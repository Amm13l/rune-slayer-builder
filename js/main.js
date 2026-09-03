    import itemsDatabase from '../data/items.js';
    import statlist from '../data/stats.js';
    import classesDatabase from '../data/classes.js';
    import classInfoData from '../data/classdata.js';
    import runesDatabase from '../data/runes.js';
    import abilitiesDatabase from '../data/abilities.js';
    import { Weapon, Item } from '../data/types.js';
    import { renderCharacter } from './character.js';
    import { initCommunityHub, fetchBuildById } from './community.js';


    const equippedItems = {
        helmet: null,
        chest: null,
        back: null,
        boots: null,
        ring1: null,
        ring2: null,
        ring3: null,
        ring4: null,
        race: null,
        weapon1: null,
        weapon2: null,
        offhand: null,
        lantern: null,
        fairy: null
    };

    // Frei equipte Abilities (Ability-Instanzen aus abilitiesDatabase).
    // Klassen- und Rassen-Abilities stehen NICHT hier drin — die haengen am
    // Klassenlevel bzw. an der gewaehlten Rasse.
    const equippedAbilities = [];

    // Gewaehlte Evolutionen: Ability-Name -> Name der gewaehlten Option.
    // Der Name reicht als Schluessel, weil geteilte Abilities (Battle Aura &
    // Co.) im Panel ohnehin zu einer Kachel zusammenfallen.
    const chosenEvolutions = {};

    // Aeltere Builds/Community-Hub-Uploads speichern die Wahl noch unter dem
    // alten "... Evolution"-Namen (vor dem Zusammenlegen mit der Basis-
    // Ability). Migration beim Laden, sonst geht die Wahl beim Import
    // stillschweigend verloren.
    const LEGACY_EVOLUTION_NAME_MAP = {
        'Slashing Strike Evolution': 'Slashing Strike',
        'Power Shot Evolution': 'Power Shot',
        'Piercing Strike Evolution -': 'Piercing Strike',
        'Piercing Strike Evolution': 'Piercing Strike',
        'Strike Evolution -': 'Strike',
        'Strike Evolution': 'Strike',
        'Magic Arrow Evolution': 'Magic Arrow',
        'Unsheathe Evolution': 'Unsheathe',
        'Battle Aura Evolution': 'Battle Aura',
        'Auto Shot Evolution': 'Auto Shot',
        'Weapon Throw Evolution': 'Weapon Throw',
        'Blast Evolution': 'Blast',
        // Battle Aura evolviert zweimal (Lv 15 dann Lv 25) — beide alten
        // Namen der zweiten Stufe landen auf demselben internen Tier-2-
        // Schluessel (siehe tier2Key() weiter unten; hier bewusst als
        // Literal, weil diese Map vor der Funktionsdefinition steht).
        'Battle Aura Evolution 3': 'Battle Aura::tier2',
        'Battle Aura Mastery': 'Battle Aura::tier2'
    };

    function migrateLegacyEvolutions(evolutions) {
        const migrated = {};
        Object.entries(evolutions || {}).forEach(([name, choice]) => {
            const key = LEGACY_EVOLUTION_NAME_MAP[name] || name;
            // "Limit Breaker Evolution" (Asura) hat keine echte Wahl mehr -
            // die Ability heisst jetzt schlicht "Asura's Wrath" ohne Options.
            if (key === 'Limit Breaker Evolution') return;
            migrated[key] = choice;
        });
        return migrated;
    }

    const rarityOrder = {
        'common': 1,
        'uncommon': 2,
        'rare': 3,
        'epic': 4,
        'legendary': 5,
        'spec': 6
    };

    // Filter werden pro Slot-Typ getrennt gemerkt. Vorher war das ein einziges
    // globales Objekt — eine Suche bei den Boots stand dann auch im Waffen- und
    // Runenmenue, und ein Typ-Filter wie 'dagger' liess andere Slots leer wirken.
    const filterStates = {};

    function filterStateFor(slotType) {
        if (!filterStates[slotType]) {
            filterStates[slotType] = { search: '', stat: '', type: '', sort: 'name-asc' };
        }
        return filterStates[slotType];
    }

    window.itemsDatabase = itemsDatabase;

    const slots = document.querySelectorAll('.slot');
    let currentOpenMenu = null;

    function normalizarSlot(slotType) {
        const mapa = {
        weapon1: 'weapon',
        weapon2: 'weapon',
        };
        return mapa[slotType] || slotType;
    }

    const shieldCompatibleWeaponTypes = ['sword', 'greataxe', 'staff', 'greatsword', 'gauntlet', 'spear', 'tyle'];

    function isShield(item) {
        return typeof item?.posture === 'number';
    }

    function shieldAllowed() {
        const weapons = [equippedItems.weapon1, equippedItems.weapon2].filter(Boolean);
        if (weapons.length === 0) return true;
        return weapons.some(w => shieldCompatibleWeaponTypes.includes(w.type));
    }

    function enforceShieldRule() {
        const offhand = equippedItems.offhand;
        if (offhand && isShield(offhand) && !shieldAllowed()) {
            const slotElement = document.querySelector('.slot[data-slot="offhand"]');
            if (slotElement) {
                emptySlot(slotElement, 'offhand');
            } else {
                equippedItems.offhand = null;
                updateTotalStatsDisplay();
            }
            showNotification(`${offhand.name} removed: shields can't be used with the equipped weapon type`, true);
        }
    }

    // ---- Dual Wielding ----
    // Die Passive erlaubt eine zweite Waffe im OFFHAND-Slot (nicht Weapon 2).
    // Massgeblich ist allein Weapon 1: liegt dort ein Schwert, sind im Offhand
    // nur Schwerter waehlbar, bei einem Dolch nur Dolche. Schwert + Dolch geht
    // nicht. Weapon 2 bleibt davon unberuehrt.
    function dualWieldGrant() {
        return equippedAbilities.find(a => Array.isArray(a.grants?.dualWield))?.grants.dualWield || null;
    }

    // Waffengattung, die aktuell im Offhand erlaubt ist — sonst null.
    function dualWieldType() {
        const allowed = dualWieldGrant();
        if (!allowed) return null;
        const mainType = equippedItems.weapon1?.type;
        return mainType && allowed.includes(mainType) ? mainType : null;
    }

    // Ein Offhand-Eintrag ist eine Waffe, wenn er Schaden traegt und kein Schild ist.
    function isOffhandWeapon(item) {
        return !!item && !isShield(item) && !!item.damage;
    }

    // Weapon 1/2 und ein per Dual Wielding bestuecktes Offhand sind jeweils
    // eigenstaendige physische Waffen — jede darf denselben Rune-Namen tragen,
    // ohne als Duplikat zu gelten (siehe updateRuneMenu).
    function isWeaponBearingSlot(equipmentSlotKey) {
        if (equipmentSlotKey === 'weapon1' || equipmentSlotKey === 'weapon2') return true;
        return equipmentSlotKey === 'offhand' && isOffhandWeapon(equippedItems.offhand);
    }

    function enforceDualWieldRule() {
        const offhand = equippedItems.offhand;
        if (!isOffhandWeapon(offhand)) return;
        if (offhand.type === dualWieldType()) return;

        const slotElement = document.querySelector('.slot[data-slot="offhand"]');
        if (slotElement) {
            emptySlot(slotElement, 'offhand');
        } else {
            equippedItems.offhand = null;
            updateTotalStatsDisplay();
        }
        showNotification(`${offhand.name} removed: needs Dual Wielding and a matching weapon in Weapon 1`, true);
    }

    // Auswahl fuer ein Slot-Menue. Nur der Offhand weicht vom reinen
    // itemsDatabase[slotType] ab: mit Dual Wielding kommen die passenden
    // Waffen dazu.
    function menuItemEntries(slotType) {
        const entries = Object.entries(itemsDatabase[slotType] || {});
        if (slotType !== 'offhand') return entries;
        const dwType = dualWieldType();
        if (!dwType) return entries;
        return entries.concat(
            Object.entries(itemsDatabase.weapon).filter(([, w]) => w.type === dwType)
        );
    }

    function isUnobtainable(item) {
        return typeof item?.description === 'string' && item.description.toLowerCase().includes('unobtainable');
    }

    function markUnobtainable(element, item) {
        if (isUnobtainable(item)) {
            element.setAttribute('data-unobtainable', '');
        } else {
            element.removeAttribute('data-unobtainable');
        }
    }

    // Rune-Slots liegen im selben .slot-wrap wie ihr Ausruestungsslot.
    function equipmentSlotKeyOf(runeSlot) {
        return runeSlot.closest('.slot-wrap')?.querySelector('.slot')?.dataset.slot;
    }

    function runeSlotElement(equipmentSlot, slotNumber) {
        const wrap = document.querySelector(`.slot[data-slot="${equipmentSlot}"]`)?.closest('.slot-wrap');
        return wrap?.querySelector(`.rune-slot[data-original-number="${slotNumber}"]`) || null;
    }

    const equippedRunes = {};

    document.querySelectorAll('.rune-slots').forEach(runeSlotsContainer => {
        const equipmentSlot = runeSlotsContainer.closest('.slot-wrap').querySelector('.slot').dataset.slot;
        const runeSlots = {};
        
        runeSlotsContainer.querySelectorAll('.rune-slot').forEach((slot, index) => {
            const slotNumber = ['I', 'II', 'III', 'IV', 'V', 'VI'][index];
            runeSlots[slotNumber] = null;
        });
        
        equippedRunes[equipmentSlot] = runeSlots;
    });

    document.querySelectorAll('.rune-slot').forEach(runeSlot => {
    // Bei gefuelltem Slot faengt das Loeschen-Overlay den Linksklick ab.
    // Rechtsklick oeffnet daher weiterhin die Auswahl zum Tauschen.
    runeSlot.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        this.click();
    });
    runeSlot.addEventListener('click', function() {
        const equipmentSlot = equipmentSlotKeyOf(this);
        const slotNumber = this.textContent;
        
        if (currentOpenMenu && currentOpenMenu.slot === this) {
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
            return;
        }

        if (currentOpenMenu) {
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
        }

        const menu = document.createElement('div');
        menu.className = 'item-menu rune-menu';
        menu.dataset.slotType = 'rune';

        menu.innerHTML = `
            <div class="menu-header-container">
                <div class="item-menu-header">
                    <input type="text" id="item-search" class="filter-input item-menu-search" 
                        placeholder="Search runes...">
                    <button id="reset-filters" class="menu-reset-button">Reset</button>
                </div>
                <div class="item-menu-filters">
                    <select id="stat-filter" class="filter-select">
                        <option value="">All Stats</option>
                    </select>
                    <select id="type-filter" class="filter-select">
                        <option value="">All Types</option>
                    </select>
                    <select id="sort-filter" class="filter-select">
                        <option value="name-asc">A-Z</option>
                        <option value="name-desc">Z-A</option>
                        <option value="rarity-asc">Rarity ↑</option>
                        <option value="rarity-desc">Rarity ↓</option>
                        <option value="stat-asc">Stat ↑</option>
                        <option value="stat-desc">Stat ↓</option>
                    </select>
                </div>
            </div>
            <div class="item-menu-content"></div>
        `;
        
        document.body.appendChild(menu);
        
        currentOpenMenu = {
            menu: menu,
            slot: this,
            equipmentSlot: equipmentSlot,
            slotNumber: slotNumber
        };

        const contentArea = menu.querySelector('.item-menu-content');
        initializeRuneFilters(menu, 'rune', menu.querySelector('.item-menu-content'));
        
        setTimeout(() => {
            restoreFilters(menu, 'rune');
        }, 0);
    });
});

