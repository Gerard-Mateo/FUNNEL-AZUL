# Step 2 – Payments: DeUna + transfer

## Recommendation

| Option | Speed | Cost for you | For the customer | Verdict |
|---|---|---|---|---|
| **DeUna (QR)** | instant | check current merchant fees in the app | scans a QR from DeUna or from many bank apps; very popular with young people | ✅ **main option** |
| **Bank transfer** | instant to ~1 day (interbank) | usually free | copy account data, more steps | ✅ backup for people without DeUna |
| Card payment link (Payphone, Kushki…) | instant | % commission per sale | pays with debit/credit card | later, if many people ask for cards |

So yes — **you can use DeUna**, and it's the best fit: it's the fastest for the customer (scan + pay in seconds) and it's already very widespread in Ecuador (millions of users; the DeUna QR is also accepted from apps of many banks and cooperatives).

## Set up DeUna for your business

1. Download the DeUna app and register your business (**DeUna Negocios**). Check the requirements in the app (cédula/RUC, an account to receive the money).
2. Get your **business QR** and save it as an image.
3. Upload the image somewhere public (your website, Cloudinary, Google Drive "anyone with link" direct-download link, etc.) and put the link in `DEUNA_QR_URL`.
4. Optionally put the phone linked to DeUna in `DEUNA_PHONE` (the bot shows it as an alternative to scanning).

The bot sends the QR + the exact amount, the customer pays and sends the screenshot, and **you confirm in 1 tap** with `pagado AZ123` after you see the money in your DeUna/bank app.

> ⚠️ Always check that the money actually arrived before confirming — fake screenshots exist.

## Bank transfer

Fill the `BANK_*` variables. The bot asks the customer to put the **order code (AZ…) as the reference**, so you can match payments easily.

## Future upgrade: automatic payment confirmation

Right now you confirm payments manually (15 seconds per order). If volume grows, payment gateways like **Kushki** or **Payvalida** offer DeUna with a **dynamic QR per order and automatic confirmation** (webhook). Then the bot could confirm the payment by itself without a screenshot. Talk to them about fees and requirements, and I can add the integration.

Sources: [Kushki – DeUna (Ecuador)](https://docs.kushki.com/ec/transfer-payments), [Payvalida – API DeUna](https://docs.payvalida.com/api-deuna/), [Ekos – DeUna en Ecuador](https://ekosnegocios.com/articulo/deuna-la-plataforma-que-integra-los-pagos-digitales-a-la-vida-diaria-de-millones-de-ecuatorianos)
