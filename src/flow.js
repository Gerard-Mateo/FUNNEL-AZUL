// The sales conversation, as a state machine.
//
//   ad click -> product + "¿lo quieres?" -> cantidad -> envío o retiro
//     envío  -> nombre -> cédula -> ciudad -> dirección -> resumen
//     retiro -> nombre -> resumen (con dirección de la tienda)
//   resumen -> método de pago (DeUna / transferencia) -> comprobante -> verificación
//
// This file never talks to WhatsApp directly. `handleCustomer` and `handleOwner`
// return a list of outgoing messages ({ to, msg }) and the server sends them.
// That keeps the logic easy to test (see test/flow.test.js).

import * as M from './messages.js';

export const S = {
  START: 'START',
  CONFIRM_PRODUCT: 'CONFIRM_PRODUCT',
  QTY: 'QTY',
  METHOD: 'METHOD',
  D_NAME: 'D_NAME',
  D_ID: 'D_ID',
  D_CITY: 'D_CITY',
  D_ADDRESS: 'D_ADDRESS',
  P_NAME: 'P_NAME',
  SUMMARY: 'SUMMARY',
  PAYMENT: 'PAYMENT',
  RECEIPT: 'RECEIPT',
  VERIFYING: 'VERIFYING',
  HUMAN: 'HUMAN',
};

export const newSession = (phone) => ({ phone, state: S.START, order: {} });

const norm = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

// Accept a tapped button id OR something the person typed that means the same.
const pick = (incoming, options) => {
  const id = incoming.buttonId;
  if (id && options[id]) return id;
  const text = norm(incoming.text);
  if (!text) return null;
  for (const [key, pattern] of Object.entries(options)) {
    if (pattern.test(text)) return key;
  }
  return null;
};

const YES = /^(si|sii+|sip|ok|okay|dale|claro|de una|lo quiero|quiero|me interesa|va|listo)\b/;
const NO = /^(no|nop|nel|todavia no|aun no)\b/;
const WANTS_HUMAN = /\b(asesor|asesora|humano|persona|ayuda|hablar con alguien)\b/;
const RESTART = /^(reiniciar|empezar|menu|inicio)$/;

export const totals = (order, cfg) => {
  const qty = order.qty ?? 1;
  const subtotal = round(qty * cfg.product.price);
  const shipping = order.method === 'delivery' ? cfg.shippingCost : 0;
  return { qty, subtotal, shipping, total: round(subtotal + shipping) };
};

const round = (n) => Math.round(n * 100) / 100;

const newOrderId = () =>
  'AZ' + Date.now().toString(36).slice(-4).toUpperCase() + Math.floor(Math.random() * 10);

/**
 * @param session  the customer's saved session (mutated and returned)
 * @param incoming { text?, buttonId?, imageId?, referral? }
 * @param ctx      { config, store }
 * @returns {{ session, out: Array<{to:string,msg:object}> }}
 */
