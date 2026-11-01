// Draws the plans card (Compra única / Club Azul / Plan Anual) that the bot shows
// above the 3 buttons, using the prices in your .env. Run it again after changing prices:
//   npm run build:image
// Needs Playwright + Chromium on the machine (or ask Claude to run it for you).
// Writes assets/planes.jpg (for WhatsApp) and assets/planes.json (the prices it used).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { config as cfg } from '../src/config.js';
import { planQuote, planImageKey } from '../src/pricing.js';
import { freqLabel } from '../src/subscriptions.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const money = (n) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
const months = cfg.subscription.defaultMonths;
const club = planQuote('club', months, cfg);
const annual = cfg.subscription.annualPrice > 0 ? planQuote('annual', months, cfg) : null;

const row = ({ cls = '', tag = '', name, lines, price, unit, note = '' }) => `
  <div class="row ${cls}">
    ${tag ? `<div class="tag">${tag}</div>` : ''}
    <div class="info">
      <div class="name">${name}</div>
      ${lines.map((l) => `<div class="line">${l}</div>`).join('')}
    </div>
    <div class="price">
      <div class="amount">${price}</div>
      <div class="unit">${unit}</div>
      ${note ? `<div class="note">${note}</div>` : ''}
    </div>
  </div>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Figtree:wght@500;600;700;800&display=swap">
<style>
  /* Shown ~330 px wide on a phone (scale ~0.3): keep every text >= 38 px here. */
  :root { --navy: #1b2f5e; --ink: #16213f; --cream: #f6f0e4; --kraft: #e9dcc6; --muted: #5d5d6c; --gold: #c9a25a; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1080px; height: 1080px; background: var(--kraft); font-family: Figtree, sans-serif; color: var(--ink);
         display: flex; flex-direction: column; padding: 56px 56px 60px; gap: 26px; }
  .brand { font-family: "IBM Plex Mono", monospace; font-size: 38px; letter-spacing: 0.03em; color: var(--navy); }
  .rows { display: flex; flex-direction: column; gap: 30px; flex: 1; }
  .row { position: relative; flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 20px;
         background: var(--cream); border-radius: 30px; padding: 0 44px; border: 4px solid transparent; }
  .row.star { background: var(--navy); color: var(--cream); flex: 1.12; box-shadow: 0 14px 30px rgba(27,47,94,.3); }
  .row.gold { border-color: var(--gold); }
  .tag { position: absolute; top: -24px; left: 36px; font-size: 30px; font-weight: 800; letter-spacing: 0.08em;
         padding: 6px 20px; border-radius: 999px; background: var(--gold); color: var(--navy); }
  .info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .name { font-size: 60px; font-weight: 800; letter-spacing: -0.015em; line-height: 1.05; }
  .line { font-size: 40px; font-weight: 600; color: var(--muted); line-height: 1.15; }
  .star .line { color: #d3dbee; }
  .price { text-align: right; flex: none; display: flex; flex-direction: column; align-items: flex-end; }
  .amount { font-size: 120px; font-weight: 800; letter-spacing: -0.035em; line-height: 0.9; }
  .unit { font-size: 38px; font-weight: 700; color: var(--muted); }
  .star .unit { color: #d3dbee; }
  .note { margin-top: 8px; font-size: 36px; font-weight: 800; color: var(--navy); background: var(--gold);
          border-radius: 12px; padding: 2px 14px; }
</style></head><body>
  <div class="brand">el cuaderno azul · elige tu plan</div>
  <div class="rows">
    ${row({
      name: 'Compra única',
      lines: ['1 o varios', `+ ${money(cfg.shippingCost)} de envío`],
      price: money(cfg.product.price),
      unit: 'c/u',
    })}
    ${row({
      cls: 'star',
      tag: '★ RECOMENDADO',
      name: 'Club Azul',
      lines: [`1 ${freqLabel(months)}`, 'Envío GRATIS'],
      price: money(club.unit),
      unit: 'c/u',
      note: `ahorras ${money(club.savings)} c/u`,
    })}
    ${
      annual
        ? row({
            cls: 'gold',
            name: 'Plan Anual',
            lines: [`${annual.deliveries} cuadernos, 1 pago`, 'Envío GRATIS'],
            price: money(annual.total),
            unit: 'por el año',
            note: `ahorras ${money(annual.savings)}`,
          })
        : ''
    }
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, 'assets/planes.jpg'), type: 'jpeg', quality: 88 });
await browser.close();

fs.writeFileSync(path.join(root, 'assets/planes.json'), JSON.stringify({ key: planImageKey(cfg) }, null, 2) + '\n');
console.log('wrote assets/planes.jpg for prices', planImageKey(cfg));
