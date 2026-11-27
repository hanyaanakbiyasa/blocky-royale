// Panggung karakter di lobby dan gambar kecil (thumbnail) untuk Shop/Vault/Spin.
import * as THREE from 'three';
import { createCharacter, createChute, createGun, box } from './character.js';
import { ITEMS, SKINS, RANKS, WEAPONS } from '../shared/catalog.js';

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
  // Kabin pesawat: lantai, dinding, jendela berawan, kursi, dan lampu langit-langit
  const cabin = new THREE.Group(); scene.add(cabin);
  box(cabin, 0, -0.36, -1, 15, 0.2, 14, 0x3a3f4f); box(cabin, 0, -0.24, -1, 3, 0.03, 13, 0x7f1d1d);
  box(cabin, 0, 5.2, -1, 15, 0.2, 14, 0xcfd5df); box(cabin, 0, 2.4, -5.2, 15, 6, 0.3, 0xe5e7eb);
  for (const s of [-1, 1]) { box(cabin, s * 7.4, 2.4, -1, 0.3, 6, 14, 0xdfe3ea); box(cabin, s * 2.2, 5.08, -1, 0.35, 0.05, 11, 0xfff3c4, true); }
  const clouds = [];
  for (const x of [-5, -1.7, 1.7, 5]) {
    box(cabin, x, 2.7, -5.02, 1.7, 1.8, 0.1, 0x1f2937); box(cabin, x, 2.7, -4.95, 1.45, 1.55, 0.04, 0x7dd3fc, true);
    for (let i = 0; i < 2; i++) { const c = box(cabin, x, 2.7, -4.9, 0.6, 0.22, 0.03, 0xffffff, true); c.userData = { x, o: i / 2 + (x > 0 ? 0.2 : 0), y: 2.35 + i * 0.6 }; clouds.push(c); }
  }
  for (const z of [-3.2, -1.4, 0.4]) for (const s of [-1, 1]) {
    box(cabin, s * 5.3, 0.15, z, 1.5, 0.5, 1.2, 0x2b4a8b); box(cabin, s * 5.95, 0.85, z, 0.3, 1.3, 1.2, 0x2b4a8b); box(cabin, s * 5.95, 1.6, z, 0.34, 0.3, 0.7, 0x1e3a6f);
  }
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
  const seat = box(scene, 0, 0.2, 0, 0.8, 0.4, 0.8, 0x6b4f2a); seat.visible = false;
  const fx = new THREE.Group(); scene.add(fx);
  let ch, key = '', angle = 0.35, active = true, drag = null, last = 0, moved = 0, emo = null, hand = null, prof = null, api;
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag != null) { moved += Math.abs(e.clientX - drag); angle += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { if (drag != null && moved < 6) api.onTap?.(); drag = null; });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  const applyHand = () => {
    if (!ch) return;
    const s = SKINS[hand], id = s ? s.weapon : WEAPONS[hand] ? hand : null;
    ch.setWeapon(id, s ? hand : null, s ? (prof?.evo?.[hand] || 1) : 1);
  };
  // Efek emote final: meteor jatuh / petir / orbit, lalu senjata muncul di tangan.
  const FINAL = { e_shot_lahar: 'fall', e_awm_petir: 'beam', e_kar_hantu: 'fall', e_famas_samurai: 'beam' };
  function finalFx(e, t) {
    const s = SKINS[e.skin], k = FINAL[e.skin] || 'orbit', u = t - e.t0;
    if (!e.parts) {
      e.parts = Array.from({ length: k === 'orbit' ? 8 : 6 }, () => box(fx, 0, 0, 0, 0.35, 0.35, 0.35, s.accent, true));
      e.flash = box(fx, 0, 0.1, 0, 0.5, 0.05, 0.5, 0xffffff, true); e.flash.visible = false;
    }
    e.parts.forEach((m, i) => {
      m.visible = u < 2.4;
      if (k === 'fall') { const f = Math.min(1, u / 2.1); m.position.set(Math.sin(i) * 0.12 * (1 - f), 9 * (1 - f) + 0.4 + i * 0.35 * (1 - f), 0); m.scale.setScalar(i ? 0.6 : 2.2); }
      else if (k === 'beam') { m.position.set(0, 0.8 + i * 1.5, 0); m.scale.set(0.35, 4, 0.35); m.visible = u > 1.2 && u < 2.4 && Math.floor(u * 14) % 2 === 0; }
      else { const f = u / 2.2, a = u * 5 + i * 0.785; m.position.set(Math.cos(a) * 2 * (1 - f), 0.4 + f * 1.6, Math.sin(a) * 2 * (1 - f)); }
    });
    e.flash.visible = u > 2.1 && u < 3.1; e.flash.scale.setScalar(1 + (u - 2.1) * 12);
    if (u >= 2.2 && !e.got) { e.got = true; hand = e.skin; applyHand(); api.onHand?.(e.skin); }
    return u < 2.2 ? 'idle' : 'wave';
  }

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
    let st = 'idle';
    if (emo) {
      if (emo.skin) { st = finalFx(emo, t); if (st === 'idle') ch.parts.head.rotation.x = 0; }
      else st = emo.name;
      if (t - emo.t0 > (emo.skin ? 4.6 : 6)) { fx.clear(); emo = null; st = 'idle'; }
    }
    seat.visible = st === 'sit';
    ch.root.rotation.y = angle; ch.animate(t, st);
    if (emo?.skin && st === 'idle') ch.parts.head.rotation.x = -0.6;
    for (const c of clouds) { const u = c.userData; c.position.set(u.x + (((t * 0.12 + u.o) % 1) - 0.5) * 1.1, u.y, -4.9); }
    for (const s of sparks) {
      const u = s.userData; u.y = (u.y + u.v * dt) % 2.6; u.a += dt * 0.3;
      s.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  api = {
    update(profile) {
      prof = profile;
      const k = JSON.stringify([profile.equipped, profile.rank]);
      if (k === key) return;
      key = k;
      if (ch) scene.remove(ch.root);
      ch = createCharacter(profile.equipped); scene.add(ch.root);
      ring.material = new THREE.MeshBasicMaterial({ color: RANKS[profile.rank].from });
      applyHand();
    },
    setHand(id) { hand = id || null; applyHand(); },
    emote(e) { fx.clear(); emo = { ...e, t0: last }; },
    turn(d) { angle += d; },
    setActive(v) { active = v; },
  };
  return api;
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
