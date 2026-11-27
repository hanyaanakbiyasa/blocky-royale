// Matchmaking dan sinkronisasi multiplayer lewat Firebase Realtime Database.
// Pemain hanya dipertemukan dengan rank yang SAMA; sisa slot diisi bot dengan rank sama atau di bawahnya.
import { fb } from './firebase.js';
import { store } from './store.js';
import { seeded } from './world.js';
import { MODES, ITEMS, BANNERS } from '../shared/catalog.js';

const WAIT = 12000;
const NAMES = ['Budi', 'Sari', 'Agus', 'Dewi', 'Joko', 'Putri', 'Rizky', 'Ayu', 'Bayu', 'Nadia', 'Fajar', 'Intan', 'Galih', 'Wulan', 'Dimas', 'Tari', 'Raka', 'Sinta', 'Bagas', 'Mega'];

function makeBots(seed, count, maxRank) {
  const rng = seeded(seed ^ 0x5bd1e995);
  const names = [...NAMES];
  const bundles = Object.values(BANNERS).flatMap((b) => b.bundles);
  const pool = (slot) => Object.values(ITEMS).filter((i) => i.slot === slot).map((i) => i.id);
  return Array.from({ length: count }, (_, i) => {
    const eq = {};
    if (rng() < 0.12) eq.bundle = bundles[Math.floor(rng() * bundles.length)];
    else for (const s of ['hat', 'acc', 'clothes', 'pants', 'shoes']) if (rng() < 0.35) { const p = pool(s); eq[s] = p[Math.floor(rng() * p.length)]; }
    return {
      id: `bot${i}`, bot: true, name: `${names.splice(Math.floor(rng() * names.length), 1)[0]}${Math.floor(rng() * 90) + 10}`,
      rank: Math.max(0, maxRank - Math.floor(rng() * 2)), equipped: eq, weaponSkins: {}, evo: {},
    };
  });
}

const sleep = (ms, signal) => new Promise((res, rej) => {
  const abort = () => rej(new DOMException('Dibatalkan', 'AbortError'));
  if (signal.aborted) return abort();
  const t = setTimeout(res, ms);
  signal.addEventListener('abort', () => { clearTimeout(t); abort(); }, { once: true });
});

const meEntry = (p, id) => ({ id, me: true, name: p.name, rank: p.rank, equipped: p.equipped, weaponSkins: p.weaponSkins, evo: p.evo });

function offlineMatch(mode, profile, seed = (Math.random() * 2 ** 31) | 0) {
  const total = MODES.find((m) => m.id === mode).total;
  return { mode, seed, total, net: null, startAt: null, roster: [meEntry(profile, 'me'), ...makeBots(seed, total - 1, profile.rank)] };
}

export async function findMatch(mode, profile, signal) {
  if (mode === 'training') { await sleep(600, signal); return offlineMatch(mode, profile); }
  if (!store.online || !fb.rtdb) { await sleep(1800 + Math.random() * 1500, signal); return offlineMatch(mode, profile); }
  try { return await onlineMatch(mode, profile, signal); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    console.warn('Matchmaking online gagal:', e.message);
    window.dispatchEvent(new CustomEvent('br-offline'));
    await sleep(800, signal);
    return offlineMatch(mode, profile);
  }
}

async function onlineMatch(mode, profile, signal) {
  const { db, rtdb, uid } = fb;
  const total = MODES.find((m) => m.id === mode).total;
  let offset = 0;
  const stopOffset = db.onValue(db.ref(rtdb, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
  const now = () => Date.now() + offset;
  await sleep(400, signal);

  const queueRef = db.ref(rtdb, `queue/${mode}_${profile.rank}`);
  const fresh = db.push(db.ref(rtdb, 'rooms')).key;
  const seed = (Math.random() * 2 ** 31) | 0;
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
  const tx = await Promise.race([db.runTransaction(queueRef, (q) => {
    const t = now();
    if (q && t - q.createdAt < WAIT - 2000 && Object.keys(q.players || {}).length < total) {
      q.players = { ...q.players, [uid]: true };
      return q;
    }
    return { room: fresh, createdAt: t, seed, players: { [uid]: true } };
  }, { applyLocally: false }), timeout]);
  const q = tx.snapshot.val();
  const base = `rooms/${q.room}`;
  const ref = (p) => db.ref(rtdb, `${base}/${p}`);
  const mine = [ref(`players/${uid}`), ref(`state/${uid}`)];
  const subs = [stopOffset];
  const leave = async () => {
    subs.splice(0).forEach((u) => u());
    try {
      await Promise.all(mine.map((r) => db.remove(r)));
      const left = await db.get(ref('players'));
      if (!left.exists()) await Promise.all(['bots', 'events', 'taken', 'drops'].map((p) => db.remove(ref(p))));
    } catch { /* koneksi sudah putus */ }
  };

  try {
    for (const r of mine) await db.onDisconnect(r).remove();
    await db.set(mine[0], { name: profile.name, rank: profile.rank, look: JSON.stringify([profile.equipped, profile.weaponSkins, profile.evo]) });
    await sleep(Math.max(0, q.createdAt + WAIT - now()), signal);
    const players = (await db.get(ref('players'))).val() || {};
    const ids = Object.keys(players).sort();
    if (ids.length < 2 || !players[uid]) { await leave(); return offlineMatch(mode, profile, q.seed); }
    const humans = ids.map((id) => {
      const p = players[id];
      let look = [{}, {}, {}];
      try { look = JSON.parse(p.look); } catch { /* tampilan default */ }
      return id === uid ? meEntry(profile, uid) : { id, name: String(p.name).slice(0, 14), rank: p.rank, equipped: look[0] || {}, weaponSkins: look[1] || {}, evo: look[2] || {} };
    });

    let present = new Set(ids);
    subs.push(db.onValue(ref('players'), (s) => { present = new Set(Object.keys(s.val() || {})); }));
    const listen = (path, fn) => subs.push(db.onChildAdded(ref(path), (s) => fn(s.val(), s.key)));
    const warn = () => {};
    const net = {
      uid,
      present: () => present,
      isHost: () => [...present].sort()[0] === uid,
      sendState: (s) => db.set(mine[1], s).catch(warn),
      sendBots: (b) => db.set(ref('bots'), b).catch(warn),
      onStates: (fn) => subs.push(db.onValue(ref('state'), (s) => fn(s.val() || {}))),
      onBots: (fn) => subs.push(db.onValue(ref('bots'), (s) => fn(s.val() || {}))),
      event: (e) => db.push(ref('events'), { ...e, by: uid }).catch(warn),
      onEvent: (fn) => listen('events', (e) => { if (e.by !== uid) fn(e); }),
      take: (id) => db.set(ref(`taken/${id}`), uid).then(() => true, () => false), // rules: hanya penulis pertama
      onTaken: (fn) => listen('taken', (v, key) => { if (v !== uid) fn(key); }),
      drop: (item) => db.set(ref(`drops/${item.id}`), item).catch(warn),
      onDrop: (fn) => listen('drops', (v) => fn(v)),
      leave,
    };
    return { mode, seed: q.seed, total, net, startAt: q.createdAt + WAIT + 2500, now, roster: [...humans, ...makeBots(q.seed, total - humans.length, profile.rank)] };
  } catch (e) { await leave(); throw e; }
}
