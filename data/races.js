import { Race } from './types.js';

/* -------------------------------------------------------------------------
   Rassen (Species) inkl. Racial Upgrades ("Evolutionen").

   Abilities/Passives laut Wiki: https://rune-slayerrblx.fandom.com/wiki/Species

   Skill-Shape: { name, level, requirement, description }
     level       -> Charakterlevel-Anforderung (1 = von Anfang an verfuegbar)
     requirement -> Kosten/Bedingung als Text, optional

   Evolutionen schalten laut Wiki auf Level 15 frei und ersetzen die
   Basisrasse komplett — deshalb tragen sie die vollen Stats, nicht nur die
   Differenz. Die Statwerte sind unveraendert aus der frueheren
   racesDatabase uebernommen.
------------------------------------------------------------------------- */

const EVOLUTION_LEVEL = 15;

// ---------- Common ----------

const Human = new Race({
  name: 'Human',
  stats: {focusEfficiency: 1, manaEfficiency: 2},
  passives: [
    {name: 'Tenacity', level: 1,
      description: 'When below 50% HP, gain a 15% attack damage buff and damage reduction.'},
    {name: 'Ghoul Slayer', level: 1,
      description: 'Your attacks deal increased damage to undead enemies.'},
    {name: 'Hunger Efficiency', level: 1,
      description: '+1 Focus efficiency, +2 Mana efficiency.'}
  ],
  actives: [
    {name: 'Surge', level: 1, requirement: '50 Hunger',
      description: 'Harness your hunger to fuel a powerful burst of stamina.'}
  ]
});

const Elf = new Race({
  name: 'Elf',
  stats: {speedBoost: 0.05, cdReduction: 0.05, stealth: 0.1,
      mana: 0.1, focus: 0.05},
  passives: [
    {name: 'Strider', level: 1,
      description: '+5% Speed Boost, +5% Cooldown Reduction, +10% Stealth.'},
    {name: 'Mana Affinity', level: 1, description: '+10% Increased Mana.'},
    {name: 'Focus Affinity', level: 1, description: '+5% Increased Focus.'}
  ],
  actives: [
    {name: 'Duskwalk', level: 15,
      description: 'Temporarily vanish by channeling your focus as energy. Any attack will break the invisibility.'}
  ]
});

const Orc = new Race({
  name: 'Orc',
  stats: {healthRegen: 0.1, maxHunger: 0.15, heatResistance: 0.2},
  passives: [
    {name: 'Battle Hardened', level: 1, description: '10% Base health regeneration.'},
    {name: 'Ravenous', level: 1, description: '15% Higher max hunger.'},
    {name: 'Ash Walker', level: 1, description: '20% Heat resistance.'}
  ],
  actives: [
    {name: 'Spine Breaker', level: 15,
      description: 'Lift the opponent and slam them headfirst onto the ground.'}
  ]
});

const ghoulStats = {magicAttack: 0.025, immunity: 0.5};

const Ghoul = new Race({
  name: 'Ghoul',
  stats: ghoulStats,
  passives: [
    {name: 'Ghoul Lineage', level: 1, description: '+2.5% Magic Attack.'},
    {name: 'Ghoulish Gut', level: 1, description: '+50% resistance to poison.'},
    {name: 'Ghoulish Screech', level: 1,
      description: 'When going below 30% HP, has a chance to perform a Ghoulish Screech that inflicts sleep on those hit by it.'}
  ],
  actives: [
    {name: 'Ghoulish Gall', level: 1,
      description: 'Fade into nothingness and reappear to strike those that oppose, from above.'}
  ],
  evolutions: [
    new Race({
      name: 'Phantom Ghoul',
      stats: {...ghoulStats, jumpBoost: 0.03, fallReduction: 0.1, speedBoost: 0.025},
      passives: [
        {name: 'Phantom Pleasure', level: EVOLUTION_LEVEL,
          description: '+3% Jump Boost, +10% Fall Damage Reduction, +2.5% Speed Boost.'}
      ],
      actives: [
        {name: 'Ghoulish Gall (Phantom)', level: EVOLUTION_LEVEL,
          description: 'Ghoulish Gall now teleports you to wherever your mouse is pointing with a pretty good range, dealing damage if teleporting onto an enemy.'}
      ]
    }),
    new Race({
      name: 'Howling Wraith',
      stats: {...ghoulStats, robustness: 0.05, holyResistance: 0.05,
          coldResistance: 0.1, speedBoost: 0.025},
      passives: [
        {name: 'Howling Hollow', level: EVOLUTION_LEVEL,
          description: '+5 Robustness, +5% Holy Resistance, +10% Cold Resistance, +2.5% Speed Boost.'}
      ],
      actives: [
        {name: 'Ghoulish Gall (Howling)', level: EVOLUTION_LEVEL,
          description: 'Ghoulish Gall now summons a clone of you at your enemy\'s position that performs a Ghoulish Screech.'}
      ]
    }),
    new Race({
      name: 'Wretched Wraith',
      stats: {...ghoulStats, attackPower: 0.05, magicPower: 0.05, speedBoost: 0.025},
      passives: [
        {name: 'Wretched Soul', level: EVOLUTION_LEVEL,
          description: '+5% Attack Power Buff, +5% Magic Power Buff, +2.5% Speed Boost.'}
      ],
      actives: [
        {name: 'Ghoulish Gall (Wretched)', level: EVOLUTION_LEVEL,
          description: 'Ghoulish Gall now summons a ghost clone of you to attack instead of using yourself, completely negating the previous commitment and endlag the move had.'}
      ]
    })
  ]
});

