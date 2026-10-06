// Чимборасо в разрезе: блок-диаграмма с поясами растительности (оммаж «Картине природы» Гумбольдта)
import { stage, fbm, rng, smooth } from '../stage.js';

const { THREE, scene, camera, sun, hemi, shadowCatcher, finish } = stage({ w: 1600, h: 1100, fov: 26, env: 0.45 });

const X0 = -6.5, X1 = 6.5, Z0 = -6, Z1 = 0, YB = -1.1, G = 0.35, H = 4.9;

function height(x, z) {
  const r = Math.hypot(x, z * 1.05);
  const a = Math.atan2(z, x);
  let h = H * Math.exp(-Math.pow(r / 3.0, 1.5));
  h *= 1 + 0.07 * fbm(a * 2.2 + 3, r * 0.6, 3) + 0.05 * Math.sin(a * 11 + r * 1.3) * smooth(0.6, 2.5, r);
  // вершина чуть приплюснута, как купол
  h = Math.min(h, H * 0.985 + 0.05 * fbm(x * 3, z * 3, 2));
  const foot = 0.22 * fbm(x * 0.45 + 10, z * 0.45 - 4, 4) + 0.1;
  return G + h + foot * (1 - smooth(0, H * 0.4, h));
}

// Пояса: t = доля высоты
const BELTS = [
  { k: 'tropic', t: 0.2, c: '#2f5a36' },
  { k: 'forest', t: 0.5, c: '#6f8f4e' },
  { k: 'meadow', t: 0.66, c: '#c2b46a' },
  { k: 'lichen', t: 0.77, c: '#978b7b' },
  { k: 'snow', t: 2.0, c: '#f6f4ee' },
];
const col = c => new THREE.Color(c);
function beltColor(t, x, z) {
  const jitter = 0.025 * fbm(x * 2.5, z * 2.5, 3);
  const tt = t + jitter;
  for (let i = 0; i < BELTS.length; i++) {
    if (tt < BELTS[i].t) {
      const c = col(BELTS[i].c);
      // мягкий переход к следующему поясу
      if (i < BELTS.length - 1) {
        const d = BELTS[i].t - tt;
        if (d < 0.015) c.lerp(col(BELTS[i + 1].c), (0.015 - d) / 0.03);
      }
      // лёгкая вариативность тона
      c.offsetHSL(0, 0, 0.03 * fbm(x * 6, z * 6, 2));
      return c;
    }
  }
  return col('#fff');
}
const tOf = y => (y - G - 0.1) / H;

// --- поверхность
const NX = 300, NZ = 140;
const pos = [], colors = [], idx = [];
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
  const x = X0 + (X1 - X0) * i / NX, z = Z0 + (Z1 - Z0) * j / NZ;
  const y = height(x, z);
  pos.push(x, y, z);
  const c = beltColor(tOf(y), x, z);
  colors.push(c.r, c.g, c.b);
}
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
  const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
  idx.push(a, c, b, b, c, d);
}
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
g.setIndex(idx);
g.computeVertexNormals();
const surf = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
surf.castShadow = surf.receiveShadow = true;
scene.add(surf);

// --- стенки блока со слоями
const STRATA = ['#7d6a58', '#8f7a64', '#9a856d', '#857260', '#a18c74', '#7a685a', '#927d67', '#6f5f52'];
function wallColor(x, y, yTop, cut) {
  const d = yTop - y;
  if (cut && d < 0.07) return beltColor(tOf(yTop), x, 0).multiplyScalar(0.92);
  if (d < 0.16) return col('#3e3226');
  if (cut && yTop > G + 0.6 && y > G - 0.1) {
    // слои стратовулкана параллельны склону
    const k = Math.floor((d - 0.16) / 0.34 + 0.25 * Math.sin(x * 1.7));
    const c = col(STRATA[(k % 5 + 5) % 5 + 1]);
    return c.offsetHSL(0, 0, 0.02 * Math.sin(x * 9 + y * 4));
  }
  const k = Math.floor((y - YB) / 0.3 + 0.15 * Math.sin(x * 0.9));
  return col(STRATA[(k % STRATA.length + STRATA.length) % STRATA.length]).offsetHSL(0, 0, -0.03);
}
function wall(edge, cut = false, n = 900, ny = 320) {
  const p = [], c = [], ix = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const x = edge.x0 + (edge.x1 - edge.x0) * s, z = edge.z0 + (edge.z1 - edge.z0) * s;
    const yTop = height(x, z);
    for (let j = 0; j <= ny; j++) {
      const y = YB + (yTop - YB) * j / ny;
      p.push(x, y, z);
      const cc = wallColor(x + z, y, yTop, cut);
      c.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) {
    const a = i * (ny + 1) + j, b = a + 1, d = a + ny + 1, e = d + 1;
    if (edge.flip) ix.push(a, b, d, b, e, d); else ix.push(a, d, b, b, d, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  geo.setIndex(ix);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}
wall({ x0: X0, z0: Z1, x1: X1, z1: Z1 }, true);      // фронтальный разрез через вершину
wall({ x0: X1, z0: Z1, x1: X1, z1: Z0 });            // правый бок
wall({ x0: X1, z0: Z0, x1: X0, z1: Z0 });            // задний
wall({ x0: X0, z0: Z0, x1: X0, z1: Z1 });            // левый
// дно
const bottom = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ color: '#3a322b' }));
bottom.rotation.x = Math.PI / 2; bottom.position.set(0, YB, (Z0 + Z1) / 2); scene.add(bottom);

