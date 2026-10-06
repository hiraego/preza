// Пирамида чисел Элтона: «взорванный» вид, на каждом ярусе видно, сколько там особей
import { stage, rng } from '../stage.js';

const { THREE, scene, camera, sun, hemi, finish } = stage({ w: 1500, h: 1300, fov: 26, env: 0.55 });
const R = rng(5);

const TIERS = [
  { w: 5.6, n: 15, kind: 'plant', color: '#3f8a52', s: 0.115 },
  { w: 4.0, n: 6, kind: 'herb', color: '#d9a43a', s: 0.14 },
  { w: 2.5, n: 3, kind: 'pred', color: '#d9662e', s: 0.2 },
  { w: 1.2, n: 1, kind: 'top', color: '#e5321d', s: 0.3 },
];
const TH = 0.2, GAPY = 1.55;
const slabMat = new THREE.MeshStandardMaterial({ color: '#ebe8e1', roughness: 0.9, metalness: 0 });
const edgeMat = new THREE.LineBasicMaterial({ color: '#0f0f0e' });
const anchors = {};
const dummy = new THREE.Object3D();

TIERS.forEach((t, k) => {
  const y = k * (TH + GAPY);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(t.w, TH, t.w), slabMat);
  slab.position.y = y + TH / 2; slab.castShadow = slab.receiveShadow = true; scene.add(slab);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(t.w, TH, t.w)), edgeMat);
  edges.position.copy(slab.position); scene.add(edges);

  const mat = new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.6 });
  let geo;
  if (t.kind === 'plant') { geo = new THREE.ConeGeometry(0.5, 1.6, 7); geo.translate(0, 0.8, 0); }
  else { geo = new THREE.SphereGeometry(0.5, 32, 20); geo.translate(0, 0.5, 0); }
  const im = new THREE.InstancedMesh(geo, mat, t.n * t.n);
  const pad = t.w * 0.12, step = (t.w - 2 * pad) / Math.max(1, t.n - 1);
  let i = 0;
  for (let a = 0; a < t.n; a++) for (let b = 0; b < t.n; b++) {
    const jx = t.n > 1 ? (R() - 0.5) * step * 0.35 : 0, jz = t.n > 1 ? (R() - 0.5) * step * 0.35 : 0;
    dummy.position.set(t.n > 1 ? -t.w / 2 + pad + a * step + jx : 0, y + TH, t.n > 1 ? -t.w / 2 + pad + b * step + jz : 0);
    const s = t.s * (0.85 + R() * 0.3);
    dummy.scale.set(s * 2, s * 2, s * 2);
    dummy.rotation.y = R() * 6.28;
    dummy.updateMatrix(); im.setMatrixAt(i++, dummy.matrix);
  }
  im.castShadow = true; im.receiveShadow = true;
  scene.add(im);
  anchors['t' + k] = [t.w / 2, y + TH / 2, t.w / 2];
  anchors['l' + k] = [-t.w / 2, y + TH / 2, t.w / 2];
  anchors['r' + k] = [t.w / 2, y + TH / 2, -t.w / 2];
});

// вертикальные направляющие между ярусами
const guide = new THREE.LineDashedMaterial({ color: '#1f3fd6', dashSize: 0.08, gapSize: 0.08, transparent: true, opacity: 0.7 });
for (let k = 0; k < TIERS.length - 1; k++) {
  const a = TIERS[k], b = TIERS[k + 1];
  const y0 = k * (TH + GAPY) + TH, y1 = (k + 1) * (TH + GAPY);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx * a.w / 2, y0, sz * a.w / 2), new THREE.Vector3(sx * b.w / 2, y1, sz * b.w / 2)]);
    const l = new THREE.Line(g, guide); l.computeLineDistances(); scene.add(l);
  }
}

sun({ pos: [-5, 12, 7], intensity: 2.6, size: 6, radius: 6, blur: 16 });
hemi(0xf4f4f2, 0xb8b3a8, 1.2);
camera.position.set(11.8, 10.4, 14.8);
camera.lookAt(0, 2.15, 0);
finish(anchors);
