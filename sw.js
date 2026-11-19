/* Service worker: aplikacja i baza działają offline.
   Po aktualizacji data.json podbij numer w CACHE, żeby telefony pobrały nową bazę. */
const CACHE = 'kompas-v0.7';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'data.json', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/znaki/B-1.svg', 'icons/znaki/B-2.svg', 'icons/znaki/B-3.svg', 'icons/znaki/B-35.svg', 'icons/znaki/B-36.svg', 'icons/znaki/B-37.svg', 'icons/znaki/B-38.svg', 'icons/znaki/B-39.svg', 'icons/znaki/B-3a.svg', 'icons/znaki/B-4.svg', 'icons/znaki/B-41.svg', 'icons/znaki/B-6.svg', 'icons/znaki/B-7.svg', 'icons/znaki/C-13.svg', 'icons/znaki/C-16.svg', 'icons/znaki/D-18.svg', 'icons/znaki/D-18a.svg', 'icons/znaki/D-18b.svg', 'icons/znaki/D-19.svg', 'icons/znaki/P-17.svg', 'icons/znaki/P-18.svg', 'icons/znaki/P-19.svg', 'icons/znaki/P-20.svg', 'icons/znaki/P-21.svg', 'icons/znaki/P-24.svg', 'icons/znaki/T-29.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Baza: najpierw sieć (świeże dane), offline z pamięci. Reszta: najpierw pamięć.
  if (url.pathname.endsWith('data.json')) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  }
});
