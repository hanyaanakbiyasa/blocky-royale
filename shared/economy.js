// Aturan ekonomi. Dijalankan di server saat online (otoritatif) dan di browser saat offline.
import { ITEMS, SKINS, BANNERS, RATES, PITY, SPIN_COST, EVO_MAX, EVO_COST, SLOT_GROUPS, MODES, rankIndex } from './catalog.js';

export const STARTER = { coin: 1000, iron: 1000 };
export const DAILY_IRON = 100;
const SLOTS = SLOT_GROUPS.flatMap((g) => g.slots.map((s) => s[0]));
const OUTFIT = ['hat', 'acc', 'clothes', 'pants', 'shoes'];

export const RENAME_COST = 100;
export class GameError extends Error {}
const fail = (m) => { throw new GameError(m); };
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

export function cleanName(raw) {
  const name = String(raw ?? '').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14);
  if (name.length < 3) fail('Username minimal 3 karakter (huruf/angka)');
  return name;
}
// Tanggal WIB (UTC+7) supaya reset harian jam 00:00 Indonesia barat
export const dayKey = (now) => new Date(now + 7 * 3600e3).toISOString().slice(0, 10);

export function newProfile(name, now) {
  return {
    v: 1, name: cleanName(name), coin: STARTER.coin, iron: STARTER.iron, tokens: 0, exp: 0, rank: 0,
    stats: { matches: 0, wins: 0, kills: 0, assists: 0, damage: 0 },
    owned: {}, equipped: {}, weaponSkins: {}, evo: {}, pity: {},
    daily: '', lastMatchAt: 0, createdAt: now, lastLogin: now,
  };
}

const pickFrom = (list, rng) => list[Math.floor(rng() * list.length)];

function grant(p, kind, id) {
  if (kind === 'skin' || kind === 'evo') {
    const s = SKINS[id];
    if (p.owned[id]) {
      if (s.evo) { p.tokens += 25; return { kind, id, dup: true, bonus: '+25 token' }; }
      p.coin += 150; return { kind, id, dup: true, bonus: '+150 coin' };
    }
    p.owned[id] = true;
    if (s.evo) p.evo[id] = 1;
    return { kind, id };
  }
  if (p.owned[id]) {
    const refund = kind === 'bundle' ? 600 : 100;
    p.coin += refund; return { kind, id, dup: true, bonus: `+${refund} coin` };
  }
  p.owned[id] = true;
  return { kind, id };
}

function rollOne(p, bannerId, rng) {
  const b = BANNERS[bannerId];
  p.pity[bannerId] = (p.pity[bannerId] || 0) + 1;
  let kind;
  const missing = [...b.bundles.map((id) => ['bundle', id]), ...b.evo.map((id) => ['evo', id])].filter(([, id]) => !p.owned[id]);
  if (p.pity[bannerId] >= PITY) {
    p.pity[bannerId] = 0;
    const [k, id] = missing.length ? pickFrom(missing, rng) : ['bundle', pickFrom(b.bundles, rng)];
    return grant(p, k, id);
  }
  let r = rng() * 100;
  for (const [k, w] of RATES) { kind = k; if ((r -= w) < 0) break; }
  if (kind === 'bundle' || kind === 'evo') p.pity[bannerId] = 0;
  if (kind === 'bundle') return grant(p, kind, pickFrom(b.bundles, rng));
  if (kind === 'evo') return grant(p, kind, pickFrom(b.evo, rng));
  if (kind === 'skin') return grant(p, kind, pickFrom(b.skins, rng));
  if (kind === 'item') return grant(p, kind, pickFrom(b.items, rng));
  if (kind === 'token') { const n = pickFrom([5, 5, 8, 10, 15], rng); p.tokens += n; return { kind, amount: n }; }
  const n = pickFrom([30, 50, 50, 80, 120], rng); p.coin += n; return { kind: 'coin', amount: n };
}

const int = (v, min, max) => Math.min(max, Math.max(min, Math.floor(Number(v) || 0)));

