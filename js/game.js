// Gameplay Battle Royale: pesawat, parasut, looting, tembak-menembak, bot, zona, dan HUD.
import * as THREE from 'three';
import { WEAPONS, AMMO, ARMOR, SKINS, CHARACTERS, MEDS } from '../shared/catalog.js';
import { createCharacter, createGun, createChute, box } from './character.js';
import { generateWorld, buildWorldMesh, moveBody, blocked, floorAt, rayBox, rayWorld, seeded, vehicleSolid, HALF } from './world.js';
import { settings } from './settings.js';
import { sfx } from './audio.js';
import { icon } from './icons.js';
import { $, esc, toast, openModal } from './ui.js';

const PLANE_TIME = 20, PLANE_Y = 62;
const HEIGHT = { stand: 1.95, crouch: 1.4, prone: 0.6 };
const AMMO_COLOR = { '12g': 0xef4444, '9mm': 0xfbbf24, '5.56': 0x22c55e, '7.62': 0x3b82f6 };
// [detik, radius, damage per detik]
const ZONES = {
  br: [[0, 145, 1], [45, 145, 2], [75, 70, 2], [100, 70, 4], [125, 36, 4], [150, 36, 7], [175, 15, 7], [200, 15, 10], [235, 1, 14]],
  clash: [[0, 48, 2], [25, 48, 3], [60, 22, 5], [80, 22, 7], [115, 1, 12]],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

let renderer;

export function startGame(match, profile, onEnd) {
  const { mode, net } = match;
  const training = mode === 'training';
  const social = mode === 'social';
  const canvas = $('#view');
  renderer ||= new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.6, devicePixelRatio));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0f0);
  scene.fog = new THREE.Fog(0x8fd0f0, 70, 230);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4b6b3a, 1.9));
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.7); sun.position.set(40, 80, 25); scene.add(sun);

  const world = generateWorld(match.seed);
  const worldMesh = buildWorldMesh(world.visuals); scene.add(worldMesh);
  const rng = seeded(match.seed ^ 0x2545f491);

  const ac = new AbortController(), on = (el, ev, fn, opt = {}) => el.addEventListener(ev, fn, { ...opt, signal: ac.signal });
  const myId = net ? net.uid : 'me';
  let ended = false, raf = 0, clock = 0, last = performance.now(), lead = 0;
  const startAt = match.startAt;
  const localStart = performance.now() + (startAt ? Math.max(0, startAt - match.now()) : 600);

  // ---------- Pesawat & zona ----------
  const angle = rng() * Math.PI * 2;
  const pathFrom = V(Math.cos(angle) * 92, PLANE_Y, Math.sin(angle) * 92);
  const pathTo = V(-pathFrom.x, PLANE_Y, -pathFrom.z);
  const plane = new THREE.Group();
  box(plane, 0, 0, 0, 3, 2.6, 12, 0xd8dee9); box(plane, 0, 0.2, 0.5, 18, 0.35, 2.6, 0x7c8797); box(plane, 0, 2.2, -5, 0.35, 2.4, 2, 0xef4444);
  box(plane, 0, 0.3, -5.2, 6, 0.25, 1.4, 0x7c8797); box(plane, 0, 0.5, 6.1, 2.2, 1.1, 0.5, 0x38506b);
  const props = [-6, -3, 3, 6].map((x) => box(plane, x, 0.1, 2.1, 2, 0.18, 0.1, 0x222228));
  plane.rotation.y = Math.atan2(pathTo.x - pathFrom.x, pathTo.z - pathFrom.z);
  plane.visible = mode === 'br'; scene.add(plane);
  const planePos = () => pathFrom.clone().lerp(pathTo, clamp(clock / PLANE_TIME, 0, 1.4));

  const zoneCenter = mode === 'clash' ? { x: 0, z: 0 } : { x: (rng() - 0.5) * 80, z: (rng() - 0.5) * 80 };
  const zone = { x: 0, z: 0, r: 160, dps: 0, next: 0 };
  const zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 40, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  zoneMesh.visible = !training && !social; scene.add(zoneMesh);
  function updateZone() {
    if (training || social) return;
    const k = ZONES[mode];
    let i = 0; while (i < k.length - 1 && clock >= k[i + 1][0]) i++;
    const a = k[i], b = k[i + 1] || a;
    const f = b === a ? 0 : (clock - a[0]) / (b[0] - a[0]);
    zone.r = a[1] + (b[1] - a[1]) * clamp(f, 0, 1); zone.dps = a[2]; zone.next = Math.max(0, b[0] - clock); zone.shrinking = b[1] < a[1];
    const shift = clamp((k[0][1] - zone.r) / k[0][1], 0, 1);
    zone.x = zoneCenter.x * shift; zone.z = zoneCenter.z * shift;
    zoneMesh.position.set(zone.x, 18, zone.z); zoneMesh.scale.set(zone.r, 1, zone.r);
  }

  // ---------- Aktor ----------
  const actors = new Map();
  function addActor(info, index) {
    const ch = createCharacter(info.equipped);
    scene.add(ch.root);
    const a = {
      id: info.id, name: info.name, rank: info.rank, isBot: !!info.bot, isMe: !!info.me, skins: info.weaponSkins || {}, evo: info.evo || {},
      ch, x: 0, y: 0, z: 0, vy: 0, yaw: 0, hp: 100, mana: 100, armor: { h: 0, v: 0 }, weapons: [null, null], slot: 2,
      alive: true, stance: 'stand', phase: 'plane', speed: 0, dmgBy: new Map(), lastHurt: -99, grounded: false, chute: null, punch: 0, seen: false,
      jumpAt: 2.5 + rng() * (PLANE_TIME - 4), brain: { think: rng(), target: null, since: 0, dir: rng() * 6.28, cool: 1, stuck: 0, goal: null, landed: 0 },
    };
    if (mode !== 'br') {
      a.phase = 'ground';
      const spawnAngle = (index / match.total) * Math.PI * 2;
      const rad = mode === 'clash' ? 30 : index ? 14 + index * 3 : 0;
      a.x = Math.cos(spawnAngle) * rad; a.z = training && !index ? 0 : Math.sin(spawnAngle) * rad;
      if (training && index) { a.x = -18 + index * 5; a.z = 24 + (index % 2) * 8; a.yaw = Math.PI; }
      while (blocked(world, a.x, a.y, a.z, 2)) a.x += 0.7;
      if (mode === 'clash') giveGun(a, ['ak47', 'mp40', 'm4a1', 'm1887', 'scar'][Math.floor(rng() * 5)]);
    }
    actors.set(a.id, a);
    return a;
  }
  function giveGun(a, key) {
    a.weapons[0] = { key, mag: WEAPONS[key].mag }; a.slot = 0;
    if (a.isMe) ammo[WEAPONS[key].ammo] += AMMO[WEAPONS[key].ammo].pack * 2;
  }
  const ammo = Object.fromEntries(Object.keys(AMMO).map((k) => [k, 0]));
  match.roster.forEach(addActor);
  const me = actors.get(myId);
  const alive = () => [...actors.values()].filter((a) => a.alive);
  const chr = CHARACTERS[profile.char] || CHARACTERS.c_adam;
  const meds = { medkit: 0, super: 0 }, nets = [], EMOTES = ['wave', 'laugh', 'angry', 'sit'];
  let healRate = 12, scopeLv = 0, scopeBest = 2, skillCd = 0, shieldT = 0, sprintT = 0, drive = null, nearV = null, emote = null, emoteI = -1;
  const vehicles = (world.vehicles || []).map((v) => {
    const g = new THREE.Group(), c = v.color;
    if (v.truck) {
      box(g, 0, 0.7, 0, 2.4, 0.7, 7, 0x333842); box(g, 0, 1.8, -1, 2.4, 2.2, 4.6, 0xe5e7eb); box(g, 0, 1.5, 2.9, 2.3, 1.4, 1.5, c); box(g, 0, 1.7, 3.66, 1.9, 0.6, 0.1, 0x9fc7d9);
      for (const z of [-2.4, 1, 2.8]) for (const x of [-1.2, 1.2]) box(g, x, 0.45, z, 0.35, 0.9, 0.9, 0x17171a);
    } else {
      box(g, 0, 0.6, 0, 1.9, 0.6, 4.4, c); box(g, 0, 1.2, 0.9, 1.8, 0.8, 1.8, c); box(g, 0, 1.3, 1.82, 1.5, 0.5, 0.1, 0x9fc7d9); box(g, 0, 1.15, -1.1, 1.8, 0.4, 2, 0x2a2a30);
      for (const z of [-1.4, 1.4]) for (const x of [-0.95, 0.95]) box(g, x, 0.4, z, 0.3, 0.8, 0.8, 0x17171a);
      for (const x of [-0.6, 0.6]) box(g, x, 0.7, 2.22, 0.3, 0.2, 0.05, 0xfde68a, true);
    }
    scene.add(g); return Object.assign(v, { mesh: g, speed: 0 });
  });
  const owns = (a) => a.isMe || (a.isBot && (!net || net.isHost()));

  // ---------- Loot ----------
  const loot = new Map();
  function addLoot(item) {
    if (loot.has(item.id)) return;
    const g = new THREE.Group();
    g.position.set(item.x, item.y, item.z);
    if (item.type === 'weapon') {
      const gun = createGun(item.key); gun.rotation.x = Math.PI / 2; gun.position.set(0, 0.45, 0.5); g.add(gun);
      box(g, 0, 0.03, 0, 0.9, 0.04, 0.9, 0xffffff, true);
    } else if (item.type === 'ammo') {
      box(g, 0, 0.22, 0, 0.42, 0.34, 0.3, 0x3a3f2a); box(g, 0, 0.42, 0, 0.44, 0.08, 0.32, AMMO_COLOR[item.key], true);
    } else if (item.type === 'med') {
      const c = item.key === 'super' ? 0xfbbf24 : 0xffffff;
      box(g, 0, 0.22, 0, 0.55, 0.38, 0.4, c); box(g, 0, 0.25, 0.21, 0.32, 0.1, 0.02, 0xdc2626, true); box(g, 0, 0.25, 0.21, 0.1, 0.32, 0.02, 0xdc2626, true);
    } else if (item.type === 'scope') {
      box(g, 0, 0.3, 0, 0.18, 0.18, 0.6, 0x111118); box(g, 0, 0.3, 0.32, 0.22, 0.22, 0.05, item.key === 4 ? 0xf0abfc : 0x22d3ee, true); box(g, 0, 0.03, 0, 0.9, 0.04, 0.9, 0xffffff, true);
    } else if (item.key === 'h') {
      box(g, 0, 0.36, 0, 0.5, 0.28, 0.5, ARMOR[item.tier].color); box(g, 0, 0.19, 0.26, 0.5, 0.07, 0.12, ARMOR[item.tier].color);
    } else {
      box(g, 0, 0.4, 0, 0.62, 0.56, 0.26, ARMOR[item.tier].color); box(g, 0, 0.35, 0.15, 0.36, 0.16, 0.05, 0x1f2937);
    }
    scene.add(g); loot.set(item.id, { ...item, mesh: g });
  }
  if (training) {
    Object.keys(WEAPONS).filter((k) => k !== 'fist').forEach((key, i) => addLoot({ id: `t${i}`, type: 'weapon', key, mag: WEAPONS[key].mag, x: -12 + i * 3, y: 0.1, z: 7 }));
    Object.keys(AMMO).forEach((k) => { ammo[k] = 999; });
    ['h', 'v'].forEach((key, s) => [1, 2, 3].forEach((tier) => addLoot({ id: `a${key}${tier}`, type: 'armor', key, tier, x: (s ? 4 : -8) + tier * 2, y: 0.1, z: -7 })));
    addLoot({ id: 'tm1', type: 'med', key: 'medkit', x: 8, y: 0.1, z: 7 }); addLoot({ id: 'tm2', type: 'med', key: 'super', x: 10, y: 0.1, z: 7 });
    addLoot({ id: 'ts3', type: 'scope', key: 3, x: 12, y: 0.1, z: 7 }); addLoot({ id: 'ts4', type: 'scope', key: 4, x: 14, y: 0.1, z: 7 });
  } else if (!social) world.loot.forEach(addLoot);
  function removeLoot(id) { const l = loot.get(id); if (l) { scene.remove(l.mesh); loot.delete(id); } }

  const lootName = (l) => l.type === 'med' ? MEDS[l.key].name : l.type === 'scope' ? `Scope x${l.key}` : l.type === 'weapon' ? WEAPONS[l.key].name : l.type === 'ammo' ? `${AMMO[l.key].name} x${l.n}` : `${ARMOR[l.tier].name} ${l.key === 'h' ? 'Helmet' : 'Vest'}`;
  let dropSeq = 0;
  function dropItem(data, a) {
    const item = { ...data, id: `d${String(myId).slice(0, 8)}${Date.now().toString(36)}${dropSeq++}`, manual: true,
      x: clamp(a.x + Math.sin(a.yaw) * 1.1 + (Math.random() - 0.5), -HALF + 1, HALF - 1), z: clamp(a.z + Math.cos(a.yaw) * 1.1 + (Math.random() - 0.5), -HALF + 1, HALF - 1), y: 0 };
    item.y = floorAt(world, item.x, item.z, a.y + 0.6) + 0.05;
    addLoot(item); net?.drop(item);
  }

  let pickable = null, picking = false;
  async function pickup(l) {
    if (picking) return;
    picking = true;
    const ok = !net || training || (await net.take(l.id));
    picking = false;
    if (!loot.has(l.id) || ended || !me.alive) return;
    if (!training) removeLoot(l.id);
    if (!ok) return;
    if (l.type === 'ammo') ammo[l.key] += l.n;
    else if (l.type === 'med') meds[l.key] += 1;
    else if (l.type === 'scope') { scopeBest = Math.max(scopeBest, l.key); toast(`Scope x${l.key} didapat! Tekan tombol Scope`); }
    else if (l.type === 'armor') {
      if (me.armor[l.key] && !training) dropItem({ type: 'armor', key: l.key, tier: me.armor[l.key] }, me);
      me.armor[l.key] = l.tier;
    } else {
      let s = me.weapons.indexOf(null);
      if (s < 0) { s = me.slot < 2 ? me.slot : 0; if (!training) dropItem({ type: 'weapon', ...me.weapons[s] }, me); }
      me.weapons[s] = { key: l.key, mag: l.mag };
      if (me.slot === 2 || me.slot === s) me.slot = s;
      reloading = 0;
    }
    sfx.pickup(); feed(`Mengambil ${lootName(l)}`); hudKey = '';
    if (!$('#inventory').hidden) renderInventory();
  }
  function scanLoot() {
    pickable = null;
    if (!me.alive || me.phase !== 'ground') return;
    let best = 2.1;
    for (const l of loot.values()) {
      const d = dist2(l, me);
      if (d > 2.1 || Math.abs(l.y - me.y) > 1.4) continue;
      const auto = !l.manual && (l.type === 'ammo' || l.type === 'med' || l.type === 'scope' || (l.type === 'armor' && l.tier > me.armor[l.key]) || (l.type === 'weapon' && me.weapons.includes(null) && !me.weapons.some((w) => w?.key === l.key)));
      if (auto && d < 1.4) { pickup(l); return; }
      if (d < best && !(training && l.type === 'weapon' && me.weapons.some((w) => w?.key === l.key))) { best = d; pickable = l; }
    }
  }

  // ---------- Efek (object pool) ----------
  const pool = (n, make) => { const list = Array.from({ length: n }, make); let i = 0; return { list, next: () => list[i++ % n] }; };
  const fxMesh = (color) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color })); m.visible = false; scene.add(m); return { m, life: 0, v: V() }; };
  const tracers = pool(60, () => fxMesh(0xfff0a0));
  const parts = pool(160, () => fxMesh(0xffffff));
  function tracer(from, to, color = 0xfff0a0) {
    const t = tracers.next(), len = from.distanceTo(to);
    t.m.material.color.setHex(color); t.m.position.copy(from).lerp(to, 0.5); t.m.scale.set(0.035, 0.035, len); t.m.lookAt(to); t.m.visible = true; t.life = 0.07;
  }
  function burst(p, color, n = 6, size = 0.12, force = 3) {
    for (let i = 0; i < n; i++) {
      const q = parts.next();
      q.m.material.color.setHex(color); q.m.position.copy(p); q.m.scale.setScalar(size); q.m.visible = true; q.life = 0.35 + Math.random() * 0.25;
      q.v.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(force);
    }
  }

  // ---------- Pertempuran ----------
  const stats = { kills: 0, assists: 0, damage: 0 };
  const markers = new Map();
  const current = (a) => (a.slot < 2 && a.weapons[a.slot] ? a.weapons[a.slot] : { key: 'fist', mag: 0 });
  const hitbox = (a) => {
    const r = a.stance === 'prone' ? 0.75 : 0.46;
    return { x0: a.x - r, x1: a.x + r, y0: a.y, y1: a.y + HEIGHT[a.stance], z0: a.z - r, z1: a.z + r };
  };
  function nearestHit(shooter, o, d, max) {
    let t = rayWorld(world, o, d, max), target = null;
    for (const a of actors.values()) {
      if (a === shooter || !a.alive || a.phase !== 'ground') continue;
      const h = rayBox(o.x, o.y, o.z, d.x, d.y, d.z, hitbox(a));
      if (h < t) { t = h; target = a; }
    }
    return { t, target };
  }

  function damage(target, amount, from, head) {
    if (!target.alive || ended) return;
    if ((training || social) && target.isMe) return;
    if (social) return;
    const cut = ARMOR[head ? target.armor.h : target.armor.v]?.cut || 0;
    const real = Math.min(target.hp, amount * (1 - cut) * (target.isMe && shieldT > 0 ? 0.4 : 1));
    if (from?.isMe) { stats.damage += real; hitMark(); }
    if (!owns(target)) { net?.event({ k: 'hit', to: target.id, from: from?.id || '', d: amount, h: head ? 1 : 0 }); return; }
    target.hp -= real; target.lastHurt = clock;
    if (from) { target.dmgBy.set(from.id, clock); if (target.isBot) { target.brain.target = from; target.brain.since = clock - 0.4; } }
    if (target.isMe) { flash = 0.8; sfx.hurt(); }
    if (target.hp <= 0.01) die(target, from);
  }

  function die(victim, killer) {
    const assists = [...victim.dmgBy].filter(([id, t]) => id !== killer?.id && clock - t < 20).map(([id]) => id);
    net?.event({ k: 'kill', v: victim.id, killer: killer?.id || '', as: assists });
    if (!training) {
      // Jatuhkan isi tas
      for (const w of victim.weapons) if (w) { dropItem({ type: 'weapon', ...w }, victim); const t = WEAPONS[w.key].ammo; dropItem({ type: 'ammo', key: t, n: AMMO[t].pack }, victim); }
      for (const k of ['h', 'v']) if (victim.armor[k]) dropItem({ type: 'armor', key: k, tier: victim.armor[k] }, victim);
    }
    applyDeath(victim, killer, assists);
  }

  function applyDeath(victim, killer, assists = []) {
    if (!victim.alive) return;
    victim.alive = false; victim.hp = 0; victim.diedAt = clock;
    if (victim.chute) { scene.remove(victim.chute); victim.chute = null; }
    if (killer?.isMe) {
      stats.kills++; sfx.reward();
      const w = current(me), s = SKINS[me.skins[w.key]];
      if (s?.evo && me.evo[s.id] >= 7) burst(V(victim.x, victim.y + 1, victim.z), s.accent, 40, 0.22, 8);
    } else if (assists.includes(myId)) stats.assists++;
    if (!training) feed(killer ? `${killer.name} mengalahkan ${victim.name}` : `${victim.name} gugur`);
    if (victim.isMe) finish(false);
    else if (!training && !social && me.alive && alive().length === 1) finish(true);
  }

  function finish(win) {
    if (ended) return;
    ended = true;
    const placement = win ? 1 : Math.min(match.total, alive().filter((a) => !a.isMe).length + 1);
    const result = { mode, total: match.total, kills: stats.kills, assists: stats.assists, damage: Math.round(stats.damage), survival: Math.round(clock), placement, win };
    const text = $('#prompt'); text.textContent = training || social ? '' : win ? 'BOOYAH! Kamu yang terakhir bertahan' : 'Kamu gugur';
    setTimeout(() => { cleanup(); onEnd(result); }, training || social ? 100 : 1800);
  }

  // Satu tembakan dari aktor mana pun
  function fire(a, aim, accuracy = null) {
    const w = current(a), spec = WEAPONS[w.key];
    const origin = V(a.x, a.y + HEIGHT[a.stance] * 0.72, a.z);
    a.yaw = a.isMe ? cam.yaw : Math.atan2(aim.x - a.x, aim.z - a.z);
    if (w.key === 'fist') {
      a.punch = 1; sfx.shot('Fist', dist2(a, me));
      for (const t of actors.values()) {
        if (t === a || !t.alive || t.phase !== 'ground' || dist2(a, t) > spec.range || Math.abs(t.y - a.y) > 1.5) continue;
        const facing = Math.sin(a.yaw) * (t.x - a.x) + Math.cos(a.yaw) * (t.z - a.z);
        if (facing > 0) { damage(t, spec.dmg, a, false); burst(V(t.x, t.y + 1.3, t.z), 0xffffff, 4); break; }
      }
      return;
    }
    const skin = SKINS[a.skins[w.key]], level = skin?.evo ? a.evo[skin.id] || 1 : 0;
    const color = level >= 3 ? skin.accent : 0xfff0a0;
    const muzzle = origin.clone().add(V(Math.sin(a.yaw) * 0.9 - Math.cos(a.yaw) * 0.35, 0, Math.cos(a.yaw) * 0.9 + Math.sin(a.yaw) * 0.35));
    const base = aim.clone().sub(origin).normalize();
    const spread = spec.spread * (a.stance === 'prone' ? 0.45 : a.stance === 'crouch' ? 0.7 : 1) * (a.speed > 0.3 ? 1.35 : 1);
    let end = origin;
    for (let i = 0; i < spec.pellets; i++) {
      const d = base.clone().add(V((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2)).normalize();
      let { t, target } = nearestHit(a, origin, d, spec.range);
      if (accuracy != null && target && Math.random() > accuracy) { target = null; d.x += (Math.random() - 0.5) * 0.16; d.z += (Math.random() - 0.5) * 0.16; d.normalize(); t = rayWorld(world, origin, d, spec.range); }
      end = origin.clone().addScaledVector(d, t);
      tracer(muzzle, end, color);
      if (target) {
        const head = target.stance !== 'prone' && end.y > target.y + HEIGHT[target.stance] - 0.5;
        const falloff = t > spec.range * 0.6 ? 0.7 : 1;
        const botScale = a.isBot ? 0.42 + a.rank * 0.04 : 1;
        damage(target, spec.dmg * falloff * (head ? 1.6 : 1) * botScale, a, head);
        burst(end, level >= 5 ? skin.accent : 0xef4444, level >= 5 ? 8 : 4);
      } else if (t < spec.range) burst(end, 0xcfc4a8, 2, 0.08, 2);
    }
    if (level >= 4) burst(muzzle, skin.accent, 5, 0.1, 2);
    sfx.shot(spec.cat, a.isMe ? 0 : dist2(a, me), w.key);
    if (!a.isMe && dist2(a, me) < 90) markers.set(a.id, { x: a.x, z: a.z, t: clock });
    net?.event({ k: 'shot', from: a.id, o: [muzzle.x, muzzle.y, muzzle.z], e: [end.x, end.y, end.z], w: w.key, c: color });
  }

  // ---------- Pemain ----------
  const cam = { yaw: Math.atan2(pathTo.x - pathFrom.x, pathTo.z - pathFrom.z), pitch: -0.45 };
  if (mode !== 'br') { cam.yaw = training ? 0 : Math.atan2(-me.x, -me.z); cam.pitch = -0.12; me.yaw = cam.yaw; }
  const input = { x: 0, y: 0, jx: 0, jy: 0, fire: false, keys: new Set() };
  let cooldown = 0, reloading = 0, dash = 0, healing = 0, flash = 0, hitTimer = 0, quitArm = 0;

  function aimPoint() {
    const d = V(); camera.getWorldDirection(d);
    // Mulai sinar dari depan karakter agar benda di belakang pemain tidak ikut kena
    const skip = camera.position.distanceTo(V(me.x, me.y + 1.5, me.z));
    const o = camera.position.clone().addScaledVector(d, skip);
    const { t } = nearestHit(me, o, d, 200);
    return o.addScaledVector(d, t);
  }
  function reload() {
    const w = current(me), spec = WEAPONS[w.key];
    if (!me.alive || reloading || !spec.ammo || w.mag >= spec.mag) return;
    if (!ammo[spec.ammo]) return toast(`Peluru ${AMMO[spec.ammo].name} habis`);
    reloading = spec.reload; sfx.reload();
  }
  function tryFire() {
    if (social || cooldown > 0 || reloading || me.phase !== 'ground' || !me.alive || !$('#inventory').hidden) return;
    const w = current(me), spec = WEAPONS[w.key];
    if (spec.ammo && w.mag <= 0) { cooldown = 0.4; if (ammo[spec.ammo]) reload(); else toast('Tidak ada peluru. Cari ammo atau pakai tinju'); return; }
    cooldown = spec.rate;
    fire(me, aimPoint());
    if (spec.ammo) { w.mag = Math.max(0, w.mag - spec.perShot); if (!w.mag && ammo[spec.ammo]) reload(); }
    cam.pitch = Math.min(0.9, cam.pitch + (spec.cat === 'Sniper' ? 0.03 : spec.ammo ? 0.004 : 0));
  }
  const selectSlot = (s) => { if (me.slot !== s) { me.slot = s; reloading = 0; cooldown = 0.25; hudKey = ''; } };
  function jump() {
    if (me.phase === 'plane') return leavePlane(me);
    if (me.phase !== 'ground' || !me.alive) return;
    if (me.stance !== 'stand') return setStance('stand');
    if (me.grounded) { me.vy = 7.6; me.grounded = false; }
  }
  function setStance(s) {
    if (me.phase !== 'ground') return;
    const next = me.stance === s ? 'stand' : s;
    if (HEIGHT[next] > HEIGHT[me.stance] && blocked(world, me.x, me.y, me.z, HEIGHT[next])) return toast('Tidak ada ruang untuk berdiri');
    me.stance = next;
  }
  function useDash() { if (me.phase === 'ground' && me.mana >= 25 && dash <= 0) { me.mana -= 25; dash = 0.28; } else if (me.mana < 25) toast('Mana kurang'); }
  function useHeal() {
    if (me.phase !== 'ground' || healing > 0) return;
    if (me.hp >= 100) return toast('HP penuh');
    const kind = meds.medkit > 0 ? 'medkit' : meds.super > 0 ? 'super' : null;
    if (!kind) return toast('Tidak punya Medkit. Cari di rumah!');
    meds[kind]--; healing = MEDS[kind].time; healRate = MEDS[kind].hp / MEDS[kind].time; sfx.pickup(); toast(`Memakai ${MEDS[kind].name}...`);
  }
  // ----- Skill karakter, scope, kendaraan, emote -----
  function useSkill() {
    if (!chr.skill) return toast('Adam tidak punya skill. Beli karakter di menu Karakter');
    if (me.phase !== 'ground' || !me.alive || social) return;
    if (skillCd > 0) return toast(`Skill siap ${Math.ceil(skillCd)} detik lagi`);
    if (me.mana < chr.mana) return toast(`Mana kurang (butuh ${chr.mana})`);
    me.mana -= chr.mana; skillCd = chr.cd; sfx.reward();
    if (chr.skill === 'net') {
      const x = me.x + Math.sin(me.yaw) * 6, z = me.z + Math.cos(me.yaw) * 6, g = new THREE.Group(); g.position.set(x, 0.08, z);
      for (let i = -3; i <= 3; i++) { box(g, i, 0, 0, 0.06, 0.06, 7, 0xffffff, true); box(g, 0, 0, i, 7, 0.06, 0.06, 0xffffff, true); }
      scene.add(g); nets.push({ x, z, r: 4, t: 6, mesh: g });
    } else if (chr.skill === 'heal') { me.hp = Math.min(100, me.hp + 40); burst(V(me.x, me.y + 1, me.z), 0x4ade80, 14, 0.14, 3); }
    else if (chr.skill === 'sprint') sprintT = 5;
    else if (chr.skill === 'shield') { shieldT = 6; burst(V(me.x, me.y + 1, me.z), 0x60a5fa, 14, 0.14, 3); }
    else if (chr.skill === 'shock') {
      for (const a of actors.values()) if (a !== me && a.alive && dist2(a, me) < 9 && (a.isBot || !net)) damage(a, 30, me, false);
      burst(V(me.x, me.y + 0.5, me.z), 0xfde047, 30, 0.2, 7);
    }
    toast(chr.skillName);
  }
  const cycleScope = () => { if (me.phase === 'ground') scopeLv = scopeLv >= scopeBest - 1 ? 0 : scopeLv + 1; };
  const cycleEmote = () => { if (me.phase !== 'ground') return; emoteI = (emoteI + 1) % EMOTES.length; emote = EMOTES[emoteI]; };
  function toggleCar() {
    if (me.phase === 'car') {
      const v = drive;
      let ox = v.x + Math.cos(v.yaw) * 3, oz = v.z - Math.sin(v.yaw) * 3;
      if (blocked(world, ox, 0, oz, 2)) { ox = v.x - Math.cos(v.yaw) * 3; oz = v.z + Math.sin(v.yaw) * 3; }
      v.speed = 0; v.solid = vehicleSolid(v); world.solids.push(v.solid);
      me.x = ox; me.z = oz; me.y = floorAt(world, ox, oz, 1); me.phase = 'ground'; drive = null; return;
    }
    if (me.phase !== 'ground' || !nearV) return;
    if (net) return toast('Kendaraan hanya bisa dikendarai di mode offline');
    drive = nearV; const i = world.solids.indexOf(drive.solid); if (i >= 0) world.solids.splice(i, 1);
    me.phase = 'car'; me.stance = 'stand'; scopeLv = 0; cam.yaw = drive.yaw;
    toast('Joystick: gas dan belok. Tekan Turun untuk keluar');
  }
  function stepCar(dt, ix, iy) {
    const v = drive, max = v.truck ? 11 : 16, acc = v.truck ? 9 : 13;
    v.speed = iy ? clamp(v.speed + iy * acc * dt, -6, max) : v.speed * (1 - Math.min(1, dt * 1.6));
    v.yaw -= ix * 1.7 * dt * clamp(v.speed / 5, -1, 1);
    const sx = Math.sin(v.yaw), sz = Math.cos(v.yaw), dir = v.speed < 0 ? -1 : 1, front = (v.truck ? 3.6 : 2.4) * dir;
    const nx = v.x + sx * v.speed * dt, nz = v.z + sz * v.speed * dt;
    if (Math.abs(nx) > HALF - 3 || Math.abs(nz) > HALF - 3 || blocked(world, nx, 0, nz, 1.2) || blocked(world, nx + sx * front, 0, nz + sz * front, 1.2)) v.speed *= -0.3;
    else { v.x = nx; v.z = nz; }
    me.x = v.x; me.z = v.z; me.y = 0; me.yaw = v.yaw; me.speed = Math.abs(v.speed) / max;
    if (Math.abs(v.speed) > 5) for (const a of actors.values()) {
      if (a === me || !a.alive || a.phase !== 'ground' || !(a.isBot || !net) || dist2(a, v) > (v.truck ? 3 : 2.4) || clock - (a.rammed ?? -9) < 0.8) continue;
      a.rammed = clock; damage(a, Math.abs(v.speed) * 3, me, false); burst(V(a.x, a.y + 1, a.z), 0xef4444, 8);
    }
    if (iy) cam.yaw += Math.atan2(Math.sin(v.yaw - cam.yaw), Math.cos(v.yaw - cam.yaw)) * Math.min(1, dt * 2);
  }
  function updateExtras(dt) {
    skillCd = Math.max(0, skillCd - dt); shieldT = Math.max(0, shieldT - dt); sprintT = Math.max(0, sprintT - dt);
    for (let i = nets.length - 1; i >= 0; i--) { const n = nets[i]; n.t -= dt; if (n.t <= 0) { scene.remove(n.mesh); nets.splice(i, 1); } }
    for (const a of actors.values()) a.slow = a !== me && nets.some((n) => dist2(n, a) < n.r) ? 0.35 : 1;
    for (const v of vehicles) { v.mesh.position.set(v.x, 0, v.z); v.mesh.rotation.y = v.yaw; }
    nearV = null;
    if (me.phase === 'ground') for (const v of vehicles) if (dist2(v, me) < (v.truck ? 5.5 : 4.5)) { nearV = v; break; }
    if (me.speed > 0.1 && emote) emote = null;
    if (me.phase !== 'ground' && scopeLv) scopeLv = 0;
  }
  function leavePlane(a) {
    if (a.phase !== 'plane' || clock < 1.5) return;
    const p = planePos();
    a.phase = 'fall'; a.x = clamp(p.x + (a.isMe ? 0 : (Math.random() - 0.5) * 6), -97, 97); a.z = clamp(p.z, -97, 97); a.y = p.y - 2; a.fallT = 0;
  }

  // ---------- Inventory ----------
  function renderInventory() {
    const rows = [];
    me.weapons.forEach((w, i) => { if (w) rows.push([`Slot ${i + 1}: ${WEAPONS[w.key].name} (${w.mag}/${WEAPONS[w.key].mag})`, `w${i}`]); });
    for (const [k, n] of [['h', 'Helmet'], ['v', 'Vest']]) if (me.armor[k]) rows.push([`${ARMOR[me.armor[k]].name} ${n} (-${ARMOR[me.armor[k]].cut * 100}% damage)`, `a${k}`]);
    for (const [k, n] of Object.entries(ammo)) if (n) rows.push([`${AMMO[k].name}: ${n}`, `m${k}`]);
    $('#inventory').innerHTML = `<div class="invhead"><h3>Inventory</h3><button class="btn ghost" data-close>Tutup</button></div>
      ${rows.map(([t, id]) => `<div class="invrow"><span>${esc(t)}</span><button class="btn" data-drop="${id}">Buang</button></div>`).join('') || '<p class="empty">Tas kosong.</p>'}`;
  }
  function toggleInventory(force) {
    const el = $('#inventory'), open = force ?? el.hidden;
    el.hidden = !open;
    if (open) { renderInventory(); input.fire = false; document.exitPointerLock?.(); }
  }
  on($('#inventory'), 'click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.close !== undefined) return toggleInventory(false);
    const id = b.dataset.drop, kind = id[0], k = id.slice(1);
    if (me.phase !== 'ground') return;
    if (kind === 'w') { dropItem({ type: 'weapon', ...me.weapons[k] }, me); me.weapons[k] = null; if (me.slot === Number(k)) selectSlot(2); reloading = 0; }
    if (kind === 'a') { dropItem({ type: 'armor', key: k, tier: me.armor[k] }, me); me.armor[k] = 0; }
    if (kind === 'm') { const n = Math.min(ammo[k], AMMO[k].pack); ammo[k] -= n; dropItem({ type: 'ammo', key: k, n }, me); }
    hudKey = ''; renderInventory();
  });

  // ---------- Kontrol ----------
  const tap = (sel, fn) => on($(sel), 'pointerdown', (e) => { e.preventDefault(); fn(); });
  tap('#bJump', jump); tap('#bJumpPlane', jump); tap('#bCrouch', () => setStance('crouch')); tap('#bProne', () => setStance('prone'));
  tap('#bBag', () => toggleInventory()); tap('#bReload', reload); tap('#bDash', useDash); tap('#bHeal', useHeal);
  tap('#bSkill', useSkill); tap('#bScope', cycleScope); tap('#bCar', toggleCar); tap('#bEmote', cycleEmote); tap('#bChat', () => openModal('chat'));
  tap('#bPickup', () => pickable && pickup(pickable));
  tap('#bQuit', () => {
    if (training || social) return finish(false);
    if (performance.now() - quitArm < 3000) return damage(me, 9999, null, false);
    quitArm = performance.now(); toast('Tekan sekali lagi untuk menyerah');
  });
  on($('#slots'), 'pointerdown', (e) => { const b = e.target.closest('button'); if (b) selectSlot(Number(b.dataset.slot)); });

  const rotate = (dx, dy, k) => { const z = camera.fov / 65; cam.yaw -= dx * k * z * settings.sensitivity; cam.pitch = clamp(cam.pitch - dy * k * z * settings.sensitivity, -1.2, 0.9); };
  // Drag layar (dan drag di tombol tembak) untuk memutar kamera
  function dragLook(el, isFire) {
    let id = null, px = 0, py = 0;
    on(el, 'pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'mouse' && !isFire) {
        if (document.pointerLockElement) { if (e.button === 0) input.fire = true; return; }
        try { el.requestPointerLock?.()?.catch?.(() => {}); } catch { /* tidak didukung */ }
      }
      id = e.pointerId; px = e.clientX; py = e.clientY; el.setPointerCapture(id);
      if (isFire) { input.fire = true; el.classList.add('on'); }
    });
    on(el, 'pointermove', (e) => { if (e.pointerId !== id || document.pointerLockElement) return; rotate(e.clientX - px, e.clientY - py, 0.006); px = e.clientX; py = e.clientY; });
    for (const ev of ['pointerup', 'pointercancel']) on(el, ev, (e) => { if (e.pointerId === id) { id = null; if (isFire) { input.fire = false; el.classList.remove('on'); } } });
  }
  dragLook($('#look'), false); dragLook($('#bFire'), true);
  on(document, 'mousemove', (e) => { if (document.pointerLockElement) rotate(e.movementX, e.movementY, 0.0025); });
  on(window, 'mouseup', () => { if (document.pointerLockElement) input.fire = false; });
  on(window, 'contextmenu', (e) => e.preventDefault());

  const joy = $('#joy'), knob = $('#knob');
  let joyId = null;
  const joyMove = (e) => {
    const r = joy.getBoundingClientRect(), max = r.width * 0.38;
    let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    const l = Math.hypot(dx, dy); if (l > max) { dx *= max / l; dy *= max / l; }
    input.jx = dx / max; input.jy = -dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const joyEnd = () => { joyId = null; input.jx = input.jy = 0; knob.style.transform = ''; };
  on(joy, 'pointerdown', (e) => { e.preventDefault(); joyId = e.pointerId; joy.setPointerCapture(joyId); joyMove(e); });
  on(joy, 'pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  on(joy, 'pointerup', joyEnd); on(joy, 'pointercancel', joyEnd);

  const KEYS = { Space: jump, ShiftLeft: jump, ShiftRight: jump, ControlLeft: () => setStance('crouch'), KeyC: () => setStance('crouch'), KeyZ: () => setStance('prone'), KeyR: reload, KeyF: () => pickable && pickup(pickable), KeyQ: useDash, KeyH: useHeal, KeyI: () => toggleInventory(), Tab: () => toggleInventory(), Digit1: () => selectSlot(0), Digit2: () => selectSlot(1), Digit3: () => selectSlot(2) };
  on(window, 'keydown', (e) => {
    if (e.code === 'Tab' || e.code === 'Space' || e.ctrlKey) e.preventDefault();
    if (e.target?.tagName === 'INPUT') return;
    input.keys.add(e.code);
    if (!e.repeat) KEYS[e.code]?.();
  });
  on(window, 'keyup', (e) => input.keys.delete(e.code));
  on(window, 'blur', () => { input.keys.clear(); input.fire = false; joyEnd(); });
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  on(window, 'resize', resize); resize();

  // ---------- Update aktor ----------
  function stepPlayer(dt) {
    const k = (c) => (input.keys.has(c) ? 1 : 0);
    let ix = input.jx + k('KeyD') - k('KeyA');
    let iy = input.jy + k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
    rotate((k('KeyE') + k('ArrowRight') - k('ArrowLeft')) * dt * 320, 0, 0.006);
    const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const mx = fx * iy - fz * ix, mz = fz * iy + fx * ix;
    me.yaw = cam.yaw; me.speed = Math.min(1, len);
    if (me.phase === 'car') return stepCar(dt, ix, iy);
    if (me.phase === 'fall') return stepFall(me, mx, mz, dt);
    if (me.phase !== 'ground') return;
    let sp = (me.stance === 'prone' ? 1.3 : me.stance === 'crouch' ? 2.8 : 5.8) * (sprintT > 0 ? 1.7 : 1);
    let vx = mx * sp, vz = mz * sp;
    if (dash > 0) { dash -= dt; const dl = Math.hypot(mx, mz); vx = (dl > 0.1 ? mx / dl : fx) * 20; vz = (dl > 0.1 ? mz / dl : fz) * 20; burst(V(me.x, me.y + 0.9, me.z), 0x22d3ee, 1, 0.18, 1); }
    moveBody(world, me, vx * dt, vz * dt, dt, HEIGHT[me.stance]);
  }
  function stepFall(a, mx, mz, dt) {
    a.fallT += dt;
    if (!a.chute && a.fallT > 0.8) { a.chute = createChute(a.ch.look.chute); scene.add(a.chute); }
    const nx = clamp(a.x + mx * 13 * dt, -98, 98), nz = clamp(a.z + mz * 13 * dt, -98, 98);
    const fy = a.y - (a.chute ? 9.5 : 18) * dt;
    if (!blocked(world, nx, fy, nz, 1.9)) { a.x = nx; a.z = nz; }
    const floor = floorAt(world, a.x, a.z, a.y + 0.05);
    a.y = Math.max(floor, fy);
    if (a.chute) { a.chute.position.set(a.x, a.y, a.z); a.chute.rotation.y = a.yaw; }
    if (a.y <= floor + 0.001) {
      a.phase = 'ground'; a.vy = 0; a.grounded = true; a.brain.landed = clock;
      if (a.chute) { scene.remove(a.chute); a.chute = null; }
      burst(V(a.x, a.y + 0.1, a.z), 0xd8c9a0, 10, 0.18, 3);
      if (a.isBot) {
        giveGun(a, ['m500', 'mp40', 'ak47', 'm4a1', 'm1887', 'scar', 'deagle'][Math.floor(Math.random() * 7)]);
        if (Math.random() < 0.2 + a.rank * 0.08) a.armor.v = 1 + (a.rank > 4);
      }
    }
  }
  function stepBot(a, dt) {
    const b = a.brain;
    if (social) {
      b.think -= dt;
      if (b.think <= 0) { b.think = 2 + Math.random() * 4; b.dir = Math.random() * 6.28; b.cool = Math.random() < 0.3 ? 1 : 0; }
      a.speed = b.cool ? 0 : 0.5; a.yaw = b.dir;
      if (!b.cool) moveBody(world, a, Math.sin(b.dir) * 2.2 * dt, Math.cos(b.dir) * 2.2 * dt, dt, HEIGHT.stand);
      return;
    }
    if (training) { a.speed = 0; return; }
    if (a.phase === 'plane') { if (clock >= a.jumpAt) leavePlane(a); return; }
    if (a.phase === 'fall') {
      b.goal ||= { x: a.x + (Math.random() - 0.5) * 60, z: a.z + (Math.random() - 0.5) * 60 };
      const d = Math.max(1, dist2(b.goal, a));
      a.yaw = Math.atan2(b.goal.x - a.x, b.goal.z - a.z);
      return stepFall(a, ((b.goal.x - a.x) / d) * 0.6, ((b.goal.z - a.z) / d) * 0.6, dt);
    }
    b.think -= dt; b.cool -= dt;
    const eye = (t) => V(t.x, t.y + HEIGHT[t.stance] * 0.75, t.z);
    if (b.think <= 0) {
      b.think = 0.35 + Math.random() * 0.3;
      let best = null, bd = 32 + a.rank * 3;
      for (const t of actors.values()) {
        if (t === a || !t.alive || t.phase !== 'ground') continue;
        const d = dist2(a, t) * (t.isBot ? 1.5 : 1);
        if (d >= bd) continue;
        const from = eye(a), dir = eye(t).sub(from), l = dir.length();
        if (rayWorld(world, from, dir.normalize(), l) >= l - 0.1) { best = t; bd = d; }
      }
      if (best !== b.target) b.since = clock;
      b.target = best;
    }
    let mx = 0, mz = 0;
    const outside = dist2(a, zone) > zone.r * 0.88;
    const t = b.target?.alive ? b.target : null;
    if (t) {
      const d = dist2(a, t), want = WEAPONS[current(a).key].cat === 'Shotgun' ? 8 : 17;
      a.yaw = Math.atan2(t.x - a.x, t.z - a.z);
      const side = Math.sin(clock * 1.3 + a.jumpAt) > 0 ? 1 : -1;
      const fwd = d > want ? 1 : d < want * 0.5 ? -0.7 : 0;
      mx = Math.sin(a.yaw) * fwd + Math.cos(a.yaw) * side * 0.5; mz = Math.cos(a.yaw) * fwd - Math.sin(a.yaw) * side * 0.5;
      const reaction = 1.3 - a.rank * 0.1;
      if (b.cool <= 0 && clock - b.since > reaction && clock - b.landed > 6) {
        const w = current(a), spec = WEAPONS[w.key];
        if (d <= spec.range) {
          b.cool = Math.max(0.35, spec.rate * 2.6) + Math.random() * 0.25;
          const accuracy = clamp((0.34 + a.rank * 0.05) * (1 - d / 75) * (t.speed > 0.3 ? 0.75 : 1) * (t.stance !== 'stand' ? 0.8 : 1), 0.05, 0.75);
          fire(a, eye(t), accuracy);
        }
      }
    }
    if (outside) { const d = Math.max(1, dist2(zone, a)); mx = (zone.x - a.x) / d; mz = (zone.z - a.z) / d; if (!t) a.yaw = Math.atan2(mx, mz); }
    else if (!t) {
      if (!b.goal || dist2(b.goal, a) < 2 || b.stuck > 1) {
        const r = Math.random() * Math.min(zone.r * 0.7, 45), g = Math.random() * 6.28;
        // Sesekali bergerak ke arah pemain lain supaya match tidak macet
        const prey = Math.random() < 0.35 ? alive().find((o) => o !== a && !o.isBot) : null;
        b.goal = prey ? { x: prey.x + (Math.random() - 0.5) * 16, z: prey.z + (Math.random() - 0.5) * 16 } : { x: clamp(zone.x + Math.cos(g) * r, -95, 95), z: clamp(zone.z + Math.sin(g) * r, -95, 95) };
        b.stuck = 0; b.dir = Math.atan2(b.goal.x - a.x, b.goal.z - a.z) + (Math.random() - 0.5) * 2;
      }
      const goal = Math.atan2(b.goal.x - a.x, b.goal.z - a.z);
      b.dir += Math.atan2(Math.sin(goal - b.dir), Math.cos(goal - b.dir)) * Math.min(1, dt * 0.9);
      mx = Math.sin(b.dir); mz = Math.cos(b.dir); a.yaw = b.dir;
    }
    const sp = 3.7, ox = a.x, oz = a.z;
    moveBody(world, a, mx * sp * dt * (a.slow ?? 1), mz * sp * dt * (a.slow ?? 1), dt, HEIGHT.stand);
    a.speed = Math.min(1, Math.hypot(mx, mz));
    if (a.speed > 0.2 && Math.hypot(a.x - ox, a.z - oz) < sp * dt * 0.35) {
      b.stuck += dt; b.dir += (Math.random() < 0.5 ? 1 : -1) * 1.6;
      if (a.grounded && Math.random() < 0.3) a.vy = 7;
    }
  }

  // ---------- Online ----------
  const r2 = (v) => Math.round(v * 100) / 100;
  const pack = (a) => ({ x: r2(a.x), y: r2(a.y), z: r2(a.z), r: r2(a.yaw), p: a.phase, s: a.stance, w: current(a).key, hp: Math.ceil(a.hp), a: a.alive, h: a.armor.h, v: a.armor.v, m: r2(a.speed) });
  function applyRemote(a, s) {
    a.seen = true; a.net = s;
    if (a.phase === 'plane' && s.p !== 'plane') { a.x = s.x; a.y = s.y; a.z = s.z; }
    a.phase = s.p; a.stance = HEIGHT[s.s] ? s.s : 'stand'; a.hp = s.hp; a.armor = { h: s.h || 0, v: s.v || 0 }; a.speed = s.m || 0;
    if (s.w !== 'fist' && WEAPONS[s.w]) { a.weapons[0] = { key: s.w, mag: WEAPONS[s.w].mag }; a.slot = 0; } else a.slot = 2;
    if (a.alive && s.a === false) applyDeath(a, null);
  }
  if (net) {
    net.onStates((all) => { for (const [id, s] of Object.entries(all)) { const a = actors.get(id); if (a && !a.isMe && a.alive) applyRemote(a, s); } });
    net.onBots((all) => { if (net.isHost()) return; for (const [id, s] of Object.entries(all)) { const a = actors.get(id); if (a?.alive) applyRemote(a, s); } });
    net.onEvent((e) => {
      if (ended) return;
      if (e.k === 'hit') { const t = actors.get(e.to); if (t && owns(t)) damage(t, clamp(Number(e.d) || 0, 0, 200), actors.get(e.from), !!e.h); }
      if (e.k === 'kill') { const v = actors.get(e.v); if (v) applyDeath(v, actors.get(e.killer), e.as || []); }
      if (e.k === 'shot') {
        const from = actors.get(e.from);
        tracer(V(...e.o), V(...e.e), e.c);
        if (from) { sfx.shot(WEAPONS[e.w]?.cat, dist2(from, me), e.w); if (dist2(from, me) < 90) markers.set(from.id, { x: from.x, z: from.z, t: clock }); }
      }
    });
    net.onTaken(removeLoot); net.onDrop(addLoot);
  }
  let netTimer = 0;
  function syncNet(dt) {
    if (!net || ended) return;
    netTimer -= dt;
    if (netTimer > 0) return;
    netTimer = 0.1;
    net.sendState(pack(me));
    if (net.isHost()) net.sendBots(Object.fromEntries([...actors.values()].filter((a) => a.isBot).map((a) => [a.id, pack(a)])));
    for (const a of actors.values()) if (!a.isMe && !a.isBot && a.alive && !net.present().has(a.id) && clock > 3) applyDeath(a, null);
  }

  function drawActor(a, dt) {
    if (a.net && !owns(a) && a.alive && a.phase !== 'plane') {
      const k = Math.min(1, dt * 12);
      a.x += (a.net.x - a.x) * k; a.y += (a.net.y - a.y) * k; a.z += (a.net.z - a.z) * k; a.yaw += Math.atan2(Math.sin(a.net.r - a.yaw), Math.cos(a.net.r - a.yaw)) * k;
      if (a.phase === 'fall' && !a.chute) { a.chute = createChute(a.ch.look.chute); scene.add(a.chute); }
      if (a.chute) { a.chute.position.set(a.x, a.y, a.z); if (a.phase !== 'fall') { scene.remove(a.chute); a.chute = null; } }
    }
    a.ch.root.visible = a.phase !== 'plane' && a.phase !== 'car' && (a.alive || clock - a.diedAt < 5);
    a.ch.root.position.set(a.x, a.y, a.z); a.ch.root.rotation.y = a.yaw;
    const w = current(a).key, skin = a.skins[w];
    a.ch.setWeapon(w, skin, a.evo[skin] || 1); a.ch.setArmor(a.armor.h, a.armor.v);
    a.punch = Math.max(0, a.punch - dt * 3.5);
    let state = 'idle';
    if (!a.alive) state = 'dead';
    else if (a.phase === 'fall') state = a.chute ? 'chute' : 'air';
    else if (a.stance !== 'stand') state = a.stance;
    else if (owns(a) && !a.grounded) state = 'air';
    else if (a.speed > 0.1) state = 'walk';
    else if (a.isMe && healing > 0) state = 'heal';
    else if (a.isMe && emote) state = emote;
    a.ch.animate(clock + a.jumpAt, state, a.speed, a.punch);
    if (a.ch.look.trail && a.alive && a.phase === 'ground' && a.speed > 0.4 && Math.random() < dt * 9) burst(V(a.x, a.y + 0.25, a.z), a.ch.look.trail, 1, 0.16, 0.6);
  }

  function updateCamera(dt) {
    const sniper = WEAPONS[current(me).key].cat === 'Sniper' && me.phase === 'ground';
    const fov = scopeLv ? [65, 36, 25, 17][scopeLv] : sniper ? 34 : 65;
    if (Math.abs(camera.fov - fov) > 0.1) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
    const f = V(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    if (me.phase === 'plane') {
      const p = planePos(); camera.position.copy(p).addScaledVector(f, -26).add(V(0, 5, 0)); camera.lookAt(p.x, p.y, p.z); return;
    }
    const pivot = V(me.x, me.y + (me.stance === 'prone' ? 1.0 : me.stance === 'crouch' ? 1.55 : 2.0), me.z);
    const shoulder = me.phase === 'ground' ? 0.75 : 0;
    const want = pivot.clone().add(V(-Math.cos(cam.yaw) * shoulder, 0, Math.sin(cam.yaw) * shoulder)).addScaledVector(f, me.phase === 'ground' ? -4.6 : -10);
    const dir = want.clone().sub(pivot), len = dir.length(); dir.normalize();
    const t = rayWorld(world, pivot, dir, len);
    camera.position.copy(pivot).addScaledVector(dir, Math.max(0.4, t - 0.25));
    camera.lookAt(camera.position.clone().add(f));
  }

  // ---------- HUD ----------
  const mapCtx = $('#minimap').getContext('2d');
  const toMap = (x, z) => [HALF - x, HALF - z];
  function drawMinimap() {
    const g = mapCtx;
    g.fillStyle = '#4d7d3a'; g.fillRect(0, 0, 200, 200);
    g.fillStyle = '#b59b6c'; g.fillRect(0, 98, 200, 4); g.fillRect(98, 0, 4, 200); g.fillRect(25, 44.5, 150, 3); g.fillRect(25, 152.5, 150, 3);
    g.fillStyle = '#d7d3c8';
    for (const [x, z, w, d] of world.buildings) { const [px, py] = toMap(x, z); g.fillRect(px - w / 2, py - d / 2, w, d); }
    if (!training && !social) { const [zx, zy] = toMap(zone.x, zone.z); g.strokeStyle = '#d8b4fe'; g.lineWidth = 3; g.beginPath(); g.arc(zx, zy, zone.r, 0, 7); g.stroke(); }
    if (me.phase === 'plane') {
      g.strokeStyle = '#fff'; g.setLineDash([6, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(...toMap(pathFrom.x, pathFrom.z)); g.lineTo(...toMap(pathTo.x, pathTo.z)); g.stroke(); g.setLineDash([]);
    }
    for (const [id, m] of markers) {
      const age = clock - m.t;
      if (age > 2.5 || !actors.get(id)?.alive) { markers.delete(id); continue; }
      const [px, py] = toMap(m.x, m.z);
      g.globalAlpha = 1 - age / 3; g.fillStyle = '#ff2d2d'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(px, py + 6); g.lineTo(px - 6, py - 5); g.lineTo(px, py - 2); g.lineTo(px + 6, py - 5); g.closePath(); g.fill(); g.stroke(); g.globalAlpha = 1;
    }
    const p = me.phase === 'plane' ? planePos() : me;
    const [px, py] = toMap(p.x, p.z);
    g.save(); g.translate(px, py); g.rotate(-cam.yaw); g.fillStyle = '#22d3ee'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  const feeds = [];
  function feed(t) { feeds.push({ t, at: performance.now() }); if (feeds.length > 3) feeds.shift(); }
  function hitMark() { hitTimer = 0.12; sfx.hit(); }
  let hudKey = '', hudTimer = 0;
  function updateHud(dt) {
    flash = Math.max(0, flash - dt * 1.6); hitTimer -= dt;
    $('#damageFlash').style.opacity = flash; $('#hitmark').hidden = hitTimer <= 0;
    hudTimer -= dt;
    if (hudTimer > 0) return;
    hudTimer = 0.1;
    $('#hKill').textContent = stats.kills; $('#hAlive').textContent = alive().length;
    $('#hZone').textContent = training ? 'Latihan' : social ? 'Social Island' : `${zone.shrinking ? 'Zona menyusut' : 'Zona'} ${Math.ceil(zone.next)}s`;
    $('#hpFill').style.width = `${me.hp}%`; $('#hpText').textContent = `HP ${Math.ceil(me.hp)}`;
    $('#bSkill').hidden = !chr.skill || social; $('#bSkill small').textContent = skillCd > 0 ? `${Math.ceil(skillCd)}s` : (chr.skillName || '');
    $('#bCar').hidden = !(nearV || me.phase === 'car'); $('#bCar small').textContent = me.phase === 'car' ? 'Turun' : 'Naik';
    $('#scopeOv').hidden = !scopeLv; $('#scopeOv').textContent = `x${scopeLv + 1}`; $('#bScope small').textContent = scopeLv ? `x${scopeLv + 1}` : 'Scope';
    $('#bEmote').hidden = !social; $('#bChat').hidden = !social; $('#bHeal small').textContent = `${meds.medkit}/${meds.super}`;
    $('#manaFill').style.width = `${me.mana}%`; $('#manaText').textContent = `MANA ${Math.floor(me.mana)}`;
    const w = current(me), spec = WEAPONS[w.key];
    $('#ammoText').textContent = reloading ? `Reload ${reloading.toFixed(1)}s` : spec.ammo ? `${w.mag} / ${ammo[spec.ammo]}  ${AMMO[spec.ammo].name}` : 'Tinju';
    const key = JSON.stringify([me.slot, me.weapons.map((x) => x?.key), me.armor]);
    if (key !== hudKey) {
      hudKey = key;
      $('#slots').innerHTML = [0, 1, 2].map((i) => `<button class="slot ${(i === 2 ? me.slot === 2 : me.slot === i) ? 'on' : ''}" data-slot="${i}"><small>[${i + 1}]</small>${i === 2 ? 'Tinju' : me.weapons[i] ? WEAPONS[me.weapons[i].key].name : 'Kosong'}</button>`).join('');
      $('#armorIcons').innerHTML = [['h', 'helmet'], ['v', 'vest']].filter(([k]) => me.armor[k]).map(([k, ic]) => `<span style="border-color:#${ARMOR[me.armor[k]].color.toString(16).padStart(6, '0')}">${icon(ic)} ${ARMOR[me.armor[k]].name}</span>`).join('');
    }
    const fireIcon = w.key === 'fist' ? 'fist' : 'fire';
    if ($('#bFire').dataset.i !== fireIcon) { $('#bFire').dataset.i = fireIcon; $('#bFire').innerHTML = icon(fireIcon); }
    $('#bCrouch').classList.toggle('on', me.stance === 'crouch'); $('#bProne').classList.toggle('on', me.stance === 'prone');
    $('#bJumpPlane').hidden = !(me.phase === 'plane' && clock >= 1.5 && !ended);
    $('#bPickup').hidden = !pickable; if (pickable) $('#pickName').textContent = `Ambil ${lootName(pickable)}`;
    $('#crosshair').hidden = me.phase !== 'ground';
    if (!ended) {
      $('#prompt').textContent = lead > 0 ? `Mulai dalam ${Math.ceil(lead)}` : me.phase === 'plane' ? `Pilih tempat turun (${Math.max(0, Math.ceil(PLANE_TIME - clock))}s)`
        : me.phase === 'fall' ? 'Arahkan parasut dengan joystick / WASD' : !training && !social && dist2(me, zone) > zone.r ? 'Kamu di luar zona aman!' : '';
    }
    $('#feed').innerHTML = feeds.filter((f) => performance.now() - f.at < 4000).map((f) => `<div>${esc(f.t)}</div>`).join('');
    drawMinimap();
  }

  // ---------- Loop ----------
  let zoneTick = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    lead = (localStart - performance.now()) / 1000;
    // Online: waktu mengikuti jam bersama; offline: mengikuti frame
    clock = lead > 0 ? 0 : net ? -lead : clock + dt;
    const running = lead <= 0;
    updateZone();
    if (running && !ended) {
      cooldown -= dt;
      if (reloading) {
        reloading -= dt;
        if (reloading <= 0) {
          reloading = 0;
          const w = current(me), spec = WEAPONS[w.key];
          if (spec.ammo) { const n = Math.min(spec.mag - w.mag, ammo[spec.ammo]); w.mag += n; if (!training) ammo[spec.ammo] -= n; }
        }
      }
      if (mode === 'br' && clock >= PLANE_TIME - 1 && me.phase === 'plane') leavePlane(me);
      stepPlayer(dt); updateExtras(dt);
      for (const a of actors.values()) if (a.isBot && a.alive && owns(a)) stepBot(a, dt);
      if (input.fire || input.keys.has('KeyJ')) tryFire();
      // Regenerasi & zona
      zoneTick += dt;
      for (const a of actors.values()) {
        if (!a.alive || !owns(a)) continue;
        if (clock - a.lastHurt > 6 && a.hp < 100) a.hp = Math.min(100, a.hp + 1.5 * dt);
        if (a.isMe) { a.mana = Math.min(100, a.mana + 3 * dt); if (healing > 0) { healing -= dt; a.hp = Math.min(100, a.hp + healRate * dt); } }
        if (zoneTick >= 1 && !training && !social && (a.phase === 'ground' || a.phase === 'car') && dist2(a, zone) > zone.r) {
          a.hp -= zone.dps; if (a.isMe) { flash = 0.5; sfx.hurt(); }
          if (a.hp <= 0) die(a, null);
        }
      }
      if (zoneTick >= 1) zoneTick = 0;
      if (training) for (const a of actors.values()) if (!a.alive && clock - a.diedAt > 3) { a.alive = true; a.hp = 100; }
      scanLoot();
    }
    syncNet(dt);
    for (const a of actors.values()) drawActor(a, dt);
    if (plane.visible) { plane.position.copy(planePos()); plane.position.y += 1.5; props.forEach((p) => { p.rotation.z += dt * 30; }); if (clock > PLANE_TIME * 1.4) plane.visible = false; }
    for (const l of loot.values()) {
      const near = Math.abs(l.x - me.x) < 55 && Math.abs(l.z - me.z) < 55;
      l.mesh.visible = near;
      if (near && l.type === 'weapon') l.mesh.rotation.y += dt * 0.8;
    }
    for (const t of tracers.list) if (t.m.visible && (t.life -= dt) <= 0) t.m.visible = false;
    for (const q of parts.list) if (q.m.visible) { q.life -= dt; q.v.y -= 7 * dt; q.m.position.addScaledVector(q.v, dt); if (q.life <= 0) q.m.visible = false; }
    updateCamera(dt);
    updateHud(dt);
    renderer.render(scene, camera);
  }

  function cleanup() {
    cancelAnimationFrame(raf); ac.abort(); document.exitPointerLock?.(); joyEnd();
    $('#bFire').classList.remove('on'); $('#inventory').hidden = true; $('#prompt').textContent = ''; $('#feed').innerHTML = '';
    $('#damageFlash').style.opacity = 0; $('#bPickup').hidden = true; $('#bJumpPlane').hidden = true;
    net?.leave();
    worldMesh.geometry.dispose(); worldMesh.material.dispose(); scene.clear(); renderer.renderLists?.dispose();
  }

  raf = requestAnimationFrame(frame);
  // Dipakai untuk debugging / pengujian
  return { me, actors, world, loot, zone, jump, cam };
}
