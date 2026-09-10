// Story scripts.
//
// A script is an async function that receives a small `ctx` of primitives —
// say, ask, battle, give, wait, move — and awaits them. Writing cutscenes as
// straight-line async code keeps them readable, and keeps the sequencing out
// of the render loop entirely.
import { STARTER_LINES, rivalStarterBase, getTrainer } from '../../data/trainers.js';
import { getTournament } from '../../data/circuit.js';
import { getSpecies } from '../../data/species.js';
import { createMonster } from '../monster.js';
import { FLAGS } from '../storyflags.js';
import { CASS, ROWAN, MARS, EVERLIGHT, DOCUMENTS } from '../../data/story.js';

// The thing in the chamber: Dialga, by national dex number.
const EVERLIGHT_SPECIES = 483;

// A whole block of lines from the story bible, said one page at a time.
async function speak(ctx, lines, opts) {
  for (const line of lines) await ctx.say(line, opts);
}

export const SCRIPTS = {};

// ---- Professor Rowan: choosing a starter ---------------------------------

SCRIPTS.starter = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.GOT_STARTER]) {
    await ctx.say('Prof. Rowan: How is it settling in? Keep it close and it will keep you close.');
    return;
  }

  await speak(ctx, ROWAN.give);

  let chosen = -1;
  while (chosen < 0) {
    const pick = await ctx.ask('Which one will you take?', [
      'Turtwig', 'Chimchar', 'Piplup', 'Look again',
    ]);
    if (pick === 3) { await ctx.say('Prof. Rowan: Take your time. This is not a small decision.'); continue; }

    const line = STARTER_LINES[pick];
    const sp = getSpecies(line.base);
    await ctx.showMonster(line.base);
    await ctx.say(`${sp.name}, the ${sp.types.join('/')} type.\f${sp.dex}`);
    const sure = await ctx.ask(`Take ${sp.name}?`, ['Yes', 'No']);
    ctx.hideMonster();
    if (sure === 0) chosen = pick;
  }

  const base = STARTER_LINES[chosen].base;
  const mon = createMonster(base, 5);
  mon.ot = st.player.name;
  mon.otId = st.player.id;
  mon.caughtAt = 'rowan_lab';
  st.party.push(mon);
  st.starterBase = base;
  ctx.dex.caught(base);

  ctx.sfx('caught');
  await ctx.say(`${getSpecies(base).name} joined your team!`);
  await ctx.askNickname(mon);
  await speak(ctx, ROWAN.chosen);
  ctx.give('pokedex', 1);
  ctx.give('pokeball', 5);
  await ctx.say('You received the Pokédex and 5 Poké Balls!');
  // The aside that turns out to matter. Nobody remembers it the first time.
  await speak(ctx, ROWAN.dex);
  await speak(ctx, ROWAN.send);

  ctx.setFlag(FLAGS.GOT_STARTER);
  ctx.shareMilestone(FLAGS.GOT_STARTER);
  ctx.journal('gotStarter');
};

// ---- Rival battles ---------------------------------------------------------

function rivalTeam(st, trainerId) {
  const t = { ...getTrainer(trainerId) };
  const base = rivalStarterBase(st.starterBase || 1);
  t.team = t.team.map((entry) => {
    if (typeof entry !== 'string') return entry;
    const [, lvl] = entry.split(':');
    const level = parseInt(lvl, 10) || 5;
    // The rival's starter is the one that beats yours, evolved to match.
    const sp = getSpecies(base);
    let id = base;
    for (const evo of sp.evolutions) if (evo.method === 'level' && level >= evo.level) id = evo.into;
    const evolved = getSpecies(id);
    for (const evo of evolved.evolutions) if (evo.method === 'level' && level >= evo.level) id = evo.into;
    return { species: id, level, moves: null };
  });
  return t;
}

