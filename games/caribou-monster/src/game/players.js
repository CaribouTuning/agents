// The two people this game is for.
//
// This is not a character creator. Caribou Monster is a two-player game built
// for Matthew and Sammy, so the roster is exactly two, and the world always
// knows which of them is holding the phone — and therefore which of them is
// the one who is *not* here yet.
//
// `buddy` is the other one's name. Every NPC that talks about "your friend"
// reads it from here, so the world is populated by the right person whether
// or not the link is up.

export const PLAYERS = [
  {
    key: 'matthew',
    name: 'Matthew',
    look: 'matthew',
    label: 'MATTHEW',
    buddy: 'Sammy',
    // The left-hand house in Twinleaf. Which house is whose is fixed, so
    // the town reads the same whichever of them is holding the phone.
    house: 'matthew_house',
    blurb: 'Twinleaf. Never sits still.',
  },
  {
    key: 'sammy',
    name: 'Sammy',
    look: 'sammy',
    label: 'SAMMY',
    buddy: 'Matthew',
    // The right-hand house, and Bandit sleeps on its step.
    house: 'sammy_house',
    blurb: 'Twinleaf. Reddish-blonde. Reads the room.',
  },
];

export function playerByLook(look) {
  return PLAYERS.find((p) => p.look === look) || null;
}

export function playerByName(name) {
  const key = String(name || '').trim().toLowerCase();
  return PLAYERS.find((p) => p.name.toLowerCase() === key) || null;
}

/**
 * The name of the other one. A save from before this existed, or a name
 * neither of them uses, still gets a sensible answer rather than undefined.
 */
export function buddyOf(state) {
  const byLook = playerByLook(state && state.player && state.player.look);
  if (byLook) return byLook.buddy;
  const byName = playerByName(state && state.player && state.player.name);
  if (byName) return byName.buddy;
  return PLAYERS[0].buddy;
}

/** True when this save belongs to one of the two, rather than a stray name. */
export function isKnownPlayer(state) {
  return !!(playerByLook(state && state.player && state.player.look)
    || playerByName(state && state.player && state.player.name));
}

/** The record for whoever is holding the phone, defaulting to Matthew. */
export function playerOf(state) {
  return playerByLook(state && state.player && state.player.look)
    || playerByName(state && state.player && state.player.name)
    || PLAYERS[0];
}

/** The other one's record — the partner the world talks about. */
export function buddyPlayerOf(state) {
  const me = playerOf(state);
  return PLAYERS.find((p) => p.key !== me.key) || PLAYERS[1];
}

/** Your own front door. */
export function houseOf(state) { return playerOf(state).house; }

/** Theirs. */
export function buddyHouseOf(state) { return buddyPlayerOf(state).house; }
