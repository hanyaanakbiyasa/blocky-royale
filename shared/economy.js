// Aturan ekonomi. Dijalankan di server saat online (otoritatif) dan di browser saat offline.
import { ITEMS, SKINS, BANNERS, RATES, PITY, SPIN_COST, EVO_MAX, EVO_COST, SLOT_GROUPS, MODES, rankIndex, MYSTERY_ITEMS, MYSTERY_MILESTONES, CHARACTERS, GLOO_SKINS, AVATARS, BUNDLE_PARTS } from './catalog.js';

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
const weekKey = (now) => { const d = new Date(now + 7 * 3600e3); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0,10); };

export function newProfile(name, now) {
  return {
    v: 1, name: cleanName(name), coin: STARTER.coin, iron: STARTER.iron, tokens: 0, exp: 0, rank: 0,
    stats: { matches: 0, wins: 0, kills: 0, assists: 0, damage: 0 },
    owned: {}, equipped: {}, weaponSkins: {}, evo: {}, pity: {},
    matchHistory: [], pets: { owned: ['cat'], equipped: 'cat' }, guild: null, blockyPass: { xp: 0, claimed: [] },
    emoteCollection: ['wave', 'laugh', 'sit'], characterPresets: [{ name: 'Preset 1', char: 'c_adam', pet: 'cat' }, { name: 'Preset 2', char: 'c_adam', pet: 'cat' }, { name: 'Preset 3', char: 'c_adam', pet: 'cat' }], activePreset: 0,
    hudLayout: { scale: 100, opacity: 100 },
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
export function applyAction(profile, action, { now = Date.now(), rng = Math.random, event = null } = {}) {
  const p = structuredClone(profile);
  let result = {};
  switch (action?.type) {
    case 'login': {
      p.lastLogin = now;
      p.eventProgress ||= {};
      const today = dayKey(now);
      if (p.eventProgress.lastLoginDay !== today) {
        p.eventProgress.logins = (p.eventProgress.logins || 0) + 1;
        const month = today.slice(0,7);
        if (p.eventProgress.monthKey !== month) { p.eventProgress.monthKey = month; p.eventProgress.monthlyLogins = 0; }
        p.eventProgress.monthlyLogins = (p.eventProgress.monthlyLogins || 0) + 1;
        p.eventProgress.ramadhanLogins = (p.eventProgress.ramadhanLogins || 0) + 1;
        p.eventProgress.lastLoginDay = today;
      }
      break;
    }
    case 'claimNewbieDaily': {
      const today = dayKey(now), state = p.newbieDaily || { day: 0, lastDay: '' };
      if (state.lastDay === today) fail('Check-in hari ini sudah diklaim');
      const prev = state.lastDay ? new Date(`${state.lastDay}T00:00:00+07:00`).getTime() : 0;
      const current = new Date(`${today}T00:00:00+07:00`).getTime();
      const day = prev && current - prev === 86400e3 ? Math.min(7, state.day + 1) : 1;
      const rewards = [
        { coin: 500, iron: 500 }, { coin: 1500, iron: 1500 }, { coin: 2500, iron: 2500 },
        { coin: 3500, iron: 3500 }, { coin: 5000, iron: 5000 }, { coin: 7500, iron: 7500 },
        { bundle: 'b_hercules', skin: 's_scar_laut', gloo: 'gloo_gold' },
      ];
      const reward = rewards[day - 1];
      if (reward.coin) { p.coin += reward.coin; p.iron += reward.iron; }
      else {
        for (const id of [reward.bundle, reward.skin]) if (id && !p.owned[id]) p.owned[id] = true;
        if (reward.gloo) p.ownedGlooSkins[reward.gloo] = true;
      }
      p.newbieDaily = { day, lastDay: today };
      result = { day, reward };
      break;
    }
    case 'setFriends': {
      if (!Array.isArray(action.friends)) fail('Daftar teman tidak valid');
      p.friends = [...new Set(action.friends.map(x => cleanName(x)))].slice(0, 100);
      break;
    }
    case 'buyAvatar': {
      const a = AVATARS.find(x => x.id === action.id);
      if (!a) fail('Avatar tidak ditemukan');
      if (p.ownedAvatars?.[a.id]) fail('Avatar sudah dimiliki');
      if (p.coin < a.price) fail('Coin tidak cukup');
      p.coin -= a.price; p.ownedAvatars ||= {}; p.ownedAvatars[a.id] = true;
      break;
    }
    case 'setAvatar': {
      if (action.id && !p.ownedAvatars?.[action.id]) fail('Avatar belum dimiliki');
      p.avatar = action.id || '';
      break;
    }
    case 'buyGlooSkin': {
      const g = GLOO_SKINS[action.id];
      if (!g) fail('Skin Gloo Wall tidak ditemukan');
      p.ownedGlooSkins ||= { gloo_default: true };
      if (p.ownedGlooSkins[g.id]) fail('Skin sudah dimiliki');
      if (p.coin < g.price) fail('Coin tidak cukup');
      p.coin -= g.price; p.ownedGlooSkins[g.id] = true;
      break;
    }
    case 'setGlooSkin': {
      if (!GLOO_SKINS[action.id] || !p.ownedGlooSkins?.[action.id]) fail('Skin Gloo Wall belum dimiliki');
      p.glooSkin = action.id;
      break;
    }
    case 'claimEvent': {
      const tasks = {
        login1: { key: 'logins', goal: 1, reward: { coin: 300 } }, login3: { key: 'logins', goal: 3, reward: { iron: 600 } },
        login7: { key: 'logins', goal: 7, reward: { coin: 1500, iron: 1000 } },
        kill1: { key: 'kills', goal: 1, reward: { coin: 250 } }, kill5: { key: 'kills', goal: 5, reward: { coin: 750 } },
        kill10: { key: 'kills', goal: 10, reward: { iron: 1000 } },
        death3: { key: 'deaths', goal: 3, reward: { coin: 500 } }, death10: { key: 'deaths', goal: 10, reward: { iron: 1000 } },
        revive1: { key: 'revives', goal: 1, reward: { coin: 500 } }, revive5: { key: 'revives', goal: 5, reward: { coin: 1200 } },
        weapon5: { key: 'weaponKills', goal: 5, reward: { coin: 700 } }, weapon20: { key: 'weaponKills', goal: 20, reward: { iron: 1500 } },
        bundle1: { key: 'bundles', goal: 1, reward: { coin: 300 } },
        weeklyKills: { key: 'weeklyKills', goal: 25, reward: { coin: 2500, iron: 1000 } },
        monthlyLogin: { key: 'monthlyLogins', goal: 20, reward: { coin: 3000, iron: 2000 } },
        ramadhanLogin: { key: 'ramadhanLogins', goal: 7, reward: { coin: 2000, iron: 2000 } },
      };
      const task = tasks[action.id];
      if (!task) fail('Event tidak ditemukan');
      p.eventClaims ||= {};
      if (p.eventClaims[action.id]) fail('Hadiah sudah diklaim');
      const progress = p.eventProgress?.[task.key] || 0;
      if (progress < task.goal) fail('Target event belum tercapai');
      if (task.reward.coin) p.coin += task.reward.coin;
      if (task.reward.iron) p.iron += task.reward.iron;
      p.eventClaims[action.id] = true; result = task.reward;
      break;
    }
    case 'buyChar': {
      const c = CHARACTERS[action.id];
      if (!c) fail('Karakter tidak ada');
      if (c.price === 0 || p.owned[action.id]) fail('Sudah dimiliki');
      if (p.coin < c.price) fail('Coin tidak cukup');
      p.coin -= c.price; p.owned[action.id] = true; break;
    }
    case 'setChar': {
      const c = CHARACTERS[action.id];
      if (!c) fail('Karakter tidak ada');
      if (c.price > 0 && !p.owned[action.id]) fail('Karakter belum dimiliki');
      p.char = action.id; p.characterPresets ||= [{ name: 'Preset 1', char: 'c_adam', pet: 'cat' }, { name: 'Preset 2', char: 'c_adam', pet: 'cat' }, { name: 'Preset 3', char: 'c_adam', pet: 'cat' }]; p.characterPresets[p.activePreset || 0].char = action.id; break;
    }
    case 'setPet': {
      const pets = ['cat','eagle','tiger','orangutan','dog','fox','panda'];
      p.pets ||= { owned: ['cat'], equipped: 'cat' };
      if (!pets.includes(action.id) || !p.pets.owned.includes(action.id)) fail('Pet belum dimiliki');
      p.pets.equipped = action.id; if (p.characterPresets?.[p.activePreset || 0]) p.characterPresets[p.activePreset || 0].pet = action.id; break;
    }
    case 'setPreset': {
      const i = int(action.index, 0, 2); p.characterPresets ||= [{ name: 'Preset 1', char: 'c_adam', pet: 'cat' }, { name: 'Preset 2', char: 'c_adam', pet: 'cat' }, { name: 'Preset 3', char: 'c_adam', pet: 'cat' }];
      const preset = p.characterPresets[i]; if (!preset) fail('Preset tidak ditemukan');
      if (action.char) { const c = CHARACTERS[action.char]; if (!c || (c.price > 0 && !p.owned[action.char])) fail('Karakter belum dimiliki'); preset.char = action.char; }
      if (action.pet) { if (!p.pets?.owned?.includes(action.pet)) fail('Pet belum dimiliki'); preset.pet = action.pet; }
      p.activePreset = i; p.char = preset.char; p.pets ||= { owned: ['cat'], equipped: 'cat' }; p.pets.equipped = preset.pet || 'cat'; break;
    }
    case 'claimPass': {
      const tier = int(action.tier, 1, 30); p.blockyPass ||= { xp: 0, claimed: [] };
      if ((p.blockyPass.xp || 0) < tier * 100) fail('Level Blocky Pass belum tercapai');
      if (p.blockyPass.claimed.includes(tier)) fail('Hadiah sudah diklaim');
      p.blockyPass.claimed.push(tier); p.coin += 100 + tier * 15; p.iron += 100 + tier * 20; result = { tier }; break;
    }
    case 'createGuild': {
      const name = String(action.name || '').trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 18);
      if (name.length < 3) fail('Nama guild minimal 3 karakter'); if (p.guild) fail('Kamu sudah tergabung dalam guild');
      p.guild = { name, tag: name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'BR', role: 'Leader', members: [p.name], level: 1, exp: 0 }; break;
    }
    case 'leaveGuild': p.guild = null; break;
    case 'setHud': p.hudLayout = { scale: int(action.scale, 70, 130), opacity: int(action.opacity, 30, 100) }; break;
    case 'mysteryBuy': case 'mysteryClaim': {
      if (!event || event.endsAt <= now || event.startsAt > now) fail('Mystery Shop sedang tidak aktif');
      if (p.mystery?.ev !== event.id) p.mystery = { ev: event.id, spent: 0, claimed: [] };
      const my = p.mystery, give = (id) => grant(p, SKINS[id]?.evo ? 'evo' : SKINS[id] ? 'skin' : 'bundle', id);
      if (action.type === 'mysteryBuy') {
        const m = MYSTERY_ITEMS.find((x) => x.id === action.id);
        if (!m) fail('Barang tidak ada');
        if (p.owned[m.id]) fail('Sudah dimiliki');
        if (p.iron < m.price) fail('Iron tidak cukup');
        p.iron -= m.price; my.spent += m.price; result = give(m.id);
      } else {
        const i = Math.floor(Number(action.index)), m = MYSTERY_MILESTONES[i];
        if (!m) fail('Hadiah tidak ada');
        if (my.claimed.includes(i)) fail('Sudah diklaim');
        if (my.spent < m.spend) fail(`Belanja ${m.spend} Iron dulu`);
        my.claimed.push(i); result = give(m.id);
      }
      break;
    }
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
    case 'splitBundle': {
      const parts = BUNDLE_PARTS[action.id];
      if (!parts || !p.owned[action.id]) fail('Bundle belum dimiliki atau tidak bisa dipisah');
      p.ownedParts ||= {};
      for (const id of Object.values(parts)) p.owned[id] = true;
      result = { parts: Object.values(parts) };
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
      if (action.slot === 'bundle') { OUTFIT.forEach((s) => delete p.equipped[s]); p.eventProgress ||= {}; p.eventProgress.bundles = (p.eventProgress.bundles || 0) + 1; }
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
      p.eventProgress ||= {};
      p.eventProgress.kills = (p.eventProgress.kills || 0) + kills;
      const week = weekKey(now);
      if (p.eventProgress.weekKey !== week) { p.eventProgress.weekKey = week; p.eventProgress.weeklyKills = 0; }
      p.eventProgress.weeklyKills = (p.eventProgress.weeklyKills || 0) + kills;
      p.eventProgress.weaponKills = (p.eventProgress.weaponKills || 0) + kills;
      if (!win) p.eventProgress.deaths = (p.eventProgress.deaths || 0) + 1;
      p.stats.matches++; p.stats.wins += win ? 1 : 0; p.stats.kills += kills; p.stats.assists += assists; p.stats.damage += damage;
      p.matchHistory ||= []; p.matchHistory.unshift({ mode: mode.name, map: action.map || 'Random', kills, assists, damage, survival, placement, total: mode.total, win, at: now, exp }); p.matchHistory = p.matchHistory.slice(0, 30);
      p.blockyPass ||= { xp: 0, claimed: [] }; p.blockyPass.xp = (p.blockyPass.xp || 0) + exp;
      if (p.guild) { p.guild.exp = (p.guild.exp || 0) + exp; p.guild.level = Math.max(1, Math.floor(p.guild.exp / 1000) + 1); }
      result = { exp, base, coin, kills, assists, damage, placement, survival, win, rankBefore: before, rankAfter: p.rank };
      break;
    }
    default: fail('Aksi tidak dikenal');
  }
  p.rank = rankIndex(p.exp);
  return { profile: p, result };
}
