const CACHE_VERSION = 'v4';
let CACHE_NAME = `frostdex-${CACHE_VERSION}`;
let cacheNameInitialized = false;

/* Never serve these stale — always fetch fresh */
const NEVER_CACHE_PATHS = ['/', '/index.html', '/config.js', '/sw.js', '/manifest.json'];

/* Hashed bundles: /assets/xxx-AbCdEfGh.js — safe to cache forever */
const HASHED_ASSET_RE = /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|mjs|css)$/;

/* Fonts and images — cache-first, long-lived */
const STATIC_EXT_RE = /\.(woff2?|ttf|otf|eot|png|jpg|jpeg|svg|webp|ico|gif)$/i;

/* External hostnames to pass through untouched */
const PASSTHROUGH_HOSTS = new Set([
  'api.orderly.org',
  'api-evm.orderly.org',
  'testnet-api-evm.orderly.org',
  'ws.orderly.org',
  'wss.orderly.org',
  'static.orderly.org',
  'api.groq.com',
  'api.dexscreener.com',
  'api.coingecko.com',
  'cdn.jsdelivr.net',
]);

async function initCacheName() {
  if (cacheNameInitialized) return;
  try {
    const res = await fetch('/config.js', { cache: 'no-store' });
    const text = await res.text();
    const json = text
      .replace(/window\.__RUNTIME_CONFIG__\s*=\s*/, '')
      .replace(/;\s*$/, '')
      .trim();
    const cfg = JSON.parse(json);
    const broker = (cfg.VITE_ORDERLY_BROKER_ID || 'frostdex').replace(/[^a-z0-9-]/gi, '');
    CACHE_NAME = `${broker}-${CACHE_VERSION}`;
  } catch {
    /* keep default */
  }
  cacheNameInitialized = true;
}

/* ── install: pre-cache critical static assets ── */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    initCacheName().then(() =>
      caches.open(CACHE_NAME).then((cache) =>
        cache.addAll([
          '/fonts/Manrope/Manrope-Medium.ttf',
          '/fonts/Manrope/Manrope-SemiBold.ttf',
          '/fonts/Manrope/Manrope-Bold.ttf',
          '/favicon.webp',
          '/frostdex-logo.webp',
        ]).catch(() => { /* non-fatal: assets might not exist yet */ })
      )
    )
  );
});

/* ── activate: delete every old cache version ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── fetch ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  /* Only handle GET over HTTP(S) */
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  /* Pass through external APIs / CDNs untouched */
  if (PASSTHROUGH_HOSTS.has(url.hostname)) return;

  /* Skip SW/manifest requests */
  if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') return;

  /* ── Strategy A: Network-only (always fresh) ── */
  if (NEVER_CACHE_PATHS.includes(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || Promise.reject()))
    );
    return;
  }

  /* ── Strategy B: Cache-first for hashed JS/CSS (immutable) ── */
  if (HASHED_ASSET_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
            return res;
          });
        })
      )
    );
    return;
  }

  /* ── Strategy C: Cache-first for fonts & images ── */
  if (STATIC_EXT_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
            return res;
          }).catch(() => { throw new Error('offline'); });
        })
      )
    );
    return;
  }

  /* ── Strategy D: Network-only for everything else ──
     (TradingView scripts, locale JSON, non-hashed JS — never cache these
      to avoid serving stale code after a deploy) */
  /* default: no respondWith → browser handles natively */
});
