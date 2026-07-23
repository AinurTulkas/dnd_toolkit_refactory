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
}

// --- MODAL SYSTEM ---
function openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    if (!overlay || !body) return;
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
                <h2 class="cinzel">Mis Campañas (Master)</h2>
                <div id="master-campaigns"></div>
                <button onclick="window.showCampaignForm()" class="btn-primary" style="margin-top:20px;">INICIAR NUEVA AVENTURA</button>
            </div>
            <div class="card">
                <h2 class="cinzel">Mis Aventuras (Jugador)</h2>
                <div id="player-campaigns"></div>
                <button onclick="window.showJoinForm()" class="btn-secondary" style="margin-top:10px; width:100%;">+ UNIRSE A MESA</button>
            </div>
        </div>
    `;
    renderCampaignLists();
    document.getElementById('lobby-overlay').style.display = 'block';
}

function renderCampaignLists() {
    const mContainer = document.getElementById('master-campaigns');
    const pContainer = document.getElementById('player-campaigns');
    const masterCamps = campaigns.filter(c => !c.isJoined);
    const playerCamps = campaigns.filter(c => c.isJoined);
    
    mContainer.innerHTML = masterCamps.map(c => renderCampaignItem(c, 'master')).join('') || '<p style="color:#444; text-align:center;">No eres Master.</p>';
    pContainer.innerHTML = playerCamps.map(c => renderCampaignItem(c, 'adventurer')).join('') || '<p style="color:#444; text-align:center;">No eres jugador.</p>';
}

function renderCampaignItem(c, role) {
    return `
        <div class="campaign-item">
            <div onclick="window.selectCampaign('${c.id}', '${role}')" style="flex:1; cursor:pointer;">
                <h3 style="margin:0; color:var(--gold);">${c.name}</h3>
                <p style="margin:0; font-size:0.8rem; color:#666;">${(c.party || []).length} Héroes • ${role.toUpperCase()}</p>
            </div>
            <div style="display:flex; gap:15px; align-items:center;">
                ${role === 'master' ? `<i class="fa-solid fa-share-nodes" onclick="event.stopPropagation(); window.copyCode('${c.id}')" style="color:var(--gold); cursor:pointer;"></i>` : ''}
                <i class="fa-solid fa-trash" onclick="event.stopPropagation(); window.confirmDelete('${c.id}')" style="color:var(--danger); cursor:pointer;"></i>
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
    renderNavigation();
    renderParty();
    showTab('tab-home');
}

function renderNavigation() {
    const nav = document.getElementById('main-nav');
    const isM = currentRole === 'master';
    nav.innerHTML = `
        <button onclick="window.showTab('tab-home')"><i class="fa-solid fa-house"></i><span>Home</span></button>
        ${isM ? `<button onclick="window.showTab('tab-combat')"><i class="fa-solid fa-bolt"></i><span>Batalla</span></button>` : ''}
        ${isM ? `<button onclick="window.showTab('tab-botin')"><i class="fa-solid fa-coins"></i><span>Botín</span></button>` : ''}
        <button onclick="window.showTab('tab-party')"><i class="fa-solid fa-users"></i><span>Gremio</span></button>
    `;
}

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(t).style.display = 'block';
}

// --- PERSONAJES & INVENTARIO INICIAL ---
const CLASS_GEAR = {
    'Pícaro': { 
        items: [{name:'Pack de Ladrón', weight:5}, {name:'Herramientas de Ladrón', weight:1}, {name:'Armadura de Cuero', weight:10}, {name:'Daga', weight:1}, {name:'Daga', weight:1}],
        wallet: {gp:15, sp:0, cp:0}
    },
    'Bardo': { 
        items: [{name:'Pack de Artista', weight:5}, {name:'Laúd', weight:2}, {name:'Armadura de Cuero', weight:10}, {name:'Daga', weight:1}],
        wallet: {gp:10, sp:0, cp:0}
    },
    'Clérigo': { 
        items: [{name:'Pack de Sacerdote', weight:8}, {name:'Símbolo Sagrado', weight:0.5}, {name:'Cota de Malla', weight:40}, {name:'Escudo', weight:6}],
        wallet: {gp:5, sp:0, cp:0}
    },
    'Mago': { 
        items: [{name:'Pack de Erudito', weight:3}, {name:'Libro de Conjuros', weight:3}, {name:'Bastón Arcano', weight:4}],
        wallet: {gp:10, sp:0, cp:0}
    },
    'default': {
        items: [{name:'Pack de Explorador', weight:7}, {name:'Arma Sencilla', weight:3}, {name:'Raciones (5 días)', weight:10}],
        wallet: {gp:10, sp:0, cp:0}
    }
};

