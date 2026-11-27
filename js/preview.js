// Panggung karakter di lobby dan gambar kecil (thumbnail) untuk Shop/Vault/Spin.
import * as THREE from 'three';
import { createCharacter, createChute, createGun, box } from './character.js';
import { ITEMS, SKINS, RANKS } from '../shared/catalog.js';

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3150, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 6, 5); scene.add(sun);
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 1.9, 7.4); camera.lookAt(0, 1.18, 0);
  lights(scene);
  // Pedestal + bayangan
  box(scene, 0, -0.22, 0, 2.5, 0.24, 2.5, 0x1b1b2c);
  const ring = box(scene, 0, -0.09, 0, 2.1, 0.03, 2.1, 0xa855f7, true);
  box(scene, 0, -0.06, 0, 1.96, 0.05, 1.96, 0x25253a);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.025; scene.add(shadow);
  const sparks = Array.from({ length: 36 }, (_, i) => {
    const s = box(scene, 0, 0, 0, 0.035, 0.035, 0.035, i % 2 ? 0x22d3ee : 0xa855f7, true);
    s.userData = { a: Math.random() * 6.28, r: 0.9 + Math.random() * 0.8, y: Math.random() * 2.6, v: 0.15 + Math.random() * 0.3 };
    return s;
  });
  let ch, key = '', angle = 0.35, active = true, drag = null, last = 0;
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag != null) { angle += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { drag = null; });

  function frame(ms) {
    requestAnimationFrame(frame);
    if (!active || !ch) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    const t = ms / 1000, dt = Math.min(0.05, t - last); last = t;
    ch.root.rotation.y = angle; ch.animate(t, 'idle');
    for (const s of sparks) {
      const u = s.userData; u.y = (u.y + u.v * dt) % 2.6; u.a += dt * 0.3;
      s.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return {
    update(profile) {
      const k = JSON.stringify([profile.equipped, profile.rank]);
      if (k === key) return;
      key = k;
      if (ch) scene.remove(ch.root);
      ch = createCharacter(profile.equipped); scene.add(ch.root);
      ring.material = new THREE.MeshBasicMaterial({ color: RANKS[profile.rank].from });
    },
    turn(d) { angle += d; },
    setActive(v) { active = v; },
  };
}

const cache = new Map();
let mini;
/** Gambar PNG kecil dari item atau skin. */
export function thumb(id) {
  if (cache.has(id)) return cache.get(id);
  if (!mini) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(160, 160);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    mini = { renderer, camera };
  }
  const scene = new THREE.Scene(); lights(scene);
  let eye = [1.6, 2, 5.6], at = [0, 1.1, 0];
  const it = ITEMS[id];
  if (SKINS[id]) {
    const g = createGun(SKINS[id].weapon, id, 7); g.rotation.x = Math.PI / 2; g.position.z = 0.55; scene.add(g);
    eye = [3, 0.9, 0.6]; at = [0, 0, 0];
  } else if (it.slot === 'parachute') {
    scene.add(createChute(it.look.chute)); eye = [2.5, 4, 7]; at = [0, 2.6, 0];
  } else if (it.slot === 'trail') {
    for (let i = 0; i < 7; i++) box(scene, -0.9 + i * 0.3, Math.sin(i) * 0.25, 0, 0.08 + i * 0.025, 0.08 + i * 0.025, 0.1, it.look.trail, true);
    eye = [0, 0.3, 4]; at = [0, 0, 0];
  } else {
    const ch = createCharacter({ [it.slot]: id }); ch.animate(0, 'idle');
    ch.root.rotation.y = it.slot === 'backpack' ? Math.PI - 0.5 : 0.35; scene.add(ch.root);
    if (it.slot === 'hat' || it.slot === 'acc') { eye = [0.9, 2.4, 3.2]; at = [0, 1.95, 0]; }
    else if (it.slot === 'shoes') { eye = [1, 0.9, 2.8]; at = [0, 0.25, 0]; }
    else if (it.slot === 'pants') { eye = [1, 1.1, 3.8]; at = [0, 0.55, 0]; }
  }
  mini.camera.position.set(...eye); mini.camera.lookAt(...at);
  mini.renderer.render(scene, mini.camera);
  const url = mini.renderer.domElement.toDataURL();
  cache.set(id, url);
  return url;
}
