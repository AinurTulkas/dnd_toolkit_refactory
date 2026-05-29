// --- ESTADO ---
let party = JSON.parse(localStorage.getItem('dnd_party')) || [];
let appConfig = JSON.parse(localStorage.getItem('dnd_config')) || { 
    combat: true, loot: true, survival: true, community: true 
};
let diceTray = [];

function saveState() {
    localStorage.setItem('dnd_party', JSON.stringify(party));
    localStorage.setItem('dnd_config', JSON.stringify(appConfig));
}

// --- DADOS GLOBALES ---
function toggleDiceTray() {
    const tray = document.getElementById('dice-overlay');
    tray.style.display = tray.style.display === 'flex' ? 'none' : 'flex';
}

function addDiceToTray(sides) {
    diceTray.push(sides);
    renderDiceTray();
}

function clearTray() {
    diceTray = [];
    document.getElementById('dice-result-area').innerHTML = '--';
    document.getElementById('dice-selected-list').innerHTML = '';
}

function renderDiceTray() {
    const list = document.getElementById('dice-selected-list');
    if (diceTray.length === 0) { list.innerHTML = 'Toca los dados...'; return; }
    const counts = {};
    diceTray.forEach(s => counts[s] = (counts[s] || 0) + 1);
    list.innerHTML = Object.entries(counts).map(([s, c]) => `${c}d${s}`).join(' + ');
}

function rollAllDice() {
    if (diceTray.length === 0) return;
    let total = 0, br = [];
    diceTray.forEach(s => {
        const r = Math.floor(Math.random() * s) + 1;
        total += r; br.push(r);
    });
    document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${total}</div><div style="color:#666; font-size:0.9rem;">[${br.join(' + ')}]</div>`;
}

// --- MODULARIDAD ---
function renderNavigation() {
    const nav = document.getElementById('main-nav');
    if(!nav) return;
    nav.innerHTML = `
        <button onclick="showTab('tab-home')" class="active"><i class="fa-solid fa-house-chimney"></i><span>Inicio</span></button>
        ${appConfig.combat ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button>` : ''}
        ${appConfig.loot ? `<button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}
        <button onclick="showTab('tab-party')"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>
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
            <div class="module-label"><i class="fa-solid ${m.icon}"></i> <span>${m.label}</span></div>
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

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`nav button[onclick*="${tabId}"]`);
    if(btn) btn.classList.add('active');
}

// --- INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    renderNavigation();
    showTab('tab-home');
});

window.showTab = showTab;
window.toggleModule = toggleModule;
window.toggleDiceTray = toggleDiceTray;
window.addDiceToTray = addDiceToTray;
window.clearTray = clearTray;
window.rollAllDice = rollAllDice;