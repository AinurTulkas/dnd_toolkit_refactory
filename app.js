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

// --- UTILIDADES ---
const calculateMod = (val) => {
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

// --- CARGA DE DATOS ---
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

// --- GENERADOR DE BOTÍN ---
function generateLoot() {
    const cr = parseInt(document.getElementById('loot-cr').value) || 1;
    const container = document.getElementById('loot-result');
    const baseCoins = (Math.floor(Math.random() * 100) + 50) * (cr + 1);
    const distribution = { cp: Math.floor(baseCoins * 0.90), sp: Math.floor(baseCoins * 0.07), gp: Math.floor(baseCoins * 0.025), pp: Math.floor(baseCoins * 0.003), ep: Math.floor(baseCoins * 0.002) };
    const isFake = Math.random() < 0.12;
    const fakeMsg = isFake ? `<div style="color: #ff4444; font-size: 0.7rem; margin-top: 5px; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> ADVERTENCIA: Metales viles detectados</div>` : '';
    const allPossibleItems = [...srdData.weapons, ...srdData.armor, ...srdData.items];
    const lootItems = [];
    if(Math.random() < (0.3 + cr*0.05)) lootItems.push({...allPossibleItems[Math.floor(Math.random() * allPossibleItems.length)], id: Date.now() + 1});
    if(Math.random() < 0.6) lootItems.push({...srdData.trinkets[Math.floor(Math.random() * srdData.trinkets.length)], id: Date.now() + 2});
    currentLoot = { distribution, items: lootItems, isFake };

    container.innerHTML = `
        <div class="card" style="background: #1a1a1a; border: 1px dashed var(--gold); padding: 20px;">
            <h3 style="font-family: 'Cinzel'; color: var(--gold); margin-top: 0;">Tesoro Encontrado</h3>
            <div style="display: grid; grid-template-columns: repeat(1, 1fr); gap: 10px; margin-bottom: 15px;">
                ${Object.entries(distribution).map(([type, amount]) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding: 5px 0;">
                        <span style="font-weight: bold; color: ${getCoinColor(type)}">${amount} ${type}</span>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <input type="number" id="split-${type}" value="${amount}" min="1" max="${amount}" style="width: 50px; font-size: 0.7rem; padding: 2px; margin:0;">
                            <button onclick="assignCoins('${type}')" style="background: var(--gold); border:none; border-radius:4px; font-size:0.6rem; padding: 3px 6px; cursor:pointer;">DAR</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${fakeMsg}
            <div style="margin-top: 15px; text-align: left;">
                ${lootItems.map((item, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding: 8px 0;">
                        <span style="font-size: 0.85rem; color: #fff;">• ${item.name}</span>
                        <button onclick="showAssignItem(${idx})" style="background: #333; color: var(--gold); border: 1px solid var(--gold); border-radius:4px; font-size:0.6rem; padding: 3px 6px; cursor:pointer;">ASIGNAR</button>
                    </div>
                    <div id="assign-item-${idx}" style="display:none; margin-top:5px; background:#222; padding:5px; border-radius:4px;"></div>
                `).join('')}
            </div>
        </div>
    `;
}

function getCoinColor(type) { const colors = { cp: '#cd7f32', sp: '#c0c0c0', gp: '#ffd700', pp: '#e5e4e2', ep: '#50c878' }; return colors[type] || '#fff'; }

function assignCoins(type) {
    const amount = parseInt(document.getElementById(`split-${type}`).value);
    if(amount <= 0 || isNaN(amount)) return;
    const charList = party.map(c => `<button onclick="confirmAssignCoins('${type}', ${amount}, '${c.id}')" style="display:block; width:100%; margin-bottom:2px; font-size:0.7rem; background:#333; color:#fff; border:1px solid var(--gold); cursor:pointer; padding:4px;">${c.name}</button>`).join('');
    const container = document.getElementById('assign-area-global') || createGlobalAssignArea();
    container.style.display = 'block';
    container.innerHTML = `<div class="card" style="padding:15px; background:#111; border:1px solid var(--gold);"><p style="font-size:0.7rem; color:var(--gold); margin-top:0;">Repartir ${amount}${type} a:</p>${charList}</div>`;
}

function confirmAssignCoins(type, amount, charId) {
    const char = party.find(c => c.id == charId);
    if(char) {
        char.wallet[type] += amount; saveState();
        const input = document.getElementById(`split-${type}`);
        const newMax = parseInt(input.max) - amount;
        input.max = newMax; input.value = newMax;
        input.parentElement.parentElement.querySelector('span').innerText = `${newMax} ${type}`;
        if(newMax <= 0) input.parentElement.style.display = 'none';
    }
    document.getElementById('assign-area-global').style.display = 'none';
}

function showAssignItem(idx) {
    const area = document.getElementById(`assign-item-${idx}`);
    area.style.display = area.style.display === 'block' ? 'none' : 'block';
    area.innerHTML = party.map(c => `<button onclick="confirmAssignItem(${idx}, '${c.id}')" style="display:block; width:100%; margin-bottom:2px; font-size:0.7rem; background:#111; color:#fff; border:none; cursor:pointer; padding:4px; text-align:left;">→ ${c.name}</button>`).join('');
}

function confirmAssignItem(idx, charId) {
    const char = party.find(c => c.id == charId);
    const item = currentLoot.items[idx];
    if(char && item) {
        char.inventory.push({...item}); saveState();
        const row = document.getElementById(`assign-item-${idx}`).previousElementSibling;
        row.style.opacity = '0.3'; row.querySelector('button').style.display = 'none';
        document.getElementById(`assign-item-${idx}`).style.display = 'none';
    }
}

function createGlobalAssignArea() {
    const div = document.createElement('div'); div.id = 'assign-area-global';
    div.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:3000; width:80%; max-width:300px; display:none;';
    document.body.appendChild(div); return div;
}

// --- GESTIÓN DE INVENTARIO ---
function toggleInventory(charId) {
    const div = document.getElementById(`inv-${charId}`);
    div.style.display = div.style.display === 'block' ? 'none' : 'block';
    renderInventory(charId);
}

function renderInventory(charId) {
    const char = party.find(c => c.id == charId);
    const container = document.getElementById(`inv-list-${charId}`);
    if(!char || !container) return;
    let currentWeight = 0; char.inventory.forEach(i => currentWeight += (i.weight || 0));
    const capacity = (char.stats.str * 15) + (char.hasMagicBag ? 500 : 0);
    const isEncumbered = currentWeight > (char.stats.str * 5);
    const isHeavilyEncumbered = currentWeight > capacity;

    let weightHtml = `
        <div style="margin-bottom:15px; padding:10px; background:#000; border-radius:8px; border:1px solid ${isHeavilyEncumbered ? '#ff4444' : (isEncumbered ? '#ffa500' : '#333')};">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                <span style="color:var(--gold)">PESO: ${currentWeight.toFixed(1)} / ${capacity} lb</span>
                <span style="font-size:0.6rem; color:#666;">(STR: ${char.stats.str} ${calculateMod(char.stats.str)})</span>
            </div>
            <div style="height:4px; background:#222; margin-top:8px; border-radius:2px;"><div style="height:100%; width:${Math.min(100, (currentWeight/capacity)*100)}%; background:${isHeavilyEncumbered ? '#ff4444' : (isEncumbered ? '#ffa500' : '#44bb44')};"></div></div>
        </div>
    `;

    let walletHtml = `<div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px; font-size:0.7rem;">`;
    Object.entries(char.wallet).forEach(([t, v]) => walletHtml += `<div onclick="spendCoins('${charId}', '${t}')" style="background:#222; border:1px solid ${getCoinColor(t)}; padding:3px 6px; border-radius:4px; cursor:pointer;">${v} ${t}</div>`);
    walletHtml += `</div>`;

    let itemsHtml = char.inventory.length === 0 ? '<p style="font-size:0.7rem; color:#666;">Vacío...</p>' : char.inventory.map((item, idx) => `
        <div style="background:#111; padding:8px; border-radius:4px; margin-bottom:5px; font-size:0.75rem; border:1px solid #333;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>• ${item.name} (${item.weight || 0} lb)</span>
                <div style="display:flex; gap:5px;">
                    <button onclick="giveToNPC('${charId}', ${idx})" style="background:transparent; border:none; color:#ff4444; cursor:pointer;"><i class="fa-solid fa-hand-holding-dollar"></i></button>
                    <button onclick="showTradeMenu('${charId}', ${idx})" style="background:transparent; border:none; color:var(--gold); cursor:pointer;"><i class="fa-solid fa-arrows-left-right"></i></button>
                </div>
            </div>
            <div id="trade-menu-${charId}-${idx}" style="display:none; margin-top:5px; border-top:1px solid #222; padding-top:5px;"></div>
        </div>
    `).join('');
    container.innerHTML = weightHtml + walletHtml + itemsHtml;
}

