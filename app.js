// --- ESTADO GLOBAL ---
let campaigns = [];
try {
    const saved = localStorage.getItem('dnd_campaigns');
    campaigns = saved ? JSON.parse(saved) : [];
} catch (e) {
    console.error("Storage corrupto, reiniciando...");
    campaigns = [];
}

let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';
let party = [];
let srdData = { classes: [], races: [], monsters: [], weapons: [], items: [] };
let activeTrade = null;

function saveAll() {
    localStorage.setItem('dnd_campaigns', JSON.stringify(campaigns));
    localStorage.setItem('dnd_current_campaign', currentCampaignId || "");
    localStorage.setItem('dnd_role', currentRole);
}

// --- LOBBY Y CAMPAÑAS ---
function init() {
    console.log("Grimorio Pro: Inicializando...");
    renderCampaignList();
    if (currentCampaignId && currentCampaignId !== "") {
        selectCampaign(currentCampaignId);
    }
    loadSRDData();
}

function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    if (!container) return;
    
    if (campaigns.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic; padding:20px; text-align:center;">No hay aventuras creadas.</p>';
        return;
    }

    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item" style="display:flex; justify-content:space-between; align-items:center; background:#111; border:1px solid #333; margin-bottom:10px; padding:15px; border-radius:8px;">
            <div class="campaign-info" onclick="window.selectCampaign('${c.id}')" style="flex:1; cursor:pointer;">
                <h3 style="margin:0; color:var(--gold); font-family:\'Cinzel\';">${c.name}</h3>
                <p style="margin:0; font-size:0.8rem; color:#666;">${(c.party || []).length} Héroes activos</p>
            </div>
            <div class="campaign-controls" style="display:flex; gap:10px; align-items:center;">
                <button onclick="window.editCampaign('${c.id}')" style="background:none; border:none; color:var(--gold); cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="window.deleteCampaign('${c.id}')" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function showCreateCampaign() {
    document.getElementById('new-campaign-name').value = '';
    document.getElementById('campaign-form-title').innerText = "Nueva Campaña";
    document.getElementById('edit-campaign-id').value = '';
    document.getElementById('create-campaign-form').style.display = 'block';
}

function editCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return;
    document.getElementById('new-campaign-name').value = camp.name;
    document.getElementById('campaign-form-title').innerText = "Editar Campaña";
    document.getElementById('edit-campaign-id').value = id;
    document.getElementById('create-campaign-form').style.display = 'block';
}

function saveCampaign() {
    const nameInput = document.getElementById('new-campaign-name');
    const editId = document.getElementById('edit-campaign-id').value;
    const name = nameInput.value.trim();
    if (!name) return alert("Escribe un nombre para la aventura.");
    
    if (editId) {
        const camp = campaigns.find(c => c.id === editId);
        if (camp) camp.name = name;
    } else {
        campaigns.push({ id: 'camp_' + Date.now(), name: name, party: [], notices: [] });
    }
    
    saveAll();
    nameInput.value = '';
    document.getElementById('create-campaign-form').style.display = 'none';
    renderCampaignList();
}

function deleteCampaign(id) {
    if (confirm("¿Seguro que quieres eliminar esta campaña y todos sus datos?")) {
        campaigns = campaigns.filter(c => c.id !== id);
        if (currentCampaignId === id) currentCampaignId = null;
        saveAll();
        renderCampaignList();
    }
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) {
        currentCampaignId = null;
        saveAll();
        renderCampaignList();
        return;
    }
    currentCampaignId = id;
    party = camp.party || [];
    
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title-display').innerText = camp.name;
    
    applyRoleUI();
    renderNavigation();
    showTab('tab-home');
}

function exitToLobby() {
    currentCampaignId = null;
    saveAll();
    location.reload();
}

// --- DATOS SRD ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        srdData = await response.json();
        populateSelects();
    } catch (e) {
        console.warn("No se pudo cargar el manual SRD");
    }
}

function populateSelects() {
    const cc = document.getElementById('char-class');
    const cr = document.getElementById('char-race');
    if (cc && cr && srdData.classes) {
        cc.innerHTML = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        cr.innerHTML = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
    }
}

// --- INTERCAMBIO (HANDSHAKE) ---
function openTrade(charId) {
    const initiator = party.find(c => c.id == charId);
    const others = party.filter(c => c.id != charId);
    if (others.length === 0) return alert("Necesitas al menos dos aventureros.");

    activeTrade = { p1Id: charId, p2Id: others[0].id, offer1: { gold: 0, items: [] }, offer2: { gold: 0, items: [] }, p1Confirmed: false, p2Confirmed: false };
    renderTradeUI();
    document.getElementById('trade-overlay').style.display = 'flex';
}

