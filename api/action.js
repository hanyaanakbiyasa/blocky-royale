// Semua perubahan ekonomi (coin, iron, spin, EXP) diproses di sini agar tidak bisa diubah dari browser.
import { admin } from './_lib/firebase.js';
import { applyAction, newProfile, GameError } from '../shared/economy.js';
import { ITEMS, SKINS, RANKS, CHARACTERS, rankIndex } from '../shared/catalog.js';
import { randomInt } from 'node:crypto';

const rng = () => randomInt(0, 2 ** 30) / 2 ** 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  let fb;
  try { fb = admin(); } catch (e) { console.error('Service account tidak valid', e.message); }
  if (!fb) return res.status(503).json({ error: 'Server belum dikonfigurasi' });

  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  let uid, isAdmin = false;
  try { const d = await fb.auth.verifyIdToken(token); uid = d.uid; isAdmin = d.admin === true; }
  catch { return res.status(401).json({ error: 'Sesi tidak valid' }); }

  const action = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!action || typeof action.type !== 'string') return res.status(400).json({ error: 'Permintaan tidak valid' });

  try {
    const ref = fb.db.collection('users').doc(uid);
    if (action.type === 'admin') {
      if (!isAdmin) return res.status(403).json({ error: 'Bukan admin' });
      const out = await adminOp(fb, uid, action);
      return res.status(200).json(out);
    }
    const evSnap = await fb.db.collection('config').doc('mystery').get();
    const event = evSnap.exists ? evSnap.data() : null;
    if (action.type === 'get') { const s = await ref.get(); return res.status(200).json({ profile: s.exists ? s.data() : null, event, admin: isAdmin }); }
    const out = await fb.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      let current = snap.exists ? snap.data() : null;
      if (!current) {
        if (action.type !== 'create') throw new GameError('Profil belum dibuat');
        current = newProfile(action.name, now);
      }
      const { profile, result } = action.type === 'create'
        ? { profile: current, result: {} }
        : applyAction(current, action, { now, rng, event });
      tx.set(ref, profile);
      tx.set(fb.db.collection('leaderboard').doc(uid), {
        name: profile.name, exp: profile.exp, rank: profile.rank, kills: profile.stats.kills, wins: profile.stats.wins,
      });
      return { profile, result };
    });
    res.status(200).json(out);
  } catch (e) {
    if (e instanceof GameError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Kesalahan server' });
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

const amt = (v) => Math.min(1e9, Math.max(0, Math.floor(Number(v) || 0)));

/** Operasi admin pada profil target (kosong = diri sendiri). Mengembalikan profil admin sendiri. */
async function adminOp(fb, adminUid, a) {
  if (a.op === 'mysteryStart' || a.op === 'mysteryStop') {
    const days = Math.min(30, Math.max(1, Math.floor(Number(a.amount) || 7))), now = Date.now();
    const ev = a.op === 'mysteryStop' ? null : { id: 'm' + now, title: String(a.id || 'Mystery Shop').slice(0, 40) || 'Mystery Shop', startsAt: now, endsAt: now + days * 86400e3 };
    const ref = fb.db.collection('config').doc('mystery');
    if (ev) await ref.set(ev); else await ref.delete();
    const me = await fb.db.collection('users').doc(adminUid).get();
    return { profile: me.data(), result: { target: ev ? `Mystery Shop (${days} hari)` : 'Event dihentikan', event: ev } };
  }
  let tuid = adminUid;
  const tname = String(a.target || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (tname) {
    const s = await fb.db.collection('accounts').doc(tname).get();
    if (!s.exists) throw new GameError('Username target tidak ditemukan');
    tuid = s.data().uid;
  }
  const ref = fb.db.collection('users').doc(tuid), mine = fb.db.collection('users').doc(adminUid);
  return fb.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); const myProfile = tuid === adminUid ? snap : await tx.get(mine);
    if (!snap.exists) throw new GameError('Profil target tidak ada');
    const p = snap.data();
    switch (a.op) {
      case 'coin': p.coin += amt(a.amount); break;
      case 'iron': p.iron += amt(a.amount); break;
      case 'tokens': p.tokens += amt(a.amount); break;
      case 'rank': { const i = Math.min(RANKS.length - 1, Math.max(0, Math.floor(Number(a.rank) || 0))); p.exp = RANKS[i].exp; p.rank = rankIndex(p.exp); break; }
      case 'grantAll':
        for (const id of [...Object.keys(ITEMS), ...Object.keys(SKINS), ...Object.keys(CHARACTERS)]) { p.owned[id] = true; if (SKINS[id]?.evo && !p.evo[id]) p.evo[id] = 1; }
        break;
      case 'grant': {
        const id = String(a.id || '');
        if (!ITEMS[id] && !SKINS[id] && !CHARACTERS[id]) throw new GameError('ID item tidak dikenal');
        p.owned[id] = true; if (SKINS[id]?.evo && !p.evo[id]) p.evo[id] = 1; break;
      }
      default: throw new GameError('Operasi admin tidak dikenal');
    }
    tx.set(ref, p);
    tx.set(fb.db.collection('leaderboard').doc(tuid), { name: p.name, exp: p.exp, rank: p.rank, kills: p.stats.kills, wins: p.stats.wins });
    return { profile: tuid === adminUid ? p : myProfile.data(), result: { target: p.name } };
  });
}