/** Terapkan satu aksi ke salinan profil. Mengembalikan { profile, result }. */
export function applyAction(profile, action, { now = Date.now(), rng = Math.random } = {}) {
  const p = structuredClone(profile);
  let result = {};
  switch (action?.type) {
    case 'login': p.lastLogin = now; break;
    case 'rename': {
      const name = cleanName(action.name);
      if (name === p.name) fail('Username sama dengan yang sekarang');
      if (p.iron < RENAME_COST) fail(`Butuh ${RENAME_COST} Iron untuk ganti username`);
      p.iron -= RENAME_COST; p.name = name; break;
    }
    case 'daily': {
      const today = dayKey(now);
      if (p.daily >= today) fail('Hadiah hari ini sudah diklaim');
      p.daily = today; p.iron += DAILY_IRON; result = { iron: DAILY_IRON };
      break;
    }
    case 'buy': {
      if (!has(ITEMS, action.id)) fail('Item tidak ditemukan');
      const it = ITEMS[action.id];
      if (!it.price) fail('Item ini hanya dari Spin');
      if (p.owned[it.id]) fail('Item sudah dimiliki');
      if (p.coin < it.price) fail('Coin tidak cukup');
      p.coin -= it.price; p.owned[it.id] = true;
      break;
    }
    case 'spin': {
      const count = action.count === 10 ? 10 : action.count === 1 ? 1 : fail('Jumlah spin tidak valid');
      if (!has(BANNERS, action.banner)) fail('Toko gacha tidak ditemukan');
      const cost = SPIN_COST[count];
      if (p.iron < cost) fail('Iron tidak cukup');
      p.iron -= cost;
      result = { rewards: Array.from({ length: count }, () => rollOne(p, action.banner, rng)) };
      break;
    }
    case 'equip': {
      if (!SLOTS.includes(action.slot)) fail('Slot tidak valid');
      if (action.id == null) { delete p.equipped[action.slot]; break; }
      if (!has(ITEMS, action.id) || ITEMS[action.id].slot !== action.slot) fail('Item tidak cocok');
      if (!p.owned[action.id]) fail('Item belum dimiliki');
      p.equipped[action.slot] = action.id;
      // Bundle menggantikan seluruh outfit; memakai item outfit melepas bundle
      if (OUTFIT.includes(action.slot)) delete p.equipped.bundle;
      if (action.slot === 'bundle') OUTFIT.forEach((s) => delete p.equipped[s]);
      break;
    }
    case 'equipSkin': {
      if (action.id == null) { delete p.weaponSkins[action.weapon]; break; }
      if (!has(SKINS, action.id) || SKINS[action.id].weapon !== action.weapon) fail('Skin tidak cocok');
      if (!p.owned[action.id]) fail('Skin belum dimiliki');
      p.weaponSkins[action.weapon] = action.id;
      break;
    }
    case 'upgrade': {
      if (!has(SKINS, action.id) || !SKINS[action.id].evo || !p.owned[action.id]) fail('Skin Evo belum dimiliki');
      const level = p.evo[action.id] || 1;
      if (level >= EVO_MAX) fail('Sudah level maksimal');
      const cost = EVO_COST[level + 1];
      if (p.tokens < cost) fail('Token Evo tidak cukup');
      p.tokens -= cost; p.evo[action.id] = level + 1; result = { level: level + 1 };
      break;
    }
    case 'match': {
      const mode = MODES.find((m) => m.id === action.mode && m.id !== 'training') || fail('Mode tidak memberi EXP');
      if (now - p.lastMatchAt < 20e3) fail('Hasil match dikirim terlalu cepat');
      const kills = int(action.kills, 0, mode.total - 1);
      const assists = int(action.assists, 0, mode.total - 1);
      const damage = int(action.damage, 0, mode.total * 400);
      const placement = int(action.placement, 1, mode.total);
      const survival = int(action.survival, 0, 1800);
      const win = placement === 1;
      // Base 50-150 berdasarkan placement
      const base = Math.round(50 + 100 * (mode.total - placement) / (mode.total - 1));
      const exp = base + kills * 10 + (win ? 100 : 0);
      const coin = 40 + kills * 25 + (win ? 150 : 0);
      const before = rankIndex(p.exp);
      p.exp += exp; p.coin += coin; p.rank = rankIndex(p.exp); p.lastMatchAt = now;
      p.stats.matches++; p.stats.wins += win ? 1 : 0; p.stats.kills += kills; p.stats.assists += assists; p.stats.damage += damage;
      result = { exp, base, coin, kills, assists, damage, placement, survival, win, rankBefore: before, rankAfter: p.rank };
      break;
    }
    default: fail('Aksi tidak dikenal');
  }
  p.rank = rankIndex(p.exp);
  return { profile: p, result };
}
