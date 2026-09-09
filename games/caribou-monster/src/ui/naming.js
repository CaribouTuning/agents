// The on-screen keyboard, and the screen that wraps it.
//
// Two places need to type a name: character creation and nicknaming a Pokémon
// you have just caught. They share the layout and the hit-testing so a thumb
// learns one keyboard, not two.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import { window9, rect, drawText, drawTextCentered, label } from './kit.js';
import { drawBackChip } from './controls.js';
import { renderMonster } from '../render/monsterart.js';
import { getSpecies } from '../data/species.js';

export const KEY_ROWS = [
  'ABCDEFGHIJ',
  'KLMNOPQRST',
  'UVWXYZ    ',
  'abcdefghij',
  'klmnopqrst',
  'uvwxyz-. 0',
  '123456789 ',
];

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

/**
 * Key rectangles in logical pixels. `top` is where the grid starts, so a caller
 * can put a portrait or a text box above it.
 */
export function keyGrid(display, top = 44) {
  const { width: W } = display;
  const cw = Math.min(16, Math.floor((W - 24) / 10));
  const ch = 13;
  const gx = W / 2 - (cw * 10) / 2;
  const cells = [];
  KEY_ROWS.forEach((row, r) => {
    for (let c = 0; c < 10; c++) {
      if (row[c] === ' ') continue;
      cells.push({ ch: row[c], x: gx + c * cw, y: top + r * ch, w: cw - 1, h: ch - 1, r, c });
    }
  });
  const by = top + KEY_ROWS.length * ch + 3;
  return {
    cells, gx, gy: top, cw, ch,
    okX: W / 2 + 6, okY: by,
    delX: W / 2 - 50, delY: by,
    // Only the nickname keyboard offers a skip; character creation always
    // needs a name, so the caller decides whether to draw it.
    skipX: W / 2 + 54, skipY: by,
  };
}

/** Draws the grid plus its DEL / OK (and optionally SKIP) buttons. */
export function drawKeyGrid(ctx, g, kx, ky, opts = {}) {
  for (const cell of g.cells) {
    const sel = cell.r === ky && cell.c === kx;
    rect(ctx, cell.x, cell.y, cell.w, cell.h, sel ? PAL.uiHighlight : PAL.uiBg);
    drawTextCentered(ctx, cell.ch, cell.x + cell.w / 2, cell.y + 3, { color: PAL.uiText });
  }
  rect(ctx, g.delX, g.delY, 44, 14, PAL.uiBgAlt);
  drawTextCentered(ctx, 'DEL', g.delX + 22, g.delY + 4, { color: PAL.uiText });
  rect(ctx, g.okX, g.okY, 44, 14, PAL.hpGreen);
  drawTextCentered(ctx, 'OK', g.okX + 22, g.okY + 4, { color: '#ffffff' });
  if (opts.skip) {
    rect(ctx, g.skipX, g.skipY, 44, 14, PAL.uiShadow);
    drawTextCentered(ctx, 'SKIP', g.skipX + 22, g.skipY + 4, { color: PAL.uiFrame });
  }
}

/**
 * Handles a frame of typing against a grid. Returns the new text plus what the
 * player asked for, so the caller decides what "done" means.
 */
export function typeFrame(g, text, maxLen, cursor, opts = {}) {
  const out = { text, done: false, skipped: false, kx: cursor.kx, ky: cursor.ky };
  const put = (ch) => {
    if (!ch || ch === ' ') return;
    if (out.text.length >= maxLen) { audio.sfx('deny'); return; }
    out.text += ch;
    audio.sfx('select');
  };
  const del = () => {
    if (!out.text.length) { audio.sfx('deny'); return; }
    out.text = out.text.slice(0, -1);
    audio.sfx('back');
  };

  const tap = input.consumeTap();
  if (tap) {
    for (const cell of g.cells) {
      if (hit(tap, cell.x, cell.y, cell.w, cell.h)) { out.kx = cell.c; out.ky = cell.r; put(cell.ch); return out; }
    }
    if (hit(tap, g.okX, g.okY, 44, 14)) { out.done = true; return out; }
    if (hit(tap, g.delX, g.delY, 44, 14)) { del(); return out; }
    if (opts.skip && hit(tap, g.skipX, g.skipY, 44, 14)) { out.done = true; out.skipped = true; return out; }
  }

  if (input.repeated('left')) { out.kx = (out.kx + 9) % 10; audio.sfx('cursor'); }
  if (input.repeated('right')) { out.kx = (out.kx + 1) % 10; audio.sfx('cursor'); }
  if (input.repeated('up')) { out.ky = (out.ky + KEY_ROWS.length - 1) % KEY_ROWS.length; audio.sfx('cursor'); }
  if (input.repeated('down')) { out.ky = (out.ky + 1) % KEY_ROWS.length; audio.sfx('cursor'); }
  if (input.pressed('a')) put(KEY_ROWS[out.ky][out.kx]);
  if (input.pressed('b')) del();
  if (input.pressed('start')) out.done = true;
  return out;
}

// ===========================================================================

/**
 * "Give a nickname to CHIMCHAR?" — the moment a caught Pokémon becomes yours
 * rather than a species entry. The keyboard is the same one that named you.
 */
export class NicknameScreen extends Screen {
  constructor(game, mon, onDone) {
    super(game);
    this.mon = mon;
    this.onDone = onDone || null;
    this.text = '';
    this.kx = 0; this.ky = 0;
    this.t = 0;
  }

  get _species() { return getSpecies(this.mon.species); }

  _top() {
    const H = this.game.display.height;
    return Math.max(46, Math.round(H / 2) - 46);
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    const g = keyGrid(this.game.display, this._top());
    const r = typeFrame(g, this.text, 10, this, { skip: true });
    this.text = r.text; this.kx = r.kx; this.ky = r.ky;
    if (r.done) this._finish(r.skipped);
  }

  _finish(skipped = false) {
    const name = skipped ? '' : this.text.trim();
    if (name) this.mon.nickname = name;
    audio.sfx('select');
    this.game.screens.pop();
    if (this.onDone) this.onDone(name || null);
  }

  hint() { return 'A: type   B: delete   START: done'; }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const sp = this._species;
    rect(ctx, 0, 0, W, H, shade(PAL.uiSelect, -0.6));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade(PAL.uiSelect, -0.55));

    drawTextCentered(ctx, `Give a nickname to ${sp.name.toUpperCase()}?`, W / 2, 8,
      { color: PAL.uiTextLight, shadow: PAL.black });

    // The Pokémon it belongs to, so you are naming a face and not a form field.
    // It sits beside the box rather than above it: on a short screen there is
    // no room above, and the title was landing on top of it.
    const top = this._top();
    const boxY = top - 22;
    const size = 28;
    const sx = Math.round(W / 2 - 66 - size - 4);
    if (sx > 2) {
      const img = renderMonster(sp.art, { size, shiny: this.mon.shiny });
      ctx.drawImage(img, sx, boxY - 6);
    }

    window9(ctx, W / 2 - 66, boxY, 132, 16);
    const shown = this.text || sp.name;
    drawTextCentered(ctx, shown + ((this.t * 2) % 1 < 0.5 ? '_' : ' '), W / 2, boxY + 4,
      { color: this.text ? PAL.uiText : PAL.uiTextDim });

    drawKeyGrid(ctx, keyGrid(this.game.display, top), this.kx, this.ky, { skip: true });
    label(ctx, 'SKIP keeps the species name.', 8, H - 11, { color: '#9ab8ff' });
    void drawText; void drawBackChip;
  }
}
