import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, newProfile } from '../shared/economy.js';
import { ITEMS, SKINS, BANNERS, RATES, MODES, rankIndex } from '../shared/catalog.js';

const T = Date.UTC(2026, 10, 27, 12);
const base = () => newProfile('Tester', T);
const run = (p, a, o = {}) => applyAction(p, a, { now: T, ...o });

test('pemain baru dapat 1000 iron', () => { assert.equal(base().iron, 1000); assert.equal(base().coin, 1000); });
test('klaim harian sekali per hari WIB', () => {
  const a = run(base(), { type: 'daily' }).profile;
  assert.equal(a.iron, 1100);
  assert.throws(() => run(a, { type: 'daily' }));
  // 17:00 UTC = 00:00 WIB hari berikutnya
  assert.equal(run(a, { type: 'daily' }, { now: Date.UTC(2026, 10, 27, 17) }).profile.iron, 1200);
});
test('biaya spin 50 dan 300', () => {
  assert.equal(run(base(), { type: 'spin', banner: 'superior', count: 1 }).profile.iron, 950);
  const r = run(base(), { type: 'spin', banner: 'shinobi', count: 10 });
  assert.equal(r.profile.iron, 700); assert.equal(r.result.rewards.length, 10);
  assert.throws(() => run({ ...base(), iron: 10 }, { type: 'spin', banner: 'aura', count: 1 }));
  assert.throws(() => run(base(), { type: 'spin', banner: 'constructor', count: 1 }));
  assert.throws(() => run(base(), { type: 'spin', banner: 'aura', count: -10 }));
});
test('jaminan di spin ke-40', () => {
  const p = { ...base(), pity: { superior: 39 } };
  const r = run(p, { type: 'spin', banner: 'superior', count: 1 }, { rng: () => 0.999 });
  assert.ok(['bundle', 'evo'].includes(r.result.rewards[0].kind));
  assert.equal(r.profile.pity.superior, 0);
});
test('semua hadiah banner valid, peluang total 100', () => {
  for (const b of Object.values(BANNERS)) {
    for (const id of [...b.bundles, ...b.items]) assert.ok(ITEMS[id], id);
    for (const id of b.skins) assert.ok(SKINS[id] && !SKINS[id].evo, id);
    for (const id of b.evo) assert.ok(SKINS[id]?.evo, id);
  }
  assert.equal(RATES.reduce((s, r) => s + r[1], 0), 100);
});
test('beli, equip, dan bundle menggantikan outfit', () => {
  let p = run(base(), { type: 'buy', id: 'hat_cap_red' }).profile;
  assert.equal(p.coin, 700);
  assert.throws(() => run(p, { type: 'buy', id: 'hat_cap_red' }));
  assert.throws(() => run(p, { type: 'buy', id: 'b_zeus' }));
  assert.throws(() => run(p, { type: 'equip', slot: 'hat', id: 'hat_crown' }));
  p = run(p, { type: 'equip', slot: 'hat', id: 'hat_cap_red' }).profile;
  p.owned.b_zeus = true;
  p = run(p, { type: 'equip', slot: 'bundle', id: 'b_zeus' }).profile;
  assert.deepEqual(p.equipped, { bundle: 'b_zeus' });
  p = run(p, { type: 'equip', slot: 'hat', id: 'hat_cap_red' }).profile;
  assert.deepEqual(p.equipped, { hat: 'hat_cap_red' });
});
test('upgrade evo sampai level 7', () => {
  let p = { ...base(), tokens: 1000, owned: { e_ak_naga: true }, evo: { e_ak_naga: 1 } };
  for (let i = 0; i < 6; i++) p = run(p, { type: 'upgrade', id: 'e_ak_naga' }).profile;
  assert.equal(p.evo.e_ak_naga, 7); assert.equal(p.tokens, 600);
  assert.throws(() => run(p, { type: 'upgrade', id: 'e_ak_naga' }));
});
test('exp match, rank naik, nilai curang dipotong', () => {
  const r = run(base(), { type: 'match', mode: 'br', kills: 999, placement: 1, damage: 1e9 });
  assert.equal(r.result.kills, MODES[0].total - 1);
  assert.equal(r.result.exp, 150 + 110 + 100);
  assert.equal(r.profile.rank, rankIndex(360));
  assert.throws(() => run(r.profile, { type: 'match', mode: 'br', placement: 1 }));
  const last = run(base(), { type: 'match', mode: 'br', kills: 0, placement: 12 });
  assert.equal(last.result.exp, 50);
  assert.throws(() => run(base(), { type: 'match', mode: 'training' }));
});
test('username dibersihkan', () => {
  assert.equal(newProfile('  <b>Andi</b>  ', T).name, 'bAndib');
  assert.throws(() => newProfile('<>', T));
});


