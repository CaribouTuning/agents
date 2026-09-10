// The story, beat by beat.
//
// The plot turns on one fact revealed late, and almost every scene before it is
// written to mean something different afterwards. That only works if the beats
// actually fire, in order, once each — and if the journal records what the
// player has worked out rather than what the engine did.
//
// This runs the story headlessly: no canvas, no browser. It drives the same
// scripts the game runs, with a fake cutscene context that records every line.
import { readFile } from 'node:fs/promises';
import { SCRIPTS } from '../src/game/overworld/scripts.js';
import { createGameState, serializeState, deserializeState } from '../src/game/state.js';
import { createMonster } from '../src/game/monster.js';
import { FLAGS } from '../src/game/storyflags.js';
import { ENTRIES, entriesFor, objective, record } from '../src/game/journal.js';
import { CASS, ROWAN, MARS, EVERLIGHT, DOCUMENTS } from '../src/data/story.js';
import { TRAINERS } from '../src/data/trainers.js';
import { unrenderable } from '../src/render/font.js';
import { worldSnapshot, isKnownSlot } from '../src/game/overworld/gossip.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log(`  FAIL  ${msg}`); fails++; } };

/**
 * A cutscene context that says everything to an array instead of a screen.
 * `answers` queues replies to ctx.ask, `battles` queues win/lose, `wilds`
 * queues the outcome of a wild encounter.
 */
function fakeCtx(state, opts = {}) {
  const said = [];
  const journalIds = [];
  const answers = [...(opts.answers || [])];
  const battles = [...(opts.battles || [])];
  const wilds = [...(opts.wilds || [])];
  const spawned = [];
  const ctx = {
    state,
    said, journalIds, spawned,
    get player() { return { x: 5, y: 5 }; },
    say: async (t) => { said.push(String(t)); },
    ask: async (q, options) => {
      said.push(String(q));
      const a = answers.length ? answers.shift() : 0;
      said.push(`> ${options[a]}`);
      return a;
    },
    wait: async () => {},
    sfx: () => {}, cry: () => {}, shake: () => {},
    walk: async () => {}, approach: async () => {}, exclaim: () => {},
    spawnNpc: (cfg) => { spawned.push(cfg); return { ...cfg, data: cfg }; },
    despawn: () => {},
    battle: async () => (battles.length ? battles.shift() : true),
    wild: async () => (wilds.length ? wilds.shift() : 'run'),
    warpTo: async () => {},
    give: (id, n) => { state.inventory.items[id] = (state.inventory.items[id] || 0) + n; },
    hasItem: (id) => (state.inventory.items[id] || 0) > 0,
    setFlag: (k, v = true) => { state.flags[k] = v; },
    shareMilestone: () => {},
    awardBadge: (n) => { if (!state.badges.includes(n)) state.badges.push(n); },
    dex: { seen: (id) => { state.dex.seen[id] = true; }, caught: (id) => { state.dex.caught[id] = true; } },
    showMonster: async () => {}, hideMonster: () => {},
    healAnimation: async () => {}, setHealPoint: () => {},
    openShop: async () => {}, autosave: () => {},
    joinCircuit: () => { state.circuit.joined = true; },
    openCircuit: () => {}, resumeTournament: () => {},
    askNickname: async () => {},
    journal: (id) => { journalIds.push(id); record(state, id); },
    fill: (lines) => lines.map((l) => l.replace(/\{starter\}/g, 'Turtwig')),
  };
  return ctx;
}

function freshState() {
  const st = createGameState({ name: 'Matthew' });
  st.player.look = 'boy';
  return st;
}

// ---- 1. the opening ----------------------------------------------------------
{
  const st = freshState();
  const ctx = fakeCtx(st, { answers: [0, 0] });     // pick Turtwig, confirm
  await SCRIPTS.starter(ctx);
  check(st.party.length === 1, 'the professor should hand over a Pokémon');
  check(!!st.flags[FLAGS.GOT_STARTER], 'the starter flag should be set');
  check((st.inventory.items.pokedex || 0) > 0, 'the Pokédex should be given');

  const script = ctx.said.join(' ');
  // The aside that the whole plot later turns on has to actually be said, in
  // the first scene, where nobody will notice it.
  check(/ambient light/i.test(script),
    'Rowan must mention the light sensor in the opening scene');
  check(ctx.journalIds.includes('gotStarter'), 'the opening should write a journal entry');
}

