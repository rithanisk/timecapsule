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

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Your Timecapsule is ready', {
    body: payload.body || 'Your people are together in one photobooth.',
    icon: '/brand/app-icon.svg',
    badge: '/brand/app-icon.svg',
    tag: payload.tag || 'timecapsule-ready',
    renotify: false,
    data: { url: payload.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    if ('clearAppBadge' in self.registration) {
      await self.registration.clearAppBadge().catch(() => undefined);
    }
    const target = new URL(event.notification.data?.url || '/', self.registration.scope).href;
    const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of openClients) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
