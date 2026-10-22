// Offline support. App files are network-first, so a new deploy shows up on the next launch,
// with the cached copy used when there's no connection. Speech you've already heard is
// cache-first: it never changes for the same text and speed.

const VERSION = 'greek-v5';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'config.js', 'translate.js', 'phrasebook.js', 'translit.js',
  'speech.js', 'dictation.js', 'library.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png',
];
const AUDIO = 'greek-audio-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION && key !== AUDIO) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.endsWith('/api/tts') && !url.searchParams.has('w')) {
    e.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch {
      return (await caches.match(req, { ignoreSearch: true })) || Response.error();
    }
  })());
});
