// Monster artwork generator.
//
// Every creature is built from an ARCHETYPE (body plan) plus FEATURES
// (ears, horns, wings, flames, leaves...) and a palette. Everything is
// expressed as a fraction of the sprite box, so the exact same data draws
// a 48px battle sprite and a 20px party icon.
//
// This is what makes the Pokédex scalable: a new species is ~6 lines of
// data, never a hand-drawn asset.
import { makeSurface } from './canvas.js';
import { shade } from './palette.js';

const cache = new Map();

// ---- pixel primitives ------------------------------------------------

function ell(c, cx, cy, rx, ry, col) {
  if (rx <= 0 || ry <= 0) return;
  c.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const x0 = Math.round(cx - half), x1 = Math.round(cx + half);
    if (x1 > x0) c.fillRect(x0, y, x1 - x0, 1);
  }
}

// Tapered capsule — legs, arms, necks, tails.
function limb(c, x0, y0, x1, y1, w0, w1, col) {
  const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  c.fillStyle = col;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const w = (w0 + (w1 - w0) * t) / 2;
    ell(c, x, y, w, w, col);
  }
}

function tri(c, ax, ay, bx, by, cx2, cy2, col) {
  c.fillStyle = col;
  const minY = Math.floor(Math.min(ay, by, cy2)), maxY = Math.ceil(Math.max(ay, by, cy2));
  const edge = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const minX = Math.floor(Math.min(ax, bx, cx2)), maxX = Math.ceil(Math.max(ax, bx, cx2));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const d1 = edge(ax, ay, bx, by, px, py);
      const d2 = edge(bx, by, cx2, cy2, px, py);
      const d3 = edge(cx2, cy2, ax, ay, px, py);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) c.fillRect(x, y, 1, 1);
    }
  }
}

// ---- shading + outline ----------------------------------------------

// Light comes from the upper-left. Pixels near the lit edge brighten,
// pixels near the lower-right edge darken. Applied to the finished buffer
// so every archetype gets consistent volume for free.
function shadePass(surf, strength = 1) {
  const { ctx, w, h } = surf;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
  const out = new Uint8ClampedArray(d);
  const k = Math.max(1, Math.round(w / 24));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (d[o + 3] === 0) continue;
      const lit = A(x - k, y - k) === 0 || A(x, y - k) === 0;
      const dark = A(x + k, y + k) === 0 || A(x + k, y) === 0;
      let f = 0;
      if (lit && !dark) f = 0.22 * strength;
      else if (dark && !lit) f = -0.26 * strength;
      if (!f) continue;
      for (let i = 0; i < 3; i++) {
        const v = d[o + i];
        out[o + i] = f > 0 ? v + (255 - v) * f : v * (1 + f);
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}

function outlinePass(surf, color) {
  const { ctx, w, h } = surf;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (op(x, y)) continue;
    if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) pts.push([x, y]);
  }
  ctx.fillStyle = color;
  for (const [x, y] of pts) ctx.fillRect(x, y, 1, 1);
}

// ---- face ------------------------------------------------------------

function face(c, S, hx, hy, hr, p, opts = {}) {
  const eyeR = Math.max(1, hr * (opts.eyeSize || 0.30));
  const dx = hr * (opts.eyeSpread || 0.46);
  const ey = hy - hr * (opts.eyeY != null ? opts.eyeY : 0.08);
  for (const sx of [-1, 1]) {
    ell(c, hx + sx * dx, ey, eyeR, eyeR * 1.12, p.eyeWhite || '#f8f8ff');
    ell(c, hx + sx * dx + (opts.pupilShift || 0), ey + eyeR * 0.12, eyeR * 0.62, eyeR * 0.78, p.eye);
    c.fillStyle = '#ffffff';
    c.fillRect(Math.round(hx + sx * dx - eyeR * 0.5), Math.round(ey - eyeR * 0.6), 1, 1);
  }
  if (opts.mouth !== false) {
    c.fillStyle = p.line;
    const my = hy + hr * (opts.mouthY || 0.52);
    const mw = Math.max(1, Math.round(hr * 0.34));
    c.fillRect(Math.round(hx - mw / 2), Math.round(my), mw, 1);
    if (opts.fang) {
      c.fillStyle = '#ffffff';
      c.fillRect(Math.round(hx - mw / 2), Math.round(my + 1), 1, 1);
      c.fillRect(Math.round(hx + mw / 2 - 1), Math.round(my + 1), 1, 1);
    }
  }
  if (opts.beak) {
    tri(c, hx - hr * 0.30, hy + hr * 0.30, hx + hr * 0.30, hy + hr * 0.30,
      hx, hy + hr * 0.95, p.accent);
  }
}

