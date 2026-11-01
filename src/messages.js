// Every text the bot sends. Edit freely to match your brand voice.
// WhatsApp limits: max 3 buttons per message, button titles max 20 characters.

const $ = (n) => `$${Number(n).toFixed(2)}`;

export const plain = (text) => ({ type: 'text', text });

const buttons = (text, list, headerImage) => ({
  type: 'buttons',
  text,
  buttons: list.map(([id, title]) => ({ id, title })),
  ...(headerImage ? { headerImage } : {}),
});

// ---------- Customer flow ----------

export const productOffer = (cfg) =>
  buttons(
    `¡Hola! 💙 Gracias por escribirnos.\n\n` +
      `Este es nuestro *${cfg.product.name}*\n` +
      `${cfg.product.description}\n\n` +
      `💵 Precio: *${$(cfg.product.price)}*\n\n` +
      `¿Lo quieres para ti? ✨`,
    [
      ['yes', '¡Sí, lo quiero! 😍'],
      ['question', 'Tengo una pregunta'],
    ],
    cfg.product.imageUrl || undefined
  );

export const askQty = (retry = false) =>
  buttons(
    (retry ? 'Elige una cantidad o escríbeme el número 🙏\n\n' : '¡Excelente elección! 🙌\n\n') +
      '¿Cuántos cuadernos quieres?',
    [
      ['qty_1', '1 cuaderno'],
      ['qty_2', '2 cuadernos'],
      ['qty_3', '3 cuadernos'],
    ]
  );

export const askMethod = (cfg) =>
  buttons(
    '¿Cómo prefieres recibirlo?\n\n' +
      `🚚 *Envío a domicilio* con LAAR Courier: ${$(cfg.shippingCost)} (${cfg.deliveryDays})\n` +
      `🏬 *Retiro en tienda*: GRATIS`,
    [
      ['delivery', '🚚 Envío'],
      ['pickup', '🏬 Retiro en tienda'],
    ]
  );

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

export const summary = (order, cfg) => {
  const qty = order.qty ?? 1;
  const subtotal = qty * cfg.product.price;
  const shipping = order.method === 'delivery' ? cfg.shippingCost : 0;
  const lines = [
    '📝 *Resumen de tu pedido*',
    '',
    `${qty} × ${cfg.product.name} — ${$(subtotal)}`,
    order.method === 'delivery'
      ? `🚚 Envío LAAR — ${$(shipping)}`
      : '🏬 Retiro en tienda — GRATIS',
    `*Total: ${$(subtotal + shipping)}*`,
    '',
    `👤 ${order.name}`,
  ];
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
      `${o.qty} × cuaderno · ${o.method === 'delivery' ? 'ENVÍO LAAR' : 'RETIRO'}\n` +
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

export const ownerHelp = () =>
  plain(
    '🛠️ *Comandos*\n\n' +
      '*pedidos* — pagos por verificar\n' +
      '*pagado AZ123* — confirma el pago y avisa al cliente\n' +
      '*guia AZ123 123456* — envía la guía LAAR al cliente\n' +
      '*responder 5939... hola!* — escribe a un cliente desde el número del bot\n' +
      '*bot 5939...* — devuelve un chat al bot'
  );
