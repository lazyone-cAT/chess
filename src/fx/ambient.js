/** Floating embers / shooting streaks behind the page. Returns a cleanup fn. */
export function createAmbient(canvas, reduced) {
  if (!canvas || reduced) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let W = 0;
  let H = 0;
  let dpr = 1;

  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  };
  resize();
  window.addEventListener('resize', resize);

  const embers = [];
  const streaks = [];
  const count = window.innerWidth < 700 ? 26 : 46;
  for (let i = 0; i < count; i++) {
    embers.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: -(8 + Math.random() * 26),
      drift: (Math.random() - 0.5) * 16,
      r: 0.7 + Math.random() * 2.2,
      phase: Math.random() * 6.28,
      a: 0.2 + Math.random() * 0.55
    });
  }

  let nextStreak = performance.now() + 3000;
  let last = performance.now();
  let raf = 0;
  let running = true;

  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      for (const e of embers) {
        e.y += e.vy * dt;
        e.x += (e.drift + Math.sin(now / 900 + e.phase) * 12) * dt;
        if (e.y < -10) {
          e.y = H + 10;
          e.x = Math.random() * W;
        }
        if (e.x < -10) e.x = W + 10;
        else if (e.x > W + 10) e.x = -10;
        const flick = 0.65 + Math.sin(now / 260 + e.phase) * 0.35;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 5);
        g.addColorStop(0, 'rgba(255,214,130,' + e.a * flick + ')');
        g.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,240,205,' + Math.min(1, e.a * flick * 1.3) + ')';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (now > nextStreak) {
        nextStreak = now + 4500 + Math.random() * 5000;
        streaks.push({
          x: Math.random() * W,
          y: Math.random() * H,
          a: -0.5 - Math.random() * 0.6,
          len: 120 + Math.random() * 260,
          t: 0,
          life: 0.5 + Math.random() * 0.4
        });
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.t += dt;
        if (s.t >= s.life) {
          streaks.splice(i, 1);
          continue;
        }
        const k = 1 - s.t / s.life;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255,255,255,' + 0.22 * k + ')';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + Math.cos(s.a) * s.len, s.y + Math.sin(s.a) * s.len);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
