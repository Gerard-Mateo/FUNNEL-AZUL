// All business settings live here. Change them via environment variables (.env)
// so you never have to touch the code to update a price or an address.

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
    price: money('PRODUCT_PRICE', '15.00'),
    // Defaults to the photo in assets/ served by this same server.
    imageUrl:
      env('PRODUCT_IMAGE_URL') ||
      (env('PUBLIC_URL') ? `${env('PUBLIC_URL').replace(/\/$/, '')}/assets/cuaderno-azul.jpg` : ''),
  },

  // --- Delivery (LAAR Courier) ---
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
