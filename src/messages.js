// Every text the bot sends. Edit freely to match your brand voice.
// WhatsApp limits: max 3 buttons per message, button titles max 20 characters.

import { quote, hasFreeShipping } from './pricing.js';
import { freqLabel, formatDate } from './subscriptions.js';

const $ = (n) => `$${Number(n).toFixed(2)}`;

export const plain = (text) => ({ type: 'text', text });

const buttons = (text, list, headerImage) => ({
  type: 'buttons',
  text,
  buttons: list.map(([id, title]) => ({ id, title })),
  ...(headerImage ? { headerImage } : {}),
});

const cuadernos = (n) => (n === 1 ? '1 cuaderno' : `${n} cuadernos`);

// The pack is the second price tier (e.g. 3 notebooks at $12 each).
export const packQty = (cfg) => cfg.pricing[1]?.min;

// ---------- Customer flow ----------

export const productOffer = (cfg) =>
  buttons(
    `¡Hola! 💙 Gracias por escribirnos.\n\n` +
      `Este es *${cfg.product.name}*\n` +
      `${cfg.product.description}\n\n` +
      `💵 *${$(cfg.product.price)}*\n\n` +
      `📅 También puedes *suscribirte* y recibir uno nuevo ${freqLabel(1)} o ${freqLabel(2)}, con envío incluido.`,
    [
      ['yes', '¡Lo quiero! 😍'],
      ['sub', '📅 Suscripción'],
      ['question', 'Tengo una pregunta'],
    ],
    cfg.product.imageUrl || undefined
  );

// The ONLY upsell moment: the pack is offered right next to the single notebook.
export const askQty = (cfg, retry = false) => {
  const pack = packQty(cfg);
  const lines = [
    retry ? 'Elige una opción o escríbeme el número 🙏' : '¡Excelente elección! 🙌 ¿Cuántos quieres?',
    '',
    `• 1 cuaderno: ${$(cfg.product.price)}`,
  ];
  const opts = [['qty_1', '1 cuaderno']];
  if (pack && pack <= cfg.maxQty) {
    const q = quote(pack, 'delivery', cfg);
    const free = hasFreeShipping(pack, cfg) ? ' + envío GRATIS 🚚' : '';
    lines.push(`• *Pack de ${pack}: ${$(q.subtotal)}* (${$(q.unit)} c/u)${free}`);
    opts.push([`qty_${pack}`, `⭐ Pack de ${pack}`]);
  }
  opts.push(['qty_more', 'Otra cantidad']);
  return buttons(lines.join('\n'), opts);
};

export const askQtyNumber = (cfg, retry = false) =>
  plain(
    (retry ? 'Escríbeme solo el número, porfa 🙏\n\n' : '') +
      `¿Cuántos cuadernos quieres? Escribe el número (hasta ${cfg.maxQty}).`
  );

export const wholesale = (qty) =>
  plain(
    `¡Wow, ${cuadernos(qty)}! 🤩 Para pedidos grandes te hacemos *precio mayorista*.\n` +
      'Una persona de nuestro equipo te escribe en breve por aquí 🙌\n\n(Escribe *reiniciar* para volver al menú)'
  );

export const askMethod = (cfg, qty = 1) => {
  const delivery = hasFreeShipping(qty, cfg)
    ? `🚚 *Envío a domicilio* con LAAR: *GRATIS* 🎉 (${cfg.deliveryDays})`
    : `🚚 *Envío a domicilio* con LAAR: ${$(cfg.shippingCost)} (${cfg.deliveryDays})`;
  return buttons('¿Cómo prefieres recibirlo?\n\n' + delivery + '\n🏬 *Retiro en tienda*: GRATIS', [
    ['delivery', '🚚 Envío'],
    ['pickup', '🏬 Retiro en tienda'],
  ]);
};

export const askName = (retry = false) =>
  plain(retry ? 'Escríbeme tu nombre completo, porfa 🙏' : '¡Perfecto! ¿A nombre de quién va el pedido? (nombre y apellido)');

