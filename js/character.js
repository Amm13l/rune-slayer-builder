/* -------------------------------------------------------------------------
   Blockige Roblox-Silhouette für die Charaktervorschau.

   Jede Körperpartie gehört zu einem Ausrüstungsslot und wird in dessen
   Rarity-Farbe eingefärbt; unbelegte Partien bleiben stumpf grau.
   In der rechten Hand liegt je nach Waffentyp eine andere Silhouette.

   Alle Zeichenwerte kommen aus den Tabellen hier, nie aus Nutzereingaben —
   das SVG kann also gefahrlos als Markup zusammengesetzt werden.
------------------------------------------------------------------------- */

// identisch zu den .tooltip-name-Farben in organizer.css
const RARITY_COLORS = {
  common: '#aaaaaa',
  uncommon: '#4CAF50',
  rare: '#2196F3',
  epic: '#bf2fd8',
  legendary: '#FF9800',
  spec: '#ff0f0f'
};

const BARE = '#4a4a55';

// Kopf quadratisch und leicht abgerundet, Rumpf/Gliedmaßen hart kantig.
// Torso läuft von x=60 bis 132, Mitte also 96 — daran hängt der Kopf.
const BODY = {
  head:  { x: 70,  y: 14,  w: 52, h: 52, r: 7 },
  torso: { x: 60,  y: 72,  w: 72, h: 78 },
  armL:  { x: 18,  y: 72,  w: 36, h: 78 },
  armR:  { x: 138, y: 72,  w: 36, h: 78 },
  legL:  { x: 60,  y: 156, w: 34, h: 78 },
  legR:  { x: 98,  y: 156, w: 34, h: 78 }
};

const HAND_R = { x: 156, y: 150 };   // Griffpunkt der rechten Hand
const HAND_L = { x: 36,  y: 150 };   // Offhand — gleiche Hoehe wie rechts,
                                      // sonst haengt die zweite Waffe beim
                                      // Dual Wielding sichtbar hoeher als die erste.

/* Waffen-Silhouetten. Ursprung (0,0) = Griff, die Klinge zeigt nach oben
   (negatives y). Bewusst kantig gehalten, passend zum Blockstil. */
const WEAPONS = {
  sword: `<path d="M 0 -112 L 6 -98 L 6 -26 L -6 -26 L -6 -98 Z"/>
          <rect x="-17" y="-26" width="34" height="8"/>
          <rect x="-4" y="-18" width="8" height="22"/>
          <rect x="-7" y="4" width="14" height="7"/>`,

  // deutlich längere Klinge als beim Schwert — reicht bis auf Kopfhöhe
  greatsword: `<path d="M 0 -152 L 10 -134 L 10 -28 L -10 -28 L -10 -134 Z"/>
               <rect x="-27" y="-28" width="54" height="10"/>
               <rect x="-5.5" y="-18" width="11" height="26"/>
               <rect x="-10" y="8" width="20" height="10"/>`,

  /* Der Rücken ist eine gerade Linie, die Schneide schwingt daran gerundet
     aus und läuft oben in die angeschrägte Spitze. Dazu kleine Tsuba und
     langer zweihändiger Griff. */
  katana: `<path d="M 4 -28 L 4 -122 L 0 -134 C -4 -108, -5 -60, -4 -28 Z"/>
           <rect x="-9" y="-28" width="18" height="6"/>
           <rect x="-4" y="-22" width="8" height="30"/>
           <rect x="-6" y="8" width="12" height="5"/>`,

  /* Beidseitig geschliffene Dreiecksklinge: breit am Heft, gleichmäßig
     zulaufend bis zur Spitze. Anders als beim Katana symmetrisch, dazu
     nur ein winziges Heft statt einer Parierstange. */
  dagger: `<path d="M -7 -20 C -8 -44, -5 -60, 0 -72 C 5 -60, 8 -44, 7 -20 Z"/>
           <rect x="-10" y="-20" width="20" height="5"/>
           <rect x="-3.5" y="-15" width="7" height="16"/>
           <rect x="-6" y="1" width="12" height="5"/>`,

  spear: `<path d="M 0 -136 L 10 -110 L -10 -110 Z"/>
          <rect x="-6.5" y="-110" width="13" height="8"/>
          <rect x="-3.5" y="-102" width="7" height="140"/>`,

  // einschneidig mit Gegengewicht hinten
  greataxe: `<rect x="-4" y="-120" width="8" height="158"/>
             <path d="M 4 -114 L 36 -102 L 36 -58 L 4 -48 Z"/>
             <path d="M -4 -110 L -20 -100 L -20 -74 L -4 -66 Z"/>`,

  hatchet: `<rect x="-3.5" y="-78" width="7" height="104"/>
            <path d="M 3.5 -74 L 25 -63 L 25 -33 L 3.5 -25 Z"/>`,

  staff: `<rect x="-4.5" y="-104" width="9" height="146"/>
          <path d="M 0 -138 L 15 -120 L 15 -108 L 0 -90 L -15 -108 L -15 -120 Z"/>`,

  // kantiger Bogen: Wurfarme als Polygonzug, Sehne als gerade Linie
  bow: `<path d="M -4 -112 L 14 -92 L 21 -50 L 21 -8 L 14 34 L -4 54"
              fill="none" stroke-width="8" stroke-linejoin="miter"/>
        <path d="M -4 -112 L -4 54" fill="none" stroke-width="2.5"/>`,

  /* Keine Waffe, sondern eine gepanzerte Faust am herabhängenden Arm:
     oben die Stulpe am Handgelenk, darunter der Faustblock, unten die
     Finger. Der Daumen sitzt innen an der Körperseite. */
  gauntlet: `<rect x="-15" y="-32" width="30" height="13"/>
             <rect x="-16" y="-18" width="32" height="26"/>
             <rect x="-15" y="8" width="8" height="9"/>
             <rect x="-4" y="8" width="8" height="9"/>
             <rect x="7" y="8" width="8" height="9"/>
             <rect x="-23" y="-10" width="7" height="12"/>`
};

