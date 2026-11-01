// Tiny JSON-file storage: good enough for the first hundreds of orders.
// When you grow, swap this file for Google Sheets / Supabase with the same functions.

import fs from 'node:fs';
import path from 'node:path';

export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (name) => path.join(dir, name);
  const load = (name) => {
    try {
      return JSON.parse(fs.readFileSync(file(name), 'utf8'));
    } catch {
      return {};
    }
  };
  const persist = (name, data) => {
    const tmp = file(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file(name));
  };

  const sessions = load('sessions.json');
  const orders = load('orders.json');

  return {
    getSession: (phone) => sessions[phone],
    saveSession(session) {
      session.updatedAt = new Date().toISOString();
      sessions[session.phone] = session;
      persist('sessions.json', sessions);
    },
    findOrder: (id = '') => orders[id.toUpperCase()],
    listOrders: () => Object.values(orders),
    saveOrder(order) {
      orders[order.id] = { ...order };
      persist('orders.json', orders);
    },
  };
}
