// Every text the bot sends. Edit freely to match your brand voice.
// WhatsApp limits: max 3 buttons per message, button titles max 20 characters,
// list rows max 10, row title max 24 and row description max 72 characters.

import { quote, hasFreeShipping, shippingGap } from './pricing.js';

const $ = (n) => `$${Number(n).toFixed(2)}`;

export const plain = (text) => ({ type: 'text', text });

const buttons = (text, list, headerImage) => ({
  type: 'buttons',
  text,
  buttons: list.map(([id, title]) => ({ id, title })),
  ...(headerImage ? { headerImage } : {}),
});

const list = (text, button, rows) => ({ type: 'list', text, button, rows });

const cuadernos = (n) => (n === 1 ? '1 cuaderno' : `${n} cuadernos`);

// "• Desde 2 → $13.50 c/u" lines for the volume discounts
const tierLines = (cfg) => {
  const lines = cfg.pricing.slice(1).map((t, i, arr) => {
    const free = t.min === cfg.freeShippingFrom ? ' + envío GRATIS 🚚' : '';
    const best = i === arr.length - 1 ? ' 💎' : '';
    return `• Desde ${t.min} → *${$(t.unit)}* c/u${free}${best}`;
  });
  if (cfg.freeShippingFrom && !cfg.pricing.some((t) => t.min === cfg.freeShippingFrom)) {
    lines.push(`🚚 Envío GRATIS desde ${cuadernos(cfg.freeShippingFrom)}`);
  }
  return lines.join('\n');
};

// ---------- Customer flow ----------

export const productOffer = (cfg) =>
  buttons(
    `¡Hola! 💙 Gracias por escribirnos.\n\n` +
      `Este es *${cfg.product.name}*\n` +
      `${cfg.product.description}\n\n` +
      `💵 *${$(cfg.product.price)}* c/u\n\n` +
      (cfg.pricing.length > 1 ? `🔥 *Mientras más llevas, menos pagas:*\n${tierLines(cfg)}\n\n` : '') +
      `¿Lo quieres? ✨`,
    [
      ['yes', '¡Sí, lo quiero! 😍'],
      ['question', 'Tengo una pregunta'],
    ],
    cfg.product.imageUrl || undefined
  );

// Quantity picker (WhatsApp list): every row shows the price, the savings and free shipping.
export const askQty = (cfg, retry = false) => {
  const options = [1, 2, 3, 4, 5, 10].filter((n) => n <= cfg.maxQty);
  const rows = options.map((n) => {
    const q = quote(n, 'pickup', cfg);
    const tags = [
      n === cfg.freeShippingFrom ? 'Recomendado' : '',
      n === 1 ? $(q.subtotal) : `${$(q.subtotal)} (${$(q.unit)} c/u)`,
      q.savings > 0 ? `ahorras ${$(q.savings)}` : '',
      hasFreeShipping(n, cfg) ? 'envío gratis' : '',
    ].filter(Boolean);
    return { id: `qty_${n}`, title: cuadernos(n) + (n === cfg.freeShippingFrom ? ' ⭐' : ''), description: tags.join(' · ') };
  });
  rows.push({ id: 'qty_more', title: 'Otra cantidad', description: `Escribe cuántos quieres (hasta ${cfg.maxQty})` });
  return list(
    (retry ? 'Elige una opción de la lista o escríbeme el número 🙏\n\n' : '¡Excelente elección! 🙌\n\n') +
      '¿Cuántos cuadernos quieres? Mientras más llevas, más ahorras 💸\n\n' +
      '🎁 Tip: uno para ti y otro para regalar.',
    'Elegir cantidad',
    rows
  );
};

export const askQtyNumber = (cfg, retry = false) =>
  plain(
    (retry ? 'Escríbeme solo el número, porfa 🙏\n\n' : '') +
      `¿Cuántos cuadernos quieres? Escribe el número (hasta ${cfg.maxQty}).\n` +
      'Si son más, te hacemos *precio mayorista* 😉'
  );

// The upsell: right after choosing a quantity, offer ONE more when it's a clearly better deal.
export const upsellOffer = (qty, up, cfg) =>
  buttons(
    `🔥 *¡Espera!* Tengo una oferta para ti:\n\n` +
      `Si llevas *${up.qty}* en vez de ${qty}, el cuaderno extra te sale en solo *${$(up.extra)}* ` +
      `(normal ${$(cfg.product.price)}) 😱\n\n` +
      `✅ Pagas ${$(up.unit)} c/u y ahorras ${$(up.savings)} en total\n` +
      (up.unlocksShipping ? `🚚 ¡Y el envío a domicilio es *GRATIS*!\n` : '') +
      `\n🎁 Ideal para regalar o para compartir con tu bestie.`,
    [
      ['up_yes', `¡Sí, quiero ${up.qty}! 🙌`],
      ['up_no', `Solo ${qty}, gracias`],
    ]
  );

export const upsellAcceptedIntro = (qty) =>
  `¡Buenísima elección! 🙌 Tu pedido queda en *${cuadernos(qty)}*.\n\n`;

