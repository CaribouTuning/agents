// The Underground as a place you keep coming back to.
//
// The dig minigame is stateless — you give it loot and a seed and it gives you
// a wall. This is everything that has to persist: where you climbed down from,
// which walls you have already emptied, and how long ago.
//
// Walls come back. A tunnel where every seam is gone forever is a tunnel
// nobody visits twice, and this game is meant to be visited on a Tuesday
// evening for ten minutes. The timer is the world clock, the same one the
// berries grow on.
import { now } from '../clock.js';
import { serializeBase, reviveBase } from './base.js';

/** How long a seam takes to be worth digging again. */
export const REFRESH_HOURS = 3;

export function createUnderground() {
  return {
    unlocked: false,        // the Explorer Kit has been used at least once
    returnTo: null,         // { map, x, y, dir } — where you climbed down
    walls: {},              // "x,y" -> the ms at which it was last emptied
    digs: 0,                // how many walls you have worked, for the card
    finds: 0,               // and how many things came out of them
    base: null,             // your Secret Base, once you have cut one
    partnerBase: null,      // theirs, as last sent over the link
    flagsTaken: 0,          // how many times you have taken theirs
    visiting: false,        // true while you are standing in theirs, not yours
  };
}

export function wallKey(x, y) { return `${x},${y}`; }

/** Milliseconds until this seam is worth digging again; 0 if it is ready. */
export function coolingFor(ug, x, y, at = now()) {
  const last = ug.walls[wallKey(x, y)];
  if (!last) return 0;
  const ready = last + REFRESH_HOURS * 3600 * 1000;
  return Math.max(0, ready - at);
}

export function isReady(ug, x, y, at = now()) { return coolingFor(ug, x, y, at) === 0; }

export function markDug(ug, x, y, finds = 0, at = now()) {
  ug.walls[wallKey(x, y)] = at;
  ug.digs++;
  ug.finds += finds;
}

/** What the wall says when you press A on one that is not ready yet. */
export function coolingText(ms) {
  const hours = ms / 3600000;
  if (hours >= 1) return `This seam is worked out. Give it ${Math.ceil(hours)} hour${Math.ceil(hours) === 1 ? '' : 's'}.`;
  const mins = Math.max(1, Math.ceil(ms / 60000));
  return `This seam is worked out. Another ${mins} minute${mins === 1 ? '' : 's'} and there will be more.`;
}

/**
 * A seed for one wall.
 *
 * Derived from where the wall is and which time slot it is in, so two people
 * standing at the same seam in the same hour dig the same rock — and so the
 * same seam is a different wall tomorrow.
 */
export function seedFor(x, y, at = now()) {
  const slot = Math.floor(at / (REFRESH_HOURS * 3600 * 1000));
  let n = (x * 73856093) ^ (y * 19349663) ^ (slot * 83492791);
  n = Math.abs(n | 0) || 1;
  return n;
}

// ---- saving ---------------------------------------------------------------

export function serializeUnderground(ug) {
  if (!ug) return null;
  return {
    unlocked: !!ug.unlocked,
    returnTo: ug.returnTo ? { ...ug.returnTo } : null,
    walls: { ...ug.walls },
    digs: ug.digs || 0,
    finds: ug.finds || 0,
    base: serializeBase(ug.base),
    flagsTaken: ug.flagsTaken || 0,
  };
}

export function reviveUnderground(raw) {
  const ug = createUnderground();
  if (!raw || typeof raw !== 'object') return ug;
  ug.unlocked = !!raw.unlocked;
  if (raw.returnTo && typeof raw.returnTo.map === 'string') {
    ug.returnTo = {
      map: raw.returnTo.map,
      x: Number(raw.returnTo.x) || 0,
      y: Number(raw.returnTo.y) || 0,
      dir: raw.returnTo.dir || 'down',
    };
  }
  for (const [k, v] of Object.entries(raw.walls || {})) {
    if (!/^\d+,\d+$/.test(k)) continue;
    const t = Number(v);
    if (Number.isFinite(t) && t > 0) ug.walls[k] = t;
  }
  ug.digs = Math.max(0, Number(raw.digs) || 0);
  ug.finds = Math.max(0, Number(raw.finds) || 0);
  ug.base = reviveBase(raw.base);
  ug.flagsTaken = Math.max(0, Number(raw.flagsTaken) || 0);
  // A partner's base is never saved: it is theirs, and it arrives fresh over
  // the link or not at all.
  return ug;
}