export function handleCustomer(session, incoming, { config: cfg, store }) {
  const out = [];
  const reply = (...msgs) => msgs.forEach((msg) => out.push({ to: session.phone, msg }));
  const notifyOwner = (...msgs) =>
    cfg.ownerPhone && msgs.forEach((msg) => out.push({ to: cfg.ownerPhone, msg }));
  const go = (state) => (session.state = state);
  const text = (incoming.text ?? '').trim();

  if (incoming.referral && !session.adId) session.adId = incoming.referral.source_id;

  // --- Global shortcuts that work at any step ---
  if (RESTART.test(norm(text))) {
    Object.assign(session, newSession(session.phone));
  } else if (session.state === S.HUMAN) {
    return { session, out }; // a person is handling this chat; the bot stays quiet
  } else if (WANTS_HUMAN.test(norm(text))) {
    go(S.HUMAN);
    reply(M.handoffToHuman());
    notifyOwner(M.ownerHandoffAlert(session));
    return { session, out };
  }

  switch (session.state) {
    case S.START: {
      reply(M.productOffer(cfg));
      go(S.CONFIRM_PRODUCT);
      break;
    }

    case S.CONFIRM_PRODUCT: {
      const c = pick(incoming, { yes: YES, question: NO });
      if (c === 'yes') {
        reply(M.askQty());
        go(S.QTY);
      } else if (c === 'question') {
        go(S.HUMAN);
        reply(M.handoffToHuman());
        notifyOwner(M.ownerHandoffAlert(session));
      } else {
        reply(M.productOffer(cfg));
      }
      break;
    }

    case S.QTY: {
      const fromButton = incoming.buttonId?.startsWith('qty_')
        ? Number(incoming.buttonId.slice(4))
        : null;
      const qty = fromButton ?? Number.parseInt(text.match(/\d+/)?.[0] ?? '', 10);
      if (qty >= 1 && qty <= 20) {
        session.order.qty = qty;
        reply(M.askMethod(cfg));
        go(S.METHOD);
      } else {
        reply(M.askQty(true));
      }
      break;
    }

    case S.METHOD: {
      const c = pick(incoming, {
        delivery: /(envio|delivery|domicilio|enviar|laar|a mi casa)/,
        pickup: /(retir|tienda|local|recoger|paso)/,
      });
      if (c === 'delivery') {
        session.order.method = 'delivery';
        reply(M.askName());
        go(S.D_NAME);
      } else if (c === 'pickup') {
        session.order.method = 'pickup';
        reply(M.askName());
        go(S.P_NAME);
      } else {
        reply(M.askMethod(cfg));
      }
      break;
    }

    case S.D_NAME:
    case S.P_NAME: {
      if (text.length < 3) {
        reply(M.askName(true));
        break;
      }
      session.order.name = text;
      if (session.state === S.D_NAME) {
        reply(M.askCedula());
        go(S.D_ID);
      } else {
        reply(M.summary(session.order, cfg));
        go(S.SUMMARY);
      }
      break;
    }

    case S.D_ID: {
      const digits = text.replace(/\D/g, '');
      if (!/^\d{10}(\d{3})?$/.test(digits)) {
        reply(M.askCedula(true));
        break;
      }
      session.order.cedula = digits;
      reply(M.askCity());
      go(S.D_CITY);
      break;
    }

    case S.D_CITY: {
      if (text.length < 3) {
        reply(M.askCity(true));
        break;
      }
      session.order.city = text;
      reply(M.askAddress());
      go(S.D_ADDRESS);
      break;
    }

    case S.D_ADDRESS: {
      if (text.length < 10) {
        reply(M.askAddress(true));
        break;
      }
      session.order.address = text;
      reply(M.summary(session.order, cfg));
      go(S.SUMMARY);
      break;
    }

    case S.SUMMARY: {
      const c = pick(incoming, { confirm: YES, edit: /(corregir|cambiar|editar|no)/ });
      if (c === 'confirm') {
        const t = totals(session.order, cfg);
        Object.assign(session.order, t, {
          id: session.order.id ?? newOrderId(),
          phone: session.phone,
          adId: session.adId,
          status: 'awaiting_payment',
          createdAt: new Date().toISOString(),
        });
        store?.saveOrder(session.order);
        reply(M.askPayment(session.order));
        go(S.PAYMENT);
      } else if (c === 'edit') {
        session.order = { qty: session.order.qty };
        reply(M.askMethod(cfg));
        go(S.METHOD);
      } else {
        reply(M.summary(session.order, cfg));
      }
      break;
    }

    case S.PAYMENT: {
      const c = pick(incoming, {
        pay_deuna: /de ?una/,
        pay_transfer: /(transfer|deposito|banco)/,
      });
      if (c === 'pay_deuna') {
        session.order.paymentMethod = 'deuna';
        reply(...M.deunaInstructions(session.order, cfg));
        go(S.RECEIPT);
      } else if (c === 'pay_transfer') {
        session.order.paymentMethod = 'transferencia';
        reply(M.transferInstructions(session.order, cfg));
        go(S.RECEIPT);
      } else {
        reply(M.askPayment(session.order));
      }
      store?.saveOrder(session.order);
      break;
    }

    case S.RECEIPT: {
      if (incoming.imageId) {
        session.order.status = 'verifying';
        session.order.receiptMediaId = incoming.imageId;
        store?.saveOrder(session.order);
        reply(M.receiptReceived());
        notifyOwner(
          { type: 'forward_image', mediaId: incoming.imageId, caption: `Comprobante ${session.order.id}` },
          M.ownerNewPayment(session.order)
        );
        go(S.VERIFYING);
      } else if (pick(incoming, { switch: /(cambiar|otro metodo|otra forma)/ })) {
        reply(M.askPayment(session.order));
        go(S.PAYMENT);
      } else {
        reply(M.askReceipt());
      }
      break;
    }

    case S.VERIFYING: {
      if (incoming.imageId) {
        notifyOwner({
          type: 'forward_image',
          mediaId: incoming.imageId,
          caption: `Otra imagen del pedido ${session.order.id}`,
        });
      }
      reply(M.stillVerifying(session.order));
      break;
    }
  }

  return { session, out };
}

