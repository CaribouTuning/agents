// Moving through a solid world, in three dimensions.
//
// Same lesson as the flat version, one axis wider: resolve each axis against
// the world separately, and never take a step longer than the smallest thing
// you could pass through. What changed is the shape of the world — there is
// no grid to look up any more, so collision is against a list of boxes, and
// the list is kept in a coarse spatial grid so a world with a few thousand of
// them still costs nothing to walk around in.

export const PHYS = {
  // Everything is in world units per second. One unit is about a stride, and
  // the hero is about 1.2 units tall.
  runAccel: 46,
  runMax: 6.6,
  groundDrag: 30,
  airAccel: 26,
  airDrag: 1.6,

  gravity: 23.5,
  terminal: 26,

  jump: 8.4,
  jumpCut: 0.42,

  coyote: 0.12,      // seconds
  buffer: 0.15,

  // The helicopter. Slow enough to cross a real gap, fast enough that height
  // still means something.
  glideFall: 2.1,
  glideEase: 34,
  glideSteer: 1.5,
};

/** An axis-aligned box in the world. Everything solid is one of these. */
export function solid(x, y, z, hx, hy, hz, tag = null) {
  return { x, y, z, hx, hy, hz, tag,
    minX: x - hx, maxX: x + hx,
    minY: y - hy, maxY: y + hy,
    minZ: z - hz, maxZ: z + hz };
}

/**
 * A broad-phase grid over the XZ plane.
 *
 * Without it every step tests every box in the level, which is fine for a
 * test field and quietly quadratic by the time there is a world. Cells are
 * deliberately large: the cost of testing a few extra boxes is nothing next
 * to the cost of a body slipping between two cells.
 */
export class Collision {
  constructor(cell = 8) {
    this.cell = cell;
    this.grid = new Map();
    this.all = [];
  }

  add(s) {
    this.all.push(s);
    const c = this.cell;
    const x0 = Math.floor(s.minX / c), x1 = Math.floor(s.maxX / c);
    const z0 = Math.floor(s.minZ / c), z1 = Math.floor(s.maxZ / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const k = `${x},${z}`;
        let list = this.grid.get(k);
        if (!list) { list = []; this.grid.set(k, list); }
        list.push(s);
      }
    }
    return s;
  }

  /** Everything that could touch this box. May contain duplicates. */
  near(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const list = this.grid.get(`${x},${z}`);
        if (!list) continue;
        for (const s of list) if (!out.includes(s)) out.push(s);
      }
    }
    return out;
  }
}

export function makeActor(x, y, z, radius = 0.32, height = 1.2) {
  return {
    x, y, z,                 // y is the FEET, not the centre
    vx: 0, vy: 0, vz: 0,
    r: radius,
    h: height,
    onGround: false,
    wasOnGround: false,
    justLanded: false,
    justLeftGround: false,
    hitCeiling: false,
    hitWall: false,
    groundTag: null,
  };
}

export function beginActorFrame(a) {
  a.wasOnGround = a.onGround;
  a.justLanded = false;
  a.justLeftGround = false;
  a.hitCeiling = false;
  a.hitWall = false;
}

const scratch = [];

function overlaps(a, s) {
  return a.x + a.r > s.minX && a.x - a.r < s.maxX
    && a.y + a.h > s.minY && a.y < s.maxY
    && a.z + a.r > s.minZ && a.z - a.r < s.maxZ;
}

/**
 * Advance the actor, resolving against the world.
 *
 * The vertical axis is resolved LAST on purpose. Resolving it first means a
 * body walking up to a step gets pushed up onto it before the horizontal move
 * is considered, which turns every wall into a ramp.
 */
export function moveActor(world, a, dt) {
  const steps = Math.max(1, Math.ceil(
    Math.max(Math.abs(a.vx), Math.abs(a.vy), Math.abs(a.vz)) * dt / (a.r * 0.8)));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    sweep(world, a, a.vx * sdt, 'x');
    sweep(world, a, a.vz * sdt, 'z');
    sweep(world, a, a.vy * sdt, 'y');
  }
  if (a.onGround && !a.wasOnGround) a.justLanded = true;
  if (!a.onGround && a.wasOnGround) a.justLeftGround = true;
}

function sweep(world, a, d, axis) {
  if (d === 0) return;
  if (axis === 'x') a.x += d; else if (axis === 'z') a.z += d; else a.y += d;

  const list = world.near(a.x - a.r, a.z - a.r, a.x + a.r, a.z + a.r, scratch);
  for (const s of list) {
    if (!overlaps(a, s)) continue;
    if (axis === 'x') {
      a.x = d > 0 ? s.minX - a.r : s.maxX + a.r;
      a.vx = 0;
      a.hitWall = true;
    } else if (axis === 'z') {
      a.z = d > 0 ? s.minZ - a.r : s.maxZ + a.r;
      a.vz = 0;
      a.hitWall = true;
    } else if (d > 0) {
      a.y = s.minY - a.h;
      a.vy = 0;
      a.hitCeiling = true;
    } else {
      a.y = s.maxY;
      a.vy = 0;
      a.onGround = true;
      a.groundTag = s.tag;
    }
  }
  // Falling with nothing hit means there is no longer anything underfoot.
  if (axis === 'y' && d < 0 && !a.hitCeiling) {
    let found = false;
    for (const s of list) {
      if (Math.abs(a.y - s.maxY) > 0.001) continue;
      if (a.x + a.r <= s.minX || a.x - a.r >= s.maxX) continue;
      if (a.z + a.r <= s.minZ || a.z - a.r >= s.maxZ) continue;
      found = true; break;
    }
    if (!found) a.onGround = false;
  }
}

/** Is there floor within `reach` below the actor? Used for ledge cues. */
export function groundUnder(world, a, reach = 0.25) {
  const list = world.near(a.x - a.r, a.z - a.r, a.x + a.r, a.z + a.r, scratch);
  for (const s of list) {
    if (s.maxY > a.y + 0.01 || s.maxY < a.y - reach) continue;
    if (a.x + a.r <= s.minX || a.x - a.r >= s.maxX) continue;
    if (a.z + a.r <= s.minZ || a.z - a.r >= s.maxZ) continue;
    return s;
  }
  return null;
}
