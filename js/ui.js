// Lobby, modal, hasil match, dan animasi Rank Up.
import { ITEMS, SKINS, WEAPONS, AMMO, RANKS, BANNERS, RATES, PITY, SPIN_COST, EVO_MAX, EVO_COST, EVO_PERKS, SLOT_GROUPS, MODES, MYSTERY_ITEMS, MYSTERY_MILESTONES, CHARACTERS, GLOO_SKINS, AVATARS, MAPS } from '../shared/catalog.js';
import { DAILY_IRON, dayKey } from '../shared/economy.js';
import { store, act, logout } from './store.js';
import { fb } from './firebase.js';
import { invitePartyFriend, watchPartyInvites, watchActiveParty, respondPartyInvite, requestPartyMatch, answerPartyMatch, leaveParty, removePartyMember, getActiveParty } from './net.js';
import { settings, saveSettings } from './settings.js';
import { sfx } from './audio.js';
import { icon } from './icons.js';
import { thumb } from './preview.js';
import * as THREE from 'three';
import { createCharacter } from './character.js';

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
  $('#avatar').style.backgroundImage = p.avatar ? `url("avatars/png/${encodeURIComponent(p.avatar)}.png")` : '';
  $('#avatar').classList.toggle('has-avatar', !!p.avatar);
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
let openModalName = null, cleanup = null, previewCleanup = null, busy = false;
const view = { vault: 'bundle', shop: 'hat', spin: 'superior', last: null, char: 'c_adam', charPage: 'collection' };
const TITLES = { pets: 'Pet Collection', guild: 'Guild', pass: 'Blocky Pass', history: 'Match History', emotes: 'Emote Collection', achievements: 'Achievement', hud: 'HUD Customization', vault: 'Vault', shop: 'Shop', spin: 'Spin', chat: 'Global Chat', weapon: 'Weapon', board: 'Leaderboard', settings: 'Settings', admin: 'Panel Admin', mystery: 'Mystery Shop', chars: 'Character Preset', daily: 'Hadiah Harian', newbie: 'Newbie Daily', events: 'Events', avatars: 'Avatar Profile', gloo: 'Gloo Wall', friends: 'Friends' };

export function openModal(name) {
  closeModal(); openModalName = name;
  if (name === 'chars') view.charPage = 'presets';
  $('#modal').hidden = false; $('#modalTitle').textContent = TITLES[name];
  renderModal();
}
export function closeModal() { cleanup?.(); cleanup = null; previewCleanup?.(); previewCleanup = null; openModalName = null; $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }

function renderModal() {
  previewCleanup?.(); previewCleanup = null;
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

function mountCharacterPreview(canvas, profile, characterId) {
  if (!canvas) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return; }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x34344d, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(3, 5, 4); scene.add(light);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30); camera.position.set(0, 1.35, 5.2); camera.lookAt(0, 1.05, 0);
  const avatar = createCharacter(profile.equipped || {}); scene.add(avatar.root); avatar.animate(0, 'idle');
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 6), new THREE.MeshStandardMaterial({color:0x25253a,metalness:.35,roughness:.55})); platform.position.y=-.08; scene.add(platform);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05,.025,8,48),new THREE.MeshBasicMaterial({color:0xfbbf24})); ring.rotation.x=Math.PI/2; ring.position.y=-.005; scene.add(ring);
  let active=true, angle=.35, drag=null, last=0, raf=0;
  const resize=()=>{const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
  const down=e=>{drag=e.clientX;canvas.setPointerCapture?.(e.pointerId)}; const move=e=>{if(drag!==null){angle+=(e.clientX-drag)*.012;drag=e.clientX}}; const up=()=>{drag=null};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);window.addEventListener('resize',resize);resize();
  const frame=t=>{if(!active)return;raf=requestAnimationFrame(frame);avatar.root.rotation.y=angle;avatar.animate(t/1000,'idle');renderer.render(scene,camera)};raf=requestAnimationFrame(frame);
  previewCleanup=()=>{active=false;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);avatar.root.traverse(o=>{o.geometry?.dispose?.();if(o.material&&!Array.isArray(o.material))o.material.dispose?.()});renderer.dispose()};
}

