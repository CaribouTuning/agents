// The real DS-era sprites.
//
// Everything in this game is drawn from data, which is what let the Pokédex
// grow to 210 entries without an art pipeline — but a generated approximation
// of a Pokémon is not a Pokémon. These are Platinum's own sprites, embedded in
// the bundle (see tools/getsprites.py and tools/packsprites.py), with the
// generator kept underneath as the fallback for anything they do not cover.
//
// Decoding is lazy and per-sprite. A data: URI decodes in about a millisecond,
// so the first frame a species appears may draw the generated art and every
// frame after it draws the real thing — which is invisible in practice and,
// more importantly, never blocks a frame waiting on an image.
import { SPRITE_SHEETS } from './_gen_sprites.js';
import { makeSurface } from './canvas.js';

const images = new Map();     // "slug:set" -> HTMLImageElement | null
const scaled = new Map();     // "slug:set:size" -> canvas

/** The set name for a request: front/back, normal/shiny. */
export function setFor(back, shiny) {
  return back ? (shiny ? 'bs' : 'b') : (shiny ? 'fs' : 'f');
}

export function hasSprite(slug) { return !!SPRITE_SHEETS[slug]; }

function image(slug, set) {
  const key = `${slug}:${set}`;
  if (images.has(key)) return images.get(key);
  const rec = SPRITE_SHEETS[slug];
  const data = rec && rec[set];
  if (!data) { images.set(key, null); return null; }
  // No `document` during a headless import; the tools that do that only ever
  // ask whether a sprite exists, never for the pixels.
  if (typeof Image === 'undefined') { images.set(key, null); return null; }
  const img = new Image();
  img.decoding = 'sync';
  img.src = `data:image/png;base64,${data}`;
  images.set(key, img);
  return img;
}

/** The decoded sprite, or null while it is still decoding or absent. */
export function rawSprite(slug, set) {
  const img = image(slug, set);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * The sprite drawn into a `size` square, cached.
 *
 * Scaling is nearest-neighbour at whole ratios and smooth otherwise: dropping
 * every fifth row out of an 80px sprite to reach 64 eats thin outlines and
 * eyes, which is exactly the detail these sprites exist for. Anything at or
 * below 32px is drawn from the 32px menu icon instead, which is the artwork
 * that was designed to be read at that size.
 */
export function spriteAt(slug, set, size) {
  const useIcon = size <= 32 && SPRITE_SHEETS[slug] && SPRITE_SHEETS[slug].i;
  const src = useIcon ? 'i' : set;
  const key = `${slug}:${src}:${size}`;
  const hit = scaled.get(key);
  if (hit) return hit;

  const img = rawSprite(slug, src);
  if (!img) return null;

  const surf = makeSurface(size, size);
  const c = surf.ctx;
  const n = img.naturalWidth;
  const whole = size % n === 0 || n % size === 0;
  c.imageSmoothingEnabled = !whole;
  if (!whole) c.imageSmoothingQuality = 'high';
  // Icons are drawn at their own size, centred and sitting on the bottom, so a
  // party list of them lines up on the feet rather than on the box.
  if (useIcon && size >= n) {
    c.drawImage(img, Math.round((size - n) / 2), size - n);
  } else {
    c.drawImage(img, 0, 0, n, n, 0, 0, size, size);
  }
  scaled.set(key, surf.canvas);
  return surf.canvas;
}

/**
 * Warms the sprites a screen is about to need, so nothing pops.
 * Safe to call every frame: an already-created Image is not created twice.
 */
export function preload(slugs, sets = ['f', 'b', 'i']) {
  for (const slug of slugs) for (const set of sets) image(slug, set);
}