function updateRuneMenu(menu, slotType, contentArea) {
    const searchTerm = menu.querySelector('#item-search').value.toLowerCase();
    const selectedStat = menu.querySelector('#stat-filter').value;
    const selectedType = menu.querySelector('#type-filter').value;
    const sortOption = menu.querySelector('#sort-filter').value;
    const equipmentSlot = currentOpenMenu?.equipmentSlot;
    const currentSlotNumber = currentOpenMenu?.slotNumber;
    // Steckt dank Dual Wielding eine echte zweite Waffe im Offhand-Slot,
    // gelten fuer deren Runen dieselben Regeln wie fuer Weapon 1/2 — nicht
    // die eingeschraenkten Offhand/Schild-Runen. Ein Schild bleibt unveraendert.
    const runeSlotType = (equipmentSlot === 'offhand' && isOffhandWeapon(equippedItems.offhand))
        ? 'weapon'
        : equipmentSlot;

    contentArea.innerHTML = '';

    console.debug(equippedRunes);

    const runes = Object.entries(runesDatabase)
        .map(([key, rune]) => ({ key, rune }))
        .filter(({ rune }) => {
            const nameMatch = rune.name.toLowerCase().includes(searchTerm);
            
            let statMatch = true;
            if (selectedStat) {
                statMatch = rune.stats && rune.stats[selectedStat] !== undefined;
            }
            
            const nType = normalizarSlot(rune.type);
            const slotMatch = nType === 'null' || nType === normalizarSlot(runeSlotType);
            
            let typeMatch = true;
            if (selectedType) {
                if (selectedType === 'null') {
                    typeMatch = nType === 'null';
                } else {
                    typeMatch = nType === selectedType;
                }
            }

            // Check for duplicates across all equipment slots
            let isDuplicate = false;
            if (nType !== 'null') {
                for (const [eqSlot, runeSlots] of Object.entries(equippedRunes)) {
                    // Zwei verschiedene physische Waffen (Weapon 1/2, Dual-Wielding-
                    // Offhand) duerfen dieselbe Rune unabhaengig voneinander tragen.
                    if (eqSlot !== equipmentSlot && isWeaponBearingSlot(eqSlot) && isWeaponBearingSlot(equipmentSlot)) {
                        continue;
                    }
                    for (const [slotNum, equippedRune] of Object.entries(runeSlots)) {
                        if (equippedRune && equippedRune.name.toLowerCase() === rune.name.toLowerCase()) {
                            // Skip if this is the same rune in the same slot (we're replacing it)
                            if (!(eqSlot === equipmentSlot && slotNum === currentSlotNumber)) {
                                isDuplicate = true;
                                break;
                            }
                        }
                    }
                    if (isDuplicate) break;
                }
            }
            
            return nameMatch && statMatch && slotMatch && typeMatch && !isDuplicate;
        })
            .sort((a, b) => {
                const runeA = a.rune;
                const runeB = b.rune;

                const sumStats = (rune) => {
                    let total = 0;
                    if (rune.stats) {
                        total += Object.values(rune.stats).reduce((sum, val) => sum + val, 0);
                    }
                    return total;
                };
                
                switch (sortOption) {
                    case 'name-asc':
                        return runeA.name.localeCompare(runeB.name);
                    case 'name-desc':
                        return runeB.name.localeCompare(runeA.name);
                    case 'rarity-asc':
                        return (rarityOrder[runeA.rarity || 'common'] || 0) - 
                            (rarityOrder[runeB.rarity || 'common'] || 0);
                    case 'rarity-desc':
                        return (rarityOrder[runeB.rarity || 'common'] || 0) - 
                            (rarityOrder[runeA.rarity || 'common'] || 0);
                    case 'stat-asc': {
                        if (!selectedStat) {
                            const sumA = sumStats(runeA);
                            const sumB = sumStats(runeB);
                            return sumA - sumB;
                        }
                        
                        const statA = runeA.stats?.[selectedStat] || 0;
                        const statB = runeB.stats?.[selectedStat] || 0;
                        return statA - statB;
                    }
                    case 'stat-desc': {
                        if (!selectedStat) {
                            const sumA = sumStats(runeA);
                            const sumB = sumStats(runeB);
                            return sumB - sumA;
                        }
                        
                        const statA = runeA.stats?.[selectedStat] || 0;
                        const statB = runeB.stats?.[selectedStat] || 0;
                        return statB - statA;
                    }
                    default:
                        return 0;
                }
            });
        
        runes.forEach(({ key, rune }) => {
    const button = document.createElement('button');
    button.textContent = rune.name;
    button.setAttribute('data-rarity', rune.rarity || 'common');
    button.setAttribute('data-rune-key', key);
    markUnobtainable(button, rune);
    
    button.addEventListener('mouseenter', (e) => {
        const tooltipContent = createItemTooltipContent(rune);
        tooltipSystem.showTooltip(tooltipContent, button);
    });
    
    button.addEventListener('mouseleave', () => {
        tooltipSystem.hideTooltip();
    });
   
    button.onclick = () => {
    const slot = currentOpenMenu.slot;
    const equipmentSlot = currentOpenMenu.equipmentSlot;
    // Get the original slot number from data attribute instead of currentOpenMenu
    const slotNumber = slot.dataset.originalNumber; 
    
    // Update the slot with new rune
    slot.className = 'rune-slot filled';
    slot.setAttribute('data-rarity', rune.rarity || 'common');
    slot.setAttribute('data-rune-key', key);
    markUnobtainable(slot, rune);
    
    // Clear and rebuild the slot content safely
    slot.innerHTML = '';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'slot-content';
    contentDiv.textContent = runeSlotLabel(rune);
    slot.appendChild(contentDiv);
    
    const removeDiv = document.createElement('div');
    removeDiv.className = 'remove-rune';
    slot.appendChild(removeDiv);
    
    // Update equippedRunes with the new rune using the preserved slot number
    equippedRunes[equipmentSlot][slotNumber] = rune;
    
    tooltipSystem.hideTooltip();
    document.body.removeChild(currentOpenMenu.menu);
    currentOpenMenu = null;
    updateTotalStatsDisplay();
    updateSlotPanel(equipmentSlot);

    // addRuneSlotHoverEvents haengt den Remove-Handler selbst an — hier kein
    // zweites Mal, sonst lief emptyRuneSlot pro Klick doppelt.
    addRuneSlotHoverEvents(slot);
};

    contentArea.appendChild(button);
});
    
    if (runes.length === 0) {
        const noItemsMsg = document.createElement('div');
        noItemsMsg.className = 'no-items-message';
        noItemsMsg.textContent = 'No runes match your filters';
        contentArea.appendChild(noItemsMsg);
    }
    }

    // 71 von 72 Runen heissen "... Rune". Im 56px-Slot ist das Suffix nur
    // Platzverschwendung — der volle Name steht weiterhin im Tooltip.
    function runeSlotLabel(rune) {
        return rune.name.replace(/\s+Rune$/, '');
    }

    function addRuneSlotHoverEvents(slot) {
        slot.addEventListener('mouseenter', (e) => {
            const runeKey = slot.getAttribute('data-rune-key');
            if (runeKey) {
                const rune = runesDatabase[runeKey];
                if (rune) {
                    const tooltipContent = createItemTooltipContent(rune);
                    tooltipSystem.showTooltip(tooltipContent, slot);
                }
            }
        });
        
        slot.addEventListener('mouseleave', () => {
            tooltipSystem.hideTooltip();
        });
        
        const removeBtn = slot.querySelector('.remove-rune');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const slotNumber = slot.dataset.originalNumber || slot.textContent.trim();
            emptyRuneSlot(slot, equipmentSlotKeyOf(slot), slotNumber);
        });
    }


    function emptyRuneSlot(slot, equipmentSlot, slotNumber) {
    if (!equipmentSlot || !slotNumber) {
        equipmentSlot = equipmentSlot || equipmentSlotKeyOf(slot);
        slotNumber = slotNumber || slot.dataset.originalNumber;
    }

    // Clear the slot
    slot.className = 'rune-slot';
    slot.removeAttribute('data-rarity');
    slot.removeAttribute('data-unobtainable');
    slot.removeAttribute('data-rune-key');
    slot.textContent = slot.dataset.originalNumber || slotNumber;
    
    // Clear from equippedRunes
    if (equipmentSlot && slotNumber && equippedRunes[equipmentSlot]) {
        equippedRunes[equipmentSlot][slotNumber] = null;
    }
    
    updateTotalStatsDisplay();
    updateSlotPanel(equipmentSlot);
    tooltipSystem.hideTooltip();

    if (currentOpenMenu) {
        saveCurrentFilterState();
        document.body.removeChild(currentOpenMenu.menu);
        currentOpenMenu = null;
    }
}

    function slotElementFor(slotKey) {
        if (slotKey.startsWith('ring')) {
            return document.querySelector(`.slot[data-slot="ring"][data-ring-number="${slotKey.slice(4)}"]`);
        }
        return document.querySelector(`.slot[data-slot="${slotKey}"]`);
    }

    // Ingame zeigt das Item-Panel Rune-Boni bereits mit ins Item eingerechnet
    // (siehe Bug-Report: Ruestung zeigt dort z.B. Armor 1775 statt der reinen
    // 1400 Basis). Fuer die Anzeige im Slot-Panel klonen wir das Item daher
    // mit den Stats seiner gesockelten Runen addiert; die Basisdaten in
    // items.js bleiben unangetastet.
    function itemWithRuneStatsForDisplay(item, slotKey) {
        const runeSlots = equippedRunes[slotKey];
        if (!runeSlots) return item;

        const merged = { ...item, stats: { ...(item.stats || {}) } };
        let armor = typeof item.armor === 'number' ? item.armor : undefined;
        // Runen wie Storm Caller Rune haben neben reinen Stats auch einen
        // Fliesstext-Effekt ("When it's raining, ..."). Der soll im Item-Panel
        // mit auftauchen, statt nur im Rune-Slot-Tooltip sichtbar zu sein.
        const runeDescriptions = [...(item.runeDescriptions || [])];

        for (const rune of Object.values(runeSlots)) {
            if (!rune) continue;
            if (rune.stats) {
                for (const [stat, value] of Object.entries(rune.stats)) {
                    if (stat === 'armor') {
                        armor = (armor || 0) + value;
                    } else {
                        merged.stats[stat] = (merged.stats[stat] || 0) + value;
                    }
                }
            }
            if (rune.description) {
                runeDescriptions.push({ name: rune.name, description: rune.description });
            }
        }

        if (armor !== undefined) merged.armor = armor;
        if (runeDescriptions.length) merged.runeDescriptions = runeDescriptions;
        return merged;
    }

    // Das Hover-Panel ersetzt den Tooltip an den Ausruestungsslots: oben die
    // Item-Infos (oder "None"), darunter die Rune-Slots. Muss nach jeder
    // Aenderung am Slot neu gefuellt werden.
    function updateSlotPanel(slotKey) {
        const panel = slotElementFor(slotKey)
            ?.parentElement?.querySelector(':scope > .slot-panel');
        const info = panel?.querySelector(':scope > .slot-panel-info');
        if (!info) return;

        panel.querySelector(':scope > .race-abilities-btn')?.remove();

        info.innerHTML = '';
        const item = slotKey === 'race' ? getActiveRace() : equippedItems[slotKey];
        if (item) {
            info.appendChild(createItemTooltipContent(itemWithRuneStatsForDisplay(item, slotKey)));
        } else {
            const empty = document.createElement('div');
            empty.className = 'slot-panel-empty';
            empty.textContent = 'None';
            info.appendChild(empty);
        }

        // Fragezeichen-Box im aufgeklappten Race-Panel: oeffnet alle Skills der
        // Rasse bis Level 50, inklusive saemtlicher Racial Upgrades.
        if (slotKey === 'race' && equippedItems.race) {
            const btn = document.createElement('button');
            btn.className = 'race-abilities-btn';
            btn.textContent = '?';
            btn.title = `Show all ${equippedItems.race.name} abilities`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showRaceAbilities();
            });
            panel.appendChild(btn);
        }
    }

    function updateAllSlotPanels() {
        Object.keys(equippedItems).forEach(updateSlotPanel);
    }

    // Charaktervorschau. Ist Weapon 1 leer, zeigt die Silhouette Weapon 2 in
    // der rechten Hand — sonst bliebe die Hand leer, obwohl eine Waffe
    // ausgeruestet ist. Sind BEIDE belegt, gilt das als Dual Wielding: Weapon 1
    // rechts, Weapon 2 gespiegelt in der linken Hand.
    function updateCharacter() {
        const bothWeaponsEquipped = equippedItems.weapon1 && equippedItems.weapon2;
        renderCharacter(document.querySelector('.character-portrait'), {
            helmet: equippedItems.helmet,
            chest: equippedItems.chest,
            boots: equippedItems.boots,
            back: equippedItems.back,
            weapon: equippedItems.weapon1 || equippedItems.weapon2,
            secondWeapon: bothWeaponsEquipped ? equippedItems.weapon2 : null,
            offhand: equippedItems.offhand,
            // Basisrasse bestimmt das Merkmal, die Evolution nur dessen
            // Ausprägung (2/4/6 Flügel bzw. Hörner)
            race: equippedItems.race,
            raceEvolution: getRaceEvolution()?.name || ''
        });
    }

    // Beim Entfernen eines Items muessen dessen Runen mit weg. Sie zaehlten
    // sonst weiter in die Stats, waeren aber unsichtbar — das Flyout oeffnet
    // ja nur ueber einem Item.
    function clearRunesOfSlot(equipmentSlot) {
        const runeSlots = equippedRunes[equipmentSlot];
        if (!runeSlots) return;
        for (const slotNumber of Object.keys(runeSlots)) {
            if (!runeSlots[slotNumber]) continue;
            runeSlots[slotNumber] = null;
            const el = runeSlotElement(equipmentSlot, slotNumber);
            if (!el) continue;
            el.className = 'rune-slot';
            el.removeAttribute('data-rarity');
            el.removeAttribute('data-unobtainable');
            el.removeAttribute('data-rune-key');
            el.textContent = el.dataset.originalNumber || slotNumber;
        }
    }

    function initializeClassSystem() {
        const classList = document.getElementById('class-list');
        const totalLevelsDisplay = document.getElementById('total-levels');
        let totalLevels = 0;

        initializeStartingClassSelect();
        
        Object.entries(classesDatabase).forEach(([className, classData]) => {
            const classItem = document.createElement('div');
            classItem.className = 'class-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'class-name clickable';
            nameSpan.textContent = className;
            nameSpan.title = 'Click for class details';
            nameSpan.addEventListener('click', () => showClassInfo(className));

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'class-level-input';
            input.min = 0;
            input.max = 50;
            input.value = 0;
            input.dataset.className = className;

            // Fragezeichen-Box: Abilities dieser Klasse (inkl. gewaehlter
            // Subklasse), noch gesperrte ausgegraut.
            const abilitiesBtn = document.createElement('button');
            abilitiesBtn.className = 'class-abilities-btn';
            abilitiesBtn.textContent = '?';
            abilitiesBtn.title = `Show all ${className} abilities`;
            abilitiesBtn.addEventListener('click', () => showClassAbilities(className));

            classItem.appendChild(nameSpan);
            classItem.appendChild(abilitiesBtn);
            classItem.appendChild(input);
            classList.appendChild(classItem);

            // Subklassen-Auswahl (ab Klassenlevel 30)
            const subclasses = classInfoData[className]?.subclasses || [];
            if (subclasses.length) {
                const subRow = document.createElement('div');
                subRow.className = 'subclass-row';
                subRow.dataset.className = className;
                subRow.style.display = 'none';

                const select = document.createElement('select');
                select.className = 'subclass-select';
                select.dataset.className = className;
                const noneOpt = document.createElement('option');
                noneOpt.value = '';
                noneOpt.textContent = 'No subclass';
                select.appendChild(noneOpt);
                subclasses.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    opt.textContent = sub;
                    select.appendChild(opt);
                });
                const onSubclassChange = () => {
                    updateAbilitiesDisplay();
                    // Subklasse kann Stat-Passive haben (z.B. Bulwarks Might).
                    updateTotalStatsDisplay();
                    if (!select.value) return;
                    // Die neu dazugekommenen Subklassen-Abilities kurz hervorheben
                    const cards = document.querySelectorAll(
                        `.abilities-display .ability-card[data-source="${select.value}"]`);
                    cards.forEach(card => {
                        card.classList.add('highlight');
                        setTimeout(() => card.classList.remove('highlight'), 1500);
                    });
                };
                select.addEventListener('change', onSubclassChange);
                select.addEventListener('input', onSubclassChange);

                const infoBtn = document.createElement('button');
                infoBtn.className = 'subclass-info-btn';
                infoBtn.textContent = '?';
                infoBtn.title = 'Subclass details';
                infoBtn.addEventListener('click', () => {
                    showClassInfo(select.value || className);
                });

                subRow.appendChild(select);
                subRow.appendChild(infoBtn);
                classList.appendChild(subRow);
            }

            input.addEventListener('change', updateClassLevels);
            input.addEventListener('input', updateClassLevels);
        });
        
        function updateClassLevels() {
            let newTotal = 0;
            const inputs = document.querySelectorAll('.class-level-input');
            
            inputs.forEach(input => {
                const value = parseInt(input.value) || 0;
                newTotal += value;
            });
            
            if (newTotal > 50) {
                this.value = Math.max(0, 50 - (newTotal - parseInt(this.value)));
                newTotal = 50;
                showLevelWarning();
            } else {
                hideLevelWarning();
            }
            
            totalLevels = newTotal;
            totalLevelsDisplay.textContent = totalLevels;
            updateSubclassRows();
            updateTotalStatsDisplay();
            updateAbilitiesDisplay();
        }
        
        function showLevelWarning() {
            let warning = document.querySelector('.level-warning');
            if (!warning) {
                warning = document.createElement('div');
                warning.className = 'level-warning';
                warning.textContent = 'Maximum 50 total levels across all classes!';
                classList.appendChild(warning);
            }
            warning.style.display = 'block';
            setTimeout(() => warning.style.display = 'none', 3000);
        }
        
        function hideLevelWarning() {
            const warning = document.querySelector('.level-warning');
            if (warning) warning.style.display = 'none';
        }
    }

    function getClassLevel(className) {
        const input = document.querySelector(`.class-level-input[data-class-name="${className}"]`);
        return input ? (parseInt(input.value) || 0) : 0;
    }

    function getTotalLevel() {
        let total = 0;
        document.querySelectorAll('.class-level-input').forEach(i => total += parseInt(i.value) || 0);
        return total;
    }

    function getSubclassSelection(className) {
        const select = document.querySelector(`.subclass-select[data-class-name="${className}"]`);
        return select ? select.value : '';
    }

    /* ---- Startklasse ("first class picked") -----------------------------
       Die zuerst gewaehlte Klasse faerbt einen Teil des Passive-Baums ein,
       ersetzt ihn aber NICHT komplett. themaninred im Discord (03.09.2026)
       zu seinem Build "10 Thief, danach 40 Striker":

         · Lv 35 gibt Thiefs "Momentum Builder" statt Strikers "Counter Force"
         · Thiefs "Backstabber" (Lv 12) bekommt er trotzdem nicht
         · Strikers "Tackle" (Lv 20) und "Pain Conversion" (Lv 32) hat er
         · Lv 20 gibt "Gauntlet Mastery", nicht Thiefs "Dagger Mastery"
         · 10 Warrior + 40 Magician bekommt kein "Magic Training"

       Zwei Regeln erklaeren alle fuenf Beobachtungen:

       1. Level-Slot-Tausch: hat die Startklasse auf demselben Level ein
          eigenes Passive, bekommt man ihres statt dem der gelevelten Klasse.
          Deckt Lv 35 (Momentum Builder) und Lv 6 (Focus Training) ab.
          Backstabber (Lv 12) faellt raus, weil Striker dort nichts hat und
          Thief nur auf Lv 10 steht; Tackle und Pain Conversion bleiben, weil
          Thief auf Lv 20/32 nichts hat.
       2. Training-Linie ist exklusiv: Focus Training und Magic Training sind
          dieselbe Ressourcen-Passive in zwei Geschmacksrichtungen. Man behaelt
          die der Startklasse, die andere kommt nie — auch nicht auf Leveln
          ohne Kollision (Magic Training 1 steht auf Lv 11, Warrior hat da
          nichts).

       Weapon Mastery ist ausdruecklich ausgenommen, Gauntlet Mastery bleibt
       Gauntlet Mastery. Thiefs Dagger Mastery steht aktuell ohnehin nur im
       Beschreibungstext von Backstabber statt als eigener Eintrag — der
       Filter haelt das Verhalten stabil, falls das nachgetragen wird.

       3. Ruestungsklasse haengt allein am ersten Level: nur wer als Warrior
          STARTET kann Heavy Armor tragen. Bestaetigt von Ammiel. Siehe
          effectivePassiveFeatures() — die Waffen-Trainings danebendran
          bleiben pro Klasse.

       Unberuehrt bleiben Moves (actives), die Waffen-Trainings und alle
       Skills einer Subklasse.

       Wichtig fuers Level-Gating: die Schwellen werden weiter gegen das
       Level der jeweiligen Klasse geprueft, NICHT gegen das Gesamtlevel.
       Sonst waeren mit 10 Warrior + 4x10 anderen Klassen ploetzlich alle
       Warrior-Passives bis Lv 50 offen, obwohl keine Klasse ueber Lv 10
       steht. So bleibt die Obergrenze immer das hoechste Einzelklassenlevel.
    --------------------------------------------------------------------- */

    // "Focus Training", "Focus Training 2", "Magic Training 1", "Focus Training III" ...
    const TRAINING_LINE = /^(Focus|Magic) Training\b/;
    // "Sword Mastery", "Gauntlet Mastery", "Dagger Mastery" ...
    const WEAPON_MASTERY = /\bMastery\b/;
    // "Heavy Armor", "Medium Armor", "Light Armor" — Level-0-passiveFeature
    const ARMOR_FEATURE = /^(Heavy|Medium|Light) Armor$/;

    function getStartingClass() {
        const select = document.getElementById('starting-class-select');
        const value = select ? select.value : '';
        return classesDatabase[value] ? value : '';
    }

    function trainingResource(skill) {
        const hit = TRAINING_LINE.exec(skill.name);
        return hit ? hit[1] : null;
    }

    // 'Focus' bei Warrior/Archer/Thief/Striker/Samurai, 'Magic' bei
    // Magician/Priest.
    function classTrainingResource(className) {
        for (const skill of classInfoData[className]?.passiveSkills || []) {
            const resource = trainingResource(skill);
            if (resource) return resource;
        }
        return null;
    }

    // Welche Passives diese Klasse im aktuellen Build wirklich liefert, je
    // Eintrag mit der Klasse, aus der er stammt. Nur Basisklassen werden
    // angefasst — eine Subklasse behaelt ihre eigenen.
    function effectivePassiveSkills(className) {
        const own = classInfoData[className]?.passiveSkills || [];
        const starter = getStartingClass();
        if (!starter || !classesDatabase[className] || starter === className) {
            return {
                entries: own.map(skill => ({ skill, source: className })),
                starter: '', swapped: false, levels: [], dropped: []
            };
        }

        const starterResource = classTrainingResource(starter);

        // Level -> Passives der Startklasse, die diesen Slot besetzen koennen
        const byLevel = new Map();
        (classInfoData[starter]?.passiveSkills || []).forEach(skill => {
            if (skill.level === null || skill.level === undefined) return;
            if (WEAPON_MASTERY.test(skill.name)) return;
            if (!byLevel.has(skill.level)) byLevel.set(skill.level, []);
            byLevel.get(skill.level).push(skill);
        });

        const entries = [];
        const levels = [];
        const dropped = [];
        const taken = new Set();

        own.forEach(skill => {
            // Regel 2: die falsche Ressourcen-Linie faellt ersatzlos weg
            const resource = trainingResource(skill);
            if (resource && starterResource && resource !== starterResource) {
                dropped.push(skill.name);
                return;
            }
            // Regel 1: Level-Slot-Tausch, Weapon Mastery ausgenommen
            const replacement = WEAPON_MASTERY.test(skill.name) ? null : byLevel.get(skill.level);
            if (!replacement) {
                entries.push({ skill, source: className });
                return;
            }
            // Mehrere Passives auf demselben Level teilen sich den Slot; die
            // Startklasse wird trotzdem nur einmal eingesetzt.
            if (taken.has(skill.level)) return;
            taken.add(skill.level);
            levels.push(skill.level);
            replacement.forEach(s => entries.push({ skill: s, source: starter }));
        });

        return {
            entries,
            starter,
            swapped: !!levels.length || !!dropped.length,
            levels: levels.sort((a, b) => a - b),
            dropped
        };
    }

    function armorFeature(className) {
        return (classInfoData[className]?.passiveFeatures || [])
            .find(skill => ARMOR_FEATURE.test(skill.name)) || null;
    }

    /* Ruestungsklasse haengt allein am ersten Level: nur wer als Warrior
       STARTET kann Heavy Armor tragen, egal wie hoch der Striker daneben ist.
       Weapon Trainings bleiben dagegen pro Klasse — wer Thief levelt, fuehrt
       Daggers. Deshalb wird hier gezielt nur der Armor-Eintrag getauscht und
       nicht, wie bei den passiveSkills, ueber die Levelzahl gematcht: auf
       Level 0 stehen Waffen- und Ruestungsfreischaltung nebeneinander.

       Im Spiel gibt es keine Item-Kategorie dafuer, die Ruestungsklasse ist
       nur diese Passive — deshalb bleibt es hier bei der Anzeige und greift
       nicht in die Item-Slots ein. */
    function effectivePassiveFeatures(className) {
        const own = classInfoData[className]?.passiveFeatures || [];
        const starter = getStartingClass();
        const plain = () => own.map(skill => ({ skill, source: className }));
        if (!starter || !classesDatabase[className] || starter === className) {
            return { entries: plain(), armorSwap: null };
        }

        const armor = armorFeature(starter);
        if (!armor) return { entries: plain(), armorSwap: null };

        let armorSwap = null;
        const entries = own.map(skill => {
            // Gleiche Ruestungsklasse (z.B. Thief-Start + Samurai, beide
            // Medium Armor) — dann bleibt der eigene Eintrag stehen.
            if (!ARMOR_FEATURE.test(skill.name) || skill.name === armor.name) {
                return { skill, source: className };
            }
            armorSwap = { from: skill.name, to: armor.name };
            return { skill: armor, source: starter };
        });
        return { entries, armorSwap };
    }

    function updateStartingClassNote() {
        const note = document.getElementById('starting-class-note');
        if (!note) return;
        const starter = getStartingClass();
        const resource = starter ? classTrainingResource(starter) : null;
        const armor = starter ? armorFeature(starter) : null;
        note.textContent = starter
            ? `${armor ? `Only ${starter} armor: ${armor.name}. ` : ''}`
                + `On levels where ${starter} has a passive of its own you get ${starter}'s `
                + `version${resource ? `, and you stay on the ${resource} Training line` : ''}. `
                + 'Everything else — moves, weapon training, weapon mastery, subclass skills '
                + '— still comes from the class you level.'
            : 'In game the class you picked first decides part of your passives. '
                + 'Set it here and the right ones show up.';
        note.classList.toggle('is-set', !!starter);
    }

    // Ein Satz, der genau benennt was die Startklasse an dieser Klasse
    // aendert — die Kacheln allein sehen sonst nach Datenfehler aus.
    // Nur ueber das berichten, was reingereicht wird: das "?"-Modal hat eine
    // Zeile fuer alles, das Nachschlagewerk haengt Ruestung an die Passive
    // Features und den Rest an die Passive Skills.
    function startingClassNote(className, { passives, features } = {}) {
        const armorSwap = features?.armorSwap;
        const parts = [];
        if (armorSwap) {
            parts.push(`you wear ${armorSwap.to} instead of ${armorSwap.from}`);
        }
        if (passives?.levels.length) {
            parts.push(`on Lv ${passives.levels.join(', Lv ')} you get `
                + `${passives.starter}'s passive instead of ${className}'s`);
        }
        if (passives?.dropped.length) {
            parts.push(`${passives.dropped.join(' and ')} never unlock`
                + `${passives.dropped.length > 1 ? '' : 's'}`);
        }
        if (!parts.length) return null;
        return `You started as ${getStartingClass()}: ${parts.join(', and ')}.`;
    }

    // Dropdown befuellen und verdrahten. Steht ausserhalb von #class-list,
    // deshalb eigene Initialisierung statt im Klassen-Loop.
    function initializeStartingClassSelect() {
        const select = document.getElementById('starting-class-select');
        if (!select) return;

        Object.keys(classesDatabase).forEach(className => {
            const opt = document.createElement('option');
            opt.value = className;
            opt.textContent = className;
            select.appendChild(opt);
        });

        const onChange = () => {
            updateStartingClassNote();
            updateAbilitiesDisplay();
        };
        select.addEventListener('change', onChange);
        select.addEventListener('input', onChange);
        updateStartingClassNote();
    }

    function setStartingClass(className) {
        const select = document.getElementById('starting-class-select');
        if (!select) return;
        select.value = [...select.options].some(o => o.value === className) ? className : '';
        updateStartingClassNote();
    }

    // Subklassen-Dropdowns nur zeigen, wenn die Klasse Level 30+ hat.
    // Die Auswahl bleibt erhalten (wichtig beim Editieren des Levels) —
    // Anzeige und Export filtern selbst auf Level >= 30.
    function updateSubclassRows() {
        document.querySelectorAll('.subclass-row').forEach(row => {
            const unlocked = getClassLevel(row.dataset.className) >= 30;
            row.style.display = unlocked ? 'flex' : 'none';
        });
    }

    // ---- Rasse & Racial Upgrade ("Evolution") ----

    function getRaceEvolution() {
        const race = equippedItems.race;
        const select = document.getElementById('race-evolution-select');
        if (!race || !select || !select.value) return null;
        return race.evolutions?.find(e => e.name === select.value) || null;
    }

    // Eine gewaehlte Evolution ersetzt die Basisrasse komplett — ihre Stats
    // sind Vollwerte, nicht Deltas.
    function getActiveRace() {
        return getRaceEvolution() || equippedItems.race || null;
    }

    // Dropdown neu befuellen. Die bisherige Auswahl bleibt erhalten, solange
    // die neue Rasse eine gleichnamige Evolution hat.
    function updateRaceEvolutionRow() {
        const row = document.getElementById('race-evolution-row');
        const select = document.getElementById('race-evolution-select');
        if (!row || !select) return;

        const evolutions = equippedItems.race?.evolutions || [];
        if (!evolutions.length) {
            row.style.display = 'none';
            select.innerHTML = '';
            return;
        }

        const previous = select.value;
        select.innerHTML = '';
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = 'No racial upgrade';
        select.appendChild(noneOpt);
        evolutions.forEach(evo => {
            const opt = document.createElement('option');
            opt.value = evo.name;
            opt.textContent = evo.name;
            select.appendChild(opt);
        });
        select.value = evolutions.some(e => e.name === previous) ? previous : '';
        row.style.display = 'flex';
    }

    function setRaceEvolution(name) {
        const select = document.getElementById('race-evolution-select');
        if (!select) return;
        select.value = [...select.options].some(o => o.value === name) ? name : '';
    }

    // Vor der Evolution-Umstellung waren Evolutionen eigenstaendige Rassen
    // ("Ghoul: Phantom Ghoul", "Black Ooze Slime"). Alte Builds bleiben lesbar.
    function findRaceByEvolutionName(name) {
        for (const [key, race] of Object.entries(itemsDatabase.race)) {
            const evolution = race.evolutions?.find(e =>
                e.name === name || `${race.name}: ${e.name}` === name);
            if (evolution) return { key, race, evolution };
        }
        return null;
    }

    /* =====================================================================
       Abilities

       Drei Quellen, eine Darstellung: Klassen-Abilities (haengen am
       Klassenlevel), Rassen-Abilities (haengen an Rasse + Charakterlevel) und
       frei equipte Abilities aus abilitiesDatabase. Alle werden als
       Item-Kachel mit Rarity-Rahmen gerendert.

       Interne Form ("Entry"):
         { skill, kind: 'active'|'passive', rarity, source, sourceKind, locked }
       ===================================================================== */

    // Abilities tragen im Spiel eine eigene Rarity. Die equipbaren Spells in
    // abilities.js haben sie schon; Klassen- und Rassen-Skills sind noch nicht
    // eingepflegt und bleiben deshalb common (grau). Sobald die echten Werte
    // da sind, reicht ein `rarity: '...'` am jeweiligen Skill in
    // classdata.js / races.js.
    function abilityRarity(skill) {
        return skill.rarity || 'common';
    }

    function abilityEntry(skill, { kind, source, sourceKind, locked, evolveLocked, stage2Unlocked }) {
        return {
            skill,
            kind,
            source,
            sourceKind,
            locked: !!locked,
            // Ability selbst schon da, aber die Evolutionswahl (skill.evolveLevel)
            // noch nicht erreicht — Pfeil bleibt bis dahin versteckt.
            evolveLocked: !!evolveLocked,
            // Zweite Evolutionsstufe (skill.evolveLevel2, z.B. Battle Aura ab
            // Lv 25) erreicht — nur relevant, wenn die Ability sowas hat.
            stage2Unlocked: !!stage2Unlocked,
            rarity: abilityRarity(skill)
        };
    }

    // Alle Abilities einer Klasse inkl. gewaehlter Subklasse.
    // includeLocked liefert auch noch nicht freigeschaltete (fuer das Modal).
    function classAbilityEntries(className, { includeLocked = false } = {}) {
        const info = classInfoData[className];
        if (!info) return [];

        const level = getClassLevel(className);
        const totalLevel = getTotalLevel();
        const entries = [];

        const push = (skills, kind, source, isUnlocked, refLevel) => {
            (skills || []).forEach(skill => {
                const locked = !isUnlocked(skill);
                if (locked && !includeLocked) return;
                const evolveLocked = !!skill.evolveLevel && refLevel < skill.evolveLevel;
                const stage2Unlocked = !!skill.evolveLevel2 && refLevel >= skill.evolveLevel2;
                entries.push(abilityEntry(skill, { kind, source, sourceKind: 'class', locked, evolveLocked, stage2Unlocked }));
            });
        };

        // Basisklasse: das eigene Klassenlevel entscheidet
        const baseUnlocked = s => s.level !== null && s.level !== undefined && s.level <= level;
        push(info.actives, 'active', className, baseUnlocked, level);

        // Waffen-Trainings pro Klasse, Ruestungsklasse von der Startklasse.
        effectivePassiveFeatures(className).entries.forEach(({ skill, source }) => {
            const locked = !baseUnlocked(skill);
            if (locked && !includeLocked) return;
            entries.push(abilityEntry(skill, {
                kind: 'passive', source, sourceKind: 'class', locked
            }));
        });

        // Passives koennen aus der Startklasse stammen, die Level-Schwelle
        // bleibt aber die DIESER Klasse — siehe getStartingClass(). Ein
        // eingetauschtes Passive sitzt per Definition auf demselben Level,
        // das Gating aendert sich dadurch also nicht. Passives haben keine
        // Evolutionen, deshalb reicht hier der schlanke Eintrag.
        effectivePassiveSkills(className).entries.forEach(({ skill, source }) => {
            const locked = !baseUnlocked(skill);
            if (locked && !includeLocked) return;
            entries.push(abilityEntry(skill, {
                kind: 'passive', source, sourceKind: 'class', locked
            }));
        });

        // Subklasse ab Klassenlevel 30; ihre Skills haengen am Gesamtlevel
        const subclass = getSubclassSelection(className);
        const sub = classInfoData[subclass];
        if (sub && (includeLocked || level >= 30)) {
            const subUnlocked = s => level >= 30 &&
                (s.level === null || s.level === undefined || s.level <= totalLevel);
            push(sub.passiveFeatures, 'passive', subclass, subUnlocked, totalLevel);
            push(sub.actives, 'active', subclass, subUnlocked, totalLevel);
            push(sub.passiveSkills, 'passive', subclass, subUnlocked, totalLevel);
        }

        return entries;
    }

    // Rassen-Skills schalten ueber das Charakterlevel frei — das ist die Summe
    // der Klassenlevel, aber mindestens 1, damit die Level-1-Passives auch
    // ohne verteilte Klassenlevel sichtbar sind.
    function characterLevel() {
        return Math.max(getTotalLevel(), 1);
    }

    function raceSkillEntries(race, skills, kind, { forceUnlocked = false } = {}) {
        const level = characterLevel();
        return (skills || []).map(skill => abilityEntry(skill, {
            kind,
            source: race.name,
            sourceKind: 'race',
            locked: forceUnlocked ? false
                : !(skill.level === null || skill.level === undefined || skill.level <= level)
        }));
    }

    // Fuer das Panel: Basisrasse + das tatsaechlich gewaehlte Racial Upgrade.
    function raceAbilityEntries(race) {
        if (!race) return [];
        const entries = [
            ...raceSkillEntries(race, race.passives, 'passive'),
            ...raceSkillEntries(race, race.actives, 'active')
        ].filter(e => !e.locked);

        const evolution = getRaceEvolution();
        if (evolution) {
            // Nicht nochmal level-gaten: wer das Upgrade waehlt, soll auch sehen
            // was es bringt — die Stats zaehlen ja ebenfalls sofort.
            entries.push(
                ...raceSkillEntries(evolution, evolution.passives, 'passive', { forceUnlocked: true }),
                ...raceSkillEntries(evolution, evolution.actives, 'active', { forceUnlocked: true })
            );
        }
        return entries;
    }

    // Quellen-Label einer equipbaren Ability: "Fire Spell", "Spell",
    // "Passive". Es steht im Tooltip und wird von beiden Suchfeldern
    // durchsucht — damit findet "fire" alle Feuer-Spells, nicht nur Fireball.
    function abilitySource(ability) {
        const category = ability.category.charAt(0).toUpperCase() + ability.category.slice(1);
        return ability.element ? `${ability.element} ${category}` : category;
    }

    // Bei Ability-Instanzen liest abilityRarity die eigene rarity direkt mit.
    function equippedAbilityEntries() {
        return equippedAbilities.map(ability => abilityEntry(ability, {
            kind: ability.kind,
            source: abilitySource(ability),
            sourceKind: 'equipped'
        }));
    }

    // ---- Evolutionen ----
    // Fast jede Klasse evolviert ihre Standardattacke (Lv 10), dazu kommen
    // Battle Aura & Co. Der Nutzer soll das wie im Spiel selbst festlegen.

    // Manche Abilities (aktuell nur Battle Aura) evolvieren ein zweites Mal:
    // Lv 15 waehlt man eine Aura, Lv 25 verfeinert man genau diese Wahl weiter
    // (Fierce -> Savage/Warrior's, etc). Damit die zweite Wahl nicht die erste
    // ueberschreibt, bekommt sie einen eigenen Schluessel in chosenEvolutions.
    const TIER2_SUFFIX = '::tier2';
    function tier2Key(skillName) {
        return `${skillName}${TIER2_SUFFIX}`;
    }
    function isTier2Key(key) {
        return key.endsWith(TIER2_SUFFIX);
    }
    function baseNameFromKey(key) {
        return isTier2Key(key) ? key.slice(0, -TIER2_SUFFIX.length) : key;
    }

    // Namen mit Doppelpunkt am Ende sind Zwischenueberschriften aus dem Wiki,
    // keine waehlbaren Abilities.
    function isOptionHeader(option) {
        return option.name.trim().endsWith(':');
    }

    // Manche Evolutionsstufen bauen auf einer frueheren Wahl auf ("You will
    // receive 2 choices based off of your previous chosen battle aura"). Die
    // Gruppen tragen den Namen der Vorgaenger-Option — steht die fest, bleibt
    // nur die passende Gruppe uebrig.
    function narrowByGroup(options) {
        if (!options.some(o => o.group)) return options;
        const chosen = new Set(Object.values(chosenEvolutions));
        const matching = options.filter(o => o.group && chosen.has(o.group.replace(/:\s*$/, '')));
        return matching.length ? matching : options;
    }

    // Optionen fuer einen konkreten chosenEvolutions-Schluessel (Basis-Name
    // oder tier2Key) — unabhaengig vom aktuellen Charakterlevel, damit z.B.
    // pruneEvolutionChoices ohne Level-Kontext validieren kann.
    function optionsForKey(key) {
        const skill = findSkillByName(baseNameFromKey(key));
        if (!skill) return [];
        const raw = isTier2Key(key) ? skill.options2 : skill.options;
        return narrowByGroup((raw || []).filter(o => !isOptionHeader(o)));
    }

    // Welcher chosenEvolutions-Schluessel gerade aktiv ist: Stufe 2, sobald
    // sie freigeschaltet UND eine Stufe-1-Wahl getroffen ist — sonst Stufe 1.
    function activeEvolutionKey(skill, entry) {
        if (skill.evolveLevel2 && entry?.stage2Unlocked && chosenEvolutions[skill.name]) {
            return tier2Key(skill.name);
        }
        return skill.name;
    }

    function activeEvolutionOptions(skill, entry) {
        if (entry?.evolveLocked) return [];
        return optionsForKey(activeEvolutionKey(skill, entry));
    }

    function chosenOptionForKey(key) {
        const name = chosenEvolutions[key];
        return name ? optionsForKey(key).find(o => o.name === name) || null : null;
    }

    // Finale Form der Ability fuer Kachel/Suche: eine Stufe-2-Wahl schlaegt
    // eine Stufe-1-Wahl, unabhaengig davon, ob Stufe 2 gerade (noch) durchs
    // Level freigeschaltet ist — einmal gewaehlt, bleibt es die Anzeige.
    function displayedEvolutionName(skill) {
        return chosenEvolutions[tier2Key(skill.name)] || chosenEvolutions[skill.name] || null;
    }

    // Wird eine Vorgaenger-Wahl geaendert oder entfernt, kann eine Folgewahl
    // (Stufe 2, oder eine gruppenabhaengige Option) ungueltig werden.
    function pruneEvolutionChoices() {
        Object.keys(chosenEvolutions).forEach(key => {
            if (!optionsForKey(key).some(o => o.name === chosenEvolutions[key])) {
                delete chosenEvolutions[key];
            }
        });
    }

    function findSkillByName(name) {
        for (const info of Object.values(classInfoData)) {
            for (const bucket of [info.passiveFeatures, info.actives, info.passiveSkills]) {
                const hit = (bucket || []).find(s => s.name === name);
                if (hit) return hit;
            }
        }
        return null;
    }

    function setEvolutionChoice(key, optionName) {
        if (optionName) {
            chosenEvolutions[key] = optionName;
        } else {
            delete chosenEvolutions[key];
        }
        pruneEvolutionChoices();
        updateAbilitiesDisplay();
        // Ein offenes Nachschlage-Modal soll die Wahl sofort mitzeigen
        abilityModalRefresh?.();
    }

    // Stufe-1-Wahl (z.B. "Fortified Battle Aura") komplett zuruecksetzen,
    // inklusive einer davon abhaengenden Stufe-2-Wahl (z.B. "Aegis Battle
    // Aura"). Ohne das explizite Loeschen beider Keys wuerde die Stufe-2-Wahl
    // als "verwaist" stehen bleiben, weil pruneEvolutionChoices sie nicht
    // erkennt, sobald optionsForKey(tier2Key) ohne Gruppen-Filter (weil die
    // Stufe-1-Wahl fehlt) wieder alle Optionen zulaesst.
    function resetEvolutionChoice(skillName) {
        delete chosenEvolutions[skillName];
        delete chosenEvolutions[tier2Key(skillName)];
        pruneEvolutionChoices();
        updateAbilitiesDisplay();
        abilityModalRefresh?.();
    }

    // ---- Darstellung ----

    function createSkillTooltip(entry) {
        const skill = entry.skill;
        const content = document.createElement('div');

        const header = document.createElement('div');
        header.className = 'tooltip-header';
        const nameEl = document.createElement('div');
        nameEl.className = `tooltip-name ${entry.rarity}`;
        nameEl.textContent = skill.name;
        header.appendChild(nameEl);

        const headerRight = document.createElement('div');
        headerRight.className = 'tooltip-header-right';
        const rarityEl = document.createElement('div');
        rarityEl.className = `tooltip-rarity ${entry.rarity}`;
        rarityEl.textContent = entry.rarity;
        headerRight.appendChild(rarityEl);
        if (skill.level !== null && skill.level !== undefined) {
            const lvlEl = document.createElement('div');
            lvlEl.className = 'tooltip-level';
            lvlEl.textContent = `Lv. ${skill.level}`;
            headerRight.appendChild(lvlEl);
        }
        header.appendChild(headerRight);
        content.appendChild(header);

        const meta = document.createElement('div');
        meta.className = 'tooltip-type';
        // Set, damit eine freie Passive nicht als "Passive · Passive" endet
        meta.textContent = [...new Set(
            [entry.source, entry.kind === 'passive' ? 'Passive' : 'Active'].filter(Boolean)
        )].join(' · ');
        content.appendChild(meta);

        if (entry.locked) {
            const locked = document.createElement('div');
            locked.className = 'tooltip-locked';
            locked.textContent = 'Not unlocked in this build';
            content.appendChild(locked);
        }

        if (skill.requirement) {
            const req = document.createElement('div');
            req.className = 'tooltip-type';
            req.textContent = skill.requirement;
            content.appendChild(req);
        }
        if (skill.description) {
            const desc = document.createElement('div');
            desc.className = 'tooltip-description';
            desc.textContent = skill.description;
            content.appendChild(desc);
        }
        const options = activeEvolutionOptions(skill, entry);
        if (entry.evolveLocked && skill.evolveLevel) {
            const evoNote = document.createElement('div');
            evoNote.className = 'tooltip-type';
            evoNote.textContent = `Evolves at Lv. ${skill.evolveLevel} (▲)`;
            content.appendChild(evoNote);
        } else if (skill.evolveLevel2 && !entry.stage2Unlocked && chosenEvolutions[skill.name]) {
            const evoNote = document.createElement('div');
            evoNote.className = 'tooltip-type';
            evoNote.textContent = `Refines further at Lv. ${skill.evolveLevel2} (▲)`;
            content.appendChild(evoNote);
        }
        if (options.length) {
            const chosen = chosenOptionForKey(activeEvolutionKey(skill, entry));
            const optsHeader = document.createElement('div');
            optsHeader.className = 'tooltip-type';
            optsHeader.textContent = chosen ? 'Evolution — click ▲ to change:' : 'Choose an evolution (▲):';
            content.appendChild(optsHeader);
            options.forEach(o => {
                const picked = chosen?.name === o.name;
                const n = document.createElement('div');
                n.className = 'tooltip-stat-name' + (picked ? ' tooltip-option-chosen' : '');
                n.textContent = (picked ? '▸ ' : '· ') + o.name;
                content.appendChild(n);
                // Beschreibung nur zur gewaehlten Option, sonst wird der
                // Tooltip bei neun Battle-Aura-Varianten unlesbar lang.
                if (o.description && (picked || !chosen)) {
                    const d = document.createElement('div');
                    d.className = 'tooltip-option-desc';
                    d.textContent = o.description;
                    content.appendChild(d);
                }
            });
        }
        return content;
    }

    // Ability-Kachel im Item-Look: Rarity-Rahmen, Level-Badge, Tooltip.
    // Nur selbst equipte Abilities bekommen das Loeschen-Overlay.
    function renderAbilityCard(entry) {
        const card = document.createElement('div');
        card.className = 'ability-card';
        card.dataset.rarity = entry.rarity;
        card.dataset.source = entry.source;
        if (entry.locked) card.classList.add('locked');
        if (entry.sourceKind === 'equipped') card.classList.add('equipped');

        if (entry.skill.level !== null && entry.skill.level !== undefined) {
            const lvl = document.createElement('div');
            lvl.className = 'ability-card-level';
            lvl.textContent = `Lv ${entry.skill.level}`;
            card.appendChild(lvl);
        }

        const options = activeEvolutionOptions(entry.skill, entry);
        // "chosen" ist die Wahl der GERADE aktiven Stufe (Pfeil-Highlight,
        // "N choices"-Hinweis); der Kachel-Name zeigt dagegen immer die
        // hoechste getroffene Wahl, auch wenn Stufe 2 aktuell nicht aktiv ist.
        const chosen = chosenOptionForKey(activeEvolutionKey(entry.skill, entry));

        const name = document.createElement('div');
        name.className = 'ability-card-name';
        name.textContent = displayedEvolutionName(entry.skill) || entry.skill.name;
        card.appendChild(name);

        if (options.length && !chosen) {
            const note = document.createElement('div');
            note.className = 'ability-card-note';
            note.textContent = options.length === 1 ? '1 choice' : `${options.length} choices`;
            card.appendChild(note);
        }

        card.addEventListener('mouseenter', () => {
            tooltipSystem.showTooltip(createSkillTooltip(entry), card);
        });
        card.addEventListener('mouseleave', () => tooltipSystem.hideTooltip());

        // Gelber Pfeil oben rechts: Evolution auswaehlen
        if (options.length && !entry.locked) {
            const evolve = document.createElement('button');
            evolve.className = 'ability-evolve-btn' + (chosen ? ' chosen' : '');
            evolve.textContent = '▲';
            evolve.title = chosen
                ? `Evolution: ${chosen.name} — click to change`
                : 'Choose evolution';
            evolve.addEventListener('click', (e) => {
                e.stopPropagation();
                openEvolutionMenu(entry, evolve);
            });
            card.appendChild(evolve);
        }

        if (entry.sourceKind === 'equipped') {
            const remove = document.createElement('div');
            remove.className = 'remove-item';
            remove.title = 'Unequip';
            remove.addEventListener('click', (e) => {
                e.stopPropagation();
                unequipAbility(entry.skill);
            });
            card.appendChild(remove);
        }

        return card;
    }

    function renderAbilityGrid(entries) {
        const grid = document.createElement('div');
        grid.className = 'ability-grid';
        entries.forEach(entry => grid.appendChild(renderAbilityCard(entry)));
        return grid;
    }

    // Viele Abilities stehen bei mehreren Klassen (Battle Aura, Focus Training,
    // Light Armor, die Buff-Sprueche von Magician/Priest ...). Man hat sie
    // trotzdem nur einmal — also eine Kachel pro Name, mit allen Quellen dran.
    function dedupeAbilityEntries(entries) {
        const byName = new Map();
        entries.forEach(entry => {
            const existing = byName.get(entry.skill.name);
            if (!existing) {
                byName.set(entry.skill.name, { ...entry, sources: [entry.source] });
                return;
            }
            if (!existing.sources.includes(entry.source)) existing.sources.push(entry.source);

            // Wer z.B. Warrior UND Samurai levelt, bekommt "Battle Aura" von
            // beiden Klassen — je nach Klassenlevel mit unterschiedlichem
            // Freischaltstand. Die Kachel soll den permissivsten Stand aller
            // Quellen zeigen: einmal durch irgendeine Klasse freigeschaltet,
            // bleibt es freigeschaltet, statt vom Zufall abzuhaengen, welche
            // Klasse zuerst in der Liste steht.
            const locked = existing.locked && entry.locked;
            const evolveLocked = existing.evolveLocked && entry.evolveLocked;
            const stage2Unlocked = existing.stage2Unlocked || entry.stage2Unlocked;

            // Manche Klassen kennen dieselbe Ability nur unvollstaendig (z.B.
            // fehlende options2, wenn deren Wiki-Eintrag nie strukturiert
            // erfasst wurde). Damit Stufe 2 nicht vom Zufall abhaengt, welche
            // Klasse zuerst in der Liste steht, gewinnt IMMER die Seite mit
            // den vollstaendigeren Daten — unabhaengig vom Level-Tiebreak.
            const existingHasStage2Data = !!existing.skill.options2;
            const entryHasStage2Data = !!entry.skill.options2;

            // Sonst: die frueheste Freischaltung gewinnt fuers Level-Badge,
            // sonst stuende auf der Kachel ein Level, das der Build ueber
            // die andere Klasse laengst hat. Equipte Abilities behalten den
            // Vorrang — sonst ginge ihr Loeschen-Overlay verloren.
            const preferEntry = existingHasStage2Data !== entryHasStage2Data
                ? entryHasStage2Data
                : (existing.sourceKind !== 'equipped'
                    && (entry.skill.level ?? 0) < (existing.skill.level ?? 0));
            const base = preferEntry ? entry : existing;
            byName.set(entry.skill.name, {
                ...base,
                sources: existing.sources,
                locked,
                evolveLocked,
                stage2Unlocked
            });
        });
        return [...byName.values()].map(entry => ({ ...entry, source: entry.sources.join(', ') }));
    }

    // Sucht ueber Name UND Herkunft — "warrior" filtert damit auf die
    // Klassen-Abilities, "ghoul" auf die der Rasse.
    function abilitySearchTerm() {
        return (document.getElementById('ability-search')?.value || '').trim().toLowerCase();
    }

    function matchesAbilitySearch(entry, term) {
        if (!term) return true;
        // Gewaehlte Evolution mitsuchen — sie steht ja auch auf der Kachel
        const evolution = displayedEvolutionName(entry.skill) || '';
        return `${entry.skill.name} ${entry.source} ${evolution}`.toLowerCase().includes(term);
    }

    // Panel rechts: alles was der Build gerade hat, nur nach Active/Passive
    // getrennt. Klassen- und Rassenlisten im Detail gibt es in den Modals.
    function updateAbilitiesDisplay() {
        const display = document.querySelector('.abilities-display');
        if (!display) return;
        display.innerHTML = '';

        const entries = dedupeAbilityEntries([
            ...equippedAbilityEntries(),
            ...Object.keys(classesDatabase)
                .filter(className => getClassLevel(className) > 0)
                .flatMap(className => classAbilityEntries(className)),
            ...raceAbilityEntries(equippedItems.race)
        ]);

        const term = abilitySearchTerm();
        const visible = entries.filter(e => matchesAbilitySearch(e, term));

        if (!visible.length) {
            const hint = document.createElement('div');
            hint.className = 'abilities-hint';
            hint.textContent = entries.length
                ? `No ability matches "${term}".`
                : 'Set class levels, pick a race, or equip an ability above.';
            display.appendChild(hint);
            return;
        }

        [['active', 'Active'], ['passive', 'Passive']].forEach(([kind, label]) => {
            const group = visible.filter(e => e.kind === kind);
            if (!group.length) return;
            const total = entries.filter(e => e.kind === kind).length;
            const header = document.createElement('div');
            header.className = 'ability-group-header';
            // Bei aktiver Suche zeigen, wie viel gerade ausgeblendet ist
            header.textContent = group.length === total
                ? `${label} (${group.length})`
                : `${label} (${group.length} of ${total})`;
            display.appendChild(header);
            display.appendChild(renderAbilityGrid(group));
        });
    }

    function closeCurrentMenu() {
        if (!currentOpenMenu) return;
        saveCurrentFilterState();
        document.body.removeChild(currentOpenMenu.menu);
        currentOpenMenu = null;
    }

    // Kompaktes Popover direkt am Pfeil statt des grossen Seitenmenues — es
    // geht ja nur um eine Handvoll Optionen.
    function openEvolutionMenu(entry, anchor) {
        const key = activeEvolutionKey(entry.skill, entry);
        const wasOpen = currentOpenMenu?.menu.dataset.evolutionOf === key;
        closeCurrentMenu();
        if (wasOpen) return;
        tooltipSystem.hideTooltip();

        const menu = document.createElement('div');
        menu.className = 'item-menu evolution-menu';
        menu.dataset.slotType = 'evolution';
        menu.dataset.evolutionOf = key;

        const header = document.createElement('div');
        header.className = 'evolution-menu-header';
        header.textContent = entry.skill.name;
        menu.appendChild(header);

        const list = document.createElement('div');
        list.className = 'evolution-menu-list';
        const chosen = chosenOptionForKey(key);

        optionsForKey(key).forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'evolution-option' + (chosen?.name === option.name ? ' chosen' : '');
            const name = document.createElement('div');
            name.className = 'evolution-option-name';
            name.textContent = option.name;
            btn.appendChild(name);
            if (option.description) {
                const desc = document.createElement('div');
                desc.className = 'evolution-option-desc';
                desc.textContent = option.description;
                btn.appendChild(desc);
            }
            btn.addEventListener('click', () => {
                closeCurrentMenu();
                setEvolutionChoice(key, option.name);
            });
            list.appendChild(btn);
        });

        if (chosen) {
            const clear = document.createElement('button');
            clear.className = 'evolution-option evolution-clear';
            clear.textContent = 'Clear choice';
            clear.addEventListener('click', () => {
                closeCurrentMenu();
                setEvolutionChoice(key, null);
            });
            list.appendChild(clear);
        }

        // Auf Stufe 2 (z.B. Battle Aura ab Lv. 25) bleibt der Pfeil sonst fuer
        // immer auf die einmal gewaehlte Stufe-1-Gruppe (Fierce/Swift/
        // Fortified) festgelegt — ohne diesen Button kaeme man z.B. von Aegis
        // Battle Aura nie mehr zurueck zu Swift/Strength Battle Aura.
        if (isTier2Key(key)) {
            const resetBase = document.createElement('button');
            resetBase.className = 'evolution-option evolution-clear';
            resetBase.textContent = `Reset ${baseNameFromKey(key)} choice`;
            resetBase.addEventListener('click', () => {
                closeCurrentMenu();
                resetEvolutionChoice(baseNameFromKey(key));
            });
            list.appendChild(resetBase);
        }

        menu.appendChild(list);
        document.body.appendChild(menu);
        currentOpenMenu = { menu, slot: anchor };

        // position: fixed -> Viewport-Koordinaten, kein scrollY noetig
        const rect = anchor.getBoundingClientRect();
        const margin = 8;
        const width = menu.offsetWidth;
        const height = menu.offsetHeight;
        const left = Math.max(margin,
            Math.min(rect.right - width, window.innerWidth - width - margin));
        let top = rect.bottom + margin;
        if (top + height > window.innerHeight - margin) {
            top = Math.max(margin, rect.top - height - margin);
        }
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    // ---- Equipbare Abilities ----

    function equipAbility(ability) {
        if (equippedAbilities.some(a => a.name === ability.name)) return;
        equippedAbilities.push(ability);
        onAbilitiesChanged();
    }

    function unequipAbility(ability) {
        const index = equippedAbilities.findIndex(a => a.name === ability.name);
        if (index === -1) return;
        equippedAbilities.splice(index, 1);
        onAbilitiesChanged();
    }

    function onAbilitiesChanged() {
        tooltipSystem.hideTooltip();
        updateAbilitiesDisplay();
        // Dual Wielding entscheidet, was im Offhand liegen darf
        enforceDualWieldRule();
        updateTotalStatsDisplay();
    }

    // Auswahlmenue am "+" — gleiche Huelle wie das Item-/Runenmenue, damit
    // Filter-Persistenz und Klick-ausserhalb-schliesst unveraendert greifen.
    function openAbilityMenu(anchor) {
        const wasOpen = currentOpenMenu?.menu.dataset.slotType === 'ability';
        if (currentOpenMenu) {
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
        }
        if (wasOpen) return;

        const menu = document.createElement('div');
        menu.className = 'item-menu ability-menu';
        menu.dataset.slotType = 'ability';
        menu.innerHTML = `
            <div class="menu-header-container">
                <div class="item-menu-header">
                    <input type="text" id="item-search" class="filter-input item-menu-search"
                        placeholder="Search abilities...">
                    <button id="reset-filters" class="menu-reset-button">Reset</button>
                </div>
                <div class="item-menu-filters">
                    <select id="stat-filter" class="filter-select">
                        <option value="">All Kinds</option>
                        <option value="active">Active</option>
                        <option value="passive">Passive</option>
                    </select>
                    <select id="type-filter" class="filter-select">
                        <option value="">All Categories</option>
                    </select>
                    <select id="sort-filter" class="filter-select">
                        <option value="name-asc">A-Z</option>
                        <option value="name-desc">Z-A</option>
                        <option value="rarity-asc">Rarity ↑</option>
                        <option value="rarity-desc">Rarity ↓</option>
                    </select>
                </div>
            </div>
            <div class="item-menu-content"></div>
        `;
        document.body.appendChild(menu);
        currentOpenMenu = { menu, slot: anchor };

        const typeFilter = menu.querySelector('#type-filter');
        [...new Set(Object.values(abilitiesDatabase).map(a => a.category))].sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            typeFilter.appendChild(option);
        });

        const contentArea = menu.querySelector('.item-menu-content');
        const update = () => updateAbilityMenu(menu, contentArea);
        menu.querySelector('#item-search').addEventListener('input', update);
        menu.querySelector('#stat-filter').addEventListener('change', update);
        typeFilter.addEventListener('change', update);
        menu.querySelector('#sort-filter').addEventListener('change', update);
        menu.querySelector('#reset-filters').addEventListener('click', () => {
            menu.querySelector('#item-search').value = '';
            menu.querySelector('#stat-filter').value = '';
            typeFilter.value = '';
            menu.querySelector('#sort-filter').value = 'name-asc';
            Object.assign(filterStateFor('ability'), { search: '', stat: '', type: '', sort: 'name-asc' });
            update();
        });

        restoreFilters(menu, 'ability');
    }

    function updateAbilityMenu(menu, contentArea) {
        const searchTerm = menu.querySelector('#item-search').value.toLowerCase();
        const selectedKind = menu.querySelector('#stat-filter').value;
        const selectedCategory = menu.querySelector('#type-filter').value;
        const sortOption = menu.querySelector('#sort-filter').value;

        contentArea.innerHTML = '';

        const abilities = Object.entries(abilitiesDatabase)
            .map(([key, ability]) => ({ key, ability }))
            .filter(({ ability }) =>
                `${ability.name} ${abilitySource(ability)}`.toLowerCase().includes(searchTerm) &&
                (!selectedKind || ability.kind === selectedKind) &&
                (!selectedCategory || ability.category === selectedCategory) &&
                !equippedAbilities.some(a => a.name === ability.name))
            .sort((a, b) => {
                switch (sortOption) {
                    case 'name-desc':
                        return b.ability.name.localeCompare(a.ability.name);
                    case 'rarity-asc':
                        return (rarityOrder[a.ability.rarity] || 0) - (rarityOrder[b.ability.rarity] || 0);
                    case 'rarity-desc':
                        return (rarityOrder[b.ability.rarity] || 0) - (rarityOrder[a.ability.rarity] || 0);
                    default:
                        return a.ability.name.localeCompare(b.ability.name);
                }
            });

        abilities.forEach(({ key, ability }) => {
            const button = document.createElement('button');
            button.textContent = ability.name;
            button.setAttribute('data-rarity', ability.rarity);
            button.setAttribute('data-ability-key', key);

            const entry = abilityEntry(ability, {
                kind: ability.kind,
                source: abilitySource(ability),
                sourceKind: 'equipped'
            });
            button.addEventListener('mouseenter', () => {
                tooltipSystem.showTooltip(createSkillTooltip(entry), button);
            });
            button.addEventListener('mouseleave', () => tooltipSystem.hideTooltip());

            button.onclick = () => {
                saveCurrentFilterState();
                document.body.removeChild(currentOpenMenu.menu);
                currentOpenMenu = null;
                equipAbility(ability);
            };

            contentArea.appendChild(button);
        });

        if (!abilities.length) {
            const message = document.createElement('div');
            message.className = 'no-items-message';
            message.textContent = Object.keys(abilitiesDatabase).length === equippedAbilities.length
                ? 'All abilities are already equipped'
                : 'No abilities match your filters';
            contentArea.appendChild(message);
        }
    }

    // ---- Nachschlage-Modals (Klasse / Rasse) ----

    let abilityModalOverlay = null;
    // Baut das offene Modal neu auf, damit eine dort getroffene
    // Evolutions-Wahl sofort sichtbar wird. null = kein Modal offen.
    let abilityModalRefresh = null;

    function closeAbilityModal() {
        if (abilityModalOverlay) {
            document.body.removeChild(abilityModalOverlay);
            abilityModalOverlay = null;
        }
        abilityModalRefresh = null;
    }

    // groups: [{ title, entries, note? }] — leere Gruppen fallen raus.
    function showAbilityModal({ title, subtitle, groups, footer }) {
        closeAbilityModal();
        tooltipSystem.hideTooltip();

        abilityModalOverlay = document.createElement('div');
        abilityModalOverlay.className = 'class-info-overlay ability-modal-overlay';
        abilityModalOverlay.addEventListener('click', (e) => {
            if (e.target === abilityModalOverlay) closeAbilityModal();
        });

        const modal = document.createElement('div');
        modal.className = 'class-info-modal ability-modal';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'class-info-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', closeAbilityModal);
        modal.appendChild(closeBtn);

        const heading = document.createElement('h2');
        heading.textContent = title;
        modal.appendChild(heading);

        if (subtitle) {
            const sub = document.createElement('p');
            sub.className = 'class-info-overview';
            sub.textContent = subtitle;
            modal.appendChild(sub);
        }

        groups.filter(g => g.entries.length).forEach(group => {
            const h = document.createElement('h3');
            h.textContent = group.title;
            modal.appendChild(h);
            if (group.note) {
                const note = document.createElement('div');
                note.className = 'ability-group-note';
                note.textContent = group.note;
                modal.appendChild(note);
            }
            modal.appendChild(renderAbilityGrid(group.entries));
        });

        if (footer) modal.appendChild(footer);

        abilityModalOverlay.appendChild(modal);
        document.body.appendChild(abilityModalOverlay);
    }

    function showClassAbilities(className) {
        // dedupe faengt Eintraege ab, die im Wiki doppelt gelistet sind
        // (z.B. Strikers "Rampage" unter Active UND Passive).
        const entries = dedupeAbilityEntries(classAbilityEntries(className, { includeLocked: true }));
        const level = getClassLevel(className);
        const subclass = getSubclassSelection(className);
        // Die Liste zeigt bereits die getauschten Passives — ohne Hinweis
        // sieht es aus wie ein Datenfehler.
        const passives = effectivePassiveSkills(className);
        const swapNote = startingClassNote(className,
            { passives, features: effectivePassiveFeatures(className) });

        const details = document.createElement('button');
        details.className = 'class-info-subclass-btn ability-modal-link';
        details.textContent = 'Full class details';
        details.addEventListener('click', () => {
            closeAbilityModal();
            showClassInfo(className);
        });

        showAbilityModal({
            title: `${className} — Abilities`,
            subtitle: `Class level ${level}/50`
                + (subclass ? ` · Subclass: ${subclass}` : '')
                + ' — greyed-out abilities are not unlocked in this build yet.'
                + (swapNote ? ` ${swapNote}` : ''),
            groups: [
                { title: 'Active', entries: entries.filter(e => e.kind === 'active') },
                { title: 'Passive', entries: entries.filter(e => e.kind === 'passive') }
            ],
            footer: details
        });
        abilityModalRefresh = () => showClassAbilities(className);
    }

    // Alles was die Rasse bis Level 50 hergibt, inklusive aller Racial Upgrades.
    function showRaceAbilities() {
        const race = equippedItems.race;
        if (!race) return;

        const base = [
            ...raceSkillEntries(race, race.actives, 'active'),
            ...raceSkillEntries(race, race.passives, 'passive')
        ];

        const groups = [
            { title: 'Active', entries: base.filter(e => e.kind === 'active') },
            { title: 'Passive', entries: base.filter(e => e.kind === 'passive') }
        ];

        const chosen = getRaceEvolution();
        (race.evolutions || []).forEach(evolution => {
            const picked = chosen?.name === evolution.name;
            const entries = [
                ...raceSkillEntries(evolution, evolution.actives, 'active', { forceUnlocked: picked }),
                ...raceSkillEntries(evolution, evolution.passives, 'passive', { forceUnlocked: picked })
            ].map(entry => picked ? entry : { ...entry, locked: true });

            groups.push({
                title: `Racial Upgrade: ${evolution.name}${picked ? ' ✓' : ''}`,
                entries,
                note: picked ? null : 'Not your chosen upgrade'
            });
        });

        showAbilityModal({
            title: `${race.name} — Racial Abilities`,
            subtitle: `Everything this species unlocks up to level 50. `
                + `Your character level is ${characterLevel()} — greyed-out entries are not active yet.`,
            groups
        });
        abilityModalRefresh = () => showRaceAbilities();
    }

    // ---- Klassen-Nachschlagewerk (Modal) ----
    let classInfoOverlay = null;

    function closeClassInfo() {
        if (classInfoOverlay) {
            document.body.removeChild(classInfoOverlay);
            classInfoOverlay = null;
        }
    }

    function showClassInfo(className) {
        const info = classInfoData[className];
        if (!info) return;
        closeClassInfo();
        tooltipSystem.hideTooltip();

        classInfoOverlay = document.createElement('div');
        classInfoOverlay.className = 'class-info-overlay';
        classInfoOverlay.addEventListener('click', (e) => {
            if (e.target === classInfoOverlay) closeClassInfo();
        });

        const modal = document.createElement('div');
        modal.className = 'class-info-modal';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'class-info-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', closeClassInfo);
        modal.appendChild(closeBtn);

        const title = document.createElement('h2');
        title.textContent = className;
        modal.appendChild(title);

        if (info.subclassOf) {
            const parentLine = document.createElement('div');
            parentLine.className = 'class-info-parent';
            parentLine.append('Subclass of ');
            const link = document.createElement('span');
            link.className = 'class-info-link';
            link.textContent = info.subclassOf;
            link.addEventListener('click', () => showClassInfo(info.subclassOf));
            parentLine.appendChild(link);
            modal.appendChild(parentLine);
        }

        if (info.overview) {
            const ov = document.createElement('p');
            ov.className = 'class-info-overview';
            ov.textContent = info.overview;
            modal.appendChild(ov);
        }

        // Stats pro Level (nur Basisklassen; Subklassen skalieren nicht zusätzlich)
        const baseStats = classesDatabase[className]?.stats;
        if (baseStats) {
            const statsHeader = document.createElement('h3');
            statsHeader.textContent = 'Stats per Level';
            modal.appendChild(statsHeader);
            const statsList = document.createElement('div');
            statsList.className = 'class-info-stats';
            Object.entries(baseStats).forEach(([stat, value]) => {
                const s = document.createElement('div');
                const statInfo = getStatInfo(stat);
                s.textContent = `+${value} ${statInfo ? statInfo.name : stat}`;
                statsList.appendChild(s);
            });
            modal.appendChild(statsList);
        }

        const addSkillSection = (titleText, skills, isPassive, note) => {
            if (!skills || !skills.length) return;
            const h = document.createElement('h3');
            h.textContent = titleText;
            modal.appendChild(h);
            if (note) {
                const n = document.createElement('p');
                n.className = 'class-info-starter-note';
                n.textContent = note;
                modal.appendChild(n);
            }
            skills.forEach(skill => {
                const row = document.createElement('div');
                row.className = 'class-info-skill';
                const lvl = document.createElement('span');
                lvl.className = 'ability-level';
                lvl.textContent = skill.level === null || skill.level === undefined ? 'Lv ?' : `Lv ${skill.level}`;
                const body = document.createElement('div');
                body.className = 'class-info-skill-body';
                const name = document.createElement('div');
                name.className = 'class-info-skill-name';
                name.textContent = skill.name;
                body.appendChild(name);
                if (skill.description) {
                    const desc = document.createElement('div');
                    desc.className = 'class-info-skill-desc';
                    desc.textContent = skill.description;
                    body.appendChild(desc);
                }
                const addOptionsBlock = (options, evolveLevel) => {
                    if (!options?.length) return;
                    const opts = document.createElement('div');
                    opts.className = 'class-info-skill-options';
                    if (evolveLevel) {
                        const evoLabel = document.createElement('div');
                        evoLabel.className = 'class-info-option-group class-info-evolve-label';
                        evoLabel.textContent = `Evolves at Lv ${evolveLevel}:`;
                        opts.appendChild(evoLabel);
                    }
                    options.forEach(o => {
                        if (o.name.endsWith(':')) {
                            const g = document.createElement('div');
                            g.className = 'class-info-option-group';
                            g.textContent = o.name;
                            opts.appendChild(g);
                            return;
                        }
                        const opt = document.createElement('div');
                        opt.className = 'class-info-option';
                        opt.textContent = o.name + (o.description ? ` — ${o.description}` : '');
                        opts.appendChild(opt);
                    });
                    body.appendChild(opts);
                };
                addOptionsBlock(skill.options, skill.evolveLevel);
                // Zweite Evolutionsstufe (z.B. Battle Aura ab Lv 25) — baut auf
                // der ersten Wahl auf, deshalb als eigener Block darunter.
                addOptionsBlock(skill.options2, skill.evolveLevel2);
                row.appendChild(lvl);
                row.appendChild(body);
                modal.appendChild(row);
            });
        };

        // Das Nachschlagewerk zeigt weiter die echte Klassenliste — mit dem
        // Hinweis, welche Eintraege die Startklasse im Build ersetzt.
        addSkillSection('Passive Features', info.passiveFeatures, true,
            startingClassNote(className, { features: effectivePassiveFeatures(className) }));
        addSkillSection('Active Skills', info.actives, false);
        addSkillSection('Passive Skills', info.passiveSkills, true,
            startingClassNote(className, { passives: effectivePassiveSkills(className) }));

        // Gewählte Subklasse direkt mit anzeigen statt sie erneut auswählen zu müssen
        const chosenSub = info.subclasses?.length ? getSubclassSelection(className) : '';
        if (chosenSub && classInfoData[chosenSub]) {
            const subInfo = classInfoData[chosenSub];
            const divider = document.createElement('h3');
            divider.className = 'class-info-chosen-sub';
            divider.textContent = `${chosenSub} — your subclass`;
            modal.appendChild(divider);
            if (subInfo.overview) {
                const ov = document.createElement('p');
                ov.className = 'class-info-overview';
                ov.textContent = subInfo.overview;
                modal.appendChild(ov);
            }
            addSkillSection(`${chosenSub}: Passive Features`, subInfo.passiveFeatures, true);
            addSkillSection(`${chosenSub}: Active Skills`, subInfo.actives, false);
            addSkillSection(`${chosenSub}: Passive Skills`, subInfo.passiveSkills, true);
        }

        if (info.subclasses?.length) {
            const h = document.createElement('h3');
            h.textContent = 'Subclasses (from class level 30)';
            modal.appendChild(h);
            const wrap = document.createElement('div');
            wrap.className = 'class-info-subclasses';
            info.subclasses.forEach(sub => {
                const btn = document.createElement('button');
                btn.className = 'class-info-subclass-btn' + (sub === chosenSub ? ' selected' : '');
                btn.textContent = sub === chosenSub ? `${sub} ✓` : sub;
                btn.addEventListener('click', () => showClassInfo(sub));
                wrap.appendChild(btn);
            });
            modal.appendChild(wrap);
        }

        classInfoOverlay.appendChild(modal);
        document.body.appendChild(classInfoOverlay);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        closeClassInfo();
        closeAbilityModal();
    });


    function calculateTotalStats() {
        const totalStats = {
            flat: {},
            percent: {},
            damage: {},
            armor: 0,
            posture: 0,
        };

        statlist.forEach(stat => {
            if (stat.percentual) {
            totalStats.percent[stat.stat] = 0;
            } else {
            totalStats.flat[stat.stat] = 0;
            }
        });

        const classInputs = document.querySelectorAll('.class-level-input');
        classInputs.forEach(input => {
            const className = input.dataset.className;
            const level = parseInt(input.value) || 0;
            const classData = classesDatabase[className];
            
            if (classData && level > 0) {
                Object.entries(classData.stats).forEach(([stat, value]) => {
                    const statValue = value * level;
                    const statInfo = statlist.find(s => s.stat === stat);
                    
                    if (statInfo) {
                        if (statInfo.percentual) {
                            totalStats.percent[stat] = (totalStats.percent[stat] || 0) + statValue;
                        } else {
                            totalStats.flat[stat] = (totalStats.flat[stat] || 0) + statValue;
                        }
                    }
                });
            }
        });

        const professionBonus = document.getElementById('level60-professions').checked;
        if (professionBonus) {
            ['strength', 'stamina', 'agility', 'intellect', 'spirit'].forEach(stat => {
                totalStats.flat[stat] = (totalStats.flat[stat] || 0) + 60;
            });
            totalStats.flat['luck'] = (totalStats.flat['luck'] || 0) + 7;
            totalStats.flat['maxWeight'] = (totalStats.flat['maxWeight'] || 0) + 150;
        }
        
        for (let i = 1; i <= 4; i++) {
            const ring = equippedItems[`ring${i}`];
            if (ring && ring.name && ring.name === 'Maelis\'s Ring') {
                if (equippedItems.fairy && equippedItems.fairy.name){
                    if (equippedItems.fairy.name == 'Golden Fairy'){
                        totalStats.flat['luck'] = (totalStats.flat['luck'] || 0) + 1;
                    }
                    else if (equippedItems.fairy.name == 'Fairy'){
                        totalStats.percent['magicAttack'] = (totalStats.flat['magicAttack'] || 0) + 0.08;
                    }
                    else if (equippedItems.fairy.name == 'Earth Fairy'){
                        totalStats.percent['earthAttack'] = (totalStats.flat['earthAttack'] || 0) + 0.05;
                    }
                    else if (equippedItems.fairy.name == 'Fire Fairy'){
                        totalStats.percent['fireAttack'] = (totalStats.flat['fireAttack'] || 0) + 0.05;
                    }
                    else if (equippedItems.fairy.name == 'Water Fairy'){
                        totalStats.percent['waterAttack'] = (totalStats.flat['waterAttack'] || 0) + 0.05;
                    }
                    else if (equippedItems.fairy.name == 'Lightning Fairy'){
                        totalStats.percent['lightningAttack'] = (totalStats.flat['lightningAttack'] || 0) + 0.05;
                    }
                    else if (equippedItems.fairy.name == 'Wind Fairy'){
                        totalStats.percent['windAttack'] = (totalStats.flat['windAttack'] || 0) + 0.05;
                    }
                }
                break;
            }
        }

        for (const [slot, item] of Object.entries(equippedItems)) {
            // Bei gewaehltem Racial Upgrade zaehlen dessen Stats statt der Basisrasse
            const source = slot === 'race' ? getActiveRace() : item;
            if (source) {
            if (source.stats) {
                for (const [stat, value] of Object.entries(source.stats)) {
                const statInfo = statlist.find(s => s.stat === stat);
                if (statInfo) {
                    if (statInfo.percentual) {
                    totalStats.percent[stat] = (totalStats.percent[stat] || 0) + value;
                    } else {
                    totalStats.flat[stat] = (totalStats.flat[stat] || 0) + value;
                    }
                }
                }
            }

            if (source.damage) {
                for (const [type, value] of Object.entries(source.damage)) {
                totalStats.damage[type] = (totalStats.damage[type] || 0) + value;
                }
            }

            if (typeof source.armor === 'number') {
                totalStats.armor += source.armor;
            }

            if (typeof source.posture === 'number') {
                totalStats.posture += source.posture;
            }
            }
        }

            for (const [equipmentSlot, runeSlots] of Object.entries(equippedRunes)) {
            for (const [slotNumber, rune] of Object.entries(runeSlots)) {
                if (rune) {
                    if (rune.stats) {
                        for (const [stat, value] of Object.entries(rune.stats)) {
                            const statInfo = statlist.find(s => s.stat === stat);
                            if (stat === 'armor') {
                            totalStats.armor += value;
                        } else if (statInfo.percentual) {
                            totalStats.percent[stat] = (totalStats.percent[stat] || 0) + value;
                        } else {
                            totalStats.flat[stat] = (totalStats.flat[stat] || 0) + value;
                        }
                        }
                    }
                }
            }
        }

        // Sword Master (Warrior-Subklasse, ab Lv. 30): "Bulwarks Might" gibt
        // Bonus-Strength je 40 Gesamt-Armor. Laut Discord-Info: 1 Strength
        // pro 40 Armor, abgerundet.
        if (getClassLevel('Warrior') >= 30 && getSubclassSelection('Warrior') === 'Sword Master') {
            totalStats.flat['strength'] = (totalStats.flat['strength'] || 0) + Math.floor(totalStats.armor / 40);
        }

        return totalStats;
        }

    function formatStatValue(value, isPercent) {
    if (isPercent) {
        return `${(value * 100).toFixed(1)}%`;
    }
    return Number.isInteger(value) ? value.toString() : value.toFixed(1);
    }

    function getStatInfo(statKey) {
        return statlist.find(s => s.stat === statKey);
    }

    function updateTotalStatsDisplay() {
        const totalStats = calculateTotalStats();
        const statsDisplay = document.querySelector('.stats-display');
        
         statsDisplay.innerHTML = `
            <div class="stats-column" id="column1"></div>
            <div class="stats-column" id="column2"></div>
        `;
        
        const column1 = document.getElementById('column1');
        const column2 = document.getElementById('column2');
        
        const column1Sections = ['Main', 'Critical', 'Attack', 'Mobility'];
        const column2Sections = ['Resistance', 'Duration', 'Resource', 'Miscellaneous'];
        
        const sections = {
            'Main': [],
            'Critical': [],
            'Attack': [],
            'Resistance': [],
            'Mobility': [],
            'Duration': [],
            'Resource': [],
            'Miscellaneous': []
        };

        for (const [stat, value] of Object.entries(totalStats.flat)) {
            if (value !== 0) {
            const statInfo = getStatInfo(stat);
            if (statInfo) {
                const category = statInfo.category || 'Miscellaneous';
                sections[category].push({
                    statInfo,
                    value,
                    isPercent: false
                });
            }
            }
        }
        
        for (const [stat, value] of Object.entries(totalStats.percent)) {
            if (value !== 0) {
            const statInfo = getStatInfo(stat);
            if (statInfo) {
                const category = statInfo.category || 'Miscellaneous';
                sections[category].push({
                    statInfo,
                    value,
                    isPercent: true
                });
            }
            }
        }

        for (const [type, value] of Object.entries(totalStats.damage)) {
            sections['Attack'].push({
            statInfo: {
                name: `${type.charAt(0).toUpperCase() + type.slice(1)} Damage`,
                stat: `damage-${type}`
            },
            value,
            isPercent: false
        });
        }

        if (totalStats.armor !== 0) {
            sections['Main'].push({
            statInfo: {
                name: 'Armor',
                stat: 'armor'
            },
            value: totalStats.armor,
            isPercent: false
        });
        }

        if (totalStats.posture !== 0) {
            sections['Main'].push({
            statInfo: {
                name: 'Posture',
                stat: 'posture'
            },
            value: totalStats.posture,
            isPercent: false
        });
        }

         column1Sections.forEach(sectionName => {
            const stats = sections[sectionName];
            if (stats.length > 0) {
                addStatsSection(column1, sectionName, stats);
            }
        });

        column2Sections.forEach(sectionName => {
            const stats = sections[sectionName];
            if (stats.length > 0) {
                addStatsSection(column2, sectionName, stats);
            }
        });
    }

    function addStatsSection(column, sectionName, stats) {
    const sectionDivider = document.createElement('div');
    sectionDivider.className = 'stat-section';
    sectionDivider.textContent = sectionName;
    column.appendChild(sectionDivider);
    
    stats.forEach(({statInfo, value, isPercent}) => {
        const statElement = document.createElement('div');
        statElement.className = 'stat-item stat-update';
        statElement.innerHTML = `
            <span class="stat-name">${statInfo.name}</span>
            <span class="stat-value ${value < 0 ? 'negative' : ''}">${value >= 0 ? '+' : ''}${formatStatValue(value, isPercent)}</span>
        `;
        column.appendChild(statElement);
        
        setTimeout(() => {
            statElement.classList.remove('stat-update');
        }, 300);
    });
}