// ---------- Uncommon ----------

const amphibuStats = {swimBoost: 35, immunity: 0.5};

const Amphibu = new Race({
  name: 'Amphibu',
  stats: amphibuStats,
  rarity: 'uncommon',
  passives: [
    {name: 'Amphibu Lineage', level: 1, description: 'Swim Boost: +35.'},
    {name: 'Amphibius Immunity', level: 1, description: '+50% Immunity.'},
    {name: 'Echolocation', level: 1,
      description: 'At random intervals lets out a ribbit that highlights nearby mobs and shows hitboxes.'}
  ],
  actives: [
    {name: 'Amphibu Fissure', level: 1, description: 'Toss those in range into the sky.'}
  ],
  evolutions: [
    new Race({
      name: 'Goliath',
      rarity: 'uncommon',
      stats: {...amphibuStats, jumpBoost: 0.02, fallReduction: 0.05,
          speedBoost: -0.05, damageReduction: 0.05, attackPower: 0.03},
      passives: [
        {name: 'Goliath', level: EVOLUTION_LEVEL,
          description: '+3% Attack Power Buff, +2% Jump Height, +5% Fall Damage Reduction, -5% Speed Boost, +5% Damage Reduction.'}
      ]
    }),
    new Race({
      name: 'Agile Frog',
      rarity: 'uncommon',
      stats: {...amphibuStats, swimBoost: amphibuStats.swimBoost + 35,
          speedBoost: 0.15, jumpBoost: 0.25, fallReduction: 0.15},
      passives: [
        {name: 'Agile Frog', level: EVOLUTION_LEVEL,
          description: '+35 Swim Boost, +25% Jump Height, +15% Fall Damage Reduction, +15% Speed Boost.'}
      ]
    }),
    new Race({
      name: 'Golden Poison',
      rarity: 'uncommon',
      stats: {...amphibuStats, immunity: amphibuStats.immunity + 0.5,
          speedBoost: 0.07, jumpBoost: 0.15, fallReduction: 0.05},
      passives: [
        {name: 'Golden Poison', level: EVOLUTION_LEVEL,
          description: '+15% Jump Height, +5% Fall Damage Reduction, +7% Speed Boost, +50% Immunity.'}
      ]
    })
  ]
});

// ---------- Rare ----------

const Ailuran = new Race({
  name: 'Ailuran',
  stats: {speedBoost: 0.08, fireResistance: -0.1, heatResistance: 0.25,
      coldResistance: 0.25, fallReduction: 0.15, jumpBoost: 0.25},
  rarity: 'rare',
  passives: [
    {name: 'Fleetfoot', level: 1, description: '8% Speed Boost.'},
    {name: 'Beastly Coat', level: 1,
      description: '-10% Fire Resistance, +25% Heat Resistance, +25% Cold Resistance.'},
    {name: 'Prowler', level: 1, description: '+15% Fall Damage Reduction, +25% Jump Height.'}
  ],
  actives: [
    {name: 'Nimble Retreat', level: 15, requirement: 'Focus Drain: 30',
      description: 'Swiftly leap out of danger.'},
    {name: 'Lick Clean', level: 1, requirement: 'Focus Drain: 30',
      description: 'Lick yourself clean removing status effects negative and positive alike.'}
  ]
});

