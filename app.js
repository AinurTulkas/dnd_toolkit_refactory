// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let globalNotices = JSON.parse(localStorage.getItem('dnd_global_notices')) || [];
let recentMonsters = JSON.parse(localStorage.getItem('dnd_recent_monsters')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';

let party = [];
let srdData = { classes: [], races: [], genders: ["Masculino", "Femenino", "No binario"], monsters: [], weapons: [], armor: [], items: [] };
let diceTray = [];

const badWords = ["mierda", "puta", "joder", "cabron", "cojones"];

// --- UTILIDADES ---
const calculateMod = (val) => { const mod = Math.floor((val - 10) / 2); return mod >= 0 ? "+" + mod : "" + mod; };
const filterProfanity = (text) => { 
    if(!text) return "";
    let filtered = text;
    badWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filtered = filtered.replace(regex, "****");
    });
    return filtered;
};

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_global_notices', JSON.stringify(globalNotices));
    localStorage.setItem('dnd_recent_monsters', JSON.stringify(recentMonsters));
    localStorage.setItem('dnd_current_campaign', currentCampaignId || "");
    localStorage.setItem('dnd_role', currentRole);
}

// --- LÓGICA DE INICIO Y LOBBY ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        populateSelects();
    } catch (e) { console.error("Fallo carga SRD"); }
}

function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    if (!container) return;
    if (campaigns.length === 0) {
        container.innerHTML = '<p style="color:#666; padding: 20px; font-style:italic;">No hay campañas.</p>';
        return;
    }
    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item">
            <div class="campaign-info" onclick="selectCampaign(\'' + c.id + '\')">
                <h3 style="font-family:\'Cinzel\'; color:var(--gold); margin:0;">${c.name}</h3>
                <p style="font-size:0.9rem; color:#888;">${(c.party || []).length} Héroes</p>
            </div>
            <div class="campaign-controls">
                <button class="btn-mini" onclick="editCampaignName(\'' + c.id + '\')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-mini btn-delete-camp" onclick="deleteCampaign(\'' + c.id + '\')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return;
    currentCampaignId = id;
    party = camp.party || [];
    saveAll();
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title-display').innerText = camp.name;
    applyRoleUI();
    renderNavigation();
    showTab('tab-home');
}

function exitToLobby() { currentCampaignId = null; saveAll(); location.reload(); }

function showCreateCampaign() { document.getElementById('create-campaign-form').style.display = 'block'; document.getElementById('campaign-list').style.display = 'none'; }
function hideCreateCampaign() { document.getElementById('create-campaign-form').style.display = 'none'; document.getElementById('campaign-list').style.display = 'block'; }

function saveCampaign() {
    const name = document.getElementById('new-campaign-name').value.trim();
    const editId = document.getElementById('edit-campaign-id').value;
    if (!name) return;
    if (editId) { const camp = campaigns.find(c => c.id === editId); if(camp) camp.name = name; }
    else { campaigns.push({ id: 'camp_' + Date.now(), name, party: [], notices: [] }); }
    saveAll(); hideCreateCampaign(); renderCampaignList();
}

function editCampaignName(id) {
    const camp = campaigns.find(c => c.id === id); if(!camp) return;
    document.getElementById('campaign-form-title').innerText = "Editar Campaña";
    document.getElementById('new-campaign-name').value = camp.name;
    document.getElementById('edit-campaign-id').value = id;
    document.getElementById('create-campaign-form').style.display = 'block';
    document.getElementById('campaign-list').style.display = 'none';
}

function deleteCampaign(id) {
    if(confirm("¿Borrar definitivamente?")) {
        campaigns = campaigns.filter(c => c.id !== id);
        saveAll(); renderCampaignList();
    }
}

// --- BESTIARIO (BÚSQUEDA Y RECIENTES) ---
function searchMonsters() {
    const query = document.getElementById('monster-search-input').value.toLowerCase().trim();
    const results = document.getElementById('monster-search-results');
    if(!query) { results.innerHTML = ''; return; }
    const matches = srdData.monsters.filter(m => m.name.toLowerCase().includes(query)).slice(0, 10);
    results.innerHTML = matches.map(m => `
        <div class="char-card" onclick="useMonster(\'' + m.name + '\')" style="cursor:pointer; border-left-color: #d32f2f; margin-bottom:10px;">
            <div class="char-info"><h3>${m.name}</h3><p>${m.type} | CR: ${m.cr}</p></div>
            <i class="fa-solid fa-plus"></i>
        </div>
    `).join('');
}

