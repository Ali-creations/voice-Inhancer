const CACHE = 'clearvoice-v3';
const ASSETS = [
  './', 
  './index.html', 
  './styles.css', 
  './app.js', 
  './manifest.webmanifest', 
  './icon.svg'
];

// Handles isolated font caching matrices for Google Fonts
const FONT_ORIGINS = ['://googleapis.com', '://gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Strategy: Stale-While-Revalidate for local code resources and foreign typography fonts
  if (requestUrl.origin === self.location.origin || FONT_ORIGINS.includes(requestUrl.hostname)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return networkResponse;
        }).catch(() => {
          // Silent catch for network drops during validation check
        });

        // Immediately serve cached resource if available, fallback to the network trip
        return cachedResponse || fetchPromise;
      })
    );
  }
});
