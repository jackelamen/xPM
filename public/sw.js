/* Plain service worker (no workbox/Babel build pipeline).
 * Provides installability + Web Push (push + notificationclick). */

self.addEventListener('install', () => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch {
        data = { title: 'xPM', body: event.data ? event.data.text() : '' }
    }

    const title = data.title || 'xPM'
    const options = {
        body: data.body || '',
        icon: '/icon-192.png?v=2',
        badge: '/icon-192.png?v=2',
        tag: data.type || 'xpm-notification',
        data: { url: data.url || '/' },
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = (event.notification.data && event.notification.data.url) || '/'
    const targetHref = new URL(url, self.location.origin).href

    event.waitUntil(
        (async () => {
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

            // A window already on the target URL only needs focus.
            const exact = clients.find((c) => c.url === targetHref && 'focus' in c)
            if (exact) return exact.focus()

            // Otherwise steer an existing window there. `navigate()` REJECTS for
            // a client this worker doesn't control, and `includeUncontrolled: true`
            // deliberately surfaces those - so firing it without awaiting left the
            // window focused on whatever page it was already showing while the
            // rejection was swallowed. Await it, and fall through to openWindow
            // if no existing window can be navigated.
            for (const client of clients) {
                if (!('focus' in client)) continue
                try {
                    const navigated = await client.navigate(url)
                    await (navigated || client).focus()
                    return
                } catch {
                    // Try the next window.
                }
            }

            if (self.clients.openWindow) return self.clients.openWindow(url)
        })(),
    )
})
