// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
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

// --- INICIO ---
async function loadSRDData() {
    try {
        const response = await fetch('data/srd_data.json');
        if (!response.ok) throw new Error("Fetch failed");
        srdData = await response.json();
        populateSelects();
    } catch (e) {
        console.error("Error cargando SRD:", e);
    }
    // Siempre intentar renderizar lo que haya en localStorage
    if (currentCampaignId && currentCampaignId !== "") {
        selectCampaign(currentCampaignId);
    } else {
        renderCampaignList();
    }
}

// --- GESTIÓN DE CAMPAÑAS ---
function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    if (!container) return;
    
    if (campaigns.length === 0) {
        container.innerHTML = '<p style="color:#666; font-style:italic; padding:10px;">No hay campañas activas.</p>';
        return;
    }

    container.innerHTML = campaigns.map(c => `
        <div class="campaign-item">
            <div class="campaign-info" onclick="selectCampaign(\'' + c.id + '\')">
                <h3 style="margin:0; color:var(--gold); font-family:\'Cinzel\';">${c.name}</h3>
                <p style="margin:0; font-size:0.8rem; color:#888;">${(c.party || []).length} Héroes</p>
            </div>
            <button class="btn-mini" onclick="deleteCampaign(\'' + c.id + '\')" style="background:transparent; border:none; color:#ff4444;"><i class="fa-solid fa-trash"></i></button>
        </div>
    `).join('');
}

function showCreateCampaign() {
    document.getElementById('create-campaign-form').style.display = 'block';
}

function saveCampaign() {
    const nameInput = document.getElementById('new-campaign-name');
    const name = nameInput.value.trim();
    if (!name) return alert("Escribe un nombre.");
    
    const newCamp = {
        id: 'camp_' + Date.now(),
        name: name,
        party: [],
        notices: []
    };
    
    campaigns.push(newCamp);
    saveAll();
    nameInput.value = '';
    document.getElementById('create-campaign-form').style.display = 'none';
    renderCampaignList();
}

