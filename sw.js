const CACHE_NAME = 'dnd-toolkit-v2'; // Incrementado a v2 para forzar actualización
const assetsToCache = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './data/srd_data.json'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Forzar a que el nuevo SW tome el control inmediatamente
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(assetsToCache))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // Limpiar versiones viejas
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});