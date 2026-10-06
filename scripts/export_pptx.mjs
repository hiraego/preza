// Разбор слайдов на слои для нативного PPTX: build/pptx/plan.json + картинки слоев (PNG с прозрачностью)
// Дальше: python3 scripts/build_pptx.py
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serve, ROOT } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const SCALE = 4 / 3; // 2560x1440
const only = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const OUT = path.join(ROOT, 'build/pptx');
fs.mkdirSync(OUT, { recursive: true });

const { srv, url } = await serve();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(`${url}/src/deck.html?render`);
await page.waitForFunction(() => window.__deckReady || window.__deckError, null, { timeout: 120000 });
await page.addScriptTag({ path: path.join(ROOT, 'scripts/pptx_extract.js') });

const n = await page.$$eval('section.slide', s => s.length);
const slides = await page.$$('section.slide');
const plan = { scale: SCALE, slides: [] };
for (let i = 0; i < n; i++) {
  if (only.length && !only.includes(i + 1)) { plan.slides.push(null); continue; }
  const p = await page.evaluate(i => window.__pptxPlan(i), i);
  const tag = String(i + 1).padStart(2, '0');
  if (p.hasBefore) {
    await page.evaluate(i => window.__pptxCapture(i, -1), i);
    p.bgImage = `${tag}_bg.png`;
    await slides[i].screenshot({ path: path.join(OUT, p.bgImage), omitBackground: true });
  }
  for (const L of p.layers) {
    if (!L.visual) continue;
    await page.evaluate(([i, j]) => window.__pptxCapture(i, j), [i, L.j]);
    L.image = `${tag}_${String(L.j).padStart(2, '0')}.png`;
    await slides[i].screenshot({ path: path.join(OUT, L.image), omitBackground: true });
  }
  await page.evaluate(i => window.__pptxReset(i), i);
  plan.slides.push(p);
  process.stdout.write(`${i + 1} `);
}
fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan));
console.log(`\n${n} slides -> build/pptx/plan.json`);
await browser.close();
srv.close();
