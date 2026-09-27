import { FILES, GLYPH, FONT_STACK, squareCenter, glyphOffset } from '../lib/glyphs';

/* ------------------------------------------------------------------
   BoardFX — canvas engine for pieces, trails, sparks and shake.
   Pieces are drawn as glyphs whose *ink* box is measured and centred,
   so every piece sits exactly in the middle of its square.
------------------------------------------------------------------ */

function drawGlyph(ctx, glyph, font, x, y, style) {
  const off = glyphOffset(glyph, font);
  const sx = style.sx == null ? 1 : style.sx;
  const sy = style.sy == null ? 1 : style.sy;
  const rot = style.rot || 0;
  const alpha = style.alpha == null ? 1 : style.alpha;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  if (style.lineWidth > 0) {
    ctx.lineWidth = style.lineWidth;
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(glyph, -off.dx, off.dy);
  }
  if (style.shadow) {
    ctx.shadowColor = style.shadow.color;
    ctx.shadowBlur = style.shadow.blur;
    ctx.shadowOffsetY = style.shadow.offsetY;
    ctx.shadowOffsetX = 0;
  }
  ctx.fillStyle = style.fill;
  ctx.fillText(glyph, -off.dx, off.dy);
  ctx.restore();
}

export class BoardFX {
  constructor({ canvas, boardEl, shakeEl, getBoard, getInteraction, getQueueDepth, reduced }) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.boardEl = boardEl;
    this.shakeEl = shakeEl;
    this.getBoard = getBoard;
    this.getInteraction = getInteraction || (() => ({}));
    this.getQueueDepth = getQueueDepth || (() => 0);
    this.reduced = !!reduced;

    this.pieces = new Map();
    this.ghosts = [];
    this.parts = [];
    this.rings = [];
    this.lines = [];
    this.slashes = [];
    this.bolts = [];
    this.pillars = [];
    this.flashes = [];
    this.glowItems = [];

    this.shake = { t: 0, mag: 0 };
    this.moveAnim = null;

    this.W = 0;
    this.H = 0;
    this.S = 0;
    this.dpr = 1;
    this.ready = false;
    this.running = false;
    this.last = performance.now();

