// The character you steer.
//
// All the feel work from the flat prototype carried over intact — the
// jump-cut, coyote time, the landing buffer, the helicopter — because none of
// it was ever about being two-dimensional. What is new is that "left" now
// means "left of where the camera is looking", and that the character has to
// turn to face where they are going.

import { makeActor, moveActor, beginActorFrame, groundUnder, PHYS } from './actor.js';
import { angleDelta, approach, clamp } from '../gl/math.js';

export const STATE = {
  STAND: 'stand', RUN: 'run', JUMP: 'jump', FALL: 'fall',
  GLIDE: 'glide', HURT: 'hurt',
};

/**
 * The shape of a character. The hero and whoever is walking with you are the
 * same object with different things driving them — which is the only reason
 * the partner animates as well as the player does, because there is no second
 * implementation to fall behind.
 */
export function makeCharacter(x, y, z, look = 'matt') {
  const a = makeActor(x, y, z, 0.33, 1.15);
  const limb = () => ({ x, y, z, vx: 0, vy: 0, vz: 0 });
  return {
    a,
    look,
    yaw: 0,               // where the body is pointing
    state: STATE.FALL,
    t: 0,
    coyote: 0,
    buffer: 0,
    squash: 0,
    rotor: 0,
    hands: [limb(), limb()],
    boots: [limb(), limb()],
    shadowY: y,
    shadowScale: 1,
    lums: 0,
    hearts: 4,
    invuln: 0,
    can: { glide: true, fist: false, climb: false, swim: false },
  };
}

export function makeHero(x, y, z, look = 'matt') {
  return makeCharacter(x, y, z, look);
}

/**
 * `input` is { mx, mz, jump, jumpHeld, camYaw } where mx/mz is a stick in
 * camera space, each in [-1, 1].
 */
export function updateHero(h, world, input, dt) {
  const a = h.a;
  h.t += dt;
  beginActorFrame(a);
  if (h.invuln > 0) h.invuln -= dt;

  // --- the stick, rotated into the world -------------------------------
  let wx = 0, wz = 0;
  const mag = Math.hypot(input.mx, input.mz);
  if (mag > 0.06) {
    const c = Math.cos(input.camYaw), s = Math.sin(input.camYaw);
    // Forward on the stick is away from the camera.
    wx = input.mx * c - input.mz * s;
    wz = input.mx * s + input.mz * c;
    const l = Math.hypot(wx, wz) || 1;
    const push = Math.min(1, mag);
    wx = (wx / l) * push;
    wz = (wz / l) * push;
  }

  if (input.jump) h.buffer = PHYS.buffer;
  else h.buffer = Math.max(0, h.buffer - dt);
  if (a.onGround) h.coyote = PHYS.coyote;
  else h.coyote = Math.max(0, h.coyote - dt);

  const gliding = !a.onGround && a.vy < 0 && input.jumpHeld && h.can.glide;

  // --- run ---------------------------------------------------------------
  const accel = (a.onGround ? PHYS.runAccel : PHYS.airAccel * (gliding ? PHYS.glideSteer : 1)) * dt;
  const drag = (a.onGround ? PHYS.groundDrag : PHYS.airDrag) * dt;
  if (wx || wz) {
    a.vx += wx * accel;
    a.vz += wz * accel;
    const sp = Math.hypot(a.vx, a.vz);
    const max = PHYS.runMax * Math.min(1, Math.hypot(wx, wz));
    if (sp > max) {
      const k = Math.max(max, sp - accel) / sp;
      a.vx *= k; a.vz *= k;
    }
    // Turn to face the way you are going, quickly but not instantly.
    const want = Math.atan2(wx, wz);
    h.yaw += angleDelta(h.yaw, want) * Math.min(1, 16 * dt);
  } else {
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > 0) {
      const k = Math.max(0, sp - drag) / sp;
      a.vx *= k; a.vz *= k;
    }
  }

  // --- fall --------------------------------------------------------------
  if (gliding) {
    a.vy = approach(a.vy, -PHYS.glideFall, PHYS.glideEase * dt);
    h.rotor += 26 * dt;
  } else {
    a.vy -= PHYS.gravity * dt;
    if (a.vy < -PHYS.terminal) a.vy = -PHYS.terminal;
  }

  // --- jump ---------------------------------------------------------------
  if ((a.onGround || h.coyote > 0) && h.buffer > 0) {
    a.vy = PHYS.jump;
    a.onGround = false;
    h.coyote = 0;
    h.buffer = 0;
    h.squash = -1;
  }
  if (!input.jumpHeld && a.vy > 0) a.vy *= PHYS.jumpCut;

  moveActor(world, a, dt);

  if (a.justLanded) h.squash = 1;
  h.squash *= Math.pow(0.02, dt);

  // --- what that added up to ----------------------------------------------
  if (h.invuln > 0.55) h.state = STATE.HURT;
  else if (gliding) h.state = STATE.GLIDE;
  else if (!a.onGround) h.state = a.vy > 0 ? STATE.JUMP : STATE.FALL;
  else if (Math.hypot(a.vx, a.vz) > 0.35) h.state = STATE.RUN;
  else h.state = STATE.STAND;
  if (h.state !== STATE.GLIDE) h.rotor *= Math.pow(0.05, dt);

  // The shadow finds the floor rather than sitting at the feet, so height
  // over a drop is readable — which in a 3D platformer is the difference
  // between landing a jump and guessing at one.
  const under = groundUnder(world, a, 12);
  h.shadowY = under ? under.maxY : a.y;
  h.shadowScale = under ? clamp(1 - (a.y - under.maxY) / 9, 0.28, 1) : 0;

  updateLimbs(h, dt);
  return h.state;
}

