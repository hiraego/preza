// Общая «студия» для 3D-сцен: рендер в прозрачный PNG + экспорт точек-якорей для подписей.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const params = new URLSearchParams(location.search);

export function stage({ w = 1600, h = 1200, pr = 2, fov = 30, exposure = 1.0, env = 0.35 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x000000, 0);
  document.body.style.margin = '0';
  document.body.style.background = params.has('preview') ? '#e9e3d5' : 'transparent';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = env;

  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 500);

  function sun({ pos = [-6, 12, 8], color = 0xfff4e2, intensity = 2.4, size = 12, radius = 14, blur = 24, mapSize = 4096 } = {}) {
    const l = new THREE.DirectionalLight(color, intensity);
    l.position.set(...pos);
    l.castShadow = true;
    l.shadow.mapSize.set(mapSize, mapSize);
    const c = l.shadow.camera;
    c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = 80;
    l.shadow.radius = radius;
    l.shadow.blurSamples = blur;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
    scene.add(l);
    scene.add(l.target);
    return l;
  }

  function hemi(sky = 0xe8eef8, ground = 0xb9a88a, intensity = 0.9) {
    const l = new THREE.HemisphereLight(sky, ground, intensity);
    scene.add(l);
    return l;
  }

  // Прозрачная плоскость, которая только принимает тень
  function shadowCatcher(y = 0, size = 60, opacity = 0.22) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function finish(anchors = {}) {
    renderer.render(scene, camera);
    const out = {};
    for (const [k, p] of Object.entries(anchors)) {
      const v = new THREE.Vector3(...p).project(camera);
      out[k] = [+((v.x + 1) / 2).toFixed(4), +((1 - v.y) / 2).toFixed(4)];
    }
    window.__anchors = out;
    window.__size = [w * pr, h * pr];
    window.__ready = true;
    if (params.has('preview')) {
      for (const [k, [x, y]] of Object.entries(out)) {
        const d = document.createElement('div');
        d.textContent = '● ' + k;
        d.style.cssText = `position:absolute;left:${x * w}px;top:${y * h}px;font:12px monospace;color:#c00;transform:translate(-4px,-8px)`;
        document.body.appendChild(d);
      }
    }
  }

  return { THREE, renderer, scene, camera, sun, hemi, shadowCatcher, finish };
}

// Детерминированный шум (value noise + fbm), чтобы рендеры не менялись между сборками
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

export function fbm(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
