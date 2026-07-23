// --- ESTADO ---
let userTier = JSON.parse(localStorage.getItem('dnd_user_tier')) || { level: 'free', maxParties: 6, rolls: [] };
function saveTier() { localStorage.setItem('dnd_user_tier', JSON.stringify(userTier)); }

let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let globalNotices = JSON.parse(localStorage.getItem('dnd_global_notices')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let srdData = { classes: [], races: [], monsters: [], items: [], weapons: [] };
let useXP = true;

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_global_notices', JSON.stringify(globalNotices));
    localStorage.setItem('dnd_current_campaign', currentCampaignId || "");
    localStorage.setItem('dnd_role', currentRole);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => console.log("Copiado"));
}

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

function toggleXP(val) {
    useXP = val;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (camp) camp.useXP = val;
    saveAll();
    renderParty();
}

function levelUp(charId) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    if (char) {
        char.level = (char.level || 1) + 1;
        saveAll();
        renderParty();
    }
}

function levelUpAll() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (camp && camp.party) {
        camp.party.forEach(p => p.level = (p.level || 1) + 1);
        saveAll();
        renderParty();
    }
}

function openAwardSeal(charId) {
    let html = '<h2 class="cinzel">Otorgar Insignia</h2>' +
        '<input type="text" id="seal-name" placeholder="Hito (ej: Matadragones)">' +
        '<p style="font-size:0.8rem; color:#666;">Selecciona un icono:</p>' +
        '<div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:10px; margin-bottom:20px;">' +
        '<i class="fa-solid fa-dragon" style="cursor:pointer; font-size:1.5rem;" onclick="window.selectSealIcon(this, \'fa-dragon\')"></i>' +
        '<i class="fa-solid fa-skull" style="cursor:pointer; font-size:1.5rem;" onclick="window.selectSealIcon(this, \'fa-skull\')"></i>' +
        '<i class="fa-solid fa-shield-halved" style="cursor:pointer; font-size:1.5rem;" onclick="window.selectSealIcon(this, \'fa-shield-halved\')"></i>' +
        '<i class="fa-solid fa-gem" style="cursor:pointer; font-size:1.5rem;" onclick="window.selectSealIcon(this, \'fa-gem\')"></i>' +
        '<i class="fa-solid fa-scroll" style="cursor:pointer; font-size:1.5rem;" onclick="window.selectSealIcon(this, \'fa-scroll\')"></i>' +
        '</div>' +
        '<input type="hidden" id="selected-icon" value="fa-award">' +
        '<button onclick="window.saveSeal(\'' + charId + '\')" class="btn-primary">OTORGAR</button>';
    openModal(html);
}

let lastSelectedIconEl = null;
function selectSealIcon(el, icon) {
    if (lastSelectedIconEl) lastSelectedIconEl.style.color = '';
    el.style.color = 'var(--gold)';
    lastSelectedIconEl = el;
    document.getElementById('selected-icon').value = icon;
}

function saveSeal(charId) {
    const name = document.getElementById('seal-name').value.trim() || "Hito";
    const icon = document.getElementById('selected-icon').value;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const char = camp.party.find(p => p.id == charId);
    if (char) {
        if (!char.seals) char.seals = [];
        char.seals.push({ name, icon });
        saveAll();
        closeModal();
        renderParty();
    }
}

function init() {
    renderLobby();
    if (currentCampaignId) selectCampaign(currentCampaignId, currentRole);
}

function renderLobby() {
    const container = document.getElementById('lobby-overlay');
    if (!container) return;
    container.innerHTML = '<header style="padding:40px 20px; text-align:center;"><h1 style="font-size:3rem; margin:0; letter-spacing:4px;">GRIMOIRE PRO</h1><p style="color:var(--gold-muted); font-style:italic;">Asistente para Dungeon Masters</p></header><div style="max-width:700px; margin:0 auto; padding:0 20px;"><div class="card"><h2 class="cinzel">Mis Campañas</h2><div id="master-campaigns"></div><button onclick="window.showCampaignForm()" class="btn-primary" style="margin-top:20px;">INICIAR NUEVA AVENTURA</button></div></div>';
    renderCampaignLists();
    container.style.display = 'block';
}

function renderCampaignLists() {
    const mContainer = document.getElementById('master-campaigns');
    if (!mContainer) return;
    mContainer.innerHTML = campaigns.map(c => 
        '<div class="campaign-item" onclick="window.selectCampaign(\''+c.id+'\')"><div><h3 style="margin:0; color:var(--gold);">' + c.name + '</h3><p style="margin:0; font-size:0.8rem; color:#666;">' + (c.party || []).length + ' Héroes</p></div><i class="fa-solid fa-trash" onclick="event.stopPropagation(); window.confirmDeleteCampaign(\''+c.id+'\')" style="color:var(--danger); cursor:pointer;"></i></div>').join('') || '<p style="text-align:center; color:#444; font-style:italic;">No hay aventuras registradas.</p>';
}

