// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let party = [];
let srdData = { classes: [], races: [], genders: [], monsters: [], weapons: [], armor: [], items: [] };
let diceTray = [];
let currentLoot = null;

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_current_campaign', currentCampaignId);
    localStorage.setItem('dnd_role', currentRole);
}

// --- LÓGICA DE INICIO ---
async function loadSRDData() {
    try {
        console.log("Cargando SRD...");
        const response = await fetch('data/srd_data.json');
        if (!response.ok) throw new Error("Fallo en fetch");
        srdData = await response.json();
        console.log("SRD Cargado con éxito.");
        
        populateSelects();
        
        // Manejo de redirección si ya hay campaña activa
        if(currentCampaignId && campaigns.find(c => c.id === currentCampaignId)) {
            selectCampaign(currentCampaignId);
        } else {
            renderCampaignList();
        }
    } catch (e) {
        console.error("Error crítico de carga:", e);
        // Fallback básico si falla el JSON para no romper la app
        renderCampaignList();
    }
}

function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    const lobby = document.getElementById('lobby-overlay');
    if(!container || !lobby) return;

    lobby.style.display = 'flex';
    if(campaigns.length === 0) {
        container.innerHTML = '<p style="color:#666;">No hay campañas creadas.</p>';
        return;
    }
    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item" onclick="selectCampaign('${c.id}')">
            <h3 style="font-family:'Cinzel';color:var(--gold);margin:0;">${c.name}</h3>
            <p style="font-size:0.9rem;color:#888;">${c.party.length} Héroes</p>
        </div>
    `).join('');
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return exitToLobby();
    currentCampaignId = id;
    party = camp.party || [];
    saveAll();
    
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title-display').innerText = camp.name;
    
    applyRoleUI();
    renderNavigation();
    showTab('tab-home');
}

function createCampaign() {
    const nameInput = document.getElementById('new-campaign-name');
    const name = nameInput.value.trim();
    if (!name) return alert("Ponle un nombre a la campaña.");
    
    const newCamp = { 
        id: 'camp_' + Date.now(), 
        name, 
        party: [], 
        notices: [], 
        config: { combat: true, loot: true, community: true } 
    };
    campaigns.push(newCamp);
    saveAll();
    nameInput.value = '';
    hideCreateCampaign();
    renderCampaignList();
}

function showCreateCampaign() {
    document.getElementById('create-campaign-form').style.display = 'block';
    document.getElementById('campaign-list').style.display = 'none';
}

function hideCreateCampaign() {
    document.getElementById('create-campaign-form').style.display = 'none';
    document.getElementById('campaign-list').style.display = 'block';
}

function exitToLobby() {
    currentCampaignId = null;
    saveAll();
    location.reload();
}

// --- RESTO DE FUNCIONES (DADOS, ROLES, PARTY) ---
const calculateMod = (val) => { const mod = Math.floor((val - 10) / 2); return mod >= 0 ? `+${mod}` : `${mod}`; };

function applyRoleUI() {
    const isM = currentRole === 'master';
    const text = document.getElementById('current-role-text');
    if(text) text.innerText = isM ? 'DUNGEON MASTER' : 'AVENTURERO';
    const sel = document.getElementById('role-selector');
    if(sel) sel.value = currentRole;
    document.body.className = isM ? 'is-master' : 'is-adventurer';
}

function changeRole() {
    currentRole = document.getElementById('role-selector').value;
    saveAll();
    applyRoleUI();
    renderNavigation();
    showTab('tab-home');
}

function toggleDiceTray() {
    const tray = document.getElementById('dice-overlay');
    tray.style.display = (tray.style.display === 'flex') ? 'none' : 'flex';
}

function addDiceToTray(s) { diceTray.push(s); renderDiceTray(); }
function clearTray() { diceTray = []; document.getElementById('dice-result-area').innerHTML = '--'; document.getElementById('dice-selected-list').innerHTML = ''; }
function renderDiceTray() {
    const l = document.getElementById('dice-selected-list');
    if(diceTray.length === 0) { l.innerHTML = 'Toca dados...'; return; }
    const counts = {}; diceTray.forEach(s => counts[s] = (counts[s] || 0) + 1);
    l.innerHTML = Object.entries(counts).map(([s, c]) => `${c}d${s}`).join(' + ');
}
function rollAllDice() {
    if (diceTray.length === 0) return;
    let total = 0, br = []; diceTray.forEach(s => { const r = Math.floor(Math.random() * s) + 1; total += r; br.push(r); });
    document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${total}</div><div style="color:#666;">[${br.join(' + ')}]</div>`;
}

