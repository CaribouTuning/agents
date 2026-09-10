// The digging minigame.
//
// Platinum's Underground is the one thing in the series that was designed for
// a touch screen and has never worked properly anywhere else: you tap a wall
// of rock with a hammer or a pick, the rock comes away in layers, and what is
// buried under it comes out whole or not at all. This game is played on a
// phone, so it is the one Gen 4 feature that fits here better than it fitted
// the DS.
//
// This module is the whole game and none of the drawing. It takes a seeded
// RNG, so a dig can be replayed exactly — which is what lets two people dig
// the same wall over a link and both see the same fossil.

/** Rock depth at a cell: 3 is untouched, 0 is bare floor. */
export const MAX_DEPTH = 3;

/** Strikes the wall will take before it comes down. */
export const MAX_STRIKES = 12;

/**
 * The two tools, and the damage each does around the cell you hit.
 *
 * The hammer clears ground fast and burns the wall down with it; the pick is
 * slow and precise. Choosing between them *is* the game — a fossil under six
 * cells is not coming out on hammer alone.
 */
export const TOOLS = {
  hammer: {
    name: 'Hammer',
    cost: 2,
    // [dx, dy, damage]
    pattern: [
      [0, 0, 2], [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
      [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
    ],
  },
  pick: {
    name: 'Pick',
    cost: 1,
    pattern: [[0, 0, 2], [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1]],
  },
};

/**
 * Buried things, and the shape each one takes up.
 *
 * Shape is a list of cells relative to the top-left of the item's box. A big
 * awkward shape is worth more precisely because getting all of it out before
 * the roof comes in is harder.
 */
export const SHAPES = {
  small: [[0, 0], [1, 0], [0, 1], [1, 1]],
  bar: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  tee: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
  ell: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  big: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
};

export function shapeBox(shape) {
  const cells = SHAPES[shape] || SHAPES.small;
  return {
    w: Math.max(...cells.map((c) => c[0])) + 1,
    h: Math.max(...cells.map((c) => c[1])) + 1,
    cells,
  };
}

/**
 * Lays out one wall.
 *
 * `loot` is a list of `{ item, shape, weight }` — the caller owns what can be
 * found where, so a wall deep in the tunnels can hold things a wall near the
 * entrance cannot.
 */
export function createDig(loot, rng = Math.random, opts = {}) {
  const w = opts.width || 11;
  const h = opts.height || 7;
  const dig = {
    w, h,
    depth: [],
    items: [],
    strikes: 0,
    maxStrikes: opts.maxStrikes || MAX_STRIKES,
    collapsed: false,
    tool: 'hammer',
  };
  // The rock is not flat: a wall of uniform depth would make every strike
  // worth the same, and there would be nothing to read in it. It never starts
  // at one layer, though — a wall that already looks half-cleared reads as a
  // wall somebody else has been at.
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) row.push(MAX_DEPTH - Math.floor(rng() * (MAX_DEPTH - 1)));
    dig.depth.push(row);
  }

  const count = opts.count || (2 + Math.floor(rng() * 3));
  for (let i = 0; i < count && loot.length; i++) {
    const pick = weighted(loot, rng);
    const box = shapeBox(pick.shape);
    const placed = place(dig, box, rng);
    if (!placed) continue;
    dig.items.push({
      item: pick.item, shape: pick.shape,
      x: placed.x, y: placed.y, found: false,
    });
  }
  return dig;
}

function weighted(list, rng) {
  const total = list.reduce((n, e) => n + (e.weight || 1), 0);
  let r = rng() * total;
  for (const e of list) { r -= e.weight || 1; if (r <= 0) return e; }
  return list[list.length - 1];
}

/** Finds somewhere the shape fits without overlapping another buried thing. */
function place(dig, box, rng) {
  for (let tries = 0; tries < 40; tries++) {
    const x = Math.floor(rng() * (dig.w - box.w + 1));
    const y = Math.floor(rng() * (dig.h - box.h + 1));
    const cells = box.cells.map(([dx, dy]) => `${x + dx},${y + dy}`);
    const clash = dig.items.some((it) => {
      const b = shapeBox(it.shape);
      return b.cells.some(([dx, dy]) => cells.includes(`${it.x + dx},${it.y + dy}`));
    });
    if (!clash) return { x, y };
  }
  return null;
}

export function depthAt(dig, x, y) {
  if (x < 0 || y < 0 || x >= dig.w || y >= dig.h) return null;
  return dig.depth[y][x];
}

/** Which buried thing, if any, lies under this cell. */
export function itemAt(dig, x, y) {
  for (const it of dig.items) {
    const box = shapeBox(it.shape);
    if (box.cells.some(([dx, dy]) => it.x + dx === x && it.y + dy === y)) return it;
  }
  return null;
}

/** True once every cell of the thing is down to bare floor. */
export function isExposed(dig, it) {
  const box = shapeBox(it.shape);
  return box.cells.every(([dx, dy]) => depthAt(dig, it.x + dx, it.y + dy) === 0);
}

/**
 * One swing.
 *
 * Returns what happened, so the screen can play it: which cells moved, what
 * came out of the wall, and whether that was the last swing this roof had in
 * it. Striking a cell already at bare floor is refused rather than charged —
 * an accidental tap should not cost you a fossil.
 */
export function strike(dig, x, y, tool = dig.tool) {
  const out = { ok: false, cells: [], found: [], collapsed: false, wasted: false };
  if (dig.collapsed) return out;
  const spec = TOOLS[tool] || TOOLS.hammer;
  if (depthAt(dig, x, y) === null) return out;
  if (depthAt(dig, x, y) === 0) { out.wasted = true; return out; }

  out.ok = true;
  for (const [dx, dy, dmg] of spec.pattern) {
    const cx = x + dx, cy = y + dy;
    const d = depthAt(dig, cx, cy);
    if (d === null || d === 0) continue;
    dig.depth[cy][cx] = Math.max(0, d - dmg);
    out.cells.push({ x: cx, y: cy, depth: dig.depth[cy][cx] });
  }

  for (const it of dig.items) {
    if (it.found || !isExposed(dig, it)) continue;
    it.found = true;
    out.found.push(it);
  }

  dig.strikes += spec.cost;
  if (dig.strikes >= dig.maxStrikes) {
    dig.collapsed = true;
    out.collapsed = true;
  }
  return out;
}

/** 0..1 — how close the roof is to coming in. */
export function stability(dig) {
  return Math.max(0, 1 - dig.strikes / dig.maxStrikes);
}

export function found(dig) { return dig.items.filter((i) => i.found); }
export function missed(dig) { return dig.items.filter((i) => !i.found); }

/** True once there is nothing left worth swinging at. */
export function isDone(dig) {
  return dig.collapsed || dig.items.every((i) => i.found);
}
