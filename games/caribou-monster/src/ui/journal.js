// The journal screen.
//
// Two panes: what I am doing now, and everything I have worked out. The
// objective at the top is the single most useful line in the game for anyone
// picking it up again after a fortnight — which, for a game two people play on
// their phones in the evening, is most sessions.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, drawText, drawTextCentered, drawTextRight,
  titleBar, rowHighlight, rule, moveCursor, LINE,
} from './kit.js';
import { drawBackChip, hintBar } from './controls.js';
import { entriesFor, objective } from '../game/journal.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

/**
 * Hard line breaks in the story text were authored for a 33-character dialogue
 * box. The journal is a different width, so they are flattened and the text is
 * re-wrapped to fit here — otherwise every paragraph reads ragged.
 */
function wrap(str, maxChars) {
  const out = [];
  let line = '';
  for (const word of String(str).replace(/\s+/g, ' ').trim().split(' ')) {
    if (!line.length) { line = word; continue; }
    if (line.length + 1 + word.length > maxChars) { out.push(line); line = word; }
    else line += ' ' + word;
  }
  if (line.length) out.push(line);
  return out;
}

export class JournalScreen extends Screen {
  constructor(game) {
    super(game);
    this.index = 0;
    this.scroll = 0;
    this.reading = null;
    this.readScroll = 0;
  }

  get entries() {
    // Newest first: what just happened is what you came here for.
    return entriesFor(this.game.state).slice().reverse();
  }

  _panel() {
    const { width: W, height: H } = this.game.display;
    return { x: 3, y: 32, w: W - 6, h: H - 32 - 13 };
  }

  _rowH() { return LINE + 2; }
  _rows() { return Math.max(2, Math.floor((this._panel().h - 8) / this._rowH())); }

