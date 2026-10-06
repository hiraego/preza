/* Сборка слайдов: футер со шкалой времени, подписи к 3D, графики. Работает и в браузере, и при рендере. */
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

if (new URLSearchParams(location.search).has('render')) document.body.classList.add('render');

function footer(slide, i, n) {
  if (slide.hasAttribute('data-nofoot')) return;
  const act = +slide.dataset.act || 0;
  const f = document.createElement('div');
  f.className = 'foot' + (slide.hasAttribute('data-foot-photo') ? ' on-photo' : '');
  if (slide.dataset.footLeft) f.style.left = slide.dataset.footLeft + 'px';
  if (slide.dataset.footRight) f.style.right = slide.dataset.footRight + 'px';
  const [rn, name] = ACTS[act];
  f.innerHTML = `<div class="act">${rn ? `<i>${rn}</i> · ` : ''}${name}</div><svg></svg><div class="pg">${String(i + 1).padStart(2, '0')} / ${n}</div>`;
  slide.appendChild(f);
  const s = f.querySelector('svg');
  const W = s.getBoundingClientRect().width || 1000;
  s.setAttribute('viewBox', `0 0 ${W} 40`);
  const x = y => (y - 1760) / (2030 - 1760) * W;
  const ink = css(slide, '--muted'), acc = css(slide, '--accent');
  const onPhoto = slide.hasAttribute('data-foot-photo');
  const base = onPhoto ? 'rgba(255,255,255,.55)' : ink;
  svg('line', { x1: 0, x2: W, y1: 26, y2: 26, stroke: base, 'stroke-width': 1, opacity: .6 }, s);
  for (let y = 1770; y <= 2020; y += 10) {
    const big = y % 50 === 0;
    svg('line', { x1: x(y), x2: x(y), y1: big ? 20 : 23, y2: 26, stroke: base, 'stroke-width': 1, opacity: big ? .9 : .5 }, s);
    if (big) { const t = svg('text', { x: x(y), y: 40, 'text-anchor': 'middle', fill: base, 'font-family': 'JetBrains Mono', 'font-size': 12, opacity: .9 }, s); t.textContent = y; }
  }
  if (ERA[act]) svg('line', { x1: x(ERA[act][0]), x2: x(ERA[act][1]), y1: 26, y2: 26, stroke: acc, 'stroke-width': 3, 'stroke-linecap': 'round' }, s);
  const yr = slide.dataset.year;
  if (yr) {
    const [a, b] = yr.split('-').map(Number);
    if (b) svg('line', { x1: x(a), x2: x(b), y1: 26, y2: 26, stroke: acc, 'stroke-width': 7, 'stroke-linecap': 'round' }, s);
    svg('circle', { cx: x(a), cy: 26, r: 6, fill: acc, stroke: onPhoto ? 'rgba(0,0,0,.4)' : css(slide, '--bg'), 'stroke-width': 3 }, s);
    const t = svg('text', { x: x(b ? (a + b) / 2 : a), y: 12, 'text-anchor': 'middle', fill: acc, 'font-family': 'JetBrains Mono', 'font-size': 14, 'font-weight': 500 }, s);
    t.textContent = slide.dataset.yearLabel || yr.replace('-', '-');
  }
}

