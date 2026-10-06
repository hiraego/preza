// Экосистема Тенсли: диорама «растения + животные + почва + вода + климат = одна система»
import { stage, fbm, rng, smooth } from '../stage.js';

const { THREE, renderer, scene, camera, sun, hemi, finish } = stage({ w: 1600, h: 1250, fov: 26, env: 0.6 });
renderer.localClippingEnabled = true;
const R = rng(21);
const X0 = -4.2, X1 = 4.2, Z0 = -3, Z1 = 3, YB = -1.7, WL = -0.14;
const PC = [-1.3, 2.75], PR = [1.55, 1.15];
const pondD = (x, z) => Math.hypot((x - PC[0]) / PR[0], (z - PC[1]) / PR[1]);

function height(x, z) {
  let h = 0.12 + 0.28 * fbm(x * 0.35 + 3, z * 0.35, 4) + 0.35 * smooth(-1, 3, -z) * smooth(-2, 4, x);
  const d = pondD(x, z);
  const dip = 1 - smooth(0.6, 1.15, d);
  h = h * (1 - dip) + (-0.62) * dip;
  return h;
}
const col = c => new THREE.Color(c);
function groundColor(x, z, y) {
  const d = pondD(x, z);
  if (d < 1.12 && y < WL + 0.08) return col('#9b8a6a'); // песчаный берег
  const c = col('#7aa257').lerp(col('#a3b65f'), 0.5 + 0.5 * fbm(x * 1.4, z * 1.4, 3));
  return c.offsetHSL(0, 0, 0.03 * fbm(x * 5, z * 5, 2));
}

// поверхность
const NX = 220, NZ = 160, pos = [], cols = [], idx = [];
for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
  const x = X0 + (X1 - X0) * i / NX, z = Z0 + (Z1 - Z0) * j / NZ, y = height(x, z);
  pos.push(x, y, z); const c = groundColor(x, z, y); cols.push(c.r, c.g, c.b);
}
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i; idx.push(a, a + NX + 1, a + 1, a + 1, a + NX + 1, a + NX + 2); }
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
g.setIndex(idx); g.computeVertexNormals();
const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
ground.receiveShadow = ground.castShadow = true; scene.add(ground);

// стенки: почвенные горизонты + вода в разрезе пруда
const HOR = [[0.12, '#3b2b1f'], [0.45, '#5e4430'], [0.9, '#8a6440'], [1.25, '#a98a62'], [9, '#7d7770']];
function wallColor(x, y, h) {
  if (y > h) { const t = (WL - y) / (WL - h + 1e-6); return col('#5fb1d6').lerp(col('#1f6f9e'), Math.min(1, t * 0.9 + 0.1)); }
  const d = h - y + 0.04 * Math.sin(x * 3.1) + 0.03 * fbm(x * 4, y * 4, 2);
  for (const [t, c] of HOR) if (d < t) return col(c).offsetHSL(0, 0, 0.025 * fbm(x * 9, y * 9, 2));
}
function wall(x0, z0, x1, z1, flip) {
  const n = 500, ny = 260, p = [], c = [], ix = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, x = x0 + (x1 - x0) * s, z = z0 + (z1 - z0) * s, h = height(x, z);
    const top = pondD(x, z) < 1.0 ? Math.max(h, WL) : h;
    for (let j = 0; j <= ny; j++) { const y = YB + (top - YB) * j / ny; p.push(x, y, z); const cc = wallColor(x + z, y, h); c.push(cc.r, cc.g, cc.b); }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < ny; j++) { const a = i * (ny + 1) + j, b = a + 1, d = a + ny + 1, e = d + 1; if (flip) ix.push(a, b, d, b, e, d); else ix.push(a, d, b, b, d, e); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  geo.setIndex(ix); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true; scene.add(m);
}
wall(X0, Z1, X1, Z1); wall(X1, Z1, X1, Z0); wall(X1, Z0, X0, Z0); wall(X0, Z0, X0, Z1);