function useMonster(name) {
    const monster = srdData.monsters.find(m => m.name === name);
    if(!monster) return;
    recentMonsters = recentMonsters.filter(m => m.name !== name);
    recentMonsters.unshift(monster);
    if(recentMonsters.length > 5) recentMonsters.pop();
    saveAll(); renderRecentMonsters();
    document.getElementById('monster-search-input').value = '';
    document.getElementById('monster-search-results').innerHTML = '';
}

function renderRecentMonsters() {
    const container = document.getElementById('monster-recent-list'); if(!container) return;
    if(recentMonsters.length === 0) { container.innerHTML = '<p style="color:#444;">Sin recientes.</p>'; return; }
    container.innerHTML = recentMonsters.map(m => `
        <div class="char-card" style="border-left-color: #8b0000; margin-bottom:10px; opacity: 0.8;">
            <div class="char-info"><h3>${m.name}</h3><p>${m.type} | AC: ${m.ac} | HP: ${m.hp}</p></div>
        </div>
    `).join('');
}

// --- COMUNIDAD GLOBAL ---
function toggleGlobalBoard(show) {
    document.getElementById('global-board-overlay').style.display = show ? 'flex' : 'none';
    if(show) renderGlobalNotices();
}

function publishGlobalNotice() {
    const t = document.getElementById('global-notice-title').value.trim();
    const c = document.getElementById('global-notice-content').value.trim();
    const co = document.getElementById('global-notice-contact').value.trim();
    if(!t || !c || !co) return alert("Faltan datos.");
    globalNotices.unshift({ type: document.getElementById('global-notice-type').value, title: filterProfanity(t), content: filterProfanity(c), contact: filterProfanity(co) });
    saveAll(); renderGlobalNotices();
}

function renderGlobalNotices() {
    const container = document.getElementById('global-notices-container'); if(!container) return;
    container.innerHTML = globalNotices.map((n, idx) => `
        <div class="notice-card">
            <span class="notice-tag ${n.type === 'lfm' ? 'tag-quest' : 'tag-recruitment'}">${n.type === 'lfm' ? 'Master' : 'Jugador'}</span>
            <i class="fa-solid fa-trash-can" onclick="deleteGlobalNotice(${idx})" style="position:absolute; right:15px; top:15px; color:#444; cursor:pointer;"></i>
            <h3>${n.title}</h3><p>${n.content}</p><div class="notice-reward">CONTACTO: ${n.contact}</div>
        </div>
    `).join('');
}
function deleteGlobalNotice(idx) { globalNotices.splice(idx, 1); saveAll(); renderGlobalNotices(); }

// --- HÉROES Y STATS ---
function createCharacter() {
    const name = document.getElementById('char-name').value.trim();
    if(!name) return alert("¡Nombre!");
    const classData = srdData.classes.find(c => c.name === document.getElementById('char-class').value);
    
    let stats = {
        str: parseInt(document.getElementById('char-str').value)||10,
        dex: parseInt(document.getElementById('char-dex').value)||10,
        con: parseInt(document.getElementById('char-con').value)||10,
        int: parseInt(document.getElementById('char-int').value)||10,
        wis: parseInt(document.getElementById('char-wis').value)||10,
        cha: parseInt(document.getElementById('char-cha').value)||10
    };

    let needsOverride = false;
    for (let s in stats) { if (stats[s] > 20) needsOverride = true; }
    if (needsOverride && !confirm("¿Superar límite de 20 por objeto mágico?")) {
        for (let s in stats) { if (stats[s] > 20) stats[s] = 20; }
    }

    const inventory = [];
    const all = [...srdData.weapons, ...srdData.armor, ...srdData.items];
    if(classData.starting_items) classData.starting_items.forEach(it => {
        const match = all.find(i => i.name.toLowerCase() === it.toLowerCase());
        inventory.push(match ? {...match} : {name: it, weight: 1});
    });

    party.push({ id: Date.now(), name, race: document.getElementById('char-race').value, charClass: classData.name, gender: document.getElementById('char-gender').value, stats, hp: classData.hit_die, wallet:{cp:0,sp:0,gp:0,pp:0,ep:0}, inventory });
    saveAll(); renderParty();
}

