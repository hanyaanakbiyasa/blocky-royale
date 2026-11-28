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

function offlineMatch(mode, profile, seed = (Math.random() * 2 ** 31) | 0, map = 'andromeda') {
  const total = MODES.find((m) => m.id === mode).total;
  return { mode, map, seed: seed ^ map.split('').reduce((a,c)=>a+c.charCodeAt(0),0), total, net: null, startAt: null, roster: [meEntry(profile, 'me'), ...makeBots(seed, total - 1, profile.rank)] };
}

export async function findMatch(mode, profile, signal, map = 'andromeda', party = null) {
  if (party && mode !== 'training' && mode !== 'social') return onlinePartyMatch(mode, profile, signal, map, party);
  if (mode === 'training' || mode === 'social') { await sleep(600, signal); return offlineMatch(mode, profile, undefined, map); }
  if (!store.online || !fb.rtdb) { await sleep(1800 + Math.random() * 1500, signal); return offlineMatch(mode, profile, undefined, map); }
  try { return await onlineMatch(mode, profile, signal, map); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    console.warn('Matchmaking online gagal:', e.message);
    window.dispatchEvent(new CustomEvent('br-offline'));
    await sleep(800, signal);
    return offlineMatch(mode, profile, undefined, map);
  }
}

async function onlineMatch(mode, profile, signal, map) {
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
    if (ids.length < 2 || !players[uid]) { await leave(); return offlineMatch(mode, profile, q.seed, map); }
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
    return { mode, map, seed: q.seed ^ map.split('').reduce((a,c)=>a+c.charCodeAt(0),0), total, net, startAt: q.createdAt + WAIT + 2500, now, roster: [...humans, ...makeBots(q.seed, total - humans.length, profile.rank)] };
  } catch (e) { await leave(); throw e; }
}


let activeParty = null;
let stopPartyWatch = null;
let stopInviteWatch = null;
const partyEvents = () => window.dispatchEvent(new CustomEvent('br-party-updated', { detail: activeParty }));

export function getActiveParty() { return activeParty; }

export async function publishPlayerPresence(profile) {
  if (!store.online || !fb.rtdb || !fb.uid) return false;
  const { db, rtdb, uid } = fb;
  const r = db.ref(rtdb, `presence/${uid}`);
  await db.set(r, { uid, name: profile.name, nameKey: String(profile.name).toLowerCase(), rank: profile.rank || 0, online: true, updatedAt: db.serverTimestamp() });
  await db.onDisconnect(r).remove();
  const partySnap = await db.get(db.ref(rtdb, `partyByUser/${uid}`));
  if (partySnap.exists()) await watchActiveParty(partySnap.val(), () => {});
  return true;
}

export function watchPartyInvites(onChange) {
  stopInviteWatch?.();
  if (!store.online || !fb.rtdb || !fb.uid) { onChange([]); return () => {}; }
  const { db, rtdb, uid } = fb;
  stopInviteWatch = db.onValue(db.ref(rtdb, `partyInvites/${uid}`), (snap) => {
    const v = snap.val() || {};
    onChange(Object.entries(v).map(([id, invite]) => ({ id, ...invite })));
  });
  return () => { stopInviteWatch?.(); stopInviteWatch = null; };
}

async function findOnlinePlayer(name) {
  const { db, rtdb } = fb;
  const q = db.query(db.ref(rtdb, 'presence'), db.orderByChild('nameKey'), db.equalTo(String(name).trim().toLowerCase()));
  const snap = await db.get(q);
  if (!snap.exists()) throw new Error('Pemain tidak ditemukan atau sedang offline');
  const entries = Object.entries(snap.val());
  if (entries.length !== 1) throw new Error('Username tidak unik di daftar pemain online');
  return { uid: entries[0][0], ...entries[0][1] };
}

export async function watchActiveParty(partyId, onChange) {
  stopPartyWatch?.(); activeParty = null;
  if (!store.online || !fb.rtdb || !partyId) { onChange(null); return () => {}; }
  const { db, rtdb } = fb;
  stopPartyWatch = db.onValue(db.ref(rtdb, `parties/${partyId}`), (snap) => {
    activeParty = snap.exists() ? { id: partyId, ...snap.val() } : null;
    onChange(activeParty); partyEvents();
  });
  return () => { stopPartyWatch?.(); stopPartyWatch = null; };
}

export async function createParty(profile) {
  if (!store.online || !fb.rtdb || !fb.uid) throw new Error('Party online membutuhkan koneksi Firebase');
  const { db, rtdb, uid } = fb;
  const id = db.push(db.ref(rtdb, 'parties')).key;
  const party = { leader: uid, status: 'lobby', createdAt: db.serverTimestamp(), members: {
    [uid]: { uid, name: profile.name, rank: profile.rank || 0, status: 'joined', role: 'leader' }
  }};
  await db.set(db.ref(rtdb, `parties/${id}`), party);
  await db.set(db.ref(rtdb, `partyByUser/${uid}`), id);
  await watchActiveParty(id, () => {});
  return { id, ...party };
}

