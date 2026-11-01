// Every text the bot sends. Edit freely to match your brand voice.
// WhatsApp limits: max 3 buttons per message, button titles max 20 characters.
// Why each message is written this way: docs/09-estrategia.md

import { quote, hasFreeShipping, planQuote } from './pricing.js';
import { freqLabel, formatDate, planName } from './subscriptions.js';

const $ = (n) => `$${Number(n).toFixed(2)}`;
const $short = (n) => (Number.isInteger(Number(n)) ? `$${Number(n)}` : $(n)); // "$15" instead of "$15.00" in tight spots

export const plain = (text) => ({ type: 'text', text });

const buttons = (text, list, headerImage) => ({
  type: 'buttons',
  text,
  buttons: list.map(([id, title]) => ({ id, title })),
  ...(headerImage ? { headerImage } : {}),
});

const cuadernos = (n) => (n === 1 ? '1 cuaderno' : `${n} cuadernos`);
const firstName = (name = '') => name.split(' ')[0];

// ---------- 1. Offer: one decision, "yes" ----------

export const productOffer = (cfg) =>
  buttons(
    `¡Hola! 💙 Este es *${cfg.product.name}*\n` +
      `${cfg.product.description}\n\n` +
      `💵 *${$(cfg.product.price)}*\n` +
      `🚚 Envío a todo Ecuador o retiro GRATIS en tienda`,
    [
      ['yes', '¡Lo quiero! 😍'],
      ['question', 'Tengo una pregunta'],
    ],
    cfg.product.imageUrl || undefined
  );

// ---------- 2. The upsell: right after "yes", one message, 3 options ----------
// One-time purchase (any quantity) · Club (target, in the middle) · Annual (anchor, biggest saving)

export const planOffer = (cfg, retry = false) => {
  const months = cfg.subscription.defaultMonths;
  const club = planQuote('club', months, cfg);
  const annual = cfg.subscription.annualPrice > 0 ? planQuote('annual', months, cfg) : null;
  const opts = [
    ['plan_single', `Comprar · ${$short(cfg.product.price)} c/u`],
    ['plan_club', `⭐ Club · ${$short(club.unit)} c/u`],
    ...(annual ? [['plan_annual', `💎 Anual · ${$short(annual.total)}`]] : []),
  ];

  // With the plans card (assets/planes.jpg) the image does the comparing: keep the text short.
  if (cfg.planImageUrl) {
    return buttons(
      (retry ? 'Toca una opción 👇' : '¡Buenísimo! 🙌 Antes de tus datos, mira esto 👀') +
        `\n\n⭐ Con el *Club* o el *Anual* el envío es *GRATIS* y cada cuaderno te sale más barato. ` +
        `El Club lo cancelas cuando quieras.` +
        (cfg.freeShippingFrom ? `\n\n🛍️ En compra única, envío gratis desde ${cfg.freeShippingFrom}.` : ''),
      opts,
      cfg.planImageUrl
    );
  }

  const lines = [
    retry ? 'Toca una opción 👇' : '¡Buenísimo! 🙌 Antes de tus datos, mira esto 👀',
    '',
    `🛍️ *Compra única*: ${$short(cfg.product.price)} c/u (+ ${$(cfg.shippingCost)} de envío` +
      (cfg.freeShippingFrom ? `, gratis desde ${cfg.freeShippingFrom})` : ')'),
    '',
    `⭐ *Club Azul*: uno nuevo ${freqLabel(months)} a *${$short(club.unit)}*, envío GRATIS.`,
    `Ahorras ${$short(club.savings)} en cada envío y cancelas cuando quieras.`,
  ];
  if (annual) {
    lines.push(
      '',
      `💎 *Anual*: ${cuadernos(annual.deliveries)} por *${$short(annual.total)}* (${$short(annual.unit)} c/u), un solo pago, envío GRATIS.`,
      `*Ahorras ${$short(annual.savings)}* en el año.`
    );
  }
  return buttons(lines.join('\n'), opts);
};