function initializeRuneFilters(menu, slotType, contentArea) {
    const statFilter = menu.querySelector('#stat-filter');
    const typeFilter = menu.querySelector('#type-filter');
    
    while (statFilter.options.length > 1) statFilter.remove(1);
    while (typeFilter.options.length > 1) typeFilter.remove(1);
    
    const statSet = new Set();
    const typeSet = new Set();
    const equipmentSlot = currentOpenMenu?.equipmentSlot;
    // Siehe updateRuneMenu: eine per Dual Wielding equippte zweite Waffe im
    // Offhand-Slot soll dieselben Rune-Typen anbieten wie Weapon 1/2.
    const runeSlotType = (equipmentSlot === 'offhand' && isOffhandWeapon(equippedItems.offhand))
        ? 'weapon'
        : equipmentSlot;

    for (const runeId in runesDatabase) {
        const rune = runesDatabase[runeId];

        const normalizedRuneType = normalizarSlot(rune.type);
        const normalizedEquipmentSlot = normalizarSlot(runeSlotType);
        
        if (normalizedRuneType === 'null' || normalizedRuneType === normalizedEquipmentSlot) {
            if (rune.stats) {
                Object.keys(rune.stats).forEach(stat => statSet.add(stat));
            }
            
            if (normalizedRuneType !== 'null' || normalizedRuneType === normalizedEquipmentSlot) {
                typeSet.add(normalizedRuneType === 'null' ? 'null' : normalizedRuneType);
            }
        }
    }
    
    statlist.forEach(stat => {
        if (statSet.has(stat.stat)) {
            const option = document.createElement('option');
            option.value = stat.stat;
            option.textContent = stat.name;
            statFilter.appendChild(option);
        }
    });
    
    const allTypes = Array.from(typeSet).sort();
    if (allTypes.length > 0) {
        allTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type === 'null' ? null : type;
            option.textContent = type === 'null' ? 'null' : 
                               type.charAt(0).toUpperCase() + type.slice(1);
            typeFilter.appendChild(option);
        });
    }
    
    const searchInput = menu.querySelector('#item-search');
    const sortFilter = menu.querySelector('#sort-filter');
    const resetButton = menu.querySelector('#reset-filters');
    
    const updateMenu = () => updateRuneMenu(menu, slotType, contentArea);
    
    searchInput.addEventListener('input', updateMenu);
    statFilter.addEventListener('change', updateMenu);
    typeFilter.addEventListener('change', updateMenu);
    sortFilter.addEventListener('change', updateMenu);
    resetButton.addEventListener('click', () => {
        searchInput.value = '';
        statFilter.value = '';
        typeFilter.value = '';
        sortFilter.value = 'name-asc';
        Object.assign(filterStateFor(slotType), { search: '', stat: '', type: '', sort: 'name-asc' });
        updateMenu();
    });

    updateMenu();
}

    function initializeFilters(menu, slotType) {
        const contentArea = menu.querySelector('.item-menu-content');
        const statFilter = menu.querySelector('#stat-filter');
        const typeFilter = menu.querySelector('#type-filter');
        
        while (statFilter.options.length > 1) statFilter.remove(1);
        while (typeFilter.options.length > 1) typeFilter.remove(1);
        
        const statSet = new Set();
        const typeSet = new Set();
        
        for (const [, item] of menuItemEntries(slotType)) {
        if (item.stats) {
            Object.keys(item.stats).forEach(stat => statSet.add(stat));
        }
        
        if (typeof item.armor === 'number') {
            statSet.add('armor');
        }
        
        if (typeof item.posture === 'number') {
            statSet.add('posture');
        }
        
        if (item.damage) {
            Object.keys(item.damage).forEach(type => {
                statSet.add(`damage-${type}`);
            });
        }
        
        if (item.type) {
            typeSet.add(item.type);
        }
    }
    
    statlist.forEach(stat => {
        if (statSet.has(stat.stat)) {
            const option = document.createElement('option');
            option.value = stat.stat;
            option.textContent = stat.name;
            statFilter.appendChild(option);
        }
    });
    
    if (statSet.has('posture')) {
        const option = document.createElement('option');
        option.value = 'posture';
        option.textContent = 'Posture';
        statFilter.appendChild(option);
    }
    
    Array.from(statSet)
        .filter(stat => stat.startsWith('damage-'))
        .forEach(stat => {
            const damageType = stat.replace('damage-', '');
            const option = document.createElement('option');
            option.value = stat;
            option.textContent = `${damageType.charAt(0).toUpperCase() + damageType.slice(1)} Damage`;
            statFilter.appendChild(option);
        });
        
        Array.from(typeSet).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            typeFilter.appendChild(option);
        });
        
        const searchInput = menu.querySelector('#item-search');
        const sortFilter = menu.querySelector('#sort-filter');
        const resetButton = menu.querySelector('#reset-filters');
        
        const updateMenu = () => updateItemMenu(menu, slotType, contentArea);
        
        searchInput.addEventListener('input', updateMenu);
        statFilter.addEventListener('change', updateMenu);
        typeFilter.addEventListener('change', updateMenu);
        sortFilter.addEventListener('change', updateMenu);
        resetButton.addEventListener('click', () => {
            searchInput.value = '';
            statFilter.value = '';
            typeFilter.value = '';
            sortFilter.value = 'name-asc';
            Object.assign(filterStateFor(slotType), { search: '', stat: '', type: '', sort: 'name-asc' });
            updateMenu();
        });
        
        updateMenu();
    }

    function updateItemMenu(menu, slotType, contentArea) {
    const searchTerm = menu.querySelector('#item-search').value.toLowerCase();
    const selectedStat = menu.querySelector('#stat-filter').value;
    const selectedType = menu.querySelector('#type-filter').value;
    const sortOption = menu.querySelector('#sort-filter').value;
    
    contentArea.innerHTML = '';
    
    const equippedRingNames = [];
    for (let i = 1; i <= 4; i++) {
        const ring = equippedItems[`ring${i}`];
        if (ring && ring.name) {
            equippedRingNames.push(ring.name.toLowerCase());
        }
    }

    const items = menuItemEntries(slotType)
        .map(([key, item]) => ({ key, item }))
        .filter(({ item }) => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm);
            
            let statMatch = true;
            if (selectedStat) {
                if (selectedStat === 'armor') {
                    statMatch = typeof item.armor === 'number';
                } else if (selectedStat === 'posture') {
                    statMatch = typeof item.posture === 'number';
                } else if (selectedStat.startsWith('damage-')) {
                    const damageType = selectedStat.replace('damage-', '');
                    statMatch = item.damage && typeof item.damage[damageType] === 'number';
                } else {
                    statMatch = item.stats && item.stats[selectedStat] !== undefined;
                }
            }
            
            let typeMatch = true;
            if (selectedType) {
                typeMatch = item.type === selectedType;
            }

            let duplicateRing = false;
            if (slotType === 'ring') {
                duplicateRing = equippedRingNames.includes(item.name.toLowerCase());
            }

            let shieldBlocked = false;
            if (slotType === 'offhand' && isShield(item)) {
                shieldBlocked = !shieldAllowed();
            }

            return nameMatch && statMatch && typeMatch && !duplicateRing && !shieldBlocked;
        })
        .sort((a, b) => {
            const itemA = a.item;
            const itemB = b.item;

            const sumStats = (item) => {
                let total = 0;
                if (item.stats) {
                    total += Object.values(item.stats).reduce((sum, val) => sum + val, 0);
                }
                if (typeof item.armor === 'number') {
                    total += item.armor;
                }
                if (typeof item.posture === 'number') {
                    total += item.posture;
                }
                if (item.damage) {
                    total += Object.values(item.damage).reduce((sum, val) => sum + val, 0);
                }
                return total;
            };
            
            switch (sortOption) {
                case 'name-asc':
                    return itemA.name.localeCompare(itemB.name);
                case 'name-desc':
                    return itemB.name.localeCompare(itemA.name);
                case 'rarity-asc':
                    return (rarityOrder[itemA.rarity || 'common'] || 0) - 
                           (rarityOrder[itemB.rarity || 'common'] || 0);
                case 'rarity-desc':
                    return (rarityOrder[itemB.rarity || 'common'] || 0) - 
                           (rarityOrder[itemA.rarity || 'common'] || 0);
                case 'stat-asc': {
                    if (!selectedStat) {
                        const sumA = sumStats(itemA);
                        const sumB = sumStats(itemB);
                        return sumA - sumB;
                    }
                    
                    let statA = itemA.stats?.[selectedStat] || 0;
                    let statB = itemB.stats?.[selectedStat] || 0;
                    
                    if (selectedStat === 'armor') {
                        statA = itemA.armor || 0;
                        statB = itemB.armor || 0;
                    } else if (selectedStat === 'posture') {
                        statA = itemA.posture || 0;
                        statB = itemB.posture || 0;
                    } else if (selectedStat.startsWith('damage-')) {
                        const damageType = selectedStat.replace('damage-', '');
                        statA = itemA.damage?.[damageType] || 0;
                        statB = itemB.damage?.[damageType] || 0;
                    }
                    
                    return statA - statB;
                }
                case 'stat-desc': {
                    if (!selectedStat) {
                        const sumA = sumStats(itemA);
                        const sumB = sumStats(itemB);
                        return sumB - sumA;
                    }
                    
                    let statA = itemA.stats?.[selectedStat] || 0;
                    let statB = itemB.stats?.[selectedStat] || 0;
                    
                    if (selectedStat === 'armor') {
                        statA = itemA.armor || 0;
                        statB = itemB.armor || 0;
                    } else if (selectedStat === 'posture') {
                        statA = itemA.posture || 0;
                        statB = itemB.posture || 0;
                    } else if (selectedStat.startsWith('damage-')) {
                        const damageType = selectedStat.replace('damage-', '');
                        statA = itemA.damage?.[damageType] || 0;
                        statB = itemB.damage?.[damageType] || 0;
                    }
                    return statB - statA;
                }
                default:
                    return 0;
            }
        });
    
    items.forEach(({ key, item }) => {
        const nome = item.name || key;
        const botao = document.createElement('button');
        botao.textContent = `${nome}`;
        botao.setAttribute('data-rarity', item.rarity || 'common');
        botao.setAttribute('data-item-key', key);
        botao.setAttribute('data-slot-type', slotType);
        markUnobtainable(botao, item);
        
        botao.onclick = () => {
            const slot = currentOpenMenu.slot;
            slot.className = 'slot filled';
            slot.setAttribute('data-rarity', item.rarity || 'common');
            markUnobtainable(slot, item);
            slot.innerHTML = `
                <div class="slot-content">${nome}</div>
                <div class="remove-item"></div>
            `;
            
            const slotKey = slot.dataset.slot === 'ring' ? 
                `ring${slot.dataset.ringNumber}` : 
                slot.dataset.slot;
            equippedItems[slotKey] = item;
            
            tooltipSystem.hideTooltip();
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
            if (slotKey === 'race') updateRaceEvolutionRow();
            updateSlotPanel(slotKey);
            updateCharacter();
            updateTotalStatsDisplay();
            if (slotKey === 'race') updateAbilitiesDisplay();

            const removeBtn = slot.querySelector('.remove-item');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                emptySlot(slot, slotKey);
            });

            if (slotKey === 'weapon1' || slotKey === 'weapon2') {
                enforceShieldRule();
            }
            // Weapon 1 bestimmt, welche Gattung im Offhand dual-wieldbar ist
            if (slotKey === 'weapon1') {
                enforceDualWieldRule();
            }
        };

        contentArea.appendChild(botao);
    });
    
    if (items.length === 0) {
        const noItemsMsg = document.createElement('div');
        noItemsMsg.className = 'no-items-message';
        noItemsMsg.textContent = 'No items match your filters';
        contentArea.appendChild(noItemsMsg);
    }
}

    slots.forEach(slot => {
    // Siehe Runen-Slots: Rechtsklick bleibt der Weg zum Tauschen, weil der
    // Linksklick bei gefuelltem Slot auf das Loeschen-Overlay geht.
    slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        slot.click();
    });
    slot.addEventListener('click', () => {
        const slotType = slot.dataset.slot;
        const slotChave = normalizarSlot(slotType);

        if (currentOpenMenu && currentOpenMenu.slot === slot) {
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
            return;
        }

        if (currentOpenMenu) {
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
        }

        const banco = window.itemsDatabase?.[slotChave];
        if (!banco || Object.keys(banco).length === 0) {
            alert("No item available for this slot.");
            return;
        }

        const menu = document.createElement('div');
        menu.className = 'item-menu';
        menu.dataset.slotType = slotChave;

        const headerContainer = document.createElement('div');
        headerContainer.className = 'menu-header-container';

        const menuHeader = document.createElement('div');
        menuHeader.className = 'item-menu-header';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'item-search';
        searchInput.className = 'filter-input item-menu-search';
        searchInput.placeholder = 'Search items...';
        
        const resetButton = document.createElement('button');
        resetButton.id = 'reset-filters';
        resetButton.className = 'menu-reset-button';
        resetButton.innerHTML = 'Reset';
        resetButton.title = 'Reset filters';
        
        menuHeader.appendChild(searchInput);
        menuHeader.appendChild(resetButton);
        
        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'item-menu-filters';
        
        const statFilter = document.createElement('select');
        statFilter.id = 'stat-filter';
        statFilter.className = 'filter-select';
        
        const typeFilter = document.createElement('select');
        typeFilter.id = 'type-filter';
        typeFilter.className = 'filter-select';
        
        const sortFilter = document.createElement('select');
        sortFilter.id = 'sort-filter';
        sortFilter.className = 'filter-select';
        
        const sortOptions = [
            {value: 'name-asc', text: 'A-Z'},
            {value: 'name-desc', text: 'Z-A'},
            {value: 'rarity-asc', text: 'Rarity ↑'},
            {value: 'rarity-desc', text: 'Rarity ↓'},
            {value: 'stat-asc', text: 'Stat ↑'},
            {value: 'stat-desc', text: 'Stat ↓'}
        ];
        
        sortOptions.forEach(option => {
            const optElement = document.createElement('option');
            optElement.value = option.value;
            optElement.textContent = option.text;
            sortFilter.appendChild(optElement);
        });
        
        const addDefaultOption = (select, text) => {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = text;
            select.appendChild(option);
        };
        
        addDefaultOption(statFilter, 'All Stats');
        addDefaultOption(typeFilter, 'All Types');
        
        filtersContainer.appendChild(statFilter);
        filtersContainer.appendChild(typeFilter);
        filtersContainer.appendChild(sortFilter);
        
        headerContainer.appendChild(menuHeader);
        headerContainer.appendChild(filtersContainer);
        
        const menuContent = document.createElement('div');
        menuContent.className = 'item-menu-content';
        
        menu.appendChild(headerContainer);
        menu.appendChild(menuContent);
        
        document.body.appendChild(menu);
        
        currentOpenMenu = {
            menu: menu,
            slot: slot
        };
        
        setTimeout(() => {
            restoreFilters(menu, slotChave);
        }, 0);
        
        currentOpenMenu = {
            menu: menu,
            slot: slot
        };

        initializeFilters(menu, slotChave);
    });
});

    function saveCurrentFilterState() {
    if (!currentOpenMenu) return;

    const menu = currentOpenMenu.menu;
    // Das Evolutions-Popover hat keine Filterleiste
    if (!menu.querySelector('#item-search')) return;

    const state = filterStateFor(menu.dataset.slotType);
    state.search = menu.querySelector('#item-search').value;
    state.stat = menu.querySelector('#stat-filter').value;
    state.type = menu.querySelector('#type-filter').value;
    state.sort = menu.querySelector('#sort-filter').value;
}

