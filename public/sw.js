const CACHE = 'mindvault-static-v2';
const CORE = ['/', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isDynamicRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/');
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || network;
}

async function navigationFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put('/', response.clone());
    }
    return response;
  } catch {
    return caches.match('/') || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || isDynamicRequest(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationFallback(event.request));
    return;
  }

  if (url.pathname.startsWith('/assets/') || CORE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
