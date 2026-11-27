// Semua perubahan ekonomi (coin, iron, spin, EXP) diproses di sini agar tidak bisa diubah dari browser.
import { admin } from './_lib/firebase.js';
import { applyAction, newProfile, GameError } from '../shared/economy.js';
import { randomInt } from 'node:crypto';

const rng = () => randomInt(0, 2 ** 30) / 2 ** 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  let fb;
  try { fb = admin(); } catch (e) { console.error('Service account tidak valid', e.message); }
  if (!fb) return res.status(503).json({ error: 'Server belum dikonfigurasi' });

  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  let uid;
  try { uid = (await fb.auth.verifyIdToken(token)).uid; }
  catch { return res.status(401).json({ error: 'Sesi tidak valid' }); }

  const action = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  if (!action || typeof action.type !== 'string') return res.status(400).json({ error: 'Permintaan tidak valid' });

  try {
    const ref = fb.db.collection('users').doc(uid);
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
        : applyAction(current, action, { now, rng });
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