export const OWNER_COMMANDS = ['pagado', 'guia', 'bot', 'pedidos', 'responder', 'comandos'];

// Only messages that start with a command are treated as admin commands, so you
// can still test the customer flow from your own phone.
export const isOwnerCommand = (text = '') => OWNER_COMMANDS.includes(norm(text.split(/\s+/)[0]));

/**
 * Commands you send from your own WhatsApp (OWNER_PHONE) to the bot's number:
 *   pagado AZ12345          -> marks paid and tells the customer
 *   guia AZ12345 LAAR123    -> sends the LAAR tracking number to the customer
 *   bot 593991234567        -> gives a chat back to the bot (after "asesor")
 *   pedidos                 -> lists orders waiting for verification
 *   responder 5939... texto -> sends a message to a customer through the bot's number
 *   comandos                -> shows this list
 */
export function handleOwner(text, { config: cfg, store }) {
  const out = [];
  const toOwner = (msg) => out.push({ to: cfg.ownerPhone, msg });
  const [cmd, arg1, ...rest] = text.trim().split(/\s+/);

  switch (norm(cmd)) {
    case 'pagado': {
      const order = store.findOrder(arg1);
      if (!order) {
        toOwner(M.plain(`No encontré el pedido ${arg1}`));
        break;
      }
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      store.saveOrder(order);
      out.push({ to: order.phone, msg: M.paymentConfirmed(order, cfg) });
      const session = store.getSession(order.phone);
      if (session) {
        Object.assign(session, newSession(order.phone));
        session.lastOrderId = order.id;
        store.saveSession(session);
      }
      toOwner(M.plain(`✅ ${order.id} marcado como pagado. Cliente notificado.`));
      break;
    }
    case 'guia': {
      const order = store.findOrder(arg1);
      const tracking = rest.join(' ') || '';
      if (!order || !tracking) {
        toOwner(M.plain('Uso: guia <pedido> <número de guía LAAR>'));
        break;
      }
      order.tracking = tracking;
      order.status = 'shipped';
      store.saveOrder(order);
      out.push({ to: order.phone, msg: M.trackingSent(order) });
      toOwner(M.plain(`🚚 Guía enviada al cliente de ${order.id}.`));
      break;
    }
    case 'bot': {
      const session = store.getSession(arg1);
      if (!session) {
        toOwner(M.plain(`No encontré chat con ${arg1}`));
        break;
      }
      Object.assign(session, newSession(arg1));
      store.saveSession(session);
      toOwner(M.plain(`🤖 El bot vuelve a atender a ${arg1}.`));
      break;
    }
    case 'pedidos': {
      const pending = store.listOrders().filter((o) => o.status === 'verifying');
      toOwner(
        M.plain(
          pending.length
            ? pending.map((o) => `${o.id} · ${o.name} · $${o.total.toFixed(2)} · ${o.paymentMethod}`).join('\n')
            : 'No hay pagos por verificar 🙌'
        )
      );
      break;
    }
    case 'responder': {
      const message = rest.join(' ');
      if (!arg1 || !message) {
        toOwner(M.plain('Uso: responder <número> <mensaje>'));
        break;
      }
      out.push({ to: arg1, msg: M.plain(message) });
      break;
    }
    case 'comandos':
      toOwner(M.ownerHelp());
      break;
  }
  return out;
}