SCRIPTS.rival1 = async (ctx) => {
  const st = ctx.state;
  if (!st.flags[FLAGS.GOT_STARTER] || st.flags[FLAGS.BEAT_RIVAL_1]) return;

  const cass = ctx.spawnNpc({
    id: 'rival', look: CASS.look, x: ctx.player.x, y: ctx.player.y - 3,
    dir: 'down', name: CASS.name,
  });
  ctx.sfx('bump');
  await ctx.wait(0.35);
  await ctx.walk(cass, 'down', 2);
  await speak(ctx, CASS.first.approach);
  // She names your actual starter, because she got up early and picked its
  // counter on purpose, and she wants you to know that.
  await speak(ctx, ctx.fill(CASS.first.pick));
  await speak(ctx, CASS.first.pre);

  const t = rivalTeam(st, 'rival_1');
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) {
    await speak(ctx, CASS.first.lose);
    ctx.despawn(cass);
    return;
  }
  await speak(ctx, CASS.first.win);
  await ctx.walk(cass, 'up', 4);
  ctx.despawn(cass);
  ctx.setFlag(FLAGS.BEAT_RIVAL_1);
  ctx.setFlag(FLAGS.MET_RIVAL);
  ctx.setFlag(FLAGS.LEFT_TOWN);
  ctx.shareMilestone(FLAGS.LEFT_TOWN);
  ctx.journal('metCass');
};

SCRIPTS.rival2 = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.BEAT_RIVAL_2] || !st.flags[FLAGS.BEAT_RIVAL_1]) {
    ctx.setFlag(FLAGS.REACHED_ALDERMERE);
    return;
  }
  const cass = ctx.spawnNpc({
    id: 'rival', look: CASS.look, x: ctx.player.x, y: ctx.player.y - 2,
    dir: 'down', name: CASS.name,
  });
  await ctx.wait(0.3);
  await speak(ctx, CASS.second.approach);
  await speak(ctx, CASS.second.pre);

  const t = rivalTeam(st, 'rival_2');
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (won) {
    await speak(ctx, CASS.second.win);
    ctx.setFlag(FLAGS.BEAT_RIVAL_2);
    ctx.journal('cassCircuit');
  } else {
    await speak(ctx, CASS.second.lose);
  }
  await ctx.walk(cass, 'up', 3);
  ctx.despawn(cass);
  ctx.setFlag(FLAGS.REACHED_ALDERMERE);
  ctx.shareMilestone(FLAGS.REACHED_ALDERMERE);
};

/**
 * Route 207, at the mouth of the Gate. The first time she is not keeping
 * score — she is standing in your way because she does not want you to go in.
 */
SCRIPTS.rival3 = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.BEAT_RIVAL_3]) return;

  const cass = ctx.spawnNpc({
    id: 'rival', look: CASS.look, x: ctx.player.x, y: ctx.player.y - 2,
    dir: 'down', name: CASS.name,
  });
  ctx.exclaim(cass);
  await ctx.wait(0.4);
  await speak(ctx, CASS.third.approach);
  // She notices if you are not on your own.
  if (ctx.linked()) await speak(ctx, ctx.fill(CASS.linked));
  await speak(ctx, CASS.third.pre);

  const t = rivalTeam(st, 'rival_3');
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) {
    await speak(ctx, CASS.third.lose);
    ctx.despawn(cass);
    return;
  }
  await speak(ctx, CASS.third.win);
  ctx.give('hyperpotion', 3);
  await ctx.say('You received 3 Hyper Potions from Cass!');
  await ctx.walk(cass, 'down', 3);
  ctx.despawn(cass);
  ctx.setFlag(FLAGS.BEAT_RIVAL_3);
  ctx.journal('cassWarning');
};

// ---- Monster Centre ---------------------------------------------------------

SCRIPTS.heal = async (ctx) => {
  if (!ctx.state.party.length) {
    await ctx.say('Nurse: Come back when you have a monster with you!');
    return;
  }
  const yes = await ctx.ask('Nurse: Shall I heal your monsters to full health?', ['Yes', 'No']);
  if (yes !== 0) { await ctx.say('Nurse: We hope to see you again!'); return; }
  await ctx.say('Nurse: Certainly. One moment.', { instant: true });
  await ctx.healAnimation();
  await ctx.say('Nurse: Thank you for waiting.\fYour monsters are fully healed. We hope to see you again!');
  ctx.setHealPoint();
  ctx.autosave();
};

SCRIPTS.shop = async (ctx) => {
  await ctx.say('Clerk: Welcome! What can I get you?', { instant: true });
  await ctx.openShop();
};

// ---- Gym leader ---------------------------------------------------------------

