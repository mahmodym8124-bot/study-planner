const CACHE = 'mindvault-static-v3';
const BASE_PATH = (() => {
  const scopePath = new URL(self.registration.scope).pathname;
  return scopePath.endsWith('/') ? scopePath.slice(0, -1) : scopePath;
})();

function withBase(path) {
  return BASE_PATH ? `${BASE_PATH}${path}` : path;
}

function stripBase(pathname) {
  if (!BASE_PATH) return pathname;
  return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || '/' : pathname;
}

const ROOT_PATH = withBase('/');
const CORE = [ROOT_PATH, withBase('/manifest.webmanifest'), withBase('/favicon.svg')];

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
  const path = stripBase(url.pathname);
  return path.startsWith('/api/') || path.startsWith('/uploads/');
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
      cache.put(ROOT_PATH, response.clone());
    }
    return response;
  } catch {
    return caches.match(ROOT_PATH) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const path = stripBase(url.pathname);
  if (url.origin !== self.location.origin || isDynamicRequest(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(navigationFallback(event.request));
    return;
  }

  if (path.startsWith('/assets/') || CORE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
