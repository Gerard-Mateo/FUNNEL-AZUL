// All business settings live here. Change them via environment variables (.env)
// so you never have to touch the code to update a price or an address.

import fs from 'node:fs';
import { parseTiers, planImageKey } from './pricing.js';

const env = (key, fallback = '') => process.env[key] ?? fallback;
const money = (key, fallback) => Number.parseFloat(env(key, fallback));

export const config = {
  // --- WhatsApp Cloud API (Meta) ---
  whatsappToken: env('WHATSAPP_TOKEN'),
  phoneNumberId: env('WHATSAPP_PHONE_NUMBER_ID'),
  verifyToken: env('WHATSAPP_VERIFY_TOKEN', 'cambia-este-token'),
  appSecret: env('META_APP_SECRET'),
  graphVersion: env('GRAPH_API_VERSION', 'v23.0'),

  // Your personal WhatsApp number (gets order alerts + can run admin commands).
  // Format: country code + number, no "+" or spaces. Ecuador example: 593991234567
  ownerPhone: env('OWNER_PHONE'),

  port: Number.parseInt(env('PORT', '3000'), 10),
  // Public https address of this server, e.g. https://funnel-azul.up.railway.app
  // Used to serve the product photo in /assets.
  publicUrl: env('PUBLIC_URL').replace(/\/$/, ''),
  dataDir: env('DATA_DIR', './data'),

  // --- Product (only one model) ---
  product: {
    name: env('PRODUCT_NAME', 'El Cuaderno Azul'),
    description: env(
      'PRODUCT_DESCRIPTION',
      'Tapa dura azul, minimalista y con cinta marcapáginas. Simple y hermoso 💙'
    ),
    // Defaults to the photo in assets/ served by this same server.
    imageUrl:
      env('PRODUCT_IMAGE_URL') ||
      (env('PUBLIC_URL') ? `${env('PUBLIC_URL').replace(/\/$/, '')}/assets/cuaderno-azul.jpg` : ''),
  },

  // --- One-time purchase ---
  // "min:unitPrice" pairs. Default: $15 per notebook. (e.g. "1:15,5:13" for a bulk price)
  pricing: parseTiers(env('PRICE_TIERS', '1:15')),
  // Free LAAR delivery from this many notebooks on one-time orders (0 = never)
  freeShippingFrom: Number.parseInt(env('FREE_SHIPPING_FROM', '3'), 10),
  // Above this, the chat goes to a person for a wholesale price
  maxQty: Number.parseInt(env('MAX_QTY', '20'), 10),

  // --- The upsell: Club (pay per delivery) and Annual (pay once) ---
  subscription: {
    clubPrice: money('CLUB_PRICE', '12.00'), // per notebook, LAAR shipping included
    annualPrice: money('ANNUAL_PRICE', '10.00'), // per notebook when the year is paid upfront (0 = no annual plan)
    defaultMonths: Number.parseInt(env('SUB_DEFAULT_MONTHS', '2'), 10), // 1 notebook every N months (1 or 2)
    reminderDaysBefore: Number.parseInt(env('SUB_REMINDER_DAYS', '3'), 10),
  },

  // --- WhatsApp templates (needed to write to a customer after 24 h; see docs/08-suscripcion.md) ---
  templates: {
    renewal: env('TEMPLATE_RENEWAL', 'recordatorio_suscripcion'),
    shipping: env('TEMPLATE_SHIPPING', 'envio_en_camino'),
    lang: env('TEMPLATE_LANG', 'es'),
  },

  // --- Delivery (LAAR Courier) ---
  // Ask the customer's cédula for delivery orders (LAAR guía / invoice). Set ASK_CEDULA=false if LAAR doesn't need it.
  askCedula: env('ASK_CEDULA', 'true') !== 'false',
  shippingCost: money('SHIPPING_COST', '4.50'),
  deliveryDays: env('DELIVERY_DAYS', '1 a 3 días hábiles'),

  // --- Store pickup (free) ---
  store: {
    address: env('STORE_ADDRESS', 'Av. Ejemplo N00-00 y Calle Ejemplo, Quito'),
    mapsUrl: env('STORE_MAPS_URL', 'https://maps.google.com/?q=Quito'),
    hours: env('STORE_HOURS', 'Lunes a sábado, 10:00 a 19:00'),
  },

  // --- Payment ---
  deunaQrUrl: env('DEUNA_QR_URL'), // public https link to your DeUna Negocios QR image
  deunaPhone: env('DEUNA_PHONE'), // optional: number linked to your DeUna account
  bank: {
    name: env('BANK_NAME', 'Banco Pichincha'),
    accountType: env('BANK_ACCOUNT_TYPE', 'Ahorros'),
    accountNumber: env('BANK_ACCOUNT_NUMBER', '0000000000'),
    holder: env('BANK_ACCOUNT_HOLDER', 'Nombre del titular'),
    holderId: env('BANK_ACCOUNT_HOLDER_ID', '0000000000'),
    email: env('BANK_ACCOUNT_EMAIL', ''),
  },
};

// Base price = price of 1 notebook (first tier)
config.product.price = config.pricing[0].unit;

// Plans card shown above the 3 upsell buttons (assets/planes.jpg, made by `npm run build:image`).
// Used only if it was drawn with the current prices; otherwise the bot sends the text version.
config.planImageUrl = (() => {
  if (env('PLAN_IMAGE_URL')) return env('PLAN_IMAGE_URL');
  if (!config.publicUrl) return '';
  try {
    const { key } = JSON.parse(fs.readFileSync(new URL('../assets/planes.json', import.meta.url), 'utf8'));
    if (key === planImageKey(config)) return `${config.publicUrl}/assets/planes.jpg?v=${encodeURIComponent(key)}`;
    console.warn('⚠️  assets/planes.jpg has old prices: run `npm run build:image` (sending the text version meanwhile)');
  } catch {}
  return '';
})();

