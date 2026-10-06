/* Сборка слайдов: футер со шкалой времени, подписи к 3D, графики, недостающие портреты. */
const NS = 'http://www.w3.org/2000/svg';
const ACTS = {
  0: ['', 'Введение'], 1: ['I', 'Описывать'], 2: ['II', 'Считать'], 3: ['III', 'Предупреждать'],
  4: ['IV', 'Вся планета'], 5: ['V', 'И у нас'], 6: ['', 'Итог'],
};
const ERA = { 1: [1769, 1913], 2: [1920, 1958], 3: [1945, 1972], 4: [1957, 2025], 5: [1840, 1940] };
const css = (el, p) => getComputedStyle(el).getPropertyValue(p).trim();
const svg = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const C = { ink: '#0F0F0E', paper: '#F1EFEA', c1: '#1E5B3A', c2: '#1F3FD6', c3: '#E5321D', c4: '#F2B705', stone: '#6F6C66' };

if (new URLSearchParams(location.search).has('render')) document.body.classList.add('render');

/* ---------- футер ---------- */
function footer(slide, i, n) {
  if (slide.hasAttribute('data-nofoot')) return;
  const act = +slide.dataset.act || 0;
  const inv = slide.hasAttribute('data-foot-inv');
  const f = document.createElement('div');
  f.className = 'foot' + (inv ? ' inv' : '');
  if (slide.dataset.footLeft) f.style.left = slide.dataset.footLeft + 'px';
  if (slide.dataset.footRight) f.style.right = slide.dataset.footRight + 'px';
  const [rn, name] = ACTS[act];
  f.innerHTML = `<div class="act">${rn ? `<i>${rn}</i> ` : ''}${name}</div><svg></svg><div class="pg">${String(i + 1).padStart(2, '0')} / ${n}</div>`;
  slide.appendChild(f);
  const s = f.querySelector('svg');
  const W = s.getBoundingClientRect().width || 1000;
  s.setAttribute('viewBox', `0 0 ${W} 40`);
  const x = y => (y - 1760) / (2030 - 1760) * W;
  const base = inv ? 'rgba(255,255,255,.7)' : css(slide, '--mute');
  const acc = css(slide, '--accent');
  const mark = slide.classList.contains('field') ? css(slide, '--fg') : acc;
  svg('line', { x1: 0, x2: W, y1: 26, y2: 26, stroke: base, 'stroke-width': 1 }, s);
  for (let y = 1770; y <= 2020; y += 10) {
    const big = y % 50 === 0;
    svg('line', { x1: x(y), x2: x(y), y1: big ? 19 : 22, y2: 26, stroke: base, 'stroke-width': 1 }, s);
    if (big) { const t = svg('text', { x: x(y), y: 40, 'text-anchor': 'middle', fill: base, 'font-family': 'IBM Plex Mono', 'font-size': 12 }, s); t.textContent = y; }
  }
  if (ERA[act] && act !== 5) svg('rect', { x: x(ERA[act][0]), y: 24.5, width: x(ERA[act][1]) - x(ERA[act][0]), height: 3, fill: mark }, s);
  const yr = slide.dataset.year;
  if (yr) {
    const [a, b] = yr.split('-').map(Number);
    if (b) svg('rect', { x: x(a), y: 22, width: x(b) - x(a), height: 8, fill: mark }, s);
    else svg('rect', { x: x(a) - 5, y: 21, width: 10, height: 10, fill: mark }, s);
    const t = svg('text', { x: x(b ? (a + b) / 2 : a), y: 12, 'text-anchor': 'middle', fill: mark, 'font-family': 'IBM Plex Mono', 'font-size': 14, 'font-weight': 500 }, s);
    t.textContent = slide.dataset.yearLabel || yr;
  }
}

