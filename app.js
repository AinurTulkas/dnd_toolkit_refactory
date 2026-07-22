// --- ESTADO ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let globalNotices = JSON.parse(localStorage.getItem('dnd_global_notices')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let srdData = { classes: [], races: [], monsters: [], items: [], weapons: [] };
let activeTrade = null;

let userTier = JSON.parse(localStorage.getItem('dnd_user_tier')) || { level: 'free', maxParties: 6, rolls: [] };
function saveTier() { localStorage.setItem('dnd_user_tier', JSON.stringify(userTier)); }

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_global_notices', JSON.stringify(globalNotices));
    localStorage.setItem('dnd_current_campaign', currentCampaignId || "");
    localStorage.setItem('dnd_role', currentRole);
}

// --- UTILIDADES ---
function normalizeText(text) {
    const numbers = { 'cero':0, 'uno':1, 'dos':2, 'tres':3, 'cuatro':4, 'cinco':5, 'seis':6, 'siete':7, 'ocho':8, 'nueve':9, 'diez':10 };
    let clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let [word, val] of Object.entries(numbers)) { clean = clean.replace(new RegExp(word, 'g'), val); }
    return clean;
}

function isSpam(text) {
    const clean = normalizeText(text);
    const digits = clean.replace(/[^0-9]/g, '');
    return digits.length >= 7; 
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // En lugar de alert, usamos un feedback visual discreto si existiera, 
        // pero por ahora el usuario no quiere alertas nativas.
        console.log("Copiado: " + text);
    });
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
    renderLobby();
    loadSRDData();
    if (currentCampaignId) selectCampaign(currentCampaignId, currentRole);
}

function renderLobby() {
    const container = document.getElementById('lobby-overlay');
    if (!container) return;
    
    container.innerHTML = `
        <header style="padding:40px 20px; text-align:center;">
            <h1 style="font-size:3rem; margin:0; letter-spacing:4px;">GRIMOIRE PRO</h1>
            <p style="color:var(--gold-muted); font-style:italic;">Asistente para Dungeon Masters</p>
        </header>
        <div style="max-width:700px; margin:0 auto; padding:0 20px;">
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 class="cinzel">Tablón Global</h2>
                    <button onclick="window.openGlobalNoticeModal()" class="btn-secondary" style="font-size:0.8rem; border-color:var(--gold);">+ ANUNCIO PP</button>
                </div>
                <div id="global-board" style="max-height:250px; overflow-y:auto; background:#000; padding:15px; border-radius:8px;"></div>
            </div>

            <div class="card">
                <h2 class="cinzel">Mis Campañas (Master)</h2>
                <div id="master-campaigns"></div>
                <button onclick="window.showCampaignForm()" class="btn-primary" style="margin-top:20px;">INICIAR NUEVA AVENTURA</button>
                <button onclick="window.rollForLimit()" class="btn-secondary" style="margin-top:10px; width:100%; border-style:dashed; border-color:var(--gold);">[TEST] PROBAR DADO D20</button>
            </div>

            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h2 class="cinzel">Mis Aventuras (Jugador)</h2>
                    <button onclick="window.showJoinForm()" class="btn-secondary" style="font-size:0.8rem; border-color:var(--gold);">+ UNIRSE</button>
                </div>
                <div id="player-campaigns"></div>
            </div>
        </div>
    `;
    renderGlobalBoard();
    renderCampaignLists();
}

function renderCampaignLists() {
    const mContainer = document.getElementById('master-campaigns');
    const pContainer = document.getElementById('player-campaigns');
    
    const masterCamps = campaigns.filter(c => !c.isJoined);
    const playerCamps = campaigns.filter(c => c.isJoined);
    
    if (masterCamps.length === 0) {
        mContainer.innerHTML = '<p style="color:#444; font-style:italic; text-align:center;">No eres Master en ninguna campaña.</p>';
    } else {
        mContainer.innerHTML = masterCamps.map(c => renderCampaignItem(c, 'master')).join('');
    }
    
    if (playerCamps.length === 0) {
        pContainer.innerHTML = '<p style="color:#444; font-style:italic; text-align:center;">No te has unido a ninguna aventura.</p>';
    } else {
        pContainer.innerHTML = playerCamps.map(c => renderCampaignItem(c, 'adventurer')).join('');
    }
}

