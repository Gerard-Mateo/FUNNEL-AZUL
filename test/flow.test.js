import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCustomer,
  handleOwner,
  isOwnerCommand,
  looksLikeName,
  newSession,
  subscriptionReminders,
  S,
} from '../src/flow.js';
import * as M from '../src/messages.js';
import { parseTiers, quote, planQuote } from '../src/pricing.js';
import { addMonths, dueForReminder } from '../src/subscriptions.js';

const config = {
  ownerPhone: '593990000000',
  product: { name: 'Cuaderno Azul', description: 'Bonito', price: 15, imageUrl: 'https://x/img.jpg' },
  pricing: parseTiers('1:15'),
  freeShippingFrom: 3,
  maxQty: 20,
  subscription: { clubPrice: 12, annualPrice: 10, defaultMonths: 2, reminderDaysBefore: 3 },
  templates: { renewal: 'recordatorio_suscripcion', shipping: 'envio_en_camino', lang: 'es' },
  shippingCost: 4.5,
  deliveryDays: '1 a 3 días',
  store: { address: 'Tienda', mapsUrl: 'https://maps', hours: '10-19' },
  deunaQrUrl: 'https://x/qr.png',
  bank: { name: 'B', accountType: 'Ahorros', accountNumber: '1', holder: 'H', holderId: '1' },
};

const memoryStore = () => {
  const sessions = {};
  const orders = {};
  const subs = {};
  const customers = {};
  return {
    getSession: (p) => sessions[p],
    saveSession: (s) => (sessions[s.phone] = s),
    findOrder: (id = '') => orders[id.toUpperCase()],
    listOrders: () => Object.values(orders),
    saveOrder: (o) => (orders[o.id] = { ...o }),
    getCustomer: (p) => customers[p],
    saveCustomer: (c) => (customers[c.phone] = { ...customers[c.phone], ...c }),
    findSubscription: (id = '') => subs[id.toUpperCase()],
    listSubscriptions: () => Object.values(subs),
    saveSubscription: (s) => (subs[s.id] = { ...s }),
  };
};

const chat = (store, phone = '593981111111', profileName = 'María Pérez') => {
  let session = store.getSession(phone) ?? newSession(phone);
  return {
    get session() {
      return session;
    },
    send(incoming, now) {
      const msg = typeof incoming === 'string' ? { text: incoming } : incoming;
      const r = handleCustomer(session, { profileName, ...msg }, { config, store, now });
      session = r.session;
      store.saveSession(session);
      return r.out;
    },
  };
};

const ADDRESS = 'Quito, Av. Amazonas N34 y Rusia, casa azul frente al parque';
const allButtons = (out) => out.flatMap((o) => o.msg.buttons ?? []);

test('offer: just "yes" or a question, no subscription talk yet', () => {
  const c = chat(memoryStore());
  const [{ msg }] = c.send({ text: 'Hola! Quiero el cuaderno', referral: { source_id: 'AD123' } });
  assert.deepEqual(msg.buttons.map((b) => b.id), ['yes', 'question']);
  assert.doesNotMatch(msg.text, /suscri|club/i);
  assert.equal(c.session.adId, 'AD123');
});

test('the upsell comes right after yes: single, club (middle), annual', () => {
  const c = chat(memoryStore());
  c.send('hola');
  const [{ msg }] = c.send({ buttonId: 'yes' });
  assert.deepEqual(msg.buttons.map((b) => b.id), ['plan_single', 'plan_club', 'plan_annual']);
  assert.match(msg.text, /Solo este\*: \$15 \(\+ \$4\.50 de envío\)/);
  assert.match(msg.text, /Club Azul\*: uno nuevo cada 2 meses a \*\$12\*, envío GRATIS/);
  assert.match(msg.text, /Ahorras \$7\.50 en cada envío/);
  assert.match(msg.text, /6 cuadernos por \*\$60\* \(\$10 c\/u\)/);
  assert.match(msg.text, /Ahorras \$57\* en el año/);
});