const Chiroptran = new Race({
  name: 'Chiroptran',
  stats: {windResistance: -5, holyAttack: 0.05, holyResistance: -0.05},
  rarity: 'rare',
  passives: [
    {name: 'Chiroptran Lineage', level: 1,
      description: 'Wind Resistance: -5, +5% Holy Attack, -5% Holy Resistance.'}
  ],
  actives: [
    {name: 'Chiroptran Roar', level: 15,
      description: 'Roar and stun your opponent slowing them, and gaining a speed buff for 10 seconds. Activating the ability again during the buff bites your opponent for 5% of their health (Holy Damage) and lifesteal.'}
  ]
});

// ---------- Epic ----------

const slimeStats = {magicResistance: -0.075, fireResistance: -0.075, immunity: 0.25};

const Slime = new Race({
  name: 'Slime',
  stats: slimeStats,
  rarity: 'epic',
  passives: [
    {name: 'Slime Body', level: 1,
      description: '-7.5% Magic Resistance, -7.5% Fire Resistance, +25% Immunity.'},
    {name: 'Viscous Remain', level: 1,
      description: 'When struck, there is a chance to release a blob of slime. These can be picked up to recover 6% HP.'}
  ],
  actives: [
    {name: 'Viscous Shock', level: 1, requirement: '4% HP',
      description: 'Sacrifice HP to unleash a powerful slime shockwave. Automatically triggers Viscous Remain.'}
  ],
  evolutions: [
    new Race({
      name: 'Black Ooze Slime',
      rarity: 'epic',
      stats: {...slimeStats},
      passives: [
        {name: 'Black Ooze', level: EVOLUTION_LEVEL,
          description: 'Viscous Remain blobs apply Black Ooze buildup while remaining on top and occur much more often.'}
      ],
      actives: [
        {name: 'Viscous Shock (Black Ooze)', level: EVOLUTION_LEVEL,
          description: 'Viscous Shock applies 20 Black Ooze buildup and releases 2 slime blobs. Good for warriors and strikers.'}
      ]
    }),
    new Race({
      name: 'Predator Slime',
      rarity: 'epic',
      stats: {...slimeStats},
      passives: [
        {name: 'Predator', level: EVOLUTION_LEVEL,
          description: 'Staying green, enemies will now burst into slime upon death. Slime can be picked up to regain 6% of your max health. Good for archers and thieves.'}
      ]
    }),
    new Race({
      name: 'Sapphire Slime',
      rarity: 'epic',
      stats: {...slimeStats},
      passives: [
        {name: 'Sapphire', level: EVOLUTION_LEVEL,
          description: 'Slime now rejuvenates targets on impact and restores mana when absorbed. Good for mages and priests.'}
      ]
    })
  ]
});

const halfGolemStats = {speedBoost: -0.05, damageReduction: 0.05,
    maxWeight: 10, robustness: 0.25};

const HalfGolem = new Race({
  name: 'Half Golem',
  stats: halfGolemStats,
  rarity: 'epic',
  passives: [
    {name: 'Stone Body', level: 1,
      description: '-5% Max Speed, +5% Damage Reduction, +10 Max Weight, +25% Robustness.'}
  ],
  actives: [
    {name: 'Smash', level: 15,
      description: 'Smash the ground and cause spikes to grow around you, damaging nearby enemies.'}
  ],
  evolutions: [
    new Race({
      name: 'Siege Body',
      rarity: 'epic',
      stats: {...halfGolemStats,
          speedBoost: halfGolemStats.speedBoost - 0.1,
          damageReduction: halfGolemStats.damageReduction + 0.1,
          magicResistance: 0.05,
          maxWeight: halfGolemStats.maxWeight + 25,
          robustness: halfGolemStats.robustness + 0.25},
      passives: [
        {name: 'Siege Body', level: EVOLUTION_LEVEL,
          description: '-10% Speed, +10% Damage Reduction, +5% Magic Resistance, +25 Max Weight, +25% Robustness.'}
      ],
      actives: [
        {name: 'Smash (Siege)', level: EVOLUTION_LEVEL,
          description: 'Smash procs -15% magic resistance on hit. VFX are now rock pillars coming from the ground.'}
      ]
    }),
    new Race({
      name: 'Assault Body',
      rarity: 'epic',
      stats: {...halfGolemStats,
          speedBoost: halfGolemStats.speedBoost + 0.06,
          damageReduction: halfGolemStats.damageReduction - 0.1,
          attackPower: 0.12,
          robustness: halfGolemStats.robustness + 0.25},
      passives: [
        {name: 'Assault Body', level: EVOLUTION_LEVEL,
          description: '+12% Attack Power Buff, +6% Speed, -10% Damage Reduction, +25% Robustness.'}
      ],
      actives: [
        {name: 'Smash (Assault)', level: EVOLUTION_LEVEL,
          description: 'Smash procs bleed on hit. VFX are now rock spikes coming from the ground.'}
      ]
    }),
    new Race({
      name: 'Crystal Body',
      rarity: 'epic',
      stats: {...halfGolemStats,
          speedBoost: halfGolemStats.speedBoost + 0.06,
          damageReduction: halfGolemStats.damageReduction - 0.1,
          magicPower: 0.12,
          robustness: halfGolemStats.robustness + 0.25},
      passives: [
        {name: 'Crystal Body', level: EVOLUTION_LEVEL,
          description: '+12% Magic Power Buff, +6% Speed, -10% Damage Reduction, +25% Robustness.'}
      ],
      actives: [
        {name: 'Smash (Crystal)', level: EVOLUTION_LEVEL,
          description: 'Smash increases the enemy\'s vulnerability to magic attacks. VFX are now crystal/ice spikes coming from the ground.'}
      ]
    })
  ]
});

