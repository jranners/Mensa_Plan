const CACHE_NAME = 'kstw-mensa-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './kstw-logo.png',
  'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
  'https://cdn.tailwindcss.com?plugins=forms,container-queries'
];

// Install Service Worker and cache static shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching App Shell...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
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
  const requestUrl = new URL(event.request.url);

  // Dynamic Cache for Supabase API requests: Network-First, fallback to Cache
  if (requestUrl.pathname.includes('/rpc/public_get_week_menu')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response and cache it
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network failed, serve from cache
          console.log('Service Worker: Offline - Serving menu from cache...');
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-First strategy for static assets
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then(response => {
          // Cache new static assets dynamically (e.g. dynamic Google Fonts assets)
          if (event.request.method === 'GET' && (
            event.request.url.includes('gstatic.com') || 
            event.request.url.includes('fonts.googleapis.com')
          )) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});
