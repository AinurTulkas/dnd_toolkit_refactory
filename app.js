// --- ESTADO ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let globalNotices = JSON.parse(localStorage.getItem('dnd_global_notices')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let srdData = { classes: [], races: [], monsters: [], items: [], weapons: [] };
let activeTrade = null;

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_global_notices', JSON.stringify(globalNotices));
    localStorage.setItem('dnd_current_campaign', currentCampaignId || "");
    localStorage.setItem('dnd_role', currentRole);
}

// --- MODAL SYSTEM ---
function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    body.innerHTML = html;
    overlay.style.display = 'flex';
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

// --- LOBBY ---
function init() {
    renderCampaignList();
    renderGlobalBoard();
    if (currentCampaignId) {
        selectCampaign(currentCampaignId);
    }
    loadSRDData();
}

function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    if (!container) return;
    if (campaigns.length === 0) {
        container.innerHTML = '<p style="color:#444; font-style:italic; text-align:center;">No hay aventuras creadas.</p>';
        return;
    }
    
    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item">
            <div onclick="window.selectCampaign('${c.id}')" style="flex:1; cursor:pointer;">
                <h3 style="margin:0;">${c.name}</h3>
                <p style="margin:0; font-size:0.7rem; color:#666;">${(c.party || []).length} Héroes activos</p>
            </div>
            <div style="display:flex; gap:15px; font-size:1.2rem;">
                <i class="fa-solid fa-pen-to-square" onclick="window.showCampaignForm('${c.id}')" style="color:var(--gold); cursor:pointer;"></i>
                <i class="fa-solid fa-trash" onclick="window.confirmDeleteCampaign('${c.id}')" style="color:var(--danger); cursor:pointer;"></i>
            </div>
        </div>
    `).join('');
}

function showCampaignForm(id = null) {
    const camp = id ? campaigns.find(c => c.id === id) : null;
    openModal(`
        <h2 class="cinzel">${id ? 'Editar' : 'Nueva'} Campaña</h2>
        <input type="text" id="form-camp-name" value="${camp ? camp.name : ''}" placeholder="Nombre de la aventura...">
        <button onclick="window.saveCampaign('${id || ''}')" class="btn-primary">GUARDAR</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:10px; width:100%;">CANCELAR</button>
    `);
}

function saveCampaign(id) {
    const name = document.getElementById('form-camp-name').value.trim();
    if (!name) return;
    if (id) {
        const camp = campaigns.find(c => c.id === id);
        if (camp) camp.name = name;
    } else {
        campaigns.push({ id: 'camp_' + Date.now(), name, party: [], notices: [] });
    }
    saveAll(); renderCampaignList(); closeModal();
}

function confirmDeleteCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    openModal(`
        <h2 class="cinzel" style="color:var(--danger);">¿Borrar Aventura?</h2>
        <p>Se eliminará "${camp.name}" y todos sus datos.</p>
        <button onclick="window.deleteCampaign('${id}')" class="btn-primary">BORRAR</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:10px; width:100%;">CANCELAR</button>
    `);
}

function deleteCampaign(id) {
    campaigns = campaigns.filter(c => c.id !== id);
    if (currentCampaignId === id) currentCampaignId = null;
    saveAll(); renderCampaignList(); closeModal();
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return;
    currentCampaignId = id;
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('role-indicator').style.display = 'inline-block';
    document.getElementById('campaign-title').innerText = camp.name;
    applyRoleUI(); renderNavigation(); renderLocalBoard(); showTab('tab-home');
}

function exitToLobby() { currentCampaignId = null; saveAll(); location.reload(); }

// --- TABLONES ---
function renderGlobalBoard() {
    const res = document.getElementById('global-board');
    if (!res) return;
    res.innerHTML = globalNotices.map((n) => `
        <div style="border-bottom:1px solid #111; padding:10px 0;">
            <p style="margin:0; color:var(--gold); font-size:0.9rem;"><b>${n.title}</b></p>
            <p style="margin:0; font-size:0.8rem; color:#888;">${n.text}</p>
        </div>
    `).join('') || '<p style="color:#444; font-size:0.8rem; text-align:center;">No hay anuncios mundiales.</p>';
}

function openGlobalNoticeModal() {
    openModal(`
        <h2 class="cinzel">Anuncio Mundial</h2>
        <input type="text" id="g-title" placeholder="Título (ej: Se buscan Jugadores)">
        <textarea id="g-text" placeholder="Tu mensaje..." style="height:80px;"></textarea>
        <button onclick="window.postGlobalNotice()" class="btn-primary">PUBLICAR</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:10px; width:100%;">VOLVER</button>
    `);
}

function postGlobalNotice() {
    const title = document.getElementById('g-title').value.trim();
    const text = document.getElementById('g-text').value.trim();
    if (!title || !text) return;
    globalNotices.unshift({ title, text, date: Date.now() });
    if (globalNotices.length > 5) globalNotices.pop();
    saveAll(); renderGlobalBoard(); closeModal();
}

function renderLocalBoard() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const res = document.getElementById('local-board');
    res.innerHTML = (camp.notices || []).map((n, i) => `
        <div class="card" style="background:#0a0a0a; position:relative;">
            <h3 style="margin:0;">${n.title}</h3>
            ${currentRole === 'master' ? `<i class="fa-solid fa-trash" onclick="window.deleteMission(${i})" style="position:absolute; top:20px; right:20px; color:var(--danger); cursor:pointer;"></i>` : ''}
            <p style="font-size:0.9rem; white-space:pre-wrap; margin-top:10px;">${n.text}</p>
        </div>
    `).join('') || '<p style="color:#444; text-align:center;">Misiones vácías.</p>';
}

function addMission() {
    const title = document.getElementById('mission-title').value.trim();
    const text = document.getElementById('mission-text').value.trim();
    if (!title || !text) return;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp.notices) camp.notices = [];
    camp.notices.unshift({ title, text });
    saveAll(); renderLocalBoard();
    document.getElementById('mission-title').value = '';
    document.getElementById('mission-text').value = '';
}

function deleteMission(idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    camp.notices.splice(idx, 1);
    saveAll(); renderLocalBoard();
}

// --- TRATO NPC (MASTER) ---
function openNPCTrade(charId) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    activeTrade = {
        charId: charId,
        giveItems: [],
        receiveGold: 0,
        receiveItems: [],
        p1Confirmed: false,
        p2Confirmed: false
    };
    renderNPCTradeUI(char);
}

function renderNPCTradeUI(char) {
    openModal(`
        <h2 class="cinzel">Trato con NPC</h2>
        <div class="trade-grid">
            <div class="trade-side">
                <h3 style="color:white; font-size:0.8rem; margin-top:0;">DEDUCCIÓN (Aventurero paga)</h3>
                <div style="max-height:100px; overflow-y:auto; font-size:0.8rem;">
                    ${char.inventory.map((it, i) => `<div><label><input type="checkbox" onchange="window.updateNPCGive(${i})"> ${it.name}</label></div>`).join('') || 'Mochila vacía'}
                </div>
            </div>
            <div class="trade-side">
                <h3 style="color:white; font-size:0.8rem; margin-top:0;">GENERACIÓN (NPC entrega)</h3>
                <input type="number" id="npc-gold" placeholder="Oro gp..." oninput="activeTrade.receiveGold=this.value">
                <input type="text" id="npc-item-search" placeholder="Generar ítem..." onkeyup="window.searchNPCItems()">
                <div id="npc-search-results" style="font-size:0.7rem; color:var(--gold); margin-bottom:5px;"></div>
                <div id="npc-pending-items" style="font-size:0.8rem; color:#aaa;"></div>
            </div>
        </div>
        <div style="margin-top:15px; display:flex; gap:10px;">
            <button id="btn-npc-p1" onclick="window.confirmNPCPart(1)" class="btn-primary" style="font-size:0.7rem; background:#444;">SELLAR POR NPC</button>
            <button id="btn-npc-p2" onclick="window.confirmNPCPart(2)" class="btn-primary" style="font-size:0.7rem; background:#444;">SELLAR POR AVENTURERO</button>
        </div>
        <button id="btn-npc-exec" onclick="window.executeNPCTrade()" class="btn-primary" style="display:none; background:var(--success); margin-top:10px;">CERRAR TRATO</button>
    `);
}

function updateNPCGive(idx) {
    if (activeTrade.giveItems.includes(idx)) activeTrade.giveItems = activeTrade.giveItems.filter(i => i !== idx);
    else activeTrade.giveItems.push(idx);
}

function searchNPCItems() {
    const q = document.getElementById('npc-item-search').value.toLowerCase();
    const res = document.getElementById('npc-search-results');
    if (q.length < 2) return res.innerHTML = '';
    const matches = [...srdData.items, ...srdData.weapons].filter(i => i.name.toLowerCase().includes(q)).slice(0, 3);
    res.innerHTML = matches.map(m => `<div onclick="window.addNPCItem('${m.name}')" style="cursor:pointer; padding:5px; border-bottom:1px solid #222;">+ ${m.name}</div>`).join('') + `<div onclick="window.addNPCItem('${document.getElementById('npc-item-search').value}')" style="color:white; cursor:pointer; padding:5px;">+ [Manual]: ${document.getElementById('npc-item-search').value}</div>`;
}

function addNPCItem(name) {
    activeTrade.receiveItems.push(name);
    document.getElementById('npc-pending-items').innerHTML = activeTrade.receiveItems.map(i => `• ${i}`).join('<br>');
}

function confirmNPCPart(n) {
    if (n === 1) { activeTrade.p1Confirmed = true; document.getElementById('btn-npc-p1').style.background = 'var(--success)'; }
    if (n === 2) { activeTrade.p2Confirmed = true; document.getElementById('btn-npc-p2').style.background = 'var(--success)'; }
    if (activeTrade.p1Confirmed && activeTrade.p2Confirmed) document.getElementById('btn-npc-exec').style.display = 'block';
}

function executeNPCTrade() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == activeTrade.charId);
    activeTrade.giveItems.sort((a,b) => b-a).forEach(idx => char.inventory.splice(idx, 1));
    char.wallet.gp += parseInt(activeTrade.receiveGold) || 0;
    activeTrade.receiveItems.forEach(name => char.inventory.push({ name, weight: 1 }));
    saveAll(); closeModal(); renderParty();
}

// --- SRD & SEARCH ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        populateSelects();
    } catch (e) { console.warn("SRD fail"); }
}

function populateSelects() {
    const cc = document.getElementById('char-class');
    const cr = document.getElementById('char-race');
    if (cc && cr && srdData.classes) {
        cc.innerHTML = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        cr.innerHTML = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    }
}

function searchMonsters() {
    const q = document.getElementById('monster-search').value.toLowerCase();
    const res = document.getElementById('search-results');
    if (!q) return res.innerHTML = '';
    const matches = srdData.monsters.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5);
    res.innerHTML = matches.map(m => `<div onclick="window.showMonsterModal('${m.name}')" class="campaign-item" style="font-size:0.8rem; cursor:pointer;">${m.name} (CR ${m.cr})</div>`).join('');
}

function showMonsterModal(name) {
    const m = srdData.monsters.find(mo => mo.name === name);
    openModal(`
        <h2 class="cinzel">${m.name}</h2>
        <p style="color:#888;">${m.type} | CR: ${m.cr}</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center;">
            <div style="background:#000; padding:10px; border-radius:8px;">CA<br><b style="color:var(--gold);">${m.ac}</b></div>
            <div style="background:#000; padding:10px; border-radius:8px;">Vida<br><b style="color:#ff4444;">${m.hp}</b></div>
        </div>
        <button onclick="window.goToLootFromMonster('${m.cr}')" class="btn-primary" style="margin-top:20px;">DERROTADO (BOTÍN)</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:10px; width:100%;">CERRAR</button>
    `);
}

function goToLootFromMonster(cr) {
    closeModal(); showTab('tab-loot');
    document.getElementById('loot-cr').value = eval(cr);
    if (eval(cr) >= 5) document.getElementById('is-lair-loot').checked = true;
}

// --- BOTÍN ---
function generateLoot() {
    const cr = eval(document.getElementById('loot-cr').value) || 1;
    const isLair = document.getElementById('is-lair-loot').checked;
    const coins = (Math.floor(Math.random() * 20) + 10) * cr * (isLair ? 10 : 1);
    const isFake = Math.random() < 0.12;
    const gp = Math.floor(coins * 0.025);
    
    openModal(`
        <h2 class="cinzel">Tesoro Hallado ${isFake && currentRole === 'master' ? '⚠️' : ''}</h2>
        <div style="text-align:center; font-size:2rem; margin:20px 0;">💰 ${gp} gp</div>
        <div id="loot-assign-area">
            <button onclick="window.assignLootToAll(${gp}, ${isFake})" class="btn-primary" style="background:#004488;">DIVIDIR ENTRE TODOS</button>
            <p style="text-align:center; margin:10px 0; font-size:0.8rem; color:#666;">- o entregar a uno -</p>
            <select id="loot-target" style="margin-bottom:10px;">${(campaigns.find(c => c.id === currentCampaignId).party || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
            <button onclick="window.assignLootToOne(${gp}, ${isFake})" class="btn-primary">ENTREGAR</button>
        </div>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">DESCARTAR</button>
    `);
}

function assignLootToAll(gp, isFake) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const share = Math.floor(gp / camp.party.length);
    camp.party.forEach(p => { if(isFake) p.wallet.gp_fake += share; else p.wallet.gp += share; });
    saveAll(); closeModal(); renderParty();
}

function assignLootToOne(gp, isFake) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const targetId = document.getElementById('loot-target').value;
    const p = camp.party.find(hero => hero.id == targetId);
    if(isFake) p.wallet.gp_fake += gp; else p.wallet.gp += gp;
    saveAll(); closeModal(); renderParty();
}

// --- PARTY ---
function renderParty() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const res = document.getElementById('character-list');
    res.innerHTML = (camp.party || []).map(c => `
        <div class="campaign-item">
            <div onclick="window.toggleInventory(${c.id})" style="flex:1; cursor:pointer;">
                <h3 style="margin:0;">${c.name}</h3>
                <p style="margin:0; font-size:0.8rem; color:#888;">💰 ${c.wallet.gp + (c.wallet.gp_fake||0)} gp</p>
            </div>
            ${currentRole === 'master' ? `<button onclick="window.openNPCTrade(${c.id})" class="btn-secondary" style="font-size:0.6rem;">TRATO NPC</button>` : ''}
            <div id="inv-${c.id}" style="display:none; width:100%; margin-top:10px; background:#000; padding:10px; border-radius:5px; font-size:0.8rem;">
                ${c.inventory.map(it => `• ${it.name}`).join('<br>') || 'Vacía'}
                ${(currentRole === 'master' && c.wallet.gp_fake > 0) ? `<p style="color:red; margin-top:5px;">⚠️ ORO FALSO: ${c.wallet.gp_fake} gp</p>` : ''}
            </div>
        </div>
    `).join('') || '<p style="color:#444; text-align:center;">No hay héroes.</p>';
}

function showCharForm() {
    openModal(`
        <h2 class="cinzel">Nuevo Héroe</h2>
        <input type="text" id="form-char-name" placeholder="Nombre...">
        <button onclick="window.createCharacter()" class="btn-primary">CREAR PERSONAJE</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:10px; width:100%;">CANCELAR</button>
    `);
}

function createCharacter() {
    const name = document.getElementById('form-char-name').value.trim();
    if (!name) return;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    camp.party.push({
        id: Date.now(), name, level: 1, inventory: [],
        wallet: { gp: 0, gp_fake: 0, sp: 0, sp_fake: 0, cp: 0, cp_fake: 0 }
    });
    saveAll(); renderParty(); closeModal();
}

function toggleInventory(id) {
    const d = document.getElementById('inv-' + id);
    if (d) d.style.display = (d.style.display === 'none' ? 'block' : 'none');
}

// --- NAVEGACION ---
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(t);
    if (target) target.style.display = 'block';
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
}

function renderNavigation() {
    const isM = currentRole === 'master';
    document.getElementById('main-nav').innerHTML = `
        <button onclick="window.showTab('tab-home')"><i class="fa-solid fa-house"></i><span>Home</span></button>
        ${isM ? `<button onclick="window.showTab('tab-combat')"><i class="fa-solid fa-bolt"></i><span>Batalla</span></button>` : ''}
        ${isM ? `<button onclick="window.showTab('tab-loot')"><i class="fa-solid fa-coins"></i><span>Oro</span></button>` : ''}
        <button onclick="window.showTab('tab-notices')"><i class="fa-solid fa-bullhorn"></i><span>Misiones</span></button>
        <button onclick="window.showTab('tab-party')"><i class="fa-solid fa-users"></i><span>Gremio</span></button>
    `;
}

function applyRoleUI() {
    document.getElementById('role-text').innerText = currentRole.toUpperCase();
}

function changeRole() {
    currentRole = document.getElementById('role-selector').value;
    saveAll(); applyRoleUI(); renderNavigation(); renderParty(); renderLocalBoard();
}

function generateEncounter(mode) {
    const apl = 1;
    const target = mode === 'hard' ? apl + 1 : apl;
    const matches = srdData.monsters.filter(mo => eval(mo.cr) == target);
    if (matches.length === 0) return alert("No hay monstruos de ese CR.");
    const res = matches[Math.floor(Math.random() * matches.length)];
    window.showMonsterModal(res.name);
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', init);

// Bindings globales
window.showTab = showTab;
window.selectCampaign = selectCampaign;
window.exitToLobby = exitToLobby;
window.showCampaignForm = showCampaignForm;
window.saveCampaign = saveCampaign;
window.confirmDeleteCampaign = confirmDeleteCampaign;
window.deleteCampaign = deleteCampaign;
window.closeModal = closeModal;
window.openGlobalNoticeModal = openGlobalNoticeModal;
window.postGlobalNotice = postGlobalNotice;
window.addMission = addMission;
window.deleteMission = deleteMission;
window.generateEncounter = generateEncounter;
window.searchMonsters = searchMonsters;
window.showMonsterModal = showMonsterModal;
window.goToLootFromMonster = goToLootFromMonster;
window.generateLoot = generateLoot;
window.assignLootToAll = assignLootToAll;
window.assignLootToOne = assignLootToOne;
window.showCharForm = showCharForm;
window.createCharacter = createCharacter;
window.toggleInventory = toggleInventory;
window.openNPCTrade = openNPCTrade;
window.updateNPCGive = updateNPCGive;
window.searchNPCItems = searchNPCItems;
window.addNPCItem = addNPCItem;
window.confirmNPCPart = confirmNPCPart;
window.executeNPCTrade = executeNPCTrade;
window.changeRole = changeRole;