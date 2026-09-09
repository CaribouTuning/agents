// Display setup. The game renders at a small logical resolution (DS-ish)
// and is scaled up with nearest-neighbour, which is what gives crisp
// pixels instead of a blurry upscaled webpage.
import { PAL } from './palette.js';

export const TILE = 16;

class Display {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 384;   // logical pixels
    this.height = 192;
    this.scale = 1;     // logical -> css pixels
    this.dpr = 1;
    this.portrait = false;
    this.onResize = null;
  }

  attach(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const aspect = vw / vh;
    this.portrait = aspect < 1;

    // Landscape: fix the height at a DS-like 192 logical pixels and let the
    // width follow the device aspect (clamped so ultrawide phones don't get
    // an absurd field of view). Portrait: fix the width instead.
    if (!this.portrait) {
      this.height = 192;
      this.width = Math.round(clamp(192 * aspect, 256, 400));
    } else {
      this.width = 224;
      this.height = Math.round(clamp(224 / aspect, 280, 440));
    }

    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    // Fit the logical surface inside the viewport, preferring whole-number
    // scaling so pixels stay square; fall back to fractional when the
    // integer step would waste more than ~12% of the screen.
    const fit = Math.min(vw / this.width, vh / this.height);
    const whole = Math.max(1, Math.floor(fit));
    this.scale = (whole / fit >= 0.88) ? whole : fit;

    const cssW = Math.round(this.width * this.scale);
    const cssH = Math.round(this.height * this.scale);

    this.canvas.width = Math.round(this.width * this.dpr * this.scale);
    this.canvas.height = Math.round(this.height * this.dpr * this.scale);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';

    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    if (this.onResize) this.onResize(this.width, this.height);
  }

  // Call at the top of each frame; sets up the logical-pixel transform.
  begin() {
    const c = this.ctx;
    c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = PAL.black;
    c.fillRect(0, 0, this.width, this.height);
    return c;
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export const display = new Display();

// Offscreen pixel buffer used by every procedural sprite generator.
export function makeSurface(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: cv, ctx, w, h };
}

// Paints a '#'-style pixel grid onto a surface using a letter->colour map.
// This is the shared primitive for tiles, characters and monsters.
export function paintGrid(ctx, rows, palette, ox = 0, oy = 0, px = 1) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * px, oy + y * px, px, px);
    }
  }
}