/**
 * Where the four loose parts want to be, and the springs that get them there.
 *
 * Targets are computed in the character's own space and then rotated into the
 * world, so a hand that should be "out to the left" stays out to the left
 * whichever way he is facing.
 */
export function updateLimbs(h, dt) {
  const a = h.a;
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  const speed = Math.hypot(a.vx, a.vz);
  const run = Math.min(1, speed / PHYS.runMax);
  const step = Math.sin(h.t * 15 * (0.45 + run * 0.8));

  // [sideways, up, forward] in body space.
  let hand = [[-0.52, 0.88, 0.04], [0.52, 0.88, 0.04]];
  let boot = [[-0.24, 0.12, 0], [0.24, 0.12, 0]];
  let stiff = 16;

  switch (h.state) {
    case STATE.RUN:
      hand = [[-0.5, 0.9 + step * 0.12, -step * 0.32], [0.5, 0.9 - step * 0.12, step * 0.32]];
      boot = [[-0.19, 0.12 + Math.max(0, step) * 0.26, step * 0.3],
        [0.19, 0.12 + Math.max(0, -step) * 0.26, -step * 0.3]];
      stiff = 20;
      break;
    case STATE.GLIDE:
      // Hands up, holding on. Everything else hangs.
      hand = [[-0.34, 1.56, 0.04], [0.34, 1.56, 0.04]];
      boot = [[-0.17, -0.12, -0.12], [0.17, -0.12, -0.12]];
      stiff = 11;
      break;
    case STATE.JUMP:
      hand = [[-0.56, 1.18, 0.08], [0.56, 1.18, 0.08]];
      boot = [[-0.2, 0.26, 0.08], [0.2, 0.2, -0.04]];
      stiff = 15;
      break;
    case STATE.FALL:
      hand = [[-0.62, 1.0, -0.04], [0.62, 1.0, -0.04]];
      boot = [[-0.2, 0.0, -0.06], [0.2, 0.04, -0.02]];
      stiff = 10;
      break;
    case STATE.HURT:
      hand = [[-0.58, 1.26, -0.1], [0.58, 1.26, -0.1]];
      boot = [[-0.22, 0.2, -0.14], [0.22, 0.2, -0.14]];
      stiff = 13;
      break;
    default: {
      const idle = Math.sin(h.t * 2.1) * 0.03;
      hand = [[-0.52, 0.88 + idle, 0.04], [0.52, 0.88 - idle, 0.04]];
      stiff = 12;
    }
  }

  for (let i = 0; i < 2; i++) {
    place(h.hands[i], a, c, s, hand[i], stiff, dt);
    place(h.boots[i], a, c, s, boot[i], stiff + 6, dt);
  }
}

function place(p, a, c, s, off, stiff, dt) {
  // Body space -> world. +Z is forward, +X is the character's right.
  const tx = a.x + off[0] * c + off[2] * s;
  const ty = a.y + off[1];
  const tz = a.z - off[0] * s + off[2] * c;
  const k = 1 - Math.pow(0.0001, stiff * dt * 0.06);
  p.x += (tx - p.x) * k;
  p.y += (ty - p.y) * k;
  p.z += (tz - p.z) * k;
}

/** Everything the renderer needs, and nothing it has to decide. */
export function heroPose(h) {
  return {
    x: h.a.x, y: h.a.y, z: h.a.z,
    yaw: h.yaw,
    squash: h.squash,
    shadowY: h.shadowY,
    shadowScale: h.shadowScale,
    hands: h.hands,
    boots: h.boots,
  };
}
