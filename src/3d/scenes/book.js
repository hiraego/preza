// Альбом Геккеля «Красота форм в природе», раскрытый на столе: таблицы показаны как страницы старой книги
import { stage, rng, fbm } from '../stage.js';

const { THREE, scene, camera, sun, hemi, shadowCatcher, finish } = stage({ w: 1700, h: 1300, fov: 24, env: 0.5 });
const R = rng(12);

const PW = 2.8, PH = 3.9;          // страница
const BLOCK = 0.16;                // толщина блока страниц с каждой стороны
const COVER = 0.035, OVER = 0.07;  // переплет и его выступ
const OPEN = 0.07;                 // половинки чуть приподняты к корешку

async function img(src) {
  const im = new Image();
  im.src = src;
  await im.decode();
  return im;
}

// страница: бумага, поле, таблица, тень у корешка
async function pageTexture(src, side) {
  const W = 1400, H = Math.round(W * PH / PW);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ECE4D0'; g.fillRect(0, 0, W, H);
  // зерно бумаги
  const d = g.getImageData(0, 0, W, H), r = rng(side === 'L' ? 3 : 4);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (r() - 0.5) * 10 + 6 * fbm((i / 4 % W) / 90, Math.floor(i / 4 / W) / 90, 3);
    d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n * 0.8;
  }
  g.putImageData(d, 0, 0);
  // таблица с полями, печать «впитана» в бумагу
  const im = await img(src);
  const mx = W * 0.11, my = H * 0.075;
  const bw = W - 2 * mx, bh = H - 2 * my - H * 0.03;
  const k = Math.min(bw / im.width, bh / im.height);
  const iw = im.width * k, ih = im.height * k;
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.filter = 'saturate(0.8)';
  g.drawImage(im, (W - iw) / 2 + (side === 'L' ? -W * 0.015 : W * 0.015), my, iw, ih);
  g.restore();
  // номер страницы внизу
  g.fillStyle = 'rgba(60,50,40,.55)';
  g.font = `italic ${Math.round(W * 0.022)}px Georgia, serif`;
  g.textAlign = 'center';
  // тень у корешка и легкое потемнение краев
  const gx = side === 'L' ? W : 0;
  const grd = g.createLinearGradient(gx, 0, side === 'L' ? W * 0.82 : W * 0.18, 0);
  grd.addColorStop(0, 'rgba(70,50,30,.38)'); grd.addColorStop(1, 'rgba(70,50,30,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H / 2, W * 0.45, W / 2, H / 2, W * 0.95);
  vg.addColorStop(0, 'rgba(120,90,50,0)'); vg.addColorStop(1, 'rgba(120,90,50,.18)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}

// изогнутая страница: у корешка поднимается, к краю ложится на блок
function pageGeometry(side) {
  const nx = 80, ny = 4;
  const g = new THREE.PlaneGeometry(PW, PH, nx, ny);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / PW + 0.5;               // 0..1 слева направо
    const s = side === 'L' ? 1 - u : u;           // 0 у корешка, 1 у края
    const x = (side === 'L' ? -1 : 1) * s * PW;
    const lift = BLOCK + 0.13 * Math.exp(-s / 0.09) - 0.02 * s * s + OPEN * (1 - s);
    p.setXYZ(i, x, lift, p.getZ(i));
  }
  g.computeVertexNormals();
  return g;
}

const paperEdge = (() => {
  const c = document.createElement('canvas'); c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  for (let y = 0; y < 256; y++) { const v = 222 + Math.round((R() - 0.5) * 22); g.fillStyle = `rgb(${v},${v - 8},${v - 26})`; g.fillRect(0, y, 16, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const cloth = new THREE.MeshStandardMaterial({ color: '#23382B', roughness: 0.92 });
const edgeMat = new THREE.MeshStandardMaterial({ map: paperEdge, roughness: 1 });

for (const side of ['L', 'R']) {
  const sg = side === 'L' ? -1 : 1;
  // переплет
  const cover = new THREE.Mesh(new THREE.BoxGeometry(PW + OVER, COVER, PH + 2 * OVER), cloth);
  cover.position.set(sg * (PW + OVER) / 2, COVER / 2, 0);
  cover.rotation.z = -sg * 0.025;
  cover.castShadow = cover.receiveShadow = true;
  scene.add(cover);
  // блок страниц (обрез)
  const block = new THREE.Mesh(new THREE.BoxGeometry(PW - 0.03, BLOCK, PH - 0.02), [edgeMat, edgeMat, new THREE.MeshStandardMaterial({ color: '#E6DDC8' }), edgeMat, edgeMat, edgeMat]);
  block.position.set(sg * (PW / 2 + 0.01), COVER + BLOCK / 2 - 0.004, 0);
  block.castShadow = block.receiveShadow = true;
  scene.add(block);
}
// корешок
const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, PH + 2 * OVER, 24, 1, false, Math.PI, Math.PI), cloth);
spine.rotation.x = Math.PI / 2; spine.position.set(0, 0.08, 0);
scene.add(spine);

const [texL, texR] = await Promise.all([
  pageTexture('/assets/photos/haeckel_plate_b.jpg', 'L'),
  pageTexture('/assets/photos/haeckel_medusa.jpg', 'R'),
]);
for (const [side, tex] of [['L', texL], ['R', texR]]) {
  const m = new THREE.Mesh(pageGeometry(side), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }));
  m.position.y = COVER;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}

// закладка-ленточка
const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.006, 1.1), new THREE.MeshStandardMaterial({ color: '#8E2A1E', roughness: 0.8 }));
ribbon.position.set(0.06, 0.012, PH / 2 + 0.5); ribbon.rotation.y = -0.12; ribbon.castShadow = true;
scene.add(ribbon);

sun({ pos: [-7, 9, 5], intensity: 2.4, size: 7, radius: 9, blur: 20 });
hemi(0xf6f2ea, 0xb3a68e, 1.15);
shadowCatcher(0, 40, 0.42);

camera.position.set(2.4, 10.4, 7.2);
camera.lookAt(0, 0.1, 0.25);
finish({
  L: [-PW * 0.5, COVER + BLOCK, -PH / 2], R: [PW * 0.5, COVER + BLOCK, -PH / 2],
  Lb: [-PW * 0.5, COVER, PH / 2 + OVER], Rb: [PW * 0.5, COVER, PH / 2 + OVER],
});
