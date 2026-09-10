// The Day Care.
//
// You leave two Pokémon with somebody, walk a long way, and come back to find
// they have grown and there is an Egg. It is the slowest system in a Pokémon
// game and the only one that rewards you for going away, which is exactly why
// it belongs in a game two people play a bit at a time.
//
// The co-op part is the point of it here. When the two of you are linked at
// the moment you hand a Pokémon over, the Egg is stamped with both names, and
// whatever hatches carries them for the rest of its life.
import { createMonster, maxHp, displayName, healFully } from './monster.js';
import { getSpecies } from '../data/species.js';
import { expForLevel } from '../data/species.js';

/** Steps between rolls for an Egg, and the odds at each roll. */
const EGG_CHECK_STEPS = 128;
const EGG_ODDS = { same: 0.55, related: 0.35, distant: 0.15 };

/** Nothing in these groups ever produces an Egg. */
const NO_EGGS = 'no-eggs';

export function createDaycare() {
  return {
    mons: [],            // 0, 1 or 2 boarded Pokémon
    depositLevels: [],   // the level each went in at, so the fee is honest
    steps: 0,            // steps walked since the last Egg check
    egg: null,           // { species, steps, needed, parents, witness }
    witness: null,       // who else was online when the pair was made
    collected: 0,        // Eggs taken home, for the trainer card
  };
}

export function serializeDaycare(d) {
  if (!d) return null;
  return {
    mons: (d.mons || []).map((m) => ({ ...m, ivs: { ...m.ivs }, evs: { ...m.evs }, moves: m.moves.map((x) => ({ ...x })) })),
    depositLevels: [...(d.depositLevels || [])],
    steps: d.steps || 0,
    egg: d.egg ? { ...d.egg, parents: [...(d.egg.parents || [])] } : null,
    witness: d.witness || null,
    collected: d.collected || 0,
  };
}

export function reviveDaycare(raw, reviveMon) {
  const d = createDaycare();
  if (!raw || typeof raw !== 'object') return d;
  d.mons = (raw.mons || []).map(reviveMon).filter(Boolean).slice(0, 2);
  d.depositLevels = (raw.depositLevels || []).slice(0, 2);
  d.steps = Number(raw.steps) || 0;
  d.witness = raw.witness || null;
  d.collected = Number(raw.collected) || 0;
  if (raw.egg && getSpecies(raw.egg.species)) {
    d.egg = {
      species: raw.egg.species,
      steps: Number(raw.egg.steps) || 0,
      needed: Number(raw.egg.needed) || getSpecies(raw.egg.species).hatchSteps,
      parents: [...(raw.egg.parents || [])],
      witness: raw.egg.witness || null,
    };
  }
  return d;
}

// ---- compatibility ---------------------------------------------------------

/**
 * How well two Pokémon get on, or null if they cannot breed at all.
 *
 * The series' own rules, minus the ones this game has no machinery for: they
 * need a shared egg group, opposite genders, and neither may be in the group
 * that never produces Eggs. Genderless Pokémon and legendaries simply do not.
 */
export function compatibility(a, b) {
  if (!a || !b) return null;
  const sa = getSpecies(a.species);
  const sb = getSpecies(b.species);
  if (!sa || !sb) return null;
  if (sa.eggGroups.includes(NO_EGGS) || sb.eggGroups.includes(NO_EGGS)) return null;
  if (a.gender === 'N' || b.gender === 'N') return null;
  if (a.gender === b.gender) return null;
  const shared = sa.eggGroups.some((g) => sb.eggGroups.includes(g));
  if (!shared) return null;
  if (sa.baby === sb.baby) return 'same';
  return sa.eggGroups.filter((g) => sb.eggGroups.includes(g)).length > 1 ? 'related' : 'distant';
}

export function compatibilityText(a, b) {
  const c = compatibility(a, b);
  if (!a || !b) return 'There is only one here. Bring it a friend.';
  if (!c) return 'The two of them prefer to play with other Pokémon.';
  if (c === 'same') return 'The two of them get along very well!';
  if (c === 'related') return 'The two of them get along.';
  return 'The two of them do not seem to like each other much.';
}

// ---- boarding --------------------------------------------------------------

export function canDeposit(d) { return d.mons.length < 2; }

export function deposit(d, mon, witness = null) {
  if (!canDeposit(d)) return false;
  d.mons.push(mon);
  d.depositLevels.push(mon.level);
  d.steps = 0;
  // Who else was online when the pair was made. Recorded on the second one,
  // because that is the moment the pair exists.
  if (d.mons.length === 2) d.witness = witness || null;
  return true;
}

