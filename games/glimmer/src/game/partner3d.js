// The other one of you.
//
// Whichever of the two you are playing, the other walks with you. That is the
// whole premise of this game, so the partner is not a decoration bolted to the
// camera — she runs the same physics, collides with the same boxes, jumps the
// same jump and glides the same glide as the player does.
//
// The hard part in 3D is that "walk toward the player" is wrong. A follower
// that steers straight at you walks off every platform you jumped to, falls
// down every gap you crossed, and shoves itself into the wall you ran round.
// So instead the hero drops a trail of breadcrumbs as they move and the
// partner walks the trail — the same route, a couple of seconds late. She goes
// where you went, which is both correct and the thing that reads as company.

import { moveActor, beginActorFrame, groundUnder, PHYS } from './actor.js';
import { makeCharacter, updateLimbs, STATE } from './hero3d.js';
import { angleDelta, clamp } from '../gl/math.js';

const CRUMB_STEP = 0.42;   // how far the hero moves before dropping a crumb
const CRUMB_MAX = 120;     // ~50 metres of memory
const FOLLOW = 1.9;        // how far back along the trail she walks
const CATCHUP = 5.5;       // beyond this she starts hurrying
const LOST = 17;           // beyond this she gave up and cuts the corner
const SIDE = 1.05;         // how far off the player's own line she walks
const RESCUE = 26;         // beyond this she was left behind entirely
const VOID = 11;           // this far below you, she is not on a ledge — she is falling

export function makeTrail() {
  return { pts: [], len: 0 };
}

/** Called with the hero's position every frame; records it when it is new. */
export function pushCrumb(trail, x, y, z, onGround) {
  const last = trail.pts[trail.pts.length - 1];
  if (last) {
    const d = Math.hypot(x - last.x, y - last.y, z - last.z);
    if (d < CRUMB_STEP) return;
    trail.len += d;
    trail.pts.push({ x, y, z, onGround, d });
  } else {
    trail.pts.push({ x, y, z, onGround, d: 0 });
  }
  while (trail.pts.length > CRUMB_MAX) {
    const gone = trail.pts.shift();
    trail.len -= gone.d;
    if (trail.pts[0]) { trail.len -= trail.pts[0].d; trail.pts[0].d = 0; }
  }
}

/** Put her back beside you, wherever you have ended up. */
export function replacePartner(p, hero, trail) {
  const a = p.a, ha = hero.a;
  a.x = ha.x - Math.sin(hero.yaw) * 1.2;
  a.y = ha.y + 0.4;
  a.z = ha.z - Math.cos(hero.yaw) * 1.2;
  a.vx = a.vy = a.vz = 0;
  a.onGround = false;
  if (trail) { trail.pts.length = 0; trail.len = 0; }
  for (const l of p.hands.concat(p.boots)) { l.x = a.x; l.y = a.y; l.z = a.z; }
}

export function makePartner(x, y, z, look) {
  const p = makeCharacter(x, y, z, look);
  p.isPartner = true;
  p.hop = 0;        // a small delay before repeating a jump
  p.lostFor = 0;
  // Reused every frame for the floor probe, so steering allocates nothing.
  p.probe = { x: 0, y: 0, z: 0, r: p.a.r };
  return p;
}

/**
 * Walks back along the trail from the newest crumb until `back` metres of it
 * have been covered, and returns that point — where she should be standing.
 *
 * Returns null when the trail is SHORTER than that, rather than handing back
 * the oldest crumb it has. That fallback looks harmless and is not: at spawn
 * the only crumbs are the hero's short drop onto the meadow, so the oldest one
 * sits a metre in the air, and she stands next to a motionless player jumping
 * at it forever.
 */
function pointBack(trail, back) {
  const pts = trail.pts;
  if (pts.length < 2) return null;
  let acc = 0;
  for (let i = pts.length - 1; i > 0; i--) {
    acc += pts[i].d;
    if (acc >= back) return { p: pts[i - 1], next: pts[i] };
  }
  return null;
}

/**
 * She walks beside your line, not along it.
 *
 * Following the crumbs exactly puts her on the precise ground you covered,
 * which is directly between you and a camera sitting behind you — so the
 * person you are playing this with spends the game behind her head. Stepping
 * off to one side fixes that and is what walking somewhere together looks
 * like anyway.
 *
 * The offset is dropped whenever there is no floor out there, so it never
 * walks her off the side of a plank you crossed down the middle.
 */
function sidestep(world, mark, probe) {
  const a = mark.p, b = mark.next;
  const dx = b.x - a.x, dz = b.z - a.z;
  const l = Math.hypot(dx, dz);
  if (l < 0.05) return a;
  const ox = (-dz / l) * SIDE, oz = (dx / l) * SIDE;
  probe.x = a.x + ox; probe.y = a.y; probe.z = a.z + oz;
  if (!groundUnder(world, probe, 1.6)) return a;
  return { x: probe.x, y: a.y, z: probe.z };
}

