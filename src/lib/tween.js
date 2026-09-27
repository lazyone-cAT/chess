export const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
export const easeOutQuint = (p) => 1 - Math.pow(1 - p, 5);

/** Tiny rAF tween used for the board intro and the end-of-match cinematic. */
export function tween(dur, ease, step, done) {
  const t0 = performance.now();
  let cancelled = false;
  const loop = (now) => {
    if (cancelled) return;
    const p = Math.min(1, (now - t0) / (dur * 1000));
    step(ease ? ease(p) : p);
    if (p < 1) requestAnimationFrame(loop);
    else if (done) done();
  };
  requestAnimationFrame(loop);
  return () => {
    cancelled = true;
  };
}
