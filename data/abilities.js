import { Ability } from './types.js';

/* -------------------------------------------------------------------------
   Frei equipbare Abilities — alles was nicht ueber Klasse oder Rasse
   automatisch freigeschaltet wird: Spells, Scrolls und ungebundene Passives.

   Shape: { name, rarity, kind, category, element, level, requirement,
            description, grants }
     kind      -> 'active' | 'passive'  (Gruppierung im Abilities-Panel)
     category  -> 'spell' | 'scroll' | 'passive' | 'blessing' | 'curse'
                  (Filter im Auswahlmenue; blessing/curse sind die Sekten-
                  Abilities, die das Spiel selbst so betitelt)
     element   -> nur bei Spells: 'Earth' | 'Fire' | 'Water' | 'Wind' |
                  'Lightning' | 'Plague'. Landet als "Fire Spell" auf der
                  Kachel und ist damit in beiden Suchfeldern auffindbar.
     level     -> Charakterlevel-Anforderung, null = keine
     grants    -> vom Builder ausgewertete Effekte, siehe types.js

   Magician- und Priest-Spells stehen NICHT hier: die haengen am Klassenlevel
   und kommen aus classdata.js.

   Rarity wie bei Items aus der Namensfarbe im Spiel uebernehmen. Solange die
   echten Werte fehlen, bleibt es beim Default 'common' (grau).
------------------------------------------------------------------------- */

// Scroll Roulette bei Shoen The Mage, 20 Silber pro Dreh — Quelle fast aller
// Element-Spells.
const ROULETTE = 'Scroll Roulette at Shoen The Mage (20 Silver per spin)';
// Die drei Lightning-Scrolls gibt es nur im Tausch gegen Electrical Energy,
// und man bekommt eine zufaellige davon.
const LIGHTNING = 'Trade Electrical Energy to the Lightning Spirit at Stormpeak (random spell)';
const RAT_KING = "Buy from Hobo near the sewers for 1 Heart (needs a Rat King's Head)";