function spendCoins(charId, type) {
    const char = party.find(c => c.id == charId);
    const amount = prompt(`¿Cuántas monedas de ${type} gastar? (Máx: ${char.wallet[type]})`);
    if(!amount || isNaN(amount) || amount > char.wallet[type]) return;
    char.wallet[type] -= parseInt(amount); saveState(); renderInventory(charId);
}

function giveToNPC(charId, itemIdx) {
    const char = party.find(c => c.id == charId);
    if(confirm(`¿Gastar item?`)) { char.inventory.splice(itemIdx, 1); saveState(); renderInventory(charId); }
}

function showTradeMenu(charId, itemIdx) {
    const menu = document.getElementById(`trade-menu-${charId}-${itemIdx}`); menu.style.display = 'block';
    const others = party.filter(c => c.id != charId);
    menu.innerHTML = others.map(c => `<button onclick="tradeItem('${charId}', '${c.id}', ${itemIdx})" style="width:100%; background:#333; color:#fff; font-size:0.65rem; padding:4px; margin-bottom:2px; border:none; cursor:pointer;">Dar a ${c.name}</button>`).join('') + `<button onclick="this.parentElement.style.display='none'" style="width:100%; color:#666; border:none; background:transparent; font-size:0.6rem;">CERRAR</button>`;
}

