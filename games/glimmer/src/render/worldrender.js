// Drawing the world.
//
// Everything is painted from shapes at draw time rather than blitted from an
// atlas. At this resolution that is affordable, and it buys two things worth
// having: the art is ours outright, and a tile can know what its neighbours
// are — so grass grows over the lip of a ledge and soil gets darker the
// deeper it is buried, without anybody authoring a single autotile.

import { TILE } from './canvas.js';
import { PAL, shade, mix } from './palette.js';
import { TILES, tileAt } from '../data/tiles.js';

const TAU = Math.PI * 2;

/** Deterministic per-tile noise, so a tile looks the same every frame. */
function h(x, y, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** The sky: a soft vertical wash with a warm band near the horizon. */
export function drawSky(c, w, hgt, camY) {
  const g = c.createLinearGradient(0, 0, 0, hgt);
  const drift = Math.max(0, Math.min(1, camY / 600));
  g.addColorStop(0, mix(PAL.skyHigh, PAL.skyMid, drift));
  g.addColorStop(0.55, PAL.skyMid);
  g.addColorStop(0.82, PAL.skyLow);
  g.addColorStop(1, mix(PAL.skyLow, PAL.skyGlow, 0.6));
  c.fillStyle = g;
  c.fillRect(0, 0, w, hgt);
}

/**
 * Hills behind the level, at two depths.
 *
 * Parallax is the cheapest way to say "this is a place and it continues past
 * the edges of the screen", which is the whole point of a game about
 * exploring somewhere.
 */
export function drawParallax(c, w, hgt, camX, camY) {
  const band = (speed, baseY, amp, period, fill, lit) => {
    const off = camX * speed;
    const y0 = baseY - camY * speed * 0.5;
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(0, hgt);
    for (let x = 0; x <= w + 8; x += 8) {
      const t = (x + off) / period;
      const y = y0 + Math.sin(t) * amp + Math.sin(t * 2.3 + 1.7) * amp * 0.4;
      c.lineTo(x, y);
    }
    c.lineTo(w, hgt);
    c.closePath();
    c.fill();
    // A rim of light along the crest.
    c.strokeStyle = lit;
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= w + 8; x += 8) {
      const t = (x + off) / period;
      const y = y0 + Math.sin(t) * amp + Math.sin(t * 2.3 + 1.7) * amp * 0.4;
      if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  };
  band(0.12, hgt * 0.62, 14, 90, PAL.farHill, PAL.farHillLit);
  band(0.28, hgt * 0.78, 10, 58, PAL.midHill, PAL.midHillLit);
}

/** One tile, at screen position. `nb` is a neighbour lookup. */
function drawTile(c, ch, x, y, tx, ty, level) {
  const def = TILES[ch];
  if (!def || !def.art) return;
  const openAbove = !isSolidArt(tileAt(level, tx, ty - 1));

  switch (def.art) {
    case 'earth':
    case 'turf': {
      // Soil, getting darker with depth, with turf on any face that is open
      // to the sky.
      const depth = Math.min(1, depthBelowAir(level, tx, ty) / 6);
      const soil = mix(PAL.soilLit, PAL.soilDark, depth * 0.85);
      c.fillStyle = soil;
      c.fillRect(x, y, TILE, TILE);
      for (let i = 0; i < 5; i++) {
        const px = x + Math.floor(h(tx, ty, i) * TILE);
        const py = y + Math.floor(h(tx, ty, i + 11) * TILE);
        c.fillStyle = h(tx, ty, i + 21) > 0.5 ? shade(soil, 0.12) : shade(soil, -0.12);
        c.fillRect(px, py, 2, 2);
      }
      if (openAbove) {
        c.fillStyle = PAL.turfDeep;
        c.fillRect(x, y, TILE, 6);
        c.fillStyle = PAL.turf;
        c.fillRect(x, y, TILE, 4);
        c.fillStyle = PAL.turfLit;
        c.fillRect(x, y, TILE, 2);
        // Blades hanging over the lip.
        for (let i = 0; i < 4; i++) {
          const bx = x + 1 + Math.floor(h(tx, ty, i + 31) * 14);
          const bh = 2 + Math.floor(h(tx, ty, i + 41) * 4);
          c.fillStyle = PAL.turf;
          c.fillRect(bx, y + 4, 1, bh);
        }
      }
      break;
    }
    case 'branch': {
      c.fillStyle = PAL.barkDark;
      c.fillRect(x, y + 2, TILE, 5);
      c.fillStyle = PAL.bark;
      c.fillRect(x, y + 2, TILE, 3);
      c.fillStyle = PAL.barkLit;
      c.fillRect(x, y + 2, TILE, 1);
      for (let i = 0; i < 3; i++) {
        const lx = x + Math.floor(h(tx, ty, i + 5) * 13);
        c.fillStyle = h(tx, ty, i) > 0.5 ? PAL.turf : PAL.turfDeep;
        c.beginPath();
        c.ellipse(lx + 2, y + 1, 3, 1.6, h(tx, ty, i + 9) * 1.2 - 0.6, 0, TAU);
        c.fill();
      }
      break;
    }
    case 'trunk': {
      c.fillStyle = PAL.barkDark;
      c.fillRect(x, y, TILE, TILE);
      c.fillStyle = PAL.bark;
      c.fillRect(x + 1, y, TILE - 3, TILE);
      c.fillStyle = PAL.barkLit;
      c.fillRect(x + 2, y, 2, TILE);
      for (let i = 0; i < 3; i++) {
        const ly = y + Math.floor(h(tx, ty, i + 3) * 14);
        c.fillStyle = shade(PAL.bark, -0.2);
        c.fillRect(x + 4, ly, TILE - 7, 1);
      }
      break;
    }
    case 'stone':
    case 'ruin': {
      const base = def.art === 'ruin' ? shade(PAL.stone, -0.1) : PAL.stone;
      c.fillStyle = shade(base, -0.28);
      c.fillRect(x, y, TILE, TILE);
      c.fillStyle = base;
      c.fillRect(x, y, TILE - 1, TILE - 1);
      c.fillStyle = shade(base, 0.18);
      c.fillRect(x, y, TILE - 1, 1);
      c.fillRect(x, y, 1, TILE - 1);
      if (h(tx, ty, 7) > 0.6) {
        c.fillStyle = shade(base, -0.18);
        c.fillRect(x + 3, y + 4 + Math.floor(h(tx, ty, 8) * 6), 8, 1);
      }
      if (openAbove) {
        c.fillStyle = PAL.turfDeep;
        for (let i = 0; i < 5; i++) {
          if (h(tx, ty, i + 51) < 0.45) continue;
          c.fillRect(x + i * 3, y, 2, 1 + Math.floor(h(tx, ty, i + 61) * 2));
        }
      }
      break;
    }
    case 'vine': {
      c.strokeStyle = PAL.turfDeep;
      c.lineWidth = 1.6;
      c.beginPath();
      for (let i = 0; i <= TILE; i += 4) {
        const vx = x + TILE / 2 + Math.sin((ty * TILE + i) * 0.25) * 2.5;
        if (i === 0) c.moveTo(vx, y + i); else c.lineTo(vx, y + i);
      }
      c.stroke();
      for (let i = 0; i < 3; i++) {
        const ly = y + 3 + i * 5;
        c.fillStyle = PAL.turf;
        c.beginPath();
        c.ellipse(x + TILE / 2 + (i % 2 ? 3 : -3), ly, 2.4, 1.3, 0, 0, TAU);
        c.fill();
      }
      break;
    }
    case 'thorns': {
      c.fillStyle = shade(PAL.soilDark, -0.15);
      c.fillRect(x, y + 10, TILE, 6);
      for (let i = 0; i < 4; i++) {
        const bx = x + 1 + i * 4;
        const bh = 6 + Math.floor(h(tx, ty, i) * 4);
        c.fillStyle = shade(PAL.stone, -0.3);
        c.beginPath();
        c.moveTo(bx, y + TILE);
        c.lineTo(bx + 2, y + TILE - bh);
        c.lineTo(bx + 4, y + TILE);
        c.closePath();
        c.fill();
        c.fillStyle = PAL.stoneLit;
        c.fillRect(bx + 1.6, y + TILE - bh + 1, 0.8, 2);
      }
      break;
    }
    case 'water': {
      const openTop = !isWaterArt(tileAt(level, tx, ty - 1));
      c.fillStyle = PAL.waterDeep;
      c.fillRect(x, y, TILE, TILE);
      c.globalAlpha = 0.55;
      c.fillStyle = PAL.water;
      c.fillRect(x, y, TILE, TILE);
      c.globalAlpha = 1;
      if (openTop) {
        const t = performance.now() / 620;
        c.fillStyle = PAL.waterLit;
        for (let i = 0; i < TILE; i += 2) {
          const wy = y + 1 + Math.sin(t + (x + i) * 0.22) * 1.2;
          c.fillRect(x + i, wy, 2, 1);
        }
      }
      break;
    }
    // --- scenery -----------------------------------------------------
    case 'fern': {
      c.strokeStyle = PAL.turfDeep;
      c.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.36;
        c.beginPath();
        c.moveTo(x + 8, y + TILE);
        c.quadraticCurveTo(x + 8 + Math.cos(a) * 5, y + 9, x + 8 + Math.cos(a) * 10, y + 3 + Math.abs(i - 2) * 2);
        c.stroke();
      }
      break;
    }
    case 'mushroom': {
      c.fillStyle = '#f0efe4';
      c.fillRect(x + 6, y + 8, 4, 8);
      c.fillStyle = '#e3573f';
      c.beginPath();
      c.ellipse(x + 8, y + 8, 6.5, 4.5, 0, Math.PI, TAU);
      c.fill();
      c.fillStyle = '#fdf6e3';
      disc(c, x + 6, y + 6, 1.1);
      disc(c, x + 10.5, y + 7, 0.9);
      break;
    }
    case 'leaves': {
      for (let i = 0; i < 6; i++) {
        const lx = x + h(tx, ty, i) * TILE;
        const ly = y + h(tx, ty, i + 13) * TILE;
        c.fillStyle = i % 2 ? PAL.turf : PAL.turfDeep;
        c.globalAlpha = 0.9;
        c.beginPath();
        c.ellipse(lx, ly, 5, 3.2, h(tx, ty, i + 17) * 2, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
      break;
    }
    case 'petals': {
      const t = performance.now() / 1000;
      for (let i = 0; i < 4; i++) {
        const px = x + ((h(tx, ty, i) * TILE + t * 6 * (0.5 + h(tx, ty, i + 2))) % TILE);
        const py = y + ((h(tx, ty, i + 5) * TILE + t * 9) % TILE);
        c.fillStyle = ['#ffd9e8', '#fff0c8', '#ffc0d8'][i % 3];
        c.globalAlpha = 0.85;
        c.beginPath();
        c.ellipse(px, py, 1.6, 1, t + i, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
      break;
    }
    default: break;
  }
}

function disc(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }

function isSolidArt(ch) { const d = TILES[ch]; return !!(d && d.solid); }
function isWaterArt(ch) { const d = TILES[ch]; return !!(d && d.water); }

/** How many solid tiles sit above this one, for shading depth. */
function depthBelowAir(level, tx, ty) {
  let n = 0;
  for (let y = ty - 1; y >= 0 && n < 8; y--) {
    if (!isSolidArt(tileAt(level, tx, y))) break;
    n++;
  }
  return n;
}

/** Everything behind the hero. */
export function drawLevel(c, level, cam, viewW, viewH) {
  const x0 = Math.max(0, Math.floor(cam.x / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE));
  const x1 = Math.min(level.width - 1, Math.ceil((cam.x + viewW) / TILE));
  const y1 = Math.min(level.height - 1, Math.ceil((cam.y + viewH) / TILE));

  // Scenery first so a fern is behind the ledge it grows out of.
  for (let pass = 0; pass < 2; pass++) {
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = level.rows[ty][tx];
        const def = TILES[ch];
        if (!def || !def.art) continue;
        const isBack = !!def.back;
        if ((pass === 0) !== isBack) continue;
        drawTile(c, ch, Math.round(tx * TILE - cam.x), Math.round(ty * TILE - cam.y), tx, ty, level);
      }
    }
  }
}
