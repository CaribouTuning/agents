// The on-screen gamepad.
//
// Drawn on the canvas in the same pixel style as everything else, so it looks
// like part of the machine rather than HTML buttons parked on top of a game.
// Hit areas are deliberately larger than the artwork — thumbs are imprecise
// and a missed D-pad press is the fastest way to make a phone game feel bad.
import { PAL, shade } from '../render/palette.js';
import { drawTextCentered } from '../render/font.js';
import { input } from '../core/input.js';

let layout = null;
let hidden = false;
let fadeAt = 0;
let backChip = null;
// The pad only swallows touches on frames where it was actually drawn.
// Otherwise its regions stay live under screens that hide it (the title,
// character creation) and silently eat taps on whatever is there instead.
let padDrawn = false;
let padDirs = true;
let padStart = true;

export function setControlsHidden(v) { hidden = v; }

// A small BACK affordance for screens that have no D-pad on show. Registered
// as a hit target so a thumb can reach it, and drawn by `drawBackChip`.
export function setBackChip(rect) { backChip = rect; }
export function beginControlsFrame() { padDrawn = false; backChip = null; }
export function getBackChip() { return backChip; }

export function computeLayout(W, H, portrait) {
  const pad = portrait ? 10 : 8;
  // D-pad: a 3x3 cross. `cell` is one arm.
  const cell = portrait ? 26 : Math.max(20, Math.min(26, Math.round(H * 0.13)));
  const dpadSize = cell * 3;
  const dx = pad;
  const dy = H - dpadSize - pad;

  // A sits high-right, B low-left of it — the handheld arrangement — and both
  // are kept fully inside the screen at every size.
  const btnR = portrait ? 17 : Math.max(13, Math.min(19, Math.round(H * 0.095)));
  const ax = W - pad - btnR;
  const ay = Math.min(H - pad - btnR, H - pad - btnR - Math.round(btnR * 0.85));
  const bx = W - pad - Math.round(btnR * 3.1);
  const by = H - pad - btnR;

  layout = {
    W, H, cell, btnR,
    dpad: { x: dx, y: dy, size: dpadSize },
    a: { x: ax, y: ay, r: btnR },
    b: { x: bx, y: by, r: btnR },
    start: { x: W - 44, y: 4, w: 40, h: 12 },
  };
  return layout;
}

export function getLayout() { return layout; }

// Returns the logical button at a point, or null. Registered on the Input
// object so touch handling stays in one place.
export function hitTest(px, py) {
  if (!layout || hidden || !padDrawn) return null;
  const { dpad } = layout;

  if (padDirs) {
    // Generous slack around the cross: thumbs are imprecise, and a missed
    // D-pad press is the fastest way to make a phone game feel bad.
    const slack = 6;
    if (px >= dpad.x - slack && px <= dpad.x + dpad.size + slack
      && py >= dpad.y - slack && py <= dpad.y + dpad.size + slack) {
      const cx = px - dpad.x - dpad.size / 2;
      const cy = py - dpad.y - dpad.size / 2;
      // Whichever axis dominates wins, so diagonals resolve instead of dropping.
      if (Math.abs(cx) > Math.abs(cy)) return cx < 0 ? 'left' : 'right';
      return cy < 0 ? 'up' : 'down';
    }
  }

  const inCircle = (c) => (px - c.x) ** 2 + (py - c.y) ** 2 <= (c.r + 7) ** 2;
  if (inCircle(layout.a)) return 'a';
  if (inCircle(layout.b)) return 'b';
  const s = layout.start;
  if (padStart && px >= s.x - 4 && px <= s.x + s.w + 4 && py >= s.y - 4 && py <= s.y + s.h + 6) return 'start';
  return null;
}

// Checked before the gamepad so a BACK chip always wins over an overlap.
export function hitBack(px, py) {
  if (!backChip) return false;
  const b = backChip;
  return px >= b.x - 4 && px <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4;
}

input.hitTest = (x, y) => (hitBack(x, y) ? 'b' : hitTest(x, y));

// ---- drawing -------------------------------------------------------------

function dpadArm(ctx, x, y, w, h, pressed) {
  const base = pressed ? shade(PAL.uiFrame, 0.30) : PAL.uiFrame;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pressed ? shade(base, -0.2) : shade(base, 0.22);
  ctx.fillRect(x, y, w, 1);
}

