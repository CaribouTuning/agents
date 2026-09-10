// The journal.
//
// A Pokémon game tells you what to do next by having somebody say it once, out
// loud, forty minutes ago. That was fine when you played it on a bus every day
// for a month. It is not fine when you pick this up on a Tuesday having last
// touched it three weeks earlier.
//
// So: every beat writes an entry, entries carry what you *learned* rather than
// what happened, and the top of the screen always says what you are doing now.
// Nothing here gates anything — it is a record, not a quest system.
import { FLAGS } from './storyflags.js';

/**
 * Entries in story order. `id` is what a script passes to ctx.journal().
 * `next` is what the journal shows as the current objective while this is the
 * latest entry — the single most useful line in the whole feature.
 */
export const ENTRIES = [
  {
    id: 'gotStarter',
    title: 'A Pokémon of my own',
    body: [
      'Prof. Rowan gave me a starter and a Pokédex, and said the road north\nis "the whole point".',
      'He mentioned the Pokédex logs ambient light as well. He said not to\nworry about that part.',
    ],
    next: 'Head north out of Twinleaf, along Route 201.',
  },
  {
    id: 'bandit',
    title: 'Bandit came too',
    body: [
      'He was sitting outside the lab the whole time I was in it. Nobody let\nhim out. He just knew.',
      'Rowan says a Pokémon that picks a person has already decided, and the\npaperwork only catches up later.',
      'He is a Houndour. He is not really mine. He is completely mine.',
    ],
  },
  {
    id: 'metCass',
    title: 'Cass Wren',
    body: [
      'Cass from four doors down was waiting on Route 201. She started a year\nbefore me and has never once let me forget it.',
      'She got up at seven to take the starter that beats mine. On purpose.',
    ],
    next: 'North through Sandgem and Jubilife to Oreburgh.',
  },
  {
    id: 'registered',
    title: 'On the register',
    body: [
      'The clerk in the Jubilife Center writes down pairs who walk the road on\nthe same day. She wrote down both of us.',
      'She gave me a bell and said the other one is the pair to it. There is no\nsecond pair.',
    ],
  },
  {
    id: 'cassCircuit',
    title: 'The Battle Hall',
    body: [
      'Cass has been competing at the Oreburgh Battle Hall — sanctioned World\nCircuit events, with a real world ranking.',
      'She is rated 1180. She was very keen to tell me that is "not a good\nnumber, just a real one".',
    ],
    next: 'Take on Roark at the Oreburgh Gym.',
  },
  {
    id: 'badge1',
    title: 'The Coal Badge',
    body: ['Beat Roark. Oreburgh was cut out of the hillside by people who did not\ngive up, apparently, and now I have the badge to prove I am one of them.'],
    next: 'Route 207 runs north out of the city. Team Galactic are up there.',
  },
  {
    id: 'doc_survey',
    title: 'A ninety-year-old survey',
    body: [
      'A quarry survey from ninety years ago records the north seam as "warm at\nall hours and in all weathers", with no explanation offered.',
      'Someone wrote in the margin, in a different pen: "The Everlight does not\nsleep. It waits, and it is patient, and it is not alone."',
    ],
  },
  {
    id: 'doc_memo',
    title: 'A Galactic field memo',
    body: [
      'Site 9 is Oreburgh Gate. Readings up 40% on the month, and the memo says\nthat is expected — "this is the whole point".',
      'Field staff are forbidden from carrying the artefact into the chamber\napproach. Not once. Not to test it.',
      'Signed "M."',
    ],
  },
  {
    id: 'doc_logbook',
    title: 'A worn field logbook',
    body: [
      'Thirty-one years of light readings in a young hand, then this:',
      '"I keep asking what opens it. I should be asking what it is holding shut,\nand who is holding it."',
      'The rest of the pages are blank. The book has been kept anyway.',
    ],
  },
  {
    id: 'joinedCircuit',
    title: 'Registered on the World Circuit',
    body: [
      'Signed on at the Oreburgh Battle Hall. Unranked, like everyone starts.',
      'Rating moves both ways. Circuit Points only go up. One measures how good\nI am now, the other measures what I have done.',
    ],
    next: 'Enter the Oreburgh Rookie Cup — open entry.',
  },
  {
    id: 'cassWarning',
    title: 'Cass, at the mouth of the Gate',
    body: [
      'She stood in the way and told me not to go in. She has been up there\ntwice this week and there are more of them each time.',
      'Then she made me beat her for the privilege, gave me three Hyper Potions,\nand said if I am not out in a day she is coming in after me.',
    ],
    next: 'Go into Oreburgh Gate and find out what Galactic are doing.',
  },
  {
    id: 'beatMars',
    title: 'Commander Mars',
    body: [
      'Beat her. She said "we will not make that mistake twice" and walked out.',
      'She left every instrument behind. She did not even look at them.',
    ],
    next: 'Look for whatever Galactic were digging towards.',
  },
  {
    id: 'theKey',
    title: 'It is a key, and it is theirs',
    body: [
      'The Aurora Charm was warm when I picked it up. Rowan says that means it\nhad been in that rock for minutes, not centuries.',
      'Galactic built it. They cannot use it — the door does not open for anyone\nwho wants in — so they left it where a trainer would find it.',
      'Mars did not lose. She stepped aside.',
      'And Rowan sent me up that road knowing all of it. He tried the door\nhimself thirty-one years ago and it would not open for him.',
    ],
    next: 'The seam is in the north wall of Oreburgh Gate.',
  },
  {
    id: 'doorOpened',
    title: 'The rock drew back',
    body: ['The charm did not answer the light. The light answered the charm.'],
    next: 'Go into the Everlight Chamber.',
  },
  {
    id: 'caughtEverlight',
    title: 'The Everlight',
    body: [
      'Dialga. It had its back to the door, and it had been standing that way\nfor a very long time.',
      'It was not guarding the light. It was holding the door shut, from the\ninside, alone, and nobody had ever come to help.',
      'It turned around and it was not surprised. It was relieved.',
    ],
    next: 'Prof. Rowan is waiting outside the Gate.',
  },
  {
    id: 'marsLate',
    title: 'Four hours',
    body: [
      'Mars got to the chamber four hours after I did.',
      'Fourteen months of operation, two commanders, nine sites. They built the\nkey, picked the hill, and picked the trainer.',
      'They picked me.',
    ],
  },
  {
    id: 'rowanOutside',
    title: 'Rowan, outside the Gate',
    body: [
      'He had been standing there six hours. He could not go in, and he wanted\nme to understand that he tried.',
      '"The door was never locked. It was held. From the inside."',
      '"And you knocked."',
    ],
    next: 'The World Circuit is still running. Cass is at the Battle Hall.',
  },
];

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));
export function getEntry(id) { return BY_ID.get(id) || null; }

