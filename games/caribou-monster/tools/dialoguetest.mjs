// Conditional dialogue coverage.
//
// Every NPC line in the game is data with a condition attached. This drives a
// synthetic save through the whole story — no starter, first Pokémon, a badge,
// the cave, joining the circuit, titles, world number one — and at each stage
// asks every NPC in every map what they would say.
//
// It asserts three things the audit cannot: that a branch actually fires
// somewhere in a real career (dead dialogue is dead content), that nobody ever
// falls silent, and that no line ever escapes with an unfilled slot in it.
import { MAPS } from '../src/data/maps/index.js';
import { createGameState, serializeState, deserializeState } from '../src/game/state.js';
import { createMonster } from '../src/game/monster.js';
import { resolveDialogue, worldSnapshot, matches, fill } from '../src/game/overworld/gossip.js';
import { createCircuit } from '../src/game/circuit/circuit.js';
import { TOURNAMENTS, PRO_LIST, RANKS } from '../src/data/circuit.js';
import { recordCaught, recordSeen } from '../src/game/pokedex.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log(`  FAIL  ${msg}`); fails++; } };

// ---- the stages of a career -------------------------------------------------

function baseState(name = 'Matthew') {
  // The look matters now: half the town knows which of the two it is
  // talking to, so a stage that does not set it tests the wrong person.
  const st = createGameState({ name, look: name.toLowerCase() });
  st.circuit = createCircuit();
  return st;
}

/**
 * Matthew's save with Bandit in it. She is Sammy's dog, so this only happens
 * in co-op — and half of Twinleaf has a line for exactly that situation.
 */
function matthewWithBandit(st) {
  // `hasBandit` means she is in THIS save's party, which for Matthew she
  // never is. `banditWithUs` is the one that means she is with the two of
  // you — set when Sammy comes off the step with him.
  st.flags.banditWithUs = true;
  st.flags.buddyJoined = true;
  st.flags.pairRegistered = true;
  return st;
}

function withBandit(st) {
  // Sammy's playthrough. Bandit is real content with real lines about him,
  // so the sweep has to walk a save that has him in it.
  st.player.look = 'sammy';
  st.player.name = 'Sammy';
  st.flags.hasBandit = true;
  st.flags.banditWithUs = true;
  // The pair register is a linked-only thing, and the sweep runs each stage
  // both alone and linked, so this stage carries it.
  st.flags.pairRegistered = true;
  st.party = [...st.party, createMonster(228, 8)];
  return st;
}

function withStarter(st) {
  st.flags.gotStarter = true;
  // The other one took a starter in the same scene, and the world is allowed
  // to have noticed. Every save that has a starter has this.
  st.flags.buddyHasStarter = true;
  st.starterBase = 1;
  st.party = [createMonster(387, 5)];
  return st;
}

/** The second badge, from Gardenia in Eterna — the northern branch's gate. */
function withSecondBadge(st) {
  st.badges = [1, 2];
  st.flags.badge2 = true;
  st.flags.beat_gym2_leader = true;
  return st;
}

/** And the third, from Fantina in Hearthome, over the mountain. */
function withThirdBadge(st) {
  st.badges = [1, 2, 3];
  st.flags.badge3 = true;
  st.flags.beat_gym3_leader = true;
  return st;
}

/** The fourth, from Maylene, and the day the grey building stopped being a rumour. */
function withFourthBadge(st) {
  st.badges = [1, 2, 3, 4];
  st.flags.badge4 = true;
  st.flags.beat_gym4_leader = true;
  return st;
}

/** The fifth, from Crasher Wake, and the road south to the marsh. */
function withFifthBadge(st) {
  st.badges = [1, 2, 3, 4, 5];
  st.flags.badge5 = true;
  st.flags.beat_gym5_leader = true;
  return st;
}

/** The morning the lake went. Everything south of Hearthome talks about it. */
function afterLakeValor(st) {
  st.flags.lakeValor = true;
  return st;
}

/** The ducks are off the fog road, which means Celestic is reachable. */
function pastThePsyduck(st) {
  st.flags.psyducks = true;
  return st;
}

/** The grey coats are off the shrine steps and the mural has been read. */
function afterCelestic(st) {
  st.flags.psyducks = true;
  st.flags.celestic = true;
  st.flags.celesticRead = true;
  st.flags.beat_celestic_grunt1 = true;
  return st;
}

/** The library read, and Looker's picture assembled. */
function afterCanalave(st) {
  st.badges = [1, 2, 3, 4, 5, 6];
  st.flags.badge5 = true;
  st.flags.badge6 = true;
  st.flags.beat_gym6_leader = true;
  st.flags.readVolume1 = true;
  st.flags.readVolume2 = true;
  st.flags.readVolume3 = true;
  st.flags.canalaveTruth = true;
  return st;
}

