// Discord's Interactions Endpoint. Empfaengt Button-Klicks unter einem
// Build-Post (siehe _shared/discordBuild.ts):
//   like:<build_id>     Daumen hoch
//   dislike:<build_id>  Daumen runter
//   info:<build_id>     dieselben Build-Infos wie das ℹ-Panel im Hub,
//                       als ephemere Nachricht nur fuer den Klickenden
//
// Abgestimmt wird ueber cast_build_vote — dieselbe Postgres-Function wie im
// Web-Hub, damit beide Seiten nach denselben Regeln zaehlen.
//
// Tempo (gemessen in den Produktions-Logs):
//   - Die Datenbank steht in eu-west-1. Supabase fuehrt die Function nahe am
//     Aufrufer aus, bei Discord also in us-east-1, wo jeder DB-Aufruf Median
//     316–419 ms statt 32 ms braucht. Klicks werden deshalb an diese Function
//     in eu-west-1 weitergereicht.
//   - Jede Anfrage bekommt eine frische Instanz (~105–120 ms Plattformzeit),
//     eine korrekte Antwort liegt damit bei ~300–400 ms.
//   - Stimmen erscheinen deshalb sofort als Vorhersage: die Zaehler aus den
//     Buttons der geklickten Nachricht, +1 auf der geklickten Seite. Die echte
//     Stimme laeuft danach im Hintergrund (EdgeRuntime.waitUntil haelt die
//     Instanz am Leben). Weicht das Ergebnis ab — Stimme zurueckgenommen,
//     umgeschwenkt, Zaehler veraltet —, wird die Nachricht korrigiert.

// Dasselbe buildInfo.js wie der Hub, statt einer Kopie — so zeigt Discord
// garantiert dieselben Infos. Ueber jsDelivr und auf einen Commit gepinnt:
// Supabase' Bundler laedt nicht von github.io, und der Pin macht jeden
// Deploy reproduzierbar. Nach Aenderungen an Items, Runen oder Abilities den
// Hash auf den neuen Commit setzen und neu deployen.
import { buildInfoModel, MAX_TOTAL_LEVEL } from 'https://cdn.jsdelivr.net/gh/Amm13l/rune-slayer-builder@0b1c0f4dda275b0bdc3dfc312e696cbbdf17d218/js/buildInfo.js';
import { buildMessageComponents, renderInfoEmbed } from '../_shared/discordBuild.ts';

// Global der Supabase Edge Runtime; fehlt ausserhalb davon (z.B. lokal).
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY')!;

const BUILDS_URL = `${SUPABASE_URL}/rest/v1/community_builds`;
const VOTE_RPC_URL = `${SUPABASE_URL}/rest/v1/rpc/cast_build_vote`;
const DISCORD_API = 'https://discord.com/api/v10';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOTE_DIRECTIONS: Record<string, number> = { like: 1, dislike: -1 };

// Discord-Flag fuer "nur der Klickende sieht die Antwort".
const EPHEMERAL = 64;

const HOME_REGION = 'eu-west-1';
// Markiert weitergereichte Anfragen, damit sie nie ein zweites Mal
// weitergereicht werden. Der Wert sagt, was zurueckkommen soll: bei 'vote'
// nur das Ergebnis der Stimme (VoteResult), sonst die fertige Discord-Antwort.
const FORWARDED_HEADER = 'x-rs-forwarded';
// Solange Discord auf die Antwort wartet (3 s), bleibt so Luft zum lokalen
// Nachholen. Im Hintergrund darf eu-west-1 laenger brauchen.
const FORWARD_TIMEOUT_MS = 1500;
const BACKGROUND_FORWARD_TIMEOUT_MS = 8000;
// Korrekturen erst, wenn Discord die Sofort-Antwort sicher verbucht hat —
// sonst koennte die spaeter angewandte Vorhersage die echte Zahl ueberschreiben.
const CORRECTION_DELAY_MS = 300;

const MSG_BUILD_GONE = 'This build no longer exists.';
const MSG_VOTE_FAILED = 'Your vote could not be saved — try again.';
const MSG_VOTE_UNCONFIRMED = 'Could not confirm your vote — check the counter and try again.';
const MSG_COUNTER_MAY_BE_OFF = 'Could not confirm your vote — the counter may be off. Try again in a moment.';

type Counts = { likes: number; dislikes: number };

