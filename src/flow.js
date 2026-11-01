// The sales conversation, as a state machine.
//
//   ad click -> product: [Lo quiero] [Suscripción] [Pregunta]
//     compra      -> cantidad: [1] [Pack de 3] [Otra] -> envío o retiro
//                      envío  -> nombre -> cédula -> ciudad -> dirección -> resumen
//                      retiro -> nombre -> resumen (con dirección de la tienda)
//     suscripción -> [cada mes] [cada 2 meses] -> nombre -> cédula -> ciudad -> dirección -> resumen
//   resumen -> método de pago (DeUna / transferencia) -> comprobante -> verificación
//
//   Subscriptions: a few days before each delivery the server sends a payment
//   reminder (subscriptionReminders); the customer taps "Pagar envío" and pays.
//
// This file never talks to WhatsApp directly. It returns outgoing messages
// ({ to, msg }) and the server sends them. That keeps it easy to test.

import * as M from './messages.js';
import { quote } from './pricing.js';
import { addMonths, dueForReminder, todayEC } from './subscriptions.js';

export const S = {
  START: 'START',
  CONFIRM_PRODUCT: 'CONFIRM_PRODUCT',
  QTY: 'QTY',
  QTY_CUSTOM: 'QTY_CUSTOM',
  SUB_FREQ: 'SUB_FREQ',
  SUB_CANCEL: 'SUB_CANCEL',
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

// Start over but keep who the customer is and which ad brought them.
const resetSession = (session, phone = session.phone) => {
  for (const key of Object.keys(session)) if (key !== 'adId') delete session[key];
  Object.assign(session, newSession(phone));
};

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
const CANCEL_SUB = /^cancelar( mi| la)?( suscripcion)?$/;

export const totals = (order, cfg) => quote(order.qty ?? 1, order.method, cfg);

const shortId = (prefix) =>
  prefix + Date.now().toString(36).slice(-4).toUpperCase() + Math.floor(Math.random() * 10);
const newOrderId = () => shortId('AZ');
const newSubId = () => shortId('SUB');

const activeSub = (store, phone) =>
  store?.listSubscriptions?.().find((s) => s.phone === phone && s.status === 'active');

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
  const isSub = () => session.order.kind === 'subscription';
  const showSummary = () => reply(isSub() ? M.subSummary(session.order, cfg) : M.summary(session.order, cfg));

  if (incoming.referral && !session.adId) session.adId = incoming.referral.source_id;

  // --- Global shortcuts that work at any step ---
  if (RESTART.test(norm(text))) {
    resetSession(session);
  } else if (session.state === S.HUMAN) {
    return { session, out }; // a person is handling this chat; the bot stays quiet
  } else if (WANTS_HUMAN.test(norm(text))) {
    go(S.HUMAN);
    reply(M.handoffToHuman());
    notifyOwner(M.ownerHandoffAlert(session));
    return { session, out };
  }

  // Subscription reminder buttons ("Pagar envío" / "Cancelar suscripción")
  const btn = incoming.buttonId ?? '';
  if (btn.startsWith('sub_pay_')) {
    const sub = store.findSubscription(btn.slice('sub_pay_'.length));
    if (!sub || sub.status !== 'active') {
      reply(M.plain('No encontré una suscripción activa 🤔 Escribe *asesor* y te ayudamos.'));
      return { session, out };
    }
    session.order = {
      id: newOrderId(),
      kind: 'subscription',
      subId: sub.id,
      renewal: true,
      months: sub.months,
      qty: 1,
      method: 'delivery',
      name: sub.name,
      cedula: sub.cedula,
      city: sub.city,
      address: sub.address,
      unit: sub.price,
      subtotal: sub.price,
      savings: 0,
      shipping: 0,
      total: sub.price,
      phone: session.phone,
      status: 'awaiting_payment',
      createdAt: new Date().toISOString(),
    };
    store.saveOrder(session.order);
    reply(M.askPayment(session.order));
    go(S.PAYMENT);
    return { session, out };
  }
  const sub = activeSub(store, session.phone);
  if (sub && session.state !== S.SUB_CANCEL && (btn.startsWith('sub_cancel_') || CANCEL_SUB.test(norm(text)))) {
    reply(M.askCancelSub(sub));
    go(S.SUB_CANCEL);
    return { session, out };
  }

  switch (session.state) {
    case S.START: {
      reply(M.productOffer(cfg));
      go(S.CONFIRM_PRODUCT);
      break;
    }

    case S.CONFIRM_PRODUCT: {
      const c = pick(incoming, { sub: /suscri/, yes: YES, question: /^(no|pregunta|tengo una pregunta)/ });
      if (c === 'yes') {
        reply(M.askQty(cfg));
        go(S.QTY);
      } else if (c === 'sub') {
        reply(M.subOffer(cfg));
        go(S.SUB_FREQ);
      } else if (c === 'question') {
        go(S.HUMAN);
        reply(M.handoffToHuman());
        notifyOwner(M.ownerHandoffAlert(session));
      } else {
        reply(M.productOffer(cfg));
      }
      break;
    }

    case S.QTY:
    case S.QTY_CUSTOM: {
      if (pick(incoming, { qty_more: /^(otra|otra cantidad|mas)$/ })) {
        reply(M.askQtyNumber(cfg));
        go(S.QTY_CUSTOM);
        break;
      }
      let qty = /^qty_\d+$/.test(btn) ? Number(btn.slice(4)) : Number.parseInt(text.match(/\d+/)?.[0] ?? '', 10);
      if (!qty && /pack/.test(norm(text)) && M.packQty(cfg)) qty = M.packQty(cfg);
      if (qty > cfg.maxQty) {
        // Wholesale: a person negotiates the price
        session.order.qty = qty;
        go(S.HUMAN);
        reply(M.wholesale(qty));
        notifyOwner(M.ownerWholesaleAlert(session, qty));
        break;
      }
      if (!(qty >= 1)) {
        reply(session.state === S.QTY ? M.askQty(cfg, true) : M.askQtyNumber(cfg, true));
        break;
      }
      session.order = { kind: 'one-time', qty };
      reply(M.askMethod(cfg, qty));
      go(S.METHOD);
      break;
    }

    case S.SUB_FREQ: {
      const c = pick(incoming, {
        sub_1: /(cada mes|mensual|1 mes|^1$)/,
        sub_2: /(2 meses|dos meses|bimestral|^2$)/,
      });
      if (!c) {
        reply(M.subOffer(cfg));
        break;
      }
      session.order = { kind: 'subscription', months: c === 'sub_1' ? 1 : 2, qty: 1, method: 'delivery' };
      reply(M.askName());
      go(S.D_NAME);
      break;
    }

    case S.SUB_CANCEL: {
      const c = pick(incoming, { sub_cancel_yes: YES, sub_cancel_no: NO });
      const current = activeSub(store, session.phone);
      if (c === 'sub_cancel_yes' && current) {
        current.status = 'cancelled';
        current.cancelledAt = new Date().toISOString();
        store.saveSubscription(current);
        reply(M.subCancelled());
        notifyOwner(M.ownerSubCancelled(current));
        resetSession(session);
      } else if (c === 'sub_cancel_no' || !current) {
        reply(M.subKept());
        resetSession(session);
      } else {
        reply(M.askCancelSub(current));
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
        reply(M.askMethod(cfg, session.order.qty));
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
        showSummary();
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
      showSummary();
      go(S.SUMMARY);
      break;
    }

    case S.SUMMARY: {
      const c = pick(incoming, { confirm: YES, edit: /(corregir|cambiar|editar|no)/ });
      if (c === 'confirm') {
        const base = {
          id: session.order.id ?? newOrderId(),
          phone: session.phone,
          adId: session.adId,
          status: 'awaiting_payment',
          createdAt: new Date().toISOString(),
        };
        if (isSub()) {
          const price = cfg.subscription.price;
          const newSub = {
            id: session.order.subId ?? newSubId(),
            phone: session.phone,
            name: session.order.name,
            cedula: session.order.cedula,
            city: session.order.city,
            address: session.order.address,
            months: session.order.months,
            price,
            status: 'pending_payment',
            createdAt: base.createdAt,
          };
          store?.saveSubscription(newSub);
          Object.assign(session.order, base, {
            subId: newSub.id,
            unit: price,
            subtotal: price,
            savings: 0,
            shipping: 0,
            total: price,
          });
        } else {
          Object.assign(session.order, totals(session.order, cfg), base);
        }
        store?.saveOrder(session.order);
        reply(M.askPayment(session.order));
        go(S.PAYMENT);
      } else if (c === 'edit') {
        if (isSub()) {
          const { kind, months } = session.order;
          session.order = { kind, months, qty: 1, method: 'delivery' };
          reply(M.askName());
          go(S.D_NAME);
        } else {
          session.order = { kind: 'one-time', qty: session.order.qty };
          reply(M.askMethod(cfg, session.order.qty));
          go(S.METHOD);
        }
      } else {
        showSummary();
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

/**
 * Payment reminders for subscriptions whose next delivery is close.
 * The server runs this every hour; `today` is 'YYYY-MM-DD' (Ecuador time).
 */
export function subscriptionReminders(today, { config: cfg, store }) {
  const out = [];
  for (const sub of dueForReminder(store.listSubscriptions(), today, cfg.subscription.reminderDaysBefore)) {
    out.push({ to: sub.phone, msg: M.subReminder(sub, cfg) });
    if (cfg.ownerPhone) out.push({ to: cfg.ownerPhone, msg: M.ownerSubReminderSent(sub) });
    sub.remindedFor = sub.nextShipDate;
    store.saveSubscription(sub);
  }
  return out;
}

export const OWNER_COMMANDS = ['pagado', 'guia', 'bot', 'pedidos', 'suscripciones', 'recordar', 'responder', 'comandos'];

// Only messages that start with a command are treated as admin commands, so you
// can still test the customer flow from your own phone.
export const isOwnerCommand = (text = '') => OWNER_COMMANDS.includes(norm(text.split(/\s+/)[0]));

/**
 * Commands you send from your own WhatsApp (OWNER_PHONE) to the bot's number:
 *   pagado AZ12345          -> marks paid and tells the customer (activates/renews subscriptions)
 *   guia AZ12345 LAAR123    -> sends the LAAR tracking number to the customer
 *   pedidos                 -> lists orders waiting for verification
 *   suscripciones           -> lists active subscriptions and next delivery dates
 *   recordar SUB12345       -> sends the payment reminder for a subscription right now
 *   responder 5939... texto -> sends a message to a customer through the bot's number
 *   bot 593991234567        -> gives a chat back to the bot (after "asesor")
 *   comandos                -> shows this list
 */
export function handleOwner(text, { config: cfg, store, today = todayEC() }) {
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
      const sub = order.subId && store.findSubscription(order.subId);
      if (sub) {
        if (order.renewal) {
          sub.nextShipDate = addMonths(sub.nextShipDate, sub.months);
        } else {
          sub.status = 'active';
          sub.nextShipDate = addMonths(today, sub.months);
        }
        sub.lastPaidOrder = order.id;
        store.saveSubscription(sub);
        out.push({ to: order.phone, msg: order.renewal ? M.subRenewed(sub, cfg) : M.subActivated(sub, cfg) });
      } else {
        out.push({ to: order.phone, msg: M.paymentConfirmed(order, cfg) });
      }
      const session = store.getSession(order.phone);
      if (session) {
        resetSession(session, order.phone);
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
      resetSession(session, arg1);
      store.saveSession(session);
      toOwner(M.plain(`🤖 El bot vuelve a atender a ${arg1}.`));
      break;
    }
    case 'pedidos': {
      const pending = store.listOrders().filter((o) => o.status === 'verifying');
      toOwner(
        M.plain(
          pending.length
            ? pending
                .map((o) => `${o.id} · ${o.name} · ${o.subId ? 'suscripción' : `${o.qty} cuad.`} · $${o.total.toFixed(2)} · ${o.paymentMethod}`)
                .join('\n')
            : 'No hay pagos por verificar 🙌'
        )
      );
      break;
    }
    case 'suscripciones': {
      toOwner(M.ownerSubList(store.listSubscriptions().filter((s) => s.status === 'active')));
      break;
    }
    case 'recordar': {
      const sub = store.findSubscription(arg1);
      if (!sub || sub.status !== 'active') {
        toOwner(M.plain('Uso: recordar <SUB…> (de una suscripción activa)'));
        break;
      }
      sub.remindedFor = sub.nextShipDate;
      store.saveSubscription(sub);
      out.push({ to: sub.phone, msg: M.subReminder(sub, cfg) });
      toOwner(M.ownerSubReminderSent(sub));
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
