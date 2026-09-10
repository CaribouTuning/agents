// Secret Bases.
//
// You cut a room into a wall a hundred feet under Sinnoh, and then you put
// things in it, and then somebody else comes and looks at it. That is the
// whole feature, and it is the most personal thing Gen 4 ever shipped.
//
// Here it is built for exactly two people. There is one other base you will
// ever visit, and one person who will ever visit yours, and both of you know
// whose it is. The note board is the part that matters: a line left in a room
// underground for the other person to find next time they are down there.
import { now } from '../clock.js';

/**
 * What a base can be furnished with, and what each costs in spheres.
 *
 * Spheres are the only currency that buys these, and nothing else buys
 * anything, which keeps the Underground's economy closed: what you dig up
 * down there is spent down there.
 */
export const GOODS = {
  lamp: { name: 'Pit Lamp', cost: 2, w: 1, h: 1, blurb: 'A steady yellow light.' },
  rug: { name: 'Woven Rug', cost: 3, w: 2, h: 1, blurb: 'Warm underfoot.' },
  chair: { name: 'Folding Chair', cost: 2, w: 1, h: 1, blurb: 'For sitting in, in a cave.' },
  table: { name: 'Low Table', cost: 3, w: 2, h: 1, blurb: 'Two mugs fit on it.' },
  plant: { name: 'Cave Fern', cost: 4, w: 1, h: 1, blurb: 'It should not grow down here. It does.' },
  shelf: { name: 'Rock Shelf', cost: 5, w: 2, h: 1, blurb: 'For the things you dug up.' },
  banner: { name: 'Pair Banner', cost: 8, w: 2, h: 1, blurb: 'Two names on one cloth.' },
  hearth: { name: 'Little Hearth', cost: 10, w: 2, h: 1, blurb: 'It is not cold any more.' },
};

export const GOODS_IDS = Object.keys(GOODS);

/** Where a base's room lets you put things. Kept small on purpose. */
export const ROOM = { w: 9, h: 5, maxDecor: 8 };

export function createBase(x, y, owner) {
  return {
    x, y,                      // the wall in the tunnels this room is cut into
    owner: owner || null,      // the trainer's name, for when somebody visits
    dugAt: now(),
    decor: [],                 // [{ id, x, y }]
    note: '',                  // a line left for whoever comes next
    noteBy: null,
    flagTaken: 0,              // how many times the other one has taken the flag
    visits: 0,
  };
}

export function hasBase(ug) { return !!(ug && ug.base); }

/** Moving house. The old room is simply gone, which is how Platinum did it. */
export function digBase(ug, x, y, owner) {
  ug.base = createBase(x, y, owner);
  return ug.base;
}

export function costOf(id) { return (GOODS[id] || {}).cost || 0; }

export function canAfford(spheres, id) { return spheres >= costOf(id); }

/** Somewhere in the room that this piece fits and nothing else is standing. */
export function fits(base, id, x, y) {
  const g = GOODS[id];
  if (!g) return false;
  if (x < 0 || y < 0 || x + g.w > ROOM.w || y + g.h > ROOM.h) return false;
  for (const d of base.decor) {
    const o = GOODS[d.id];
    if (!o) continue;
    if (x < d.x + o.w && x + g.w > d.x && y < d.y + o.h && y + g.h > d.y) return false;
  }
  return true;
}

/** The first free spot, scanning the room the way you would read it. */
export function freeSpot(base, id) {
  for (let y = 0; y < ROOM.h; y++) {
    for (let x = 0; x < ROOM.w; x++) if (fits(base, id, x, y)) return { x, y };
  }
  return null;
}

export function place(base, id, x, y) {
  if (base.decor.length >= ROOM.maxDecor) return false;
  if (!fits(base, id, x, y)) return false;
  base.decor.push({ id, x, y });
  return true;
}

export function removeAt(base, x, y) {
  const i = base.decor.findIndex((d) => {
    const g = GOODS[d.id];
    return g && x >= d.x && x < d.x + g.w && y >= d.y && y < d.y + g.h;
  });
  if (i < 0) return null;
  return base.decor.splice(i, 1)[0];
}

/** A line left on the board. Short, because it is scratched into rock. */
export const NOTE_MAX = 64;

export function leaveNote(base, text, by) {
  base.note = String(text || '').slice(0, NOTE_MAX);
  base.noteBy = by || null;
  return base.note;
}

/**
 * How the room reads to somebody standing in it. Kept here so the test can
 * assert it without a canvas.
 */
export function describe(base) {
  if (!base.decor.length) return 'Bare rock, and room to put things.';
  const names = base.decor.map((d) => GOODS[d.id].name);
  const unique = [...new Set(names)];
  if (unique.length === 1) return `${unique[0]}. Nothing else, yet.`;
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}.`;
}

// ---- what crosses the wire ------------------------------------------------
//
// A base is sent to the partner whole, because it is small and because the
// alternative — patching one across a link — would let the two rooms drift
// apart. Nothing here is trusted: a base that comes off the wire is rebuilt
// field by field, the same as a save.

export function shareable(base, ownerName) {
  if (!base) return null;
  return {
    x: base.x, y: base.y,
    owner: ownerName || base.owner || null,
    decor: base.decor.map((d) => ({ id: d.id, x: d.x, y: d.y })),
    note: base.note || '',
    noteBy: base.noteBy || null,
  };
}

export function acceptShared(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = createBase(Number(raw.x) || 0, Number(raw.y) || 0,
    typeof raw.owner === 'string' ? raw.owner.slice(0, 16) : null);
  base.decor = (Array.isArray(raw.decor) ? raw.decor : [])
    .filter((d) => d && GOODS[d.id])
    .slice(0, ROOM.maxDecor)
    .map((d) => ({ id: d.id, x: Math.max(0, Math.min(ROOM.w - 1, Number(d.x) || 0)),
      y: Math.max(0, Math.min(ROOM.h - 1, Number(d.y) || 0)) }));
  base.note = typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '';
  base.noteBy = typeof raw.noteBy === 'string' ? raw.noteBy.slice(0, 16) : null;
  return base;
}

// ---- saving ---------------------------------------------------------------

export function serializeBase(base) {
  if (!base) return null;
  return {
    x: base.x, y: base.y, owner: base.owner, dugAt: base.dugAt,
    decor: base.decor.map((d) => ({ ...d })),
    note: base.note, noteBy: base.noteBy,
    flagTaken: base.flagTaken || 0, visits: base.visits || 0,
  };
}

export function reviveBase(raw) {
  const base = acceptShared(raw);
  if (!base) return null;
  base.dugAt = Number(raw.dugAt) || now();
  base.flagTaken = Math.max(0, Number(raw.flagTaken) || 0);
  base.visits = Math.max(0, Number(raw.visits) || 0);
  return base;
}