function insideGalactic(st) {
  st.flags.metLooker = true;
  st.flags.galacticHQ = true;
  st.flags.beat_galactic_saturn = true;
  return st;
}

/** Somebody in Twinleaf has handed over a few berries. */
function withBerries(st) {
  st.flags.gotBerries = true;
  return st;
}

/** The player has picked up the Aurora Charm and worked out what it means. */
function withTwist(st) {
  st.flags.knowsTwist = true;
  st.flags.gotCharm = true;
  return st;
}

function withBadge(st) {
  st.badges = [1];
  st.flags.badge1 = true;
  st.flags.beatRival1 = true;
  st.flags.beat_gym1_leader = true;
  st.party = [createMonster(389, 20)];
  for (let i = 1; i <= 12; i++) { recordSeen(st.dex, i); recordCaught(st.dex, i); }
  return st;
}

function withCave(st) {
  st.flags.enteredCave = true;
  st.flags.beatRival2 = true;
  return st;
}

function withCommander(st) {
  st.flags.beatCommander = true;
  return st;
}

function wokeTheEverlight(st) {
  st.flags.beatCommander = true;
  st.flags.everlightOpened = true;
  st.flags.everlightResolved = true;
  return st;
}

function caughtTheEverlight(st) {
  wokeTheEverlight(st);
  st.flags.caughtEverlight = true;
  return st;
}

function joined(st) {
  st.circuit.joined = true;
  return st;
}

function withTitles(st, n) {
  const c = st.circuit;
  c.joined = true;
  c.titles = TOURNAMENTS.slice(0, n).map((t) => t.id);
  c.cp = RANKS[Math.min(RANKS.length - 1, n)].cp;
  c.rank = RANKS[Math.min(RANKS.length - 1, n)].id;
  c.rating = 1000 + n * 60;
  c.wins = n * 4; c.losses = 2; c.streak = 4; c.bestStreak = 6;
  c.h2h = { wren: { w: 3, l: 1 } };
  c.news = [{ id: 'n', week: 3, kind: 'titleWin', outlet: 'Sinnoh Battle Wire', headline: 'A real headline', body: ['x'], big: true }];
  st.party = [createMonster(390, 45)];
  for (let i = 1; i <= 25; i++) { recordSeen(st.dex, i); recordCaught(st.dex, i); }
  return st;
}

function loudmouth(st) {
  withTitles(st, 2);
  st.circuit.hype = 80;
  st.circuit.respect = 12;
  return st;
}

function wellLiked(st) {
  withTitles(st, 2);
  st.circuit.hype = 20;
  st.circuit.respect = 70;
  return st;
}

function asChampion(st) {
  withTitles(st, 6);
  // Beat every pro down below the player's rating so the standings really do
  // put the player first — the NPCs read the table, not a flag.
  st.circuit.rating = 2000;
  for (const p of PRO_LIST) st.circuit.pros[p.id].rating = 900;
  return st;
}

function midEvent(st) {
  joined(st);
  st.circuit.active = { id: 'rookie_cup', round: 0, rounds: 2, ladder: ['quint'], others: ['quint'], log: [], eliminated: false, done: false };
  return st;
}

/** Out through the grass on 202 and back — the first road anybody walks. */
function walkedTheGrass(st) {
  st.flags.enteredForest = true;
  return st;
}

/** After the end: the Everlight put back, the Finals won, the world quiet. */
function afterTheEnd(st) {
  st.flags.canalaveTruth = true;
  st.flags.everlightResolved = true;
  st.flags.rowanDebriefed = true;
  st.flags.wentHome = true;
  st.flags.wonFinals = true;
  st.flags.postGame = true;
  return st;
}