export function updatePartner(p, hero, trail, world, dt) {
  const a = p.a;
  const ha = hero.a;
  beginActorFrame(a);
  p.t += dt;
  if (p.hop > 0) p.hop -= dt;

  const far = Math.hypot(ha.x - a.x, ha.z - a.z);

  // Left behind past all recovery — a long fall, or a warp. Put her back
  // beside the player rather than leaving her stranded off-screen forever.
  // The vertical limit is well under the drop off the edge of the world and
  // well over the tallest climb in it, so it catches a fall into the void
  // without firing when she is simply on a lower ledge than you.
  if (far > RESCUE || a.y < ha.y - VOID) replacePartner(p, hero, trail);

  // Where she is heading. Normally a point on the trail; if she has fallen a
  // long way behind, straight at the player instead, because at that distance
  // retracing a two-second-old route just loses more ground.
  let tx, ty, tz;
  const mark = far > LOST ? null : pointBack(trail, FOLLOW);
  if (mark) {
    const at = sidestep(world, mark, p.probe);
    tx = at.x; ty = at.y; tz = at.z;
  } else if (far > LOST) {
    // Hopelessly behind: cut straight to the player.
    tx = ha.x; ty = ha.y; tz = ha.z;
  } else {
    // No trail worth walking — you have barely moved. Stand at your shoulder
    // rather than on top of you.
    tx = ha.x - Math.sin(hero.yaw) * 0.8 - Math.cos(hero.yaw) * SIDE;
    ty = ha.y;
    tz = ha.z - Math.cos(hero.yaw) * 0.8 + Math.sin(hero.yaw) * SIDE;
  }

  const dx = tx - a.x, dz = tz - a.z;
  const dist = Math.hypot(dx, dz);

  // --- run ----------------------------------------------------------------
  // She hurries when behind and eases off as she arrives, so she settles next
  // to you instead of jittering back and forth across the mark.
  const eager = clamp((far - 1.2) / CATCHUP, 0, 1);
  const wantSpeed = dist < 0.35 ? 0 : PHYS.runMax * clamp(dist / 2.2, 0.25, 1) * (0.72 + eager * 0.38);
  const accel = (a.onGround ? PHYS.runAccel : PHYS.airAccel) * dt;
  const drag = (a.onGround ? PHYS.groundDrag : PHYS.airDrag) * dt;

  if (wantSpeed > 0.01 && dist > 0.001) {
    const nx = dx / dist, nz = dz / dist;
    a.vx += nx * accel;
    a.vz += nz * accel;
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > wantSpeed) {
      const k = Math.max(wantSpeed, sp - accel) / sp;
      a.vx *= k; a.vz *= k;
    }
    p.yaw += angleDelta(p.yaw, Math.atan2(nx, nz)) * Math.min(1, 14 * dt);
  } else {
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > 0) {
      const k = Math.max(0, sp - drag) / sp;
      a.vx *= k; a.vz *= k;
    }
    // Standing still, she turns to look at you. It costs nothing and it is
    // the difference between a companion and a piece of luggage.
    if (far > 0.4) p.yaw += angleDelta(p.yaw, Math.atan2(ha.x - a.x, ha.z - a.z)) * Math.min(1, 6 * dt);
  }

  // --- jump ---------------------------------------------------------------
  // She jumps for the same two reasons a player does: the ground she is
  // heading for is above her, or there is nothing under the next step.
  // Only worth jumping for something you still have to travel to. Standing
  // on the mark already and jumping because it is fractionally higher is the
  // same bunny-hop by another route.
  const climbing = ty > a.y + 0.45 && dist > 0.7;
  let gap = false;
  if (a.onGround && dist > 0.5) {
    const ahead = { ...a, x: a.x + (dx / dist) * 0.9, z: a.z + (dz / dist) * 0.9 };
    const under = groundUnder(world, ahead, 2.4);
    gap = !under;
  }
  if (a.onGround && p.hop <= 0 && (climbing || gap)) {
    a.vy = PHYS.jump * (climbing ? clamp(0.6 + (ty - a.y) * 0.24, 0.7, 1) : 0.92);
    a.onGround = false;
    p.squash = -1;
    p.hop = 0.25;
  }

  // --- fall, and the glide ------------------------------------------------
  // She opens the helicopter when she is falling and still has ground to make
  // up — which is what stops her dropping short of every gap you cleared.
  const gliding = !a.onGround && a.vy < -1.4 && p.can.glide
    && (ty > a.y - 3.5) && dist > 1.2;
  if (gliding) {
    a.vy = Math.max(a.vy, -PHYS.glideFall);
    p.rotor += 26 * dt;
  } else {
    a.vy -= PHYS.gravity * dt;
    if (a.vy < -PHYS.terminal) a.vy = -PHYS.terminal;
  }

  moveActor(world, a, dt);

  if (a.justLanded) p.squash = 1;
  p.squash *= Math.pow(0.02, dt);

  if (gliding) p.state = STATE.GLIDE;
  else if (!a.onGround) p.state = a.vy > 0 ? STATE.JUMP : STATE.FALL;
  else if (Math.hypot(a.vx, a.vz) > 0.35) p.state = STATE.RUN;
  else p.state = STATE.STAND;
  if (p.state !== STATE.GLIDE) p.rotor *= Math.pow(0.05, dt);

  const under = groundUnder(world, a, 12);
  p.shadowY = under ? under.maxY : a.y;
  p.shadowScale = under ? clamp(1 - (a.y - under.maxY) / 9, 0.28, 1) : 0;

  updateLimbs(p, dt);
  return p.state;
}
