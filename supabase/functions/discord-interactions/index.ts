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
// Geschwindigkeit: Die Datenbank steht in eu-west-1 (Irland). Supabase fuehrt
// die Function nahe am Aufrufer aus — bei Discord also in us-east-1, und jeder
// DB-Aufruf ging ueber den Atlantik (gemessen: Median 316–419 ms statt 32 ms).
// Landet ein Klick ausserhalb von eu-west-1, reicht die Function ihn deshalb
// an sich selbst in eu-west-1 weiter (forwardToHomeRegion); der Sprung selbst
// kostet ueber Supabase' Backbone nur ~50 ms. Mit ?forceFunctionRegion=eu-west-1
// in der Interactions Endpoint URL entfiele auch dieser Zwischenschritt.
// Jeder Klick startet ausserdem eine frische Instanz, Boot-Kosten zaehlen also
// bei jedem Klick — daher native Kryptografie statt einer JS-Bibliothek.

// Dasselbe buildInfo.js wie der Hub, statt einer Kopie — so zeigt Discord
// garantiert dieselben Infos. Ueber jsDelivr und auf einen Commit gepinnt:
// Supabase' Bundler laedt nicht von github.io, und der Pin macht jeden
// Deploy reproduzierbar. Nach Aenderungen an Items, Runen oder Abilities den
// Hash auf den neuen Commit setzen und neu deployen.
import { buildInfoModel, MAX_TOTAL_LEVEL } from 'https://cdn.jsdelivr.net/gh/Amm13l/rune-slayer-builder@0b1c0f4dda275b0bdc3dfc312e696cbbdf17d218/js/buildInfo.js';
import { buildMessageComponents, renderInfoEmbed } from '../_shared/discordBuild.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY')!;

const BUILDS_URL = `${SUPABASE_URL}/rest/v1/community_builds`;
const VOTE_RPC_URL = `${SUPABASE_URL}/rest/v1/rpc/cast_build_vote`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOTE_DIRECTIONS: Record<string, number> = { like: 1, dislike: -1 };

// Discord-Flag fuer "nur der Klickende sieht die Antwort".
const EPHEMERAL = 64;

