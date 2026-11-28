// Data game yang dipakai bersama oleh browser dan server (Vercel Function).

export const RANKS = [
  { name: 'Kroco',         exp: 0,     from: '#8B5A2B', to: '#5C3A1A' },
  { name: 'Noob',          exp: 200,   from: '#9CA3AF', to: '#4B5563' },
  { name: 'Golden',        exp: 550,   from: '#FDE047', to: '#F97316' },
  { name: 'Diamond',       exp: 1100,  from: '#7DD3FC', to: '#38BDF8' },
  { name: 'Platinum',      exp: 1900,  from: '#1E3A8A', to: '#1E40AF' },
  { name: 'Super Star',    exp: 3000,  from: '#A855F7', to: '#EC4899' },
  { name: 'Mythic',        exp: 4500,  from: '#DC2626', to: '#7F1D1D' },
  { name: 'Immortal',      exp: 6500,  from: '#FBBF24', to: '#7C3AED' },
  { name: 'Immortal Neon', exp: 9500,  from: '#C084FC', to: '#E879F9', neon: true },
];
export const rankIndex = (exp) => RANKS.reduce((a, r, i) => (exp >= r.exp ? i : a), 0);

export const WEAPONS = {
  m1887: { name: 'M1887',        cat: 'Shotgun', ammo: '12g',  dmg: 11, pellets: 8, perShot: 2, mag: 2,  rate: 0.65, reload: 2.0, range: 28,  spread: 0.07,  color: 0x7a4a24, len: 0.85 },
  m1014: { name: 'M1014',        cat: 'Shotgun', ammo: '12g',  dmg: 9,  pellets: 7, perShot: 1, mag: 6,  rate: 0.45, reload: 2.8, range: 30,  spread: 0.08,  color: 0x37414d, len: 0.9 },
  m500:  { name: 'M500',         cat: 'Pistol',  ammo: '9mm',  dmg: 32, pellets: 1, perShot: 1, mag: 5,  rate: 0.45, reload: 1.6, range: 60,  spread: 0.012, color: 0x8b919b, len: 0.45 },
  deagle:{ name: 'Desert Eagle', cat: 'Pistol',  ammo: '9mm',  dmg: 38, pellets: 1, perShot: 1, mag: 7,  rate: 0.55, reload: 1.8, range: 55,  spread: 0.018, color: 0xb08d57, len: 0.45 },
  ak47:  { name: 'AK47',         cat: 'Rifle',   ammo: '7.62', dmg: 24, pellets: 1, perShot: 1, mag: 30, rate: 0.12, reload: 2.4, range: 90,  spread: 0.026, color: 0x6b3f1d, len: 1.0 },
  m4a1:  { name: 'M4A1',         cat: 'Rifle',   ammo: '5.56', dmg: 20, pellets: 1, perShot: 1, mag: 30, rate: 0.11, reload: 2.1, range: 95,  spread: 0.018, color: 0x2f3640, len: 1.0 },
  scar:  { name: 'SCAR',         cat: 'Rifle',   ammo: '5.56', dmg: 22, pellets: 1, perShot: 1, mag: 30, rate: 0.12, reload: 2.2, range: 90,  spread: 0.02,  color: 0x9a8a5c, len: 0.95 },
  mp40:  { name: 'MP40',         cat: 'SMG',     ammo: '9mm',  dmg: 16, pellets: 1, perShot: 1, mag: 20, rate: 0.08, reload: 1.7, range: 45,  spread: 0.034, color: 0x4b4f56, len: 0.7 },
  awm:   { name: 'AWM',          cat: 'Sniper',  ammo: '7.62', dmg: 105,pellets: 1, perShot: 1, mag: 5,  rate: 1.5,  reload: 3.2, range: 180, spread: 0.002, color: 0x45602f, len: 1.3 },
  fist:  { name: 'Tinju',        cat: 'Fist',    ammo: null,   dmg: 18, pellets: 1, perShot: 0, mag: 0,  rate: 0.45, reload: 0,   range: 2.2, spread: 0,     color: 0xd9a47a, len: 0 },
};
export const AMMO = { '12g': { name: 'Shell 12g', pack: 12 }, '9mm': { name: '9mm', pack: 40 }, '5.56': { name: '5.56', pack: 60 }, '7.62': { name: '7.62', pack: 40 } };
export const ARMOR = [
  null,
  { name: 'Low',   cut: 0.10, color: 0x9ca3af },
  { name: 'Mid',   cut: 0.25, color: 0x38bdf8 },
  { name: 'Esper', cut: 0.40, color: 0xa855f7 },
];

// Slot kosmetik. Kategori Vault memakai daftar ini.
export const SLOT_GROUPS = [
  { name: 'Outfit', slots: [['bundle', 'Bundle'], ['hat', 'Hat'], ['acc', 'Accessories'], ['clothes', 'Clothes'], ['pants', 'Pants'], ['shoes', 'Shoes']] },
  { name: 'Equipment', slots: [['parachute', 'Parasut'], ['backpack', 'Tas'], ['trail', 'Jejak'], ['glove', 'Sarung Tinju']] },
];

