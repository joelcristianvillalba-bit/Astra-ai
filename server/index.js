// Simple relay server for Astra AI live demo (mock data, free to run locally)
// - Exposes a WebSocket for live UI updates (/ws)
// - Exposes a push subscription endpoint (/subscribe)
// - Exposes a simulate endpoint (/simulate) to broadcast demo events and send push notifications
// - Optional Supabase integration for persistent favorites when SUPABASE_URL and SUPABASE_KEY are provided

const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

// optional supabase
let useSupabase = false;
let supabase = null;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
if(SUPABASE_URL && SUPABASE_KEY){
  try{
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    useSupabase = true;
    console.log('Supabase integration enabled');
  }catch(e){
    console.warn('Could not initialize Supabase client', e.message);
  }
}

const app = express();
app.use(bodyParser.json());
app.use(cors());

// In-memory stores (free, ephemeral). For production persist in DB.
const subscriptions = []; // push subscriptions
let wsClients = new Set();
const favoritesMap = {}; // { userId: [teams] }

// VAPID keys: generate on first run if not provided via env (free/local)
let VAPID_PUBLIC = process.env.VAPID_PUBLIC || '';
let VAPID_PRIVATE = process.env.VAPID_PRIVATE || '';

if(!VAPID_PUBLIC || !VAPID_PRIVATE){
  const keys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC = keys.publicKey;
  VAPID_PRIVATE = keys.privateKey;
  console.log('Generated VAPID keys (save these to env for persistent use)');
}

webpush.setVapidDetails('mailto:admin@astra.ai', VAPID_PUBLIC, VAPID_PRIVATE);

app.get('/vapidPublicKey', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

app.get('/health', (req, res) => res.json({ ok: true, supabase: useSupabase }));

// Receive subscription from client and store it
app.post('/subscribe', (req, res) => {
  try{
    const sub = req.body.subscription;
    if(!sub) return res.status(400).json({ error: 'No subscription provided' });
    // naive dedupe by endpoint
    if(!subscriptions.find(s => s.endpoint === sub.endpoint)){
      subscriptions.push(sub);
      console.log('Saved new subscription, total=', subscriptions.length);
    }
    return res.json({ ok: true });
  }catch(e){
    console.error(e);
    return res.status(500).json({ error: 'error' });
  }
});

// Favorites endpoints: persistent if Supabase enabled, otherwise in-memory fallback
app.get('/favorites/:user', async (req, res) => {
  const user = req.params.user;
  if(useSupabase){
    try{
      const { data, error } = await supabase.from('favorites').select('team').eq('user_id', user);
      if(error) return res.status(500).json({ error: error.message });
      const teams = data.map(r => r.team);
      return res.json({ teams });
    }catch(e){
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }
  return res.json({ teams: favoritesMap[user] || [] });
});

app.post('/favorites', async (req, res) => {
  const { user, team } = req.body;
  if(!user || !team) return res.status(400).json({ error: 'user and team required' });
  if(useSupabase){
    try{
      // upsert to avoid duplicates
      const existsQ = await supabase.from('favorites').select('id').match({ user_id: user, team });
      if(existsQ.error) console.warn('supabase check err', existsQ.error.message);
      if(existsQ.data && existsQ.data.length === 0){
        const insertQ = await supabase.from('favorites').insert({ user_id: user, team }).select();
        if(insertQ.error) return res.status(500).json({ error: insertQ.error.message });
      }
      const listQ = await supabase.from('favorites').select('team').eq('user_id', user);
      return res.json({ teams: listQ.data.map(r=>r.team) });
    }catch(e){
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }
  favoritesMap[user] = favoritesMap[user] || [];
  if(!favoritesMap[user].includes(team)) favoritesMap[user].push(team);
  return res.json({ teams: favoritesMap[user] });
});

app.delete('/favorites/:user/:team', async (req, res) => {
  const user = req.params.user;
  const team = decodeURIComponent(req.params.team);
  if(useSupabase){
    try{
      const del = await supabase.from('favorites').delete().match({ user_id: user, team });
      if(del.error) return res.status(500).json({ error: del.error.message });
      const listQ = await supabase.from('favorites').select('team').eq('user_id', user);
      return res.json({ teams: listQ.data.map(r=>r.team) });
    }catch(e){
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  }
  favoritesMap[user] = (favoritesMap[user] || []).filter(t=>t!==team);
  return res.json({ teams: favoritesMap[user] || [] });
});

// Simple simulate endpoint that will broadcast events to WS clients and send push notifications
app.post('/simulate', async (req, res) => {
  const events = [
    { type: 'kickoff', text: '¡Comenzó el partido!', subtitle: 'River Plate vs Boca Juniors' },
    { type: 'goal', team: 'River Plate', player: 'J. Fernández', text: 'GOL — J. Fernández (River)', subtitle: '1-0' },
    { type: 'yellow', team: 'Boca Juniors', player: 'M. Gómez', text: 'Tarjeta amarilla — M. Gómez', subtitle: 'Min 66' },
    { type: 'goal', team: 'Boca Juniors', player: 'L. Martínez', text: 'GOL — L. Martínez (Boca)', subtitle: '1-1' },
    { type: 'red', team: 'Boca Juniors', player: 'M. Gómez', text: 'Tarjeta roja — M. Gómez', subtitle: 'Expulsado' },
    { type: 'end', text: 'Final del partido — 2-1', subtitle: 'Resultado final' }
  ];

  // Broadcast sequence with small delays
  events.forEach((ev, idx) => {
    setTimeout(() => {
      broadcast({ event: ev });
      // send push for important events
      if(['goal','yellow','red','end'].includes(ev.type)){
        sendPushToAll({ title: ev.type === 'goal' ? 'Gol' : ev.type === 'yellow' ? 'Tarjeta amarilla' : ev.type === 'red' ? 'Tarjeta roja' : 'Final', body: ev.subtitle || ev.text });
      }
    }, 1400 * (idx+1));
  });

  res.json({ ok: true, queued: events.length });
});

// Helper: broadcast JSON to WS clients
function broadcast(obj){
  const raw = JSON.stringify(obj);
  for(const ws of wsClients){
    if(ws.readyState === 1){
      ws.send(raw);
    }
  }
}

// Helper: send push to all saved subscriptions
async function sendPushToAll(payload){
  const p = { title: payload.title || 'Astra AI', body: payload.body || '' };
  const payloadStr = JSON.stringify(p);
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, payloadStr).catch(err => {
      console.warn('Push send failed, removing subscription if gone', err.message);
      // remove if gone
      if(err.statusCode === 410 || err.statusCode === 404){
        const idx = subscriptions.findIndex(s => s.endpoint === sub.endpoint);
        if(idx >= 0) subscriptions.splice(idx,1);
      }
    });
  });
}

// Create server and attach WS
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (socket) => {
  console.log('WS client connected');
  wsClients.add(socket);
  socket.send(JSON.stringify({ hello: 'connected', time: new Date().toISOString() }));
  socket.on('close', () => { wsClients.delete(socket); console.log('WS client disconnected'); });
});

server.on('upgrade', (request, socket, head) => {
  // Use path /ws for websocket
  const { url } = request;
  if(url && url.startsWith('/ws')){
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
  console.log(`Astra live server running on http://localhost:${PORT}`);
  console.log(`VAPID_PUBLIC: ${VAPID_PUBLIC}`);
  console.log('If you want persistent VAPID keys, set VAPID_PUBLIC and VAPID_PRIVATE env vars.');
  if(useSupabase) console.log('Supabase mode: favorites persisted to Supabase table `favorites` (user_id, team)');
});
