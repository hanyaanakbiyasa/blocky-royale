// Model karakter voxel + animasi. Semua pemain memakai karakter dasar yang sama.
import * as THREE from 'three';
import { ITEMS, SKINS, WEAPONS, ARMOR } from '../shared/catalog.js';

const geo = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
export function mat(color, glow = false) {
  const key = color + (glow ? 'g' : '');
  if (!mats.has(key)) mats.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }));
  return mats.get(key);
}
export function box(parent, x, y, z, w, h, d, color, glow = false) {
  const m = new THREE.Mesh(geo, mat(color, glow));
  m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m);
  return m;
}
const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

const BASE = { skin: 0xd9a47a, torso: 0xf5f5f5, arms: null, legs: 0x4b5d34, feet: 0x2f9e44, hair: 0x1c1410, beard: 0x3e2414 };

/** Gabungkan item yang dipakai menjadi satu deskripsi tampilan. */
export function lookOf(equipped = {}) {
  const look = { ...BASE, boxes: [], bundle: false };
  const ids = equipped.bundle ? [equipped.bundle] : ['hat', 'acc', 'clothes', 'pants', 'shoes'].map((s) => equipped[s]);
  ids.push(equipped.backpack);
  for (const id of ids) {
    const it = ITEMS[id];
    if (!it) continue;
    const { boxes = [], ...colors } = it.look;
    Object.assign(look, colors);
    look.boxes.push(...boxes);
    if (it.slot === 'bundle') look.bundle = true;
  }
  look.glove = ITEMS[equipped.glove]?.look.glove ?? null;
  look.chute = ITEMS[equipped.parachute]?.look.chute ?? [0xe5e7eb, 0x9ca3af];
  look.trail = ITEMS[equipped.trail]?.look.trail ?? null;
  return look;
}

