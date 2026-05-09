const CACHE = 'mindvault-v1';
const CORE = ['/', '/manifest.webmanifest', '/favicon.svg'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then((response) => {
    const clone = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, clone));
    return response;
  }).catch(() => caches.match(event.request).then((match) => match || caches.match('/'))));
});
