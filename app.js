// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let party = [];
let srdData = { classes: [], races: [], genders: [], monsters: [], weapons: [], armor: [], items: [] };
let diceTray = [];
let currentLoot = null;

const badWords = ["mierda", "puta", "joder", "cabron", "cojones"];

// --- UTILIDADES ---
const calculateMod = (val) => { const mod = Math.floor((val - 10) / 2); return mod >= 0 ? `+${mod}` : `${mod}`; };
const filterProfanity = (text) => { let filtered = text; badWords.forEach(word => { const regex = new RegExp(word, 'gi'); filtered = filtered.replace(regex, "****"); }); return filtered; };

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_current_campaign', currentCampaignId);
    localStorage.setItem('dnd_role', currentRole);
}

// --- LÓGICA DE LOBBY ---
function renderCampaignList() {
    const container = document.getElementById('campaign-list'); if (!container) return;
    if (campaigns.length === 0) { container.innerHTML = '<p style="color:#666; font-style:italic;">No hay campañas.</p>'; return; }
    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item">
            <div class="campaign-info" onclick="selectCampaign('${c.id}')">
                <h3 style="font-family:'Cinzel'; color:var(--gold); margin:0;">${c.name}</h3>
                <p style="font-size:0.9rem; color:#888; margin:5px 0 0;">${c.party.length} Héroes</p>
            </div>
            <div class="campaign-controls">
                <button class="btn-mini" onclick="editCampaignName('${c.id}')">EDITAR</button>
                <button class="btn-mini btn-delete-camp" onclick="deleteCampaign('${c.id}')">ELIMINAR</button>
            </div>
        </div>
    `).join('');
}

function showCreateCampaign() { 
    document.getElementById('campaign-form-title').innerText = "Nueva Campaña";
    document.getElementById('btn-save-campaign').innerText = "CREAR";
    document.getElementById('edit-campaign-id').value = "";
    document.getElementById('create-campaign-form').style.display = 'block';
    document.getElementById('campaign-list').style.display = 'none';
}

function hideCreateCampaign() { 
    document.getElementById('create-campaign-form').style.display = 'none';
    document.getElementById('campaign-list').style.display = 'block';
}

function saveCampaign() {
    const nameInput = document.getElementById('new-campaign-name');
    const name = nameInput.value.trim();
    const editId = document.getElementById('edit-campaign-id').value;
    if (!name) return;

    if (editId) {
        const camp = campaigns.find(c => c.id === editId);
        if(camp) camp.name = name;
    } else {
        campaigns.push({ id: 'camp_' + Date.now(), name, party: [], notices: [], config: { combat: true, loot: true, community: true } });
    }
    
    saveAll(); nameInput.value = ''; hideCreateCampaign(); renderCampaignList();
}

function editCampaignName(id) {
    const camp = campaigns.find(c => c.id === id);
    if(!camp) return;
    document.getElementById('campaign-form-title').innerText = "Editar Campaña";
    document.getElementById('btn-save-campaign').innerText = "GUARDAR";
    document.getElementById('new-campaign-name').value = camp.name;
    document.getElementById('edit-campaign-id').value = id;
    document.getElementById('create-campaign-form').style.display = 'block';
    document.getElementById('campaign-list').style.display = 'none';
}

function deleteCampaign(id) {
    if(confirm("¿Seguro que quieres borrar toda esta campaña? Esta acción no se puede deshacer.")) {
        campaigns = campaigns.filter(c => c.id !== id);
        saveAll(); renderCampaignList();
    }
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return exitToLobby();
    currentCampaignId = id; party = camp.party; saveAll();
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title-display').innerText = camp.name;
    applyRoleUI(); renderNavigation(); showTab('tab-home');
}

function exitToLobby() { currentCampaignId = null; saveAll(); location.reload(); }

// --- ROLES Y SEGURIDAD ---
function applyRoleUI() {
    const isM = currentRole === 'master';
    document.getElementById('current-role-text').innerText = isM ? 'DUNGEON MASTER' : 'AVENTURERO';
    document.getElementById('role-selector').value = currentRole;
    document.body.className = isM ? 'is-master' : 'is-adventurer';
}
function changeRole() { currentRole = document.getElementById('role-selector').value; saveAll(); applyRoleUI(); renderNavigation(); }

// --- DADOS ---
function toggleDiceTray() { const t = document.getElementById('dice-overlay'); t.style.display = (t.style.display === 'flex') ? 'none' : 'flex'; }
function addDiceToTray(s) { diceTray.push(s); renderDiceTray(); }
function clearTray() { diceTray = []; document.getElementById('dice-result-area').innerHTML = '--'; document.getElementById('dice-selected-list').innerHTML = ''; }
function renderDiceTray() {
    const l = document.getElementById('dice-selected-list');
    if(diceTray.length === 0) { l.innerHTML = 'Toca los dados...'; return; }
    const counts = {}; diceTray.forEach(s => counts[s] = (counts[s] || 0) + 1);
    l.innerHTML = Object.entries(counts).map(([s, c]) => `${c}d${s}`).join(' + ');
}
function rollAllDice() {
    if (diceTray.length === 0) return;
    let total = 0, br = []; diceTray.forEach(s => { const r = Math.floor(Math.random() * s) + 1; total += r; br.push(r); });
    document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${total}</div><div style="color:#666;">[${br.join(' + ')}]</div>`;
}