export function createCharacter(equipped) {
  const L = lookOf(equipped);
  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0);
  const hips = joint(body, 0, 0.86, 0);
  const torso = joint(hips, 0, 0, 0);
  box(torso, 0, 0.39, 0, 0.82, 0.78, 0.44, L.torso);
  const head = joint(torso, 0, 0.82, 0);
  box(head, 0, 0.32, 0, 0.62, 0.62, 0.62, L.skin);
  // Rambut cepak
  box(head, 0, 0.66, -0.02, 0.65, 0.09, 0.64, L.hair);
  box(head, 0, 0.5, -0.31, 0.65, 0.28, 0.04, L.hair);
  box(head, -0.315, 0.53, -0.05, 0.03, 0.2, 0.5, L.hair);
  box(head, 0.315, 0.53, -0.05, 0.03, 0.2, 0.5, L.hair);
  // Wajah datar: mata garis horizontal, tanpa senyum
  const eye = L.skin === 0x1b1b24 ? 0x22d3ee : 0x141414;
  box(head, -0.14, 0.36, 0.316, 0.15, 0.045, 0.015, eye);
  box(head, 0.14, 0.36, 0.316, 0.15, 0.045, 0.015, eye);
  if (L.beard != null) {
    box(head, 0, 0.07, 0.3, 0.56, 0.16, 0.08, L.beard);
    box(head, 0, 0.19, 0.318, 0.34, 0.05, 0.03, L.beard);
    box(head, -0.28, 0.2, 0.22, 0.09, 0.24, 0.2, L.beard);
    box(head, 0.28, 0.2, 0.22, 0.09, 0.24, 0.2, L.beard);
  }
  const parts = { torso, head };
  for (const [name, side] of [['armL', -1], ['armR', 1]]) {
    const arm = joint(torso, side * 0.55, 0.72, 0);
    const sleeve = L.arms || null;
    box(arm, 0, -0.14, 0, 0.27, 0.34, 0.29, sleeve || L.torso);
    box(arm, 0, -0.5, 0, 0.25, 0.4, 0.27, sleeve || L.skin);
    box(arm, 0, -0.75, 0, L.glove ? 0.32 : 0.25, L.glove ? 0.22 : 0.12, L.glove ? 0.34 : 0.27, L.glove || L.skin);
    parts[name] = arm;
  }
  for (const [name, side] of [['legL', -1], ['legR', 1]]) {
    const leg = joint(hips, side * 0.2, 0, 0);
    box(leg, 0, -0.38, 0, 0.35, 0.76, 0.38, L.legs);
    // Sendal flat: kaki + alas + tali
    box(leg, 0, -0.78, 0.01, 0.32, 0.08, 0.38, L.skin);
    box(leg, 0, -0.835, 0.05, 0.39, 0.05, 0.5, L.feet);
    box(leg, 0, -0.735, 0.13, 0.35, 0.035, 0.08, L.feet);
    parts[name] = leg;
  }
  for (const [part, x, y, z, w, h, d, c] of L.boxes) box(parts[part], x, y, z, w, h, d, c);

  const gunMount = joint(parts.armR, 0, -0.72, 0.08);
  const armor = new THREE.Group(); torso.add(armor);
  const helmet = new THREE.Group(); head.add(helmet);

  let weapon = null, armorKey = '';
  const ch = {
    root, body, parts, look: L, gunMount,
    setWeapon(id, skinId, level = 1) {
      const key = `${id}:${skinId}:${level}`;
      if (key === weapon) return;
      weapon = key; gunMount.clear();
      if (id && id !== 'fist') gunMount.add(createGun(id, skinId, level));
      ch.armed = !!id && id !== 'fist';
    },
    setArmor(h, v) {
      const key = `${h}${v}`;
      if (key === armorKey) return;
      armorKey = key; armor.clear(); helmet.clear();
      if (v) { box(armor, 0, 0.42, 0, 0.9, 0.56, 0.52, ARMOR[v].color); box(armor, 0, 0.36, 0.28, 0.5, 0.18, 0.05, 0x1f2937); }
      if (h) { box(helmet, 0, 0.67, 0, 0.74, 0.2, 0.74, ARMOR[h].color); box(helmet, 0, 0.5, -0.36, 0.74, 0.2, 0.06, ARMOR[h].color); }
    },
    /** state: idle | walk | air | chute | crouch | prone | dead */
    animate(t, state = 'idle', speed = 1, punch = 0) {
      const p = parts;
      for (const k of ['armL', 'armR', 'legL', 'legR', 'head', 'torso']) p[k].rotation.set(0, 0, 0);
      body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); hips.position.y = 0.86; torso.scale.y = 1;
      const swing = Math.sin(t * 10) * 0.75 * Math.min(1, speed);
      if (state === 'idle') {
        torso.scale.y = 1 + Math.sin(t * 2.2) * 0.016;
        p.torso.rotation.y = Math.sin(t * 0.7) * 0.05;
        p.head.rotation.y = Math.sin(t * 0.5) * 0.16;
        p.armL.rotation.z = -0.06 - Math.sin(t * 2.2) * 0.03; p.armR.rotation.z = 0.06 + Math.sin(t * 2.2) * 0.03;
      } else if (state === 'walk') {
        p.legL.rotation.x = swing; p.legR.rotation.x = -swing; p.armL.rotation.x = -swing * 0.8; p.armR.rotation.x = swing * 0.8;
        body.position.y = Math.abs(Math.cos(t * 10)) * 0.05;
      } else if (state === 'air') {
        p.legL.rotation.x = -0.6; p.legR.rotation.x = 0.25; p.armL.rotation.z = -0.9; p.armR.rotation.z = 0.9;
      } else if (state === 'chute') {
        p.armL.rotation.z = -2.7; p.armR.rotation.z = 2.7; p.legL.rotation.x = Math.sin(t * 2) * 0.2; p.legR.rotation.x = -Math.sin(t * 2) * 0.2;
      } else if (state === 'crouch') {
        hips.position.y = 0.52; p.torso.rotation.x = 0.3; p.head.rotation.x = -0.25;
        p.legL.rotation.x = -1.0 + swing * 0.4 * (speed > 0.05); p.legR.rotation.x = 0.7 - swing * 0.4 * (speed > 0.05);
      } else if (state === 'prone' || state === 'dead') {
        body.rotation.x = Math.PI / 2; body.position.set(0, 0.28, -0.9);
        if (state === 'prone') { p.head.rotation.x = -1.2; p.armL.rotation.x = -2.8 + swing * 0.3 * (speed > 0.05); p.armR.rotation.x = -2.8 - swing * 0.3 * (speed > 0.05); }
      } else if (state === 'wave') {
        p.armR.rotation.z = 2.6 + Math.sin(t * 9) * 0.35; p.armL.rotation.z = -0.08; p.head.rotation.y = Math.sin(t * 2) * 0.12;
      } else if (state === 'laugh') {
        body.position.y = Math.abs(Math.sin(t * 14)) * 0.06; p.torso.rotation.x = Math.sin(t * 14) * 0.1; p.head.rotation.x = -0.35;
        p.armL.rotation.set(-0.9, 0, 0.4); p.armR.rotation.set(-0.9, 0, -0.4);
      } else if (state === 'angry') {
        p.torso.rotation.y = Math.sin(t * 28) * 0.07; p.head.rotation.x = 0.35; p.armL.rotation.set(-0.5, 0, -0.25); p.armR.rotation.set(-0.5, 0, 0.25);
        p.legL.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.7;
      } else if (state === 'heal') {
        // Menggulung tangan seperti memperban
        p.armL.rotation.set(-1.15, 0, 0.85); p.armR.rotation.set(-1.15 + Math.sin(t * 11) * 0.3, 0, -0.85 + Math.sin(t * 11) * 0.2);
        p.torso.rotation.x = 0.18; p.head.rotation.x = 0.4;
      } else if (state === 'sit') {
        hips.position.y = 0.44; p.legL.rotation.x = -1.5; p.legR.rotation.x = -1.5; p.armL.rotation.x = -0.9; p.armR.rotation.x = -0.9; p.head.rotation.y = Math.sin(t * 0.6) * 0.2;
      }
      if (ch.armed && !['chute', 'dead', 'wave', 'laugh', 'angry', 'sit', 'heal'].includes(state)) {
        p.armR.rotation.set(state === 'prone' ? -3.0 : -1.5, 0, 0);
        p.armL.rotation.set(state === 'prone' ? -2.9 : -1.35, 0, 0.7);
      } else if (punch > 0) p.armR.rotation.x = -1.6 * Math.sin(punch * Math.PI);
    },
  };
  return ch;
}

