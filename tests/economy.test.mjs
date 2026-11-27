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
