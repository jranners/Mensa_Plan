const CACHE_NAME = 'kstw-mensa-v42';
const API_CACHE_NAME = 'kstw-api-v1';
const API_HOST = 'axxiebkvmfjmiaanviob.supabase.co';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './kstw-logo.png',
  './fonts.css',
  './fonts/hanken-grotesk-latin.woff2',
  './fonts/hanken-grotesk-latin-ext.woff2',
  './styles.css',
  './data/icons.js',
  './data/canteens.js',
  './data/translations.js',
  './data/allergens.js'
];

// Install Service Worker and cache static shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('Service Worker: Caching App Shell...');
      
      const cachePromises = STATIC_ASSETS.map(async asset => {
        try {
          const cleanRequest = asset instanceof Request ? asset : new Request(asset);
          
          // Only apply cache busting to local assets (same origin)
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
            console.warn(`Service Worker: Failed to cache ${cleanRequest.url} - status ${response.status}`);
          }
        } catch (err) {
          console.error(`Service Worker: Error caching asset:`, asset, err);
        }
      });
      
      await Promise.all(cachePromises);
      console.log('Service Worker: App Shell caching complete.');
    })
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== API_CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache...', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // Strategie 1: Dynamische Konfiguration & Ankündigungen → Network-First mit Cache-Fallback
  if (pathname.endsWith('data/config.js') || pathname.endsWith('data/announcements.json')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          // Frische Daten vom Netzwerk mit 2.5s Timeout laden
          const networkPromise = fetch(event.request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 2500)
          );
          const response = await Promise.race([networkPromise, timeoutPromise]);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (err) {
          // Fallback auf gecachte Version bei Offline / Timeout
          const cached = await cache.match(event.request, { ignoreSearch: true });
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  // Strategie A: API-Calls → Stale-While-Revalidate
  if (url.hostname === API_HOST) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request).then(response => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached); // Offline-Fallback: cached zurückgeben

        // Sofort cached zurückgeben (wenn vorhanden), Netz läuft im Hintergrund
        return cached || networkFetch;
      })
    );
    return;
  }

  // Strategie B: Statische Assets (App Shell) → Cache-First
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(response => {
        if (url.hostname.includes('gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});

// Message listener to trigger skipWaiting manually when requested by the client app
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