function renderCampaignItem(c, role) {
    const isMaster = role === 'master';
    return `
        <div class="campaign-item">
            <div onclick="window.selectCampaign('${c.id}', '${role}')" style="flex:1; cursor:pointer;">
                <h3 style="margin:0; color:var(--gold);">${c.name}</h3>
                <p style="margin:0; font-size:0.8rem; color:#666;">${(c.party || []).length} Héroes • ${role.toUpperCase()}</p>
            </div>
            <div style="display:flex; gap:20px; font-size:1.4rem; align-items:center;">
                ${!isMaster ? `<i class="fa-solid fa-crown" onclick="event.stopPropagation(); window.reclaimMaster('${c.id}')" style="color:var(--gold); cursor:pointer; font-size:1.1rem;" title="Reclamar Trono (Dungeon Master)"></i>` : ''}
                ${isMaster ? `<i class="fa-solid fa-share-nodes" onclick="event.stopPropagation(); window.copyInviteCode('${c.id}')" style="color:var(--gold); cursor:pointer; font-size:1.1rem;" title="Copiar Código"></i>` : ''}
                <i class="fa-solid fa-pen-to-square" onclick="event.stopPropagation(); window.showCampaignForm('${c.id}')" style="color:var(--gold); cursor:pointer;"></i>
                <i class="fa-solid fa-trash" onclick="event.stopPropagation(); window.confirmDeleteCampaign('${c.id}')" style="color:var(--danger); cursor:pointer;"></i>
            </div>
        </div>
    `;
}

function copyInviteCode(id) {
    copyToClipboard(id);
    openModal(`
        <h2 class="cinzel" style="text-align:center;">Código Copiado</h2>
        <p style="text-align:center;">Envía este código a tus jugadores:</p>
        <div style="background:#000; padding:15px; border-radius:8px; text-align:center; font-family:monospace; color:var(--gold); font-size:1.2rem; border:1px solid var(--gold-muted); margin:15px 0;">
            ${id}
        </div>
        <button onclick="window.closeModal()" class="btn-primary">ENTENDIDO</button>
    `);
}

function showJoinForm() {
    openModal(`
        <h2 class="cinzel">Unirse a Aventura</h2>
        <p>Pega el código que te envió tu Dungeon Master:</p>
        <input type="text" id="join-code" placeholder="camp_123456789...">
        <button onclick="window.joinCampaign()" class="btn-primary">UNIRSE</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">CANCELAR</button>
    `);
}

function joinCampaign() {
    const code = document.getElementById('join-code').value.trim();
    if (!code) return;
    
    let camp = campaigns.find(c => c.id === code);
    
    if (camp && !camp.isJoined) {
        openModal(`
            <h2 class="cinzel" style="color:var(--gold);">Acceso Denegado</h2>
            <p style="text-align:center;">Ya eres el Master de esta aventura. Un Dungeon Master no puede ser un simple aventurero en su propio reino.</p>
            <button onclick="window.closeModal()" class="btn-primary">ENTENDIDO</button>
        `);
        return;
    }

    if (camp && camp.isJoined) {
        openModal(`<p style="text-align:center;">Ya formas parte de esta aventura.</p>`);
        return;
    }

    // Si no existe, se une como jugador
    campaigns.push({ id: code, name: "Aventura Invitada", party: [], notices: [], isJoined: true });
    saveAll(); renderLobby(); closeModal();
}