/** Senjata voxel. Menghadap sumbu -Y lengan (ke depan saat lengan diangkat). */
export function createGun(id, skinId, level = 1) {
  const w = WEAPONS[id], s = SKINS[skinId];
  const g = new THREE.Group();
  const main = s ? s.color : w.color;
  const len = w.len;
  box(g, 0, -len * 0.45, 0, 0.13, len, 0.17, main);
  box(g, 0, -len - 0.1, 0.02, 0.07, 0.24, 0.07, 0x15151b);
  box(g, 0, -len * 0.25, -0.16, 0.09, 0.14, 0.2, 0x1d1d24);
  if (w.cat === 'Rifle' || w.cat === 'SMG') box(g, 0, -len * 0.6, -0.18, 0.09, 0.12, 0.24, s ? s.accent : 0x26262e);
  if (w.cat === 'Sniper') box(g, 0, -len * 0.5, 0.17, 0.1, 0.45, 0.1, 0x111118);
  if (s) {
    const glow = s.evo && level >= 2;
    box(g, 0, -len * 0.55, 0.09, 0.145, len * 0.5, 0.025, s.accent, glow);
    if (s.evo && level >= 4) box(g, 0, -len - 0.24, 0.02, 0.13, 0.05, 0.13, s.accent, true);
    if (s.evo && level >= 6) for (const x of [-0.17, 0.17]) box(g, x, -len * 0.7, 0.08, 0.05, 0.28, 0.05, s.accent, true);
    if (s.evo && level >= 7) box(g, 0, -len * 0.2, 0.25, 0.09, 0.09, 0.09, s.accent, true);
  }
  return g;
}

export function createChute(colors) {
  const g = new THREE.Group();
  for (let i = -2; i <= 2; i++) box(g, i * 0.7, 3.5 - Math.abs(i) * 0.22, 0, 0.68, 0.18, 2.0, colors[Math.abs(i) % 2]);
  for (const x of [-1.3, 1.3]) { const l = box(g, x * 0.62, 2.35, 0, 0.04, 2.2, 0.04, 0x222222); l.rotation.z = -x * 0.45; }
  return g;
}
