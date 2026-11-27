// Peta 200x200: kota, rumah, gudang, menara, pohon, batu, pagar, jalan, crate, dan loot.
import * as THREE from 'three';
import { WEAPONS, AMMO } from '../shared/catalog.js';

export const HALF = 100;

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOWNS = [[0, 0], [-58, -52], [56, -55], [-55, 55], [58, 52]];

/** Kotak tabrakan kendaraan parkir (diputar ke sumbu terdekat). */
export function vehicleSolid(v) {
  const al = Math.abs(Math.sin(v.yaw)) > 0.7, hx = (al ? v.len : v.wid) / 2, hz = (al ? v.wid : v.len) / 2;
  return { x0: v.x - hx, x1: v.x + hx, y0: 0, y1: 1.7, z0: v.z - hz, z1: v.z + hz };
}

export function generateWorld(seed) {
  const rng = seeded(seed);
  const rand = (a, b) => a + rng() * (b - a);
  const pick = (l) => l[Math.floor(rng() * l.length)];
  const visuals = [], solids = [], spots = [], taken = [], buildings = [];

  // x,z = pusat; y = dasar kotak
  const block = (x, y, z, w, h, d, color, solid = true) => {
    visuals.push([x, y + h / 2, z, w, h, d, color]);
    if (solid) solids.push({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h, z0: z - d / 2, z1: z + d / 2 });
  };
  const free = (x, z, w, d, pad = 1) => Math.abs(x) + w / 2 < HALF - 2 && Math.abs(z) + d / 2 < HALF - 2
    && !taken.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 + pad && Math.abs(r.z - z) < (r.d + d) / 2 + pad);
  const reserve = (x, z, w, d) => taken.push({ x, z, w, d });

  // Tanah, petak rumput, jalan
  block(0, -2, 0, HALF * 2, 2, HALF * 2, 0x6aa84f, false);
  for (let i = 0; i < 520; i++) block(rand(-97, 97), 0, rand(-97, 97), rand(1, 5), 0.012 + rng() * 0.012, rand(1, 5), pick([0x5d9a43, 0x78b85a, 0x538c3b, 0x86a851]), false);
  for (const [tx, tz] of TOWNS) block(tx, 0, tz, 30, 0.03, 30, 0x9c8a66, false);
  const road = (x, z, w, d, y) => { block(x, 0, z, w, y, d, 0xb59b6c, false); reserve(x, z, w, d); };
  road(0, 0, 190, 4, 0.05); road(0, 0, 4, 190, 0.055); road(0, -54, 150, 3, 0.045); road(0, 54, 150, 3, 0.046);

  // Dinding sepanjang sumbu dengan celah pintu/jendela
  function wall(cx, cz, len, axis, color, { door = false, windows = false, h = 3.2 } = {}) {
    const t = 0.35;
    const seg = (off, l, y, hh) => axis === 'x' ? block(cx + off, y, cz, l, hh, t, color) : block(cx, y, cz + off, t, hh, l, color);
    if (door) {
      const gap = 1.9, side = (len - gap) / 2;
      seg(-(gap + side) / 2, side, 0, h); seg((gap + side) / 2, side, 0, h); seg(0, gap, 2.5, h - 2.5);
    } else if (windows) {
      const gap = 1.6, side = (len - gap) / 2;
      seg(-(gap + side) / 2, side, 0, h); seg((gap + side) / 2, side, 0, h); seg(0, gap, 0, 1.15); seg(0, gap, 2.3, h - 2.3);
    } else seg(0, len, 0, h);
  }
  // Tangga menempel di sisi +x, naik ke arah -z sampai ketinggian top
  function stairs(x, zStart, top, color) {
    const n = Math.ceil(top / 0.4);
    for (let i = 0; i < n; i++) block(x, 0, zStart - i * 0.6, 1.4, ((i + 1) * top) / n, 0.6, color);
    return zStart - (n - 1) * 0.6;
  }

  function house(x, z, w, d, withStairs) {
    const wallC = pick([0xd9c9a3, 0xb8c4cc, 0xc98f6b, 0xa9bd8f, 0xcfb3c9, 0xe3dccb]);
    const roofC = pick([0x9c3d2e, 0x3f5a78, 0x5d4037, 0x2f6b57]);
    const front = rng() < 0.5 ? 1 : -1;
    block(x, 0, z, w, 0.08, d, 0x8a6a48, false);
    wall(x, z + (front * d) / 2, w, 'x', wallC, { door: true });
    wall(x, z - (front * d) / 2, w, 'x', wallC, { door: rng() < 0.4, windows: true });
    wall(x - w / 2, z, d - 0.35, 'z', wallC, { windows: true });
    wall(x + w / 2, z, d - 0.35, 'z', wallC, { windows: true });
    block(x, 3.2, z, w + 0.35, 0.3, d + 0.35, roofC);
    if (withStairs) {
      stairs(x + w / 2 + 0.9, z + d / 2 - 0.3, 3.5, 0x8d8d96);
      block(x - w / 2, 3.5, z, 0.25, 0.7, d, roofC); // pagar atap
      spots.push([x - 1, 3.5, z]);
      if (w > 7) { block(x - 1.4, 3.5, z - d / 2 + 1.4, 2, 1.6, 2, wallC); }
    } else {
      block(x, 3.5, z, w * 0.75, 0.35, d + 0.2, roofC, false); block(x, 3.85, z, w * 0.4, 0.35, d + 0.1, roofC, false);
    }
    // Perabot dan loot di dalam
    block(x - w / 2 + 1, 0, z - d / 2 + 0.8, 1.4, 0.7, 0.8, 0x7a5230);
    spots.push([x + rand(-1, 1), 0.1, z + rand(-1, 1)], [x + w / 2 - 1.2, 0.1, z - front * (d / 2 - 1.2)]);
    block(x - w / 2 - 0.6, 0, z + rand(-1.5, 1.5), 0.8, 0.8, 0.8, 0x9b6b34);
    buildings.push([x, z, w, d]);
  }

  function warehouse(x, z) {
    const w = 14, d = 10, c = 0x78838f;
    block(x, 0, z, w, 0.08, d, 0x55555c, false);
    wall(x, z + d / 2, w, 'x', c, { door: true, h: 4.2 }); wall(x, z - d / 2, w, 'x', c, { door: true, h: 4.2 });
    wall(x - w / 2, z, d - 0.35, 'z', c, { windows: true, h: 4.2 }); wall(x + w / 2, z, d - 0.35, 'z', c, { door: true, h: 4.2 });
    block(x, 4.2, z, w + 0.5, 0.3, d + 0.5, 0xb0553a);
    for (const [ox, oz, n] of [[-5, -3, 2], [-3.6, -3, 1], [4.8, 3, 2], [4.8, -3, 1]]) for (let i = 0; i < n; i++) block(x + ox, i * 1.2, z + oz, 1.2, 1.2, 1.2, i ? 0xb98545 : 0x9b6b34);
    spots.push([x, 0.1, z], [x - 3, 0.1, z + 2], [x + 3, 0.1, z - 2], [x - 5.5, 0.1, z + 3]);
    buildings.push([x, z, w, d]);
  }

  function tower(x, z) {
    const top = 4.8;
    for (const [ox, oz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) { block(x + ox, 0, z + oz, 0.35, top - 0.3, 0.35, 0x6b4a2b); block(x + ox, top, z + oz, 0.2, 2.3, 0.2, 0x6b4a2b); }
    block(x, top - 0.3, z, 4, 0.3, 4, 0x8d6b45);
    block(x, top + 2.3, z, 4.6, 0.3, 4.6, 0x9c3d2e);
    block(x - 1.9, top, z, 0.2, 0.9, 3.4, 0x8d6b45); block(x, top, z - 1.9, 3.4, 0.9, 0.2, 0x8d6b45); block(x, top, z + 1.9, 3.4, 0.9, 0.2, 0x8d6b45);
    // Tangga naik ke arah -x menuju lantai menara
    const n = 12;
    for (let i = 0; i < n; i++) block(x + 2.3 + (n - 1 - i) * 0.55, 0, z, 0.6, ((i + 1) * top) / n, 1.4, 0x7b5a39);
    spots.push([x, top + 0.05, z]);
    buildings.push([x, z, 4, 4]);
  }

  // Kota
  TOWNS.forEach(([tx, tz], ti) => {
    const wx = tx + (ti % 2 ? -14 : 14), wz = tz + (tz > 0 ? 14 : -14);
    if (free(wx, wz, 15, 11)) { reserve(wx, wz, 15, 11); warehouse(wx, wz); }
    let made = 0;
    for (let i = 0; i < 300 && made < 8; i++) {
      const w = rand(6, 9), d = rand(6, 8), x = tx + rand(-24, 24), z = tz + rand(-24, 24);
      if (!free(x + 1, z, w + 3, d + 3)) continue;
      reserve(x + 1, z, w + 3, d + 3); house(x, z, w, d, made % 2 === 0); made++;
    }
  });
  // Rumah terpencil dan menara
  for (let i = 0, made = 0; i < 400 && made < 12; i++) {
    const x = rand(-90, 90), z = rand(-90, 90);
    if (!free(x + 1, z, 10, 10)) continue;
    reserve(x + 1, z, 10, 10); house(x, z, rand(6, 7.5), rand(6, 7), rng() < 0.5); made++;
  }
  for (let i = 0, made = 0; i < 400 && made < 7; i++) {
    const x = rand(-85, 80), z = rand(-85, 85);
    if (!free(x + 3, z, 13, 7)) continue;
    reserve(x + 3, z, 13, 7); tower(x, z); made++;
  }
  // Pagar, crate, mobil rongsok
  for (let i = 0, made = 0; i < 300 && made < 34; i++) {
    const x = rand(-88, 88), z = rand(-88, 88), len = rand(5, 10), horiz = rng() < 0.5;
    const w = horiz ? len : 0.2, d = horiz ? 0.2 : len;
    if (!free(x, z, w, d, 0.5)) continue;
    reserve(x, z, w, d); made++;
    block(x, 0.45, z, w, 0.15, d, 0xc8a574); block(x, 0.8, z, w, 0.12, d, 0xc8a574, false);
    for (let k = -len / 2; k <= len / 2; k += len / 5) block(x + (horiz ? k : 0), 0, z + (horiz ? 0 : k), 0.28, 1, 0.28, 0x8a6436);
  }
  for (let i = 0, made = 0; i < 300 && made < 40; i++) {
    const x = rand(-90, 90), z = rand(-90, 90);
    if (!free(x, z, 3, 3, 0.3)) continue;
    reserve(x, z, 3, 3); made++;
    block(x, 0, z, 1.2, 1.2, 1.2, 0x9b6b34); block(x, 1.2, z, 1.24, 0.08, 1.24, 0x6b4720, false);
    if (rng() < 0.4) block(x + 1.25, 0, z, 1, 0.55, 1, 0xb98545);
    spots.push([x, 1.3, z], [x - 1.4, 0.1, z]);
  }
  for (let i = 0, made = 0; i < 200 && made < 9; i++) {
    const x = rand(-85, 85), z = rand(-85, 85);
    if (!free(x, z, 5, 3)) continue;
    reserve(x, z, 5, 3); made++;
    const c = pick([0xb23b3b, 0x2f6fb2, 0xc9a227]);
    block(x, 0.35, z, 4, 0.8, 2, c); block(x - 0.3, 1.15, z, 2, 0.7, 1.9, 0x9fc7d9);
    for (const ox of [-1.4, 1.4]) for (const oz of [-1, 1]) block(x + ox, 0, z + oz, 0.8, 0.7, 0.3, 0x17171a, false);
  }
  // Pohon, batu, semak, bunga
  for (let i = 0, made = 0; i < 900 && made < 150; i++) {
    const x = rand(-96, 96), z = rand(-96, 96);
    if (!free(x, z, 2, 2, 0.6)) continue;
    reserve(x, z, 2, 2); made++;
    const h = rand(2.2, 3.6), leaf = pick([0x2f7d32, 0x3c9440, 0x256b2b, 0x55a630]);
    block(x, 0, z, 0.55, h, 0.55, 0x6d4a2a);
    block(x, h - 0.2, z, rand(2.2, 3), 1.1, rand(2.2, 3), leaf, false); block(x, h + 0.9, z, 1.6, 0.9, 1.6, leaf, false); block(x, h + 1.8, z, 0.8, 0.6, 0.8, leaf, false);
  }
  for (let i = 0, made = 0; i < 400 && made < 60; i++) {
    const x = rand(-95, 95), z = rand(-95, 95), s = rand(0.8, 2.2);
    if (!free(x, z, s, s, 0.4)) continue;
    reserve(x, z, s, s); made++;
    block(x, 0, z, s, s * 0.7, s * 0.9, 0x8b8f96); block(x + s * 0.3, s * 0.7, z, s * 0.5, s * 0.3, s * 0.5, 0x9ea2a9, false);
  }
  for (let i = 0; i < 190; i++) {
    const x = rand(-96, 96), z = rand(-96, 96);
    if (!free(x, z, 1, 1, 0)) continue;
    if (i % 3) { block(x, 0, z, rand(0.7, 1.4), rand(0.4, 0.8), rand(0.7, 1.4), 0x3f8f3a, false); }
    else for (let k = 0; k < 4; k++) block(x + rand(-1, 1), 0, z + rand(-1, 1), 0.15, 0.3, 0.15, pick([0xf9d342, 0xf45b69, 0xffffff, 0xb57bee]), false);
  }
  // Rumah-rumah tambahan tersebar
  for (let i = 0, made = 0; i < 300 && made < 18; i++) {
    const w = rand(5, 8.5), d = rand(5, 7.5), x = rand(-88, 88), z = rand(-88, 88);
    if (!free(x, z, w + 3, d + 3, 2)) continue;
    reserve(x, z, w + 3, d + 3); made++; house(x, z, w, d, rng() < 0.25);
  }
  // Sungai dengan jembatan (air tidak solid, jembatan punya pagar samping)
  for (let i = 0, made = 0; i < 40 && made < 3; i++) {
    const x = rand(-65, 65), z = rand(-65, 65), horiz = rng() < 0.5, L = 30, W = 6;
    const w = horiz ? L : W, d = horiz ? W : L;
    if (!free(x, z, w + 4, d + 4, 0)) continue;
    reserve(x, z, w + 4, d + 4); made++;
    block(x, 0, z, w, 0.04, d, 0x3b82c4, false);
    const bx = horiz ? 4 : W + 4, bz = horiz ? W + 4 : 4;
    block(x, 0.04, z, bx, 0.1, bz, 0x9a6b3a, false);
    for (const s of [-1, 1]) horiz ? block(x + s * 1.9, 0.1, z, 0.2, 0.9, bz, 0x6d4a2a) : block(x, 0.1, z + s * 1.9, bx, 0.9, 0.2, 0x6d4a2a);
  }
  // Pagar kayu
  for (let i = 0, made = 0; i < 300 && made < 16; i++) {
    const x = rand(-92, 92), z = rand(-92, 92), ax = rng() < 0.5, w = ax ? 8 : 0.3, d = ax ? 0.3 : 8;
    if (!free(x, z, w, d, 1.5)) continue;
    reserve(x, z, w, d); made++;
    block(x, 0, z, w, 1, d, 0xc9a46a);
    for (let k = -3; k <= 3; k += 2) block(ax ? x + k : x, 0, ax ? z : z + k, 0.25, 1.25, 0.25, 0x8a6a3a, false);
  }
  // Tumpukan ban
  for (let i = 0, made = 0; i < 200 && made < 20; i++) {
    const x = rand(-94, 94), z = rand(-94, 94);
    if (!free(x, z, 1.8, 1.8, 0.5)) continue;
    reserve(x, z, 1.8, 1.8); made++;
    const n = 1 + Math.floor(rng() * 3);
    block(x, 0, z, 0.95, 0.3 * n, 0.95, 0x1b1b1f); if (n > 1) block(x + 0.8, 0, z, 0.95, 0.3, 0.95, 0x25252b);
  }
  // Kendaraan (bisa dikendarai di game; solid saat diparkir)
  const vehicles = [];
  for (let i = 0, made = 0; i < 300 && made < 12; i++) {
    const x = rand(-90, 90), z = rand(-90, 90), ax = rng() < 0.5, truck = made % 3 === 2, len = truck ? 7 : 4.6, wid = truck ? 2.5 : 2;
    if (!free(x, z, ax ? len : wid, ax ? wid : len, 1.5)) continue;
    reserve(x, z, ax ? len : wid, ax ? wid : len);
    const v = { id: 'v' + made, x, z, yaw: ax ? Math.PI / 2 : 0, truck, len, wid, color: pick([0xb23b3b, 0x2f6fb2, 0xc9a227, 0xe5e7eb, 0x3c9440]) };
    v.solid = vehicleSolid(v); solids.push(v.solid); vehicles.push(v); made++;
  }
  // Tembok batas
  for (const s of [-1, 1]) { block(s * (HALF + 0.5), 0, 0, 1, 3, HALF * 2 + 2, 0x4a5568); block(0, 0, s * (HALF + 0.5), HALF * 2 + 2, 3, 1, 0x4a5568); }

  return { solids, buildings, visuals, vehicles, loot: makeLoot(spots, rng), spawnRng: rng };
}