function showCampaignForm(id = null) {
    if (!id && campaigns.length >= userTier.maxParties) {
        openModal(`
            <h2 class="cinzel">Límite Alcanzado</h2>
            <p style="text-align:center;">Has llegado al máximo de ${userTier.maxParties} aventuras (${userTier.level}).</p>
            ${userTier.level === 'free' ? `<button onclick="window.rollForLimit()" class="btn-primary">MEJORAR CON DADO D20</button>` : ''}
            <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:10px; width:100%;">CANCELAR</button>
        `);
        return;
    }
    const camp = id ? campaigns.find(c => c.id === id) : null;
    openModal(`
        <h2 class="cinzel">${id ? 'Editar' : 'Nueva'} Campaña</h2>
        <input type="text" id="form-camp-name" value="${camp ? camp.name : ''}" placeholder="Nombre de la aventura...">
        <button onclick="window.saveCampaign('${id || ''}')" class="btn-primary">GUARDAR</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">CANCELAR</button>
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
    saveAll(); renderLobby(); closeModal();
}

function confirmDeleteCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    openModal(`
        <h2 class="cinzel" style="color:var(--danger);">¿Borrar Aventura?</h2>
        <p style="text-align:center;">Se eliminará "${camp.name}" y todos sus datos permanentemente.</p>
        <button onclick="window.deleteCampaign('${id}')" class="btn-primary">BORRAR</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">CANCELAR</button>
    `);
}

function deleteCampaign(id) {
    campaigns = campaigns.filter(c => c.id !== id);
    if (currentCampaignId === id) currentCampaignId = null;
    saveAll(); renderLobby(); closeModal();
}

function selectCampaign(id, role = 'master') {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return;
    currentCampaignId = id;
    currentRole = role;
    saveAll();
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('role-indicator').style.display = 'inline-block';
    document.getElementById('role-indicator').innerHTML = `MODO: <span id="role-text">${role.toUpperCase()}</span>`;
    document.getElementById('campaign-title').innerText = camp.name;
    
    renderMasterEye();
    renderNavigation();
    renderLocalBoard();
    showTab('tab-home');
}

function renderMasterEye() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp || currentRole !== 'master') {
        const eye = document.getElementById('master-eye');
        if (eye) eye.style.display = 'none';
        return;
    }
    
    let totals = { cp:0, sp:0, ep:0, gp:0, pp:0 };
    camp.party.forEach(p => {
        totals.cp += p.wallet.cp || 0;
        totals.sp += p.wallet.sp || 0;
        totals.ep += p.wallet.ep || 0;
        totals.gp += p.wallet.gp || 0;
        totals.pp += p.wallet.pp || 0;
    });

    const eyeArea = document.getElementById('master-eye') || document.createElement('div');
    eyeArea.id = 'master-eye';
    eyeArea.style.display = 'flex';
    eyeArea.innerHTML = `
        <span>OJO DEL MASTER: TESORO GRUPAL</span>
        <div style="display:flex; gap:10px;">
            <span class="coin-cp">${totals.cp}cp</span>
            <span class="coin-sp">${totals.sp}sp</span>
            <span class="coin-gp">${totals.gp}gp</span>
            <span class="coin-pp">${totals.pp}pp</span>
        </div>
    `;
    if (!document.getElementById('master-eye')) document.body.prepend(eyeArea);
}

function exitToLobby() { 
    currentCampaignId = null; 
    saveAll(); 
    location.reload(); 
}

// --- TABLONES ---
function renderGlobalBoard() {
    const res = document.getElementById('global-board');
    if (!res) return;
    const now = Date.now();
    const filtered = globalNotices.filter(n => (now - (n.date || 0)) < (n.expiry || 604800000));
    res.innerHTML = filtered.map((n) => `
        <div style="border-bottom:1px solid #222; padding:15px 0; ${n.pending ? 'opacity:0.5;' : ''}">
            <div style="display:flex; justify-content:space-between;">
                <p style="margin:0; color:var(--gold); font-family:Cinzel;"><b>${n.title}</b></p>
                ${n.pending ? '<span style="color:orange; font-size:0.7rem;">[REVISIÓN]</span>' : ''}
            </div>
            <p style="margin:5px 0 0 0; font-size:0.9rem; color:#aaa;">${n.text}</p>
        </div>
    `).join('') || '<p style="color:#444; font-size:0.8rem; text-align:center;">No hay anuncios mundiales.</p>';
}

function openGlobalNoticeModal() {
    openModal(`
        <h2 class="cinzel">Anuncio Mundial</h2>
        <input type="text" id="g-title" placeholder="Título (ej: Se buscan Jugadores)">
        <textarea id="g-text" placeholder="Tu mensaje..." style="height:120px;"></textarea>
        <div style="margin-bottom:15px; display:flex; align-items:center; gap:10px;">
            <input type="checkbox" id="g-long" style="width:auto; margin:0;">
            <label style="font-size:0.8rem;">DURACIÓN EXTENDIDA (30 días)</label>
        </div>
        <p style="font-size:0.7rem; color:#666;">* Por defecto duran 7 días. Mensajes sospechosos serán moderados.</p>
        <button onclick="window.postGlobalNotice()" class="btn-primary">PUBLICAR</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">VOLVER</button>
    `);
}

function postGlobalNotice() {
    const title = document.getElementById('g-title').value.trim();
    const text = document.getElementById('g-text').value.trim();
    if (!title || !text) return;
    
    const needsReview = isSpam(title) || isSpam(text);
    const isLong = document.getElementById('g-long').checked;
    globalNotices.unshift({ 
        title, text, date: Date.now(), 
        pending: needsReview,
        expiry: isLong ? 2592000000 : 604800000 
    });
    
    if (globalNotices.length > 20) globalNotices.pop();
    saveAll(); renderGlobalBoard(); closeModal();
}

function renderLocalBoard() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const res = document.getElementById('local-board');
    res.innerHTML = (camp.notices || []).map((n, i) => `
        <div class="card" style="background:#0a0a0a; position:relative; border-left:4px solid var(--danger);">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <h3 style="margin:0;">${n.title}</h3>
                ${currentRole === 'master' ? `<i class="fa-solid fa-trash" onclick="window.deleteMission(${i})" style="color:var(--danger); cursor:pointer;"></i>` : ''}
            </div>
            <p style="font-size:1.1rem; white-space:pre-wrap; margin:15px 0; color:#ccc;">${n.text}</p>
            <div style="border-top:1px solid #222; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <div id="seals-${i}">
                    ${(n.readBy || []).map(r => `<div class="wax-seal" title="${r}"></div>`).join('')}
                </div>
                ${currentRole === 'adventurer' ? `<button onclick="window.markAsRead(${i})" class="btn-secondary" style="font-size:0.7rem; padding:5px 10px;">MARCAR COMO LEÍDO</button>` : ''}
            </div>
        </div>
    `).join('') || '<p style="color:#444; text-align:center;">No hay misiones activas.</p>';
}

function markAsRead(idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const n = camp.notices[idx];
    if (!n.readBy) n.readBy = [];
    if (!n.readBy.includes('Jugador')) { 
        n.readBy.push('Jugador');
        saveAll(); renderLocalBoard();
    }
}

function addMission() {
    const title = document.getElementById('mission-title').value.trim();
    const text = document.getElementById('mission-text').value.trim();
    if (!title || !text) return;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp.notices) camp.notices = [];
    camp.notices.unshift({ title, text, readBy: [] });
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
        receiveCoins: { cp:0, sp:0, ep:0, gp:0, pp:0 },
        receiveItems: [],
        p1Confirmed: false,
        p2Confirmed: false
    };
    renderNPCTradeUI(char);
}

function renderNPCTradeUI(char) {
    openModal(`
        <h2 class="cinzel" style="text-align:center;">Trato con NPC</h2>
        <div style="display:grid; grid-template-columns: 1fr; gap:20px;">
            <div class="card" style="margin:0; background:#000;">
                <h3 style="font-size:0.9rem; color:white;">ENTREGA DEL AVENTURERO</h3>
                <div style="max-height:120px; overflow-y:auto; font-size:1rem; margin-bottom:10px;">
                    ${char.inventory.map((it, i) => `
                        <div style="padding:5px 0;"><label><input type="checkbox" onchange="window.updateNPCGive(${i})"> ${it.name}</label></div>
                    `).join('') || 'Mochila vacía'}
                </div>
                <div class="coin-grid">
                    <div class="coin-unit"><span class="coin-cp">CP</span><span>${char.wallet.cp}</span></div>
                    <div class="coin-unit"><span class="coin-sp">SP</span><span>${char.wallet.sp}</span></div>
                    <div class="coin-unit"><span class="coin-gp">GP</span><span>${char.wallet.gp}</span></div>
                    <div class="coin-unit"><span class="coin-pp">PP</span><span>${char.wallet.pp}</span></div>
                </div>
            </div>
            
            <div class="card" style="margin:0; background:#000; border:1px solid var(--gold);">
                <h3 style="font-size:0.9rem; color:var(--gold);">RECOMPENSA DEL NPC</h3>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                    <input type="number" placeholder="CP" oninput="activeTrade.receiveCoins.cp=this.value">
                    <input type="number" placeholder="GP" oninput="activeTrade.receiveCoins.gp=this.value">
                </div>
                <input type="text" id="npc-item-search" placeholder="Generar ítem o material..." onkeyup="window.searchNPCItems()">
                <div id="npc-search-results" style="font-size:0.9rem; color:var(--gold); margin-bottom:10px;"></div>
                <div id="npc-pending-items" style="font-size:0.9rem; color:#aaa;"></div>
            </div>
        </div>

        <div style="margin-top:20px; display:flex; gap:10px;">
            <button id="btn-npc-p1" onclick="window.confirmNPCPart(1)" class="btn-secondary" style="flex:1;">SELLAR NPC</button>
            <button id="btn-npc-p2" onclick="window.confirmNPCPart(2)" class="btn-secondary" style="flex:1;">SELLAR JUGADOR</button>
        </div>
        <button id="btn-npc-exec" onclick="window.executeNPCTrade()" class="btn-primary" style="display:none; margin-top:15px;">CERRAR TRATO</button>
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
    res.innerHTML = matches.map(m => `<div onclick="window.addNPCItem('${m.name}')" style="cursor:pointer; padding:8px; border-bottom:1px solid #222;">+ ${m.name}</div>`).join('') + `<div onclick="window.addNPCItem('${document.getElementById('npc-item-search').value}')" style="color:white; cursor:pointer; padding:8px;">+ [Crear]: ${document.getElementById('npc-item-search').value}</div>`;
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
    
    char.wallet.cp += parseInt(activeTrade.receiveCoins.cp) || 0;
    char.wallet.sp += parseInt(activeTrade.receiveCoins.sp) || 0;
    char.wallet.gp += parseInt(activeTrade.receiveCoins.gp) || 0;
    char.wallet.pp += parseInt(activeTrade.receiveCoins.pp) || 0;
    
    activeTrade.receiveItems.forEach(name => char.inventory.push({ name, weight: 1 }));
    
    saveAll(); closeModal(); renderParty(); renderMasterEye();
}

// --- SRD & SEARCH ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
    } catch (e) { console.warn("SRD fail"); }
}

function searchMonsters() {
    const q = document.getElementById('monster-search').value.toLowerCase();
    const res = document.getElementById('search-results');
    if (!q) return res.innerHTML = '';
    const matches = srdData.monsters.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5);
    res.innerHTML = matches.map(m => `
        <div onclick="window.showMonsterModal('${m.name}')" class="campaign-item" style="cursor:pointer;">
            <span style="color:var(--gold); font-family:Cinzel;">${m.name}</span>
            <span style="color:#666; font-size:0.8rem;">CR ${m.cr}</span>
        </div>
    `).join('');
}

function showMonsterModal(name) {
    const m = srdData.monsters.find(mo => mo.name === name);
    openModal(`
        <h2 class="cinzel" style="text-align:center; color:var(--gold); font-size:2rem;">${m.name}</h2>
        <p style="text-align:center; color:#888; margin-top:-10px;">${m.type} | CR: ${m.cr}</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin:20px 0;">
            <div class="card" style="margin:0; text-align:center; background:#000;">CA<br><b style="font-size:1.5rem; color:var(--gold);">${m.ac}</b></div>
            <div class="card" style="margin:0; text-align:center; background:#000;">VIDA<br><b style="font-size:1.5rem; color:var(--danger);">${m.hp}</b></div>
        </div>
        <button onclick="window.goToLootFromMonster('${m.name}', '${m.cr}', '${m.type}')" class="btn-primary">DERROTADO (BOTÍN)</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">CERRAR</button>
    `);
}