test('fastest path, new customer: single + delivery in 7 steps, profile name is one tap', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola'); // 1 offer
  c.send({ buttonId: 'yes' }); // 2 plan
  const addr = c.send({ buttonId: 'plan_single' }); // 3 address
  assert.match(addr[0].msg.text, /ciudad y dirección/);
  assert.deepEqual(addr[0].msg.buttons.map((b) => b.id), ['pickup']);
  const name = c.send(ADDRESS); // 4 name
  assert.match(name[0].msg.text, /a nombre de \*María Pérez\*/);
  assert.match(c.send({ buttonId: 'name_ok' })[0].msg.text, /cédula/); // 5 cédula
  assert.match(c.send('17-123456-7')[0].msg.text, /no parece/); // 9 digits
  const summary = c.send('1712345678'); // 6 summary
  assert.match(summary[0].msg.text, /Envío LAAR — \$4\.50/);
  assert.match(summary[0].msg.text, /Total: \$19\.50/);
  assert.match(summary[0].msg.text, /María Pérez · 1712345678/);
  assert.deepEqual(summary[0].msg.buttons.map((b) => b.id), ['confirm', 'edit']);

  const pay = c.send({ buttonId: 'confirm' }); // 7 pay: QR right away
  assert.equal(pay[0].msg.headerImage, 'https://x/qr.png');
  assert.deepEqual(pay[0].msg.buttons.map((b) => b.id), ['pay_transfer']);
  const order = c.session.order;
  assert.equal(order.total, 19.5);
  assert.equal(order.city, 'Quito');
  assert.equal(order.paymentMethod, 'deuna');

  assert.match(c.send({ buttonId: 'pay_transfer' })[0].msg.text, /Referencia: \*AZ/);
  assert.equal(c.session.order.paymentMethod, 'transferencia');
  const afterReceipt = c.send({ imageId: 'MEDIA1' });
  const toOwner = afterReceipt.filter((o) => o.to === config.ownerPhone);
  assert.equal(toOwner[0].msg.type, 'forward_image');
  assert.match(toOwner[1].msg.text, new RegExp(`pagado ${order.id}`));

  const paid = handleOwner(`pagado ${order.id.toLowerCase()}`, { config, store });
  assert.match(paid.find((o) => o.to === c.session.phone).msg.text, /Pago confirmado/);
  assert.equal(store.getSession(c.session.phone).state, S.START);
  assert.match(handleOwner(`guia ${order.id} LAAR-999`, { config, store })[0].msg.text, /LAAR-999/);
});

test('returning customer: same address in one tap, name and cédula remembered', () => {
  const store = memoryStore();
  store.saveCustomer({ phone: '593981111111', name: 'María Pérez', cedula: '1712345678', address: ADDRESS, city: 'Quito' });
  const c = chat(store);
  c.send('hola');
  c.send({ buttonId: 'yes' });
  const same = c.send({ buttonId: 'plan_single' });
  assert.deepEqual(same[0].msg.buttons.map((b) => b.id), ['same_address', 'other_address', 'pickup']);
  const summary = c.send({ buttonId: 'same_address' });
  assert.equal(c.session.state, S.SUMMARY); // skipped name and cédula
  assert.match(summary[0].msg.text, /1712345678/);
});

test('store pickup, typed answers, no profile name, an address mentioning "tienda" is still an address', () => {
  const c = chat(memoryStore(), '593981234000', '✨ Mari ✨');
  c.send('hola');
  c.send('si');
  c.send('solo este');
  c.send('lo retiro');
  const ask = c.send('x'); // too short for a name
  assert.match(ask[0].msg.text, /nombre y apellido/);
  const summary = c.send('Juan Andrade');
  assert.match(summary[0].msg.text, /Retiro en tienda — GRATIS/);
  assert.match(summary[0].msg.text, /Total: \$15\.00/);

  const d = chat(memoryStore(), '593981234001');
  d.send('hola');
  d.send('si');
  d.send('solo este');
  d.send('Guayaquil, Av. 9 de Octubre 100, junto a la tienda Tía');
  assert.equal(d.session.order.method, 'delivery');
});

