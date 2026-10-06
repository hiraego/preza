// Островная биогеография Уилсона и Макартура: материк, большой близкий остров, маленький далекий
import { stage, rng, fbm } from '../stage.js';

const { THREE, scene, camera, sun, hemi, shadowCatcher, finish } = stage({ w: 1800, h: 1000, fov: 24, env: 0.6 });
const R = rng(77);
const X0 = -6.4, X1 = 6.4, Z0 = -3.4, Z1 = 3.4, D = 0.7;

// море: блок воды с разрезом по краям
const sea = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, D, Z1 - Z0), [
  new THREE.MeshStandardMaterial({ color: '#2f7fb0', roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: '#2f7fb0', roughness: 0.3 }),
  new THREE.MeshPhysicalMaterial({ color: '#3f8cc2', roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#1f5a82' }),
  new THREE.MeshStandardMaterial({ color: '#3a8cc0', roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: '#3a8cc0', roughness: 0.3 }),
]);
sea.position.y = -D / 2; sea.receiveShadow = true; scene.add(sea);
// дно и его разрез
const floor = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.35, Z1 - Z0), new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 1 }));
floor.position.y = -D - 0.175; scene.add(floor);

function blob(cx, cz, r, seed, rough = 0.18) {
  const s = new THREE.Shape(), n = 120;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2;
    const rr = r * (1 + rough * fbm(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 - seed, 4));
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, z); else s.lineTo(x, z);
  }
  return s;
}
function land(shape, h, color, y0, bevel = 0.12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 1 });
  g.rotateX(Math.PI / 2); g.translate(0, y0 + h, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  m.castShadow = m.receiveShadow = true; scene.add(m); return m;
}
// материк: полоса слева с изрезанным берегом
const main = new THREE.Shape();
main.moveTo(X0, Z0);
for (let i = 0; i <= 80; i++) { const z = Z0 + (Z1 - Z0) * i / 80; main.lineTo(-3.9 + 0.45 * fbm(z * 0.8, 3, 4) + 0.15 * Math.sin(z * 2.3), z); }
main.lineTo(X0, Z1); main.lineTo(X0, Z0);
land(main, 0.25, '#d8c89a', -0.12, 0.1);
const mainTop = new THREE.Shape();
mainTop.moveTo(X0, Z0 + 0.02);
for (let i = 0; i <= 80; i++) { const z = Z0 + 0.02 + (Z1 - Z0 - 0.04) * i / 80; mainTop.lineTo(-4.2 + 0.45 * fbm(z * 0.8, 3, 4) + 0.15 * Math.sin(z * 2.3), z); }
mainTop.lineTo(X0, Z1 - 0.02); mainTop.lineTo(X0, Z0 + 0.02);
land(mainTop, 0.12, '#86ad5a', 0.12, 0.06);

const A = { x: -1.3, z: 0.35, r: 1.5 }, B = { x: 4.2, z: -0.9, r: 0.6 };
for (const [I, seed] of [[A, 1.3], [B, 7.1]]) {
  land(blob(I.x, I.z, I.r, seed), 0.25, '#d8c89a', -0.12, 0.1);
  land(blob(I.x, I.z, I.r * 0.8, seed), 0.12, '#86ad5a', 0.12, 0.06);
}

// деревья: цвет и форма = вид. На материке все 8 видов, на большом острове 6, на маленьком 2
const SPECIES = [
  ['cone', '#2f6a43'], ['ball', '#4f9a45'], ['tall', '#8bb54a'], ['ball', '#d9a63a'],
  ['cone', '#5d8f6a'], ['ball', '#d0663a'], ['tall', '#a34a6a'], ['ball', '#e3d36a'],
];
const geos = {
  cone: (() => { const g = new THREE.ConeGeometry(0.16, 0.5, 8); g.translate(0, 0.33, 0); return g; })(),
  ball: (() => { const g = new THREE.IcosahedronGeometry(0.17, 1); g.translate(0, 0.3, 0); return g; })(),
  tall: (() => { const g = new THREE.SphereGeometry(0.11, 14, 10); g.scale(1, 2.2, 1); g.translate(0, 0.32, 0); return g; })(),
};
const trunkGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6); trunkGeo.translate(0, 0.09, 0);
const trunkM = new THREE.MeshStandardMaterial({ color: '#6b4a33' });
function plant(x, z, sp, s = 1) {
  const [kind, color] = SPECIES[sp];
  const t = new THREE.Mesh(trunkGeo, trunkM); t.position.set(x, 0.24, z); t.scale.setScalar(s); t.castShadow = true; scene.add(t);
  const c = new THREE.Mesh(geos[kind], new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: kind === 'ball' }));
  c.position.set(x, 0.24, z); c.scale.setScalar(s); c.castShadow = c.receiveShadow = true; scene.add(c);
}
function populate(test, n, species, minD = 0.36) {
  const placed = [];
  for (let k = 0; k < 5000 && placed.length < n; k++) {
    const p = test();
    if (!p || placed.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < minD)) continue;
    placed.push(p);
    plant(p[0], p[1], species[placed.length % species.length], 0.85 + R() * 0.35);
  }
}
populate(() => { const x = X0 + 0.3 + R() * 2.0, z = Z0 + 0.35 + R() * (Z1 - Z0 - 0.7); return [x, z]; }, 46, [0, 1, 2, 3, 4, 5, 6, 7]);
populate(() => { const a = R() * 6.28, r = Math.sqrt(R()) * A.r * 0.66; return [A.x + Math.cos(a) * r, A.z + Math.sin(a) * r]; }, 22, [0, 1, 2, 3, 5, 7]);
populate(() => { const a = R() * 6.28, r = Math.sqrt(R()) * B.r * 0.45; return [B.x + Math.cos(a) * r, B.z + Math.sin(a) * r]; }, 3, [1, 2], 0.3);

sun({ pos: [-6, 11, 7], intensity: 2.6, size: 9, radius: 6, blur: 16 });
hemi(0xf1f4fa, 0x6f8fa8, 1.15);
shadowCatcher(-D - 0.35, 50, 0.18);
camera.position.set(0.3, 13.6, 18.2);
camera.lookAt(0.0, -0.55, 0.15);
finish({ main: [-5.6, 0.9, -2.2], A: [A.x + 0.2, 0.95, A.z - 0.6], B: [B.x, 0.85, B.z - 0.1], Afoot: [A.x, 0, A.z + A.r], Bfoot: [B.x, 0, B.z + B.r] });
