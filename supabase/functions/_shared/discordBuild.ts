// Discord-Darstellung eines Community-Builds, geteilt von notify-discord-build
// (neuer Post) und discord-interactions (Button-Klicks). Bewusst rein: keine
// Deno-, Netz- oder Import-Abhaengigkeiten, damit es sich lokal mit Node
// testen laesst. Das Info-Modell kommt fertig aus js/buildInfo.js.

export const SITE_URL = 'https://amm13l.github.io/rune-slayer-builder';
export const EMBED_COLOR = 0x8b5cf6;

// Harte Discord-Grenzen fuer Embeds.
const LIMIT_TITLE = 256;
const LIMIT_DESCRIPTION = 4096;
const LIMIT_FIELD_VALUE = 1024;
const LIMIT_FOOTER = 2048;
const LIMIT_TOTAL = 6000;
const LIMIT_FIELDS = 25;

// Discord-Text kennt keine Farben. Der Hub zeigt die Rarity nur ueber die
// Schriftfarbe — hier steht sie deshalb als farbiges Quadrat davor, in
// derselben Farbfolge wie RARITY_COLORS in js/character.js.
const RARITY_MARKERS: Record<string, string> = {
    common: '⬜',
    uncommon: '🟩',
    rare: '🟦',
    epic: '🟪',
    legendary: '🟧',
    spec: '🟥'
};

export interface InfoModel {
    name: string;
    tags: string[];
    description: string;
    race: { label: string; rarity: string } | null;
    startingClass: string;
    classBreakdown: string;
    professionBonus: boolean;
    classes: { name: string; level: number; subclass: string }[];
    totalLevels: number;
    equipment: { slot: string; name: string; rarity: string; runes: string[] }[];
    abilities: { name: string; rarity: string }[];
    evolutions: string[];
    createdAt: string | null;
    likes: number;
    dislikes: number;
}

/* Die Button-Reihe unter jedem Build-Post. custom_ids tragen die Build-ID,
   damit discord-interactions ohne Nachschlagen weiss, worum es geht.
   `like:` ist absichtlich derselbe Praefix wie beim alten Herz-Button: ein
   Klick auf ein altes ❤️ landet im Like-Handler und ersetzt die Reihe
   dabei gleich durch diese hier. */
