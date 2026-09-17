// Community Hub: Builds ohne Account auf Supabase hochladen und durchstoebern.
import { renderCharacter, RARITY_COLORS } from './character.js';
import { buildGear, classBreakdown, dominantClass, isBuildEmpty } from './buildGear.js';
import { buildInfoModel, raceLabel, MAX_TOTAL_LEVEL } from './buildInfo.js';

const SUPABASE_URL = 'https://nzvkfczphpvkvfsquzmy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmtmY3pwaHB2a3Zmc3F1em15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzgxODYsImV4cCI6MjEwMjkxNDE4Nn0.FkS0H0BCUElZprYQwJwGRzG8IUXjOQPClpA0c_SF6fY';
const TABLE_URL = `${SUPABASE_URL}/rest/v1/community_builds`;
const UPLOAD_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/upload-community-build`;
const MANAGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-community-build`;
// Heisst aus historischen Gruenden noch "like", nimmt aber beide Richtungen.
const VOTE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/toggle-community-build-like`;
const ADMIN_CODE_STORAGE_KEY = 'rsCommunityAdminCode';
const VOTES_STORAGE_KEY = 'rsCommunityBuildVotes';
// Vor den Dislikes: nur ein Array gelikter IDs. Wird beim ersten Laden in
// VOTES_STORAGE_KEY uebernommen, damit gesetzte Daumen nicht verschwinden.
const LEGACY_LIKED_STORAGE_KEY = 'rsCommunityLikedBuilds';

// Site-Key ist bewusst oeffentlich (Cloudflare Turnstile ist so designt) —
// die eigentliche Pruefung passiert serverseitig in der Edge Function.
const TURNSTILE_SITE_KEY = '0x4AAAAAAEdxNMmr2l5UazeC';

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_TAGS = 3;

// Build-Key: optional beim Upload, danach der einzige Weg, das eigene Build
// ohne Account noch zu aendern oder zu loeschen. Der Key wird nie gespeichert
// (weder hier noch in localStorage) — geprueft wird serverseitig gegen einen
// bcrypt-Hash, den nur der Service-Role-Key erreicht.
const MIN_KEY_LENGTH = 8;

// Feste Auswahl statt Freitext: so bleiben die Kacheln lesbar, der Tag-Filter
// im Hub hat ein endliches Vokabular und es gibt nichts zu moderieren.
// Muss mit ALLOWED_TAGS in supabase/functions/upload-community-build
// uebereinstimmen — der Server verwirft alles, was er nicht kennt.
const AVAILABLE_TAGS = [
    'PvP', 'PvE', 'Crit', 'Minmaxxed', 'Tank', 'Meta', 'Off-Meta'
];

/* Icons als Inline-SVG statt als Emoji: die Serifenschrift der Seite hat
   fuer ✏ und 🗑 kein Glyph und ersetzt sie durch unleserliche Balken, und
   Farb-Emoji ignorieren die CSS-Farbe — der aktive Daumen soll aber gruen
   bzw. rot leuchten. `currentColor` macht beides. Feste Strings, kein
   Nutzerinput. */
const ICON_PENCIL = `
<svg class="community-icon" viewBox="0 0 16 16" aria-hidden="true">
  <path d="M10.9 1.7 14.3 5.1 5.4 14 1.5 14.5 2.1 10.6 Z" fill="none"
        stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M9.3 3.3 12.7 6.7" fill="none" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

const ICON_TRASH = `
<svg class="community-icon" viewBox="0 0 16 16" aria-hidden="true">
  <path d="M2.6 4.3h10.8M6.2 2.3h3.6M4.2 4.3l.7 9.4h6.2l.7-9.4" fill="none"
        stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
        stroke-linejoin="round"/>
  <path d="M6.6 6.6v4.6M9.4 6.6v4.6" fill="none" stroke="currentColor"
        stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

// Daumen runter ist derselbe Pfad, um 180° gedreht — wie bei den gaengigen
// Icon-Sets sitzt die Manschette dann oben rechts.
const THUMB_PATHS = `
  <path d="M1.8 7.2h2.6v6.9H1.8z" fill="none" stroke="currentColor"
        stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M4.4 7.4 7.1 2.1c1 0 1.8.9 1.6 1.9L8.3 6.4h4.4c1 0 1.7.9 1.5 1.9l-1 4.4c-.2.9-1 1.4-1.8 1.4H4.4"
        fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`;

const ICON_THUMB_UP = `
<svg class="community-icon" viewBox="0 0 16 16" aria-hidden="true">${THUMB_PATHS}</svg>`;

const ICON_THUMB_DOWN = `
<svg class="community-icon" viewBox="0 0 16 16" aria-hidden="true">
  <g transform="rotate(180 8 8)">${THUMB_PATHS}</g>
</svg>`;

function supabaseHeaders(extra = {}) {
    return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        ...extra
    };
}

async function fetchCommunityBuilds(sortBy = 'likes') {
    const order = sortBy === 'likes' ? 'likes_count.desc,created_at.desc' : 'created_at.desc';
    // has_key ist nur ein Flag — die Hashes selbst liegen in
    // community_build_keys, wo anon keinerlei Zugriff hat.
    const columns = 'id,name,description,tags,has_key,created_at,build_data,likes_count,dislikes_count';
    const res = await fetch(`${TABLE_URL}?select=${columns}&order=${order}&limit=100`, {
        headers: supabaseHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load builds (${res.status})`);
    return res.json();
}

// Fuer Deep-Links (z.B. "View Build" Button in der Discord-Benachrichtigung):
// laedt genau einen Build anhand seiner id.
export async function fetchBuildById(id) {
    const res = await fetch(`${TABLE_URL}?select=name,build_data&id=eq.${encodeURIComponent(id)}`, {
        headers: supabaseHeaders()
    });
    if (!res.ok) throw new Error(`Failed to load build (${res.status})`);
    const rows = await res.json();
    return rows[0] || null;
}

