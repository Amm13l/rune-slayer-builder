// Reine Build-Data -> Gear-Aufloesung, ohne DOM-Abhaengigkeit.
// Wird sowohl vom Community Hub (Browser) als auch von der
// Discord-Notify Edge Function (Deno) importiert.
import itemsDatabase from '../data/items.js';

// slot-Key -> itemsDatabase-Kategorie (wie normalizarSlot/slotType in main.js)
export function itemSlotType(slotKey) {
    if (slotKey.startsWith('ring')) return 'ring';
    if (slotKey === 'weapon1' || slotKey === 'weapon2') return 'weapon';
    return slotKey;
}

export function resolveItem(slotKey, name) {
    if (!name) return null;
    const type = itemSlotType(slotKey);
    const db = itemsDatabase[type];
    if (!db) return null;
    for (const key in db) {
        if (db[key].name === name) return db[key];
    }
    // Mit Dual Wielding steckt im Offhand eine Waffe statt eines Schilds
    if (type === 'offhand') {
        for (const key in itemsDatabase.weapon) {
            if (itemsDatabase.weapon[key].name === name) return itemsDatabase.weapon[key];
        }
    }
    // Alte Builds speicherten Rassen-Evolutionen als eigenstaendigen Namen
    if (type === 'race') {
        for (const key in itemsDatabase.race) {
            const race = itemsDatabase.race[key];
            const hasEvo = race.evolutions?.some(e => e.name === name || `${race.name}: ${e.name}` === name);
            if (hasEvo) return race;
        }
    }
    return null;
}

export function buildGear(buildData) {
    const items = buildData.items || {};
    const weapon1 = resolveItem('weapon1', items.weapon1?.name);
    const weapon2 = resolveItem('weapon2', items.weapon2?.name);
    return {
        helmet: resolveItem('helmet', items.helmet?.name),
        chest: resolveItem('chest', items.chest?.name),
        boots: resolveItem('boots', items.boots?.name),
        back: resolveItem('back', items.back?.name),
        weapon: weapon1 || weapon2,
        // Dual Wielding: beide Waffenslots belegt -> zweite Waffe gespiegelt
        // in der linken Hand zeigen, wie im Hauptbuilder.
        secondWeapon: (weapon1 && weapon2) ? weapon2 : null,
        offhand: resolveItem('offhand', items.offhand?.name),
        race: resolveItem('race', items.race?.name),
        raceEvolution: buildData.raceEvolution || ''
    };
}

// "30 Warrior + 10 Samurai + 10 Thief" — absteigend nach Level, bei Gleichstand A-Z
export function classEntries(buildData) {
    const classes = buildData.classes || {};
    const entries = Object.entries(classes).filter(([, lvl]) => (parseInt(lvl) || 0) > 0);
    entries.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    return entries;
}

export function classBreakdown(buildData) {
    const entries = classEntries(buildData);
    if (!entries.length) return '';
    return entries.map(([name, lvl]) => `${lvl} ${name}`).join(' + ');
}

// Hauptklasse fuer den Klassen-Filter: hoechstes Level gewinnt.
export function dominantClass(buildData) {
    const entries = classEntries(buildData);
    return entries.length ? entries[0][0] : null;
}

// Muss dieselben Kriterien wie die DB-Constraint community_builds_not_empty
// verwenden, damit die Fehlermeldung schon vor dem Request kommt.
export function isBuildEmpty(buildData) {
    const hasItem = Object.values(buildData.items || {}).some(Boolean);
    const hasClassLevel = Object.values(buildData.classes || {}).some(lvl => (parseInt(lvl) || 0) > 0);
    return !hasItem && !hasClassLevel;
}
