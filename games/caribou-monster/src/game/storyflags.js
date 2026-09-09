// Story flags.
//
// Flags are the single source of truth for progression, which matters for
// co-op: when two players are in a room, flags are the thing that gets
// reconciled (see net/protocol.js). Keeping them as a flat string->value map
// makes that merge trivial and debuggable.

export const FLAGS = {
  GOT_STARTER: 'gotStarter',
  MET_RIVAL: 'metRival',
  BEAT_RIVAL_1: 'beatRival1',
  LEFT_TOWN: 'leftTown',
  ENTERED_FOREST: 'enteredForest',
  FOREST_GRUNT: 'forestGrunt',
  REACHED_ALDERMERE: 'reachedOreburgh',
  BEAT_RIVAL_2: 'beatRival2',
  BADGE_1: 'badge1',
  ENTERED_CAVE: 'enteredCave',
  GOT_CHARM: 'gotCharm',
  BEAT_COMMANDER: 'beatCommander',
  EVERLIGHT_OPENED: 'everlightOpened',
  EVERLIGHT_RESOLVED: 'everlightResolved',
  CAUGHT_EVERLIGHT: 'caughtEverlight',
};

// Milestones that co-op partners keep in step, in the order they happen.
export const SHARED_MILESTONES = [
  FLAGS.GOT_STARTER, FLAGS.LEFT_TOWN, FLAGS.ENTERED_FOREST, FLAGS.FOREST_GRUNT,
  FLAGS.REACHED_ALDERMERE, FLAGS.BADGE_1, FLAGS.ENTERED_CAVE, FLAGS.BEAT_COMMANDER,
  FLAGS.CAUGHT_EVERLIGHT,
];

export function createFlags() { return {}; }

export function setFlag(flags, key, value = true) {
  const changed = flags[key] !== value;
  flags[key] = value;
  return changed;
}

export function getFlag(flags, key) { return !!flags[key]; }

// How far through the shared story a save is. Used to tell a joining player
// "your partner is further ahead" rather than silently desyncing.
export function storyProgress(flags) {
  let n = 0;
  for (const m of SHARED_MILESTONES) { if (flags[m]) n++; else break; }
  return n;
}

export function progressLabel(n) {
  return [
    'Just starting out', 'On the road', 'In Route 202', 'Through the forest',
    'In Oreburgh', 'One badge', 'Into Oreburgh Gate', 'Faced Galactic',
    'Woke the Everlight',
  ][Math.min(n, 8)];
}
