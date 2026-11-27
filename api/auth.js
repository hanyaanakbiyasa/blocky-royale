// Login / daftar username + password, dan login Admin (dari environment variables).
import { randomBytes } from 'node:crypto';
import { admin } from './_lib/firebase.js';
import { hashPw, verifyPw } from './_lib/pw.js';
import { checkAdmin, keyOf } from './_lib/adminauth.js';
import { newProfile, cleanName, GameError } from '../shared/economy.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bad = async (res, msg, code = 400) => { await sleep(600); return res.status(code).json({ error: msg }); };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST' });
  let fb; try { fb = admin(); } catch (e) { console.error(e.message); }
  if (!fb) return res.status(503).json({ error: 'Server belum dikonfigurasi' });
  const b = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  try {
    const pw = String(b.password || ''), now = Date.now();
    const adm = checkAdmin(b.username, pw);
    let uid, claims = {}, name, key;
    if (adm.isAdmin) {
      if (adm.configError) return bad(res, adm.configError, 500);
      if (b.mode !== 'login' || !adm.ok) return bad(res, 'Username atau password salah', 401);
      uid = 'admin'; claims = { admin: true }; name = cleanName(String(b.username).trim().slice(0, 14));
    } else {
      name = cleanName(b.username); key = keyOf(name);
      if (pw.length < 6 || pw.length > 128) return bad(res, 'Password 6-128 karakter');
    }
    if (uid === 'admin') {
      // sudah diverifikasi di atas
    } else if (b.mode === 'register') {
      uid = 'u_' + randomBytes(12).toString('hex');
      const ref = fb.db.collection('accounts').doc(key);
      await fb.db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) throw new GameError('Username sudah dipakai');
        tx.set(ref, { uid, hash: hashPw(pw), createdAt: now });
        tx.set(fb.db.collection('users').doc(uid), newProfile(name, now));
      });
    } else {
      const s = await fb.db.collection('accounts').doc(key).get();
      if (!s.exists || !verifyPw(pw, s.data().hash)) return bad(res, 'Username atau password salah', 401);
      uid = s.data().uid;
    }
    if (uid === 'admin') { // profil admin dibuat sekali
      const ref = fb.db.collection('users').doc('admin');
      if (!(await ref.get()).exists) await ref.set({ ...newProfile(name, now), coin: 999999, iron: 999999 });
    }
    res.status(200).json({ token: await fb.auth.createCustomToken(uid, claims) });
  } catch (err) {
    if (err instanceof GameError) return bad(res, err.message);
    console.error(err); res.status(500).json({ error: 'Kesalahan server: ' + String(err.message).slice(0, 120) });
  }
}