// ---- archetypes ------------------------------------------------------
// Each receives the drawing context, sprite size S, palette p, and a build
// spec b (fractions of S). They return the head position so features can
// attach to it.

const ARCH = {
  quadruped(c, S, p, b) {
    const bodyCx = S * 0.54, bodyCy = S * 0.58;
    const bw = S * (b.bodyW || 0.28), bh = S * (b.bodyH || 0.22);
    const legLen = S * (b.legLen || 0.15), legW = S * (b.legW || 0.13);
    // Back legs first so the near pair overlaps them.
    for (const [lx, sc, col] of [[-0.62, 0.88, shade(p.primary, -0.20)], [0.62, 0.88, shade(p.primary, -0.20)],
                                 [-0.42, 1, p.primary], [0.82, 1, p.primary]]) {
      const fx = bodyCx + bw * lx;
      limb(c, fx, bodyCy + bh * 0.55, fx, bodyCy + bh * 0.55 + legLen * sc, legW, legW * 0.92, col);
    }
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    ell(c, bodyCx, bodyCy + bh * 0.44, bw * 0.74, bh * 0.46, p.belly);
    const hr = S * (b.headR || 0.19);
    const hx = S * (b.headX || 0.28), hy = S * (b.headY || 0.36);
    limb(c, bodyCx - bw * 0.55, bodyCy - bh * 0.35, hx + hr * 0.35, hy + hr * 0.45, S * 0.17, S * 0.15, p.primary);
    ell(c, hx, hy, hr, hr * 0.92, p.primary);
    ell(c, hx - hr * 0.16, hy + hr * 0.44, hr * 0.66, hr * 0.42, p.belly);
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },

  biped(c, S, p, b) {
    const bodyCx = S * 0.50, bodyCy = S * 0.58;
    const bw = S * (b.bodyW || 0.20), bh = S * (b.bodyH || 0.22);
    const legLen = S * (b.legLen || 0.20);
    for (const sx of [-1, 1]) {
      limb(c, bodyCx + sx * bw * 0.5, bodyCy + bh * 0.7, bodyCx + sx * bw * 0.72,
        bodyCy + bh * 0.7 + legLen, S * 0.11, S * 0.10, p.primary);
      c.fillStyle = p.accent;
      c.fillRect(Math.round(bodyCx + sx * bw * 0.72 - S * 0.06), Math.round(bodyCy + bh * 0.7 + legLen - S * 0.03),
        Math.round(S * 0.12), Math.max(1, Math.round(S * 0.05)));
    }
    for (const sx of [-1, 1]) {
      limb(c, bodyCx + sx * bw * 0.85, bodyCy - bh * 0.25, bodyCx + sx * bw * 1.35,
        bodyCy + bh * 0.45, S * 0.09, S * 0.075, p.primary);
    }
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    ell(c, bodyCx, bodyCy + bh * 0.25, bw * 0.66, bh * 0.6, p.belly);
    const hr = S * (b.headR || 0.19);
    const hx = bodyCx, hy = bodyCy - bh - hr * 0.55;
    ell(c, hx, hy, hr, hr * 0.96, p.primary);
    ell(c, hx, hy + hr * 0.38, hr * 0.66, hr * 0.46, p.belly);
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },

  bird(c, S, p, b) {
    const bodyCx = S * 0.50, bodyCy = S * 0.58;
    const bw = S * (b.bodyW || 0.24), bh = S * (b.bodyH || 0.24);
    for (const sx of [-1, 1]) {
      limb(c, bodyCx + sx * bw * 0.35, bodyCy + bh * 0.85, bodyCx + sx * bw * 0.42,
        bodyCy + bh * 0.85 + S * 0.12, S * 0.05, S * 0.045, p.accent);
      c.fillStyle = p.accent;
      c.fillRect(Math.round(bodyCx + sx * bw * 0.42 - S * 0.05), Math.round(bodyCy + bh * 0.85 + S * 0.11),
        Math.round(S * 0.11), Math.max(1, Math.round(S * 0.04)));
    }
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    ell(c, bodyCx, bodyCy + bh * 0.28, bw * 0.62, bh * 0.6, p.belly);
    const hr = S * (b.headR || 0.16);
    const hx = bodyCx - S * 0.02, hy = bodyCy - bh - hr * 0.4;
    ell(c, hx, hy, hr, hr, p.primary);
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },

  bug(c, S, p, b) {
    const bodyCx = S * 0.54, bodyCy = S * 0.58;
    const bw = S * (b.bodyW || 0.26), bh = S * (b.bodyH || 0.17);
    for (let i = 0; i < 3; i++) {
      for (const sx of [-1, 1]) {
        const ax = bodyCx + (i - 1) * bw * 0.55;
        limb(c, ax, bodyCy + bh * 0.5, ax + sx * S * 0.11, bodyCy + bh * 0.5 + S * 0.13,
          S * 0.045, S * 0.03, p.accent);
      }
    }
    for (let i = 0; i < 3; i++) {
      const seg = bodyCx + (1 - i) * bw * 0.62;
      ell(c, seg, bodyCy, bw * (0.52 - i * 0.06), bh * (1 - i * 0.08), i % 2 ? shade(p.primary, -0.12) : p.primary);
    }
    const hr = S * (b.headR || 0.15);
    const hx = bodyCx - bw * 0.95, hy = bodyCy - bh * 0.22;
    ell(c, hx, hy, hr, hr * 0.9, p.secondary);
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },

  fish(c, S, p, b) {
    const bodyCx = S * 0.52, bodyCy = S * 0.54;
    const bw = S * (b.bodyW || 0.28), bh = S * (b.bodyH || 0.20);
    tri(c, bodyCx + bw * 0.85, bodyCy, bodyCx + bw * 1.7, bodyCy - bh * 0.95,
      bodyCx + bw * 1.7, bodyCy + bh * 0.95, p.accent);
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    ell(c, bodyCx, bodyCy + bh * 0.4, bw * 0.72, bh * 0.46, p.belly);
    tri(c, bodyCx, bodyCy - bh * 0.7, bodyCx + bw * 0.6, bodyCy - bh * 1.5,
      bodyCx - bw * 0.3, bodyCy - bh * 0.9, p.secondary);
    const hr = S * (b.headR || 0.15);
    const hx = bodyCx - bw * 0.72, hy = bodyCy - bh * 0.14;
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },

  serpent(c, S, p, b) {
    const bodyCx = S * 0.52, bodyCy = S * 0.60;
    const bw = S * (b.bodyW || 0.30), bh = S * (b.bodyH || 0.16);
    // Coil: ellipses swept along an S so the body reads as a snake, not a lump.
    const N = 16;
    for (let i = N - 1; i >= 0; i--) {
      const t = i / (N - 1);
      const x = bodyCx + Math.sin(t * Math.PI * 1.6) * bw * 0.85 - bw * 0.15;
      const y = bodyCy + bh * 0.75 - t * S * 0.42;
      const r = S * (0.115 - t * 0.055);
      ell(c, x, y, r, r * 0.9, i % 2 ? p.primary : shade(p.primary, -0.10));
      if (t < 0.5) ell(c, x, y + r * 0.45, r * 0.55, r * 0.35, p.belly);
    }
    const hr = S * (b.headR || 0.16);
    const hx = bodyCx + Math.sin(Math.PI * 1.6) * bw * 0.85 - bw * 0.15;
    const hy = bodyCy + bh * 0.75 - S * 0.42 - hr * 0.4;
    ell(c, hx, hy, hr * 1.15, hr * 0.88, p.primary);
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },

  blob(c, S, p, b) {
    const bodyCx = S * 0.50, bodyCy = S * 0.60;
    const bw = S * (b.bodyW || 0.28), bh = S * (b.bodyH || 0.26);
    for (const sx of [-1, 1]) ell(c, bodyCx + sx * bw * 0.5, bodyCy + bh * 0.92, S * 0.07, S * 0.045, p.accent);
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    ell(c, bodyCx, bodyCy + bh * 0.3, bw * 0.66, bh * 0.56, p.belly);
    const hr = S * (b.headR || 0.20);
    return { hx: bodyCx, hy: bodyCy - bh * 0.18, hr, bodyCx, bodyCy, bw, bh };
  },

  rodent(c, S, p, b) {
    const bodyCx = S * 0.54, bodyCy = S * 0.66;
    const bw = S * (b.bodyW || 0.22), bh = S * (b.bodyH || 0.17);
    for (const [lx, ly] of [[-0.6, 0.7], [0.6, 0.7]]) {
      limb(c, bodyCx + bw * lx, bodyCy + bh * ly, bodyCx + bw * lx, bodyCy + bh * ly + S * 0.11,
        S * 0.08, S * 0.07, p.primary);
    }
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    ell(c, bodyCx, bodyCy + bh * 0.35, bw * 0.7, bh * 0.5, p.belly);
    const hr = S * (b.headR || 0.21);
    const hx = bodyCx - bw * 0.42, hy = bodyCy - bh - hr * 0.42;
    ell(c, hx, hy, hr, hr * 0.9, p.primary);
    ell(c, hx - hr * 0.1, hy + hr * 0.44, hr * 0.6, hr * 0.4, p.belly);
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },

  golem(c, S, p, b) {
    const bodyCx = S * 0.50, bodyCy = S * 0.56;
    const bw = S * (b.bodyW || 0.27), bh = S * (b.bodyH || 0.25);
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    c.fillStyle = shade(p.primary, -0.18);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.31;
      c.fillRect(Math.round(bodyCx + Math.cos(a) * bw * 0.55), Math.round(bodyCy + Math.sin(a) * bh * 0.55),
        Math.max(1, Math.round(S * 0.06)), Math.max(1, Math.round(S * 0.05)));
    }
    for (const sx of [-1, 1]) {
      limb(c, bodyCx + sx * bw * 0.80, bodyCy + bh * 0.18, bodyCx + sx * bw * 1.45,
        bodyCy + bh * 0.82, S * 0.085, S * 0.075, p.secondary);
      ell(c, bodyCx + sx * bw * 1.5, bodyCy + bh * 0.9, S * 0.085, S * 0.080, p.accent);
    }
    const hr = S * (b.headR || 0.19);
    return { hx: bodyCx, hy: bodyCy - bh * 0.28, hr, bodyCx, bodyCy, bw, bh };
  },

  bat(c, S, p, b) {
    const bodyCx = S * 0.50, bodyCy = S * 0.54;
    const bw = S * (b.bodyW || 0.15), bh = S * (b.bodyH || 0.18);
    for (const sx of [-1, 1]) {
      tri(c, bodyCx + sx * bw * 0.6, bodyCy - bh * 0.6, bodyCx + sx * S * 0.46, bodyCy - bh * 1.5,
        bodyCx + sx * S * 0.40, bodyCy + bh * 1.1, p.secondary);
      tri(c, bodyCx + sx * bw * 0.6, bodyCy - bh * 0.3, bodyCx + sx * S * 0.34, bodyCy - bh * 0.9,
        bodyCx + sx * S * 0.30, bodyCy + bh * 0.9, shade(p.secondary, -0.16));
    }
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    const hr = S * (b.headR || 0.15);
    return { hx: bodyCx, hy: bodyCy - bh * 0.5, hr, bodyCx, bodyCy, bw, bh };
  },

  // Stately deer/caribou plan — reserved for the legendary.
  stag(c, S, p, b) {
    const bodyCx = S * 0.52, bodyCy = S * 0.58;
    const bw = S * (b.bodyW || 0.28), bh = S * (b.bodyH || 0.16);
    for (const [lx, ly] of [[-0.7, 0.4], [0.6, 0.4], [-0.45, 0.8], [0.8, 0.8]]) {
      limb(c, bodyCx + bw * lx, bodyCy + bh * ly, bodyCx + bw * lx * 1.06,
        bodyCy + bh * ly + S * 0.24, S * 0.065, S * 0.045, p.primary);
    }
    ell(c, bodyCx, bodyCy, bw, bh, p.primary);
    ell(c, bodyCx, bodyCy + bh * 0.45, bw * 0.7, bh * 0.4, p.belly);
    const hr = S * (b.headR || 0.13);
    const hx = S * 0.24, hy = S * 0.28;
    limb(c, bodyCx - bw * 0.6, bodyCy - bh * 0.5, hx + hr * 0.4, hy + hr * 0.5, S * 0.10, S * 0.085, p.primary);
    ell(c, hx, hy, hr * 1.15, hr * 0.8, p.primary);
    return { hx, hy, hr, bodyCx, bodyCy, bw, bh };
  },
};

