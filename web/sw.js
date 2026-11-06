// Offline support: network first (so updates arrive), cache as fallback.
const CACHE = 'bmc-v21';
const ASSETS = [
  './', 'index.html', 'review.html', 'review.css', 'review-page.js', 'style.css', 'data.js', 'practice.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg', 'fonts/asap-latin.woff2',
  '../src/graph.js', '../src/generator.js', '../src/reach.js', '../src/sketch.js', '../src/motion.js', '../src/map.js', '../src/share.js', '../src/review.js', '../src/mirror.js',
  'ui/dom.js', 'ui/state.js', 'ui/strip.js', 'ui/panel.js', 'ui/map-panel.js', 'ui/reference.js', 'ui/my-moves.js', 'ui/layout.js', 'ui/movie.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && new URL(event.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })));
});
