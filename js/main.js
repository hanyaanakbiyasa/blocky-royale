import { SKINS, EVO_MAX } from '../shared/catalog.js';
// Titik masuk: login guest, lobby, matchmaking, lalu game.
import { store, loadProfile, createGuest, authenticate, onProfile, act } from './store.js';
import { startWar } from './war.js';
import { applySettings } from './settings.js';
import { $, hydrate, toast, renderProfile, initLobby, closeModal, showResults, goLandscape, rankBadge, esc } from './ui.js';
import { createStage } from './preview.js';
import { findMatch } from './net.js';
import { startGame } from './game.js';

applySettings();
hydrate(document);
const stopWar = (() => { let stop = startWar($('#war')); return () => { stop?.(); stop = null; $('#war').hidden = true; }; })();
const show = (id) => { for (const s of ['loading', 'login', 'lobby', 'game']) $(`#${s}`).hidden = s !== id; if (id === 'lobby' || id === 'game') stopWar(); };
const setPct = (n) => { n = Math.min(100, Math.round(n)); $('#loadFill').style.width = n + '%'; $('#loadPct').textContent = n + '%'; };
let pct = 0; const prog = setInterval(() => { pct += (90 - pct) * 0.04; setPct(pct); }, 80);

const quick = (m) => m === 'training' || m === 'social';
let stage;
function enterLobby() {
  show('lobby'); $('#adminBtn').hidden = !store.admin;
  if (!stage) {
    stage = createStage($('#stage'));
    initLobby(stage, play);
    stage.setHand(localStorage.getItem('br_hand'));
    document.addEventListener('br-hand', (e) => { localStorage.setItem('br_hand', e.detail); stage.setHand(e.detail); });
    stage.onHand = (id) => { localStorage.setItem('br_hand', id); toast(`${SKINS[id].name} kini di tanganmu`); };
    const menu = $('#emoteMenu');
    const EMO = [['wave', 'Melambai'], ['laugh', 'Tertawa'], ['angry', 'Marah'], ['sit', 'Duduk']];
    stage.onTap = () => {
      const finals = Object.keys(SKINS).filter((id) => SKINS[id].evo && (store.profile.evo?.[id] || 0) >= EVO_MAX);
      menu.innerHTML = EMO.map(([k, n]) => `<button data-e="${k}">${n}</button>`).join('')
        + finals.map((id) => `<button class="final" data-s="${id}">Final: ${SKINS[id].name}</button>`).join('')
        + (finals.length ? '' : '<small>Emote final terbuka saat Level Gun mencapai MAX</small>');
      menu.hidden = false;
    };
    menu.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      stage.emote(b.dataset.s ? { skin: b.dataset.s } : { name: b.dataset.e }); menu.hidden = true;
    };
    $('#stage').addEventListener('pointerdown', () => { menu.hidden = true; });
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
  box.hidden = false; found.innerHTML = ''; status.textContent = quick(mode) ? 'Menyiapkan arena latihan...' : 'Searching for opponent...';
  box.classList.remove('done');
  const t0 = Date.now();
  const tick = setInterval(() => { timer.textContent = `${Math.floor((Date.now() - t0) / 1000)} dtk`; }, 200);
  timer.textContent = '0 dtk';
  $('#mmCancel').onclick = () => abort.abort();
  if (!store.online && !quick(mode)) toast('Koneksi terputus, mode offline');
  try {
    const match = await findMatch(mode, store.profile, abort.signal);
    clearInterval(tick);
    status.textContent = quick(mode) ? 'Siap!' : 'Match Found!'; box.classList.add('done');
    found.innerHTML = match.roster.filter((r) => !r.me).slice(0, 11).map((r) => `<div>${rankBadge(r.rank, 'sm')} ${esc(r.name)}${r.bot ? ' <small>BOT</small>' : ''}</div>`).join('');
    await new Promise((res, rej) => {
      const t = setTimeout(res, quick(mode) ? 500 : 2200);
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
  if (!quick(result.mode)) {
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

const LABEL = { guest: 'Masuk sebagai Guest', login: 'Login', register: 'Daftar & Masuk' };
$('#authTabs').onclick = (e) => {
  const m = e.target.dataset.m; if (!m) return;
  $('#loginForm').dataset.mode = m; $('#loginBtn').textContent = LABEL[m]; $('#loginError').textContent = '';
  $('#loginPass').required = m !== 'guest';
  for (const b of $('#authTabs').children) b.classList.toggle('on', b === e.target);
};
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn'); btn.disabled = true; $('#loginError').textContent = '';
  const mode = $('#loginForm').dataset.mode;
  try {
    if (mode === 'guest') await createGuest($('#loginName').value);
    else await authenticate(mode, $('#loginName').value, $('#loginPass').value);
    enterLobby(); if (mode !== 'login') toast('Hadiah pemula: 1.000 Iron');
  }
  catch (err) { $('#loginError').textContent = err.message; }
  finally { btn.disabled = false; }
};

loadProfile().catch((e) => { console.error(e); }).then(async () => {
  clearInterval(prog); setPct(100); $('#loadText').textContent = 'Siap!'; await new Promise((r) => setTimeout(r, 450));
  if (store.error) toast(store.error);
  if (store.profile) enterLobby();
  else show('login');
});
