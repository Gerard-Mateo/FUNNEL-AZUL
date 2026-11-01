import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleCustomer, handleOwner, isOwnerCommand, newSession, S } from '../src/flow.js';
import { parseTiers, quote, nextUpgrade } from '../src/pricing.js';

const config = {
  ownerPhone: '593990000000',
  product: { name: 'Cuaderno Azul', description: 'Bonito', price: 15, imageUrl: 'https://x/img.jpg' },
  shippingCost: 4.5,
  pricing: parseTiers('1:15,2:13.5,3:12,5:11'),
  freeShippingFrom: 3,
  maxQty: 20,
  deliveryDays: '1 a 3 días',
  store: { address: 'Tienda', mapsUrl: 'https://maps', hours: '10-19' },
  deunaQrUrl: 'https://x/qr.png',
  bank: { name: 'B', accountType: 'Ahorros', accountNumber: '1', holder: 'H', holderId: '1' },
};

const memoryStore = () => {
  const sessions = {};
  const orders = {};
  return {
    getSession: (p) => sessions[p],
    saveSession: (s) => (sessions[s.phone] = s),
    findOrder: (id = '') => orders[id.toUpperCase()],
    listOrders: () => Object.values(orders),
    saveOrder: (o) => (orders[o.id] = { ...o }),
    orders,
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
      return r.out;
    },
  };
};

test('delivery happy path with buttons, DeUna and receipt', () => {
  const store = memoryStore();
  const c = chat(store);

  const offer = c.send({ text: 'Hola! Quiero el cuaderno', referral: { source_id: 'AD123' } });
  assert.equal(offer[0].msg.type, 'buttons');
  assert.equal(offer[0].msg.headerImage, 'https://x/img.jpg');
  assert.equal(c.session.adId, 'AD123');

  c.send({ buttonId: 'yes' });
  assert.equal(c.session.state, S.QTY);
  const list = c.send({ buttonId: 'qty_2' });
  assert.equal(c.session.state, S.UPSELL); // 2 -> offer 3
  assert.match(list[0].msg.text, /solo \*\$9\.00\*/); // the 3rd costs only $9
  assert.match(list[0].msg.text, /GRATIS/);
  const method = c.send({ buttonId: 'up_yes' });
  assert.equal(c.session.order.qty, 3);
  assert.match(method[0].msg.text, /~\$4\.50~ \*GRATIS\*/);
  c.send({ buttonId: 'delivery' });
  c.send('María Pérez');
  assert.match(c.send('17-123456-7')[0].msg.text, /no parece/); // only 9 digits
  c.send('1712345678');
  c.send('Quito');
  const summary = c.send('Av. Amazonas N34 y Rusia, casa azul frente al parque');
  assert.match(summary[0].msg.text, /Total: \$36\.00/);
  assert.match(summary[0].msg.text, /Ahorras \$9\.00/);
  assert.equal(summary[0].msg.buttons.length, 2); // free shipping already: no "add more" button

  const pay = c.send({ buttonId: 'confirm' });
  const order = c.session.order;
  assert.equal(order.total, 36);
  assert.equal(order.shipping, 0);
  assert.equal(order.upsold, true);
  assert.equal(order.adId, 'AD123');
  assert.ok(store.findOrder(order.id));
  assert.match(pay[0].msg.text, new RegExp(order.id));

  const deuna = c.send({ buttonId: 'pay_deuna' });
  assert.equal(deuna[0].msg.type, 'image');
  assert.equal(c.session.state, S.RECEIPT);

  assert.match(c.send('ya pagué')[0].msg.text, /captura/); // text instead of photo

  const afterReceipt = c.send({ imageId: 'MEDIA1' });
  assert.equal(c.session.state, S.VERIFYING);
  const toOwner = afterReceipt.filter((o) => o.to === config.ownerPhone);
  assert.equal(toOwner[0].msg.type, 'forward_image');
  assert.match(toOwner[1].msg.text, new RegExp(`pagado ${order.id}`));
  assert.equal(store.findOrder(order.id).status, 'verifying');

  // Owner confirms payment, then sends the LAAR tracking number
  store.saveSession(c.session);
  const paid = handleOwner(`pagado ${order.id.toLowerCase()}`, { config, store });
  const toCustomer = paid.find((o) => o.to === c.session.phone);
  assert.match(toCustomer.msg.text, /Pago confirmado/);
  assert.equal(store.findOrder(order.id).status, 'paid');
  assert.equal(store.getSession(c.session.phone).state, S.START);

  const guia = handleOwner(`guia ${order.id} LAAR-999`, { config, store });
  assert.match(guia[0].msg.text, /LAAR-999/);
});