function renderTradeUI() {
    const t = activeTrade; if (!t) return;
    const p1 = party.find(c => c.id == t.p1Id); const p2 = party.find(c => c.id == t.p2Id);

    document.getElementById('trader-1-name').innerText = p1.name;
    document.getElementById('trade-items-1').innerHTML = p1.inventory.map((it, i) => `<div><label><input type="checkbox" onchange="window.toggleTradeItem(1, ${i})" ${t.offer1.items.includes(i)?'checked':''} ${t.p1Confirmed?'disabled':''}> ${it.name}</label></div>`).join('') || '<p style="color:#444;">Vacio</p>';
    document.getElementById('trade-gold-1').value = t.offer1.gold; document.getElementById('trade-gold-1').disabled = t.p1Confirmed;
    document.getElementById('trader-1-status').innerText = t.p1Confirmed ? '✅ LISTO' : '⌛ Editando...';

    document.getElementById('trader-2-name').innerText = p2.name;
    const sel = document.getElementById('trader-2-selector-area');
    if (!t.p1Confirmed) {
        sel.innerHTML = `<select onchange="activeTrade.p2Id=this.value; window.renderTradeUI();" style="background:#222; color:var(--gold); border:1px solid #444;">${party.filter(p=>p.id!=t.p1Id).map(p=>`<option value="${p.id}" ${p.id==t.p2Id?'selected':''}>${p.name}</option>`).join('')}</select>`;
    } else {
        sel.innerHTML = '';
    }

    document.getElementById('trade-items-2').innerHTML = p2.inventory.map((it, i) => `<div><label><input type="checkbox" onchange="window.toggleTradeItem(2, ${i})" ${t.offer2.items.includes(i)?'checked':''} ${t.p2Confirmed?'disabled':''}> ${it.name}</label></div>`).join('') || '<p style="color:#444;">Vacio</p>';
    document.getElementById('trade-gold-2').value = t.offer2.gold; document.getElementById('trade-gold-2').disabled = t.p2Confirmed;
    document.getElementById('trader-2-status').innerText = t.p2Confirmed ? '✅ LISTO' : '⌛ Editando...';

    document.getElementById('btn-confirm-1').style.display = t.p1Confirmed ? 'none' : 'block';
    document.getElementById('btn-confirm-1').innerText = `CONFIRMAR PARTE DE ${p1.name.toUpperCase()}`;
    document.getElementById('btn-confirm-2').style.display = (t.p1Confirmed && !t.p2Confirmed) ? 'block' : 'none';
    document.getElementById('btn-confirm-2').innerText = `CONFIRMAR PARTE DE ${p2.name.toUpperCase()}`;
    document.getElementById('btn-execute-trade').style.display = (t.p1Confirmed && t.p2Confirmed) ? 'block' : 'none';
}

function updateTradeOffer(num) {
    const val = parseInt(document.getElementById('trade-gold-' + num).value) || 0;
    if (num === 1) activeTrade.offer1.gold = val; else activeTrade.offer2.gold = val;
    activeTrade.p1Confirmed = false; activeTrade.p2Confirmed = false; renderTradeUI();
}

function toggleTradeItem(num, idx) {
    const list = num === 1 ? activeTrade.offer1.items : activeTrade.offer2.items;
    if (list.includes(idx)) { list.splice(list.indexOf(idx), 1); } else { list.push(idx); }
    activeTrade.p1Confirmed = false; activeTrade.p2Confirmed = false; renderTradeUI();
}

function confirmTradePart(num) {
    const t = activeTrade; const char = party.find(c => c.id == (num === 1 ? t.p1Id : t.p2Id));
    const g = num == 1 ? t.offer1.gold : t.offer2.gold;
    if (g > char.wallet.gp + (char.wallet.gp_fake || 0)) return alert("Oro insuficiente.");
    if (num === 1) t.p1Confirmed = true; else t.p2Confirmed = true; renderTradeUI();
}

function executeTrade() {
    const t = activeTrade; const p1 = party.find(c => c.id == t.p1Id); const p2 = party.find(c => c.id == t.p2Id);

    const moveGold = (from, to, amount) => {
        if (amount <= 0) return;
        const total = from.wallet.gp + (from.wallet.gp_fake || 0);
        const ratio = (from.wallet.gp_fake || 0) / total;
        const fGive = Math.floor(amount * ratio); const rGive = amount - fGive;
        from.wallet.gp -= rGive; from.wallet.gp_fake -= fGive; to.wallet.gp += rGive; to.wallet.gp_fake += fGive;
    };
    moveGold(p1, p2, t.offer1.gold); moveGold(p2, p1, t.offer2.gold);

    const moveItems = (from, to, indices) => { indices.sort((a,b) => b-a).forEach(idx => to.inventory.push(from.inventory.splice(idx, 1)[0])); };
    moveItems(p1, p2, t.offer1.items); moveItems(p2, p1, t.offer2.items);

    alert("¡Intercambio cerrado con éxito!"); activeTrade = null;
    const camp = campaigns.find(c => c.id === currentCampaignId); if (camp) camp.party = party;
    saveAll(); closeTrade(); renderParty();
}