const STAGES = [
  ['fresh save', () => baseState()],
  ['got a starter', () => withStarter(baseState())],
  ['been up through the grass', () => walkedTheGrass(withStarter(baseState()))],
  ['Sammy, with Bandit', () => withBandit(withStarter(baseState('Sammy')))],
  ['Sammy, on her own', () => withStarter(baseState('Sammy'))],
  // Co-op: Matthew playing, with Sammy and her dog actually along. Bandit is
  // Sammy's, so this is the only way Matthew's save ever has her in it.
  ['Matthew, with Sammy and Bandit', () => matthewWithBandit(withStarter(baseState('Matthew')))],
  ['first badge', () => withBadge(withStarter(baseState()))],
  ['into the cave', () => withCave(withBadge(withStarter(baseState())))],
  ['beat the commander', () => withCommander(withCave(withBadge(withStarter(baseState()))))],
  ['opened the Everlight', () => wokeTheEverlight(withCave(withBadge(withStarter(baseState()))))],
  ['caught the Everlight', () => caughtTheEverlight(withCave(withBadge(withStarter(baseState()))))],
  ['joined the circuit', () => joined(withBadge(withStarter(baseState())))],
  ['mid-tournament', () => midEvent(withBadge(withStarter(baseState())))],
  ['one title', () => withTitles(withBadge(withStarter(baseState())), 1)],
  ['three titles', () => withTitles(withCommander(withCave(withBadge(withStarter(baseState())))), 3)],
  ['all hype, no respect', () => loudmouth(withBadge(withStarter(baseState())))],
  ['all respect, no hype', () => wellLiked(withBadge(withStarter(baseState())))],
  ['world number one', () => asChampion(withCommander(withCave(withBadge(withStarter(baseState())))))],
  ['after the end', () => afterTheEnd(asChampion(withCommander(withCave(withBadge(withStarter(baseState()))))))],
  // The northern branch: berries, the second badge, and knowing what the
  // charm is. Without these stages a third of the new region never speaks.
  ['carrying berries', () => withBerries(withStarter(baseState()))],
  ['second badge', () => withSecondBadge(withBadge(withStarter(baseState())))],
  ['third badge', () => withThirdBadge(withSecondBadge(withBadge(withStarter(baseState()))))],
  ['fourth badge', () => withFourthBadge(withThirdBadge(withSecondBadge(withBadge(withStarter(baseState())))))],
  ['inside Galactic HQ', () => insideGalactic(withFourthBadge(withThirdBadge(withSecondBadge(withBadge(withStarter(baseState()))))))],
  ['knows the twist', () => withTwist(withCommander(withCave(withBadge(withStarter(baseState())))))],
  // The wet south: Pastoria, the marsh, and the lake that stopped being one.
  ['fifth badge', () => withFifthBadge(withFourthBadge(withThirdBadge(withSecondBadge(withBadge(withStarter(baseState()))))))],
  ['saw Lake Valor go', () => afterLakeValor(withFifthBadge(withFourthBadge(withThirdBadge(withSecondBadge(withBadge(withStarter(baseState())))))))],
  // The highlands: the fog road opening, and the shrine after it.
  ['past the Psyduck', () => pastThePsyduck(afterLakeValor(withFifthBadge(withFourthBadge(withThirdBadge(withSecondBadge(withBadge(withStarter(baseState()))))))))],
  ['read the library', () => afterCanalave(afterCelestic(afterLakeValor(withFifthBadge(withFourthBadge(withThirdBadge(withSecondBadge(withBadge(withStarter(baseState())))))))))],
  ['read the mural', () => afterCelestic(afterLakeValor(withFifthBadge(withFourthBadge(withThirdBadge(withSecondBadge(withBadge(withStarter(baseState()))))))))],
];

// ---- 1. every NPC answers, at every stage ----------------------------------

const fired = new Map();          // "map/npc" -> Set of branch indices seen
let spoken = 0;

// Every stage is asked twice: alone, and with the other player in the world.
// Without this half the co-op lines would be branches nothing ever reaches.
const LINKS = [
  ['', null],
  [' + linked', { connected: true, partner: { name: 'Robin' } }],
];

for (const [stageLabel, build] of STAGES) {
 for (const [linkLabel, link] of LINKS) {
  const label = stageLabel + linkLabel;
  const st = build();
  const snap = worldSnapshot(st, link);
  check(!!snap.champion, `[${label}] snapshot has no champion`);

  for (const map of Object.values(MAPS)) {
    for (const npc of map.npcs) {
      for (const key of ['dialogue', 'after']) {
        const d = npc[key];
        if (!d) continue;
        const tag = `${map.id}/${npc.id}.${key}`;
        // Ask several times so pooled remarks all get exercised.
        for (let turn = 0; turn < 4; turn++) {
          const lines = resolveDialogue(d, st, turn, link);
          check(!!lines && lines.length > 0, `[${label}] ${tag} said nothing`);
          if (!lines) continue;
          spoken++;
          for (const l of lines) {
            check(!/\{\w+\}/.test(l), `[${label}] ${tag} left an unfilled slot: ${l}`);
            check(l.trim().length > 0, `[${label}] ${tag} produced an empty line`);
          }
        }
        // Which branch fired? Recorded so dead branches show up below.
        if (!Array.isArray(d) || d.every((e) => typeof e === 'string')) continue;
        const idx = d.findIndex((e) => typeof e !== 'string' && matches(e.when, snap));
        if (idx >= 0) {
          if (!fired.has(tag)) fired.set(tag, new Set());
          fired.get(tag).add(idx);
        }
      }
    }
  }
 }
}
console.log(`  spoke ${spoken} conversations across ${STAGES.length} career stages`);

