// zerøbyte Service Worker
// Version: 1.0.0

const CACHE_NAME = 'zerobyte-v1.0.0';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/home.html',
  '/login.html',
  '/signup.html',
  '/chat.html',
  '/profile.html',
  '/search.html',
  '/offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install - cache files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - serve from cache or network
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (requestUrl.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) return cachedResponse;
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then(response => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          });
      })
  );
});

// Push notification handler
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" rx="40" fill="%237c3aed"/%3E%3Ctext x="96" y="130" font-size="75" text-anchor="middle" fill="white" font-weight="bold"%3EZB%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"%3E%3Crect width="72" height="72" rx="15" fill="%237c3aed"/%3E%3Ctext x="36" y="50" font-size="28" text-anchor="middle" fill="white"%3EZB%3C/text%3E%3C/svg%3E',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/home.html' }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/home.html')
  );
});

