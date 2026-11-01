// Builds docs/demo/index.html: a browser chat simulator that runs the REAL bot code
// (src/messages.js + src/flow.js), so you can try the funnel from your phone.
//   npm run build:demo
//   node scripts/build-demo.js <extra-output.html>   (also writes a body-only copy)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const strip = (code) => code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
const pricingCode = strip(read('src/pricing.js')) + '\n' + strip(read('src/subscriptions.js'));
const messages = read('src/messages.js');
const exported = [...messages.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
const messagesCode = messages.replace(/^import .*$/gm, '').replace(/^export /gm, '') + `\nconst M = { ${exported.join(', ')} };\n`;
const flowCode = read('src/flow.js')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '');

const dataUri = (file) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, file)).toString('base64');
const img = dataUri('assets/cuaderno-thumb.jpg');
const plansImg = dataUri('assets/planes.jpg');

const body = read('scripts/demo-template.html')
  .replace('/*__BOT_CODE__*/', () => `${pricingCode}\n${messagesCode}\n${flowCode}`)
  .replaceAll('__IMG__', img)
  .replaceAll('__PLANS_IMG__', plansImg);

const full = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'docs/demo/index.html'), full);
console.log('wrote docs/demo/index.html');
if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], body);
  console.log('wrote', process.argv[2]);
}