    this._onResize = () => this.resize();
    this._loop = this._loop.bind(this);
  }

  /* ---------------- lifecycle ---------------- */
  start() {
    if (!this.canvas || !this.ctx) return false;
    this.ready = true;
    this.resize();
    window.addEventListener('resize', this._onResize);
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._loop);
    return true;
  }

  destroy() {
    this.running = false;
    window.removeEventListener('resize', this._onResize);
  }

  resize() {
    if (!this.ready || !this.boardEl) return;
    const rect = this.boardEl.getBoundingClientRect();
    if (!rect.width) return;
    this.W = rect.width;
    this.H = rect.height;
    this.S = this.W / 8;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    for (const p of this.pieces.values()) this.stylePiece(p);
    this.layoutAll();
  }

  centerOf(sq) {
    return squareCenter(sq, this.S);
  }

  /* ---------------- pieces ---------------- */
  stylePiece(p) {
    const S = this.S || 1;
    const fs = Math.max(14, S * 0.7);
    p.font = '700 ' + fs + 'px ' + FONT_STACK;
    p.lineWidth = Math.max(2, S * 0.075);
    p.glyph = GLYPH[p.type] || p.type;
    if (p.color === 'w') {
      p.fill = '#fffbf0';
      p.stroke = 'rgba(40,30,14,.95)';
      p.shadow = { color: 'rgba(0,0,0,.55)', offsetY: Math.max(2, S * 0.04), blur: Math.max(3, S * 0.05) };
    } else {
      p.fill = '#16141d';
      p.stroke = 'rgba(244,236,214,.9)';
      p.shadow = { color: 'rgba(255,255,255,.3)', offsetY: Math.max(1, S * 0.02), blur: Math.max(2, S * 0.03) };
    }
    p.selectedShadow = { color: 'rgba(240,192,74,.95)', offsetY: 0, blur: Math.max(10, S * 0.5) };
  }

  makePiece(type, color) {
    const p = { type, color, x: 0, y: 0, sx: 1, sy: 1, rot: 0, alpha: 1, anim: false, pop: 0, phase: Math.random() * Math.PI * 2 };
    this.stylePiece(p);
    return p;
  }

  layoutAll() {
    for (const p of this.pieces.values()) {
      if (p.anim || p.sq == null) continue;
      const c = this.centerOf(p.sq);
      p.bx = c.x;
      p.by = c.y;
    }
  }

  sync() {
    if (!this.ready) return;
    if (this.moveAnim) return;
    const pos = this.getBoard ? this.getBoard() : null;
    if (!pos) return;

    const keep = new Set();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = pos[r][f];
        if (!cell) continue;
        const sq = FILES[f] + (8 - r);
        keep.add(sq);
        let p = this.pieces.get(sq);
        if (!p) {
          p = this.makePiece(cell.type, cell.color);
          p.pop = performance.now();
          p.sq = sq;
          this.pieces.set(sq, p);
        } else if (p.type !== cell.type || p.color !== cell.color) {
          p.type = cell.type;
          p.color = cell.color;
          this.stylePiece(p);
          p.pop = performance.now();
          p.sq = sq;
        } else {
          p.sq = sq;
        }
      }
    }
    for (const [sq, p] of Array.from(this.pieces)) {
      if (!keep.has(sq) && !p.anim) this.pieces.delete(sq);
    }
    this.layoutAll();
  }

  /* ---------------- fx primitives ---------------- */
  burst(x, y, power, color) {
    const s = this.S;
    this.rings.push({ x, y, r0: s * 0.14, r1: s * (0.75 + 0.55 * power), t: 0, life: 0.44, w: 3.5, c: '#ffffff' });
    this.rings.push({ x, y, r0: s * 0.08, r1: s * (0.5 + 0.4 * power), t: 0, life: 0.6, w: 6, c: color });
    const n = Math.round((9 + 9 * power) * (this.reduced ? 0.4 : 1));
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
      const len = s * (0.35 + Math.random() * 0.55) * power;
      this.lines.push({
        x, y, a, len,
        w: 1.2 + Math.random() * 2.6,
        t: 0,
        life: 0.24 + Math.random() * 0.14,
        c: i % 3 === 0 ? '#ffffff' : color
      });
    }
    const sp = Math.round(16 * power * (this.reduced ? 0.5 : 1));
    for (let i = 0; i < sp; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = s * (2.2 + Math.random() * 4.4);
      this.parts.push({
        kind: 'spark', x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        g: 0, drag: 0.9, size: 1 + Math.random() * 2.6,
        t: 0, life: 0.32 + Math.random() * 0.4,
        c: Math.random() < 0.4 ? '#ffffff' : color
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({
        kind: 'dust',
        x: x + Math.cos(a) * s * 0.16,
        y: y + Math.sin(a) * s * 0.16,
        vx: Math.cos(a) * s * 1.5,
        vy: Math.sin(a) * s * 1.1 - s * 0.4,
        g: s * 2.4, drag: 0.93,
        size: s * (0.1 + Math.random() * 0.12),
        t: 0, life: 0.5 + Math.random() * 0.3,
        c: 'rgba(226,214,186,.75)'
      });
    }
    this.flashes.push({ x, y, r: s * 0.95, t: 0, life: 0.15, c: '#ffffff', a: 0.55 * Math.min(1, power) });
    this.glowItems.push({ x, y, r0: s * 0.2, r1: s * (0.8 + 0.5 * power), t: 0, life: 0.5, c: 'rgba(255,214,130,.55)' });
  }

  shatter(x, y, glyph, color) {
    const s = this.S;
    this.slashes.push({ x, y, a: -Math.PI / 4, len: s * 0.95, w: Math.max(6, s * 0.16), t: 0, life: 0.3, c: '#ffffff' });
    this.slashes.push({ x, y, a: Math.PI / 4, len: s * 0.95, w: Math.max(6, s * 0.16), t: 0, life: 0.34, c: '#ffffff' });
    const base = color === 'w' ? '#f4efe2' : '#1d1a26';
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = s * (2.4 + Math.random() * 5);
      this.parts.push({
        kind: 'shard',
        x: x + (Math.random() - 0.5) * s * 0.3,
        y: y + (Math.random() - 0.5) * s * 0.3,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - s * 1.6,
        g: s * 7.5, drag: 0.99,
        size: s * (0.04 + Math.random() * 0.1),
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 16,
        t: 0, life: 0.7 + Math.random() * 0.45,
        c: Math.random() < 0.35 ? '#ff5578' : base
      });
    }
    const fs = Math.max(14, s * 0.7);
    this.ghosts.push({
      glyph,
      font: '700 ' + fs + 'px ' + FONT_STACK,
      fill: color === 'w' ? '#fffbf0' : '#16141d',
      stroke: color === 'w' ? 'rgba(40,30,14,.95)' : 'rgba(244,236,214,.9)',
      lineWidth: Math.max(2, s * 0.075),
      shadow: null,
      x, y, rot: (Math.random() - 0.5) * 24, alpha: 0.95,
      sx: 1, sy: 1, t: 0, life: 0.5, growTo: 2.0
    });
    this.flashes.push({ x, y, r: s * 1.1, t: 0, life: 0.22, c: '#ff4d70', a: 0.5 });
    this.burst(x, y, 1.5, '#ff5578');
  }

  lightning() {
    const pts = [];
    const { W, H, S } = this;
    const y0 = H * (0.18 + Math.random() * 0.12);
    let x = -S * 0.2;
    let y = y0;
    pts.push(x, y);
    while (x < W + S * 0.2) {
      x += S * (0.5 + Math.random() * 0.7);
      y = Math.max(H * 0.06, Math.min(H * 0.94, y + (Math.random() - 0.5) * H * 0.45));
      pts.push(x, y);
    }
    this.bolts.push({ pts, t: 0, life: 0.4 });
    this.flashes.push({ x: W / 2, y: H / 2, r: Math.max(W, H), t: 0, life: 0.34, c: '#ff2d55', a: 0.42, full: true });
    this.shakeIt(this.reduced ? 2 : 6, 0.3);
  }

  pillar(x, color) {
    this.pillars.push({ x, t: 0, life: 0.75, c: color || '#ffe08a' });
    this.flashes.push({ x, y: this.H / 2, r: this.S * 1.4, t: 0, life: 0.5, c: '#ffffff', a: 0.5 });
    this.burst(x, this.H / 2, 1.2, '#ffe08a');
  }

  shakeIt(mag, dur) {
    if (this.reduced) return;
    this.shake.mag = Math.max(this.shake.mag, mag);
    this.shake.t = Math.max(this.shake.t, dur);
  }

  speedBurst() {
    const cx = this.W / 2;
    const cy = this.H / 2;
    for (let i = 0; i < 26; i++) {
      const a = (Math.PI * 2 * i) / 26 + Math.random() * 0.2;
      this.lines.push({
        x: cx, y: cy, a,
        len: Math.max(this.W, this.H) * 0.6,
        w: 1 + Math.random() * 3,
        t: 0, life: 0.5 + Math.random() * 0.3,
        c: i % 4 === 0 ? '#ff5578' : '#ffffff',
        from: 0.15
      });
    }
    this.flashes.push({ x: cx, y: cy, r: Math.max(this.W, this.H), t: 0, life: 0.3, c: '#ffffff', a: 0.4, full: true });
  }

  /* ---------------- move choreography ---------------- */
  playMove(move, cb) {
    if (!this.ready) {
      if (cb) cb();
      return;
    }
    const mover = this.pieces.get(move.from);
    const capSq = move.flags.indexOf('e') >= 0 ? move.to[0] + move.from[1] : move.to;
    const victim = move.captured ? this.pieces.get(capSq) : null;
    if (victim) this.pieces.delete(capSq);

    let rookObj = null;
    let rookTo = null;
    if (move.flags.indexOf('k') >= 0 || move.flags.indexOf('q') >= 0) {
      const side = move.flags.indexOf('k') >= 0 ? 'k' : 'q';
      const rf = move.color === 'w' ? '1' : '8';
      const from = (side === 'k' ? 'h' : 'a') + rf;
      const to = side === 'k' ? 'f' + rf : 'd' + rf;
      rookObj = this.pieces.get(from);
      if (rookObj) {
        this.pieces.delete(from);
        this.pieces.set(to, rookObj);
        rookObj.anim = true;
        rookTo = to;
        const start = this.centerOf(from);
        rookObj.rx0 = start.x;
        rookObj.ry0 = start.y;
        rookObj.x = start.x;
        rookObj.y = start.y;
      }
    }

    if (!mover) {
      if (rookObj) rookObj.anim = false;
      if (cb) cb();
      return;
    }

    this.pieces.delete(move.from);
    this.pieces.set(move.to, mover);
    mover.anim = true;
    mover.pop = 0;
    this.moveAnim = {
      move,
      mover,
      victim,
      rookObj,
      rookTo,
      from: this.centerOf(move.from),
      to: this.centerOf(move.to),
      start: performance.now(),
      impacted: false,
      ghostAt: 0,
      cb
    };
  }

  stepMove(now) {
    const m = this.moveAnim;
    if (!m) return;
    const knight = m.move.piece === 'n';
    const A = 0.075;
    const TR = knight ? 0.4 : 0.31;
    const LAND = 0.27;
    const total = A + TR + LAND;
    const el = (now - m.start) / 1000;
    const { mover, from, to } = m;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const ang = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy) || 1;
    const S = this.S;

    if (el < A) {
      const p = el / A;
      mover.x = from.x - Math.cos(ang) * S * 0.1 * p;
      mover.y = from.y - Math.sin(ang) * S * 0.1 * p;
      mover.sx = 1 - 0.1 * p;
      mover.sy = 1 + 0.09 * p;
      mover.rot = 0;
    } else if (el < A + TR) {
      const p = (el - A) / TR;
      const e = 1 - Math.pow(1 - p, 4);
      let x = from.x + dx * e;
      let y = from.y + dy * e;
      let hop = 0;
      if (knight) {
        const nx = -dy / dist;
        const ny = dx / dist;
        const off = dist * 0.22;
        const cx = (from.x + to.x) / 2 + nx * off;
        const cy = (from.y + to.y) / 2 + ny * off;
        const it = 1 - e;
        x = it * it * from.x + 2 * it * e * cx + e * e * to.x;
        y = it * it * from.y + 2 * it * e * cy + e * e * to.y;
        hop = Math.sin(Math.PI * p) * S * 0.34;
      } else {
        hop = Math.sin(Math.PI * p) * S * 0.13;
      }
      mover.x = x;
      mover.y = y - hop;
      const k = 0.55 * Math.sin(Math.PI * p);
      mover.sx = 1 + k * Math.abs(Math.cos(ang));
      mover.sy = 1 + k * Math.abs(Math.sin(ang));
      mover.rot = Math.sin(Math.PI * p) * (knight ? 24 : 9) * (dx >= 0 ? 1 : -1);

      if (now - m.ghostAt > 42) {
        m.ghostAt = now;
        this.spawnGhost(mover, x, y - hop);
      }
      const bx = x - Math.cos(ang) * dist * 0.3;
      const by = y - hop - Math.sin(ang) * dist * 0.3;
      this.lines.push({
        x: bx, y: by, a: ang, len: dist * 0.42,
        w: Math.max(2, S * 0.05), t: 0, life: 0.16,
        c: m.move.color === 'w' ? 'rgba(255,244,214,.9)' : 'rgba(150,200,255,.85)',
        dirBack: true
      });
    } else if (!m.impacted) {
      m.impacted = true;
      this.impact(m);
    }

    if (el >= A + TR) {
      const u = Math.min(1, (el - A - TR) / LAND);
      mover.x = to.x;
      mover.y = to.y;
      const sq = 1 + 0.34 * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u);
      mover.sx = 1 / Math.sqrt(sq);
      mover.sy = sq;
      mover.rot *= 1 - u * 0.8;
      if (m.rookObj && m.rookTo) {
        const rp = this.centerOf(m.rookTo);
        const rr = Math.min(1, u * 1.4);
        m.rookObj.x = m.rookObj.rx0 + (rp.x - m.rookObj.rx0) * (1 - Math.pow(1 - rr, 3));
        m.rookObj.y = m.rookObj.ry0;
        m.rookObj.sx = 1;
        m.rookObj.sy = 1;
      }
    }

    if (el >= total) {
      mover.sx = 1;
      mover.sy = 1;
      mover.rot = 0;
      mover.x = to.x;
      mover.y = to.y;
      mover.anim = false;
      if (m.rookObj) {
        m.rookObj.anim = false;
        m.rookObj.sx = 1;
        m.rookObj.sy = 1;
        m.rookObj.rot = 0;
      }
      this.moveAnim = null;
      const cb = m.cb;
      // Rebuilding the piece map mid-queue would teleport the next mover,
      // so only re-sync when nothing else is waiting to animate.
      if (this.getQueueDepth() === 0) this.sync();
      if (cb) cb();
    }
  }

  spawnGhost(src, x, y) {
    this.ghosts.push({
      glyph: src.glyph,
      font: src.font,
      fill: src.fill,
      stroke: src.stroke,
      lineWidth: src.lineWidth,
      shadow: null,
      x, y,
      rot: src.rot || 0,
      alpha: 0.5,
      sx: (src.sx || 1) * 1.04,
      sy: (src.sy || 1) * 1.04,
      t: 0,
      life: 0.3
    });
  }

  impact(m) {
    const p = this.centerOf(m.move.to);
    const isCap = !!m.victim;
    if (m.victim) {
      this.shatter(p.x, p.y, GLYPH[m.victim.type], m.victim.color);
      for (const [sq, piece] of Array.from(this.pieces)) {
        if (piece === m.victim) this.pieces.delete(sq);
      }
      m.victim = null;
    } else {
      this.burst(p.x, p.y, 0.85, '#ffd980');
    }
    this.shakeIt(isCap ? 7 : 4, 0.26);
    if (m.rookObj && m.rookTo) {
      const rp = this.centerOf(m.rookTo);
      this.burst(rp.x, rp.y, 0.5, '#ffd980');
    }
    if (m.move.promotion) this.pillar(p.x, '#ffe08a');
  }

  isBusy() {
    return !!this.moveAnim;
  }

  clearFx() {
    this.ghosts.length = 0;
    this.parts.length = 0;
    this.rings.length = 0;
    this.lines.length = 0;
    this.slashes.length = 0;
    this.bolts.length = 0;
    this.pillars.length = 0;
    this.flashes.length = 0;
    this.glowItems.length = 0;
  }

  /* ---------------- loop ---------------- */
  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!document.hidden) {
      this.stepMove(now);
      this.updatePieces(now);
      this.stepFx(dt);
      this.updateShake(dt);
      this.draw();
    }
    requestAnimationFrame(this._loop);
  }

  updatePieces(now) {
    const { selected, hover } = this.getInteraction();
    for (const p of this.pieces.values()) {
      if (p.anim) continue;
      if (p.sq == null) continue;
      const c = this.centerOf(p.sq);
      p.bx = c.x;
      p.by = c.y;
      let sc = 1;
      let dy = Math.sin(now / 620 + p.phase) * (this.reduced ? 0.3 : 1.1);
      if (p.sq === selected) {
        sc = 1.13;
        dy -= this.S * 0.07;
      } else if (p.sq === hover) {
        sc = 1.07;
      }
      let extra = 1;
      if (p.pop) {
        const q = (now - p.pop) / 460;
        if (q < 1) extra = popScale(q);
        else p.pop = 0;
      }
      p.x = c.x;
      p.y = c.y + dy;
      p.sx = sc * extra;
      p.sy = sc * extra;
      p.rot = 0;
      p.alpha = 1;
      p.useGlow = p.sq === selected;
    }
  }

  stepFx(dt) {
    const step = (arr) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].t += dt;
        if (arr[i].t >= arr[i].life) arr.splice(i, 1);
      }
    };
    step(this.rings);
    step(this.lines);
    step(this.slashes);
    step(this.bolts);
    step(this.pillars);
    step(this.flashes);
    step(this.glowItems);

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.t += dt;
      const k = Math.max(0, 1 - g.t / g.life);
      g.alpha = (g.fadeFrom != null ? g.fadeFrom : 0.5) * k;
      if (g.growTo) {
        const grow = 1 + (g.growTo - 1) * Math.min(1, g.t / g.life);
        g.sx = grow;
        g.sy = grow;
      }
      if (g.t >= g.life) this.ghosts.splice(i, 1);
    }

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot != null) p.rot += p.vr * dt;
    }
  }

  updateShake(dt) {
    if (this.shake.t > 0) {
      this.shake.t -= dt;
      const k = Math.max(0, this.shake.t) * this.shake.mag * 6;
      if (this.shakeEl) {
        this.shakeEl.style.transform =
          'translate(' + ((Math.random() - 0.5) * k).toFixed(2) + 'px,' + ((Math.random() - 0.5) * k).toFixed(2) + 'px)';
      }
      if (this.shake.t <= 0) {
        this.shake.mag = 0;
        if (this.shakeEl) this.shakeEl.style.transform = 'translate(0,0)';
      }
    }
  }

  /* ---------------- draw ---------------- */
  draw() {
    const ctx = this.ctx;
    const { W, H, S } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ground glows
    for (const it of this.glowItems) {
      const k = it.t / it.life;
      const r = it.r0 + (it.r1 - it.r0) * k;
      const g = ctx.createRadialGradient(it.x, it.y, 0, it.x, it.y, r);
      g.addColorStop(0, it.c);
      g.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(it.x, it.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ghosts behind live pieces
    for (const g of this.ghosts) {
      drawGlyph(ctx, g.glyph, g.font, g.x, g.y, g);
    }

    // pieces
    for (const p of this.pieces.values()) {
      const style = {
        fill: p.fill,
        stroke: p.stroke,
        lineWidth: p.lineWidth,
        shadow: p.useGlow ? p.selectedShadow : p.shadow,
        alpha: p.alpha,
        sx: p.sx,
        sy: p.sy,
        rot: p.rot
      };
      drawGlyph(ctx, p.glyph, p.font, p.x, p.y, style);
    }

    // normal fx layer
    this.drawNormal(ctx);

    // additive layer
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.drawAdditive(ctx);
    ctx.restore();

    // flashes
    this.drawFlashes(ctx);
  }

  drawNormal(ctx) {
    for (const p of this.parts) {
      const k = 1 - p.t / p.life;
      if (p.kind === 'shard') {
        const s = p.size;
        const cos = Math.cos(p.rot || 0);
        const sin = Math.sin(p.rot || 0);
        const pt = (dx, dy) => [p.x + dx * cos - dy * sin, p.y + dx * sin + dy * cos];
        const a = pt(0, -s);
        const b = pt(s * 0.85, s * 0.55);
        const c = pt(-s * 0.85, s * 0.45);
        ctx.globalAlpha = k;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'dust') {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + p.t * 1.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = k;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + k), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    for (const b of this.bolts) {
      const k = 1 - b.t / b.life;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 5 * k);
      ctx.strokeStyle = 'rgba(255,120,150,' + 0.9 * k + ')';
      ctx.beginPath();
      ctx.moveTo(b.pts[0], b.pts[1]);
      for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.strokeStyle = 'rgba(255,255,255,' + k + ')';
      ctx.beginPath();
      ctx.moveTo(b.pts[0], b.pts[1]);
      for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  drawAdditive(ctx) {
    for (const p of this.parts) {
      if (p.kind !== 'spark') continue;
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + k * 1.3), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of this.rings) {
      const k = r.t / r.life;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2));
      ctx.lineWidth = Math.max(0.5, r.w * (1 - k));
      ctx.strokeStyle = r.c;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const l of this.lines) {
      const k = 1 - l.t / l.life;
      const inner = (l.from || 0) * l.len;
      let s0;
      let s1;
      if (l.dirBack) {
        s0 = inner + l.len * (1 - k);
        s1 = inner + l.len;
      } else {
        s0 = inner;
        s1 = inner + l.len * (1 - Math.pow(1 - k, 2));
      }
      const x0 = l.x + Math.cos(l.a) * s0;
      const y0 = l.y + Math.sin(l.a) * s0;
      const x1 = l.x + Math.cos(l.a) * s1;
      const y1 = l.y + Math.sin(l.a) * s1;
      ctx.lineWidth = Math.max(0.6, l.w * k);
      ctx.strokeStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    for (const s of this.slashes) {
      const k = 1 - s.t / s.life;
      const len = s.len * (1 + (1 - k) * 0.5);
      ctx.lineWidth = Math.max(1, s.w * k);
      ctx.strokeStyle = s.c;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.a) * len, s.y - Math.sin(s.a) * len);
      ctx.lineTo(s.x + Math.cos(s.a) * len, s.y + Math.sin(s.a) * len);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.6, s.w * k * 0.45);
      ctx.strokeStyle = '#ff5578';
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.a) * len, s.y - Math.sin(s.a) * len);
      ctx.lineTo(s.x + Math.cos(s.a) * len, s.y + Math.sin(s.a) * len);
      ctx.stroke();
    }

    for (const p of this.pillars) {
      const k = 1 - p.t / p.life;
      const w = this.S * (0.5 + (1 - k) * 0.9);
      const grad = ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, p.c);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x - w, 0, w * 2, this.H * (1 - (1 - k) * 0.2));
    }
  }

  drawFlashes(ctx) {
    const { W, H } = this;
    for (const f of this.flashes) {
      const k = 1 - f.t / f.life;
      const alpha = Math.max(0, f.a * k);
      if (f.full) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = f.c;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        continue;
      }
      const r = f.r * (1 + (1 - k) * 0.6);
      const rgb = toRGB(f.c);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')');
      g.addColorStop(0.72, 'rgba(' + rgb + ',' + (alpha * 0.35).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function popScale(p) {
  if (p >= 1) return 1;
  const e = 1 - Math.pow(1 - p, 3);
  return e + Math.sin(p * Math.PI) * 0.28;
}

function toRGB(c) {
  if (c[0] !== '#') return c.replace(/^rgba?\(|\)$/g, '').split(',').slice(0, 3).join(',');
  const h = c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1);
  return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
}
