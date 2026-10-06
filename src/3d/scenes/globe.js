// Глобус из точек с маршрутом Гумбольдта по России (1829)
import { stage } from '../stage.js';

const { THREE, scene, camera, sun, hemi, finish } = stage({ w: 1500, h: 1500, fov: 24, env: 0.5 });

const world = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
const countries = topojson.feature(world, world.objects.countries);
const land = topojson.feature(world, world.objects.land);
const russia = countries.features.find(f => f.id === '643');

// растеризуем сушу в равнопромежуточной проекции, чтобы быстро проверять точки
const W = 4096, Hh = 2048;
const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
const ctx = cv.getContext('2d');
const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, Hh / 2]);
const path = d3.geoPath(proj, ctx);
ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Hh);
ctx.fillStyle = '#f00'; ctx.beginPath(); path(land); ctx.fill();
ctx.fillStyle = '#0f0'; ctx.beginPath(); path(russia); ctx.fill();
const px = ctx.getImageData(0, 0, W, Hh).data;
function sample(lon, lat) {
  const [x, y] = proj([lon, lat]);
  const i = (Math.min(Hh - 1, Math.max(0, Math.floor(y))) * W + Math.min(W - 1, Math.max(0, Math.floor(x)))) * 4;
  return px[i + 1] > 128 ? 2 : px[i] > 128 ? 1 : 0;
}

const D2R = Math.PI / 180;
const v3 = (lon, lat, r = 1) => new THREE.Vector3(
  r * Math.cos(lat * D2R) * Math.sin(lon * D2R), r * Math.sin(lat * D2R), r * Math.cos(lat * D2R) * Math.cos(lon * D2R));

// шар
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshStandardMaterial({ color: '#dcd2bd', roughness: 0.95 }));
scene.add(ball);

// точки суши
const N = 160000;
const pts = [[], []];
const ga = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
  const lat = Math.asin(y) / D2R, lon = Math.atan2(Math.sin(th) * r, Math.cos(th) * r) / D2R;
  const s = sample(lon, lat);
  if (s) pts[s - 1].push(v3(lon, lat));
}
const dot = new THREE.CylinderGeometry(0.0036, 0.0036, 0.004, 10); dot.rotateX(Math.PI / 2);
const up = new THREE.Vector3(0, 0, 1);
const q = new THREE.Quaternion(), m4 = new THREE.Matrix4();
function dots(list, color, lift = 1.002) {
  const im = new THREE.InstancedMesh(dot, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }), list.length);
  list.forEach((p, i) => {
    q.setFromUnitVectors(up, p.clone().normalize());
    m4.compose(p.clone().multiplyScalar(lift), q, new THREE.Vector3(1, 1, 1));
    im.setMatrixAt(i, m4);
  });
  scene.add(im);
}
dots(pts[0], '#9c917f');
dots(pts[1], '#2a2520', 1.0028);

// сетка параллелей и меридианов
const gmat = new THREE.LineBasicMaterial({ color: '#b9ad95', transparent: true, opacity: 0.55 });
for (let lat = -75; lat <= 75; lat += 15) {
  const g = []; for (let lon = -180; lon <= 180; lon += 2) g.push(v3(lon, lat, 1.0012));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(g), gmat));
}
for (let lon = -180; lon < 180; lon += 15) {
  const g = []; for (let lat = -90; lat <= 90; lat += 2) g.push(v3(lon, lat, 1.0012));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(g), gmat));
}

// маршрут
const CITIES = {
  spb: [30.32, 59.94], msk: [37.62, 55.75], kzn: [49.12, 55.79], ural: [60.6, 56.84], altai: [83.0, 51.6],
};
const order = ['spb', 'msk', 'kzn', 'ural', 'altai'];
const routePts = [];
for (let k = 0; k < order.length - 1; k++) {
  const a = v3(...CITIES[order[k]]), b = v3(...CITIES[order[k + 1]]);
  const ang = a.angleTo(b);
  for (let s = 0; s <= 40; s++) {
    const t = s / 40;
    const p = a.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(b.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang));
    p.normalize().multiplyScalar(1.006 + 0.05 * ang * Math.sin(Math.PI * t));
    if (!(k > 0 && s === 0)) routePts.push(p);
  }
}
const curve = new THREE.CatmullRomCurve3(routePts);
const rust = new THREE.MeshStandardMaterial({ color: '#c0461f', roughness: 0.55, emissive: '#5a1a08', emissiveIntensity: 0.25 });
scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 600, 0.0075, 12), rust));
// тень маршрута на поверхности
const shadowPts = routePts.map(p => p.clone().normalize().multiplyScalar(1.0032));
scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shadowPts), 600, 0.0028, 6),
  new THREE.MeshBasicMaterial({ color: '#2a2520', transparent: true, opacity: 0.25 })));

const anchors = {};
for (const [k, ll] of Object.entries(CITIES)) {
  const p = v3(...ll);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(k === 'spb' ? 0.016 : 0.012, 24, 16), rust);
  pin.position.copy(p.clone().multiplyScalar(1.008));
  scene.add(pin);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(k === 'spb' ? 0.028 : 0.022, 0.0025, 8, 48), new THREE.MeshBasicMaterial({ color: '#c0461f' }));
  ring.position.copy(p.clone().multiplyScalar(1.004));
  ring.lookAt(p.clone().multiplyScalar(2));
  scene.add(ring);
  anchors[k] = p.clone().multiplyScalar(1.01).toArray();
}

// свет и камера
sun({ pos: [-4, 6, 8], intensity: 2.2, size: 2 });
hemi(0xffffff, 0xcbbfa6, 1.2);
const look = v3(52, 38, 1);
camera.position.copy(look.clone().normalize().multiplyScalar(5.6));
camera.up.set(0, 1, 0);
camera.lookAt(0, 0, 0);
anchors.center = [0, 0, 0];
finish(anchors);
