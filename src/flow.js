// The sales conversation, as a state machine. Designed for the fewest taps (docs/09-estrategia.md):
//
//   1. OFFER    photo + price                  [¡Lo quiero!] [Pregunta]
//   2. PLAN     the only upsell, right after yes [Comprar] [⭐ Club] [💎 Anual]   (or type a number)
//   3. ADDRESS  "ciudad y dirección" in one message, or [🏬 Retiro]  (returning customer: [✅ Misma])
//   4. NAME     one tap if the WhatsApp profile name looks real       (returning customer: skipped)
//   5. CEDULA   only for delivery                                      (returning customer: skipped)
//   6. SUMMARY  [✅ Confirmar y pagar] [➕ Agregar otro | 📅 frecuencia] [✏️ Corregir]
//   7. PAY      DeUna QR straight away, [🏦 Transferencia] one tap away -> receipt photo
//   8. VERIFYING until you reply "pagado AZ123"
//
//   Club Azul: before each delivery the customer gets a renewal reminder (template) -> pays.
//   Plan Anual: paid once; before each delivery YOU get "toca enviar"; at the end it asks to renew.
//
// This file never talks to WhatsApp directly. It returns outgoing messages ({ to, msg })
// and the server sends them. That keeps it easy to test (test/flow.test.js).

import * as M from './messages.js';
import { quote, planQuote } from './pricing.js';
import { addMonths, dueForReminder, todayEC } from './subscriptions.js';

export const S = {
  START: 'START',
  OFFER: 'OFFER',
  PLAN: 'PLAN',
  ADDRESS: 'ADDRESS',
  NAME: 'NAME',
  CEDULA: 'CEDULA',
  SUMMARY: 'SUMMARY',
  PAY: 'PAY',
  VERIFYING: 'VERIFYING',
  SUB_CANCEL: 'SUB_CANCEL',
  HUMAN: 'HUMAN',
};

export const newSession = (phone) => ({ phone, state: S.START, order: {} });

// Start over but keep who the customer is, which ad brought them and their profile name.
const KEEP = ['adId', 'profileName', 'lastInboundAt'];
const resetSession = (session, phone = session.phone) => {
  for (const key of Object.keys(session)) if (!KEEP.includes(key)) delete session[key];
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

const YES = /^(si|sii+|sip|ok|okay|dale|claro|de una|lo quiero|quiero|me interesa|va|listo|confirmo|correcto)\b/;
const NO = /^(no|nop|nel|todavia no|aun no)\b/;
const WANTS_HUMAN = /\b(asesor|asesora|humano|persona|ayuda|hablar con alguien)\b/;
const RESTART = /^(reiniciar|empezar|menu|inicio)$/;
const CANCEL_SUB = /^cancelar( mi| la)?( suscripcion| club| plan)?$/;
const WINDOW_MS = 23 * 60 * 60 * 1000; // WhatsApp's free-form window is 24 h; keep a margin

// A profile name is worth offering only if it looks like "Nombre Apellido".
export const looksLikeName = (s = '') => /^[\p{L}][\p{L}'.-]+(\s+[\p{L}][\p{L}'.-]+)+$/u.test(s.trim());

export const totals = (order, cfg) => quote(order.qty ?? 1, order.method, cfg);

const shortId = (prefix) =>
  prefix + Date.now().toString(36).slice(-4).toUpperCase() + Math.floor(Math.random() * 10);
const newOrderId = () => shortId('AZ');
const newSubId = () => shortId('SUB');

const activeSub = (store, phone) =>
  store?.listSubscriptions?.().find((s) => s.phone === phone && s.status === 'active' && s.renew !== false);

// Outside the 24 h window WhatsApp only accepts templates.
const inWindow = (store, phone, now) => {
  const last = store.getSession(phone)?.lastInboundAt;
  return Boolean(last) && now - last < WINDOW_MS;
};

/**
 * @param session  the customer's saved session (mutated and returned)
 * @param incoming { text?, buttonId?, imageId?, referral?, profileName? }
 * @param ctx      { config, store }
 * @returns {{ session, out: Array<{to:string,msg:object}> }}
 */