// Weapon.type-Werte ohne eigene Silhouette
const WEAPON_ALIASES = { tyle: 'sword' };

const SHIELD = `<path d="M -23 -36 L 23 -36 L 23 12 L 0 34 L -23 12 Z"/>`;

function colorOf(item) {
  return item ? (RARITY_COLORS[item.rarity] || RARITY_COLORS.common) : BARE;
}

// Belegte Partien leuchten in der Rarity-Farbe, leere bleiben fast schwarz.
function piece(rect, item) {
  const c = colorOf(item);
  const on = Boolean(item);
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"
            ${rect.r ? `rx="${rect.r}" ry="${rect.r}"` : ''}
            fill="${c}" fill-opacity="${on ? 0.26 : 0.05}"
            stroke="${c}" stroke-opacity="${on ? 0.95 : 0.5}" stroke-width="2"
            ${on ? `filter="url(#rsGlow)"` : ''}/>`;
}

/* Waffe und Schild liegen vor dem Körper. Damit sie sich auch dann absetzen,
   wenn sie dieselbe Rarity-Farbe wie die Rüstung haben, bekommen sie zuerst
   eine dunkle Kontur als Unterlage und darüber die farbige Silhouette. */
function heldMarkup(shape, item, at, scale, fillOpacity) {
  const c = colorOf(item);
  const place = `translate(${at.x} ${at.y}) scale(${scale})`;
  return `<g transform="${place}" fill="#07070a" stroke="#07070a"
             stroke-width="9" stroke-linejoin="round">${shape}</g>
          <g transform="${place}" fill="${c}" fill-opacity="${fillOpacity}"
             stroke="${c}" stroke-width="2.5" filter="url(#rsGlow)">${shape}</g>`;
}

// mirror=true spiegelt nur horizontal (negatives sx) fuer die linke Hand,
// sonst stuende die Klinge auf dem Kopf.
function weaponMarkup(weapon, at = HAND_R, mirror = false) {
  if (!weapon) return '';
  const key = WEAPON_ALIASES[weapon.type] || weapon.type;
  const scale = mirror ? '-0.88 0.88' : 0.88;
  return heldMarkup(WEAPONS[key] || WEAPONS.sword, weapon, at, scale, 0.5);
}

function offhandMarkup(offhand) {
  if (!offhand) return '';
  // Schilde sind an posture erkennbar; Sashes haben keine Silhouette.
  if (typeof offhand.posture === 'number') {
    return heldMarkup(SHIELD, offhand, HAND_L, 1, 0.42);
  }
  // Falls doch mal eine echte Waffe im Offhand-Slot landet — gespiegelt in
  // die linke Hand, wie beim zweiten Dual-Wielding-Weapon-Slot.
  if (offhand.type && WEAPONS[WEAPON_ALIASES[offhand.type] || offhand.type]) {
    return weaponMarkup(offhand, HAND_L, true);
  }
  return '';
}

function capeMarkup(back) {
  if (!back) return '';
  const c = colorOf(back);
  return `<path d="M 56 76 L 136 76 L 152 206 L 40 206 Z"
            fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-opacity="0.7"
            stroke-width="2" filter="url(#rsGlow)"/>`;
}

/* -------------------------- Rassenmerkmale --------------------------
   Kleine Erkennungszeichen laut Wiki-Feature der jeweiligen Rasse, gezeichnet
   in deren Rarity-Farbe. Kopf liegt bei x 70..122, y 14..66, Mitte x=96.
   `behind` wird vor dem Körper gezeichnet (Flügel), `front` danach. */

const HEAD_CX = 70 + 52 / 2;   // 96
const HEAD_TOP = 14;

// Sich nach außen neigendes Horn als schlankes Dreieck
function horn(cx, baseY, h, w, dir) {
  return `<path d="M ${cx - w / 2} ${baseY} L ${cx + dir * h * 0.5} ${baseY - h} L ${cx + w / 2} ${baseY} Z"/>`;
}

// Paare von der Mitte nach außen, danach ein kleines inneres Paar
function horns(count) {
  const pairs = [
    { dx: 13, h: 32, w: 12 },
    { dx: 25, h: 23, w: 10 },
    { dx: 4,  h: 16, w: 8  }
  ].slice(0, Math.max(1, Math.round(count / 2)));
  return pairs.map(p =>
    horn(HEAD_CX - p.dx, HEAD_TOP + 4, p.h, p.w, -1) +
    horn(HEAD_CX + p.dx, HEAD_TOP + 4, p.h, p.w, 1)
  ).join('');
}

/* Schwingen, Ursprung am Ansatzpunkt an der Schulter, nach außen und unten.
   Federschwinge: Vorderkante schwingt zum Flügelende aus, die Hinterkante
   läuft in fünf gestaffelten Federspitzen zurück. */
const WING_FEATHER =
  'M 0 -4 L -23 -18 L -45 -14 L -58 4 L -45 6 L -51 26 L -38 24 ' +
  'L -43 46 L -28 40 L -30 62 L -15 48 L -12 66 L -2 40 Z';

/* Fledermausschwinge: gleiche Spannweite, aber Fingerstreben mit
   ausgeschnittener Flughaut statt Federn. */
const WING_BAT =
  'M 0 -4 L -22 -20 L -46 -22 L -60 -6 ' +
  'Q -52 16 -48 34 Q -40 18 -34 44 Q -24 24 -17 52 Q -8 28 0 42 Z';

/* Mehrere Paare werden aufgefächert statt gestapelt — übereinandergelegte
   Kopien überschneiden sich sonst zu einem unleserlichen Klumpen. Ein
   einzelnes Paar bleibt ungedreht. */
const WING_LAYOUTS = {
  1: [{ y: 84,  s: 1,    a: 0   }],
  2: [{ y: 78,  s: 1,    a: -16 }, { y: 110, s: 0.82, a: 18 }],
  3: [{ y: 74,  s: 0.95, a: -26 }, { y: 102, s: 0.86, a: 2 }, { y: 128, s: 0.72, a: 30 }]
};

function wingPairs(shape, count) {
  const pairs = Math.min(3, Math.max(1, Math.round(count / 2)));
  return WING_LAYOUTS[pairs].map(r =>
    `<path d="${shape}" transform="translate(58 ${r.y}) scale(${r.s}) rotate(${r.a})"/>
     <path d="${shape}" transform="translate(134 ${r.y}) scale(${-r.s} ${r.s}) rotate(${r.a})"/>`
  ).join('');
}

const wings = (count) => wingPairs(WING_FEATHER, count);

/* Ophanim sind Räder voller Augen. Ein Reif je Flügelpaar, ineinander
   geschachtelt statt gekreuzt — gekreuzte Reifen lesen sich sonst als
   Atommodell. Sie liegen hinter dem Kopf, der Kopf sitzt also im Rad. */
function ophanimWheel(wingCount) {
  const cx = HEAD_CX, cy = 40;
  const pairs = Math.min(3, Math.max(1, Math.round(wingCount / 2)));
  const radii = [33, 45, 57].slice(0, pairs);

  return radii.map((r, i) => {
    const eyeCount = 8 + i * 4;
    let eyes = '';
    for (let k = 0; k < eyeCount; k++) {
      // Jeder Reif um einen halben Schritt versetzt, damit keine Speichen entstehen
      const a = (Math.PI * 2 * (k + i * 0.5)) / eyeCount - Math.PI / 2;
      eyes += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}"
                       cy="${(cy + Math.sin(a) * r).toFixed(1)}"
                       r="${(3.2 - i * 0.5).toFixed(1)}"/>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                    stroke-width="${(2.6 - i * 0.5).toFixed(1)}"/>${eyes}`;
  }).join('');
}

