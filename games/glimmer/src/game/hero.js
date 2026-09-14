// The hero.
//
// Everything here is in service of one thing: that moving is a pleasure even
// with nothing to do. If running from one end of an empty field to the other
// and gliding down off the far ledge is not fun on its own, no amount of
// world will rescue it — so this file gets the attention, and it is all
// small numbers found by hand.

import { makeBody, moveBody, beginBodyFrame, groundBelow, MOVE } from './physics.js';
import { TILE } from '../render/canvas.js';
import { hurtAt, climbAt, waterAt } from '../data/tiles.js';

export const STATE = {
  STAND: 'stand',
  RUN: 'run',
  JUMP: 'jump',
  FALL: 'fall',
  GLIDE: 'glide',
  CLIMB: 'climb',
  SWIM: 'swim',
  HURT: 'hurt',
};

export function makeHero(x, y, look = 'matthew') {
  // 11x16 is the collision box, not the drawing: the head and hair sit
  // above it and the feet dangle below. Sized so he is about an eighth of
  // the screen high, which is where a platformer hero reads without eating
  // the view of what he is about to run into.
  const b = makeBody(x, y, 11, 16);
  return {
    body: b,
    look,
    facing: 1,
    state: STATE.FALL,
    // Frame counters for the two forgivenesses.
    coyote: 0,
    buffer: 0,
    // Drawing state. The hands and feet are not attached to anything, so
    // they are simulated rather than posed: each chases where it ought to be
    // and arrives late, which is most of what sells the character.
    t: 0,
    hairSpin: 0,
    squash: 0,
    handL: { x, y, vx: 0, vy: 0 },
    handR: { x, y, vx: 0, vy: 0 },
    footL: { x, y, vx: 0, vy: 0 },
    footR: { x, y, vx: 0, vy: 0 },
    // The fist, when it is out in the world rather than beside him.
    fist: null,
    fistCooldown: 0,
    // What the world has done to him.
    hearts: 3,
    invuln: 0,
    lums: 0,
    // Abilities, earned. The whole map is gated on these, so they live in
    // the save rather than here — this is just the working copy.
    can: { glide: true, fist: true, climb: false, swim: false, superFist: false },
  };
}

/** The centre of the body, which is what everything else is drawn around. */
export function heroCentre(h) {
  return { x: h.body.x + h.body.w / 2, y: h.body.y + h.body.h / 2 };
}

/**
 * One tick.
 *
 * `input` is a plain object so the same routine drives the player, a replay,
 * and the test harness: { left, right, up, down, jump, jumpHeld, fist }.
 */
export function updateHero(h, level, input, dt) {
  h.t += dt;
  const b = h.body;
  beginBodyFrame(b);

  if (h.invuln > 0) h.invuln--;
  if (h.fistCooldown > 0) h.fistCooldown--;

  const wet = inWater(level, b);

  // --- what the player asked for -------------------------------------
  const want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (want !== 0) h.facing = want;

  if (input.jump) h.buffer = MOVE.buffer;
  else if (h.buffer > 0) h.buffer--;

  if (b.onGround) h.coyote = MOVE.coyote;
  else if (h.coyote > 0) h.coyote--;

  // --- the helicopter -------------------------------------------------
  //
  // Held jump, falling, not in water, and off the ground. Deliberately NOT
  // gated on having jumped: walking off a ledge and catching yourself is the
  // move people fall in love with, and making them jump first to earn it
  // would be a rule nobody asked for.
  const gliding = !wet && !b.onGround && b.vy > 0 && input.jumpHeld && h.can.glide;

  // --- horizontal -----------------------------------------------------
  const accel = b.onGround ? MOVE.runAccel : MOVE.airAccel * (gliding ? MOVE.glideSteer : 1);
  const friction = b.onGround ? MOVE.groundFriction : MOVE.airFriction;
  if (want !== 0) {
    b.vx += want * accel;
    const max = MOVE.runMax * (wet ? 0.68 : 1);
    if (b.vx > max) b.vx = Math.max(max, b.vx - accel);
    if (b.vx < -max) b.vx = Math.min(-max, b.vx + accel);
  } else if (b.vx !== 0) {
    const drop = Math.min(Math.abs(b.vx), friction);
    b.vx -= Math.sign(b.vx) * drop;
  }

  // --- vertical -------------------------------------------------------
  if (wet) {
    // Water is a different medium, not a slower version of air: you sink
    // gently, you can swim up, and the jump button is the up stroke.
    b.vy += (input.jumpHeld ? -0.24 : 0.12);
    b.vy = Math.max(-1.9, Math.min(1.7, b.vy));
    if (input.up) b.vy -= 0.1;
    if (input.down) b.vy += 0.1;
  } else if (gliding) {
    // Ease down to the drift rather than snapping to it, so catching the
    // glide late still feels like arresting a fall.
    if (b.vy > MOVE.glideFall) b.vy = Math.max(MOVE.glideFall, b.vy - MOVE.glideAccel);
    else b.vy = Math.min(MOVE.glideFall, b.vy + MOVE.gravity * 0.5);
    h.hairSpin += 0.55;
  } else {
    b.vy += MOVE.gravity;
    if (b.vy > MOVE.terminal) b.vy = MOVE.terminal;
  }

  // --- the jump -------------------------------------------------------
  const mayJump = (b.onGround || h.coyote > 0 || wet) && h.buffer > 0;
  if (mayJump) {
    b.vy = wet ? -2.4 : MOVE.jump;
    b.onGround = false;
    h.coyote = 0;
    h.buffer = 0;
    h.squash = -1;          // stretch on the way up
    h.jumped = true;
  }
  // Letting go early trims the arc. Only on the way up, and only once.
  if (!input.jumpHeld && b.vy < 0 && !wet) b.vy *= MOVE.jumpCut;

  // --- the world answers ----------------------------------------------
  moveBody(level, b);

  if (b.justLanded) {
    h.squash = 1;
    h.jumped = false;
  }
  h.squash *= 0.82;

  if (touchingHurt(level, b) && h.invuln <= 0) hurt(h, 1);

  // --- what all that added up to --------------------------------------
  if (wet) h.state = STATE.SWIM;
  else if (h.invuln > 44) h.state = STATE.HURT;
  else if (gliding) h.state = STATE.GLIDE;
  else if (!b.onGround) h.state = b.vy < 0 ? STATE.JUMP : STATE.FALL;
  else if (Math.abs(b.vx) > 0.12) h.state = STATE.RUN;
  else h.state = STATE.STAND;

  if (h.state !== STATE.GLIDE) h.hairSpin *= 0.86;

  updateLimbs(h);
  void groundBelow;
  void climbAt;
  return h.state;
}

