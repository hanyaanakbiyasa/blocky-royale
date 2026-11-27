// Diagnosis koneksi: buka https://DOMAIN-KAMU/api/health untuk melihat langkah mana yang gagal.
import { admin } from './_lib/firebase.js';
import { hashFormatOk } from './_lib/adminauth.js';

export default async function handler(req, res) {
  const e = process.env, out = { env: {}, steps: [] };
  for (const k of ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_DATABASE_URL', 'FIREBASE_APP_ID', 'FIREBASE_SERVICE_ACCOUNT', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH'])
    out.env[k] = e[k] ? 'terisi' : 'KOSONG';
  const step = async (name, fn) => {
    try { out.steps.push({ name, ok: true, info: await fn() }); return true; }
    catch (err) { out.steps.push({ name, ok: false, error: String(err.message || err).slice(0, 300), hint: hint(err) }); return false; }
  };
  await step('Konfigurasi admin', async () => {
    const strip = (v) => String(v ?? '').trim().replace(/^['"`]+|['"`]+$/g, '').trim();
    if (!strip(e.ADMIN_USERNAME)) throw new Error('ADMIN_USERNAME kosong');
    if (!hashFormatOk(strip(e.ADMIN_PASSWORD_HASH))) throw new Error('ADMIN_PASSWORD_HASH kosong atau salah format (harus scrypt:salt:hash dari scripts/hash.mjs)');
    return `siap, username admin ${strip(e.ADMIN_USERNAME).length} karakter`;
  });
  let fb;
  if (await step('Baca service account', () => { fb = admin(); if (!fb) throw new Error('FIREBASE_SERVICE_ACCOUNT kosong'); return 'valid'; })) {
    await step('Firestore (server)', async () => { await fb.db.collection('users').limit(1).get(); return 'tersambung'; });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}

function hint(err) {
  const m = String(err.message || err);
  if (/NOT_FOUND|5 NOT_FOUND/.test(m)) return 'Firestore belum dibuat (Build > Firestore Database > Create database) di project yang sama.';
  if (/PERMISSION_DENIED|7 PERMISSION/.test(m)) return 'Service account tidak punya izin atau Firestore API belum aktif.';
  if (/JSON|private_key|PEM|Unexpected token/.test(m)) return 'Isi FIREBASE_SERVICE_ACCOUNT rusak. Tempel ulang seluruh JSON, atau pakai versi base64 satu baris.';
  return 'Periksa Vercel > Logs.';
}
