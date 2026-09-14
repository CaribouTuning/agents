// What each character in a level means.
//
// Levels are ASCII grids, same as the RPG next door, and for the same reason:
// a level you can read in a pull request is a level you can fix. What changed
// is that solidity is now a property consulted by a collision routine sixty
// times a second rather than a yes/no on stepping into a square.

/**
 * The legend.
 *
 *   solid    stops a body from every direction
 *   oneWay   stops a body falling onto its top, and nothing else
 *   climb    a surface the hands can go up
 *   hurt     costs a heart on contact
 *   water    swimmable; gravity is replaced by drift
 *   back     drawn behind the hero, never collided with
 */
export const TILES = {
  ' ': { name: 'air' },
  '.': { name: 'air' },

  // --- ground ---
  '#': { name: 'earth', solid: true, art: 'earth' },
  '=': { name: 'turf', solid: true, art: 'turf' },
  '_': { name: 'branch', oneWay: true, art: 'branch' },
  'T': { name: 'trunk', solid: true, art: 'trunk' },
  'S': { name: 'stone', solid: true, art: 'stone' },
  'R': { name: 'ruin', solid: true, art: 'ruin' },

  // --- surfaces with a rule ---
  'V': { name: 'vine', climb: true, art: 'vine' },
  '^': { name: 'thorns', hurt: true, art: 'thorns' },
  '~': { name: 'water', water: true, art: 'water' },

  // --- scenery, never collided with ---
  'f': { name: 'fern', back: true, art: 'fern' },
  'm': { name: 'mushroom', back: true, art: 'mushroom' },
  'l': { name: 'leaves', back: true, art: 'leaves' },
  'p': { name: 'petals', back: true, art: 'petals' },

  // --- things the game places rather than draws ---
  'o': { name: 'lum', pickup: 'lum' },
  'c': { name: 'cage', pickup: 'cage' },
  '@': { name: 'spawn', spawn: true },
  '>': { name: 'exit', exit: true },
};

/** The character at a tile, or a space when outside the level. */
export function tileAt(level, tx, ty) {
  if (ty < 0 || ty >= level.height || tx < 0 || tx >= level.width) return ' ';
  return level.rows[ty][tx];
}

/**
 * Outside the level is solid at the sides and the bottom, and open at the
 * top. A world with open sides is a world you can walk out of, and a world
 * with a lid is a world where a big jump feels like hitting a ceiling.
 */
export function solidAt(level, tx, ty) {
  if (tx < 0 || tx >= level.width) return true;
  if (ty >= level.height) return true;
  if (ty < 0) return false;
  const def = TILES[level.rows[ty][tx]];
  return !!(def && def.solid);
}

export function oneWayAt(level, tx, ty) {
  const def = TILES[tileAt(level, tx, ty)];
  return !!(def && def.oneWay);
}

export function climbAt(level, tx, ty) {
  const def = TILES[tileAt(level, tx, ty)];
  return !!(def && def.climb);
}

export function hurtAt(level, tx, ty) {
  const def = TILES[tileAt(level, tx, ty)];
  return !!(def && def.hurt);
}

export function waterAt(level, tx, ty) {
  const def = TILES[tileAt(level, tx, ty)];
  return !!(def && def.water);
}

/** Every character a level may legally contain. */
export const LEGAL = new Set(Object.keys(TILES));
