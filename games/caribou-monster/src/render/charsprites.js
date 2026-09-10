// The DS overworld characters.
//
// sprites.js still builds a character out of a palette and a template, and it
// still runs for anything the atlas does not carry. But every look the game
// actually uses is in the atlas now, cut from Platinum's own sheets — which is
// why the people in the world stopped being the same person in different
// jumpers.
//
// One image, one row per look, twelve 32x32 frames: down, up, left, right,
// three frames each. Right is not mirrored at draw time; it is mirrored once
// when the atlas is built, which keeps this a plain blit.
import { CHAR_ATLAS, CHAR_CELL, CHAR_DIRS, CHAR_ROWS } from './_gen_chars.js';

// Where the feet sit inside a cell, measured off the sheets. Everything in the
// world is placed by its feet, so this is the number that matters.
const FEET = 30;

let atlas = null;

function sheet() {
  if (atlas !== null) return atlas;
  if (typeof Image === 'undefined') { atlas = false; return atlas; }
  const img = new Image();
  img.decoding = 'sync';
  img.src = `data:image/png;base64,${CHAR_ATLAS}`;
  atlas = img;
  return atlas;
}

export function hasCharSprite(look) {
  return CHAR_ROWS[look] !== undefined;
}

/**
 * Draws one character frame with its feet on the bottom of the tile at (x, y).
 * Returns false when the atlas has nothing for this look or has not decoded,
 * so the caller can fall back to the generated sprite.
 */
export function drawCharSprite(ctx, look, dir, frame, x, y, alpha = 1) {
  const row = CHAR_ROWS[look];
  if (row === undefined) return false;
  const img = sheet();
  if (!img || !img.complete || !img.naturalWidth) return false;

  const d = Math.max(0, CHAR_DIRS.indexOf(dir));
  const col = d * 3 + (frame % 3);
  const dx = Math.round(x) + 8 - CHAR_CELL / 2;
  const dy = Math.round(y) + 16 - FEET;

  if (alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.drawImage(img, col * CHAR_CELL, row * CHAR_CELL, CHAR_CELL, CHAR_CELL,
    dx, dy, CHAR_CELL, CHAR_CELL);
  if (alpha !== 1) ctx.restore();
  return true;
}

/** Warms the atlas so the first character on screen is already the real one. */
export function preloadChars() { sheet(); }
