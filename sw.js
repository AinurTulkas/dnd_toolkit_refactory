const CACHE_NAME = 'dnd-toolkit-v19';
const assetsToCache = ['./', './index.html', './styles.css', './app.js', './manifest.json'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(assetsToCache))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => k !== CACHE_NAME ? caches.delete(k) : null))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); });