// Friendship.
//
// Every Pokémon has carried a `friendship` value since the first commit, the
// evolution resolver reads it, and nothing ever changed it — so a friendship
// evolution could never fire and the number on the summary screen was a
// constant 70 pretending to be a relationship.
//
// The rules are the series' own, simplified: it grows from levelling and from
// winning, and it falls when a Pokémon faints. Walking with it helps a little.

export const FRIENDSHIP_MAX = 255;
export const FRIENDSHIP_START = 70;

/** Gains shrink as a Pokémon gets fonder of you, the way the games do it. */
function bandGain(value, base) {
  if (value >= 200) return Math.max(1, Math.round(base * 0.4));
  if (value >= 100) return Math.max(1, Math.round(base * 0.7));
  return base;
}

export function adjustFriendship(mon, base) {
  if (!mon) return 0;
  const before = mon.friendship || 0;
  const delta = base > 0 ? bandGain(before, base) : base;
  mon.friendship = Math.max(0, Math.min(FRIENDSHIP_MAX, before + delta));
  return mon.friendship - before;
}

export const FRIENDSHIP_EVENTS = {
  levelUp: 3,
  wonBattle: 1,
  caught: 0,
  walked: 1,          // per 128 steps, and only for the lead Pokémon
  fainted: -5,
  usedBitterItem: -5,
};

export function onLevelUp(mon) { return adjustFriendship(mon, FRIENDSHIP_EVENTS.levelUp); }
export function onWonBattle(mon) { return adjustFriendship(mon, FRIENDSHIP_EVENTS.wonBattle); }
export function onFainted(mon) { return adjustFriendship(mon, FRIENDSHIP_EVENTS.fainted); }
export function onWalked(mon) { return adjustFriendship(mon, FRIENDSHIP_EVENTS.walked); }

/** Words rather than a number, because 174 means nothing to a player. */
export function friendshipLabel(mon) {
  const v = mon.friendship || 0;
  if (v >= 250) return 'Inseparable';
  if (v >= 200) return 'Devoted';
  if (v >= 150) return 'Very friendly';
  if (v >= 100) return 'Friendly';
  if (v >= 70) return 'Warming up';
  if (v >= 30) return 'Wary';
  return 'Distant';
}