const abilitiesDatabase = {
  DualWielding: new Ability({
    name: 'Dual Wielding',
    kind: 'passive',
    category: 'passive',
    description: 'Lets you wield two one-handed weapons of the same kind at once — '
      + 'two Swords or two Daggers. The second weapon goes into the Offhand slot. '
      + 'Mixing a Sword with a Dagger is not possible.',
    grants: { dualWield: ['sword', 'dagger'] }
  }),

  // ---- Earth ----
  RockBullet: new Ability({
    name: 'Rock Bullet',
    rarity: 'common',
    category: 'spell',
    element: 'Earth',
    requirement: ROULETTE,
    description: 'Materializes a bullet-size rock to hit a target.'
  }),
  StoneCannon: new Ability({
    name: 'Stone Cannon',
    rarity: 'uncommon',
    category: 'spell',
    element: 'Earth',
    requirement: ROULETTE,
    description: 'Launches a rocky stake projectile toward the cursor.'
  }),
  EarthPillar: new Ability({
    name: 'Earth Pillar',
    rarity: 'common',
    category: 'spell',
    element: 'Earth',
    requirement: ROULETTE,
    description: 'Summons a pillar of earth beneath you, propelling you upwards to reach '
      + 'high places or evade danger. Deals no damage.'
  }),
  EarthWall: new Ability({
    name: 'Earth Wall',
    rarity: 'uncommon',
    category: 'spell',
    element: 'Earth',
    requirement: ROULETTE,
    description: 'Creates a moving earthen wall that blocks attacks and knocks back enemies.'
  }),

  // ---- Fire ----
  Ignite: new Ability({
    name: 'Ignite',
    rarity: 'common',
    category: 'spell',
    element: 'Fire',
    requirement: ROULETTE,
    description: 'Fire a short burst of flames.'
  }),
  FlameSlice: new Ability({
    name: 'Flame Slice',
    rarity: 'uncommon',
    category: 'spell',
    element: 'Fire',
    requirement: ROULETTE,
    description: 'Hurl a searing slash of fire, sending a blazing arc of flames towards '
      + 'your enemy. Shortest range of the Slice spells, but the highest damage.'
  }),
  FlameThrower: new Ability({
    name: 'Flame Thrower',
    rarity: 'rare',
    category: 'spell',
    element: 'Fire',
    requirement: ROULETTE,
    description: 'Channels a continuous stream of fire that can be held down for short '
      + 'bursts or sustained damage.'
  }),
  FlamePillar: new Ability({
    name: 'Flame Pillar',
    rarity: 'rare',
    category: 'spell',
    element: 'Fire',
    requirement: ROULETTE,
    description: 'Materializes a pillar of fire.'
  }),
  Fireball: new Ability({
    name: 'Fireball',
    rarity: 'rare',
    category: 'spell',
    element: 'Fire',
    requirement: 'Use Skill Book: Fireball, a 1% drop from Imps in Balgarom Chasm',
    description: 'Launches a ball of fire at the target. Learned from a Skill Book, '
      + 'which is consumed on use.'
  }),

  // ---- Water ----
  WaterBall: new Ability({
    name: 'Water Ball',
    rarity: 'common',
    category: 'spell',
    element: 'Water',
    requirement: ROULETTE,
    description: 'Shoot out a ball of water towards the enemy.'
  }),
  WaterCannon: new Ability({
    name: 'Water Cannon',
    rarity: 'uncommon',
    category: 'spell',
    element: 'Water',
    requirement: ROULETTE,
    description: 'A larger and stronger version of Water Ball, launched forward to deal '
      + 'higher damage.'
  }),
  Waterfall: new Ability({
    name: 'Waterfall',
    rarity: 'rare',
    category: 'spell',
    element: 'Water',
    requirement: ROULETTE,
    description: 'Blast water towards the enemy in short but continuous bursts.'
  }),
  WaterSlice: new Ability({
    name: 'Water Slice',
    rarity: 'uncommon',
    category: 'spell',
    element: 'Water',
    requirement: ROULETTE,
    description: 'Hurl a fast, blade-like stream of water forward to cut through enemies. '
      + 'Longest range of the Slice spells, but slower and the weakest.'
  }),

  // ---- Wind ----
  WindBlast: new Ability({
    name: 'Wind Blast',
    rarity: 'common',
    category: 'spell',
    element: 'Wind',
    requirement: ROULETTE,
    description: 'Releases a strong gust of wind that pushes enemies and the user backward.'
  }),
  WindBind: new Ability({
    name: 'Wind Bind',
    rarity: 'uncommon',
    category: 'spell',
    element: 'Wind',
    requirement: ROULETTE,
    description: 'Launches a sphere of wind that explodes on impact, stunning and slowing '
      + 'enemies.'
  }),
  WindSlice: new Ability({
    name: 'Wind Slice',
    rarity: 'rare',
    category: 'spell',
    element: 'Wind',
    requirement: ROULETTE,
    description: 'Unleashes a sharp wind slash with extended reach. Faster and slightly '
      + 'longer ranged than Flame Slice, but weaker.'
  }),
  Tornado: new Ability({
    name: 'Tornado',
    rarity: 'rare',
    category: 'spell',
    element: 'Wind',
    requirement: ROULETTE,
    description: 'Summons a tornado that pulls in enemies and deals continuous damage.'
  }),
  WindGust: new Ability({
    name: 'Wind Gust',
    rarity: 'rare',
    category: 'spell',
    element: 'Wind',
    requirement: 'Use Skill Book: Wind Gust, a 6% drop from Amphitheres in Greatwood Forest',
    description: 'Shoots out a burst of wind after a mediocre windup, dealing low damage '
      + 'but decent knockback. Learned from a Skill Book, which is consumed on use.'
  }),

  // ---- Lightning ----
  ChainLightning: new Ability({
    name: 'Chain Lightning',
    rarity: 'rare',
    category: 'spell',
    element: 'Lightning',
    requirement: LIGHTNING,
    description: 'Fire a bolt of lightning that chains between multiple nearby enemies.'
  }),
  StormSphere: new Ability({
    name: 'Storm Sphere',
    rarity: 'rare',
    category: 'spell',
    element: 'Lightning',
    requirement: LIGHTNING,
    description: 'Summon a crackling sphere of lightning that travels toward the cursor '
      + 'and unleashes multiple strikes upon impact.'
  }),
  ThunderStrike: new Ability({
    name: 'Thunder Strike',
    rarity: 'rare',
    category: 'spell',
    element: 'Lightning',
    requirement: `${LIGHTNING} — one of the two spells not usable by every class`,
    description: 'Summon a powerful bolt of lightning that crashes down on a single '
      + 'target for heavy damage.'
  }),

  // ---- Plague (Rat King) ----
  PlagueOfRats: new Ability({
    name: 'Plague of Rats',
    rarity: 'rare',
    category: 'spell',
    element: 'Plague',
    requirement: RAT_KING,
    description: 'Summons a horde of rats.'
  }),
  PlagueBreath: new Ability({
    name: 'Plague Breath',
    rarity: 'rare',
    category: 'spell',
    element: 'Plague',
    requirement: RAT_KING,
    description: 'A constant breath of plague.'
  }),

  // ---- Miscellaneous ----
  SummoningPortal: new Ability({
    name: 'Summoning Portal',
    rarity: 'legendary',
    category: 'spell',
    requirement: `${ROULETTE} — needs 10 levels in Magician or Priest to use`,
    description: 'Summon a portal that allows an ally to teleport to your location '
      + 'instantly. The target has to accept the summon.'
  }),

  // ---- Sekten-Abilities ----
  // An die Fraktion gebunden und zusaetzlich an eine passende Fairy im Slot.
  BlessingOfTheCho: new Ability({
    name: 'Blessing of the Cho',
    rarity: 'legendary',
    category: 'blessing',
    requirement: 'Holy Sect only — needs an Earth Fairy equipped. '
      + 'Drops from The Dreadful Licht King and The Goblin King.'
  }),
  CurseOfTheDuneDragon: new Ability({
    name: 'Curse of the Dune Dragon',
    rarity: 'legendary',
    category: 'curse',
    requirement: 'Demon Sect only — needs a Fire Fairy equipped. '
      + 'From the Curse: Eclipse scroll dropped by The Dreadful Licht King and The Goblin King.'
  })
};

export default abilitiesDatabase;