// ---- 2. Cass, three times ------------------------------------------------------
{
  const st = freshState();
  st.flags[FLAGS.GOT_STARTER] = true;
  st.starterBase = 1;
  st.party = [createMonster(1, 10)];

  const c1 = fakeCtx(st, { battles: [true] });
  await SCRIPTS.rival1(c1);
  check(c1.spawned[0] && c1.spawned[0].name === CASS.name,
    `the rival should be ${CASS.name}, got ${c1.spawned[0] && c1.spawned[0].name}`);
  check(c1.said.join(' ').includes('Turtwig'),
    'Cass should name the starter you actually chose');
  check(!!st.flags[FLAGS.BEAT_RIVAL_1], 'beating her should set the flag');

  const c2 = fakeCtx(st, { battles: [true] });
  await SCRIPTS.rival2(c2);
  check(/1180/.test(c2.said.join(' ')),
    'the second meeting should introduce her circuit rating');
  check(!!st.flags[FLAGS.BEAT_RIVAL_2], 'the second rival flag should be set');

  const c3 = fakeCtx(st, { battles: [true] });
  await SCRIPTS.rival3(c3);
  check(!!st.flags[FLAGS.BEAT_RIVAL_3], 'the third rival flag should be set');
  check((st.inventory.items.hyperpotion || 0) === 3, 'she should hand over her potions');
  const third = c3.said.join(' ');
  check(/do not go in/i.test(third), 'the third meeting should be a warning, not a challenge');

  // She is the same person as the circuit pro. One relationship, not two.
  check(TRAINERS.rival_1.name === CASS.name && TRAINERS.rival_3.name === CASS.name,
    'every rival battle should be the same named person');
}

// ---- 3. the turn ----------------------------------------------------------------
{
  const st = freshState();
  st.flags[FLAGS.BEAT_COMMANDER] = true;
  const ctx = fakeCtx(st, { answers: [0] });
  await SCRIPTS.charmFound(ctx);
  const said = ctx.said.join(' ');

  check(!!st.flags[FLAGS.KNOWS_TWIST], 'the reveal should set its flag');
  // The three things the reveal has to land, or it is just atmosphere.
  check(/Galactic made it|key, and Galactic/i.test(said),
    'the reveal must say the charm is Galactic\'s');
  check(/stepped aside/i.test(said),
    'the reveal must recast the Mars fight as a hand-off');
  check(/thirty-one years/i.test(said),
    'the reveal must include Rowan\'s own failed attempt');
  check(/wanted in/i.test(said),
    'the reveal must explain why the door refused him');

  // It fires once.
  const again = fakeCtx(st, { answers: [0] });
  await SCRIPTS.charmFound(again);
  check(again.said.length === 0, 'the reveal must not repeat');
}

// ---- 4. Mars reads differently on the way out -------------------------------------
{
  // Her first scene and her last have to be consistent: the withdrawal is the
  // hinge, and it has to be there before the player knows what it means.
  const early = MARS.withdraw.join(' ');
  check(/without collecting/i.test(early),
    'Mars must leave her equipment behind, in the scene before the reveal');
  const late = MARS.late.join(' ');
  check(/fourteen months/i.test(late) && /picked YOU/i.test(late),
    'her late scene must state the operation and that they chose the player');
}

// ---- 5. the chamber ---------------------------------------------------------------
{
  const st = freshState();
  st.flags[FLAGS.EVERLIGHT_OPENED] = true;
  st.party = [createMonster(1, 30)];

  const declined = fakeCtx(st, { wilds: ['lose'] });
  await SCRIPTS.everlightDialga(declined);
  check(!!st.flags[FLAGS.EVERLIGHT_RESOLVED], 'the encounter should resolve');
  check(!st.flags[FLAGS.CAUGHT_EVERLIGHT], 'losing must not count as catching');
  check(!!st.dex.seen[37], 'Dialga should be registered as seen');
  check(!!st.flags[FLAGS.MARS_LATE], 'Mars should arrive after the encounter');
  const firstText = declined.said.join(' ');
  check(/back to the door/i.test(firstText),
    'the first sight must establish it was holding the door, not guarding a prize');
  check(/relieved/i.test(firstText), 'it should read as relieved, not hostile');

  // Coming back: the sentry is still there, Mars does not arrive twice.
  const retry = fakeCtx(st, { wilds: ['caught'] });
  await SCRIPTS.everlightDialga(retry);
  check(!!st.flags[FLAGS.CAUGHT_EVERLIGHT], 'catching it should set the flag');
  check(!/Four hours/.test(retry.said.join(' ')), 'Mars must not arrive twice');

  const quiet = fakeCtx(st, {});
  await SCRIPTS.everlightDialga(quiet);
  check(/quiet now/i.test(quiet.said.join(' ')), 'the chamber should be quiet afterwards');
}

