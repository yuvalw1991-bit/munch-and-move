// Service worker for "Munch & Move" — offline support + PWA installability.
// Strategy:
//   • navigations            → network-first, fall back to cached shell (offline launch)
//   • same-origin static      → cache-first (fonts, icons, css)
//   • cross-origin (CDN/SDK)  → stale-while-revalidate
//   • /api/* and non-GET      → always network (dynamic AI calls, Supabase writes)
// Bump CACHE when the shell asset list changes to evict the old cache.
const CACHE = 'munch-move-v24';  // v20 (v19 added the gym files): gym live mode (gym-*.js precached; bump ?v= in index.html AND here on every change)

const SHELL = [
  '/', '/index.html', '/manifest.json',
  '/gym-core.js?v=6', '/gym-ui.js?v=6', '/gym-views.js?v=6',
  '/vendor/zxing.min.js',                 // barcode decoder — precached so the first scan doesn't wait on the network
  '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
  '/fonts/Polin-Light.woff2', '/fonts/Polin-Regular.woff2', '/fonts/Polin-Medium.woff2',
  '/fonts/Polin-Semibold.woff2', '/fonts/Polin-Bold.woff2', '/fonts/Polin-Extrabold.woff2',
  '/fonts/Polin-Black.woff2',
];

// The shell itself is not optional: without it an offline launch has nothing to serve.
const SHELL_REQUIRED = ['/', '/index.html'];

// Last-resort answer so a navigation never resolves to undefined.
const OFFLINE_HTML = '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<body style="background:#06070d;color:#e5e7eb;font-family:sans-serif;padding:2rem;text-align:center">'
  + '<h1>אין חיבור</h1><p>נסי שוב כשהאינטרנט יחזור.</p></body></html>';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) =>
        Promise.all(SHELL_REQUIRED.map((u) => c.add(u)))
          // Don't let one missing font or icon abort the whole precache.
          .then(() => Promise.allSettled(
            SHELL.filter((u) => !SHELL_REQUIRED.includes(u)).map((u) => c.add(u))
          ))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // Drop the previous cache only once this one demonstrably holds the shell. A flaky
    // install used to leave an empty cache AND delete the good one, so the next offline
    // launch had nothing at all to fall back on.
    caches.open(CACHE)
      .then((c) => c.match('/index.html'))
      .then((hit) => (hit
        ? caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
        : null))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  // Only cache OK, basic/cors responses (skip opaque errors and partial 206).
  if (!response || response.status !== 200 || response.type === 'opaqueredirect') return;
  const copy = response.clone();
  caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
}

// ---- Web Push: user-defined reminders (מים/תרופה/תוסף...) ----
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'תזכורת', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '⏰ תזכורת', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    tag: d.tag || d.id || ('mm-' + Date.now()),   // per-reminder tag: a water reminder must not replace an unread meds one
    dir: 'rtl',
    lang: 'he',
    renotify: true,
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('/');
  }));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return; // API POSTs, Supabase writes — straight to network.

  const url = new URL(request.url);

  // Never intercept the serverless API — AI calls must always hit the network.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Never cache user-data APIs (Supabase). Caching these could serve stale/incorrect
  // account data. Always go straight to the network.
  if (/supabase\.(co|in)/.test(url.hostname) || url.hostname.endsWith('.supabase.co')) return;

  // The build check wants the truth from the server, never our own cached copy —
  // answering it cache-first compared the new build against what we already had, so a
  // deploy was invisible. Keyed on the query param, not on request.cache: that field
  // only exists from Safari 16.4, and on an older iPhone every check would otherwise
  // be stored under its unique ?_b= URL, growing the cache by ~500KB a time.
  if (url.searchParams.has('_b')) return;
  if (request.cache === 'no-store' || request.cache === 'reload') return;

  // App navigation: fresh-first so deploys show up, cached shell when offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => { putInCache(request, res); return res; })
        .catch(() => caches.match('/index.html')
          .then((hit) => hit || caches.match('/'))
          // respondWith(undefined) surfaces as a hard network error — always answer.
          .then((hit) => hit || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } })))
    );
    return;
  }

  // Same-origin static assets.
  if (url.origin === self.location.origin) {
    // CSS is network-first so style deploys show up immediately (fall back to cache offline).
    if (url.pathname.endsWith('.css')) {
      e.respondWith(
        fetch(request)
          .then((res) => { putInCache(request, res); return res; })
          .catch(() => caches.match(request))
      );
      return;
    }
    // Fonts / icons / other: cache-first (instant, rarely change).
    e.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => { putInCache(request, res); return res; })
      )
    );
    return;
  }

  // Cross-origin (Tailwind CDN, Supabase SDK, Google fonts): stale-while-revalidate.
  e.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request)
        .then((res) => { putInCache(request, res); return res; })
        .catch(() => hit);
      return hit || net;
    })
  );
});