export function buildMessageComponents(buildId: string, likes: number, dislikes: number) {
    return [{
        type: 1, // Action Row
        components: [
            { type: 2, style: 5, label: 'View Build', url: `${SITE_URL}/?build=${buildId}` },
            { type: 2, style: 2, label: String(likes ?? 0), custom_id: `like:${buildId}`, emoji: { name: '👍' } },
            { type: 2, style: 2, label: String(dislikes ?? 0), custom_id: `dislike:${buildId}`, emoji: { name: '👎' } },
            { type: 2, style: 2, custom_id: `info:${buildId}`, emoji: { name: 'ℹ️' } }
        ]
    }];
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// Nutzertext (Name, Beschreibung) soll so erscheinen wie im Hub, also ohne
// dass * oder _ ploetzlich fett/kursiv machen. Zeilenanfaenge extra, weil
// #, > und - dort Ueberschrift, Zitat bzw. Liste ausloesen.
function esc(text: string): string {
    return text
        .replace(/([\\*_~|`\[\]])/g, '\\$1')
        .replace(/^(\s*)([#>-])/gm, '$1\\$2');
}

function marker(rarity: string): string {
    return RARITY_MARKERS[rarity] || RARITY_MARKERS.common;
}

/* Verteilt Bloecke auf mehrere Feld-Werte, statt mitten in einer Zeile
   abzuschneiden. Ein Block (z.B. Item + seine Runen) bleibt zusammen. */
function chunk(blocks: string[], separator: string): string[] {
    const values: string[] = [];
    let current = '';
    for (const raw of blocks) {
        const block = truncate(raw, LIMIT_FIELD_VALUE);
        const next = current ? current + separator + block : block;
        if (next.length > LIMIT_FIELD_VALUE) {
            values.push(current);
            current = block;
        } else {
            current = next;
        }
    }
    if (current) values.push(current);
    return values;
}

/**
 * Dieselben Abschnitte wie das ℹ-Panel im Hub (community.js), in derselben
 * Reihenfolge. Geht als ephemere Antwort raus — sieht also nur, wer klickt.
 */
export function renderInfoEmbed(
    model: InfoModel,
    { buildId, maxTotalLevels }: { buildId: string; maxTotalLevels: number }
) {
    const fields: { name: string; value: string }[] = [];
    const add = (name: string, values: string[]) =>
        values.forEach((value, i) => fields.push({ name: i === 0 ? name : `${name} (cont.)`, value }));

    add('Character', [[
        `**Race:** ${model.race ? `${marker(model.race.rarity)} ${esc(model.race.label)}` : 'None'}`,
        `**First class picked:** ${model.startingClass ? esc(model.startingClass) : 'Not set'}`,
        `**Classes:** ${model.classBreakdown ? esc(model.classBreakdown) : 'No class levels set'}`,
        `**Level 60 professions:** ${model.professionBonus ? 'Included' : 'Not included'}`
    ].join('\n')]);

    if (model.classes.length) {
        add('Class Levels', chunk([
            ...model.classes.map(c =>
                `${esc(c.name)} · Lv ${c.level}${c.subclass ? ` — ${esc(c.subclass)}` : ''}`),
            `**Total:** ${model.totalLevels}/${maxTotalLevels} levels`
        ], '\n'));
    } else {
        add('Class Levels', ['*No class levels set.*']);
    }

    if (model.equipment.length) {
        add('Equipment', chunk(model.equipment.map(item => {
            const head = `**${item.slot}** · ${marker(item.rarity)} ${esc(item.name)}`;
            return item.runes.length
                ? `${head}\n╰ *${item.runes.map(esc).join(' · ')}*`
                : head;
        }), '\n'));
    } else {
        add('Equipment', ['*Nothing equipped.*']);
    }

    if (model.abilities.length) {
        add('Equipped Abilities', chunk(
            model.abilities.map(a => `${marker(a.rarity)} ${esc(a.name)}`), ' · '));
    }

    if (model.evolutions.length) {
        add('Ability Evolutions', chunk(model.evolutions.map(esc), '\n'));
    }

    const buildUrl = `${SITE_URL}/?build=${buildId}`;
    const tagLine = model.tags.length ? model.tags.map(t => `\`${t}\``).join(' ') + '\n\n' : '';
    const title = truncate(model.name, LIMIT_TITLE);
    const description = truncate(
        tagLine + (model.description ? esc(model.description) : '*No description provided.*'),
        LIMIT_DESCRIPTION
    );
    const footerText = truncate(`👍 ${model.likes} · 👎 ${model.dislikes} · Uploaded`, LIMIT_FOOTER);

    /* Discord lehnt ein Embed ueber 6000 Zeichen komplett ab — der Klick
       endet dann in "Interaction failed". Echte Builds kommen nicht mal in
       die Naehe (Beschreibung max. 500 Zeichen), aber falls doch: von hinten
       Felder weglassen (Evolutions, Abilities, …) und auf die Website
       verweisen. Beschreibung und Kern-Infos bleiben so immer sichtbar. */
    const moreField = { name: 'More', value: `Too much to fit here — [open the full build](${buildUrl})` };
    const size = (list: { name: string; value: string }[]) =>
        title.length + description.length + footerText.length
        + list.reduce((n, f) => n + f.name.length + f.value.length, 0);

    let shown = fields.slice(0, LIMIT_FIELDS);
    if (shown.length < fields.length || size(shown) > LIMIT_TOTAL) {
        while (shown.length > 1 && (size([...shown, moreField]) > LIMIT_TOTAL || shown.length + 1 > LIMIT_FIELDS)) {
            shown = shown.slice(0, -1);
        }
        shown = [...shown, moreField];
    }

    return {
        title,
        url: buildUrl,
        color: EMBED_COLOR,
        description,
        fields: shown,
        footer: { text: footerText },
        ...(model.createdAt ? { timestamp: model.createdAt } : {})
    };
}