function tradeItem(fromId, toId, itemIdx) {
    const fromChar = party.find(c => c.id == fromId); const toChar = party.find(c => c.id == toId);
    if(fromChar && toChar) {
        const item = fromChar.inventory.splice(itemIdx, 1)[0]; toChar.inventory.push(item);
        saveState(); alert(`${fromChar.name} entregó "${item.name}" a ${toChar.name}.`); renderInventory(fromId);
    }
}

// --- GESTIÓN DE PERSONAJES ---
function createCharacter() {
    const name = document.getElementById('char-name').value;
    const race = document.getElementById('char-race').value;
    const charClass = document.getElementById('char-class').value;
    const gender = document.getElementById('char-gender').value;
    const stats = {
        str: parseInt(document.getElementById('char-str').value) || 10,
        dex: parseInt(document.getElementById('char-dex').value) || 10,
        con: parseInt(document.getElementById('char-con').value) || 10,
        int: parseInt(document.getElementById('char-int').value) || 10,
        wis: parseInt(document.getElementById('char-wis').value) || 10,
        cha: parseInt(document.getElementById('char-cha').value) || 10
    };
    if (!name) return alert("¡Nombre requerido!");
    const classData = srdData.classes.find(c => c.name === charClass);
    const inventory = [];
    if(classData && classData.starting_items) {
        classData.starting_items.forEach(itemName => {
            const item = [...srdData.weapons, ...srdData.armor, ...srdData.items].find(i => i.name === itemName);
            if(item) inventory.push({...item});
        });
    }
    const newChar = { id: Date.now(), name, race, charClass, gender, level: 1, hp: classData.hit_die, stats, hasMagicBag: false, wallet: {cp:0, sp:0, gp:0, pp:0, ep:0}, inventory };
    party.push(newChar); saveState(); renderParty(); document.getElementById('char-name').value = '';
}

