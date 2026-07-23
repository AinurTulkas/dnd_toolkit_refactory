// --- ESTADO GLOBAL ---
const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const CONTAINERS = [
    "Cajita rota", "Vaso con doble fondo", "Alcancía de barro", "Saco de arpillera remendado", 
    "Alfolí de cuero viejo", "Cofre de pino astillado", "Bote de cerámica sellado", "Joyero de madera de sándalo", 
    "Estuche de pergamino reforzado", "Caja de munición oxidada", "Zurrón manchado de grasa", "Baúl con restos de moho", 
    "Arqueta de bronce verde", "Botella de vidrio opaco", "Fardo atado con cuerdas", "Escondite tras baldosa suelta", 
    "Orinal de plata", "Cofre de hierro remachado", "Maletín de boticario", "Caja de puros vacía", 
    "Barrilito de arenques falso", "Estatua hueca", "Libro hueco", "Calcetín de lana gorda", 
    "Bolsa de seda deshilachada", "Cofre de viaje", "Cofrecillo de marfil", "Urna funeraria", 
    "Cesta de mimbre con doble fondo", "Caja de herramientas"
];

let userTier = JSON.parse(localStorage.getItem('dnd_user_tier')) || { level: 'free', maxParties: 6 };
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let globalNotices = JSON.parse(localStorage.getItem('dnd_global_notices')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let srdData = { classes: [], races: [], monsters: [], items: [], weapons: [] };
let lastGeneratedLoot = null;

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_global_notices', JSON.stringify(globalNotices));
    localStorage.setItem('dnd_current_campaign', currentCampaignId || "");
    localStorage.setItem('dnd_role', currentRole);
    localStorage.setItem('dnd_user_tier', JSON.stringify(userTier));
}

// --- MODALES ---
function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (!overlay || !body) return;
    body.innerHTML = html;
    overlay.style.display = 'flex';
}
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

