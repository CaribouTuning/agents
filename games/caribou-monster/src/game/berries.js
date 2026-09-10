// Berries, and the soft soil you put them in.
//
// The Day Care rewards you for walking. Berries reward you for leaving, which
// is a different and stranger thing for a game to ask: you push a berry into
// the ground, close the game, live your life, and the plant carries on without
// you. Three hours later there is something there that was not there before.
//
// Growth is measured against the real clock, not against steps or play time,
// for exactly that reason — and the clock lives in `game/clock.js`, so a test
// (or the debug menu) can say "and then it was tomorrow" in one call.
//
// The co-op part is small and deliberate. If the two of you are linked when a
// berry goes in, the patch remembers who was standing there, and says so when
// you come back for it. You end up with a route full of small notes to each
// other that happen to be edible.
import { getItem, isBerry } from '../data/items.js';
import { now } from './clock.js';

/** The four stages a plant goes through, evenly spaced across its growth. */
export const STAGES = ['planted', 'sprout', 'growing', 'ripe'];

/** Tending a patch between stages is worth one extra berry, once per stage. */
const TEND_BONUS = 1;
/** And planting it together is worth one more, for the whole life of the plant. */
const TOGETHER_BONUS = 1;

export function createPatches() { return {}; }

/** Patches are keyed by where they are, which is the only identity they have. */
export function patchKey(map, x, y) { return `${map}:${x},${y}`; }

export function patchAt(patches, map, x, y) {
  return (patches && patches[patchKey(map, x, y)]) || null;
}

/**
 * Puts a berry in the ground.
 *
 * `witness` is the partner's name if you are linked right now, and null if you
 * are not. It is written once, at planting, and never changes afterwards — a
 * berry planted alone does not become a shared one because somebody logged on
 * while it was growing.
 */
export function plant(patches, map, x, y, berryId, witness = null) {
  if (!isBerry(berryId)) return null;
  const patch = {
    berry: berryId,
    planted: now(),
    tended: 0,          // stages the player has tended, capped at one each
    lastTend: -1,       // the stage index the last tending was done at
    witness: witness || null,
  };
  patches[patchKey(map, x, y)] = patch;
  return patch;
}

/** Milliseconds a plant has been in the ground. Never negative. */
export function ageMs(patch, at = now()) {
  return Math.max(0, at - (patch.planted || 0));
}

/** 0 to 1 across the whole growth, clamped. */
export function progress(patch, at = now()) {
  const spec = getItem(patch.berry).berry;
  const total = spec.hours * 3600 * 1000;
  return Math.max(0, Math.min(1, ageMs(patch, at) / total));
}

/** 0..3 — planted, sprout, growing, ripe. */
export function stageIndex(patch, at = now()) {
  const p = progress(patch, at);
  if (p >= 1) return 3;
  return Math.min(2, Math.floor(p * 3));
}

export function stageOf(patch, at = now()) { return STAGES[stageIndex(patch, at)]; }

export function isRipe(patch, at = now()) { return stageIndex(patch, at) === 3; }

/**
 * How many berries this patch will give back.
 *
 * The base crop is the berry's own; tending it as it grows is worth one each
 * time, and having planted it with somebody is worth one for good. A Lum Berry
 * left alone gives two and takes a day; a Lum Berry the two of you planted and
 * looked in on gives five.
 */
export function cropOf(patch, at = now()) {
  const spec = getItem(patch.berry).berry;
  return spec.crop + patch.tended * TEND_BONUS + (patch.witness ? TOGETHER_BONUS : 0);
}

/**
 * Looking after a plant that is still growing. Worth something once per stage,
 * so standing on it pressing A is not a strategy.
 * Returns true if this actually counted.
 */
export function tend(patch, at = now()) {
  const stage = stageIndex(patch, at);
  if (stage >= 3) return false;
  if (patch.lastTend === stage) return false;
  patch.lastTend = stage;
  patch.tended++;
  return true;
}

/** Takes the crop and clears the soil. Returns { berry, count } or null. */
export function harvest(patches, map, x, y, at = now()) {
  const key = patchKey(map, x, y);
  const patch = patches[key];
  if (!patch || !isRipe(patch, at)) return null;
  const out = { berry: patch.berry, count: cropOf(patch, at), witness: patch.witness };
  delete patches[key];
  return out;
}

export function clearPatch(patches, map, x, y) { delete patches[patchKey(map, x, y)]; }

/**
 * What the patch has to say for itself, in the words the game uses out loud.
 * Kept here rather than in the script so the test can read it too.
 */
export function patchText(patch, at = now()) {
  const item = getItem(patch.berry);
  const stage = stageIndex(patch, at);
  if (stage === 3) return `${item.name}. It is ripe.`;
  const left = hoursLeft(patch, at);
  const when = left < 1 ? 'It will not be long now.' : `Another ${Math.ceil(left)} hour${Math.ceil(left) === 1 ? '' : 's'}, at a guess.`;
  const what = ['A ' + item.name + ' is planted here.', 'A sprout is up.', 'It is nearly a plant.'][stage];
  return `${what} ${when}`;
}

export function hoursLeft(patch, at = now()) {
  const spec = getItem(patch.berry).berry;
  const total = spec.hours * 3600 * 1000;
  return Math.max(0, (total - ageMs(patch, at)) / 3600000);
}

// ---- saving ---------------------------------------------------------------
//
// Patches are the one thing in this game that keeps a wall-clock timestamp in
// the save, which is the whole point of them: the plant grows while the game
// is closed. A patch whose berry no longer exists is dropped rather than
// crashing, the same as everything else that comes back off disk.

export function serializePatches(patches) {
  const out = {};
  for (const [key, p] of Object.entries(patches || {})) {
    out[key] = {
      berry: p.berry, planted: p.planted, tended: p.tended || 0,
      lastTend: p.lastTend ?? -1, witness: p.witness || null,
    };
  }
  return out;
}

export function revivePatches(raw) {
  const out = createPatches();
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, p] of Object.entries(raw)) {
    if (!p || !isBerry(p.berry)) continue;
    if (!/^[^:]+:\d+,\d+$/.test(key)) continue;
    out[key] = {
      berry: p.berry,
      planted: Number(p.planted) || 0,
      tended: Math.max(0, Math.min(3, Number(p.tended) || 0)),
      lastTend: Number.isInteger(p.lastTend) ? p.lastTend : -1,
      witness: typeof p.witness === 'string' ? p.witness : null,
    };
  }
  return out;
}
