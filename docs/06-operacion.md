# Step 6 – Daily routine (≈15 min)

1. **When you get a "💰 Nuevo comprobante" alert** → open your DeUna/bank app → if the money is there, reply to the bot: `pagado AZ1234`. The customer gets the confirmation automatically.
   - Not there? Use `responder 5939XXXXXXXX Hola! Aún no nos llega el pago, ¿nos ayudas revisando?`
2. **Once a day**, write `pedidos` to see anything still pending.
3. **Delivery orders**: create the guías in LAAR, pack, hand over. Then for each: `guia AZ1234 <número de guía>`.
4. **Pickup orders**: when they arrive, ask for the name or AZ code.
5. **"🙋 Un cliente pidió hablar con una persona"** alert → answer with `responder <número> <mensaje>` → when done, `bot <número>`.
6. **Every 3–4 days**: check Ads Manager, turn off bad ads, try new videos.

## Where is my data?

- `data/orders.json` — all orders (status: `awaiting_payment` → `verifying` → `paid` → `shipped`).
- `data/sessions.json` — where each chat is in the flow.

Customers who reached the payment step but never paid (`awaiting_payment`) are warm leads: write to them within 24 h with `responder`.