function inWater(level, b) {
  const tx = Math.floor((b.x + b.w / 2) / TILE);
  const ty = Math.floor((b.y + b.h * 0.65) / TILE);
  return waterAt(level, tx, ty);
}

function touchingHurt(level, b) {
  const x0 = Math.floor(b.x / TILE), x1 = Math.floor((b.x + b.w - 0.001) / TILE);
  const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) if (hurtAt(level, tx, ty)) return true;
  }
  return false;
}

export function hurt(h, n = 1) {
  if (h.invuln > 0) return false;
  h.hearts -= n;
  h.invuln = 60;
  h.body.vy = -3.2;
  h.body.vx = -h.facing * 1.8;
  return true;
}

/**
 * The hands and the feet.
 *
 * They belong to nobody: there are no arms and no legs, so each one is a
 * little mass on a spring chasing a target that depends on what he is doing.
 * The lag is the character. Stiffen the springs and he turns into a normal
 * platformer sprite; loosen them and he turns to jelly.
 */
function updateLimbs(h) {
  const b = h.body;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const f = h.facing;
  const run = Math.min(1, Math.abs(b.vx) / MOVE.runMax);
  const step = Math.sin(h.t * 16 * (0.4 + run)) * run;

  let hlx = cx - 7 * f, hly = cy - 1;
  let hrx = cx + 6 * f, hry = cy - 1;
  let flx = cx - 3, fly = b.y + b.h - 1;
  let frx = cx + 3, fry = b.y + b.h - 1;

  switch (h.state) {
    case STATE.RUN:
      hlx = cx - 6 * f; hly = cy - 2 - step * 2;
      hrx = cx + 5 * f; hry = cy - 2 + step * 2;
      fly -= Math.max(0, step) * 4;
      fry -= Math.max(0, -step) * 4;
      flx = cx - 3 + step * 2; frx = cx + 3 + step * 2;
      break;
    case STATE.GLIDE:
      // Hands UP, holding on to the hair. Everybody who has played one of
      // these knows that shape before they know anything else about the
      // character, and hands held out to the sides reads as falling.
      hlx = cx - 5.5 * f; hly = cy - 15;
      hrx = cx + 4.5 * f; hry = cy - 15;
      fly = b.y + b.h + 3; fry = b.y + b.h + 4;
      flx = cx - 2.5 - b.vx * 1.6; frx = cx + 3.5 - b.vx * 1.6;
      break;
    case STATE.JUMP:
      hlx = cx - 6 * f; hly = cy - 5;
      hrx = cx + 6 * f; hry = cy - 5;
      fly = b.y + b.h - 3; fry = b.y + b.h - 1;
      break;
    case STATE.FALL:
      hlx = cx - 8 * f; hly = cy - 2;
      hrx = cx + 7 * f; hry = cy - 3;
      fly = b.y + b.h + 1; fry = b.y + b.h;
      break;
    case STATE.SWIM: {
      const s = Math.sin(h.t * 7);
      hlx = cx - 7 * f - s * 2; hly = cy - 1 + s;
      hrx = cx + 6 * f + s * 2; hry = cy - 1 - s;
      fly = b.y + b.h + 1 + s; fry = b.y + b.h + s;
      break;
    }
    case STATE.HURT:
      hlx = cx - 8 * f; hly = cy - 5;
      hrx = cx + 7 * f; hry = cy - 5;
      break;
    default: {
      // Standing still is never still: a slow breath in the hands.
      const idle = Math.sin(h.t * 2.2);
      hly = cy - 1 + idle * 0.8;
      hry = cy - 1 - idle * 0.8;
    }
  }

  // A hand that has been thrown is not where the body wants it to be.
  if (h.fist && h.fist.hand === 'R') { hrx = h.fist.x; hry = h.fist.y; }

  spring(h.handL, hlx, hly, 0.34, 0.62);
  spring(h.handR, hrx, hry, h.fist && h.fist.hand === 'R' ? 1 : 0.34, 0.62);
  spring(h.footL, flx, fly, 0.42, 0.58);
  spring(h.footR, frx, fry, 0.42, 0.58);
}

function spring(p, tx, ty, k, damp) {
  if (k >= 1) { p.x = tx; p.y = ty; p.vx = 0; p.vy = 0; return; }
  p.vx = (p.vx + (tx - p.x) * k) * damp;
  p.vy = (p.vy + (ty - p.y) * k) * damp;
  p.x += p.vx;
  p.y += p.vy;
}