// ---- 2. no branch is unreachable -------------------------------------------

let dead = 0;
for (const map of Object.values(MAPS)) {
  for (const npc of map.npcs) {
    for (const key of ['dialogue', 'after']) {
      const d = npc[key];
      if (!Array.isArray(d) || d.every((e) => typeof e === 'string')) continue;
      const tag = `${map.id}/${npc.id}.${key}`;
      const seen = fired.get(tag) || new Set();
      d.forEach((e, i) => {
        if (typeof e === 'string') return;
        if (!seen.has(i)) {
          console.log(`  FAIL  ${tag}[${i}] never fires in any career stage`);
          dead++;
        }
      });
    }
  }
}
fails += dead;
check(dead === 0, `${dead} unreachable dialogue branch(es)`);

// ---- 3. the world agrees with itself ---------------------------------------
// The champion an NPC names has to be the trainer actually top of the table.
{
  const st = asChampion(withStarter(baseState()));
  const snap = worldSnapshot(st);
  check(snap.championIsPlayer, 'the player should be world number one at that rating');
  check(fill('{champion}', snap) === st.player.name, 'a champion mention should name the player');
  check(snap.place === 1, `player should be placed 1st, got ${snap.place}`);

  const rookie = worldSnapshot(baseState());
  check(!rookie.championIsPlayer, 'a fresh save should not be world number one');
  check(fill('{champion}', rookie) !== rookie.playerName, 'a rookie should not be named as champion');
  check(fill('{rank}', rookie) === 'Rookie', `fresh rank should be Rookie, got ${fill('{rank}', rookie)}`);
}

// ---- 4. conditions are strict ----------------------------------------------
{
  const snap = worldSnapshot(withBadge(withStarter(baseState())));
  check(matches({ badges: 1 }, snap), 'badges:1 should match one badge');
  check(!matches({ badges: 2 }, snap), 'badges:2 should not match one badge');
  check(matches({ flag: 'gotStarter' }, snap), 'flag should match');
  check(!matches({ flag: 'nope' }, snap), 'an unset flag should not match');
  check(!matches({ nonsense: true }, snap), 'an unknown clause must never pass');
  // A rank id the resolver cannot find used to clamp to index 0, which made a
  // typo'd condition always true — an end-game line on a brand-new save.
  check(!matches({ rank: 'legend' }, snap), 'a rank far above the player must not match');
  check(!matches({ rank: 'contendor' }, snap), 'a misspelled rank id must never pass');
  check(!matches({ rank: '' }, snap), 'an empty rank id must never pass');
  check(matches({ rank: 'rookie' }, snap), 'the player\'s own rank must match');
  check(matches({ any: [{ badges: 9 }, { flag: 'gotStarter' }] }, snap), 'any: should match');
  check(matches({ all: [{ badges: 1 }, { flag: 'gotStarter' }] }, snap), 'all: should match');
  check(!matches({ not: { badges: 1 } }, snap), 'not: should invert');
}

// ---- 5. dialogue survives the save layer -----------------------------------
{
  const st = withTitles(withBadge(withStarter(baseState())), 2);
  const back = deserializeState(JSON.parse(JSON.stringify(serializeState(st))));
  const a = resolveDialogue(MAPS.oreburgh.npcs.find((n) => n.id === 'al_fan').dialogue, st, 0);
  const b = resolveDialogue(MAPS.oreburgh.npcs.find((n) => n.id === 'al_fan').dialogue, back, 0);
  check(JSON.stringify(a) === JSON.stringify(b),
    `the same NPC said different things after a save:\n    ${JSON.stringify(a)}\n    ${JSON.stringify(b)}`);
}

// ---- 6. a sample of what the world sounds like ------------------------------
{
  console.log('\n  --- Tam, from Twinleaf, across a career ---');
  const tam = MAPS.twinleaf.npcs.find((n) => n.id === 'bv_kid');
  for (const [label, build] of STAGES) {
    const lines = resolveDialogue(tam.dialogue, build(), 0);
    console.log(`  [${label}]\n    ${lines.join('\n    ')}`);
  }
}

console.log(fails ? `\n${fails} failure(s)` : '\ndialogue: all checks passed');
process.exit(fails ? 1 : 0);
