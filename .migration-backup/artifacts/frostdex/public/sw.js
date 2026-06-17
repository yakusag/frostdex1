const CACHE_VERSION = 'v2';
const CACHE_NAME = `frostdex-${CACHE_VERSION}`;

const NEVER_CACHE = ['/', '/index.html', '/config.js', '/sw.js', '/manifest.json'];
const STATIC_EXTS = /\.(woff2?|png|jpg|jpeg|svg|webp|ico|css|gif)$/i;
const HASHED_CHUNK = /\/assets\/.*-[A-Za-z0-9_-]{8,}\.(js|mjs|css)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('frostdex-') && k !== CACHE_NAME || k.startsWith('orderly-dex-'))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  const path = url.pathname;

  if (NEVER_CACHE.some((p) => path === p || path.endsWith(p))) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (HASHED_CHUNK.test(path)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  if (STATIC_EXTS.test(path)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchFresh = fetch(request).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        });
        return cached || fetchFresh;
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