function arrow(ctx, cx, cy, dir, pressed) {
  ctx.fillStyle = pressed ? '#ffffff' : shade(PAL.uiBg, -0.06);
  const s = 3;
  for (let i = 0; i < s; i++) {
    const wdt = (i + 1) * 2 - 1;
    if (dir === 'up') ctx.fillRect(cx - Math.floor(wdt / 2), cy - 1 + i, wdt, 1);
    if (dir === 'down') ctx.fillRect(cx - Math.floor(wdt / 2), cy + 1 - i, wdt, 1);
    if (dir === 'left') ctx.fillRect(cx - 1 + i, cy - Math.floor(wdt / 2), 1, wdt);
    if (dir === 'right') ctx.fillRect(cx + 1 - i, cy - Math.floor(wdt / 2), 1, wdt);
  }
}

function roundButton(ctx, c, letter, pressed, color) {
  const { x, y, r } = c;
  ctx.fillStyle = shade(color, -0.45);
  circle(ctx, x, y + 1, r);
  ctx.fillStyle = pressed ? shade(color, -0.18) : color;
  circle(ctx, x, y, r);
  ctx.fillStyle = pressed ? shade(color, -0.05) : shade(color, 0.28);
  circle(ctx, x, y - 1, r - 3);
  drawTextCentered(ctx, letter, x, y - 3, { color: '#ffffff', shadow: shade(color, -0.5) });
}

function circle(ctx, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

/**
 * Draws the gamepad. `alpha` lets screens dim it (during cutscenes) and
 * `mode` swaps the labels so the buttons always say what they will do.
 */
export function drawControls(ctx, opts = {}) {
  if (!layout || hidden) return;
  padDrawn = true;
  const alpha = opts.alpha != null ? opts.alpha : 0.82;
  const dirs = opts.dirs !== false;
  padDirs = dirs;
  padStart = opts.start !== false;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (dirs) {
    const { dpad, cell } = layout;
    const x = dpad.x, y = dpad.y;
    // Cross body.
    dpadArm(ctx, x + cell, y, cell, cell, input.isDown('up'));
    dpadArm(ctx, x, y + cell, cell, cell, input.isDown('left'));
    dpadArm(ctx, x + cell * 2, y + cell, cell, cell, input.isDown('right'));
    dpadArm(ctx, x + cell, y + cell * 2, cell, cell, input.isDown('down'));
    // Hub.
    ctx.fillStyle = shade(PAL.uiFrame, 0.12);
    ctx.fillRect(x + cell, y + cell, cell, cell);
    ctx.fillStyle = shade(PAL.uiFrame, -0.25);
    ctx.fillRect(x + cell + 2, y + cell + 2, cell - 4, cell - 4);

    arrow(ctx, x + cell + cell / 2, y + cell / 2 + 2, 'up', input.isDown('up'));
    arrow(ctx, x + cell + cell / 2, y + cell * 2 + cell / 2 - 2, 'down', input.isDown('down'));
    arrow(ctx, x + cell / 2 + 2, y + cell + cell / 2, 'left', input.isDown('left'));
    arrow(ctx, x + cell * 2 + cell / 2 - 2, y + cell + cell / 2, 'right', input.isDown('right'));
  }

  roundButton(ctx, layout.a, opts.aLabel || 'A', input.isDown('a'), opts.aColor || '#d8493f');
  roundButton(ctx, layout.b, opts.bLabel || 'B', input.isDown('b'), opts.bColor || '#3f6fd4');

  if (opts.start !== false) {
    const s = layout.start;
    ctx.fillStyle = shade(PAL.uiFrame, input.isDown('start') ? 0.3 : 0);
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = shade(PAL.uiFrame, 0.3);
    ctx.fillRect(s.x, s.y, s.w, 1);
    drawTextCentered(ctx, opts.startLabel || 'MENU', s.x + s.w / 2, s.y + 3, { color: PAL.uiTextLight });
  }

  ctx.restore();
  void fadeAt;
}

export function drawBackChip(ctx, x, y, text = 'BACK') {
  const w = text.length * 6 + 10, h = 13;
  setBackChip({ x, y, w, h });
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = shade(PAL.uiFrame, -0.1);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(PAL.uiFrame, 0.25);
  ctx.fillRect(x, y, w, 1);
  ctx.restore();
  drawTextCentered(ctx, text, x + w / 2, y + 3, { color: PAL.uiTextLight });
}

// A one-line hint strip, e.g. "A: Talk   B: Run".
export function hintBar(ctx, W, H, text) {
  if (!text) return;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = PAL.uiFrame;
  ctx.fillRect(0, H - 11, W, 11);
  ctx.restore();
  drawTextCentered(ctx, text, W / 2, H - 9, { color: PAL.uiTextLight });
}
