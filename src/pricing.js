// Volume pricing: the more notebooks, the lower the price per notebook.
// Tiers come from PRICE_TIERS, e.g. "1:15,2:13.5,3:12,5:11"
//   -> 1 notebook $15 each, 2-4 notebooks $13.50... (each tier applies from its minimum)

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

// Is taking ONE more notebook a clearly better deal? Used for the upsell offer.
export function nextUpgrade(qty, cfg) {
  const next = qty + 1;
  if (next > cfg.maxQty) return null;
  const betterPrice = unitPrice(next, cfg) < unitPrice(qty, cfg);
  const unlocksShipping = hasFreeShipping(next, cfg) && !hasFreeShipping(qty, cfg);
  if (!betterPrice && !unlocksShipping) return null;
  const now = quote(qty, 'pickup', cfg);
  const then = quote(next, 'pickup', cfg);
  return {
    qty: next,
    unit: then.unit,
    extra: round(then.subtotal - now.subtotal), // what the extra notebook really costs
    savings: then.savings,
    unlocksShipping,
  };
}

// Notebooks missing to unlock free delivery, when it's close enough to suggest (1-2).
export const shippingGap = (order, cfg) => {
  if (order.method !== 'delivery' || !cfg.freeShippingFrom || hasFreeShipping(order.qty, cfg)) return 0;
  const gap = cfg.freeShippingFrom - order.qty;
  return gap <= 2 && cfg.freeShippingFrom <= cfg.maxQty ? gap : 0;
};
