// Бочка Либиха: вода держится на уровне самой короткой доски (закон минимума)
import { stage, rng, fbm } from '../stage.js';

const { THREE, scene, camera, sun, hemi, shadowCatcher, finish } = stage({ w: 1300, h: 1400, fov: 27, env: 0.5 });

const N = 12, R0 = 1.1, T = 0.085, HB = 3.0, GAP = 0.0035;
const prof = y => R0 * (1 + 0.085 * Math.sin(Math.PI * Math.min(y, HB) / HB));
const HEIGHTS = [1.3, 2.5, 2.78, 2.36, 2.92, 2.6, 2.84, 2.46, 2.96, 2.55, 2.72, 2.3];
const LABELS = { 0: 'P', 1: 'N', 11: 'K', 2: 'water', 10: 'light', 3: 'heat' };

// текстура дерева
function woodTexture(seed, base) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 1024);
  const R = rng(seed);
  for (let i = 0; i < 70; i++) {
    const x0 = R() * 256, w = 0.6 + R() * 2.2, a = 0.05 + R() * 0.13;
    g.strokeStyle = R() < 0.5 ? `rgba(60,35,15,${a})` : `rgba(255,235,200,${a * 0.7})`;
    g.lineWidth = w; g.beginPath();
    for (let y = 0; y <= 1024; y += 16) g.lineTo(x0 + 6 * Math.sin(y / 90 + i) + 3 * fbm(i, y / 140, 2), y);
    g.stroke();
  }
  // пара сучков
  for (let k = 0; k < 2; k++) {
    const x = 40 + R() * 170, y = 100 + R() * 820;
    const grd = g.createRadialGradient(x, y, 1, x, y, 10);
    grd.addColorStop(0, 'rgba(50,28,10,.55)'); grd.addColorStop(1, 'rgba(50,28,10,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, 9, 16, 0, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function staveGeometry(a0, a1, h) {
  const nu = 10, nv = 60;
  const P = [], UV = [], I = [];
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
  const push = (x, y, z, u, v) => { P.push(x, y, z); UV.push(u, v); return P.length / 3 - 1; };
  const at = (ang, y, inner) => { const r = prof(y) - (inner ? T : 0); return [r * Math.sin(ang), y, r * Math.cos(ang)]; };
  // наружная и внутренняя поверхности
  for (const inner of [false, true]) {
    const base = P.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const ang = a0 + (a1 - a0) * i / nu, y = h * j / nv;
      push(...at(ang, y, inner), i / nu, y / HB);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
      if (inner) quad(a, d, c, b); else quad(a, b, c, d);
    }
  }
  // торец сверху и снизу
  for (const [y, flip] of [[h, false], [0, true]]) {
    const base = P.length / 3;
    for (let i = 0; i <= nu; i++) {
      const ang = a0 + (a1 - a0) * i / nu;
      push(...at(ang, y, false), i / nu, 0.98); push(...at(ang, y, true), i / nu, 1);
    }
    for (let i = 0; i < nu; i++) { const a = base + i * 2; if (flip) quad(a, a + 1, a + 3, a + 2); else quad(a, a + 2, a + 3, a + 1); }
  }
  // боковые грани
  for (const [ang, flip] of [[a0, true], [a1, false]]) {
    const base = P.length / 3;
    for (let j = 0; j <= nv; j++) { const y = h * j / nv; push(...at(ang, y, false), 0, y / HB); push(...at(ang, y, true), 0.05, y / HB); }
    for (let j = 0; j < nv; j++) { const a = base + j * 2; if (flip) quad(a, a + 1, a + 3, a + 2); else quad(a, a + 2, a + 3, a + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  return g;
}

const anchors = {};
const step = Math.PI * 2 / N;
HEIGHTS.forEach((h, i) => {
  const c = i * step, a0 = c - step / 2 + GAP, a1 = c + step / 2 - GAP;
  const base = i === 0 ? '#c25a2e' : ['#b88a55', '#a97c4a', '#bf9360', '#ae8150'][i % 4];
  const mat = new THREE.MeshStandardMaterial({ map: woodTexture(i + 3, base), roughness: 0.78, metalness: 0 });
  const m = new THREE.Mesh(staveGeometry(a0, a1, h), mat);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  if (LABELS[i]) { const r = prof(h) + 0.02; anchors[LABELS[i]] = [r * Math.sin(c), h + 0.02, r * Math.cos(c)]; }
});
// дно
const bottom = new THREE.Mesh(new THREE.CircleGeometry(R0 - T, 64), new THREE.MeshStandardMaterial({ color: '#7a5634' }));
bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.06; scene.add(bottom);

// обручи
const iron = new THREE.MeshStandardMaterial({ color: '#56504a', roughness: 0.5, metalness: 0.55 });
for (const y of [0.32, 1.02]) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(prof(y) + 0.008, 0.02, 12, 128), iron);
  t.rotation.x = Math.PI / 2; t.position.y = y; t.scale.z = 2.6; t.castShadow = true; scene.add(t);
}

// вода внутри: уровень = самая короткая доска
const LV = HEIGHTS[0] - 0.035;
const water = new THREE.MeshPhysicalMaterial({ color: '#3f86b3', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
const wcyl = new THREE.Mesh(new THREE.CylinderGeometry(prof(LV) - T - 0.005, R0 - T, LV - 0.06, 96), water);
wcyl.position.y = 0.06 + (LV - 0.06) / 2; scene.add(wcyl);

// струя через край короткой доски: тонкий изогнутый «лист» воды со струйками
function streakTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, 'rgba(120,185,220,0.95)'); grd.addColorStop(1, 'rgba(70,145,195,0.9)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 512);
  const R = rng(11);
  for (let i = 0; i < 46; i++) {
    const x = R() * 256, w = 1 + R() * 5;
    g.fillStyle = R() < 0.6 ? `rgba(235,248,255,${0.12 + R() * 0.3})` : `rgba(30,90,140,${0.1 + R() * 0.2})`;
    g.fillRect(x, 0, w, 512);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const flowN = 80, FP = [], FUV = [], FI = [];
for (let k = 0; k <= flowN; k++) {
  const t = k / flowN;
  const lip = Math.min(1, t / 0.12);
  const z = prof(LV) + 0.03 + 0.07 * Math.sin(lip * Math.PI / 2) + 0.5 * Math.pow(Math.max(0, t - 0.05), 1.1);
  const y = LV + 0.035 * Math.cos(lip * Math.PI / 2) - (LV + 0.02) * Math.pow(t, 1.7);
  const w = 0.42 * (1 - 0.3 * t);
  FP.push(-w / 2, Math.max(0.005, y), z, w / 2, Math.max(0.005, y), z);
  FUV.push(0, 1 - t, 1, 1 - t);
  if (k < flowN) { const a = k * 2; FI.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
}
const fg = new THREE.BufferGeometry();
fg.setAttribute('position', new THREE.Float32BufferAttribute(FP, 3));
fg.setAttribute('uv', new THREE.Float32BufferAttribute(FUV, 2));
fg.setIndex(FI); fg.computeVertexNormals();
const flow = new THREE.Mesh(fg, new THREE.MeshPhysicalMaterial({ map: streakTexture(), transparent: true, roughness: 0.1, clearcoat: 1, side: THREE.DoubleSide }));
flow.castShadow = true;
scene.add(flow);
// рябь на поверхности воды
for (const [r, o] of [[0.25, 0.5], [0.45, 0.35], [0.68, 0.22]]) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.012, 96), new THREE.MeshBasicMaterial({ color: '#bfe0f2', transparent: true, opacity: o }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0.05, LV + 0.002, 0.1); scene.add(ring);
}
// лужа
const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshPhysicalMaterial({ color: '#5a9cc4', roughness: 0.04, transparent: true, opacity: 0.85, clearcoat: 1 }));
puddle.rotation.x = -Math.PI / 2; puddle.scale.set(0.72, 0.36, 1); puddle.position.set(0.02, 0.004, prof(0) + 0.66); scene.add(puddle);

sun({ pos: [-5, 9, 6], intensity: 2.5, size: 5, radius: 8, blur: 18 });
hemi(0xf4f1ea, 0xb8a888, 1.1);
shadowCatcher(0, 40, 0.24);

camera.position.set(4.0, 5.0, 7.6);
camera.lookAt(0.1, 1.3, 0.35);
anchors.water = [0, LV, 0.5];
anchors.puddle = [0.6, 0, prof(0) + 0.8];
finish(anchors);
