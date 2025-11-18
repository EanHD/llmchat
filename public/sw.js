/**
 * Service Worker for LLM Chat PWA
 * Cache-first for static assets, network-first for API calls
 */

const CACHE_VERSION = '1.0.1';
const CACHE_NAME = `llmchat-v${CACHE_VERSION}`;

// Use relative paths that work in subdirectories
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles.css',
  './app.js',
  './favicon.svg',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('llmchat-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network first
  if (url.pathname.startsWith('/v1/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request)
          .then((response) => {
            // Cache successful GET requests
            if (request.method === 'GET' && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
            }
            return response;
          });
      })
      .catch(() => {
        // Fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./index.html')
            .then(response => response || caches.match(self.registration.scope + 'index.html'));
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
