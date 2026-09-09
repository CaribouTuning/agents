// Screen stack + transitions.
//
// Screens are pushed and popped like a navigation stack. Only the top screen
// receives input; screens below it still render when they ask to (`seeThrough`),
// which is how menus float over the world and battles over everything.
import { input } from '../core/input.js';
import { PAL } from '../render/palette.js';
import { rect } from './kit.js';

export class Screen {
  constructor(game) {
    this.game = game;
    this.seeThrough = false;   // render the screen below this one first
    this.pausesBelow = true;   // stop updating screens below
    this.dead = false;
  }
  onEnter() {}
  onExit() {}
  onResume() {}     // became top again after something above popped
  update() {}
  render() {}
  // Optional: returns a hint string for the bottom bar.
  hint() { return null; }
}

export const FADE = { NONE: 0, BLACK: 1, WHITE: 2, BATTLE: 3, DOOR: 4 };

export class ScreenManager {
  constructor(display) {
    this.display = display;
    this.stack = [];
    this.transition = null;
  }

  get top() { return this.stack[this.stack.length - 1] || null; }

  push(screen) {
    const prev = this.top;
    if (prev && prev.onBlur) prev.onBlur();
    this.stack.push(screen);
    screen.onEnter();
    input.releaseAll();
    return screen;
  }

  pop(n = 1) {
    for (let i = 0; i < n; i++) {
      const s = this.stack.pop();
      if (s) s.onExit();
    }
    input.releaseAll();
    if (this.top) this.top.onResume();
    return this.top;
  }

  replace(screen) {
    const s = this.stack.pop();
    if (s) s.onExit();
    return this.push(screen);
  }

  // Unwinds to the named screen class (by constructor name) or to the root.
  popTo(name) {
    while (this.stack.length > 1 && this.top.constructor.name !== name) this.pop();
    return this.top;
  }

  clearTo(screen) {
    while (this.stack.length) this.pop();
    return this.push(screen);
  }

  contains(name) { return this.stack.some((s) => s.constructor.name === name); }

  /**
   * Runs `action` behind a fade. This is the single place screen changes
   * happen with any visual weight, so every door, warp and battle entry
   * feels the same.
   */
  fade(kind, action, opts = {}) {
    const outMs = opts.outMs != null ? opts.outMs : 220;
    const inMs = opts.inMs != null ? opts.inMs : 240;
    this.transition = {
      kind, t: 0, phase: 'out', outMs: outMs / 1000, inMs: inMs / 1000, action, done: false,
    };
  }

  get busy() { return !!this.transition; }

  update(dt) {
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt;
      if (tr.phase === 'out' && tr.t >= tr.outMs) {
        tr.phase = 'in';
        tr.t = 0;
        if (tr.action) { const a = tr.action; tr.action = null; a(); }
      } else if (tr.phase === 'in' && tr.t >= tr.inMs) {
        this.transition = null;
      }
      // Input is swallowed during a transition.
      return;
    }
    // Update from the topmost screen down until one pauses those below.
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const s = this.stack[i];
      s.update(dt, i === this.stack.length - 1);
      if (s.pausesBelow) break;
    }
  }

  render(ctx) {
    // Find the lowest screen that must be drawn.
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].seeThrough) start--;
    for (let i = start; i < this.stack.length; i++) this.stack[i].render(ctx);
    if (this.transition) this._renderTransition(ctx);
  }

  _renderTransition(ctx) {
    const { width: W, height: H } = this.display;
    const tr = this.transition;
    const p = tr.phase === 'out'
      ? Math.min(1, tr.t / tr.outMs)
      : 1 - Math.min(1, tr.t / tr.inMs);

    if (tr.kind === FADE.BATTLE) {
      // Interlaced wipe: the DS-era "battle starting" flourish.
      const bands = 12;
      const bh = Math.ceil(H / bands);
      ctx.fillStyle = PAL.black;
      for (let i = 0; i < bands; i++) {
        const w = Math.round(W * Math.min(1, p * 1.35 - (i % 3) * 0.12));
        if (w <= 0) continue;
        const x = i % 2 === 0 ? 0 : W - w;
        ctx.fillRect(x, i * bh, w, bh);
      }
      if (p >= 0.99) rect(ctx, 0, 0, W, H, PAL.black);
      return;
    }
    if (tr.kind === FADE.DOOR) {
      // Iris: closes onto the player, opens on the new room.
      ctx.fillStyle = PAL.black;
      const maxR = Math.hypot(W, H) / 2;
      const r = maxR * (1 - p);
      const cx = W / 2, cy = H / 2;
      for (let y = 0; y < H; y += 2) {
        const dy = y - cy;
        const half = Math.sqrt(Math.max(0, r * r - dy * dy));
        if (half <= 0) { ctx.fillRect(0, y, W, 2); continue; }
        ctx.fillRect(0, y, Math.max(0, cx - half), 2);
        ctx.fillRect(cx + half, y, Math.max(0, W - (cx + half)), 2);
      }
      return;
    }
    ctx.globalAlpha = p;
    rect(ctx, 0, 0, W, H, tr.kind === FADE.WHITE ? '#ffffff' : PAL.black);
    ctx.globalAlpha = 1;
  }
}