export function createJournal() { return { seen: [] }; }

export function reviveJournal(raw) {
  const j = createJournal();
  if (raw && Array.isArray(raw.seen)) j.seen = raw.seen.filter((id) => BY_ID.has(id));
  return j;
}

export function serializeJournal(j) { return { seen: [...(j ? j.seen : [])] }; }

/** Records an entry. Returns true the first time, so a script can react. */
export function record(state, id) {
  if (!BY_ID.has(id)) return false;
  const j = state.journal || (state.journal = createJournal());
  if (j.seen.includes(id)) return false;
  j.seen.push(id);
  return true;
}

/** Entries the player has, in story order. */
export function entriesFor(state) {
  const seen = new Set(state.journal ? state.journal.seen : []);
  return ENTRIES.filter((e) => seen.has(e.id));
}

/**
 * What to do next — the line the guide bar puts on screen and the journal
 * puts at the top.
 *
 * This used to read the last journal entry's `next` and stop there, which
 * went stale the moment the player did something out of order: walk into
 * Oreburgh without having spoken to Cass and the game was still telling you
 * to walk to Oreburgh. So the flags come first. Each rule is a plain
 * (condition, instruction) pair in the order the game happens, and every
 * instruction names a PLACE and a REASON, because "go north" without "to
 * take the Gym's badge" is how a player ends up wandering a city wondering
 * what the game wants.
 *
 * Each rule sees the flags and the whole state, so an instruction can change
 * once the player is actually in the building it was pointing at. Every line
 * is kept under 48 characters, because it has to fit the guide bar on a phone
 * without being cut off — tools/audit.mjs enforces that.
 */
export const OBJECTIVE_MAX = 48;

const onTheRoad = (f, st) => !f.reachedOreburgh && !String(st.player.map).startsWith('oreburgh');

const RULES = [
  // --- the opening ---
  [(f, st) => !f.gotStarter && st.player.map === 'rowan_lab', 'Talk to Prof. Rowan. Choose a Pokémon.'],
  [(f) => !f.gotStarter, "Go to Prof. Rowan's lab, north of your house."],

  // --- the road to Oreburgh, town by town ---
  [(f, st) => onTheRoad(f, st) && st.player.map === 'twinleaf', 'Leave Twinleaf to the north, onto Route 201.'],
  [(f, st) => onTheRoad(f, st) && st.player.map === 'route201', 'North up Route 201 to Sandgem Town.'],
  [(f, st) => onTheRoad(f, st) && st.player.map === 'sandgem', 'Rest here, then north on Route 202.'],
  [(f, st) => onTheRoad(f, st) && st.player.map === 'route202', 'North through Route 202 to Jubilife City.'],
  [(f, st) => onTheRoad(f, st) && st.player.map === 'jubilife_school', 'Read the boards. Talk to Ms. Orme.'],
  [(f, st) => onTheRoad(f, st) && st.player.map === 'jubilife', "Visit the Trainers' School, then Route 203."],
  [(f, st) => onTheRoad(f, st) && st.player.map === 'route203', 'Follow Route 203 south to Oreburgh City.'],
  [onTheRoad, 'Head north from Twinleaf toward Oreburgh.'],

  // --- the first badge. The whole point of arriving. ---
  [(f, st) => !f.badge1 && st.player.map === 'oreburgh_gym', 'Beat 3 trainers, then Roark, for the badge.'],
  [(f, st) => !f.badge1 && st.player.map === 'oreburgh_center', 'Heal your team, then challenge the GYM.'],
  [(f, st) => !f.badge1 && st.player.map === 'oreburgh', 'Win the COAL BADGE at the GYM, south end.'],
  [(f) => !f.badge1, 'Return to Oreburgh and challenge the GYM.'],

  // --- Galactic, the cave, the Everlight ---
  [(f, st) => !f.beatCommander && st.player.map === 'oreburgh_gate', 'Find the Galactic commander in here.'],
  [(f) => !f.beatCommander, 'Head up Route 207. Galactic are digging.'],
  [(f) => !f.gotCharm, 'Take the Aurora Charm from the dig site.'],
  [(f) => !f.everlightOpened, "The sealed seam is in the Gate's north wall."],
  [(f) => !f.everlightResolved, 'Enter the Everlight Chamber.'],
];

export function objective(state) {
  const f = (state && state.flags) || {};
  const st = state || { player: {}, flags: {} };
  for (const [when, text] of RULES) {
    if (when(f, st)) return text;
  }
  // Past the story's end the journal takes over: whatever the last recorded
  // entry says to do next, then the circuit, which never runs out.
  const mine = entriesFor(state);
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i].next) return mine[i].next;
  }
  return 'The World Circuit is still running. The Battle Hall is in Oreburgh.';
}
