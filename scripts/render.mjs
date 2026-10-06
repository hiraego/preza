// Рендер слайдов из src/deck.html (+ заметки докладчика в build/notes.json)
// node scripts/render.mjs            все слайды: JPEG 2560x1440 в build/jpg
// node scripts/render.mjs 3 7 12     только эти слайды
// node scripts/render.mjs --fast     масштаб 1, PNG, для быстрого просмотра
// по умолчанию: JPEG 2560x1440 (build/jpg/NN.jpg) для PDF и PPTX
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serve, ROOT } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const args = process.argv.slice(2);
const fast = args.includes('--fast');
const only = args.filter(a => /^\d+$/.test(a)).map(Number);
const OUT = path.join(ROOT, fast ? 'build/slides' : 'build/jpg');
fs.mkdirSync(OUT, { recursive: true });

const { srv, url } = await serve();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: fast ? 1 : 4 / 3 });
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto(`${url}/src/deck.html?render`);
await page.waitForFunction(() => window.__deckReady || window.__deckError, null, { timeout: 120000 });
const err = await page.evaluate(() => window.__deckError);
if (err) { console.error(err); process.exit(1); }

const slides = await page.$$('section.slide');
const notes = await page.$$eval('section.slide', ss => ss.map(s => (s.querySelector('aside.notes')?.textContent || '').trim().replace(/\s+/g, ' ')));
fs.writeFileSync(path.join(ROOT, 'build/notes.json'), JSON.stringify(notes, null, 1));
for (let i = 0; i < slides.length; i++) {
  if (only.length && !only.includes(i + 1)) continue;
  const f = path.join(OUT, String(i + 1).padStart(2, '0') + (fast ? '.png' : '.jpg'));
  await slides[i].screenshot(fast ? { path: f } : { path: f, type: 'jpeg', quality: 92 });
  process.stdout.write(`${i + 1} `);
}
console.log(`\n${slides.length} slides`);
await browser.close();
srv.close();
