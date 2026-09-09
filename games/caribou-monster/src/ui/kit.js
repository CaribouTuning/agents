// UI kit: the handheld window chrome every screen is built from.
//
// One place for frames, panels, cursors, bars and chips means the whole game
// looks like it came from one machine — which is most of what "feels like a
// DS game" actually is.
import { PAL, shade, typeColor } from '../render/palette.js';
import { drawText, drawTextCentered, drawTextRight, textWidth, CHAR_ADVANCE, GLYPH_H } from '../render/font.js';

export const LINE = 10;

export function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function stroke(ctx, x, y, w, h, color, t = 1) {
  ctx.fillStyle = color;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillRect(x + w - t, y, t, h);
}

/**
 * The signature window: a dark rounded border, a light inner bevel and a
 * cream field. Every menu, dialogue box and HUD panel in the game is one.
 */
export function window9(ctx, x, y, w, h, opts = {}) {
  const bg = opts.bg || PAL.uiBg;
  const frame = opts.frame || PAL.uiFrame;
  const inner = opts.inner || PAL.uiFrameLight;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);

  // Outer frame with clipped corners — reads as rounded at this pixel size.
  rect(ctx, x + 1, y, w - 2, h, frame);
  rect(ctx, x, y + 1, w, h - 2, frame);
  // Inner bevel.
  rect(ctx, x + 2, y + 1, w - 4, h - 2, inner);
  rect(ctx, x + 1, y + 2, w - 2, h - 4, inner);
  // Field.
  rect(ctx, x + 3, y + 2, w - 6, h - 4, bg);
  rect(ctx, x + 2, y + 3, w - 4, h - 6, bg);

  if (opts.shadow !== false) {
    ctx.globalAlpha = 0.22;
    rect(ctx, x + 2, y + h, w - 2, 2, PAL.black);
    rect(ctx, x + w, y + 2, 2, h - 2, PAL.black);
    ctx.globalAlpha = 1;
  }
}

// A flatter panel for HUD elements that sit over the world.
export function panel(ctx, x, y, w, h, opts = {}) {
  const bg = opts.bg || PAL.uiBg;
  rect(ctx, x, y, w, h, opts.frame || PAL.uiFrame);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, bg);
  if (opts.accent) rect(ctx, x + 1, y + 1, w - 2, 1, opts.accent);
}

export function shadeScreen(ctx, w, h, alpha = 0.55, color = PAL.black) {
  ctx.globalAlpha = alpha;
  rect(ctx, 0, 0, w, h, color);
  ctx.globalAlpha = 1;
}

// ---- text helpers ------------------------------------------------------

export function label(ctx, s, x, y, opts = {}) {
  drawText(ctx, s, x, y, { color: PAL.uiText, ...opts });
}

export function labelDim(ctx, s, x, y, opts = {}) {
  drawText(ctx, s, x, y, { color: PAL.uiTextDim, ...opts });
}

export function labelLight(ctx, s, x, y, opts = {}) {
  drawText(ctx, s, x, y, { color: PAL.uiTextLight, shadow: PAL.uiFrame, ...opts });
}

export { drawText, drawTextCentered, drawTextRight, textWidth, CHAR_ADVANCE, GLYPH_H };

// ---- cursor ------------------------------------------------------------

let cursorPhase = 0;
export function tickCursor(dt) { cursorPhase += dt; }

export function cursor(ctx, x, y, opts = {}) {
  const bob = Math.floor(cursorPhase * 6) % 2;
  drawText(ctx, '▶', x + bob, y, { color: opts.color || PAL.uiText, scale: opts.scale || 1 });
}

export function blink(period = 0.9) {
  return (cursorPhase % period) < period * 0.62;
}

// ---- list menus --------------------------------------------------------

/**
 * The workhorse vertical menu. Handles the frame, the cursor, scrolling and
 * an optional right-hand column (counts, prices, levels).
 */