test('several notebooks by typing a number; wholesale goes to a person', () => {
  const c = chat(memoryStore());
  c.send('hola');
  c.send('si');
  c.send('quiero 3');
  assert.equal(c.session.order.qty, 3);
  c.send(ADDRESS);
  c.send({ buttonId: 'name_ok' });
  const summary = c.send('1712345678');
  assert.match(summary[0].msg.text, /Envío LAAR — GRATIS/); // free from 3
  assert.match(summary[0].msg.text, /Total: \$45\.00/);

  const w = chat(memoryStore(), '593982222222');
  w.send('hola');
  w.send('si');
  const out = w.send('50');
  assert.equal(w.session.state, S.HUMAN);
  assert.ok(out.some((o) => o.to === config.ownerPhone && /mayorista/.test(o.msg.text)));
});

test('Club Azul: frequency switch in the summary, activation, renewal reminder, renewal, cancel', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  c.send({ buttonId: 'yes' });
  const addr = c.send({ buttonId: 'plan_club' });
  assert.equal(addr[0].msg.type, 'text'); // subscriptions are always delivered: no pickup button
  assert.match(addr[0].msg.text, /GRATIS/);
  c.send(ADDRESS);
  c.send({ buttonId: 'name_ok' });
  const summary = c.send('1712345678');
  assert.match(summary[0].msg.text, /1 cuaderno cada 2 meses/);
  assert.deepEqual(summary[0].msg.buttons.map((b) => b.id), ['confirm', 'toggle_freq', 'edit']);
  const monthly = c.send({ buttonId: 'toggle_freq' });
  assert.match(monthly[0].msg.text, /1 cuaderno cada mes/);
  assert.match(monthly[0].msg.text, /Hoy pagas: \$12\.00/);
  c.send({ buttonId: 'confirm' });
  const first = c.session.order;
  const subId = first.subId;
  assert.equal(store.findSubscription(subId).status, 'pending_payment');

  c.send({ imageId: 'M1' });
  const activated = handleOwner(`pagado ${first.id}`, { config, store, today: '2026-11-01' });
  assert.match(activated.find((o) => o.to === c.session.phone).msg.text, /Club Azul/);
  let sub = store.findSubscription(subId);
  assert.equal(sub.status, 'active');
  assert.equal(sub.nextShipDate, '2026-12-01');
  assert.equal(sub.deliveriesLeft, 0);

  assert.equal(subscriptionReminders('2026-11-20', { config, store }).length, 0);
  const reminders = subscriptionReminders('2026-11-28', { config, store });
  const tpl = reminders.find((o) => o.to === c.session.phone).msg;
  assert.equal(tpl.type, 'template');
  assert.deepEqual(tpl.params, ['María', '1 de diciembre', '$12.00']);
  assert.equal(subscriptionReminders('2026-11-29', { config, store }).length, 0); // only once

  c.send({ buttonId: `sub_pay_${subId}` });
  const renewal = c.session.order;
  assert.equal(renewal.total, 12);
  c.send({ imageId: 'M2' });
  handleOwner(`pagado ${renewal.id}`, { config, store });
  assert.equal(store.findSubscription(subId).nextShipDate, '2027-01-01');

  c.send('cancelar');
  assert.equal(c.session.state, S.SUB_CANCEL);
  c.send({ buttonId: 'sub_cancel_yes' });
  assert.equal(store.findSubscription(subId).status, 'cancelled');
});

