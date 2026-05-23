// --- CONFIGURACIÓN Y ESTADO ---
let party = JSON.parse(localStorage.getItem('dnd_party')) || [];
let appConfig = JSON.parse(localStorage.getItem('dnd_config')) || {
    combat: true, loot: true, survival: true, community: true
};

function saveState() {
    localStorage.setItem('dnd_party', JSON.stringify(party));
    localStorage.setItem('dnd_config', JSON.stringify(appConfig));
}

// --- RENDERING DINÁMICO ---
function renderNavigation() {
    const nav = document.getElementById('main-nav');
    nav.innerHTML = `
        <button onclick="showTab('tab-home')" id="btn-home" class="active">
            <i class="fa-solid fa-house-chimney"></i>
            <span>Inicio</span>
        </button>
        ${appConfig.combat ? `<button onclick="showTab('tab-combat')" id="btn-combat"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button>` : ''}
        ${appConfig.loot ? `<button onclick="showTab('tab-loot')" id="btn-loot"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}
        <button onclick="showTab('tab-party')" id="btn-party">
            <i class="fa-solid fa-users-rays"></i>
            <span>Gremio</span>
        </button>
    `;
    renderConfigToggles();
}

function renderConfigToggles() {
    const container = document.getElementById('config-panel');
    if(!container) return;
    
    const modules = [
        { id: 'combat', label: 'Tablero de Guerra', icon: 'fa-shield-halved' },
        { id: 'loot', label: 'Cámara de Tesoros', icon: 'fa-gem' },
        { id: 'survival', label: 'Supervivencia', icon: 'fa-campground' },
        { id: 'community', label: 'Tablón Gremial', icon: 'fa-bullhorn' }
    ];

    container.innerHTML = modules.map(m => `
        <div class="module-row">
            <div><i class="fa-solid ${m.icon}"></i> <span>${m.label}</span></div>
            <label class="switch">
                <input type="checkbox" ${appConfig[m.id] ? 'checked' : ''} onchange="toggleModule('${m.id}')">
                <span class="slider"></span>
            </label>
        </div>
    `).join('');
}

function toggleModule(m) {
    appConfig[m] = !appConfig[m];
    saveState();
    renderNavigation();
}

// --- GESTIÓN DE HÉROES ---
function addDetailedPlayer() {
    const name = document.getElementById('p-name').value;
    const cls = document.getElementById('p-class').value;
    party.push({
        name: name || "Héroe",
        className: cls,
        level: 1,
        currency: { gp: 10 },
        inventory: []
    });
    saveState();
    renderParty();
}

function renderParty() {
    const list = document.getElementById('party-list');
    list.innerHTML = party.map((p, i) => `
        <div class="hero-card" onclick="showPlayerDetails(${i})">
            <strong>${p.name}</strong> - Niv. ${p.level} ${p.className}
        </div>
    `).join('') || '<p>No hay héroes reclutados.</p>';
}

function showPlayerDetails(i) {
    const p = party[i];
    document.getElementById('player-details-content').innerHTML = `
        <div class="card">
            <h3>${p.name}</h3>
            <p>Clase: ${p.className}</p>
            <p>Oro: ${p.currency.gp} gp</p>
        </div>
    `;
    showTab('tab-details');
}

// --- LOOT ---
function generateDetailedLoot(cr) {
    const gp = Math.floor(Math.random() * 50 * cr) + 10;
    document.getElementById('loot-display').innerHTML = `
        <div class="hero-card">
            <h4>Botín Hallado</h4>
            <p>Oro: ${gp} gp</p>
        </div>
    `;
}

// --- NAVEGACIÓN ---
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`nav button[onclick*="${tabId}"]`);
    if(btn) btn.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    renderNavigation();
    renderParty();
    showTab('tab-home');
});

window.showTab = showTab;
window.toggleModule = toggleModule;
window.addDetailedPlayer = addDetailedPlayer;
window.showPlayerDetails = showPlayerDetails;
window.generateDetailedLoot = generateDetailedLoot;