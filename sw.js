const CACHE_NAME = 'kstw-mensa-v13';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './kstw-logo.png',
  'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&display=swap',
  new Request('https://cdn.tailwindcss.com/?plugins=forms,container-queries', { mode: 'no-cors' })
];

// Install Service Worker and cache static shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('Service Worker: Caching App Shell...');
      
      const cachePromises = STATIC_ASSETS.map(async asset => {
        try {
          const request = asset instanceof Request ? asset : new Request(asset);
          const response = await fetch(request);
          if (response.ok || response.type === 'opaque') {
            await cache.put(request, response);
          } else {
            console.warn(`Service Worker: Failed to cache ${request.url} - status ${response.status}`);
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
          if (cache !== CACHE_NAME) {
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
  // Only handle GET requests (static assets)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then(response => {
        // Cache new static assets dynamically (e.g. dynamic Google Fonts assets)
        if (event.request.url.includes('gstatic.com') || 
            event.request.url.includes('fonts.googleapis.com')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
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
