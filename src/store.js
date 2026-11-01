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
  const subscriptions = load('subscriptions.json');
  const customers = load('customers.json'); // saved name/ID/address for returning customers

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
    getCustomer: (phone) => customers[phone],
    saveCustomer(customer) {
      customers[customer.phone] = { ...customers[customer.phone], ...customer };
      persist('customers.json', customers);
    },
    findSubscription: (id = '') => subscriptions[id.toUpperCase()],
    listSubscriptions: () => Object.values(subscriptions),
    saveSubscription(sub) {
      subscriptions[sub.id] = { ...sub };
      persist('subscriptions.json', subscriptions);
    },
  };
}
