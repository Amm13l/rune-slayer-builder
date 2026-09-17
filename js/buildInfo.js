// Was das ℹ-Panel ueber einen Build zeigt, als reine Daten ohne DOM.
// Der Hub rendert daraus HTML (community.js), die Discord-Function ein Embed
// (discord-interactions) — beide zeigen dadurch garantiert dieselben Infos.
// Laeuft im Browser und unter Deno; die Discord-Functions importieren diese
// Datei direkt von der GitHub-Pages-Seite.
import { buildGear, classBreakdown, classEntries, resolveItem } from './buildGear.js';
import abilitiesDatabase from '../data/abilities.js';

// Reihenfolge wie im Ausruestungs-Panel: Ruestung, Waffen, dann Schmuck.
// Die Rasse fehlt bewusst — die steht im Abschnitt "Character".
export const INFO_SLOTS = [
    ['helmet', 'Helmet'],
    ['chest', 'Chest'],
    ['back', 'Back'],
    ['boots', 'Boots'],
    ['weapon1', 'Weapon 1'],
    ['offhand', 'Offhand'],
    ['weapon2', 'Weapon 2'],
    ['ring1', 'Ring 1'],
    ['ring2', 'Ring 2'],
    ['ring3', 'Ring 3'],
    ['ring4', 'Ring 4'],
    ['lantern', 'Lantern'],
    ['fairy', 'Fairy']
];

export const MAX_TOTAL_LEVEL = 50;

const RUNE_SLOT_NUMBERS = ['I', 'II', 'III', 'IV', 'V', 'VI'];

// Abilities stehen im Build nur als Name — die Rarity muss hier
// nachgeschlagen werden.
const ABILITY_BY_NAME = new Map(
    Object.values(abilitiesDatabase).map(ability => [ability.name, ability])
);

// "Seraphim (4 Wings)" — steht so auf der Kachel und im Info-Panel.
export function raceLabel(gear, buildData) {
    if (!gear.race) return '';
    return gear.race.name + (buildData.raceEvolution ? ` (${buildData.raceEvolution})` : '');
}

function evolutionLabels(buildData) {
    // Schluessel der zweiten Evolutionsstufe heissen intern "Name::tier2"
    return Object.entries(buildData.evolutions || {})
        .filter(([, choice]) => Boolean(choice))
        .map(([key, choice]) => {
            const base = key.replace('::tier2', '');
            const tier = key.endsWith('::tier2') ? ' II' : '';
            return `${base}${tier} → ${choice}`;
        })
        .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {object} build { name, description, tags, buildData, created_at,
 *                         likesCount, dislikesCount }
 * Rarities sind die Rohwerte ('common' … 'spec'); welche Farbe oder welches
 * Symbol daraus wird, entscheidet der jeweilige Renderer.
 */
export function buildInfoModel(build) {
    const buildData = build.buildData || {};
    const gear = buildGear(buildData);
    // Alte Uploads koennen Level als String gespeichert haben.
    const classes = classEntries(buildData).map(([name, level]) => ({
        name,
        level: parseInt(level) || 0,
        subclass: buildData.subclasses?.[name] || ''
    }));

    return {
        name: build.name || 'Unnamed Build',
        tags: build.tags || [],
        description: (build.description || '').trim(),
        race: gear.race
            ? { label: raceLabel(gear, buildData), rarity: gear.race.rarity || 'common' }
            : null,
        startingClass: buildData.startingClass || '',
        classBreakdown: classBreakdown(buildData),
        professionBonus: Boolean(buildData.professionBonus),
        classes,
        totalLevels: classes.reduce((sum, c) => sum + c.level, 0),
        equipment: INFO_SLOTS.flatMap(([slotKey, slot]) => {
            const entry = buildData.items?.[slotKey];
            if (!entry?.name) return [];
            return [{
                slot,
                name: entry.name,
                rarity: resolveItem(slotKey, entry.name)?.rarity || 'common',
                runes: RUNE_SLOT_NUMBERS
                    .map(n => buildData.runes?.[slotKey]?.[n]?.name)
                    .filter(Boolean)
            }];
        }),
        abilities: (buildData.abilities || []).filter(Boolean).map(name => ({
            name,
            rarity: ABILITY_BY_NAME.get(name)?.rarity || 'common'
        })),
        evolutions: evolutionLabels(buildData),
        createdAt: build.created_at || null,
        likes: build.likesCount ?? 0,
        dislikes: build.dislikesCount ?? 0
    };
}
