// Service Worker for Push Notifications & Background Messages
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'AkademiPanel';
    const options = {
      body: data.body || data.message || 'Yeni bir bildiriminiz var.',
      icon: data.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'akademi-notification',
      renotify: true,
      data: {
        url: data.url || '/',
        tab: data.tab || 'results',
        id: data.id
      }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('AkademiPanel', {
        body: text,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          if (event.notification.data && event.notification.data.tab) {
            client.postMessage({
              type: 'NAVIGATE_TAB',
              tab: event.notification.data.tab
            });
          }
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
