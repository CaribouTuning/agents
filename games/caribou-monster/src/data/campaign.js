// The campaign spine.
//
// Platinum's shape, as data: the Gyms in Platinum's order — which is *not*
// Diamond and Pearl's, because Fantina moves from fifth to third and that
// changes the whole middle of the game — each with the badge it gives, the TM
// it hands over, and the field move that badge authorises.
//
// Everything else hangs off this. The audit reads it to check the Gyms are
// built in order and that nothing gives out a badge twice; the field-move
// system reads it to decide whether you are allowed to cut down a tree; and
// the story gates read it to decide which road is open.
//
// A Gym listed here without a map is not an error — it is the to-do list, in
// order, and `builtGyms()` is what the game actually has.

/**
 * `field` is the move this badge authorises. In the games a badge does not
 * teach you anything; it makes the world accept a move you already know. That
 * distinction is the whole reason progression works, so it is modelled that
 * way here: the badge is permission, the move is capability, and you need both.
 */
export const GYMS = [
  {
    n: 1, city: 'oreburgh', map: 'oreburgh_gym', leader: 'Roark', type: 'Rock',
    badge: 'Coal Badge', trainer: 'gym1_leader', tm: 'tm01',
    field: 'rocksmash', level: 14,
  },
  {
    n: 2, city: 'eterna', map: 'eterna_gym', leader: 'Gardenia', type: 'Grass',
    badge: 'Forest Badge', trainer: 'gym2_leader', tm: 'tm08',
    field: 'cut', level: 22,
  },
  {
    n: 3, city: 'hearthome', map: 'hearthome_gym', leader: 'Fantina', type: 'Ghost',
    badge: 'Relic Badge', trainer: 'gym3_leader', tm: 'tm05',
    field: 'defog', level: 26,
  },
  {
    n: 4, city: 'veilstone', map: 'veilstone_gym', leader: 'Maylene', type: 'Fighting',
    badge: 'Cobble Badge', trainer: 'gym4_leader', tm: 'tm03',
    field: 'fly', level: 32,
  },
  {
    n: 5, city: 'pastoria', map: 'pastoria_gym', leader: 'Crasher Wake', type: 'Water',
    badge: 'Fen Badge', trainer: 'gym5_leader', tm: 'tm06',
    field: 'defog', level: 30,
  },
  {
    n: 6, city: 'canalave', map: 'canalave_gym', leader: 'Byron', type: 'Steel',
    badge: 'Mine Badge', trainer: 'gym6_leader', tm: 'tm07',
    field: 'strength', level: 39,
  },
  {
    n: 7, city: 'snowpoint', map: 'snowpoint_gym', leader: 'Candice', type: 'Ice',
    badge: 'Icicle Badge', trainer: 'gym7_leader', tm: 'tm04',
    field: 'rockclimb', level: 42,
  },
  {
    n: 8, city: 'sunyshore', map: 'sunyshore_gym', leader: 'Volkner', type: 'Electric',
    badge: 'Beacon Badge', trainer: 'gym8_leader', tm: 'tm02',
    field: 'waterfall', level: 49,
  },
];

/**
 * Surf is the exception: no Gym authorises it. In Platinum it comes out of the
 * Celestic Town story, which is why the west half of the region opens up in
 * the middle of the Galactic plot rather than after a badge.
 */
export const STORY_FIELD_MOVES = {
  surf: { after: 'lakeValor', from: 'the Galactic attack on Lake Valor' },
};

export function gymByNumber(n) { return GYMS.find((g) => g.n === n) || null; }
export function gymByTrainer(id) { return GYMS.find((g) => g.trainer === id) || null; }
export function gymByCity(city) { return GYMS.find((g) => g.city === city) || null; }

/** The Gyms that actually exist in the world, in order. */
export function builtGyms(maps) {
  return GYMS.filter((g) => maps[g.map]);
}