SCRIPTS.gymLeader = async (ctx, npc) => {
  const t = getTrainer(npc.data.trainer);
  if (ctx.state.flags[`beat_${t.id}`]) {
    await ctx.say(`${t.name}: ${(npc.data.after || ['Straight through the stone.'])[0]}`);
    return;
  }
  await ctx.say(`${t.name}: ${t.intro}`, { speaker: t.name });
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) return;

  await ctx.say(`${t.name}: ${t.defeat}`, { speaker: t.name });
  ctx.sfx('badge');
  ctx.awardBadge(t.badge, t.badgeName);
  await ctx.say(`You received the ${t.badgeName}!`);
  if (t.tm) {
    ctx.give(t.tm, 1);
    await ctx.say(`${t.name}: And take this. It is the move that made me.`, { speaker: t.name });
  }
  ctx.setFlag(`badge${t.badge}`);
  ctx.shareMilestone(`badge${t.badge}`);
  if (t.badge === 1) ctx.journal('badge1');
  for (const line of npc.data.after || []) await ctx.say(`${t.name}: ${line}`, { speaker: t.name });
};

// ---- Team Galactic ---------------------------------------------------------------

SCRIPTS.commander = async (ctx, npc) => {
  const t = getTrainer(npc.data.trainer);
  if (ctx.state.flags[`beat_${t.id}`]) {
    for (const line of npc.data.after || []) await ctx.say(`Mars: ${line}`, { speaker: 'Mars' });
    return;
  }
  await speak(ctx, MARS.intro);
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) return;

  // Three short lines, and then she leaves her expensive instruments behind.
  // On the way in that reads as a threat and an oversight. It is neither.
  await speak(ctx, MARS.defeat, { speaker: 'Mars' });
  await speak(ctx, MARS.withdraw);
  ctx.setFlag(FLAGS.BEAT_COMMANDER);
  ctx.shareMilestone(FLAGS.BEAT_COMMANDER);
  ctx.journal('beatMars');
  for (const line of npc.data.after || []) await ctx.say(`Mars: ${line}`, { speaker: 'Mars' });
};

/**
 * The turn. Picking up the charm is the first time anything in the game tells
 * the player they have misread it — and it does so with a fact they were given
 * in the first five minutes and told not to worry about.
 */
SCRIPTS.charmFound = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.KNOWS_TWIST]) return;

  ctx.sfx('warp');
  await ctx.wait(0.4);
  await speak(ctx, ROWAN.call);
  const answer = await ctx.ask('What is it like?', ['It is warm.', 'It is old.', 'It is glowing faintly.']);
  if (answer !== 0) {
    await ctx.say('Prof. Rowan: Yes, yes. But is it WARM. In your hand. Right now.');
    await ctx.ask('Well?', ['...It is warm.']);
  }
  await speak(ctx, ROWAN.callTwist);
  if (ctx.linked()) await speak(ctx, ctx.fill(ROWAN.callLinked));
  await ctx.wait(0.3);
  await speak(ctx, ROWAN.callConfession);
  ctx.setFlag(FLAGS.KNOWS_TWIST);
  ctx.shareMilestone(FLAGS.KNOWS_TWIST);
  ctx.journal('theKey');
  ctx.autosave();
};

// ---- The Everlight ----------------------------------------------------------
//
// The payoff the whole region has been talking about. Four maps of NPCs, a
// scientist reading ninety-year-old survey notes, an old man watching the
// aurora come further south every night, and a commander who says the mountain
// is not finished with either of you — all of it pointed at a door that did
// not exist. This is the door.

SCRIPTS.everlight = async (ctx) => {
  const st = ctx.state;
  if (!ctx.hasItem('auroracharm')) { await speak(ctx, EVERLIGHT.shut); return; }

  if (!st.flags[FLAGS.EVERLIGHT_OPENED]) {
    await speak(ctx, EVERLIGHT.opening.slice(0, 3));
    ctx.sfx('warp');
    ctx.shake(1);
    await ctx.wait(0.9);
    await ctx.say(EVERLIGHT.opening[3]);
    ctx.setFlag(FLAGS.EVERLIGHT_OPENED);
    ctx.shareMilestone(FLAGS.EVERLIGHT_OPENED);
    ctx.journal('doorOpened');
    ctx.autosave();
  }
  await ctx.warpTo('everlight_chamber', 7, 7);
};

