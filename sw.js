// ============================================
// THE BILL — Service Worker
// Cache-first for static assets, network-first for API
// ============================================

const CACHE_NAME = 'the-bill-v6';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// ---- Install: Pre-cache static assets ----
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// ---- Activate: Clean old caches ----
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ---- Fetch: Strategy based on request type ----
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Network-first for API calls
    if (url.pathname.startsWith('/api/') || url.hostname.includes('firestore') || url.hostname.includes('firebase')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Cache-first for static assets
    event.respondWith(cacheFirst(request));
});

// ---- Cache-first strategy ----
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Return offline fallback if available
        return caches.match('/index.html');
    }
}

// ---- Network-first strategy ----
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('Offline', { status: 503 });
    }
}

// ---- Push Notifications ----
self.addEventListener('push', (event) => {
    let data = {
        title: 'The Bill',
        body: '¡Tenés una novedad en tu sala!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'the-bill-notification',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            vibrate: [100, 50, 100],
            data: data.data,
            actions: [
                { action: 'open', title: 'Ver' },
                { action: 'close', title: 'Cerrar' }
            ]
        })
    );
});

// ---- Notification click ----
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Focus existing window if available
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // Otherwise open new window
                return clients.openWindow(targetUrl);
            })
    );
});
