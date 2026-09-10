// Field moves, and the obstacles that answer to them.
//
// A badge does not teach you anything. It makes the world accept a move you
// already know — which is why progression in these games works at all, and why
// it is modelled that way here: the badge is permission, the move is
// capability, and an obstacle needs both.
//
// The obstacles are tiles. A cuttable tree is solid rock as far as the
// collision code is concerned, right up until it is not there any more, so
// nothing anywhere else has to know that Cut exists.
import { getSpecies } from '../data/species.js';
import { GYMS, STORY_FIELD_MOVES } from '../data/campaign.js';

/**
 * `tile` is the map character the move clears. Surf has none: it works on
 * ordinary water, which is exactly why it opens up half a region at once.
 */
export const FIELD_MOVES = {
  cut: {
    move: 'cut', name: 'Cut', tile: 'f',
    prompt: 'A thin tree, small enough to cut down.',
    doing: 'cut the tree down',
    denied: 'A thin tree. Something with a blade could get through it.',
  },
  rocksmash: {
    move: 'rocksmash', name: 'Rock Smash', tile: 'r',
    prompt: 'A cracked rock. It would not take much.',
    doing: 'smashed the rock',
    denied: 'A cracked rock, sitting in the way.',
  },
  strength: {
    move: 'strength', name: 'Strength', tile: 'm',
    prompt: 'A boulder. It might shift, with enough behind it.',
    doing: 'shoved the boulder',
    denied: 'A boulder. Far too heavy to move by hand.',
    push: true,
  },
  rockclimb: {
    move: 'rockclimb', name: 'Rock Climb', tile: 'a',
    prompt: 'The rock face is rough enough to climb.',
    doing: 'climbed the rock face',
    denied: 'A rock face. Rough, but too steep to climb unaided.',
  },
  surf: {
    move: 'surf', name: 'Surf', tile: null,
    prompt: 'The water is deep. Something could carry you across.',
    doing: 'set off across the water',
    denied: 'The water is clear and deep.',
  },
  waterfall: {
    move: 'waterfall', name: 'Waterfall', tile: 'u',
    prompt: 'The water climbs the rock face.',
    doing: 'went up the waterfall',
    denied: 'A waterfall, running hard. Nothing is climbing that yet.',
  },
};

export const FIELD_IDS = Object.keys(FIELD_MOVES);

/** The tile character an obstacle uses, for the map author and the audit. */
export function tileFor(id) { return (FIELD_MOVES[id] || {}).tile || null; }

/** Which field move, if any, clears this tile. */
export function moveForTile(ch) {
  return FIELD_IDS.find((id) => FIELD_MOVES[id].tile === ch) || null;
}

/**
 * Which badge authorises a field move — read off the campaign spine rather
 * than written down twice, so moving Fantina from fifth to third cannot leave
 * the wrong badge gating the wrong move.
 */
export function badgeFor(id) {
  const gym = GYMS.find((g) => g.field === id);
  return gym ? gym.n : null;
}

export function storyGateFor(id) {
  return STORY_FIELD_MOVES[id] || null;
}

/** True once the player is allowed to use this move outside a battle. */
export function isAuthorised(state, id) {
  const n = badgeFor(id);
  if (n !== null) return !!state.flags[`badge${n}`];
  const story = storyGateFor(id);
  if (story) return !!state.flags[story.after];
  return false;
}

/** The first party member that knows the move, or null. */
export function bearerOf(state, id) {
  const spec = FIELD_MOVES[id];
  if (!spec) return null;
  return (state.party || []).find((m) => m && !m.isEgg
    && m.moves.some((mv) => mv.id === spec.move)) || null;
}

/**
 * Can the player use this here and now? Returns why not, so the game can say
 * something more useful than "you can't do that" — the two failures are very
 * different problems and the player fixes them in different places.
 */
export function usability(state, id) {
  if (!FIELD_MOVES[id]) return { ok: false, why: 'unknown' };
  if (!isAuthorised(state, id)) return { ok: false, why: 'badge' };
  const mon = bearerOf(state, id);
  if (!mon) return { ok: false, why: 'nobody' };
  return { ok: true, mon };
}

export function canUse(state, id) { return usability(state, id).ok; }

/** What to say when the player faces an obstacle they cannot clear yet. */
export function refusalText(state, id) {
  const spec = FIELD_MOVES[id];
  const u = usability(state, id);
  if (u.ok) return null;
  if (u.why === 'badge') {
    const n = badgeFor(id);
    const gym = GYMS.find((g) => g.n === n);
    if (gym) return `${spec.denied}\fThe ${gym.badge} would settle whether you are allowed.`;
    const story = storyGateFor(id);
    return `${spec.denied}${story ? `\fNothing you have learned yet would get you across.` : ''}`;
  }
  return `${spec.denied}\fNothing in your party knows ${spec.name}.`;
}

// ---- obstacles that stay cleared -------------------------------------------
//
// A tree you cut down should still be down when you come back, so cleared
// tiles are saved. Boulders are the exception: they are puzzles, and a puzzle
// you cannot reset is a puzzle you can lock yourself out of.

export function clearedKey(map, x, y) { return `${map}:${x},${y}`; }

export function isCleared(state, map, x, y) {
  return !!(state.cleared && state.cleared[clearedKey(map, x, y)]);
}

export function markCleared(state, map, x, y) {
  if (!state.cleared) state.cleared = {};
  state.cleared[clearedKey(map, x, y)] = true;
}

export function serializeCleared(cleared) { return { ...(cleared || {}) }; }

export function reviveCleared(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(raw)) {
    if (/^[a-z0-9_]+:\d+,\d+$/.test(k)) out[k] = true;
  }
  return out;
}

/** Field moves a Pokémon of this species could plausibly be taught. */
export function teachableTo(speciesId, id) {
  const spec = FIELD_MOVES[id];
  const sp = getSpecies(speciesId);
  if (!spec || !sp) return false;
  return true;
}