test('store pickup is free and accepts typed answers', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  c.send('Sí');
  c.send('quiero 1');
  assert.equal(c.session.state, S.UPSELL);
  c.send('no, solo 1');
  assert.equal(c.session.order.qty, 1);
  c.send('lo retiro en la tienda');
  assert.equal(c.session.state, S.P_NAME);
  const summary = c.send('Juan Andrade');
  assert.match(summary[0].msg.text, /GRATIS/);
  assert.match(summary[0].msg.text, /Total: \$15\.00/);
  c.send('si');
  assert.equal(c.session.order.total, 15);
  const transfer = c.send('transferencia');
  assert.match(transfer[0].msg.text, /Referencia/);
});

test('asking for a human pauses the bot and alerts the owner', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  const out = c.send('quiero hablar con un asesor');
  assert.equal(c.session.state, S.HUMAN);
  assert.ok(out.some((o) => o.to === config.ownerPhone));
  assert.deepEqual(c.send('hola?'), []); // bot stays quiet
  c.send('reiniciar');
  assert.equal(c.session.state, S.CONFIRM_PRODUCT);
});

test('edit from summary goes back to delivery method', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  c.send({ buttonId: 'yes' });
  c.send({ buttonId: 'qty_1' });
  c.send({ buttonId: 'up_no' });
  c.send({ buttonId: 'pickup' });
  c.send('Ana Torres');
  c.send({ buttonId: 'edit' });
  assert.equal(c.session.state, S.METHOD);
  assert.equal(c.session.order.qty, 1);
});

test('owner commands are recognised only when they start the message', () => {
  assert.ok(isOwnerCommand('pagado AZ123'));
  assert.ok(isOwnerCommand('Guía AZ123 999'));
  assert.ok(!isOwnerCommand('hola quiero el cuaderno'));
});

test('quantity list shows prices, savings and free shipping', () => {
  const c = chat(memoryStore());
  c.send('hola');
  const [{ msg }] = c.send({ buttonId: 'yes' });
  assert.equal(msg.type, 'list');
  assert.ok(msg.rows.length <= 10);
  for (const r of msg.rows) {
    assert.ok(r.title.length <= 24, r.title);
    assert.ok(r.description.length <= 72, r.description);
  }
  const three = msg.rows.find((r) => r.id === 'qty_3');
  assert.match(three.description, /Recomendado.*\$36\.00.*ahorras \$9\.00.*envío gratis/);
});

test('summary nudges to free shipping and "add" button upgrades the order', () => {
  const store = memoryStore();
  const c = chat(store);
  c.send('hola');
  c.send({ buttonId: 'yes' });
  c.send({ buttonId: 'qty_1' });
  c.send({ buttonId: 'up_no' }); // declined the first upsell
  c.send({ buttonId: 'delivery' });
  c.send('Ana Torres');
  c.send('1712345678');
  c.send('Cuenca');
  const [{ msg }] = c.send('Calle Larga 1-23 y Benigno Malo, junto a la farmacia');
  assert.match(msg.text, /Total: \$19\.50/);
  assert.match(msg.text, /Por solo \*\$16\.50 más\* te llevas 2 cuadernos más/);
  assert.deepEqual(msg.buttons.map((b) => b.id), ['confirm', 'add_more', 'edit']);
  const [{ msg: updated }] = c.send({ buttonId: 'add_more' });
  assert.equal(c.session.order.qty, 3);
  assert.match(updated.text, /Ahora tu envío es \*GRATIS\*/);
  assert.match(updated.text, /Total: \$36\.00/);
  c.send({ buttonId: 'confirm' });
  assert.equal(c.session.order.total, 36);
});

test('custom quantity and wholesale handoff', () => {
  const c = chat(memoryStore());
  c.send('hola');
  c.send({ buttonId: 'yes' });
  c.send({ buttonId: 'qty_more' });
  assert.equal(c.session.state, S.QTY_CUSTOM);
  c.send('quiero 7');
  assert.equal(c.session.order.qty, 7);
  assert.equal(c.session.state, S.METHOD); // 7 -> 8 is not a better deal: no upsell

  const w = chat(memoryStore(), '593982222222');
  w.send('hola');
  w.send('si');
  const out = w.send('50');
  assert.equal(w.session.state, S.HUMAN);
  assert.ok(out.some((o) => o.to === config.ownerPhone && /mayorista/.test(o.msg.text)));
});

test('pricing math', () => {
  assert.deepEqual(quote(2, 'delivery', config), { qty: 2, unit: 13.5, subtotal: 27, savings: 3, shipping: 4.5, total: 31.5 });
  assert.equal(quote(3, 'delivery', config).shipping, 0);
  assert.equal(quote(5, 'pickup', config).total, 55);
  assert.equal(nextUpgrade(1, config).extra, 12);
  assert.equal(nextUpgrade(2, config).unlocksShipping, true);
  assert.equal(nextUpgrade(3, config), null);
  assert.equal(nextUpgrade(4, config).qty, 5);
});

test('restart clears the upsell so it can be offered again', () => {
  const c = chat(memoryStore());
  c.send('hola');
  c.send('si');
  c.send({ buttonId: 'qty_1' });
  c.send('reiniciar');
  assert.equal(c.session.upsellShown, undefined);
});
