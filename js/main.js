// Titik masuk: login guest, lobby, matchmaking, lalu game.
import { store, loadProfile, createGuest, onProfile, act } from './store.js';
import { applySettings } from './settings.js';
import { $, hydrate, toast, renderProfile, initLobby, closeModal, showResults, goLandscape, rankBadge, esc } from './ui.js';
import { createStage } from './preview.js';
import { findMatch } from './net.js';
import { startGame } from './game.js';

applySettings();
hydrate(document);
const show = (id) => { for (const s of ['loading', 'login', 'lobby', 'game']) $(`#${s}`).hidden = s !== id; };

let stage;
function enterLobby() {
  show('lobby');
  if (!stage) {
    stage = createStage($('#stage'));
    initLobby(stage, play);
    onProfile((p) => { renderProfile(p); stage.update(p); });
  }
  stage.setActive(true); renderProfile(store.profile); stage.update(store.profile);
}

let searching = false;
async function play(mode) {
  if (searching) return;
  searching = true;
  closeModal(); goLandscape();
  const box = $('#matchmaking'), status = $('#mmStatus'), found = $('#mmFound'), timer = $('#mmTimer');
  const abort = new AbortController();
  box.hidden = false; found.innerHTML = ''; status.textContent = mode === 'training' ? 'Menyiapkan arena latihan...' : 'Searching for opponent...';
  box.classList.remove('done');
  const t0 = Date.now();
  const tick = setInterval(() => { timer.textContent = `${Math.floor((Date.now() - t0) / 1000)} dtk`; }, 200);
  timer.textContent = '0 dtk';
  $('#mmCancel').onclick = () => abort.abort();
  if (!store.online && mode !== 'training') toast('Koneksi terputus, mode offline');
  try {
    const match = await findMatch(mode, store.profile, abort.signal);
    clearInterval(tick);
    status.textContent = mode === 'training' ? 'Siap!' : 'Match Found!'; box.classList.add('done');
    found.innerHTML = match.roster.filter((r) => !r.me).slice(0, 11).map((r) => `<div>${rankBadge(r.rank, 'sm')} ${esc(r.name)}${r.bot ? ' <small>BOT</small>' : ''}</div>`).join('');
    await new Promise((res, rej) => {
      const t = setTimeout(res, mode === 'training' ? 500 : 2200);
      abort.signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('', 'AbortError')); });
      if (abort.signal.aborted) rej(new DOMException('', 'AbortError'));
    }).catch((e) => { match.net?.leave(); throw e; });
    box.hidden = true; show('game'); stage.setActive(false);
    startGame(match, store.profile, finish);
  } catch (e) {
    box.hidden = true;
    if (e.name !== 'AbortError') { console.error(e); toast('Gagal memulai match'); enterLobby(); }
  } finally { clearInterval(tick); searching = false; }
}

/** Dipanggil game saat selesai. result = null bila pemain keluar dari Training. */
async function finish(result) {
  let rewarded = null;
  if (result.mode !== 'training') {
    // Server menolak hasil yang datang < 20 detik setelah match sebelumnya
    const wait = Math.min(20500, 20500 - (Date.now() - (store.profile.lastMatchAt || 0)));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try { rewarded = await act({ type: 'match', ...result }); }
    catch (e) {
      try { if (!store.online) rewarded = await act({ type: 'match', ...result }); else result.error = e.message; }
      catch (e2) { result.error = e2.message; }
    }
  }
  showResults(result, rewarded, enterLobby);
}

window.addEventListener('br-offline', () => toast('Koneksi terputus, mode offline'));
window.addEventListener('online', () => toast('Internet tersambung. Muat ulang halaman untuk kembali online.'));

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true;
  try { await createGuest($('#loginName').value); enterLobby(); toast('Hadiah pemula: 1.000 Iron'); }
  catch (err) { $('#loginError').textContent = err.message; }
  finally { btn.disabled = false; }
};

loadProfile().catch((e) => { console.error(e); }).then(() => {
  if (store.profile) enterLobby();
  else show('login');
});
