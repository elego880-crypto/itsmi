const { WebSocketServer } = require('ws');
const { verifyAccess } = require('./middleware/auth');
const db = require('./db');

let wss;

const clients = new Map(); // userId -> Set<ws>

function initWS(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    // Auth via ?token= in URL
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const payload = token ? verifyAccess(token) : null;

    ws.userId = payload ? payload.sub : null;
    ws.isAlive = true;

    if (ws.userId) {
      if (!clients.has(ws.userId)) clients.set(ws.userId, new Set());
      clients.get(ws.userId).add(ws);
    }

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', () => {
      if (ws.userId && clients.has(ws.userId)) {
        clients.get(ws.userId).delete(ws);
        if (clients.get(ws.userId).size === 0) clients.delete(ws.userId);
      }
    });

    ws.on('error', () => ws.terminate());
  });

  // Heartbeat every 30s
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));
}

// Broadcast event to ALL connected clients
function broadcast(event, data) {
  if (!wss) return;
  const msg = JSON.stringify({ event, data });
  wss.clients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
}

// Send to specific user
function sendToUser(userId, event, data) {
  if (!wss || !clients.has(userId)) return;
  const msg = JSON.stringify({ event, data });
  clients.get(userId).forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
}

module.exports = { initWS, broadcast, sendToUser };
