// Generiert aus dem Rune Slayer Wiki (https://rune-slayerrblx.fandom.com/wiki/Classes), Stand 2026-08-20.
const classData = {
  "Warrior": {
    "name": "Warrior",
    "subclasses": [
      "Sword Master",
      "Knight",
      "Berserker"
    ],
    "overview": "This class excels in melee combat, wielding a sword as their primary weapon.",
    "passiveFeatures": [
      {
        "level": 0,
        "name": "Sword Training",
        "description": "Unlocks the ability to utilize Swords."
      },
      {
        "level": 0,
        "name": "Heavy Armor",
        "description": "Unlocks Heavy Armor"
      }
    ],
    "actives": [
      {
        "level": 0,
        "name": "Slashing Strike",
        "description": "An exceptionally swift slash.",
        "evolveLevel": 10,
        "options": [
          {
            "level": null,
            "name": "Four-Fold Slash of Light",
            "description": "Unleashes four quick slashes in front of you. Air variant sends projectiles."
          },
          {
            "level": null,
            "name": "Mortal Strike",
            "description": "A powerful, vicious strike that deeply wounds the target, increasing the damage they take while reducing the effectiveness of their healing."
          },
          {
            "level": null,
            "name": "Shield Bash",
            "description": "Requires a shield. Strikes the enemy with your shield while auto-blocking is active. (High posture damage)"
          }
        ]
      },
      {
        "level": 5,
        "name": "Battle Aura",
        "description": "+25 Attack Power, + 5% Speed Boost, +5% Damage reduction (Active | 20s Duration)",
        "evolveLevel": 15,
        "options": [
          {
            "level": null,
            "name": "Fierce Battle Aura",
            "description": "Temporarily Increases Damage"
          },
          {
            "level": null,
            "name": "Swift Battle Aura",
            "description": "Temporarily Increases Movement Speed"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura",
            "description": "Temporarily Increases Defense"
          }
        ],
        "evolveLevel2": 25,
        "options2": [
          {
            "level": null,
            "name": "Fierce Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Savage Battle Aura",
            "description": "A battle aura that focuses entirely on enhancing your arm. (Lasts 8 seconds)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Warrior's Battle Aura",
            "description": "Shout and give you and your allies offensive benefits. (Lasts 20 seconds, only slightly worse than the Savage Battle Aura)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Swift Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Rapid Battle Aura",
            "description": "Increased speed. Gives 50 Agility for the duration of the Aura",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Alacrity Battle Aura",
            "description": "Exhaust 35% of ability cooldowns in exchange for speed",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Aegis Battle Aura",
            "description": "Manifest a shield that absorbs incoming damage. (Shield HP = 25% of max HP, lasts 10 seconds.)",
            "group": "Fortified Battle Aura:"
          },
          {
            "level": null,
            "name": "Protective Battle Aura",
            "description": "A defensive aura that strengthens and regenerates your body. (For 10 seconds, 10% DR and heal 10% HP)",
            "group": "Fortified Battle Aura:"
          }
        ]
      },
      {
        "level": 8,
        "name": "Assault",
        "description": "Two spin slashes in the direction you aim."
      },
      {
        "level": 13,
        "name": "Charge",
        "description": "Dash forward towards your target to close the gap."
      },
      {
        "level": 16,
        "name": "Counter",
        "description": "Enter a stance. If attacked in this stance, you counterattack with i-frames, dealing a strong strike followed by 4–6 weaker attacks."
      },
      {
        "level": 21,
        "name": "Hindsight Slash",
        "description": "Deliver a slash. If this slash hits, you will do another follow-up slash."
      },
      {
        "level": 23,
        "name": "Greater Counter",
        "description": "Counter's first hit gain bonus damage, scaled with the damage of the hit that triggered it."
      },
      {
        "level": 28,
        "name": "Whirl Wind",
        "description": "Spin for 2-4 seconds, dealing medium damage to nearby enemies."
      },
      {
        "level": 36,
        "name": "Leap",
        "description": "Leap forward, stunning and dealing damage on impact."
      },
      {
        "level": 40,
        "name": "Thrusting Strike",
        "description": "Deliver a devastating blow, sending any enemies backwards."
      }
    ],
    "passiveSkills": [
      {
        "level": 3,
        "name": "Two Hand Training",
        "description": "Allows the utilization of two-handed weapons."
      },
      {
        "level": 4,
        "name": "Shield Training",
        "description": "Allows the utilization of two-handed Shields."
      },
      {
        "level": 6,
        "name": "Focus Training",
        "description": "Reduce Focus Regeneration delay (-0.5 second)"
      },
      {
        "level": 17,
        "name": "Focus Training 2",
        "description": "Reduce Focus Regeneration delay (-1 second)"
      },
      {
        "level": 18,
        "name": "Trained",
        "description": "Successful Parry gives Damage Reduction"
      },
      {
        "level": 20,
        "name": "Sword Mastery",
        "description": "Increases Sword Damage by 10%"
      },
      {
        "level": 27,
        "name": "Focus Training 3",
        "description": "Reduce Focus Regeneration delay (-2 seconds)"
      },
      {
        "level": 35,
        "name": "Counter Force",
        "description": "Gain a damage bonus after being struck while in hyper armor."
      }
    ]
  },
  "Archer": {
    "name": "Archer",
    "subclasses": [
      "Sharpshooter",
      "Beast Tamer"
    ],
    "overview": "This class specializes in long range attacks with a bow.",
    "passiveFeatures": [
      {
        "level": 0,
        "name": "Bow Training",
        "description": "Unlocks the ability to utilize Bows."
      },
      {
        "level": 0,
        "name": "Medium Armor",
        "description": "Unlocks the ability to wear Medium Armor."
      }
    ],
    "actives": [
      {
        "level": 0,
        "name": "Power Shot",
        "description": "Shoot an average arrow in front of you.",
        "evolveLevel": 10,
        "options": [
          {
            "name": "Triple Shot",
            "description": "Shoot three arrows at the same time. Each arrow can hit the same target."
          },
          {
            "name": "Multi Shot",
            "description": "Shoot three arrows in quick succession, each going in the direction you are facing."
          }
        ]
      },
      {
        "level": 5,
        "name": "Battle Aura",
        "description": "+25 Attack Power, + 5% Speed Boost, +5% Damage reduction (Active | 18s Duration)",
        "evolveLevel": 15,
        "options": [
          {
            "name": "Fierce Battle Aura",
            "description": "Temporarily Increases Damage"
          },
          {
            "name": "Swift Battle Aura",
            "description": "Temporarily Increases Movement Speed"
          },
          {
            "name": "Fortified Battle Aura",
            "description": "Temporarily Increases Defense"
          }
        ],
        "evolveLevel2": 25,
        "options2": [
          {
            "level": null,
            "name": "Fierce Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Savage Battle Aura",
            "description": "A battle aura that focuses entirely on enhancing your arm. (Lasts 8 seconds)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Warrior's Battle Aura",
            "description": "Shout and give you and your allies offensive benefits. (Lasts 20 seconds, only slightly worse than the Savage Battle Aura)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Swift Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Rapid Battle Aura",
            "description": "Increased speed. Gives 50 Agility for the duration of the Aura",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Alacrity Battle Aura",
            "description": "Exhaust 35% of ability cooldowns in exchange for speed",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Aegis Battle Aura",
            "description": "Manifest a shield that absorbs incoming damage. (Shield HP = 25% of max HP, lasts 10 seconds.)",
            "group": "Fortified Battle Aura:"
          },
          {
            "level": null,
            "name": "Protective Battle Aura",
            "description": "A defensive aura that strengthens and regenerates your body. (For 10 seconds, 10% DR and heal 10% HP)",
            "group": "Fortified Battle Aura:"
          }
        ]
      },
      {
        "level": 8,
        "name": "Evasive Shot",
        "description": "Shoot an arrow while dashing backwards."
      },
      {
        "level": 13,
        "name": "Mark",
        "description": "A self-buff that tailors to your tamed pet."
      },
      {
        "level": 15,
        "name": "Auto Shot",
        "description": "Sends a homing arrow to your target.",
        "evolveLevel": 25,
        "options": [
          {
            "name": "Double Track",
            "description": "Unleash two homing arrows."
          },
          {
            "name": "Concussive Shot",
            "description": "The homing arrow now slows the target."
          }
        ]
      },
      {
        "level": 28,
        "name": "Hunter's Mark",
        "description": "Mark an enemy. That enemy takes increased damage from all sources. (Active | 30s Duration)"
      },
      {
        "level": 30,
        "name": "Arrow Rain",
        "description": "Launch an arrow in the sky. The target area will take constant fire from raining arrows for a good while."
      },
      {
        "level": 40,
        "name": "Whirling Arrow",
        "description": "Fire an arrow that drills into the target, dealing continuous damage."
      }
    ],
    "passiveSkills": [
      {
        "level": 6,
        "name": "Focus Training",
        "description": "Increases Focus Regeneration"
      },
      {
        "level": 8,
        "name": "Initiative",
        "description": "The first hit of an unsuspecting target deals bonus damage."
      },
      {
        "level": 17,
        "name": "Focus Training 2",
        "description": "Increases Focus Regeneration"
      },
      {
        "level": 20,
        "name": "Bow Mastery",
        "description": "Increases Bow Damage by 10%"
      },
      {
        "level": 27,
        "name": "Focus Training 3",
        "description": "Increases your regeneration to be 3x as fast."
      },
      {
        "level": 35,
        "name": "Momentum",
        "description": "Every hit increases your damage for 5 seconds."
      }
    ]
  },
  "Thief": {
    "name": "Thief",
    "subclasses": [
      "Assassin",
      "Ninja"
    ],
    "overview": "This class excels at being quick and attacking at a fast rate wielding daggers.",
    "passiveFeatures": [
      {
        "level": 0,
        "name": "Dagger Training",
        "description": "Unlocks the ability to utilize Daggers."
      },
      {
        "level": 0,
        "name": "Medium Armor",
        "description": "Unlocks the ability to wear Medium Armor."
      }
    ],
    "actives": [
      {
        "level": 0,
        "name": "Piercing Strike",
        "description": "Thrust forwards with your weapon.",
        "evolveLevel": 10,
        "options": [
          {
            "name": "Piercing Slash",
            "description": "Dash forward and deliver a sweeping thrust."
          },
          {
            "name": "Piercing Thrust",
            "description": "Dash forward with a powerful thrust, driving your weapon deeper into the target. Weapons: Dagger, Medium | Physical: 5 | Focus Drain: 30"
          }
        ]
      },
      {
        "level": 3,
        "name": "Weapon Throw",
        "description": "Throw a weapon at your target (aims with mouse).",
        "evolveLevel": 18,
        "options": [
          {
            "name": "Triple Dagger Throw",
            "description": "Hurls three weapons in a fan pattern, causing a bleed effect if all three hit the target."
          },
          {
            "name": "Shuriken Barrage",
            "description": "Throws a barrage of shurikens, damaging your enemy."
          }
        ]
      },
      {
        "level": 5,
        "name": "Battle Aura",
        "description": "+25 Attack Power, + 5% Speed Boost, +5% Damage reduction (Active | 18s Duration)",
        "evolveLevel": 15,
        "options": [
          {
            "name": "Fierce Battle Aura",
            "description": "Temporarily Increases Damage"
          },
          {
            "name": "Swift Battle Aura",
            "description": "Temporarily Increases Movement Speed (10% speed boost for 20 seconds)"
          },
          {
            "name": "Fortified Battle Aura",
            "description": "Temporarily Increases Defense"
          }
        ],
        "evolveLevel2": 25,
        "options2": [
          {
            "level": null,
            "name": "Fierce Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Savage Battle Aura",
            "description": "A battle aura that focuses entirely on enhancing your arm. (Lasts 8 seconds)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Warrior's Battle Aura",
            "description": "Shout and give you and your allies offensive benefits. (Lasts 20 seconds, only slightly worse than the Savage Battle Aura)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Swift Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Rapid Battle Aura",
            "description": "Increased speed. Gives 50 Agility for the duration of the Aura",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Alacrity Battle Aura",
            "description": "Exhaust 35% of ability cooldowns in exchange for speed",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Aegis Battle Aura",
            "description": "Manifest a shield that absorbs incoming damage. (Shield HP = 25% of max HP, lasts 10 seconds.)",
            "group": "Fortified Battle Aura:"
          },
          {
            "level": null,
            "name": "Protective Battle Aura",
            "description": "A defensive aura that strengthens and regenerates your body. (For 10 seconds, 10% DR and heal 10% HP)",
            "group": "Fortified Battle Aura:"
          }
        ]
      },
      {
        "level": 22,
        "name": "Backstab",
        "description": "Swift strike to the target. Significantly increases critical chance when striking from behind."
      },
      {
        "level": 28,
        "name": "Liver Shot",
        "description": "Stab your target with a blow that stuns them for a short time."
      },
      {
        "level": 35,
        "name": "Ambush",
        "description": "Piercing strike that secures a hold on the target."
      },
      {
        "level": 40,
        "name": "Deathmark",
        "description": "Unleashing Ambush upon a target already bleeding invokes Deathmark."
      }
    ],
    "passiveSkills": [
      {
        "level": 6,
        "name": "Focus Training",
        "description": "Increases Focus Regeneration Level 8 Initiative - The first hit of an unsuspecting target deals bonus damage."
      },
      {
        "level": 12,
        "name": "Backstabber",
        "description": "You deal extra damage when striking from behind your target. Level 17 Focus Training 2 - Increases Focus Regeneration Level 18 Trained - Successful Parry gives Damage Reduction Level 20 Dagger Mastery - Increases Dagger Damage by 10%"
      },
      {
        "level": 23,
        "name": "Garrote",
        "description": "Critical hits make your target bleed for a short time. Level 26 Double Jump - Allows user to double jump."
      },
      {
        "level": 26,
        "name": "Focus Training 3",
        "description": "Increases your regeneration to be 3x as fast."
      },
      {
        "level": 35,
        "name": "Momentum Builder",
        "description": "Every hit increases your damage for 5 seconds."
      }
    ]
  },
  "Striker": {
    "name": "Striker",
    "subclasses": [
      "Asura",
      "Monk"
    ],
    "overview": "A melee-focused class specializing in close-range combat, this class utilizes fists and gauntlet-type weapons to deliver enhanced physical damage.",
    "passiveFeatures": [
      {
        "level": 0,
        "name": "Gauntlet Training",
        "description": "Unlocks the ability to utilize Gauntlets."
      },
      {
        "level": 0,
        "name": "Light Armor",
        "description": "Unlocks the ability to wear Light Armor."
      }
    ],
    "actives": [
      {
        "level": 0,
        "name": "Strike",
        "description": "A simple strike that knocks enemies back.",
        "evolveLevel": 10,
        "options": [
          {
            "level": null,
            "name": "Rapid Strike",
            "description": "A rapid flurry of strikes. Will grab and stun non-giant enemies for the duration of the combo."
          },
          {
            "level": null,
            "name": "Power Strike",
            "description": "A strike that can be charged for more power."
          }
        ]
      },
      {
        "level": 3,
        "name": "Brace",
        "description": "Enter a defensive stance that lowers incoming damage. Then, swiftly strike."
      },
      {
        "level": 5,
        "name": "Battle Aura",
        "description": "+25 Attack Power, + 5% Speed Boost, +5% Damage reduction (Active | 18s Duration)",
        "evolveLevel": 15,
        "options": [
          {
            "level": null,
            "name": "Fierce Battle Aura",
            "description": "Temporarily Increases Damage"
          },
          {
            "level": null,
            "name": "Swift Battle Aura",
            "description": "Temporarily Increases Movement Speed"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura",
            "description": "Temporarily Increases Defense"
          }
        ],
        "evolveLevel2": 25,
        "options2": [
          {
            "level": null,
            "name": "Fierce Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Savage Battle Aura",
            "description": "A battle aura that focuses entirely on enhancing your arm.",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Warrior's Battle Aura",
            "description": "Shout and give you and your allies offensive benefits.",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Swift Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Rapid Battle Aura",
            "description": "Increased speed.",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Alacrity Battle Aura",
            "description": "Exhaust 35% of ability cooldowns in exchange for speed.",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Aegis Battle Aura",
            "description": "Manifest a shield that absorbs incoming damage. (Shield HP = 25% of max HP)",
            "group": "Fortified Battle Aura:"
          },
          {
            "level": null,
            "name": "Protective Battle Aura",
            "description": "A defensive aura that strengthens and regenerates your body. (For 10 seconds, 10% DR and heal 10% HP)",
            "group": "Fortified Battle Aura:"
          }
        ]
      },
      {
        "level": 8,
        "name": "Vertical Strike",
        "description": "Uppercut that hits multiple times."
      },
      {
        "level": 15,
        "name": "Limit Breaker",
        "description": "Activate to gain an attack and movement speed buff, at the cost of some health. Can be activated multiple times for stacking effects. Costs 5/10/15/25% of max HP for each use while increasing the potency of the attack and movement speed buff. Maximum buff potency reached after 4 uses; repeated usages refresh the buff duration."
      },
      {
        "level": 22,
        "name": "Blast",
        "description": "Harness energy to be sent as a projectile.",
        "evolveLevel": 34,
        "options": [
          {
            "level": null,
            "name": "Blast Barrage",
            "description": "A barrage of aura blasts."
          },
          {
            "level": null,
            "name": "Charged Blast",
            "description": "A super charged aura blast."
          }
        ]
      },
      {
        "level": 26,
        "name": "Uppercut",
        "description": "Deliver a powerful uppercut that ignores enemy attacks. Has hyperarmor."
      },
      {
        "level": 28,
        "name": "Leap Smash",
        "description": "Propel yourself forward, crashing into the ground with immense force upon impact."
      },
      {
        "level": 36,
        "name": "Axe Kick",
        "description": "Slam the ground with a powerful kick, executing enemies below a certain amount. Has hyperarmor."
      },
      {
        "level": 40,
        "name": "Rampage",
        "description": "Attack wildly in front of you."
      }
    ],
    "passiveSkills": [
      {
        "level": 6,
        "name": "Focus Training",
        "description": "Reduce Focus regeneration delay. (-0.5 second)"
      },
      {
        "level": 20,
        "name": "Tackle",
        "description": "Land Brace's second part to gain damage reduction. If Limit Breaker is used while tackle is active, it won't cost anything. 25% damage reduction for 7 seconds. Allows you to keep Limit Breaker up indefinitely at no health cost as long as you keep fighting stuff."
      },
      {
        "level": 17,
        "name": "Focus Training II",
        "description": "Reduce Focus regeneration delay. (-1 second)"
      },
      {
        "level": 18,
        "name": "Trained",
        "description": "Successful Parry gives Damage Reduction Gives 5% damage reduction for 4 seconds, seems to stack with multiple successive parries. Maxes out at 15% at three parries? (needs testing)"
      },
      {
        "level": 20,
        "name": "Gauntlet Mastery",
        "description": "Increases Gauntlet Damage by 10%"
      },
      {
        "level": 27,
        "name": "Focus Training III",
        "description": "Reduce Focus regeneration delay. (-2 seconds)"
      },
      {
        "level": 32,
        "name": "Pain Conversion",
        "description": "When struck, you recover 2.5% HP, but this effect can only occur once every 10 seconds."
      },
      {
        "level": 35,
        "name": "Counter Force",
        "description": "Gain a damage bonus when struck while in hyperarmor, turning your resilience into power. 25% damage buff for 4 seconds. Brace, Vertical Strike, Power Strike, Uppercut and Axe Kick can all trigger it."
      },
      {
        "level": 40,
        "name": "Rampage",
        "description": "A barrage of smashes."
      }
    ]
  },
  "Magician": {
    "name": "Magician",
    "subclasses": [
      "Warlock",
      "Sorcerer"
    ],
    "overview": "This class excels in using Magic along with a staff as their primary weapon.",
    "passiveFeatures": [
      {
        "level": 0,
        "name": "Staff Training",
        "description": "Unlocks the ability to utilize Staffs."
      },
      {
        "level": 0,
        "name": "Light Armor",
        "description": "Unlocks the ability to wear Light Armor."
      }
    ],
    "actives": [
      {
        "level": 0,
        "name": "Magic Arrow",
        "description": "Fire a small magic arrow at a target.",
        "evolveLevel": 15,
        "options": [
          {
            "level": null,
            "name": "Magic Arrows",
            "description": "Fires three arrows at the same time."
          },
          {
            "level": null,
            "name": "Magic Repeater",
            "description": "Fires three arrows in quick succession."
          }
        ]
      },
      {
        "level": 3,
        "name": "Lesser Strength",
        "description": "Casts an incantation that applies a small Strength Buff (+10) for 5 minutes to you and nearby allies."
      },
      {
        "level": 3,
        "name": "Lesser Intellect",
        "description": "Casts an incantation that applies a small Intelligence Buff (+10) for 5 minutes to you and nearby allies."
      },
      {
        "level": 3,
        "name": "Lesser Dexterity",
        "description": "Casts an incantation that applies a small Agility Buff (+10) for 5 minutes to you and nearby allies."
      },
      {
        "level": 5,
        "name": "Mana Shield",
        "description": "Gives Damage Reduction for 5 hits, lowering in effectiveness every hit."
      },
      {
        "level": 7,
        "name": "Conjure Food I",
        "description": "Conjure basic food that replenishes health and hunger. (45 hunger, +195 HP)"
      },
      {
        "level": 7,
        "name": "Conjure Water I",
        "description": "Conjure basic water to refresh mana. (+150 Mana)"
      },
      {
        "level": 10,
        "name": "Mana Bomb",
        "description": "Conjure a large ball of Mana and fire it forward, with it exploding upon contact with a surface or enemy and dealing damage in an AOE."
      },
      {
        "level": 13,
        "name": "Magic Imbue",
        "description": "Activate to have basic attacks deal magic damage."
      },
      {
        "level": 16,
        "name": "Strength",
        "description": "Casts an incantation that applies a moderate Strength Buff (+25) for 5 minutes to you and nearby allies."
      },
      {
        "level": 16,
        "name": "Intellect",
        "description": "Casts an incantation that applies a moderate Intelligence Buff (+25) for 5 minutes to you and nearby allies."
      },
      {
        "level": 16,
        "name": "Dexterity",
        "description": "Casts an incantation that applies a moderate Agility Buff (+25) for 5 minutes to you and nearby allies."
      },
      {
        "level": 22,
        "name": "Conjure Food II",
        "description": "Conjure good food that replenishes health and hunger. (75 hunger, +465 HP)"
      },
      {
        "level": 22,
        "name": "Conjure Water II",
        "description": "Conjure good water to refresh mana. (+300 Mana)"
      },
      {
        "level": 30,
        "name": "Blink",
        "description": "Teleports the caster forward."
      },
      {
        "level": 32,
        "name": "Greater Strength",
        "description": "Casts an incantation that applies a huge Strength Buff (+50) for 5 minutes to you and nearby allies."
      },
      {
        "level": 32,
        "name": "Greater Intellect",
        "description": "Casts an incantation that applies a huge Intelligence Buff (+50) for 5 minutes to you and nearby allies."
      },
      {
        "level": 32,
        "name": "Greater Dexterity",
        "description": "Casts an incantation that applies a huge Agility Buff (+50) for 5 minutes to you and nearby allies."
      },
      {
        "level": 33,
        "name": "Overload",
        "description": "Unleash the full potential of your magic, dramatically amplifying your power for a short duration (+50% Magic damage, 15 seconds)."
      },
      {
        "level": 36,
        "name": "Conjure Food III",
        "description": "Conjure amazing food that replenishes health and hunger."
      },
      {
        "level": 36,
        "name": "Conjure Water III",
        "description": "Conjure amazing water to refresh mana."
      },
      {
        "level": 40,
        "name": "Arcane Storm",
        "description": "Conjures magical arrows from the sky, dealing constant damage to an area."
      }
    ],
    "passiveSkills": [
      {
        "level": 8,
        "name": "Arcane Armor",
        "description": "Gain bonus armor, scaling with Intelligence."
      },
      {
        "level": 11,
        "name": "Magic Training 1",
        "description": "Increases Mana Regeneration."
      },
      {
        "level": 17,
        "name": "Spell Made",
        "description": "Taking a lethal hit depletes 50% mana instead."
      },
      {
        "level": 18,
        "name": "Diverted Energy",
        "description": "Magic Shield restores mana equal to the damage taken when it is destroyed."
      },
      {
        "level": 21,
        "name": "Magic Training 2",
        "description": "Increases Mana Regeneration even more."
      },
      {
        "level": 24,
        "name": "Mana Pool",
        "description": "10% increased mana."
      },
      {
        "level": 27,
        "name": "Meditation",
        "description": "Mana regeneration isn't interrupted during casting."
      },
      {
        "level": 38,
        "name": "Clearcast",
        "description": "When a spell hits a target, there is a chance to make the next spell cast free."
      }
    ]
  },
  "Priest": {
    "name": "Priest",
    "subclasses": [
      "Cleric"
    ],
    "overview": "This class excels in using Magic along with a staff as their primary weapon.",
    "passiveFeatures": [
      {
        "level": 0,
        "name": "Staff Training",
        "description": "Unlocks the ability to utilize Staffs."
      },
      {
        "level": 0,
        "name": "Light Armor",
        "description": "Unlocks the ability to wear Light Armor."
      }
    ],
    "actives": [
      {
        "level": 0,
        "name": "Holy Light",
        "description": "Heal a light amount to a target. Holding right click applies it to yourself."
      },
      {
        "level": 3,
        "name": "Lesser Strength",
        "description": "Casts an incantation that applies a small Strength Buff (+10) for 5 minutes to you and nearby allies."
      },
      {
        "level": 3,
        "name": "Lesser Intellect",
        "description": "Casts an incantation that applies a small Intelligence Buff (+10) for 5 minutes to you and nearby allies."
      },
      {
        "level": 3,
        "name": "Lesser Dexterity",
        "description": "Casts an incantation that applies a small Agility Buff (+10) for 5 minutes to you and nearby allies."
      },
      {
        "level": 4,
        "name": "Dispell",
        "description": "Removes debuffs from a target. Holding right click applies it to yourself."
      },
      {
        "level": 5,
        "name": "Holy Shield",
        "description": "Casts a shield on a target. Holding right click applies it to yourself. Scales 1x with Spirit."
      },
      {
        "level": 10,
        "name": "Holy Fire",
        "description": "Scorch a target, dealing holy damage and lingering burning damage."
      },
      {
        "level": 13,
        "name": "Holy Imbue",
        "description": "Activate to have basic attacks deal holy damage."
      },
      {
        "level": 16,
        "name": "Strength",
        "description": "Casts an incantation that applies a moderate Strength Buff (+25) for 5 minutes to you and nearby allies."
      },
      {
        "level": 16,
        "name": "Intellect",
        "description": "Casts an incantation that applies a moderate Intelligence Buff (+25) for 5 minutes to you and nearby allies."
      },
      {
        "level": 16,
        "name": "Dexterity",
        "description": "Casts an incantation that applies a moderate Agility Buff (+25) for 5 minutes to you and nearby allies."
      },
      {
        "level": 17,
        "name": "Flash Heal",
        "description": "Casts a light heal to a target immediately. Holding right click applies it to yourself."
      },
      {
        "level": 20,
        "name": "Smite",
        "description": "Cast a lightning strike on a target, dealing moderate damage."
      },
      {
        "level": 24,
        "name": "Enlightenment",
        "description": "Channel for several seconds. Massively heal yourself and nearby allies."
      },
      {
        "level": 27,
        "name": "Divine Volley",
        "description": "Cast a ball that heals nearby allies and damages enemies on impact."
      },
      {
        "level": 31,
        "name": "Greater Smite",
        "description": "Cast a greater lightning strike on a target, dealing huge damage and knocking enemies upwards."
      },
      {
        "level": 32,
        "name": "Greater Strength",
        "description": "Casts an incantation that applies a huge Strength Buff (+50) for 5 minutes to you and nearby allies."
      },
      {
        "level": 32,
        "name": "Greater Intellect",
        "description": "Casts an incantation that applies a huge Intelligence Buff (+50) for 5 minutes to you and nearby allies."
      },
      {
        "level": 32,
        "name": "Greater Dexterity",
        "description": "Casts an incantation that applies a huge Agility Buff (+50) for 5 minutes to you and nearby allies."
      },
      {
        "level": 32,
        "name": "Resurrection",
        "description": "Channel on the corpse of a player. Bring them back from the dead with small health and mana."
      },
      {
        "level": 40,
        "name": "Suverias's Light",
        "description": "Immediately heals a great amount of health to target player. Holding right click applies it to yourself."
      }
    ],
    "passiveSkills": [
      {
        "level": 11,
        "name": "Magic Training 1",
        "description": "Increases Mana Regeneration. Level 21 Magic Training 2 - Increases Mana Regeneration even more. Level 22 Holy Reach - Healing magic can be cast at any distance as long as you have line of sight. Level 26 Purging Flames - Smite has a chance of refreshing the cooldown of Holy Fire."
      },
      {
        "level": 34,
        "name": "Blessed Heals",
        "description": "On a critical heal you bless your target."
      },
      {
        "level": 37,
        "name": "Radiant Spirit",
        "description": "Gain bonus Intelligence, scaling with Spirit (+50% scaling) Smite and Greater Smite: When using Greater Smite before Smite, if the second skill did not have a cooldown, it will go on cooldown. Blessing of Harmony: This skill can be used on anything, including enemy NPCs. Angelic guardian: This skill can be used on anything, including enemy NPCs. Holy Reach: This skill makes the radius of using healing skills very large, but it does not work correctly with some skills. For example, with Flash Heal it works correctly, but with Holy Light - it does not. "
      }
    ]
  },
  "Samurai": {
    "name": "Samurai",
    "subclasses": [
      "Orochi"
    ],
    "overview": "This class excels in swift melee combat, wielding a katana as their primary weapon. This class's focus is on a high constant DPS as a opposed to the burst damage dealt by Thieves.",
    "passiveFeatures": [
      {
        "level": 0,
        "name": "Katana Training",
        "description": "Unlocks the ability to utilize Katanas."
      },
      {
        "level": 0,
        "name": "Medium Armor",
        "description": "Unlocks Medium Armor"
      }
    ],
    "actives": [
      {
        "level": 0,
        "name": "Unsheathe",
        "description": "Resheathe your katana to charge it up for a powerful horizontal slash.",
        "evolveLevel": 10,
        "options": [
          {
            "level": null,
            "name": "Drawing Blade",
            "description": "Sheathe your weapon, releasing a crescent strike in its wake,"
          },
          {
            "level": null,
            "name": "Quick Draw",
            "description": "Sheathe your blade and, once ready, release a flurry of slashes forward."
          }
        ]
      },
      {
        "level": 5,
        "name": "Battle Aura",
        "description": "+25 Attack Power, + 5% Speed Boost, +5% Damage reduction (Active | 20s Duration)",
        "evolveLevel": 15,
        "options": [
          {
            "level": null,
            "name": "Fierce Battle Aura",
            "description": "Temporarily Increases Damage"
          },
          {
            "level": null,
            "name": "Swift Battle Aura",
            "description": "Temporarily Increases Movement Speed"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura",
            "description": "Temporarily Increases Defense"
          }
        ],
        "evolveLevel2": 25,
        "options2": [
          {
            "level": null,
            "name": "Fierce Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Savage Battle Aura",
            "description": "A battle aura that focuses entirely on enhancing your arm. (Lasts 8 seconds)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Warrior's Battle Aura",
            "description": "Shout and give you and your allies offensive benefits. (Lasts 20 seconds, only slightly worse than the Savage Battle Aura)",
            "group": "Fierce Battle Aura:"
          },
          {
            "level": null,
            "name": "Swift Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Rapid Battle Aura",
            "description": "Increased speed.",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Alacrity Battle Aura",
            "description": "Exhaust 35% of ability cooldowns in exchange for speed.",
            "group": "Swift Battle Aura:"
          },
          {
            "level": null,
            "name": "Fortified Battle Aura:",
            "description": ""
          },
          {
            "level": null,
            "name": "Aegis Battle Aura",
            "description": "Manifest a shield that absorbs incoming damage. (Shield HP = 25% of max HP)",
            "group": "Fortified Battle Aura:"
          },
          {
            "level": null,
            "name": "Protective Battle Aura",
            "description": "A defensive aura that strengthens and regenerates your body. (For 10 seconds, 10% DR and heal 10% HP)",
            "group": "Fortified Battle Aura:"
          }
        ]
      },
      {
        "level": 7,
        "name": "Lightning Strikes Twice",
        "description": "Draw your blade, fiercely filleting your opponent."
      },
      {
        "level": 16,
        "name": "Serpents Stance",
        "description": "Cut your enemy, slithering between them through their block."
      },
      {
        "level": 22,
        "name": "Fierce Whirlwind",
        "description": "Rush forward and slash a whirlwind in a circle around you."
      },
      {
        "level": 28,
        "name": "Storm of Blades",
        "description": "Raise your weapon up before cutting down anything in your path with a multitude of cuts."
      },
      {
        "level": 32,
        "name": "Unleashed Winds",
        "description": "Conjure the winds unto your blade, unleashing a wretched blast onto your foe."
      },
      {
        "level": 34,
        "name": "Relenting Storm",
        "description": "Conqure the winds with your blade, launching any foes up into the air."
      }
    ],
    "passiveSkills": [
      {
        "level": 6,
        "name": "Focus Training",
        "description": "Reduce Focus Regeneration delay (-0.5 second)"
      },
      {
        "level": 12,
        "name": "Mastered Blade",
        "description": "When your blade is in \"sheathed\" form (unsheathe and its paths), gain a 20% damage reduction until the attack is over, if the attack is interrupted, gain a 40% cooldown reduction on that attack,"
      },
      {
        "level": 17,
        "name": "Focus Training 2",
        "description": "Reduce Focus Regeneration delay (-1 second)"
      },
      {
        "level": 20,
        "name": "Katana Mastery",
        "description": "Increases Katana Damage by 10%"
      },
      {
        "level": 23,
        "name": "Voltaic Finisher",
        "description": "The second strike of Lightning Strikes Twice procs 10% haemorrhage."
      },
      {
        "level": 27,
        "name": "Focus Training 3",
        "description": "Reduce Focus Regeneration delay (-2 second)"
      },
      {
        "level": 34,
        "name": "Poisoned Blade",
        "description": "Your basic attacks do 10% more damage if the enemy is poisoned and for every time you proc hemorrhage, you also proc 25% poison. Katanas cannot be dual-wielded, and Samurai's active skills are only compatible with katanas."
      }
    ]
  },
  "Sword Master": {
    "name": "Sword Master",
    "subclassOf": "Warrior",
    "overview": "Sword Master is a subclass of Warrior. A true master of the blade, able to flicker across the battlefield to strike down foes.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Bulwarks Might",
        "description": "Gain bonus strength, scaling with total armor (+3.5% scaling)."
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Field",
        "description": "Places a large field around you. Enemies in the Field will be hit when Flicker Strike is activated."
      },
      {
        "level": 30,
        "name": "Flicker Strike",
        "description": "Thrust in front of you. If a field has been placed, the thrust chains to other enemies, until all enemies have been hit."
      }
    ],
    "passiveSkills": [
      {
        "level": 38,
        "name": "Flux",
        "description": "When you land an attack within your field, you gain flux. Each 20% flux causes Flicker Strike to hit your primary target an additional time."
      },
      {
        "level": null,
        "name": "Flicker Counter",
        "description": "A counter that when activated, allows you to flicker to your target and chain trough all enemies inside"
      }
    ]
  },
  "Knight": {
    "name": "Knight",
    "subclassOf": "Warrior",
    "overview": "Knight is a subclass of Warrior. A stalwart defender, wielding their shield with mastery to protect their allies from danger.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Fortress",
        "description": "When using a shield skill that causes you to block, you cannot be guard broken."
      },
      {
        "level": 30,
        "name": "Iron Will",
        "description": "Absorb a portion of damage of nearby party members. Said absorbed damage can be resisted further by your armor or damage reduction effects"
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Exhaust",
        "description": "Use up your posture. Gain damage reduction for a set time. Remove all your accumulated posture and gain upward of 52% Damage Reduction based on posture removed."
      },
      {
        "level": 33,
        "name": "Shield Slam",
        "description": "Slam your Shield on the ground, putting the attention of nearby enemies to yourself."
      },
      {
        "level": 38,
        "name": "Shield Crash",
        "description": "Charge with your shield, blocking and hitting anything in your path."
      },
      {
        "level": 43,
        "name": "Taunting Roar",
        "description": "Clank your shield three times, sending shockwaves provoking anything nearby, forcing hostile creatures to focus their attacks on you."
      },
      {
        "level": 48,
        "name": "Bastion Field",
        "description": "Stand your ground forming a protective field at your feet. Allies within the field take reduced damage (30%), while absorbed damage is redirected into your Shield Bar."
      }
    ],
    "passiveSkills": []
  },
  "Berserker": {
    "name": "Berserker",
    "subclassOf": "Warrior",
    "overview": "Berserker is a subclass of Warrior. A savage warrior who fuels their strength with rage, cleaving through enemies.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Rage",
        "description": "Whilst in combat, a Rage bar will increase. Rage can be used to activate Berserker abilities."
      },
      {
        "level": 30,
        "name": "Blood Lust",
        "description": "Gain physical damage and life-steal based on missing health."
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Enrage",
        "description": "Enter an enraged state, gaining hyperarmor, 25% damage boost, and 25% speed boost for 8 seconds."
      },
      {
        "level": 38,
        "name": "Blood Thirst",
        "description": "Strike twice. Both heals the user on hit."
      },
      {
        "level": 43,
        "name": "Blood Surge",
        "description": "Channel your rage into a surge of blood, consuming your rage for a significant portion of your health."
      },
      {
        "level": 48,
        "name": "Blood Rage",
        "description": "Channel your rage into a crushing slam, dealing massive damage and restoring a portion of your health."
      }
    ],
    "passiveSkills": [
      {
        "level": 30,
        "name": "Blood Craze",
        "description": "Killing enemies gives a 30% speed buff for 8 seconds and 25 Rage."
      }
    ]
  },
  "Sharpshooter": {
    "name": "Sharpshooter",
    "subclassOf": "Archer",
    "overview": "Sharpshooter is a subclass of Archer, focusing on precise and deadly ranged attacks.",
    "passiveFeatures": [],
    "actives": [
      {
        "level": 30,
        "name": "Ballistic Shot",
        "description": "A swift pull shot that drops rapidly."
      },
      {
        "level": 35,
        "name": "Dragon Piercer",
        "description": "Fire a powerful shot."
      },
      {
        "level": 43,
        "name": "Tracer Shot",
        "description": "Fire a powerful homing shot."
      },
      {
        "level": 48,
        "name": "Focused aim",
        "description": "Enter in a deep state of concentration. While in this stance, you cannot move, but any ability becomes uninterruptible and is empowered"
      }
    ],
    "passiveSkills": [
      {
        "level": 33,
        "name": "Double Tap",
        "description": "Ballistic Shot fires two arrows but deals 20% less damage."
      },
      {
        "level": 38,
        "name": "Piercing Focus",
        "description": "Landing a Ballistic Shot lowers the cooldown of Dragon Piercer."
      }
    ]
  },
  "Beast Tamer": {
    "name": "Beast Tamer",
    "subclassOf": "Archer",
    "overview": "Beast Tamer is a subclass of Archer, focusing on the utilization of Pets.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Alpha Predator",
        "description": "Allows the ability to tame high-level mobs."
      }
    ],
    "actives": [
      {
        "level": 33,
        "name": "Feral Roar",
        "description": "A roar the disables the usage of enemies Pets for 10 seconds."
      },
      {
        "level": 35,
        "name": "Feral Strike",
        "description": "For the next 4 hits, your tame will heal for half the damage they do."
      },
      {
        "level": 43,
        "name": "Primal Fury",
        "description": "Unleash the power withing yourself and your companion. For a short duration, both you and your beast enter a primal rage state. 30 focus drain."
      },
      {
        "level": 48,
        "name": "Call of the Wild",
        "description": "Answer nature's call and temporaly summon one of your stables companion to fight by your side."
      }
    ],
    "passiveSkills": [
      {
        "level": 30,
        "name": "Bestial Swiftness",
        "description": "Increased movement speed while riding a mount."
      }
    ]
  },
  "Assassin": {
    "name": "Assassin",
    "subclassOf": "Thief",
    "overview": "Assassin is a subclass of Thief. A silent killer who vanishes into the shadows, striking with lethal precision. This sub-class is PvP based, which means that its main use is solely for PvP.",
    "passiveFeatures": [],
    "actives": [
      {
        "level": 30,
        "name": "Veil",
        "description": "Enter a state of invisibility."
      },
      {
        "level": 33,
        "name": "Shadow Step",
        "description": "Teleport behind a distant target."
      },
      {
        "level": 38,
        "name": "Gouge",
        "description": "Seize a human target and slash their eyes, leaving them blinded."
      },
      {
        "level": 43,
        "name": "mirage blade",
        "description": "vanish into the shadows, swiftly evading all moves and delivering a final slash at the end of the dance (usable when veiled)"
      },
      {
        "level": 48,
        "name": "Thousand weapons",
        "description": "Enter a deadly dance and unleash a rapid flurry of weapons ahead of you"
      }
    ],
    "passiveSkills": [
      {
        "level": 35,
        "name": "Greater Initiative",
        "description": "If you land the first hit, that hit deals 50% bonus damage."
      }
    ]
  },
  "Ninja": {
    "name": "Ninja",
    "subclassOf": "Thief",
    "overview": "Ninja is a subclass of Thief. A swift and elusive rogue, overwhelming foes with rapid strikes and relentless agility.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Sky Rend",
        "description": "Landing Rising Fang grants the ability to utilize Sky Rend."
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Rising Fang",
        "description": "Slash upwards, launching you and your target into the air."
      },
      {
        "level": 30,
        "name": "Rend",
        "description": "Dash through your enemies, launching them into the air on impact."
      },
      {
        "level": 43,
        "name": "Shadow Knives",
        "description": "Throws 3 unrelenting shadow knives that home in on a target."
      },
      {
        "level": 48,
        "name": "Mirage Clone",
        "description": "Leave behind a spectral clone. After a small duration swap place with with the spectral clone which mimics your most recent move (Thief Move)."
      }
    ],
    "passiveSkills": [
      {
        "level": 38,
        "name": "Shukuchi",
        "description": "Makes your dash instant. - Using Rising Fang in the air allows the user to launch the attack downwards - Successfully landing both Rising Fang and Rend will reset the cooldown of each skill respectively. - It is recommended to use Rend immediately after Rising Fang to combo and perform a Sky Rend to maximise DMG. - Ninja is the recommended Subclass for PVE, whereas Assassin is recommended for PVP. Although both can work interchangeably depending on play style."
      }
    ]
  },
  "Asura": {
    "name": "Asura",
    "subclassOf": "Striker",
    "overview": "Asura is one of the 2 sub classes of Striker, being an aggressive melee class that consists of strong devastating combos.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Wrath",
        "description": "Landing Asura's Crash will give you Wrath (+5% Damage, +5% Damage reduction, 8 seconds) Wrath is consumed to activate Asura's Wrath."
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Asura's Crash",
        "description": "Every time you do an aerial attack, you can press Asura's Crash to hit them with a powerful punch in the air. Physical: 20, Focus Drain: 20"
      },
      {
        "level": 30,
        "name": "Asura's Wrath",
        "description": "After landing Asura's Crash, you are able to use this move to enable a power boost that boosts your attack and movement speed by 10% for 45 seconds. So long as you obtain Wrath with Asura's Crash, Asura's Wrath can be reused to stack the damage and speed buff and refresh the duration. While Asura's Wrath is active, Asura's Crash heals you, the healing increasing with repeated usage of Asura's Wrath."
      },
      {
        "level": 38,
        "name": "Asura's Eclipse",
        "description": "At maximum Wrath, unleash a relentless blitz upon your target, consuming all wrath to lock them in a devastating, inescapable combo. Physical: 45, Focus Drain: 40"
      },
      {
        "level": 43,
        "name": "Demon Breaker",
        "description": "The one and only demon step. Focus Drain: 25"
      }
    ],
    "passiveSkills": []
  },
  "Monk": {
    "name": "Monk",
    "subclassOf": "Striker",
    "overview": "Monk is a subclass of Striker, focusing on the utilizing of versatile Spirit forms.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Spirit Finisher",
        "description": "Allows the user to teleport behind a target if Spirit Shift is used after Spirit Burst."
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Spirit Shift",
        "description": "Allows the user to enter the spirit form of one of three animals.",
        "options": [
          {
            "name": "Panther",
            "description": "10% Movement Speed for 30s"
          },
          {
            "name": "Wolf",
            "description": "10% damage boost for 30s"
          },
          {
            "name": "Bear",
            "description": "10% damage reduction for 30s"
          }
        ]
      },
      {
        "level": 30,
        "name": "Spirit Burst",
        "description": "Unleash a burst of energy, its effect shifting with your current stance.",
        "options": [
          {
            "name": "Panther form",
            "description": "does multiple spinning kicks in the air on the target and does a final kick throwing them where you are facing"
          },
          {
            "name": "Wolf form",
            "description": "does 3 slashes with the final slash healing you and bleeding the target"
          },
          {
            "name": "Bear form",
            "description": "You lunge where you are facing and smash the ground doing dmg and making the target airborne"
          }
        ]
      },
      {
        "level": 30,
        "name": "Spirit Crash",
        "description": "Unleash a crash of energy, its effect shifting with your current stance."
      },
      {
        "level": 30,
        "name": "Spirit Barrier",
        "description": "Focus your inner spirit entering a defensive stance. For a brief moment, incoming attacks will trigger a powerful counter."
      }
    ],
    "passiveSkills": [
      {
        "level": 33,
        "name": "Spirit Cleanse",
        "description": "There is a chance to reset the cooldown of Spirit Burst after landing Spirit Burst Finisher."
      }
    ]
  },
  "Warlock": {
    "name": "Warlock",
    "subclassOf": "Magician",
    "overview": "Warlock is a subclass of Magician, relying on the utilization of Demons and demonic arts.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Souls",
        "description": "Gives a resource bar that counts the Souls you've collected. Souls are lost when summons die. Souls save across servers."
      },
      {
        "level": 30,
        "name": "Summon Imp",
        "description": "Summons an Imp to fight for you. Costs 25% of your Souls."
      },
      {
        "level": 30,
        "name": "Summon Fiend",
        "description": "Summons a Fiend to fight for you. Costs 75% of your Souls."
      },
      {
        "level": 30,
        "name": "Sacrifice",
        "description": "Sacrifice your current summon, refunding their soul cost."
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Soul Steal",
        "description": "Deal moderate damage to a target. If this finishes off a mob, you gain some health. If this mob is near your level, you steal their soul, increasing Soul count. Instantly kills enemies under half a bar of health."
      },
      {
        "level": 37,
        "name": "Demonic Sacrifice",
        "description": "Sacrifice your demon to gain a buff.",
        "options": [
          {
            "name": "Sacrificing Fiend",
            "description": "Gives 2% max HP every 4 seconds for 30 minutes."
          },
          {
            "name": "Sacrificing Imp",
            "description": "10% Intellect scaling damage for 30 minutes."
          }
        ]
      },
      {
        "level": 43,
        "name": "Soul Exchange",
        "description": "Exchange your lifeforce and souls to channel life into your summoned creature while also gain mana back."
      }
    ],
    "passiveSkills": [
      {
        "level": 35,
        "name": "Soul Link",
        "description": "Your demons take a portion of your health. A split second before summoning Fiend, you can see the name of the Fiend model is \"InJonathenWeTrust\""
      }
    ]
  },
  "Sorcerer": {
    "name": "Sorcerer",
    "subclassOf": "Magician",
    "overview": "Sorcerer is a subclass of Magician that takes advantage of Arcane magic.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Arcane Charges",
        "description": "Landing a spell/weapon art has a chance to grant an Arcane charge. The odds of gaining a charge increase with damage dealt. Arcane Charges (the associated buff to count them) last 1 minute, and their duration is refreshed when gained or spent."
      },
      {
        "level": 30,
        "name": "Arcane Mend",
        "description": "Restore yourself with 2 Arcane charges."
      }
    ],
    "actives": [
      {
        "level": 30,
        "name": "Arcane Explosion",
        "description": "Consume an Arcane Charge to unleash a powerful explosion around you."
      },
      {
        "level": 35,
        "name": "Arcane Finale",
        "description": "Smites foes down with a large orbital laser that does an ungodly amount of damage, but it comes at a huge cost of mana and 4 arcane charges."
      },
      {
        "level": 43,
        "name": "Arcane Pulse",
        "description": "Casting this on a target already struck by a spell grants an arcane charge."
      },
      {
        "level": 48,
        "name": "Arcane Vortex",
        "description": "Consume 2 Arcane Charge to unleash a vortex which drags enemies caught towards the center."
      }
    ],
    "passiveSkills": []
  },
  "Cleric": {
    "name": "Cleric",
    "subclassOf": "Priest",
    "overview": "Cleric is a subclass of Priest that focuses on healing utility.",
    "passiveFeatures": [
      {
        "level": 30,
        "name": "Angelic Wings",
        "description": "Chance to grant the Angelic Wings status effect after casting Holy Light or Flash Heal, granting 25% cooldown reduction speed, allows mana to regenerate during casting, and increases mana regeneration significantly for 12 seconds."
      }
    ],
    "actives": [
      {
        "level": 33,
        "name": "Clarity",
        "description": "For 2 seconds, spells have no mana cost and you gain additional magical crit chance."
      },
      {
        "level": 38,
        "name": "Angelic Guardian",
        "description": "Bless an ally, increasing their healing received. Blessed allies are immediately revived upon death."
      },
      {
        "level": 43,
        "name": "Blessing of Harmony",
        "description": "Attach a sigil to an ally. The marked ally will gain 50% of any healing done to any party member, including yourself."
      },
      {
        "level": 48,
        "name": "Divine Resonance",
        "description": "Channel a Divine Sphere that hovers above your head for 20 seconds, while active, nearby party members receive healing overtime in a radius around yourself."
      }
    ],
    "passiveSkills": [
      {
        "level": 35,
        "name": "Divine Healing",
        "description": "Healing effects also grant 20% of their healing to yourself."
      }
    ]
  },
  "Orochi": {
    "name": "Orochi",
    "subclassOf": "Samurai",
    "overview": "Orochi is a subclass of Samurai. Draw forth the power of the Great Serpent. Orochi is a powerful sub-class that focuses on defensive attacks whilst also poisoning your opponent.",
    "passiveFeatures": [],
    "actives": [
      {
        "level": 31,
        "name": "Orochi Counter",
        "description": "Draw your blade back to unleash a devastating stab upon being hit."
      },
      {
        "level": 40,
        "name": "Bare Fangs",
        "description": "Unleash the Great Serpent, poisoning any prey caught with your blade."
      },
      {
        "level": 45,
        "name": "Moon Cutter",
        "description": "Cutting the Moon."
      }
    ],
    "passiveSkills": [
      {
        "level": 36,
        "name": "Trained Body",
        "description": "Gain extra stamina scaling with Agility(10%)"
      }
    ]
  }
};

export default classData;