/** What it costs to take one back: a flat fee plus a hundred per level gained. */
export function feeFor(d, index) {
  const mon = d.mons[index];
  if (!mon) return 0;
  const gained = Math.max(0, mon.level - (d.depositLevels[index] ?? mon.level));
  return 100 + gained * 100;
}

export function withdraw(d, index) {
  const mon = d.mons[index];
  if (!mon) return null;
  d.mons.splice(index, 1);
  d.depositLevels.splice(index, 1);
  if (d.mons.length < 2) d.witness = null;
  healFully(mon);
  return mon;
}

// ---- walking ---------------------------------------------------------------

/**
 * One step of the world, for the pair and for any Egg being carried.
 *
 * `rng` is passed in rather than reached for, so a test can make the same walk
 * twice and get the same answer.
 */
export function walk(d, party, steps = 1, rng = Math.random) {
  const out = { levelled: [], eggFound: false, hatched: null };

  // Boarders grow while they are away. Slowly — one level per 256 steps —
  // because the Day Care is meant to be somewhere you leave something, not a
  // faster way to train it.
  for (const mon of d.mons) {
    if (mon.level >= 100) continue;
    mon.daycareSteps = (mon.daycareSteps || 0) + steps;
    while (mon.daycareSteps >= 256 && mon.level < 100) {
      mon.daycareSteps -= 256;
      mon.level++;
      mon.exp = expForLevel(getSpecies(mon.species).growth, mon.level);
      mon.hp = maxHp(mon);
      out.levelled.push(displayName(mon));
    }
  }

  // An Egg, if the pair get on and there is not one waiting already.
  if (!d.egg && d.mons.length === 2) {
    const c = compatibility(d.mons[0], d.mons[1]);
    if (c) {
      d.steps += steps;
      while (d.steps >= EGG_CHECK_STEPS) {
        d.steps -= EGG_CHECK_STEPS;
        if (rng() < EGG_ODDS[c]) {
          d.egg = makeEgg(d);
          out.eggFound = true;
          break;
        }
      }
    }
  }

  // An Egg in the party hatches by being carried.
  const egg = party.find((m) => m && m.isEgg);
  if (egg) {
    egg.eggSteps = (egg.eggSteps || 0) + steps;
    if (egg.eggSteps >= egg.eggNeeded) out.hatched = egg;
  }
  return out;
}

/**
 * The Egg the pair produced. The baby is the bottom of the mother's line —
 * or of whichever parent is female, which is the same rule stated the way the
 * games state it.
 */
function makeEgg(d) {
  const mother = d.mons.find((m) => m.gender === 'F') || d.mons[0];
  const sp = getSpecies(mother.species);
  return {
    species: sp.baby,
    steps: 0,
    needed: getSpecies(sp.baby).hatchSteps,
    parents: d.mons.map((m) => displayName(m)),
    witness: d.witness || null,
  };
}

export function hasEgg(d) { return !!d.egg; }

/**
 * Takes the waiting Egg home as a party member.
 *
 * An Egg is an ordinary Pokémon with `isEgg` set: it has its species, its
 * stats and its moves already, it just cannot be sent into a battle and shows
 * as "Egg" everywhere until it hatches. Keeping it a real monster means the
 * party, the boxes, the save and the wire all handle it without knowing.
 */
export function collectEgg(d, trainer) {
  if (!d.egg) return null;
  const mon = createMonster(d.egg.species, 1, {
    friendship: 120,
    ot: trainer.name,
    otId: trainer.id,
    caughtAt: 'daycare',
  });
  mon.isEgg = true;
  mon.eggSteps = 0;
  mon.eggNeeded = d.egg.needed;
  mon.eggParents = d.egg.parents;
  // The name on the Egg. Two people who were both online when the pair was
  // made both own whatever comes out of it.
  mon.coParent = d.egg.witness || null;
  d.egg = null;
  d.collected++;
  return mon;
}

/** Turns a carried Egg into the Pokémon inside it. */
export function hatch(mon) {
  if (!mon || !mon.isEgg) return null;
  mon.isEgg = false;
  mon.eggSteps = 0;
  mon.friendship = 120;
  healFully(mon);
  return mon;
}

export function eggProgress(mon) {
  if (!mon || !mon.isEgg) return 1;
  return Math.max(0, Math.min(1, (mon.eggSteps || 0) / (mon.eggNeeded || 1)));
}

/** What the Day Care lady says about how close it is. */
export function eggHint(mon) {
  const p = eggProgress(mon);
  if (p > 0.85) return 'It is making sounds! It is about to hatch!';
  if (p > 0.55) return 'It moves about inside sometimes. It must be close.';
  if (p > 0.25) return 'It does not seem close to hatching. Keep walking.';
  return 'What could be inside? It needs a lot more care.';
}