/**
 * How many badges the League in THIS build actually asks for.
 *
 * Rowan used to say "eight of those and the League has to let you in" while
 * the game had six Gyms in it, which is the kind of thing that quietly tells a
 * player the world is not real. Nobody states a number any more: every line
 * that mentions how many badges there are reads it from here, so the sentence
 * and the game cannot come apart.
 */
export function leagueBadges(maps) {
  return builtGyms(maps).length;
}

/** The town a Gym is in, by leader name — so nobody ever mislocates one. */
export function gymTownOf(leader, maps) {
  const g = builtGyms(maps).find((x) => x.leader === leader);
  return g ? g.city : null;
}

/** How far through them the player is. */
export function badgeCount(state) { return (state.badges || []).length; }

/** The next Gym to go and find, or null once all eight are done. */
export function nextGym(state) {
  return GYMS.find((g) => !state.flags[`badge${g.n}`]) || null;
}

// ---- the story, in order ---------------------------------------------------
//
// Platinum's beats, as flags, in the sequence they must happen. The journal's
// objective machine and the progression gates both read this, so "what should
// the player be doing" and "where may the player go" cannot drift apart.

export const BEATS = [
  { flag: 'gotStarter', where: 'twinleaf', text: 'Take a Pokémon from Professor Rowan.' },
  { flag: 'leftTown', where: 'route201', text: 'Head north out of Twinleaf.' },
  { flag: 'reachedOreburgh', where: 'oreburgh', text: 'Reach Oreburgh City.' },
  { flag: 'badge1', where: 'oreburgh_gym', text: 'Beat Roark for the Coal Badge.' },
  { flag: 'enteredCave', where: 'oreburgh_gate', text: 'Something is under Oreburgh Gate.' },
  { flag: 'beatCommander', where: 'oreburgh_gate', text: 'Team Galactic are down there.' },
  { flag: 'knowsTwist', where: 'oreburgh_gate', text: 'The charm was theirs all along.' },
  { flag: 'badge2', where: 'eterna_gym', text: 'Beat Gardenia for the Forest Badge.' },
  { flag: 'badge3', where: 'hearthome_gym', text: 'Beat Fantina for the Relic Badge.' },
  { flag: 'badge4', where: 'veilstone_gym', text: 'Beat Maylene for the Cobble Badge.' },
  { flag: 'galacticHQ', where: 'veilstone', text: 'Team Galactic have a building in Veilstone.' },
  { flag: 'badge5', where: 'pastoria_gym', text: 'Beat Crasher Wake for the Fen Badge.' },
  { flag: 'lakeValor', where: 'lake_valor', text: 'Lake Valor. Galactic got there first.' },
  { flag: 'badge6', where: 'canalave_gym', text: 'Beat Byron for the Mine Badge.' },
  { flag: 'lakeAcuity', where: 'lake_acuity', text: 'Lake Acuity. They are ahead of you again.' },
  { flag: 'badge7', where: 'snowpoint_gym', text: 'Beat Candice for the Icicle Badge.' },
  { flag: 'spearPillar', where: 'spear_pillar', text: 'Cyrus is at the top of Mt. Coronet.' },
  { flag: 'distortionWorld', where: 'distortion', text: 'Follow Giratina through the tear.' },
  { flag: 'caughtEverlight', where: 'distortion', text: 'Giratina.' },
  { flag: 'badge8', where: 'sunyshore_gym', text: 'Beat Volkner for the Beacon Badge.' },
  { flag: 'victoryRoad', where: 'victory_road', text: 'Victory Road.' },
  { flag: 'champion', where: 'league', text: 'The Pokémon League.' },
  { flag: 'battleZone', where: 'fight_area', text: 'The Battle Zone is open.' },
];

/** The first beat the player has not reached. */
export function currentBeat(state) {
  return BEATS.find((b) => !state.flags[b.flag]) || null;
}

/** Which beats exist in the world today, so the audit can say what is missing. */
export function beatsWithMaps(maps) {
  return BEATS.filter((b) => maps[b.where]);
}
