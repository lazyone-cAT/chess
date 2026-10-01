export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const GLYPH = {
  p: '\u265F',
  n: '\u265E',
  b: '\u265D',
  r: '\u265C',
  q: '\u265B',
  k: '\u265A'
};

export const PNAME = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King'
};

export const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export const FONT_STACK =
  '"Segoe UI Symbol","Noto Sans Symbols 2","Noto Sans Symbols","Apple Symbols","DejaVu Sans",sans-serif';

export function squareCenter(sq, size, orientation = 'w') {
  const f = FILES.indexOf(sq[0]);
  const rank = parseInt(sq[1], 10);
  if (orientation === 'b') {
    return { x: (7 - f + 0.5) * size, y: (rank - 0.5) * size };
  }
  return { x: (f + 0.5) * size, y: (8 - rank + 0.5) * size };
}

/* ------------------------------------------------------------------
   PIECE ALIGNMENT
   Canvas text is positioned from font metrics, not from the ink that
   is actually painted. Chess glyphs (and most symbol fonts) sit far
   away from the "middle" baseline, so centre-aligned text ends up a
   few pixels off inside its square. We measure the real ink box of
   every glyph and return the delta that puts the painted shape dead
   centre of the square (horizontally *and* vertically).
------------------------------------------------------------------ */
let measureCtx = null;
const offsetCache = new Map();

export function glyphOffset(glyph, font) {
  const key = font + '\u0000' + glyph;
  const cached = offsetCache.get(key);
  if (cached) return cached;

  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  measureCtx.textAlign = 'center';
  measureCtx.textBaseline = 'alphabetic';

  let dx = 0;
  let dy = 0;
  const m = measureCtx.measureText(glyph);
  if (m && typeof m.actualBoundingBoxAscent === 'number') {
    const asc = m.actualBoundingBoxAscent;
    const desc = m.actualBoundingBoxDescent || 0;
    const left = m.actualBoundingBoxLeft || 0;
    const right = m.actualBoundingBoxRight || 0;
    // ink centre relative to the align point -> move the origin by the opposite
    dy = (asc - desc) / 2;
    dx = (right - left) / 2;
  } else {
    const pxMatch = font.match(/(\d+(?:\.\d+)?)px/);
    const px = pxMatch ? parseFloat(pxMatch[1]) : 16;
    dy = px * 0.08;
  }

  const out = { dx, dy };
  offsetCache.set(key, out);
  return out;
}

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

export function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}