export const wholesale = (qty) =>
  plain(
    `¡Wow, ${cuadernos(qty)}! 🤩 Para pedidos grandes te hacemos *precio mayorista*.\n` +
      'Una persona de nuestro equipo te escribe en breve por aquí 🙌\n\n(Escribe *reiniciar* para volver al menú)'
  );

// ---------- 3. Data: address (or pickup) -> name -> cédula ----------

export const askAddress = (order, cfg, retry = false) => {
  const isSub = order.kind === 'subscription';
  const freeShip = isSub || hasFreeShipping(order.qty, cfg);
  const text =
    (retry ? 'Necesito un poquito más de detalle 🙏\n\n' : '') +
    '📍 ¿A dónde te lo enviamos?\n' +
    'Escribe tu *ciudad y dirección* en un mensaje.\n' +
    '_Ej: Quito, Av. Amazonas N34 y Rusia, casa azul frente al parque_\n\n' +
    (freeShip
      ? `🚚 Envío LAAR *GRATIS* · ${cfg.deliveryDays}`
      : `🚚 Envío LAAR ${$(cfg.shippingCost)} · ${cfg.deliveryDays}\n🏬 O retíralo *GRATIS* en nuestra tienda 👇`);
  return isSub ? plain(text) : buttons(text, [['pickup', '🏬 Prefiero retirar']]);
};

// Returning customer: one tap instead of typing everything again.
export const askSameAddress = (customer, order) =>
  buttons(`¿Te lo enviamos a la misma dirección? 📍\n${customer.address}`, [
    ['same_address', '✅ Sí, a esa'],
    ['other_address', 'Otra dirección'],
    ...(order.kind === 'subscription' ? [] : [['pickup', '🏬 Prefiero retirar']]),
  ]);

// WhatsApp gives us the profile name: confirming it is one tap.
export const askNameConfirm = (profileName) =>
  buttons(`¿El pedido va a nombre de *${profileName}*?`, [
    ['name_ok', '✅ Sí'],
    ['name_other', 'Otro nombre'],
  ]);

export const askName = (retry = false) =>
  plain(retry ? 'Escríbeme tu nombre y apellido, porfa 🙏' : '¿A nombre de quién va? (nombre y apellido)');

export const askCedula = (retry = false) =>
  plain(
    retry
      ? 'Mmm, eso no parece una cédula. Escribe los 10 dígitos (o 13 si es RUC) 🙏'
      : '🪪 Tu número de cédula, porfa (LAAR lo pide para la guía).'
  );

// ---------- 4. Summary ----------

const customerLines = (order, cfg) => {
  const who = `👤 ${order.name}${order.cedula ? ` · ${order.cedula}` : ''}`;
  return order.method === 'pickup'
    ? [who, `🏬 Retiras en: ${cfg.store.address}`, `🕒 ${cfg.store.hours}`, `🗺️ ${cfg.store.mapsUrl}`]
    : [who, `📍 ${order.address}`];
};

