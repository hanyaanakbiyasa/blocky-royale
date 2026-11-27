// Efek suara disintesis dengan WebAudio (tanpa file audio).
import { settings } from './settings.js';
let ctx;
function tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0) {
  const v = vol * settings.volume;
  if (v <= 0) return;
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
  } catch { /* audio tidak tersedia */ }
}
function noise(dur, vol, freq, delay = 0) {
  const v = vol * settings.volume;
  if (v <= 0) return;
  try {
    ctx ||= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = v;
    src.connect(f).connect(g).connect(ctx.destination); src.start(ctx.currentTime + delay);
  } catch { /* audio tidak tersedia */ }
}
export const sfx = {
  click: () => tone(520, 0.06, 'square', 0.08),
  shot: (cat, dist = 0, key = '') => {
    const v = 0.22 / (1 + dist / 12), k = 0.88 + ([...key].reduce((x, c) => x + c.charCodeAt(0), 0) % 9) * 0.03;
    const P = { Sniper: [90, 0.55, 2200, 0.38], Shotgun: [120, 0.32, 3000, 0.2], Pistol: [240, 0.16, 5200, 0.1], SMG: [300, 0.1, 6500, 0.07], Rifle: [180, 0.2, 4600, 0.11], Fist: [90, 0.08, 900, 0.08] }[cat] || [200, 0.15, 4000, 0.1];
    noise(P[1], v * 1.5, P[2] * k); tone(P[0] * k, P[3], 'sawtooth', v, -P[0] * 0.6 * k);
    if (cat === 'Sniper') { noise(0.5, v * 0.5, 900, 0.12); tone(60, 0.3, 'sine', v, -20, 0.05); }
    if (cat === 'Shotgun') { tone(420, 0.05, 'square', 0.08, 0, 0.35); tone(300, 0.05, 'square', 0.08, 0, 0.42); }
  },
  hit: () => tone(900, 0.05, 'triangle', 0.18),
  hurt: () => tone(160, 0.15, 'sawtooth', 0.2, -80),
  pickup: () => { tone(600, 0.07, 'square', 0.1); tone(900, 0.08, 'square', 0.1, 0, 0.07); },
  reload: () => { tone(220, 0.05, 'square', 0.1); tone(300, 0.05, 'square', 0.1, 0, 0.2); },
  reward: () => [523, 659, 784].forEach((f, i) => tone(f, 0.14, 'square', 0.12, 0, i * 0.09)),
  rankUp: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i === 4 ? 0.6 : 0.15, 'square', 0.18, 0, i * 0.12)),
};