export function listMenu(ctx, opts) {
  const {
    x, y, w, rows, items, index, scroll = 0, title = null,
    rightOf = null, colorOf = null, disabledOf = null, itemH = LINE,
  } = opts;
  const headerH = title ? LINE + 2 : 0;
  const h = headerH + rows * itemH + 8;
  window9(ctx, x, y, w, h, opts.windowOpts);

  let ty = y + 5;
  if (title) {
    label(ctx, title, x + 7, ty, { color: PAL.uiTextDim });
    ty += LINE + 2;
  }
  const visible = items.slice(scroll, scroll + rows);
  visible.forEach((it, i) => {
    const idx = scroll + i;
    const iy = ty + i * itemH;
    const text = typeof it === 'string' ? it : it.text;
    const dis = disabledOf ? disabledOf(it, idx) : false;
    const col = dis ? PAL.uiShadow : (colorOf ? colorOf(it, idx) : PAL.uiText);
    if (idx === index) cursor(ctx, x + 4, iy);
    label(ctx, text, x + 12, iy, { color: col });
    const right = rightOf ? rightOf(it, idx) : (typeof it === 'object' ? it.right : null);
    if (right) drawTextRight(ctx, right, x + w - 7, iy, { color: dis ? PAL.uiShadow : PAL.uiTextDim });
  });

  // Scroll nubs so the player knows there is more.
  if (scroll > 0) drawText(ctx, '▲', x + w - 10, y + headerH + 3, { color: PAL.uiTextDim });
  if (scroll + rows < items.length) drawText(ctx, '▼', x + w - 10, y + h - 11, { color: PAL.uiTextDim });
  return h;
}

// Keeps a cursor index and its scroll window in step.
export function moveCursor(index, count, delta, rows, scroll) {
  if (count <= 0) return { index: 0, scroll: 0 };
  let i = (index + delta + count) % count;
  let s = scroll;
  if (i < s) s = i;
  if (i >= s + rows) s = i - rows + 1;
  s = Math.max(0, Math.min(Math.max(0, count - rows), s));
  return { index: i, scroll: s };
}

// ---- bars --------------------------------------------------------------

export function hpColor(frac) {
  if (frac > 0.5) return PAL.hpGreen;
  if (frac > 0.2) return PAL.hpYellow;
  return PAL.hpRed;
}

export function hpBar(ctx, x, y, w, frac, opts = {}) {
  const h = opts.h || 3;
  rect(ctx, x - 1, y - 1, w + 2, h + 2, PAL.uiFrame);
  rect(ctx, x, y, w, h, shade(PAL.uiFrame, 0.25));
  const fw = Math.max(frac > 0 ? 1 : 0, Math.round(w * Math.max(0, Math.min(1, frac))));
  rect(ctx, x, y, fw, h, opts.color || hpColor(frac));
  rect(ctx, x, y, fw, 1, shade(opts.color || hpColor(frac), 0.35));
}

export function expBar(ctx, x, y, w, frac) {
  rect(ctx, x, y, w, 2, shade(PAL.uiFrame, 0.25));
  rect(ctx, x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 2, PAL.expBlue);
}

// ---- chips -------------------------------------------------------------

export function typeChip(ctx, type, x, y, opts = {}) {
  const w = opts.w || textWidth(type.toUpperCase(), 1) + 8;
  const h = 9;
  rect(ctx, x, y, w, h, shade(typeColor(type), -0.35));
  rect(ctx, x, y, w, h - 1, typeColor(type));
  rect(ctx, x + 1, y + 1, w - 2, 1, shade(typeColor(type), 0.3));
  drawTextCentered(ctx, type.toUpperCase(), x + w / 2, y + 1, { color: '#ffffff', shadow: shade(typeColor(type), -0.5) });
  return w;
}

const STATUS_COLORS = {
  PSN: PAL.statusPSN, BRN: PAL.statusBRN, PAR: PAL.statusPAR,
  SLP: PAL.statusSLP, FRZ: PAL.statusFRZ, FNT: PAL.statusFNT,
};

export function statusChip(ctx, status, x, y) {
  if (!status) return 0;
  const w = 18, h = 8;
  rect(ctx, x, y, w, h, shade(STATUS_COLORS[status] || PAL.statusFNT, -0.35));
  rect(ctx, x, y, w, h - 1, STATUS_COLORS[status] || PAL.statusFNT);
  drawTextCentered(ctx, status, x + w / 2, y + 1, { color: '#ffffff' });
  return w;
}

// ---- misc --------------------------------------------------------------

export function genderMark(ctx, gender, x, y) {
  if (gender === 'M') drawText(ctx, '♂', x, y, { color: '#4a90d8' });
  else if (gender === 'F') drawText(ctx, '♀', x, y, { color: '#e05a9a' });
}

export function money(n) {
  return `$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// A soft vignette that stops the world looking like it floats on white.
export function vignette(ctx, w, h, strength = 0.18) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(0.25, 'rgba(0,0,0,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export { PAL, shade, typeColor };