function makeLoot(spots, rng) {
  const pick = (l) => l[Math.floor(rng() * l.length)];
  const loot = [];
  const push = (data, x, y, z) => loot.push({ id: `l${loot.length}`, ...data, x, y, z });
  const guns = Object.keys(WEAPONS).filter((w) => w !== 'fist');
  const place = ([x, y, z], indoor = false) => {
    const q = rng();
    if (indoor && q < 0.07) return push({ type: 'scope', key: rng() < 0.35 ? 4 : 3 }, x, y, z);
    if (q < 0.17) return push({ type: 'med', key: rng() < 0.2 ? 'super' : 'medkit' }, x, y, z);
    const r = rng();
    if (r < 0.5) {
      const key = r < 0.025 ? 'awm' : r < 0.04 ? 'kar98' : pick(guns.filter((g) => g !== 'awm' && g !== 'kar98'));
      const ammo = WEAPONS[key].ammo;
      push({ type: 'weapon', key, mag: WEAPONS[key].mag }, x, y, z);
      push({ type: 'ammo', key: ammo, n: AMMO[ammo].pack }, x + 0.7, y, z + 0.4);
    } else if (r < 0.72) {
      const t = rng();
      push({ type: 'armor', key: rng() < 0.5 ? 'h' : 'v', tier: t < 0.55 ? 1 : t < 0.87 ? 2 : 3 }, x, y, z);
    } else { const key = pick(Object.keys(AMMO)); push({ type: 'ammo', key, n: AMMO[key].pack }, x, y, z); }
  };
  spots.forEach((s) => place(s, true));
  for (let i = 0; i < 70; i++) place([-90 + rng() * 180, 0.1, -90 + rng() * 180]);
  return loot;
}