// Laeuft ueber die Edge Function statt eines direkten REST-Inserts: die
// hasht die IP serverseitig, rate-limitet neue Stimmen pro IP und haelt so
// die Zaehler-Trigger vor direkten anon-Schreibzugriffen sicher.
// Gleiche Richtung nochmal = zuruecknehmen, andere Richtung = umschwenken;
// die Antwort enthaelt den neuen Stand (`vote` ist 'like', 'dislike' oder null).
async function voteCommunityBuild(buildId, vote) {
    const res = await fetch(VOTE_FUNCTION_URL, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ build_id: buildId, vote })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Vote failed (${res.status})`);
    return data;
}

// Serverseitig haengt eine Stimme am IP-Hash (mehrfaches Abstimmen vom
// selben Anschluss aendert nichts); lokal merken wir uns nur, welcher Daumen
// nach einem Reload wieder aktiv dargestellt werden soll.
function getMyVotes() {
    let votes = {};
    try {
        votes = JSON.parse(localStorage.getItem(VOTES_STORAGE_KEY) || '{}') || {};
    } catch {
        votes = {};
    }
    // Einmalige Uebernahme der alten Herz-Likes, danach ist der Schluessel weg.
    try {
        const legacy = localStorage.getItem(LEGACY_LIKED_STORAGE_KEY);
        if (legacy) {
            JSON.parse(legacy).forEach(id => { if (!votes[id]) votes[id] = 'like'; });
            localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
            localStorage.removeItem(LEGACY_LIKED_STORAGE_KEY);
        }
    } catch {
        // Kaputter Altbestand — dann eben ohne Uebernahme.
    }
    return votes;
}

function saveMyVotes(votes) {
    try {
        localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
    } catch {
        // Privater Modus o.ae.: die Stimme zaehlt serverseitig trotzdem.
    }
}

// Laeuft ueber die Edge Function statt eines direkten REST-Inserts: die
// prueft den Turnstile-Token bei Cloudflare, hat ein Rate-Limit pro IP und
// schreibt erst danach mit dem Service-Role-Key (RLS erlaubt anon keine
// direkten Inserts mehr — Bots, die die REST-API direkt anfragen, laufen ins Leere).
async function uploadCommunityBuild({ name, description, tags, buildKey, buildData, turnstileToken }) {
    const res = await fetch(UPLOAD_FUNCTION_URL, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            name,
            description,
            tags,
            buildKey,
            build_data: buildData,
            turnstileToken
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
    }
    return data;
}

// Verifizieren, Aendern und Loeschen per Build-Key. Laeuft bewusst ueber die
// Edge Function und nicht als RPC: verify_build_key ist fuer anon gesperrt,
// sonst haette man ein oeffentliches Orakel zum Durchprobieren von Keys.
// Die Function begrenzt zusaetzlich die Fehlversuche pro IP.
async function manageCommunityBuild(action, buildId, key, extra = {}) {
    const res = await fetch(MANAGE_FUNCTION_URL, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action, build_id: buildId, key, ...extra })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

function waitForTurnstile(retries = 50) {
    return new Promise((resolve, reject) => {
        const check = (n) => {
            if (window.turnstile) return resolve(window.turnstile);
            if (n <= 0) return reject(new Error('Turnstile script not loaded'));
            setTimeout(() => check(n - 1), 100);
        };
        check(retries);
    });
}

// Admin-Code wird nur an eine Postgres-Function geschickt und dort geprueft
// (siehe verify_admin_code/delete_community_build) — der Client kennt den
// echten Code nie, er kann nur "richtig"/"falsch" pruefen lassen.
async function verifyAdminCode(code) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_admin_code`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ access_code: code })
    });
    if (!res.ok) return false;
    return res.json();
}

async function deleteCommunityBuildRemote(id, code) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_community_build`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ build_id: id, access_code: code })
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Delete failed (${res.status}) ${text}`);
    }
    return res.json();
}

function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function rarityColor(entity) {
    return RARITY_COLORS[entity?.rarity] || RARITY_COLORS.common;
}

function chip(label, className) {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = label;
    return el;
}

function tagRow(tags) {
    if (!tags?.length) return null;
    const row = document.createElement('div');
    row.className = 'community-tag-row';
    tags.forEach(tag => row.appendChild(chip(tag, 'community-tag')));
    return row;
}

/* ------------------------------ Build-Kachel ------------------------------
   Dieselbe Kachel rendert das Hub-Grid und die Live-Vorschau im Publish-
   Menue. `preview: true` laesst Load/Delete weg und macht die Daumen
   inert. Die Beschreibung steht bewusst NICHT auf der Kachel, sondern
   ausschliesslich hinter dem Info-Button. */
function buildCard(build, { isAdmin = false, myVote = null, preview = false } = {}) {
    const { buildData } = build;
    const gear = buildGear(buildData);

    const card = document.createElement('div');
    card.className = 'community-card' + (preview ? ' community-card-is-preview' : '');

    const portrait = document.createElement('div');
    portrait.className = 'community-card-preview';
    renderCharacter(portrait, gear);
    card.appendChild(portrait);

    const name = document.createElement('div');
    name.className = 'community-card-name';
    name.textContent = build.name;
    card.appendChild(name);

    const tags = tagRow(build.tags);
    if (tags) card.appendChild(tags);

    if (gear.race) {
        const race = document.createElement('div');
        race.className = 'community-card-race';
        race.style.color = rarityColor(gear.race);
        race.textContent = raceLabel(gear, buildData);
        card.appendChild(race);
    }

    const classesEl = document.createElement('div');
    classesEl.className = 'community-card-classes';
    classesEl.textContent = classBreakdown(buildData) || 'No class levels set';
    card.appendChild(classesEl);

    // Die zuerst gewaehlte Klasse liefert die Passives — ohne sie sehen
    // "10 Thief + 40 Striker" und "40 Striker + 10 Thief" identisch aus.
    if (buildData.startingClass) {
        const starter = document.createElement('div');
        starter.className = 'community-card-starter';
        starter.textContent = `Started as ${buildData.startingClass}`;
        card.appendChild(starter);
    }

    const footer = document.createElement('div');
    footer.className = 'community-card-footer';
    const date = document.createElement('span');
    date.className = 'community-card-date';
    date.textContent = preview ? 'Not uploaded yet' : formatDate(build.created_at);
    footer.appendChild(date);

    const meta = document.createElement('div');
    meta.className = 'community-card-meta';

    // Der Stift erscheint nur, wenn beim Upload ein Build-Key gesetzt wurde.
    // Sichtbar ist er fuer alle — nutzen kann ihn nur, wer den Key kennt.
    // Er steht ganz links: die Buttons sind rechtsbuendig gepackt, so bleiben
    // ℹ und die Daumen in Kacheln mit und ohne Key an derselben Stelle.
    let editBtn = null;
    if (build.hasKey && !preview) {
        editBtn = document.createElement('button');
        editBtn.className = 'community-card-edit-btn';
        editBtn.title = 'Edit or delete with the build key';
        editBtn.setAttribute('aria-label', 'Edit or delete with the build key');
        editBtn.innerHTML = ICON_PENCIL;
        meta.appendChild(editBtn);
    }

    const infoBtn = document.createElement('button');
    infoBtn.className = 'community-card-info-btn';
    infoBtn.title = 'Build details';
    infoBtn.setAttribute('aria-label', 'Build details');
    infoBtn.textContent = 'ℹ';
    meta.appendChild(infoBtn);

    const votes = voteButtons({
        likes: build.likesCount ?? 0,
        dislikes: build.dislikesCount ?? 0,
        myVote,
        inert: preview
    });
    meta.appendChild(votes.el);

    footer.appendChild(meta);

    let deleteBtn = null;
    let loadBtn = null;
    if (!preview) {
        const actions = document.createElement('div');
        actions.className = 'community-card-actions';

        if (isAdmin) {
            deleteBtn = document.createElement('button');
            deleteBtn.className = 'community-card-delete-btn';
            deleteBtn.textContent = 'Delete';
            actions.appendChild(deleteBtn);
        }

        loadBtn = document.createElement('button');
        loadBtn.className = 'community-card-load-btn';
        loadBtn.textContent = 'Load';
        actions.appendChild(loadBtn);

        footer.appendChild(actions);
    }

    card.appendChild(footer);

    return { card, loadBtn, deleteBtn, votes, infoBtn, editBtn };
}

