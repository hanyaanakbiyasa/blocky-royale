// Koneksi Firebase. Konfigurasi diambil dari /api/config (Environment Variables Vercel).
// Alternatif: isi LOCAL_CONFIG di bawah bila ingin menulis langsung di file.
const LOCAL_CONFIG = {
  apiKey: '',       // FIREBASE_API_KEY
  authDomain: '',   // FIREBASE_AUTH_DOMAIN
  projectId: '',    // FIREBASE_PROJECT_ID
  databaseURL: '',  // FIREBASE_DATABASE_URL
  appId: '',        // FIREBASE_APP_ID
};
const SDK = 'https://www.gstatic.com/firebasejs/12.0.0';

export const fb = { ready: false, uid: null, server: false };

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function initFirebase() {
  try {
    let config = null;
    try {
      const r = await withTimeout(fetch('/api/config'), 6000);
      if (r.ok) { const j = await r.json(); config = j.firebase; fb.server = j.server; }
    } catch { /* dibuka tanpa server */ }
    if (!config && LOCAL_CONFIG.apiKey) { config = LOCAL_CONFIG; fb.server = true; }
    if (!config) return false;
    const [app, auth, fs, db] = await withTimeout(Promise.all(
      ['app', 'auth', 'firestore', 'database'].map((m) => import(`${SDK}/firebase-${m}.js`))), 15000);
    const instance = app.initializeApp(config);
    const a = auth.getAuth(instance);
    await withTimeout(a.authStateReady(), 10000);
    if (!a.currentUser) await withTimeout(auth.signInAnonymously(a), 10000);
    Object.assign(fb, { ready: true, uid: a.currentUser.uid, auth: a, fs, db, store: fs.getFirestore(instance) });
    if (config.databaseURL) fb.rtdb = db.getDatabase(instance);
    return true;
  } catch (e) {
    console.warn('Firebase tidak aktif:', e.message);
    return false;
  }
}

export async function callServer(action) {
  const token = await fb.auth.currentUser.getIdToken();
  const r = await withTimeout(fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(action),
  }), 12000);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || `Server error ${r.status}`); e.rejected = r.status === 400; throw e; }
  return j;
}