export const summary = (order, cfg) => {
  const isSub = order.kind === 'subscription';
  const lines = [];
  if (isSub) {
    const p = planQuote(order.plan, order.months, cfg);
    lines.push(`📝 *Tu ${planName(order.plan)}*`, '');
    if (order.plan === 'annual') {
      lines.push(
        `📅 ${cuadernos(p.deliveries)}, uno ${freqLabel(p.months)}`,
        `💵 ${$(p.total)} (${$(p.unit)} c/u), envío incluido`,
        `🎉 Ahorras ${$(p.savings)}`
      );
    } else {
      lines.push(`📅 1 cuaderno ${freqLabel(p.months)}`, `💵 ${$(p.unit)} por envío, envío incluido`);
    }
    lines.push('🚚 El primero sale apenas confirmes el pago', `*Hoy pagas: ${$(p.total)}*`);
  } else {
    const q = quote(order.qty, order.method, cfg);
    lines.push(
      '📝 *Tu pedido*',
      '',
      order.qty === 1
        ? `1 × ${cfg.product.name} — ${$(q.subtotal)}`
        : `${order.qty} × ${cfg.product.name} (${$(q.unit)} c/u) — ${$(q.subtotal)}`
    );
    if (q.savings > 0) lines.push(`🎉 Ahorras ${$(q.savings)}`);
    lines.push(
      order.method === 'pickup' ? '🏬 Retiro en tienda — GRATIS' : `🚚 Envío LAAR — ${q.shipping ? $(q.shipping) : 'GRATIS 🎉'}`,
      `*Total: ${$(q.total)}*`
    );
    if (order.qty > 1) lines.push('_(Para quitar uno, escribe *quitar*)_');
  }
  lines.push('', ...customerLines(order, cfg));
  return buttons(lines.join('\n'), [
    ['confirm', '✅ Confirmar y pagar'],
    // Subscriptions: switch frequency here. One-time: a cart "+" to take several (no extra question).
    isSub
      ? ['toggle_freq', order.months === 1 ? '📅 Cada 2 meses' : '📅 Mejor cada mes']
      : ['add_one', '➕ Agregar otro'],
    ['edit', '✏️ Corregir'],
  ]);
};

// ---------- 5. Payment: DeUna QR straight away, transfer one tap away ----------

export const payDeuna = (order, cfg, intro = '') =>
  buttons(
    intro +
      `¡Listo! Pedido *${order.id}* 🎉\n\n` +
      `⚡ Paga *${$(order.total)}* con *DeUna*: escanea el QR desde DeUna o desde la app de tu banco.` +
      (cfg.deunaPhone ? `\n¿No puedes escanear? Paga al ${cfg.deunaPhone}` : '') +
      `\n\nDespués mándame aquí la *captura* 📸`,
    [['pay_transfer', '🏦 Transferencia']],
    cfg.deunaQrUrl || undefined
  );

export const transferInstructions = (order, cfg) =>
  buttons(
    `🏦 *Datos para transferencia*\n\n` +
      `Banco: ${cfg.bank.name}\n` +
      `Cuenta ${cfg.bank.accountType}: ${cfg.bank.accountNumber}\n` +
      `Titular: ${cfg.bank.holder}\n` +
      `C.I./RUC: ${cfg.bank.holderId}\n` +
      (cfg.bank.email ? `Correo: ${cfg.bank.email}\n` : '') +
      `\nMonto: *${$(order.total)}*\n` +
      `Referencia: *${order.id}*\n\n` +
      `Después mándame aquí la *captura* 📸`,
    [['pay_deuna', '⚡ Mejor DeUna']]
  );

export const askReceipt = () =>
  plain('Estoy esperando la *captura* de tu pago 📸\n\n¿Necesitas ayuda? Escribe *asesor*.');

export const receiptReceived = () =>
  plain('¡Recibido! 🙌 Estamos verificando tu pago, te confirmamos en unos minutos 💙');

export const stillVerifying = (order) =>
  plain(`Seguimos verificando el pago del pedido *${order.id}* ⏳ Te escribimos apenas esté listo.`);

// ---------- 6. After payment ----------

export const paymentConfirmed = (order, cfg) =>
  plain(
    order.method === 'delivery'
      ? `✅ ¡Pago confirmado! Tu pedido *${order.id}* sale con LAAR (${cfg.deliveryDays}) 🚚\n` +
          `Te mando la guía apenas lo despachemos. ¡Gracias por tu compra! 💙`
      : `✅ ¡Pago confirmado! Tu pedido *${order.id}* te espera en la tienda 🏬\n\n` +
          `📍 ${cfg.store.address}\n🕒 ${cfg.store.hours}\n🗺️ ${cfg.store.mapsUrl}\n\n` +
          `Di tu nombre o el código *${order.id}* al llegar. ¡Gracias por tu compra! 💙`
  );