/* Daumen hoch/runter als zusammengehoeriges Paar. `update()` setzt Zaehler
   und aktiven Zustand auf einmal, damit ein Umschwenken (hoch -> runter)
   nie einen Zwischenstand mit zwei aktiven Daumen zeigt. */
function voteButtons({ likes, dislikes, myVote, inert }) {
    const el = document.createElement('div');
    el.className = 'community-card-votes';

    function make(direction, icon) {
        const btn = document.createElement('button');
        btn.className = `community-card-vote-btn community-card-vote-${direction}`;
        btn.innerHTML = icon;
        btn.disabled = inert;
        const count = document.createElement('span');
        count.className = 'community-card-vote-count';
        btn.appendChild(count);
        el.appendChild(btn);
        return { btn, count };
    }

    const up = make('up', ICON_THUMB_UP);
    const down = make('down', ICON_THUMB_DOWN);

    function update(vote, likeCount, dislikeCount) {
        up.count.textContent = likeCount;
        down.count.textContent = dislikeCount;
        up.btn.classList.toggle('active', vote === 'like');
        down.btn.classList.toggle('active', vote === 'dislike');
        up.btn.title = inert ? 'Likes' : (vote === 'like' ? 'Remove like' : 'Like');
        down.btn.title = inert ? 'Dislikes' : (vote === 'dislike' ? 'Remove dislike' : 'Dislike');
        up.btn.setAttribute('aria-pressed', String(vote === 'like'));
        down.btn.setAttribute('aria-pressed', String(vote === 'dislike'));
    }

    function setBusy(busy) {
        if (inert) return;
        up.btn.disabled = busy;
        down.btn.disabled = busy;
    }

    update(myVote, likes, dislikes);
    return { el, likeBtn: up.btn, dislikeBtn: down.btn, update, setBusy };
}

/* ------------------------------- Info-Panel -------------------------------
   Alles, was nicht auf die Kachel passt: die Beschreibung plus die Details,
   aus denen der Build tatsaechlich besteht (Rasse, Klassen, Ausruestung
   inkl. Runen, Abilities). Liegt als eigenes Overlay ueber dem Hub. */

function infoSection(title) {
    const section = document.createElement('div');
    section.className = 'community-info-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    section.appendChild(heading);
    return section;
}

function infoRow(label, value) {
    const row = document.createElement('div');
    row.className = 'community-info-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'community-info-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'community-info-value';
    if (typeof value === 'string') valueEl.textContent = value;
    else valueEl.appendChild(value);
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
}

function emptyNote(text) {
    const note = document.createElement('div');
    note.className = 'community-info-empty';
    note.textContent = text;
    return note;
}

function equipmentSection(model) {
    const section = infoSection('Equipment');
    if (!model.equipment.length) {
        section.appendChild(emptyNote('Nothing equipped.'));
        return section;
    }

    const list = document.createElement('div');
    list.className = 'community-info-gear';

    model.equipment.forEach(item => {
        const row = document.createElement('div');
        row.className = 'community-info-gear-row';

        const slotLabel = document.createElement('span');
        slotLabel.className = 'community-info-label';
        slotLabel.textContent = item.slot;
        row.appendChild(slotLabel);

        const body = document.createElement('div');
        body.className = 'community-info-gear-body';

        const itemName = document.createElement('span');
        itemName.className = 'community-info-item';
        itemName.style.color = rarityColor(item);
        itemName.textContent = item.name;
        body.appendChild(itemName);

        if (item.runes.length) {
            const runeList = document.createElement('span');
            runeList.className = 'community-info-runes';
            runeList.textContent = item.runes.join(' · ');
            body.appendChild(runeList);
        }

        row.appendChild(body);
        list.appendChild(row);
    });

    section.appendChild(list);
    return section;
}

function classSection(model) {
    const section = infoSection('Class Levels');
    if (!model.classes.length) {
        section.appendChild(emptyNote('No class levels set.'));
        return section;
    }

    const list = document.createElement('div');
    list.className = 'community-info-classes';

    model.classes.forEach(({ name, level, subclass }) => {
        const row = document.createElement('div');
        row.className = 'community-info-class-row';
        const nameEl = document.createElement('span');
        nameEl.className = 'community-info-class-name';
        nameEl.textContent = name;
        const levelEl = document.createElement('span');
        levelEl.className = 'community-info-class-level';
        // Subclass gibt es erst ab Klassenlevel 30, siehe gatherBuildData()
        levelEl.textContent = subclass ? `Lv ${level} — ${subclass}` : `Lv ${level}`;
        row.appendChild(nameEl);
        row.appendChild(levelEl);
        list.appendChild(row);
    });

    section.appendChild(list);
    section.appendChild(infoRow('Total', `${model.totalLevels}/${MAX_TOTAL_LEVEL} levels`));
    return section;
}

// Gibt null zurueck, wenn es nichts zu zeigen gibt — der Aufrufer haengt die
// Sektion dann gar nicht erst ein. `entries` sind { label, rarity? }.
function chipSection(title, entries) {
    if (!entries.length) return null;
    const section = infoSection(title);
    const wrap = document.createElement('div');
    wrap.className = 'community-tag-row';
    entries.forEach(({ label, rarity }) => {
        const el = chip(label, 'community-info-chip');
        if (rarity) {
            const color = rarityColor({ rarity });
            el.style.color = color;
            el.style.borderColor = color;
        }
        wrap.appendChild(el);
    });
    section.appendChild(wrap);
    return section;
}