// вода
const wshape = new THREE.Shape();
wshape.absellipse(0, 0, PR[0] * 1.06, PR[1] * 1.06, 0, Math.PI * 2);
const water = new THREE.Mesh(new THREE.ShapeGeometry(wshape, 96), new THREE.MeshPhysicalMaterial({ color: '#4d9fcb', roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.92 }));
water.rotation.x = -Math.PI / 2; water.position.set(PC[0], WL, PC[1]);
// обрезаем то, что вылезает за передний край
water.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), Z1 - 0.002)];
scene.add(water);

// деревья
const dummy = new THREE.Object3D();
const trunks = [], crowns = [], firs = [];
for (let k = 0; k < 400 && trunks.length + firs.length < 30; k++) {
  const x = X0 + 0.4 + R() * (X1 - X0 - 0.8), z = Z0 + 0.4 + R() * (Z1 - Z0 - 0.8);
  if (pondD(x, z) < 1.45 || (x > -0.3 && x < 2.2 && z > 0.2)) continue;
  if ([...trunks, ...firs].some(t => Math.hypot(t[0] - x, t[2] - z) < 0.55)) continue;
  (R() < 0.45 ? firs : trunks).push([x, height(x, z), z, 0.8 + R() * 0.5]);
}
const barkM = new THREE.MeshStandardMaterial({ color: '#6b4a33', roughness: 0.9 });
const leafM = new THREE.MeshStandardMaterial({ color: '#4f8a45', roughness: 0.8, flatShading: true });
const firM = new THREE.MeshStandardMaterial({ color: '#2f6a43', roughness: 0.8, flatShading: true });
const anchors = {};
for (const [x, y, z, s] of trunks) {
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.7 * s, 8), barkM);
  tr.position.set(x, y + 0.35 * s, z); tr.castShadow = true; scene.add(tr);
  const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 1), leafM.clone());
  cr.material.color.offsetHSL((R() - 0.5) * 0.04, 0, (R() - 0.5) * 0.08);
  cr.position.set(x, y + 0.95 * s, z); cr.scale.y = 1.1; cr.castShadow = cr.receiveShadow = true; scene.add(cr);
  if (!anchors.plants || x > anchors.plants[0] + 0 && z > -1 && z < 1 && x < 3.5) anchors.plants = [x, y + 1.3 * s, z];
}
for (const [x, y, z, s] of firs) {
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.4 * s, 6), barkM);
  tr.position.set(x, y + 0.2 * s, z); tr.castShadow = true; scene.add(tr);
  for (let l = 0; l < 3; l++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((0.42 - l * 0.1) * s, 0.6 * s, 8), firM);
    c.position.set(x, y + (0.5 + l * 0.32) * s, z); c.castShadow = c.receiveShadow = true; scene.add(c);
  }
}
// трава
const tuft = new THREE.ConeGeometry(0.03, 0.16, 4); tuft.translate(0, 0.08, 0);
const grass = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: '#5f9446', roughness: 0.9 }), 1600);
for (let i = 0; i < 1600; i++) {
  let x, z; do { x = X0 + 0.1 + R() * (X1 - X0 - 0.2); z = Z0 + 0.1 + R() * (Z1 - Z0 - 0.2); } while (pondD(x, z) < 1.1);
  dummy.position.set(x, height(x, z), z); dummy.rotation.set((R() - 0.5) * 0.4, R() * 6, (R() - 0.5) * 0.4);
  const s = 0.7 + R() * 0.8; dummy.scale.set(s, s, s); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
}
grass.castShadow = true; scene.add(grass);
// камыш у пруда
const reedM = new THREE.MeshStandardMaterial({ color: '#7d8f3e' });
for (let i = 0; i < 26; i++) {
  const a = -0.4 + R() * 2.4, x = PC[0] + Math.cos(a + Math.PI) * PR[0] * 1.02, z = PC[1] - Math.sin(a) * PR[1] * 1.02;
  if (z > Z1 - 0.1) continue;
  const h = 0.35 + R() * 0.3;
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 5), reedM);
  r.position.set(x, WL + h / 2, z); r.rotation.z = (R() - 0.5) * 0.3; r.castShadow = true; scene.add(r);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.08, 4, 8), new THREE.MeshStandardMaterial({ color: '#5a3b24' }));
  head.position.set(x, WL + h, z); scene.add(head);
}
// камни
for (let i = 0; i < 9; i++) {
  const x = X0 + 0.5 + R() * 7.2, z = Z0 + 0.5 + R() * 5;
  if (pondD(x, z) < 1.2) continue;
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + R() * 0.12, 0), new THREE.MeshStandardMaterial({ color: '#9a958c', flatShading: true }));
  r.position.set(x, height(x, z) + 0.04, z); r.scale.y = 0.6; r.rotation.set(R(), R(), R()); r.castShadow = true; scene.add(r);
}
// зайцы
const fur = new THREE.MeshStandardMaterial({ color: '#a8875f', roughness: 0.9 });
function hare(x, z, rot) {
  const y = height(x, z), g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), fur); body.scale.set(1.25, 0.9, 0.85); body.position.y = 0.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12), fur); head.position.set(0.19, 0.27, 0); g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.14, 4, 8), fur); ear.position.set(0.17, 0.42, s * 0.03); ear.rotation.z = 0.25; ear.rotation.x = s * 0.15; g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: '#efe8dc' })); tail.position.set(-0.21, 0.17, 0); g.add(tail);
  g.traverse(o => { o.castShadow = true; });
  g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
  return [x, y + 0.5, z];
}
anchors.animals = hare(0.9, 1.3, 0.5); hare(1.6, 0.6, 2.4); hare(0.2, 0.5, -0.4);

