const cacheName = 'pilantras-v1';
const assets = ['./', './index.html']; // Adicione style.css e script.js se estiverem separados

self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});