// "👍 12 · 👎 3" mit denselben SVG-Daumen wie auf der Kachel.
function voteTally(likes, dislikes) {
    const tally = document.createElement('span');
    tally.className = 'community-info-votes';
    [[ICON_THUMB_UP, likes], [ICON_THUMB_DOWN, dislikes]].forEach(([icon, count]) => {
        const part = document.createElement('span');
        part.className = 'community-info-vote';
        part.innerHTML = icon;
        part.appendChild(document.createTextNode(String(count)));
        tally.appendChild(part);
    });
    return tally;
}

/* Rendert das gemeinsame Modell aus buildInfo.js. Discord rendert dasselbe
   Modell als Embed — neue Infos gehoeren deshalb dort hinein, nicht hierher. */
function buildInfoContent(build) {
    const model = buildInfoModel(build);
    const content = document.createElement('div');
    content.className = 'community-info-content';

    const heading = document.createElement('h2');
    heading.textContent = model.name;
    content.appendChild(heading);

    const tags = tagRow(model.tags);
    if (tags) content.appendChild(tags);

    const about = infoSection('Description');
    if (model.description) {
        const text = document.createElement('p');
        text.className = 'community-info-description';
        text.textContent = model.description;
        about.appendChild(text);
    } else {
        about.appendChild(emptyNote('No description provided.'));
    }
    content.appendChild(about);

    const overview = infoSection('Character');
    let raceValue = 'None';
    if (model.race) {
        raceValue = document.createElement('span');
        raceValue.style.color = rarityColor(model.race);
        raceValue.textContent = model.race.label;
    }
    overview.appendChild(infoRow('Race', raceValue));
    overview.appendChild(infoRow('First class picked', model.startingClass || 'Not set'));
    overview.appendChild(infoRow('Classes', model.classBreakdown || 'No class levels set'));
    overview.appendChild(infoRow(
        'Level 60 professions',
        model.professionBonus ? 'Included' : 'Not included'
    ));
    content.appendChild(overview);

    content.appendChild(classSection(model));
    content.appendChild(equipmentSection(model));

    const abilitySection = chipSection(
        'Equipped Abilities',
        model.abilities.map(a => ({ label: a.name, rarity: a.rarity }))
    );
    if (abilitySection) content.appendChild(abilitySection);

    const evolutionSection = chipSection(
        'Ability Evolutions',
        model.evolutions.map(label => ({ label }))
    );
    if (evolutionSection) content.appendChild(evolutionSection);

    const footer = document.createElement('div');
    footer.className = 'community-info-footer';
    if (model.createdAt) {
        footer.appendChild(document.createTextNode(`Uploaded ${formatDate(model.createdAt)} · `));
        footer.appendChild(voteTally(model.likes, model.dislikes));
    } else {
        footer.textContent = 'Not uploaded yet — this is a preview';
    }
    content.appendChild(footer);

    return content;
}