export const subActivated = (sub, cfg) =>
  plain(
    `✅ ¡Pago confirmado! Bienvenida/o al *${planName(sub.plan)}* 💙\n\n` +
      (sub.plan === 'annual'
        ? `Tu cuaderno 1 de ${sub.deliveries} sale con LAAR (${cfg.deliveryDays}).\n` +
          `📅 El siguiente: *${formatDate(sub.nextShipDate)}*. Ya está pagado, no tienes que hacer nada más ✨`
        : `Tu primer cuaderno sale con LAAR (${cfg.deliveryDays}).\n` +
          `📅 El siguiente: *${formatDate(sub.nextShipDate)}*. Te escribimos unos días antes para el pago.\n` +
          `Para cancelar, escribe *cancelar* cuando quieras.`)
  );

export const subRenewed = (sub, cfg) =>
  plain(
    `✅ ¡Pago confirmado! Tu cuaderno sale con LAAR (${cfg.deliveryDays}) 🚚\n` +
      `📅 El siguiente: *${formatDate(sub.nextShipDate)}*`
  );

export const trackingSent = (order) =>
  plain(`🚚 ¡Tu cuaderno ya está en camino!\n\nGuía LAAR: *${order.tracking}*\nRastréalo en laarcourier.com 📦`);

// ---------- Templates (WhatsApp only lets you write first, or after 24 h, with approved templates) ----------
// `text` is only a preview for the simulator/demo; WhatsApp shows the approved template text.

export const renewalReminder = (sub, cfg) => ({
  type: 'template',
  name: cfg.templates.renewal,
  lang: cfg.templates.lang,
  params: [firstName(sub.name), formatDate(sub.nextShipDate), $(sub.price)],
  text:
    `Hola ${firstName(sub.name)} 💙 Tu suscripción de ${cfg.product.name} se renueva el ` +
    `*${formatDate(sub.nextShipDate)}*. Total: *${$(sub.price)}* (envío incluido). ¿La renovamos?`,
  buttons: [
    { id: `sub_pay_${sub.id}`, title: 'Pagar' },
    { id: `sub_cancel_${sub.id}`, title: 'Cancelar suscripción' },
  ],
});

export const trackingTemplate = (name, tracking, cfg) => ({
  type: 'template',
  name: cfg.templates.shipping,
  lang: cfg.templates.lang,
  params: [firstName(name), tracking],
  text: `Hola ${firstName(name)} 📦 Tu cuaderno ya va en camino con LAAR. Guía: *${tracking}*. ¡Gracias! 💙`,
  buttons: [],
});

// ---------- Cancel ----------

export const askCancelSub = (sub) =>
  buttons(`¿Seguro que quieres cancelar tu *${planName(sub.plan)}*? 🥺`, [
    ['sub_cancel_yes', 'Sí, cancelar'],
    ['sub_cancel_no', 'No, me quedo 💙'],
  ]);

export const subCancelled = (sub) =>
  plain(
    sub.deliveriesLeft > 0
      ? `Listo, tu plan no se renovará. Igual te llegan los ${cuadernos(sub.deliveriesLeft)} que ya pagaste 💙`
      : 'Listo, cancelamos tu suscripción. ¡Gracias por estar con nosotros! 💙 Si un día quieres volver, solo escríbenos.'
  );

export const subKept = () => plain('¡Genial! 🙌 Tu suscripción sigue activa 💙');

export const handoffToHuman = () =>
  plain('¡Claro! 🙋‍♀️ Una persona de nuestro equipo te responde en breve por aquí.\n\n(Escribe *reiniciar* para volver al menú)');

// ---------- Messages to you (the owner) ----------