// --- TABLÓN ---
function renderNotices() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const container = document.getElementById('notices-container');
    if (!camp || !container) return;
    const notices = camp.notices || [];
    if (notices.length === 0) { container.innerHTML = '<p style="color:#666; font-style:italic; margin-top:20px; text-align:center;">Tablón vacío.</p>'; return; }
    container.innerHTML = notices.map((n, idx) => `
        <div class="notice-card">
            <span class="notice-tag ${n.type === 'recruitment' ? 'tag-recruitment' : 'tag-quest'}">${n.type === 'recruitment' ? 'Reclutamiento' : 'Misión'}</span>
            ${currentRole==='master' ? `<i class="fa-solid fa-trash-can" onclick="deleteNotice(${idx})" style="position:absolute; right:15px; top:15px; color:#ff4444; cursor:pointer;"></i>`:''}
            <h3>${n.title}</h3>
            <p>${n.content}</p>
            <div class="notice-reward">RECOMPENSA: ${n.reward}</div>
        </div>
    `).join('');
}

function publishNotice() {
    if (currentRole !== 'master') return;
    const t = document.getElementById('notice-title').value;
    const c = document.getElementById('notice-content').value;
    const r = document.getElementById('notice-reward').value;
    const type = document.getElementById('notice-type').value;
    if (!t || !c) return;
    const camp = campaigns.find(ca => ca.id === currentCampaignId);
    if (!camp.notices) camp.notices = [];
    camp.notices.unshift({ type, title: filterProfanity(t), content: filterProfanity(c), reward: filterProfanity(r || "Honor") });
    saveAll(); renderNotices();
    document.getElementById('notice-title').value = ''; document.getElementById('notice-content').value = ''; document.getElementById('notice-reward').value = '';
}

function deleteNotice(idx) { const camp = campaigns.find(ca => ca.id === currentCampaignId); camp.notices.splice(idx, 1); saveAll(); renderNotices(); }

// --- GREMIO ---
function populateSelects() {
    const cls = document.getElementById('char-class'); const rac = document.getElementById('char-race'); const gen = document.getElementById('char-gender');
    if(cls) cls.innerHTML = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    if(rac) rac.innerHTML = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    if(gen) gen.innerHTML = srdData.genders.map(g => `<option value="${g}">${g}</option>`).join('');
}

function createCharacter() {
    const name = document.getElementById('char-name').value.trim();
    if(!name) return alert("Nombre requerido.");
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
            const itemMatch = [...srdData.weapons, ...srdData.armor, ...srdData.items].find(i => i.name.toLowerCase() === it.toLowerCase());
            inventory.push(itemMatch ? {...itemMatch} : {name: it, category: "Equipo", weight: 1});
        });
    }
    const newChar = { id: Date.now(), name, race: document.getElementById('char-race').value, charClass: classData.name, gender: document.getElementById('char-gender').value, stats, hp: classData.hit_die, wallet:{cp:0,sp:0,gp:0,pp:0,ep:0}, inventory, hasMagicBag: false };
    party.push(newChar); const camp = campaigns.find(c => c.id === currentCampaignId); if(camp) camp.party = party;
    saveAll(); renderParty(); document.getElementById('char-name').value = '';
}

