// --- ESTADO ---
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
    const numbers = { 'cero':0, 'uno':1, 'dos':2, 'tres':3, 'cuatro':4, 'cinco':5, 'seis':6, 'siete':7, 'ocho':8, 'nuve':9, 'diez':10 };
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
                <button onclick="window.rollForLimit()" class="btn-secondary" style="margin-top:10px; width:100%; border-style:dashed; border-color:var(--gold);">[TEST] PROBAR DADO D20</button>
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

function copyInviteCode(id) {
    copyToClipboard(id);
    openModal(`
        <h2 class="cinzel" style="text-align:center;">Código Copiado</h2>
        <p style="text-align:center;">Envía este código a tus jugadores:</p>
        <div style="background:#000; padding:15px; border-radius:8px; text-align:center; font-family:monospace; color:var(--gold); font-size:1.2rem; border:1px solid var(--gold-muted); margin:15px 0;">
            ${id}
        </div>
        <button onclick="window.closeModal()" class="btn-primary">ENTENDIDO</button>
    `);
}

function showJoinForm() {
    openModal(`
        <h2 class="cinzel">Unirse a Aventura</h2>
        <p>Pega el código que te envió tu Dungeon Master:</p>
        <input type="text" id="join-code" placeholder="camp_123456789...">
        <button onclick="window.joinCampaign()" class="btn-primary">UNIRSE</button>
        <button onclick="window.closeModal()" class="btn-secondary" style="margin-top:15px; width:100%;">CANCELAR</button>
    `);
}