export async function invitePartyFriend(name, profile) {
  if (!store.online || !fb.rtdb || !fb.uid) throw new Error('Party online membutuhkan koneksi Firebase');
  let party = activeParty;
  if (!party) party = await createParty(profile);
  if (party.leader !== fb.uid) throw new Error('Hanya leader yang bisa mengundang teman');
  const target = await findOnlinePlayer(name);
  if (target.uid === fb.uid) throw new Error('Tidak bisa mengundang akun sendiri');
  if (Object.keys(party.members || {}).length >= 4) throw new Error('Party sudah penuh, maksimal 4 pemain');
  const { db, rtdb, uid } = fb;
  await db.set(db.ref(rtdb, `partyInvites/${target.uid}/${party.id}`), {
    partyId: party.id, leader: uid, leaderName: profile.name, sentAt: db.serverTimestamp()
  });
  return target;
}

export async function respondPartyInvite(invite, accept, profile) {
  if (!store.online || !fb.rtdb || !fb.uid) throw new Error('Koneksi Firebase tidak tersedia');
  const { db, rtdb, uid } = fb;
  const partyRef = db.ref(rtdb, `parties/${invite.partyId}`);
  if (accept) {
    const tx = await db.runTransaction(partyRef, (party) => {
      if (!party || party.status !== 'lobby') return;
      party.members ||= {};
      if (Object.keys(party.members).length >= 4 && !party.members[uid]) return;
      party.members[uid] = { uid, name: profile.name, rank: profile.rank || 0, status: 'joined', role: 'member' };
      return party;
    });
    if (!tx.committed) throw new Error('Party sudah penuh atau tidak menerima anggota baru');
    await db.set(db.ref(rtdb, `partyByUser/${uid}`), invite.partyId);
    await watchActiveParty(invite.partyId, () => {});
  }
  await db.remove(db.ref(rtdb, `partyInvites/${uid}/${invite.partyId}`));
  return accept;
}

export async function removePartyMember(targetUid) {
  if (!activeParty || activeParty.leader !== fb.uid) throw new Error('Hanya leader yang bisa mengeluarkan anggota');
  if (targetUid === fb.uid) throw new Error('Leader tidak bisa mengeluarkan dirinya sendiri');
  const { db, rtdb } = fb;
  await db.remove(db.ref(rtdb, `parties/${activeParty.id}/members/${targetUid}`));
  await db.remove(db.ref(rtdb, `partyByUser/${targetUid}`));
}

export async function leaveParty() {
  if (!activeParty || !fb.rtdb || !fb.uid) return;
  const { db, rtdb, uid } = fb, id = activeParty.id;
  if (activeParty.leader === uid) {
    for (const member of Object.keys(activeParty.members || {})) await db.remove(db.ref(rtdb, `partyByUser/${member}`));
    await db.remove(db.ref(rtdb, `parties/${id}`));
  } else {
    await db.remove(db.ref(rtdb, `parties/${id}/members/${uid}`));
    await db.remove(db.ref(rtdb, `partyByUser/${uid}`));
  }
  stopPartyWatch?.(); stopPartyWatch = null; activeParty = null; partyEvents();
}

export async function requestPartyMatch(mode, map) {
  if (!activeParty || activeParty.leader !== fb.uid) throw new Error('Hanya leader yang bisa memulai match');
  const { db, rtdb } = fb;
  const members = activeParty.members || {};
  const responses = Object.fromEntries(Object.keys(members).map((id) => [id, id === fb.uid ? 'accepted' : 'pending']));
  await db.set(db.ref(rtdb, `parties/${activeParty.id}/matchRequest`), {
    mode, map, status: 'approval', createdAt: db.serverTimestamp(), responses
  });
}

export async function answerPartyMatch(accept) {
  if (!activeParty?.matchRequest || !fb.rtdb) return;
  const { db, rtdb, uid } = fb;
  const pRef = db.ref(rtdb, `parties/${activeParty.id}`);
  const tx = await db.runTransaction(pRef, (p) => {
    if (!p?.matchRequest || p.matchRequest.status !== 'approval' || !p.members?.[uid]) return;
    p.matchRequest.responses ||= {};
    p.matchRequest.responses[uid] = accept ? 'accepted' : 'declined';
    const values = Object.values(p.matchRequest.responses);
    if (values.includes('declined')) p.matchRequest.status = 'cancelled';
    else if (Object.keys(p.members).every((id) => p.matchRequest.responses[id] === 'accepted')) p.matchRequest.status = 'launching';
    return p;
  });
  if (!tx.committed) throw new Error('Permintaan match sudah tidak aktif');
}