// Evolutionen heißen "2 Wings", "4 Horns" … — die Zahl steuert die Anzahl
function countFrom(evolutionName, fallback) {
  const m = /^(\d+)/.exec(evolutionName || '');
  return m ? Number(m[1]) : fallback;
}

const RACE_FEATURES = {
  // Spitze Ohren
  Elf: () => ({ front: `<path d="M 70 42 L 56 20 L 70 28 Z"/>
                        <path d="M 122 42 L 136 20 L 122 28 Z"/>` }),

  // Hauer, die aus dem Kiefer nach oben stehen
  Orc: () => ({ front: `<path d="M 82 64 L 85 46 L 89 64 Z"/>
                        <path d="M 103 64 L 107 46 L 110 64 Z"/>` }),

  // Eingefallene, schräge Augenhöhlen und ein aufgerissenes Maul mit
  // abgebrochenen Zähnen — passend zum Ghoulish Screech.
  Ghoul: () => ({ front: `<path d="M 76 30 L 91 33 L 88 41 L 78 41 Z"/>
                          <path d="M 116 30 L 101 33 L 104 41 L 114 41 Z"/>
                          <path d="M 78 54 L 82 60 L 86 55 L 90 60 L 96 54 L 102 60 L 106 55 L 110 60 L 114 54
                                   L 114 66 L 110 61 L 106 66 L 102 61 L 96 66 L 90 61 L 86 66 L 82 61 L 78 66 Z"/>` }),

  // Zunge, die im 45°-Winkel aus dem Mund kommt, und der Schal, in den
  // sie hineinläuft.
  Amphibu: () => ({ front: `<path d="M 92 50 L 100 50 L 116 66 L 108 66 Z"/>
                            <path d="M 70 62 C 65 74, 65 80, 74 80 L 118 80 C 127 80, 127 74, 122 62
                                     C 113 71, 79 71, 70 62 Z"/>` }),

  // Katzenohren
  Ailuran: () => ({ front: `<path d="M 72 18 L 77 -6 L 91 18 Z"/>
                            <path d="M 120 18 L 115 -6 L 101 18 Z"/>` }),

  // Fledermausschwingen mit Flughaut
  Chiroptran: () => ({ behind: wingPairs(WING_BAT, 2) }),

  // Einfache Kulleraugen wie ein Schleimklumpen, dazu eine dünne,
  // gerade Schleimschicht zwischen Kopf und Oberkörper.
  Slime: () => ({ front: `<circle cx="84" cy="36" r="4.5"/>
                          <circle cx="108" cy="36" r="4.5"/>
                          <rect x="67" y="66" width="58" height="6" rx="3" ry="3"/>` }),

  /* Golem-Gesicht: durchgehender eckiger Spalt als Mund, dazu leere Augen
     ohne Pupille, deren Oberkante zur Mitte hin abfällt (aggressiv). */
  'Half Golem': () => ({ front: `<path d="M 74 30 L 90 36 L 90 45 L 74 45 Z"/>
                                 <path d="M 118 30 L 102 36 L 102 45 L 118 45 Z"/>
                                 <path d="M 70 53 L 82 53 L 85 57 L 107 57 L 110 53 L 122 53
                                          L 122 60 L 110 60 L 107 63 L 85 63 L 82 60 L 70 60 Z"/>` }),

  // Lange Hasenohren
  Bunny: () => ({ front: `<rect x="81" y="-28" width="11" height="46" rx="5.5"/>
                          <rect x="100" y="-28" width="11" height="46" rx="5.5"/>` }),

  // Kronenförmiger Heiligenschein
  Dullahan: () => ({ front: `<line x1="69" y1="32" x2="123" y2="32" stroke-width="4"/>
                             <path d="M 74 32 L 82 16 L 90 29 L 96 2 L 102 29 L 110 16 L 118 32 Z"/>` }),

  // Eckzähne

  Vampire: () => ({ front: `<path d="M 86 56 L 89 68 L 92 56 Z"/>
                            <path d="M 100 56 L 103 68 L 106 56 Z"/>` }),

  // Ohne Evolution nur Flügel. Ab Evolution kommen ebenso viele
  // Ophanim-Reifen dazu (2/4/6), hinter dem Kopf, der dann im Rad sitzt.
  Seraphim: (evo) => {
    if (!evo) return { behind: wings(2) };
    const n = countFrom(evo, 2);
    return { behind: ophanimWheel(n) + wings(n) };
  },

  // Hörner (2/4/6 je Evolution)
  Infernim: (evo) => ({ front: horns(countFrom(evo, 2)) }),

  // Spec-Rasse: Schwingen und zwei lateinische Kreuze als Augen
  Angel: () => ({
    behind: wings(2),
    front: `<rect x="82" y="26" width="4" height="21"/>
            <rect x="77" y="31" width="14" height="4"/>
            <rect x="106" y="26" width="4" height="21"/>
            <rect x="101" y="31" width="14" height="4"/>`
  })
};

