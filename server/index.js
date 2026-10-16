const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error('Faltan VAPID_PUBLIC / VAPID_PRIVATE en entorno. Generá y agrega las claves.');
  process.exit(1);
}

webpush.setVapidDetails('mailto:tu@correo', VAPID_PUBLIC, VAPID_PRIVATE);

let subscriptions = []; // en memoria — para pruebas

app.get('/health', (req, res) => res.send('ok'));

app.get('/vapidPublicKey', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

app.post('/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).send('subscription invalid');
  // evitar duplicados
  if (!subscriptions.find(s => s.endpoint === sub.endpoint)) subscriptions.push(sub);
  console.log('Nueva suscripción, total:', subscriptions.length);
  res.status(201).send('subscribed');
});

app.post('/simulate', async (req, res) => {
  const payload = JSON.stringify({ title: 'Astra Live — Simulación', body: 'Este es un push de prueba', url: '/' });
  const results = [];
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, status: 'ok' });
    } catch (err) {
      console.error('Error sendNotification', err);
      results.push({ endpoint: sub.endpoint, status: 'error', error: err.message });
    }
  }
  res.json({ sent: results.length, results });
});

app.listen(PORT, () => console.log('Server listening on', PORT));
