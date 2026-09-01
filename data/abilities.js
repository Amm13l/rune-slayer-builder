import { Ability } from './types.js';

/* -------------------------------------------------------------------------
   Frei equipbare Abilities — alles was nicht ueber Klasse oder Rasse
   automatisch freigeschaltet wird: Spells, Scrolls und ungebundene Passives.

   Shape: { name, rarity, kind, category, level, requirement, description, grants }
     kind      -> 'active' | 'passive'  (Gruppierung im Abilities-Panel)
     category  -> 'spell' | 'scroll' | 'passive'  (Filter im Auswahlmenue)
     level     -> Charakterlevel-Anforderung, null = keine
     grants    -> vom Builder ausgewertete Effekte, siehe types.js

   Rarity wie bei Items aus der Namensfarbe im Spiel uebernehmen. Solange die
   echten Werte fehlen, bleibt es beim Default 'common' (grau).
------------------------------------------------------------------------- */

const abilitiesDatabase = {
  DualWielding: new Ability({
    name: 'Dual Wielding',
    kind: 'passive',
    category: 'passive',
    description: 'Lets you wield two one-handed weapons of the same kind at once — '
      + 'two Swords or two Daggers. The second weapon goes into the Offhand slot. '
      + 'Mixing a Sword with a Dagger is not possible.',
    grants: { dualWield: ['sword', 'dagger'] }
  })
};

export default abilitiesDatabase;
