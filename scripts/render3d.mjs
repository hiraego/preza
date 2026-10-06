// Рендер 3D-сцен из src/3d/scenes в assets/render3d/<имя>.png (+ <имя>.json с координатами подписей)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serve, ROOT } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const OUT = path.join(ROOT, 'assets/render3d');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
// имя файла: сцена + вариант (через query)
const JOBS = [
  ['chimborazo', ''], ['globe', ''], ['barrel', ''], ['pyramid', ''], ['ecosystem', ''],
  ['pond', 'day=28'], ['pond', 'day=29'], ['pond', 'day=30'], ['islands', ''], ['book', ''],
].filter(([s]) => !only.length || only.includes(s));

const { srv, url } = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [scene, q] of JOBS) {
  const name = scene + (q ? '_' + q.split('=')[1] : '');
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log(`[${name}]`, m.text()); });
  page.on('pageerror', e => console.log(`[${name}] pageerror`, e.message));
  const t0 = Date.now();
  await page.goto(`${url}/src/3d/index.html?scene=${scene}${q ? '&' + q : ''}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 600000 });
  const err = await page.evaluate(() => window.__error);
  if (err) { console.log(name, 'ERROR', err); await page.close(); continue; }
  const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  const meta = await page.evaluate(() => ({ size: window.__size, anchors: window.__anchors }));
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(meta, null, 1));
  console.log(name, 'ok', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await page.close();
}
await browser.close();
srv.close();
