// Save migrations.
//
// A save is a promise: whatever we change in here, the game somebody was
// halfway through still has to open. Every migration is a pure function from
// one version's payload to the next, so they compose and each one can be
// tested on its own.

// v1 -> v2. Before the real Pokedex landed, this game had a hand-written
// roster of 54 monsters numbered 1..54. Those numbers are now national dex
// numbers belonging to entirely different Pokemon, so a v1 save left alone
// would either lose its whole party (unknown species are dropped) or, worse,
// quietly turn a Turtwig into a Bulbasaur. This is the exact table the roster
// was remapped through, by name.
const V1_TO_NATIONAL = {
  1: 387, 2: 388, 3: 389, 4: 390, 5: 391, 6: 392, 7: 393, 8: 394, 9: 395,
  10: 396, 11: 397, 12: 398, 13: 399, 14: 400, 15: 403, 16: 404, 17: 405, 18: 401,
  19: 402, 20: 406, 21: 315, 22: 427, 23: 428, 24: 41, 25: 42, 26: 74, 27: 75,
  28: 95, 29: 66, 30: 67, 31: 77, 32: 54, 33: 55, 34: 63, 35: 64, 36: 417,
  37: 483, 38: 265, 39: 266, 40: 267, 41: 415, 42: 420, 43: 421, 44: 422, 45: 423,
  46: 436, 47: 437, 48: 129, 49: 130, 50: 433, 51: 438, 52: 185, 53: 447, 54: 448,
};

function remapSpecies(id) {
  const n = Number(id);
  return V1_TO_NATIONAL[n] !== undefined ? V1_TO_NATIONAL[n] : n;
}

function remapMon(mon) {
  if (!mon || mon.species === undefined) return mon;
  return { ...mon, species: remapSpecies(mon.species) };
}

function remapDexSide(side) {
  const out = {};
  for (const key of Object.keys(side || {})) out[remapSpecies(key)] = side[key];
  return out;
}

export function migrateV1toV2(state) {
  if (!state) return state;
  const next = { ...state };
  next.party = (state.party || []).map(remapMon);
  next.boxes = (state.boxes || []).map((b) => ({ ...b, mons: (b.mons || []).map(remapMon) }));
  next.dex = {
    seen: remapDexSide(state.dex && state.dex.seen),
    caught: remapDexSide(state.dex && state.dex.caught),
  };
  if (state.starterBase != null) next.starterBase = remapSpecies(state.starterBase);
  return next;
}

// Ordered. `migrate` applies every step from the payload's version up to
// SAVE_VERSION, so a save can skip as many releases as it likes.
export const MIGRATIONS = [
  { from: 1, to: 2, apply: migrateV1toV2 },
];