/* Подписи к 3D-рендерам: координаты точек берутся из assets/render3d/<name>.json */
async function annotate(el) {
  const meta = await (await fetch(`/assets/render3d/${el.dataset.src}.json`)).json();
  const items = JSON.parse(el.dataset.items);
  const box = el.getBoundingClientRect();
  const W = box.width, H = box.height;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}` });
  el.appendChild(s);
  const slide = el.closest('.slide');
  const ink = css(slide, '--ink'), acc = css(slide, '--accent'), bg = css(slide, '--bg');
  for (const it of items) {
    const [nx, ny] = meta.anchors[it.a];
    const ax = nx * W, ay = ny * H;
    const lx = it.x != null ? it.x : ax + (it.dx || 0), ly = it.y != null ? it.y : ay + (it.dy || 0);
    const col = it.c || ink;
    if (!it.nodot) {
      svg('polyline', { points: `${ax},${ay} ${lx},${ly}`, fill: 'none', stroke: col, 'stroke-width': 1.5, opacity: .85 }, s);
      svg('circle', { cx: ax, cy: ay, r: 7, fill: it.dot || acc, stroke: bg, 'stroke-width': 3 }, s);
    }
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.innerHTML = (it.s ? `<small>${it.s}</small>` : '') + it.t;
    lab.style.color = col;
    if (it.chip) { lab.style.background = it.chip === true ? bg : it.chip; lab.style.padding = '5px 12px 6px'; lab.style.borderRadius = '8px'; }
    if (it.fs) lab.style.fontSize = it.fs + 'px';
    const right = lx < ax;
    lab.style.top = `${ly}px`;
    if (right) { lab.style.right = `${W - lx + 14}px`; lab.style.textAlign = 'right'; } else lab.style.left = `${lx + 14}px`;
    lab.style.transform = `translateY(${it.va === 'top' ? '-100%' : it.va === 'bottom' ? '0' : '-50%'})`;
    el.appendChild(lab);
  }
}

/* ---------------- графики ---------------- */
let DATA;
const CHARTS = {};

CHARTS.harelynx = (el) => {
  const { years, hare, lynx } = DATA.hare_lynx;
  const W = el.clientWidth, H = el.clientHeight, m = { l: 70, r: 30, t: 30, b: 50 };
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const x = d3.scaleLinear([1900, 1920], [m.l, W - m.r]), y = d3.scaleLinear([0, 85], [H - m.b, m.t]);
  const slide = el.closest('.slide'), muted = css(slide, '--muted'), rule = css(slide, '--rule');
  s.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).attr('stroke', rule);
  s.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 14).attr('y', d => y(d) + 5).attr('text-anchor', 'end')
    .attr('fill', muted).attr('font-family', 'JetBrains Mono').attr('font-size', 16).text(d => d);
  s.append('g').selectAll('text').data([1900, 1905, 1910, 1915, 1920]).join('text').attr('x', x).attr('y', H - m.b + 32).attr('text-anchor', 'middle')
    .attr('fill', muted).attr('font-family', 'JetBrains Mono').attr('font-size', 16).text(d => d);
  const series = [[hare, '#F2B33D', 'заяц'], [lynx, '#4FD1E8', 'рысь']];
  const line = d3.line().x((d, i) => x(years[i])).y(d => y(d)).curve(d3.curveCatmullRom.alpha(.5));
  const area = d3.area().x((d, i) => x(years[i])).y0(y(0)).y1(d => y(d)).curve(d3.curveCatmullRom.alpha(.5));
  for (const [v, c] of series) {
    s.append('path').attr('d', area(v)).attr('fill', c).attr('opacity', .1);
    s.append('path').attr('d', line(v)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 5).attr('stroke-linejoin', 'round');
    s.append('g').selectAll('circle').data(v).join('circle').attr('cx', (d, i) => x(years[i])).attr('cy', y).attr('r', 4.5).attr('fill', c);
  }
  // пики
  const peaks = [[1903, 77.4, '#F2B33D'], [1904, 59.4, '#4FD1E8'], [1913, 76.6, '#F2B33D'], [1915, 51.1, '#4FD1E8']];
  for (const [yr, v, c] of peaks) s.append('circle').attr('cx', x(yr)).attr('cy', y(v)).attr('r', 11).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 2.5);
  // стрелки «рысь опаздывает»
  for (const [a, b, v] of [[1903, 1904, 83], [1913, 1915, 83]]) {
    s.append('path').attr('d', `M${x(a)},${y(v)} L${x(b)},${y(v)}`).attr('stroke', '#E8EEF6').attr('stroke-width', 2).attr('marker-end', 'url(#ar)');
  }
  const defs = s.append('defs');
  defs.append('marker').attr('id', 'ar').attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', '#E8EEF6');
};

CHARTS.lv = (el) => {
  // численная модель Лотки-Вольтерры (схема): жертва и хищник
  const W = el.clientWidth, H = el.clientHeight;
  let N = 10, P = 5; const a = 1.1, b = .4, c = .4, d = .1, dt = .01, pts = [];
  for (let t = 0; t < 30; t += dt) { const dN = (a * N - b * N * P) * dt, dP = (d * N * P - c * P) * dt; N += dN; P += dP; pts.push([t, N, P]); }
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const x = d3.scaleLinear([0, 30], [0, W]), y = d3.scaleLinear([0, d3.max(pts, p => Math.max(p[1], p[2])) * 1.05], [H - 4, 4]);
  s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(pts)).attr('fill', 'none').attr('stroke', '#F2B33D').attr('stroke-width', 4);
  s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[2]))(pts)).attr('fill', 'none').attr('stroke', '#4FD1E8').attr('stroke-width', 4);
};

CHARTS.waffle = (el) => {
  const cols = 49, rows = 25, n = cols * rows; // 1225: «1200 с лишним»
  const W = el.clientWidth, H = el.clientHeight, gap = W / cols;
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  // 12 отказавшихся: детерминированно разбросаны
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const brave = new Set(); while (brave.size < 12) brave.add(Math.floor(rnd() * n));
  const volterra = [...brave][3];
  for (let i = 0; i < n; i++) {
    const cx = (i % cols) * gap + gap / 2, cy = Math.floor(i / cols) * gap + gap / 2;
    const isB = brave.has(i);
    s.append('circle').attr('cx', cx).attr('cy', cy).attr('r', isB ? gap * .42 : gap * .2).attr('fill', isB ? '#F2B33D' : 'rgba(232,238,246,.28)');
    if (i === volterra) {
      s.append('circle').attr('cx', cx).attr('cy', cy).attr('r', gap * .95).attr('fill', 'none').attr('stroke', '#F2B33D').attr('stroke-width', 2.5);
      el.dataset.vx = cx; el.dataset.vy = cy;
    }
  }
  const lab = el.parentElement.querySelector('[data-volterra-label]');
  if (lab) { lab.style.left = (+el.dataset.vx + el.offsetLeft + gap * 1.3) + 'px'; lab.style.top = (+el.dataset.vy + el.offsetTop - 18) + 'px'; }
};

CHARTS.gause = (el) => {
  // схема опыта: два вида инфузорий с одинаковой пищей в одной пробирке
  const W = el.clientWidth, H = el.clientHeight, m = { l: 10, r: 10, t: 34, b: 40 };
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const x = d3.scaleLinear([0, 24], [m.l, W - m.r]), y = d3.scaleLinear([0, 1], [H - m.b, m.t]);
  const A = [], B = [];
  let a = .02, b = .06;
  for (let t = 0; t <= 24; t += .05) { A.push([t, a]); B.push([t, b]); const da = .75 * a * (1 - a - .6 * b), db = .8 * b * (1 - b - 1.9 * a); a += da * .05; b += db * .05; }
  const line = d3.line().x(p => x(p[0])).y(p => y(p[1])).curve(d3.curveBasis);
  s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'rgba(232,238,246,.3)');
  s.append('path').attr('d', line(A)).attr('fill', 'none').attr('stroke', '#4FD1E8').attr('stroke-width', 5);
  s.append('path').attr('d', line(B)).attr('fill', 'none').attr('stroke', '#F2B33D').attr('stroke-width', 5).attr('stroke-dasharray', '1 0');
  s.append('text').attr('x', W - m.r).attr('y', y(A[A.length - 1][1]) - 14).attr('text-anchor', 'end').attr('fill', '#4FD1E8').attr('font-family', 'Onest').attr('font-size', 22).attr('font-weight', 600).text('вид 1 вытесняет');
  s.append('text').attr('x', W - m.r).attr('y', y(B[B.length - 1][1]) - 12).attr('text-anchor', 'end').attr('fill', '#F2B33D').attr('font-family', 'Onest').attr('font-size', 22).attr('font-weight', 600).text('вид 2 исчезает');
  s.append('text').attr('x', m.l).attr('y', H - 8).attr('fill', 'rgba(232,238,246,.55)').attr('font-family', 'JetBrains Mono').attr('font-size', 15).text('ДНИ ОПЫТА →');
};

CHARTS.limits = (el) => {
  // качественная схема «стандартного» сценария: рост, затем спад (не данные!)
  const W = el.clientWidth, H = el.clientHeight, m = { l: 20, r: 20, t: 40, b: 50 };
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const x = d3.scaleLinear([1900, 2100], [m.l, W - m.r]), y = d3.scaleLinear([0, 1], [H - m.b, m.t]);
  const bump = (mu, sl, sr, h) => t => h * Math.exp(-((t - mu) ** 2) / (2 * (t < mu ? sl : sr) ** 2));
  const curves = [
    ['ресурсы', '#E9D7A8', t => 0.9 / (1 + Math.exp((t - 2015) / 20)) + .04],
    ['промышленность', '#F2B33D', bump(2012, 30, 22, .8)],
    ['продовольствие', '#8FD17E', bump(2018, 38, 24, .55)],
    ['население', '#F3ECE3', bump(2040, 45, 30, .62)],
    ['загрязнение', '#FF4B26', bump(2058, 22, 20, .42)],
  ];
  const ts = d3.range(1900, 2100.1, 1);
  s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'rgba(243,236,227,.3)');
  for (const yr of [1900, 1972, 2000, 2100]) {
    s.append('text').attr('x', x(yr)).attr('y', H - 14).attr('text-anchor', yr === 1900 ? 'start' : yr === 2100 ? 'end' : 'middle').attr('fill', yr === 1972 ? '#FF4B26' : 'rgba(243,236,227,.55)')
      .attr('font-family', 'JetBrains Mono').attr('font-size', 16).text(yr);
  }
  s.append('line').attr('x1', x(1972)).attr('x2', x(1972)).attr('y1', y(0)).attr('y2', m.t - 20).attr('stroke', '#FF4B26').attr('stroke-dasharray', '4 6').attr('stroke-width', 1.5);
  s.append('text').attr('x', x(1972) + 10).attr('y', m.t - 8).attr('fill', '#FF4B26').attr('font-family', 'JetBrains Mono').attr('font-size', 15).text('ДОКЛАД');
  for (const [name, c, f] of curves) {
    const pts = ts.map(t => [t, f(t)]);
    const past = pts.filter(p => p[0] <= 1972), fut = pts.filter(p => p[0] >= 1972);
    s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(past)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 4);
    s.append('path').attr('d', d3.line().x(p => x(p[0])).y(p => y(p[1]))(fut)).attr('fill', 'none').attr('stroke', c).attr('stroke-width', 4).attr('stroke-dasharray', '10 8');
  }
};

CHARTS.gaia = (el) => {
  // кольцо обратных связей вокруг Земли
  const W = el.clientWidth, H = el.clientHeight, cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 70;
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).style('overflow', 'visible');
  s.append('defs').append('marker').attr('id', 'arG').attr('viewBox', '0 0 10 10').attr('refX', 8).attr('refY', 5).attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
    .append('path').attr('d', 'M0,0 L10,5 L0,10 z').attr('fill', '#6FE3BF');
  s.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r).attr('fill', 'none').attr('stroke', 'rgba(111,227,191,.2)');
  const P = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const arcs = [[-145, -35, 'ТЕМПЕРАТУРА', -90], [-5, 85, 'СОСТАВ ВОЗДУХА', 25], [115, 205, 'СОЛЕНОСТЬ ОКЕАНА', 112]];
  for (const [a0, a1, lab, am] of arcs) {
    const [x0, y0] = P(a0), [x1, y1] = P(a1);
    s.append('path').attr('d', `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`).attr('fill', 'none').attr('stroke', '#6FE3BF').attr('stroke-width', 3).attr('marker-end', 'url(#arG)');
    const rr = r + 30, ax = cx + rr * Math.cos(am * Math.PI / 180), ay = cy + rr * Math.sin(am * Math.PI / 180);
    s.append('text').attr('x', ax).attr('y', ay + 6).attr('text-anchor', Math.cos(am * Math.PI / 180) > .3 ? 'start' : Math.cos(am * Math.PI / 180) < -.3 ? 'end' : 'middle')
      .attr('fill', '#6FE3BF').attr('font-family', 'JetBrains Mono').attr('font-size', 19).attr('letter-spacing', 2).text(lab);
  }
};

CHARTS.lifespans = (el) => {
  const people = DATA.lifespans.people.slice();
  const W = el.clientWidth, H = el.clientHeight, m = { l: 230, r: 120, t: 24, b: 44 };
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const x = d3.scaleLinear([1760, 2030], [m.l, W - m.r]);
  const y = d3.scaleBand(people.map(p => p[0]), [m.t, H - m.b]).padding(.32);
  const colors = { 1: '#B8461F', 2: '#2FB8D0', 3: '#FF4B26', 4: '#49C9A4' };
  // полоса 1925-1980
  s.append('rect').attr('x', x(1925)).attr('width', x(1980) - x(1925)).attr('y', m.t - 10).attr('height', H - m.b - m.t + 10).attr('fill', 'rgba(233,215,168,.08)');
  s.append('line').attr('x1', x(1925)).attr('x2', x(1925)).attr('y1', m.t - 10).attr('y2', H - m.b).attr('stroke', 'rgba(233,215,168,.5)').attr('stroke-dasharray', '3 5');
  s.append('line').attr('x1', x(1980)).attr('x2', x(1980)).attr('y1', m.t - 10).attr('y2', H - m.b).attr('stroke', 'rgba(233,215,168,.5)').attr('stroke-dasharray', '3 5');
  for (const yr of [1800, 1850, 1900, 1950, 2000]) {
    s.append('text').attr('x', x(yr)).attr('y', H - 12).attr('text-anchor', 'middle').attr('fill', 'rgba(239,233,221,.5)').attr('font-family', 'JetBrains Mono').attr('font-size', 15).text(yr);
  }
  const long = Object.fromEntries(DATA.longevity);
  for (const [name, b, d, w, g] of people) {
    const yy = y(name), h = y.bandwidth();
    const short = name.split(' ').length > 1 ? name.split(' ')[0][0] + '. ' + name.split(' ').slice(1).join(' ') : name;
    s.append('text').attr('x', m.l - 16).attr('y', yy + h / 2 + 6).attr('text-anchor', 'end').attr('fill', '#EFE9DD').attr('font-family', 'Onest').attr('font-size', 18).attr('font-weight', 500)
      .text(name.replace(/^(\S+) /, (mm, f) => f[0] + '. '));
    s.append('rect').attr('x', x(b)).attr('width', x(d) - x(b)).attr('y', yy).attr('height', h).attr('rx', h / 2).attr('fill', colors[g]).attr('opacity', long[name] ? 1 : .55);
    s.append('path').attr('d', `M${x(w)},${yy - 3} l${h / 2 + 3},${h / 2 + 3} l${-h / 2 - 3},${h / 2 + 3} l${-h / 2 - 3},${-h / 2 - 3} z`).attr('fill', '#E9D7A8').attr('stroke', '#12110E').attr('stroke-width', 2);
    const age = d - b - 1 + 1;
    if (long[name]) {
      s.append('text').attr('x', x(d) + 12).attr('y', yy + h / 2 + 7).attr('fill', '#E9D7A8').attr('font-family', 'Unbounded').attr('font-weight', 600).attr('font-size', 20).text(long[name]);
    }
  }
};

CHARTS.lanes = (el) => {
  const W = el.clientWidth, H = el.clientHeight;
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const x = d3.scaleLinear([1830, 1980], [40, W - 40]);
  const yA = H * .3, yB = H * .7;
  const ink = '#1A1813', muted = '#6E6656', acc = '#B8461F', green = '#4F6B3A';
  for (const yr of [1850, 1875, 1900, 1925, 1950, 1975]) {
    s.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', 0).attr('y2', H - 34).attr('stroke', 'rgba(26,24,19,.1)');
    s.append('text').attr('x', x(yr)).attr('y', H - 6).attr('text-anchor', 'middle').attr('fill', muted).attr('font-family', 'JetBrains Mono').attr('font-size', 16).text(yr);
  }
  for (const [yy, c] of [[yA, ink], [yB, acc]]) s.append('line').attr('x1', x(1832)).attr('x2', x(1978)).attr('y1', yy).attr('y2', yy).attr('stroke', c).attr('stroke-width', 2.5);
  const A = [
    [1840, 'закон минимума', 'Либих', 1], [1866, 'экология', 'Геккель', -1], [1875, 'биосфера', 'Зюсс', 1], [1877, 'биоценоз', 'Мебиус', -2.2],
    [1913, 'толерантность', 'Шелфорд', 1], [1927, 'пищевая цепь', 'Элтон', -1], [1935, 'экосистема', 'Тенсли', 1], [1942, 'правило 10%', 'Линдеман', -2.2], [1972, 'Гея', 'Лавлок', 1],
  ];
  const B = [
    [1845, 'животное и среда', 'Рулье', 1, '1840-1850-е'], [1855, 'первая экологическая работа', 'Северцов', -1], [1908, 'идея заповедников', 'Кожевников', 1],
    [1917, 'Баргузинский заповедник', '', -2.2], [1926, 'учение о биосфере', 'Вернадский', 2.2], [1934, 'конкурентное исключение', 'Гаузе', -1], [1940, 'биогеоценоз', 'Сукачев', 1],
  ];
  const put = (arr, yy, col, dotFill) => {
    for (const [yr, t, who, side, yl] of arr) {
      const up = side < 0, k = Math.abs(side);
      const ly = yy + (up ? -1 : 1) * 30 * k;
      s.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', yy).attr('y2', ly + (up ? -2 : 2)).attr('stroke', col).attr('stroke-width', 1.2);
      s.append('circle').attr('cx', x(yr)).attr('cy', yy).attr('r', 8).attr('fill', dotFill).attr('stroke', '#ECE6D8').attr('stroke-width', 3);
      const g = s.append('text').attr('x', x(yr)).attr('y', up ? ly - 30 : ly + 22).attr('text-anchor', 'middle').attr('font-family', 'Onest');
      g.append('tspan').attr('x', x(yr)).attr('dy', 0).attr('font-size', 20).attr('font-weight', 600).attr('fill', ink).text(t);
      g.append('tspan').attr('x', x(yr)).attr('dy', 24).attr('font-size', 16).attr('fill', muted).attr('font-family', 'JetBrains Mono').text(`${who}${who ? ' · ' : ''}${yl || yr}`);
    }
  };
  put(A, yA, ink, ink);
  put(B, yB, acc, acc);
};

CHARTS.roadmap = (el) => {
  const W = el.clientWidth, H = el.clientHeight;
  const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const x = d3.scaleLinear([1760, 2030], [0, W]);
  const y0 = H - 60;
  s.append('line').attr('x1', 0).attr('x2', W).attr('y1', y0).attr('y2', y0).attr('stroke', 'rgba(239,233,221,.35)');
  for (let yr = 1770; yr <= 2020; yr += 10) {
    const big = yr % 50 === 0;
    s.append('line').attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', y0 - (big ? 12 : 6)).attr('y2', y0).attr('stroke', 'rgba(239,233,221,.5)');
    if (big) s.append('text').attr('x', x(yr)).attr('y', y0 + 34).attr('text-anchor', 'middle').attr('fill', 'rgba(239,233,221,.6)').attr('font-family', 'JetBrains Mono').attr('font-size', 18).text(yr);
  }
  const eras = [[1769, 1913, '#B8461F'], [1920, 1958, '#2FB8D0'], [1945, 1972, '#FF4B26'], [1957, 2025, '#49C9A4']];
  eras.forEach(([a, b, c], i) => {
    const yy = y0 - 40 - i * 26;
    s.append('rect').attr('x', x(a)).attr('width', x(b) - x(a)).attr('y', yy - 7).attr('height', 14).attr('rx', 7).attr('fill', c);
  });
};

async function main() {
  DATA = await (await fetch('/assets/data/charts.json')).json();
  await document.fonts.ready;
  const slides = [...document.querySelectorAll('.slide')];
  slides.forEach((s, i) => { s.id = s.id || 's' + (i + 1); footer(s, i, slides.length); });
  await Promise.all([...document.querySelectorAll('.anno[data-src]')].map(annotate));
  for (const el of document.querySelectorAll('[data-chart]')) CHARTS[el.dataset.chart](el);
  await Promise.all([...document.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  window.__deckReady = true;
}
main().catch(e => { window.__deckError = String(e.stack || e); console.error(e); });
