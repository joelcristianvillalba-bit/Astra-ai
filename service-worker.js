/* Service Worker for Astra AI (push handling) */
self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'Astra AI', body: 'Evento en vivo' }; }
  const title = data.title || 'Astra AI';
  const options = {
    body: data.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: data
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then(function(clientList) {
    if (clientList.length > 0) {
      let client = clientList[0];
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].focused) {
          client = clientList[i];
        }
      }
      return client.focus();
    }
    return clients.openWindow('/');
  }));
});
