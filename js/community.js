// Community Hub: Builds ohne Account auf Supabase hochladen und durchstoebern.
import { renderCharacter, RARITY_COLORS } from './character.js';
import { buildGear, classBreakdown, dominantClass, isBuildEmpty } from './buildGear.js';

const SUPABASE_URL = 'https://nzvkfczphpvkvfsquzmy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dmtmY3pwaHB2a3Zmc3F1em15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzgxODYsImV4cCI6MjEwMjkxNDE4Nn0.FkS0H0BCUElZprYQwJwGRzG8IUXjOQPClpA0c_SF6fY';
const TABLE_URL = `${SUPABASE_URL}/rest/v1/community_builds`;
const UPLOAD_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/upload-community-build`;
const LIKE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/toggle-community-build-like`;
const ADMIN_CODE_STORAGE_KEY = 'rsCommunityAdminCode';
const LIKED_BUILDS_STORAGE_KEY = 'rsCommunityLikedBuilds';

// Site-Key ist bewusst oeffentlich (Cloudflare Turnstile ist so designt) —
// die eigentliche Pruefung passiert serverseitig in der Edge Function.
const TURNSTILE_SITE_KEY = '0x4AAAAAAEdxNMmr2l5UazeC';

function supabaseHeaders(extra = {}) {
    return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        ...extra
    };
}

