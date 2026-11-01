// Volume pricing: the more notebooks, the lower the price per notebook.
// Tiers come from PRICE_TIERS, e.g. "1:15" (or "1:15,5:13" for a bulk price from 5)

export const round = (n) => Math.round(n * 100) / 100;

export const parseTiers = (spec) =>
  spec
    .split(',')
    .map((part) => part.split(':').map(Number))
    .filter(([min, unit]) => min >= 1 && unit > 0)
    .map(([min, unit]) => ({ min, unit }))
    .sort((a, b) => a.min - b.min);

export const unitPrice = (qty, cfg) => {
  let unit = cfg.pricing[0].unit;
  for (const t of cfg.pricing) if (qty >= t.min) unit = t.unit;
  return unit;
};

export const hasFreeShipping = (qty, cfg) => cfg.freeShippingFrom > 0 && qty >= cfg.freeShippingFrom;

// Full price breakdown for a quantity and delivery method.
export function quote(qty, method, cfg) {
  const unit = unitPrice(qty, cfg);
  const subtotal = round(unit * qty);
  const savings = round(cfg.pricing[0].unit * qty - subtotal);
  const shipping = method === 'delivery' && !hasFreeShipping(qty, cfg) ? cfg.shippingCost : 0;
  return { qty, unit, subtotal, savings, shipping, total: round(subtotal + shipping) };
}

// Subscription plans. "club" = pay each delivery; "annual" = pay one year upfront.
// Savings are measured against buying one notebook with delivery each time.
export function planQuote(plan, months, cfg) {
  const s = cfg.subscription;
  const singleDelivered = quote(1, 'delivery', cfg).total;
  if (plan === 'club') {
    return { plan, months, deliveries: 1, unit: s.clubPrice, total: s.clubPrice, savings: round(singleDelivered - s.clubPrice) };
  }
  const deliveries = Math.round(12 / months);
  const total = round(s.annualPrice * deliveries);
  return { plan, months, deliveries, unit: s.annualPrice, total, savings: round(singleDelivered * deliveries - total) };
}

// The numbers printed on the plans image (assets/planes.jpg). If any of these change
// in .env, the image is out of date and the bot falls back to the text version.
export const planImageKey = (cfg) =>
  [
    cfg.product.price,
    cfg.shippingCost,
    cfg.freeShippingFrom,
    cfg.subscription.clubPrice,
    cfg.subscription.annualPrice,
    cfg.subscription.defaultMonths,
  ].join('|');