SCRIPTS.everlightDialga = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.CAUGHT_EVERLIGHT]) { await speak(ctx, EVERLIGHT.quiet); return; }

  await speak(ctx, st.flags[FLAGS.EVERLIGHT_RESOLVED] ? EVERLIGHT.again : EVERLIGHT.firstSight);

  ctx.dex.seen(EVERLIGHT_SPECIES);
  await ctx.showMonster(EVERLIGHT_SPECIES);
  ctx.cry(EVERLIGHT_SPECIES);
  await ctx.wait(0.5);
  ctx.hideMonster();

  const level = Math.max(30, Math.min(55, (st.party[0] ? st.party[0].level : 30) + 6));
  const result = await ctx.wild(EVERLIGHT_SPECIES, level, {
    name: 'The Everlight', canRun: true, monster: { friendship: 0 },
  });

  ctx.setFlag(FLAGS.EVERLIGHT_RESOLVED);
  if (result === 'caught') {
    ctx.setFlag(FLAGS.CAUGHT_EVERLIGHT);
    ctx.shareMilestone(FLAGS.CAUGHT_EVERLIGHT);
    ctx.sfx('badge');
    await speak(ctx, EVERLIGHT.caught);
    ctx.journal('caughtEverlight');
  } else if (result === 'run') {
    await speak(ctx, EVERLIGHT.fled);
  } else {
    // Knocked out is not gone. A legendary you can permanently lose is a save
    // file you have to restart, and nobody has ever enjoyed that.
    await speak(ctx, EVERLIGHT.declined);
  }
  ctx.autosave();

  // Mars arrives four hours late, and finally says what the operation was.
  if (!st.flags[FLAGS.MARS_LATE]) {
    ctx.setFlag(FLAGS.MARS_LATE);
    await ctx.wait(0.5);
    ctx.sfx('bump');
    await speak(ctx, MARS.late, { speaker: 'Mars' });
    await speak(ctx, st.flags[FLAGS.CAUGHT_EVERLIGHT] ? MARS.lateCaught : MARS.lateLeft);
    ctx.journal('marsLate');
    ctx.autosave();
  }
};

/** Rowan is waiting outside the Gate. He could not go in. He tried. */
SCRIPTS.rowanAfter = async (ctx) => {
  const st = ctx.state;
  await speak(ctx, ROWAN.after);
  if (st.flags[FLAGS.CAUGHT_EVERLIGHT]) await speak(ctx, ROWAN.afterCaught);
  ctx.journal('rowanOutside');
};

// ---- documents ---------------------------------------------------------------
// Things lying around that nobody makes you read, each one a piece of the turn,
// all of them available before the reveal. The story should be solvable, not
// merely survivable.

function readDocument(key, entryId) {
  return async (ctx) => {
    const doc = DOCUMENTS[key];
    if (!doc) return;
    await ctx.say(`*${doc.title}*`);
    for (const page of doc.pages) await ctx.say(page);
    ctx.journal(entryId);
  };
}

// The journal id is passed literally rather than built from the key, so a
// reader scanning this file — human or test — can see which entry each
// document writes.
SCRIPTS.docSurvey = readDocument('survey', 'doc_survey');
SCRIPTS.docMemo = readDocument('memo', 'doc_memo');
SCRIPTS.docLogbook = readDocument('logbook', 'doc_logbook');

// ---- The World Circuit registration desk -----------------------------------
//
// The one door into the side story, and the only place a run can be resumed —
// so a save taken mid-tournament always has somewhere to come back to.

SCRIPTS.circuitDesk = async (ctx) => {
  const c = ctx.state.circuit;

  if (c.active) {
    const t = getTournament(c.active.id);
    await ctx.say(`Registrar: You are still entered in the ${t ? t.name : 'event'}.\fThe floor is ready when you are.`);
    ctx.resumeTournament();
    return;
  }

  if (!ctx.state.party.length) {
    await ctx.say('Registrar: Circuit entry requires at least one Pokémon.\fCome back with a team.');
    return;
  }

  if (!c.joined) {
    await ctx.say('Registrar: Welcome to the Oreburgh Battle Hall.');
    await ctx.say('Registrar: This is a sanctioned venue of the World Circuit — the ranking\nevery professional trainer on the planet is measured against.');
    const yes = await ctx.ask('Registrar: Would you like to register as a competitor?', ['Yes', 'Not yet']);
    if (yes !== 0) { await ctx.say('Registrar: The desk is open whenever you change your mind.'); return; }
    ctx.joinCircuit();
    ctx.sfx('badge');
    await ctx.say('Registrar: Registered. You start unranked, like everyone does.');
    await ctx.say('Registrar: Win matches and your rating climbs. Reach a stage in an event\nand you bank Circuit Points, which is what promotes you.');
    await ctx.say('Registrar: Rookie Cup is open entry. That is where every career starts.');
    ctx.journal('joinedCircuit');
  }

  await ctx.openCircuit();
};

export function scriptFor(name) { return SCRIPTS[name] || null; }
