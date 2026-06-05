// --- ESTADO ---
let party = JSON.parse(localStorage.getItem('dnd_party')) || [];
let appConfig = JSON.parse(localStorage.getItem('dnd_config')) || { 
    combat: true, loot: true, survival: true, community: true 
};
let srdData = { classes: [], races: [], genders: [], monsters: [], weapons: [], armor: [], items: [], trinkets: [] };
let diceTray = [];
let currentLoot = null;

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
        renderLootTable(); 
        renderBestiary();   
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

// --- GENERADOR DE BOTÍN MATÁTICO ---
function generateLoot() {
    const cr = parseInt(document.getElementById('loot-cr').value) || 1;
    const container = document.getElementById('loot-result');
    
    const baseCoins = (Math.floor(Math.random() * 100) + 50) * (cr + 1);
    
    const distribution = {
        cp: Math.floor(baseCoins * 0.90),
        sp: Math.floor(baseCoins * 0.07),
        gp: Math.floor(baseCoins * 0.025),
        pp: Math.floor(baseCoins * 0.003),
        ep: Math.floor(baseCoins * 0.002)
    };

    const isFake = Math.random() < 0.12;
    const fakeMsg = isFake ? `<div style="color: #ff4444; font-size: 0.7rem; margin-top: 5px; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> ADVERTENCIA: Se detectan trazas de metales viles</div>` : '';

    const allItems = [...srdData.weapons, ...srdData.armor, ...srdData.items];
    const lootItems = [];
    
    // Items normales
    if(Math.random() < (0.3 + cr*0.05)) lootItems.push(allItems[Math.floor(Math.random() * allItems.length)]);
    
    // "Baratijas" (Objetos inútiles) - Siempre al menos 1 por sabor
    if(Math.random() < 0.6) lootItems.push(srdData.trinkets[Math.floor(Math.random() * srdData.trinkets.length)]);

    currentLoot = { distribution, items: lootItems, isFake };

    container.innerHTML = `
        <div class="card" style="background: #1a1a1a; border: 1px dashed var(--gold); padding: 20px;">
            <h3 style="font-family: 'Cinzel'; color: var(--gold); margin-top: 0;">Tesoro Encontrado</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.8rem; font-weight: bold;">
                <div style="color: #cd7f32;">${distribution.cp} cp</div>
                <div style="color: #c0c0c0;">${distribution.sp} sp</div>
                <div style="color: #ffd700;">${distribution.gp} gp</div>
                <div style="color: #e5e4e2;">${distribution.pp} pp</div>
                <div style="color: #50c878;">${distribution.ep} ep</div>
            </div>
            ${fakeMsg}
            <div style="margin-top: 15px; text-align: left;">
                ${lootItems.map(item => `<div style="font-size: 0.85rem; color: #fff; border-bottom: 1px solid #333; padding: 5px 0;">• ${item.name} <span style="font-size:0.6rem; color:var(--gold)">[${item.category}]</span></div>`).join('')}
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button onclick="distributeLootRandomly()" class="btn-primary" style="font-size: 0.7rem; padding: 8px;">REPARTIR AZAR</button>
                <button onclick="showAssignLoot()" class="btn-primary" style="font-size: 0.7rem; padding: 8px; background: var(--gold); color: black;">ASIGNAR A...</button>
            </div>
            <div id="assign-area" style="margin-top:15px; display:none;"></div>
        </div>
    `;
}

function distributeLootRandomly() {
    if(!currentLoot || party.length === 0) return alert("No hay botín o héroes en el gremio.");
    const luckyChar = party[Math.floor(Math.random() * party.length)];
    alert(`¡El azar ha hablado! Todo el botín va para: ${luckyChar.name}`);
}

function showAssignLoot() {
    const area = document.getElementById('assign-area');
    area.style.display = 'block';
    area.innerHTML = `<p style="font-size:0.7rem; color:var(--gold)">Selecciona un héroe:</p>` + 
        party.map(c => `<button onclick="assignLootTo('${c.name}')" style="width:100%; margin-bottom:5px; padding:5px; background:#222; border:1px solid var(--gold); color:#fff; cursor:pointer; font-size:0.8rem;">${c.name}</button>`).join('');
}

function assignLootTo(name) {
    alert(`Botín asignado a ${name}. El Master ha hablado.`);
    document.getElementById('assign-area').style.display = 'none';
}