export const ITEMS = {};
// Kotak voxel: [bagian, x, y, z, lebar, tinggi, tebal, warna]
const add = (id, slot, name, price, look = {}, rarity = 'rare') => { ITEMS[id] = { id, slot, name, price, look, rarity }; };

// ---- Topi
const cap = (c) => [['head', 0, .66, 0, .68, .16, .68, c], ['head', 0, .61, .42, .5, .06, .24, c]];
add('hat_cap_red', 'hat', 'Topi Merah', 300, { boxes: cap(0xd62f2f) });
add('hat_cap_black', 'hat', 'Topi Hitam', 300, { boxes: cap(0x17171c) });
add('hat_bucket', 'hat', 'Bucket Hat', 450, { boxes: [['head', 0, .68, 0, .62, .22, .62, 0xc9b27c], ['head', 0, .57, 0, .86, .07, .86, 0xb59e68]] });
add('hat_beanie', 'hat', 'Kupluk Cyan', 400, { boxes: [['head', 0, .68, 0, .66, .22, .66, 0x22b8cc], ['head', 0, .84, 0, .18, .12, .18, 0xffffff]] });
add('hat_helm_viking', 'hat', 'Helm Viking', 900, { boxes: [['head', 0, .66, 0, .68, .2, .68, 0x8d96a3], ['head', -.42, .72, 0, .18, .14, .14, 0xf1e6c8], ['head', .42, .72, 0, .18, .14, .14, 0xf1e6c8], ['head', -.48, .86, 0, .1, .2, .1, 0xf1e6c8], ['head', .48, .86, 0, .1, .2, .1, 0xf1e6c8]] }, 'epic');
add('hat_crown', 'hat', 'Mahkota Emas', 2500, { boxes: [['head', 0, .66, 0, .64, .12, .64, 0xfbbf24], ['head', -.24, .8, .24, .12, .18, .12, 0xfbbf24], ['head', .24, .8, .24, .12, .18, .12, 0xfbbf24], ['head', -.24, .8, -.24, .12, .18, .12, 0xfbbf24], ['head', .24, .8, -.24, .12, .18, .12, 0xfbbf24], ['head', 0, .68, .33, .1, .08, .04, 0xdc2626]] }, 'epic');
// ---- Aksesoris
const glasses = (frame, lens) => [['head', -.15, .34, .33, .22, .13, .03, lens], ['head', .15, .34, .33, .22, .13, .03, lens], ['head', 0, .36, .33, .1, .03, .03, frame], ['head', -.29, .36, .33, .07, .03, .03, frame], ['head', .29, .36, .33, .07, .03, .03, frame]];
add('acc_glasses', 'acc', 'Kacamata Bulat', 250, { boxes: glasses(0x111111, 0x9fd8ef) });
add('acc_shades', 'acc', 'Kacamata Hitam', 500, { boxes: glasses(0x111111, 0x0b0b0f) });
add('acc_visor', 'acc', 'Visor Neon', 1100, { boxes: [['head', 0, .35, .33, .66, .14, .05, 0x22d3ee]] }, 'epic');
add('acc_mask', 'acc', 'Masker Kain', 350, { boxes: [['head', 0, .15, .34, .56, .24, .06, 0x374151]] });
add('acc_headphone', 'acc', 'Headphone', 700, { boxes: [['head', -.36, .32, 0, .1, .24, .22, 0xa855f7], ['head', .36, .32, 0, .1, .24, .22, 0xa855f7], ['head', 0, .72, 0, .76, .07, .1, 0x222230]] });
add('acc_scarf', 'acc', 'Syal Merah', 400, { boxes: [['torso', 0, .72, 0, .9, .16, .5, 0xdc2626], ['torso', .2, .45, .26, .18, .45, .05, 0xdc2626]] });
// ---- Baju
const sleeves = (c) => ({ torso: c, arms: c });
add('top_hoodie_black', 'clothes', 'Hoodie Hitam', 800, { ...sleeves(0x1f2028), boxes: [['torso', 0, .74, -.3, .56, .28, .2, 0x1f2028], ['torso', 0, .2, .24, .46, .18, .04, 0x2d2f3a]] });
add('top_hoodie_purple', 'clothes', 'Hoodie Ungu', 800, { ...sleeves(0x7e3fc4), boxes: [['torso', 0, .74, -.3, .56, .28, .2, 0x7e3fc4], ['torso', 0, .2, .24, .46, .18, .04, 0x6a32a8]] });
add('top_jacket_leather', 'clothes', 'Jaket Kulit', 1200, { ...sleeves(0x3b2618), boxes: [['torso', 0, .36, .235, .2, .7, .03, 0xe8e4da]] }, 'epic');
add('top_jersey', 'clothes', 'Jersey Biru', 600, { torso: 0x2563eb, boxes: [['torso', 0, .46, .235, .14, .34, .03, 0xffffff]] });
add('top_flannel', 'clothes', 'Flanel Merah', 550, { ...sleeves(0xb4322c), boxes: [['torso', 0, .52, .235, .82, .07, .02, 0x4a1512], ['torso', 0, .26, .235, .82, .07, .02, 0x4a1512], ['torso', .22, .38, .24, .06, .76, .02, 0x4a1512]] });
add('top_tactical', 'clothes', 'Rompi Taktis', 1000, { torso: 0x4b5320, boxes: [['torso', -.2, .3, .26, .22, .2, .08, 0x33391a], ['torso', .2, .3, .26, .22, .2, .08, 0x33391a]] }, 'epic');
// ---- Celana
add('pants_jeans_blue', 'pants', 'Jeans Biru', 400, { legs: 0x33598c });
add('pants_jeans_black', 'pants', 'Jeans Hitam', 400, { legs: 0x20222a });
add('pants_cargo', 'pants', 'Celana Kargo', 650, { legs: 0xa58b5f, boxes: [['legL', -.2, -.4, 0, .08, .24, .26, 0x8a734c], ['legR', .2, -.4, 0, .08, .24, .26, 0x8a734c]] });
add('pants_track', 'pants', 'Celana Training', 500, { legs: 0x111827, boxes: [['legL', -.18, -.37, 0, .03, .74, .1, 0xffffff], ['legR', .18, -.37, 0, .03, .74, .1, 0xffffff]] });
add('pants_royal', 'pants', 'Celana Royal', 900, { legs: 0x5b21b6 }, 'epic');
// ---- Sepatu
const shoes = (c, sole) => ({ feet: c, boxes: [['legL', 0, -.72, .05, .37, .2, .48, c], ['legL', 0, -.83, .05, .39, .06, .5, sole], ['legR', 0, -.72, .05, .37, .2, .48, c], ['legR', 0, -.83, .05, .39, .06, .5, sole]] });
add('shoes_sneaker', 'shoes', 'Sneakers Putih', 350, shoes(0xf3f4f6, 0xdc2626));
add('shoes_boots', 'shoes', 'Boots Militer', 500, shoes(0x2b241c, 0x111111));
add('shoes_neon', 'shoes', 'Sepatu Neon', 900, shoes(0x22d3ee, 0xffffff), 'epic');
add('shoes_gold', 'shoes', 'Sepatu Emas', 1500, shoes(0xfbbf24, 0x7c5a05), 'epic');
// ---- Equipment
add('chute_red', 'parachute', 'Parasut Merah', 500, { chute: [0xdc2626, 0xffffff] });
add('chute_cyan', 'parachute', 'Parasut Cyan', 500, { chute: [0x22d3ee, 0x0e7490] });
add('chute_royal', 'parachute', 'Parasut Royal', 1500, { chute: [0xa855f7, 0xfbbf24] }, 'epic');
add('chute_army', 'parachute', 'Parasut Loreng', 700, { chute: [0x4b5320, 0x8a734c] });
const pack = (c, d) => ({ boxes: [['torso', 0, .4, -.37, .54, .58, .28, c], ['torso', 0, .28, -.54, .34, .24, .08, d]] });
add('bag_army', 'backpack', 'Tas Militer', 400, pack(0x4b5320, 0x33391a));
add('bag_cyber', 'backpack', 'Tas Siber', 1100, pack(0x1f2937, 0x22d3ee), 'epic');
add('bag_chest', 'backpack', 'Tas Peti Harta', 900, pack(0x7a4a24, 0xfbbf24));
add('trail_cyan', 'trail', 'Jejak Cyan', 800, { trail: 0x22d3ee });
add('trail_gold', 'trail', 'Jejak Emas', 1200, { trail: 0xfbbf24 }, 'epic');
add('glove_red', 'glove', 'Sarung Tinju Merah', 350, { glove: 0xdc2626 });
add('glove_gold', 'glove', 'Sarung Tinju Emas', 1000, { glove: 0xfbbf24 }, 'epic');

