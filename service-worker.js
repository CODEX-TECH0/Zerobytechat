// zerøbyte Service Worker - FIXED VERSION
// Version: 2.0.0

const CACHE_NAME = 'zerobyte-v2.0.0';
const OFFLINE_URL = '/offline.html';

// ONLY cache these files (NO authenticated pages)
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// DO NOT cache these pages (they need authentication)
const SKIP_CACHE = [
  '/home.html',
  '/chat.html',
  '/profile.html',
  '/search.html',
  '/admin/'
];

// Install - cache only public files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching public files...');
        return cache.addAll(urlsToCache);
      })
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
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - NEVER cache authenticated pages
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Skip Supabase API calls
  if (requestUrl.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Check if this is an authenticated page that should NOT be cached
  const shouldSkipCache = SKIP_CACHE.some(path => 
    requestUrl.pathname.includes(path) || 
    requestUrl.pathname === '/home.html' ||
    requestUrl.pathname === '/chat.html' ||
    requestUrl.pathname === '/profile.html' ||
    requestUrl.pathname === '/search.html'
  );
  
  // For authenticated pages - NEVER serve from cache
  if (shouldSkipCache) {
    console.log('[Service Worker] Skipping cache for:', requestUrl.pathname);
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For public pages (index, login, signup) - try network first, then cache
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful response for public pages
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) return cachedResponse;
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // For assets (CSS, JS, fonts) - cache first then network
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
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New message from zerøbyte',
      icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"%3E%3Crect width="192" height="192" rx="40" fill="%237c3aed"/%3E%3Ctext x="96" y="130" font-size="75" text-anchor="middle" fill="white" font-weight="bold"%3EZB%3C/text%3E%3C/svg%3E',
      badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"%3E%3Crect width="72" height="72" rx="15" fill="%237c3aed"/%3E%3Ctext x="36" y="50" font-size="28" text-anchor="middle" fill="white"%3EZB%3C/text%3E%3C/svg%3E',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/home.html' }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'zerøbyte', options)
    );
  } catch (error) {
    console.log('[Service Worker] Push error:', error);
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/home.html';
  event.waitUntil(
    clients.openWindow(urlToOpen)
  );
});