function restoreFilters(menu, slotType) {
    const searchInput = menu.querySelector('#item-search');
    const statFilter = menu.querySelector('#stat-filter');
    const typeFilter = menu.querySelector('#type-filter');
    const sortFilter = menu.querySelector('#sort-filter');
    const state = filterStateFor(slotType);

    searchInput.value = state.search;
    sortFilter.value = state.sort;

    if (state.stat) {
        const statExists = Array.from(statFilter.options).some(
            opt => opt.value === state.stat
        );
        if (statExists) {
            statFilter.value = state.stat;
        } else {
            statFilter.value = '';
            state.stat = '';
        }
    }

    if (state.type) {
        const typeExists = Array.from(typeFilter.options).some(
            opt => opt.value === state.type
        );
        if (typeExists) {
            typeFilter.value = state.type;
        } else {
            typeFilter.value = '';
            state.type = '';
        }
    }
    
    const contentArea = menu.querySelector('.item-menu-content');
    if (slotType === 'rune') {
        updateRuneMenu(menu, slotType, contentArea);
    } else if (slotType === 'ability') {
        updateAbilityMenu(menu, contentArea);
    } else {
        updateItemMenu(menu, slotType, contentArea);
    }
}

    function emptySlot(slot, slotKey) {
        slot.className = 'slot';
        slot.removeAttribute('data-rarity');
    slot.removeAttribute('data-unobtainable');
        slot.innerHTML = slot.dataset.slot.charAt(0).toUpperCase() + slot.dataset.slot.slice(1);
        equippedItems[slotKey] = null;
        clearRunesOfSlot(slotKey);
        updateSlotPanel(slotKey);
        updateCharacter();
        if (slotKey === 'race') updateRaceEvolutionRow();
        updateTotalStatsDisplay();
        if (slotKey === 'race') updateAbilitiesDisplay();
        if (slotKey === 'weapon1') enforceDualWieldRule();
        tooltipSystem.hideTooltip();
        if (currentOpenMenu) {
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
        }
    }