// ---- features --------------------------------------------------------
// Drawn after the body, positioned relative to the head/body it returns.

const FEAT = {
  earsRound(c, S, p, g) {
    for (const sx of [-1, 1]) ell(c, g.hx + sx * g.hr * 0.78, g.hy - g.hr * 0.62, g.hr * 0.38, g.hr * 0.38, p.primary);
    for (const sx of [-1, 1]) ell(c, g.hx + sx * g.hr * 0.78, g.hy - g.hr * 0.62, g.hr * 0.20, g.hr * 0.20, p.accent);
  },
  earsPointed(c, S, p, g) {
    for (const sx of [-1, 1]) {
      tri(c, g.hx + sx * g.hr * 0.35, g.hy - g.hr * 0.6, g.hx + sx * g.hr * 1.0, g.hy - g.hr * 0.4,
        g.hx + sx * g.hr * 0.85, g.hy - g.hr * 1.5, p.primary);
    }
  },
  earsLong(c, S, p, g) {
    for (const sx of [-1, 1]) {
      limb(c, g.hx + sx * g.hr * 0.45, g.hy - g.hr * 0.7, g.hx + sx * g.hr * 0.75, g.hy - g.hr * 2.3,
        g.hr * 0.34, g.hr * 0.26, p.primary);
      limb(c, g.hx + sx * g.hr * 0.5, g.hy - g.hr * 0.9, g.hx + sx * g.hr * 0.75, g.hy - g.hr * 2.1,
        g.hr * 0.16, g.hr * 0.12, p.accent);
    }
  },
  earsTuft(c, S, p, g) {
    for (const sx of [-1, 1]) {
      tri(c, g.hx + sx * g.hr * 0.5, g.hy - g.hr * 0.75, g.hx + sx * g.hr * 1.05, g.hy - g.hr * 0.5,
        g.hx + sx * g.hr * 1.15, g.hy - g.hr * 1.8, p.accent);
    }
  },
  horn(c, S, p, g) {
    tri(c, g.hx - g.hr * 0.22, g.hy - g.hr * 0.9, g.hx + g.hr * 0.22, g.hy - g.hr * 0.9,
      g.hx, g.hy - g.hr * 2.0, p.accent);
  },
  antlers(c, S, p, g) {
    for (const sx of [-1, 1]) {
      limb(c, g.hx + sx * g.hr * 0.5, g.hy - g.hr * 0.6, g.hx + sx * g.hr * 1.2, g.hy - g.hr * 2.6,
        S * 0.045, S * 0.028, p.accent);
      limb(c, g.hx + sx * g.hr * 0.85, g.hy - g.hr * 1.6, g.hx + sx * g.hr * 2.1, g.hy - g.hr * 2.0,
        S * 0.032, S * 0.020, p.accent);
      limb(c, g.hx + sx * g.hr * 1.05, g.hy - g.hr * 2.2, g.hx + sx * g.hr * 2.0, g.hy - g.hr * 3.0,
        S * 0.030, S * 0.018, p.accent);
    }
  },
  crest(c, S, p, g) {
    tri(c, g.hx - g.hr * 0.5, g.hy - g.hr * 0.8, g.hx + g.hr * 0.3, g.hy - g.hr * 0.9,
      g.hx - g.hr * 0.2, g.hy - g.hr * 1.9, p.accent);
  },
  mane(c, S, p, g) {
    for (let i = 0; i < 7; i++) {
      const a = -0.4 + i * 0.55;
      ell(c, g.hx + Math.cos(a) * g.hr * 1.25, g.hy + Math.sin(a) * g.hr * 1.25, g.hr * 0.42, g.hr * 0.42, p.accent);
    }
  },
  leaf(c, S, p, g) {
    ell(c, g.hx + g.hr * 0.1, g.hy - g.hr * 1.35, g.hr * 0.62, g.hr * 0.30, p.accent);
    limb(c, g.hx, g.hy - g.hr * 0.9, g.hx + g.hr * 0.1, g.hy - g.hr * 1.3, S * 0.035, S * 0.025, shade(p.accent, -0.3));
  },
  sprout(c, S, p, g) {
    limb(c, g.hx, g.hy - g.hr * 0.8, g.hx, g.hy - g.hr * 1.7, S * 0.035, S * 0.03, shade(p.accent, -0.25));
    ell(c, g.hx - g.hr * 0.5, g.hy - g.hr * 1.7, g.hr * 0.42, g.hr * 0.26, p.accent);
    ell(c, g.hx + g.hr * 0.5, g.hy - g.hr * 1.8, g.hr * 0.42, g.hr * 0.26, p.accent);
  },
  bloom(c, S, p, g) {
    for (let i = 0; i < 5; i++) {
      const a = i * (Math.PI * 2 / 5) - Math.PI / 2;
      ell(c, g.hx + Math.cos(a) * g.hr * 0.7, g.hy - g.hr * 1.5 + Math.sin(a) * g.hr * 0.7,
        g.hr * 0.38, g.hr * 0.38, p.accent);
    }
    ell(c, g.hx, g.hy - g.hr * 1.5, g.hr * 0.28, g.hr * 0.28, '#f8e070');
  },
  shell(c, S, p, g) {
    ell(c, g.bodyCx + g.bw * 0.12, g.bodyCy - g.bh * 0.42, g.bw * 0.88, g.bh * 0.82, p.secondary);
    c.fillStyle = shade(p.secondary, -0.22);
    for (let i = -1; i <= 1; i++) {
      c.fillRect(Math.round(g.bodyCx + g.bw * (0.12 + i * 0.4) - 1), Math.round(g.bodyCy - g.bh * 0.9),
        Math.max(1, Math.round(S * 0.03)), Math.max(1, Math.round(g.bh * 1.0)));
    }
  },
  flameTail(c, S, p, g) {
    const tx = g.bodyCx + g.bw * 1.45, ty = g.bodyCy - g.bh * 0.25;
    limb(c, g.bodyCx + g.bw * 0.75, g.bodyCy + g.bh * 0.1, tx, ty, S * 0.07, S * 0.05, p.primary);
    ell(c, tx + S * 0.02, ty - S * 0.14, S * 0.095, S * 0.13, '#e85820');
    ell(c, tx + S * 0.02, ty - S * 0.16, S * 0.062, S * 0.090, '#f8a030');
    ell(c, tx + S * 0.01, ty - S * 0.18, S * 0.032, S * 0.050, '#f8e070');
  },
  bushyTail(c, S, p, g) {
    ell(c, g.bodyCx + g.bw * 1.15, g.bodyCy - g.bh * 0.5, g.bw * 0.42, g.bh * 0.9, p.secondary);
    ell(c, g.bodyCx + g.bw * 1.2, g.bodyCy - g.bh * 0.8, g.bw * 0.26, g.bh * 0.5, p.accent);
  },
  starTail(c, S, p, g) {
    limb(c, g.bodyCx + g.bw * 0.8, g.bodyCy, g.bodyCx + g.bw * 1.5, g.bodyCy - g.bh * 1.2,
      S * 0.05, S * 0.035, p.primary);
    const tx = g.bodyCx + g.bw * 1.55, ty = g.bodyCy - g.bh * 1.35;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4;
      c.fillStyle = p.accent;
      c.fillRect(Math.round(tx + Math.cos(a) * S * 0.06 - 1), Math.round(ty + Math.sin(a) * S * 0.06 - 1), 2, 2);
    }
    ell(c, tx, ty, S * 0.055, S * 0.055, p.accent);
  },
  thinTail(c, S, p, g) {
    limb(c, g.bodyCx + g.bw * 0.85, g.bodyCy, g.bodyCx + g.bw * 1.5, g.bodyCy - g.bh * 0.9,
      S * 0.05, S * 0.02, p.primary);
  },
  flatTail(c, S, p, g) {
    ell(c, g.bodyCx + g.bw * 1.2, g.bodyCy + g.bh * 0.3, g.bw * 0.5, g.bh * 0.34, p.secondary);
  },
  wingsFeather(c, S, p, g) {
    for (const sx of [-1, 1]) {
      tri(c, g.bodyCx + sx * g.bw * 0.7, g.bodyCy - g.bh * 0.5, g.bodyCx + sx * S * 0.44, g.bodyCy - g.bh * 1.0,
        g.bodyCx + sx * S * 0.34, g.bodyCy + g.bh * 0.7, p.secondary);
      c.fillStyle = shade(p.secondary, -0.2);
      for (let i = 0; i < 3; i++) {
        c.fillRect(Math.round(g.bodyCx + sx * (g.bw * 0.8 + i * S * 0.06)),
          Math.round(g.bodyCy - g.bh * 0.2 + i * S * 0.03), Math.max(1, Math.round(S * 0.04)), 1);
      }
    }
  },
  wingsBug(c, S, p, g) {
    for (const sx of [-1, 1]) {
      ell(c, g.bodyCx + sx * S * 0.20, g.bodyCy - g.bh * 1.1, S * 0.17, S * 0.10, p.accent);
    }
  },
  fins(c, S, p, g) {
    for (const sx of [-1, 1]) {
      tri(c, g.bodyCx + sx * g.bw * 0.2, g.bodyCy + g.bh * 0.2, g.bodyCx + sx * g.bw * 1.0, g.bodyCy + g.bh * 0.9,
        g.bodyCx + sx * g.bw * 0.3, g.bodyCy + g.bh * 1.1, p.secondary);
    }
  },
  spikes(c, S, p, g) {
    for (let i = -1; i <= 1; i++) {
      tri(c, g.bodyCx + i * g.bw * 0.5 - S * 0.04, g.bodyCy - g.bh * 0.85,
        g.bodyCx + i * g.bw * 0.5 + S * 0.04, g.bodyCy - g.bh * 0.85,
        g.bodyCx + i * g.bw * 0.5, g.bodyCy - g.bh * 1.6, p.accent);
    }
  },
  armour(c, S, p, g) {
    c.fillStyle = p.secondary;
    c.fillRect(Math.round(g.bodyCx - g.bw * 0.8), Math.round(g.bodyCy - g.bh * 0.2),
      Math.round(g.bw * 1.6), Math.max(1, Math.round(g.bh * 0.4)));
  },
  collar(c, S, p, g) {
    ell(c, g.hx, g.hy + g.hr * 1.1, g.hr * 1.15, g.hr * 0.38, p.accent);
  },
  gem(c, S, p, g) {
    ell(c, g.bodyCx, g.bodyCy + g.bh * 0.1, S * 0.06, S * 0.07, p.accent);
    c.fillStyle = '#ffffff';
    c.fillRect(Math.round(g.bodyCx - S * 0.02), Math.round(g.bodyCy + g.bh * 0.1 - S * 0.03), 1, 1);
  },
  halo(c, S, p, g) {
    const rx = g.hr * 2.0, ry = g.hr * 0.62, cy = g.hy - g.hr * 1.9;
    const steps = Math.max(40, Math.round(rx * 6));
    c.fillStyle = p.accent;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      c.fillRect(Math.round(g.hx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
    }
  },
};

