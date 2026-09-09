// Dialogue box: typewriter text, page breaks, yes/no and list choices.
//
// Used by NPCs, signs, shops, the battle log and every confirmation in the
// game, so its feel — the tick of the letters, the bouncing arrow, the way B
// fast-forwards — is a large part of the game's texture.
import { PAL } from '../render/palette.js';
import { window9, label, cursor, LINE } from './kit.js';
import { wrapText, drawText } from '../render/font.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';

const SPEEDS = [70, 45, 22];   // ms per character: slow, normal, fast

export class DialogueBox {
  constructor() {
    this.visible = false;
    this.pages = [];
    this.page = 0;
    this.shown = 0;
    this.timer = 0;
    this.speedIndex = 1;
    this.onDone = null;
    this.choice = null;        // { options, index, onPick, title }
    this.waiting = false;
    this.bounce = 0;
    this.speaker = null;
    this.maxChars = 34;
    this.lines = 3;
  }

  layout(W) {
    // Text width follows the screen so wide phones show longer lines.
    this.maxChars = Math.max(22, Math.floor((W - 26) / 6));
  }

  /** Queues text. `\f` starts a new page; long text wraps and pages itself. */
  show(text, opts = {}) {
    this.layout(opts.width || 320);
    const chunks = String(text).split('\f');
    this.pages = [];
    for (const chunk of chunks) {
      const wrapped = wrapText(chunk.trim(), this.maxChars);
      for (let i = 0; i < wrapped.length; i += this.lines) {
        this.pages.push(wrapped.slice(i, i + this.lines));
      }
    }
    if (!this.pages.length) this.pages = [['']];
    this.page = 0;
    this.shown = 0;
    this.timer = 0;
    this.visible = true;
    this.waiting = false;
    this.choice = null;
    this.speaker = opts.speaker || null;
    this.onDone = opts.onDone || null;
    this.instant = !!opts.instant;
  }

  /** Shows a yes/no (or arbitrary) choice attached to the current text. */
  ask(text, options, onPick, opts = {}) {
    this.show(text, opts);
    this.pendingChoice = { options, onPick, title: opts.title || null, index: opts.defaultIndex || 0 };
  }

  hide() {
    this.visible = false;
    this.pages = [];
    this.choice = null;
    this.pendingChoice = null;
    this.onDone = null;
  }

  get busy() { return this.visible; }
  get typing() { return this.shown < this.currentText.length; }

  get currentText() {
    const p = this.pages[this.page] || [];
    return p.join('\n');
  }

  update(dt, isTop = true) {
    if (!this.visible) return;
    this.bounce += dt;

    if (this.choice) {
      if (!isTop) return;
      const n = this.choice.options.length;
      if (input.repeated('up')) { this.choice.index = (this.choice.index - 1 + n) % n; audio.sfx('cursor'); }
      if (input.repeated('down')) { this.choice.index = (this.choice.index + 1) % n; audio.sfx('cursor'); }
      if (input.pressed('a')) {
        audio.sfx('select');
        const pick = this.choice.index;
        const cb = this.choice.onPick;
        this.choice = null;
        this.hide();
        if (cb) cb(pick);
      } else if (input.pressed('b')) {
        // B on a choice picks the last option, which is always the safe one.
        audio.sfx('back');
        const cb = this.choice.onPick;
        const last = this.choice.options.length - 1;
        this.choice = null;
        this.hide();
        if (cb) cb(last);
      }
      return;
    }

    const full = this.currentText;
    if (this.shown < full.length) {
      const ms = this.instant ? 0 : SPEEDS[this.speedIndex];
      // Holding A or B fast-forwards, exactly like the handheld games.
      const boost = (input.isDown('a') || input.isDown('b')) ? 4 : 1;
      this.timer += dt * 1000 * boost;
      while (this.timer >= ms && this.shown < full.length) {
        this.timer -= Math.max(1, ms);
        this.shown++;
        const ch = full[this.shown - 1];
        if (ch && ch !== ' ' && ch !== '\n' && this.shown % 2 === 0) audio.sfx('text');
        if (ms === 0) { this.shown = full.length; break; }
      }
      if (isTop && (input.pressed('a') || input.pressed('b') || input.consumeTap())) this.shown = full.length;
      return;
    }

    this.waiting = true;
    if (!isTop) return;
    // Anywhere on the screen advances: with the gamepad hidden behind the
    // text box, a tap is the natural gesture.
    if (input.pressed('a') || input.pressed('b') || input.consumeTap()) {
      audio.sfx('select');
      if (this.page < this.pages.length - 1) {
        this.page++;
        this.shown = 0;
        this.timer = 0;
        this.waiting = false;
      } else if (this.pendingChoice) {
        this.choice = this.pendingChoice;
        this.pendingChoice = null;
      } else {
        const cb = this.onDone;
        this.hide();
        if (cb) cb();
      }
    }
  }

  /** Advances programmatically — used by the battle log. */
  advance() {
    const full = this.currentText;
    if (this.shown < full.length) { this.shown = full.length; return false; }
    if (this.page < this.pages.length - 1) { this.page++; this.shown = 0; this.timer = 0; return false; }
    const cb = this.onDone;
    this.hide();
    if (cb) cb();
    return true;
  }

  get finished() {
    return this.visible && this.page >= this.pages.length - 1 && this.shown >= this.currentText.length;
  }

  render(ctx, W, H, opts = {}) {
    if (!this.visible) return;
    const h = this.lines * LINE + 12;
    const y = opts.y != null ? opts.y : H - h - 4;
    const x = 4, w = W - 8;
    window9(ctx, x, y, w, h);

    if (this.speaker) {
      const sw = this.speaker.length * 6 + 10;
      window9(ctx, x + 4, y - 11, sw, 13, { bg: PAL.uiHighlight });
      label(ctx, this.speaker, x + 9, y - 8);
    }

    const page = this.pages[this.page] || [];
    let remaining = this.shown;
    page.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, remaining));
      remaining -= line.length + 1;   // +1 for the newline the join added
      if (n > 0) label(ctx, line, x + 8, y + 6 + i * LINE, { limit: n });
    });

    if (this.choice) {
      this._renderChoice(ctx, W, y);
    } else if (this.waiting && !this.typing) {
      const bob = Math.floor(this.bounce * 5) % 2;
      drawText(ctx, '▼', x + w - 12, y + h - 10 + bob, { color: PAL.uiText });
    }
  }

  _renderChoice(ctx, W, boxY) {
    const c = this.choice;
    const longest = c.options.reduce((a, s) => Math.max(a, s.length), 0);
    const w = longest * 6 + 22;
    const h = c.options.length * LINE + 9;
    const x = W - w - 6;
    const y = boxY - h - 3;
    window9(ctx, x, y, w, h);
    c.options.forEach((opt, i) => {
      const oy = y + 5 + i * LINE;
      if (i === c.index) cursor(ctx, x + 4, oy);
      label(ctx, opt, x + 12, oy);
    });
  }
}

export const dialogue = new DialogueBox();
