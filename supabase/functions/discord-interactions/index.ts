// Discord's Interactions Endpoint. Empfaengt Button-Klicks unter einem
// Build-Post (siehe _shared/discordBuild.ts):
//   like:<build_id>     Daumen hoch
//   dislike:<build_id>  Daumen runter
//   info:<build_id>     dieselben Build-Infos wie das ℹ-Panel im Hub,
//                       als ephemere Nachricht nur fuer den Klickenden
//
// Abgestimmt wird ueber cast_build_vote — dieselbe Postgres-Function wie im
// Web-Hub, damit beide Seiten nach denselben Regeln zaehlen.
import nacl from 'npm:tweetnacl@1.0.3';
// Dasselbe buildInfo.js wie der Hub, statt einer Kopie — so zeigt Discord
// garantiert dieselben Infos. Ueber jsDelivr und auf einen Commit gepinnt:
// Supabase' Bundler laedt nicht von github.io, und der Pin macht jeden
// Deploy reproduzierbar. Nach Aenderungen an Items, Runen oder Abilities den
// Hash auf den neuen Commit setzen und neu deployen.
import { buildInfoModel, MAX_TOTAL_LEVEL } from 'https://cdn.jsdelivr.net/gh/Amm13l/rune-slayer-builder@3c3223735e9505c796895ea4d63be09776f052e7/js/buildInfo.js';
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

function serviceHeaders(extra: Record<string, string> = {}) {
    return {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        ...extra
    };
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
    const signature = req.headers.get('X-Signature-Ed25519');
    const timestamp = req.headers.get('X-Signature-Timestamp');
    if (!signature || !timestamp) return false;
    return nacl.sign.detached.verify(
        new TextEncoder().encode(timestamp + rawBody),
        hexToBytes(signature),
        hexToBytes(DISCORD_PUBLIC_KEY)
    );
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