/* Ausgang einer Stimme:
     counted  gezaehlt, Zaehler danach bekannt
     unsure   Weiterleitung mit unklarem Ausgang — die Stimme KOENNTE gezaehlt
              sein; wenn moeglich mit frisch gelesenen Zaehlern
     gone     Build existiert nicht mehr, nichts gezaehlt
     failed   nicht gezaehlt */
type VoteResult =
    | ({ result: 'counted' } & Counts)
    | ({ result: 'unsure' } & Partial<Counts>)
    | { result: 'gone' }
    | { result: 'failed' };

// Die signierte Anfrage, wie sie von Discord kam — so wird sie weitergereicht.
type SignedRequest = { signature: string; timestamp: string; rawBody: string };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));

function serviceHeaders(extra: Record<string, string> = {}) {
    return {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        ...extra
    };
}

const HEX_RE = /^[0-9a-f]*$/i;

function hexToBytes(hex: string): Uint8Array | null {
    if (hex.length % 2 !== 0 || !HEX_RE.test(hex)) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

/* Ed25519 ueber WebCrypto statt tweetnacl: nativ statt reinem JS (lokal
   gemessen 0,15 ms statt 5,5 ms pro Pruefung, im frischen Prozess ~3 statt
   ~8 ms) und ein npm-Paket weniger, das jede frische Instanz laden muss.
   Der Schluessel wird einmal pro Instanz importiert. */
let publicKeyPromise: Promise<CryptoKey> | null = null;
function discordPublicKey(): Promise<CryptoKey> {
    if (!publicKeyPromise) {
        const raw = hexToBytes(DISCORD_PUBLIC_KEY);
        publicKeyPromise = raw
            ? crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify'])
            : Promise.reject(new Error('DISCORD_PUBLIC_KEY is not valid hex'));
    }
    return publicKeyPromise;
}

async function verifySignature(signed: SignedRequest): Promise<boolean> {
    const signature = hexToBytes(signed.signature);
    // Ed25519-Signaturen sind immer 64 Bytes; alles andere gar nicht erst pruefen.
    if (!signature || signature.length !== 64 || !signed.timestamp) return false;
    try {
        return await crypto.subtle.verify(
            { name: 'Ed25519' },
            await discordPublicKey(),
            signature,
            new TextEncoder().encode(signed.timestamp + signed.rawBody)
        );
    } catch (err) {
        console.error('signature check failed', err);
        return false;
    }
}

async function hashIdentity(discordUserId: string): Promise<string> {
    const bytes = new TextEncoder().encode(`discord:${discordUserId}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function ephemeral(content: string) {
    return Response.json({ type: 4, data: { content, flags: EPHEMERAL } });
}

function updateMessage(buildId: string, counts: Counts) {
    return Response.json({
        type: 7, // UPDATE_MESSAGE
        data: { components: buildMessageComponents(buildId, counts.likes, counts.dislikes) }
    });
}

// Direkt per RPC statt ueber toggle-community-build-like: die Function haengt
// ihr Rate-Limit an der Anfrager-IP auf, die hier (Server-zu-Server-Aufruf
// via Discord) fuer jeden Discord-Nutzer identisch waere. Jeder Discord-Account
// hat ohnehin genau eine Stimme pro Build.
// Liefert null, wenn es den Build nicht mehr gibt.
async function castVote(buildId: string, identityHash: string, direction: number): Promise<Counts | null> {
    const res = await fetch(VOTE_RPC_URL, {
        method: 'POST',
        headers: serviceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ p_build_id: buildId, p_voter_hash: identityHash, p_vote: direction })
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // 23503: Fremdschluessel verletzt — Build wurde inzwischen geloescht.
        if (body?.code === '23503') return null;
        throw new Error(`cast_build_vote failed (${res.status}) ${JSON.stringify(body)}`);
    }
    const rows = await res.json();
    if (!rows.length) return null;
    return { likes: rows[0].likes_count ?? 0, dislikes: rows[0].dislikes_count ?? 0 };
}

async function fetchBuild(buildId: string) {
    const columns = 'id,name,description,tags,created_at,build_data,likes_count,dislikes_count';
    const res = await fetch(`${BUILDS_URL}?select=${columns}&id=eq.${buildId}`, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`Build lookup failed (${res.status})`);
    const rows = await res.json();
    return rows[0] || null;
}

// Nur lesen — fuer den Fall, dass unklar ist, ob eine Stimme schon gezaehlt wurde.
async function fetchCounts(buildId: string): Promise<Counts | null> {
    const res = await fetch(`${BUILDS_URL}?select=likes_count,dislikes_count&id=eq.${buildId}`, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`Count lookup failed (${res.status})`);
    const rows = await res.json();
    return rows[0] ? { likes: rows[0].likes_count ?? 0, dislikes: rows[0].dislikes_count ?? 0 } : null;
}

function outsideHomeRegion(): boolean {
    const region = Deno.env.get('SB_REGION');
    // Ohne bekannte Region lieber hier bearbeiten: langsamer, aber sicher richtig.
    return Boolean(region) && !region!.includes(HOME_REGION);
}

/* Reicht einen bereits verifizierten Klick an diese Function in eu-west-1
   weiter. Die Signatur-Header gehen unveraendert mit, dort wird erneut
   geprueft. Fuer Stimmen zaehlt, was bei einem Fehler passiert:
     'done'   Antwort aus eu-west-1 liegt vor.
     'unsent' eu-west-1 hat mit 4xx abgelehnt, also nichts getan (Signatur,
              Routing) -> hier gefahrlos selbst bearbeiten.
     'unsure' Timeout, Netzfehler, 5xx -> die Stimme KOENNTE schon gezaehlt
              sein. Nicht wiederholen. */
type ForwardResult =
    | { outcome: 'done'; response: Response }
    | { outcome: 'unsent' | 'unsure' };

async function forwardToHomeRegion(
    mode: 'vote' | 'discord', signed: SignedRequest, timeoutMs: number
): Promise<ForwardResult> {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/discord-interactions?forceFunctionRegion=${HOME_REGION}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature-Ed25519': signed.signature,
                'X-Signature-Timestamp': signed.timestamp,
                [FORWARDED_HEADER]: mode
            },
            body: signed.rawBody,
            signal: AbortSignal.timeout(timeoutMs)
        });
        if (res.ok) {
            // Nur den dekodierten Text uebernehmen, keine Header wie
            // Content-Encoding — die wuerden nicht mehr zum Inhalt passen.
            const text = await res.text();
            return {
                outcome: 'done',
                response: new Response(text, {
                    status: res.status,
                    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' }
                })
            };
        }
        console.error('forward to home region answered', res.status);
        return { outcome: res.status < 500 ? 'unsent' : 'unsure' };
    } catch (err) {
        console.error('forward to home region failed', err);
        return { outcome: 'unsure' };
    }
}

// Stimme in dieser Region zaehlen.
async function voteHere(buildId: string, discordUserId: string, direction: number): Promise<VoteResult> {
    try {
        const counts = await castVote(buildId, await hashIdentity(discordUserId), direction);
        return counts ? { result: 'counted', ...counts } : { result: 'gone' };
    } catch (err) {
        console.error('vote failed', err);
        return { result: 'failed' };
    }
}

function isVoteResult(value: any): value is VoteResult {
    if (!value || typeof value.result !== 'string') return false;
    if (value.result === 'counted') return Number.isInteger(value.likes) && Number.isInteger(value.dislikes);
    return ['unsure', 'gone', 'failed'].includes(value.result);
}

// Stimme in eu-west-1 zaehlen lassen, ohne je doppelt abzustimmen.
async function voteInHomeRegion(
    signed: SignedRequest, buildId: string, discordUserId: string, direction: number, timeoutMs: number
): Promise<VoteResult> {
    const forwarded = await forwardToHomeRegion('vote', signed, timeoutMs);
    if (forwarded.outcome === 'done') {
        const result = await forwarded.response.json().catch(() => null);
        if (isVoteResult(result)) return result;
        console.error('unexpected vote result from home region', result);
    } else if (forwarded.outcome === 'unsent') {
        return voteHere(buildId, discordUserId, direction);
    }
    // Unklar: nur noch lesen und den echten Stand zeigen.
    try {
        const counts = await fetchCounts(buildId);
        return counts ? { result: 'unsure', ...counts } : { result: 'gone' };
    } catch (err) {
        console.error('count refresh failed', err);
        return { result: 'unsure' };
    }
}

// Discord-Antwort, wenn auf das echte Ergebnis gewartet wurde.
function voteResponse(buildId: string, vote: VoteResult): Response {
    switch (vote.result) {
        case 'counted':
            return updateMessage(buildId, vote);
        case 'unsure':
            return vote.likes !== undefined && vote.dislikes !== undefined
                ? updateMessage(buildId, { likes: vote.likes, dislikes: vote.dislikes })
                : ephemeral(MSG_VOTE_UNCONFIRMED);
        case 'gone':
            return ephemeral(MSG_BUILD_GONE);
        default:
            return ephemeral(MSG_VOTE_FAILED);
    }
}

/* Aktuelle Zaehler aus den Buttons der geklickten Nachricht — die Grundlage
   fuer die Vorhersage. Posts aus der Herz-Zeit haben nur den like:-Button;
   deren Dislikes zaehlen als 0 und werden im Hintergrund korrigiert.
   null = nicht lesbar, dann wird auf das echte Ergebnis gewartet. */
function countsFromMessage(message: any, buildId: string): Counts | null {
    const rows = Array.isArray(message?.components) ? message.components : [];
    const buttons = rows.flatMap((row: any) => Array.isArray(row?.components) ? row.components : []);
    const read = (action: string): number | null | undefined => {
        const button = buttons.find((b: any) => b?.custom_id === `${action}:${buildId}`);
        if (!button) return undefined;
        const n = Number(button.label);
        return typeof button.label === 'string' && Number.isSafeInteger(n) && n >= 0 ? n : null;
    };
    const likes = read('like');
    const dislikes = read('dislike');
    if (typeof likes !== 'number' || dislikes === null) return null;
    return { likes, dislikes: dislikes ?? 0 };
}

// Annahme: neue Stimme. Stimmt beim ersten Klick; sonst korrigiert
// reconcileVote, sobald das echte Ergebnis da ist.
function predictCounts(current: Counts, direction: number): Counts {
    return direction === 1
        ? { likes: current.likes + 1, dislikes: current.dislikes }
        : { likes: current.likes, dislikes: current.dislikes + 1 };
}

function interactionWebhook(interaction: any): string | null {
    const appId = String(interaction?.application_id ?? '');
    const token = String(interaction?.token ?? '');
    if (!/^\d+$/.test(appId) || !/^[\w.-]+$/.test(token)) return null;
    return `${DISCORD_API}/webhooks/${appId}/${token}`;
}

/* Laeuft ueber den Interaction-Token (15 Minuten gueltig), kein Bot-Token.
   '/messages/@original' ist bei Button-Klicks die Nachricht mit den Buttons.
   Ein zweiter Versuch bei 404 (Discord hat die Sofort-Antwort noch nicht
   verbucht) und 429 (Rate-Limit). */
async function callWebhook(webhook: string, method: 'PATCH' | 'POST', path: string, payload: unknown) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await fetch(webhook + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            await res.body?.cancel();
            return;
        }
        const body = await res.json().catch(() => ({}));
        if (attempt === 2 || (res.status !== 404 && res.status !== 429)) {
            console.error(`${method} interaction webhook failed`, res.status, JSON.stringify(body));
            return;
        }
        const retryAfterMs = Number(body?.retry_after) * 1000;
        await sleep(res.status === 429 && retryAfterMs > 0 ? Math.min(retryAfterMs, 3000) : 500);
    }
}

const sameCounts = (a: Counts, b: Counts) => a.likes === b.likes && a.dislikes === b.dislikes;

// Hintergrund-Teil der Sofort-Anzeige: echte Stimme, dann ggf. korrigieren.
async function reconcileVote(job: {
    webhook: string;
    buildId: string;
    cast: () => Promise<VoteResult>;
    shown: Counts;   // die Vorhersage, die Discord gerade anzeigt
    before: Counts;  // Stand vor dem Klick
    respondedAt: number;
}) {
    try {
        const vote = await job.cast();
        let counts: Counts | null = null;
        let notice: string | null = null;
        if (vote.result === 'counted') {
            counts = vote;
        } else if (vote.result === 'unsure') {
            if (vote.likes !== undefined && vote.dislikes !== undefined) {
                counts = { likes: vote.likes, dislikes: vote.dislikes };
            } else {
                notice = MSG_COUNTER_MAY_BE_OFF;
            }
        } else {
            // Nicht gezaehlt: Vorhersage zuruecknehmen und Bescheid geben.
            counts = job.before;
            notice = vote.result === 'gone' ? MSG_BUILD_GONE : MSG_VOTE_FAILED;
        }

        const correction = counts && !sameCounts(counts, job.shown) ? counts : null;
        if (!correction && !notice) return;

        await sleep(job.respondedAt + CORRECTION_DELAY_MS - Date.now());
        if (correction) {
            await callWebhook(job.webhook, 'PATCH', '/messages/@original', {
                components: buildMessageComponents(job.buildId, correction.likes, correction.dislikes)
            });
        }
        if (notice) {
            await callWebhook(job.webhook, 'POST', '', {
                content: notice, flags: EPHEMERAL, allowed_mentions: { parse: [] }
            });
        }
    } catch (err) {
        console.error('reconciling vote failed', err);
    }
}

async function infoResponse(buildId: string): Promise<Response> {
    try {
        const row = await fetchBuild(buildId);
        if (!row) return ephemeral(MSG_BUILD_GONE);

        const model = buildInfoModel({
            name: row.name,
            description: row.description,
            tags: row.tags,
            buildData: row.build_data,
            created_at: row.created_at,
            likesCount: row.likes_count,
            dislikesCount: row.dislikes_count
        });

        return Response.json({
            type: 4,
            data: {
                flags: EPHEMERAL,
                embeds: [renderInfoEmbed(model, { buildId, maxTotalLevels: MAX_TOTAL_LEVEL })],
                allowed_mentions: { parse: [] }
            }
        });
    } catch (err) {
        console.error('info failed', err);
        return ephemeral('Failed to load build info — try again.');
    }
}

Deno.serve(async (req: Request) => {
    const signed: SignedRequest = {
        signature: req.headers.get('X-Signature-Ed25519') || '',
        timestamp: req.headers.get('X-Signature-Timestamp') || '',
        rawBody: await req.text()
    };

    if (!(await verifySignature(signed))) {
        return new Response('Invalid request signature', { status: 401 });
    }

    const interaction = JSON.parse(signed.rawBody);

    // PING — Discord schickt das beim Speichern der Interactions Endpoint URL.
    if (interaction.type === 1) {
        return Response.json({ type: 1 });
    }

    // MESSAGE_COMPONENT (Button-Klick)
    if (interaction.type !== 3) {
        return new Response('Unhandled interaction', { status: 400 });
    }

    const [action, buildId] = String(interaction.data?.custom_id || '').split(':');
    // hasOwn statt `in`: "toString" & Co. stehen sonst ueber den Prototyp drin.
    if (!Object.hasOwn(VOTE_DIRECTIONS, action) && action !== 'info') {
        return new Response('Unhandled interaction', { status: 400 });
    }
    if (!UUID_RE.test(buildId || '')) {
        return ephemeral('Invalid build.');
    }

    const forwardedAs = req.headers.get(FORWARDED_HEADER);
    const remote = !forwardedAs && outsideHomeRegion();

    if (action === 'info') {
        if (remote) {
            const forwarded = await forwardToHomeRegion('discord', signed, FORWARD_TIMEOUT_MS);
            if (forwarded.outcome === 'done') return forwarded.response;
            // Info ist nur lesend: bei jedem Fehler einfach hier nachholen.
        }
        return infoResponse(buildId);
    }

    const discordUserId = interaction.member?.user?.id || interaction.user?.id;
    if (!discordUserId) {
        return ephemeral('Could not identify Discord user.');
    }
    const direction = VOTE_DIRECTIONS[action];

    // Aus einer anderen Region weitergereicht: nur das Ergebnis zurueckgeben.
    if (forwardedAs === 'vote') {
        return Response.json(await voteHere(buildId, discordUserId, direction));
    }

    const cast = (timeoutMs: number) => remote
        ? voteInHomeRegion(signed, buildId, discordUserId, direction, timeoutMs)
        : voteHere(buildId, discordUserId, direction);

    // Sofort-Anzeige: Vorhersage jetzt, echte Stimme im Hintergrund.
    const before = countsFromMessage(interaction.message, buildId);
    const webhook = interactionWebhook(interaction);
    if (before && webhook && typeof EdgeRuntime !== 'undefined') {
        const shown = predictCounts(before, direction);
        EdgeRuntime.waitUntil(reconcileVote({
            webhook, buildId, shown, before,
            cast: () => cast(BACKGROUND_FORWARD_TIMEOUT_MS),
            respondedAt: Date.now()
        }));
        return updateMessage(buildId, shown);
    }

    // Zaehler nicht lesbar oder keine Edge Runtime: auf das echte Ergebnis warten.
    return voteResponse(buildId, await cast(FORWARD_TIMEOUT_MS));
});