// ---- Bundle (hanya dari Spin). Semua desain orisinal.
const bundle = (id, name, look) => add(id, 'bundle', name, 0, look, 'legend');
const robe = (c, trim) => ({ torso: c, arms: 0, legs: c, boxes: [['torso', .22, .38, .24, .14, .8, .04, trim], ['torso', 0, 0, .25, .86, .1, .04, trim]] });
bundle('b_zeus', 'Bundle Zeus', { torso: 0xf4f1e8, legs: 0xf4f1e8, feet: 0xc9962c, hair: 0xeef2f7, beard: 0xeef2f7, boxes: [['head', 0, .06, .31, .52, .24, .14, 0xeef2f7], ['head', 0, .66, 0, .68, .08, .68, 0xfbbf24], ['torso', -.2, .4, .24, .18, .8, .05, 0xfbbf24], ['armR', 0, -.7, .3, .08, .1, .55, 0xfde047], ['armR', .1, -.7, .62, .08, .1, .25, 0xfde047]] });
bundle('b_socrates', 'Bundle Socrates', { torso: 0xe7ddc4, legs: 0xe7ddc4, feet: 0x8b5a2b, hair: 0xb8b8b8, beard: 0xb8b8b8, boxes: [['head', 0, .03, .3, .5, .3, .12, 0xb8b8b8], ['torso', .2, .4, .24, .24, .82, .05, 0x9c4a34], ['armL', 0, -.72, .22, .12, .12, .34, 0xd9c28f]] });
bundle('b_hercules', 'Bundle Hercules', { torso: 0xd9a47a, arms: 0xd9a47a, legs: 0x6b3f1d, feet: 0x6b3f1d, boxes: [['head', 0, .68, -.05, .74, .24, .72, 0xc88a2e], ['head', 0, .35, -.38, .74, .7, .12, 0xa86f1f], ['torso', 0, .74, 0, 1.0, .18, .56, 0xc88a2e], ['torso', 0, .06, 0, .86, .16, .5, 0xfbbf24]] });
bundle('b_anubis', 'Bundle Anubis', { skin: 0x1b1b24, torso: 0x1b1b24, arms: 0x1b1b24, legs: 0xe9e2c8, feet: 0xfbbf24, boxes: [['head', -.2, .82, 0, .14, .42, .14, 0x1b1b24], ['head', .2, .82, 0, .14, .42, .14, 0x1b1b24], ['head', 0, .2, .42, .26, .18, .26, 0x1b1b24], ['torso', 0, .66, .02, .9, .2, .52, 0xfbbf24], ['torso', 0, .66, .29, .6, .08, .02, 0x22d3ee]] });
bundle('b_gatot', 'Bundle Gatotkaca', { torso: 0x111827, arms: 0xd9a47a, legs: 0x7f1d1d, feet: 0xfbbf24, boxes: [['head', 0, .7, 0, .66, .2, .66, 0xfbbf24], ['head', 0, .9, -.14, .24, .26, .18, 0xfbbf24], ['torso', 0, .42, .245, .3, .3, .04, 0xfbbf24], ['torso', -.55, .72, 0, .3, .14, .4, 0xfbbf24], ['torso', .55, .72, 0, .3, .14, .4, 0xfbbf24], ['torso', 0, .1, -.3, .7, .9, .06, 0xb91c1c]] });
bundle('b_cleopatra', 'Bundle Cleopatra', { torso: 0xf5f0dc, legs: 0xf5f0dc, feet: 0xfbbf24, hair: 0x0b0b0f, beard: null, boxes: [['head', -.37, .2, 0, .12, .75, .62, 0x0b0b0f], ['head', .37, .2, 0, .12, .75, .62, 0x0b0b0f], ['head', 0, .62, .32, .68, .08, .05, 0xfbbf24], ['torso', 0, .68, .02, .88, .16, .52, 0x0e7490], ['torso', 0, .1, .245, .84, .1, .04, 0xfbbf24]] });
bundle('b_kapten', 'Bundle Kapten Karang Hitam', { torso: 0x1e293b, arms: 0x1e293b, legs: 0x3f2d20, feet: 0x111111, boxes: [['head', 0, .68, 0, .98, .1, .76, 0x0f172a], ['head', 0, .84, 0, .6, .24, .6, 0x0f172a], ['head', 0, .82, .31, .16, .12, .03, 0xe5e7eb], ['head', -.15, .35, .34, .2, .16, .03, 0x050505], ['torso', 0, .12, .245, .86, .14, .04, 0xb91c1c], ['torso', 0, .5, .245, .08, .5, .04, 0xfbbf24]] });
bundle('b_navigator', 'Bundle Navigator Ombak', { torso: 0xf8fafc, legs: 0x1e3a8a, feet: 0x7a4a24, boxes: [['head', 0, .67, 0, .68, .16, .68, 0x0ea5e9], ['head', .36, .5, -.2, .08, .4, .2, 0x0ea5e9], ['torso', 0, .55, .235, .82, .08, .02, 0x1d4ed8], ['torso', 0, .3, .235, .82, .08, .02, 0x1d4ed8]] });
bundle('b_shinobi', 'Bundle Shinobi Senja', { ...robe(0x26233a, 0x7c3aed), arms: 0x26233a, feet: 0x111111, boxes: [...robe(0x26233a, 0x7c3aed).boxes, ['head', 0, .15, .33, .66, .28, .06, 0x15131f], ['head', 0, .6, 0, .66, .12, .66, 0x7c3aed], ['torso', -.12, .5, -.3, .1, 1.1, .1, 0x9ca3af]] });
bundle('b_kitsune', 'Bundle Rubah Api', { torso: 0xea580c, arms: 0xea580c, legs: 0x1c1917, feet: 0x1c1917, hair: 0xf97316, boxes: [['head', -.24, .78, 0, .18, .24, .12, 0xf97316], ['head', .24, .78, 0, .18, .24, .12, 0xf97316], ['head', 0, .17, .34, .5, .22, .05, 0xffffff], ['torso', 0, .05, -.46, .26, .26, .5, 0xf97316], ['torso', 0, .16, -.76, .2, .2, .18, 0xffffff]] });
bundle('b_aura', 'Bundle Penjaga Aura', { torso: 0x0f766e, arms: 0xd9a47a, legs: 0x134e4a, feet: 0xfbbf24, hair: 0x2dd4bf, boxes: [['head', 0, .74, .05, .5, .2, .7, 0x2dd4bf], ['torso', 0, .72, .02, .96, .12, .54, 0xfbbf24], ['torso', -.62, .9, -.25, .18, .18, .18, 0x5eead4], ['torso', .62, 1.05, -.25, .14, .14, .14, 0x5eead4], ['armL', 0, -.5, 0, .32, .2, .32, 0xfbbf24], ['armR', 0, -.5, 0, .32, .2, .32, 0xfbbf24]] });
bundle('b_pendekar', 'Bundle Pendekar Bintang', { torso: 0x7f1d1d, arms: 0x7f1d1d, legs: 0x111827, feet: 0xffffff, hair: 0xfacc15, boxes: [['head', -.18, .8, 0, .18, .3, .5, 0xfacc15], ['head', .16, .86, 0, .18, .42, .4, 0xfacc15], ['torso', 0, .42, .245, .24, .24, .03, 0xfacc15], ['torso', 0, .08, 0, .86, .12, .5, 0x000000]] });
bundle('b_mainan', 'Bundle Si Balok Pemula', { skin: 0x86efac, torso: 0xf97316, arms: 0x86efac, legs: 0x7c3aed, feet: 0x475569, hair: 0x86efac, beard: null, boxes: [['head', 0, .72, 0, .3, .14, .3, 0x86efac], ['torso', 0, .4, .24, .34, .34, .03, 0xffffff]] });
bundle('b_robot', 'Bundle Robot Kaleng', { skin: 0x94a3b8, torso: 0x64748b, arms: 0x94a3b8, legs: 0x475569, feet: 0x334155, hair: 0x64748b, beard: null, boxes: [['head', 0, .82, 0, .06, .28, .06, 0x334155], ['head', 0, 1.0, 0, .14, .14, .14, 0xef4444], ['head', 0, .35, .33, .54, .18, .04, 0x22d3ee], ['torso', 0, .42, .245, .46, .34, .05, 0x1e293b], ['torso', -.1, .42, .28, .1, .1, .03, 0x22c55e], ['torso', .1, .42, .28, .1, .1, .03, 0xfbbf24]] });