// ---- shiny -----------------------------------------------------------

function rotateHue(hex, deg) {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hh = 0;
  if (d) {
    if (mx === r) hh = ((g - b) / d) % 6;
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
  }
  hh = (hh * 60 + deg + 360) % 360;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const cc = (1 - Math.abs(2 * l - 1)) * s;
  const x = cc * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - cc / 2;
  let rr = 0, gg = 0, bb = 0;
  if (hh < 60) [rr, gg, bb] = [cc, x, 0];
  else if (hh < 120) [rr, gg, bb] = [x, cc, 0];
  else if (hh < 180) [rr, gg, bb] = [0, cc, x];
  else if (hh < 240) [rr, gg, bb] = [0, x, cc];
  else if (hh < 300) [rr, gg, bb] = [x, 0, cc];
  else [rr, gg, bb] = [cc, 0, x];
  const q = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return `#${((1 << 24) + (q(rr) << 16) + (q(gg) << 8) + q(bb)).toString(16).slice(1)}`;
}

// ---- public API ------------------------------------------------------

export function renderMonster(art, { size = 48, back = false, shiny = false } = {}) {
  const key = `${art.key}:${size}:${back ? 'b' : 'f'}:${shiny ? 's' : 'n'}`;
  if (cache.has(key)) return cache.get(key);

  const S = size;
  const surf = makeSurface(S, S);
  const c = surf.ctx;

  const base = art.colors;
  const p = shiny
    ? Object.fromEntries(Object.entries(base).map(([k, v]) =>
        [k, typeof v === 'string' && v.startsWith('#') ? rotateHue(v, 140) : v]))
    : { ...base };
  p.belly = p.belly || shade(p.primary, 0.30);
  p.secondary = p.secondary || shade(p.primary, -0.20);
  p.accent = p.accent || shade(p.primary, 0.45);
  p.eye = p.eye || '#20283a';
  p.line = p.line || shade(p.primary, -0.55);

  c.save();
  if (back) { c.translate(S, 0); c.scale(-1, 1); }

  const archFn = ARCH[art.arch] || ARCH.quadruped;
  const g = archFn(c, S, p, art.build || {});
  for (const f of art.features || []) {
    const fn = FEAT[f];
    if (fn) fn(c, S, p, g);
  }
  c.restore();

  // A back sprite shows no face; it is the trainer's own monster seen from
  // behind, which is exactly how the DS games frame it.
  if (!back) face(c, S, g.hx, g.hy, g.hr, p, art.face || {});

  shadePass(surf, size >= 32 ? 1 : 0.7);
  outlinePass(surf, p.line);

  cache.set(key, surf.canvas);
  return surf.canvas;
}

export function drawMonster(ctx, art, x, y, opts = {}) {
  const img = renderMonster(art, opts);
  ctx.drawImage(img, Math.round(x), Math.round(y));
  return img;
}