// --- LOBBY Y RITUAL ---
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
            <p style="color:var(--gold-muted); font-style:italic;">Asistente de Dungeon Master</p>
        </header>
        <div style="max-width:700px; margin:0 auto; padding:0 20px;">
            <div class="card">
                <h2 class="cinzel">Tablón Global</h2>
                <div id="global-board" style="max-height:200px; overflow-y:auto; background:#000; padding:15px; border-radius:8px;"></div>
                <button onclick="window.showGlobalNoticeForm()" class="btn-secondary" style="width:100%; margin-top:10px; font-size:0.8rem;">+ ANUNCIO PP</button>
            </div>
            <div class="card">
                <h2 class="cinzel">Mis Campañas (Master)</h2>
                <div id="master-campaigns"></div>
                <button onclick="window.showCampaignForm()" class="btn-primary" style="margin-top:20px;">INICIAR NUEVA AVENTURA</button>
                <button onclick="window.showRitual()" class="btn-secondary" style="width:100%; margin-top:10px; border-style:dashed;">[TEST] RITUAL DE ASCENSO</button>
            </div>
            <div class="card">
                <h2 class="cinzel">Mis Aventuras (Jugador)</h2>
                <div id="player-campaigns"></div>
                <button onclick="window.showJoinForm()" class="btn-secondary" style="width:100%; margin-top:10px;">+ UNIRSE A MESA</button>
            </div>
        </div>
    `;
    renderGlobalBoard();
    renderCampaignLists();
    container.style.display = 'block';
}

function renderGlobalBoard() {
    const res = document.getElementById('global-board');
    if (!res) return;
    res.innerHTML = globalNotices.map(n => `
        <div style="border-bottom:1px solid #222; padding:10px 0;">
            <b style="color:var(--gold); font-family:Cinzel;">${n.title}</b>
            <p style="margin:5px 0; font-size:0.85rem; color:#aaa;">${n.text}</p>
        </div>
    `).join('') || '<p style="text-align:center; color:#444;">No hay anuncios mundiales.</p>';
}

function renderCampaignLists() {
    const mContainer = document.getElementById('master-campaigns');
    const pContainer = document.getElementById('player-campaigns');
    const masterCamps = campaigns.filter(c => !c.isJoined);
    const playerCamps = campaigns.filter(c => c.isJoined);
    mContainer.innerHTML = masterCamps.map(c => renderCampaignItem(c, 'master')).join('') || '<p style="text-align:center; color:#444;">Sin campañas.</p>';
    pContainer.innerHTML = playerCamps.map(c => renderCampaignItem(c, 'adventurer')).join('') || '<p style="text-align:center; color:#444;">Sin aventuras.</p>';
}

function renderCampaignItem(c, role) {
    const isM = role === 'master';
    return `
        <div class="campaign-item" style="background:var(--charcoal); padding:15px; border-radius:10px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; border:1px solid #333;">
            <div onclick="window.selectCampaign('${c.id}', '${role}')" style="cursor:pointer; flex:1;">
                <h3 style="margin:0; color:var(--gold);">${c.name}</h3>
                <p style="margin:0; font-size:0.75rem; color:#666;">${(c.party || []).length} Héroes • ${role.toUpperCase()}</p>
            </div>
            <div style="display:flex; gap:15px;">
                ${!isM ? `<i class="fa-solid fa-crown" onclick="window.reclaimMaster('${c.id}')" style="color:var(--gold); cursor:pointer;" title="Reclamar Trono"></i>` : ''}
                ${isM ? `<i class="fa-solid fa-share-nodes" onclick="window.copyCode('${c.id}')" style="color:var(--gold); cursor:pointer;"></i>` : ''}
                <i class="fa-solid fa-trash" onclick="window.confirmDelete('${c.id}')" style="color:var(--danger); cursor:pointer;"></i>
            </div>
        </div>
    `;
}

function selectCampaign(id, role = 'master') {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return;
    currentCampaignId = id;
    currentRole = role;
    saveAll();
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title').innerText = camp.name;
    document.getElementById('role-indicator').style.display = 'block';
    document.getElementById('role-text').innerText = role.toUpperCase();
    renderMasterEye();
    renderNavigation();
    renderParty();
    renderLocalBoard();
    showTab('tab-home');
}

function renderMasterEye() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp || currentRole !== 'master') {
        const eye = document.getElementById('master-eye');
        if (eye) eye.remove();
        return;
    }
    let totals = { cp:0, sp:0, gp:0, pp:0 };
    (camp.party || []).forEach(p => {
        totals.cp += p.wallet.cp || 0;
        totals.sp += p.wallet.sp || 0;
        totals.gp += p.wallet.gp || 0;
        totals.pp += p.wallet.pp || 0;
    });
    let eye = document.getElementById('master-eye');
    if (!eye) {
        eye = document.createElement('div');
        eye.id = 'master-eye';
        document.body.prepend(eye);
    }
    eye.className = 'master-eye-bar';
    eye.innerHTML = `<span>OJO DEL MASTER</span><div class="coin-grid" style="gap:10px;"><span class="coin-cp">${totals.cp}c</span><span class="coin-sp">${totals.sp}s</span><span class="coin-gp">${totals.gp}g</span><span class="coin-pp">${totals.pp}p</span></div>`;
}

// --- TABS ---
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(t).style.display = 'block';
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.getAttribute('onclick').includes(t));
    if (btn) btn.classList.add('active');
}

function renderNavigation() {
    const nav = document.getElementById('main-nav');
    const isM = currentRole === 'master';
    nav.innerHTML = `
        <button onclick="window.showTab('tab-home')"><i class="fa-solid fa-house"></i><span>Home</span></button>
        ${isM ? `<button onclick="window.showTab('tab-combat')"><i class="fa-solid fa-bolt"></i><span>Batalla</span></button>` : ''}
        ${isM ? `<button onclick="window.showTab('tab-botin')"><i class="fa-solid fa-coins"></i><span>Botín</span></button>` : ''}
        <button onclick="window.showTab('tab-notices')"><i class="fa-solid fa-bullhorn"></i><span>Misiones</span></button>
        <button onclick="window.showTab('tab-party')"><i class="fa-solid fa-users"></i><span>Gremio</span></button>
    `;
}

// --- PERSONAJES ---
const CLASS_GEAR = {
    'Pícaro': { items: [{name:'Pack de Ladrón', weight:5}, {name:'Herramientas de Ladrón', weight:1}, {name:'Armadura de Cuero', weight:10}, {name:'Daga', weight:1}, {name:'Raciones (10 días)', weight:20}], wallet: {gp:15} },
    'Bardo': { items: [{name:'Pack de Artista', weight:5}, {name:'Laúd', weight:2}, {name:'Disfraz', weight:4}, {name:'Daga', weight:1}], wallet: {gp:10} },
    'Clérigo': { items: [{name:'Pack de Sacerdote', weight:8}, {name:'Símbolo Sagrado', weight:0.5}, {name:'Cota de Malla', weight:40}, {name:'Escudo', weight:6}], wallet: {gp:5} },
    'Mago': { items: [{name:'Pack de Erudito', weight:3}, {name:'Libro de Conjuros', weight:3}, {name:'Bastón Arcano', weight:4}], wallet: {gp:10} },
    'default': { items: [{name:'Pack de Explorador', weight:7}, {name:'Antorchas (10)', weight:10}, {name:'Raciones (5 días)', weight:10}], wallet: {gp:10} }
};

function showCharForm() {
    const races = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    const classes = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    openModal(`
        <h2 class="cinzel">Nuevo Aventurero</h2>
        <input type="text" id="char-name" placeholder="Nombre...">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <select id="char-race">${races || '<option>Humano</option>'}</select>
            <select id="char-class">${classes || '<option>Guerrero</option>'}</select>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:15px;">
            <div style="text-align:center;"><small>STR</small><input type="number" id="s-str" value="10"></div>
            <div style="text-align:center;"><small>DEX</small><input type="number" id="s-dex" value="10"></div>
            <div style="text-align:center;"><small>CON</small><input type="number" id="s-con" value="10"></div>
            <div style="text-align:center;"><small>INT</small><input type="number" id="s-int" value="10"></div>
            <div style="text-align:center;"><small>WIS</small><input type="number" id="s-wis" value="10"></div>
            <div style="text-align:center;"><small>CHA</small><input type="number" id="s-cha" value="10"></div>
        </div>
        <button onclick="window.createCharacter()" class="btn-primary" style="margin-top:20px;">FORJAR HÉROE</button>
    `);
}

function createCharacter() {
    const name = document.getElementById('char-name').value.trim();
    if (!name) return;
    const cls = document.getElementById('char-class').value;
    const gear = CLASS_GEAR[cls] || CLASS_GEAR['default'];
    const camp = campaigns.find(c => c.id === currentCampaignId);
    camp.party.push({ 
        id: Date.now(), name, class: cls, race: document.getElementById('char-race').value,
        level: 1, xp: 0,
        stats: { 
            str: parseInt(document.getElementById('s-str').value), 
            dex: parseInt(document.getElementById('s-dex').value), 
            con: parseInt(document.getElementById('s-con').value), 
            int: parseInt(document.getElementById('s-int').value), 
            wis: parseInt(document.getElementById('s-wis').value), 
            cha: parseInt(document.getElementById('s-cha').value) 
        },
        inventory: gear.items.map(it => ({...it, id: Math.random()})),
        wallet: { cp: 0, sp: 0, ep: 0, gp: gear.wallet.gp || 0, pp: 0 }
    });
    saveAll(); renderParty(); renderMasterEye(); closeModal();
}

function renderParty() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const res = document.getElementById('character-list');
    if (!res) return;
    res.innerHTML = (camp.party || []).map(c => {
        const totalW = c.inventory.reduce((s, i) => s + (i.weight || 0), 0);
        const maxW = (c.stats.str || 10) * 15;
        return `
            <div class="card" style="border-left:4px solid ${totalW > maxW ? 'var(--danger)' : 'var(--gold)'}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <h3 style="margin:0;">${c.name} <span style="font-size:0.6rem; background:var(--gold); color:black; padding:2px 5px; border-radius:3px; vertical-align:middle;">LVL ${c.level}</span></h3>
                        <p style="margin:0; font-size:0.8rem; color:#888;">${c.race} ${c.class} • XP: ${c.xp}</p>
                    </div>
                    <div style="text-align:right; font-size:0.7rem;">CARGA: ${totalW.toFixed(1)} / ${maxW} lb</div>
                </div>
                <div class="coin-grid" style="margin-top:10px; font-size:0.85rem;">
                    <span class="coin-cp">${c.wallet.cp}c</span>
                    <span class="coin-sp">${c.wallet.sp}s</span>
                    <span class="coin-gp">${c.wallet.gp}g</span>
                    <span class="coin-pp">${c.wallet.pp}p</span>
                </div>
                <div style="margin-top:12px; background:#000; padding:12px; border-radius:8px; font-size:0.85rem; border:1px solid #222;">
                    <b style="color:var(--gold); font-size:0.65rem; font-family:Cinzel;">MOCHILA:</b><br>
                    ${c.inventory.map((it, idx) => `
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>• ${it.name} (${it.weight}lb)</span>
                            <i class="fa-solid fa-pen" onclick="window.editItem(${c.id}, ${idx})" style="cursor:pointer; font-size:0.7rem; color:var(--gold-muted);"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('') || '<p style="text-align:center; color:#444;">Sin aventureros.</p>';
}

function editItem(charId, idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    const it = char.inventory[idx];
    openModal(`
        <h2 class="cinzel">Editar Objeto</h2>
        <input type="text" id="edit-n" value="${it.name}">
        <input type="number" id="edit-w" value="${it.weight}">
        <button onclick="window.saveItemEdit(${charId}, ${idx})" class="btn-primary">GUARDAR</button>
        <button onclick="window.deleteItem(${charId}, ${idx})" class="btn-secondary" style="width:100%; margin-top:10px; color:var(--danger);">ELIMINAR</button>
    `);
}

function saveItemEdit(charId, idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    char.inventory[idx].name = document.getElementById('edit-n').value;
    char.inventory[idx].weight = parseFloat(document.getElementById('edit-w').value);
    saveAll(); renderParty(); closeModal();
}

function deleteItem(charId, idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    char.inventory.splice(idx, 1);
    saveAll(); renderParty(); closeModal();
}

// --- MISIONES ---
function renderLocalBoard() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const res = document.getElementById('local-board');
    if (!res || !camp) return;
    res.innerHTML = (camp.notices || []).map((n, i) => `
        <div class="card" style="background:#0a0a0a; border-left:3px solid var(--danger);">
            <div style="display:flex; justify-content:space-between;">
                <h3 style="margin:0;">${n.title}</h3>
                ${currentRole === 'master' ? `<i class="fa-solid fa-trash" onclick="window.deleteMission(${i})" style="color:var(--danger); cursor:pointer;"></i>` : ''}
            </div>
            <p style="margin:10px 0; font-size:0.95rem; color:#ccc; white-space:pre-wrap;">${n.text}</p>
            <div style="border-top:1px solid #222; padding-top:10px;">
                ${(n.readBy || []).map(() => `<div class="wax-seal"></div>`).join('')}
                ${currentRole === 'adventurer' ? `<button onclick="window.markRead(${i})" class="btn-secondary" style="font-size:0.6rem; padding:4px 10px;">SELLAR LECTURA</button>` : ''}
            </div>
        </div>
    `).join('') || '<p style="text-align:center; color:#444;">Sin misiones activas.</p>';
}

function addMission() {
    const t = document.getElementById('mission-title').value.trim();
    const x = document.getElementById('mission-text').value.trim();
    if (!t || !x) return;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp.notices) camp.notices = [];
    camp.notices.unshift({title: t, text: x, readBy: [], date: Date.now()});
    saveAll(); renderLocalBoard();
    document.getElementById('mission-title').value = '';
    document.getElementById('mission-text').value = '';
}

function deleteMission(i) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    camp.notices.splice(i, 1);
    saveAll(); renderLocalBoard();
}

// --- COMBATE Y REPARTO ---
function generateEncounter(diff) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp || !camp.party.length) return alert('No hay héroes.');
    const avg = camp.party.reduce((s, p) => s + p.level, 0) / camp.party.length;
    let min, max;
    if (diff === 'hard') { min = avg + 1; max = avg + 3; }
    else { min = Math.max(0, avg - 1); max = avg; }
    const matches = srdData.monsters.filter(m => eval(m.cr) >= min && eval(m.cr) <= max);
    const m = matches[Math.floor(Math.random() * matches.length)] || srdData.monsters[0];
    openModal(`
        <h2 class="cinzel" style="color:var(--gold);">${m.name}</h2>
        <p style="text-align:center;">CR: ${m.cr} | HP: ${m.hp} | CA: ${m.ac}</p>
        <button onclick="window.generateLoot('${m.cr}', '${m.type}', '${m.name}', true)" class="btn-primary">DERROTAR CRIATURA</button>
    `);
}

function generateLoot(crStr, type, name, isBattle) {
    const cr = eval(crStr);
    const xp = isBattle ? (Math.floor(cr * 200) || 50) : 0;
    let title = name;
    if (!isBattle) {
        title = CONTAINERS[Math.floor(Math.random() * CONTAINERS.length)];
    }
    const coins = { cp: Math.floor(Math.random() * 50 * cr), sp: Math.floor(Math.random() * 20 * cr), gp: Math.floor(Math.random() * 10 * cr) };
    const items = [];
    if (Math.random() > 0.4) items.push({name: isBattle ? `Botín de ${name}` : `Hallazgo en ${title}`, weight: 1});
    lastGeneratedLoot = { coins, items, xp, source: title };
    openModal(`
        <h2 class="cinzel">${title}</h2>
        <div style="text-align:center; padding:10px;">
            <p style="color:var(--gold); font-size:1.2rem;">${coins.cp}c, ${coins.sp}s, ${coins.gp}g</p>
            <p style="color:#aaa;">XP: ${xp}</p>
            ${items.map(i=>`<p>• ${i.name}</p>`).join('')}
        </div>
        <button onclick="window.executeReparto()" class="btn-primary">REPARTIR ENTRE TODOS</button>
    `);
}

function executeReparto() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const { coins, items, xp } = lastGeneratedLoot;
    const pCount = camp.party.length || 1;
    camp.party.forEach(p => {
        p.xp += Math.floor(xp / pCount);
        p.wallet.cp += Math.floor(coins.cp / pCount);
        p.wallet.sp += Math.floor(coins.sp / pCount);
        p.wallet.gp += Math.floor(coins.gp / pCount);
        for(let i=0; i<XP_TABLE.length; i++) { if(p.xp >= XP_TABLE[i]) p.level = i+1; else break; }
    });
    if (!camp.lastRecipientIdx) camp.lastRecipientIdx = 0;
    items.forEach(it => {
        const recipient = camp.party[camp.lastRecipientIdx % pCount];
        recipient.inventory.push({...it});
        camp.lastRecipientIdx++;
    });
    saveAll(); closeModal(); renderParty(); renderMasterEye();
    openModal(`<h2 class="cinzel">Reparto Hecho</h2><p style="text-align:center;">El botín ha sido entregado a los aventureros.</p><button onclick="window.closeModal()" class="btn-primary">LISTO</button>`);
}

// --- SRD Y LOBBY BINDINGS ---
async function loadSRDData() {
    try { const r = await fetch('data/srd_data.json'); srdData = await r.json(); } catch(e) {}
}

function exitToLobby() { currentCampaignId = null; saveAll(); location.reload(); }

window.showTab = showTab;
window.selectCampaign = selectCampaign;
window.exitToLobby = exitToLobby;
window.showCharForm = showCharForm;
window.createCharacter = createCharacter;
window.renderParty = renderParty;
window.editItem = editItem;
window.saveItemEdit = saveItemEdit;
window.deleteItem = deleteItem;
window.addMission = addMission;
window.deleteMission = deleteMission;
window.generateEncounter = generateEncounter;
window.generateLoot = generateLoot;
window.executeReparto = executeReparto;
window.closeModal = closeModal;
window.confirmDelete = (id) => { if(confirm('¿Borrar aventura?')) { campaigns = campaigns.filter(c=>c.id!==id); saveAll(); renderLobby(); } };
window.showCampaignForm = () => openModal(`<h2 class="cinzel">Nueva Aventura</h2><input type="text" id="nc-n" placeholder="Nombre de la campaña..."><button onclick="window.saveNewCamp()" class="btn-primary">INICIAR</button>`);
window.saveNewCamp = () => { const n = document.getElementById('nc-n').value; campaigns.push({id:'camp_'+Date.now(), name:n, party:[], notices:[], lastRecipientIdx:0}); saveAll(); renderLobby(); closeModal(); };
window.copyCode = (id) => { navigator.clipboard.writeText(id); alert('Código de invitación copiado.'); };
window.showJoinForm = () => openModal(`<h2 class="cinzel">Unirse</h2><input type="text" id="j-id" placeholder="Código de la mesa..."><button onclick="window.join()" class="btn-primary">ENTRAR</button>`);
window.join = () => { const id = document.getElementById('j-id').value; campaigns.push({id, name:'Aventura Unida', party:[], notices:[], isJoined:true, lastRecipientIdx:0}); saveAll(); renderLobby(); closeModal(); };
window.reclaimMaster = (id) => { const camp = campaigns.find(c=>c.id===id); if(camp){ camp.isJoined=false; saveAll(); location.reload(); } };
window.showGlobalNoticeForm = () => openModal(`<h2 class="cinzel">Anuncio Mundial</h2><input type="text" id="gn-t" placeholder="Título..."><textarea id="gn-x" placeholder="Mensaje..."></textarea><button onclick="window.addGlobalNotice()" class="btn-primary">PUBLICA</button>`);
window.addGlobalNotice = () => { const t = document.getElementById('gn-t').value; const x = document.getElementById('gn-x').value; globalNotices.unshift({title:t, text:x}); saveAll(); renderGlobalBoard(); closeModal(); };
window.showRitual = () => openModal(`<div class="dice-ritual-area"><h2 class="cinzel">Ritual de Ascenso</h2><div class="d20-visual"><i class="fa-solid fa-dice-d20"></i></div><p style="font-size:0.8rem;">[Toca el dado para iniciar el ritual]</p><button onclick="window.closeModal()" class="btn-secondary" style="margin-top:20px; width:100%;">CERRAR</button></div>`);

document.addEventListener('DOMContentLoaded', init);