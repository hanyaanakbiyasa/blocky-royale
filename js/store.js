// Penyimpanan profil: Firebase (online) dengan localStorage sebagai cadangan offline.
import { fb, initFirebase, callServer, signInGuest, signInWithServerToken, isAdminSession } from './firebase.js';
import { newProfile, applyAction } from '../shared/economy.js';

const LOCAL = 'blockyroyale.local';   // progres mode offline
const CACHE = 'blockyroyale.cache';   // salinan profil online
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privat */ } };

export const store = { profile: null, online: false, error: null, admin: false, event: null };
const listeners = new Set();
export const onProfile = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn(store.profile));

function set(profile) {
  store.profile = profile;
  write(store.online ? CACHE : LOCAL, profile);
  emit();
}

function goOffline() {
  if (!store.online) return;
  store.online = false;
  write(LOCAL, store.profile);
  window.dispatchEvent(new CustomEvent('br-offline'));
}

/** Muat data: Firebase, lalu localStorage, lalu null (pengguna baru). */
export async function loadProfile() {
  const ok = await initFirebase();
  if (ok && fb.server) {
    try {
      if (!fb.uid) { store.online = true; return null; } // belum login: tampilkan layar login
      store.admin = await isAdminSession();
      const { profile, event } = await callServer({ type: 'get' });
      store.event = event || null; store.online = true; store.error = null;
      if (profile) { set(profile); await act({ type: 'login' }).catch(() => {}); }
      return store.profile;
    } catch (e) { console.warn('Server tidak terjangkau:', e.message); store.online = false; store.error = 'Server: ' + e.message + ' (buka /api/health)'; }
  } else if (!ok) { store.error = fb.error || 'Firebase tidak aktif (buka /api/health)'; }
  if (store.error) { try { window.__brError = store.error; } catch {} } {
  }
  const local = read(LOCAL) || read(CACHE);
  if (local) set(local);
  return store.profile;
}

let unwatch = null;
function watch() {
  unwatch?.();
  unwatch = fb.fs.onSnapshot(fb.fs.doc(fb.store, 'users', fb.uid), (s) => {
    if (store.online && s.exists() && !s.metadata.fromCache) set(s.data());
  }, (e) => console.warn(e.message));
}

/** Login atau daftar dengan username + password (mode: 'login' | 'register'). */
export async function authenticate(mode, username, password) {
  if (!store.online) throw new Error('Login akun butuh koneksi online');
  try {
    await signInWithServerToken(mode, username, password);
    store.admin = await isAdminSession();
    const { profile } = await callServer({ type: 'get' });
    set(profile);
  } catch (e) { if (!e.rejected) e.message = `Login gagal: ${e.message || 'tidak bisa terhubung ke server'}`; throw e; }
}

export async function createGuest(name) {
  if (store.online) {
    try {
      await signInGuest();
      const { profile } = await callServer({ type: 'create', name });
      set(profile); return;
    } catch (e) { if (e.rejected) throw e; store.online = false; window.dispatchEvent(new CustomEvent('br-offline')); }
  }
  set(newProfile(name, Date.now()));
}

export async function act(action) {
  if (store.online) {
    try {
      const { profile, result } = await callServer(action);
      set(profile); return result;
    } catch (e) {
      if (e.rejected) throw e;
      goOffline();
      // Jangan ulangi aksi: server mungkin sudah memprosesnya
      throw new Error('Koneksi terputus, mode offline. Coba lagi.');
    }
  }
  const { profile, result } = applyAction(store.profile, action);
  set(profile);
  return result;
}

// Sinkron antar tab saat offline
window.addEventListener('storage', (e) => {
  if (!store.online && e.key === LOCAL && e.newValue) { store.profile = read(LOCAL); emit(); }
});
window.addEventListener('offline', goOffline);

/** Keluar dari akun: hapus sesi dan salinan lokal, lalu muat ulang ke layar login. */
export async function logout() {
  try { if (fb.auth) await fb.authMod.signOut(fb.auth); } catch { /* abaikan */ }
  for (const k of [LOCAL, CACHE, 'br_hand']) { try { localStorage.removeItem(k); } catch { /* abaikan */ } }
  location.reload();
}
