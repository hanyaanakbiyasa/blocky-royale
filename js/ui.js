// Lobby, modal, hasil match, dan animasi Rank Up.
import { ITEMS, SKINS, WEAPONS, AMMO, RANKS, BANNERS, RATES, PITY, SPIN_COST, EVO_MAX, EVO_COST, EVO_PERKS, SLOT_GROUPS, MODES } from '../shared/catalog.js';
import { DAILY_IRON, dayKey } from '../shared/economy.js';
import { store, act } from './store.js';
import { fb } from './firebase.js';
import { settings, saveSettings } from './settings.js';
import { sfx } from './audio.js';
import { icon } from './icons.js';
import { thumb } from './preview.js';

export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const num = (n) => Number(n).toLocaleString('id-ID');
const hydrate = (el) => el.querySelectorAll('[data-icon]').forEach((n) => { n.innerHTML = icon(n.dataset.icon); n.removeAttribute('data-icon'); });
export { hydrate };

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3200);
}
export const rankBadge = (i, cls = '') => {
  const r = RANKS[i] || RANKS[0];
  return `<span class="badge ${r.neon ? 'neon' : ''} ${cls}" style="--a:${r.from};--b:${r.to}">${r.name}</span>`;
};

export function renderProfile(p) {
  const i = p.rank, r = RANKS[i], next = RANKS[i + 1];
  $('#pName').textContent = p.name;
  $('#avatar').textContent = p.name[0].toUpperCase();
  $('#avatar').style.setProperty('--glow', r.from);
  $('#avatar').classList.toggle('neon', !!r.neon);
  $('#pCoin').textContent = num(p.coin); $('#pIron').textContent = num(p.iron); $('#pToken').textContent = num(p.tokens);
  $('#pBadge').innerHTML = rankBadge(i);
  const pct = next ? ((p.exp - r.exp) / (next.exp - r.exp)) * 100 : 100;
  $('#expFill').style.cssText = `width:${pct}%;--a:${r.from};--b:${r.to}`;
  $('#expText').textContent = next ? `${num(p.exp - r.exp)} / ${num(next.exp - r.exp)} EXP` : `${num(p.exp)} EXP (rank tertinggi)`;
  $('#dailyBtn').classList.toggle('ready', p.daily < dayKey(Date.now()));
  $('#netState').innerHTML = store.online ? `${icon('wifi')} Online` : `${icon('wifioff')} Offline`;
  if (openModalName && openModalName !== 'chat' && openModalName !== 'board' && !busy) renderModal();
}

// ---------- Modal ----------
let openModalName = null, cleanup = null, busy = false;
const view = { vault: 'bundle', shop: 'hat', spin: 'superior', last: null };
const TITLES = { vault: 'Vault', shop: 'Shop', spin: 'Spin', chat: 'Global Chat', weapon: 'Weapon', board: 'Leaderboard', settings: 'Settings', admin: 'Panel Admin', daily: 'Hadiah Harian' };

export function openModal(name) {
  closeModal(); openModalName = name;
  $('#modal').hidden = false; $('#modalTitle').textContent = TITLES[name];
  renderModal();
}
export function closeModal() { cleanup?.(); cleanup = null; openModalName = null; $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }

function renderModal() {
  const body = $('#modalBody');
  const scroll = [...body.querySelectorAll('.scroll')].map((e) => e.scrollTop);
  VIEWS[openModalName](body, store.profile);
  hydrate(body);
  body.querySelectorAll('.scroll').forEach((e, i) => { e.scrollTop = scroll[i] || 0; });
}

async function run(action, ok) {
  if (busy) return null;
  busy = true;
  try {
    const result = await act(action);
    if (ok) toast(ok);
    return result;
  } catch (e) { toast(e.message); return null; }
  finally { busy = false; if (openModalName && openModalName !== 'chat' && openModalName !== 'board') renderModal(); }
}

const card = (id, rarity, name, footer) => `<article class="card ${rarity}"><img src="${thumb(id)}" alt=""><h4>${esc(name)}</h4>${footer}</article>`;

