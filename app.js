// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';

let party = [];
let appConfig = { combat: true, loot: true, community: true };
let srdData = { classes: [], races: [], genders: [], monsters: [], weapons: [], armor: [], items: [], trinkets: [] };
let diceTray = [];
let currentLoot = null;

const badWords = ["mierda", "puta", "joder", "cabron", "cojones"];

// --- UTILIDADES ---
const calculateMod = (val) => {
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

const filterProfanity = (text) => {
    let filtered = text;
    badWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filtered = filtered.replace(regex, "****");
    });
    return filtered;
};

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_current_campaign', currentCampaignId);
    localStorage.setItem('dnd_role', currentRole);
}

// --- LÓGICA DE LOBBY ---
function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    if (!container) return;
    if (campaigns.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic;">No hay campañas. ¡Crea la primera!</p>';
        return;
    }
    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item" onclick="selectCampaign('${c.id}')">
            <h3 style="font-family:'Cinzel'; color:var(--gold); margin:0;">${c.name}</h3>
            <p style="font-size:0.9rem; color:#888; margin:5px 0 0;">${c.party.length} Héroes</p>
        </div>
    `).join('');
}

function showCreateCampaign() { 
    document.getElementById('create-campaign-form').style.display = 'block';
    document.getElementById('campaign-list').style.display = 'none';
}

function hideCreateCampaign() { 
    document.getElementById('create-campaign-form').style.display = 'none';
    document.getElementById('campaign-list').style.display = 'block';
}

function createCampaign() {
    const nameInput = document.getElementById('new-campaign-name');
    const name = nameInput.value.trim();
    if (!name) return;
    const newCamp = { id: 'camp_' + Date.now(), name, party: [], notices: [], config: { combat: true, loot: true, community: true } };
    campaigns.push(newCamp);
    saveAll();
    nameInput.value = '';
    hideCreateCampaign();
    renderCampaignList();
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return exitToLobby();
    currentCampaignId = id;
    party = camp.party;
    appConfig = camp.config;
    saveAll();
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title-display').innerText = camp.name;
    applyRoleUI();
    renderNavigation();
    showTab('tab-home');
}

function exitToLobby() {
    currentCampaignId = null;
    saveAll();
    document.getElementById('lobby-overlay').style.display = 'flex';
    renderCampaignList();
}

// --- ROLES ---
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
    document.body.className = isMaster ? 'is-master' : 'is-adventurer';
}

// --- DADOS GLOBALES ---
function toggleDiceTray() {
    const tray = document.getElementById('dice-overlay');
    if(!tray) return;
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
    document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${total}</div><div style="color:#666; font-size:1rem;">[${br.join(' + ')}]</div>`;
}

// --- CARGA DE DATOS SRD ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        console.log("SRD Data cargada:", srdData);
        populateSelects();
        
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

// --- GREMIO ---
function createCharacter() {
    const nameInput = document.getElementById('char-name');
    const name = nameInput.value.trim();
    if (!name) return alert("Indica un nombre.");
    
    const classData = srdData.classes.find(c => c.name === document.getElementById('char-class').value);
    const stats = { 
        str: Math.min(20, parseInt(document.getElementById('char-str').value)||10), 
        dex: Math.min(20, parseInt(document.getElementById('char-dex').value)||10), 
        con: Math.min(20, parseInt(document.getElementById('char-con').value)||10), 
        int: Math.min(20, parseInt(document.getElementById('char-int').value)||10), 
        wis: Math.min(20, parseInt(document.getElementById('char-wis').value)||10), 
        cha: Math.min(20, parseInt(document.getElementById('char-cha').value)||10) 
    };
    
    const inventory = [];
    if(classData && classData.starting_items) {
        classData.starting_items.forEach(it => {
            const found = [...srdData.weapons, ...srdData.armor, ...srdData.items].find(i=>i.name===it);
            if(found) inventory.push({...found});
        });
    }

    const newChar = { id: Date.now(), name, race: document.getElementById('char-race').value, charClass: classData.name, gender: document.getElementById('char-gender').value, level:1, hp: classData.hit_die, stats, hasMagicBag: false, wallet:{cp:0,sp:0,gp:0,pp:0,ep:0}, inventory };
    
    party.push(newChar);
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if(camp) camp.party = party;
    saveAll();
    renderParty();
    nameInput.value = '';
}