const Bunny = new Race({
  name: 'Bunny',
  rarity: 'epic',
  passives: [
    {name: 'Bunny Dash', level: 1, description: 'Every single one of your dashes take you further.'}
  ],
  actives: [
    {name: 'Bunny Jump', level: 1, requirement: '+5 Physical, +35 Focus',
      description: 'A long-reaching dash that glides through the air with very large endlag. If an enemy is struck, a decent amount of damage is dealt with very high posture damage, and endlag is nullified.'},
    {name: 'Carrot Summoning', level: 15, requirement: 'Hunger 75, Health 750, Mana 500',
      description: 'Summons a Carrot to be eaten. Can be used in combat at 15% efficiency.'}
  ]
});

// ---------- Legendary ----------

const Dullahan = new Race({
  name: 'Dullahan',
  stats: {coldResistance: 0.25, holyResistance: -0.1, robustness: 0.25},
  rarity: 'legendary',
  passives: [
    {name: 'Grim Reaper', level: 1,
      description: 'Heal a small amount of health after killing a monster.'},
    {name: 'Undead Body', level: 1,
      description: '+25% Robustness, +25% Cold Resistance, -10% Holy Resistance.'}
  ],
  actives: [
    {name: 'Severed Sight', level: 1,
      description: 'Detach your head and throw it. Once it lands, activate the ability again to see through its eyes. Hold the ability while your head is out to call it back.'},
    {name: 'Soul Harvest', level: 15,
      description: 'Lunge forward and sweep with your scythe.'},
    {name: 'Death Sickle', level: 15,
      description: 'Landing a Dullahan ability has a chance to trigger Death Sickle, transforming Soul Harvest into a thrown scythe that deals damage.'}
  ]
});

const Vampire = new Race({
  name: 'Vampire',
  stats: {luck: 1, holyResistance: -0.2},
  rarity: 'legendary',
  passives: [
    {name: 'Vampiric Merit', level: 1,
      description: '+1 Luck (stacks with Lucky Ring and 2x event).'},
    {name: 'Vampiric', level: 1,
      description: 'Take 5% increased damage from all holy sources.'},
    {name: 'Nocturnal Being', level: 1,
      description: 'During the day: base stats reduced by 15%. During the night: base stats increased by 20%.'},
    {name: 'Bloodthirst', level: 25, requirement: 'Needs to be slotted',
      description: 'Bleeding an opponent heals you for 50% of the bleed damage dealt.'},
    {name: 'Famished', level: 40,
      description: 'You heal when taking bleed damage, but take 15% more holy damage.'}
  ],
  actives: [
    {name: 'Sanguine Burst', level: 10,
      description: 'Fire a short burst of fire, which inflicts bleed damage.'}
  ]
});

const seraphimStats = {luck: 1, fireResistance: -0.05, coldResistance: 0.1};

