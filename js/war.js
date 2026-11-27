// Latar animasi: dua tim pemain balok saling menembak (dipakai di loading dan login).
export function startWar(canvas) {
  const c = canvas.getContext('2d'); let w, h, raf, shots = [];
  const fit = () => { w = canvas.width = innerWidth; h = canvas.height = innerHeight; };
  fit(); addEventListener('resize', fit);
  const mk = (team, i) => ({ team, x: team ? w * 0.78 + Math.random() * w * 0.2 : w * 0.02 + Math.random() * w * 0.2, y: h * 0.45 + i * (h * 0.045) + Math.random() * 20, ph: Math.random() * 6, cd: Math.random() * 60 });
  let units = Array.from({ length: 16 }, (_, i) => mk(i % 2, Math.floor(i / 2)));
  const col = ['#38bdf8', '#f87171'];
  const frame = (t) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b1038'); g.addColorStop(0.55, '#f97316'); g.addColorStop(0.56, '#1f2a1c'); g.addColorStop(1, '#0a0a12');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#0006'; for (let i = 0; i < 7; i++) c.fillRect((i * 220 + t / 40) % (w + 100) - 50, h * 0.2 + (i % 3) * 30, 90, 22);
    for (const u of units) {
      const dir = u.team ? -1 : 1, bob = Math.sin(t / 120 + u.ph) * 4;
      u.x += dir * 0.35; if (u.x > w * 0.6 && !u.team || u.x < w * 0.4 && u.team) u.x -= dir * 40 * 0.0 + dir * -0.35 * 1;
      if (--u.cd < 0) { u.cd = 25 + Math.random() * 50; shots.push({ x: u.x + dir * 18, y: u.y - 22 + bob, v: dir * 14, life: 40, f: 5 }); }
      c.fillStyle = col[u.team]; c.fillRect(u.x - 8, u.y - 30 + bob, 16, 18);   // badan
      c.fillStyle = '#fcd9a8'; c.fillRect(u.x - 7, u.y - 44 + bob, 14, 14);      // kepala
      c.fillStyle = '#222'; c.fillRect(u.x - 8, u.y - 12 + bob, 6, 12 - bob / 2); c.fillRect(u.x + 2, u.y - 12 + bob, 6, 12 + bob / 2);
      c.fillRect(u.x + dir * 8 - (dir < 0 ? 18 : 0), u.y - 26 + bob, 18, 5);     // senjata
    }
    for (const s of shots) { s.x += s.v; s.life--; c.fillStyle = '#fde047'; c.fillRect(s.x, s.y, -s.v * 1.4, 2); if (s.f-- > 0) { c.fillStyle = '#fff'; c.fillRect(s.x - 5, s.y - 4, 10, 10); } }
    shots = shots.filter((s) => s.life > 0);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
}
