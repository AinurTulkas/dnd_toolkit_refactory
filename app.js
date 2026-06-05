// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master'; // 'master' o 'adventurer'

let party = []; // Héroes de la campaña actual
let appConfig = { combat: true, loot: true, survival: true, community: true };
let srdData = { classes: [], races: [], genders: [], monsters: [], weapons: [], armor: [], items: [], trinkets: [] };
let diceTray = [];
let currentLoot = null;

// --- UTILIDADES ---
const calculateMod = (val) => {
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_current_campaign', currentCampaignId);
    localStorage.setItem('dnd_role', currentRole);
}

// --- LÓGICA DE LOBBY Y CAMPAÑAS ---
function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    if(campaigns.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">No tienes campañas creadas.</p>';
        return;
    }
    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item" onclick="selectCampaign('${c.id}')">
            <h3 style="font-family:'Cinzel'; color:var(--gold); margin:0;">${c.name}</h3>
            <p style="font-size:0.8rem; color:#888; margin:5px 0 0;">${c.party.length} Aventureros</p>
        </div>
    `).join('');
}

function showCreateCampaign() { document.getElementById('create-campaign-form').style.display = 'block'; }
function hideCreateCampaign() { document.getElementById('create-campaign-form').style.display = 'none'; }

function createCampaign() {
    const name = document.getElementById('new-campaign-name').value;
    if(!name) return;
    const newCamp = { id: 'camp_' + Date.now(), name, party: [], config: { combat: true, loot: true } };
    campaigns.push(newCamp);
    saveAll();
    renderCampaignList();
    document.getElementById('new-campaign-name').value = '';
    hideCreateCampaign();
}

function selectCampaign(id) {
    currentCampaignId = id;
    const camp = campaigns.find(c => c.id === id);
    party = camp.party;
    appConfig = camp.config;
    saveAll();
    
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title-display').innerText = camp.name;
    applyRoleUI();
    renderNavigation();
}

function exitToLobby() {
    currentCampaignId = null;
    saveAll();
    location.reload();
}

// --- GESTIÓN DE ROLES ---
function changeRole() {
    currentRole = document.getElementById('role-selector').value;
    saveAll();
    applyRoleUI();
    renderNavigation();
}

function applyRoleUI() {
    const isMaster = currentRole === 'master';
    document.getElementById('current-role-text').innerText = isMaster ? 'DUNGEON MASTER' : 'AVENTURERO';
    document.getElementById('role-selector').value = currentRole;
    
    // El aventurero no puede borrar personajes ni repartir botín libremente
    document.body.classList.toggle('is-master', isMaster);
    document.body.classList.toggle('is-adventurer', !isMaster);
}

// --- CARGA DE DATOS SRD ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        populateSelects();
        renderLootTable(); 
        renderBestiary();   
        
        if(currentCampaignId) {
            selectCampaign(currentCampaignId);
        } else {
            renderCampaignList();
        }
    } catch (e) {
        console.error("Error cargando SRD:", e);
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

// --- GENERADOR DE BOTÍN (MASTER ONLY) ---
function generateLoot() {
    if(currentRole !== 'master') return alert("Solo el Master puede generar tesoros.");
    const cr = parseInt(document.getElementById('loot-cr').value) || 1;
    const container = document.getElementById('loot-result');
    const baseCoins = (Math.floor(Math.random() * 100) + 50) * (cr + 1);
    const distribution = { cp: Math.floor(baseCoins * 0.90), sp: Math.floor(baseCoins * 0.07), gp: Math.floor(baseCoins * 0.025), pp: Math.floor(baseCoins * 0.003), ep: Math.floor(baseCoins * 0.002) };
    const isFake = Math.random() < 0.12;
    const fakeMsg = isFake ? `<div style="color: #ff4444; font-size: 0.7rem; margin-top: 5px; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> ADVERTENCIA: Se detectan trazas de metales viles</div>` : '';
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
                            <input type="number" id="split-${type}" value="${amount}" min="1" max="${amount}" style="width: 70px; font-size: 1rem; padding: 4px; margin:0;">
                            <button onclick="assignCoins('${type}')" style="background: var(--gold); border:none; border-radius:4px; font-size:0.8rem; padding: 5px 10px; cursor:pointer;">DAR</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${isFake ? `<p style="color:#ff4444; font-size:0.8rem;">⚠️ ¡Alerta de metales viles!</p>` : ''}
            <div style="margin-top: 15px; text-align: left;">
                ${lootItems.map((item, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding: 10px 0;">
                        <span>• ${item.name}</span>
                        <button onclick="showAssignItem(${idx})" style="background: #333; color: var(--gold); border: 1px solid var(--gold); border-radius:4px; font-size:0.8rem; padding: 5px 10px; cursor:pointer;">ASIGNAR</button>
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
    const charList = party.map(c => `<button onclick="confirmAssignCoins('${type}', ${amount}, '${c.id}')" style="display:block; width:100%; margin-bottom:2px; font-size:1rem; background:#333; color:#fff; border:1px solid var(--gold); cursor:pointer; padding:10px;">${c.name}</button>`).join('');
    const container = document.getElementById('assign-area-global') || createGlobalAssignArea();
    container.style.display = 'block';
    container.innerHTML = `<div class="card" style="padding:20px; background:#111; border:1px solid var(--gold);"><p style="color:var(--gold); margin-top:0;">Dar ${amount}${type} a:</p>${charList}</div>`;
}

function confirmAssignCoins(type, amount, charId) {
    const char = party.find(c => c.id == charId);
    if(char) {
        char.wallet[type] += amount; saveAll();
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
    area.innerHTML = party.map(c => `<button onclick="confirmAssignItem(${idx}, '${c.id}')" style="display:block; width:100%; margin-bottom:2px; font-size:0.9rem; background:#111; color:#fff; border:1px solid #444; cursor:pointer; padding:8px;">→ ${c.name}</button>`).join('');
}

function confirmAssignItem(idx, charId) {
    const char = party.find(c => c.id == charId);
    const item = currentLoot.items[idx];
    if(char && item) {
        char.inventory.push({...item}); saveAll();
        const row = document.getElementById(`assign-item-${idx}`).previousElementSibling;
        row.style.opacity = '0.3'; row.querySelector('button').style.display = 'none';
        document.getElementById(`assign-item-${idx}`).style.display = 'none';
    }
}

function createGlobalAssignArea() {
    const div = document.createElement('div'); div.id = 'assign-area-global';
    div.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:6000; width:90%; max-width:400px; display:none;';
    document.body.appendChild(div); return div;
}

// --- INVENTARIO (AVENTURERO) ---
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
    const isHeavilyEncumbered = currentWeight > capacity;

    container.innerHTML = `
        <div style="margin-bottom:15px; padding:15px; background:#000; border-radius:8px; border:1px solid ${isHeavilyEncumbered ? '#ff4444' : '#333'}">
            <span style="color:var(--gold)">PESO: ${currentWeight.toFixed(1)} / ${capacity} lb</span>
            <div style="height:8px; background:#222; margin-top:10px; border-radius:4px;"><div style="height:100%; width:${Math.min(100, (currentWeight/capacity)*100)}%; background:${isHeavilyEncumbered ? '#ff4444' : '#44bb44'}; transition:0.3s;"></div></div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px;">
            ${Object.entries(char.wallet).map(([t, v]) => `<div onclick="spendCoins('${charId}', '${t}')" style="background:#222; border:1px solid ${getCoinColor(t)}; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:1rem;">${v} ${t}</div>`).join('')}
        </div>
        ${char.inventory.map((item, idx) => `
            <div style="background:#111; padding:12px; border-radius:8px; margin-bottom:8px; border:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <span>• ${item.name} (${item.weight} lb)</span>
                <div style="display:flex; gap:10px;">
                    <button onclick="giveToNPC('${charId}', ${idx})" style="background:transparent; border:none; color:#ff4444;"><i class="fa-solid fa-hand-holding-dollar"></i></button>
                    <button onclick="showTradeMenu('${charId}', ${idx})" style="background:transparent; border:none; color:var(--gold);"><i class="fa-solid fa-arrows-left-right"></i></button>
                </div>
            </div>
            <div id="trade-menu-${charId}-${idx}" style="display:none; margin-top:8px;"></div>
        `).join('')}
    `;
}

function spendCoins(charId, type) {
    const char = party.find(c => c.id == charId);
    const amount = prompt(`Gastar ${type} (Máx: ${char.wallet[type]})`);
    if(amount > 0 && amount <= char.wallet[type]) { char.wallet[type] -= parseInt(amount); saveAll(); renderInventory(charId); }
}

function giveToNPC(charId, idx) {
    const char = party.find(c => c.id == charId);
    if(confirm("¿Entregar item?")) { char.inventory.splice(idx, 1); saveAll(); renderInventory(charId); }
}

function showTradeMenu(charId, idx) {
    const menu = document.getElementById(`trade-menu-${charId}-${idx}`); menu.style.display = 'block';
    menu.innerHTML = party.filter(c => c.id != charId).map(c => `<button onclick="tradeItem('${charId}', '${c.id}', ${idx})" style="width:100%; background:#333; color:#fff; padding:10px; margin-bottom:5px; border:none; border-radius:4px;">Dar a ${c.name}</button>`).join('') + `<button onclick="this.parentElement.style.display='none'" style="width:100%; color:#666; background:transparent; border:none;">CERRAR</button>`;
}

function tradeItem(fromId, toId, idx) {
    const from = party.find(c => c.id == fromId); const to = party.find(c => c.id == toId);
    const item = from.inventory.splice(idx, 1)[0]; to.inventory.push(item); saveAll(); renderInventory(fromId);
}

// --- CREACIÓN ---
function createCharacter() {
    const name = document.getElementById('char-name').value;
    if(!name) return alert("Nombre requerido.");
    const classData = srdData.classes.find(c => c.name === document.getElementById('char-class').value);
    const stats = {
        str: parseInt(document.getElementById('char-str').value) || 10,
        dex: parseInt(document.getElementById('char-dex').value) || 10,
        con: parseInt(document.getElementById('char-con').value) || 10,
        int: parseInt(document.getElementById('char-int').value) || 10,
        wis: parseInt(document.getElementById('char-wis').value) || 10,
        cha: parseInt(document.getElementById('char-cha').value) || 10
    };
    const inventory = [];
    if(classData.starting_items) {
        classData.starting_items.forEach(itemName => {
            const item = [...srdData.weapons, ...srdData.armor, ...srdData.items].find(i => i.name === itemName);
            if(item) inventory.push({...item});
        });
    }
    const newChar = { id: Date.now(), name, race: document.getElementById('char-race').value, charClass: classData.name, gender: document.getElementById('char-gender').value, level: 1, hp: classData.hit_die, stats, hasMagicBag: false, wallet: {cp:0, sp:0, gp:0, pp:0, ep:0}, inventory };
    party.push(newChar);
    saveAll();
    renderParty();
    document.getElementById('char-name').value = '';
}

function toggleMagicBag(id) {
    if(currentRole !== 'master') return alert("Solo el Master puede activar bolsas mágicas.");
    const char = party.find(c => c.id == id);
    char.hasMagicBag = !char.hasMagicBag; saveAll(); renderParty();
}

function deleteCharacter(id) {
    if(currentRole !== 'master') return alert("Solo el Master puede borrar personajes.");
    if(confirm("¿Borrar héroe del gremio?")) { party = party.filter(c => c.id != id); campaigns.find(c => c.id === currentCampaignId).party = party; saveAll(); renderParty(); }
}

function renderParty() {
    const container = document.getElementById('character-list'); if(!container) return;
    if(party.length === 0) { container.innerHTML = '<p style="color:#666;">Gremio vacío.</p>'; return; }
    container.innerHTML = party.map(c => `
        <div class="char-card" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="char-info"><h3>${c.name}</h3><p>${c.gender} | ${c.race} ${c.charClass}</p><p style="color:var(--dnd-red); font-weight:bold;">PV: ${c.hp}</p></div>
                <div style="display:flex; gap:12px; align-items:center;">
                    ${currentRole === 'master' ? `<div style="text-align:center;"><label style="font-size:0.6rem; color:var(--gold); display:block; margin-bottom:2px;">BOLSA</label><label class="switch" style="transform: scale(0.8);"><input type="checkbox" ${c.hasMagicBag ? 'checked' : ''} onchange="toggleMagicBag(${c.id})"><span class="slider"></span></label></div>` : ''}
                    <button onclick="toggleInventory(${c.id})" style="background:transparent; border:1px solid var(--gold); color:var(--gold); border-radius:10px; width:45px; height:45px; cursor:pointer; font-size:1.4rem;"><i class="fa-solid fa-sack-xmark"></i></button>
                    ${currentRole === 'master' ? `<button class="btn-delete" onclick="deleteCharacter(${c.id})"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 15px 0; background: #000; padding: 15px; border-radius: 10px; border: 1px solid #222;">
                ${Object.entries(c.stats).map(([s, v]) => `<div style="font-size:0.8rem; color:#888;">${s.toUpperCase()}: <b style="color:var(--gold)">${v}</b> <span>(${calculateMod(v)})</span></div>`).join('')}
            </div>
            <div id="inv-${c.id}" style="display:none; margin-top:15px; border-top:1px solid #222; padding-top:15px;"><div id="inv-list-${c.id}"></div></div>
        </div>
    `).join('');
}

// --- NAVEGACIÓN Y TABS ---
function renderNavigation() {
    const nav = document.getElementById('main-nav'); if(!nav) return;
    const isMaster = currentRole === 'master';
    nav.innerHTML = `
        <button onclick="showTab('tab-home')" class="active"><i class="fa-solid fa-house-chimney"></i><span>Home</span></button>
        ${isMaster ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button>` : ''}
        ${isMaster ? `<button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}
        <button onclick="showTab('tab-party')"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>
    `;
    renderConfigToggles();
}

function renderConfigToggles() {
    const c = document.getElementById('config-panel'); if(!c || currentRole !== 'master') { if(c) c.innerHTML=''; return; }
    const m = [{id:'combat',label:'Tablero Guerra',icon:'fa-shield-halved'},{id:'loot',label:'Cámara Tesoros',icon:'fa-gem'},{id:'survival',label:'Supervivencia',icon:'fa-campground'},{id:'community',label:'Tablón Gremial',icon:'fa-bullhorn'}];
    c.innerHTML = `<h2>Configuración Master</h2>` + m.map(x => `<div class="module-row" style="padding:15px 0;"><div class="module-label"><i class="fa-solid ${x.icon}"></i> <span style="font-size:1.1rem;">${x.label}</span></div><label class="switch"><input type="checkbox" ${appConfig[x.id] ? 'checked' : ''} onchange="toggleModule('${x.id}')"><span class="slider"></span></label></div>`).join('');
}

function toggleModule(m) { appConfig[m] = !appConfig[m]; saveAll(); renderNavigation(); }

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(t).style.display = 'block';
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`nav button[onclick*="${t}"]`); if(btn) btn.classList.add('active');
    if(t === 'tab-party') renderParty();
    if(t === 'tab-combat') renderBestiary();
    if(t === 'tab-loot') renderLootTable();
}

function renderBestiary() {
    const container = document.getElementById('monster-list'); if (!container) return;
    container.innerHTML = srdData.monsters.map(m => `<div class="char-card" style="border-left-color: #d32f2f; margin-bottom:12px;"><div class="char-info"><h3>${m.name}</h3><p style="font-size:1rem;">${m.type} | CA: ${m.ac} | PV: ${m.hp} | CR: ${m.cr}</p></div></div>`).join('');
}

function renderLootTable() {
    const container = document.getElementById('loot-items-list'); if (!container) return;
    const allItems = [...srdData.weapons, ...srdData.armor, ...srdData.items, ...srdData.trinkets];
    container.innerHTML = allItems.map(i => `<div class="char-card" style="border-left-color: #c5a059; margin-bottom:12px;"><div class="char-info"><h3>${i.name}</h3><p style="font-size:1rem;">${i.category} | Peso: ${i.weight} lb</p></div></div>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => { await loadSRDData(); });

window.showTab = showTab; window.toggleModule = toggleModule; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.deleteCharacter = deleteCharacter; window.generateLoot = generateLoot; window.assignCoins = assignCoins; window.confirmAssignCoins = confirmAssignCoins; window.showAssignItem = showAssignItem; window.confirmAssignItem = confirmAssignItem; window.toggleInventory = toggleInventory; window.spendCoins = spendCoins; window.giveToNPC = giveToNPC; window.showTradeMenu = showTradeMenu; window.tradeItem = tradeItem; window.toggleMagicBag = toggleMagicBag; window.createCampaign = createCampaign; window.showCreateCampaign = showCreateCampaign; window.hideCreateCampaign = hideCreateCampaign; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole;