// --- ESTADO ---
const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

function getLevelFromXP(xp) {
    let level = 1;
    for (let i = 0; i < XP_TABLE.length; i++) {
        if (xp >= XP_TABLE[i]) level = i + 1;
        else break;
    }
    return level;
}

let userTier = JSON.parse(localStorage.getItem('dnd_user_tier')) || { level: 'free', maxParties: 6, rolls: [] };
function saveTier() { localStorage.setItem('dnd_user_tier', JSON.stringify(userTier)); }

let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let globalNotices = JSON.parse(localStorage.getItem('dnd_global_notices')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let srdData = { classes: [], races: [], monsters: [], items: [], weapons: [] };
let activeTrade = null;
let lastGeneratedLoot = null;

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
        console.log("Copiado: " + text);
    });
}

// --- MODAL SYSTEM ---
function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (!overlay || !body) return;
    body.innerHTML = html;
    overlay.style.display = 'flex';
}
function closeModal() { 
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none'; 
}

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
    document.getElementById('lobby-overlay').style.display = 'block';
}

function renderCampaignLists() {
    const mContainer = document.getElementById('master-campaigns');
    const pContainer = document.getElementById('player-campaigns');
    if (!mContainer || !pContainer) return;
    
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

function showCampaignForm(id = null) {
    const camp = id ? campaigns.find(c => c.id === id) : null;
    openModal(`
        <h2 class="cinzel">${id ? 'Editar Aventura' : 'Nueva Aventura'}</h2>
        <input type="text" id="form-camp-name" value="${camp ? camp.name : ''}" placeholder="Nombre de la campaña...">
        <button onclick="window.saveCampaign(${id ? `'${id}'` : ''})" class="btn-primary">FORJAR DESTINO</button>
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
    if (!camp) return;
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
    
    const lobby = document.getElementById('lobby-overlay');
    if (lobby) lobby.style.display = 'none';
    
    const indicator = document.getElementById('role-indicator');
    if (indicator) {
        indicator.style.display = 'inline-block';
        indicator.innerHTML = `MODO: <span id="role-text">${role.toUpperCase()}</span>`;
    }
    
    const title = document.getElementById('campaign-title');
    if (title) title.innerText = camp.name;
    
    renderMasterEye();
    renderNavigation();
    renderLocalBoard();
    renderParty();
    showTab('tab-home');
}

function exitToLobby() { 
    currentCampaignId = null; 
    saveAll(); 
    location.reload(); 
}

// --- MASTER EYE ---
function renderMasterEye() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp || currentRole !== 'master') {
        const eye = document.getElementById('master-eye');
        if (eye) eye.style.display = 'none';
        return;
    }
    
    let totals = { cp:0, sp:0, ep:0, gp:0, pp:0 };
    (camp.party || []).forEach(p => {
        if (!p.wallet) return;
        totals.cp += p.wallet.cp || 0;
        totals.sp += p.wallet.sp || 0;
        totals.ep += p.wallet.ep || 0;
        totals.gp += p.wallet.gp || 0;
        totals.pp += p.wallet.pp || 0;
    });

    let eyeArea = document.getElementById('master-eye');
    if (!eyeArea) {
        eyeArea = document.createElement('div');
        eyeArea.id = 'master-eye';
        document.body.prepend(eyeArea);
    }
    eyeArea.className = 'master-eye-bar';
    eyeArea.style.display = 'flex';
    eyeArea.innerHTML = `
        <span>OJO DEL MASTER: TESORO GRUPAL</span>
        <div style="display:flex; gap:10px;">
            <span class="coin-cp">${totals.cp}c</span>
            <span class="coin-sp">${totals.sp}s</span>
            <span class="coin-gp">${totals.gp}g</span>
            <span class="coin-pp">${totals.pp}p</span>
        </div>
    `;
}

// --- NAVEGACION ---
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(t);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(btn => {
        if (btn.onclick.toString().includes(t)) btn.classList.add('active');
    });
}

function renderNavigation() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    const isM = currentRole === 'master';
    nav.innerHTML = `
        <button onclick="window.showTab('tab-home')"><i class="fa-solid fa-house"></i><span>Home</span></button>
        ${isM ? `<button onclick="window.showTab('tab-combat')"><i class="fa-solid fa-bolt"></i><span>Batalla</span></button>` : ''}
        ${isM ? `<button onclick="window.showTab('tab-botin')"><i class="fa-solid fa-coins"></i><span>Botín</span></button>` : ''}
        <button onclick="window.showTab('tab-notices')"><i class="fa-solid fa-bullhorn"></i><span>Misiones</span></button>
        <button onclick="window.showTab('tab-party')"><i class="fa-solid fa-users"></i><span>Gremio</span></button>
    `;
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
    if (!res) return;

    res.innerHTML = (camp.notices || []).map((n, i) => {
        const days = (Date.now() - (n.date || 0)) / (1000 * 60 * 60 * 24);
        const readCount = (n.readBy || []).length;
        const partySize = (camp.party || []).length || 1;
        const readPercent = (readCount / partySize) * 100;
        
        let suggestion = '';
        if (currentRole === 'master') {
            if (days > 30 && readPercent >= 70) {
                suggestion = `<div style="background:rgba(197,160,89,0.1); border:1px solid var(--gold); padding:8px; border-radius:5px; margin-top:10px; font-size:0.75rem; color:var(--gold);">
                    <i class="fa-solid fa-broom"></i> <b>Sugerencia:</b> ${Math.floor(readPercent)}% lo leyó hace +30 días. ¿Borrar misión?
                </div>`;
            } else if (days > 15 && readPercent < 30) {
                suggestion = `<div style="background:rgba(255,136,0,0.1); border:1px solid #ff8800; padding:8px; border-radius:5px; margin-top:10px; font-size:0.75rem; color:#ff8800;">
                    <i class="fa-solid fa-circle-exclamation"></i> <b>Sugerencia:</b> Solo ${Math.floor(readPercent)}% de interés en 15 días.
                </div>`;
            }
        }

        return `
        <div class="card" style="background:#0a0a0a; position:relative; border-left:4px solid var(--danger); ${suggestion ? 'border-color:var(--gold);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <h3 style="margin:0;">${n.title}</h3>
                ${currentRole === 'master' ? `<i class="fa-solid fa-trash" onclick="window.deleteMission(${i})" style="color:var(--danger); cursor:pointer;"></i>` : ''}
            </div>
            <p style="font-size:1.1rem; white-space:pre-wrap; margin:15px 0; color:#ccc;">${n.text}</p>
            ${suggestion}
            <div style="border-top:1px solid #222; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
                <div id="seals-${i}">
                    ${(n.readBy || []).map(r => `<div class="wax-seal" title="${r}"></div>`).join('')}
                </div>
                ${currentRole === 'adventurer' ? `<button onclick="window.markAsRead(${i})" class="btn-secondary" style="font-size:0.7rem; padding:5px 10px;">MARCAR COMO LEÍDO</button>` : ''}
            </div>
        </div>
    `;
    }).join('') || '<p style="color:#444; text-align:center;">No hay misiones activas.</p>';
}

function markAsRead(idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp || !camp.notices[idx]) return;
    const n = camp.notices[idx];
    if (!n.readBy) n.readBy = [];
    if (!n.readBy.includes('Aventurero')) { 
        n.readBy.push('Aventurero');
        saveAll(); renderLocalBoard();
    }
}

function addMission() {
    const title = document.getElementById('mission-title').value.trim();
    const text = document.getElementById('mission-text').value.trim();
    if (!title || !text) return;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp.notices) camp.notices = [];
    camp.notices.unshift({ title, text, readBy: [], date: Date.now() });
    saveAll(); renderLocalBoard();
    document.getElementById('mission-title').value = '';
    document.getElementById('mission-text').value = '';
}

function deleteMission(idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    camp.notices.splice(idx, 1);
    saveAll(); renderLocalBoard();
}

// --- SRD DATA ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
    } catch (e) { 
        console.warn("SRD fail, usando datos locales"); 
        srdData = { 
            classes: [{name:'Guerrero'}, {name:'Mago'}, {name:'Clérigo'}, {name:'Pícaro'}], 
            races: [{name:'Humano'}, {name:'Elfo'}, {name:'Enano'}, {name:'Mediano'}], 
            monsters: [], items: [], weapons: [] 
        };
    }
}

// --- PERSONAJES ---
function showCharForm() {
    const races = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    const classes = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    
    openModal(`
        <h2 class="cinzel">Nuevo Aventurero</h2>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <input type="text" id="char-name" placeholder="Nombre..." style="grid-column: span 2;">
            <select id="char-race">${races}</select>
            <select id="char-class">${classes}</select>
        </div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:15px;">
            <div class="stat-box">STR<input type="number" id="s-str" value="10"></div>
            <div class="stat-box">DEX<input type="number" id="s-dex" value="10"></div>
            <div class="stat-box">CON<input type="number" id="s-con" value="10"></div>
            <div class="stat-box">INT<input type="number" id="s-int" value="10"></div>
            <div class="stat-box">WIS<input type="number" id="s-wis" value="10"></div>
            <div class="stat-box">CHA<input type="number" id="s-cha" value="10"></div>
        </div>
        <button onclick="window.createCharacter()" class="btn-primary" style="margin-top:20px;">FORJAR HÉROE</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:10px; width:100%;">CANCELAR</button>
        <style>
            .stat-box { background:#000; padding:5px; border-radius:5px; text-align:center; font-size:0.7rem; color:var(--gold); }
            .stat-box input { padding:5px; margin:0; text-align:center; background:none; border:none; border-bottom:1px solid var(--gold); }
        </style>
    `);
}

function createCharacter() {
    const name = document.getElementById('char-name').value.trim();
    if (!name) return;
    
    const stats = {
        str: parseInt(document.getElementById('s-str').value) || 10,
        dex: parseInt(document.getElementById('s-dex').value) || 10,
        con: parseInt(document.getElementById('s-con').value) || 10,
        int: parseInt(document.getElementById('s-int').value) || 10,
        wis: parseInt(document.getElementById('s-wis').value) || 10,
        cha: parseInt(document.getElementById('s-cha').value) || 10
    };

    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp.party) camp.party = [];
    
    camp.party.push({
        id: Date.now(),
        name,
        race: document.getElementById('char-race').value,
        class: document.getElementById('char-class').value,
        level: 1,
        xp: 0,
        stats,
        inventory: [],
        wallet: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0, gp_fake: 0 }
    });
    
    saveAll(); renderParty(); renderMasterEye(); closeModal();
}

function renderParty() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const res = document.getElementById('character-list');
    if (!res) return;

    res.innerHTML = (camp.party || []).map(c => {
        const totalWeight = (c.inventory || []).reduce((sum, it) => sum + (it.weight || 0), 0);
        const maxWeight = (c.stats ? c.stats.str : 10) * 15;
        const isOverburdened = totalWeight > maxWeight;

        return `
        <div class="card" style="margin-bottom:15px; padding:15px; border-left: 3px solid ${isOverburdened ? 'var(--danger)' : 'var(--gold)'}">
            <div onclick="window.toggleInventory(${c.id})" style="display:flex; justify-content:space-between; align-items:start; cursor:pointer;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <h3 style="margin:0; font-size:1.2rem;">${c.name}</h3>
                        <span style="background:var(--gold); color:#000; font-size:0.6rem; padding:2px 5px; border-radius:3px; font-weight:bold;">LVL ${c.level}</span>
                    </div>
                    <p style="margin:0; font-size:0.75rem; color:#888;">${c.race} ${c.class} • XP: ${c.xp}</p>
                    <div class="coin-grid" style="width:200px; margin-top:10px;">
                        <span class="coin-cp">${c.wallet.cp}c</span>
                        <span class="coin-sp">${c.wallet.sp}s</span>
                        <span class="coin-gp">${c.wallet.gp + (c.wallet.gp_fake||0)}g</span>
                        <span class="coin-pp">${c.wallet.pp}p</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    <p style="margin:0; font-size:0.7rem; color:${isOverburdened ? 'var(--danger)' : '#666'}">
                        CARGA: ${totalWeight.toFixed(1)} / ${maxWeight} lb
                    </p>
                    ${currentRole === 'master' ? `<button onclick="event.stopPropagation(); window.openNPCTrade(${c.id})" class="btn-secondary" style="font-size:0.6rem; margin-top:5px; padding:5px 8px;">TRATO NPC</button>` : ''}
                </div>
            </div>
            <div id="inv-${c.id}" style="display:none; width:100%; margin-top:15px; background:#000; padding:15px; border-radius:8px; font-size:0.85rem; border:1px solid #222;">
                <b style="color:var(--gold); font-family:Cinzel; font-size:0.7rem;">ESTADÍSTICAS:</b>
                <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:5px; text-align:center; margin-bottom:10px; background:#111; padding:5px; border-radius:5px;">
                    <div><small>STR</small><br>${c.stats ? c.stats.str : 10}</div>
                    <div><small>DEX</small><br>${c.stats ? c.stats.dex : 10}</div>
                    <div><small>CON</small><br>${c.stats ? c.stats.con : 10}</div>
                    <div><small>INT</small><br>${c.stats ? c.stats.int : 10}</div>
                    <div><small>WIS</small><br>${c.stats ? c.stats.wis : 10}</div>
                    <div><small>CHA</small><br>${c.stats ? c.stats.cha : 10}</div>
                </div>
                <b style="color:var(--gold); font-family:Cinzel; font-size:0.7rem;">INVENTARIO:</b><br>
                ${(c.inventory || []).map(it => `• ${it.name} (${it.weight}lb)`).join('<br>') || 'Mochila vacía'}
                ${(currentRole === 'master' && c.wallet.gp_fake > 0) ? `<p style="color:#ff4444; margin-top:10px; border-top:1px solid #444; padding-top:5px;">⚠️ ORO FALSO: ${c.wallet.gp_fake} gp</p>` : ''}
            </div>
        </div>
    `}).join('') || '<p style="color:#444; text-align:center;">No hay héroes registrados.</p>';
}

function toggleInventory(id) {
    const el = document.getElementById(`inv-${id}`);
    if (el) el.style.display = (el.style.display === 'none' ? 'block' : 'none');
}

// --- COMBATE ---
function generateEncounter(difficulty) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp || !camp.party || camp.party.length === 0) {
        openModal('<h2 class="cinzel">Sin Héroes</h2><p>Registra aventureros en el Gremio para calcular el desafío.</p>');
        return;
    }
    
    const avgLevel = camp.party.reduce((sum, p) => sum + (p.level || 1), 0) / camp.party.length;
    let minCR, maxCR;

    if (difficulty === 'hard') {
        minCR = avgLevel + 1;
        maxCR = avgLevel + 3;
    } else {
        minCR = Math.max(0, avgLevel - 1);
        maxCR = avgLevel + 1;
    }
    
    const matches = srdData.monsters.filter(m => {
        const crValue = eval(m.cr);
        return crValue >= minCR && crValue <= maxCR;
    });

    if (matches.length === 0) {
        const fallback = srdData.monsters.filter(m => eval(m.cr) <= maxCR).slice(-5);
        if(fallback.length === 0) return;
        showMonsterModal(fallback[Math.floor(Math.random() * fallback.length)].name);
    } else {
        const monster = matches[Math.floor(Math.random() * matches.length)];
        showMonsterModal(monster.name);
    }
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
    if (!m) return;
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
function generateLoot(crStr, type, monsterName) {
    const cr = eval(crStr) || 1;
    const isNature = ['beast', 'monstrosity', 'plant', 'ooze'].includes(type.toLowerCase());
    
    const mData = srdData.monsters.find(m => m.name === monsterName);
    const xp = mData ? (parseInt(mData.xp) || Math.floor(cr * 200)) : Math.floor(cr * 200);

    let coins = { cp:0, sp:0, ep:0, gp:0, pp:0 };
    let items = [];
    let isFake = Math.random() < 0.12;

    if (isNature) {
        items.push({ name: `Piel de ${monsterName}`, weight: 5, val: Math.floor(cr * 5) });
        items.push({ name: `Glándula de ${monsterName}`, weight: 1, val: Math.floor(cr * 2) });
    } else {
        coins.cp = Math.floor(Math.random() * 100 * cr);
        coins.sp = Math.floor(Math.random() * 50 * cr);
        coins.gp = Math.floor((Math.random() * 20 + 10) * cr);
        if (cr >= 5) coins.pp = Math.floor(Math.random() * 5 * cr);
        
        if (Math.random() > 0.4) {
            const trinkets = ["Dije de hueso", "Mapa borroso", "Anillo de cobre", "Llave oxidada", "Cáliz de peltre"];
            items.push({ name: trinkets[Math.floor(Math.random() * trinkets.length)], weight: 0.5, val: Math.floor(cr * 1) });
        }
    }

    lastGeneratedLoot = { coins, items, xp, isFake };

    let coinHtml = Object.entries(coins).filter(([_, v]) => v > 0).map(([k, v]) => `<span class="coin-${k}">${v}${k}</span>`).join(' ');
    
    openModal(`
        <h2 class="cinzel">${isNature ? 'Restos Naturales' : 'Cofre Hallado'}</h2>
        <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:1.4rem; color:var(--gold);">${coinHtml || '0 monedas'}</div>
            <div style="color:#aaa; font-size:0.9rem;">XP Ganada: <b style="color:white;">${xp}</b></div>
            ${items.map(it => `<div style="font-size:0.9rem;">• ${it.name} (${it.val}gp)</div>`).join('')}
        </div>
        <div id="loot-assign-area">
            <label style="font-size:0.8rem;">REPARTIR ENTRE:</label>
            <select id="loot-target" style="margin-bottom:15px;">
                <option value="all">Toda la Party (División)</option>
                ${(campaigns.find(c => c.id === currentCampaignId).party || []).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
            <button onclick="window.executeLootAssign()" class="btn-primary">CONFIRMAR REPARTO</button>
        </div>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">DESCARTAR</button>
    `);
}

function executeLootAssign() {
    if (!lastGeneratedLoot) return;
    const target = document.getElementById('loot-target').value;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const { coins, items, xp, isFake } = lastGeneratedLoot;
    let report = [];

    if (target === 'all') {
        const pCount = camp.party.length || 1;
        const divXP = Math.floor(xp / pCount);
        camp.party.forEach(p => {
            let got = { xp: divXP, coins: {} };
            p.xp = (p.xp || 0) + divXP;
            Object.keys(coins).forEach(k => {
                const share = Math.floor(coins[k] / pCount);
                if (share > 0) {
                    if (k === 'gp' && isFake) p.wallet.gp_fake = (p.wallet.gp_fake || 0) + share;
                    else p.wallet[k] = (p.wallet[k] || 0) + share;
                    got.coins[k] = share;
                }
            });
            items.forEach(it => p.inventory.push({...it}));
            const oldLvl = p.level;
            p.level = getLevelFromXP(p.xp);
            report.push({ name: p.name, ...got, levelUp: p.level > oldLvl });
        });
    } else {
        const p = camp.party.find(h => h.id == target);
        p.xp = (p.xp || 0) + xp;
        Object.keys(coins).forEach(k => {
            if (k === 'gp' && isFake) p.wallet.gp_fake = (p.wallet.gp_fake || 0) + coins[k];
            else p.wallet[k] = (p.wallet[k] || 0) + coins[k];
        });
        items.forEach(it => p.inventory.push({...it}));
        const oldLvl = p.level;
        p.level = getLevelFromXP(p.xp);
        report.push({ name: p.name, xp, coins, levelUp: p.level > oldLvl });
    }

    saveAll();
    renderLootReport(report);
}

function renderLootReport(data) {
    const html = `
        <h2 class="cinzel" style="color:var(--gold);">Resumen del Tesoro</h2>
        <div style="max-height:300px; overflow-y:auto;">
            ${data.map(r => `
                <div class="card" style="padding:10px; background:#000; border-color:${r.levelUp ? 'var(--gold)' : '#333'}">
                    <div style="display:flex; justify-content:space-between;">
                        <b>${r.name}</b>
                        ${r.levelUp ? '<span style="color:var(--gold); font-size:0.7rem;">¡LEVEL UP!</span>' : ''}
                    </div>
                    <div style="font-size:0.8rem; color:#aaa;">
                        +${r.xp} XP | Monedas: ${Object.entries(r.coins).map(([k,v]) => v+k).join(', ')}
                    </div>
                </div>
            `).join('')}
        </div>
        <button onclick="window.closeModal(); window.renderParty(); window.renderMasterEye();" class="btn-primary" style="margin-top:15px;">CONTINUAR</button>
    `;
    openModal(html);
}

// --- NPC TRADE ---
function openNPCTrade(charId) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = (camp.party || []).find(p => p.id == charId);
    if (!char) return;
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
                    ${(char.inventory || []).map((it, i) => `
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
                <input type="text" id="npc-item-search" placeholder="Añadir ítem..." onkeyup="window.searchNPCItems()">
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
    if (!activeTrade) return;
    if (activeTrade.giveItems.includes(idx)) activeTrade.giveItems = activeTrade.giveItems.filter(i => i !== idx);
    else activeTrade.giveItems.push(idx);
}

function searchNPCItems() {
    const q = document.getElementById('npc-item-search').value.toLowerCase();
    const res = document.getElementById('npc-search-results');
    if (q.length < 2) return res.innerHTML = '';
    res.innerHTML = `<div onclick="window.addNPCItem('${document.getElementById('npc-item-search').value}')" style="color:white; cursor:pointer; padding:8px;">+ [Crear]: ${document.getElementById('npc-item-search').value}</div>`;
}

function addNPCItem(name) {
    if (!activeTrade) return;
    activeTrade.receiveItems.push(name);
    document.getElementById('npc-pending-items').innerHTML = activeTrade.receiveItems.map(i => `• ${i}`).join('<br>');
}

function confirmNPCPart(n) {
    if (!activeTrade) return;
    if (n === 1) { activeTrade.p1Confirmed = true; document.getElementById('btn-npc-p1').style.background = 'var(--success)'; }
    if (n === 2) { activeTrade.p2Confirmed = true; document.getElementById('btn-npc-p2').style.background = 'var(--success)'; }
    if (activeTrade.p1Confirmed && activeTrade.p2Confirmed) document.getElementById('btn-npc-exec').style.display = 'block';
}

function executeNPCTrade() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == activeTrade.charId);
    
    activeTrade.giveItems.sort((a,b) => b-a).forEach(idx => char.inventory.splice(idx, 1));
    
    char.wallet.cp += parseInt(activeTrade.receiveCoins.cp) || 0;
    char.wallet.gp += parseInt(activeTrade.receiveCoins.gp) || 0;
    
    activeTrade.receiveItems.forEach(name => char.inventory.push({ name, weight: 1 }));
    
    saveAll(); closeModal(); renderParty(); renderMasterEye();
}

// --- GLOBAL BINDINGS ---
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
window.searchMonsters = searchMonsters;
window.showMonsterModal = showMonsterModal;
window.goToLootFromMonster = goToLootFromMonster;
window.markAsRead = markAsRead;
window.copyInviteCode = copyToClipboard;
window.showJoinForm = () => openModal(`
    <h2 class="cinzel">Unirse a Aventura</h2>
    <input type="text" id="join-code" placeholder="camp_...">
    <button onclick="window.joinCampaign()" class="btn-primary">UNIRSE</button>
`);
window.joinCampaign = () => {
    const code = document.getElementById('join-code').value.trim();
    if (!code) return;
    campaigns.push({ id: code, name: "Aventura Invitada", party: [], notices: [], isJoined: true });
    saveAll(); renderLobby(); closeModal();
};
window.reclaimMaster = (id) => {
    let camp = campaigns.find(c => c.id === id);
    if (camp) { camp.isJoined = false; saveAll(); location.reload(); }
};

window.showCharForm = showCharForm;
window.createCharacter = createCharacter;
window.renderParty = renderParty;
window.toggleInventory = toggleInventory;
window.generateEncounter = generateEncounter;
window.generateLoot = generateLoot;
window.executeLootAssign = executeLootAssign;
window.openNPCTrade = openNPCTrade;
window.updateNPCGive = updateNPCGive;
window.searchNPCItems = searchNPCItems;
window.addNPCItem = addNPCItem;
window.confirmNPCPart = confirmNPCPart;
window.executeNPCTrade = executeNPCTrade;

document.addEventListener('DOMContentLoaded', init);