function deleteCampaign(id) {
    if (confirm("¿Seguro que quieres borrar esta campaña?")) {
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

// --- INTERCAMBIO (HANDSHAKE) ---
function openTrade(charId) {
    const initiator = party.find(c => c.id == charId);
    const others = party.filter(c => c.id != charId);
    if (others.length === 0) return alert("Necesitas al menos otro héroe.");

    activeTrade = {
        p1Id: charId,
        p2Id: others[0].id,
        offer1: { gold: 0, items: [] },
        offer2: { gold: 0, items: [] },
        p1Confirmed: false,
        p2Confirmed: false
    };
    renderTradeUI();
    document.getElementById('trade-overlay').style.display = 'flex';
}

function renderTradeUI() {
    const t = activeTrade;
    const p1 = party.find(c => c.id == t.p1Id);
    const p2 = party.find(c => c.id == t.p2Id);

    // Trader 1
    document.getElementById('trader-1-name').innerText = p1.name;
    document.getElementById('trade-items-1').innerHTML = p1.inventory.map((it, i) => `
        <div><input type="checkbox" onchange="toggleTradeItem(1, ${i})" ${t.offer1.items.includes(i)?'checked':''} ${t.p1Confirmed?'disabled':''}> ${it.name}</div>
    `).join('');
    document.getElementById('trade-gold-1').value = t.offer1.gold;
    document.getElementById('trade-gold-1').disabled = t.p1Confirmed;
    
    const s1 = document.getElementById('trader-1-status');
    s1.className = 'status-badge ' + (t.p1Confirmed ? 'status-ready' : 'status-pending');
    s1.innerText = t.p1Confirmed ? '✅ CONFORME' : '⌛ Editando...';

    // Trader 2 (Selector de objetivo si P1 no ha cerrado)
    document.getElementById('trader-2-name').innerText = p2.name;
    const selectorArea = document.getElementById('trader-2-selector-area');
    if (!t.p1Confirmed) {
        selectorArea.innerHTML = `<select onchange="activeTrade.p2Id=this.value; renderTradeUI();">${party.filter(p=>p.id!=t.p1Id).map(p=>`<option value="${p.id}" ${p.id==t.p2Id?'selected':''}>${p.name}</option>`).join('')}</select>`;
    } else {
        selectorArea.innerHTML = '';
    }

    document.getElementById('trade-items-2').innerHTML = p2.inventory.map((it, i) => `
        <div><input type="checkbox" onchange="toggleTradeItem(2, ${i})" ${t.offer2.items.includes(i)?'checked':''} ${t.p2Confirmed?'disabled':''}> ${it.name}</div>
    `).join('');
    document.getElementById('trade-gold-2').value = t.offer2.gold;
    document.getElementById('trade-gold-2').disabled = t.p2Confirmed;
    
    const s2 = document.getElementById('trader-2-status');
    s2.className = 'status-badge ' + (t.p2Confirmed ? 'status-ready' : 'status-pending');
    s2.innerText = t.p2Confirmed ? '✅ CONFORME' : '⌛ Editando...';

    // Visibilidad de botones
    document.getElementById('btn-confirm-1').style.display = t.p1Confirmed ? 'none' : 'block';
    document.getElementById('btn-confirm-2').style.display = (t.p1Confirmed && !t.p2Confirmed) ? 'block' : 'none';
    document.getElementById('btn-execute-trade').style.display = (t.p1Confirmed && t.p2Confirmed) ? 'block' : 'none';
}

function updateTradeOffer(num) {
    const val = parseInt(document.getElementById('trade-gold-' + num).value) || 0;
    if (num === 1) activeTrade.offer1.gold = val; else activeTrade.offer2.gold = val;
    activeTrade.p1Confirmed = false;
    activeTrade.p2Confirmed = false;
    renderTradeUI();
}

function toggleTradeItem(num, idx) {
    const list = num === 1 ? activeTrade.offer1.items : activeTrade.offer2.items;
    if (list.includes(idx)) { list.splice(list.indexOf(idx), 1); } else { list.push(idx); }
    activeTrade.p1Confirmed = false;
    activeTrade.p2Confirmed = false;
    renderTradeUI();
}

function confirmTradePart(num) {
    const t = activeTrade;
    const char = party.find(c => c.id == (num === 1 ? t.p1Id : t.p2Id));
    const offerG = num === 1 ? t.offer1.gold : t.offer2.gold;
    if (offerG > char.wallet.gp + (char.wallet.gp_fake || 0)) return alert("Oro insuficiente.");
    
    if (num === 1) t.p1Confirmed = true; else t.p2Confirmed = true;
    renderTradeUI();
}

function executeTrade() {
    const t = activeTrade;
    const p1 = party.find(c => c.id == t.p1Id);
    const p2 = party.find(c => c.id == t.p2Id);

    function move(from, to, amount) {
        if (amount <= 0) return;
        const total = from.wallet.gp + (from.wallet.gp_fake || 0);
        const fRatio = (from.wallet.gp_fake || 0) / total;
        const fGive = Math.floor(amount * fRatio);
        const rGive = amount - fGive;
        from.wallet.gp -= rGive; from.wallet.gp_fake -= fGive;
        to.wallet.gp += rGive; to.wallet.gp_fake += fGive;
    }
    move(p1, p2, t.offer1.gold);
    move(p2, p1, t.offer2.gold);

    function moveIts(from, to, idxs) {
        idxs.sort((a,b) => b-a).forEach(i => to.inventory.push(from.inventory.splice(i, 1)[0]));
    }
    moveIts(p1, p2, t.offer1.items);
    moveIts(p2, p1, t.offer2.items);

    alert("¡Intercambio finalizado!");
    activeTrade = null;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    camp.party = party;
    saveAll();
    closeTrade();
    renderParty();
}

function closeTrade() { document.getElementById('trade-overlay').style.display = 'none'; }

// --- UI Y OTROS ---
function applyRoleUI() {
    document.getElementById('current-role-text').innerText = currentRole.toUpperCase();
}

function changeRole() {
    currentRole = document.getElementById('role-selector').value;
    saveAll();
    applyRoleUI();
    renderNavigation();
    renderParty();
}

function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(t).style.display = 'block';
    if(t === 'tab-party') renderParty();
}

function renderNavigation() {
    const isM = currentRole === 'master';
    document.getElementById('main-nav').innerHTML = `
        <button onclick="showTab(\'' + 'tab-home' + '\')">Home</button>
        ${isM ? `<button onclick="showTab(\'' + 'tab-combat' + '\')">Batalla</button><button onclick="showTab(\'' + 'tab-loot' + '\')">Oro</button>` : ''}
        <button onclick="showTab(\'' + 'tab-party' + '\')">Gremio</button>
    `;
}

function renderParty() {
    const container = document.getElementById('character-list');
    if (!container) return;
    container.innerHTML = party.map(c => `
        <div class="char-card" style="display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div onclick="toggleInventory(${c.id})" style="flex:1; cursor:pointer;">
                    <h3 style="margin:0;">${c.name}</h3>
                    <p style="margin:0; font-size:0.8rem; color:#888;">💰 ${c.wallet.gp + (c.wallet.gp_fake||0)} gp</p>
                </div>
                <button onclick="openTrade(${c.id})" class="btn-mini" style="border:1px solid var(--gold); color:var(--gold); background:none; padding:5px 10px; border-radius:5px;">INTERCAMBIO</button>
            </div>
            <div id="inv-${c.id}" style="display:none; background:#111; padding:10px; border-radius:5px; margin-top:10px; font-size:0.8rem;">
                <strong>Inventario:</strong>
                ${c.inventory.length ? c.inventory.map(it=>`<p style="margin:2px 0;">• ${it.name}</p>`).join('') : '<p>Vacío</p>'}
                ${(currentRole=='master' && c.wallet.gp_fake > 0) ? `<p style="color:red; font-size:0.7rem; margin-top:5px;">⚠️ ORO FALSO: ${c.wallet.gp_fake}</p>`:''}
            </div>
        </div>
    `).join('');
}

function toggleInventory(id) {
    const d = document.getElementById('inv-'+id);
    d.style.display = (d.style.display === 'none' || d.style.display === '') ? 'block' : 'none';
}

function createCharacter() {
    const name = document.getElementById('char-name').value;
    if (!name) return;
    const cls = document.getElementById('char-class').value;
    const race = document.getElementById('char-race').value;
    const newChar = {
        id: Date.now(), name, level: 1, charClass: cls, race,
        stats: { str: 10 }, inventory: [],
        wallet: { gp: 0, gp_fake: 0, sp: 0, sp_fake: 0, cp: 0, cp_fake: 0 }
    };
    party.push(newChar);
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (camp) camp.party = party;
    saveAll();
    renderParty();
}

function populateSelects() {
    document.getElementById('char-class').innerHTML = srdData.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    document.getElementById('char-race').innerHTML = srdData.races.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
}

function generateRandomEncounter() { alert("Simulación: Trasgo CR 1/4"); }
function generateLoot() { alert("Simulación: 10 gp hallados"); }

document.addEventListener('DOMContentLoaded', loadSRDData);

window.showTab = showTab; window.openTrade = openTrade; window.confirmTradePart = confirmTradePart; window.executeTrade = executeTrade; window.closeTrade = closeTrade; window.toggleTradeItem = toggleTradeItem; window.updateTradeOffer = updateTradeOffer; window.createCharacter = createCharacter; window.saveCampaign = saveCampaign; window.showCreateCampaign = showCreateCampaign; window.deleteCampaign = deleteCampaign; window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.toggleInventory = toggleInventory;