// ---- Skin senjata: biasa, dan Evo (level 1-7)
export const SKINS = {};
const skin = (id, weapon, name, color, accent, evo = false) => { SKINS[id] = { id, weapon, name, color, accent, evo, rarity: evo ? 'legend' : 'epic' }; };
skin('s_ak_loreng', 'ak47', 'AK47 Loreng', 0x4b5320, 0x8a734c);
skin('s_m4_salju', 'm4a1', 'M4A1 Salju', 0xe5e7eb, 0x7dd3fc);
skin('s_mp_permen', 'mp40', 'MP40 Permen', 0xf472b6, 0x22d3ee);
skin('s_awm_pasir', 'awm', 'AWM Gurun', 0xc9a66b, 0x6b4f2a);
skin('s_shot_bara', 'm1887', 'M1887 Bara', 0x7f1d1d, 0xf97316);
skin('s_m500_emas', 'm500', 'M500 Emas', 0xfbbf24, 0x92600a);
skin('s_scar_laut', 'scar', 'SCAR Laut', 0x0e7490, 0x67e8f9);
skin('s_deagle_malam', 'deagle', 'Eagle Tengah Malam', 0x111827, 0xa855f7);
skin('s_m1014_toxic', 'm1014', 'M1014 Racun', 0x1a2e05, 0xa3e635);
skin('e_ak_naga', 'ak47', 'AK47 Naga Biru', 0x1d4ed8, 0x22d3ee, true);
skin('e_mp_kobra', 'mp40', 'MP40 Kobra Neon', 0x581c87, 0xe879f9, true);
skin('e_awm_petir', 'awm', 'AWM Petir Olimpus', 0xf8fafc, 0xfde047, true);
skin('e_shot_lahar', 'm1887', 'M1887 Lahar', 0x450a0a, 0xfb923c, true);
skin('e_m4_aura', 'm4a1', 'M4A1 Aura Giok', 0x134e4a, 0x2dd4bf, true);
export const EVO_MAX = 7;
export const EVO_COST = [0, 0, 20, 35, 50, 70, 95, 130]; // biaya token untuk NAIK ke level tsb
export const EVO_PERKS = ['', 'Warna skin', 'Garis menyala', 'Peluru berwarna', 'Kilatan moncong', 'Efek percikan saat kena', 'Aksen melayang', 'Efek ledakan saat kill'];

