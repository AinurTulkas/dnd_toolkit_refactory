let campaigns = JSON.parse(localStorage.getItem("dnd_campaigns")) || [];
let currentCampaignId = localStorage.getItem("dnd_current_campaign") || null;
let useXP = true;

function saveAll() {
    localStorage.setItem("dnd_campaigns", JSON.stringify(campaigns));
    localStorage.setItem("dnd_current_campaign", currentCampaignId || "");
}

function openModal(html) {
    const overlay = document.getElementById("modal-overlay");
    const body = document.getElementById("modal-body");
    if (overlay && body) { body.innerHTML = html; overlay.style.display = "flex"; }
}

function closeModal() { 
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.style.display = "none"; 
}

function toggleXP(val) {
    useXP = val;
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (camp) camp.useXP = val;
    saveAll();
    renderParty();
}

function levelUp(charId) {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    if (char) { char.level = (char.level || 1) + 1; saveAll(); renderParty(); }
}

function levelUpAll() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (camp && camp.party) {
        camp.party.forEach(p => p.level = (p.level || 1) + 1);
        saveAll(); renderParty();
    }
}

function openAwardSeal(charId) {
    let h = "<h2>Otorgar Insignia</h2><input type='text' id='seal-name' placeholder='Hito'>";
    h += "<div style='display:flex;gap:10px;margin:15px 0;'>";
    h += "<i class='fa-solid fa-dragon' style='font-size:1.5rem;' onclick='window.saveSeal(\""+charId+"\", \"fa-dragon\")'></i>";
    h += "<i class='fa-solid fa-skull' style='font-size:1.5rem;' onclick='window.saveSeal(\""+charId+"\", \"fa-skull\")'></i>";
    h += "</div>";
    openModal(h);
}

function saveSeal(charId, icon) {
    const name = document.getElementById("seal-name").value || "Hito";
    const camp = campaigns.find(c => c.id === currentCampaignId);
    const char = camp.party.find(p => p.id == charId);
    if (char) {
        if (!char.seals) char.seals = [];
        char.seals.push({ name, icon });
        saveAll(); closeModal(); renderParty();
    }
}

function init() {
    renderLobby();
    if (currentCampaignId) selectCampaign(currentCampaignId);
}

function renderLobby() {
    const container = document.getElementById("lobby-overlay");
    if (!container) return;
    container.innerHTML = "<h1>GRIMOIRE PRO</h1><div class='card'><h2>Campañas</h2><div id='list'></div><button onclick='window.addCamp()' class='btn-primary'>NUEVA</button></div>";
    const list = document.getElementById("list");
    list.innerHTML = campaigns.map(c => "<div onclick='window.selectCampaign(\""+c.id+"\")' class='campaign-item'>" + c.name + "</div>").join("");
    container.style.display = "block";
}

function addCamp() {
    const name = prompt("Nombre:");
    if (name) { campaigns.push({id: \"c\"+Date.now(), name, party: []}); saveAll(); renderLobby(); }
}

function selectCampaign(id) {
    const camp = campaigns.find(c => c.id === id);
    if (!camp) return;
    currentCampaignId = id;
    useXP = camp.useXP !== undefined ? camp.useXP : true;
    saveAll();
    document.getElementById("lobby-overlay").style.display = "none";
    document.getElementById("campaign-title").innerText = camp.name;
    renderParty();
    showTab("tab-home");
}

function showTab(t) {
    document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
    const target = document.getElementById(t);
    if (target) target.style.display = "block";
}

function renderParty() {
    const camp = campaigns.find(c => c.id === currentCampaignId);
    if (!camp) return;
    const res = document.getElementById("character-list");
    res.innerHTML = (camp.party || []).map(p => 
        "<div class='card'><h3>" + p.name + "</h3><p>LVL " + (p.level || 1) + "</p>" +
        "<button onclick='window.openAwardSeal(\""+p.id+"\")'>Sello</button></div>").join("");
}

function showCharForm() {
    const name = prompt("Héroe:");
    if (name) {
        const camp = campaigns.find(c => c.id === currentCampaignId);
        camp.party.push({id: \"p\"+Date.now(), name, level: 1, seals: [], wallet: {cp:0, sp:0, gp:0, pp:0}});
        saveAll(); renderParty();
    }
}

function exitToLobby() { currentCampaignId = null; saveAll(); location.reload(); }

document.addEventListener("DOMContentLoaded", init);
window.showTab = showTab;
window.selectCampaign = selectCampaign;
window.addCamp = addCamp;
window.toggleXP = toggleXP;
window.levelUp = levelUp;
window.levelUpAll = levelUpAll;
window.openAwardSeal = openAwardSeal;
window.saveSeal = saveSeal;
window.showCharForm = showCharForm;
window.exitToLobby = exitToLobby;