function createItemTooltipContent(item) {
        const tooltipContent = document.createElement('div');

        const header = document.createElement('div');
        header.className = 'tooltip-header';
        
        const nameElement = document.createElement('div');
        nameElement.className = `tooltip-name ${item.rarity || 'common'}`;
        nameElement.textContent = item.name || 'Unnamed Item';
        
        const headerRight = document.createElement('div');
        headerRight.className = 'tooltip-header-right';
        
        const rarityElement = document.createElement('div');
        rarityElement.className = `tooltip-rarity ${item.rarity || 'common'}`;
        rarityElement.textContent = item.rarity || 'common';

        if (typeof item.level === 'number') {
            const levelElement = document.createElement('div');
            levelElement.className = 'tooltip-level';
            levelElement.textContent = `Lv. ${item.level}`;
            headerRight.appendChild(levelElement);
        }
        
        header.appendChild(nameElement);
        header.appendChild(headerRight);
        tooltipContent.appendChild(header);
        
        if (item.type && item.type !== 'null') {
            const typeElement = document.createElement('div');
            typeElement.className = 'tooltip-type';
            typeElement.textContent = `${item.type.charAt(0).toUpperCase() + item.type.slice(1)}`;
            tooltipContent.appendChild(typeElement);
        }

        if (typeof item.armor === 'number') {
            const armorElement = document.createElement('div');
            armorElement.className = 'tooltip-stat';
            
            const armorName = document.createElement('div');
            armorName.className = 'tooltip-stat-name';
            armorName.textContent = 'Armor';
            
            const armorValue = document.createElement('div');
            armorValue.className = `tooltip-stat-value ${item.armor >= 0 ? 'positive' : 'negative'}`;
            armorValue.textContent = `${item.armor}`;
            
            armorElement.appendChild(armorName);
            armorElement.appendChild(armorValue);
            tooltipContent.appendChild(armorElement);
        }

        if (typeof item.posture === 'number') {
            const postureElement = document.createElement('div');
            postureElement.className = 'tooltip-stat';
            
            const postureName = document.createElement('div');
            postureName.className = 'tooltip-stat-name';
            postureName.textContent = 'Posture';
            
            const postureValue = document.createElement('div');
            postureValue.className = `tooltip-stat-value ${item.posture >= 0 ? 'positive' : 'negative'}`;
            postureValue.textContent = `${item.posture}`;
            
            postureElement.appendChild(postureName);
            postureElement.appendChild(postureValue);
            tooltipContent.appendChild(postureElement);
        }

        if (item.damage && Object.keys(item.damage).length > 0) {
            for (const [damageType, value] of Object.entries(item.damage)) {
                const damageElement = document.createElement('div');
                damageElement.className = 'tooltip-stat';
                
                const damageName = document.createElement('div');
                damageName.className = 'tooltip-stat-name';
                damageName.textContent = `${damageType.charAt(0).toUpperCase() + damageType.slice(1)} Damage`;
                
                const damageValue = document.createElement('div');
                damageValue.className = `tooltip-stat-value ${value >= 0 ? 'positive' : 'negative'}`;
                damageValue.textContent = `${value}`;
                
                damageElement.appendChild(damageName);
                damageElement.appendChild(damageValue);
                tooltipContent.appendChild(damageElement);
            }
        }

        if (item.stats && Object.keys(item.stats).length > 0) {
            const statsContainer = document.createElement('div');
            statsContainer.className = 'tooltip-stats';
            
            for (const [stat, value] of Object.entries(item.stats)) {
                const statInfo = getStatInfo(stat);
                if (statInfo) {
                    const statElement = document.createElement('div');
                    statElement.className = 'tooltip-stat';
                    
                    const statName = document.createElement('div');
                    statName.className = 'tooltip-stat-name';
                    statName.textContent = statInfo.name;
                    
                    const statValue = document.createElement('div');
                    statValue.className = `tooltip-stat-value ${value >= 0 ? 'positive' : 'negative'}`;
                    statValue.textContent = `${formatStatValue(value, statInfo.percentual)}`;
                    
                    statElement.appendChild(statName);
                    statElement.appendChild(statValue);
                    statsContainer.appendChild(statElement);
                }
            }
            
            tooltipContent.appendChild(statsContainer);
        }
        
        if (item.description) {
            const descElement = document.createElement('div');
            descElement.className = 'tooltip-description';
            descElement.textContent = item.description;
            tooltipContent.appendChild(descElement);
        }

        // Rune-Effekttexte (z.B. "When it's raining, ...") separat je Rune,
        // damit klar bleibt welcher Effekt von welcher Rune kommt. Ein
        // gemeinsamer Wrapper traegt die Trennlinie nur einmal, egal ob das
        // Item selbst schon eine eigene description hatte.
        if (item.runeDescriptions && item.runeDescriptions.length) {
            const runeDescWrapper = document.createElement('div');
            runeDescWrapper.className = 'tooltip-description tooltip-rune-descriptions';
            item.runeDescriptions.forEach(({ name, description }) => {
                const runeDescElement = document.createElement('div');
                runeDescElement.className = 'tooltip-rune-description';
                const runeNameEl = document.createElement('span');
                runeNameEl.className = 'tooltip-rune-description-name';
                runeNameEl.textContent = `${name}: `;
                runeDescElement.appendChild(runeNameEl);
                runeDescElement.appendChild(document.createTextNode(description));
                runeDescWrapper.appendChild(runeDescElement);
            });
            tooltipContent.appendChild(runeDescWrapper);
        }

        return tooltipContent;
    }

