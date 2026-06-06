// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let party = [];
let srdData = { classes: [], races: [], genders: [], monsters: [], weapons: [], armor: [], items: [] };
let diceTray = [];
let currentLoot = null;

// --- UTILIDADES ---
const calculateMod = (val) => { const mod = Math.floor((val - 10) / 2); return mod >= 0 ? `+${mod}` : `${mod}`; };

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_current_campaign', currentCampaignId);
    localStorage.setItem('dnd_role', currentRole);
}

// --- LÓGICA DE INICIO ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        populateSelects();
        if(currentCampaignId) { selectCampaign(currentCampaignId); } else { renderCampaignList(); }
    } catch (e) { console.error("Error SRD:", e); }
}

function renderCampaignList() {
    const container = document.getElementById('campaign-list'); if(!container) return;
    if(campaigns.length === 0) { container.innerHTML = '<p style="color:#666;">Sin campañas.</p>'; return; }
    container.innerHTML = campaigns.map(c => `<div class="campaign-item" onclick="selectCampaign('${c.id}')"><h3 style="font-family:'Cinzel';color:var(--gold);margin:0;">${c.name}</h3><p style="font-size:0.9rem;color:#888;">${c.party.length} Héroes</p></div>`).join('');
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

function applyRoleUI() {
    const isM = currentRole === 'master';
    document.getElementById('current-role-text').innerText = isM ? 'DUNGEON MASTER' : 'AVENTURERO';
    document.getElementById('role-selector').value = currentRole;
    document.body.className = isM ? 'is-master' : 'is-adventurer';
}

function changeRole() { currentRole = document.getElementById('role-selector').value; saveAll(); applyRoleUI(); renderNavigation(); }

// --- DADOS ---
function toggleDiceTray() {
    const tray = document.getElementById('dice-overlay');
    tray.style.display = tray.style.display === 'flex' ? 'none' : 'flex';
}
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
    document.getElementById('dice-result-area').innerHTML = `<div style="font-size:3.5rem; color:#f1d592;">${total}</div><div style="color:#666; font-size:1rem;">[${br.join(' + ')}]</div>`;
}

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
    const allItems = [...srdData.weapons, ...srdData.armor, ...srdData.items];
    if(classData && classData.starting_items) {
        classData.starting_items.forEach(itemName => {
            const itemMatch = allItems.find(i => i.name.toLowerCase().trim() === itemName.toLowerCase().trim());
            if(itemMatch) {
                inventory.push({...itemMatch});
            } else {
                inventory.push({name: itemName, category: "Equipo", weight: 0});
            }
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

function generateLoot() {
    if(currentRole !== 'master') return;
    const cr = parseInt(document.getElementById('loot-cr').value) || 1;
    const container = document.getElementById('loot-result');
    const coinFactor = Math.max(1, cr);
    const distribution = {
        cp: Math.floor(Math.random() * 20 * coinFactor),
        sp: Math.floor(Math.random() * 10 * coinFactor),
        gp: Math.floor(Math.random() * 2 * coinFactor)
    };
    const allPossibleItems = [...srdData.weapons, ...srdData.armor, ...srdData.items];
    const lootItems = [];
    if(Math.random() < 0.2) lootItems.push({...allPossibleItems[Math.floor(Math.random() * allPossibleItems.length)]});
    currentLoot = { distribution, items: lootItems };
    container.innerHTML = `
        <div class="card" style="background:#1a1a1a; border:1px dashed var(--gold); padding:20px; text-align:left;">
            <h3 style="font-family:'Cinzel'; color:var(--gold); margin:0 0 15px 0;">Botín Coherente</h3>
            ${Object.entries(distribution).map(([type, amount]) => `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding:8px 0;">
                    <span style="font-weight:bold; color:${getCoinColor(type)}">${amount} ${type}</span>
                    <div style="display:flex; gap:5px;">
                        <input type="number" id="split-${type}" value="${amount}" min="1" max="${amount}" style="width:70px; padding:4px;">
                        <button onclick="assignCoins('${type}')" style="background:var(--gold); border:none; border-radius:4px; padding:4px 8px; font-weight:bold; cursor:pointer;">DAR</button>
                    </div>
                </div>
            `).join('')}
            <div style="margin-top:15px;">
                ${lootItems.map((item, idx) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #333; padding: 8px 0;">
                        <span>• ${item.name}</span>
                        <button onclick="showAssignItem(${idx})" style="background:#333; color:var(--gold); border:1px solid var(--gold); border-radius:4px; padding:4px 8px; cursor:pointer;">ASIGNAR</button>
                    </div>
                    <div id="assign-item-${idx}" style="display:none; margin-top:5px; background:#222; padding:10px;"></div>
                `).join('')}
            </div>
        </div>
    `;
}

function getCoinColor(type) { const colors = { cp:'#cd7f32', sp:'#c0c0c0', gp:'#ffd700' }; return colors[type] || '#fff'; }
function assignCoins(type) {
    const amount = parseInt(document.getElementById(`split-${type}`).value);
    if (amount <= 0 || isNaN(amount)) return;
    const charList = party.map(c => `<button onclick="confirmAssignCoins('${type}', ${amount}, '${c.id}')" style="display:block; width:100%; margin-bottom:5px; font-size:1.1rem; background:#333; color:#fff; border:1px solid var(--gold); cursor:pointer; padding:12px;">${c.name}</button>`).join('');
    const container = document.getElementById('assign-area-global') || createGlobalAssignArea();
    container.style.display = 'block';
    container.innerHTML = `<div class="card" style="padding:25px; background:#111; border:1px solid var(--gold);"><p style="color:var(--gold); margin-bottom:15px;">Dar ${amount}${type} a:</p>${charList}</div>`;
}
function confirmAssignCoins(type, amount, charId) {
    const char = party.find(c => c.id == charId);
    if (char) { char.wallet[type] += amount; saveAll(); }
    document.getElementById('assign-area-global').style.display = 'none';
}
function showAssignItem(idx) {
    const area = document.getElementById(`assign-item-${idx}`); area.style.display = 'block';
    area.innerHTML = party.map(c => `<button onclick="confirmAssignItem(${idx}, '${c.id}')" style="display:block; width:100%; margin-bottom:2px; background:#111; color:#fff; border:1px solid #444; padding:10px; cursor:pointer;">→ ${c.name}</button>`).join('');
}
function confirmAssignItem(idx, charId) {
    const char = party.find(c => c.id == charId); if (char) { char.inventory.push({...currentLoot.items[idx]}); saveAll(); }
    document.getElementById(`assign-item-${idx}`).parentElement.style.display = 'none';
}
function createGlobalAssignArea() { const div = document.createElement('div'); div.id = 'assign-area-global'; div.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:7000; width:90%; max-width:450px; display:none;'; document.body.appendChild(div); return div; }

function toggleInventory(id) { const d = document.getElementById(`inv-${id}`); d.style.display = d.style.display === 'block' ? 'none' : 'block'; if(d.style.display==='block') renderInventory(id); }
function renderInventory(id) {
    const char = party.find(c => c.id == id); const container = document.getElementById(`inv-list-${id}`);
    let w = 0; char.inventory.forEach(i => w += (i.weight || 0)); const cap = (char.stats.str * 15);
    container.innerHTML = `<div style="margin-bottom:15px; padding:15px; background:#000; border-radius:8px; border:1px solid #333;"><span style="color:var(--gold)">PESO: ${w.toFixed(1)} / ${cap} lb</span></div>` + 
        `<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">${Object.entries(char.wallet).map(([t, v]) => `<div style="background:#222; border:1px solid #444; padding:8px 15px; border-radius:8px;">${v} ${t}</div>`).join('')}</div>` + 
        char.inventory.map((item, idx) => `<div style="background:#111; padding:12px; border-radius:8px; margin-bottom:8px; border:1px solid #333;">${item.name} (${item.weight} lb)</div>`).join('');
}

function renderNavigation() {
    const nav = document.getElementById('main-nav'); if (!nav) return;
    const isM = currentRole === 'master';
    nav.innerHTML = `<button onclick="showTab('tab-home')"><i class="fa-solid fa-house-chimney"></i><span>Home</span></button>${isM ? `<button onclick="showTab('tab-combat')"><i class="fa-solid fa-shield-halved"></i><span>Guerra</span></button><button onclick="showTab('tab-loot')"><i class="fa-solid fa-gem"></i><span>Oro</span></button>` : ''}<button onclick="showTab('tab-community')"><i class="fa-solid fa-bullhorn"></i><span>Tablón</span></button><button onclick="showTab('tab-party')"><i class="fa-solid fa-users-rays"></i><span>Gremio</span></button>`;
}

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(t); if(target) target.style.display = 'block';
    if(t === 'tab-party') renderParty();
    if(t === 'tab-combat') renderBestiary();
    if(t === 'tab-loot') renderLootTable();
}

function renderBestiary() { const c = document.getElementById('monster-list'); if (!c) return; c.innerHTML = srdData.monsters.map(m => `<div class="char-card"><h3>${m.name}</h3><p>${m.type} | CR: ${m.cr}</p></div>`).join(''); }
function renderLootTable() { const c = document.getElementById('loot-items-list'); if (!c) return; c.innerHTML = [...srdData.weapons, ...srdData.armor, ...srdData.items].map(i => `<div class="char-card"><h3>${i.name}</h3><p>${i.category} | ${i.weight} lb</p></div>`).join(''); }

document.addEventListener('DOMContentLoaded', loadSRDData);

window.showTab = showTab; window.toggleDiceTray = toggleDiceTray; window.addDiceToTray = addDiceToTray; window.clearTray = clearTray; window.rollAllDice = rollAllDice; window.createCharacter = createCharacter; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.toggleInventory = toggleInventory;