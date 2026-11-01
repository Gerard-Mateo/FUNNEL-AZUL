// Volume pricing: the more notebooks, the lower the price per notebook.
// Tiers come from PRICE_TIERS, e.g. "1:15,3:12"
//   -> 1-2 notebooks $15 each, 3 or more $12 each (the 2nd tier is the "pack" the bot offers)

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
