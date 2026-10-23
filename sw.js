const CACHE_NAME = 'kstw-mensa-v71';
const STATIC_ASSETS = [
  './',
  './index.html',
  './theme-init.js',
  './app.js',
  './manifest.json',
  './kstw-logo.png',
  './fonts.css',
  './fonts/hanken-grotesk-latin.woff2',
  './fonts/hanken-grotesk-latin-ext.woff2',
  './styles.css',
  './data/config.js',
  './data/announcements.json',
  './data/icons.js',
  './data/canteens.js',
  './data/translations.js',
  './data/allergens.js',
  './src/lib/dish.js',
  './src/lib/diet.js',
  './src/lib/allergens.js',
  './src/lib/html.js',
  './src/lib/dates.js',
  './src/lib/lifecycle.js',
  './src/lib/storage.js',
  './src/lib/validation.js',
  './src/lib/canteen-match.js',
  './src/lib/hours.js',
  './src/lib/a11y.js',
  './src/lib/stats.js',
  './src/lib/logger.js',
  './src/lib/filters.js',
  './src/ui/icons.js',
  './src/ui/toast.js',
  './src/ui/tray-calendar.js',
  './src/ui/cards.js',
  './src/ui/feed.js',
  './src/ui/modals.js',
  './src/ui/stats-modal.js',
  './src/ui/settings.js',
  './src/ui/sw-update.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install Service Worker and cache static shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachePromises = STATIC_ASSETS.map(async (asset) => {
        const cleanRequest = asset instanceof Request ? asset : new Request(asset);

        // Apply cache busting to local assets (same origin) during install
        let fetchRequest = cleanRequest;
        const isLocal = cleanRequest.url.includes(self.location.origin);

        if (isLocal) {
          const separator = cleanRequest.url.includes('?') ? '&' : '?';
          const cacheBustUrl = cleanRequest.url + separator + '_cb=' + Date.now();
          fetchRequest = new Request(cacheBustUrl, {
            method: cleanRequest.method,
            headers: cleanRequest.headers,
            mode: cleanRequest.mode === 'navigate' ? 'cors' : cleanRequest.mode,
            credentials: cleanRequest.credentials,
            redirect: cleanRequest.redirect
          });
        }

        const response = await fetch(fetchRequest);
        if (response.ok || response.type === 'opaque') {
          await cache.put(cleanRequest, response);
        } else {
          throw new Error(`Failed to cache ${cleanRequest.url} - status ${response.status}`);
        }
      });

      await Promise.all(cachePromises);
    })
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Interceptor
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // Strategy 1: Dynamic configuration, announcements & all-time stats -> Network-First with canonical Cache-Fallback
  if (
    pathname.endsWith('data/config.js') ||
    pathname.endsWith('data/announcements.json') ||
    pathname.endsWith('data/stats_all_time.json')
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cleanUrl = new URL(event.request.url);
        cleanUrl.search = '';
        const canonicalKey = cleanUrl.toString();

        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), 2500);
        try {
          const response = await fetch(event.request, {
            cache: 'no-store',
            signal: controller.signal
          });
          clearTimeout(timerId);
          if (response.ok) {
            await cache.put(canonicalKey, response.clone());
          }
          return response;
        } catch (err) {
          clearTimeout(timerId);
          const cached = await cache.match(canonicalKey, { ignoreSearch: true });
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  // Strategy 2: Static App Shell Assets -> Cache-First
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request);
    })
  );
});

// Message listener to trigger skipWaiting manually when requested by the client app
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
