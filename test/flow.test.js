import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCustomer, handleOwner, isOwnerCommand, newSession, subscriptionReminders, S } from '../src/flow.js';
import { parseTiers, quote } from '../src/pricing.js';
import { addMonths, dueForReminder } from '../src/subscriptions.js';

const config = {
  ownerPhone: '593990000000',
  product: { name: 'Cuaderno Azul', description: 'Bonito', price: 15, imageUrl: 'https://x/img.jpg' },
  pricing: parseTiers('1:15,3:12'),
  freeShippingFrom: 3,
  maxQty: 20,
  subscription: { price: 13, reminderDaysBefore: 3, reminderTemplate: 'recordatorio_suscripcion', templateLang: 'es' },
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
  return {
    getSession: (p) => sessions[p],
    saveSession: (s) => (sessions[s.phone] = s),
    findOrder: (id = '') => orders[id.toUpperCase()],
    listOrders: () => Object.values(orders),
    saveOrder: (o) => (orders[o.id] = { ...o }),
    findSubscription: (id = '') => subs[id.toUpperCase()],
    listSubscriptions: () => Object.values(subs),
    saveSubscription: (s) => (subs[s.id] = { ...s }),
  };
};

const chat = (store, phone = '593981111111') => {
  let session = newSession(phone);
  return {
    get session() {
      return session;
    },
    send(incoming) {
      const r = handleCustomer(session, typeof incoming === 'string' ? { text: incoming } : incoming, {
        config,
        store,
      });
      session = r.session;
      store.saveSession(session);
      return r.out;
    },
  };
};

const fillDelivery = (c) => {
  c.send('María Pérez');
  c.send('1712345678');
  c.send('Quito');
  return c.send('Av. Amazonas N34 y Rusia, casa azul frente al parque');
};

test('product offer has buy, subscription and question buttons', () => {
  const c = chat(memoryStore());
  const [{ msg }] = c.send({ text: 'Hola! Quiero el cuaderno', referral: { source_id: 'AD123' } });
  assert.deepEqual(msg.buttons.map((b) => b.id), ['yes', 'sub', 'question']);
  assert.equal(msg.headerImage, 'https://x/img.jpg');
  assert.equal(c.session.adId, 'AD123');
});

test('quantity is ONE question with 3 options (1, pack, other) and no extra upsell', () => {
  const c = chat(memoryStore());
  c.send('hola');
  const [{ msg }] = c.send({ buttonId: 'yes' });
  assert.deepEqual(msg.buttons.map((b) => b.id), ['qty_1', 'qty_3', 'qty_more']);
  assert.match(msg.text, /Pack de 3: \$36\.00\* \(\$12\.00 c\/u\) \+ envío GRATIS/);
  c.send({ buttonId: 'qty_1' });
  assert.equal(c.session.state, S.METHOD); // straight to delivery method
});

test('pack of 3 with delivery: free shipping, DeUna, receipt, owner confirms and sends tracking', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  c.send({ buttonId: 'yes' });
  const method = c.send({ buttonId: 'qty_3' });
  assert.match(method[0].msg.text, /\*GRATIS\*/);
  c.send({ buttonId: 'delivery' });
  c.send('María Pérez');
  assert.match(c.send('17-123456-7')[0].msg.text, /no parece/); // only 9 digits
  c.send('1712345678');
  c.send('Quito');
  const summary = c.send('Av. Amazonas N34 y Rusia, casa azul frente al parque');
  assert.match(summary[0].msg.text, /Total: \$36\.00/);
  assert.match(summary[0].msg.text, /Ahorras \$9\.00/);
  assert.deepEqual(summary[0].msg.buttons.map((b) => b.id), ['confirm', 'edit']);

  c.send({ buttonId: 'confirm' });
  const order = c.session.order;
  assert.equal(order.total, 36);
  assert.equal(order.shipping, 0);

  assert.equal(c.send({ buttonId: 'pay_deuna' })[0].msg.type, 'image');
  assert.match(c.send('ya pagué')[0].msg.text, /captura/);
  const afterReceipt = c.send({ imageId: 'MEDIA1' });
  const toOwner = afterReceipt.filter((o) => o.to === config.ownerPhone);
  assert.equal(toOwner[0].msg.type, 'forward_image');
  assert.match(toOwner[1].msg.text, new RegExp(`pagado ${order.id}`));

  const paid = handleOwner(`pagado ${order.id.toLowerCase()}`, { config, store });
  assert.match(paid.find((o) => o.to === c.session.phone).msg.text, /Pago confirmado/);
  assert.equal(store.getSession(c.session.phone).state, S.START);
  assert.match(handleOwner(`guia ${order.id} LAAR-999`, { config, store })[0].msg.text, /LAAR-999/);
});

test('single notebook, store pickup, typed answers', () => {
  const c = chat(memoryStore());
  c.send('hola');
  c.send('Sí');
  c.send('1');
  c.send('lo retiro en la tienda');
  const summary = c.send('Juan Andrade');
  assert.match(summary[0].msg.text, /Total: \$15\.00/);
  c.send('si');
  assert.equal(c.session.order.total, 15);
  assert.match(c.send('transferencia')[0].msg.text, /Referencia/);
});

