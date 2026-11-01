# FUNNEL-AZUL 💙

Sales funnel for the **Cuaderno Azul**: Meta ad → WhatsApp → automatic chat → payment → LAAR delivery or free store pickup.

<p align="center"><img src="assets/cuaderno-azul.jpg" width="280" alt="el cuaderno azul"></p>

```
 Instagram / Facebook ad          WhatsApp bot (this repo)                      You
 ───────────────────────          ─────────────────────────────────────────    ─────────────
 "Click to WhatsApp" ad   ──►  1. Photo + price                  [¡Lo quiero!]
 (pre-filled message:          2. THE UPSELL   [Comprar · $15 c/u] [⭐ Club · $12 c/u] [💎 Anual · $60]
  "¡Hola! Quiero el            3. "Ciudad y dirección" in one message   or  [🏬 Retiro]
   cuaderno azul 💙")          4. "¿A nombre de María Pérez?" (from WhatsApp profile)  [✅ Sí]
                               5. Cédula (delivery only)
                               6. Summary         [✅ Confirmar y pagar] [➕ Agregar otro] [✏️ Corregir]
                               7. DeUna QR right away (transfer 1 tap away) → receipt ──►  📲 "pagado AZ123"
                               8. "¡Pago confirmado!" ◄──────────────────────────────────┘
                               9. LAAR tracking  ◄─────────────────────────────────────── "guia AZ123 <n°>"

 Returning customers: "¿A la misma dirección?" → steps 4–5 skipped (5 steps total).
 Club: renewal reminder before each delivery. Anual: paid once, YOU get "📦 Toca enviar".
```

At any moment the customer can type **asesor** to talk to you (the bot goes quiet for that chat).

## The plan, step by step

| # | Step | Time | Guide |
|---|------|------|-------|
| 0 | Get your basics ready: product photos, price, a new SIM for the business WhatsApp, store address | 1 day | below |
| 1 | Meta Business setup: Business Portfolio, Facebook Page, Instagram, ad account | 1 hour | [docs/01-meta-business.md](docs/01-meta-business.md) |
| 2 | Payments: open **DeUna Negocios** (instant QR) + keep bank transfer as backup | 1 hour | [docs/04-pagos.md](docs/04-pagos.md) |
| 3 | Delivery: open a business account with **LAAR Courier**, get your rate | 1–3 days | [docs/05-envios-laar.md](docs/05-envios-laar.md) |
| 4 | Put the bot online (WhatsApp Cloud API + this code) | 2–3 hours | [docs/02-whatsapp-bot.md](docs/02-whatsapp-bot.md) |
| 5 | Launch the **Click-to-WhatsApp** ads | 1 hour | [docs/03-meta-ads.md](docs/03-meta-ads.md) |
| 6 | Daily routine: verify payments, ship, send tracking | 15 min/day | [docs/06-operacion.md](docs/06-operacion.md) |
| 🧠 | **Why the funnel works this way** (research + psychology) | 5 min read | [docs/09-estrategia.md](docs/09-estrategia.md) |
| ⭐ | The upsell: Solo / Club / Anual | 5 min | [docs/07-upselling.md](docs/07-upselling.md) |
| 📅 | Club & Plan Anual + create the 2 WhatsApp templates | 15 min | [docs/08-suscripcion.md](docs/08-suscripcion.md) |

> **Want to start selling this week, before the bot?** You can run steps 1–3 + 5 with the free
> **WhatsApp Business app** and answer by hand using the same scripts (quick replies). See
> "Plan B" in [docs/02-whatsapp-bot.md](docs/02-whatsapp-bot.md). Switch to the bot when the chats pile up.

### Step 0 – what you need before anything

- [x] Product mockup: [`assets/cuaderno-azul.jpg`](assets/cuaderno-azul.jpg) (plain cover, no dots) — the bot already uses it.
- [ ] 3–5 **real photos** (and a 10–15 s vertical video) of the notebook. This is 80% of the ad.
- [ ] Price, and what's included (gift wrap? sticker? that sells to young people).
- [ ] A **new phone number** (prepaid SIM Claro/Movistar/CNT) only for the business WhatsApp.
- [ ] Store address, Google Maps link, opening hours.
- [ ] Your **RUC** (or RISE / cédula) — Meta business verification and LAAR will ask for it.

## Try the bot right now (no Meta account needed)

**From your phone:** open the chat simulator, `docs/demo/index.html`. It runs the real bot code in the browser
(customer tab + your "owner" tab with alerts and commands). To host it with **GitHub Pages**: repo
→ Settings → Pages → Source "Deploy from a branch" → branch `main`, folder `/docs` → Save. After about a minute it is at
`https://<your-user>.github.io/FUNNEL-AZUL/demo/`. (Pages on a private repo needs a paid GitHub plan.)
After editing `src/messages.js` or `src/flow.js`, run `npm run build:demo` to refresh it.

**From a computer:**

```bash
npm run simulate     # chat with the bot in your terminal
npm test             # automatic tests of the whole flow
```

Requires Node.js 18+ (no other dependencies).

## Project structure

```
src/config.js      ← prices, shipping cost, store address, bank data (all from .env)
src/pricing.js     ← prices, plan prices (Club/Anual) and savings
src/subscriptions.js ← subscription dates and reminders
src/messages.js    ← every text the bot sends (edit the wording here)
src/flow.js        ← the conversation steps + your admin commands
src/whatsapp.js    ← talks to the WhatsApp Cloud API
src/server.js      ← webhook server Meta calls
src/store.js       ← saves chats and orders in data/*.json
assets/            ← product photo the bot sends (served at /assets/...)
scripts/simulate.js← terminal simulator
.env.example       ← copy to .env and fill in
```

## Your admin commands (send them from your OWNER_PHONE to the bot's number)

| Command | What it does |
|---|---|
| `pedidos` | lists payments waiting for verification |
| `pagado AZ1234` | confirms the payment and notifies the customer |
| `guia AZ1234 0012345` | sends the LAAR tracking number to the customer |
| `guia SUB1234 0012345` | ships the next prepaid notebook of a Plan Anual |
| `responder 5939XXXXXXXX hola!` | writes to a customer from the business number |
| `bot 5939XXXXXXXX` | gives a chat back to the bot after "asesor" |
| `suscripciones` | lists active subscriptions and next delivery dates |
| `recordar SUB1234` | asks for a subscription's renewal payment now |
| `comandos` | shows this list |