export const wholesale = (qty) =>
  plain(
    `¡Wow, ${cuadernos(qty)}! 🤩 Para pedidos grandes te hacemos *precio mayorista*.\n` +
      'Una persona de nuestro equipo te escribe en breve por aquí 🙌\n\n(Escribe *reiniciar* para volver al menú)'
  );

export const askMethod = (cfg, qty = 1, intro = '') => {
  const free = hasFreeShipping(qty, cfg);
  const delivery = free
    ? `🚚 *Envío a domicilio* con LAAR: ~${$(cfg.shippingCost)}~ *GRATIS* 🎉 (${cfg.deliveryDays})`
    : `🚚 *Envío a domicilio* con LAAR: ${$(cfg.shippingCost)} (${cfg.deliveryDays})` +
      (cfg.freeShippingFrom ? `\n     _Gratis desde ${cuadernos(cfg.freeShippingFrom)}_` : '');
  return buttons(
    intro + '¿Cómo prefieres recibirlo?\n\n' + delivery + '\n' + `🏬 *Retiro en tienda*: GRATIS`,
    [
      ['delivery', '🚚 Envío'],
      ['pickup', '🏬 Retiro en tienda'],
    ]
  );
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

export const freeShippingUnlocked = () => '🎉 ¡Listo! Ahora tu envío es *GRATIS*.\n\n';

export const summary = (order, cfg, intro = '') => {
  const qty = order.qty ?? 1;
  const q = quote(qty, order.method, cfg);
  const gap = shippingGap(order, cfg);
  const lines = [
    intro + '📝 *Resumen de tu pedido*',
    '',
    `${qty} × ${cfg.product.name} (${$(q.unit)} c/u) — ${$(q.subtotal)}`,
  ];
  if (q.savings > 0) lines.push(`🎉 Ahorras ${$(q.savings)}`);
  lines.push(
    order.method === 'delivery'
      ? q.shipping === 0
        ? `🚚 Envío LAAR — ~${$(cfg.shippingCost)}~ GRATIS`
        : `🚚 Envío LAAR — ${$(q.shipping)}`
      : '🏬 Retiro en tienda — GRATIS',
    `*Total: ${$(q.total)}*`
  );
  if (gap) {
    const extra = quote(cfg.freeShippingFrom, 'delivery', cfg).total - q.total;
    lines.push(
      '',
      `💡 Por solo *${$(extra)} más* te llevas ${gap === 1 ? 'otro cuaderno' : `${gap} cuadernos más`} ` +
        `y el envío es *GRATIS* 😍`
    );
  }
  lines.push('', `👤 ${order.name}`);
  if (order.method === 'delivery') {
    lines.push(`🪪 ${order.cedula}`, `📍 ${order.city} — ${order.address}`);
  } else {
    lines.push(
      `📍 Retiras en: ${cfg.store.address}`,
      `🕒 ${cfg.store.hours}`,
      `🗺️ ${cfg.store.mapsUrl}`
    );
  }
  lines.push('', '¿Está todo bien?');
  return buttons(lines.join('\n'), [
    ['confirm', '✅ Confirmar'],
    ...(gap ? [['add_more', `➕ Llevar ${cfg.freeShippingFrom}`]] : []),
    ['edit', '✏️ Corregir'],
  ]);
};

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
  return cfg.deunaQrUrl
    ? [{ type: 'image', link: cfg.deunaQrUrl, caption: text }]
    : [plain(text)];
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
  plain(
    `🚚 ¡Tu pedido *${order.id}* ya está en camino!\n\n` +
      `Guía LAAR: *${order.tracking}*\n` +
      `Rastréalo en laarcourier.com 📦`
  );

export const handoffToHuman = () =>
  plain('¡Claro! 🙋‍♀️ Una persona de nuestro equipo te responde en breve por aquí.\n\n(Escribe *reiniciar* para volver al menú)');

// ---------- Messages to you (the owner) ----------

export const ownerNewPayment = (o) =>
  plain(
    `💰 *Nuevo comprobante* — ${o.id}\n\n` +
      `${o.qty} × cuaderno (${$(o.unit)} c/u)${o.upsold ? ' · ⬆️ aceptó upsell' : ''}\n` +
      `${o.method === 'delivery' ? 'ENVÍO LAAR' : 'RETIRO'}${o.method === 'delivery' && !o.shipping ? ' (gratis)' : ''}\n` +
      `Total: ${$(o.total)} vía ${o.paymentMethod}\n` +
      `👤 ${o.name}${o.cedula ? ` · ${o.cedula}` : ''}\n` +
      (o.method === 'delivery' ? `📍 ${o.city} — ${o.address}\n` : '') +
      `📱 wa.me/${o.phone}\n\n` +
      `Si el dinero llegó, responde:\n*pagado ${o.id}*`
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
      '*responder 5939... hola!* — escribe a un cliente desde el número del bot\n' +
      '*bot 5939...* — devuelve un chat al bot'
  );