const tooltipSystem = {
  currentTooltip: null,
  
  showTooltip: function(content, element) {
    this.hideTooltip();
    
    this.currentTooltip = document.createElement('div');
    this.currentTooltip.className = 'tooltip';
    this.currentTooltip.appendChild(content);
    document.body.appendChild(this.currentTooltip);
    
    this.positionTooltip(element);
    this.currentTooltip.classList.add('visible');
  },
  
  positionTooltip: function(element) {
    const rect = element.getBoundingClientRect();
    const tooltip = this.currentTooltip;
    const margin = 10;

    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    const tipW = tooltip.offsetWidth;
    const tipH = tooltip.offsetHeight;
    tooltip.style.visibility = '';
    tooltip.style.display = '';

    const maxLeft = window.innerWidth - tipW - margin;
    let left = rect.right + margin;              // bevorzugt rechts neben Slot+Flyout
    let top = rect.top + window.scrollY;

    if (left > maxLeft) {
        const leftSide = rect.left - tipW - margin;
        if (leftSide >= margin) {
            left = leftSide;                     // sonst links daneben
        } else {
            // Weder rechts noch links Platz: darunter legen
            left = Math.max(margin, Math.min(rect.left, maxLeft));
            top = rect.bottom + window.scrollY + margin;
        }
    }

    const maxTop = window.scrollY + window.innerHeight - tipH - margin;
    if (top > maxTop) top = maxTop;
    if (top < window.scrollY + margin) top = window.scrollY + margin;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
},
  
  hideTooltip: function() {
    if (this.currentTooltip) {
      document.body.removeChild(this.currentTooltip);
      this.currentTooltip = null;
    }
  }
};

    // Ausruestungsslots brauchen keinen Hover-Tooltip mehr — die Item-Infos
    // stehen im .slot-panel, zusammen mit den Rune-Slots. Ein Tooltip wuerde
    // das Panel nur verdecken.