function toggleMagicBag(charId) {
    const char = party.find(c => c.id == charId);
    if(char) { char.hasMagicBag = !char.hasMagicBag; saveState(); renderParty(); if(document.getElementById(`inv-${charId}`).style.display === 'block') renderInventory(charId);
    }
}

function deleteCharacter(id) { party = party.filter(c => c.id != id); saveState(); renderParty(); }

function renderParty() {
    const container = document.getElementById('character-list');
    if (!container) return; if (party.length === 0) { container.innerHTML = '<p style="color: #666;">Gremio vacío...</p>'; return; }
    container.innerHTML = party.map(c => {
        if(!c.stats) c.stats = {str:10, dex:10, con:10, int:10, wis:10, cha:10};
        
        const statsHtml = `
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 10px 0; background: #000; padding: 10px; border-radius: 8px; border: 1px solid #222;">
                <div style="font-size:0.6rem; color:#888;">STR: <b style="color:var(--gold)">${c.stats.str}</b> <span style="color:#fff;">(${calculateMod(c.stats.str)})</span></div>
                <div style="font-size:0.6rem; color:#888;">DEX: <b style="color:var(--gold)">${c.stats.dex}</b> <span style="color:#fff;">(${calculateMod(c.stats.dex)})</span></div>
                <div style="font-size:0.6rem; color:#888;">CON: <b style="color:var(--gold)">${c.stats.con}</b> <span style="color:#fff;">(${calculateMod(c.stats.con)})</span></div>
                <div style="font-size:0.6rem; color:#888;">INT: <b style="color:var(--gold)">${c.stats.int}</b> <span style="color:#fff;">(${calculateMod(c.stats.int)})</span></div>
                <div style="font-size:0.6rem; color:#888;">WIS: <b style="color:var(--gold)">${c.stats.wis}</b> <span style="color:#fff;">(${calculateMod(c.stats.wis)})</span></div>
                <div style="font-size:0.6rem; color:#888;">CHA: <b style="color:var(--gold)">${c.stats.cha}</b> <span style="color:#fff;">(${calculateMod(c.stats.cha)})</span></div>
            </div>
        `;

        return `
        <div class="char-card" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="char-info">
                    <h3>${c.name}</h3>
                    <p>${c.gender} | ${c.race} ${c.charClass} | PV: ${c.hp}</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="text-align:center;"><label style="font-size:0.5rem; color:var(--gold); display:block;">BAG</label><label class="switch" style="transform: scale(0.6);"><input type="checkbox" ${c.hasMagicBag ? 'checked' : ''} onchange="toggleMagicBag(${c.id})"><span class="slider"></span></label></div>
                    <button onclick="toggleInventory(${c.id})" style="background:transparent; border:1px solid var(--gold); color:var(--gold); border-radius:50%; width:35px; height:35px; cursor:pointer;"><i class="fa-solid fa-sack-xmark"></i></button>
                    <button class="btn-delete" onclick="deleteCharacter(${c.id})"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
            ${statsHtml}
            <div id="inv-${c.id}" style="display:none; margin-top:5px; border-top:1px solid #222; padding-top:10px;"><div id="inv-list-${c.id}"></div></div>
        </div>
    `}).join('');
}

