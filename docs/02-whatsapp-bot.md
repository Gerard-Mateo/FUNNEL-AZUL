# Step 4 – Put the WhatsApp bot online

The bot uses the official **WhatsApp Cloud API** (by Meta). Replying to customers who write to you is free inside the 24-hour customer-service window, and conversations that start from a Click-to-WhatsApp ad get an extended free window (72 h). Check the current rates at [developers.facebook.com/docs/whatsapp/pricing](https://developers.facebook.com/docs/whatsapp/pricing).

> ⚠️ A number connected to the Cloud API normally **cannot be used in the WhatsApp app on a phone** at the same time. Use a **new SIM** only for the bot. Meta now offers "coexistence" (same number in the Business app + API) through some onboarding flows; if it shows up for you during setup, you can use it, but a dedicated number is the simple path. To write to customers yourself, use the `responder` command from your personal WhatsApp.

## 4.1 Create the Meta app

1. [developers.facebook.com](https://developers.facebook.com) → My Apps → **Create app** → use case **"Connect with customers through WhatsApp"** → choose your Business Portfolio.
2. In the app: **WhatsApp → API Setup**. Meta gives you a test number — send yourself a test message to see it works.
3. **Add your real number**: API Setup → *Add phone number* → display name (your brand, e.g. "Cuaderno Azul") → verify with SMS code. The display name gets reviewed by Meta (usually < 1 day).
4. Copy the **Phone number ID** (a long number, not the phone itself) → `WHATSAPP_PHONE_NUMBER_ID`.
5. App settings → Basic → **App secret** → `META_APP_SECRET`.

## 4.2 Permanent access token

The token on the API Setup page expires in 24 h. Make a permanent one:

1. business.facebook.com/settings → **Users → System users** → Add → role **Admin**.
2. *Assign assets*: your app (full control) and your WhatsApp account (full control).
3. **Generate token** → select your app → expiration **Never** → permissions `whatsapp_business_messaging` and `whatsapp_business_management`.
4. Paste it into `WHATSAPP_TOKEN`. Treat it like a password.

## 4.3 Host the code

Any Node.js host works. Easy options:

- **Railway** or **Render** (paid plan, ~5–7 USD/month): connect this GitHub repo, start command `npm start`, add the variables from `.env.example`, and attach a **persistent disk/volume** mounted at e.g. `/data` with `DATA_DIR=/data` (otherwise orders are lost on each redeploy).
- Free tiers that "sleep" make the first reply take ~1 minute — not good for sales.

Your public URL will look like `https://funnel-azul.up.railway.app`. Open it: it should say *"Funnel Azul bot OK 💙"*.

## 4.4 Connect the webhook

1. App → **WhatsApp → Configuration → Webhook → Edit**
   - Callback URL: `https://YOUR-URL/webhook`
   - Verify token: the same text you put in `WHATSAPP_VERIFY_TOKEN`
2. **Webhook fields → subscribe to `messages`**.
3. From your personal phone, write "hola" to the bot's number. You should get the product photo with the buttons. 🎉
4. Write `comandos` from your `OWNER_PHONE` to see your admin commands.

## 4.5 Fill in your business data

Edit the variables (on your host's dashboard, or `.env` locally):

| Variable | Example |
|---|---|
| `PRICE_TIERS` | `1:15` ($15 per notebook) |
| `CLUB_PRICE`, `ANNUAL_PRICE` | `12.00`, `10.00` per notebook — the upsell, see [07-upselling.md](07-upselling.md) |
| `FREE_SHIPPING_FROM` | `3` |
| `PUBLIC_URL` | your server's address, e.g. `https://funnel-azul.up.railway.app` — the bot then sends the product photo and the plans card from `assets/` automatically |
| `PRODUCT_IMAGE_URL` | optional: a different photo link (otherwise it uses the one in `assets/`) |
| `SHIPPING_COST` | your LAAR rate, e.g. `4.50` |
| `STORE_ADDRESS`, `STORE_MAPS_URL`, `STORE_HOURS` | your store |
| `DEUNA_QR_URL` | public link to your DeUna Negocios QR image |
| `BANK_*` | your account for transfers |
| `OWNER_PHONE` | your personal WhatsApp, `5939XXXXXXXX` |

All the texts are in `src/messages.js` — change the wording freely, then `npm test`.

## Plan B – start today with the WhatsApp Business app (no code)

If you want to sell before the bot is online:

1. Install **WhatsApp Business** with the business SIM. Add profile photo, description, address, hours.
2. *Business tools → Catalog*: add the notebook (photo, price).
3. *Business tools → Greeting message*: paste the product text from `productOffer` in `src/messages.js`.
4. *Business tools → Quick replies*: create `/envio`, `/retiro`, `/deuna`, `/transferencia`, `/gracias` with the texts from `src/messages.js`.
5. Link it to your Facebook Page and launch the ads (step 5). You answer by hand.

When you move to the bot, you can migrate that number to the Cloud API (it will leave the app), or use the new SIM for the bot.