function renderParty() {
    const container = document.getElementById('character-list'); if (!container) return;
    if (party.length === 0) { container.innerHTML = '<p style="color:#666; text-align:center; padding:20px;">No hay héroes en este grupo.</p>'; return; }
    container.innerHTML = party.map(c => `
        <div class="char-card" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="char-info"><h3>${c.name}</h3><p>${c.gender} | ${c.race} ${c.charClass}</p></div>
                <div style="display:flex; gap:12px; align-items:center;">
                    ${currentRole === 'master' ? `<div style="text-align:center;"><label class="switch" style="transform:scale(0.8);"><input type="checkbox" ${c.hasMagicBag ? 'checked' : ''} onchange="toggleMagicBag(${c.id})"><span class="slider"></span></label></div>` : ''}
                    <button onclick="toggleInventory(${c.id})" style="background:transparent; border:1px solid var(--gold); color:var(--gold); border-radius:10px; width:50px; height:50px;"><i class="fa-solid fa-sack-xmark"></i></button>
                    ${currentRole === 'master' ? `<button class="btn-delete" onclick="deleteCharacter(${c.id})"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; background: #000; padding: 15px; border-radius: 12px; border: 1px solid #222;">
                ${Object.entries(c.stats).map(([s, v]) => `<div style="font-size:0.85rem; color:#888;">${s.toUpperCase()}: <b style="color:var(--gold)">${v}</b><br><span style="color:#fff;">(${calculateMod(v)})</span></div>`).join('')}
            </div>
            <div id="inv-${c.id}" style="display:none; margin-top:10px; border-top:1px solid #222; padding-top:15px;"><div id="inv-list-${c.id}"></div></div>
        </div>
    `).join('');
}

// --- TABLÓN ---
function renderNotices() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const container = document.getElementById('notices-container');
    if (!camp || !container) return;
    const notices = camp.notices || [];
    if (notices.length === 0) { container.innerHTML = '<p style="color:#666; font-style:italic; margin-top:20px; text-align:center;">Tablón vacío.</p>'; return; }
    container.innerHTML = notices.map((n, idx) => `<div class="notice-card">${currentRole==='master' ? `<i class="fa-solid fa-trash-can" onclick="deleteNotice(${idx})" style="position:absolute; right:15px; top:15px; color:#ff4444; cursor:pointer;"></i>`:''}<h3>${n.title}</h3><p>${n.content}</p><div class="notice-reward">RECOMPENSA: ${n.reward}</div></div>`).join('');
}

function publishNotice() {
    if (currentRole !== 'master') return;
    const t = document.getElementById('notice-title').value;
    const c = document.getElementById('notice-content').value;
    const r = document.getElementById('notice-reward').value;
    if (!t || !c) return;
    const camp = campaigns.find(ca => ca.id === currentCampaignId);
    if (!camp.notices) camp.notices = [];
    camp.notices.unshift({ title: filterProfanity(t), content: filterProfanity(c), reward: filterProfanity(r || "Honor") });
    saveAll(); renderNotices();
    document.getElementById('notice-title').value = ''; document.getElementById('notice-content').value = ''; document.getElementById('notice-reward').value = '';
}

function deleteNotice(idx) {
    const camp = campaigns.find(ca => ca.id === currentCampaignId);
    camp.notices.splice(idx, 1); saveAll(); renderNotices();
}

// --- INVENTARIO ---
function toggleInventory(charId) {
    const div = document.getElementById(`inv-${charId}`);
    const isShowing = div.style.display === 'block';
    document.querySelectorAll('[id^="inv-"]').forEach(d => d.style.display = 'none');
    if (!isShowing) { div.style.display = 'block'; renderInventory(charId); }
}

function renderInventory(charId) {
    const char = party.find(c => c.id == charId);
    const container = document.getElementById(`inv-list-${charId}`);
    if (!char || !container) return;
    let currentWeight = 0; char.inventory.forEach(i => currentWeight += (i.weight || 0));
    const capacity = (char.stats.str * 15) + (char.hasMagicBag ? 500 : 0);
    const isHeavilyEncumbered = currentWeight > capacity;
    container.innerHTML = `
        <div style="margin-bottom:15px; padding:15px; background:#000; border-radius:8px; border:1px solid ${isHeavilyEncumbered ? '#ff4444' : '#333'}">
            <span style="color:var(--gold); font-weight:bold;">CARGA: ${currentWeight.toFixed(1)} / ${capacity} lb</span>
            <div style="height:10px; background:#222; margin-top:10px; border-radius:5px;"><div style="height:100%; width:${Math.min(100, (currentWeight/capacity)*100)}%; background:${isHeavilyEncumbered ? '#ff4444' : '#44bb44'}; transition:0.3s; border-radius:5px;"></div></div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">
            ${Object.entries(char.wallet).map(([t, v]) => `<div onclick="spendCoins('${charId}', '${t}')" style="background:#222; border:1px solid ${getCoinColor(t)}; padding:8px 15px; border-radius:8px; cursor:pointer; font-size:1.1rem; font-weight:bold;">${v} ${t}</div>`).join('')}
        </div>
        ${char.inventory.length === 0 ? '<p style="color:#666; text-align:center;">Mochila vacía.</p>' : char.inventory.map((item, idx) => `
            <div style="background:#111; padding:15px; border-radius:10px; margin-bottom:10px; border:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <span>• ${item.name} <br><small style="color:#666;">${item.weight} lb</small></span>
                <div style="display:flex; gap:12px;">
                    <button onclick="giveToNPC('${charId}', ${idx})" style="background:transparent; border:none; color:#ff4444; font-size:1.4rem;"><i class="fa-solid fa-hand-holding-dollar"></i></button>
                    <button onclick="showTradeMenu('${charId}', ${idx})" style="background:transparent; border:none; color:var(--gold); font-size:1.4rem;"><i class="fa-solid fa-arrows-left-right"></i></button>
                </div>
            </div>
            <div id="trade-menu-${charId}-${idx}" style="display:none; margin-top:10px; background:#1a1a1a; padding:10px; border-radius:8px;"></div>
        `).join('')}
    `;
}

function spendCoins(charId, type) {
    const char = party.find(c => c.id == charId);
    const amount = prompt(`Gastar ${type} (Máx: ${char.wallet[type]})`);
    const val = parseInt(amount);
    if (val > 0 && val <= char.wallet[type]) { char.wallet[type] -= val; saveAll(); renderInventory(charId); }
}

function giveToNPC(charId, idx) {
    const char = party.find(c => c.id == charId);
    if (confirm(`¿Entregar "${char.inventory[idx].name}" a un NPC?`)) { char.inventory.splice(idx, 1); saveAll(); renderInventory(charId); }
}

function showTradeMenu(charId, idx) {
    const menu = document.getElementById(`trade-menu-${charId}-${idx}`); menu.style.display = 'block';
    menu.innerHTML = `<p style="font-size:0.8rem; color:var(--gold); margin-bottom:10px;">Intercambiar con:</p>` + 
        party.filter(c => c.id != charId).map(c => `<button onclick="tradeItem('${charId}', '${c.id}', ${idx})" style="width:100%; background:#333; color:#fff; padding:12px; margin-bottom:8px; border:none; border-radius:6px; font-weight:bold;">${c.name}</button>`).join('') + 
        `<button onclick="this.parentElement.style.display='none'" style="width:100%; color:#666; background:transparent; border:none0; margin-top:5px;">CERRAR</button>`;
}

function tradeItem(fromId, toId, idx) {
    const from = party.find(c => c.id == fromId); const to = party.find(c => c.id == toId);
    const item = from.inventory.splice(idx, 1)[0]; to.inventory.push(item); saveAll(); renderInventory(fromId);
}

// --- NAVEGACIÓN ---
function renderNavigation() {
    const nav = document.getElementById('main-nav'); if (!nav) return;
    const isM = currentRole === 'master';
    nav.innerHTML = `
        <button onclick="showTab('tab-home')" id="btn-nav-home"><i class="fa-solid fa-house-chimney"></i><span>Inicio</span></button>
        ${isM ? `<button onclick="showTab('tab-combat')" id="btn-nav-combat"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button>` : ''}
        ${isM ? `<button onclick="showTab('tab-loot')" id="btn-nav-loot"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}
        <button onclick="showTab('tab-community')" id="btn-nav-community"><i class="fa-solid fa-bullhorn"></i><span>Tablón</span></button>
        <button onclick="showTab('tab-party')" id="btn-nav-party"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>
    `;
    renderConfigToggles();
}

function renderConfigToggles() {
    const c = document.getElementById('config-panel'); if (!c || currentRole !== 'master') { if(c) c.innerHTML=''; return; }
    const m = [{id:'combat',label:'Bestiario',icon:'fa-shield-halved'},{id:'loot',label:'Generador Oro',icon:'fa-gem'},{id:'community',label:'Tablón Misiones',icon:'fa-bullhorn'}];
    c.innerHTML = `<h2 style="font-size:1.3rem; margin-bottom:20px;">Configuración Master</h2>` + m.map(x => `<div class="module-row" style="padding:18px 0;"><div class="module-label"><i class="fa-solid ${x.icon}"></i> <span style="font-size:1.1rem;">${x.label}</span></div><label class="switch"><input type="checkbox" ${appConfig[x.id] ? 'checked' : ''} onchange="toggleModule('${x.id}')"><span class="slider"></span></label></div>`).join('');
}

function toggleModule(m) { appConfig[m] = !appConfig[m]; saveAll(); renderNavigation(); }

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(t);
    if(target) target.style.display = 'block';
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-nav-${t.replace('tab-', '')}`);
    if (btn) btn.classList.add('active');
    if(t === 'tab-party') renderParty();
    if(t === 'tab-combat') renderBestiary();
    if(t === 'tab-loot') renderLootTable();
    if(t === 'tab-community') renderNotices();
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

document.addEventListener('DOMContentLoaded', async () => { 
    await loadSRDData(); 
});

// Exponer funciones
window.showTab = showTab; window.toggleModule = toggleModule; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.deleteCharacter = deleteCharacter; window.generateLoot = generateLoot; window.assignCoins = assignCoins; window.confirmAssignCoins = confirmAssignCoins; window.showAssignItem = showAssignItem; window.confirmAssignItem = confirmAssignItem; window.toggleInventory = toggleInventory; window.spendCoins = spendCoins; window.giveToNPC = giveToNPC; window.showTradeMenu = showTradeMenu; window.tradeItem = tradeItem; window.toggleMagicBag = toggleMagicBag; window.createCampaign = createCampaign; window.showCreateCampaign = showCreateCampaign; window.hideCreateCampaign = hideCreateCampaign; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.publishNotice = publishNotice; window.deleteNotice = deleteNotice;