// Penyimpanan profil: Firebase (online) dengan localStorage sebagai cadangan offline.
import { fb, initFirebase, callServer } from './firebase.js';
import { newProfile, applyAction } from '../shared/economy.js';

const LOCAL = 'blockyroyale.local';   // progres mode offline
const CACHE = 'blockyroyale.cache';   // salinan profil online
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privat */ } };

export const store = { profile: null, online: false };
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
      const ref = fb.fs.doc(fb.store, 'users', fb.uid);
      const snap = await fb.fs.getDocFromServer(ref);
      store.online = true;
      if (snap.exists()) { set(snap.data()); await act({ type: 'login' }).catch(() => {}); watch(); }
      return store.profile;
    } catch (e) { console.warn('Database tidak terjangkau:', e.message); store.online = false; }
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

export async function createGuest(name) {
  if (store.online) {
    try {
      const { profile } = await callServer({ type: 'create', name });
      set(profile); watch(); return;
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
