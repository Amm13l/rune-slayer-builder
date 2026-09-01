// Discord's Interactions Endpoint. Empfaengt Button-Klicks (custom_id
// "like:<build_id>"), togglet den Like direkt in community_build_likes
// (derselbe Trigger wie beim Web-Like haelt community_builds.likes_count
// aktuell) und aktualisiert den Zaehler im Button per UPDATE_MESSAGE-Antwort.
import nacl from 'npm:tweetnacl@1.0.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DISCORD_PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY')!;

const LIKES_URL = `${SUPABASE_URL}/rest/v1/community_build_likes`;
const BUILDS_URL = `${SUPABASE_URL}/rest/v1/community_builds`;

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

// Insert/Delete direkt statt ueber toggle-community-build-like: die Function
// haengt ihr Rate-Limit an der Anfrager-IP auf, die hier (Server-zu-Server-Aufruf
// via Discord) fuer jeden Discord-Nutzer identisch waere.
async function toggleLike(buildId: string, identityHash: string): Promise<{ liked: boolean; likesCount: number }> {
    const existingRes = await fetch(
        `${LIKES_URL}?select=id&build_id=eq.${buildId}&ip_hash=eq.${identityHash}`,
        { headers: serviceHeaders() }
    );
    if (!existingRes.ok) throw new Error(`Lookup failed (${existingRes.status})`);
    const existing = await existingRes.json();

    let liked: boolean;
    if (existing.length > 0) {
        const delRes = await fetch(
            `${LIKES_URL}?build_id=eq.${buildId}&ip_hash=eq.${identityHash}`,
            { method: 'DELETE', headers: serviceHeaders() }
        );
        if (!delRes.ok) throw new Error(`Unlike failed (${delRes.status})`);
        liked = false;
    } else {
        const insRes = await fetch(LIKES_URL, {
            method: 'POST',
            headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
            body: JSON.stringify({ build_id: buildId, ip_hash: identityHash })
        });
        if (!insRes.ok) throw new Error(`Like failed (${insRes.status})`);
        liked = true;
    }

    const countRes = await fetch(
        `${BUILDS_URL}?select=likes_count&id=eq.${buildId}`,
        { headers: serviceHeaders() }
    );
    if (!countRes.ok) throw new Error(`Count lookup failed (${countRes.status})`);
    const rows = await countRes.json();
    return { liked, likesCount: rows[0]?.likes_count ?? 0 };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (interaction.type === 3 && interaction.data?.custom_id?.startsWith('like:')) {
        const buildId = interaction.data.custom_id.slice('like:'.length);
        if (!UUID_RE.test(buildId)) {
            return Response.json({ type: 4, data: { content: 'Invalid build.', flags: 64 } });
        }

        const discordUserId = interaction.member?.user?.id || interaction.user?.id;
        if (!discordUserId) {
            return Response.json({ type: 4, data: { content: 'Could not identify Discord user.', flags: 64 } });
        }

        try {
            const identityHash = await hashIdentity(discordUserId);
            const { likesCount } = await toggleLike(buildId, identityHash);

            const originalRow = interaction.message?.components?.[0]?.components ?? [];
            const linkButton = originalRow.find((c: any) => c.style === 5);

            return Response.json({
                type: 7, // UPDATE_MESSAGE
                data: {
                    components: [{
                        type: 1,
                        components: [
                            ...(linkButton ? [linkButton] : []),
                            { type: 2, style: 2, label: String(likesCount), custom_id: `like:${buildId}`, emoji: { name: '❤️' } }
                        ]
                    }]
                }
            });
        } catch (err) {
            console.error('toggleLike failed', err);
            return Response.json({ type: 4, data: { content: 'Failed to update like — try again.', flags: 64 } });
        }
    }

    return new Response('Unhandled interaction', { status: 400 });
});