// --- RESTO DE FUNCIONES (BESTIARIO, NAV, PARTY) ---
function renderBestiary() {
    const container = document.getElementById('monster-list');
    if (!container) return;
    container.innerHTML = srdData.monsters.map(m => `
        <div class="char-card" style="border-left-color: #d32f2f;">
            <div class="char-info"><h3>${m.name}</h3><p>${m.type} | CA: ${m.ac} | PV: ${m.hp} | CR: ${m.cr}</p></div>
        </div>
    `).join('');
}

function renderLootTable() {
    const container = document.getElementById('loot-items-list');
    if (!container) return;
    const allItems = [...srdData.weapons, ...srdData.armor, ...srdData.items, ...srdData.trinkets];
    container.innerHTML = allItems.map(i => `
        <div class="char-card" style="border-left-color: #c5a059;">
            <div class="char-info"><h3>${i.name}</h3><p>${i.category} | Coste: ${i.cost}</p></div>
        </div>
    `).join('');
}

function createCharacter() {
    const name = document.getElementById('char-name').value;
    const race = document.getElementById('char-race').value;
    const charClass = document.getElementById('char-class').value;
    const gender = document.getElementById('char-gender').value;
    if (!name) return alert("¡Nombre requerido!");
    const newChar = { id: Date.now(), name, race, charClass, gender, level: 1, hp: srdData.classes.find(c => c.name === charClass).hit_die };
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
    if (party.length === 0) { container.innerHTML = '<p style="color: #666;">Gremio vacío...</p>'; return; }
    container.innerHTML = party.map(c => `
        <div class="char-card">
            <div class="char-info"><h3>${c.name}</h3><p>${c.gender} | ${c.race} ${c.charClass} | ${c.hp} PV</p></div>
            <button class="btn-delete" onclick="deleteCharacter(${c.id})"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');
}

function toggleDiceTray() { const t = document.getElementById('dice-overlay'); t.style.display = t.style.display === 'flex' ? 'none' : 'flex'; }
function addDiceToTray(s) { diceTray.push(s); renderDiceTray(); }
function clearTray() { diceTray = []; document.getElementById('dice-result-area').innerHTML = '--'; document.getElementById('dice-selected-list').innerHTML = ''; }
function renderDiceTray() { const l = document.getElementById('dice-selected-list'); if (diceTray.length === 0) { l.innerHTML = 'Toca dados...'; return; } const counts = {}; diceTray.forEach(s => counts[s] = (counts[s] || 0) + 1); l.innerHTML = Object.entries(counts).map(([s, c]) => `${c}d${s}`).join(' + '); }
function rollAllDice() { if (diceTray.length === 0) return; let t = 0, br = []; diceTray.forEach(s => { const r = Math.floor(Math.random() * s) + 1; t += r; br.push(r); }); document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${t}</div><div style="color:#666; font-size:0.9rem;">[${br.join(' + ')}]</div>`; }

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
    const c = document.getElementById('config-panel'); if(!c) return;
    const m = [{id:'combat',label:'Tablero Guerra',icon:'fa-shield-halved'},{id:'loot',label:'Cámara Tesoros',icon:'fa-gem'},{id:'survival',label:'Supervivencia',icon:'fa-campground'},{id:'community',label:'Tablón Gremial',icon:'fa-bullhorn'}];
    c.innerHTML = m.map(x => `<div class="module-row"><div class="module-label"><i class="fa-solid ${x.icon}"></i> <span>${x.label}</span></div><label class="switch"><input type="checkbox" ${appConfig[x.id] ? 'checked' : ''} onchange="toggleModule('${x.id}')"><span class="slider"></span></label></div>`).join('');
}

function toggleModule(m) { appConfig[m] = !appConfig[m]; saveState(); renderNavigation(); }
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(t).style.display = 'block';
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`nav button[onclick*="${t}"]`); if(btn) btn.classList.add('active');
    if(t === 'tab-party') renderParty();
    if(t === 'tab-combat') renderBestiary();
    if(t === 'tab-loot') renderLootTable();
}

document.addEventListener('DOMContentLoaded', async () => { await loadSRDData(); renderNavigation(); showTab('tab-home'); });

window.showTab = showTab; window.toggleModule = toggleModule; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.deleteCharacter = deleteCharacter; window.generateLoot = generateLoot; window.distributeLootRandomly = distributeLootRandomly; window.showAssignLoot = showAssignLoot; window.assignLootTo = assignLootTo;