async function fetchCommunityBuilds(sortBy = 'likes') {
    const order = sortBy === 'likes' ? 'likes_count.desc,created_at.desc' : 'created_at.desc';
    const res = await fetch(`${TABLE_URL}?select=id,name,created_at,build_data,likes_count&order=${order}&limit=100`, {
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
// hasht die IP serverseitig, rate-limitet neue Likes pro IP und haelt so
// den likes_count-Trigger vor direkten anon-Schreibzugriffen sicher.
async function toggleCommunityBuildLike(buildId) {
    const res = await fetch(LIKE_FUNCTION_URL, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ build_id: buildId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Like failed (${res.status})`);
    return data;
}

// Serverseitig ist ein Like an den IP-Hash gebunden (mehrfaches Liken vom
// selben Anschluss aendert nichts); lokal merken wir uns die IDs nur, um
// den Herz-Button nach einem Reload wieder korrekt "aktiv" darzustellen.
function getLikedBuildIds() {
    try {
        return new Set(JSON.parse(localStorage.getItem(LIKED_BUILDS_STORAGE_KEY) || '[]'));
    } catch {
        return new Set();
    }
}

function setLikedBuildIds(ids) {
    localStorage.setItem(LIKED_BUILDS_STORAGE_KEY, JSON.stringify([...ids]));
}

// Laeuft ueber die Edge Function statt eines direkten REST-Inserts: die
// prueft den Turnstile-Token bei Cloudflare, hat ein Rate-Limit pro IP und
// schreibt erst danach mit dem Service-Role-Key (RLS erlaubt anon keine
// direkten Inserts mehr — Bots, die die REST-API direkt anfragen, laufen ins Leere).
async function uploadCommunityBuild(name, buildData, turnstileToken) {
    const res = await fetch(UPLOAD_FUNCTION_URL, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, build_data: buildData, turnstileToken })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
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

function buildCard(build, { isAdmin, isLiked }) {
    const { buildData } = build;
    const gear = buildGear(buildData);

    const card = document.createElement('div');
    card.className = 'community-card';

    const preview = document.createElement('div');
    preview.className = 'community-card-preview';
    renderCharacter(preview, gear);
    card.appendChild(preview);

    const name = document.createElement('div');
    name.className = 'community-card-name';
    name.textContent = build.name;
    card.appendChild(name);

    if (gear.race) {
        const race = document.createElement('div');
        race.className = 'community-card-race';
        race.style.color = RARITY_COLORS[gear.race.rarity] || RARITY_COLORS.common;
        race.textContent = gear.race.name + (buildData.raceEvolution ? ` (${buildData.raceEvolution})` : '');
        card.appendChild(race);
    }

    const classes = classBreakdown(buildData);
    const classesEl = document.createElement('div');
    classesEl.className = 'community-card-classes';
    classesEl.textContent = classes || 'No class levels set';
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
    date.textContent = formatDate(build.created_at);
    footer.appendChild(date);

    const likeBtn = document.createElement('button');
    likeBtn.className = 'community-card-like-btn' + (isLiked ? ' liked' : '');
    likeBtn.title = isLiked ? 'Unlike' : 'Like';
    const likeIcon = document.createElement('span');
    likeIcon.className = 'community-card-like-icon';
    likeIcon.textContent = '♥';
    const likeCount = document.createElement('span');
    likeCount.className = 'community-card-like-count';
    likeCount.textContent = build.likesCount ?? 0;
    likeBtn.appendChild(likeIcon);
    likeBtn.appendChild(likeCount);
    footer.appendChild(likeBtn);

    const actions = document.createElement('div');
    actions.className = 'community-card-actions';

    let deleteBtn = null;
    if (isAdmin) {
        deleteBtn = document.createElement('button');
        deleteBtn.className = 'community-card-delete-btn';
        deleteBtn.textContent = 'Delete';
        actions.appendChild(deleteBtn);
    }

    const loadBtn = document.createElement('button');
    loadBtn.className = 'community-card-load-btn';
    loadBtn.textContent = 'Load';
    actions.appendChild(loadBtn);

    footer.appendChild(actions);
    card.appendChild(footer);

    return { card, loadBtn, deleteBtn, likeBtn, likeCount };
}

export function initCommunityHub({ gatherBuildData, loadBuildData, showNotification }) {
    const openBtn = document.getElementById('community-hub-btn');
    if (!openBtn) return;

    let overlay = null;
    let adminCode = sessionStorage.getItem(ADMIN_CODE_STORAGE_KEY) || null;
    let likedIds = getLikedBuildIds();

    // Sortierung braucht einen Refetch (order kommt vom Server), Klassen-/
    // Rassen-Filter laufen rein clientseitig auf dem zuletzt geladenen Set.
    let sortBy = 'likes';
    let classFilter = '';
    let raceFilter = '';
    let currentBuilds = [];
    let classSelectEl = null;
    let raceSelectEl = null;

    function closeModal() {
        if (overlay) {
            document.body.removeChild(overlay);
            overlay = null;
        }
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
        builds.forEach(row => {
            const cls = dominantClass(row.build_data);
            if (cls) classes.add(cls);
            const race = buildGear(row.build_data).race;
            if (race) races.add(race.name);
        });
        populateSelect(classSelectEl, [...classes].sort(), 'All Classes');
        populateSelect(raceSelectEl, [...races].sort(), 'All Races');
        classFilter = classSelectEl.value;
        raceFilter = raceSelectEl.value;
    }

    function filteredBuilds() {
        return currentBuilds.filter(row => {
            if (classFilter && dominantClass(row.build_data) !== classFilter) return false;
            if (raceFilter) {
                const race = buildGear(row.build_data).race;
                if (!race || race.name !== raceFilter) return false;
            }
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
            const { card, loadBtn, deleteBtn, likeBtn, likeCount } = buildCard({
                id: row.id,
                name: row.name,
                created_at: row.created_at,
                buildData: row.build_data,
                likesCount: row.likes_count
            }, { isAdmin: Boolean(adminCode), isLiked: likedIds.has(row.id) });

            loadBtn.addEventListener('click', () => {
                loadBuildData(row.build_data);
                showNotification(`Loaded "${row.name}"`);
                closeModal();
            });

            likeBtn.addEventListener('click', async () => {
                likeBtn.disabled = true;
                try {
                    const result = await toggleCommunityBuildLike(row.id);
                    row.likes_count = result.likes_count;
                    likeCount.textContent = result.likes_count;
                    likeBtn.classList.toggle('liked', result.liked);
                    likeBtn.title = result.liked ? 'Unlike' : 'Like';
                    if (result.liked) likedIds.add(row.id);
                    else likedIds.delete(row.id);
                    setLikedBuildIds(likedIds);
                } catch (err) {
                    console.error(err);
                    showNotification(err.message || 'Failed to update like', true);
                } finally {
                    likeBtn.disabled = false;
                }
            });

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

    function openModal() {
        closeModal();

        overlay = document.createElement('div');
        overlay.className = 'community-hub-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        const modal = document.createElement('div');
        modal.className = 'community-hub-modal';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'class-info-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', closeModal);
        modal.appendChild(closeBtn);

        const title = document.createElement('h2');
        title.textContent = 'Community Hub';
        modal.appendChild(title);

        const uploadRow = document.createElement('div');
        uploadRow.className = 'community-upload';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'community-name-input';
        nameInput.placeholder = 'Build name';
        nameInput.maxLength = 60;
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'community-upload-btn';
        uploadBtn.textContent = 'Upload Current Build';
        uploadRow.appendChild(nameInput);
        uploadRow.appendChild(uploadBtn);
        modal.appendChild(uploadRow);

        const turnstileRow = document.createElement('div');
        turnstileRow.className = 'community-turnstile-row';
        modal.appendChild(turnstileRow);

        let turnstileToken = '';
        let turnstileWidgetId = null;
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

        filterRow.appendChild(sortSelect);
        filterRow.appendChild(classSelectEl);
        filterRow.appendChild(raceSelectEl);
        modal.appendChild(filterRow);

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

        const grid = document.createElement('div');
        grid.className = 'community-grid';
        modal.appendChild(grid);

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

        async function uploadCurrentBuild() {
            const name = nameInput.value.trim();
            if (!name) {
                showNotification('Please enter a build name', true);
                return;
            }
            if (name.length > 60) {
                showNotification('Build name must be 60 characters or fewer', true);
                return;
            }

            const buildData = gatherBuildData();
            if (isBuildEmpty(buildData)) {
                showNotification('Equip something or set class levels before uploading', true);
                return;
            }
            if (!turnstileToken) {
                showNotification('Please complete the verification check', true);
                return;
            }

            uploadBtn.disabled = true;
            try {
                await uploadCommunityBuild(name, buildData, turnstileToken);
                showNotification('Build uploaded to Community Hub!');
                nameInput.value = '';
                refreshGrid(grid);
            } catch (err) {
                console.error(err);
                showNotification(err.message || 'Failed to upload build', true);
            } finally {
                uploadBtn.disabled = false;
                resetTurnstile();
            }
        }

        uploadBtn.addEventListener('click', uploadCurrentBuild);
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') uploadCurrentBuild();
        });
        refreshBtn.addEventListener('click', () => refreshGrid(grid));

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        refreshGrid(grid);
    }

    openBtn.addEventListener('click', openModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}