document.addEventListener('mouseover', (e) => {
  const button = e.target.closest('.item-menu button');
  if (button) {
    const itemKey = button.getAttribute('data-item-key');
    const runeKey = button.getAttribute('data-rune-key');
    const slotType = button.closest('.item-menu').dataset.slotType;
    
    let item;
    if (itemKey && slotType !== 'rune') {
      item = window.itemsDatabase?.[slotType]?.[itemKey];
    } else if (runeKey && slotType === 'rune') {
      item = window.runesDatabase?.[runeKey];
    }
    
    if (item) {
      const tooltipContent = createItemTooltipContent(item);
      tooltipSystem.showTooltip(tooltipContent, button);
    }
  }
}, true);

// mouseout feuert auch beim Wechsel auf ein KIND des Hover-Ziels. Ohne
// .ability-card in der Liste verschwand der Tooltip, sobald der Zeiger von der
// Kachelflaeche auf den Namen in ihrer Mitte kam.
document.addEventListener('mouseout', (e) => {
  if (!e.relatedTarget || !e.relatedTarget.closest('.item-menu button, .slot, .ability-card')) {
    tooltipSystem.hideTooltip();
  }
}, true);

function copyBuildToClipboard() {
    const buildData = gatherBuildData();
    const compressed = compressBuildData(buildData);
    
    navigator.clipboard.writeText(compressed)
        .then(() => {
            showNotification('Build copied to clipboard!');
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
            showNotification('Failed to copy to clipboard', true);
        });
}