// климат: солнце и облако над диорамой
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), new THREE.MeshBasicMaterial({ color: '#ffc94a' }));
sunBall.position.set(-2.9, 2.85, -1.6); scene.add(sunBall);
const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.6, 64), new THREE.MeshBasicMaterial({ color: '#ffc94a', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
halo.position.copy(sunBall.position); halo.lookAt(14, 11, 14); scene.add(halo);
const cloud = new THREE.Group();
const cm = new THREE.MeshStandardMaterial({ color: '#f4f7fb', roughness: 1 });
for (const [x, y, z, r] of [[0, 0, 0, 0.42], [0.45, 0.08, 0.05, 0.34], [-0.42, -0.02, 0, 0.3], [0.15, 0.28, -0.05, 0.3], [0.8, -0.05, 0, 0.22]]) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), cm); b.position.set(x, y, z); b.castShadow = true; cloud.add(b);
}
cloud.position.set(1.7, 2.75, -1.9); scene.add(cloud);
// капли дождя
const dropM = new THREE.MeshStandardMaterial({ color: '#7cc3e8' });
for (let i = 0; i < 12; i++) {
  const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.12, 4, 8), dropM);
  d.position.set(1.1 + R() * 1.4, 1.85 + R() * 0.5, -1.9 + (R() - 0.5) * 0.4); scene.add(d);
}

const L = sun({ pos: [-7, 12, 9], intensity: 2.7, size: 7, radius: 7, blur: 18 });
hemi(0xeaf2ff, 0x3a4a62, 1.1);
camera.position.set(10.6, 8.4, 13.6);
camera.lookAt(-0.1, 0.6, 0.2);

anchors.climate = [-2.9, 3.35, -1.6];
anchors.cloud = [1.7, 3.2, -1.9];
anchors.water = [PC[0] + 0.3, WL, PC[1] - 0.3];
anchors.soil = [2.4, -0.5, Z1];
anchors.soilSide = [X1, -0.6, 1.5];
finish(anchors);
