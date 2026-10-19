const SHELL_CACHE = 'timecapsule-shell-v1';
const STATIC_CACHE = 'timecapsule-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      await cache.add(self.registration.scope);
    } catch {
      // The shell is refreshed on the first successful visit if install runs offline.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('timecapsule-') && ![SHELL_CACHE, STATIC_CACHE].includes(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (requestUrl.origin !== scopeUrl.origin || requestUrl.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.match(scopeUrl.href)) || Response.error();
      }
    })());
    return;
  }

  const isStaticAsset =
    requestUrl.pathname.includes('/assets/') ||
    requestUrl.pathname.startsWith('/brand/') ||
    requestUrl.pathname.endsWith('/favicon.svg');
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
