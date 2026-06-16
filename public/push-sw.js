/* push-sw.js — imported into the generated service worker (vite-plugin-pwa).
 * Handles incoming Web Push messages and notification clicks. */

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
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.type || 'xpm-notification',
        data: { url: data.url || '/' },
    }

    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = (event.notification.data && event.notification.data.url) || '/'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            // Focus an existing tab if one is open, otherwise open a new one.
            for (const client of clients) {
                if ('focus' in client) {
                    client.navigate(url)
                    return client.focus()
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(url)
        }),
    )
})
