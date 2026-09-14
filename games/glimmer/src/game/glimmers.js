// The things you are out here for.
//
// A collectible in an exploration game is not a score. It is a sentence in the
// only language the level designer can speak while you are playing: a curve of
// them hanging over a gap says "this is a jump, it will work, go"; a single one
// out over nothing says "there is something out there you cannot reach yet".
// You follow them before you have decided to, which is the whole feeling this
// game is chasing.
//
// So the placement helpers here are the important part of this file. Arcs
// trace the exact parabola a jump makes, rings mark a thing worth walking
// round, and a line draws a path. None of them are decoration.

const REACH = 1.05;      // how close you have to be to take one
const BOB = 0.16;

export function makeSet() {
  return { items: [], got: 0, chain: 0, chainT: 0, lastY: 0 };
}

function add(set, x, y, z) {
  set.items.push({
    x, y, z,
    got: false,
    pop: 0,
    // Each one bobs on its own clock, so a row of them ripples instead of
    // pulsing in unison like a row of warning lights.
    phase: (x * 1.7 + z * 2.3 + y * 0.9) % 6.283,
  });
  return set;
}

/** A straight run of them, for a path you want walked. */
export function line(set, x0, y0, z0, x1, y1, z1, n) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    add(set, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t);
  }
  return set;
}

/**
 * The shape a jump makes.
 *
 * `lift` is how high above the straight line the middle rides. Hang these on
 * the real trajectory and a player reads the whole jump before taking it —
 * which is the difference between a leap of faith and a leap.
 */
export function arc(set, x0, y0, z0, x1, y1, z1, lift, n) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const h = 4 * lift * t * (1 - t);      // a parabola, zero at both ends
    add(set, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + h, z0 + (z1 - z0) * t);
  }
  return set;
}

/** A ring, for something worth circling — a stone, a tree, a lookout. */
export function ring(set, cx, cy, cz, r, n) {
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    add(set, cx + Math.cos(th) * r, cy, cz + Math.sin(th) * r);
  }
  return set;
}

/** One on its own. Used sparingly: a lone one reads as a promise. */
export function single(set, x, y, z) { return add(set, x, y, z); }

/**
 * Collecting.
 *
 * Both of you pick them up. She is not carrying a second score — there is one
 * count between you, because the premise of this game is that you are doing
 * this together, and a partner who walks through the things you are collecting
 * without taking them is a partner who is not really there.
 */
export function updateGlimmers(set, chars, dt, onGot) {
  set.chainT = Math.max(0, set.chainT - dt);
  if (set.chainT <= 0) set.chain = 0;

  for (const g of set.items) {
    g.phase += dt * 2.1;
    if (g.got) {
      if (g.pop > 0) g.pop = Math.max(0, g.pop - dt * 2.6);
      continue;
    }
    for (const c of chars) {
      const a = c.a;
      const dx = a.x - g.x;
      const dy = (a.y + 0.72) - g.y;      // the middle of them, not their feet
      const dz = a.z - g.z;
      if (dx * dx + dy * dy + dz * dz > REACH * REACH) continue;
      g.got = true;
      g.pop = 1;
      set.got++;
      set.chain++;
      set.chainT = 1.1;
      if (onGot) onGot(g, c, set.chain);
      break;
    }
  }
}

export function remaining(set) { return set.items.length - set.got; }

/** Where one is drawn this frame: bobbing, spinning, and popping when taken. */
export function glimmerPose(g, t) {
  const bob = Math.sin(g.phase) * BOB;
  if (!g.got) {
    return { x: g.x, y: g.y + bob, z: g.z, yaw: t * 1.7 + g.phase, scale: 1, alpha: 1 };
  }
  // Taken: it swells and fades on the spot, so the eye gets told it worked
  // even when the pickup happened behind the character.
  const k = 1 - g.pop;
  return {
    x: g.x, y: g.y + bob + k * 0.7, z: g.z,
    yaw: t * 5.5 + g.phase, scale: 1 + k * 1.6, alpha: g.pop * 0.85,
  };
}
