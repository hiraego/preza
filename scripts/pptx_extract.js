/* Выполняется в браузере: разбирает слайд на слои для PPTX.
   Для каждого верхнего блока слайда: есть ли у него «графика» (фон, рамки, картинки, svg) и какой в нем текст.
   Текст режется на строки ровно так, как его сверстал браузер. */
(() => {
  const isVisualEl = (el, cs) => {
    if (el.tagName === 'IMG' || el.tagName === 'svg' || el.tagName === 'CANVAS') return true;
    const bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(\d+, \d+, \d+, 0\)/.test(bg)) return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && !/rgba\(\d+, \d+, \d+, 0\)/.test(cs['border' + s + 'Color'])) return true;
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') return true;
    return false;
  };
  const hasVisual = root => {
    const all = [root, ...root.querySelectorAll('*')];
    return all.some(el => !el.closest('aside') && isVisualEl(el, getComputedStyle(el)));
  };

  const cv = document.createElement('canvas').getContext('2d');
  const ascCache = {};
  const ascent = (st) => {
    const k = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    if (!(k in ascCache)) { cv.font = k; ascCache[k] = cv.measureText('Hgy').fontBoundingBoxAscent; }
    return ascCache[k];
  };
  const family = ff => ff.split(',')[0].replace(/["']/g, '').trim();

  function container(node) {
    let c = node.parentElement;
    while (c && getComputedStyle(c).display === 'inline') c = c.parentElement;
    return c;
  }

  function layout(c, nodes, origin) {
    const cs = getComputedStyle(c);
    const toks = [];
    let pend = false; // был ли пробел перед следующим словом (по тексту DOM)
    for (const node of nodes) {
      if (!node.nodeValue.trim()) { if (node.nodeValue.length) pend = true; continue; }
      const st = getComputedStyle(node.parentElement);
      const up = st.textTransform === 'uppercase';
      const size = parseFloat(st.fontSize);
      const asc = ascent(st);
      const style = {
        family: family(st.fontFamily), weight: +st.fontWeight, italic: st.fontStyle === 'italic', size,
        color: st.color, ls: st.letterSpacing === 'normal' ? 0 : parseFloat(st.letterSpacing),
      };
      const re = /\S+/g; let m, last = 0;
      while ((m = re.exec(node.nodeValue))) {
        if (m.index > last) pend = true;
        last = m.index + m[0].length;
        const sp = pend; pend = false;
        const r = document.createRange();
        r.setStart(node, m.index); r.setEnd(node, m.index + m[0].length);
        const rects = [...r.getClientRects()].filter(q => q.width > 0.1);
        if (!rects.length) continue;
        if (rects.length > 1 && Math.abs(rects[rects.length - 1].top - rects[0].top) > size * .5) {
          // слово разорвано переносом: режем по символам
          let cur = null;
          for (let i = 0; i < m[0].length; i++) {
            const rr = document.createRange(); rr.setStart(node, m.index + i); rr.setEnd(node, m.index + i + 1);
            const q = rr.getBoundingClientRect();
            if (!cur || Math.abs(q.top - cur.top) > size * .5) { if (cur) toks.push(cur); cur = { text: '', x0: q.left, x1: q.right, top: q.top, base: q.top + asc, style, sp: !cur && sp }; }
            cur.text += up ? m[0][i].toUpperCase() : m[0][i]; cur.x1 = q.right;
          }
          toks.push(cur);
          continue;
        }
        toks.push({ text: up ? m[0].toUpperCase() : m[0], x0: rects[0].left, x1: rects[rects.length - 1].right, top: rects[0].top, base: rects[0].top + asc, style, sp });
      }
      if (last < node.nodeValue.length) pend = true;
    }
    if (!toks.length) return null;
    // строки
    const lines = [];
    for (const t of toks) {
      const L = lines[lines.length - 1];
      if (L && Math.abs(t.base - L.base) < t.style.size * .45) {
        const prev = L.toks[L.toks.length - 1];
        t.space = !!t.sp;
        L.toks.push(t); L.base = Math.max(L.base, t.base); L.x1 = Math.max(L.x1, t.x1); L.x0 = Math.min(L.x0, t.x0);
      } else lines.push({ toks: [t], base: t.base, x0: t.x0, x1: t.x1 });
    }
    // прогоны с одинаковым стилем
    const key = s => JSON.stringify(s);
    for (const L of lines) {
      L.runs = [];
      for (const t of L.toks) {
        const R = L.runs[L.runs.length - 1];
        const txt = (t.space && L.runs.length ? ' ' : '') + t.text;
        if (R && key(R.style) === key(t.style)) R.text += txt;
        else {
          if (R && t.space) { R.text += ' '; L.runs.push({ text: t.text, style: t.style }); }
          else L.runs.push({ text: txt, style: t.style });
        }
      }
      delete L.toks;
    }
    const r = c.getBoundingClientRect();
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    let align = cs.textAlign;
    if (align === 'start' || align === 'justify' || align === '-webkit-auto') align = 'left';
    if (align === 'end') align = 'right';
    const rel = v => v;
    return {
      align,
      box: { x: r.left + pl - origin.x, y: r.top - origin.y, w: r.width - pl - pr, h: r.height },
      lines: lines.map(L => ({ runs: L.runs, base: L.base - origin.y, x0: L.x0 - origin.x, x1: L.x1 - origin.x })),
      lh: cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight),
    };
  }

  function texts(root, origin) {
    const groups = new Map();
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('svg, aside, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = w.nextNode())) {
      const c = container(n);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(n);
    }
    const out = [];
    for (const [c, nodes] of groups) { const t = layout(c, nodes, origin); if (t) out.push(t); }
    return out;
  }

  window.__pptxPlan = (i) => {
    const slide = document.querySelectorAll('section.slide')[i];
    const o = slide.getBoundingClientRect();
    const origin = { x: o.left, y: o.top };
    const kids = [...slide.children].filter(k => k.tagName !== 'ASIDE');
    const before = getComputedStyle(slide, '::before');
    return {
      bg: getComputedStyle(slide).backgroundColor,
      hasBefore: before.content !== 'none' && before.backgroundImage !== 'none',
      notes: (slide.querySelector('aside.notes')?.textContent || '').trim().replace(/\s+/g, ' '),
      layers: kids.map((k, j) => ({ j, visual: hasVisual(k), texts: texts(k, origin) })),
    };
  };

  // режим съемки одного слоя: остальные блоки скрыты, фон слайда прозрачный, текст невидим
  const st = document.createElement('style');
  st.textContent = `
    html, body, .deck { background: transparent !important; }
    .x-cap { background: transparent !important; }
    .x-cap.x-nobefore::before { display: none !important; }
    .x-cap > .x-off { visibility: hidden !important; }
    .x-cap .x-notext, .x-cap .x-notext * { -webkit-text-fill-color: transparent !important; text-shadow: none !important; }`;
  document.head.appendChild(st);
  window.__pptxCapture = (i, j) => {
    const slide = document.querySelectorAll('section.slide')[i];
    const kids = [...slide.children].filter(k => k.tagName !== 'ASIDE');
    slide.classList.add('x-cap');
    slide.classList.toggle('x-nobefore', j !== -1);
    kids.forEach((k, idx) => { k.classList.toggle('x-off', idx !== j); k.classList.toggle('x-notext', idx === j); });
  };
  window.__pptxReset = (i) => {
    const slide = document.querySelectorAll('section.slide')[i];
    slide.classList.remove('x-cap', 'x-nobefore');
    [...slide.children].forEach(k => k.classList.remove('x-off', 'x-notext'));
  };
})();