// ---- Toko gacha
export const BANNERS = {
  superior: { name: 'Superior Gacha', desc: 'Tokoh mitologi dan sejarah', color: '#fbbf24', bundles: ['b_zeus', 'b_socrates', 'b_hercules', 'b_anubis', 'b_gatot', 'b_cleopatra'], evo: ['e_awm_petir'], skins: ['s_m500_emas', 's_awm_pasir'], items: ['hat_crown', 'chute_royal', 'glove_gold'] },
  bajaklaut: { name: 'Samudra Gacha', desc: 'Petualang laut dan harta karun', color: '#22d3ee', bundles: ['b_kapten', 'b_navigator'], evo: ['e_ak_naga'], skins: ['s_scar_laut', 's_shot_bara'], items: ['bag_chest', 'acc_scarf', 'chute_cyan'] },
  shinobi: { name: 'Shinobi Gacha', desc: 'Bayangan, rubah, dan malam', color: '#a855f7', bundles: ['b_shinobi', 'b_kitsune'], evo: ['e_mp_kobra'], skins: ['s_deagle_malam', 's_ak_loreng'], items: ['acc_mask', 'trail_cyan', 'pants_royal'] },
  aura: { name: 'Aura Gacha', desc: 'Petarung dengan energi menyala', color: '#2dd4bf', bundles: ['b_aura', 'b_pendekar'], evo: ['e_m4_aura'], skins: ['s_m1014_toxic', 's_mp_permen'], items: ['acc_visor', 'trail_gold', 'shoes_neon'] },
  balok: { name: 'Mainan Gacha', desc: 'Karakter balok klasik yang kocak', color: '#f97316', bundles: ['b_mainan', 'b_robot'], evo: ['e_shot_lahar'], skins: ['s_mp_permen', 's_m4_salju'], items: ['hat_helm_viking', 'bag_cyber', 'acc_headphone'] },
};
// Peluang per spin (total 100)
export const RATES = [['bundle', 2], ['evo', 2], ['skin', 10], ['item', 22], ['token', 24], ['coin', 40]];
export const PITY = 40; // spin ke-40 tanpa hadiah legend pasti dapat Bundle/Evo yang belum dimiliki
export const SPIN_COST = { 1: 50, 10: 300 };