test('Plan Anual: one payment, you get "toca enviar", guia SUB ships the next one, renews at the end', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  c.send({ buttonId: 'yes' });
  c.send({ buttonId: 'plan_annual' });
  c.send(ADDRESS);
  c.send({ buttonId: 'name_ok' });
  const summary = c.send('1712345678');
  assert.match(summary[0].msg.text, /6 cuadernos, uno cada 2 meses/);
  assert.match(summary[0].msg.text, /Ahorras \$57\.00/);
  assert.match(summary[0].msg.text, /Hoy pagas: \$60\.00/);
  c.send({ buttonId: 'confirm' });
  const order = c.session.order;
  c.send({ imageId: 'M1' });
  handleOwner(`pagado ${order.id}`, { config, store, today: '2026-11-01' });
  let sub = store.findSubscription(order.subId);
  assert.equal(sub.deliveriesLeft, 5);

  // Before the next delivery YOU get the alert, the customer is not asked to pay
  const due = subscriptionReminders('2026-12-29', { config, store });
  assert.equal(due.length, 1);
  assert.equal(due[0].to, config.ownerPhone);
  assert.match(due[0].msg.text, /cuaderno 2 de 6/);

  const shipped = handleOwner(`guia ${sub.id} LAAR-2`, { config, store, now: Date.now() });
  assert.match(shipped[0].msg.text, /LAAR-2/);
  sub = store.findSubscription(order.subId);
  assert.equal(sub.deliveriesLeft, 4);
  assert.equal(sub.nextShipDate, '2027-03-01');

  // More than 24 h after the customer's last message, tracking goes as a template
  const late = handleOwner(`guia ${sub.id} LAAR-3`, { config, store, now: Date.now() + 2 * 86400000 });
  assert.equal(late[0].msg.type, 'template');
  assert.equal(late[0].msg.name, 'envio_en_camino');

  // Cancelling a prepaid plan keeps the paid deliveries, then it ends without asking to renew
  c.send('cancelar');
  const bye = c.send({ buttonId: 'sub_cancel_yes' });
  assert.match(bye[0].msg.text, /te llegan los 3 cuadernos que ya pagaste/);
  sub = store.findSubscription(order.subId);
  assert.equal(sub.status, 'active');
  assert.equal(sub.renew, false);
});

test('asking for a human pauses the bot and alerts the owner', () => {
  const c = chat(memoryStore());
  c.send('hola');
  const out = c.send('quiero hablar con un asesor');
  assert.equal(c.session.state, S.HUMAN);
  assert.ok(out.some((o) => o.to === config.ownerPhone));
  assert.deepEqual(c.send('hola?'), []);
  c.send('reiniciar');
  assert.equal(c.session.state, S.OFFER);
});

test('every button fits WhatsApp limits (max 3, 20 characters)', () => {
  const order = { kind: 'one-time', qty: 1, method: 'delivery', name: 'A B', cedula: '1', address: 'x', id: 'AZ1', total: 1 };
  const sub = { kind: 'subscription', plan: 'annual', months: 1, method: 'delivery', name: 'A B', address: 'x' };
  const msgs = [
    M.productOffer(config),
    M.planOffer(config),
    M.askAddress(order, config),
    M.askSameAddress({ address: 'x' }, order),
    M.askNameConfirm('A B'),
    M.summary(order, config),
    M.summary(sub, config),
    M.payDeuna(order, config),
    M.transferInstructions(order, config),
    M.askCancelSub({ plan: 'club' }),
  ];
  for (const m of msgs) {
    assert.ok(m.buttons.length <= 3);
    for (const b of m.buttons) assert.ok([...b.title].length <= 20, b.title);
  }
});

test('helpers: names, prices, dates, owner commands', () => {
  assert.ok(looksLikeName('María Pérez'));
  assert.ok(!looksLikeName('Mari'));
  assert.ok(!looksLikeName('✨ Mari ✨'));
  assert.deepEqual(quote(1, 'delivery', config), { qty: 1, unit: 15, subtotal: 15, savings: 0, shipping: 4.5, total: 19.5 });
  assert.deepEqual(planQuote('annual', 1, config), { plan: 'annual', months: 1, deliveries: 12, unit: 10, total: 120, savings: 114 });
  assert.equal(planQuote('club', 2, config).savings, 7.5);
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(dueForReminder([{ status: 'active', nextShipDate: '2026-12-01' }], '2026-11-28', 3).length, 1);
  assert.ok(isOwnerCommand('Guía AZ123 999'));
  assert.ok(!isOwnerCommand('hola quiero el cuaderno'));
});
