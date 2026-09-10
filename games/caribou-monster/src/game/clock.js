// The world clock.
//
// Platinum reads the DS's own clock, so the game is morning when it is morning
// where you are — which is the whole charm of it: play in the evening and the
// world is lit like the evening, and two people playing together see the same
// sky because they are in the same room.
//
// Phases are the series' own boundaries:
//
//   morning  04:00 - 09:59
//   day      10:00 - 19:59
//   night    20:00 - 03:59
//
// Nothing here is stored in a save. A clock you can save is a clock you can
// desync, and the point of it is that it agrees with the world outside.

export const PHASES = ['morning', 'day', 'night'];

/** Overridden by the debug menu and by the tests; null means "ask the device". */
let forced = null;

export function forceHour(hour) {
  forced = hour === null || hour === undefined ? null : ((hour % 24) + 24) % 24;
}

export function currentHour() {
  return forced === null ? new Date().getHours() : forced;
}

export function phaseAt(hour) {
  if (hour >= 4 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 20) return 'day';
  return 'night';
}

export function currentPhase() { return phaseAt(currentHour()); }

export function isNight(hour = currentHour()) { return phaseAt(hour) === 'night'; }

/** "Morning", "Day", "Night" — for the trainer card and the summary screen. */
export function phaseLabel(phase = currentPhase()) {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/**
 * The wash laid over the overworld for this phase. Outdoor maps only: a cave
 * is dark whatever the hour, and being indoors is the one place the light
 * does not change.
 *
 * `alpha` of 0 means day, which is drawn as nothing at all rather than as a
 * transparent rectangle nobody can see.
 */
const TINTS = {
  morning: { color: '#ffb463', alpha: 0.26 },
  day: { color: '#ffffff', alpha: 0 },
  night: { color: '#2a3c88', alpha: 0.62 },
};

export function tintFor(phase = currentPhase()) { return TINTS[phase] || TINTS.day; }

/**
 * How many real minutes a phase still has to run. Used by anything that wants
 * to say "come back tomorrow morning" and mean it.
 */
export function minutesLeftInPhase(now = new Date()) {
  const hour = forced === null ? now.getHours() : forced;
  const phase = phaseAt(hour);
  let endHour = phase === 'morning' ? 10 : phase === 'day' ? 20 : 4;
  let hours = (endHour - hour + 24) % 24;
  if (hours === 0) hours = 24;
  return hours * 60 - (forced === null ? now.getMinutes() : 0);
}