function pasteBuildFromClipboard() {
    navigator.clipboard.readText()
        .then(text => {
            // Try to detect if it's compressed or old format
            let buildData;
            if (text.startsWith('{') && text.endsWith('}')) {
                // Old uncompressed format
                try {
                    buildData = JSON.parse(text);
                    showNotification('Legacy build imported (not compressed)');
                } catch (error) {
                    console.error('Error parsing JSON: ', error);
                    showNotification('Invalid build data in clipboard', true);
                    return;
                }
            } else {
                // New compressed format
                buildData = decompressBuildData(text);
                if (!buildData) {
                    showNotification('Invalid compressed build data', true);
                    return;
                }
                showNotification('Build pasted from clipboard!');
            }
            
            loadBuildData(buildData);
        })
        .catch(err => {
            console.error('Failed to read clipboard: ', err);
            showNotification('Failed to read clipboard', true);
        });
}

function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    void notification.offsetWidth;
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function compressBuildData(buildData) {
    const jsonString = JSON.stringify(buildData);
    const compressed = LZString.compressToBase64(jsonString);
    return compressed;
}

function decompressBuildData(compressedString) {
    try {
        const jsonString = LZString.decompressFromBase64(compressedString);
        if (!jsonString) throw new Error("Invalid compressed data");
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Decompression error:", error);
        return null;
    }
}

function gatherBuildData() {
    const itemsData = {};
    for (const [slot, item] of Object.entries(equippedItems)) {
        if (item) {
            itemsData[slot] = {
                name: item.name,
                runeslots: item.runeslots || 0
            };
        } else {
            itemsData[slot] = null;
        }
    }

    const runesData = {};
    const validSlotNumbers = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    
    for (const [equipmentSlot, runeSlots] of Object.entries(equippedRunes)) {
        runesData[equipmentSlot] = {};
        
        // Get max slots from equipped item or default to 0
        const maxSlots = equippedItems[equipmentSlot]?.runeslots || 0;
        
        // Only process valid slot numbers up to the max slots
        for (let i = 0; i < Math.min(maxSlots, validSlotNumbers.length); i++) {
            const slotNumber = validSlotNumbers[i];
            const rune = runeSlots[slotNumber];
            
            if (rune) {
                runesData[equipmentSlot][slotNumber] = {
                    name: rune.name
                };
            } else {
                runesData[equipmentSlot][slotNumber] = null;
            }
        }
    }

    const classLevels = {};
    const classInputs = document.querySelectorAll('.class-level-input');
    classInputs.forEach(input => {
        const className = input.dataset.className;
        const level = parseInt(input.value) || 0;
        classLevels[className] = level;
    });

    const professionBonus = document.getElementById('level60-professions').checked;

    const subclasses = {};
    document.querySelectorAll('.subclass-select').forEach(select => {
        if (select.value && getClassLevel(select.dataset.className) >= 30) {
            subclasses[select.dataset.className] = select.value;
        }
    });

    const buildData = {
        items: itemsData,
        runes: runesData,
        classes: classLevels,
        // Bestimmt, aus welcher Klasse die Passives kommen — ohne das sind
        // "10 Thief + 40 Striker" und "40 Striker + 10 Thief" nicht
        // unterscheidbar, obwohl sie andere Passives haben.
        startingClass: getStartingClass(),
        subclasses: subclasses,
        abilities: equippedAbilities.map(a => a.name),
        evolutions: { ...chosenEvolutions },
        raceEvolution: getRaceEvolution()?.name || '',
        professionBonus: professionBonus,
        timestamp: new Date().toISOString()
    };

    return buildData;
}
    async function exportBuild() {
        try {
            const buildData = gatherBuildData();
            
            // Deep clean the rune data (your existing cleaning code)
            const cleanedRunes = {};
            const validSlotNumbers = ['I', 'II', 'III', 'IV', 'V', 'VI'];
            
            for (const [equipmentSlot, runeSlots] of Object.entries(buildData.runes)) {
                cleanedRunes[equipmentSlot] = {};
                const maxSlots = buildData.items[equipmentSlot]?.runeslots || 0;
                
                for (let i = 0; i < Math.min(maxSlots, validSlotNumbers.length); i++) {
                    const slotNumber = validSlotNumbers[i];
                    if (runeSlots[slotNumber]) {
                        cleanedRunes[equipmentSlot][slotNumber] = runeSlots[slotNumber];
                    }
                }
            }
            
            const cleanedBuildData = {
                ...buildData,
                runes: cleanedRunes
            };
            
            const jsonString = JSON.stringify(cleanedBuildData, (key, value) => {
                if (typeof key === 'string' && key.includes('\n')) {
                    return undefined;
                }
                return value;
            }, 2);
            
            // Default filename (same as your current one)
            const date = new Date();
            const dateString = date.toISOString().slice(0, 10);
            const timeString = date.toTimeString().slice(0, 8).replace(/:/g, '-');
            const defaultFilename = `rune-slayer-build-${dateString}_${timeString}.json`;
            
            // Try using the File System Access API
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: defaultFilename,
                        types: [{
                            description: 'JSON Files',
                            accept: {
                                'application/json': ['.json'],
                            },
                        }],
                    });
                    
                    const writable = await handle.createWritable();
                    await writable.write(jsonString);
                    await writable.close();
                    
                    showNotification('Build exported successfully!');
                    return;
                } catch (err) {
                    // User canceled the save dialog
                    if (err.name !== 'AbortError') {
                        console.error('Error using File System Access API:', err);
                        // Fall through to legacy method
                    } else {
                        return; // User cancelled, do nothing
                    }
                }
            }
            
            // Fallback for browsers that don't support File System Access API
            const blob = new Blob([jsonString], { type: 'application/json' });
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = URL.createObjectURL(blob);
            a.download = defaultFilename;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            }, 100);
            
            showNotification('Build exported successfully!');
        } catch (error) {
            console.error('Error exporting build:', error);
            showNotification('Error exporting build!', 'error');
        }
    }
    function importBuild() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const buildData = JSON.parse(event.target.result);
                    loadBuildData(buildData);
                } catch (error) {
                    alert('Error parsing build file: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    function loadBuildData(buildData) {
        try {
            // Bestehende Runen leeren (die Schleife stand hier zweimal identisch)
            for (const equipmentSlot in equippedRunes) {
                for (const slotNumber in equippedRunes[equipmentSlot]) {
                    equippedRunes[equipmentSlot][slotNumber] = null;
                    const runeSlot = runeSlotElement(equipmentSlot, slotNumber);
                    if (runeSlot) {
                        runeSlot.className = 'rune-slot';
                        runeSlot.textContent = slotNumber;
                        runeSlot.removeAttribute('data-rarity');
                        runeSlot.removeAttribute('data-rune-key');
                        runeSlot.removeAttribute('data-unobtainable');
                    }
                }
            }

            // Abilities vor den Items setzen: Dual Wielding entscheidet mit,
            // ob im Offhand eine Waffe stecken darf.
            equippedAbilities.length = 0;
            (buildData.abilities || []).forEach(name => {
                const ability = Object.values(abilitiesDatabase).find(a => a.name === name);
                if (ability) equippedAbilities.push(ability);
            });

            Object.keys(chosenEvolutions).forEach(key => delete chosenEvolutions[key]);
            Object.assign(chosenEvolutions, migrateLegacyEvolutions(buildData.evolutions));
            // Wirft raus, was zur Vorgaenger-Wahl im Build nicht (mehr) passt
            pruneEvolutionChoices();

            // Aus einem Alt-Build abgeleitete Evolution, falls die Rasse dort
            // noch als eigenstaendiger Eintrag gespeichert war.
            let legacyRaceEvolution = '';

            if (buildData.items) {
            for (const [slot, itemData] of Object.entries(buildData.items)) {
                if (itemData) {
                    let item = null;
                    let itemKey = null;

                    const slotType = slot.startsWith('ring') ? 'ring' :
                                     slot === 'weapon1' || slot === 'weapon2' ? 'weapon' :
                                     slot;

                    if (itemsDatabase[slotType]) {
                        for (const [key, dbItem] of Object.entries(itemsDatabase[slotType])) {
                            if (dbItem.name === itemData.name) {
                                item = dbItem;
                                itemKey = key;
                                break;
                            }
                        }
                    }

                    // Dual Wielding erlaubt eine Waffe im Offhand — die steht
                    // nicht in itemsDatabase.offhand.
                    if (!item && slot === 'offhand') {
                        for (const [key, dbItem] of Object.entries(itemsDatabase.weapon)) {
                            if (dbItem.name === itemData.name) {
                                item = dbItem;
                                itemKey = key;
                                break;
                            }
                        }
                    }

                    if (!item && slotType === 'race') {
                        const match = findRaceByEvolutionName(itemData.name);
                        if (match) {
                            item = match.race;
                            itemKey = match.key;
                            legacyRaceEvolution = match.evolution.name;
                        }
                    }

                    if (item) {
                        equippedItems[slot] = item;
                        
                        const slotElement = document.querySelector(`.slot[data-slot="${slot}"]`) || 
                                           document.querySelector(`.slot[data-slot="ring"][data-ring-number="${slot.replace('ring', '')}"]`);
                        
                        if (slotElement) {
                            slotElement.className = 'slot filled';
                            slotElement.setAttribute('data-rarity', item.rarity || 'common');
                            markUnobtainable(slotElement, item);
                            slotElement.innerHTML = `
                                <div class="slot-content">${item.name}</div>
                                <div class="remove-item"></div>
                            `;
                            
                            const removeBtn = slotElement.querySelector('.remove-item');
                            removeBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                emptySlot(slotElement, slot);
                            });
                        }
                    }
                }
            }
        }
             
            if (buildData.runes) {
                for (const [equipmentSlot, runeSlots] of Object.entries(buildData.runes)) {
                    for (const [slotNumber, runeData] of Object.entries(runeSlots)) {
                        if (!runeData || !runeData.name) continue;
                        const runeKey = findRuneKeyByName(runeData.name);
                        if (!runeKey) continue;
                        const rune = runesDatabase[runeKey];
                        const runeSlot = runeSlotElement(equipmentSlot, slotNumber);
                        if (!runeSlot) continue;

                        runeSlot.className = 'rune-slot filled';
                        runeSlot.setAttribute('data-rarity', rune.rarity || 'common');
                        runeSlot.setAttribute('data-rune-key', runeKey);
                        markUnobtainable(runeSlot, rune);

                        runeSlot.innerHTML = '';

                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'slot-content';
                        contentDiv.textContent = runeSlotLabel(rune);
                        runeSlot.appendChild(contentDiv);

                        const removeDiv = document.createElement('div');
                        removeDiv.className = 'remove-rune';
                        runeSlot.appendChild(removeDiv);

                        equippedRunes[equipmentSlot][slotNumber] = rune;

                        // haengt Tooltip- und Remove-Handler an
                        addRuneSlotHoverEvents(runeSlot);
                    }
                }
            }

            if (buildData.classes) {
            let totalImportedLevels = 0;
            
            const classInputs = document.querySelectorAll('.class-level-input');
            classInputs.forEach(input => {
                const className = input.dataset.className;
                if (buildData.classes[className]) {
                    const level = parseInt(buildData.classes[className]) || 0;
                    input.value = level;
                    totalImportedLevels += level;
                } else {
                    input.value = 0;
                }
            });

            const totalLevelsDisplay = document.getElementById('total-levels');
            totalLevelsDisplay.textContent = totalImportedLevels;
        }

            if (buildData.professionBonus !== undefined) {
                document.getElementById('level60-professions').checked = buildData.professionBonus;
            }

            // Aeltere Builds kennen das Feld nicht — dann bleibt es leer und
            // jede Klasse zeigt wie bisher ihre eigenen Passives.
            setStartingClass(buildData.startingClass || '');

            updateSubclassRows();
            document.querySelectorAll('.subclass-select').forEach(select => {
                const chosen = buildData.subclasses?.[select.dataset.className] || '';
                select.value = Array.from(select.options).some(o => o.value === chosen) ? chosen : '';
            });

            updateRaceEvolutionRow();
            setRaceEvolution(buildData.raceEvolution || legacyRaceEvolution || '');
            updateAllSlotPanels();
            updateCharacter();

            enforceShieldRule();
            enforceDualWieldRule();
            updateTotalStatsDisplay();
            updateAbilitiesDisplay();
        } catch (error) {
            console.error('Error loading build:', error);
            alert('Error loading build: ' + error.message);
        }
    }

    function findRuneKeyByName(name) {
        for (const key in runesDatabase) {
            if (runesDatabase[key].name === name) {
                return key;
            }
        }
        return null;
    }


    document.getElementById('copy-build-btn').addEventListener('click', copyBuildToClipboard);
    
    document.getElementById('paste-build-btn').addEventListener('click', pasteBuildFromClipboard);

    document.getElementById('import-build-btn').addEventListener('click', importBuild);

    document.getElementById('export-build-btn').addEventListener('click', exportBuild);

    document.getElementById('level60-professions').addEventListener('change', updateTotalStatsDisplay);

    document.addEventListener('click', (e) => {
        if (currentOpenMenu &&
            !e.target.closest('.item-menu') &&
            !e.target.closest('.slot') &&
            !e.target.closest('.ability-add-btn') &&
            !e.target.closest('.ability-evolve-btn') &&
            !e.target.closest('.rune-slot')) {
            
            saveCurrentFilterState();
            document.body.removeChild(currentOpenMenu.menu);
            currentOpenMenu = null;
        }
    });

    // Nach bfcache-Restore (Zurück-Button/F5) Formularwerte neu einlesen
    window.addEventListener('pageshow', () => {
        if (document.getElementById('class-list').children.length) {
            updateSubclassRows();
            updateRaceEvolutionRow();
            updateTotalStatsDisplay();
            updateAbilitiesDisplay();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        initializeClassSystem();

        const addAbilityBtn = document.getElementById('add-ability-btn');
        addAbilityBtn?.addEventListener('click', () => openAbilityMenu(addAbilityBtn));

        const abilitySearch = document.getElementById('ability-search');
        if (abilitySearch) {
            abilitySearch.addEventListener('input', updateAbilitiesDisplay);
            // Escape leert die Suche, statt nur den Fokus zu verlieren
            abilitySearch.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape' || !abilitySearch.value) return;
                e.stopPropagation();
                abilitySearch.value = '';
                updateAbilitiesDisplay();
            });
        }

        const evolutionSelect = document.getElementById('race-evolution-select');
        if (evolutionSelect) {
            const onRaceEvolutionChange = () => {
                updateSlotPanel('race');
                // Flügel-/Hornzahl der Silhouette hängt an der Evolution
                updateCharacter();
                updateTotalStatsDisplay();
                updateAbilitiesDisplay();
            };
            evolutionSelect.addEventListener('change', onRaceEvolutionChange);
            evolutionSelect.addEventListener('input', onRaceEvolutionChange);
        }
        updateRaceEvolutionRow();
        updateAllSlotPanels();
        updateCharacter();
        updateTotalStatsDisplay();
        updateAbilitiesDisplay();
        document.querySelectorAll('.rune-slot.filled').forEach(slot => {
            addRuneSlotHoverEvents(slot);
        });

        initCommunityHub({ gatherBuildData, loadBuildData, showNotification });
        loadBuildFromUrl();
    });

    // Deep-Link-Support fuer den "View Build"-Button in Discord-Benachrichtigungen:
    // ?build=<uuid> laedt den Build automatisch und raeumt die URL danach auf.
    function loadBuildFromUrl() {
        const buildId = new URLSearchParams(location.search).get('build');
        if (!buildId) return;

        fetchBuildById(buildId)
            .then(row => {
                if (!row) {
                    showNotification('Build not found — it may have been deleted', true);
                    return;
                }
                loadBuildData(row.build_data);
                showNotification(`Loaded "${row.name}" from Discord`);
            })
            .catch(err => {
                console.error(err);
                showNotification('Failed to load build from link', true);
            })
            .finally(() => {
                history.replaceState(null, '', location.pathname);
            });
    }