export const GLOO_SKINS = {
  gloo_default: { id: 'gloo_default', name: 'Dinding Es', price: 0, color: 0x8bdcf4, accent: 0xffffff },
  gloo_indonesia: { id: 'gloo_indonesia', name: 'Merah Putih', price: 650, color: 0xffffff, accent: 0xdc2626 },
  gloo_neon: { id: 'gloo_neon', name: 'Neon Pulse', price: 900, color: 0x7c3aed, accent: 0x22d3ee },
  gloo_lava: { id: 'gloo_lava', name: 'Lava Core', price: 1200, color: 0x7f1d1d, accent: 0xfb923c },
  gloo_gold: { id: 'gloo_gold', name: 'Royal Gold', price: 1800, color: 0xfbbf24, accent: 0xffffff },
};
export const AVATARS = ['indonesia','malaysia','weapon','skull','fighter','ngawi','jomok','bobby','tricky','sinpo','dev','ultra','roblox'].map(id => ({ id, name: id[0].toUpperCase()+id.slice(1), src: `avatars/png/${id}.png`, price: 50 }));
export const MAPS = [
  { id: 'andromeda', name: 'Andromeda' }, { id: 'zipper', name: 'Zipper' },
  { id: 'tel_mista', name: 'Tel Mista' }, { id: 'oslo', name: 'Oslo' },
  { id: 'ngawi', name: 'Ngawi' }, { id: 'jomokerto', name: 'Jomokerto' },
];

export const MODES = [
  { id: 'br', name: 'BATTLE ROYALE', desc: '12 petarung, turun dari pesawat, zona mengecil', total: 12 },
  { id: 'clash', name: 'CLASH ARENA', desc: '6 petarung di arena kota, langsung bersenjata', total: 6 },
  { id: 'training', name: 'TRAINING', desc: 'Tempat latihan, crate perlengkapan, dan lapangan tembak', total: 7 },
  { id: 'social', name: 'SOCIAL ISLAND', desc: 'Pulau santai untuk berkumpul dan bermain', total: 12 },
];

