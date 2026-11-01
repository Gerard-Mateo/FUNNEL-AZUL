// Chat with the bot in your terminal, no Meta account needed.
//   npm run simulate
// Type like a customer. To tap a button, type its number (1, 2, 3).
// To "send a receipt photo", type: /foto
// Owner commands (pagado, guia, ...) also work here: start the line with "owner:"
//   owner: pagado AZ1234

import readline from 'node:readline';
import { config } from '../src/config.js';
import { handleCustomer, handleOwner, newSession } from '../src/flow.js';
import { createStore } from '../src/store.js';
import os from 'node:os';
import path from 'node:path';

const store = createStore(path.join(os.tmpdir(), 'funnel-azul-sim'));
const phone = '593980000001';
let session = newSession(phone);
let lastButtons = [];

const show = (out) => {
  for (const { to, msg } of out) {
    const who = to === phone ? '🤖 Bot' : `📲 A ${to === config.ownerPhone ? 'ti (dueño)' : to}`;
    if (msg.headerImage) console.log(`${who}: [imagen ${msg.headerImage}]`);
    if (msg.type === 'image') console.log(`${who}: [imagen ${msg.link}]`);
    if (msg.type === 'forward_image') console.log(`${who}: [reenvío del comprobante] ${msg.caption}`);
    if (msg.type !== 'forward_image' && (msg.text || msg.caption)) console.log(`${who}:\n${msg.text ?? msg.caption}`);
    if (msg.type === 'buttons') {
      if (to === phone) lastButtons = msg.buttons;
      msg.buttons.forEach((b, i) => console.log(`   [${i + 1}] ${b.title}`));
    }
    if (msg.type === 'list') {
      if (to === phone) lastButtons = msg.rows;
      console.log(`   ☰ ${msg.button}`);
      msg.rows.forEach((r, i) => console.log(`   [${i + 1}] ${r.title}  —  ${r.description}`));
    }
    console.log('');
  }
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log('Simulador Funnel Azul 💙  (Ctrl+C para salir)\n');
const prompt = () => process.stdout.write('👤 Tú: ');
prompt();
for await (const raw of rl) {
  const line = raw.trim();
  if (!process.stdin.isTTY) console.log(line);
  if (line.startsWith('owner:')) {
    store.saveSession(session);
    show(handleOwner(line.slice(6).trim(), { config: { ...config, ownerPhone: config.ownerPhone || 'OWNER' }, store }));
    session = store.getSession(phone) ?? session;
    prompt();
    continue;
  }
  const n = Number(line);
  const incoming =
    line === '/foto'
      ? { imageId: 'SIMULATED_MEDIA' }
      : n >= 1 && n <= lastButtons.length
        ? { buttonId: lastButtons[n - 1].id, text: lastButtons[n - 1].title }
        : { text: line };
  const r = handleCustomer(session, incoming, { config: { ...config, ownerPhone: config.ownerPhone || 'OWNER' }, store });
  session = r.session;
  store.saveSession(session);
  show(r.out);
  prompt();
}