function renderParty() {
    const container = document.getElementById('character-list'); if(!container) return;
    if(party.length === 0) { container.innerHTML = '<p style="color:#666;">Sin héroes.</p>'; return; }
    container.innerHTML = party.map(c => `
        <div class="char-card" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="char-info"><h3>${c.name}</h3><p>${c.gender} | ${c.race} ${c.charClass}</p></div>
                <button onclick="toggleInventory(${c.id})" style="background:transparent; border:1px solid var(--gold); color:var(--gold); border-radius:10px; width:45px; height:45px; cursor:pointer;"><i class="fa-solid fa-sack-xmark"></i></button>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; background: #000; padding: 10px; border-radius: 8px; border: 1px solid #222;">
                ${Object.entries(c.stats).map(([s, v]) => `<div style="font-size:0.7rem; color:#888;">${s.toUpperCase()}: <b style="color:${v>20?'#f1d592':'var(--gold)'}">${v}</b> (${calculateMod(v)})</div>`).join('')}
            </div>
            <div id="inv-${c.id}" style="display:none; margin-top:10px;"><div id="inv-list-${c.id}"></div></div>
        </div>
    `).join('');
}

function toggleInventory(id) { const d = document.getElementById('inv-' + id); d.style.display = d.style.display === 'block' ? 'none' : 'block'; if(d.style.display==='block') renderInventory(id); }
function renderInventory(id) {
    const char = party.find(c => c.id == id); const container = document.getElementById('inv-list-' + id);
    let w = 0; char.inventory.forEach(i => w += (i.weight || 0));
    container.innerHTML = `<div style="margin-bottom:10px; font-size:0.9rem; color:var(--gold);">CARGA: ${w.toFixed(1)} / ${char.stats.str*15} lb</div>` + char.inventory.map(i => `<div style="font-size:0.9rem; padding:8px; border-bottom:1px solid #333;">• ${i.name} (${i.weight} lb)</div>`).join('');
}

// --- GENERAL ---
function applyRoleUI() {
    const isM = currentRole === 'master';
    document.getElementById('current-role-text').innerText = isM ? 'DUNGEON MASTER' : 'AVENTURERO';
    document.getElementById('role-selector').value = currentRole;
    document.body.className = isM ? 'is-master' : 'is-adventurer';
}
function changeRole() { currentRole = document.getElementById('role-selector').value; saveAll(); applyRoleUI(); renderNavigation(); showTab('tab-home'); }
function toggleDiceTray() { const t = document.getElementById('dice-overlay'); t.style.display = (t.style.display === 'flex') ? 'none' : 'flex'; }
function addDiceToTray(s) { diceTray.push(s); renderDiceTray(); }
function clearTray() { diceTray = []; document.getElementById('dice-result-area').innerHTML = '--'; document.getElementById('dice-selected-list').innerHTML = ''; }
function renderDiceTray() {
    const l = document.getElementById('dice-selected-list'); if(!l) return;
    const counts = {}; diceTray.forEach(s => counts[s] = (counts[s] || 0) + 1);
    l.innerHTML = Object.entries(counts).map(([s, c]) => c + 'd' + s).join(' + ');
}
function rollAllDice() {
    if (diceTray.length === 0) return;
    let total = 0; diceTray.forEach(s => total += Math.floor(Math.random() * s) + 1);
    document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${total}</div>`;
}

function renderNavigation() {
    const nav = document.getElementById('main-nav'); if (!nav) return;
    const isM = currentRole === 'master';
    nav.innerHTML = `<button onclick="showTab('tab-home')"><i class="fa-solid fa-house-chimney"></i><span>Inicio</span></button>${isM ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button><button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}<button onclick="showTab('tab-community')"><i class="fa-solid fa-bullhorn"></i><span>Tablón</span></button><button onclick="showTab('tab-party')"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>`;
}

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(t); if(target) target.style.display = 'block';
    if(t === 'tab-party') renderParty();
    if(t === 'tab-combat') renderRecentMonsters();
}

function populateSelects() {
    const cls = document.getElementById('char-class'); const rac = document.getElementById('char-race'); const gen = document.getElementById('char-gender');
    if(cls && srdData.classes) cls.innerHTML = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    if(rac && srdData.races) rac.innerHTML = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    if(gen && srdData.genders) gen.innerHTML = srdData.genders.map(g => `<option value="${g}">${g}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => { renderCampaignList(); loadSRDData(); if(currentCampaignId) selectCampaign(currentCampaignId); });

window.showTab = showTab; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.toggleInventory = toggleInventory; window.saveCampaign = saveCampaign; window.showCreateCampaign = showCreateCampaign; window.hideCreateCampaign = hideCreateCampaign; window.deleteCampaign = deleteCampaign; window.editCampaignName = editCampaignName; window.toggleGlobalBoard = toggleGlobalBoard; window.publishGlobalNotice = publishGlobalNotice; window.deleteGlobalNotice = deleteGlobalNotice; window.publishNotice = publishNotice; window.searchMonsters = searchMonsters; window.useMonster = useMonster;