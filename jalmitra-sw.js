const CORE_CACHE_NAME = 'jalmitra-core-assets-v1';
const ADVISORY_CACHE_NAME = 'jalmitra-advisory-data-v1';
const ADVISORY_ENDPOINT = '/advisory-cache/latest-advisory.json';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignore individual asset failure in dev mode
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CORE_CACHE_NAME && key !== ADVISORY_CACHE_NAME && !key.includes('workbox')) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      ),
    ])
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_ADVISORY_SNAPSHOT' && event.data.payload) {
    const jsonString = JSON.stringify(event.data.payload);
    event.waitUntil(
      caches.open(ADVISORY_CACHE_NAME).then((cache) =>
        cache.put(
          ADVISORY_ENDPOINT,
          new Response(jsonString, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-JalMitra-SW-Cached': 'true',
            },
          })
        )
      )
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Serve cached advisory data for offline or intermittent rural connectivity
  if (url.pathname.startsWith('/advisory-cache/')) {
    event.respondWith(
      caches.open(ADVISORY_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        try {
          const networkResp = await fetch(request);
          if (networkResp && networkResp.status === 200) {
            cache.put(request, networkResp.clone());
            return networkResp;
          }
        } catch {
          // Network unavailable; return cached advisory JSON
        }
        return (
          cached ||
          new Response(JSON.stringify({ status: 'empty-cache' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      })
    );
    return;
  }

  // Don't intercept API calls or Vite dev internals
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/@') || url.pathname.includes('node_modules')) {
    return;
  }

  // Cache-first with background refresh (Stale-While-Revalidate) for static assets & fonts
  const isStaticAsset =
    url.pathname.match(/\.(js|css|html|png|jpg|jpeg|svg|ico|woff|woff2|webp)$/i) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CORE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
