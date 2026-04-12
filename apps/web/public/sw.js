/// <reference lib="webworker" />

// Ayurplex Push Notification Service Worker
// Handles push events and displays medication reminder notifications.

self.addEventListener('push', (event) => {
  if (!event.data) return;

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

  event.waitUntil(self.registration.showNotification(title, options));
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
