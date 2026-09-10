// The dig screen.
//
// The one screen in this game that is better on a phone than it was on a DS:
// you tap the rock and the rock comes away. Everything about it is aimed at a
// thumb — big cells, two big tool chips, and a roof meter you can read without
// looking away from where you are digging.
//
// The model is in game/underground/dig.js and knows nothing about drawing.
// This file is the hands.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import {
  PAL, shade, window9, rect, stroke, label, labelDim, drawText, drawTextCentered,
  meterBar, LINE,
} from './kit.js';
import { drawBackChip, getBackChip } from './controls.js';
import { getItem } from '../data/items.js';
import { addItem } from '../game/inventory.js';
import {
  TOOLS, strike, stability, depthAt, itemAt, shapeBox, found, missed, isDone, MAX_DEPTH,
} from '../game/underground/dig.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

// Rock, lightest at the surface. Layer 0 is not drawn: it is the floor.
const ROCK = ['#000000', '#6a5646', '#8a705a', '#a4886c'];

export class DigScreen extends Screen {
  constructor(game, dig, onFinish) {
    super(game);
    this.dig = dig;
    this.onFinish = onFinish;
    this.cursor = { x: Math.floor(dig.w / 2), y: Math.floor(dig.h / 2) };
    this.message = 'Something is buried here. Get it out before the roof goes.';
    this.messageT = 0;
    this.shake = 0;
    this.flash = 0;
    this.ending = 0;          // counts up once the dig is over
    this.collected = false;
    this.hits = [];           // little animations: { x, y, t }
  }

  onEnter() { audio.sfx('select'); }

  // ---- update -------------------------------------------------------------

  update(dt, isTop) {
    if (!isTop) return;
    this.messageT += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 4);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
    for (const h2 of this.hits) h2.t += dt;
    this.hits = this.hits.filter((h2) => h2.t < 0.35);

    if (isDone(this.dig)) {
      this.ending += dt;
      // A beat to read the last thing that came out, then the tally.
      if (this.ending > 0.9) this._finish();
      return;
    }

    const tap = input.consumeTap();
    if (tap) { this._handleTap(tap); return; }