const Seraphim = new Race({
  name: 'Seraphim',
  stats: seraphimStats,
  rarity: 'legendary',
  passives: [
    {name: 'Seraphim Lineage', level: 1,
      description: '-5% Fire Resistance, +10% Cold Resistance, +1 Luck (stacks with Lucky Ring, luck rolls +2 in buffs).'}
  ],
  evolutions: [
    new Race({
      name: '2 Wings',
      rarity: 'legendary',
      stats: {...seraphimStats, agility: 15, speedBoost: 0.03},
      passives: [
        {name: '2-Wing Variant', level: EVOLUTION_LEVEL,
          description: '+15 Agility, +3% Speed Boost.'}
      ],
      actives: [
        {name: 'Angelic Absence', level: EVOLUTION_LEVEL,
          description: 'Speed blitz the unfaithful.'}
      ]
    }),
    new Race({
      name: '4 Wings',
      rarity: 'legendary',
      stats: {...seraphimStats, physicalAttack: 0.06},
      passives: [
        {name: '4-Wing Variant', level: EVOLUTION_LEVEL, description: '+6% Physical Attack.'}
      ],
      actives: [
        {name: 'Angelic Absence', level: EVOLUTION_LEVEL,
          description: 'Cast judgment upon the ground, unleashing an AOE attack.'}
      ]
    }),
    new Race({
      name: '6 Wings',
      rarity: 'legendary',
      stats: {...seraphimStats, focusEfficiency: 5, manaEfficiency: 5},
      passives: [
        {name: '6-Wing Variant', level: EVOLUTION_LEVEL,
          description: '+5 Focus Efficiency, +5 Mana Efficiency.'}
      ],
      actives: [
        {name: 'Angelic Absence', level: EVOLUTION_LEVEL,
          description: 'Pray to the celestials to restore your focus and mana.'}
      ]
    })
  ]
});

const infernimStats = {luck: 1, heatResistance: 0.1, holyResistance: -0.05};

const Infernim = new Race({
  name: 'Infernim',
  stats: infernimStats,
  rarity: 'legendary',
  passives: [
    {name: 'Hellborn', level: 1,
      description: '-5% Holy Resistance, +10% Heat Resistance, +1 Luck (stacks with Lucky Ring, luck rolls +2 in buffs).'}
  ],
  evolutions: [
    new Race({
      name: '2 Horns',
      rarity: 'legendary',
      stats: {...infernimStats, speedBoost: 0.06},
      passives: [
        {name: '2-Horn Variant', level: EVOLUTION_LEVEL, description: '+6% Speed Boost.'}
      ],
      actives: [
        {name: 'Hell\'s Embrace', level: EVOLUTION_LEVEL,
          description: 'Hellish dash that detonates shortly after.'}
      ]
    }),
    new Race({
      name: '4 Horns',
      rarity: 'legendary',
      stats: {...infernimStats, magicPower: 0.1},
      passives: [
        {name: '4-Horn Variant', level: EVOLUTION_LEVEL, description: '+10% Magic Power Buff.'}
      ],
      actives: [
        {name: 'Hell\'s Embrace', level: EVOLUTION_LEVEL,
          description: 'Snap your fingers unleashing Hell Chains.'}
      ]
    }),
    new Race({
      name: '6 Horns',
      rarity: 'legendary',
      stats: {...infernimStats, fireAttack: 0.2},
      passives: [
        {name: '6-Horn Variant', level: EVOLUTION_LEVEL, description: '+20% Fire Attack.'}
      ],
      actives: [
        {name: 'Hell\'s Embrace', level: EVOLUTION_LEVEL,
          description: 'Unleash your wrath sending a scorching wall forward.'}
      ]
    })
  ]
});

// ---------- Spec ----------

const Angel = new Race({
  name: 'Angel',
  stats: {speedBoost: 0.08},
  rarity: 'spec',
  description: '(Specs - unobtainable)',
  passives: [
    {name: 'Fleetfoot', level: 1, description: '8% speed boost.'},
    {name: 'Artificial', level: 1,
      description: 'Your hunger does not drain, but it takes longer to regenerate focus and mana.'}
  ],
  actives: [
    {name: 'Divine Smite', level: 1,
      description: 'Call upon divine power to bless your blade with holy light, unleashing a radiant explosion upon impact.'},
    {name: 'Spine Breaker', level: 1,
      description: 'Seize your enemy in a crushing grip and hurl them to the ground, leaving them briefly stunned.'}
  ]
});

const racesDatabase = {
  Human,
  Elf,
  Orc,
  Ghoul,
  Amphibu,
  Ailuran,
  Chiroptran,
  Slime,
  HalfGolem,
  Bunny,
  Dullahan,
  Vampire,
  Seraphim,
  Infernim,
  Angel
};

export default racesDatabase;
export { EVOLUTION_LEVEL };
