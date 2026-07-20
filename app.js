// --- ESTADO GLOBAL ---
let campaigns = JSON.parse(localStorage.getItem('dnd_campaigns')) || [];
let globalNotices = JSON.parse(localStorage.getItem('dnd_global_notices')) || [];
let currentCampaignId = localStorage.getItem('dnd_current_campaign') || null;
let currentRole = localStorage.getItem('dnd_role') || 'master';

let party = [];
let appConfig = { combat: true, loot: true, community: true };
let srdData = { classes: [], races: [], genders: ["Masculino", "Femenino", "No binario"], monsters: [], weapons: [], armor: [], items: [] };
let diceTray = [];

const badWords = ["mierda", "puta", "joder", "cabron", "cojones"];

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
    localStorage.setItem('dnd_current_campaign', currentCampaignId || "");
    localStorage.setItem('dnd_role', currentRole);
}

function renderCampaignList() {
    const container = document.getElementById('campaign-list');
    if (!container) return;
    if (campaigns.length === 0) {
        container.innerHTML = '<p style="color:#666; padding: 20px; font-style:italic;">No hay campañas.</p>';
        return;
    }
    let html = "";
    campaigns.forEach(c => {
        html += '<div class="campaign-item">' +
            '<div class="campaign-info" onclick="selectCampaign(\'' + c.id + '\')">' +
                '<h3 style="font-family:\'Cinzel\'; color:var(--gold); margin:0;">' + c.name + '</h3>' +
                '<p style="font-size:0.9rem; color:#888; margin:5px 0 0;">' + (c.party || []).length + ' Héroes</p>' +
            '</div>' +
            '<div class="campaign-controls">' +
                '<button class="btn-mini" onclick="editCampaignName(\'' + c.id + '\')"><i class="fa-solid fa-pen"></i></button>' +
                '<button class="btn-mini btn-delete-camp" onclick="deleteCampaign(\'' + c.id + '\')"><i class="fa-solid fa-trash"></i></button>' +
            '</div>' +
        '</div>';
    });
    container.innerHTML = html;
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return exitToLobby();
    currentCampaignId = id;
    party = camp.party || [];
    appConfig = camp.config || { combat: true, loot: true, community: true };
    saveAll();
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('campaign-title-display').innerText = camp.name;
    applyRoleUI();
    renderNavigation();
    showTab('tab-home');
}

function exitToLobby() { currentCampaignId = null; saveAll(); location.reload(); }

function applyRoleUI() {
    const isM = currentRole === 'master';
    const ind = document.getElementById('current-role-text');
    if(ind) ind.innerText = isM ? 'DUNGEON MASTER' : 'AVENTURERO';
    const sel = document.getElementById('role-selector');
    if(sel) sel.value = currentRole;
    document.body.className = isM ? 'is-master' : 'is-adventurer';
}

function changeRole() {
    currentRole = document.getElementById('role-selector').value;
    saveAll(); applyRoleUI(); renderNavigation();
}

function showTab(t) {
    document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
    const target = document.getElementById(t);
    if(target) target.style.display = "block";
    if(t === "tab-party") renderParty();
}

async function loadSRDData() {
    try {
        const response = await fetch("data/srd_data.json");
        srdData = await response.json();
        const cls = document.getElementById("char-class"); 
        const rac = document.getElementById("char-race");
        if(cls && srdData.classes) cls.innerHTML = srdData.classes.map(c => "<option value=\""+c.name+"\">"+c.name+"</option>").join("");
        if(rac && srdData.races) rac.innerHTML = srdData.races.map(r => "<option value=\""+r.name+"\">"+r.name+"</option>").join("");
    } catch (e) { console.error("SRD Fail"); }
}

function renderParty() {
    const container = document.getElementById("character-list"); if(!container) return;
    if(party.length === 0) { container.innerHTML = "<p style=\"color:#666;text-align:center;padding:20px;\">Sin héroes.</p>"; return; }
    let html = "";
    party.forEach(c => {
        html += "<div class=\"char-card\"><h3>" + c.name + "</h3><p>" + c.race + " " + c.charClass + "</p></div>";
    });
    container.innerHTML = html;
}

function renderNavigation() {
    const nav = document.getElementById("main-nav"); if(!nav) return;
    const isM = currentRole === "master";
    nav.innerHTML = "<button onclick=\"showTab('tab-home')\">Inicio</button>" +
        (isM ? "<button onclick=\"showTab('tab-combat')\">Guerra</button>" : "") +
        "<button onclick=\"showTab('tab-community')\">Tablón</button>" +
        "<button onclick=\"showTab('tab-party')\">Gremio</button>";
}

document.addEventListener("DOMContentLoaded", () => {
    renderCampaignList();
    loadSRDData();
    if(currentCampaignId) selectCampaign(currentCampaignId);
});

window.selectCampaign = selectCampaign; window.exitToLobby = exitToLobby; window.changeRole = changeRole; window.showTab = showTab;