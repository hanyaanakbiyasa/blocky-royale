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
export const sfx = {
  click: () => tone(520, 0.06, 'square', 0.08),
  shot: (cat, dist = 0) => {
    const v = 0.22 / (1 + dist / 12);
    const f = { Sniper: 110, Shotgun: 140, Pistol: 260, SMG: 330, Rifle: 200, Fist: 90 }[cat] || 200;
    tone(f, cat === 'Sniper' ? 0.35 : 0.1, 'sawtooth', v, -f * 0.7);
  },
  hit: () => tone(900, 0.05, 'triangle', 0.18),
  hurt: () => tone(160, 0.15, 'sawtooth', 0.2, -80),
  pickup: () => { tone(600, 0.07, 'square', 0.1); tone(900, 0.08, 'square', 0.1, 0, 0.07); },
  reload: () => { tone(220, 0.05, 'square', 0.1); tone(300, 0.05, 'square', 0.1, 0, 0.2); },
  reward: () => [523, 659, 784].forEach((f, i) => tone(f, 0.14, 'square', 0.12, 0, i * 0.09)),
  rankUp: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i === 4 ? 0.6 : 0.15, 'square', 0.18, 0, i * 0.12)),
};