export function initCommunityHub({ gatherBuildData, loadBuildData, showNotification }) {
    const openBtn = document.getElementById('community-hub-btn');
    if (!openBtn) return;

    let overlay = null;
    let modal = null;
    // Oberste Ebene ueber dem Hub-Modal: Info-Panel ODER Key-Eingabe. Beide
    // teilen sich denselben Slot, damit sie sich nicht stapeln koennen und
    // Escape immer nur eine Ebene schliesst.
    let overlayTop = null;
    let adminCode = sessionStorage.getItem(ADMIN_CODE_STORAGE_KEY) || null;
    const myVotes = getMyVotes();

    // Sortierung braucht einen Refetch (order kommt vom Server), Klassen-/
    // Rassen-/Tag-Filter laufen rein clientseitig auf dem zuletzt geladenen Set.
    let sortBy = 'likes';
    let classFilter = '';
    let raceFilter = '';
    let tagFilter = '';
    let currentBuilds = [];
    let classSelectEl = null;
    let raceSelectEl = null;
    let tagSelectEl = null;

    // Entwurf des Publish-Menues. Ueberlebt einen Abstecher zurueck in die
    // Liste und wird erst nach einem erfolgreichen Upload geleert. Wird
    // mutiert, nie neu zugewiesen — der Editor haelt eine Referenz darauf.
    const draft = { name: '', description: '', key: '', tags: new Set() };

    let turnstileWidgetId = null;
    let turnstileToken = '';

    function destroyTurnstile() {
        if (turnstileWidgetId !== null && window.turnstile) {
            window.turnstile.remove(turnstileWidgetId);
        }
        turnstileWidgetId = null;
        turnstileToken = '';
    }

    function closeTopOverlay() {
        if (!overlayTop) return false;
        overlayTop.remove();
        overlayTop = null;
        return true;
    }

    function closeModal() {
        closeTopOverlay();
        destroyTurnstile();
        if (overlay) {
            overlay.remove();
            overlay = null;
            modal = null;
        }
    }

    // Gemeinsame Huelle fuer Info-Panel und Key-Eingabe.
    function openTopOverlay(extraClass = '') {
        closeTopOverlay();
        overlayTop = document.createElement('div');
        overlayTop.className = 'community-info-overlay';
        overlayTop.addEventListener('click', (e) => {
            if (e.target === overlayTop) closeTopOverlay();
        });

        const panel = document.createElement('div');
        panel.className = 'community-info-modal' + (extraClass ? ` ${extraClass}` : '');

        const closeBtn = document.createElement('button');
        closeBtn.className = 'class-info-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', closeTopOverlay);
        panel.appendChild(closeBtn);

        overlayTop.appendChild(panel);
        document.body.appendChild(overlayTop);
        return panel;
    }

    function openInfo(build) {
        openTopOverlay().appendChild(buildInfoContent(build));
    }

    /* Der Stift auf der Kachel fragt zuerst den Key ab. Geprueft wird
       serverseitig (manage-community-build), die Function begrenzt dabei die
       Fehlversuche pro IP — hier gibt es absichtlich keinen Hinweis darauf,
       ob ein Key "fast" richtig war. */
    function openKeyPrompt(row) {
        const panel = openTopOverlay('community-key-modal');

        const heading = document.createElement('h2');
        heading.textContent = 'Build Key';
        panel.appendChild(heading);

        const note = document.createElement('p');
        note.className = 'community-info-description';
        note.textContent = `Enter the key for "${row.name}" to edit or delete it.`;
        panel.appendChild(note);

        const row1 = document.createElement('div');
        row1.className = 'community-admin-row';
        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'community-name-input';
        input.placeholder = 'Build key';
        input.autocomplete = 'off';
        const submitBtn = document.createElement('button');
        submitBtn.className = 'community-upload-btn';
        submitBtn.textContent = 'Unlock';
        row1.appendChild(input);
        row1.appendChild(submitBtn);
        panel.appendChild(row1);

        const hint = document.createElement('div');
        hint.className = 'community-field-note';
        hint.textContent = 'Lost the key? Nobody can recover it — the build can only be removed by a moderator.';
        panel.appendChild(hint);

        async function submit() {
            const key = input.value.trim();
            if (key.length < MIN_KEY_LENGTH) {
                showNotification(`Build keys are at least ${MIN_KEY_LENGTH} characters`, true);
                return;
            }
            submitBtn.disabled = true;
            try {
                await manageCommunityBuild('verify', row.id, key);
                closeTopOverlay();
                showEditView(row, key);
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Wrong build key', true);
                submitBtn.disabled = false;
                input.select();
            }
        }

        submitBtn.addEventListener('click', submit);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') submit();
        });
        input.focus();
    }

    // Leert den Modal-Inhalt fuer einen Ansichtswechsel und setzt den
    // Schliess-Button neu (der gehoert zum Modal, nicht zur Ansicht).
    function resetModalShell() {
        destroyTurnstile();
        modal.innerHTML = '';
        modal.scrollTop = 0;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'class-info-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', closeModal);
        modal.appendChild(closeBtn);
    }

    function populateSelect(select, options, placeholder) {
        const current = select.value;
        select.innerHTML = '';
        const allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = placeholder;
        select.appendChild(allOpt);
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            select.appendChild(el);
        });
        select.value = options.includes(current) ? current : '';
    }

    function updateFilterOptions(builds) {
        const classes = new Set();
        const races = new Set();
        const tags = new Set();
        builds.forEach(row => {
            const cls = dominantClass(row.build_data);
            if (cls) classes.add(cls);
            const race = buildGear(row.build_data).race;
            if (race) races.add(race.name);
            (row.tags || []).forEach(tag => tags.add(tag));
        });
        populateSelect(classSelectEl, [...classes].sort(), 'All Classes');
        populateSelect(raceSelectEl, [...races].sort(), 'All Races');
        // Tags in der Reihenfolge von AVAILABLE_TAGS statt alphabetisch —
        // so stehen PvP/PvE oben, wo man sie erwartet.
        populateSelect(tagSelectEl, AVAILABLE_TAGS.filter(t => tags.has(t)), 'All Tags');
        classFilter = classSelectEl.value;
        raceFilter = raceSelectEl.value;
        tagFilter = tagSelectEl.value;
    }

    function filteredBuilds() {
        return currentBuilds.filter(row => {
            if (classFilter && dominantClass(row.build_data) !== classFilter) return false;
            if (raceFilter) {
                const race = buildGear(row.build_data).race;
                if (!race || race.name !== raceFilter) return false;
            }
            if (tagFilter && !(row.tags || []).includes(tagFilter)) return false;
            return true;
        });
    }

    function renderBuilds(grid) {
        const builds = filteredBuilds();
        grid.innerHTML = '';
        if (!builds.length) {
            grid.innerHTML = currentBuilds.length
                ? '<div class="community-list-status">No builds match this filter.</div>'
                : '<div class="community-list-status">No builds uploaded yet — be the first!</div>';
            return;
        }
        builds.forEach(row => {
            const build = {
                id: row.id,
                name: row.name,
                description: row.description,
                tags: row.tags || [],
                hasKey: Boolean(row.has_key),
                created_at: row.created_at,
                buildData: row.build_data,
                likesCount: row.likes_count,
                dislikesCount: row.dislikes_count ?? 0
            };
            const { card, loadBtn, deleteBtn, votes, infoBtn, editBtn } = buildCard(build, {
                isAdmin: Boolean(adminCode),
                myVote: myVotes[row.id] || null
            });

            infoBtn.addEventListener('click', () => {
                // Stimmen koennen sich seit dem Render geaendert haben
                build.likesCount = row.likes_count;
                build.dislikesCount = row.dislikes_count ?? 0;
                openInfo(build);
            });

            if (editBtn) {
                editBtn.addEventListener('click', () => openKeyPrompt(row));
            }

            loadBtn.addEventListener('click', () => {
                loadBuildData(row.build_data);
                showNotification(`Loaded "${row.name}"`);
                closeModal();
            });

            async function castVote(direction) {
                votes.setBusy(true);
                try {
                    const result = await voteCommunityBuild(row.id, direction);
                    row.likes_count = result.likes_count;
                    row.dislikes_count = result.dislikes_count;
                    votes.update(result.vote, result.likes_count, result.dislikes_count);
                    if (result.vote) myVotes[row.id] = result.vote;
                    else delete myVotes[row.id];
                    saveMyVotes(myVotes);
                } catch (err) {
                    console.error(err);
                    showNotification(err.message || 'Failed to update vote', true);
                } finally {
                    votes.setBusy(false);
                }
            }

            votes.likeBtn.addEventListener('click', () => castVote('like'));
            votes.dislikeBtn.addEventListener('click', () => castVote('dislike'));

            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
                    deleteBtn.disabled = true;
                    try {
                        await deleteCommunityBuildRemote(row.id, adminCode);
                        showNotification(`Deleted "${row.name}"`);
                        refreshGrid(grid);
                    } catch (err) {
                        console.error(err);
                        showNotification('Failed to delete build', true);
                        deleteBtn.disabled = false;
                    }
                });
            }

            grid.appendChild(card);
        });
    }

    async function refreshGrid(grid) {
        grid.innerHTML = '<div class="community-list-status">Loading...</div>';
        try {
            currentBuilds = await fetchCommunityBuilds(sortBy);
            updateFilterOptions(currentBuilds);
            renderBuilds(grid);
        } catch (err) {
            console.error(err);
            grid.innerHTML = '<div class="community-list-status">Failed to load community builds.</div>';
        }
    }

    /* ------------------------------ Hub-Ansicht ------------------------------ */

    function showHubView() {
        resetModalShell();

        const title = document.createElement('h2');
        title.textContent = 'Community Hub';
        modal.appendChild(title);

        // Das Build selbst entsteht im Hauptmenue — hier gibt es nur noch den
        // Einstieg ins Publish-Menue, kein Namensfeld mehr.
        const uploadRow = document.createElement('div');
        uploadRow.className = 'community-upload';
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'community-upload-btn community-upload-btn-wide';
        uploadBtn.textContent = 'Upload Current Build';
        uploadRow.appendChild(uploadBtn);
        modal.appendChild(uploadRow);

        const uploadHint = document.createElement('div');
        uploadHint.className = 'community-upload-hint';
        uploadHint.textContent = 'Name it, describe it and tag it on the next screen.';
        modal.appendChild(uploadHint);

        uploadBtn.addEventListener('click', () => {
            const buildData = gatherBuildData();
            if (isBuildEmpty(buildData)) {
                showNotification('Equip something or set class levels before uploading', true);
                return;
            }
            showPublishView(buildData);
        });

        const listHeader = document.createElement('div');
        listHeader.className = 'community-list-header';
        const listLabel = document.createElement('span');
        listLabel.textContent = 'Community Builds';
        const headerControls = document.createElement('div');
        headerControls.className = 'community-list-header-controls';
        const adminToggleBtn = document.createElement('button');
        adminToggleBtn.className = 'community-admin-toggle-btn';
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'community-refresh-btn';
        refreshBtn.title = 'Refresh';
        refreshBtn.textContent = '⟳';
        headerControls.appendChild(adminToggleBtn);
        headerControls.appendChild(refreshBtn);
        listHeader.appendChild(listLabel);
        listHeader.appendChild(headerControls);
        modal.appendChild(listHeader);

        const adminRow = document.createElement('div');
        adminRow.className = 'community-admin-row';
        adminRow.style.display = 'none';
        const adminInput = document.createElement('input');
        adminInput.type = 'password';
        adminInput.className = 'community-name-input';
        adminInput.placeholder = 'Admin access code';
        adminInput.autocomplete = 'off';
        const adminSubmitBtn = document.createElement('button');
        adminSubmitBtn.className = 'community-upload-btn';
        adminSubmitBtn.textContent = 'Unlock';
        adminRow.appendChild(adminInput);
        adminRow.appendChild(adminSubmitBtn);
        modal.appendChild(adminRow);

        const filterRow = document.createElement('div');
        filterRow.className = 'community-filter-row';

        const sortSelect = document.createElement('select');
        sortSelect.className = 'community-filter-select';
        sortSelect.title = 'Sort';
        sortSelect.innerHTML = '<option value="likes">Most Liked</option><option value="newest">Newest</option>';
        sortSelect.value = sortBy;

        classSelectEl = document.createElement('select');
        classSelectEl.className = 'community-filter-select';
        classSelectEl.title = 'Filter by class';

        raceSelectEl = document.createElement('select');
        raceSelectEl.className = 'community-filter-select';
        raceSelectEl.title = 'Filter by race';

        tagSelectEl = document.createElement('select');
        tagSelectEl.className = 'community-filter-select';
        tagSelectEl.title = 'Filter by tag';

        filterRow.appendChild(sortSelect);
        filterRow.appendChild(classSelectEl);
        filterRow.appendChild(raceSelectEl);
        filterRow.appendChild(tagSelectEl);
        modal.appendChild(filterRow);

        const grid = document.createElement('div');
        grid.className = 'community-grid';
        modal.appendChild(grid);

        sortSelect.addEventListener('change', () => {
            sortBy = sortSelect.value;
            refreshGrid(grid);
        });
        classSelectEl.addEventListener('change', () => {
            classFilter = classSelectEl.value;
            renderBuilds(grid);
        });
        raceSelectEl.addEventListener('change', () => {
            raceFilter = raceSelectEl.value;
            renderBuilds(grid);
        });
        tagSelectEl.addEventListener('change', () => {
            tagFilter = tagSelectEl.value;
            renderBuilds(grid);
        });

        function updateAdminToggle() {
            if (adminCode) {
                adminToggleBtn.textContent = 'Admin ✓ (Log Out)';
                adminToggleBtn.classList.add('active');
            } else {
                adminToggleBtn.textContent = 'Admin';
                adminToggleBtn.classList.remove('active');
            }
        }
        updateAdminToggle();

        adminToggleBtn.addEventListener('click', () => {
            if (adminCode) {
                adminCode = null;
                sessionStorage.removeItem(ADMIN_CODE_STORAGE_KEY);
                updateAdminToggle();
                adminRow.style.display = 'none';
                showNotification('Admin mode disabled');
                refreshGrid(grid);
            } else {
                adminRow.style.display = adminRow.style.display === 'none' ? 'flex' : 'none';
                if (adminRow.style.display === 'flex') adminInput.focus();
            }
        });

        async function submitAdminCode() {
            const code = adminInput.value.trim();
            if (!code) return;
            adminSubmitBtn.disabled = true;
            try {
                const valid = await verifyAdminCode(code);
                if (valid) {
                    adminCode = code;
                    sessionStorage.setItem(ADMIN_CODE_STORAGE_KEY, code);
                    adminInput.value = '';
                    adminRow.style.display = 'none';
                    updateAdminToggle();
                    showNotification('Admin mode enabled');
                    refreshGrid(grid);
                } else {
                    showNotification('Invalid access code', true);
                }
            } catch (err) {
                console.error(err);
                showNotification('Failed to verify access code', true);
            } finally {
                adminSubmitBtn.disabled = false;
            }
        }

        adminSubmitBtn.addEventListener('click', submitAdminCode);
        adminInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') submitAdminCode();
        });
        refreshBtn.addEventListener('click', () => refreshGrid(grid));

        refreshGrid(grid);
    }

    /* ------------------------ Metadaten-Editor (geteilt) ---------------------
       Unterbau von Publish- und Edit-Ansicht: links Name/Description/Tags,
       rechts live die Kachel, wie sie im Hub aussieht. Der Aufrufer haengt
       danach seine eigenen Bedienelemente an `form` (Key-Feld und Turnstile
       beim Publish, Speichern/Loeschen beim Bearbeiten).

       `state` wird direkt mutiert, damit der Publish-Entwurf einen Abstecher
       in die Liste uebersteht. `getBuildData()` statt eines festen Werts,
       weil die Edit-Ansicht die Ausruestung unterwegs austauschen kann. */

    function buildMetaEditor({ state, getBuildData, submit }) {
        const layout = document.createElement('div');
        layout.className = 'community-publish-layout';

        const form = document.createElement('div');
        form.className = 'community-publish-form';

        function field(labelText, inputId, counterEl, parent = form) {
            const wrap = document.createElement('div');
            wrap.className = 'community-field';
            const head = document.createElement('div');
            head.className = 'community-field-head';
            const label = document.createElement('label');
            label.className = 'community-field-label';
            label.textContent = labelText;
            if (inputId) label.setAttribute('for', inputId);
            head.appendChild(label);
            if (counterEl) head.appendChild(counterEl);
            wrap.appendChild(head);
            parent.appendChild(wrap);
            return wrap;
        }

        // Eigene Zeile, damit das Key-Feld beim Publish daneben passt.
        const nameRow = document.createElement('div');
        nameRow.className = 'community-field-row';
        form.appendChild(nameRow);

        const nameCounter = document.createElement('span');
        nameCounter.className = 'community-field-counter';
        const nameWrap = field('Build Name', 'community-build-name', nameCounter, nameRow);
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'community-build-name';
        nameInput.className = 'community-name-input';
        nameInput.placeholder = 'e.g. Bleed Katana Duelist';
        nameInput.maxLength = MAX_NAME_LENGTH;
        nameInput.value = state.name;
        nameWrap.appendChild(nameInput);

        const descCounter = document.createElement('span');
        descCounter.className = 'community-field-counter';
        const descWrap = field('Description', 'community-build-description', descCounter);
        const descInput = document.createElement('textarea');
        descInput.id = 'community-build-description';
        descInput.className = 'community-description-input';
        descInput.rows = 5;
        descInput.maxLength = MAX_DESCRIPTION_LENGTH;
        descInput.placeholder = 'How it plays, what it is for, what to level first…';
        descInput.value = state.description;
        descWrap.appendChild(descInput);
        const descNote = document.createElement('div');
        descNote.className = 'community-field-note';
        descNote.textContent = 'Shown behind the ℹ button on the tile, not on the tile itself.';
        descWrap.appendChild(descNote);

        const tagCounter = document.createElement('span');
        tagCounter.className = 'community-field-counter';
        const tagWrap = field('Tags', null, tagCounter);
        const tagPicker = document.createElement('div');
        tagPicker.className = 'community-tag-picker';
        const tagButtons = AVAILABLE_TAGS.map(tag => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'community-tag-option';
            btn.textContent = tag;
            btn.addEventListener('click', () => {
                if (state.tags.has(tag)) state.tags.delete(tag);
                else state.tags.add(tag);
                syncTagButtons();
                renderPreview();
            });
            tagPicker.appendChild(btn);
            return { tag, btn };
        });
        tagWrap.appendChild(tagPicker);

        /* --- rechte Spalte: Live-Vorschau der Kachel --- */
        const previewCol = document.createElement('div');
        previewCol.className = 'community-publish-preview';
        const previewLabel = document.createElement('div');
        previewLabel.className = 'community-field-label';
        previewLabel.textContent = 'Tile Preview';
        previewCol.appendChild(previewLabel);
        const previewSlot = document.createElement('div');
        previewSlot.className = 'community-publish-preview-slot';
        previewCol.appendChild(previewSlot);
        const previewNote = document.createElement('div');
        previewNote.className = 'community-field-note';
        previewNote.textContent = 'The tile that lands in the hub — the ℹ button works here too.';
        previewCol.appendChild(previewNote);

        layout.appendChild(form);
        layout.appendChild(previewCol);

        function orderedTags() {
            return AVAILABLE_TAGS.filter(tag => state.tags.has(tag));
        }

        function renderPreview() {
            previewSlot.innerHTML = '';
            const build = {
                name: state.name.trim() || 'Unnamed Build',
                description: state.description,
                tags: orderedTags(),
                created_at: null,
                buildData: getBuildData(),
                likesCount: 0,
                dislikesCount: 0
            };
            const { card, infoBtn } = buildCard(build, { preview: true });
            infoBtn.addEventListener('click', () => openInfo(build));
            previewSlot.appendChild(card);
        }

        // Ueber MAX_TAGS hinaus wird nicht gemeckert, sondern deaktiviert —
        // eine Fehlermeldung fuer einen Klick, der nichts tun soll, waere Laerm.
        function syncTagButtons() {
            const full = state.tags.size >= MAX_TAGS;
            tagButtons.forEach(({ tag, btn }) => {
                const active = state.tags.has(tag);
                btn.classList.toggle('active', active);
                btn.disabled = !active && full;
            });
            tagCounter.textContent = `${state.tags.size}/${MAX_TAGS}`;
        }

        function syncCounters() {
            nameCounter.textContent = `${state.name.length}/${MAX_NAME_LENGTH}`;
            descCounter.textContent = `${state.description.length}/${MAX_DESCRIPTION_LENGTH}`;
        }

        nameInput.addEventListener('input', () => {
            state.name = nameInput.value;
            syncCounters();
            renderPreview();
        });
        descInput.addEventListener('input', () => {
            state.description = descInput.value;
            syncCounters();
        });
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') submit();
        });

        syncCounters();
        syncTagButtons();
        renderPreview();

        return { layout, form, nameRow, nameInput, previewNote, orderedTags, renderPreview };
    }

    /* ---------------------------- Publish-Ansicht ----------------------------
       `buildData` ist der Schnappschuss vom Klick auf "Upload Current Build" —
       Vorschau und Upload zeigen damit garantiert dasselbe Build, auch wenn
       im Hintergrund weitergebastelt wird. */

    function showPublishView(buildData) {
        resetModalShell();

        const title = document.createElement('h2');
        title.textContent = 'Publish Build';
        modal.appendChild(title);

        const backBtn = document.createElement('button');
        backBtn.className = 'community-back-btn';
        backBtn.textContent = '← Back to Hub';
        backBtn.addEventListener('click', showHubView);
        modal.appendChild(backBtn);

        const editor = buildMetaEditor({
            state: draft,
            getBuildData: () => buildData,
            submit: () => publish()
        });

        /* --- Build-Key, direkt neben dem Namen --- */
        const keyWrap = document.createElement('div');
        keyWrap.className = 'community-field community-field-key';
        const keyHead = document.createElement('div');
        keyHead.className = 'community-field-head';
        const keyLabel = document.createElement('label');
        keyLabel.className = 'community-field-label';
        keyLabel.textContent = 'Build Key';
        keyLabel.setAttribute('for', 'community-build-key');
        const keyOptional = document.createElement('span');
        keyOptional.className = 'community-field-counter';
        keyOptional.textContent = 'optional';
        keyHead.appendChild(keyLabel);
        keyHead.appendChild(keyOptional);
        keyWrap.appendChild(keyHead);
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.id = 'community-build-key';
        keyInput.className = 'community-name-input';
        keyInput.placeholder = `At least ${MIN_KEY_LENGTH} characters`;
        keyInput.autocomplete = 'off';
        keyInput.maxLength = 120;
        keyInput.value = draft.key;
        keyWrap.appendChild(keyInput);
        editor.nameRow.appendChild(keyWrap);

        const keyNote = document.createElement('div');
        keyNote.className = 'community-field-note';
        keyNote.textContent =
            'Set a key and you can edit or delete this build later — anyone who knows it can. '
            + 'Write it down: it cannot be recovered, and without it the build is permanent. '
            + 'Leave it empty and the build gets no ✏ button.';
        editor.form.insertBefore(keyNote, editor.form.children[1]);

        keyInput.addEventListener('input', () => { draft.key = keyInput.value; });

        const turnstileRow = document.createElement('div');
        turnstileRow.className = 'community-turnstile-row';
        editor.form.appendChild(turnstileRow);

        const publishBtn = document.createElement('button');
        publishBtn.className = 'community-publish-btn';
        publishBtn.textContent = 'Publish to Community Hub';
        editor.form.appendChild(publishBtn);

        modal.appendChild(editor.layout);
        editor.nameInput.focus();

        waitForTurnstile()
            .then(ts => {
                turnstileWidgetId = ts.render(turnstileRow, {
                    sitekey: TURNSTILE_SITE_KEY,
                    theme: 'dark',
                    callback: (token) => { turnstileToken = token; },
                    'expired-callback': () => { turnstileToken = ''; },
                    'error-callback': () => { turnstileToken = ''; }
                });
            })
            .catch(err => {
                console.error(err);
                showNotification('Failed to load verification widget — try reloading the page', true);
            });

        function resetTurnstile() {
            turnstileToken = '';
            if (turnstileWidgetId !== null && window.turnstile) {
                window.turnstile.reset(turnstileWidgetId);
            }
        }

        async function publish() {
            const name = draft.name.trim();
            if (!name) {
                showNotification('Please enter a build name', true);
                editor.nameInput.focus();
                return;
            }
            const buildKey = draft.key.trim();
            if (buildKey && buildKey.length < MIN_KEY_LENGTH) {
                showNotification(`Build key must be at least ${MIN_KEY_LENGTH} characters`, true);
                keyInput.focus();
                return;
            }
            if (isBuildEmpty(buildData)) {
                showNotification('Equip something or set class levels before uploading', true);
                return;
            }
            if (!turnstileToken) {
                showNotification('Please complete the verification check', true);
                return;
            }

            publishBtn.disabled = true;
            try {
                await uploadCommunityBuild({
                    name,
                    description: draft.description.trim(),
                    tags: editor.orderedTags(),
                    buildKey,
                    buildData,
                    turnstileToken
                });
                showNotification(buildKey
                    ? 'Build uploaded — keep your build key safe!'
                    : 'Build uploaded to Community Hub!');
                // Mutieren statt neu zuweisen: der Editor haelt eine Referenz.
                draft.name = '';
                draft.description = '';
                draft.key = '';
                draft.tags.clear();
                showHubView();
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Failed to upload build', true);
                publishBtn.disabled = false;
                resetTurnstile();
            }
        }

        publishBtn.addEventListener('click', publish);
        keyInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') publish();
        });
    }

    /* ------------------------------ Edit-Ansicht ------------------------------
       Erreichbar nur ueber den Stift plus richtigen Key. Der Key liegt
       ausschliesslich in dieser Closure — nicht in localStorage, nicht in der
       URL — und ist weg, sobald die Ansicht verlassen wird. */

    function showEditView(row, key) {
        resetModalShell();

        const state = {
            name: row.name || '',
            description: row.description || '',
            tags: new Set(row.tags || [])
        };

        // Ausruestung bleibt unangetastet, solange der Haken nicht gesetzt ist:
        // wer nur einen Tippfehler im Namen fixt, soll nicht sein Build
        // ueberschreiben, das gerade zufaellig im Builder steht.
        let replaceBuild = false;
        const originalBuildData = row.build_data;
        let swappedBuildData = null;

        const editor = buildMetaEditor({
            state,
            getBuildData: () => (replaceBuild && swappedBuildData) || originalBuildData,
            submit: () => save()
        });

        const title = document.createElement('h2');
        title.textContent = 'Edit Build';
        modal.appendChild(title);

        const backBtn = document.createElement('button');
        backBtn.className = 'community-back-btn';
        backBtn.textContent = '← Back to Hub';
        backBtn.addEventListener('click', showHubView);
        modal.appendChild(backBtn);

        const replaceLabel = document.createElement('label');
        replaceLabel.className = 'community-replace-row';
        const replaceBox = document.createElement('input');
        replaceBox.type = 'checkbox';
        replaceBox.className = 'professions-checkbox';
        const replaceText = document.createElement('span');
        replaceText.textContent = 'Replace gear and class levels with the build I have open right now';
        replaceLabel.appendChild(replaceBox);
        replaceLabel.appendChild(replaceText);
        editor.form.appendChild(replaceLabel);

        replaceBox.addEventListener('change', () => {
            if (replaceBox.checked) {
                const current = gatherBuildData();
                if (isBuildEmpty(current)) {
                    replaceBox.checked = false;
                    showNotification('Your current build is empty — nothing to copy over', true);
                    return;
                }
                swappedBuildData = current;
            }
            replaceBuild = replaceBox.checked;
            editor.renderPreview();
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'community-publish-btn';
        saveBtn.textContent = 'Save Changes';
        editor.form.appendChild(saveBtn);

        const deleteRow = document.createElement('div');
        deleteRow.className = 'community-danger-row';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'community-danger-btn';
        deleteBtn.innerHTML = ICON_TRASH;
        deleteBtn.appendChild(document.createTextNode('Delete Build'));
        const deleteNote = document.createElement('div');
        deleteNote.className = 'community-field-note';
        deleteNote.textContent = 'Removes the build and its votes for good. This cannot be undone.';
        deleteRow.appendChild(deleteBtn);
        deleteRow.appendChild(deleteNote);
        editor.form.appendChild(deleteRow);

        modal.appendChild(editor.layout);
        editor.nameInput.focus();

        async function save() {
            const name = state.name.trim();
            if (!name) {
                showNotification('Please enter a build name', true);
                editor.nameInput.focus();
                return;
            }

            saveBtn.disabled = true;
            try {
                await manageCommunityBuild('update', row.id, key, {
                    name,
                    description: state.description.trim(),
                    tags: editor.orderedTags(),
                    // Nur mitschicken, wenn ausdruecklich gewuenscht — sonst
                    // laesst die Function build_data unangetastet.
                    build_data: replaceBuild ? swappedBuildData : undefined
                });
                showNotification(`Saved "${name}"`);
                showHubView();
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Failed to save changes', true);
                saveBtn.disabled = false;
            }
        }

        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
            deleteBtn.disabled = true;
            saveBtn.disabled = true;
            try {
                await manageCommunityBuild('delete', row.id, key);
                showNotification(`Deleted "${row.name}"`);
                showHubView();
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Failed to delete build', true);
                deleteBtn.disabled = false;
                saveBtn.disabled = false;
            }
        });

        saveBtn.addEventListener('click', save);
    }

    function openModal() {
        closeModal();

        overlay = document.createElement('div');
        overlay.className = 'community-hub-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        modal = document.createElement('div');
        modal.className = 'community-hub-modal';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        showHubView();
    }

    openBtn.addEventListener('click', openModal);

    // Escape schliesst immer nur die oberste Ebene: erst das Info-Panel,
    // dann das Hub-Modal.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (closeTopOverlay()) return;
        closeModal();
    });
}