/* ---------- подписи к 3D-рендерам (координаты из assets/render3d/<name>.json) ---------- */
async function annotate(el) {
  const meta = await (await fetch(`/assets/render3d/${el.dataset.src}.json`)).json();
  const items = JSON.parse(el.dataset.items);
  const box = el.getBoundingClientRect();
  const W = box.width, H = box.height;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}` });
  el.appendChild(s);
  const slide = el.closest('.slide');
  const fg = css(slide, '--fg'), acc = css(slide, '--accent'), bg = css(slide, '--bg');
  for (const it of items) {
    const [nx, ny] = meta.anchors[it.a];
    const ax = nx * W, ay = ny * H;
    const lx = it.x != null ? it.x : ax + (it.dx || 0), ly = it.y != null ? it.y : ay + (it.dy || 0);
    svg('line', { x1: ax, y1: ay, x2: lx, y2: ly, stroke: it.c || fg, 'stroke-width': 1.5 }, s);
    svg('rect', { x: ax - 6, y: ay - 6, width: 12, height: 12, fill: it.dot || acc, stroke: bg, 'stroke-width': 2.5 }, s);
    const lab = document.createElement('div');
    lab.className = 'lab' + (it.chip ? ' chip' : '');
    lab.innerHTML = (it.s ? `<small>${it.s}</small>` : '') + it.t;
    if (it.c) lab.style.color = it.c;
    const left = lx < ax;
    lab.style.top = `${ly}px`;
    if (left) { lab.style.right = `${W - lx + 10}px`; lab.style.textAlign = 'right'; } else lab.style.left = `${lx + 10}px`;
    lab.style.transform = `translateY(${it.va === 'top' ? '-100%' : it.va === 'bottom' ? '0' : '-50%'})`;
    el.appendChild(lab);
  }
}

/* ---------- портреты, которых пока нет: если файл появится в assets/photos, он подставится сам ---------- */
async function photos() {
  for (const el of document.querySelectorAll('[data-photo]')) {
    const src = `/assets/photos/${el.dataset.photo}`;
    const ok = await fetch(src, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
    if (!ok) { if (el.hasAttribute('data-optional')) el.remove(); continue; }
    el.querySelectorAll('.ini').forEach(n => n.remove());
    const im = document.createElement('img');
    im.src = src;
    if (el.dataset.pos) im.style.objectPosition = el.dataset.pos;
    el.prepend(im);
  }
}

/* ---------------- графики ---------------- */
let DATA;
const CHARTS = {};
const mk = el => {
  const W = el.clientWidth, H = el.clientHeight;
  return [d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).style('overflow', 'visible'), W, H];
};
const txt = (s, x, y, t, o = {}) => s.append('text').attr('x', x).attr('y', y).attr('fill', o.fill || C.ink).attr('font-family', o.ff || 'IBM Plex Mono')
  .attr('font-size', o.fs || 15).attr('font-weight', o.fw || 400).attr('text-anchor', o.ta || 'start').attr('letter-spacing', o.ls || 0).text(t);

CHARTS.harelynx = (el) => {
  const { years, hare, lynx } = DATA.hare_lynx;
  const [s, W, H] = mk(el), m = { l: 56, r: 20, t: 20, b: 46 };
  const x = d3.scaleLinear([1900, 1920], [m.l, W - m.r]), y = d3.scaleLinear([0, 80], [H - m.b, m.t]);
  for (const v of [0, 20, 40, 60, 80]) {
    s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', v ? 'rgba(15,15,14,.14)' : C.ink).attr('stroke-width', v ? 1 : 1.5);
    txt(s, m.l - 12, y(v) + 5, v, { ta: 'end', fill: C.stone });
  }
  for (const yr of [1900, 1905, 1910, 1915, 1920]) txt(s, x(yr), H - m.b + 30, yr, { ta: 'middle', fill: C.stone });
  const line = d3.line().x((d, i) => x(years[i])).y(d => y(d)).curve(d3.curveMonotoneX);
  s.append('path').attr('d', line(hare)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 4.5);
  s.append('path').attr('d', line(lynx)).attr('fill', 'none').attr('stroke', C.c2).attr('stroke-width', 4.5);
  for (const [v, c] of [[hare, C.ink], [lynx, C.c2]]) s.append('g').selectAll('rect').data(v).join('rect')
    .attr('x', (d, i) => x(years[i]) - 4).attr('y', d => y(d) - 4).attr('width', 8).attr('height', 8).attr('fill', c);
  // пики и запаздывание
  for (const [a, b] of [[1903, 1904], [1913, 1915]]) {
    s.append('line').attr('x1', x(a)).attr('x2', x(a)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', C.ink).attr('stroke-dasharray', '2 5');
    s.append('line').attr('x1', x(b)).attr('x2', x(b)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', C.c2).attr('stroke-dasharray', '2 5');
    s.append('line').attr('x1', x(a)).attr('x2', x(b)).attr('y1', m.t + 4).attr('y2', m.t + 4).attr('stroke', C.c2).attr('stroke-width', 2).attr('marker-end', 'url(#arH)');
  }
  s.append('defs').append('marker').attr('id', 'arH').attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', C.c2);
};

CHARTS.lv = (el) => {
  // модель Лотки-Вольтерры (схема): жертва и хищник
  const [s, W, H] = mk(el);
  const ca = el.dataset.a || C.ink, cb = el.dataset.b || C.c2, sw = +(el.dataset.w || 4);
  let N = 10, P = 5; const a = 1.1, b = .4, c = .4, d = .1, dt = .01, pts = [];
  for (let t = 0; t < 30; t += dt) { const dN = (a * N - b * N * P) * dt, dP = (d * N * P - c * P) * dt; N += dN; P += dP; pts.push([t, N, P]); }
  const x = d3.scaleLinear([0, 30], [0, W]), y = d3.scaleLinear([0, d3.max(pts, p => Math.max(p[1], p[2])) * 1.05], [H, 0]);
  s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(pts)).attr('fill', 'none').attr('stroke', ca).attr('stroke-width', sw);
  s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[2]))(pts)).attr('fill', 'none').attr('stroke', cb).attr('stroke-width', sw);
};

CHARTS.waffle = (el) => {
  const cols = 49, rows = 25, n = cols * rows; // 1225 = «1200 с лишним»
  const [s, W] = mk(el), g = W / cols, sz = g * .62;
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const brave = new Set(); while (brave.size < 12) brave.add(Math.floor(rnd() * n));
  const volterra = [...brave][3];
  for (let i = 0; i < n; i++) {
    const cx = (i % cols) * g + g / 2, cy = Math.floor(i / cols) * g + g / 2, B = brave.has(i);
    const z = B ? g * .86 : sz;
    s.append('rect').attr('x', cx - z / 2).attr('y', cy - z / 2).attr('width', z).attr('height', z).attr('fill', B ? C.c2 : 'rgba(15,15,14,.16)');
    if (i === volterra) {
      s.append('rect').attr('x', cx - g * 1.1).attr('y', cy - g * 1.1).attr('width', g * 2.2).attr('height', g * 2.2).attr('fill', 'none').attr('stroke', C.c2).attr('stroke-width', 2);
      el.dataset.vx = cx; el.dataset.vy = cy;
    }
  }
  const lab = el.parentElement.querySelector('[data-volterra-label]');
  if (lab) { lab.style.left = (+el.dataset.vx + el.offsetLeft + g * 1.6) + 'px'; lab.style.top = (+el.dataset.vy + el.offsetTop - 13) + 'px'; }
};

CHARTS.gause = (el) => {
  // схема опыта: два вида с одинаковой пищей в одной пробирке
  const [s, W, H] = mk(el), m = { l: 0, r: 0, t: 30, b: 34 };
  const x = d3.scaleLinear([0, 24], [m.l, W - m.r]), y = d3.scaleLinear([0, 1], [H - m.b, m.t]);
  const A = [], B = []; let a = .02, b = .06;
  for (let t = 0; t <= 24; t += .05) { A.push([t, a]); B.push([t, b]); const da = .75 * a * (1 - a - .6 * b), db = .8 * b * (1 - b - 1.9 * a); a += da * .05; b += db * .05; }
  const line = d3.line().x(p => x(p[0])).y(p => y(p[1])).curve(d3.curveBasis);
  s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', C.ink).attr('stroke-width', 1.5);
  s.append('path').attr('d', line(A)).attr('fill', 'none').attr('stroke', C.c2).attr('stroke-width', 5);
  s.append('path').attr('d', line(B)).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 5);
  txt(s, W, y(A[A.length - 1][1]) - 14, 'вид 1 вытесняет', { ta: 'end', fill: C.c2, ff: 'Inter Tight', fs: 22, fw: 600 });
  txt(s, W, y(B[B.length - 1][1]) - 12, 'вид 2 исчезает', { ta: 'end', fill: C.ink, ff: 'Inter Tight', fs: 22, fw: 600 });
  txt(s, 0, H - 6, 'ДНИ ОПЫТА →', { fill: C.stone, fs: 14 });
};

CHARTS.limits = (el) => {
  // качественная схема «стандартного» сценария (не данные)
  const [s, W, H] = mk(el), m = { l: 0, r: 0, t: 40, b: 46 };
  const x = d3.scaleLinear([1900, 2100], [m.l, W - m.r]), y = d3.scaleLinear([0, 1], [H - m.b, m.t]);
  const bump = (mu, sl, sr, h) => t => h * Math.exp(-((t - mu) ** 2) / (2 * (t < mu ? sl : sr) ** 2));
  const curves = [
    ['#8F8B83', t => 0.9 / (1 + Math.exp((t - 2015) / 20)) + .04],
    [C.c4, bump(2012, 30, 22, .8)],
    ['#5FA36E', bump(2018, 38, 24, .55)],
    [C.paper, bump(2040, 45, 30, .62)],
    [C.c3, bump(2058, 22, 20, .42)],
  ];
  const ts = d3.range(1900, 2100.1, 1);
  s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'rgba(241,239,234,.5)');
  for (const yr of [1900, 1972, 2000, 2100]) txt(s, x(yr), H - 12, yr, { ta: yr === 1900 ? 'start' : yr === 2100 ? 'end' : 'middle', fill: yr === 1972 ? C.c3 : '#94908A' });
  s.append('line').attr('x1', x(1972)).attr('x2', x(1972)).attr('y1', y(0)).attr('y2', m.t - 22).attr('stroke', C.c3).attr('stroke-width', 1.5);
  txt(s, x(1972) + 10, m.t - 10, 'ДОКЛАД', { fill: C.c3, fs: 14 });
  for (const [c, f] of curves) {
    const pts = ts.map(t => [t, f(t)]);
    s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(pts.filter(p => p[0] <= 1972))).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 4);
    s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(pts.filter(p => p[0] >= 1972))).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 4).attr('stroke-dasharray', '9 7');
  }
};

CHARTS.gaia = (el) => {
  const [s, W, H] = mk(el), cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 70;
  s.append('defs').append('marker').attr('id', 'arG').attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', C.c4);
  const P = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  for (const [a0, a1, lab, am] of [[-145, -35, 'ТЕМПЕРАТУРА', -90], [-5, 85, 'СОСТАВ ВОЗДУХА', 25], [115, 205, 'СОЛЕНОСТЬ ОКЕАНА', 112]]) {
    const [x0, y0] = P(a0), [x1, y1] = P(a1);
    s.append('path').attr('d', `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`).attr('fill', 'none').attr('stroke', C.c4).attr('stroke-width', 3).attr('marker-end', 'url(#arG)');
    const rr = r + 28, k = Math.cos(am * Math.PI / 180);
    txt(s, cx + rr * k, cy + rr * Math.sin(am * Math.PI / 180) + 6, lab, { fill: C.c4, fs: 18, ls: 1, ta: k > .3 ? 'start' : k < -.3 ? 'end' : 'middle' });
  }
};

CHARTS.lifespans = (el) => {
  const people = DATA.lifespans.people;
  const [s, W, H] = mk(el), m = { l: 210, r: 70, t: 20, b: 40 };
  const x = d3.scaleLinear([1760, 2030], [m.l, W - m.r]);
  const y = d3.scaleBand(people.map(p => p[0]), [m.t, H - m.b]).padding(.36);
  const colors = { 1: C.c1, 2: C.c2, 3: C.c3, 4: C.c4 };
  s.append('rect').attr('x', x(1925)).attr('width', x(1980) - x(1925)).attr('y', m.t - 10).attr('height', H - m.b - m.t + 10).attr('fill', 'rgba(241,239,234,.07)');
  for (const yr of [1925, 1980]) {
    s.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', m.t - 10).attr('y2', H - m.b).attr('stroke', 'rgba(241,239,234,.45)').attr('stroke-dasharray', '2 5');
    txt(s, x(yr), H - 12, yr, { ta: 'middle', fill: C.paper, fw: 500 });
  }
  for (const yr of [1800, 1850, 1900, 2000]) txt(s, x(yr), H - 12, yr, { ta: 'middle', fill: '#94908A' });
  const long = Object.fromEntries(DATA.longevity);
  for (const [name, b, d, w, g] of people) {
    const yy = y(name), h = y.bandwidth();
    txt(s, m.l - 16, yy + h / 2 + 6, name.replace(/^(\S+) /, (mm, f) => f[0] + '. '), { ta: 'end', fill: C.paper, ff: 'Inter Tight', fs: 18, fw: 500 });
    s.append('rect').attr('x', x(b)).attr('width', x(d) - x(b)).attr('y', yy).attr('height', h).attr('fill', colors[g]);
    s.append('rect').attr('x', x(w) - 5).attr('y', yy - 3).attr('width', 10).attr('height', h + 6).attr('fill', C.paper);
    if (long[name]) txt(s, x(d) + 10, yy + h / 2 + 7, long[name], { fill: C.paper, ff: 'Inter Tight', fs: 20, fw: 800 });
  }
};

CHARTS.lanes = (el) => {
  const [s, W, H] = mk(el);
  const x = d3.scaleLinear([1830, 1980], [30, W - 30]);
  const yA = H * .3, yB = H * .7;
  for (const yr of [1850, 1875, 1900, 1925, 1950, 1975]) {
    s.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', 0).attr('y2', H - 34).attr('stroke', 'rgba(15,15,14,.1)');
    txt(s, x(yr), H - 6, yr, { ta: 'middle', fill: C.stone, fs: 15 });
  }
  s.append('line').attr('x1', x(1832)).attr('x2', x(1978)).attr('y1', yA).attr('y2', yA).attr('stroke', C.ink).attr('stroke-width', 1.5);
  s.append('line').attr('x1', x(1832)).attr('x2', x(1978)).attr('y1', yB).attr('y2', yB).attr('stroke', C.ink).attr('stroke-width', 5);
  const A = [
    [1840, 'закон минимума', 'Либих', 1], [1866, 'экология', 'Геккель', -1], [1875, 'биосфера', 'Зюсс', 1], [1877, 'биоценоз', 'Мебиус', -2.2],
    [1913, 'толерантность', 'Шелфорд', 1], [1927, 'пищевая цепь', 'Элтон', -1], [1935, 'экосистема', 'Тенсли', 1], [1942, 'правило 10%', 'Линдеман', -2.2], [1972, 'Гея', 'Лавлок', 1],
  ];
  const B = [
    [1845, 'животное и среда', 'Рулье', 1, '1840-1850-е'], [1855, 'первая экологическая работа', 'Северцов', -1], [1908, 'идея заповедников', 'Кожевников', 1],
    [1917, 'Баргузинский заповедник', '', -2.2], [1926, 'учение о биосфере', 'Вернадский', 2.2], [1934, 'конкурентное исключение', 'Гаузе', -1], [1940, 'биогеоценоз', 'Сукачев', 1],
  ];
  const put = (arr, yy, filled) => {
    for (const [yr, t, who, side, yl] of arr) {
      const up = side < 0, k = Math.abs(side), ly = yy + (up ? -1 : 1) * 30 * k;
      s.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', yy).attr('y2', ly + (up ? -2 : 2)).attr('stroke', C.ink).attr('stroke-width', 1);
      s.append('rect').attr('x', x(yr) - 7).attr('y', yy - 7).attr('width', 14).attr('height', 14).attr('fill', filled ? C.ink : C.paper).attr('stroke', C.ink).attr('stroke-width', 2);
      const g = s.append('text').attr('x', x(yr)).attr('y', up ? ly - 30 : ly + 22).attr('text-anchor', 'middle');
      g.append('tspan').attr('x', x(yr)).attr('font-family', 'Inter Tight').attr('font-size', 20).attr('font-weight', 600).attr('fill', C.ink).text(t);
      g.append('tspan').attr('x', x(yr)).attr('dy', 23).attr('font-family', 'IBM Plex Mono').attr('font-size', 14).attr('fill', C.stone).text(`${who}${who ? ' · ' : ''}${yl || yr}`);
    }
  };
  put(A, yA, false); put(B, yB, true);
};

CHARTS.roadmap = (el) => {
  const [s, W, H] = mk(el);
  const x = d3.scaleLinear([1760, 2030], [0, W]), y0 = H - 50;
  s.append('line').attr('x1', 0).attr('x2', W).attr('y1', y0).attr('y2', y0).attr('stroke', C.ink).attr('stroke-width', 1.5);
  for (let yr = 1770; yr <= 2020; yr += 10) {
    const big = yr % 50 === 0;
    s.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', y0 - (big ? 12 : 6)).attr('y2', y0).attr('stroke', C.ink);
    if (big) txt(s, x(yr), y0 + 32, yr, { ta: 'middle', fill: C.stone, fs: 17 });
  }
  [[1769, 1913, C.c1], [1920, 1958, C.c2], [1945, 1972, C.c3], [1957, 2025, C.c4]].forEach(([a, b, c], i) => {
    s.append('rect').attr('x', x(a)).attr('width', x(b) - x(a)).attr('y', y0 - 34 - i * 22).attr('height', 14).attr('fill', c);
  });
};

CHARTS.foodweb = (el) => {
  // упрощенная пищевая сеть Арктики (схема): кто кого ест
  const [s, W, H] = mk(el);
  const N = {
    plank: [0.30, .88, 'планктон и водоросли', 'l'], krill: [0.30, .66, 'рачки', 'l'], fish: [0.30, .44, 'рыба', 'l'],
    seal: [0.30, .22, 'тюлени', 'l'], bear: [0.30, .02, 'белый медведь', 'l'], bird: [0.50, .30, 'морские птицы', 'r'],
    moss: [0.72, .88, 'мхи и лишайники', 'r'], insect: [0.62, .66, 'насекомые', 'r'], goose: [0.86, .66, 'гуси', 'r'],
    bunting: [0.66, .44, 'пуночка', 'r'], fox: [0.74, .14, 'песец', 'r'],
  };
  const E = [['plank', 'krill'], ['krill', 'fish'], ['krill', 'bird'], ['fish', 'seal'], ['fish', 'bird'], ['seal', 'bear'], ['bird', 'fox'],
    ['moss', 'insect'], ['moss', 'goose'], ['insect', 'bunting'], ['bunting', 'fox'], ['goose', 'fox']];
  s.append('defs').append('marker').attr('id', 'arF').attr('viewBox', '0 0 10 10').attr('refX', 10).attr('refY', 5).attr('markerWidth', 8).attr('markerHeight', 8).attr('orient', 'auto')
    .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', C.c2);
  const pos = k => [N[k][0] * W, N[k][1] * H];
  // размеры подписей
  const box = {};
  for (const [k, [px, py, t, side]] of Object.entries(N)) {
    const g = s.append('text').attr('x', px * W + (side === 'l' ? -16 : 16)).attr('y', py * H + 8).attr('text-anchor', side === 'l' ? 'end' : 'start').attr('font-family', 'Inter Tight').attr('font-size', 23).attr('font-weight', k === 'bear' || k === 'fox' ? 700 : 500).attr('fill', C.ink).text(t);
    box[k] = g.node().getBBox();
  }
  for (const [a, b] of E) {
    const [x1, y1] = pos(a), [x2, y2] = pos(b);
    const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    s.insert('line', 'text').attr('x1', x1 + ux * 12).attr('y1', y1 + uy * 12).attr('x2', x2 - ux * 14).attr('y2', y2 - uy * 14).attr('stroke', C.c2).attr('stroke-width', 2).attr('marker-end', 'url(#arF)');
  }
  for (const k of Object.keys(N)) { const [x0, y0] = pos(k); s.append('rect').attr('x', x0 - 7).attr('y', y0 - 7).attr('width', 14).attr('height', 14).attr('fill', C.ink); }
};

async function main() {
  DATA = await (await fetch('/assets/data/charts.json')).json();
  await photos();
  await document.fonts.ready;
  const slides = [...document.querySelectorAll('.slide')];
  slides.forEach((s, i) => { s.id = s.id || 's' + (i + 1); footer(s, i, slides.length); });
  await Promise.all([...document.querySelectorAll('.anno[data-src]')].map(annotate));
  for (const el of document.querySelectorAll('[data-chart]')) CHARTS[el.dataset.chart](el);
  await Promise.all([...document.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  window.__deckReady = true;
}
main().catch(e => { window.__deckError = String(e.stack || e); console.error(e); });