function closeTrade() { document.getElementById('trade-overlay').style.display = 'none'; }

// --- UI HELPERS ---
function applyRoleUI() { document.getElementById('current-role-text').innerText = currentRole.toUpperCase(); }

function changeRole() { currentRole = document.getElementById('role-selector').value; saveAll(); applyRoleUI(); renderNavigation(); renderParty(); }

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    if (document.getElementById(t)) document.getElementById(t).style.display = 'block';
    if(t === 'tab-party') renderParty();
}

function renderNavigation() {
    const isM = currentRole === 'master'; const nav = document.getElementById('main-nav'); if (!nav) return;
    nav.innerHTML = `<button onclick="window.showTab('tab-home')"><i class="fa-solid fa-house"></i><span>Home</span></button>${isM ? `<button onclick="window.showTab('tab-combat')"><i class="fa-solid fa-bolt"></i><span>Batalla</span></button><button onclick="window.showTab('tab-loot')"><i class="fa-solid fa-coins"></i><span>Oro</span></button>` : ''}<button onclick="window.showTab('tab-party')"><i class="fa-solid fa-users"></i><span>Gremio</span></button>`;
}

function renderParty() {
    const container = document.getElementById('character-list'); if (!container) return;
    container.innerHTML = party.map(c => `
        <div class="char-card" style="display:flex; flex-direction:column; background:#111; border:1px solid #222; margin-bottom:10px; padding:15px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div onclick="window.toggleInventory(${c.id})" style="flex:1; cursor:pointer;">
                    <h3 style="margin:0; color:var(--gold);">${c.name}</h3>
                    <p style="margin:0; font-size:0.8rem; color:#888;">💰 ${c.wallet.gp + (c.wallet.gp_fake||0)} gp</p>
                </div>
                <button onclick="window.openTrade(${c.id})" class="btn-mini" style="border:1px solid var(--gold); color:var(--gold); background:none; padding:6px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">INTERCAMBIO</button>
            </div>
            <div id="inv-${c.id}" style="display:none; background:#0a0a0a; padding:10px; margin-top:10px; border-radius:6px;">
                ${c.inventory.map(it=>`<p style="margin:4px 0; font-size:0.8rem;">• ${it.name}</p>`).join('') || '<p style="color:#444;">Vacío</p>'}
                ${(currentRole=='master' && c.wallet.gp_fake > 0) ? `<p style="color:red; font-size:0.7rem; margin-top:5px;">⚠️ ORO FALSO: ${c.wallet.gp_fake}</p>`:''}
            </div>
        </div>
    `).join('');
}

function toggleInventory(id) { const d = document.getElementById('inv-'+id); if(d) d.style.display = (d.style.display === 'none' ? 'block' : 'none'); }

function createCharacter() {
    const name = document.getElementById('char-name').value.trim(); if (!name) return alert("Escribe un nombre.");
    const cls = document.getElementById('char-class').value; const race = document.getElementById('char-race').value;
    const newChar = { id: Date.now(), name, level: 1, charClass: cls, race, stats: { str: 10 }, inventory: [], wallet: { gp: 0, gp_fake: 0, sp: 0, sp_fake: 0, cp: 0, cp_fake: 0 } };
    party.push(newChar); const camp = campaigns.find(c => c.id === currentCampaignId); if (camp) camp.party = party;
    saveAll(); renderParty(); document.getElementById('char-name').value = '';
}

function generateRandomEncounter() { alert("Simulación: Monstruo CR 1"); } function generateLoot() { alert("Simulación: 50 gp hallados"); }

// --- INICIALIZAR ---
document.addEventListener('DOMContentLoaded', init);
window.showTab = showTab; window.openTrade = openTrade; window.renderTradeUI = renderTradeUI; window.confirmTradePart = confirmTradePart; window.executeTrade = executeTrade; window.closeTrade = closeTrade; window.toggleTradeItem = toggleTradeItem; window.updateTradeOffer = updateTradeOffer; window.createCharacter = createCharacter; window.saveCampaign = saveCampaign; window.showCreateCampaign = showCreateCampaign; window.deleteCampaign = deleteCampaign; window.selectCampaign = selectCampaign; window.editCampaign = editCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.toggleInventory = toggleInventory; window.generateRandomEncounter = generateRandomEncounter; window.generateLoot = generateLoot;