// --- деревья
const R = rng(7);
const trop = [], temp = [];
for (let k = 0; k < 26000; k++) {
  const x = X0 + 0.15 + R() * (X1 - X0 - 0.3), z = Z0 + 0.15 + R() * (Z1 - Z0 - 0.3);
  const y = height(x, z), t = tOf(y) + 0.02 * fbm(x * 2.5, z * 2.5, 3);
  if (t < 0.18 && R() < 0.5) trop.push([x, y, z]);
  else if (t > 0.215 && t < 0.49 && R() < 0.5 * (1 - smooth(0.36, 0.49, t))) temp.push([x, y, z]);
}
const dummy = new THREE.Object3D();
function forest(list, geo, mat, s0, s1, lift) {
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach(([x, y, z], i) => {
    const s = s0 + R() * (s1 - s0);
    dummy.position.set(x, y + lift * s, z);
    dummy.rotation.set(0, R() * 6.28, 0);
    dummy.scale.set(s, s * (0.9 + R() * 0.4), s);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    const c = new THREE.Color(mat.userData.base).offsetHSL((R() - 0.5) * 0.03, 0, (R() - 0.5) * 0.08);
    im.setColorAt(i, c);
  });
  im.castShadow = true; im.receiveShadow = true;
  scene.add(im);
}
const mTrop = new THREE.MeshStandardMaterial({ roughness: 0.85 }); mTrop.userData.base = '#2c5a33';
const mTemp = new THREE.MeshStandardMaterial({ roughness: 0.85 }); mTemp.userData.base = '#3f6a3c';
forest(trop, new THREE.IcosahedronGeometry(0.5, 1), mTrop, 0.07, 0.12, 0.35);
const cone = new THREE.ConeGeometry(0.32, 1, 7); cone.translate(0, 0.5, 0);
forest(temp, cone, mTemp, 0.09, 0.15, -0.05);

// --- флажок «почти 5900 м»: чуть ниже вершины на правом склоне у разреза
let fx = 0; const fz = -0.25;
for (let x = 0; x < 6; x += 0.005) { if (tOf(height(x, fz)) < 0.925) { fx = x; break; } }
const fy = height(fx, fz);
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.75, 8), new THREE.MeshStandardMaterial({ color: '#2a2622' }));
pole.position.set(fx, fy + 0.37, fz); pole.castShadow = true; scene.add(pole);
const flagShape = new THREE.Shape(); flagShape.moveTo(0, 0); flagShape.lineTo(0.42, -0.11); flagShape.lineTo(0, -0.24);
const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), new THREE.MeshStandardMaterial({ color: '#c0461f', side: THREE.DoubleSide, roughness: 0.7 }));
flag.position.set(fx + 0.01, fy + 0.74, fz); flag.rotation.y = -0.5; flag.castShadow = true; scene.add(flag);

// --- свет и камера
sun({ pos: [9, 13, 10], intensity: 2.6, size: 11, radius: 10, blur: 20 });
hemi(0xeef2fb, 0xb3a184, 1.05);
shadowCatcher(YB - 0.001, 80, 0.2);

camera.position.set(15.5, 11.0, 15.0);
camera.lookAt(0.0, 1.25, -2.8);

// якоря для подписей: середины поясов на правом склоне, у самого разреза
const anchors = {};
const mids = { tropic: 0.1, forest: 0.35, meadow: 0.58, lichen: 0.715, snow: 0.86 };
for (const [k, tm] of Object.entries(mids)) {
  const z = -0.35;
  for (let x = 0; x < 7; x += 0.005) { const y = height(x, z); if (tOf(y) < tm) { anchors[k] = [x, y + 0.03, z]; break; } }
}
anchors.flag = [fx + 0.2, fy + 0.68, fz];
anchors.summit = [0, height(0, 0), 0];
anchors.cut = [-3.5, 0.0, 0];
finish(anchors);
