// Webhook server: Meta sends every WhatsApp message here, we answer through the Cloud API.
// Run with: npm start   (Node 18+; no external dependencies)

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { createStore } from './store.js';
import { createWhatsApp, parseIncoming } from './whatsapp.js';
import { handleCustomer, handleOwner, isOwnerCommand, newSession } from './flow.js';

const store = createStore(config.dataDir);
const wa = createWhatsApp(config);
const ASSETS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets');
const seen = new Set(); // Meta may deliver the same message twice

function validSignature(raw, header) {
  if (!config.appSecret) return true; // set META_APP_SECRET in production!
  if (!header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', config.appSecret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function processMessage(raw) {
  const incoming = parseIncoming(raw);
  if (seen.has(incoming.id)) return;
  seen.add(incoming.id);
  if (seen.size > 5000) seen.clear();

  wa.markRead(incoming.id).catch(() => {});

  let out;
  if (incoming.from === config.ownerPhone && isOwnerCommand(incoming.text)) {
    out = handleOwner(incoming.text, { config, store });
  } else {
    const session = store.getSession(incoming.from) ?? newSession(incoming.from);
    ({ out } = handleCustomer(session, incoming, { config, store }));
    store.saveSession(session);
  }

  for (const { to, msg } of out) {
    try {
      await wa.send(to, msg); // sequential so messages arrive in order
    } catch (err) {
      console.error(`Send to ${to} failed:`, err.message);
    }
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200).end('Funnel Azul bot OK 💙');
    return;
  }

  // Product photos (assets/*.jpg|png) so WhatsApp can fetch them by link.
  if (url.pathname.startsWith('/assets/') && req.method === 'GET') {
    const name = path.basename(url.pathname);
    const file = path.join(ASSETS_DIR, name);
    const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[path.extname(name).toLowerCase()];
    if (!type || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' });
    fs.createReadStream(file).pipe(res);
    return;
  }

  // Meta checks the webhook once when you configure it in the developer dashboard.
  if (url.pathname === '/webhook' && req.method === 'GET') {
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === config.verifyToken;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') : 'Forbidden');
    return;
  }

  if (url.pathname === '/webhook' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      if (!validSignature(raw, req.headers['x-hub-signature-256'])) {
        res.writeHead(401).end();
        return;
      }
      res.writeHead(200).end('EVENT_RECEIVED'); // answer fast, then work

      let body;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          for (const msg of change.value?.messages ?? []) {
            processMessage(msg).catch((err) => console.error('Processing failed:', err));
          }
        }
      }
    });
    return;
  }

  res.writeHead(404).end();
});

server.listen(config.port, () => {
  console.log(`Funnel Azul bot listening on :${config.port}`);
  if (!config.whatsappToken) console.warn('⚠️  WHATSAPP_TOKEN is not set (see .env.example)');
  if (!config.appSecret) console.warn('⚠️  META_APP_SECRET is not set: webhook signatures are not checked');
  if (!config.ownerPhone) console.warn('⚠️  OWNER_PHONE is not set: you will not get order alerts');
});