function goToLootFromMonster(name, cr, type) {
    closeModal();
    generateLoot(cr, type, name);
}

// --- BOTÍN ---

window.generateEncounter = function(difficulty) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp || !camp.party || camp.party.length === 0) {
        openModal('<h2 class="cinzel">Sin Héroes</h2><p>Registra aventureros en el Gremio para calcular el desafío.</p>');
        return;
    }
    
    const avgLevel = camp.party.reduce((sum, p) => sum + (p.level || 1), 0) / camp.party.length;
    let targetCR = avgLevel;
    if (difficulty === 'hard') targetCR *= 1.5;
    
    const matches = srdData.monsters.filter(m => eval(m.cr) <= targetCR);
    if (matches.length === 0) return;
    
    const monster = matches[Math.floor(Math.random() * matches.length)];
    showMonsterModal(monster.name);
};

let lastGeneratedLoot = null;

window.generateLoot = function(crStr, type, monsterName) {
    const cr = eval(crStr) || 1;
    const isNature = ['beast', 'monstrosity', 'plant', 'ooze'].includes(type.toLowerCase());
    
    let coins = { cp:0, sp:0, ep:0, gp:0, pp:0 };
    let items = [];
    let isFake = Math.random() < 0.12;

    if (isNature) {
        items.push({ name: `Piel de ${monsterName}`, val: Math.floor(cr * 5) });
        items.push({ name: `Restos de ${monsterName}`, val: Math.floor(cr * 2) });
    } else {
        // Generación de 5 tipos de monedas
        coins.cp = Math.floor(Math.random() * 100 * cr);
        coins.sp = Math.floor(Math.random() * 50 * cr);
        coins.gp = Math.floor((Math.random() * 20 + 10) * cr);
        if (cr > 5) coins.pp = Math.floor(Math.random() * 5 * cr);
    }

    lastGeneratedLoot = { coins, items, isFake };

    let coinHtml = Object.entries(coins)
        .filter(([_, val]) => val > 0)
        .map(([key, val]) => `<span class="coin-${key}">${val}${key}</span>`)
        .join(' ');

    openModal(`
        <h2 class="cinzel">${isNature ? 'Restos Naturales' : 'Botín Hallado'} ${isFake && currentRole === 'master' ? '⚠️' : ''}</h2>
        <div style="text-align:center; font-size:1.5rem; margin:20px 0; color:var(--gold);">
            ${isNature ? '' : coinHtml}
            ${items.map(it => `<div>• ${it.name} (${it.val}gp)</div>`).join('')}
        </div>
        <div id="loot-assign-area">
            <label style="font-size:0.8rem;">ENTREGAR A:</label>
            <select id="loot-target" style="margin-bottom:15px;">
                <option value="all">Dividir entre todos</option>
                ${(campaigns.find(c => c.id === currentCampaignId).party || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
            <button onclick="window.executeLootAssign()" class="btn-primary">REPARTIR BOTÍN</button>
        </div>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">DESCARTAR</button>
    `);
};

