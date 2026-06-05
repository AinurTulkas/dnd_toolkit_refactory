// --- ESTADO ---
let party = JSON.parse(localStorage.getItem('dnd_party')) || [];
let appConfig = JSON.parse(localStorage.getItem('dnd_config')) || { 
    combat: true, loot: true, survival: true, community: true 
};
let srdData = { classes: [], races: [], genders: [], monsters: [], weapons: [], armor: [], items: [] };
let diceTray = [];

function saveState() {
    localStorage.setItem('dnd_party', JSON.stringify(party));
    localStorage.setItem('dnd_config', JSON.stringify(appConfig));
}

// --- CARGA DE DATOS (DATABASE) ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        populateSelects();
        renderLootTable(); // Renderizar tablas si existen
        renderBestiary();   // Renderizar bestiario
    } catch (e) {
        console.error("Error cargando base de datos SRD:", e);
    }
}

function populateSelects() {
    const classSelect = document.getElementById('char-class');
    const raceSelect = document.getElementById('char-race');
    const genderSelect = document.getElementById('char-gender');
    
    if(classSelect) classSelect.innerHTML = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    if(raceSelect) raceSelect.innerHTML = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    if(genderSelect) genderSelect.innerHTML = srdData.genders.map(g => `<option value="${g}">${g}</option>`).join('');
}

// --- BESTIARIO ---
function renderBestiary() {
    const container = document.getElementById('monster-list');
    if (!container) return;
    container.innerHTML = srdData.monsters.map(m => `
        <div class="char-card" style="border-left-color: #d32f2f;">
            <div class="char-info">
                <h3>${m.name}</h3>
                <p>${m.type} | CA: ${m.ac} | PV: ${m.hp} | CR: ${m.cr}</p>
            </div>
        </div>
    `).join('');
}

// --- EQUIPO Y LOOT ---
function renderLootTable() {
    const container = document.getElementById('loot-items-list');
    if (!container) return;
    
    const allItems = [...srdData.weapons, ...srdData.armor, ...srdData.items];
    container.innerHTML = allItems.map(i => `
        <div class="char-card" style="border-left-color: #c5a059;">
            <div class="char-info">
                <h3>${i.name}</h3>
                <p>${i.category} | Coste: ${i.cost} ${i.damage ? `| Daño: ${i.damage}` : ''} ${i.ac ? `| CA: ${i.ac}` : ''}</p>
            </div>
        </div>
    `).join('');
}

// --- GESTIÓN DE PERSONAJES ---
function createCharacter() {
    const name = document.getElementById('char-name').value;
    const race = document.getElementById('char-race').value;
    const charClass = document.getElementById('char-class').value;
    const gender = document.getElementById('char-gender').value;

    if (!name) { alert("¡El héroe necesita un nombre!"); return; }

    const newChar = {
        id: Date.now(),
        name, race, charClass, gender,
        level: 1,
        hp: srdData.classes.find(c => c.name === charClass).hit_die
    };

    party.push(newChar);
    saveState();
    renderParty();
    document.getElementById('char-name').value = '';
}

function deleteCharacter(id) {
    party = party.filter(c => c.id !== id);
    saveState();
    renderParty();
}

function renderParty() {
    const container = document.getElementById('character-list');
    if (!container) return;
    if (party.length === 0) {
        container.innerHTML = '<p style="color: #666; font-style: italic;">No hay héroes en el gremio aún...</p>';
        return;
    }
    container.innerHTML = party.map(c => `
        <div class="char-card">
            <div class="char-info">
                <h3>${c.name}</h3>
                <p>${c.gender} | ${c.race} ${c.charClass} (Nivel ${c.level})</p>
                <p><i class="fa-solid fa-heart" style="color: var(--dnd-red);"></i> ${c.hp} PV</p>
            </div>
            <button class="btn-delete" onclick="deleteCharacter(${c.id})"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');
}

// --- DADOS GLOBALES ---
function toggleDiceTray() {
    const tray = document.getElementById('dice-overlay');
    tray.style.display = tray.style.display === 'flex' ? 'none' : 'flex';
}
function addDiceToTray(sides) { diceTray.push(sides); renderDiceTray(); }
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
    
    if(tabId === 'tab-party') renderParty();
    if(tabId === 'tab-combat') renderBestiary();
    if(tabId === 'tab-loot') renderLootTable();
}

// --- INICIO ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadSRDData();
    renderNavigation();
    showTab('tab-home');
});

window.showTab = showTab;
window.toggleModule = toggleModule;
window.toggleDiceTray = toggleDiceTray;
window.addDiceToTray = addDiceToTray;
window.clearTray = clearTray;
window.rollAllDice = rollAllDice;
window.createCharacter = createCharacter;
window.deleteCharacter = deleteCharacter;