// ---- Mystery Shop (event, hanya dijual saat event aktif) ----
bundle('b_mys_raja', 'Bundle Raja Bayangan', { torso: 0x1e1b4b, legs: 0x111827, feet: 0xfbbf24, arms: 0x1e1b4b, hair: 0x0f0f14, boxes: [['head', 0, .68, 0, .7, .2, .7, 0xfbbf24], ['head', 0, .86, 0, .14, .16, .14, 0xf0abfc], ['torso', 0, .46, -.28, 1.0, .9, .06, 0x7e22ce]] });
bundle('b_mys_samurai', 'Bundle Samurai Merah', { torso: 0x991b1b, legs: 0x1f2937, feet: 0x111827, boxes: [['head', 0, .7, 0, .78, .16, .78, 0x7f1d1d], ['head', .3, .84, 0, .1, .26, .1, 0xfbbf24], ['torso', 0, .5, .27, .9, .12, .05, 0xfbbf24]] });
bundle('b_mys_astro', 'Bundle Astronot Neon', { torso: 0xf8fafc, legs: 0xf8fafc, feet: 0x94a3b8, arms: 0xf8fafc, boxes: [['head', 0, .2, .02, .8, .8, .8, 0x38bdf8], ['torso', 0, .5, -.3, .8, .9, .3, 0xcbd5e1], ['torso', 0, .55, .27, .3, .3, .05, 0x22d3ee]] });
skin('e_scar_nova', 'scar', 'SCAR Nova Mistik', 0x1e1b4b, 0xf0abfc, true);
skin('s_awm_merah', 'awm', 'AWM Merah Darah', 0x7f1d1d, 0xfca5a5);
export const MYSTERY_ITEMS = [
  { id: 'b_mys_samurai', price: 800 }, { id: 'b_mys_astro', price: 1200 }, { id: 'b_mys_raja', price: 2500 },
  { id: 's_awm_merah', price: 600 }, { id: 'e_scar_nova', price: 3000 },
];
// Hadiah otomatis berdasarkan total Iron yang dibelanjakan selama event
export const MYSTERY_MILESTONES = [{ spend: 1000, id: 'b_mys_samurai' }, { spend: 3000, id: 'e_scar_nova' }, { spend: 6000, id: 'b_mys_raja' }];

// ---- Senjata baru ----
const gun = (id, name, cat, ammo, dmg, pellets, perShot, mag, rate, reload, range, spread, color, len) => { WEAPONS[id] = { name, cat, ammo, dmg, pellets, perShot, mag, rate, reload, range, spread, color, len }; };
gun('usp', 'USP', 'Pistol', '9mm', 26, 1, 1, 12, 0.22, 1.5, 55, 0.015, 0x4b5563, 0.45);
gun('ump', 'UMP', 'SMG', '9mm', 18, 1, 1, 25, 0.09, 1.9, 50, 0.03, 0x5b6370, 0.72);
gun('p90', 'P90', 'SMG', '9mm', 15, 1, 1, 50, 0.07, 2.4, 45, 0.036, 0x1f2937, 0.7);
gun('g36', 'G36', 'Rifle', '5.56', 21, 1, 1, 30, 0.11, 2.2, 95, 0.019, 0x64748b, 1.0);
gun('famas', 'FAMAS', 'Rifle', '5.56', 19, 1, 1, 25, 0.085, 2.0, 85, 0.024, 0x3f4a3a, 0.9);
gun('groza', 'Groza', 'Rifle', '7.62', 27, 1, 1, 30, 0.13, 2.6, 90, 0.024, 0x78552b, 1.0);
gun('kar98', 'Kar98', 'Sniper', '7.62', 85, 1, 1, 5, 1.1, 2.8, 170, 0.003, 0x6b4a2b, 1.3);
gun('spas12', 'SPAS12', 'Shotgun', '12g', 10, 8, 1, 8, 0.55, 3.0, 30, 0.075, 0x2d3748, 0.9);

