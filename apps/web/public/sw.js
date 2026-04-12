/// <reference lib="webworker" />

// Ayurplex Push Notification Service Worker
// Handles push events and displays medication reminder notifications.

self.addEventListener('push', (event) => {
  console.log('[SW] Push event received!', event);
  console.log('[SW] Push data:', event.data ? event.data.text() : 'NO DATA');

  // Also post a message to all clients so we can see it in page console
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'PUSH_RECEIVED', data: event.data ? event.data.text() : null });
    });
  });

  if (!event.data) {
    // Show notification even with no data for debugging
    event.waitUntil(
      self.registration.showNotification('Push received (no data)', { body: 'Debug: push event fired but no data' })
    );
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Ayurplex', body: event.data.text() };
  }

  const title = payload.title || 'Ayurplex Reminder';
  const options = {
    body: payload.body || 'Time to take your medication',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.tag || 'ayurplex-reminder',
    data: payload.data || {},
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] showNotification succeeded'))
      .catch(err => console.error('[SW] showNotification failed:', err))
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] pushsubscriptionchange event fired', event);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Focus the app tab or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    }),
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