// --- OTROS ---
function toggleDiceTray() { const t = document.getElementById('dice-overlay'); t.style.display = t.style.display === 'flex' ? 'none' : 'flex'; }
function addDiceToTray(s) { diceTray.push(s); renderDiceTray(); }
function clearTray() { diceTray = []; document.getElementById('dice-result-area').innerHTML = '--'; document.getElementById('dice-selected-list').innerHTML = ''; }
function renderDiceTray() { const l = document.getElementById('dice-selected-list'); if (diceTray.length === 0) { l.innerHTML = 'Toca dados...'; return; } const counts = {}; diceTray.forEach(s => counts[s] = (counts[s] || 0) + 1); l.innerHTML = Object.entries(counts).map(([s, c]) => `${c}d${s}`).join(' + '); }
function rollAllDice() { if (diceTray.length === 0) return; let t = 0, br = []; diceTray.forEach(s => { const r = Math.floor(Math.random() * s) + 1; t += r; br.push(r); }); document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${t}</div><div style="color:#666; font-size:0.9rem;">[${br.join(' + ')}]</div>`; }
function renderNavigation() { const n = document.getElementById('main-nav'); if(!n) return;
    n.innerHTML = `<button onclick="showTab('tab-home')" class="active"><i class="fa-solid fa-house-chimney"></i><span>Inicio</span></button>${appConfig.combat ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button>` : ''}${appConfig.loot ? `<button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}<button onclick="showTab('tab-party')"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>`; renderConfigToggles(); }
function renderConfigToggles() { const c = document.getElementById('config-panel'); if(!c) return; const m = [{id:'combat',label:'Tablero Guerra',icon:'fa-shield-halved'},{id:'loot',label:'Cámara Tesoros',icon:'fa-gem'},{id:'survival',label:'Supervivencia',icon:'fa-campground'},{id:'community',label:'Tablón Gremial',icon:'fa-bullhorn'}]; c.innerHTML = m.map(x => `<div class="module-row"><div class="module-label"><i class="fa-solid ${x.icon}"></i> <span>${x.label}</span></div><label class="switch"><input type="checkbox" ${appConfig[x.id] ? 'checked' : ''} onchange="toggleModule('${x.id}')"><span class="slider"></span></label></div>`).join(''); }
function toggleModule(m) { appConfig[m] = !appConfig[m]; saveState(); renderNavigation(); }
function showTab(t) { document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none'); document.getElementById(t).style.display = 'block'; document.querySelectorAll('nav button').forEach(b => b.classList.remove('active')); const btn = document.querySelector(`nav button[onclick*="${t}"]`); if(btn) btn.classList.add('active'); if(t === 'tab-party') renderParty(); if(t === 'tab-combat') renderBestiary(); if(t === 'tab-loot') renderLootTable(); }
function renderBestiary() { const container = document.getElementById('monster-list'); if (!container) return; container.innerHTML = srdData.monsters.map(m => `<div class="char-card" style="border-left-color: #d32f2f;"><div class="char-info"><h3>${m.name}</h3><p>${m.type} | CA: ${m.ac} | PV: ${m.hp} | CR: ${m.cr}</p></div></div>`).join(''); }
function renderLootTable() { const container = document.getElementById('loot-items-list'); if (!container) return; const allItems = [...srdData.weapons, ...srdData.armor, ...srdData.items, ...srdData.trinkets]; container.innerHTML = allItems.map(i => `<div class="char-card" style="border-left-color: #c5a059;"><div class="char-info"><h3>${i.name}</h3><p>${i.category} | Coste: ${i.cost} | Peso: ${i.weight} lb</p></div></div>`).join(''); }

document.addEventListener('DOMContentLoaded', async () => { await loadSRDData(); renderNavigation(); showTab('tab-home'); });

window.showTab = showTab; window.toggleModule = toggleModule; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.deleteCharacter = deleteCharacter; window.generateLoot = generateLoot; window.assignCoins = assignCoins; window.confirmAssignCoins = confirmAssignCoins; window.showAssignItem = showAssignItem; window.confirmAssignItem = confirmAssignItem; window.toggleInventory = toggleInventory; window.spendCoins = spendCoins; window.giveToNPC = giveToNPC; window.showTradeMenu = showTradeMenu; window.tradeItem = tradeItem; window.toggleMagicBag = toggleMagicBag;