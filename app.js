// --- ESTADO Y CONFIGURACIÓN ---
let party = JSON.parse(localStorage.getItem('dnd_party')) || [];
let bulletinBoard = JSON.parse(localStorage.getItem('dnd_bulletin')) || [
    { id: 1, host: "Master Aris", title: "La Mina Perdida", level: "1-3", players: 2, maxPlayers: 5, description: "Busco guerreros valientes para exploración clásica." },
];
let chats = JSON.parse(localStorage.getItem('dnd_chats')) || {};
let appConfig = JSON.parse(localStorage.getItem('dnd_config')) || {
    survival: true, trade: true, community: true, dungeon: true, combat: true, loot: true
};
let allSrdMonsters = [];
let combatants = [];
let currentTurnIndex = 0;
let lastGeneratedLoot = null;
let selectedPlayerIndex = null;

// --- SEGURIDAD Y CHAT ---
function filterMessage(text) {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.(com|net|org|edu|gov|io|sh))/gi;
    return text.replace(urlRegex, "[ENLACE BLOQUEADO]");
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    const sender = party[0] ? party[0].name : "Aventurero";
    const tableId = "global"; // Simplificado
    if (!chats[tableId]) chats[tableId] = [];
    chats[tableId].push({ sender, text: filterMessage(text), time: new Date().toLocaleTimeString() });
    input.value = '';
    saveState();
    renderMessages();
}

function renderMessages() {
    const list = document.getElementById('chat-messages');
    const msgs = chats["global"] || [];
    list.innerHTML = msgs.map(m => `<div><strong>${m.sender}</strong>: ${m.text}</div>`).join('');
}

// --- MODULARIDAD ---
function toggleModule(m) {
    appConfig[m] = !appConfig[m];
    saveState();
    renderNavigation();
}

function renderNavigation() {
    const nav = document.getElementById('main-nav');
    nav.innerHTML = `
        <button onclick="showTab('tab-home')">🏠<br>Inicio</button>
        ${appConfig.combat ? `<button onclick="showTab('tab-combat')">⚔️<br>Tablero</button>` : ''}
        ${appConfig.loot ? `<button onclick="showTab('tab-loot')">💰<br>Loot</button>` : ''}
        ${appConfig.survival ? `<button onclick="showTab('tab-survival')">🏕️<br>Viaje</button>` : ''}
        ${appConfig.trade ? `<button onclick="showTab('tab-shop')">🛒<br>Bazar</button>` : ''}
        ${appConfig.community ? `<button onclick="showTab('tab-bulletin')">📢<br>Comunidad</button>` : ''}
        <button onclick="showTab('tab-party')">👥<br>Héroes</button>
    `;
    renderConfigToggles();
}

function renderConfigToggles() {
    const container = document.getElementById('config-panel');
    if(!container) return;
    const modules = [
        { id: 'combat', label: 'Combate', icon: '⚔️' },
        { id: 'loot', label: 'Loot', icon: '💰' },
        { id: 'survival', label: 'Viaje', icon: '🏕️' },
        { id: 'trade', label: 'Bazar', icon: '🛒' },
        { id: 'community', label: 'Comunidad', icon: '📢' },
        { id: 'dungeon', label: 'Mazmorra', icon: '🏰' }
    ];
    container.innerHTML = modules.map(m => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px; padding:10px; background:white; border-radius:8px;">
            <span>${m.icon} ${m.label}</span>
            <input type="checkbox" ${appConfig[m.id] ? 'checked' : ''} onchange="toggleModule('${m.id}')">
        </div>
    `).join('');
}

// --- PERSISTENCIA ---
function saveState() {
    localStorage.setItem('dnd_party', JSON.stringify(party));
    localStorage.setItem('dnd_config', JSON.stringify(appConfig));
    localStorage.setItem('dnd_chats', JSON.stringify(chats));
}

// --- NAVEGACIÓN ---
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    if(tabId === 'tab-party') renderParty();
    if(tabId === 'tab-chat') renderMessages();
}

// --- INICIO ---
document.addEventListener('DOMContentLoaded', () => {
    renderNavigation();
    showTab('tab-home');
});

window.showTab = showTab;
window.toggleModule = toggleModule;
window.sendMessage = sendMessage;