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
import { readFileSync } from 'node:fs';
import { SCRIPTS } from '../src/game/overworld/scripts.js';
import { createGameState, serializeState, deserializeState } from '../src/game/state.js';
import { createMonster } from '../src/game/monster.js';
import { FLAGS } from '../src/game/storyflags.js';
import { ENTRIES, entriesFor, objective, record } from '../src/game/journal.js';
import { CASS, ROWAN, MARS, EVERLIGHT, DOCUMENTS, BANDIT } from '../src/data/story.js';
import { TRAINERS } from '../src/data/trainers.js';
import { unrenderable } from '../src/render/font.js';
import { MAPS } from '../src/data/maps/index.js';
import { worldSnapshot, isKnownSlot, fillText } from '../src/game/overworld/gossip.js';

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
    // The other one walked in here with the player, so the lab scene should
    // run the branch where they take the last starter.
    companionHere: () => true,
    companionJoin: () => { state.companion = { active: true }; },
    companionLeave: () => { if (state.companion) state.companion.active = false; },
    petJoin: (who) => { state.pet = { ...who, active: true }; },
    petLeave: () => { if (state.pet) state.pet.active = false; },
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
    fill: (lines) => lines.map((l) => l.replace(/\{starter\}/g, 'Turtwig').replace(/\{partner\}/g, 'Robin')),
    linked: () => !!opts.linked,
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

// ---- 1a. the doorstep ---------------------------------------------------------
// Rowan announcing that Bandit has joined the party while Bandit is visibly
// still sitting outside Sammy's front door is the kind of thing that stops a
// world being a world. She comes off the step the moment she is with you —
// which for Sammy is the doorstep scene, and for Matthew is Sammy leaving
// with him, because the dog goes where Sammy goes.
{
  const twinleaf = MAPS.twinleaf;
  const bandit = twinleaf.npcs.find((n) => n.id === 'tw_bandit');
  check(!!bandit, 'Bandit should be standing outside at the start');
  check(bandit.goneWhen === 'banditWithUs',
    'and should stop being there once she is with you');

  for (const look of ['sammy', 'matthew']) {
    const st = createGameState({ name: look === 'sammy' ? 'Sammy' : 'Matthew', look });
    st.flags.mumSentYouOff = true;
    const ctx = fakeCtx(st);
    await SCRIPTS.buddyWaiting(ctx);
    check(!!st.flags.banditWithUs,
      `playing as ${look}, Bandit should leave the step when the two of you set off`);
  }
}

// ---- 1b. Bandit ---------------------------------------------------------------
// He is Sammy's dog and only Sammy's. Matthew hears about him instead.
{
  const sammy = createGameState({ name: 'Sammy', look: 'sammy' });
  const ctx = fakeCtx(sammy, { answers: [0, 0] });
  await SCRIPTS.starter(ctx);
  check(sammy.party.length === 2, `Sammy should leave the lab with two, got ${sammy.party.length}`);
  const dog = sammy.party[1];
  check(dog && dog.species === BANDIT.species, `the second one should be a Houndour, got ${dog && dog.species}`);
  check(dog && dog.nickname === 'Bandit', `he should already be called Bandit, got ${dog && dog.nickname}`);
  check(dog && dog.friendship > 150, 'Bandit should arrive already attached to her');
  check(!!sammy.flags.hasBandit, 'the Bandit flag should be set');
  check(ctx.journalIds.includes('bandit'), 'Bandit should get a journal entry');
  check(/sausages|followed you|picks a person/i.test(ctx.said.join(' ')),
    'the scene should explain where he came from');

  // Twice through the lab must not give her two dogs.
  const again = fakeCtx(sammy, { answers: [0, 0] });
  await SCRIPTS.starter(again);
  check(sammy.party.length === 2, 'Bandit must not join twice');

  const matthew = createGameState({ name: 'Matthew', look: 'matthew' });
  const mctx = fakeCtx(matthew, { answers: [0, 0] });
  await SCRIPTS.starter(mctx);
  check(matthew.party.length === 1, 'Matthew should leave the lab with one');
  check(!matthew.flags.hasBandit, 'Bandit is not Matthew\u2019s');
}