const VIEWS = {
  vault(body, p) {
    const tab = view.vault;
    const nav = SLOT_GROUPS.map((g) => `<h5>${g.name}</h5>${g.slots.map(([s, n]) => `<button class="tab ${tab === s ? 'on' : ''}" data-tab="${s}">${n}</button>`).join('')}`).join('')
      + `<h5>Senjata</h5><button class="tab ${tab === 'skins' ? 'on' : ''}" data-tab="skins">Skin Senjata</button>`;
    let content;
    if (tab === 'skins') {
      content = Object.values(SKINS).filter((s) => p.owned[s.id]).map((s) => {
        const on = p.weaponSkins[s.weapon] === s.id, lv = p.evo[s.id] || 1;
        let extra = '';
        if (s.evo) {
          extra = `<div class="evo">${Array.from({ length: EVO_MAX }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div><small>Level ${lv}: ${EVO_PERKS[lv]}</small>`
            + (lv < EVO_MAX ? `<button class="btn alt" data-up="${s.id}">Naik Lv ${lv + 1} (${EVO_COST[lv + 1]} token)</button>` : '<small>Level maksimal</small>');
        }
        return card(s.id, s.rarity, s.name, `${extra}<button class="btn ${on ? 'ghost' : ''}" data-skin="${s.id}">${on ? 'Lepas' : 'Equip'}</button>`);
      }).join('');
    } else {
      content = Object.values(ITEMS).filter((i) => i.slot === tab && p.owned[i.id]).map((i) => {
        const on = p.equipped[tab] === i.id;
        return card(i.id, i.rarity, i.name, `<button class="btn ${on ? 'ghost' : ''}" data-equip="${i.id}">${on ? 'Lepas' : 'Equip'}</button>`);
      }).join('');
    }
    const empty = tab === 'bundle' || tab === 'skins' ? 'Dapatkan dari Spin.' : 'Beli di Shop atau dapatkan dari Spin.';
    body.innerHTML = `<div class="split"><nav class="side scroll">${nav}</nav><div class="grid scroll">${content || `<p class="empty">Belum ada item di kategori ini. ${empty}</p>`}</div></div>`;
    body.onclick = (e) => {
      const d = e.target.closest('button')?.dataset;
      if (!d) return;
      if (d.tab) { view.vault = d.tab; renderModal(); }
      if (d.equip) run({ type: 'equip', slot: view.vault, id: p.equipped[view.vault] === d.equip ? null : d.equip });
      if (d.skin) { const w = SKINS[d.skin].weapon; run({ type: 'equipSkin', weapon: w, id: p.weaponSkins[w] === d.skin ? null : d.skin }); }
      if (d.up) run({ type: 'upgrade', id: d.up }, 'Skin Evo naik level').then((r) => r && sfx.reward());
    };
  },
  shop(body, p) {
    const slots = SLOT_GROUPS.flatMap((g) => g.slots).filter(([s]) => s !== 'bundle');
    body.innerHTML = `<div class="split"><nav class="side scroll">${slots.map(([s, n]) => `<button class="tab ${view.shop === s ? 'on' : ''}" data-tab="${s}">${n}</button>`).join('')}</nav>
      <div class="grid scroll">${Object.values(ITEMS).filter((i) => i.slot === view.shop && i.price).map((i) => card(i.id, i.rarity, i.name,
        p.owned[i.id] ? '<button class="btn ghost" disabled>Dimiliki</button>' : `<button class="btn" data-buy="${i.id}"><span data-icon="coin"></span> ${num(i.price)}</button>`)).join('')}</div></div>`;
    body.onclick = (e) => {
      const d = e.target.closest('button')?.dataset;
      if (d?.tab) { view.shop = d.tab; renderModal(); }
      if (d?.buy) run({ type: 'buy', id: d.buy }, 'Dibeli. Pakai lewat Vault.').then((r) => r && sfx.reward());
    };
  },
  spin(body, p) {
    const b = BANNERS[view.spin];
    const prize = (id) => { const x = ITEMS[id] || SKINS[id]; return `<figure class="${x.rarity} ${p.owned[id] ? 'got' : ''}"><img src="${thumb(id)}" alt=""><figcaption>${esc(x.name)}</figcaption></figure>`; };
    const reward = (r) => {
      if (r.kind === 'token' || r.kind === 'coin') return `<figure><div class="big" data-icon="${r.kind}"></div><figcaption>${r.amount} ${r.kind === 'token' ? 'Token Evo' : 'Coin'}</figcaption></figure>`;
      const x = ITEMS[r.id] || SKINS[r.id];
      return `<figure class="${x.rarity}"><img src="${thumb(r.id)}" alt=""><figcaption>${esc(x.name)}${r.dup ? `<br><small>Duplikat ${r.bonus}</small>` : ''}</figcaption></figure>`;
    };
    body.innerHTML = `<div class="split"><nav class="side scroll">${Object.entries(BANNERS).map(([id, x]) => `<button class="tab banner ${view.spin === id ? 'on' : ''}" style="--c:${x.color}" data-tab="${id}">${x.name}</button>`).join('')}</nav>
      <div class="scroll spinpane" style="--c:${b.color}">
        <header><h3>${b.name}</h3><p>${b.desc}</p></header>
        <div class="wallet"><span><span data-icon="iron"></span> ${num(p.iron)} Iron</span><span><span data-icon="token"></span> ${num(p.tokens)} Token</span></div>
        ${view.last ? `<h5>Hasil spin</h5><div class="prizes result">${view.last.map(reward).join('')}</div>` : ''}
        <div class="spinbtns"><button class="btn" data-spin="1">Spin 1x &middot; ${SPIN_COST[1]} Iron</button><button class="btn gold" data-spin="10">Spin 10x &middot; ${SPIN_COST[10]} Iron</button></div>
        <p class="note">Jaminan Bundle/Evo dalam ${PITY - (p.pity[view.spin] || 0)} spin lagi. Peluang: ${RATES.map(([k, v]) => `${{ bundle: 'Bundle', evo: 'Skin Evo', skin: 'Skin', item: 'Aksesoris', token: 'Token', coin: 'Coin' }[k]} ${v}%`).join(', ')}.</p>
        <h5>Hadiah utama</h5><div class="prizes">${[...b.bundles, ...b.evo, ...b.skins, ...b.items].map(prize).join('')}</div>
      </div></div>`;
    body.onclick = (e) => {
      const d = e.target.closest('button')?.dataset;
      if (d?.tab) { view.spin = d.tab; view.last = null; renderModal(); body.querySelector('.spinpane').scrollTop = 0; }
      if (d?.spin) run({ type: 'spin', banner: view.spin, count: Number(d.spin) }).then((r) => {
        if (!r) return;
        view.last = r.rewards; sfx.reward(); renderModal(); body.querySelector('.spinpane').scrollTop = 0;
      });
    };
  },
  weapon(body, p) {
    body.innerHTML = `<div class="grid scroll wide">${Object.entries(WEAPONS).map(([id, w]) => {
      const bar = (label, v) => `<div class="statbar"><span>${label}</span><i><b style="width:${Math.min(100, v)}%"></b></i></div>`;
      const skin = SKINS[p.weaponSkins[id]];
      return `<article class="card">${skin ? `<img src="${thumb(skin.id)}" alt="">` : ''}<h4>${w.name}</h4><small>${w.cat}${w.ammo ? ` &middot; ${AMMO[w.ammo].name} &middot; mag ${w.mag}` : ' &middot; tanpa peluru'}${w.perShot > 1 ? ` &middot; ${w.perShot} peluru/tembak` : ''}</small>
        ${bar('Damage', (w.dmg * w.pellets) / 1.1)}${bar('Kecepatan', 100 - w.rate * 62)}${bar('Jarak', w.range / 1.8)}${skin ? `<small>Skin: ${esc(skin.name)}</small>` : ''}</article>`;
    }).join('')}</div>`;
    body.onclick = null;
  },
  daily(body, p) {
    const ready = p.daily < dayKey(Date.now());
    body.innerHTML = `<div class="center"><div class="huge" data-icon="gift"></div><h3>${DAILY_IRON} Iron setiap hari</h3><p>Reset pukul 00.00 WIB. Iron dipakai untuk Spin.</p>
      <button class="btn gold" ${ready ? '' : 'disabled'}>${ready ? 'Klaim sekarang' : 'Sudah diklaim hari ini'}</button></div>`;
    body.onclick = (e) => { if (e.target.closest('button')) run({ type: 'daily' }, `+${DAILY_IRON} Iron`).then((r) => r && sfx.reward()); };
  },
  admin(body, p) {
    if (!store.admin) { body.innerHTML = '<p class="empty">Khusus admin.</p>'; return; }
    body.innerHTML = `<div class="adminform scroll">
      <label>Target username (kosongkan = akun admin ini)<input id="aT" maxlength="14" placeholder="username pemain"></label>
      <div class="row"><input id="aN" type="number" min="0" value="1000"><button class="btn" data-op="coin">+ Coin</button><button class="btn" data-op="iron">+ Iron</button><button class="btn" data-op="tokens">+ Token</button></div>
      <div class="row"><select id="aR">${RANKS.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join('')}</select><button class="btn" data-op="rank">Set Rank</button></div>
      <div class="row"><input id="aI" placeholder="ID item / bundle / skin"><button class="btn" data-op="grant">Beri item</button></div>
      <button class="btn gold" data-op="grantAll">Beri SEMUA item, bundle & skin</button>
      <small>Hasil akan terlihat setelah target login ulang atau buka lobby.</small></div>`;
    body.onclick = async (e) => {
      const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
      const r = await run({ type: 'admin', op, target: $('#aT').value, amount: $('#aN').value, rank: $('#aR').value, id: $('#aI').value }, null);
      if (r) toast(`Berhasil untuk ${r.target}`);
    };
  },
  settings(body, p) {
    body.innerHTML = `<form class="form scroll">
      <label>Username<span class="row"><input name="name" maxlength="14" value="${esc(p.name)}"><button class="btn">Ganti (100 Iron)</button></span></label>
      <label>Volume<input type="range" name="volume" min="0" max="1" step="0.05" value="${settings.volume}"></label>
      <label>Sensitivitas kamera<input type="range" name="sensitivity" min="0.3" max="2.5" step="0.1" value="${settings.sensitivity}"></label>
      <label>Tema<select name="theme"><option value="dark">Gelap</option><option value="light">Terang</option></select></label>
      <label>Posisi joystick<select name="joystick"><option value="left">Kiri</option><option value="right">Kanan</option></select></label>
      <button type="button" class="btn ghost" id="fsBtn">Layar penuh</button>
      <p class="note">${store.online ? `Online. ID: ${esc(fb.uid)}` : 'Offline: data disimpan di perangkat ini.'}<br>Total: ${p.stats.matches} match, ${p.stats.wins} menang, ${p.stats.kills} kill, ${p.stats.assists} assist.</p></form>`;
    const f = body.querySelector('form');
    f.theme.value = settings.theme; f.joystick.value = settings.joystick;
    f.onsubmit = (e) => { e.preventDefault(); run({ type: 'rename', name: f.elements.name.value }, 'Username diganti (-100 Iron)'); };
    f.oninput = (e) => { const t = e.target; if (t.name !== 'name') saveSettings({ [t.name]: t.type === 'range' ? Number(t.value) : t.value }); };
    f.querySelector('#fsBtn').onclick = goLandscape;
    body.onclick = null;
  },
  board(body, p) {
    body.innerHTML = '<div class="list scroll"><p class="empty">Memuat...</p></div>'; body.onclick = null;
    const list = body.firstChild;
    const row = (x, i, me) => `<div class="rowitem ${me ? 'me' : ''}"><b>#${i + 1}</b><span>${esc(x.name)}</span>${rankBadge(x.rank)}<span>${num(x.exp)} EXP</span><span>${num(x.kills)} kill</span></div>`;
    if (!store.online) { list.innerHTML = `<p class="empty">Leaderboard global butuh koneksi online. Statistikmu:</p>${row({ ...p, kills: p.stats.kills }, 0, true).replace('#1', '-')}`; return; }
    const { fs } = fb;
    cleanup = fs.onSnapshot(fs.query(fs.collection(fb.store, 'leaderboard'), fs.orderBy('exp', 'desc'), fs.limit(5)),
      (s) => { list.innerHTML = s.docs.map((d, i) => row(d.data(), i, d.id === fb.uid)).join('') || '<p class="empty">Belum ada data.</p>'; },
      () => { list.innerHTML = '<p class="empty">Gagal memuat. Periksa Firestore Rules.</p>'; });
  },
  chat(body, p) {
    const online = store.online && fb.rtdb;
    body.innerHTML = `<div class="chat"><div class="list scroll"></div><form class="row"><input maxlength="120" placeholder="Tulis pesan..." ${online ? '' : 'disabled'}><button class="btn" ${online ? '' : 'disabled'} aria-label="Kirim"><span data-icon="send"></span></button></form></div>`;
    body.onclick = null;
    const list = body.querySelector('.list'), form = body.querySelector('form');
    if (!online) { list.innerHTML = '<p class="empty">Chat global butuh koneksi online (Firebase Realtime Database).</p>'; return; }
    const { db, rtdb } = fb;
    let lastSent = 0;
    cleanup = db.onValue(db.query(db.ref(rtdb, 'chat'), db.limitToLast(40)), (s) => {
      const rows = [];
      s.forEach((c) => { const m = c.val(); rows.push(`<div class="msg ${m.uid === fb.uid ? 'me' : ''}">${rankBadge(m.rank, 'sm')} <b>${esc(m.name)}</b> ${esc(m.text)}</div>`); });
      list.innerHTML = rows.join('') || '<p class="empty">Belum ada pesan.</p>'; list.scrollTop = list.scrollHeight;
    }, () => { list.innerHTML = '<p class="empty">Gagal memuat chat. Periksa Database Rules.</p>'; });
    form.onsubmit = (e) => {
      e.preventDefault();
      const input = form.querySelector('input'), text = input.value.trim();
      if (!text) return;
      if (Date.now() - lastSent < 1500) return toast('Terlalu cepat, tunggu sebentar');
      lastSent = Date.now(); input.value = '';
      db.push(db.ref(rtdb, 'chat'), { uid: fb.uid, name: store.profile.name, rank: store.profile.rank, text, at: db.serverTimestamp() }).catch(() => toast('Pesan gagal dikirim'));
    };
  },
};