test('custom quantity and wholesale handoff', () => {
  const c = chat(memoryStore());
  c.send('hola');
  c.send({ buttonId: 'yes' });
  c.send({ buttonId: 'qty_more' });
  assert.equal(c.session.state, S.QTY_CUSTOM);
  c.send('quiero 7');
  assert.equal(c.session.order.qty, 7);
  assert.equal(c.session.state, S.METHOD);

  const w = chat(memoryStore(), '593982222222');
  w.send('hola');
  w.send('si');
  const out = w.send('50');
  assert.equal(w.session.state, S.HUMAN);
  assert.ok(out.some((o) => o.to === config.ownerPhone && /mayorista/.test(o.msg.text)));
});

test('subscription: sign up, first payment, reminder, renewal, cancel', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  const offer = c.send({ buttonId: 'sub' });
  assert.match(offer[0].msg.text, /\$13\.00 por envío/);
  assert.match(offer[0].msg.text, /ahorras \$6\.50/); // vs $15 + $4.50
  c.send({ buttonId: 'sub_2' });
  assert.equal(c.session.order.months, 2);
  const summary = fillDelivery(c);
  assert.match(summary[0].msg.text, /cada 2 meses/);
  c.send({ buttonId: 'confirm' });
  const first = c.session.order;
  assert.equal(first.total, 13);
  const sub = store.findSubscription(first.subId);
  assert.equal(sub.status, 'pending_payment');

  c.send({ buttonId: 'pay_transfer' });
  c.send({ imageId: 'M1' });
  const activated = handleOwner(`pagado ${first.id}`, { config, store, today: '2026-11-01' });
  assert.match(activated.find((o) => o.to === c.session.phone).msg.text, /suscripción activa/);
  assert.equal(store.findSubscription(sub.id).status, 'active');
  assert.equal(store.findSubscription(sub.id).nextShipDate, '2027-01-01');

  // Too early: no reminder. 3 days before: reminder (template) once.
  assert.equal(subscriptionReminders('2026-12-20', { config, store }).length, 0);
  const reminders = subscriptionReminders('2026-12-29', { config, store });
  const tpl = reminders.find((o) => o.to === c.session.phone).msg;
  assert.equal(tpl.type, 'template');
  assert.equal(tpl.name, 'recordatorio_suscripcion');
  assert.deepEqual(tpl.params, ['María', '1 de enero', '$13.00']);
  assert.equal(subscriptionReminders('2026-12-30', { config, store }).length, 0); // not twice

  // Customer taps "Pagar envío" from the template
  const pay = c.send({ buttonId: `sub_pay_${sub.id}` });
  assert.match(pay[0].msg.text, /\$13\.00/);
  const renewal = c.session.order;
  assert.equal(renewal.renewal, true);
  c.send({ buttonId: 'pay_deuna' });
  c.send({ imageId: 'M2' });
  const renewed = handleOwner(`pagado ${renewal.id}`, { config, store });
  assert.match(renewed.find((o) => o.to === c.session.phone).msg.text, /Siguiente envío/);
  assert.equal(store.findSubscription(sub.id).nextShipDate, '2027-03-01');

  // Owner sees it, then the customer cancels
  assert.match(handleOwner('suscripciones', { config, store })[0].msg.text, new RegExp(sub.id));
  c.send('cancelar');
  assert.equal(c.session.state, S.SUB_CANCEL);
  const cancelled = c.send({ buttonId: 'sub_cancel_yes' });
  assert.equal(store.findSubscription(sub.id).status, 'cancelled');
  assert.ok(cancelled.some((o) => o.to === config.ownerPhone));
  assert.equal(subscriptionReminders('2027-02-27', { config, store }).length, 0);
});

test('asking for a human pauses the bot and alerts the owner', () => {
  const c = chat(memoryStore());
  c.send('hola');
  const out = c.send('quiero hablar con un asesor');
  assert.equal(c.session.state, S.HUMAN);
  assert.ok(out.some((o) => o.to === config.ownerPhone));
  assert.deepEqual(c.send('hola?'), []);
  c.send('reiniciar');
  assert.equal(c.session.state, S.CONFIRM_PRODUCT);
});

test('owner commands are recognised only when they start the message', () => {
  assert.ok(isOwnerCommand('pagado AZ123'));
  assert.ok(isOwnerCommand('Guía AZ123 999'));
  assert.ok(isOwnerCommand('suscripciones'));
  assert.ok(!isOwnerCommand('hola quiero el cuaderno'));
});

test('pricing and date math', () => {
  assert.deepEqual(quote(2, 'delivery', config), { qty: 2, unit: 15, subtotal: 30, savings: 0, shipping: 4.5, total: 34.5 });
  assert.equal(quote(3, 'delivery', config).total, 36);
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-15', 2), '2027-01-15');
  const subs = [{ status: 'active', nextShipDate: '2026-12-01' }];
  assert.equal(dueForReminder(subs, '2026-11-27', 3).length, 0);
  assert.equal(dueForReminder(subs, '2026-11-28', 3).length, 1);
});
