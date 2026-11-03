const CACHE = 'orbit-v1';

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys()
        .then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name))))
        .then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'skip-waiting') {
        self.skipWaiting();
    }
});

function remember(request, response) {
    if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }
    if (request.mode === 'navigate') {
        const shell = self.registration.scope;
        event.respondWith(fetch(request).then(response => remember(shell, response)).catch(() => caches.match(shell)));
        return;
    }
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => remember(request, response))));
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const scope = self.registration.scope;
    const server = data.hubRef ? `?server=${encodeURIComponent(data.hubRef)}` : '';
    event.waitUntil(self.registration.showNotification(data.title || 'Orbit', {
        body: data.body || '',
        tag: data.conversationId,
        icon: `${scope}icons/icon-192.png`,
        data: { target: `${scope}${server}#/c/${data.conversationId || ''}` },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.target) || self.registration.scope;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        const open = windows[0];
        return open ? open.navigate(target).then(client => client && client.focus()) : self.clients.openWindow(target);
    }));
});