const orderLine = (o) =>
  o.kind === 'subscription'
    ? `📅 ${planName(o.plan).toUpperCase()} ${o.subId} · ${o.plan === 'annual' ? `${o.deliveries} cuadernos, ` : ''}${freqLabel(o.months)}${o.renewal ? ' · renovación' : ' · nuevo'}`
    : `${o.qty} × cuaderno${o.qty > 1 ? ` (${$(o.unit)} c/u)` : ''}`;

export const ownerNewPayment = (o) =>
  plain(
    `💰 *Nuevo comprobante* — ${o.id}\n\n` +
      `${orderLine(o)}\n` +
      `${o.method === 'delivery' ? `ENVÍO LAAR${o.shipping ? '' : ' (gratis/incluido)'}` : 'RETIRO EN TIENDA'}\n` +
      `Total: ${$(o.total)} vía ${o.paymentMethod}\n` +
      `👤 ${o.name}${o.cedula ? ` · ${o.cedula}` : ''}\n` +
      (o.method === 'delivery' ? `📍 ${o.address}\n` : '') +
      `📱 wa.me/${o.phone}\n\n` +
      `Si el dinero llegó, responde:\n*pagado ${o.id}*`
  );

export const ownerShipDue = (sub) =>
  plain(
    `📦 *Toca enviar*: cuaderno ${sub.deliveries - sub.deliveriesLeft + 1} de ${sub.deliveries} del Plan Anual\n` +
      `${sub.name} · ${sub.cedula}\n📍 ${sub.address}\n📅 ${formatDate(sub.nextShipDate)}\n\n` +
      `Ya está pagado. Cuando lo despaches:\n*guia ${sub.id} <número>*`
  );

export const ownerRenewalSent = (sub) =>
  plain(`🔔 Le pedí a ${sub.name} el pago de renovación de ${sub.id} (${$(sub.price)}). Si paga, te llega el comprobante.`);

export const ownerSubCancelled = (sub) =>
  plain(`❌ ${sub.name} canceló su ${planName(sub.plan)} ${sub.id}. wa.me/${sub.phone}`);

export const ownerSubList = (subs) =>
  plain(
    subs.length
      ? '📅 *Suscripciones activas*\n\n' +
          subs
            .map(
              (s) =>
                `${s.id} · ${s.name} · ${planName(s.plan)} ${freqLabel(s.months)} · próximo ${formatDate(s.nextShipDate)}` +
                (s.plan === 'annual' ? ` · faltan ${s.deliveriesLeft}` : '')
            )
            .join('\n')
      : 'Aún no hay suscripciones activas.'
  );

export const ownerHandoffAlert = (session) =>
  plain(
    `🙋 Un cliente pidió hablar con una persona: wa.me/${session.phone}\n` +
      `Respóndele con *responder ${session.phone} tu mensaje*.\n` +
      `Cuando termines, envía *bot ${session.phone}* para que el bot lo vuelva a atender.`
  );

export const ownerWholesaleAlert = (session, qty) =>
  plain(
    `📦 *Pedido mayorista*: un cliente quiere ${cuadernos(qty)}: wa.me/${session.phone}\n` +
      `Respóndele con *responder ${session.phone} tu mensaje*.\n` +
      `Cuando termines, envía *bot ${session.phone}*.`
  );

export const ownerHelp = () =>
  plain(
    '🛠️ *Comandos*\n\n' +
      '*pedidos* — pagos por verificar\n' +
      '*pagado AZ123* — confirma el pago y avisa al cliente\n' +
      '*guia AZ123 123456* — envía la guía LAAR (pedido o renovación)\n' +
      '*guia SUB123 123456* — despacha el siguiente cuaderno de un Plan Anual\n' +
      '*suscripciones* — suscripciones activas y próximos envíos\n' +
      '*recordar SUB123* — pide ya el pago de renovación\n' +
      '*responder 5939... hola!* — escribe a un cliente desde el número del bot\n' +
      '*bot 5939...* — devuelve un chat al bot'
  );