const HOME_REGION = 'eu-west-1';
// Markiert weitergereichte Anfragen, damit sie nie ein zweites Mal
// weitergereicht werden — auch falls SB_REGION anders formatiert sein sollte.
const FORWARDED_HEADER = 'x-rs-forwarded';
// Discord wartet 3 s. Bleibt Luft, um bei einem Info-Klick lokal nachzuholen.
const FORWARD_TIMEOUT_MS = 1500;

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

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
    const signature = hexToBytes(req.headers.get('X-Signature-Ed25519') || '');
    const timestamp = req.headers.get('X-Signature-Timestamp');
    // Ed25519-Signaturen sind immer 64 Bytes; alles andere gar nicht erst pruefen.
    if (!signature || signature.length !== 64 || !timestamp) return false;
    try {
        return await crypto.subtle.verify(
            { name: 'Ed25519' },
            await discordPublicKey(),
            signature,
            new TextEncoder().encode(timestamp + rawBody)
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

// Direkt per RPC statt ueber toggle-community-build-like: die Function haengt
// ihr Rate-Limit an der Anfrager-IP auf, die hier (Server-zu-Server-Aufruf
// via Discord) fuer jeden Discord-Nutzer identisch waere. Jeder Discord-Account
// hat ohnehin genau eine Stimme pro Build.
// Liefert null, wenn es den Build nicht mehr gibt.
async function castVote(buildId: string, identityHash: string, direction: number) {
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
async function fetchCounts(buildId: string) {
    const res = await fetch(`${BUILDS_URL}?select=likes_count,dislikes_count&id=eq.${buildId}`, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`Count lookup failed (${res.status})`);
    const rows = await res.json();
    return rows[0] ? { likes: rows[0].likes_count ?? 0, dislikes: rows[0].dislikes_count ?? 0 } : null;
}

function shouldForward(req: Request): boolean {
    const region = Deno.env.get('SB_REGION');
    // Ohne bekannte Region lieber hier bearbeiten: langsam, aber sicher richtig.
    return Boolean(region) && !region!.includes(HOME_REGION) && !req.headers.has(FORWARDED_HEADER);
}

/* Reicht einen bereits verifizierten Klick an diese Function in eu-west-1
   weiter. Die Signatur-Header gehen unveraendert mit, dort wird erneut
   geprueft.

   Wichtig ist, was bei einem Fehler passiert: Eine Stimme ist ein Umschalter
   und darf auf keinen Fall doppelt gezaehlt werden.
     'done'   Antwort aus eu-west-1 liegt vor -> durchreichen.
     'unsent' eu-west-1 hat mit 4xx abgelehnt, also nichts getan (Signatur,
              Routing) -> hier gefahrlos selbst bearbeiten.
     'unsure' Timeout, Netzfehler, 5xx -> die Stimme KOENNTE schon gezaehlt
              sein. Nicht wiederholen. */
type ForwardResult =
    | { outcome: 'done'; response: Response }
    | { outcome: 'unsent' | 'unsure' };

async function forwardToHomeRegion(req: Request, rawBody: string): Promise<ForwardResult> {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/discord-interactions?forceFunctionRegion=${HOME_REGION}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature-Ed25519': req.headers.get('X-Signature-Ed25519') || '',
                'X-Signature-Timestamp': req.headers.get('X-Signature-Timestamp') || '',
                [FORWARDED_HEADER]: '1'
            },
            body: rawBody,
            signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS)
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

Deno.serve(async (req: Request) => {
    const rawBody = await req.text();

    if (!(await verifySignature(req, rawBody))) {
        return new Response('Invalid request signature', { status: 401 });
    }

    const interaction = JSON.parse(rawBody);

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

    if (shouldForward(req)) {
        const forwarded = await forwardToHomeRegion(req, rawBody);
        if (forwarded.outcome === 'done') return forwarded.response;

        // Stimme mit unklarem Ausgang: nicht nochmal abstimmen, sondern den
        // tatsaechlichen Stand zeigen. Info ist nur lesend und darf unten
        // ganz normal lokal nachgeholt werden.
        if (forwarded.outcome === 'unsure' && action !== 'info') {
            try {
                const counts = await fetchCounts(buildId);
                if (!counts) return ephemeral('This build no longer exists.');
                return Response.json({
                    type: 7, // UPDATE_MESSAGE
                    data: { components: buildMessageComponents(buildId, counts.likes, counts.dislikes) }
                });
            } catch (err) {
                console.error('count refresh failed', err);
                return ephemeral('Could not confirm your vote — check the counter and try again.');
            }
        }
    }

    if (action === 'info') {
        try {
            const row = await fetchBuild(buildId);
            if (!row) return ephemeral('This build no longer exists.');

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

    const discordUserId = interaction.member?.user?.id || interaction.user?.id;
    if (!discordUserId) {
        return ephemeral('Could not identify Discord user.');
    }

    try {
        const identityHash = await hashIdentity(discordUserId);
        const counts = await castVote(buildId, identityHash, VOTE_DIRECTIONS[action]);
        if (!counts) return ephemeral('This build no longer exists.');

        // Ersetzt die ganze Button-Reihe. Bei alten Posts mit ❤️-Button
        // wird die Nachricht so beim ersten Klick auf 👍/👎/ℹ️ umgestellt.
        return Response.json({
            type: 7, // UPDATE_MESSAGE
            data: { components: buildMessageComponents(buildId, counts.likes, counts.dislikes) }
        });
    } catch (err) {
        console.error('vote failed', err);
        return ephemeral('Failed to update vote — try again.');
    }
});