function showCharForm() {
    const races = (srdData.races || [{name:'Humano'}]).map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    const classes = (srdData.classes || [{name:'Guerrero'}]).map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    openModal(`
        <h2 class="cinzel">Crear Aventurero</h2>
        <input type="text" id="char-name" placeholder="Nombre del héroe...">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <select id="char-race">${races}</select>
            <select id="char-class">${classes}</select>
        </div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:15px;">
            <div class="stat-box">STR<input type="number" id="s-str" value="10"></div>
            <div class="stat-box">DEX<input type="number" id="s-dex" value="10"></div>
            <div class="stat-box">CON<input type="number" id="s-con" value="10"></div>
            <div class="stat-box">INT<input type="number" id="s-int" value="10"></div>
            <div class="stat-box">WIS<input type="number" id="s-wis" value="10"></div>
            <div class="stat-box">CHA<input type="number" id="s-cha" value="10"></div>
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
        id: Date.now(),
        name,
        race: document.getElementById('char-race').value,
        class: cls,
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
        wallet: { cp: 0, sp: 0, ep: 0, gp: gear.wallet.gp, pp: 0 }
    });
    saveAll(); renderParty(); closeModal();
}

function renderParty() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const res = document.getElementById('character-list');
    res.innerHTML = (camp.party || []).map(c => {
        const totalW = c.inventory.reduce((s, i) => s + (i.weight || 0), 0);
        const maxW = (c.stats.str || 10) * 15;
        return `
            <div class="card" style="border-left:4px solid ${totalW > maxW ? 'var(--danger)' : 'var(--gold)'}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <h3 style="margin:0;">${c.name} <span style="font-size:0.7rem; color:var(--gold-muted);">LVL ${c.level}</span></h3>
                        <p style="margin:0; font-size:0.8rem; color:#666;">${c.race} ${c.class} • XP: ${c.xp}</p>
                    </div>
                    <div style="text-align:right; font-size:0.75rem;">
                        CARGA: ${totalW.toFixed(1)} / ${maxW} lb
                    </div>
                </div>
                <div class="coin-grid" style="margin-top:10px;">
                    <span class="coin-cp">${c.wallet.cp}c</span>
                    <span class="coin-sp">${c.wallet.sp}s</span>
                    <span class="coin-gp">${c.wallet.gp}g</span>
                    <span class="coin-pp">${c.wallet.pp}p</span>
                </div>
                <div style="margin-top:10px; font-size:0.85rem; background:#000; padding:10px; border-radius:8px;">
                    <b style="font-family:Cinzel; font-size:0.7rem; color:var(--gold);">MOCHILA:</b><br>
                    ${c.inventory.map((it, idx) => `
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>• ${it.name} (${it.weight}lb)</span>
                            <i class="fa-solid fa-pen" onclick="window.editItem(${c.id}, ${idx})" style="cursor:pointer; font-size:0.7rem;"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function editItem(charId, itemIdx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    const it = char.inventory[itemIdx];
    
    openModal(`
        <h2 class="cinzel">Editar Objeto</h2>
        <input type="text" id="edit-it-name" value="${it.name}">
        <input type="number" id="edit-it-weight" value="${it.weight}">
        <p style="font-size:0.7rem; color:#666;">* Usa la lista del SRD o crea uno propio.</p>
        <button onclick="window.saveItemEdit(${charId}, ${itemIdx})" class="btn-primary">GUARDAR</button>
        <button onclick="window.deleteItem(${charId}, ${itemIdx})" class="btn-secondary" style="margin-top:10px; width:100%; border-color:var(--danger); color:var(--danger);">BORRAR OBJETO</button>
    `);
}

function saveItemEdit(charId, idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    char.inventory[idx].name = document.getElementById('edit-it-name').value;
    char.inventory[idx].weight = parseFloat(document.getElementById('edit-it-weight').value);
    saveAll(); renderParty(); closeModal();
}

function deleteItem(charId, idx) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    char.inventory.splice(idx, 1);
    saveAll(); renderParty(); closeModal();
}

// --- COMBATE & BOTÍN ROUND-ROBIN ---
function generateEncounter(diff) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const avgLvl = camp.party.reduce((s, p) => s + p.level, 0) / (camp.party.length || 1);
    let min, max;
    if (diff === 'hard') { min = avgLvl + 1; max = avgLvl + 3; }
    else { min = Math.max(0, avgLvl - 1); max = avgLvl; }

    const matches = srdData.monsters.filter(m => eval(m.cr) >= min && eval(m.cr) <= max);
    const monster = matches[Math.floor(Math.random() * matches.length)] || srdData.monsters[0];
    showMonsterModal(monster);
}

function showMonsterModal(m) {
    openModal(`
        <h2 class="cinzel" style="text-align:center;">${m.name}</h2>
        <p style="text-align:center;">CR: ${m.cr} | HP: ${m.hp}</p>
        <button onclick="window.generateLoot('${m.cr}', '${m.type}', '${m.name}', true)" class="btn-primary">DERROTAR</button>
    `);
}

function generateLoot(crStr, type, name, isBattle) {
    const cr = eval(crStr);
    const xp = isBattle ? (Math.floor(cr * 200) || 50) : 0;
    
    let title = name;
    if (!isBattle) {
        const rand = Math.random();
        if (rand < 0.05) title = "Cofre Mágico";
        else if (rand < 0.2) title = "Cofre Grande";
        else title = CONTAINERS[Math.floor(Math.random() * CONTAINERS.length)];
    }

    let coins = { cp: Math.floor(Math.random() * 50 * cr), sp: Math.floor(Math.random() * 20 * cr), gp: Math.floor(Math.random() * 10 * cr) };
    let items = [];
    if (Math.random() > 0.5) items.push({ name: isBattle ? `Restos de ${name}` : 'Trinket extraño', weight: 1 });

    lastGeneratedLoot = { coins, items, xp, source: title };
    
    openModal(`
        <h2 class="cinzel">${title}</h2>
        <div style="text-align:center; margin-bottom:20px;">
            <p style="color:var(--gold);">Monedas: ${coins.cp}c, ${coins.sp}s, ${coins.gp}g</p>
            <p>XP: ${xp}</p>
            ${items.map(it => `<p>• ${it.name}</p>`).join('')}
        </div>
        <button onclick="window.executeReparto()" class="btn-primary">REPARTIR BOTÍN</button>
    `);
}

function executeReparto() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const { coins, items, xp } = lastGeneratedLoot;
    const pCount = camp.party.length || 1;
    
    // Reparto Monedas y XP
    camp.party.forEach(p => {
        p.xp += Math.floor(xp / pCount);
        p.wallet.cp += Math.floor(coins.cp / pCount);
        p.wallet.sp += Math.floor(coins.sp / pCount);
        p.wallet.gp += Math.floor(coins.gp / pCount);
        const oldL = p.level;
        p.level = getLevelFromXP(p.xp);
    });

    // Round-Robin para Objetos
    if (!camp.lastRecipientIdx) camp.lastRecipientIdx = 0;
    items.forEach(it => {
        const recipient = camp.party[camp.lastRecipientIdx % pCount];
        recipient.inventory.push({...it});
        camp.lastRecipientIdx++;
    });

    saveAll();
    openModal(`
        <h2 class="cinzel">Reparto Completado</h2>
        <p style="text-align:center;">El botín ha sido distribuido equitativamente.</p>
        <button onclick="window.closeModal(); window.renderParty();" class="btn-primary">CONTINUAR</button>
    `);
}

// --- SRD & INIT ---
async function loadSRDData() {
    try {
        const r = await fetch('data/srd_data.json');
        srdData = await r.json();
    } catch(e) { console.warn("SRD fail"); }
}

window.showTab = showTab;
window.selectCampaign = selectCampaign;
window.showCharForm = showCharForm;
window.createCharacter = createCharacter;
window.generateEncounter = generateEncounter;
window.generateLoot = generateLoot;
window.executeReparto = executeReparto;
window.editItem = editItem;
window.saveItemEdit = saveItemEdit;
window.deleteItem = deleteItem;
window.closeModal = closeModal;
window.confirmDelete = (id) => { if(confirm('¿Borrar campaña?')) { campaigns = campaigns.filter(c=>c.id!==id); saveAll(); renderLobby(); } };
window.showCampaignForm = () => {
    openModal(`
        <h2 class="cinzel">Nueva Aventura</h2>
        <input type="text" id="new-camp-name" placeholder="Nombre...">
        <button onclick="window.saveNewCamp()" class="btn-primary">CREAR</button>
    `);
};
window.saveNewCamp = () => {
    const name = document.getElementById('new-camp-name').value;
    campaigns.push({id:'camp_'+Date.now(), name, party:[], notices:[], lastRecipientIdx:0});
    saveAll(); renderLobby(); closeModal();
};
window.copyCode = (id) => { navigator.clipboard.writeText(id); alert('Código copiado: ' + id); };
window.showJoinForm = () => {
    openModal(`
        <h2 class="cinzel">Unirse</h2>
        <input type="text" id="join-id" placeholder="Código de la mesa...">
        <button onclick="window.join()" class="btn-primary">UNIRSE</button>
    `);
};
window.join = () => {
    const id = document.getElementById('join-id').value;
    campaigns.push({id, name:'Aventura Unida', party:[], notices:[], isJoined:true, lastRecipientIdx:0});
    saveAll(); renderLobby(); closeModal();
};

document.addEventListener('DOMContentLoaded', init);