function joinCampaign() {
    const code = document.getElementById('join-code').value.trim();
    if (!code) return;
    
    let camp = campaigns.find(c => c.id === code);
    
    if (camp && !camp.isJoined) {
        openModal(`
            <h2 class="cinzel" style="color:var(--gold);">Acceso Denegado</h2>
            <p style="text-align:center;">Ya eres el Master de esta aventura. No puedes unirte como aventurero.</p>
            <button onclick="window.closeModal()" class="btn-primary">ENTENDIDO</button>
        `);
        return;
    }

    if (camp && camp.isJoined) {
        openModal(`<p style="text-align:center;">Ya formas parte de esta aventura.</p>`);
        return;
    }

    campaigns.push({ id: code, name: "Aventura Invitada", party: [], notices: [], isJoined: true });
    saveAll(); renderLobby(); closeModal();
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
            <label style="font-size:0.8rem;">RFVSQUNJacOTTiBFWFRFTkRJREEgKDMwIGTDrWFzKTwvbGFiZWw+CiAgICAgICAgPC9kaXY+CiAgICAgICAgPHAgc3R5bGU9ImZvbnQtc2l6ZTowLjdyZW07IGNvbG9yOiM2NjY7Ij4qIFBvciBkZWZlY3RvIGR1cmFuIDcgZMOtYXMuIE1lbnNhamVzIHNvc3BlY2hvc29zIHNlcsOhbiBtb2RlcmFkb3MuPC9wPgogICAgICAgIDxidXR0b24gb25jbGljaz0id2luZG93LnBvc3RHbG9iYWxOb3RpY2UoKSIgY2xhc3M9ImJ0bi1wcmltYXJ5Ij5QVUJMSUNBUjwvYnV0dG9uPgogICAgICAgIDxidXR0b24gb25jbGljaz0id2luZG93LmNsb3NlTW9kYWwoKSIgY2xhc3M9ImJ0bi1zZWNvbmRhcnkiIHN0eWxlPSJtYXJnaW4tdG9wOjE1cHg7IHdpZHRoOjEwMCU7Ij5WT0xWRVI8L2J1dHRvbj4KICAgIGApOwp9CgpmdW5jdGlvbiBwb3N0R2xvYmFsTm90aWNlKCkgewogICAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZy10aXRsZScpLnZhbHVlLnRyaW0oKTsKICAgIGNvbnN0IHRleHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZy10ZXh0JykudmFsdWUudHJpbSgpOwogICAgaWYgKCF0aXRsZSB8fCAhdGV4dCkgcmV0dXJuOwogICAgCiAgICBjb25zdCBuZWVkc1JldmlldyA9IGlzU3BhbSh0aXRsZSkgfHwgaXNTcGFtKHRleHQpOwogICAgY29uc3QgaXNMb25nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ctbG9uZycpLmNoZWNrZWQ7CiAgICBnbG9iYWxOb3RpY2VzLnVuc2hpZnQoeyAKICAgICAgICB0aXRsZSwgdGV4dCwgZGF0ZTogRGF0ZS5ub3coKSwgCiAgICAgICAgcGVuZGluZzogbmVlZHNSZXZpZXcsCiAgICAgICAgZXhwaXJ5OiBpc0xvbmcgPyAyNTkyMDAwMDAwIDogNjA0ODAwMDAwIAogICAgfSk7CiAgICAKICAgIGlmIChnbG9iYWxOb3RpY2VzLmxlbmd0aCA+IDIwKSBnbG9iYWxOb3RpY2VzLnBvcCgpOwogICAgc2F2ZUFsbCgpOyByZW5kZXJHbG9iYWxCb2FyZCgpOyBjbG9zZU1vZGFsKCk7Cn0KCmZ1bmN0aW9uIHJlbmRlckxvYmFsQm9hcmQoKSB7CiAgICBjb25zdCBjYW1wID0gY2FtcGFpZ25zLmZpbmQoYyA9PiBjLmlkID09PSBjdXJyZW50Q2FtcGFpZ25JZCk7CiAgICBpZiAoIWNhbXApIHJldHVybjsKICAgIGNvbnN0IHJlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NhbC1ib2FyZCcpOwogICAgaWYgKCFyZXMpIHJldHVybjsKCiAgICByZXMuaW5uZXJIVE1MID0gKGNhbXAubm90aWNlcyB8fCBbXSkubWFwKChuLCBpKSA9PiB7CiAgICAgICAgY29uc3QgZGF5cyA9IChEYXRlLm5vdygpIC0gKG4uZGF0ZSB8fCAwKSkgLyAoMTAwMCAqIDYwICogNjAgKiAyNCk7CiAgICAgICAgY29uc3QgcmVhZENvdW50ID0gKG4ucmVhZEJ5IHx8IFtdKS5sZW5ndGg7CiAgICAgICAgY29uc3QgcGFydHlTaXplID0gKGNhbXAubGFydHkgfHwgW10pLmxlbmd0aCB8fCAxOwogICAgICAgIGNvbnN0IHJlYWRQZXJjZW50ID0gKHJlYWRDb3VudCAvIHBhcnR5U2l6ZSkgKiAxMDA7CiAgICAgICAgCiAgICAgICAgbGV0IHN1Z2dlc3Rpb24gPSAnJzsKICAgICAgICBpZiAoY3VycmVudFJv bGUgPT09ICdtYXN0ZXInKSB7CiAgICAgICAgICAgIGlmIChkYXlzID4gMzAgJiYgcmVhZFBlcmNlbnQgPj0gNzApIHsKICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb24gPSBgPGRpdiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDE5NywxNjAsODksMC4xKTsgYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1nb2xkKTsgcGFkZGluZzo4cHg7IGJvcmRlci1yYWRpdXM6NXB4OyBtYXJnaW4tdG9wOjEwcHg7IGZvbnQtc2l6ZTowLjc1cmVtOyBjb2xvcjp2YXIoLS1nb2xkKTsiPgogICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzPSJmYS1zb2xpZCBmYS1icm9vbSI+PC9pPiA8Yj5TdWdnZXJlbmNpYTo8L2I+ICR7TWF0aC5mbG9vcihyZWFkUGVyY2VudCl9JSBsbyBsZXnDsyBoYWNlICszMCBkw61hcy4gwr9Cb3JyYXIgbWlzacOzbj8KICAgICAgICAgICAgICAgIDwvZGl2PmA7CiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGF5cyA+IDE1ICYmIHJlYWRQZXJjZW50IDwgMzApIHsKICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb24gPSBgPGRpdiBzdHlsZT0iYmFja2dyb3VuZDpyZ2JhKDI1NSwxMzYsMCwwLjEpOyBib3JkZXI6MXB4IHNvbGlkICNmZjg4MDA7IHBhZGRpbmc6OHB4OyBib3JkZXItcmFkaXVzOjVweDsgbWFyZ2luLXRvcDoxMHB4OyBmb250LXNpemU6MC43NXJlbTsgY29sb3I6I2ZmODgwMDsiPgogICAgICAgICAgICAgICAgICAgIDxpIGNsYXNzPSJmYS1zb2xpZCBmYS1jaXJjbGUtZXhjbGFtYXRpb24iPjwvaT4gPGI+U3VnZ2VyZW5jaWE6PC9iPiBTb2xvICR7TWF0aC5mbG9vcihyZWFkUGVyY2VudCl9JSBkZSBpbnRlcsOpcyBlbiAxNSBkw61hcy4KICAgICAgICAgICAgICAgIDwvZGl2PmA7CiAgICAgICAgICAgIH0KICAgICAgICB9CgogICAgICAgIHJldHVybiBgCiAgICAgICAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9ImJhY2tncm91bmQ6IzBhMGEwYTsgcG9zaXRpb246cmVsYXRpdmU7IGJvcmRlci1sZWZ0OjRweCBzb2xpZCB2YXIoLS1kYW5nZXIpOyAke3N1Z2dlc3Rpb24gPyAnYm9yZGVyLWNvbG9yOnZhcigtLWdvbGQpOyM3JyA6ICcnfSI+CiAgICAgICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6ZmxleDsganVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47IGFsaWduLWl0ZW1zOnN0YXJ0OyI+CiAgICAgICAgICAgICAgICA8ZGl2ID4KICAgICAgICAgICAgICAgICAgICA8aDMgc3R5bGU9Im1hcmdpbjowOyI+JHtuLnRpdGxlfTwvaDM+CiAgICAgICAgICAgICAgICAgICAgJHtzdWdnZXN0aW9ufQogICAgICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgICAgICAke2N1cnJlbnRSb2xlID09PSAnbWFzdGVyJyA/IGA8aCBjbGFzcz0iZmEtc29saWQgZmEtdHJhc2giIG9uY2xpY2s9IndpbmRvdy5kZWxldGVNaXNzaW9uKCR7aX0pIiBzdHlsZT0iY29sb3I6dmFyKC0tZGFuZ2VyKTsgY3Vyc29yOnBvaW50ZXI7Ij48L2k+YCA6ICcnfQogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPHAgc3R5bGU9ImZvbnQtc2l6ZToxLjFyZW07IHdoaXRlLXNwYWNlOnByZS13cmFwOyBtYXJnaW46MTVweCAwOyBjb2xvcjojY2NjOyI+JHtuLnRleHR9PC9wPgogICAgICAgICAgICA8ZGl2IHN0eWxlPSJib3JkZXItdG9wOjFweCBzb2xpZCAjMjIyOyBwYWRkaW5nLXRvcDoxMHB4OyBkaXNwbGF5OmZsZXg7IGp1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuOyBhbGlnbi1pdGVtczpjZW50ZXI7Ij4KICAgICAgICAgICAgICAgIDxkaXYgaWQ9InNlYWxzLSR7aX0iPgogICAgICAgICAgICAgICAgICAgIDkeyhuLnJlYWRCeSB8fCBbXSkubWFwKHIgPT4gYDxkaXYgY2xhc3M9IndheC1zZWFsIiB0aXRsZT0iJHtyfSI+PC9kaXY+YCkuam9pbihfKX0KICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgJHtjdXJyZW50Um9sZSA9PT0gJ2F2ZW50dXJlcm8nID8gYDxidXR0b24gb25jbGljaz0id2luZG93Lm1hcmtBc1JlYWQoJHtpfSkiIGNsYXNzPSJidG4tc2Vjb25kYXJ5IiBzdHlsZT0iZm9udC1zaXplOjAuN3JlbTsgcGFkZGluZzo1cHggMTBweDsiPk1BUkNBUiBDT01PIExFw41ETzwvYnV0dG9uPmAgOiAnJ30KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICBgOwogICAgfSkuam9pbihfKSB8fCAnPHAgc3R5bGU9ImNvbG9yOiM0NDQ7IHRleHQtYWxpZ246Y2VudGVyOyI+Tm8gaGF5IG1pc2lvbmVzIGFjdGl2YXMuPC9wPic7Cn0KCmZ1bmN0aW9uIG1hcmtBc1JlYWQoaWR4KSB7CiAgICBjb25zdCBjYW1wID0gY2FtcGFpZ25zLmZpbmQoYyA9PiBjLmlkID09PSBjdXJyZW50Q2FtcGFpZ25JZCk7CiAgICBpZiAoIWNhbXAgfHwgIWNhbXAubm90aWNlc1tpZHhdKSByZXR1cm47CiAgICBjb25zdCBuID0gY2FtcC5ub3RpY2VzW2lkeF07CiAgICBpZiAoIW4ucmVhZEJ5KSBuLnJlYWRCeSA9IFtdOwogICAgaWYgKCFuLnJlYWRCeS5pbmNsdWRlcygnSnVnYWRvcicpKSB7IAogICAgICAgIG4ucmVhZEJ5LnB1c2goJ0p1Z2Fkb3InKTsKICAgICAgICBzYXZlQWxsKCk7IHJlbmRlckxvYmJ5KCk7CiAgICB9Cn0KCmZ1bmN0aW9uIGFkZE1pc3Npb24oKSB7CiAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaXNzaW9uLXRpdGxlJykudmFsdWUudHJpbSgpOwogICAgY29uc3QgdGV4dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaXNzaW9uLXRleHQnKS52YWx1ZS50cmltKCk7CiAgICBpZiAocCF0aXRsZSB8fCAhdGV4dCkgcmV0dXJuOwogICAgY29uc3QgY2FtcCA9IGNhbXBhaWducy5maW5kKGMgPT4gIGMuaWQgPT09IGN1cnJlbnRDYW1wYWlnbklkKTsKICAgIGlmICghY2FtcC5ub3RpY2VzKSBjYW1wLm5vdGljZXMgPSBbXTsKICAgIGNhbXAubm90aWNlcy51bnNoaWZ0KHsgdGl0bGUsIHRleHQsIHJlYWRCeTogW10sIGRhdGU6IERhdGUubm93KCkgfSk7CiAgICBzYXZlQWxsKCk7IHJlbmRlckxvYmNhQm9hcmQoKTsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaXNzaW9uLXRpdGxlJykudmFsdWUgPSAnJzsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtaXNzaW9uLXRleHQnKS52YWx1ZSA9ICcnOwp9CgpmdW5jdGlvbiBkZWxldGVNaXNzaW9uKGlkeCkgewogICAgY29uc3QgY2FtcCA9IGNhbXBhaWducy5maW5kKGMgPT4gYy5pZCA9PT0gY3VycmVudENhbXBhaWduSWQpOwogICAgaWYgKCFjYW1wKSByZXR1cm47CiAgICBjYW1wLm5vdGljZXMuc3BsaWNlKGlkeCwgMSk7CiAgICBzYXZlQWxsKCk7IHJlbmRlckxvYmNhQm9hcmQoKTsKfQoKLy8gLS0tIE5QQyBUUkFERSAtLS0KZnVuY3Rpb24gb3Blbk5QQ1RyYWRlKGNoYXJJZCkgewogICAgY29uc3QgY2FtcCA9IGNhbXBhaWducy5maW5kKGMgPT4gYy5pZCA9PT0gY3VycmVudENhbXBhaWduSWQpOwogICAgY29uc3QgY2hhciA9IChjYW1wLnBhcnR5IHx8IFtdKS5maW5kKHAgPT4gcC5pZCA9PSBjaGFySWQpOwogICAgaWYgKCFjaGFyKSByZXR1cm47CiAgICBhY3RpdmVUcmFkZSA9IHsKICAgICAgICBjaGFySWQ6IGNoYXJJZCwKICAgICAgICBnaXZlSXRlbXM6IFtdLAogICAgICAgIHJlY2VpdmVDb2luczogeyBjcDowLCBzcDowLCBlcDowLCBncDowLCBwcDowIH0sCiAgICAgICAgcmVjZWl2ZUl0ZW1zOiBbXSwKICAgICAgICBwMUNvbmZpcm1lZDogZmFsc2UsCiAgICAgICAgcDJDb25maXJtZWQ6IGZhbHNlCiAgICB9OwogICAgcmVuZGVyTlBDVHJhZGVVSShjaGFyKTsKfQoKZnVuY3Rpb24gcmVuZGVyTlBDVHJhZGVVSShjaGFyKSB7CiAgICBvcGVuTW9kYWwoYAogICAgICAgIDxoMiBjbGFzcz0iY2luemVsIiBzdHlsZT0idGV4dC1hbGlnbjpjZW50ZXI7Ij5UcmF0byBjb24gTlBDPC9oMj4KICAgICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7IGpyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyOyBnYXA6MjBweDsiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjA7IGJhY2tncm91bmQ6IzAwMDsiPgogICAgICAgICAgICAgICAgPGgzIHN0eWxlPSJmb250LXNpemU6MC45cmVtOyBjb2xvcjp3aGl0ZTsiPkVOVFJFR0EgREVMIEFWRU5UVVJFUk88L2gzPgogICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0ibWF4LWhlaWdodDoxMjBweDsgb3ZlcmZsb3cteTphdXRvOyBmb250LXNpemU6MXJlbTsgbWFyZ2luLWJvdHRvbToxMHB4OyI+CiAgICAgICAgICAgICAgICAgICAgJHsoY2hhci5pbnZlbnRvcnkgfHwgW10pLm1hcCgoaXQsIGkpID0+IGAKICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT0icGFkZGluZzo1cHggMDsiPjxsYWJlbD48aW5wdXQgdHlwZT0iY2hlY2tib3giIG9uY2hhbmdlPSJ3aW5kb3cudXBkYXRlTlBDR2l2ZSgke2l9KSI+ICR7aXQubmFtZX08L2xhYmVsPjwvZGl2PgogICAgICAgICAgICAgICAgICAgIGApLmpvaW4oJycpIHx8ICdNb2NoaWxhIHZhY8OtYScKICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iY29pbi1ncmlkIj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb2luLXVuaXQiPjxzcGFuIGNsYXNzPSJjb2luLWNwIj5DUDwvc3Bhbj48c3Bhbj4ke2NoYXIud2FsbGV0LmNwfTwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb2luLXVuaXQiPjxzcGFuIGNsYXNzPSJjb2luLXNwIj5TUDwvc3Bhbj48c3Bhbj4ke2NoYXIud2FsbGV0LnNwfTwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb2luLXVuaXQiPjxzcGFuIGNsYXNzPSJjb2luLWdwIj5HUDwvc3Bhbj48c3Bhbj4ke2NoYXIud2FsbGV0LmdwfTwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJjb2luLXVuaXQiPjxzcGFuIGNsYXNzPSJjb2luLXBwIj5QUDwvc3Bhbj48c3Bhbj4ke2NoYXIud2FsbGV0LnBwfTwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgCiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJtYXJnaW46MDsgYmFja2dyb3VuZDojMDAwOyBib3JkZXI6MXB4IHNvbGlkIHZhcigtLWdvbGQpOyI+CiAgICAgICAgICAgICAgICA8aDMgc3R5bGU9ImZvbnQtc2l6ZTowLjlyZW07IGNvbG9yOnZhcigtLWdvbGQpOyI+UkVDT01QRU5TQSBERUwgTlBDPC9oMz4KICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImRpc3BsYXk6Z3JpZDsganJpZC10ZW1wbGF0ZS1jb2x1bW5zOiAxZnIgMWZyOyBnYXA6MTBweDsgbWFyZ2luLWJvdHRvbToxNXB4OyI+CiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IkNQIiBvbmlucHV0PSJhY3RpdmVUcmFkZS5yZWNlaXZlQ29pbnMuY3A9dGhpcy52YWx1ZSI+CiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9Im51bWJlciIgcGxhY2Vob2xkZXI9IkdQIiBvbmlucHV0PSJhY3RpdmVUcmFkZS5yZWNlaXZlQ29pbnMuZ3A9dGhpcy52YWx1ZSI+CiAgICAgICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPSJ0ZXh0IiBpZD0ibnBjLWl0ZW0tc2VhcmNoIiBwbGFjZWhvbGRlcj0iR2VuZXJhciDDrXRlbSBvIG1hdGVyaWFsLi4uIiBvbmtleXVwPSJ3aW5kb3cuc2VhcmNoTlBDSXRlbXMoKSI+CiAgICAgICAgICAgICAgICA8ZGl2IGlkPSJucGMtc2VhcmNoLXJlc3VsdHMiIHN0eWxlPSJmb250LXNpemU6MC45cmVtOyBjb2xvcjp2YXIoLS1nb2xkKTsgbWFyZ2luLWJvdHRvbToxMHB4OyI+PC9kaXY+CiAgICAgICAgICAgICAgICA8ZGl2IGlkPSJucGMtcGVuZGluZy1pdGVtcyIgc3R5bGU9ImZvbnQtc2l6ZTowLjlyZW07IGNvbG9yOiNhYWE7Ij48L2Rpdj4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgPC9kaXY+CgogICAgICAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6MjBweDsgZGlzcGxheTpmbGV4OyBnYXA6MTBweDsiPgogICAgICAgICAgICA8YnV0dG9uIGlkPSJidG4tbnBjLXAxIiBvbmNsaWNrPSJ3aW5kb3cuY29uZmlybU5QQ1BhcnQoMSkiIGNsYXNzPSJidG4tc2Vjb25kYXJ5IiBzdHlsZT0iZmxleDoxOyI+U0VMTEFSIE5QQzwvYnV0dG9uPgogICAgICAgICAgICA8YnV0dG9uIGlkPSJidG4tbnBjLXAyIiBvbmNsaWNrPSJ3aW5kb3cuY29uZmlybU5QQ1BhcnQoMikiIGNsYXNzPSJidG4tc2Vjb25kYXJ5IiBzdHlsZT0iZmxleDoxOyI+U0VMTEFSIEpVR0FET1I8L2J1dHRvbj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8YnV0dG9uIGlkPSJidG4tbnBjLWV4ZWMiIG9uY2xpY2s9IndpbmRvdy5leGVjdXRlTlBDVHJhZGUoKSIgY2xhc3M9ImJ0bi1wcmltYXJ5IiBzdHlsZT0iZGlzcGxheTpub25lOyBtYXJnaW4tdG9wOjE1cHg7Ij5DRVJSQVIgVFJBVE88L2J1dHRvbj4KICAgIGApOwp9CgpmdW5jdGlvbiB1cGRhdGVOUENCaXZlKGlkeCkgewogICAgaWYgKCFhY3RpdmVUcmFkZSkgcmV0dXJuOwogICAgaWYgKGFjdGl2ZVRyYWRlLmdpdmVJdGVtcy5pbmNsdWRlcyhpZHgpKSBhY3RpdmVUcmFkZS5naXZlSXRlbXMgPSBhY3RpdmVUcmFkZS5naXZlSXRlbXMuZmlsdGVyKGkgPT4gaSAhPT0gaWR4KTsKICAgIGVsc2UgYWN0aXZlVHJhZGUuZ2l2ZUl0ZW1zLnB1c2goaWR4KTsKfQoKZnVuY3Rpb24gc2VhcmNoTlBDSXRlbXMoKSB7CiAgICBjb25zdCBxID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ25wYy1pdGVtLXNlYXJjaCcpLnZhbHVlLnRvTG93ZXJDYXNlKCk7CiAgICBjb25zdCByZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbnBjLXNlYXJjaC1yZXN1bHRzJyk7CiAgICBpZiAocS5sZW5ndGggPCAyKSByZXR1cm4gcmVzLmlubmVySFRNTCA9ICcnOwogICAgY29uc3QgbWF0Y2hlcyA9IFsuLi5zcmREYXRhLml0ZW1zLCAuLi5zcmREYXRhLndlYXBvbnNdLmZpbHRlcihpID0+IGkubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpKS5zbGljZSgwLCAzKTsKICAgIHJlcy5pbm5lckhUTUwgPSBtYXRjaGVzLm1hcChtID0+IGA8ZGl2IG9uY2xpY2s9IndpbmRvdy5hZGROUENCXRlbSgnJHttLm5hbWV9JykiIHN0eWxlPSJjdXJzb3I6cG9pbnRlcjsgcGFkZGluZzo4cHg7IGJvcmRlci1ib3R0b206MXB4IHNvbGlkICMyMjI7Ij4rICR7bS5uYW1lfTwvZGl2PmApLmpvaW4oJycpICsgYDxkaXYgb25jbGljaz0id2luZG93LmFkGROUENCXRlbSgnJHtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbnBjLWl0ZW0tc2VhcmNoJykudmFsdWV9JykiIHN0eWxlPSJjb2xvcjp3aGl0ZTsgY3Vyc29yOnBvaW50ZXI7IHBhZGRpbmc6OHB4OyI+KyBbQ3JlYXJdOiAke2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCducGMtaXRlbS1zZWFyY2gnKS52YWx1ZX08L2Rpdj5gOwp9CgpmdW5jdGlvbiBhZGROUENCXRlbShuYW1lKSB7CiAgICBpZiAoIWFjdGl2ZVRyYWRlKSByZXR1cm47CiAgICBhY3RpdmVUcmFkZS5yZWNlaXZlSXRlbXMucHVzaChuYW1lKTsKICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCducGMtcGVuZGluZy1pdGVtcycpLmlubmVySFRNTCA9IGFjdGl2ZVRyYWRlLnJlY2VpdmVJdGVtcy5tYXAoaSA9PiBg4oCiICR7aX1gKS5qb2luKCc8YnI+Jyk7Cn0KCmZ1bmN0aW9uIGNvbmZpcm1OUENCYXJ0KG4pIHsKICAgIGlmICghYWN0aXZlVHJhZGUpIHJldHVybjsKICAgIGlmIChuID09PSAxKSB7IGFjdGl2ZVRyYWRlLnAxQ29uZmlybWVkID0gdHJ1ZTsgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1ucGMtcDEnKS5zdHlsZS5iYWNrZ3JvdW5kID0gJ3ZhcigtLXN1Y2Nlc3MpJzsgfQogICAgaWYgKG4gPT09IDIpIHsgYWN0aXZlVHJhZGUucDJDb25maXJtZWQgPSB0cnVlOyBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLW5wYy1wMicpLnN0eWxlLmJhY2tncm91bmQgPSAndmFyKC0tc3VjY2VzcyknOyB9CiAgICBpZiAoYWN0aXZlVHJhZGUucDFDb25maXJtZWQgJiYgYWN0aXZlVHJhZGUucDJDb25maXJtZWQpIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tbnBjLWV4ZWMnKS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJzsKfQoKZnVuY3Rpb24gZXhlY3V0ZU5QQ1RyYWRlKCkgewogICAgY29uc3QgY2FtcCA9IGNhbXBhaWducy5maW5kKGMgPT4gYy5pZCA9PT0gY3VycmVudENhbXBhaWduSWQpOwogICAgY29uc3QgY2hhciA9IGNhbXAubmFydHkuZmluZChwID0+IHAuaWQgPT0gYWN0aXZlVHJhZGUuY2hhcklkKTsKICAgIAogICAgYWN0aXZlVHJhZGUuZ2l2ZUl0ZW1zLnNvcnQoKGEsYikgPT4gYi1hKS5mb3JFYWNoKGlkeCA9PiBjaGFyLmludmVudG9yeS5zcGxpY2UoaWR4LCAxKSk7CiAgICAKICAgIGNoYXIud2FsbGV0LmNwICs9IHBhcnNlSW50KGFjdGl2ZVRyYWRlLnJlY2VpdmVDb2lucy5jcCkgfHwgMDsKICAgIGNoYXIud2FsbGV0LnNwICs9IHBhcnNlSW50KGFjdGl2ZVRyYWRlLnJlY2VpdmVDb2lucy5zcCkgfHwgMDsKICAgIGNoYXIud2FsbGV0LmdwICs9IHBhcnNlSW50KGFjdGl2ZVRyYWRlLnJlY2VpdmVDb2lucy5ncCkgfHwgMDsKICAgIGNoYXIud2FsbGV0LnBwICs9IHBhcnNlSW50KGFjdGl2ZVRyYWRlLnJlY2VpdmVDb2lucy5wcCkgfHwgMDsKICAgIAogICAgYWN0aXZlVHJhZGUucmVjZWl2ZUl0ZW1zLmZvckVhY2gobmFtZSA9PiBjaGFyLmludmVudG9yeS5wdXNoKHsgbmFtZSwgd2VpZ2h0OiAxIH0pKTsKICAgIAogICAgc2F2ZUFsbCgpOyBjbG9zZU1vZGFsKCk7IHJlbmRlclBhcnR5KCk7IHJlbmRlck1hc3RlckV5ZSgpOwp9CgovLyAtLS0gQ09NQkFUICYgU1JEIC0tLQphc3luYyBmdW5jdGlvbiBsb2FkU1JERGF0YSgpIHsKICAgIHRyeSB7CiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnZGF0YS9zcmRfZGF0YS5qc29uJyk7CiAgICAgICAgc3JkRGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTsKICAgIH0gY2F0Y2ggKGUpIHsgY29uc29sZS53YXJuKCJTUkQgZmFpbCIpOyB9Cn0KCmZ1bmN0aW9uIHNlYXJjaE1vbnN0ZXJzKCkgewogICAgY29uc3QgcSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb25zdGVyLXNlYXJjaCcpLnZhbHVlLnRvTG93ZXJDYXNlKCk7CiAgICBjb25zdCByZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncyVhcmNoLXJlc3VsdHMnKTsKICAgIGlmICghcSkgcmV0dXJuIHJlcy5pbm5lckhUTUwgPSAnJzsKICAgIGNvbnN0IG1hdGNoZXMgPSBzcmREYXRhLm1vbnN0ZXJzLmZpbHRlcihtID0+IG0ubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpKS5zbGljZSgwLCA1KTsKICAgIHJlcy5pbm5lckhUTUwgPSBtYXRjaGVzLm1hcChtID0+IGAKICAgICAgICA8ZGl2IG9uY2xpY2s9IndpbmRvdy5zaG93TW9uc3Rlck1vZGFsKCcke20ubmFtZX0nKSIgY2xhc3M9ImNhbXBhaWduLWl0ZW0iIHN0eWxlPSJjdXJzb3I6cG9pbnRlcjsiPgogICAgICAgICAgICA8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ29sZCk7IGZvbnQtZmFtaWx5OkNpbnplbDsiPiR7bS5uYW1lfTwvc3Bhbj4KICAgICAgICAgICAgPHNwYW4gc3R5bGU9ImNvbG9yOiM2NjY7IGZvbnQtc2l6ZTowLjhyZW07Ij5DUiAke20uY3J9PC9zcGFuPgogICAgICAgIDwvZGl2PgogICAgYCkuam9pbihfKTsKfQoKZnVuY3Rpb24gc2hvd01vbnN0ZXJNb2RhbChuYW1lIHsKICAgIGNvbnN0IG0gPSBzcmREYXRhLm1vbnN0ZXJzLmZpbHRlcihtbCA9PiBtby5uYW1lID09PSBuYW1lKTsKICAgIGlmICghbSkgcmV0dXJuOwogICAgb3Blbk1vZGFsKGAKICAgICAgICA8aDIgY2xhc3M9ImNpbnplbCIgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyOyBjb2xvcjp2YXIoLS1nb2xkKTsgZm9udC1zaXplOjJyZW07Ij4ke20ubmFtZX08L2gyPgogICAgICAgIDxwIHN0eWxlPSidGV4dC1hbGlnbjpjZW50ZXI7IGNvbG9yOiM4ODg7IG1hcmdpbi10b3A6LTEwcHg7Ij4ke20udHlwZX0gfCBDUjogJHttLmNyfTwvcD4KICAgICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmdyaWQ7IGdyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyOyBnYXA6MTVweDsgbWFyZ2luOjIwcHggMDsiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjA7IHRleHQtYWxpZ246Y2VudGVyOyBiYWNrZ3JvdW5kOiMwMDA7Ij5DQTxicj48YiBzdHlsZT0iZm9udC1zaXplOjEuNXJlbTsgY29sb3I6dmFyKC0tZ29sZCk7Ij4ke20uYWN9PC9iPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luOjA7IHRleHQtYWxpZ246Y2VudGVyOyBiYWNrZ3JvdW5kOiMwMDA7Ij5WSURBPGJyPjxiIHN0eWxlPSJmb250LXNpemU6MS41cmVtOyBjb2xvcjp2YXIoLS1kYW5nZXIpOyI+JHttLmhwfTwvYj48L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgICA8YnV0dG9uIG9uY2xpY2s9IndpbmRvdy5nb290TG9vdEZyb21Nb25zdGVyKCcke20ubmFtZX0nLCAnJHttLmNrfScsICcke20udHlwZX0nKSIgY2xhc3M9ImJ0bi1wcmltYXJ5Ij5ERVJST1RBRE8gKEJPVMONTik8L2J1dHRvbj4KICAgICAgICA8YnV0dG9uIG9uY2xpY2s9IndpbmRvdy5jbG9zZU1vZGFsKCkiIGNsYXNzPSJidG4tc2Vjb25kYXJ5IiBzdHlsZT0ibWFyZ2luLXRvcDoxNXB4OyB3aWR0aDoxMDAlOyI+Q0VSUkFSPC9idXR0b24+CiAgICBgKTsKfQoKZnVuY3Rpb24gZ29v dExvb3RGcm9tTW9uc3RlcihuYW1lLCBjciwgdHlwZSkgewogICAgY2xvc2VNb2RhbCgpOwogICAgZ2VuZXJhdGVMb290KGNyLCB0eXBlLCBuYW1lKTsKfQoKLy8gLS0tIEJPVMONTiAtLS0KZnVuY3Rpb24gZ2VuZXJhdGVMb290KGNyU3RyLCB0eXBlLCBtb25zdGVyTmFtZSA9ICdUZXNvcm8nKSB7CiAgICBjb25zdCBjciA9IGV2YWwoY3JTdHIpIHx8IDE7CiAgICBjb25zdCBpc05hdHVyZSA9IFsnYmVhc3QnLCAnbW9uc3Ryb3NpdHknLCAncGxhbnQnLCAnb296ZSddLmluY2x1ZGVzKHR5cGUudG9Mb3dlckNhc2UoKSk7CiAgICAKICAgIGxldCBjb2lucyA9IHsgY3A6MCwgc3A6MCwgZXA6MCwgZ3A6MCwgcHA6MCB9OwogICAgbGV0IGl0ZW1zID0gW107CgogICAgaWYgKGlzTmF0dXJlKSB7CiAgICAgICAgaXRlbXMucHVzaCh7IG5hbWU6IGBQaWVsIGRlICR7bW9uc3Rlck5hbWV9YCwgd2VpZ2h0OiA1LCB2YWw6IE1hdGguZmxvb3IoY3IgKiA1KSB9KTsKICAgICAgICBpdGVtcy5wdXNoKHsgbmFtZTogYEdsX8OhbmR1bGEvUmVzdG9zIGRlICR7bW9uc3Rlck5hbWV9YCwgd2VpZ2h0OiAxLCB2YWw6IE1hdGguZmxvb3IoY3IgKiAyKSB9KTsKICAgIH0gZWxzZSB7CiAgICAgICAgY29pbnMuY3AgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAgKiBjcnIpOwogICAgICAgIGNvbnlucy5zcCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDUwICogY3IpOwogICAgICAgIGNvaW5zLmdwID0gTWF0aC5mbG9vcigoTWF0aC5yYW5kb20oKSAqIDIwICsgMTApICogY3IpOwogICAgICAgIGlmIChjciA+PSA1KSBjb2lucy5wcCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDUgKiBjcnIpOwogICAgfQoKICAgIGxhc3RHZW5lcmF0ZWRMb290ID0geyBjb2lucywgaXRlbXMgfTsKCiAgICBsZXQgY29pkhRtbCA9IE9iamVjdC5lbnRyaWVzKGNvaW5zKS5maWx0ZXIoKFtfLCB2XSkgPT4gdiA+IDApLm1hcCgoW2ssIHZdKSA9PiBgPHNwYW4gY2xhc3M9ImNvaW4tJHtrfSI+JHt2fSRre3N9PC9zcGFuPmApLmpvaW4oJyAnKTsKICAgIAogICAgb3Blbk1vZGFsKGAKICAgICAgICA8aDIgY2xhc3M9ImNpbnplbCI+JHtpc05hdHVyZSA/ICdSZXN0b3MgTmF0dXJhbGVzJyA6ICdDb2ZyZSBIYWxsYWRvJ308L2gyPgogICAgICAgIDxkaXYgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyOyBtYXJnaW4tYm90dG9tOjIwcHg7Ij4KICAgICAgICAgICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjEuNHJlbTsgY29sb3I6dmFyKC0tZ29sZCk7Ij4ke2NvaW5IdG1sfTwvZGl2PgogICAgICAgICAgICAke2l0ZW1zLm1hcChpdCA9PiBgPGRpdiBzdHlsZT0iZm9udC1zaXplOjAuOXJlbTsiPuKAoiAke2l0Lm5hbWV9ICgke2l0LnZhbH1ncCk8L2Rpdj5gKS5qb2luKCcnKX0KICAgICAgICA8L2Rpdj4KICAgICAgICA8ZGl2IGlkPSJsb290LWFzc2lnbi1hcmVhIj4KICAgICAgICAgICAgPGxhYmVsIHN0eWxlPSJmb250LXNpemU6MC44cmVtOyI+UkVQQVJUSVIgRU5UUkU6PC9sYWJlbD4KICAgICAgICAgICAgPHNlbGVjdCBpZD0ibG9vdC10YXJnZXQiIHN0eWxlPSJtYXJnaW4tYm90dG9tOjE1cHg7Ij4KICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9ImFsbCI+VG9kYSBsYSBQYXJ0eSAoRGl2aXNpw7NuKTwvb3B0aW9uPgogICAgICAgICAgICAgICAgJHtjYW1wLnBhcnR5Lm1hcChwID0+IGA8b3B0aW9uIHZhbHVlPSIke3AuaWR9Ij4ke3AubmFtZX08L29wdGlvbj5gKS5qb2luKCcnKX0KICAgICAgICAgICAgPC9zZWxlY3Q+CiAgICAgICAgICAgIDxidXR0b24gb25jbGljaz0id2luZG93LmV4ZWN1dGVMb290QXNzaWduKCkiIGNsYXNzPSJidG4tcHJpbWFyeSI+Q09ORklSTUFSIFJFU0FSVE88L2J1dHRvbj4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICBgKTsKfQoKZnVuY3Rpb24gZXhlY3V0ZUxvb3RBc3NpZ24oKSB7CiAgICBpZiAoIWxhc3RHZW5lcmF0ZWRMb290KSByZXR1cm47CiAgICBjb25zdCB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9vdC10YXJnZXQnKS52YWx1ZTsKICAgIGNvbnN0IGNhbXAgPSBjYW1wYWlnbnMuZmluZChjID0+IGMuaWQgPT09IGN1cnJlbnRDYW1wYWlnbklkKTsKICAgIGNvbnN0IHsgY29pbnMsIGl0ZW1zIH0gPSBsYXN0R2VuZXJhdGVkTG9vdDsKCiAgICBpZiAodGFyZ2V0ID09PSAnYWxsJykgewogICAgICAgIGNvbnN0IHBDb3VudCA9IGNhbXAubmFydHkubGVuZ3RoIHx8IDE7CiAgICAgICAgY2FtcC5wYXJ0eS5mb3JFYWNoKHAgPT4gewogICAgICAgICAgICBPYmplY3Qua2V5cyhjb2lucykuZm9yRWFjaChrID0+IHsKICAgICAgICAgICAgICAgIGNvbnN0IHNoYXJlID0gTWF0aC5mbG9vcihjb2luc1trXSAvIHBDb3VudCk7CiAgICAgICAgICAgICAgICBpZiAoc2hhcmUgPiAwKSBwLndhbGxldFtrXSA9IChwLndhbGxldFtrXSB8fCAwKSArIHNoYXJlOwogICAgICAgICAgICB9KTsKICAgICAgICAgICAgaXRlbXMuZm9yRWFjaChpdCA9PiBwLmludmVudG9yeS5wdXNoKHsuLi5pdH0pKTsKICAgICAgICB9KTsKICAgIH0gZWxzZSB7CiAgICAgICAgY29uc3QgcCA9IGNhbXAubmFydHkuZmluZChoID0+IGguaWQgPT0gdGFyZ2V0KTsKICAgICAgICBPYmplY3Qua2V5cyhjb2lucykuZm9yRWFjaChrID0+IHsKICAgICAgICAgICAgcC53YWxsZXRba10gPSAocC53YWxsZXRba10gfHwgMCkgKyBjb2luc1trXTsKICAgICAgICB9KTsKICAgICAgICBpdGVtcy5mb3JFYWNoKGl0ID0+IHAuaW52ZW50b3J5LnB1c2goey4uLml0fSkpOwogICAgfQoKICAgIHNhdmVBbGwoKTsgcmVuZGVyUGFydHkoKTsgcmVuZGVyTWFzdGVyRXllKCk7IGNsb3NlTW9kYWwoKTsKfQoKLy8gLS0tIFJJVFVBTCAtLS0KbGV0IGN1cnJlbnRSaXR1YWxSb2xscyA9IFtdOwpsZXQgaXNSZWRlbXB0aW9uTW9kZSA9IGZhbHNlOwoKZnVuY3Rpb24gcm9sbEZvckxpbWl0KCkgewogICAgY29uc3RydWN0b3JSaXR1YWxSb2xscyA9IFtdOwogICAgaXNSZWRlbXB0aW9uTW9kZSA9IGZhbHNlOwoKICAgIG9wZW5EaWNlTW9kYWwoKTsKfQoKZnVuY3Rpb24gb3BlbkRpY2VNb2RhbCgpIHsKICAgIG9wZW5Nb2RhbChgCiAgICAgICAgPGRpdiBjbGFzcz0iZGljZS1yaXR1YWwtYXJlYSI+CiAgICAgICAgICAgIDxoMiBjbGFzcz0iY2luemVsIj5SaXR1YWwgZGUgQXNjZW5zbzwvaDI+CiAgICAgICAgICAgIDxkaXYgaWQ9InJpdHVhbC1tc2ctY29udGFpbmVyIiBjbGFzcz0icml0dWFsLW1zZy1hcmVhIiBvbmNsaWNrPSJ3aW5kb3cuY2hlY2tSZWRlbXB0aW9uQ2xpY2soKSI+CiAgICAgICAgICAgICAgICA8cCBpZD0icml0dWFsLW1zZyIgc3R5bGU9Im1hcmdpbjowOyI+VG9jYSBlbCBkYWRvIHBhcmEgdHUgMcKqIHRpcmFkYTwvcD4KICAgICAgICAgICAgPC9kaXY+CiAgICAgIC2PGRpdiBpZD0idmlzdWFsLWRpZSIgY2xhc3M9ImQyMC12aXN1YWwiIG9uY2xpY2s9IndpbmRvdy5leGVjdXRlUml0dWFsU3RlcCgpIiBzdHlsZT0iY29sb3I6dmFyKC0tZ29sZCk7Ij4KICAgICAgICAgICAgICAgIDxpIGNsYXNzPSJmYS1zb2xpZCBmYS1kaWNlLWQyMCI+PC9pPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0icm9sbC1oaXN0b3J5IiBpZD0icml0dWFsLWhpc3RvcnkiPgogICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0icm9sbC1kb3QiPj88L2Rpdj4KICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9InJvbGwtZG90Ij4/PC9kaXY+CiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJyb2xsLWRvdCI+PzwvZGl2PgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgIGApOwp9CgoKLy8gLS0tIFBFUlNPTkFKRVMgLS0tCmZ1bmN0aW9uIHJlbmRlclBhcnR5KCkgewogICAgY29uc3QgY2FtcCA9IGNhbXBhaWducy5maW5kKGMgPT4gYy5pZCA9PT0gY3VycmVudENhbXBhaWduSWQpOwogICAgaWYgKCFjYW1wKSByZXR1cm47CiAgICBjb25zdCByZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2hhcmFjdGVyLWxpc3QnKTsKICAgIAogICAgcmVzLmlubmVySFRNTCA9IChjYW1wLnBhcnR5IHx8IFtdKS5tYXAoYyA9PiBgCiAgICAgICAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi1ib3R0b206MTVweDsgcGFkZGluZzoxNXB4OyBib3JkZXItbGVmdDogM3B4IHNvbGlkIHZhcigtLWdvbGQpOyI+CiAgICAgICAgICAgIDxkaXYgb25jbGljaz0id2luZG93LnRvZ2dsZUludmVudG9yeSgnJHtjLmlkfScpIiBzdHlsZT0iZGlzcGxheTpmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjsgYWxpZ24taXRlbXM6c3RhcnQ7IGN1cnNvcjpwb2ludGVyOyI+CiAgICAgICAgICAgICAgICA8ZGl2PgogICAgICAgICAgICAgICAgICAgIDxoMyBzdHlsZT0ibWFyZ2luOjA7IGZvbnQtc2l6ZToxLjJyZW07Ij4ke2MubmFtZX08L2gzPgogICAgICAgICAgICAgICAgICAgIDxwIHN0eWxlPSJtYXJnaW46MDsgZm9udC1zaXplOjAuNzVyZW07IGNvbG9yOiM4ODg7Ij5BdmVudHVyZXJvIOKAoiBOaXZlbCAxPC9wPgogICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNvaW4tZ3JpZCIgc3R5bGU9IndpZHRoOjIwMHB4OyBtYXJnaW4tdG9wOjEwcHg7Ij4KICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9ImNvaW4tY3AiPiR7Yy53YWxsZXQuY3B9Yzwvc3Bhbj4KICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgIGDsCn0KCmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0KTs=