const VIEWS = {
  vault(body, p) {
    const tab = view.vault;
    const nav = SLOT_GROUPS.map((g) => `<h5>${g.name}</h5>${g.slots.map(([s, n]) => `<button class="tab ${tab === s ? 'on' : ''}" data-tab="${s}">${n}</button>`).join('')}`).join('')
      + `<h5>Senjata</h5><button class="tab ${tab === 'skins' ? 'on' : ''}" data-tab="skins">Skin Senjata</button>`;
    let content;
    if (tab === 'bundle') {
      content = Object.values(ITEMS).filter((i) => i.slot === 'bundle' && p.owned[i.id]).map((i) => card(i.id, i.rarity, i.name, `<button class="btn alt" data-split="${i.id}">Pisahkan menjadi item</button><button class="btn" data-equip="${i.id}">Pakai Bundle</button>`)).join('');
    } else if (tab === 'skins') {
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
      if (d.split) run({ type: 'splitBundle', id: d.split }, 'Bundle dipecah menjadi item terpisah. Cek kategori outfit di Vault.');
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
    const prize = (id) => { const x = ITEMS[id] || SKINS[id]; const skill = x.skill ? ({ sandal: 'Pasif: Sendal Jepit', chicken: 'Pasif: Ayam Goreng', scan: 'Pasif: Deteksi Musuh' }[x.skill.type]) : ''; return `<figure class="${x.rarity} ${p.owned[id] ? 'got' : ''}" title="${esc(skill || x.name)}"><img src="${thumb(id)}" alt=""><figcaption>${esc(x.name)}${skill ? `<br><small>${esc(skill)}</small>` : ''}</figcaption></figure>`; };
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
        <h5>Hadiah utama</h5><div class="prizes">${[...b.bundles, ...b.evo, ...b.skins, ...b.items].map(prize).join('')}</div>${view.spin === 'kampung' ? `<div class="note kampung-skills"><b>Mythical Passive</b><p>Upin: tembakan berpeluang melempar sendal dan memberi knockback.</p><p>Ipin: tembakan berpeluang melontarkan musuh selama 2 detik.</p><p>Jarjit: topeng biru berpeluang menandai musuh di balik dinding pada minimap.</p><p>Ehsan, Fizi, dan Mail: bundle kosmetik biasa tanpa skill.</p></div>` : ''}
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
        ${bar('Damage', (w.dmg * w.pellets) / 1.1)}${bar('Kecepatan', 100 - w.rate * 62)}${bar('Jarak', w.range / 1.8)}${skin ? `<small>Skin: ${esc(skin.name)} · bonus damage ${skin.evo ? 'hingga 15%' : '5%'}</small>` : ''}<button class="btn" data-hand="${skin ? skin.id : id}">Pegang di tangan</button></article>`;
    }).join('')}</div>`;
    body.onclick = (e) => {
      const b = e.target.closest('[data-hand]'); if (!b) return;
      document.dispatchEvent(new CustomEvent('br-hand', { detail: b.dataset.hand })); toast('Senjata dipegang di lobby');
    };
  },
  daily(body, p) {
    const ready = p.daily < dayKey(Date.now());
    body.innerHTML = `<div class="center"><div class="huge" data-icon="gift"></div><h3>${DAILY_IRON} Iron setiap hari</h3><p>Reset pukul 00.00 WIB. Iron dipakai untuk Spin.</p>
      <button class="btn gold" ${ready ? '' : 'disabled'}>${ready ? 'Klaim sekarang' : 'Sudah diklaim hari ini'}</button></div>`;
    body.onclick = (e) => { if (e.target.closest('button')) run({ type: 'daily' }, `+${DAILY_IRON} Iron`).then((r) => r && sfx.reward()); };
  },
  friends(body, p) {
    let invites = [];
    let party = getActiveParty();
    let launched = false;
    const render = () => {
      const friends = p.friends || [];
      const members = Object.values(party?.members || {});
      const request = party?.matchRequest;
      const isLeader = party?.leader === fb.uid;
      const incoming = invites.map((i) => `<div class="rowitem"><b>${esc(i.leaderName)}</b><small>Undangan party</small><button class="btn gold" data-accept="${esc(i.id)}">Terima</button><button class="btn ghost" data-decline="${esc(i.id)}">Tolak</button></div>`).join('');
      const roster = members.map((m, i) => `<div class="rowitem"><b>${i + 1}) ${esc(m.name)}</b><small>${m.uid === party.leader ? 'Leader' : m.status === 'joined' ? 'Bergabung' : m.status}</small>${isLeader && m.uid !== fb.uid ? `<button class="btn ghost" data-kick="${esc(m.uid)}">Keluarkan</button>` : ''}</div>`).join('');
      let matchControls = '';
      if (request?.status === 'approval') { launched = false;
        const response = request.responses?.[fb.uid] || 'pending';
        matchControls = isLeader ? `<p>Menunggu persetujuan anggota: ${Object.values(request.responses || {}).filter(x=>x==='accepted').length}/${members.length}</p>` : response === 'pending' ? `<p>Leader meminta persetujuan untuk memulai match.</p><button class="btn gold" data-ready>Setuju</button><button class="btn ghost" data-reject>Tolak</button>` : `<p>Status persetujuan: ${response}</p>`;
      } else if (request?.status === 'launching') matchControls = '<p class="success">Semua anggota setuju. Menyiapkan match...</p>';
      else if (request?.status === 'cancelled') matchControls = '<p class="note">Permintaan match dibatalkan.</p>';
      body.innerHTML = `<div class="scroll"><form class="row" id="friendForm"><input name="friend" maxlength="14" placeholder="Username teman"><button class="btn">Tambah</button></form><div class="list">${friends.map(n=>`<div class="rowitem"><b>${esc(n)}</b><small>Teman tersimpan</small><button class="btn alt" data-invite="${esc(n)}">Undang</button><button class="btn ghost" data-remove="${esc(n)}">Hapus</button></div>`).join('')||'<p class="empty">Belum ada teman. Tambahkan username untuk mulai bermain bersama.</p>'}</div><section class="panel partybox"><h3>Undangan Masuk</h3><div class="list">${incoming || '<p class="empty">Tidak ada undangan.</p>'}</div></section><section class="panel partybox"><h3>Party (${members.length}/4)</h3>${party ? `<p>${isLeader ? 'Kamu adalah leader.' : 'Leader: '+esc(members.find(m=>m.uid===party.leader)?.name || 'Pemain')}</p><div class="list">${roster}</div>${matchControls}${isLeader && (!request || ['cancelled'].includes(request.status)) ? '<div class="row"><select data-party-mode><option value="br">Battle Royale</option><option value="clash">Clash Royale</option></select><button class="btn gold" data-party-start>Match</button></div>' : ''}<button class="btn ghost" data-party-leave>Keluar Party</button>` : '<p class="empty">Belum ada party. Undang teman online untuk membuat party.</p>'}</section></div>`;
    };
    render();
    const stopInvites = watchPartyInvites((v) => { invites = v; render(); });
    let stopParty = () => {};
    const syncParty = async () => {
      const current = getActiveParty();
      if (current?.id && current.id !== party?.id) {
        stopParty();
        stopParty = await watchActiveParty(current.id, (v) => { party = v; render(); if (v?.matchRequest?.status === 'launching' && !launched) { launched = true; window.dispatchEvent(new CustomEvent('br-party-start', { detail: { mode: v.matchRequest.mode } })); } });
      }
      party = getActiveParty() || party; render();
    };
    const onPartyUpdate = (e) => { party = e.detail; render(); if (party?.matchRequest?.status === 'launching' && !launched) { launched = true; window.dispatchEvent(new CustomEvent('br-party-start', { detail: { mode: party.matchRequest.mode } })); } };
    window.addEventListener('br-party-updated', onPartyUpdate);
    body.querySelector('#friendForm').onsubmit = async e => { e.preventDefault(); const name=e.target.friend.value.trim(); if(name.length<3)return; const list=[...new Set([...(store.profile.friends||[]),name])]; try { const result=await act({type:'setFriends',friends:list}); store.profile.friends=result.friends||list; toast('Teman ditambahkan ke daftar'); render(); } catch(err){toast(err.message);} };
    body.onclick = async e => {
      const b=e.target.closest('button'); if(!b)return;
      try {
        if (b.dataset.remove) { const list=(p.friends||[]).filter(n=>n!==b.dataset.remove); const result=await act({type:'setFriends',friends:list}); p.friends=result.friends||list; render(); }
        if (b.dataset.invite) { await invitePartyFriend(b.dataset.invite, p); party=getActiveParty(); toast(`Undangan dikirim ke ${b.dataset.invite}`); render(); }
        if (b.dataset.accept || b.dataset.decline) { const inv=invites.find(x=>x.id===(b.dataset.accept||b.dataset.decline)); if(inv){ await respondPartyInvite(inv, !!b.dataset.accept, p); party=getActiveParty(); toast(b.dataset.accept?'Bergabung ke party':'Undangan ditolak'); render(); } }
        if (b.hasAttribute('data-kick')) { await removePartyMember(b.dataset.kick); toast('Anggota dikeluarkan'); }
        if (b.hasAttribute('data-party-leave')) { await leaveParty(); party=null; launched=false; toast('Keluar dari party'); render(); }
        if (b.hasAttribute('data-party-start')) { const mode=body.querySelector('[data-party-mode]')?.value || 'br'; const map=MAPS[Math.floor(Math.random()*MAPS.length)].id; await requestPartyMatch(mode, map); toast('Permintaan match dikirim. Menunggu persetujuan anggota.'); }
        if (b.hasAttribute('data-ready')) { await answerPartyMatch(true); toast('Persetujuan dikirim'); }
        if (b.hasAttribute('data-reject')) { await answerPartyMatch(false); toast('Match ditolak'); }
      } catch(err){ toast(err.message); }
    };
    cleanup = () => { stopInvites(); stopParty(); window.removeEventListener('br-party-updated', onPartyUpdate); };
  },
  newbie(body, p) {
    const state = p.newbieDaily || { day: 0, lastDay: '' };
    const today = dayKey(Date.now()), done = state.lastDay === today;
    const rewards = [
      '500 Coin + 500 Iron','1.500 Coin + 1.500 Iron','2.500 Coin + 2.500 Iron',
      '3.500 Coin + 3.500 Iron','5.000 Coin + 5.000 Iron','7.500 Coin + 7.500 Iron',
      'Bundle Hercules + SCAR Laut + Gloo Wall Royal Gold'
    ];
    body.innerHTML = `<div class="scroll"><p>Check-in 7 hari berturut-turut. Jika melewatkan satu hari, progres kembali ke hari pertama.</p><div class="grid">${rewards.map((r,i)=>`<article class="card"><h3>DAY ${i+1}</h3><p>${r}</p><small>${i+1 <= state.day ? 'Selesai' : i+1 === state.day+1 ? 'Hadiah berikutnya' : 'Terkunci'}</small></article>`).join('')}</div><button class="btn gold" data-newbie ${done ? 'disabled' : ''}>${done ? 'Check-in hari ini selesai' : 'Check-in Hari Ini'}</button></div>`;
    body.onclick = e => { if (e.target.closest('[data-newbie]')) run({type:'claimNewbieDaily'}, 'Check-in berhasil').then(r => r && sfx.reward()); };
  },
  events(body, p) {
    const groups = [
      ['Event Harian', [['login1','Login 1 Hari','logins',1,'300 Coin'],['kill1','Kill 1','kills',1,'250 Coin'],['death3','Death 3 Kali','deaths',3,'500 Coin']]],
      ['Event Mingguan', [['weeklyKills','Kill 25','weeklyKills',25,'2.500 Coin + 1.000 Iron'],['revive1','Revive 1 Kali','revives',1,'500 Coin'],['weapon5','Weapon Master: 5 Kill','weaponKills',5,'700 Coin']]],
      ['Event Bulanan', [['monthlyLogin','Login 20 Hari','monthlyLogins',20,'3.000 Coin + 2.000 Iron'],['kill10','Kill 10','kills',10,'1.000 Iron'],['bundle1','Gunakan 1 Bundle','bundles',1,'300 Coin']]],
      ['Master Challenge', [['death10','Death Master: 10 Kali','deaths',10,'1.000 Iron'],['revive5','Revive Master: 5 Kali','revives',5,'1.200 Coin'],['weapon20','Weapon Master: 20 Kill','weaponKills',20,'1.500 Iron']]],
      ['Event Ramadhan', [['ramadhanLogin','Login 7 Hari','ramadhanLogins',7,'2.000 Coin + 2.000 Iron']]]
    ];
    const cards = groups.map(([title, rows]) => `<section class="eventgroup"><h3>${title}</h3><div class="grid">${rows.map(([id,n,k,g,r])=>{const v=p.eventProgress?.[k]||0,claimed=p.eventClaims?.[id];return `<article class="card"><h4>${n}</h4><p>${Math.min(v,g)} / ${g}</p><div class="bar"><b style="width:${Math.min(100,v/g*100)}%"></b></div><small>Hadiah: ${r}</small><button class="btn" data-event="${id}" ${claimed||v<g?'disabled':''}>${claimed?'Diklaim':'Klaim hadiah'}</button></article>`}).join('')}</div></section>`).join('');
    body.innerHTML = `<div class="scroll">${cards}<p class="note">Progress event disimpan pada profil. Event Ramadhan ditampilkan sebagai event musiman; klaim mengikuti progress login.</p></div>`;
    body.onclick = e => { const id=e.target.closest('[data-event]')?.dataset.event; if(id) run({type:'claimEvent',id},'Hadiah event diterima').then(r=>r&&sfx.reward()); };
  },
  avatars(body, p) {
    body.innerHTML = `<div class="grid scroll wide">${AVATARS.map(a=>`<article class="card"><img src="${a.src}" alt="${esc(a.name)}"><h4>${esc(a.name)}</h4>${p.avatar===a.id?'<button class="btn ghost" disabled>Dipakai</button>':p.ownedAvatars?.[a.id]?`<button class="btn" data-avatar="${a.id}">Pakai</button>`:`<button class="btn" data-buyavatar="${a.id}">50 Coin</button>`}</article>`).join('')}</div>`;
    body.onclick = e => { const b=e.target.closest('button'); if(!b)return; if(b.dataset.buyavatar) run({type:'buyAvatar',id:b.dataset.buyavatar},'Avatar dibeli'); if(b.dataset.avatar) run({type:'setAvatar',id:b.dataset.avatar},'Avatar dipakai'); };
  },
  gloo(body, p) {
    body.innerHTML = `<div class="grid scroll wide">${Object.values(GLOO_SKINS).map(g=>`<article class="card"><div class="gloo-preview" style="--gloo:#${g.color.toString(16).padStart(6,'0')};--accent:#${g.accent.toString(16).padStart(6,'0')}"></div><h4>${esc(g.name)}</h4>${p.glooSkin===g.id?'<button class="btn ghost" disabled>Dipakai</button>':p.ownedGlooSkins?.[g.id]?`<button class="btn" data-glooequip="${g.id}">Pakai</button>`:`<button class="btn" data-gloobuy="${g.id}">${g.price?g.price+' Coin':'Gratis'}</button>`}</article>`).join('')}</div>`;
    body.onclick = e => { const b=e.target.closest('button'); if(!b)return; if(b.dataset.gloobuy) run({type:'buyGlooSkin',id:b.dataset.gloobuy},'Skin Gloo Wall dibeli'); if(b.dataset.glooequip) run({type:'setGlooSkin',id:b.dataset.glooequip},'Skin Gloo Wall dipakai'); };
  },
  chars(body, p) {
    const ids = Object.keys(CHARACTERS), cur = view.char in CHARACTERS ? view.char : (p.char || 'c_adam'), c = CHARACTERS[cur], own = c.price === 0 || p.owned[cur];
    const preset = p.characterPresets?.[p.activePreset || 0];
    if (view.charPage === 'presets') {
      body.innerHTML = `<div class="preset-page"><div class="preset-head"><button class="btn ghost" data-charback>‹ Kembali</button><div><h3>CHARACTER PRESET</h3><small>Simpan kombinasi karakter dan pet</small></div></div><div class="preset-grid">${[0,1,2].map(i => { const v=p.characterPresets?.[i] || {name:`Preset ${i+1}`,char:'c_adam',pet:'cat'}; return `<button class="preset-card ${p.activePreset===i?'active':''}" data-preset="${i}"><span class="preset-number">0${i+1}</span><b>${esc(v.name || `Preset ${i+1}`)}</b><small>${esc(CHARACTERS[v.char]?.name || 'Adam')} · ${esc(v.pet || 'cat')}</small>${p.activePreset===i?'<em>AKTIF</em>':'<span>Gunakan preset</span>'}</button>`; }).join('')}</div><button class="btn gold" data-open-collection>BUKA KOLEKSI KARAKTER</button></div>`;
      body.onclick = e => { const b=e.target.closest('button'); if(!b)return; if(b.hasAttribute('data-charback')) { view.charPage='collection'; renderModal(); } if(b.dataset.preset!==undefined) run({type:'setPreset',index:+b.dataset.preset},'Preset diterapkan'); if(b.hasAttribute('data-open-collection')) { view.charPage='collection'; renderModal(); } };
      return;
    }
    body.innerHTML = `<div class="character-room"><aside class="character-grid scroll"><div class="character-grid-head"><button class="btn ghost" data-to-presets>‹ Kembali</button><b>KOLEKSI</b><small>${ids.filter(id=>CHARACTERS[id].price===0||p.owned[id]).length}/${ids.length} DIMILIKI</small></div>${ids.map(id=>{const x=CHARACTERS[id], unlocked=x.price===0||p.owned[id];return `<button class="character-tile ${cur===id?'selected':''}" data-charselect="${id}"><span class="mini-block"><i></i><b></b></span><span><b>${esc(x.name)}</b><small>${unlocked?'Dimiliki':num(x.price)+' Coin'}</small></span></button>`}).join('')}</aside><section class="character-stage"><div class="character-platform"><canvas id="characterModel"></canvas></div><div class="character-stage-name">${esc(c.name)}</div><button class="btn gold" data-to-presets>CHARACTER PRESET</button></section><aside class="character-detail"><small class="eyebrow">${own?'OWNED CHARACTER':'LOCKED CHARACTER'}</small><h2>${esc(c.name)}</h2><p>${esc(c.desc)}</p><div class="detail-skill"><small>ABILITY</small><b>${c.skill?esc(c.skillName):'No Special Skill'}</b><span>${c.skill?`${c.mana} Mana · Cooldown ${c.cd}s`:'Karakter standar tanpa skill khusus.'}</span></div><div class="detail-current"><small>PRESET AKTIF</small><b>${esc(preset?.name || 'Preset 1')}</b></div>${own?(p.char===cur?'<button class="btn ghost" disabled>SEDANG DIGUNAKAN</button>':`<button class="btn gold" data-usechar="${cur}">GUNAKAN KARAKTER</button>`):`<button class="btn gold" data-buychar="${cur}">BELI ${num(c.price)} COIN</button>`}<button class="btn ghost" data-to-presets>LIHAT PRESET</button></aside></div>`;
    mountCharacterPreview(body.querySelector('#characterModel'), p, cur);
    body.onclick = e => { const b=e.target.closest('button'); if(!b)return; if(b.dataset.charselect){view.char=b.dataset.charselect;renderModal()} if(b.hasAttribute('data-to-presets')){view.charPage='presets';renderModal()} if(b.dataset.usechar)run({type:'setChar',id:b.dataset.usechar},'Karakter digunakan'); if(b.dataset.buychar)run({type:'buyChar',id:b.dataset.buychar},'Karakter berhasil dibeli'); };
  },
  pets(body,p) {
    const pets=[['cat','Kucing','Teman kecil yang setia.'],['eagle','Elang','Terbang mengitari arena.'],['tiger','Harimau Kecil','Lincah dan berani.'],['orangutan','Orangutan','Teman hutan yang kuat.'],['dog','Anjing','Selalu mengikuti pemiliknya.'],['fox','Rubah','Lincah dengan ekor lebat.'],['panda','Panda','Santai tetapi tangguh.']]; const owned=p.pets?.owned||['cat'];
    body.innerHTML=`<div class="feature-hero"><div><small>COMPANION COLLECTION</small><h2>PET SYSTEM</h2><p>Pet menemani karakter di lobby dan menjadi bagian dari preset.</p></div><div class="pet-hero-icon">${icon('paw-print')}</div></div><div class="grid scroll wide">${pets.map(([id,n,d])=>`<article class="card pet-card"><div class="pet-avatar pet-${id}"></div><h3>${n}</h3><small>${d}</small>${owned.includes(id)?`<button class="btn ${p.pets?.equipped===id?'ghost':'gold'}" data-pet="${id}" ${p.pets?.equipped===id?'disabled':''}>${p.pets?.equipped===id?'Digunakan':'Pakai Pet'}</button>`:`<button class="btn ghost" disabled>Segera Hadir</button>`}</article>`).join('')}</div><p class="note">Saat ini Kucing tersedia sebagai pet awal. Pet lain sudah disiapkan di koleksi, tetapi belum dibuka melalui gameplay.</p>`;
    body.onclick=e=>{const id=e.target.closest('[data-pet]')?.dataset.pet;if(id)run({type:'setPet',id},'Pet diganti')};
  },
  guild(body,p) {
    const g=p.guild; body.innerHTML=g?`<div class="guild-hero"><small>GUILD PROFILE</small><h2>[${esc(g.tag)}] ${esc(g.name)}</h2><div class="guild-level">LEVEL ${g.level||1}</div><p>${g.members?.length||1} Anggota · ${num(g.exp||0)} Guild EXP</p><div class="bar"><b style="width:${(g.exp||0)%1000/10}%"></b></div><b>${esc(g.role||'Member')}</b></div><div class="panel"><h3>Guild Activity</h3><p>EXP dari match akan menambah level guild.</p><button class="btn ghost" data-leaveguild>Keluar Guild</button></div>`:`<div class="feature-hero"><div><small>SOCIAL & COMPETITIVE</small><h2>GUILD SYSTEM</h2><p>Buat guild untuk mengumpulkan pemain dan menaikkan level bersama.</p></div>${icon('users')}</div><form id="guildForm" class="guild-form"><label>Nama Guild<input name="name" maxlength="18" placeholder="Contoh: BLOCKY SQUAD" required minlength="3"></label><button class="btn gold">BUAT GUILD</button></form><p class="note">Pembuatan guild saat ini disimpan pada profil lokal/server. Pencarian guild publik dan undangan anggota lintas akun belum aktif.</p>`;
    body.onclick=e=>{if(e.target.closest('[data-leaveguild]'))run({type:'leaveGuild'},'Keluar dari guild')}; const f=body.querySelector('#guildForm'); if(f)f.onsubmit=e=>{e.preventDefault();run({type:'createGuild',name:f.elements.name.value},'Guild berhasil dibuat')};
  },
  pass(body,p) {
    const xp=p.blockyPass?.xp||0,claimed=p.blockyPass?.claimed||[]; body.innerHTML=`<div class="pass-banner"><small>SEASON 01 · PROGRESSION</small><h2>BLOCKY PASS</h2><p>Kumpulkan EXP dari match untuk membuka hadiah setiap tier.</p><div class="pass-progress"><b style="width:${Math.min(100,xp/3000*100)}%"></b></div><strong>${num(xp)} / 3.000 PASS EXP</strong></div><div class="pass-tiers scroll">${Array.from({length:30},(_,i)=>{const t=i+1,ready=xp>=t*100,done=claimed.includes(t);return `<article class="pass-tier ${ready?'ready':''} ${done?'claimed':''}"><b>${String(t).padStart(2,'0')}</b><span><strong>Tier ${t}</strong><small>${done?'Hadiah sudah diklaim':ready?'Hadiah tersedia':'Butuh '+(t*100)+' EXP'}</small></span><button class="btn ${ready?'gold':'ghost'}" data-pass="${t}" ${!ready||done?'disabled':''}>${done?'Selesai':ready?'Klaim':'Terkunci'}</button></article>`}).join('')}</div>`;
    body.onclick=e=>{const tier=e.target.closest('[data-pass]')?.dataset.pass;if(tier)run({type:'claimPass',tier},'Hadiah Blocky Pass diklaim')};
  },
  history(body,p) { const rows=p.matchHistory||[]; body.innerHTML=`<div class="history-summary"><b>${p.stats.matches}</b><span>Total Match</span><b>${p.stats.wins}</b><span>Victory</span><b>${p.stats.kills}</b><span>Total Kill</span></div><div class="list scroll">${rows.map(r=>`<article class="history-row"><div><b class="${r.win?'win':'lose'}">${r.win?'VICTORY':'DEFEAT'}</b><small>${esc(r.mode)} · ${esc(r.map||'Random')} · ${new Date(r.at).toLocaleString('id-ID')}</small></div><div><b>${r.kills} KILL</b><small>${r.assists} Assist · ${r.damage} Damage</small></div><div><b>#${r.placement}/${r.total}</b><small>+${r.exp} EXP</small></div></article>`).join('')||'<p class="empty">Belum ada riwayat match.</p>'}</div>`; body.onclick=null; },
  emotes(body,p) { const em=[['wave','Melambai'],['laugh','Tertawa'],['angry','Marah'],['sit','Duduk'],['dance','Menari'],['clap','Tepuk Tangan'],['cheer','Bersorak']]; const owned=p.emoteCollection||['wave','laugh','sit']; body.innerHTML=`<div class="feature-hero"><div><small>LOBBY COLLECTION</small><h2>EMOTE COLLECTION</h2><p>Koleksi gerakan karakter untuk lobby dan Social Island.</p></div>${icon('smile')}</div><div class="grid scroll wide">${em.map(([id,n],i)=>`<article class="card emote-card"><div class="emote-preview">${icon('user-round')}</div><h3>${n}</h3><small>${owned.includes(id)?'Dimiliki':'Belum tersedia'}</small><button class="btn ${owned.includes(id)?'gold':'ghost'}" ${owned.includes(id)?'':'disabled'}>${owned.includes(id)?'Tersedia':'Segera Hadir'}</button></article>`).join('')}</div>`; body.onclick=null; },
  achievements(body,p) { const s=p.stats, a=[['First Drop','Selesaikan 1 match',s.matches,1],['Winner','Menangkan 1 match',s.wins,1],['Veteran','Selesaikan 25 match',s.matches,25],['Eliminator','Dapatkan 100 kill',s.kills,100],['Sharpshooter','Dapatkan 1.000 damage',s.damage,1000],['Champion','Menangkan 10 match',s.wins,10]]; body.innerHTML=`<div class="feature-hero"><div><small>PLAYER MILESTONES</small><h2>ACHIEVEMENTS</h2><p>Target permanen berdasarkan statistik akun.</p></div>${icon('medal')}</div><div class="list scroll">${a.map(([n,d,v,g])=>`<article class="achievement-row"><div class="achievement-icon">${icon('trophy')}</div><div><b>${n}</b><small>${d}</small><div class="bar"><b style="width:${Math.min(100,v/g*100)}%"></b></div></div><strong>${Math.min(v,g)}/${g}</strong></article>`).join('')}</div>`; body.onclick=null; },
  hud(body,p) { const h=p.hudLayout||{scale:100,opacity:100}; body.innerHTML=`<div class="feature-hero"><div><small>IN-GAME INTERFACE</small><h2>HUD CUSTOMIZATION</h2><p>Atur skala dan transparansi tombol kontrol saat bermain.</p></div>${icon('sliders-horizontal')}</div><form id="hudForm" class="form scroll"><label>Ukuran HUD <output>${h.scale}%</output><input type="range" name="scale" min="70" max="130" value="${h.scale}"></label><label>Transparansi HUD <output>${h.opacity}%</output><input type="range" name="opacity" min="30" max="100" value="${h.opacity}"></label><button class="btn gold">SIMPAN HUD</button></form>`; const f=body.querySelector('#hudForm'); f.oninput=e=>{if(e.target.name)e.target.previousElementSibling&&(e.target.previousElementSibling.textContent=e.target.name==='scale'?`Ukuran HUD ${e.target.value}%`:`Transparansi HUD ${e.target.value}%`)}; f.onsubmit=e=>{e.preventDefault();run({type:'setHud',scale:f.elements.scale.value,opacity:f.elements.opacity.value},'Pengaturan HUD disimpan')}; },
  mystery(body, p) {
    const ev = store.event, now = Date.now();
    body.onclick = null;
    if (!ev || ev.endsAt <= now) { body.innerHTML = '<p class="empty">Belum ada event Mystery Shop. Tunggu pengumuman admin.</p>'; return; }
    const my = p.mystery?.ev === ev.id ? p.mystery : { spent: 0, claimed: [] };
    const left = Math.max(1, Math.ceil((ev.endsAt - now) / 86400e3)), get = (id) => ITEMS[id] || SKINS[id];
    body.innerHTML = `<div class="scroll"><h3>${esc(ev.title)}</h3><p>Sisa ${left} hari. Total belanja: <b>${my.spent} Iron</b></p>
      <h4>Hadiah Transaksi</h4><div class="grid">${MYSTERY_MILESTONES.map((m, i) => { const done = my.claimed.includes(i); return card(m.id, get(m.id).rarity, get(m.id).name, `<small>Belanja ${m.spend} Iron</small><button class="btn gold" data-claim="${i}" ${my.spent >= m.spend && !done ? '' : 'disabled'}>${done ? 'Diklaim' : 'Klaim'}</button>`); }).join('')}</div>
      <h4>Toko Eksklusif</h4><div class="grid">${MYSTERY_ITEMS.map((m) => card(m.id, get(m.id).rarity, get(m.id).name, `<button class="btn" data-buy="${m.id}" ${p.owned[m.id] ? 'disabled' : ''}>${p.owned[m.id] ? 'Dimiliki' : m.price + ' Iron'}</button>`)).join('')}</div></div>`;
    body.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      const a = b.dataset.buy ? { type: 'mysteryBuy', id: b.dataset.buy } : { type: 'mysteryClaim', index: +b.dataset.claim };
      run(a, 'Berhasil!').then((r) => r && sfx.reward());
    };
  },
  admin(body, p) {
    if (!store.admin) { body.innerHTML = '<p class="empty">Khusus admin.</p>'; return; }
    body.innerHTML = `<div class="adminform scroll">
      <label>Target username (kosongkan = akun admin ini)<input id="aT" maxlength="14" placeholder="username pemain"></label>
      <div class="row"><input id="aN" type="number" min="0" value="1000"><button class="btn" data-op="coin">+ Coin</button><button class="btn" data-op="iron">+ Iron</button><button class="btn" data-op="tokens">+ Token</button></div>
      <div class="row"><select id="aR">${RANKS.map((r, i) => `<option value="${i}">${esc(r.name)}</option>`).join('')}</select><button class="btn" data-op="rank">Set Rank</button></div>
      <div class="row"><input id="aI" placeholder="ID item / bundle / skin"><button class="btn" data-op="grant">Beri item</button></div>
      <div class="row"><input id="aD" type="number" min="1" max="30" value="7" title="hari"><input id="aE" placeholder="Judul event" value="Mystery Shop"><button class="btn" data-op="mysteryStart">Mulai</button><button class="btn" data-op="mysteryStop">Stop</button></div>
      <button class="btn gold" data-op="grantAll">Beri SEMUA item, bundle & skin</button>
      <small>Hasil akan terlihat setelah target login ulang atau buka lobby.</small></div>`;
    body.onclick = async (e) => {
      const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
      const r = await run({ type: 'admin', op, target: $('#aT').value, amount: op.startsWith('mystery') ? $('#aD').value : $('#aN').value, rank: $('#aR').value, id: op.startsWith('mystery') ? $('#aE').value : $('#aI').value }, null);
      if (r) { if ('event' in r) store.event = r.event; toast(`Berhasil: ${r.target}`); }
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
  const showMode = () => { $('#modeName').textContent = MODES[mode].name; $('#modeDesc').textContent = MODES[mode].desc; };
  const modeModal = $('#modeModal');
  const openModes = () => { $('#modeOptions').innerHTML = MODES.map((m,i)=>`<button class="mode-option ${i===mode?'active':''}" data-mode="${i}"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></button>`).join(''); modeModal.hidden=false; };
  $('#modePicker').onclick = openModes; $('#modeClose').onclick = () => { modeModal.hidden=true; };
  modeModal.addEventListener('pointerdown',e=>{if(e.target===modeModal)modeModal.hidden=true});
  $('#modeOptions').onclick=e=>{const i=e.target.closest('[data-mode]')?.dataset.mode;if(i!==undefined){mode=+i;showMode();modeModal.hidden=true;}};
  $('#turnL').onclick = () => stage.turn(-0.6); $('#turnR').onclick = () => stage.turn(0.6);
  $('#actions').onclick = (e) => { const b = e.target.closest('button'); if (b) openModal(b.dataset.open); };
  $('#topright').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id !== 'logoutBtn') return openModal(b.dataset.open);
    const guest = fb.auth?.currentUser?.isAnonymous || !store.online;
    if (confirm(guest ? 'Log out? Akun Guest tidak bisa dibuka lagi setelah keluar, progresnya akan hilang.' : 'Log out dari akun ini?')) logout();
  };
  $('#dailyBtn').onclick = () => openModal('daily');
  $('#friendBtn').onclick = () => openModal('friends');
  $('#friendQuick').onclick = () => openModal('friends');
  $('#chatBtn').onclick = () => openModal('chat');
  $('#editName').onclick = () => openModal('settings');
  $('#modalClose').onclick = closeModal;
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closeModal(); });
  $('#playBtn').onclick = () => onPlay(MODES[mode].id);
  document.addEventListener('click', (e) => { if (e.target.closest('button')) sfx.click(); });
  showMode();
}
