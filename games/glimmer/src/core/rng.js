// Deterministic, seedable PRNG (mulberry32). Used for encounters, damage
// rolls, catch checks — anything that a networked peer may need to replay.
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  const rng = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.range = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.seed = () => a >>> 0;
  return rng;
}

// Global gameplay RNG. Battles that are networked get their own seeded
// instance so both clients roll identically (see battle/engine.js).
export const rng = makeRng((Math.random() * 0xffffffff) >>> 0);

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

// Weighted pick: entries are [value, weight].
export function weightedPick(entries, r) {
  let total = 0;
  for (const e of entries) total += e[1];
  let roll = r() * total;
  for (const e of entries) {
    roll -= e[1];
    if (roll <= 0) return e[0];
  }
  return entries[entries.length - 1][0];
}
