// Service Worker für betterKerf (Svelte-Version).
// Versionsnummer beim nächsten Build-Deploy erhöhen → Browser-Cache wird geleert.
const CACHE = 'betterkerf-v2';

// Shell-Dateien: werden beim Install vorgeladen (keine Hash-Suffix → bekannte Pfade).
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './jspdf.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' })
        .then(clients => clients.forEach(c => c.postMessage({ type: 'UPDATE' })))
      )
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (index.html): Netzwerk zuerst, Cache als Fallback.
  // Stellt sicher, dass neue Versionen schnell ankommen.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Alle anderen Assets: Cache zuerst, dann Netzwerk (und in Cache legen).
  // Gehashte Vite-Assets (index-xxx.js, index-xxx.css) sind de-facto unveränderlich.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
    })
  );
});