test('newbie daily memberi hadiah bertingkat dan reset streak setelah jeda', () => {
  const start = Date.parse('2026-11-28T12:00:00+07:00');
  let p = newProfile('Tester', start);
  let r = applyAction(p, { type: 'claimNewbieDaily' }, { now: start });
  assert.equal(r.result.day, 1);
  assert.equal(r.profile.coin, 1500);
  assert.equal(r.profile.iron, 1500);
  r = applyAction(r.profile, { type: 'claimNewbieDaily' }, { now: start + 86400e3 });
  assert.equal(r.result.day, 2);
  r = applyAction(r.profile, { type: 'claimNewbieDaily' }, { now: start + 3 * 86400e3 });
  assert.equal(r.result.day, 1);
});

test('avatar dan skin gloo wall dibeli dengan coin', () => {
  const now = Date.now();
  const p = newProfile('Tester', now);
  const a = applyAction(p, { type: 'buyAvatar', id: 'indonesia' }, { now });
  assert.equal(a.profile.ownedAvatars.indonesia, true);
  assert.equal(a.profile.coin, 950);
  const g = applyAction(a.profile, { type: 'buyGlooSkin', id: 'gloo_neon' }, { now });
  assert.equal(g.profile.ownedGlooSkins.gloo_neon, true);
  assert.equal(g.profile.coin, 50);
});

test('bundle bisa dipecah menjadi lima slot kosmetik terpisah', () => {
  let p = base();
  p.owned.b_hercules = true;
  const r = run(p, { type: 'splitBundle', id: 'b_hercules' });
  assert.equal(r.result.parts.length, 5);
  for (const id of r.result.parts) assert.equal(r.profile.owned[id], true);
  const hat = r.result.parts.find(id => id.endsWith('_hat'));
  p = run(r.profile, { type: 'equip', slot: 'hat', id: hat }).profile;
  assert.equal(p.equipped.hat, hat);
  assert.equal(p.equipped.bundle, undefined);
});

test('event kill dan bundle punya progress dan hadiah otoritatif', () => {
  let p = base();
  p.owned.b_hercules = true;
  p = run(p, { type: 'equip', slot: 'bundle', id: 'b_hercules' }).profile;
  assert.equal(p.eventProgress.bundles, 1);
  p = run(p, { type: 'match', mode: 'br', kills: 5, placement: 4 }).profile;
  assert.equal(p.eventProgress.kills, 5);
  assert.equal(p.eventProgress.weaponKills, 5);
  p = run(p, { type: 'claimEvent', id: 'weapon5' }).profile;
  assert.equal(p.coin, 1865);
  assert.throws(() => run(p, { type: 'claimEvent', id: 'weapon5' }));
});

test('pet, guild, preset, HUD, dan Blocky Pass tersimpan di profil', () => {
  let p = base();
  p = run(p, { type: 'setPet', id: 'cat' }).profile;
  assert.equal(p.pets.equipped, 'cat');
  p = run(p, { type: 'createGuild', name: 'Blocky Squad' }).profile;
  assert.equal(p.guild.name, 'Blocky Squad');
  p = run(p, { type: 'setPreset', index: 1, char: 'c_adam', pet: 'cat' }).profile;
  assert.equal(p.activePreset, 1);
  assert.equal(p.characterPresets[1].char, 'c_adam');
  p = run(p, { type: 'setHud', scale: 120, opacity: 75 }).profile;
  assert.deepEqual(p.hudLayout, { scale: 120, opacity: 75 });
  p.blockyPass.xp = 100;
  p = run(p, { type: 'claimPass', tier: 1 }).profile;
  assert.ok(p.blockyPass.claimed.includes(1));
  assert.throws(() => run(p, { type: 'claimPass', tier: 1 }));
});

test('match menyimpan riwayat dan menambah EXP Blocky Pass', () => {
  const r = run(base(), { type: 'match', mode: 'br', kills: 2, placement: 1, map: 'Andromeda' });
  assert.equal(r.profile.matchHistory.length, 1);
  assert.equal(r.profile.matchHistory[0].map, 'Andromeda');
  assert.equal(r.profile.blockyPass.xp, r.result.exp);
});
