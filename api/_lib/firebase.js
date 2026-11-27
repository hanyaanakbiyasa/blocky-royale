import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Baca FIREBASE_SERVICE_ACCOUNT: JSON asli, JSON dalam tanda kutip, atau base64. */
export function parseServiceAccount(raw) {
  let s = String(raw || '').trim().replace(/^['"`]|['"`]$/g, '').trim();
  if (!s.startsWith('{')) s = Buffer.from(s, 'base64').toString('utf8');
  const j = JSON.parse(s);
  if (typeof j.private_key === 'string') j.private_key = j.private_key.replace(/\\n/g, '\n');
  return j;
}

/** Mengembalikan null bila env FIREBASE_SERVICE_ACCOUNT belum diisi. Melempar error bila isinya salah. */
export function admin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  if (!getApps().length) initializeApp({ credential: cert(parseServiceAccount(raw)) });
  return { auth: getAuth(), db: getFirestore() };
}
