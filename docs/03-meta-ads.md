# Step 5 – Click-to-WhatsApp ads

Goal: someone sees the notebook on Instagram/Facebook → taps **"Send message"** → WhatsApp opens with a message already typed → the bot takes over.

## 5.1 Create the campaign (Ads Manager)

1. [adsmanager.facebook.com](https://adsmanager.facebook.com) → **Create**.
2. Objective: **Engagement** (or **Sales**) → conversion location: **Messaging apps → WhatsApp**.
3. Campaign budget: start with **5–10 USD/day**. Don't touch it for 3–4 days (the algorithm needs to learn).
4. **Ad set**
   - Location: Ecuador (or just your cities first if you want faster delivery/cheaper LAAR).
   - Age: **18–30** to start (Meta heavily restricts targeting under-18s).
   - Interests: leave **broad** (Advantage+ audience). With a visual product, broad usually beats detailed interests. If you want to test one interest set: stationery, journaling, bullet journal, aesthetic, Pinterest, university students.
   - Placements: Advantage+ (automatic). Most sales will come from Instagram Reels/Stories.
   - WhatsApp number: select the bot's number.
5. **Ad**
   - Format: single video/image or carousel. **Vertical 9:16 video** works best: unboxing, flipping the pages, writing in it, close-ups of the cover.
   - Primary text (example):
     > El cuaderno más bonito que vas a tener 💙✨ Tapa dura azul, minimalista, con cinta marcapáginas. Envíos a todo Ecuador con LAAR o retiro gratis en tienda. ¡Escríbenos y pídelo en 1 minuto!
   - CTA button: **Send WhatsApp message**.
   - **Message template → Pre-filled message**: `¡Hola! Quiero el cuaderno azul 💙` (keep it short — the bot replies to anything, so no exact text is required).

## 5.2 Creative ideas that sell to young people

- "POV: encontraste el cuaderno más aesthetic de Ecuador" + slow page flip.
- Hands writing / doing a study-with-me / desk setup with the notebook.
- Before/after: messy notes vs. pretty notes.
- Gift angle: "el regalo perfecto" (birthdays, Christmas, back to school — Sierra in September, Costa in April/May).
- Make **3–5 different ads** in the same ad set; after 4–5 days turn off the worst ones.

## 5.3 Measuring

- In Ads Manager watch **cost per messaging conversation started**. Rough sanity check: if a conversation costs ~0.30–1.00 USD and 1 in 4 chats buys, your cost per sale is ~1.20–4.00 USD. Compare with your margin.
- The bot saves the **ad ID** (`adId`) in each order (`data/orders.json`) so you can see which ad actually produced sales, not just chats.
- Rule of thumb: kill ads with a high cost per conversation after ~10 USD spent; duplicate the winners with new hooks.

## 5.4 Later (optional)

- Retargeting: ads to people who watched 50%+ of your videos or interacted with your Instagram.
- Send purchase events back to Meta (Conversions API for business messaging) so Meta optimizes for buyers, not just chats. Ask me to add it when you have ~50 sales/week.
