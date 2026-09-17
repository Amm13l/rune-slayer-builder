// Wird von einem Supabase Database Webhook (INSERT auf public.community_builds)
// aufgerufen. Rendert das Build als PNG (dasselbe SVG wie im Browser-Preview)
// und postet es als Discord-Embed. Faellt der Discord-Post fehl, bleibt das
// vom Upload-Flow (upload-community-build) komplett isoliert — es handelt sich
// um einen separaten, asynchronen Trigger, kein Teil des Upload-Requests.
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';
// Silhouette und Build-Aufloesung aus demselben Code wie der Hub, statt aus
// Kopien — der Post zeigt damit dieselbe Figur. Ueber jsDelivr und auf einen
// Commit gepinnt: Supabase' Bundler laedt nicht von github.io, und der Pin
// macht jeden Deploy reproduzierbar. Nach Aenderungen an Items oder
// Silhouetten den Hash auf den neuen Commit setzen und neu deployen.
import { buildCharacterSVG } from 'https://cdn.jsdelivr.net/gh/Amm13l/rune-slayer-builder@0b1c0f4dda275b0bdc3dfc312e696cbbdf17d218/js/character.js';
import { buildGear, classBreakdown, isBuildEmpty } from 'https://cdn.jsdelivr.net/gh/Amm13l/rune-slayer-builder@0b1c0f4dda275b0bdc3dfc312e696cbbdf17d218/js/buildGear.js';
import { buildMessageComponents, EMBED_COLOR } from '../_shared/discordBuild.ts';

// Jede Instanz startet frisch und muss die ~2,4 MB Render-Engine neu laden.
// Zuerst jsDelivr: dieselbe Datei wie bei unpkg (MD5 geprueft), aber Brotli
// statt gzip (906 statt 947 KB) und dauerhaft gecacht; gemessen 0,47–0,52 s
// gegenueber 0,56–0,96 s bei unpkg. unpkg bleibt als Ausweichquelle, damit ein
// Ausfall von jsDelivr keine Build-Posts verschluckt.
const RESVG_WASM_URLS = [
    'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm',
    'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm'
];
const DISCORD_CHANNEL_ID = '1543542286967906355'; // #build-uploads

// Nur Netz-/HTTP-Fehler fuehren zur naechsten Quelle. initWasm selbst wird
// genau einmal aufgerufen — die Bibliothek erlaubt keinen zweiten Versuch.
async function fetchWasm(): Promise<Response> {
    for (const url of RESVG_WASM_URLS) {
        try {
            const res = await fetch(url);
            if (res.ok) return res;
            console.error('resvg wasm source failed', url, res.status);
        } catch (err) {
            console.error('resvg wasm source failed', url, err);
        }
    }
    throw new Error('resvg wasm could not be downloaded from any source');
}

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
    if (!wasmReady) {
        wasmReady = initWasm(fetchWasm()).then(() => undefined);
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

// Die Buttons (👍 👎 ℹ️) verarbeitet die discord-interactions Function —
// dafuer braucht es einen echten Bot (Nachricht ueber die Bot-API gesendet),
// da ein reiner Incoming-Webhook keine application_id hat und Discord Klicks
// auf seinen Buttons nirgendwo hin routen koennte.
function buildDiscordForm(record: any, png: Uint8Array): FormData {
    const gear = gearForBuild(record.build_data);
    const embed = {
        title: truncate(record.name || 'Unnamed Build', 256),
        description: truncate(classBreakdown(record.build_data) || 'No class levels set', 4096),
        color: EMBED_COLOR,
        image: { url: 'attachment://build.png' },
        footer: { text: gear.race ? gear.race.name + (record.build_data?.raceEvolution ? ` (${record.build_data.raceEvolution})` : '') : 'No race selected' },
        timestamp: record.created_at
    };

    const form = new FormData();
    form.append('payload_json', JSON.stringify({
        embeds: [embed],
        components: buildMessageComponents(record.id, record.likes_count ?? 0, record.dislikes_count ?? 0),
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