export const askCedula = (retry = false) =>
  plain(
    retry
      ? 'Mmm, eso no parece una cédula. Escribe los 10 dígitos (o 13 si es RUC) 🙏'
      : 'Gracias 😊 ¿Me ayudas con tu número de cédula? LAAR lo necesita para la guía de envío.'
  );

export const askCity = (retry = false) =>
  plain(retry ? '¿En qué ciudad estás? 🙏' : '¿A qué ciudad lo enviamos? 📍');

export const askAddress = (retry = false) =>
  plain(
    (retry ? 'Necesito un poquito más de detalle 🙏\n\n' : '') +
      'Escríbeme la dirección completa en un solo mensaje:\n' +
      '• Calle principal y secundaria\n' +
      '• Número de casa / departamento\n' +
      '• Una referencia (ej. "frente al parque")'
  );

const confirmButtons = [
  ['confirm', '✅ Confirmar'],
  ['edit', '✏️ Corregir'],
];

export const summary = (order, cfg) => {
  const qty = order.qty ?? 1;
  const q = quote(qty, order.method, cfg);
  const lines = [
    '📝 *Resumen de tu pedido*',
    '',
    qty === 1
      ? `1 × ${cfg.product.name} — ${$(q.subtotal)}`
      : `${qty} × ${cfg.product.name} (${$(q.unit)} c/u) — ${$(q.subtotal)}`,
  ];
  if (q.savings > 0) lines.push(`🎉 Ahorras ${$(q.savings)}`);
  lines.push(
    order.method === 'delivery'
      ? q.shipping === 0
        ? '🚚 Envío LAAR — GRATIS'
        : `🚚 Envío LAAR — ${$(q.shipping)}`
      : '🏬 Retiro en tienda — GRATIS',
    `*Total: ${$(q.total)}*`,
    '',
    `👤 ${order.name}`
  );
  if (order.method === 'delivery') {
    lines.push(`🪪 ${order.cedula}`, `📍 ${order.city} — ${order.address}`);
  } else {
    lines.push(`📍 Retiras en: ${cfg.store.address}`, `🕒 ${cfg.store.hours}`, `🗺️ ${cfg.store.mapsUrl}`);
  }
  lines.push('', '¿Está todo bien?');
  return buttons(lines.join('\n'), confirmButtons);
};

// ---------- Subscription ----------

export const subOffer = (cfg) => {
  const single = quote(1, 'delivery', cfg).total;
  const saving = single - cfg.subscription.price;
  return buttons(
    `📅 *Suscripción ${cfg.product.name}*\n\n` +
      `Recibe un cuaderno nuevo en tu casa, sin preocuparte de nada.\n\n` +
      `💵 *${$(cfg.subscription.price)} por envío*, con envío LAAR incluido` +
      (saving > 0 ? ` (ahorras ${$(saving)} cada vez)` : '') +
      `\n🔔 Te avisamos unos días antes de cada envío para pagarlo\n` +
      `❌ Cancelas cuando quieras escribiendo *cancelar*\n\n` +
      `¿Cada cuánto lo quieres?`,
    [
      ['sub_1', '📅 Cada mes'],
      ['sub_2', '📅 Cada 2 meses'],
    ]
  );
};

export const subSummary = (order, cfg) =>
  buttons(
    [
      '📝 *Resumen de tu suscripción*',
      '',
      `📅 1 × ${cfg.product.name} ${freqLabel(order.months)}`,
      `💵 ${$(order.total)} por envío (envío incluido)`,
      `🚚 Primer envío: ahora, al confirmar tu pago`,
      '',
      `👤 ${order.name}`,
      `🪪 ${order.cedula}`,
      `📍 ${order.city} — ${order.address}`,
      '',
      '¿Está todo bien?',
    ].join('\n'),
    confirmButtons
  );

export const subActivated = (sub, cfg) =>
  plain(
    `✅ ¡Pago confirmado y suscripción activa! 💙\n\n` +
      `Tu primer cuaderno sale con LAAR (${cfg.deliveryDays}). Te enviaremos la guía.\n\n` +
      `📅 Próximo envío: *${formatDate(sub.nextShipDate)}*\n` +
      `Te escribimos unos días antes para el pago. Para cancelar, escribe *cancelar* cuando quieras.`
  );

