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
  const st = createGameState({ name });
  st.circuit = createCircuit();
  return st;
}

function withStarter(st) {
  st.flags.gotStarter = true;
  st.starterBase = 1;
  st.party = [createMonster(1, 5)];
  return st;
}

function withBadge(st) {
  st.badges = [1];
  st.flags.badge1 = true;
  st.flags.beatRival1 = true;
  st.flags.beat_gym1_leader = true;
  st.party = [createMonster(3, 20)];
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
  st.party = [createMonster(4, 45)];
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

const STAGES = [
  ['fresh save', () => baseState()],
  ['got a starter', () => withStarter(baseState())],
  ['first badge', () => withBadge(withStarter(baseState()))],
  ['into the cave', () => withCave(withBadge(withStarter(baseState())))],
  ['beat the commander', () => withCommander(withCave(withBadge(withStarter(baseState()))))],
  ['joined the circuit', () => joined(withBadge(withStarter(baseState())))],
  ['mid-tournament', () => midEvent(withBadge(withStarter(baseState())))],
  ['one title', () => withTitles(withBadge(withStarter(baseState())), 1)],
  ['three titles', () => withTitles(withCommander(withCave(withBadge(withStarter(baseState())))), 3)],
  ['all hype, no respect', () => loudmouth(withBadge(withStarter(baseState())))],
  ['all respect, no hype', () => wellLiked(withBadge(withStarter(baseState())))],
  ['world number one', () => asChampion(withCommander(withCave(withBadge(withStarter(baseState())))))],
];

// ---- 1. every NPC answers, at every stage ----------------------------------

const fired = new Map();          // "map/npc" -> Set of branch indices seen
let spoken = 0;

for (const [label, build] of STAGES) {
  const st = build();
  const snap = worldSnapshot(st);
  check(!!snap.champion, `[${label}] snapshot has no champion`);

  for (const map of Object.values(MAPS)) {
    for (const npc of map.npcs) {
      for (const key of ['dialogue', 'after']) {
        const d = npc[key];
        if (!d) continue;
        const tag = `${map.id}/${npc.id}.${key}`;
        // Ask several times so pooled remarks all get exercised.
        for (let turn = 0; turn < 4; turn++) {
          const lines = resolveDialogue(d, st, turn);
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
