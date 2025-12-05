/**
 * Kai PWA Service Worker
 * Version 2.0.0
 */

const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `kai-v${CACHE_VERSION}`;

// Core files to cache for offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './assets/styles.css',
  './app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  // Core modules
  './src/core/api.js',
  './src/core/state.js',
  './src/core/storage.js',
  './src/core/shortcuts.js',
  './src/core/attachments.js',
  './src/core/ios-viewport.js',
  // UI modules
  './src/ui/chat.js',
  './src/ui/sidebar.js',
  './src/ui/settings.js',
  './src/ui/memory.js',
  './src/ui/toast.js',
  './src/ui/components.js',
  './src/ui/markdown.js',
  // Models
  './src/models/message.js',
  './src/models/conversation.js',
  './src/models/settings.js',
  // Agent
  './src/agent/agent-mode.js',
  './src/agent/agent-mode.css',
  // Utils
  './src/utils/dom.js',
  './src/utils/format.js'
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
          .filter((cacheName) => cacheName.startsWith('kai-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip chrome-extension and other unsupported schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

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
                .then((cache) => cache.put(request, responseClone))
                .catch((err) => console.warn('Cache put failed:', err));
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