export const subRenewed = (sub, cfg) =>
  plain(
    `✅ ¡Pago confirmado! Tu cuaderno de este ${sub.months === 1 ? 'mes' : 'periodo'} sale con LAAR (${cfg.deliveryDays}) 🚚\n\n` +
      `📅 Siguiente envío: *${formatDate(sub.nextShipDate)}*`
  );

// Sent by the server a few days before each delivery. Outside the 24-hour window
// WhatsApp only allows approved templates, so this is a template message.
// `text` is only a preview for the simulator/demo; WhatsApp shows the approved template.
export const subReminder = (sub, cfg) => ({
  type: 'template',
  name: cfg.subscription.reminderTemplate,
  lang: cfg.subscription.templateLang,
  params: [sub.name.split(' ')[0], formatDate(sub.nextShipDate), $(sub.price)],
  text:
    `Hola ${sub.name.split(' ')[0]} 💙 Tu próximo cuaderno de la suscripción sale el ` +
    `*${formatDate(sub.nextShipDate)}*. Total: *${$(sub.price)}* (envío incluido). ¿Lo pagamos?`,
  buttons: [
    { id: `sub_pay_${sub.id}`, title: 'Pagar envío' },
    { id: `sub_cancel_${sub.id}`, title: 'Cancelar suscripción' },
  ],
});

export const askCancelSub = (sub) =>
  buttons(
    `¿Seguro que quieres cancelar tu suscripción (${freqLabel(sub.months)})? 🥺\n` +
      `Tu próximo envío sería el ${formatDate(sub.nextShipDate)}.`,
    [
      ['sub_cancel_yes', 'Sí, cancelar'],
      ['sub_cancel_no', 'No, la mantengo 💙'],
    ]
  );

export const subCancelled = () =>
  plain('Listo, cancelamos tu suscripción. ¡Gracias por estar con nosotros! 💙 Si un día quieres volver, solo escríbenos.');

export const subKept = () => plain('¡Genial! 🙌 Tu suscripción sigue activa 💙');

// ---------- Payment ----------

export const askPayment = (order) =>
  buttons(
    `¡Listo! Tu pedido es el *${order.id}* 🎉\n\n` +
      `Total a pagar: *${$(order.total)}*\n\n` +
      '¿Cómo quieres pagar?\n' +
      '⚡ *DeUna*: al instante, escaneando nuestro QR\n' +
      '🏦 *Transferencia* bancaria',
    [
      ['pay_deuna', '⚡ DeUna'],
      ['pay_transfer', '🏦 Transferencia'],
    ]
  );

export const deunaInstructions = (order, cfg) => {
  const text =
    `⚡ *Paga con DeUna*\n\n` +
    `1. Abre tu app DeUna (o la de tu banco con "Pagar con QR")\n` +
    `2. Escanea este QR\n` +
    `3. Paga *${$(order.total)}*\n` +
    (cfg.deunaPhone ? `\n¿No puedes escanear? Paga al número ${cfg.deunaPhone}\n` : '') +
    `\nCuando termines, envíame aquí la *captura del comprobante* 📸`;
  return cfg.deunaQrUrl ? [{ type: 'image', link: cfg.deunaQrUrl, caption: text }] : [plain(text)];
};

export const transferInstructions = (order, cfg) =>
  plain(
    `🏦 *Datos para transferencia*\n\n` +
      `Banco: ${cfg.bank.name}\n` +
      `Cuenta ${cfg.bank.accountType}: ${cfg.bank.accountNumber}\n` +
      `Titular: ${cfg.bank.holder}\n` +
      `C.I./RUC: ${cfg.bank.holderId}\n` +
      (cfg.bank.email ? `Correo: ${cfg.bank.email}\n` : '') +
      `\nMonto: *${$(order.total)}*\n` +
      `Referencia: *${order.id}*\n\n` +
      `Cuando termines, envíame aquí la *captura del comprobante* 📸`
  );