export function goLandscape() {
  const el = document.documentElement;
  Promise.resolve(el.requestFullscreen?.()).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
}

// ---------- Hasil match & Rank Up ----------
export function showResults(r, rewarded, onClose) {
  const el = $('#results');
  const time = `${Math.floor(r.survival / 60)}:${String(Math.floor(r.survival % 60)).padStart(2, '0')}`;
  const stat = (l, v) => `<div><small>${l}</small><b>${v}</b></div>`;
  el.innerHTML = `<div class="panel"><h2 class="${r.win ? 'win' : 'lose'}">${r.mode === 'training' ? 'Latihan selesai' : r.win ? 'VICTORY' : 'GAME OVER'}</h2>
    <div class="stats">${stat('Kill', r.kills)}${stat('Assist', r.assists)}${stat('Damage', Math.round(r.damage))}${stat('Survival', time)}${stat('Placement', `#${r.placement}/${r.total}`)}${stat('EXP', rewarded ? `+${rewarded.exp}` : '0')}</div>
    <p>${rewarded ? `EXP dasar ${rewarded.base} + kill ${rewarded.kills * 10}${rewarded.win ? ' + menang 100' : ''}. Coin +${rewarded.coin}.` : r.mode === 'training' ? 'Training tidak memberi EXP.' : esc(r.error || '')}</p>
    <button class="btn gold">Kembali ke Lobby</button></div>`;
  el.hidden = false;
  el.querySelector('button').onclick = () => { el.hidden = true; onClose(); };
  if (rewarded && rewarded.rankAfter > rewarded.rankBefore) showRankUp(rewarded.rankBefore, rewarded.rankAfter);
}

export function showRankUp(from, to) {
  const el = $('#rankup');
  el.innerHTML = `<div class="burst">${Array.from({ length: 48 }, (_, i) => `<i style="--r:${i * 7.5}deg;--d:${120 + (i * 53) % 220}px;--c:${i % 2 ? RANKS[to].from : RANKS[to].to};--t:${(i % 8) * 0.06}s"></i>`).join('')}</div>
    <h2>RANK UP!</h2><div class="swap">${rankBadge(from, 'old')}${rankBadge(to, 'new')}</div><button class="btn gold">Lanjut</button>`;
  el.hidden = false; sfx.rankUp();
  el.querySelector('button').onclick = () => { el.hidden = true; };
}

// ---------- Lobby ----------
export function initLobby(stage, onPlay) {
  let mode = 0;
  const showMode = () => {
    $('#modeList').innerHTML = MODES.map((m, i) => `<span class="${i === mode ? 'on' : ''}">${m.name}</span>`).join('');
    $('#modeDesc').textContent = MODES[mode].desc;
  };
  const step = (d) => { mode = (mode + d + MODES.length) % MODES.length; showMode(); };
  $('#modePrev').onclick = () => step(-1); $('#modeNext').onclick = () => step(1);
  $('#modeList').onclick = (e) => { const i = [...e.currentTarget.children].indexOf(e.target); if (i >= 0) { mode = i; showMode(); } };
  $('#turnL').onclick = () => stage.turn(-0.6); $('#turnR').onclick = () => stage.turn(0.6);
  $('#actions').onclick = (e) => { const b = e.target.closest('button'); if (b) openModal(b.dataset.open); };
  $('#dailyBtn').onclick = () => openModal('daily');
  $('#chatBtn').onclick = () => openModal('chat');
  $('#editName').onclick = () => openModal('settings');
  $('#modalClose').onclick = closeModal;
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });
  $('#playBtn').onclick = () => onPlay(MODES[mode].id);
  document.addEventListener('click', (e) => { if (e.target.closest('button')) sfx.click(); });
  showMode();
}