// ---- Skin & bundle baru ----
skin('s_p90_neon', 'p90', 'P90 Neon', 0x0f172a, 0x22d3ee);
skin('s_g36_emas', 'g36', 'G36 Emas', 0xfbbf24, 0x92600a);
skin('s_kar_hutan', 'kar98', 'Kar98 Hutan', 0x14532d, 0x86efac);
skin('s_spas_api', 'spas12', 'SPAS12 Api', 0x7f1d1d, 0xfb923c);
skin('s_ump_es', 'ump', 'UMP Es', 0xbae6fd, 0x38bdf8);
skin('e_famas_samurai', 'famas', 'FAMAS Samurai', 0x7f1d1d, 0xfde047, true);
skin('e_kar_hantu', 'kar98', 'Kar98 Hantu', 0x1e293b, 0xa78bfa, true);
skin('e_groza_kutub', 'groza', 'Groza Kutub', 0xe0f2fe, 0x7dd3fc, true);
bundle('b_ninja_es', 'Bundle Ninja Es', { torso: 0xbae6fd, legs: 0x1e3a5f, feet: 0x0f172a, boxes: [['head', 0, .12, .31, .6, .3, .08, 0x0f172a], ['head', 0, .68, 0, .74, .1, .74, 0x38bdf8]] });
bundle('b_koboi', 'Bundle Koboi Gurun', { torso: 0xb45309, legs: 0x1e3a8a, feet: 0x451a03, boxes: [['head', 0, .66, 0, .95, .06, .95, 0x7c4a1e], ['head', 0, .74, 0, .56, .2, .56, 0x7c4a1e], ['torso', 0, .55, .27, .9, .1, .05, 0xfbbf24]] });
bundle('b_pilot', 'Bundle Pilot Ace', { torso: 0x374151, legs: 0x1f2937, feet: 0x111827, boxes: [['head', 0, .68, 0, .74, .16, .74, 0x92400e], ['head', 0, .22, .33, .6, .2, .08, 0x67e8f9], ['torso', 0, .3, .27, .5, .4, .05, 0x9ca3af]] });
bundle('b_viking', 'Bundle Raja Viking', { torso: 0x7c2d12, legs: 0x44403c, feet: 0x292524, beard: 0xd97706, boxes: [['head', 0, .68, 0, .78, .2, .78, 0x9ca3af], ['head', .42, .8, 0, .14, .4, .14, 0xf5f5f4], ['head', -.42, .8, 0, .14, .4, .14, 0xf5f5f4]] });
bundle('b_dokter', 'Bundle Dokter Tempur', { torso: 0xf8fafc, legs: 0x0e7490, feet: 0xf8fafc, boxes: [['head', 0, .68, 0, .7, .12, .7, 0xf8fafc], ['head', 0, .72, .36, .2, .2, .05, 0xef4444], ['torso', 0, .5, .27, .35, .35, .05, 0xef4444]] });
bundle('b_alien', 'Bundle Alien Hijau', { torso: 0x4ade80, legs: 0x16a34a, arms: 0x4ade80, feet: 0x14532d, hair: 0x4ade80, boxes: [['head', .22, .6, .1, .08, .5, .08, 0x86efac], ['head', -.22, .6, .1, .08, .5, .08, 0x86efac], ['head', 0, .12, .33, .5, .2, .06, 0x111827]] });
BANNERS.gurun = { name: 'Gurun Gacha', desc: 'Koboi, pilot, dan dokter medan perang', color: '#f59e0b', bundles: ['b_koboi', 'b_pilot', 'b_dokter'], evo: ['e_famas_samurai', 'e_kar_hantu'], skins: ['s_g36_emas', 's_p90_neon', 's_kar_hutan'], items: ['hat_crown', 'bag_cyber', 'shoes_neon'] };
BANNERS.kutub = { name: 'Kutub Gacha', desc: 'Dingin, viking, dan makhluk asing', color: '#38bdf8', bundles: ['b_ninja_es', 'b_viking', 'b_alien'], evo: ['e_groza_kutub'], skins: ['s_ump_es', 's_spas_api'], items: ['acc_visor', 'trail_gold', 'chute_cyan'] };

// ---- Karakter dengan skill ----
export const CHARACTERS = {
  c_adam: { name: 'Adam', price: 0, skill: null, desc: 'Karakter biasa, tanpa skill.' },
  c_uno: { name: 'Uno', price: 3000, skill: 'net', skillName: 'Jaring', mana: 40, cd: 25, desc: 'Menebar jaring: musuh di area melambat selama 6 detik.' },
  c_rena: { name: 'Rena', price: 2500, skill: 'heal', skillName: 'Pulsa Penyembuh', mana: 35, cd: 30, desc: 'Memulihkan 40 HP seketika.' },
  c_kuro: { name: 'Kuro', price: 2800, skill: 'sprint', skillName: 'Lari Kilat', mana: 30, cd: 20, desc: 'Berlari 1.7x lebih cepat selama 5 detik.' },
  c_bolt: { name: 'Bolt', price: 3500, skill: 'shock', skillName: 'Gelombang Kejut', mana: 45, cd: 28, desc: 'Menyerang musuh dalam radius 9 meter (30 damage).' },
  c_terra: { name: 'Terra', price: 3200, skill: 'shield', skillName: 'Perisai', mana: 40, cd: 35, desc: 'Mengurangi damage 60% selama 6 detik.' },
};
// Medkit dan scope
export const MEDS = { medkit: { name: 'Medkit', hp: 50, time: 4 }, super: { name: 'Super Medkit', hp: 100, time: 6 } };
MODES.push({ id: 'social', name: 'SOCIAL ISLAND', desc: 'Pulau santai: tanpa senjata, jalan-jalan, emote, dan ngobrol', total: 8 });

export const BUNDLE_PARTS = {};
for (const [id, bundleItem] of Object.entries(ITEMS).filter(([, item]) => item.slot === 'bundle')) {
  const look = bundleItem.look || {};
  const boxes = look.boxes || [];
  const parts = {
    hat: { boxes: boxes.filter(([part]) => part === 'head'), hair: look.hair, beard: look.beard },
    acc: { boxes: [] },
    clothes: { torso: look.torso, arms: look.arms, boxes: boxes.filter(([part]) => part === 'torso' || part === 'armL' || part === 'armR') },
    pants: { legs: look.legs, boxes: boxes.filter(([part]) => part === 'legL' || part === 'legR') },
    shoes: { feet: look.feet, boxes: [] },
  };
  for (const [slot, partLook] of Object.entries(parts)) {
    const partId = `bp_${id}_${slot}`;
    ITEMS[partId] = { id: partId, slot, name: `${bundleItem.name} - ${({hat:'Head',acc:'Accessories',clothes:'Clothes',pants:'Pants',shoes:'Shoes'})[slot]}`, price: 0, look: partLook, rarity: 'legend', sourceBundle: id };
    BUNDLE_PARTS[id] ||= {};
    BUNDLE_PARTS[id][slot] = partId;
  }
}