function raceLayers(race, evolutionName) {
  const build = race && RACE_FEATURES[race.name];
  if (!build) return { behind: '', front: '' };

  const { behind = '', front = '' } = build(evolutionName);
  const c = colorOf(race);
  const wrap = (markup, opacity) => markup
    ? `<g fill="${c}" fill-opacity="${opacity}" stroke="${c}" stroke-width="2"
          stroke-linejoin="round" filter="url(#rsGlow)">${markup}</g>`
    : '';
  return { behind: wrap(behind, 0.2), front: wrap(front, 0.55) };
}

/**
 * Baut das Silhouetten-SVG als String (keine DOM-Abhaengigkeit, laeuft
 * ueberall wo JS laeuft — u.a. serverseitig in der Discord-Notify-Function).
 * @param {object} gear { helmet, chest, boots, back, weapon, secondWeapon, offhand, race, raceEvolution }
 */
export function buildCharacterSVG(gear) {
  const { helmet, chest, boots, back, weapon, secondWeapon, offhand, race, raceEvolution } = gear;
  const feature = raceLayers(race, raceEvolution);

  // Der Ausschnitt reicht bis y=-34, damit Ohren, Hörner und Heiligenscheine
  // über dem Kopf Platz haben.
  return `
<svg class="character-svg" viewBox="0 -34 210 284" preserveAspectRatio="xMidYMid meet"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <filter id="rsGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-opacity="0.85"/>
    </filter>
  </defs>
  <ellipse cx="96" cy="240" rx="60" ry="7" fill="#000" fill-opacity="0.5"/>
  ${feature.behind}
  ${capeMarkup(back)}
  ${piece(BODY.head, helmet)}
  ${piece(BODY.torso, chest)}
  ${piece(BODY.armL, chest)}
  ${piece(BODY.armR, chest)}
  ${piece(BODY.legL, boots)}
  ${piece(BODY.legR, boots)}
  ${feature.front}
  ${secondWeapon ? weaponMarkup(secondWeapon, HAND_L, true) : offhandMarkup(offhand)}
  ${weaponMarkup(weapon)}
</svg>`;
}

/**
 * Zeichnet die Silhouette neu.
 * @param {Element} container Ziel-Element (.character-portrait)
 * @param {object} gear { helmet, chest, boots, back, weapon, secondWeapon, offhand, race, raceEvolution }
 */
export function renderCharacter(container, gear) {
  if (!container) return;
  container.innerHTML = buildCharacterSVG(gear);
}

export { RARITY_COLORS };