// ---- 2. Cass, three times ------------------------------------------------------
{
  const st = freshState();
  st.flags[FLAGS.GOT_STARTER] = true;
  st.starterBase = 1;
  st.party = [createMonster(387, 10)];

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

  // Linked: she has to notice the other player is standing there.
  const c3linked = fakeCtx(st, { battles: [true], linked: true });
  await SCRIPTS.rival3(c3linked);
  check(/Robin/.test(c3linked.said.join(' ')),
    'Cass should name the other trainer when the two of you are linked');
  st.flags[FLAGS.BEAT_RIVAL_3] = false;
  st.inventory.items.hyperpotion = 0;

  const c3 = fakeCtx(st, { battles: [true] });
  await SCRIPTS.rival3(c3);
  check(!/Robin/.test(c3.said.join(' ')),
    'Cass should not mention a partner who is not there');
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

  // And the call acknowledges the second trainer when there is one.
  const st2 = freshState();
  st2.flags[FLAGS.BEAT_COMMANDER] = true;
  const linkedCall = fakeCtx(st2, { answers: [0], linked: true });
  await SCRIPTS.charmFound(linkedCall);
  check(/Robin/.test(linkedCall.said.join(' ')),
    'Rowan should ask after the other trainer when the two of you are linked');

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

// ---- 5a. the chamber, too early ----------------------------------------------
// Walking in before Canalave is a sighting, not the end of the game. This
// used to resolve the whole story about two hours in.
{
  const early = freshState();
  early.flags[FLAGS.EVERLIGHT_OPENED] = true;
  early.party = [createMonster(387, 30)];
  const ctx = fakeCtx(early, { wilds: ['caught'] });
  await SCRIPTS.everlightDialga(ctx);
  check(!early.flags[FLAGS.EVERLIGHT_RESOLVED],
    'walking in before Canalave must NOT resolve the Everlight');
  check(!early.flags[FLAGS.CAUGHT_EVERLIGHT],
    'and must not let it be caught either');
  check(!!early.flags[FLAGS.EVERLIGHT_SEEN],
    'but it is seen, and the journal says so');
  check(/waiting for you to understand/i.test(ctx.said.join(' ')),
    'and it tells you plainly that you are missing something');
}

// ---- 5. the chamber ---------------------------------------------------------------
{
  const st = freshState();
  st.flags[FLAGS.EVERLIGHT_OPENED] = true;
  // The chamber opens in the first act; understanding it does not. The
  // encounter is gated on having read Volume III in Canalave, so a test of
  // the climax has to be a save that has actually got there.
  st.flags[FLAGS.CANALAVE_TRUTH] = true;
  // Deliberately NOT `everlightSeen`: this is somebody who never went in
  // early and walks down for the first time already knowing what the floor
  // is for, which is a perfectly ordinary way to play it.
  st.party = [createMonster(387, 30)];

  const declined = fakeCtx(st, { wilds: ['lose'] });
  await SCRIPTS.everlightDialga(declined);
  check(!!st.flags[FLAGS.EVERLIGHT_RESOLVED], 'the encounter should resolve');
  check(!st.flags[FLAGS.CAUGHT_EVERLIGHT], 'losing must not count as catching');
  check(!!st.dex.seen[483], 'Dialga should be registered as seen');
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
  // Not only scripts: the end of the game is recorded by the Circuit screen,
  // because winning the Finals happens in a tournament rather than on a tile.
  const scriptSource = (await Promise.all([
    readFile(new URL('../src/game/overworld/scripts.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/circuit.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/overworld.js', import.meta.url), 'utf8'),
  ])).join('\n');
  for (const e of ENTRIES) {
    check(scriptSource.includes(`'${e.id}'`),
      `journal entry "${e.id}" is never written by anything`);
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
  // The guide bar reads the player's actual state, not the last thing they
  // happened to write down: recording a late journal entry must not make it
  // claim the early story is finished.
  check(objective(st) === "Go to Prof. Rowan's lab, north of your house.",
    `a player with no starter should still be sent to the lab, got "${objective(st)}"`);
  st.flags.gotStarter = true;
  st.flags.reachedOreburgh = true;
  st.player.map = 'oreburgh';
  check(/COAL BADGE/.test(objective(st)),
    `standing in Oreburgh without the badge should point at the Gym, got "${objective(st)}"`);
  st.flags.badge1 = true;
  check(!/COAL BADGE/.test(objective(st)),
    'the badge objective should clear once the badge is won');

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

console.log('\n--- the road from the first morning to the Everlight is unbroken ---');
{
  // Every link in the chain that leads to the climax, checked as a chain
  // rather than as pieces. `SCRIPTS.commander` was written, worked perfectly
  // when called, and was placed on no map — so `beatCommander` was never set,
  // the Aurora Charm never appeared, the seam never opened, and the back half
  // of the story could not be reached from a save that had done everything
  // right. Nothing failed. It just was not there.
  const placed = new Set();
  const npcScripts = new Map();
  for (const map of Object.values(MAPS)) {
    for (const n of map.npcs) if (n.script) { placed.add(n.script); npcScripts.set(n.script, map.id); }
    for (const e of map.events || []) if (e.script) { placed.add(e.script); npcScripts.set(e.script, map.id); }
    for (const o of map.objects || []) if (o.script) { placed.add(o.script); npcScripts.set(o.script, map.id); }
  }

  // The chain, in the order it has to happen.
  const chain = [
    ['starter', 'Rowan hands over a Pokemon'],
    ['rival1', 'Cass keeps the appointment she made'],
    ['rival2', 'Cass, the second time'],
    ['commander', 'Mars in the cave — the only thing that sets beatCommander'],
    ['charmFound', 'the Aurora Charm on the floor she left it on'],
    ['everlight', 'the seam in the rock'],
    ['everlightDialga', 'the Everlight itself'],
    ['rowanAfter', 'Rowan outside the Gate, afterwards'],
  ];
  for (const [name, what] of chain) {
    check(placed.has(name), `${what} is somewhere a player can reach it`,
      placed.has(name) ? `on ${npcScripts.get(name)}` : 'PLACED NOWHERE');
  }

  // And the flag each link needs is set by the link before it.
  const src = readFileSync(new URL('../src/game/overworld/scripts.js', import.meta.url), 'utf8');
  const sets = (flag) => new RegExp(`setFlag\\((?:FLAGS\\.[A-Z_]+|'${flag}')`).test(src)
    && (src.includes(`'${flag}'`) || Object.values(FLAGS).includes(flag));
  for (const flag of ['beatCommander', 'knowsTwist', 'everlightOpened', 'everlightResolved']) {
    check(sets(flag), `something sets ${flag}`);
  }
}

console.log('\n--- nothing the game can say still has a {slot} in it ---');
{
  // Rowan told every player that "{leagueBadges} of those and the League has
  // to let you in" — with the braces, on screen, in her mouth. NPC dialogue
  // went through the slot filler and cutscene lines did not, so the moment a
  // script used a slot the player saw the template. `ctx.say` fills now, and
  // this proves every line in the story file survives it.
  const st = createGameState({ name: 'Matthew', look: 'matthew' });
  st.flags.gotStarter = true;
  st.starterBase = 387;
  st.party = [createMonster(387, 12)];

  const walk = (v, path) => {
    if (typeof v === 'string') {
      const out = fillText(v, st, null);
      const left = out.match(/\{(\w+)\}/g);
      if (left) check(false, `${path} still says ${left.join(' ')} after filling`);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  for (const [name, block] of Object.entries({ CASS, ROWAN, MARS, EVERLIGHT, DOCUMENTS, BANDIT })) {
    walk(block, `story.${name}`);
  }

  // And every line every NPC and sign in the world can say.
  for (const map of Object.values(MAPS)) {
    for (const n of map.npcs) {
      walk(n.dialogue, `${map.id}/${n.id}.dialogue`);
      walk(n.after, `${map.id}/${n.id}.after`);
    }
    for (const sg of map.signs || []) walk(sg.text, `${map.id} sign ${sg.x},${sg.y}`);
  }

  // The specific line that shipped broken.
  const rowan = ROWAN.send.map((l) => fillText(l, st, null)).join(' ');
  check(/\b6 of those\b/.test(rowan),
    'Rowan says the number of badges this build actually has', rowan.slice(-90));
  check(/Oreburgh/.test(rowan) && !/Gym in it/.test(rowan),
    'and puts Roark in Oreburgh rather than Jubilife');
}

console.log(fails ? `\n${fails} failure(s)` : '\nstory: all checks passed');
process.exit(fails ? 1 : 0);