    if (input.pressed('b')) { this._finish(); return; }
    if (input.pressed('start')) { this._swapTool(); return; }
    const dir = input.pressedDirection ? input.pressedDirection() : null;
    if (input.repeated('left')) this._move(-1, 0);
    if (input.repeated('right')) this._move(1, 0);
    if (input.repeated('up')) this._move(0, -1);
    if (input.repeated('down')) this._move(0, 1);
    if (input.pressed('a')) this._strike(this.cursor.x, this.cursor.y);
    void dir;
  }

  _move(dx, dy) {
    this.cursor.x = Math.max(0, Math.min(this.dig.w - 1, this.cursor.x + dx));
    this.cursor.y = Math.max(0, Math.min(this.dig.h - 1, this.cursor.y + dy));
    audio.sfx('cursor');
  }

  _swapTool() {
    this.dig.tool = this.dig.tool === 'hammer' ? 'pick' : 'hammer';
    audio.sfx('cursor');
  }

  _handleTap(tap) {
    const L = this._layout();
    const back = getBackChip();
    if (back && hit(tap, back.x, back.y, back.w, back.h)) { this._finish(); return; }
    for (const [name, box] of Object.entries(L.tools)) {
      if (hit(tap, box.x, box.y, box.w, box.h)) {
        if (this.dig.tool !== name) { this.dig.tool = name; audio.sfx('cursor'); }
        return;
      }
    }
    if (!hit(tap, L.gx, L.gy, L.cell * this.dig.w, L.cell * this.dig.h)) return;
    const x = Math.floor((tap.x - L.gx) / L.cell);
    const y = Math.floor((tap.y - L.gy) / L.cell);
    this.cursor.x = x; this.cursor.y = y;
    this._strike(x, y);
  }

  _strike(x, y) {
    const res = strike(this.dig, x, y);
    if (res.wasted) { audio.sfx('deny'); this._say('There is nothing left to take off there.'); return; }
    if (!res.ok) return;

    this.hits.push({ x, y, t: 0, tool: this.dig.tool });
    audio.sfx(this.dig.tool === 'hammer' ? 'bump' : 'cursor');
    this.shake = this.dig.tool === 'hammer' ? 1 : 0.5;

    for (const it of res.found) {
      addItem(this.game.state.inventory, it.item, 1);
      audio.sfx('buy');
      this.flash = 1;
      this._say(`You dug up a ${getItem(it.item).name}!`);
    }
    if (res.collapsed) {
      audio.sfx('deny');
      this.shake = 1.4;
      this._say('The roof is coming in!');
    } else if (!res.found.length && stability(this.dig) < 0.34) {
      this._say('The walls are shaking. Not much longer.');
    }
    if (this.game.save) this.game.save.markDirty();
  }

  _say(text) { this.message = text; this.messageT = 0; }

  _finish() {
    if (this.collected) return;
    this.collected = true;
    this.game.screens.pop();
    if (this.onFinish) this.onFinish({ found: found(this.dig), missed: missed(this.dig), collapsed: this.dig.collapsed });
  }

  hint() { return 'Tap the rock · MENU swaps tool · B leaves'; }

  // ---- layout -------------------------------------------------------------

  _layout() {
    const { width: W, height: H } = this.game.display;
    const top = 22;                       // the roof meter
    const bottom = 34;                    // a line of text, then the tools
    const cell = Math.max(10, Math.min(
      Math.floor((W - 12) / this.dig.w),
      Math.floor((H - top - bottom) / this.dig.h),
    ));
    const gw = cell * this.dig.w;
    const gh = cell * this.dig.h;
    const gx = Math.round((W - gw) / 2);
    const gy = top + Math.round((H - top - bottom - gh) / 2);
    const tw = 52, th = 15;
    const ty = H - th - 3;
    // Two tool chips, centred, with the running commentary on its own line
    // above them. It used to share the line and got cut off mid-sentence.
    const tx = Math.round((W - (tw * 2 + 8)) / 2);
    return {
      W, H, cell, gx, gy, gw, gh,
      tools: {
        hammer: { x: tx, y: ty, w: tw, h: th },
        pick: { x: tx + tw + 8, y: ty, w: tw, h: th },
      },
      msgY: ty - 11,
    };
  }

  // ---- render -------------------------------------------------------------

  render(ctx) {
    const L = this._layout();
    rect(ctx, 0, 0, L.W, L.H, shade(PAL.caveWallDark, -0.35));

    ctx.save();
    if (this.shake > 0) {
      ctx.translate(Math.round((Math.random() - 0.5) * this.shake * 3),
        Math.round((Math.random() - 0.5) * this.shake * 3));
    }
    this._drawGrid(ctx, L);
    ctx.restore();

    this._drawRoofMeter(ctx, L);
    this._drawTools(ctx, L);
    this._drawMessage(ctx, L);
    drawBackChip(ctx, L.W - 40, 4, 'LEAVE');

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash * 0.35;
      rect(ctx, 0, 0, L.W, L.H, '#ffffff');
      ctx.restore();
    }
  }

  _drawGrid(ctx, L) {
    const { cell, gx, gy } = L;
    // The floor under everything, so a cleared cell reveals rock face.
    rect(ctx, gx - 2, gy - 2, L.gw + 4, L.gh + 4, shade(PAL.caveFloorDark, -0.2));

    for (let y = 0; y < this.dig.h; y++) {
      for (let x = 0; x < this.dig.w; x++) {
        const sx = gx + x * cell, sy = gy + y * cell;
        const d = depthAt(this.dig, x, y);

        if (d === 0) {
          // Bare floor — and whatever is sitting on it.
          rect(ctx, sx, sy, cell, cell, PAL.caveFloor);
          const it = itemAt(this.dig, x, y);
          if (it) this._drawTreasureCell(ctx, it, x, y, sx, sy, cell);
        } else {
          // Rock erodes rather than just changing colour: each layer you take
          // off shrinks the block and shows more of the floor around it, so
          // how far down a cell is can be read at arm's length.
          const inset = (MAX_DEPTH - d) * 2;
          const col = ROCK[Math.min(MAX_DEPTH, d)];
          const it = itemAt(this.dig, x, y);
          rect(ctx, sx, sy, cell, cell, it ? shade(PAL.caveFloor, -0.1) : PAL.caveFloor);
          rect(ctx, sx + inset, sy + inset, cell - inset * 2, cell - inset * 2, col);
          rect(ctx, sx + inset, sy + inset, cell - inset * 2, 1, shade(col, 0.3));
          rect(ctx, sx + inset, sy + inset, 1, cell - inset * 2, shade(col, 0.3));
          rect(ctx, sx + inset, sy + cell - inset - 1, cell - inset * 2, 1, shade(col, -0.3));
          rect(ctx, sx + cell - inset - 1, sy + inset, 1, cell - inset * 2, shade(col, -0.3));
        }
        rect(ctx, sx, sy + cell - 1, cell, 1, 'rgba(0,0,0,0.22)');
        rect(ctx, sx + cell - 1, sy, 1, cell, 'rgba(0,0,0,0.22)');
      }
    }

    // Swing marks.
    for (const h2 of this.hits) {
      const a = 1 - h2.t / 0.35;
      const sx = gx + h2.x * cell, sy = gy + h2.y * cell;
      ctx.save();
      ctx.globalAlpha = a * 0.7;
      const r = (h2.tool === 'hammer' ? 1.6 : 0.9) * cell * (0.4 + (1 - a));
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx + cell / 2, sy + cell / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // The cursor, for anyone playing with keys.
    const cx = gx + this.cursor.x * cell, cy = gy + this.cursor.y * cell;
    stroke(ctx, cx, cy, cell, cell, '#ffe9a8', 1);
  }

  /**
   * A buried thing, drawn only where it has been uncovered — which is what
   * makes uncovering it worth doing: you see a corner and have to decide
   * whether the shape is worth the rest of the roof.
   */
  _drawTreasureCell(ctx, it, x, y, sx, sy, cell) {
    const box = shapeBox(it.shape);
    const dx = x - it.x, dy = y - it.y;
    const on = (ox, oy) => box.cells.some(([a, b]) => a === dx + ox && b === dy + oy);
    const base = it.found ? '#f4d76a' : '#c9a227';
    rect(ctx, sx + 1, sy + 1, cell - 2, cell - 2, base);
    rect(ctx, sx + 1, sy + 1, cell - 2, 2, shade(base, 0.3));
    // Fill the seams between cells of the same thing so it reads as one object.
    if (on(1, 0)) rect(ctx, sx + cell - 2, sy + 1, 2, cell - 2, base);
    if (on(0, 1)) rect(ctx, sx + 1, sy + cell - 2, cell - 2, 2, base);
  }

  _drawRoofMeter(ctx, L) {
    const frac = stability(this.dig);
    const col = frac > 0.55 ? '#63c46a' : frac > 0.28 ? '#e8c04a' : '#e05c4a';
    rect(ctx, 0, 0, L.W, 20, shade(PAL.uiFrame, -0.35));
    drawText(ctx, 'ROOF', 5, 6, { color: PAL.uiTextLight });
    meterBar(ctx, 32, 7, L.W - 84, frac, col);
  }

  _drawTools(ctx, L) {
    for (const [name, box] of Object.entries(L.tools)) {
      const on = this.dig.tool === name;
      rect(ctx, box.x, box.y, box.w, box.h, on ? PAL.uiSelect : shade(PAL.uiFrame, -0.15));
      stroke(ctx, box.x, box.y, box.w, box.h, on ? PAL.uiTextLight : PAL.uiFrameLight, 1);
      drawTextCentered(ctx, TOOLS[name].name.toUpperCase(), box.x + box.w / 2, box.y + 5,
        { color: on ? PAL.uiTextLight : PAL.uiTextDim });
    }
  }

  _drawMessage(ctx, L) {
    const chars = Math.max(4, Math.floor((L.W - 8) / 6));
    const text = this.message.length > chars ? this.message.slice(0, chars - 1) + '…' : this.message;
    drawTextCentered(ctx, text, L.W / 2, L.msgY, { color: PAL.uiTextLight });
    void window9; void labelDim; void LINE; void drawText; void label;
  }
}