function renderParty() {
    const container = document.getElementById('character-list'); if (!container) return;
    if(party.length === 0) { container.innerHTML = '<p style="color:#666;text-align:center;">Grupo vacío.</p>'; return; }
    container.innerHTML = party.map(c => `
        <div class="char-card" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="char-info"><h3>${c.name}</h3><p>${c.gender} | ${c.race} ${c.charClass}</p></div>
                <div style="display:flex; gap:12px; align-items:center;">
                    ${currentRole==='master' ? `<button class="btn-delete" onclick="deleteCharacter(${c.id})"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                    <button onclick="toggleInventory(${c.id})" style="background:transparent; border:1px solid var(--gold); color:var(--gold); border-radius:10px; width:45px; height:45px; cursor:pointer;"><i class="fa-solid fa-sack-xmark"></i></button>
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; background: #000; padding: 15px; border-radius: 12px; border: 1px solid #222;">
                ${Object.entries(c.stats).map(([s, v]) => `<div style="font-size:0.85rem; color:#888;">${s.toUpperCase()}: <b style="color:var(--gold)">${v}</b><br><span>(${calculateMod(v)})</span></div>`).join('')}
            </div>
            <div id="inv-${c.id}" style="display:none; margin-top:10px; border-top:1px solid #222; padding-top:15px;"><div id="inv-list-${c.id}"></div></div>
        </div>
    `).join('');
}

function toggleInventory(id) { const d = document.getElementById(`inv-${id}`); d.style.display = d.style.display === 'block' ? 'none' : 'block'; if(d.style.display==='block') renderInventory(id); }
function renderInventory(id) {
    const char = party.find(c => c.id == id); const container = document.getElementById(`inv-list-${id}`);
    let w = 0; char.inventory.forEach(i => w += (i.weight || 0)); const cap = (char.stats.str * 15);
    container.innerHTML = `<div style="margin-bottom:15px; padding:15px; background:#000; border-radius:8px; border:1px solid #333;"><span style="color:var(--gold)">PESO: ${w.toFixed(1)} / ${cap} lb</span></div>` + `<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">${Object.entries(char.wallet).map(([t, v]) => `<div onclick="spendCoins('${id}', '${t}')" style="background:#222; border:1px solid #444; padding:8px 15px; border-radius:8px;">${v} ${t}</div>`).join('')}</div>` + char.inventory.map(item => `<div style="background:#111; padding:12px; border-radius:8px; margin-bottom:8px; border:1px solid #333;">${item.name} (${item.weight} lb)</div>`).join('');
}

// --- NAVEGACIÓN ---
function renderNavigation() {
    const nav = document.getElementById('main-nav'); if (!nav) return;
    const isM = currentRole === 'master';
    nav.innerHTML = `<button onclick="showTab('tab-home')"><i class="fa-solid fa-house-chimney"></i><span>Home</span></button>${isM ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button><button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}<button onclick="showTab('tab-community')"><i class="fa-solid fa-bullhorn"></i><span>Tablón</span></button><button onclick="showTab('tab-party')"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>`;
}

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(t); if(target) target.style.display = 'block';
    if(t === 'tab-party') renderParty();
    if(t === 'tab-community') renderNotices();
}

function deleteCharacter(id) { if(confirm("¿Borrar?")) { party = party.filter(c => c.id != id); campaigns.find(c => c.id === currentCampaignId).party = party; saveAll(); renderParty(); } }

async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        populateSelects();
        if(currentCampaignId) { selectCampaign(currentCampaignId); } else { renderCampaignList(); }
    } catch (e) { console.error("Error SRD:", e); }
}

document.addEventListener('DOMContentLoaded', loadSRDData);

window.showTab = showTab; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.toggleInventory = toggleInventory; window.saveCampaign = saveCampaign; window.showCreateCampaign = showCreateCampaign; window.hideCreateCampaign = hideCreateCampaign; window.deleteCampaign = deleteCampaign; window.editCampaignName = editCampaignName; window.publishNotice = publishNotice; window.deleteNotice = deleteNotice;