export const askReceipt = () =>
  plain(
    'Estoy esperando la *foto o captura* de tu comprobante 📸\n\n' +
      'Si quieres pagar de otra forma escribe *cambiar*. Si necesitas ayuda escribe *asesor*.'
  );

export const receiptReceived = () =>
  plain('¡Recibido! 🙌 Estamos verificando tu pago, te confirmamos en unos minutos 💙');

export const stillVerifying = (order) =>
  plain(`Seguimos verificando el pago del pedido *${order.id}* ⏳ Te escribimos apenas esté listo.`);

export const paymentConfirmed = (order, cfg) =>
  plain(
    order.method === 'delivery'
      ? `✅ ¡Pago confirmado! Tu pedido *${order.id}* ya se prepara para salir con LAAR Courier 🚚\n\n` +
          `Tiempo estimado: ${cfg.deliveryDays}. Te enviaremos tu número de guía para que lo rastrees.\n\n¡Gracias por tu compra! 💙`
      : `✅ ¡Pago confirmado! Tu pedido *${order.id}* te espera en la tienda 🏬\n\n` +
          `📍 ${cfg.store.address}\n🕒 ${cfg.store.hours}\n🗺️ ${cfg.store.mapsUrl}\n\n` +
          `Solo di tu nombre o el código *${order.id}* al llegar. ¡Gracias por tu compra! 💙`
  );

export const trackingSent = (order) =>
  plain(`🚚 ¡Tu pedido *${order.id}* ya está en camino!\n\nGuía LAAR: *${order.tracking}*\nRastréalo en laarcourier.com 📦`);

export const handoffToHuman = () =>
  plain('¡Claro! 🙋‍♀️ Una persona de nuestro equipo te responde en breve por aquí.\n\n(Escribe *reiniciar* para volver al menú)');

// ---------- Messages to you (the owner) ----------

export const ownerNewPayment = (o) =>
  plain(
    `💰 *Nuevo comprobante* — ${o.id}\n\n` +
      (o.subId
        ? `📅 SUSCRIPCIÓN ${o.subId} · ${freqLabel(o.months)}${o.renewal ? ' · renovación' : ' · primer envío'}\n`
        : `${o.qty} × cuaderno${o.qty > 1 ? ` (${$(o.unit)} c/u)` : ''}\n`) +
      `${o.method === 'delivery' ? 'ENVÍO LAAR' : 'RETIRO'}${o.method === 'delivery' && !o.shipping ? ' (gratis/incluido)' : ''}\n` +
      `Total: ${$(o.total)} vía ${o.paymentMethod}\n` +
      `👤 ${o.name}${o.cedula ? ` · ${o.cedula}` : ''}\n` +
      (o.method === 'delivery' ? `📍 ${o.city} — ${o.address}\n` : '') +
      `📱 wa.me/${o.phone}\n\n` +
      `Si el dinero llegó, responde:\n*pagado ${o.id}*`
  );

export const ownerSubReminderSent = (sub) =>
  plain(
    `🔔 Recordatorio enviado a ${sub.name} (${sub.id}) para el envío del ${formatDate(sub.nextShipDate)}. ` +
      `Cuando pague te llega el comprobante.`
  );

export const ownerSubCancelled = (sub) =>
  plain(`❌ ${sub.name} canceló su suscripción ${sub.id} (${freqLabel(sub.months)}). wa.me/${sub.phone}`);

export const ownerSubList = (subs) =>
  plain(
    subs.length
      ? '📅 *Suscripciones activas*\n\n' +
          subs.map((s) => `${s.id} · ${s.name} · ${freqLabel(s.months)} · próximo ${formatDate(s.nextShipDate)}`).join('\n')
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
      '*guia AZ123 123456* — envía la guía LAAR al cliente\n' +
      '*suscripciones* — lista de suscripciones activas\n' +
      '*recordar SUB123* — envía ya el recordatorio de pago de una suscripción\n' +
      '*responder 5939... hola!* — escribe a un cliente desde el número del bot\n' +
      '*bot 5939...* — devuelve un chat al bot'
  );
