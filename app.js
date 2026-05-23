let party = JSON.parse(localStorage.getItem('dnd_party')) || [];
let appConfig = JSON.parse(localStorage.getItem('dnd_config')) || { combat: true, loot: true, survival: true, community: true };
let diceTray = [];

function saveState() {
    localStorage.setItem('dnd_party', JSON.stringify(party));
    localStorage.setItem('dnd_config', JSON.stringify(appConfig));
}

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
    renderDiceTray();
}

function renderDiceTray() {
    const list = document.getElementById('dice-selected-list');
    if (diceTray.length === 0) { list.innerHTML = 'Toca dados para sumarlos...'; return; }
    const counts = {};
    diceTray.forEach(s => counts[s] = (counts[s] || 0) + 1);
    list.innerHTML = Object.entries(counts).map(([s, c]) => `${c}d${s}`).join(' + ');
}

function rollAllDice() {
    if (diceTray.length === 0) return;
    let total = 0, breakdown = [];
    diceTray.forEach(s => {
        const r = Math.floor(Math.random() * s) + 1;
        total += r; breakdown.push(r);
    });
    document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${total}</div><small style="color:#888;">[${breakdown.join('+')}]</small>`;
}

function renderNavigation() {
    const nav = document.getElementById('main-nav');
    if(!nav) return;
    nav.innerHTML = `
        <button onclick="showTab('tab-home')" class="active">
            <i class="fa-solid fa-house-chimney"></i>
            <span>Inicio</span>
        </button>
        ${appConfig.combat ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button>` : ''}
        ${appConfig.loot ? `<button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}
        <button onclick="showTab('tab-party')">
            <i class="fa-solid fa-users-rays"></i>
            <span>Gremio</span>
        </button>
    `;
    renderConfigToggles();
}

function renderConfigToggles() {
    const container = document.getElementById('config-panel');
    if(!container) return;
    const modules = [{id:'combat', label:'Guerra', icon:'fa-shield-halved'}, {id:'loot', label:'Cámara', icon:'fa-gem'}];
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

function toggleModule(m) { appConfig[m] = !appConfig[m]; saveState(); renderNavigation(); }

function addDetailedPlayer() {
    const name = document.getElementById('p-name').value;
    const cls = document.getElementById('p-class').value;
    party.push({ name: name || "Héroe", level: 1, currency: { gp: 10 }, inventory: [] });
    saveState(); renderParty();
}

function renderParty() {
    const list = document.getElementById('party-list');
    if(!list) return;
    list.innerHTML = party.map((p, i) => `<div class="hero-card" onclick="showPlayerDetails(${i})"><strong>${p.name}</strong> - Niv. ${p.level} ${p.className}</div>`).join('') || '<p>No hay héroes.</p>';
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`nav button[onclick*="${tabId}"]`);
    if(btn) btn.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => { renderNavigation(); renderParty(); showTab('tab-home'); });

window.showTab = showTab; window.toggleModule = toggleModule; window.addDetailedPlayer = addDetailedPlayer; window.showPlayerDetails = showPlayerDetails; window.generateDetailedLoot = generateDetailedLoot; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice;