// Bodies that move through a tile grid, continuously.
//
// The other game in this repo moves one square at a time, and a square is
// either walkable or it is not. Nothing about that survives here. A
// platformer lives or dies on sub-pixel position, on the exact shape of a
// jump arc, and on what the collision does when you clip the corner of a
// ledge at speed — so this file is the whole game, really, and the levels
// are the decoration.
//
// The grid stays, though. Levels are still ASCII, because a level you can
// read in a diff is a level you can fix, and because the solid-ness of a
// tile is a cheap lookup no matter how fine the movement over it is.

import { TILE } from '../render/canvas.js';
import { solidAt, oneWayAt, tileAt } from '../data/tiles.js';

/** A tuning table, in one place, because feel is edited by hand. */
export const MOVE = {
  // Running. Ground acceleration is brisk and ground friction is high, so
  // stopping is crisp; the air is deliberately vaguer.
  runAccel: 0.62,
  runMax: 2.35,
  groundFriction: 0.52,
  airAccel: 0.38,
  airFriction: 0.06,

  // Falling.
  gravity: 0.44,
  terminal: 7.2,

  // Jumping. `jumpCut` is what makes a tap a hop and a hold a leap: let go
  // early and the upward speed is trimmed rather than stopped, which reads
  // as control instead of as the game taking the jump away from you.
  jump: -6.45,
  jumpCut: 0.42,

  // The two forgivenesses every good platformer has and no player notices.
  // Coyote: you may still jump for a moment after walking off an edge.
  // Buffer: a jump pressed just before landing fires on landing.
  coyote: 7,
  buffer: 9,

  // The helicopter. Holding jump while falling slows the descent to a drift.
  // This is the move the whole character is built around, so it is generous:
  // slow enough to cross a real gap, not so slow that height stops mattering.
  glideFall: 1.05,
  glideAccel: 0.3,
  glideSteer: 1.35,     // air control multiplier while gliding
};

/**
 * One physical body. The hero, a crate, a walking enemy — anything that has
 * to stop when it meets the world.
 *
 * `x`/`y` are the top-left of the collision box in world pixels, kept as
 * floats. Everything rounds only at draw time.
 */
export function makeBody(x, y, w, h) {
  return {
    x, y, w, h,
    vx: 0, vy: 0,
    onGround: false,
    wasOnGround: false,
    againstWall: 0,      // -1 left, 1 right, 0 neither
    // Carried so callers can react to the frame of contact rather than the
    // state: landing sounds, dust, squash-and-stretch.
    justLanded: false,
    justLeftGround: false,
    // Set when a move was refused by geometry, which is how a wall-slide or
    // a ledge grab knows there is something there.
    hitCeiling: false,
  };
}

const floor = Math.floor;

/** Is any solid tile overlapping this box? Used for spawn checks and tests. */
export function boxHitsSolid(level, x, y, w, h) {
  const x0 = floor(x / TILE), x1 = floor((x + w - 0.001) / TILE);
  const y0 = floor(y / TILE), y1 = floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (solidAt(level, tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Moves a body by its velocity, one axis at a time, stopping on what it hits.
 *
 * Axis-at-a-time is not an optimisation, it is the reason you can run along
 * a floor without catching on the seam between two floor tiles: horizontal
 * movement is resolved against the world before vertical is considered, so a
 * body that is exactly flush with the ground is never "inside" the next tile
 * along.
 *
 * The step is also split into pieces no larger than a tile. Without that, a
 * body moving faster than 16px a frame — a fall from any height — passes
 * straight through a floor between two frames, and the bug only shows up on
 * the one jump in the level that is high enough.
 */
/**
 * Call once at the top of a body's frame, before anything touches it.
 *
 * This used to live at the top of `moveBody`, which was wrong in a way that
 * hid itself: a jump sets `onGround = false` so the state machine reads
 * right, and that happens BEFORE the body moves — so by the time moveBody
 * snapshotted `wasOnGround` it was already false, and `justLeftGround` could
 * never fire for a jump. Only for walking off a ledge. Every takeoff cue
 * hung on that flag — the dust, the sound — would simply never have happened,
 * and nobody would have known why.
 */
export function beginBodyFrame(b) {
  b.wasOnGround = b.onGround;
  b.justLanded = false;
  b.justLeftGround = false;
  b.hitCeiling = false;
  b.againstWall = 0;
}

export function moveBody(level, b) {

  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) / (TILE - 1)));
  const sx = b.vx / steps;
  const sy = b.vy / steps;

  for (let i = 0; i < steps; i++) {
    if (sx !== 0) moveX(level, b, sx);
    if (sy !== 0) moveY(level, b, sy);
  }

  if (b.onGround && !b.wasOnGround) b.justLanded = true;
  if (!b.onGround && b.wasOnGround) b.justLeftGround = true;
}

function moveX(level, b, dx) {
  b.x += dx;
  const dir = dx > 0 ? 1 : -1;
  const edge = dir > 0 ? b.x + b.w : b.x;
  const tx = floor(edge / TILE);
  const y0 = floor(b.y / TILE), y1 = floor((b.y + b.h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    if (!solidAt(level, tx, ty)) continue;
    b.x = dir > 0 ? tx * TILE - b.w : (tx + 1) * TILE;
    b.vx = 0;
    b.againstWall = dir;
    return;
  }
}

function moveY(level, b, dy) {
  b.y += dy;
  const dir = dy > 0 ? 1 : -1;
  const edge = dir > 0 ? b.y + b.h : b.y;
  const ty = floor(edge / TILE);
  const x0 = floor(b.x / TILE), x1 = floor((b.x + b.w - 0.001) / TILE);

  for (let tx = x0; tx <= x1; tx++) {
    let blocks = solidAt(level, tx, ty);
    // A one-way platform only exists to something falling onto its top, and
    // only if the body was entirely above it before this step. Otherwise you
    // could never jump up through a branch, which is half of moving about a
    // tree.
    if (!blocks && dir > 0 && oneWayAt(level, tx, ty)) {
      const top = ty * TILE;
      if (b.y + b.h - dy <= top + 0.001) blocks = true;
    }
    if (!blocks) continue;
    if (dir > 0) {
      b.y = ty * TILE - b.h;
      b.onGround = true;
    } else {
      b.y = (ty + 1) * TILE;
      b.hitCeiling = true;
    }
    b.vy = 0;
    return;
  }
  // Nothing underfoot this step. Only clear `onGround` when moving down —
  // a body walking along a floor has a tiny positive vy every frame from
  // gravity, and clearing the flag on the way up would make every jump
  // start from the air.
  if (dir > 0) b.onGround = false;
}

/** True when there is floor within `reach` pixels below the body. */
export function groundBelow(level, b, reach = 2) {
  const y = b.y + b.h + reach;
  const ty = floor(y / TILE);
  const x0 = floor(b.x / TILE), x1 = floor((b.x + b.w - 0.001) / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    if (solidAt(level, tx, ty) || oneWayAt(level, tx, ty)) return true;
  }
  return false;
}

/**
 * A ledge the hands could catch: solid at chest height in front, open above
 * it. Returns the world Y of the lip, or null.
 */
export function ledgeInFront(level, b, facing) {
  const ahead = facing > 0 ? b.x + b.w + 2 : b.x - 2;
  const tx = floor(ahead / TILE);
  const chest = floor((b.y + 3) / TILE);
  if (!solidAt(level, tx, chest)) return null;
  if (solidAt(level, tx, chest - 1)) return null;
  return chest * TILE;
}

export { tileAt };