function selectCampaign(id, role = \'master\') {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return;
    currentCampaignId = id; currentRole = role;
    useXP = camp.useXP !== undefined ? camp.useXP : true;
    saveAll();
    document.getElementById(\'lobby-overlay\').style.display = \'none\';
    document.getElementById(\'campaign-title\').innerText = camp.name;
    renderNavigation(); renderParty(); showTab(\'tab-home\');
}

function showTab(t) {
    document.querySelectorAll(\'.tab-content\').forEach(el => el.style.display = \'none\');
    const target = document.getElementById(t);
    if (target) target.style.display = \'block\';
    document.querySelectorAll(\'nav button\').forEach(b => b.classList.remove(\'active\'));
    const navButtons = document.querySelectorAll(\'nav button\');
    navButtons.forEach(btn => {
        if (btn.getAttribute(\'onclick\') && btn.getAttribute(\'onclick\').includes(t)) btn.classList.add(\'active\');
    });
}

function renderNavigation() {
    const nav = document.getElementById(\'main-nav\');
    if (!nav) return;
    const isM = currentRole === \'master\';
    let html = \'<button onclick="window.showTab(\\'tab-home\\\')"><i class="fa-solid fa-house"></i><span>Home</span></button>\';
    if(isM) html += \'<button onclick="window.showTab(\\'tab-combat\\\')"><i class="fa-solid fa-bolt"></i><span>Batalla</span></button>\';
    html += \'<button onclick="window.showTab(\\'tab-party\\\')"><i class="fa-solid fa-users"></i><span>Gremio</span></button>\';
    nav.innerHTML = html;
}

function renderParty() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const res = document.getElementById(\'character-list\');
    if (!res) return;
    res.innerHTML = (camp.party || []).map(p => 
        \'<div class="card" style="margin-bottom:15px; padding:15px;"><div style="display:flex; justify-content:space-between; align-items:center;"><div onclick="window.toggleInventory(\\\'\' + p.id + \'\\\')" style="cursor:pointer; flex:1;"><h3 style="margin:0; font-size:1.2rem;">\' + p.name + \'</h3><p style="margin:0; font-size:0.8rem; color:#888;">Nivel \' + (p.level || 1) + (!useXP && currentRole === \'master\' ? \' <button onclick="event.stopPropagation(); window.levelUp(\\\'\'+p.id+\'\\\')" class="btn-lvl-up">+1 LVL</button>\' : \'\') + \'</p><div class="badge-container">\' + (p.seals || []).map(s => \'<div class="badge-item" title="\'+s.name+\'"><i class="fa-solid \'+s.icon+\'"></i> \'+s.name+\'</div>\').join(\'\') + \'</div></div>\' + (currentRole === \'master\' ? \'<i class="fa-solid fa-award" onclick="window.openAwardSeal(\\\'\'+p.id+\'\\\')" style="color:var(--gold); cursor:pointer; font-size:1.2rem;"></i>\' : \'\') + \'</div><div id="inv-\' + p.id + \'" style="display:none; margin-top:15px; background:#000; padding:15px; border-radius:8px; border:1px solid #222;"><div class="coin-grid"><span>\'+p.wallet.cp+\'c</span> <span>\'+p.wallet.sp+\'s</span> <span>\'+p.wallet.gp+\'g</span> <span>\'+p.wallet.pp+\'p</span></div></div></div>\').join(\'\') || \'<p style="text-align:center; color:#444;">No hay héroes registrados.</p>\';
}

function showCharForm() {
    openModal(\'<h2 class="cinzel">Nuevo Héroe</h2><input type="text" id="form-char-name" placeholder="Nombre..."><button onclick="window.createCharacter()" class="btn-primary">CREAR</button>\');
}

function createCharacter() {
    const name = document.getElementById(\'form-char-name\').value.trim();
    if (!name) return;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    if (!camp.party) camp.party = [];
    camp.party.push({ id: Date.now(), name, level: 1, inventory: [], seals: [], wallet: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } });
    saveAll(); renderParty(); closeModal();
}

function toggleInventory(id) { const d = document.getElementById(\'inv-\' + id); if (d) d.style.display = (d.style.display === \'none\' ? \'block\' : \'none\'); }
async function loadSRDData() {}
function exitToLobby() { currentCampaignId = null; saveAll(); location.reload(); }
function showCampaignForm() { openModal(\'<h2 class="cinzel">Nueva Aventura</h2><input type="text" id="form-camp-name" placeholder="Nombre..."><button onclick="window.saveCampaign()" class="btn-primary">GUARDAR</button>\'); }
function saveCampaign() { const n = document.getElementById(\'form-camp-name\').value.trim(); if (!n) return; campaigns.push({id:\'camp_\'+Date.now(), name:n, party:[], notices:[]}); saveAll(); renderLobby(); closeModal(); }
function confirmDeleteCampaign(id) { campaigns = campaigns.filter(c => c.id !== id); saveAll(); renderLobby(); }

document.addEventListener(\'DOMContentLoaded\', init);
window.showTab = showTab; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.toggleXP = toggleXP; window.levelUp = levelUp; window.levelUpAll = levelUpAll; window.openAwardSeal = openAwardSeal; window.selectSealIcon = selectSealIcon; window.saveSeal = saveSeal; window.showCharForm = showCharForm; window.createCharacter = createCharacter; window.toggleInventory = toggleInventory; window.showCampaignForm = showCampaignForm; window.saveCampaign = saveCampaign; window.confirmDeleteCampaign = confirmDeleteCampaign; window.closeModal = closeModal;