window.executeLootAssign = function() {
    if (!lastGeneratedLoot) return;
    const target = document.getElementById('loot-target').value;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const { coins, items, isFake } = lastGeneratedLoot;

    if (target === 'all') {
        const pCount = camp.party.length || 1;
        camp.party.forEach(p => {
            Object.keys(coins).forEach(k => {
                if (k === 'gp' && isFake) p.wallet.gp_fake = (p.wallet.gp_fake || 0) + Math.floor(coins[k] / pCount);
                else p.wallet[k] = (p.wallet[k] || 0) + Math.floor(coins[k] / pCount);
            });
            items.forEach(it => p.inventory.push({ name: it.name, weight: 1 }));
        });
    } else {
        const p = camp.party.find(h => h.id == target);
        Object.keys(coins).forEach(k => {
            if (k === 'gp' && isFake) p.wallet.gp_fake = (p.wallet.gp_fake || 0) + coins[k];
            else p.wallet[k] = (p.wallet[k] || 0) + coins[k];
        });
        items.forEach(it => p.inventory.push({ name: it.name, weight: 1 }));
    }
    
    lastGeneratedLoot = null;
    saveAll(); closeModal(); renderParty(); renderMasterEye();
};

function renderParty() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const res = document.getElementById('character-list');
    
    // Aseguramos que wallet tenga todas las claves
    (camp.party || []).forEach(p => {
        if (!p.wallet) p.wallet = { cp:0, sp:0, ep:0, gp:0, pp:0, gp_fake:0 };
        ['cp','sp','ep','gp','pp','gp_fake'].forEach(k => { if(p.wallet[k] === undefined) p.wallet[k]=0; });
    });

    res.innerHTML = (camp.party || []).map(c => `
        <div class="card" style="margin-bottom:15px; padding:15px;">
            <div onclick="window.toggleInventory(${c.id})" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                <div>
                    <h3 style="margin:0; font-size:1.2rem;">${c.name}</h3>
                    <div class="coin-grid" style="width:220px; font-size:0.7rem;">
                        <span class="coin-cp">${c.wallet.cp}c</span>
                        <span class="coin-sp">${c.wallet.sp}s</span>
                        <span class="coin-gp">${c.wallet.gp + (c.wallet.gp_fake||0)}g</span>
                        <span class="coin-pp">${c.wallet.pp}p</span>
                    </div>
                </div>
                ${currentRole === 'master' ? `<button onclick="event.stopPropagation(); window.openNPCTrade(${c.id})" class="btn-secondary" style="font-size:0.7rem;">TRATO NPC</button>` : ''}
            </div>
            <div id="inv-${c.id}" style="display:none; width:100%; margin-top:15px; background:#000; padding:15px; border-radius:8px; font-size:0.9rem; border:1px solid #222;">
                <b style="color:var(--gold);">INVENTARIO:</b><br>
                ${c.inventory.map(it => `• ${it.name}`).join('<br>') || 'Vacío'}
                ${(currentRole === 'master' && c.wallet.gp_fake > 0) ? `<p style="color:#ff4444; margin-top:10px; border-top:1px solid #444; padding-top:5px;">⚠️ ORO FALSO: ${c.wallet.gp_fake} gp</p>` : ''}
            </div>
        </div>
    `).join('') || '<p style="color:#444; text-align:center;">No hay héroes registrados.</p>';
}

