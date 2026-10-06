// Пруд с кувшинкой: день 28 (четверть), 29 (половина), 30 (весь пруд)
import { stage, rng, fbm, params } from '../stage.js';

const { THREE, scene, camera, sun, hemi, shadowCatcher, finish } = stage({ w: 1100, h: 1000, fov: 28, env: 0.6 });
const day = +(params.get('day') || 30);
const frac = { 28: 0.25, 29: 0.5, 30: 1 }[day] ?? 1;
const R = rng(31), RP = 2.0;

// вода и берег
const water = new THREE.Mesh(new THREE.CylinderGeometry(RP + 0.05, RP + 0.05, 0.3, 128), new THREE.MeshPhysicalMaterial({ color: '#2e6c72', roughness: 0.1, clearcoat: 1 }));
water.position.y = -0.15; water.receiveShadow = true; scene.add(water);
const bank = new THREE.Mesh(new THREE.CylinderGeometry(RP + 0.55, RP + 0.75, 0.34, 128, 1, true), new THREE.MeshStandardMaterial({ color: '#8c7a5c', roughness: 1, side: THREE.DoubleSide }));
bank.position.y = -0.14; scene.add(bank);
const ring = new THREE.Mesh(new THREE.RingGeometry(RP + 0.02, RP + 0.56, 128), new THREE.MeshStandardMaterial({ color: '#a6b07a', roughness: 1 }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; ring.receiveShadow = true; scene.add(ring);
// камни по кромке
const stoneM = new THREE.MeshStandardMaterial({ color: '#b5ab98', roughness: 0.9, flatShading: true });
for (let i = 0; i < 70; i++) {
  const a = i / 70 * Math.PI * 2 + R() * 0.05, r = RP + 0.1 + R() * 0.12;
  const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + R() * 0.07, 0), stoneM);
  s.position.set(Math.cos(a) * r, 0.04, Math.sin(a) * r); s.scale.y = 0.55; s.rotation.set(R(), R(), R());
  s.castShadow = s.receiveShadow = true; scene.add(s);
}

// листья кувшинки: кандидаты по сетке, порядок «роста» слева направо
const cands = [];
const sp = 0.25;
for (let gx = -RP; gx <= RP; gx += sp) for (let gz = -RP; gz <= RP; gz += sp * 0.87) {
  const x = gx + (Math.round(gz / (sp * 0.87)) % 2 ? sp / 2 : 0) + (R() - 0.5) * 0.08, z = gz + (R() - 0.5) * 0.08;
  if (Math.hypot(x, z) > RP - 0.13) continue;
  cands.push({ x, z, key: x + 0.35 * fbm(x * 1.2 + 5, z * 1.2, 3) + (R() - 0.5) * 0.1 });
}
cands.sort((a, b) => a.key - b.key);
const take = cands.slice(0, Math.round(cands.length * frac));

const padShape = new THREE.Shape();
padShape.moveTo(0, 0);
padShape.absarc(0, 0, 1, 0.22, Math.PI * 2 - 0.22, false);
padShape.lineTo(0, 0);
const padGeo = new THREE.ExtrudeGeometry(padShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 2, curveSegments: 40 });
padGeo.rotateX(-Math.PI / 2);
const pads = new THREE.InstancedMesh(padGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), take.length || 1);
const dummy = new THREE.Object3D();
take.forEach((p, i) => {
  const s = 0.15 + R() * 0.05;
  dummy.position.set(p.x, 0.005 + R() * 0.006, p.z); dummy.rotation.set(0, R() * 6.28, 0); dummy.scale.set(s, 0.35, s);
  dummy.updateMatrix(); pads.setMatrixAt(i, dummy.matrix);
  pads.setColorAt(i, new THREE.Color('#4f8f3a').lerp(new THREE.Color('#86b552'), R()));
});
if (!take.length) pads.count = 0;
pads.castShadow = pads.receiveShadow = true; scene.add(pads);

// цветы
const petalM = new THREE.MeshStandardMaterial({ color: '#f6eef2', roughness: 0.5 });
const coreM = new THREE.MeshStandardMaterial({ color: '#f2c03a' });
take.filter((_, i) => i % 23 === 7).forEach(p => {
  const g = new THREE.Group();
  for (let k = 0; k < 8; k++) {
    const pt = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), petalM);
    pt.scale.set(0.45, 0.35, 1); const a = k / 8 * Math.PI * 2;
    pt.position.set(Math.cos(a) * 0.05, 0.05, Math.sin(a) * 0.05); pt.rotation.y = -a + Math.PI / 2; pt.rotation.x = -0.5; g.add(pt);
  }
  const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), coreM); c.position.y = 0.07; g.add(c);
  g.position.set(p.x, 0.02, p.z); g.traverse(o => o.castShadow = true); scene.add(g);
});

sun({ pos: [-4, 9, 5], intensity: 2.4, size: 4, radius: 5, blur: 14 });
hemi(0xf1f4fa, 0x9c8e74, 1.15);
shadowCatcher(-0.31, 30, 0.2);
camera.position.set(0, 8.3, 7.3);
camera.lookAt(0, -0.2, 0.1);
finish({ center: [0, 0, 0], left: [-RP, 0, 0], right: [RP, 0, 0], top: [0, 0, -RP - 0.6], bottom: [0, 0, RP + 0.6] });