function populateSelects() {
    const cls = document.getElementById('char-class'); 
    const rac = document.getElementById('char-race'); 
    const gen = document.getElementById('char-gender');
    if(cls && srdData.classes) cls.innerHTML = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    if(rac && srdData.races) rac.innerHTML = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    if(gen && srdData.genders) gen.innerHTML = srdData.genders.map(g => `<option value="${g}">${g}</option>`).join('');
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
            const itemMatch = srdData.items.find(i => i.name.toLowerCase().trim() === it.toLowerCase().trim());
            inventory.push(itemMatch ? {...itemMatch} : {name: it, category: "Equipo", weight: 1});
        });
    }
    const newChar = { id: Date.now(), name, race: document.getElementById('char-race').value, charClass: classData.name, gender: document.getElementById('char-gender').value, stats, hp: classData.hit_die, wallet:{cp:0,sp:0,gp:0,pp:0,ep:0}, inventory, hasMagicBag: false };
    party.push(newChar);
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if(camp) camp.party = party;
    saveAll(); renderParty();
    document.getElementById('char-name').value = '';
}

function renderParty() {
    const container = document.getElementById('character-list'); if(!container) return;
    container.innerHTML = party.map(c => `
        <div class="char-card" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="char-info"><h3>${c.name}</h3><p>${c.gender} | ${c.race} ${c.charClass}</p></div>
                <div style="display:flex; gap:10px;">
                    <button onclick="toggleInventory(${c.id})" style="background:transparent; border:1px solid var(--gold); color:var(--gold); border-radius:8px; width:40px; height:40px;"><i class="fa-solid fa-sack-xmark"></i></button>
                    ${currentRole==='master' ? `<button class="btn-delete" onclick="deleteCharacter(${c.id})"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 10px 0; background: #000; padding: 10px; border-radius: 8px; border: 1px solid #222;">
                ${Object.entries(c.stats).map(([s, v]) => `<div style="font-size:0.7rem; color:#888;">${s.toUpperCase()}: <b style="color:var(--gold)">${v}</b> <span>(${calculateMod(v)})</span></div>`).join('')}
            </div>
            <div id="inv-${c.id}" style="display:none; margin-top:10px; border-top:1px solid #222; padding-top:10px;"><div id="inv-list-${c.id}"></div></div>
        </div>
    `).join('');
}

function toggleInventory(id) { const d = document.getElementById(`inv-${id}`); d.style.display = d.style.display === 'block' ? 'none' : 'block'; if(d.style.display==='block') renderInventory(id); }
function renderInventory(id) {
    const char = party.find(c => c.id == id);
    const container = document.getElementById(`inv-list-${id}`);
    if(!char || !container) return;
    let w = 0; char.inventory.forEach(i => w += (i.weight || 0)); const cap = (char.stats.str * 15);
    container.innerHTML = `<div style="margin-bottom:10px; font-size:0.8rem; color:var(--gold);">CARGA: ${w.toFixed(1)} / ${cap} lb</div>` + char.inventory.map(i => `<div style="font-size:0.8rem; padding:5px; border-bottom:1px solid #333;">• ${i.name} (${i.weight} lb)</div>`).join('');
}

function renderNavigation() {
    const nav = document.getElementById('main-nav'); if (!nav) return;
    const isM = currentRole === 'master';
    nav.innerHTML = `<button onclick="showTab('tab-home')"><i class="fa-solid fa-house-chimney"></i><span>Home</span></button>${isM ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button><button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}<button onclick="showTab('tab-community')"><i class="fa-solid fa-bullhorn"></i><span>Tablón</span></button><button onclick="showTab('tab-party')"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>`;
}

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(t);
    if(target) target.style.display = 'block';
    if(t === 'tab-party') renderParty();
}

function deleteCharacter(id) { if(confirm("¿Borrar?")) { party = party.filter(c => c.id != id); campaigns.find(c => c.id === currentCampaignId).party = party; saveAll(); renderParty(); } }

document.addEventListener('DOMContentLoaded', loadSRDData);

window.showTab = showTab; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.toggleInventory = toggleInventory; window.createCampaign = createCampaign; window.showCreateCampaign = showCreateCampaign; window.hideCreateCampaign = hideCreateCampaign;