const CACHE_VERSION = 'v3';
let CACHE_NAME = `frostdex-dex-${CACHE_VERSION}`;
let cacheNameInitialized = false;

/* Assets that must NEVER be served stale */
const NEVER_CACHE = ['/', '/index.html', '/config.js', '/sw.js', '/manifest.json'];

/* Hashed asset pattern — these are content-addressed, safe to cache forever */
const HASHED_ASSET_RE = /\/assets\/.*-[A-Za-z0-9_-]{8,}\.(js|mjs|css)$/;

/* Static file extensions worth caching */
const STATIC_EXT_RE = /\.(woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico|gif)$/i;

/* External origins we should never intercept */
const EXTERNAL_PASSTHROUGH = [
  'api.orderly.org',
  'ws.orderly.org',
  'wss.orderly.org',
  'static.orderly.org',
  'api.groq.com',
  'api.dexscreener.com',
  'api.coingecko.com',
];

async function initCacheName() {
  if (cacheNameInitialized) return;
  try {
    const res = await fetch('/config.js');
    const text = await res.text();
    const json = text
      .replace(/window\.__RUNTIME_CONFIG__\s*=\s*/, '')
      .replace(/;\s*$/, '')
      .trim();
    const cfg = JSON.parse(json);
    const broker = cfg.VITE_ORDERLY_BROKER_ID || 'frostdex';
    CACHE_NAME = `${broker}-dex-${CACHE_VERSION}`;
  } catch {
    CACHE_NAME = `frostdex-dex-${CACHE_VERSION}`;
  }
  cacheNameInitialized = true;
}

/* ── install: take control immediately ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    initCacheName().then(() =>
      caches.open(CACHE_NAME).then((cache) =>
        cache.addAll([
          '/fonts/Manrope/Manrope-Medium.ttf',
          '/fonts/Manrope/Manrope-SemiBold.ttf',
          '/fonts/Manrope/Manrope-Bold.ttf',
          '/favicon.webp',
          '/frostdex-logo.webp',
        ]).catch(() => {})
      )
    )
  );
  self.skipWaiting();
});

/* ── activate: purge old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    initCacheName().then(() =>
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
    )
  );
  self.clients.claim();
});

/* ── fetch: three strategies ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  /* Pass through external API traffic untouched */
  if (EXTERNAL_PASSTHROUGH.includes(url.hostname)) return;

  /* Never intercept SW / manifest themselves */
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') return;

  /* Strategy 1 — Network-only for HTML + config (always fresh) */
  if (NEVER_CACHE.includes(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  /* Strategy 2 — Cache-first for hashed JS/CSS bundles (immutable) */
  if (HASHED_ASSET_RE.test(url.pathname)) {
    event.respondWith(
      initCacheName().then(() =>
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((res) => {
              if (res && res.status === 200 && res.type === 'basic') {
                cache.put(request, res.clone()).catch(() => {});
              }
              return res;
            });
          })
        )
      )
    );
    return;
  }

  /* Strategy 3 — Cache-first for fonts + images (long-lived) */
  if (STATIC_EXT_RE.test(url.pathname)) {
    event.respondWith(
      initCacheName().then(() =>
        caches.open(CACHE_NAME).then((cache) =>
          cache.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((res) => {
              if (res && res.status === 200 && res.type === 'basic') {
                cache.put(request, res.clone()).catch(() => {});
              }
              return res;
            }).catch(() => cached || Promise.reject(new Error('offline')));
          })
        )
      )
    );
    return;
  }

  /* Strategy 4 — Stale-while-revalidate for everything else (locales, etc.) */
  event.respondWith(
    initCacheName().then(() =>
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(request, res.clone()).catch(() => {});
            }
            return res;
          }).catch(() => null);

          return cached || fetchPromise;
        })
      )
    )
  );
});