export async function onlinePartyMatch(mode, profile, signal, map, party) {
  if (!store.online || !fb.rtdb || !party || party.status !== 'lobby' || party.matchRequest?.status !== 'launching') throw new Error('Party tidak siap atau belum semua anggota menyetujui match');
  if (party.matchRequest.mode !== mode || party.matchRequest.map !== map) throw new Error('Mode atau map party tidak cocok');
  const { db, rtdb, uid } = fb;
  const id = party.id, members = party.members || {};
  if (Object.keys(members).length < 2 || Object.keys(members).length > 4) throw new Error('Party membutuhkan 2 sampai 4 pemain');
  const roomId = `party_${id}_${party.matchRequest?.createdAt || 'session'}`;
  const room = db.ref(rtdb, `rooms/${roomId}`);
  const playersRef = db.ref(rtdb, `rooms/${roomId}/players`);
  const myRef = db.ref(rtdb, `rooms/${roomId}/players/${uid}`);
  await db.set(myRef, { name: profile.name, rank: profile.rank, look: JSON.stringify([profile.equipped, profile.weaponSkins, profile.evo]), squad: id });
  await db.onDisconnect(myRef).remove();
  const waitFor = (path, predicate, timeoutMs = 30000) => new Promise((resolve, reject) => {
    let done = false;
    const stop = db.onValue(db.ref(rtdb, path), (snap) => {
      const value = snap.val();
      if (predicate(value)) { done = true; stop(); resolve(value); }
    });
    const timer = setTimeout(() => { if (!done) { stop(); reject(new Error('Menunggu anggota party timeout')); } }, timeoutMs);
    signal.addEventListener('abort', () => { clearTimeout(timer); stop(); reject(new DOMException('Dibatalkan', 'AbortError')); }, { once: true });
  });
  try {
    if (party.leader === uid) {
      const ids = Object.keys(members);
      await waitFor(`rooms/${roomId}/players`, (v) => v && ids.every((member) => v[member]));
      const players = (await db.get(playersRef)).val() || {};
      const seed = (Math.random() * 2 ** 31) | 0;
      const startAt = Date.now() + 4500;
      await db.set(db.ref(rtdb, `rooms/${roomId}/launch`), { seed, startAt, mode, map, total: MODES.find((m) => m.id === mode).total, squad: id });
      const humans = Object.keys(players).map((playerId) => {
        const player = players[playerId]; let look = [{}, {}, {}];
        try { look = JSON.parse(player.look); } catch {}
        return { id: playerId, me: playerId === uid, name: String(player.name).slice(0,14), rank: player.rank || 0, equipped: look[0] || {}, weaponSkins: look[1] || {}, evo: look[2] || {}, squad: id };
      });
      const total = MODES.find((m) => m.id === mode).total;
      const roster = humans;
      const net = createPartyRoomNet(db, rtdb, roomId, uid, playersRef, myRef);
      return { mode, map, seed, total, net, startAt, now: () => Date.now(), roster: [...roster, ...makeBots(seed, Math.max(0,total-roster.length), profile.rank)], squadId: id };
    }
    const launch = await waitFor(`rooms/${roomId}/launch`, (v) => !!v);
    const players = (await db.get(playersRef)).val() || {};
    const humans = Object.keys(players).map((playerId) => {
      const player = players[playerId]; let look = [{}, {}, {}];
      try { look = JSON.parse(player.look); } catch {}
      return { id: playerId, me: playerId === uid, name: String(player.name).slice(0,14), rank: player.rank || 0, equipped: look[0] || {}, weaponSkins: look[1] || {}, evo: look[2] || {}, squad: id };
    });
    const total = MODES.find((m) => m.id === mode).total;
    const net = createPartyRoomNet(db, rtdb, roomId, uid, playersRef, myRef);
    return { mode, map, seed: launch.seed, total, net, startAt: launch.startAt, now: () => Date.now(), roster: [...humans, ...makeBots(launch.seed, Math.max(0,total-humans.length), profile.rank)], squadId: id };
  } catch (e) {
    await db.remove(myRef).catch(() => {});
    throw e;
  }
}

function createPartyRoomNet(db, rtdb, roomId, uid, playersRef, myRef) {
  const ref = (path) => db.ref(rtdb, `rooms/${roomId}/${path}`);
  const stops = [];
  const present = new Set();
  stops.push(db.onValue(playersRef, (s) => { present.clear(); Object.keys(s.val() || {}).forEach((id) => present.add(id)); }));
  const listen = (path, fn) => stops.push(db.onChildAdded(ref(path), (s) => fn(s.val(), s.key)));
  return {
    uid, present: () => present, isHost: () => [...present].sort()[0] === uid,
    sendState: (s) => db.set(ref(`state/${uid}`), s).catch(() => {}),
    sendBots: (b) => db.set(ref('bots'), b).catch(() => {}),
    onStates: (fn) => stops.push(db.onValue(ref('state'), (s) => fn(s.val() || {}))),
    onBots: (fn) => stops.push(db.onValue(ref('bots'), (s) => fn(s.val() || {}))),
    event: (e) => db.push(ref('events'), { ...e, by: uid }).catch(() => {}),
    onEvent: (fn) => listen('events', (e) => { if (e.by !== uid) fn(e); }),
    take: (item) => db.set(ref(`taken/${item}`), uid).then(() => true, () => false),
    onTaken: (fn) => listen('taken', (v, key) => { if (v !== uid) fn(key); }),
    drop: (item) => db.set(ref(`drops/${item.id}`), item).catch(() => {}),
    onDrop: (fn) => listen('drops', (v) => fn(v)),
    leave: async () => { stops.splice(0).forEach((stop) => stop()); await db.remove(myRef).catch(() => {}); }
  };
}