function reclaimMaster(id) {
    let camp = campaigns.find(c => c.id === id);
    if (camp) {
        camp.isJoined = false;
        saveAll();
        location.reload();
    }
}
window.reclaimMaster = reclaimMaster;

let currentRitualRolls = [];
let isRedemptionMode = false;

function rollForLimit() {
    currentRitualRolls = [];
    isRedemptionMode = false;
    openDiceModal();
}

function openDiceModal() {
    openModal(`
        <div class="dice-ritual-area">
            <h2 class="cinzel">Ritual de Ascenso</h2>
            <div id="ritual-msg-container" class="ritual-msg-area" onclick="window.checkRedemptionClick()">
                <p id="ritual-msg" style="margin:0;">Toca el dado para tu 1ª tirada</p>
            </div>
            <div id="visual-die" class="d20-visual" onclick="window.executeRitualStep()">?</div>
            <div class="roll-history" id="ritual-history">
                <div class="roll-dot">?</div>
                <div class="roll-dot">?</div>
                <div class="roll-dot">?</div>
            </div>
        </div>
    `);
}

function checkRedemptionClick() {
    if (isRedemptionMode) {
        isRedemptionMode = false;
        const msg = document.getElementById('ritual-msg');
        const container = document.getElementById('ritual-msg-container');
        const die = document.getElementById('visual-die');
        
        container.classList.remove('waiting');
        msg.innerHTML = "Los dioses aceptan tu tributo...<br><b style='color:var(--gold);'>¡LANZA EL TIRO DE GRACIA!</b>";
        die.onclick = window.executeRitualStep;
        die.style.boxShadow = "0 0 30px var(--gold)";
    }
}

