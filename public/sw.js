self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'Astra Live', body: event.data?.text?.() || '' }; }
  const title = data.title || 'Astra Live';
  const options = {
    body: data.body || 'Tienes un evento',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: data.url || '/'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientsArr => {
      for (const client of clientsArr) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