  _rects() {
    const p = this._panel();
    const rows = this._rows();
    const items = this.entries;
    const out = [];
    for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
      out.push({ x: p.x + 3, y: p.y + 4 + i * this._rowH(), w: p.w - 6, h: this._rowH(), index: i + this.scroll });
    }
    return out;
  }

  hint() {
    if (this.reading) return 'A / B: close   ▲▼: scroll';
    return this.entries.length ? 'A: read   ▲▼: browse   B: back' : 'B: back';
  }

  update(dt, isTop) {
    if (!isTop) return;
    if (this.reading) {
      const lines = this._articleLines();
      const view = this._articleRows();
      if (input.repeated('up')) this.readScroll = Math.max(0, this.readScroll - 1);
      if (input.repeated('down')) this.readScroll = Math.min(Math.max(0, lines.length - view), this.readScroll + 1);
      if (input.pressed('a') || input.pressed('b') || input.consumeTap()) {
        audio.sfx('back'); this.reading = null;
      }
      return;
    }

    const items = this.entries;
    const rows = this._rows();
    const tap = input.consumeTap();
    if (tap) {
      for (const r of this._rects()) {
        if (hit(tap, r.x, r.y, r.w, r.h)) {
          this.index = r.index; audio.sfx('select'); this._open(); return;
        }
      }
    }
    if (items.length) {
      if (input.repeated('up')) {
        const m = moveCursor(this.index, items.length, -1, rows, this.scroll);
        this.index = m.index; this.scroll = m.scroll; audio.sfx('cursor');
      }
      if (input.repeated('down')) {
        const m = moveCursor(this.index, items.length, 1, rows, this.scroll);
        this.index = m.index; this.scroll = m.scroll; audio.sfx('cursor');
      }
      if (input.pressed('a')) { audio.sfx('select'); this._open(); }
    }
    if (input.pressed('b') || input.pressed('start')) { audio.sfx('back'); this.game.screens.pop(); }
  }

  _open() {
    const e = this.entries[this.index];
    if (e) { this.reading = e; this.readScroll = 0; }
  }

  _articleBox() {
    const { width: W, height: H } = this.game.display;
    return { x: 5, y: 8, w: W - 10, h: H - 22 };
  }

  _articleRows() {
    return Math.max(2, Math.floor((this._articleBox().h - 26) / 9));
  }

  _articleLines() {
    if (!this.reading) return [];
    const chars = Math.floor((this._articleBox().w - 18) / 6);
    const out = [];
    for (const para of this.reading.body) {
      out.push(...wrap(para, chars));
      out.push('');
    }
    if (this.reading.next) {
      out.push('NEXT:');
      out.push(...wrap(this.reading.next, chars));
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out;
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const accent = '#8a6a3a';
    rect(ctx, 0, 0, W, H, shade(accent, -0.68));
    for (let y = 0; y < H; y += 6) rect(ctx, 0, y, W, 3, shade(accent, -0.62));

    titleBar(ctx, 0, 0, W, 'JOURNAL', { color: shade(accent, -0.1), h: 13 });
    drawBackChip(ctx, W - 46, 0);

    // What I am doing now.
    const chars = Math.floor((W - 20) / 6);
    window9(ctx, 3, 15, W - 6, 16, { bg: PAL.uiBgAlt, shadow: false });
    labelDim(ctx, 'NOW', 8, 19);
    drawText(ctx, objective(this.game.state).replace(/\s+/g, ' ').slice(0, chars - 6),
      30, 19, { color: PAL.uiText });

    const p = this._panel();
    window9(ctx, p.x, p.y, p.w, p.h, { shadow: false });

    const items = this.entries;
    if (!items.length) {
      labelDim(ctx, 'Nothing written down yet.', p.x + 8, p.y + 10);
      hintBar(ctx, W, H, this.hint());
      if (this.reading) this._renderArticle(ctx, W, H);
      return;
    }

    const rows = this._rows();
    const maxChars = Math.floor((p.w - 24) / 6);
    for (const r of this._rects()) {
      const e = items[r.index];
      const sel = r.index === this.index;
      if (sel) rowHighlight(ctx, r.x, r.y, r.w, r.h, PAL.uiSelect);
      // Newest at the top, numbered in story order so the shape of the run
      // is visible at a glance.
      const n = items.length - r.index;
      drawTextRight(ctx, String(n), r.x + 18, r.y + 2,
        { color: sel ? shade(PAL.uiSelect, 0.65) : PAL.uiTextDim });
      drawText(ctx, e.title.slice(0, maxChars), r.x + 24, r.y + 2,
        { color: sel ? PAL.uiTextLight : PAL.uiText });
      if (e.next) {
        drawTextRight(ctx, '→', r.x + r.w - 6, r.y + 2,
          { color: sel ? PAL.uiTextLight : PAL.uiTextDim });
      }
    }
    if (this.scroll > 0) drawText(ctx, '▲', p.x + p.w - 11, p.y + 1, { color: PAL.uiTextDim });
    if (this.scroll + rows < items.length) {
      drawText(ctx, '▼', p.x + p.w - 11, p.y + 3 + rows * this._rowH() - 8, { color: PAL.uiTextDim });
    }

    hintBar(ctx, W, H, this.hint());
    if (this.reading) this._renderArticle(ctx, W, H);
  }

  _renderArticle(ctx, W, H) {
    const e = this.reading;
    const b = this._articleBox();
    rect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.55)');
    window9(ctx, b.x, b.y, b.w, b.h);
    const chars = Math.floor((b.w - 18) / 6);
    titleBar(ctx, b.x + 3, b.y + 3, b.w - 6, e.title.toUpperCase().slice(0, chars), {
      color: '#8a6a3a', h: 11,
    });
    rule(ctx, b.x + 7, b.y + 17, b.w - 14);

    const lines = this._articleLines();
    const view = this._articleRows();
    let y = b.y + 21;
    for (let i = 0; i < view && i + this.readScroll < lines.length; i++) {
      const line = lines[i + this.readScroll];
      if (line === 'NEXT:') drawText(ctx, line, b.x + 8, y + i * 9, { color: PAL.uiSelect });
      else labelDim(ctx, line, b.x + 8, y + i * 9);
    }
    if (this.readScroll > 0) drawText(ctx, '▲', b.x + b.w - 12, b.y + 20, { color: PAL.uiTextDim });
    if (this.readScroll + view < lines.length) {
      drawText(ctx, '▼', b.x + b.w - 12, b.y + b.h - 12, { color: PAL.uiTextDim });
    }
    void drawTextCentered; void label;
  }
}