/** Gabungkan semua kotak peta menjadi satu mesh (satu draw call, 60 FPS). */
export function buildWorldMesh(visuals) {
  const unit = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const P = unit.attributes.position.array, N = unit.attributes.normal.array, count = P.length / 3;
  const pos = new Float32Array(visuals.length * P.length), nor = new Float32Array(pos.length), col = new Float32Array(pos.length);
  const c = new THREE.Color();
  visuals.forEach(([x, y, z, w, h, d, color], b) => {
    c.set(color);
    for (let i = 0; i < count; i++) {
      const o = (b * count + i) * 3, j = i * 3;
      pos[o] = x + P[j] * w; pos[o + 1] = y + P[j + 1] * h; pos[o + 2] = z + P[j + 2] * d;
      nor[o] = N[j]; nor[o + 1] = N[j + 1]; nor[o + 2] = N[j + 2];
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  unit.dispose();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
}

// ---------- Fisika ----------
const R = 0.38;
const overlaps = (s, x, y, z, h) => x + R > s.x0 && x - R < s.x1 && z + R > s.z0 && z - R < s.z1 && y + h > s.y0 + 0.001 && y < s.y1 - 0.001;
export const blocked = (w, x, y, z, h) => w.solids.some((s) => overlaps(s, x, y, z, h));

/** Tinggi pijakan tertinggi di bawah ketinggian y. */
export function floorAt(w, x, z, y) {
  let f = 0;
  for (const s of w.solids) if (s.y1 <= y + 0.01 && s.y1 > f && x + R > s.x0 && x - R < s.x1 && z + R > s.z0 && z - R < s.z1) f = s.y1;
  return f;
}

/** Gerakkan aktor: geser di dinding, naik anak tangga, gravitasi. */
export function moveBody(w, a, dx, dz, dt, h) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.25));
  let moved = 0;
  for (let i = 0; i < steps; i++) {
    for (const [mx, mz] of [[dx / steps, 0], [0, dz / steps]]) {
      if (!mx && !mz) continue;
      const nx = Math.max(-HALF + R, Math.min(HALF - R, a.x + mx)), nz = Math.max(-HALF + R, Math.min(HALF - R, a.z + mz));
      const hit = w.solids.filter((s) => overlaps(s, nx, a.y, nz, h));
      if (!hit.length) { moved += Math.abs(nx - a.x) + Math.abs(nz - a.z); a.x = nx; a.z = nz; continue; }
      const top = Math.max(...hit.map((s) => s.y1));
      if (top - a.y <= 0.55 && a.vy <= 0.1 && !blocked(w, nx, top, nz, h)) { a.x = nx; a.z = nz; a.y = top; moved += Math.abs(mx) + Math.abs(mz); }
    }
  }
  a.vy -= 22 * dt;
  const ny = a.y + a.vy * dt;
  if (a.vy <= 0) {
    const f = floorAt(w, a.x, a.z, a.y);
    if (ny <= f) { a.y = f; a.vy = 0; a.grounded = true; } else { a.y = ny; a.grounded = false; }
  } else if (blocked(w, a.x, ny, a.z, h)) a.vy = 0;
  else { a.y = ny; a.grounded = false; }
  return moved;
}

/** Jarak sinar ke kotak (metode slab). Infinity bila meleset. */
export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let t0 = 0, t1 = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) return Infinity; continue; }
    let a = (lo - o) / d, c = (hi - o) / d;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

export function rayWorld(w, o, d, max) {
  let best = max;
  for (const s of w.solids) { const t = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, s); if (t < best) best = t; }
  if (d.y < 0) { const t = -o.y / d.y; if (t >= 0 && t < best) best = t; }
  return best;
}