function executeRitualStep() {
    const die = document.getElementById('visual-die');
    const msg = document.getElementById('ritual-msg');
    
    die.classList.add('rolling');
    die.onclick = null;
    msg.innerText = "¡Lanzando!";

    setTimeout(() => {
        die.classList.remove('rolling');
        let roll;
        
        if (currentRitualRolls.length === 3) {
            roll = 15; 
        } else {
            roll = Math.floor(Math.random() * 20) + 1;
        }
        
        currentRitualRolls.push(roll);
        die.innerText = roll;
        
        const dots = document.getElementById('ritual-history').children;
        if (currentRitualRolls.length <= 3) {
            dots[currentRitualRolls.length - 1].innerText = roll;
            dots[currentRitualRolls.length - 1].classList.add('active');
        }

        let maxSoFar = Math.max(...currentRitualRolls);

        if (currentRitualRolls.length < 3) {
            msg.innerText = `Resultado: ${roll}. ¡Toca para la siguiente!`;
            die.onclick = window.executeRitualStep;
        } else if (currentRitualRolls.length === 3 && maxSoFar < 15) {
            isRedemptionMode = true;
            const container = document.getElementById('ritual-msg-container');
            container.classList.add('waiting');
            msg.innerHTML = `<b style="color:#ff4444;">SUERTE ADVERSA...</b><br><span style="font-size:0.8rem;">[Toca este mensaje para pedir favor divino]</span>`;
        } else {
            finalizeRitual(maxSoFar);
        }
    }, 1000);
}

function finalizeRitual(finalLimit) {
    userTier.level = 'master';
    userTier.maxParties = finalLimit;
    saveTier();
    renderLobby();

    const msg = document.getElementById('ritual-msg');
    const die = document.getElementById('visual-die');
    
    die.style.color = "var(--gold)";
    die.style.transform = "scale(1.2)";
    msg.innerHTML = `<b style="color:var(--gold);">¡ASCENSO COMPLETADO!</b><br>Límite: <b>${finalLimit} aventuras</b>.`;
    
    setTimeout(() => {
        openModal(`
            <h2 class="cinzel">Nuevo Rango: Master</h2>
            <p style="text-align:center;">Has desbloqueado todo el poder del Grimorio.</p>
            <div style="font-size:4rem; text-align:center; color:var(--gold); margin:20px 0; display:flex; flex-direction:column; align-items:center; gap:10px;">
                <i class="fa-solid fa-dice-d20"></i>
                <span style="font-family:Cinzel; font-size:2.5rem;">${finalLimit}</span>
            </div>
            <button onclick="window.closeModal()" class="btn-primary">RECLAMAR PODER</button>
        `);
    }, 2000);
}

window.rollForLimit = rollForLimit;
window.executeRitualStep = executeRitualStep;
window.checkRedemptionClick = checkRedemptionClick;
window.generateEncounter = generateEncounter;
window.generateLoot = generateLoot;
window.executeLootAssign = executeLootAssign;
window.renderParty = renderParty;