export function handleCustomer(session, incoming, { config: cfg, store, now = Date.now() }) {
  const out = [];
  const reply = (...msgs) => msgs.forEach((msg) => out.push({ to: session.phone, msg }));
  const notifyOwner = (...msgs) =>
    cfg.ownerPhone && msgs.forEach((msg) => out.push({ to: cfg.ownerPhone, msg }));
  const go = (state) => (session.state = state);
  const text = (incoming.text ?? '').trim();
  const btn = incoming.buttonId ?? '';
  const order = () => session.order;
  const isSub = () => order().kind === 'subscription';
  const customer = () => store?.getCustomer?.(session.phone);

  session.lastInboundAt = now;
  if (incoming.profileName) session.profileName = incoming.profileName;
  if (incoming.referral && !session.adId) session.adId = incoming.referral.source_id;

  const toHuman = (msg = M.handoffToHuman(), alert = M.ownerHandoffAlert(session)) => {
    go(S.HUMAN);
    reply(msg);
    notifyOwner(alert);
  };

  // --- Step helpers (each one asks the next missing thing) ---
  const askForAddress = () => {
    const known = customer();
    if (known?.address && !session.forceNewAddress) reply(M.askSameAddress(known, order()));
    else reply(M.askAddress(order(), cfg));
    go(S.ADDRESS);
  };
  const askForCedulaOrSummary = () => {
    if (order().method === 'delivery' && cfg.askCedula !== false && !order().cedula) {
      reply(M.askCedula());
      go(S.CEDULA);
    } else {
      reply(M.summary(order(), cfg));
      go(S.SUMMARY);
    }
  };
  const askForName = () => {
    const known = customer();
    if (known?.name && !session.forceNewAddress) {
      order().name = known.name;
      if (order().method === 'delivery' && known.cedula) order().cedula = known.cedula;
      return askForCedulaOrSummary();
    }
    reply(looksLikeName(session.profileName) ? M.askNameConfirm(session.profileName) : M.askName());
    go(S.NAME);
  };
  const choosePlan = (plan, qty = 1) => {
    session.order =
      plan === 'single'
        ? { kind: 'one-time', qty }
        : { kind: 'subscription', plan, months: cfg.subscription.defaultMonths, qty: 1, method: 'delivery' };
    askForAddress();
  };

  // --- Global shortcuts that work at any step ---
  if (RESTART.test(norm(text))) {
    resetSession(session);
  } else if (session.state === S.HUMAN) {
    return { session, out }; // a person is handling this chat; the bot stays quiet
  } else if (WANTS_HUMAN.test(norm(text))) {
    toHuman();
    return { session, out };
  }

  // Renewal reminder buttons ("Pagar" / "Cancelar suscripción")
  if (btn.startsWith('sub_pay_')) {
    const sub = store.findSubscription(btn.slice('sub_pay_'.length));
    if (!sub || sub.status !== 'active') {
      reply(M.plain('No encontré una suscripción activa 🤔 Escribe *asesor* y te ayudamos.'));
      return { session, out };
    }
    session.order = {
      id: newOrderId(),
      kind: 'subscription',
      plan: sub.plan,
      subId: sub.id,
      renewal: true,
      months: sub.months,
      deliveries: sub.deliveries,
      qty: 1,
      method: 'delivery',
      name: sub.name,
      cedula: sub.cedula,
      city: sub.city,
      address: sub.address,
      unit: sub.unit,
      subtotal: sub.price,
      savings: 0,
      shipping: 0,
      total: sub.price,
      phone: session.phone,
      paymentMethod: 'deuna',
      status: 'awaiting_payment',
      createdAt: new Date(now).toISOString(),
    };
    store.saveOrder(session.order);
    reply(M.payDeuna(session.order, cfg));
    go(S.PAY);
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
      go(S.OFFER);
      break;
    }

    case S.OFFER: {
      const c = pick(incoming, { yes: YES, question: /^(no|pregunta|tengo una pregunta)/ });
      if (c === 'yes') {
        reply(M.planOffer(cfg));
        go(S.PLAN);
      } else if (c === 'question') {
        toHuman();
      } else {
        reply(M.productOffer(cfg));
      }
      break;
    }

    case S.PLAN: {
      const c = pick(incoming, {
        plan_annual: /(anual|ano|año)/,
        plan_club: /(club|suscri|mensual)/,
        plan_single: /^(comprar|compra|solo|uno|este|1 cuaderno)/,
      });
      const typedQty = Number.parseInt(text.match(/\d+/)?.[0] ?? '', 10);
      if (c === 'plan_annual' && cfg.subscription.annualPrice > 0) {
        choosePlan('annual');
      } else if (c === 'plan_club') {
        choosePlan('club');
      } else if (c === 'plan_single') {
        choosePlan('single');
      } else if (typedQty > cfg.maxQty) {
        session.order = { kind: 'one-time', qty: typedQty };
        toHuman(M.wholesale(typedQty), M.ownerWholesaleAlert(session, typedQty));
      } else if (typedQty >= 1) {
        choosePlan('single', typedQty);
      } else {
        reply(M.planOffer(cfg, true));
      }
      break;
    }

    case S.ADDRESS: {
      const known = customer();
      // Anchored patterns: a typed address like "frente a la tienda Tía" must not count as pickup.
      const c = pick(incoming, {
        pickup: /^(retiro|retirar|prefiero retirar|lo retiro|paso a retirar|en (la )?tienda|tienda|recoger)\b/,
        same_address: /^(si|sii|ok|dale|claro|a esa|la misma|misma)\b/,
        other_address: /^(otra|otra direccion|no)\b/,
      });
      if (c === 'pickup' && !isSub()) {
        order().method = 'pickup';
        askForName();
      } else if (c === 'same_address' && known?.address && !session.forceNewAddress) {
        Object.assign(order(), { method: 'delivery', address: known.address, city: known.city });
        askForName();
      } else if (c === 'other_address') {
        session.forceNewAddress = true;
        reply(M.askAddress(order(), cfg));
      } else if (text.length >= 12 && !c) {
        Object.assign(order(), { method: 'delivery', address: text, city: text.split(/[,\n]/)[0].trim() });
        askForName();
      } else {
        reply(M.askAddress(order(), cfg, true));
      }
      break;
    }

    case S.NAME: {
      const c = pick(incoming, { name_ok: YES, name_other: /^(otro|otro nombre|no)$/ });
      if (c === 'name_ok' && looksLikeName(session.profileName)) {
        order().name = session.profileName;
        askForCedulaOrSummary();
      } else if (c === 'name_other') {
        reply(M.askName());
      } else if (text.length >= 3 && !c) {
        order().name = text;
        askForCedulaOrSummary();
      } else {
        reply(M.askName(true));
      }
      break;
    }

    case S.CEDULA: {
      const digits = text.replace(/\D/g, '');
      if (!/^\d{10}(\d{3})?$/.test(digits)) {
        reply(M.askCedula(true));
        break;
      }
      order().cedula = digits;
      reply(M.summary(order(), cfg));
      go(S.SUMMARY);
      break;
    }

    case S.SUMMARY: {
      const c = pick(incoming, {
        toggle_freq: /(cada mes|cada 2 meses|cada dos meses|mensual|bimestral)/,
        add_one: /^(agregar|otro|uno mas|mas|\+)/,
        remove_one: /^(quitar|uno menos|menos|-)/,
        confirm: YES,
        edit: /(corregir|cambiar|editar|no)/,
      });
      if (c === 'toggle_freq' && isSub()) {
        order().months = order().months === 1 ? 2 : 1;
        reply(M.summary(order(), cfg));
      } else if (c === 'add_one' && !isSub()) {
        if (order().qty >= cfg.maxQty) {
          toHuman(M.wholesale(order().qty + 1), M.ownerWholesaleAlert(session, order().qty + 1));
          break;
        }
        order().qty += 1;
        reply(M.summary(order(), cfg));
      } else if (c === 'remove_one' && !isSub() && order().qty > 1) {
        order().qty -= 1;
        reply(M.summary(order(), cfg));
      } else if (c === 'confirm') {
        const base = {
          id: order().id ?? newOrderId(),
          phone: session.phone,
          adId: session.adId,
          paymentMethod: 'deuna',
          status: 'awaiting_payment',
          createdAt: new Date(now).toISOString(),
        };
        if (isSub()) {
          const p = planQuote(order().plan, order().months, cfg);
          const newSub = {
            id: order().subId ?? newSubId(),
            phone: session.phone,
            plan: order().plan,
            months: order().months,
            deliveries: p.deliveries, // notebooks covered by each payment
            unit: p.unit,
            price: p.total, // what each payment costs
            name: order().name,
            cedula: order().cedula,
            city: order().city,
            address: order().address,
            status: 'pending_payment',
            renew: true,
            createdAt: base.createdAt,
          };
          store?.saveSubscription(newSub);
          Object.assign(order(), base, {
            subId: newSub.id,
            deliveries: p.deliveries,
            unit: p.unit,
            subtotal: p.total,
            savings: p.savings,
            shipping: 0,
            total: p.total,
          });
        } else {
          Object.assign(order(), totals(order(), cfg), base);
        }
        store?.saveOrder(order());
        store?.saveCustomer?.({
          phone: session.phone,
          name: order().name,
          ...(order().cedula ? { cedula: order().cedula } : {}),
          ...(order().method === 'delivery' ? { address: order().address, city: order().city } : {}),
        });
        delete session.forceNewAddress;
        reply(M.payDeuna(order(), cfg));
        go(S.PAY);
      } else if (c === 'edit') {
        const { kind, plan, months, qty } = order();
        session.order = { kind, plan, months, qty, ...(kind === 'subscription' ? { method: 'delivery' } : {}) };
        session.forceNewAddress = true;
        reply(M.askAddress(order(), cfg));
        go(S.ADDRESS);
      } else {
        reply(M.summary(order(), cfg));
      }
      break;
    }

    case S.PAY: {
      const c = pick(incoming, { pay_transfer: /(transfer|deposito|banco)/, pay_deuna: /de ?una/ });
      if (incoming.imageId) {
        Object.assign(order(), { status: 'verifying', receiptMediaId: incoming.imageId });
        store?.saveOrder(order());
        reply(M.receiptReceived());
        notifyOwner(
          { type: 'forward_image', mediaId: incoming.imageId, caption: `Comprobante ${order().id}` },
          M.ownerNewPayment(order())
        );
        go(S.VERIFYING);
      } else if (c === 'pay_transfer') {
        order().paymentMethod = 'transferencia';
        store?.saveOrder(order());
        reply(M.transferInstructions(order(), cfg));
      } else if (c === 'pay_deuna') {
        order().paymentMethod = 'deuna';
        store?.saveOrder(order());
        reply(M.payDeuna(order(), cfg));
      } else {
        reply(M.askReceipt());
      }
      break;
    }

    case S.VERIFYING: {
      if (incoming.imageId) {
        notifyOwner({ type: 'forward_image', mediaId: incoming.imageId, caption: `Otra imagen del pedido ${order().id}` });
      }
      reply(M.stillVerifying(order()));
      break;
    }

    case S.SUB_CANCEL: {
      const c = pick(incoming, { sub_cancel_yes: YES, sub_cancel_no: NO });
      const current = activeSub(store, session.phone);
      if (c === 'sub_cancel_yes' && current) {
        // A prepaid annual plan keeps shipping what was paid; it just won't renew.
        if (current.deliveriesLeft > 0) current.renew = false;
        else current.status = 'cancelled';
        current.cancelledAt = new Date(now).toISOString();
        store.saveSubscription(current);
        reply(M.subCancelled(current));
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
  }

  return { session, out };
}

/**
 * Runs every hour (server.js). For each subscription whose next delivery is close:
 *  - prepaid deliveries left (Plan Anual) -> tells YOU to ship it
 *  - nothing left to ship                 -> asks the customer to renew (template)
 */
export function subscriptionReminders(today, { config: cfg, store }) {
  const out = [];
  for (const sub of dueForReminder(store.listSubscriptions(), today, cfg.subscription.reminderDaysBefore)) {
    if (sub.deliveriesLeft > 0) {
      if (cfg.ownerPhone) out.push({ to: cfg.ownerPhone, msg: M.ownerShipDue(sub) });
    } else if (sub.renew === false) {
      sub.status = 'ended';
    } else {
      out.push({ to: sub.phone, msg: M.renewalReminder(sub, cfg) });
      if (cfg.ownerPhone) out.push({ to: cfg.ownerPhone, msg: M.ownerRenewalSent(sub) });
    }
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
 * Commands you send from your own WhatsApp (OWNER_PHONE) to the bot's number. See M.ownerHelp().
 */
export function handleOwner(text, { config: cfg, store, today = todayEC(), now = Date.now() }) {
  const out = [];
  const toOwner = (msg) => out.push({ to: cfg.ownerPhone, msg });
  const [cmd, arg1 = '', ...rest] = text.trim().split(/\s+/);
  const resetCustomer = (phone, lastOrderId) => {
    const session = store.getSession(phone);
    if (!session) return;
    resetSession(session, phone);
    if (lastOrderId) session.lastOrderId = lastOrderId;
    store.saveSession(session);
  };

  switch (norm(cmd)) {
    case 'pagado': {
      const order = store.findOrder(arg1);
      if (!order) {
        toOwner(M.plain(`No encontré el pedido ${arg1}`));
        break;
      }
      order.status = 'paid';
      order.paidAt = new Date(now).toISOString();
      store.saveOrder(order);
      const sub = order.subId && store.findSubscription(order.subId);
      if (sub) {
        // This payment covers `deliveries` notebooks; the first one ships now.
        sub.deliveriesLeft = sub.deliveries - 1;
        sub.nextShipDate = addMonths(order.renewal ? sub.nextShipDate : today, sub.months);
        sub.status = 'active';
        sub.lastPaidOrder = order.id;
        store.saveSubscription(sub);
        out.push({ to: order.phone, msg: order.renewal ? M.subRenewed(sub, cfg) : M.subActivated(sub, cfg) });
      } else {
        out.push({ to: order.phone, msg: M.paymentConfirmed(order, cfg) });
      }
      resetCustomer(order.phone, order.id);
      toOwner(M.plain(`✅ ${order.id} marcado como pagado. Cliente notificado.`));
      break;
    }
    case 'guia': {
      const tracking = rest.join(' ');
      const sub = arg1.toUpperCase().startsWith('SUB') && store.findSubscription(arg1);
      const order = !sub && store.findOrder(arg1);
      if ((!sub && !order) || !tracking) {
        toOwner(M.plain('Uso: guia <AZ… o SUB…> <número de guía LAAR>'));
        break;
      }
      let phone, name;
      if (sub) {
        if (!(sub.deliveriesLeft > 0)) {
          toOwner(M.plain(`${sub.id} no tiene envíos prepagados pendientes.`));
          break;
        }
        const n = sub.deliveries - sub.deliveriesLeft + 1;
        sub.deliveriesLeft -= 1;
        sub.nextShipDate = addMonths(sub.nextShipDate, sub.months);
        (sub.shipments ??= []).push({ tracking, at: new Date(now).toISOString() });
        store.saveSubscription(sub);
        ({ phone, name } = sub);
        toOwner(M.plain(`🚚 Cuaderno ${n} de ${sub.deliveries} de ${sub.id} despachado. Cliente notificado.`));
      } else {
        Object.assign(order, { tracking, status: 'shipped' });
        store.saveOrder(order);
        ({ phone, name } = order);
        toOwner(M.plain(`🚚 Guía enviada al cliente de ${order.id}.`));
      }
      out.unshift({
        to: phone,
        msg: inWindow(store, phone, now) ? M.trackingSent({ tracking }) : M.trackingTemplate(name, tracking, cfg),
      });
      break;
    }
    case 'bot': {
      if (!store.getSession(arg1)) {
        toOwner(M.plain(`No encontré chat con ${arg1}`));
        break;
      }
      resetCustomer(arg1);
      toOwner(M.plain(`🤖 El bot vuelve a atender a ${arg1}.`));
      break;
    }
    case 'pedidos': {
      const pending = store.listOrders().filter((o) => o.status === 'verifying');
      toOwner(
        M.plain(
          pending.length
            ? pending
                .map((o) => `${o.id} · ${o.name} · ${o.subId ? o.plan : `${o.qty} cuad.`} · $${o.total.toFixed(2)} · ${o.paymentMethod}`)
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
      out.push({ to: sub.phone, msg: M.renewalReminder(sub, cfg) });
      toOwner(M.ownerRenewalSent(sub));
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
