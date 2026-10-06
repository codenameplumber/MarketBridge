/* ==========================================================================
   KonfluenX — SERVICE WORKER
   Makes the web app installable and usable offline. This is what "downloadable"
   means for a web app: the browser installs it to the home screen / desktop,
   and this worker keeps the shell available without a network.

   Strategy by resource kind:
     app shell (html/css/js)  -> stale-while-revalidate  (instant, self-healing)
     mock + api data          -> network-first           (freshness matters)
     images / fonts           -> cache-first             (immutable enough)

   NEVER cached: anything under /api/v1/trade, /api/v1/deriv, or any request
   carrying an Authorization header. Stale money is worse than no money.
   ========================================================================== */

const VERSION = 'kx-v3.0.0';
const SHELL_CACHE = VERSION + '-shell';
const DATA_CACHE  = VERSION + '-data';
const ASSET_CACHE = VERSION + '-asset';

/* Precached so the app opens offline on first launch after install. */
const PRECACHE = [
  './',
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/components.css',
  'assets/css/app.css',
  'assets/css/public.css',
  'assets/js/core/icons.js',
  'assets/js/core/util.js',
  'assets/js/core/api.js',
  'assets/js/core/ws.js',
  'assets/js/core/charts.js',
  'assets/js/core/shell.js',
  'assets/js/core/pwa.js',
  'users/index.html',
  'users/markets/index.html',
  'users/trade/index.html',
  'users/signals/index.html',
  'users/community/index.html'
];

/* Requests that must always hit the network and never be stored. */
const NEVER_CACHE = [/\/api\/v1\/trade/, /\/api\/v1\/deriv/, /\/api\/v1\/payments/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {
        /* One missing file must not abort the whole install. */
        return Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => null)));
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') { self.skipWaiting(); }
});

function isNeverCache(url) {
  return NEVER_CACHE.some((re) => re.test(url));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* Only GET is cacheable; everything else goes straight out. */
  if (req.method !== 'GET') { return; }

  const url = new URL(req.url);

  /* Cross-origin (Deriv WS handshake, fonts, CDNs) — leave alone. */
  if (url.origin !== self.location.origin) { return; }

  if (isNeverCache(url.pathname) || req.headers.get('Authorization')) {
    return;
  }

  /* ---- Navigations: network-first, offline page as the fallback ------- */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('offline.html')))
    );
    return;
  }

  /* ---- Data: network-first, cached copy when offline ------------------ */
  if (url.pathname.includes('/mock/') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  /* ---- Images and fonts: cache-first ---------------------------------- */
  if (/\.(png|jpg|jpeg|svg|webp|avif|woff2?|ttf)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  /* ---- Everything else (css/js): stale-while-revalidate ---------------- */
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

/* ==========================================================================
   PUSH — signal results and follows, wired in Phase 5
   ========================================================================== */
self.addEventListener('push', (event) => {
  if (!event.data) { return; }
  let payload = {};
  try { payload = event.data.json(); } catch (e) { payload = { title: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'KonfluenX', {
      body: payload.body || '',
      icon: 'assets/icons/icon-192.png',
      badge: 'assets/icons/icon-192.png',
      tag: payload.tag || 'mb',
      data: { url: payload.url || 'users/index.html' },
      vibrate: [40, 30, 40]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || 'users/index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(target); return client.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
