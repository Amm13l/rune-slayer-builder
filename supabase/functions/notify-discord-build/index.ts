// Wird von einem Supabase Database Webhook (INSERT auf public.community_builds)
// aufgerufen. Rendert das Build als PNG (dasselbe SVG wie im Browser-Preview)
// und postet es als Discord-Embed. Faellt der Discord-Post fehl, bleibt das
// vom Upload-Flow (upload-community-build) komplett isoliert — es handelt sich
// um einen separaten, asynchronen Trigger, kein Teil des Upload-Requests.
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';
import { buildCharacterSVG } from '../../../js/character.js';
import { buildGear, classBreakdown, isBuildEmpty } from '../../../js/buildGear.js';

const RESVG_WASM_URL = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
const SITE_URL = 'https://amm13l.github.io/rune-slayer-builder';
const DISCORD_CHANNEL_ID = '1543542286967906355'; // #build-uploads

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
    if (!wasmReady) {
        wasmReady = initWasm(fetch(RESVG_WASM_URL)).then(() => undefined);
    }
    return wasmReady;
}

const EMPTY_GEAR = {
    helmet: null, chest: null, boots: null, back: null,
    weapon: null, secondWeapon: null, offhand: null,
    race: null, raceEvolution: ''
};

function gearForBuild(buildData: any) {
    return isBuildEmpty(buildData) ? EMPTY_GEAR : buildGear(buildData);
}

async function renderBuildPng(buildData: any): Promise<Uint8Array> {
    const svg = buildCharacterSVG(gearForBuild(buildData));
    await ensureWasm();
    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: 420 },
        background: 'rgba(0,0,0,0)'
    });
    return resvg.render().asPng();
}

// Discords Embed-Description-Limit liegt bei 4096 Zeichen — bei diesen Daten
// nie praktisch relevant, aber defensiv gekappt statt blind vertraut.
function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// Zweiter Button togglet einen Like ueber die discord-interactions Function —
// braucht dafuer einen echten Bot (Nachricht ueber die Bot-API gesendet),
// da ein reiner Incoming-Webhook keine application_id hat und Discord Klicks
// auf seinen Buttons nirgendwo hin routen koennte.
function buildMessageComponents(buildId: string, likesCount: number) {
    return [{
        type: 1, // Action Row
        components: [
            { type: 2, style: 5, label: 'View Build', url: `${SITE_URL}/?build=${buildId}` },
            { type: 2, style: 2, label: String(likesCount ?? 0), custom_id: `like:${buildId}`, emoji: { name: '❤️' } }
        ]
    }];
}

function buildDiscordForm(record: any, png: Uint8Array): FormData {
    const gear = gearForBuild(record.build_data);
    const embed = {
        title: truncate(record.name || 'Unnamed Build', 256),
        description: truncate(classBreakdown(record.build_data) || 'No class levels set', 4096),
        color: 0x8b5cf6,
        image: { url: 'attachment://build.png' },
        footer: { text: gear.race ? gear.race.name + (record.build_data?.raceEvolution ? ` (${record.build_data.raceEvolution})` : '') : 'No race selected' },
        timestamp: record.created_at
    };

    const form = new FormData();
    form.append('payload_json', JSON.stringify({
        embeds: [embed],
        components: buildMessageComponents(record.id, record.likes_count ?? 0),
        attachments: [{ id: '0', filename: 'build.png' }]
    }));
    form.append('files[0]', new Blob([png], { type: 'image/png' }), 'build.png');
    return form;
}

Deno.serve(async (req: Request) => {
    const expectedSecret = Deno.env.get('WEBHOOK_SHARED_SECRET');
    if (!expectedSecret || req.headers.get('x-webhook-secret') !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 });
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return new Response('Invalid JSON', { status: 400 });
    }

    if (payload.type !== 'INSERT' || payload.table !== 'community_builds') {
        return new Response('Ignored', { status: 200 });
    }

    const record = payload.record;
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!botToken) {
        console.error('DISCORD_BOT_TOKEN secret is not set');
        return new Response('Server misconfigured', { status: 500 });
    }

    try {
        const png = await renderBuildPng(record.build_data);
        const form = buildDiscordForm(record, png);
        const discordRes = await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${botToken}` },
            body: form
        });
        if (!discordRes.ok) {
            console.error('Discord post failed', discordRes.status, await discordRes.text());
            return new Response('Discord error', { status: 502 });
        }
    } catch (err) {
        console.error('notify-discord-build failed', err);
        return new Response('Internal error', { status: 500 });
    }

    return new Response('ok', { status: 200 });
});
