/**
 * Smart Health Care - Production Service Worker
 * Cross-platform PWA offline cache manager with strict healthcare data safety.
 *
 * SAFETY GUARANTEE:
 * Private patient records, telemetry feeds, WebSocket connections,
 * and authenticated medical APIs are NEVER cached in persistent storage.
 */

const CACHE_VERSION = 'smarthealth-v1.0.0';
const STATIC_CACHE = `smarthealth-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `smarthealth-runtime-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.svg',
];

// Helper to determine if a request must strictly bypass the cache
function shouldBypassCache(url, request) {
  // Non-GET requests must never be cached
  if (request.method !== 'GET') {
    return true;
  }

  // Non-HTTP/HTTPS schemes (e.g., chrome-extension://, blob://)
  if (!url.protocol.startsWith('http')) {
    return true;
  }

  const pathname = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  // Strict API & Medical Data bypass rules
  if (
    pathname.startsWith('/api/') ||
    pathname === '/patients' ||
    pathname.startsWith('/patients') ||
    pathname.startsWith('/predict') ||
    pathname.startsWith('/device') ||
    pathname.startsWith('/telemetry') ||
    pathname.includes('socket.io') ||
    pathname.includes('/chat/') ||
    pathname.includes('/emergency/') ||
    pathname.includes('/patient/') ||
    pathname.includes('/medical-report') ||
    pathname.includes('/real-data') ||
    pathname.includes('/health')
  ) {
    return true;
  }

  // Third-party real-time & Auth services
  if (
    hostname.includes('firebaseio.com') ||
    hostname.includes('googleapis.com') ||
    hostname.includes('twilio.com') ||
    hostname.includes('onrender.com') && pathname.startsWith('/api') ||
    hostname.includes('openstreetmap.org') ||
    hostname.includes('nominatim')
  ) {
    return true;
  }

  return false;
}

// 1. Install event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[PWA SW] Pre-caching partial warning:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate event: Clean up previous cache versions
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => !currentCaches.includes(cacheName))
            .map((cacheName) => {
              console.log('[PWA SW] Purging obsolete cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-while-revalidate for static assets, network-first for pages, passthrough for health APIs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // If request contains sensitive health APIs or WebSockets, pass directly to network
  if (shouldBypassCache(url, request)) {
    return;
  }

  // HTML page navigations: Network-first with cache fallback and offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (networkResponse) => {
          // If the web server returns 404 on a client-side route, fall back to cached SPA index.html app shell
          if (networkResponse && networkResponse.status === 404) {
            const appShell = await caches.match('/index.html');
            if (appShell) return appShell;
          }
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to cached index.html or offline.html
          const appShell = await caches.match('/index.html');
          if (appShell) return appShell;
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Images): Cache-first with background revalidation
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to keep cache warm
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseClone);
        });

        return networkResponse;
      });
    })
  );
});

// 4. Message event: Client-directed updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