// ---- 6. documents are readable and say something ----------------------------------
{
  for (const [key, doc] of Object.entries(DOCUMENTS)) {
    const st = freshState();
    const ctx = fakeCtx(st, {});
    await SCRIPTS[`doc${key[0].toUpperCase()}${key.slice(1)}`](ctx);
    check(ctx.said.length > 1, `${key} should have something to read`);
    check(ctx.said[0].includes(doc.title), `${key} should announce its title`);
    check(ctx.journalIds.includes(`doc_${key}`), `${key} should write a journal entry`);
  }
  // The memo has to be solvable: it tells you the artefact must not be carried
  // in by staff, which is the whole twist stated plainly and ignored.
  check(/NOT to be carried/i.test(DOCUMENTS.memo.pages.join(' ')),
    'the memo should let an attentive player work the twist out early');
}

// ---- 7. the journal ---------------------------------------------------------------
{
  const st = freshState();
  check(objective(st).length > 0, 'a fresh save should still have an objective');

  // Every entry a script can write must exist, and vice versa: an entry no
  // script ever writes is a page the player can never turn to.
  // Read the file, not the functions: a script built by a factory closes over
  // its journal id, and String(fn) of the closure does not contain it.
  const scriptSource = await readFile(
    new URL('../src/game/overworld/scripts.js', import.meta.url), 'utf8');
  for (const e of ENTRIES) {
    check(scriptSource.includes(`'${e.id}'`),
      `journal entry "${e.id}" is never written by any script`);
    check(e.title.length > 0 && e.body.length > 0, `journal entry "${e.id}" is empty`);
  }

  // Recording is idempotent and ordered.
  record(st, 'gotStarter');
  record(st, 'gotStarter');
  record(st, 'theKey');
  const mine = entriesFor(st);
  check(mine.length === 2, `duplicate entries should collapse, got ${mine.length}`);
  check(mine[0].id === 'gotStarter' && mine[1].id === 'theKey',
    'entries should read in story order, not the order they were recorded');
  check(objective(st) === ENTRIES.find((e) => e.id === 'theKey').next,
    'the objective should come from the latest entry that has one');

  // And it survives a save.
  const back = deserializeState(JSON.parse(JSON.stringify(serializeState(st))));
  check(JSON.stringify(entriesFor(back).map((e) => e.id)) === JSON.stringify(mine.map((e) => e.id)),
    'the journal should survive a save/load round trip');
  const junk = deserializeState({ journal: { seen: ['not_a_real_entry', 'theKey'] } });
  check(entriesFor(junk).length === 1, 'a corrupt journal should drop unknown entries');
}

// ---- 8. every word of it is printable and slot-clean --------------------------------
{
  const st = freshState();
  const snap = worldSnapshot(st);
  // One authored line is one dialogue page. The narrowest screen the game
  // supports fits 33 characters across and three lines down, so anything over
  // 99 splits mid-sentence onto a second page.
  let pageLimit = 99;
  const walk = (node, path) => {
    if (typeof node === 'string') {
      const bad = unrenderable(node.replace(/\{\w+\}/g, ''));
      check(bad.length === 0, `${path} has characters the font cannot draw: ${bad.join(' ')}`);
      for (const m of node.matchAll(/\{(\w+)\}/g)) {
        check(isKnownSlot(m[1]), `${path} uses unknown slot {${m[1]}}`);
      }
      // Each authored line is one dialogue page; 99 characters is what the
      // narrowest screen fits before it splits mid-sentence.
      for (const page of node.split('\f')) {
        check(page.length <= pageLimit, `${path} has a ${page.length}-character page`);
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${path}[${i}]`)); return; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
    }
  };
  walk({ CASS, ROWAN, MARS, EVERLIGHT, DOCUMENTS }, 'story');
  // The journal draws its own text with its own wrapper and scrolls, so the
  // dialogue box's three-lines-a-page limit does not apply to it. Everything
  // else about its text does.
  pageLimit = Infinity;
  walk(ENTRIES, 'journal');
  void snap;
}

console.log(fails ? `\n${fails} failure(s)` : '\nstory: all checks passed');
process.exit(fails ? 1 : 0);
