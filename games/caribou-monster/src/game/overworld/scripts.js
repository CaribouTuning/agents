// Story scripts.
//
// A script is an async function that receives a small `ctx` of primitives —
// say, ask, battle, give, wait, move — and awaits them. Writing cutscenes as
// straight-line async code keeps them readable, and keeps the sequencing out
// of the render loop entirely.
import { STARTER_LINES, rivalStarterBase, getTrainer } from '../../data/trainers.js';
import { getTournament } from '../../data/circuit.js';
import { getSpecies } from '../../data/species.js';
import { createMonster, displayName } from '../monster.js';
import {
  deposit, withdraw, feeFor, hasEgg, collectEgg, compatibilityText, eggHint, hatch,
} from '../daycare.js';
import {
  patchAt, plant, isRipe, harvest, tend, patchText, cropOf,
} from '../berries.js';
import { getItem, BERRY_IDS } from '../../data/items.js';
import { createDig } from '../underground/dig.js';
import { tableFor } from '../underground/treasure.js';
import {
  coolingFor, coolingText, isReady, markDug, seedFor,
} from '../underground/site.js';
import { LADDERS, ladderFor, BASE_ENTRY, BASE_BOARD } from '../../data/maps/underground.js';
import {
  GOODS, GOODS_IDS, ROOM, digBase, place, freeSpot, removeAt, describe,
  leaveNote, NOTE_MAX, costOf,
} from '../underground/base.js';
import { SPHERES, sphereCount } from '../underground/treasure.js';
import { makeRng } from '../../core/rng.js';
import {
  FIELD_MOVES, usability, refusalText, markCleared, isCleared,
} from '../fieldmoves.js';
import { weightedPick } from '../../core/rng.js';
import { spend, formatMoney as money } from '../inventory.js';
import { FLAGS } from '../storyflags.js';
import { CASS, ROWAN, MARS, EVERLIGHT, DOCUMENTS, BANDIT } from '../../data/story.js';
import { playerByLook } from '../players.js';

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

  await banditJoins(ctx);
};

/**
 * Bandit lets himself in.
 *
 * Only for the player who is Sammy — she is her dog, and the whole point of
 * her is that she chose one particular person. Matthew hears about her from
 * his Mum instead, and sees her trotting along behind Sammy on a link.
 */
async function banditJoins(ctx) {
  const st = ctx.state;
  if (st.flags[FLAGS.HAS_BANDIT]) return;
  const who = playerByLook(st.player.look);
  if (!who || who.key !== 'sammy') return;

  await speak(ctx, BANDIT.arrives);
  const dog = createMonster(BANDIT.species, BANDIT.level, {
    nickname: BANDIT.nickname,
    friendship: BANDIT.friendship,
    gender: BANDIT.gender,
  });
  dog.ot = st.player.name;
  dog.otId = st.player.id;
  dog.caughtAt = 'rowan_lab';
  st.party.push(dog);
  ctx.dex.seen(BANDIT.species);
  ctx.dex.caught(BANDIT.species);
  ctx.cry(BANDIT.species);
  await speak(ctx, BANDIT.joined);
  await ctx.say('Bandit joined your team!');
  ctx.setFlag(FLAGS.HAS_BANDIT);
  ctx.journal('bandit');
}

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

/**
 * The Trainers' School keeps a drawer of Potions for anyone who sits through
 * the whole lesson. Once each — it is a school, not a shop.
 */
SCRIPTS.schoolGift = async (ctx) => {
  const st = ctx.state;
  if (st.flags.schoolGift) {
    await ctx.say('Caretaker: Come back when you have something to ask.\fThe boards do not move.');
    return;
  }
  await ctx.say('Caretaker: Stayed for the whole lesson, did you?\fHere — the school keeps a few of these.');
  ctx.give('potion', 3);
  ctx.give('greatball', 2);
  ctx.sfx('buy');
  await ctx.say('You received 3 Potions and 2 Great Balls!');
  await ctx.say('Caretaker: Great Balls hold better than the plain ones.\fSave them for something you want.');
  ctx.setFlag('schoolGift');
};

/**
 * The link registry.
 *
 * Two trainers who walk the same road on the same afternoon can have it
 * written down, and the clerk gives each of them one half of a pair of bells.
 * It only works while the two of you are actually linked, which is the point:
 * it is a record of a thing you did together, not an item you can farm.
 */
SCRIPTS.pairRegistry = async (ctx) => {
  const st = ctx.state;
  if (st.flags.pairRegistered) {
    await ctx.say('Registrar: You are both on the register.\fSecond page, near the top. I checked this morning.');
    return;
  }
  if (!ctx.linked()) {
    await ctx.say('Registrar: This desk registers LINKED PAIRS.');
    await ctx.say('Registrar: Two trainers, one link, both stood in front of me.\fCome back when the pair of you are actually connected.');
    return;
  }
  await ctx.say('Registrar: Two of you on one link. Lovely.');
  await ctx.say(ctx.fill(['Registrar: Names for the register — you, and {partner}.'])[0]);
  ctx.give('pairbell', 1);
  ctx.sfx('badge');
  await ctx.say('You received a Pair Bell!');
  await ctx.say('Registrar: There are two. Your one is the other one\u2019s pair.');
  await ctx.say('Registrar: A Pokémon holding it settles quicker.\fSomething about knowing where it belongs.');
  ctx.setFlag('pairRegistered');
  ctx.journal('registered');
};

/**
 * The Day Care.
 *
 * Deposit, withdraw, and collect whatever turned up. The one rule enforced
 * here rather than in the system is that you may not hand over your last
 * Pokémon that can fight — walking out of the door with nothing but an Egg is
 * a softlock, not a decision.
 */
SCRIPTS.daycare = async (ctx) => {
  const st = ctx.state;
  const d = st.daycare;

  for (;;) {
    const boarded = d.mons.length;
    const options = [];
    if (boarded < 2) options.push('Leave one');
    if (boarded > 0) options.push('Take one back');
    if (hasEgg(d)) options.push('Take the Egg');
    options.push('How are they?');
    options.push('Leave');

    const summary = boarded === 0
      ? 'Day-Care Lady: I am not looking after anything at the moment.'
      : `Day-Care Lady: I have ${d.mons.map((m) => displayName(m)).join(' and ')} here.`;
    const pick = options[await ctx.ask(summary, options)];

    if (pick === 'Leave' || pick === undefined) {
      await ctx.say('Day-Care Lady: Come back any time.');
      return;
    }

    if (pick === 'Leave one') {
      const able = st.party.filter((m) => !m.isEgg && m.hp > 0).length;
      if (able <= 1) {
        await ctx.say('Day-Care Lady: That is the only one you have that can battle.\fI would not be doing you a favour.');
        continue;
      }
      const index = await ctx.pickFromParty('Leave which Pokémon?');
      if (index < 0) continue;
      const mon = st.party[index];
      if (mon.isEgg) { await ctx.say('Day-Care Lady: That one has not hatched yet!'); continue; }
      st.party.splice(index, 1);
      deposit(d, mon, ctx.linked() ? ctx.partnerName() : null);
      await ctx.say(`Day-Care Lady: We will look after ${displayName(mon)}. Off you go.`);
      if (d.mons.length === 2) {
        await ctx.say(`Day-Care Lady: ${compatibilityText(d.mons[0], d.mons[1])}`);
        if (d.witness) {
          await ctx.say(`Day-Care Man: Two trainers here at once.\fI have put both names down — yours and ${d.witness}\u2019s.`);
        }
      }
      continue;
    }

    if (pick === 'Take one back') {
      const which = d.mons.length === 1 ? 0
        : await ctx.ask('Which one?', d.mons.map((m) => displayName(m)));
      const fee = feeFor(d, which);
      const name = displayName(d.mons[which]);
      const yes = await ctx.ask(`Day-Care Lady: ${name} has come on nicely.\fThat will be ${money(fee)}.`, ['Pay', 'Not now']);
      if (yes !== 0) continue;
      if (st.inventory.money < fee) { await ctx.say('Day-Care Lady: You are a bit short, I am afraid.'); continue; }
      if (st.party.length >= 6) { await ctx.say('Day-Care Lady: Your team is full. Make room first.'); continue; }
      spend(st.inventory, fee);
      const mon = withdraw(d, which);
      st.party.push(mon);
      ctx.sfx('heal');
      await ctx.say(`${name} came back! It is level ${mon.level}.`);
      continue;
    }

    if (pick === 'Take the Egg') {
      if (st.party.length >= 6) { await ctx.say('Day-Care Lady: You have no room for it. Come back.'); continue; }
      const egg = collectEgg(d, st.player);
      st.party.push(egg);
      ctx.sfx('caught');
      await ctx.say('You received the Egg!');
      if (egg.coParent) {
        await ctx.say(`Day-Care Man: Both names are on it.\fYours, and ${egg.coParent}\u2019s.`);
      }
      await ctx.say('Day-Care Lady: Carry it about with you. They hatch for people who walk.');
      ctx.journal('firstEgg');
      continue;
    }

    if (pick === 'How are they?') {
      if (!boarded) { await ctx.say('Day-Care Lady: Bring me something and I will tell you.'); continue; }
      for (const mon of d.mons) {
        await ctx.say(`${displayName(mon)} is level ${mon.level}.`);
      }
      const carried = st.party.find((m) => m.isEgg);
      if (carried) await ctx.say(`Day-Care Lady: About that Egg —\f${eggHint(carried)}`);
      else if (d.mons.length === 2) await ctx.say(`Day-Care Lady: ${compatibilityText(d.mons[0], d.mons[1])}`);
    }
  }
};

/**
 * An Egg hatching.
 *
 * Fires from the step counter rather than from talking to anything, so it
 * happens where you happen to be standing — which is the whole memory of it.
 */
SCRIPTS.eggHatch = async (ctx, npc) => {
  const egg = npc && npc.data && npc.data.egg;
  if (!egg || !egg.isEgg) return;

  ctx.sfx('encounter');
  await ctx.say('Huh? Your Egg is acting strangely!');
  await ctx.wait(0.7);

  const born = hatch(egg);
  const sp = getSpecies(born.species);
  await ctx.showMonster(born.species);
  ctx.sfx('caught');
  ctx.cry(born.species);
  await ctx.say(`Your Egg hatched!\f${sp.name} came out of it!`);
  ctx.hideMonster();

  ctx.dex.seen(born.species);
  ctx.dex.caught(born.species);
  if (born.coParent) {
    await ctx.say(`Both your names are on it \u2014 yours and ${born.coParent}\u2019s.`);
  }
  await ctx.askNickname(born);
  ctx.journal('hatched');
  egg.hatching = false;
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

// ---- soft soil: planting, tending, picking --------------------------------
//
// The whole loop is one square of ground: put something in, come back later,
// take more out than you put in. It runs on the wall clock rather than on
// steps, so it is the one system in the game that carries on while the game
// is shut — which is what makes checking on it feel like checking on
// something rather than like grinding.

SCRIPTS.berryPatch = async (ctx, npc) => {
  const tile = npc && npc.data && npc.data.tile;
  if (!tile) return;
  const st = ctx.state;
  const map = ctx.here().map;
  const patch = patchAt(st.patches, map, tile.x, tile.y);

  if (!patch) {
    const held = BERRY_IDS.filter((id) => ctx.countItem(id) > 0);
    if (!held.length) {
      await ctx.say('The soil here is soft and freshly turned.\fSomething would grow in it, if you had something to put in it.');
      return;
    }
    const options = held.map((id) => getItem(id).name).concat('Cancel');
    const pick = await ctx.ask('The soil is soft. Plant a Berry?', options);
    if (pick < 0 || pick >= held.length) return;
    const id = held[pick];
    ctx.take(id, 1);
    const witness = ctx.linked() ? ctx.partnerName() : null;
    plant(st.patches, map, tile.x, tile.y, id, witness);
    ctx.sfx('select');
    await ctx.say(`You planted a ${getItem(id).name} in the soft soil.`);
    if (witness) {
      await ctx.say(`${witness} was standing right there when you did it.\fWhatever comes up, it is both of yours.`);
    } else {
      await ctx.say(`It will take about ${getItem(id).berry.hours} hours to come up.\fCome back later.`);
    }
    ctx.journal('planted');
    return;
  }

  if (isRipe(patch)) {
    const crop = harvest(st.patches, map, tile.x, tile.y);
    const item = getItem(crop.berry);
    ctx.give(crop.berry, crop.count);
    ctx.sfx('buy');
    await ctx.say(`You picked ${crop.count} ${item.name}${crop.count === 1 ? '' : 's'}!`);
    if (crop.witness) {
      await ctx.say(`This is the one you and ${crop.witness} planted.\fIt did rather well out of the arrangement.`);
    }
    ctx.journal('harvested');
    return;
  }

  await ctx.say(patchText(patch));
  const yes = await ctx.ask('Look after it?', ['Yes', 'Leave it']);
  if (yes !== 0) return;
  if (tend(patch)) {
    ctx.sfx('heal');
    await ctx.say('You cleared the weeds and worked the soil around it.\fIt looks happier for it.');
    await ctx.say(`This one should give about ${cropOf(patch)} when it is ready.`);
  } else {
    await ctx.say('There is nothing more to do for it right now.\fIt just needs time.');
  }
};

// ---- Nel, who runs the beds at the end of the lane -------------------------

SCRIPTS.berryGift = async (ctx) => {
  const st = ctx.state;
  if (!st.flags.gotBerries) {
    await ctx.say('Nel: These beds have been here longer than the houses have.\fEverybody in Twinleaf keeps one.');
    await ctx.say('Nel: Here. Something to start you off.');
    ctx.give('oranberry', 3);
    ctx.give('cheriberry', 2);
    ctx.sfx('buy');
    await ctx.say('You received 3 ORAN BERRIES and 2 CHERI BERRIES!');
    await ctx.say('Nel: Stand at a bed, press A, and put one in.\fThen go away and do something else. That is the trick.');
    await ctx.say('Nel: Look in on it while it grows and it will thank you for it.\fThey know.');
    ctx.setFlag('gotBerries', true);
    return;
  }
  if (ctx.linked()) {
    await ctx.say(`Nel: Oh, the two of you.\fPlant one together — go on. It is worth more when there are two names on it.`);
    return;
  }
  await ctx.say('Nel: Cheri for the shakes, Pecha for the poison, Rawst for a burn.\fMy mother taught me that as a rhyme and I have never forgotten it.');
  await ctx.say('Nel: The slow ones are the good ones. Lum takes a whole day and cures\nanything you like.');
};

// ---- Bram, and the rod he keeps saying he has not got ----------------------

SCRIPTS.oldRod = async (ctx) => {
  if (ctx.hasItem('oldrod')) {
    if (ctx.linked()) {
      await ctx.say('Bram: Two of you on the beach.\fGo on then. Whoever lands the bigger one buys tea.');
    } else {
      await ctx.say('Bram: Still Magikarp? It is always Magikarp.\fKeep at it. The sea gets bored before you do.');
    }
    return;
  }
  await ctx.say('Bram: The beach goes on for miles and the water is full of things I\ncannot name.');
  await ctx.say('Bram: I have got a spare rod here. Old. Bent. Catches almost nothing.');
  const yes = await ctx.ask('Bram: Do you want it?', ['Yes, please', 'No thanks']);
  if (yes !== 0) { await ctx.say('Bram: Suit yourself. It will be here.'); return; }
  ctx.give('oldrod', 1);
  ctx.sfx('badge');
  await ctx.say('You received the OLD ROD!');
  await ctx.say('Bram: Stand at the edge, face the water, and have a go.\fThat is the whole of it.');
  await ctx.say('Bram: You will pull up a Magikarp. Then another one.\fThen, one day, something else.');
  ctx.journal('fished');
};

// ---- the water's edge ------------------------------------------------------
//
// The Old Rod catches Magikarp, and everybody knows it catches Magikarp, and
// people fish with it anyway. The bite is a real roll against a real table, so
// a blank is a blank and the one time it is not Magikarp is worth something.

SCRIPTS.fish = async (ctx) => {
  const table = ctx.fishTable();
  if (!table) { await ctx.say('You cast the line.\f...Nothing lives in this water.'); return; }

  ctx.sfx('select');
  await ctx.say('You cast the Old Rod into the water.');
  await ctx.wait(1.1);

  if (Math.random() > 0.55) {
    await ctx.say('...Not even a nibble.');
    return;
  }
  ctx.sfx('encounter');
  await ctx.say('Oh! A bite!');
  await ctx.wait(0.4);
  const species = weightedPick(table.table.map(([id, w]) => [id, w]), Math.random);
  const level = table.min + Math.floor(Math.random() * (table.max - table.min + 1));
  ctx.journal('fished');
  await ctx.wild(species, level);
};

// ---- the Underground -------------------------------------------------------
//
// Gen 4's best idea, and the only feature in the series built for a touch
// screen. There are no wild Pokemon down here and no plot: it is the part of
// the game you go to because the other person is in it.

/** The Underground Man, who hands over the kit and never comes down himself. */
SCRIPTS.explorerKit = async (ctx) => {
  if (ctx.hasItem('explorerkit')) {
    if (ctx.linked()) {
      await ctx.say('Underground Man: Both of you have kits? Then go down together.\fIt is a different place with somebody in it.');
    } else {
      await ctx.say('Underground Man: Seams come back after a few hours. The rock is\nolder than the impatience of any trainer.');
      await ctx.say('Underground Man: Hammer for ground, pick for precision.\fEverybody learns that the expensive way.');
    }
    return;
  }
  await ctx.say('Underground Man: There is another Sinnoh under this one.');
  await ctx.say('Underground Man: Tunnels. Miles of them. Nobody put them there —\nthey were simply already there when we arrived.');
  await ctx.say('Underground Man: I dug for thirty years and I never once found the end.');
  const yes = await ctx.ask('Underground Man: Would you like a kit?', ['Yes', 'Not today']);
  if (yes !== 0) { await ctx.say('Underground Man: It will be here. So will the tunnels.'); return; }
  ctx.give('explorerkit', 1);
  ctx.sfx('badge');
  await ctx.say('You received the EXPLORER KIT!');
  await ctx.say('Underground Man: Use it anywhere outdoors and you will go down.\fUse a ladder and you will come back up where you left.');
  await ctx.say('Underground Man: Look for the seams — the rock that glitters.\fHammer to clear ground, pick when it matters.');
  await ctx.say('Underground Man: And mind the roof. It only warns you once.');
  ctx.journal('underground');
};

/** Going down. Called from the bag, so it knows nothing but where you stand. */
SCRIPTS.goUnderground = async (ctx) => {
  const st = ctx.state;
  const here = ctx.here();
  const ladder = ladderFor(here.map);
  st.underground.returnTo = { map: here.map, x: here.x, y: here.y, dir: 'down' };
  st.underground.unlocked = true;
  ctx.sfx('door');
  await ctx.say('You dug straight down.');
  await ctx.warpTo('underground', ladder.drop[0], ladder.drop[1]);
  await ctx.say(`${ladder.name}.\fThe tunnels go on further than the torchlight does.`);
};

/** Coming back up, exactly where you went down. */
SCRIPTS.surface = async (ctx) => {
  const st = ctx.state;
  const back = st.underground.returnTo;
  ctx.sfx('door');
  if (!back) {
    // A save from before the kit, or a ladder reached some other way. The
    // nearest thing to "where you came from" is the town the shaft serves.
    const ladder = LADDERS.find((l) => l.drop[0] === ctx.here().x || true);
    await ctx.warpTo(ladder.surface[0], 12, 12);
    return;
  }
  await ctx.warpTo(back.map, back.x, back.y);
  await ctx.say('You climbed back up into the daylight.');
};

/** One seam. */
SCRIPTS.digWall = async (ctx, npc) => {
  const tile = npc && npc.data && npc.data.tile;
  if (!tile) return;
  const ug = ctx.state.underground;

  if (!isReady(ug, tile.x, tile.y)) {
    await ctx.say(coolingText(coolingFor(ug, tile.x, tile.y)));
    return;
  }
  const deep = tile.depth === 'deep';
  await ctx.say(deep
    ? 'The seam here runs deep, and something in it catches the light.'
    : 'Something in the rock catches the light.');
  const go = await ctx.ask('Dig here?', ['Dig', 'Leave it']);
  if (go !== 0) return;

  // The wall is derived from where it is and which refresh window it is in,
  // so two people at the same seam in the same evening dig the same rock.
  const rng = makeRng(seedFor(tile.x, tile.y));
  const dig = createDig(tableFor(tile.depth), rng, {
    width: deep ? 11 : 10,
    height: deep ? 7 : 6,
    count: deep ? 3 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2),
    maxStrikes: deep ? 14 : 12,
  });

  const result = await ctx.dig(dig);
  markDug(ug, tile.x, tile.y, result.found.length);

  if (!result.found.length) {
    await ctx.say(result.collapsed
      ? 'The roof came in and took the lot with it.'
      : 'You left with nothing but a sore arm.');
    return;
  }
  const names = result.found.map((f) => getItem(f.item).name);
  await ctx.say(`You came away with ${listOf(names)}.`);
  if (result.collapsed && result.missed.length) {
    await ctx.say(`There was ${listOf(result.missed.map((f) => getItem(f.item).name))} in there too.\fIt is under a great deal of rock now.`);
  }
  if (ctx.linked()) {
    await ctx.say(`${ctx.partnerName()} is down here somewhere.\fIf you both work the same seam you will both find the same things.`);
  }
  ctx.journal('firstDig');
};

/** "a, b and c" — used by the dig and by anything else that hands over a haul. */
function listOf(names) {
  if (names.length === 1) return `a ${names[0]}`;
  if (names.length === 2) return `a ${names[0]} and a ${names[1]}`;
  return `a ${names.slice(0, -1).join(', a ')} and a ${names[names.length - 1]}`;
}

// ---- Secret Bases ----------------------------------------------------------
//
// The most personal thing Gen 4 ever shipped, and here it is built for exactly
// two people: one other base you will ever visit, one person who will ever
// visit yours, and a board on the wall to leave them a line on.

SCRIPTS.secretBase = async (ctx, npc) => {
  const tile = npc && npc.data && npc.data.tile;
  if (!tile) return;
  const st = ctx.state;
  const ug = st.underground;
  const mine = ug.base && ug.base.x === tile.x && ug.base.y === tile.y;
  const theirs = ug.partnerBase && ug.partnerBase.x === tile.x && ug.partnerBase.y === tile.y;

  if (theirs && !mine) {
    await ctx.say(`A door, cut into the rock.\f${ug.partnerBase.owner || 'Somebody'} lives here.`);
    const go = await ctx.ask('Go in?', ['Yes', 'Leave them be']);
    if (go !== 0) return;
    ug.visiting = true;
    await ctx.warpTo('secret_base', BASE_ENTRY.x, BASE_ENTRY.y);
    await ctx.say(`${ug.partnerBase.owner || 'Their'}’s base.\f${describe(ug.partnerBase)}`);
    if (ug.partnerBase.note) {
      await ctx.say(`There is something scratched on the board:\f“${ug.partnerBase.note}”`);
    }
    return;
  }

  if (mine) {
    ug.visiting = false;
    await ctx.warpTo('secret_base', BASE_ENTRY.x, BASE_ENTRY.y);
    ug.base.visits++;
    return;
  }

  if (ug.base) {
    await ctx.say('This wall is soft enough to cut a room into.');
    const move = await ctx.ask('You already have a base. Move it here?', ['Move it', 'Keep the old one']);
    if (move !== 0) return;
    await ctx.say('You filled in the old room and started again.\fThe things you put in it stayed where they were.');
  } else {
    await ctx.say('This wall is soft enough to cut a room into.');
    const go = await ctx.ask('Make this your Secret Base?', ['Yes', 'Not here']);
    if (go !== 0) return;
  }
  const kept = ug.base ? ug.base.decor : [];
  const note = ug.base ? ug.base.note : '';
  const noteBy = ug.base ? ug.base.noteBy : null;
  const base = digBase(ug, tile.x, tile.y, st.player.name);
  base.decor = kept;
  base.note = note;
  base.noteBy = noteBy;
  ctx.sfx('badge');
  await ctx.say('You dug out a room of your own, a hundred feet under Sinnoh.');
  if (ctx.linked()) {
    ctx.shareBase();
    await ctx.say(`${ctx.partnerName()} can find this now.\fThat is rather the point of it.`);
  } else {
    await ctx.say('Link up and your partner will be able to find it.');
  }
  ctx.journal('secretBase');
};

/** The door, from the inside. */
SCRIPTS.leaveBase = async (ctx) => {
  const ug = ctx.state.underground;
  const room = ug.visiting ? ug.partnerBase : ug.base;
  ctx.sfx('door');
  ug.visiting = false;
  if (!room) { await ctx.warpTo('underground', LADDERS[0].drop[0], LADDERS[0].drop[1]); return; }
  // Out into the tunnel, standing in front of the door you came through.
  await ctx.warpTo('underground', room.x, room.y + 1);
};

/** The board on the back wall of your own room. */
SCRIPTS.baseBoard = async (ctx) => {
  const ug = ctx.state.underground;
  const room = ug.visiting ? ug.partnerBase : ug.base;
  if (!room) return;

  if (ug.visiting) {
    if (room.note) {
      await ctx.say(`Scratched into the board:\f“${room.note}”`);
      await ctx.say(`— ${room.noteBy || room.owner || 'them'}`);
    } else {
      await ctx.say('A blank board, and a nail with nothing on it.');
    }
    const take = await ctx.ask('Take the flag?', ['Take it', 'Leave it']);
    if (take !== 0) return;
    ug.flagsTaken++;
    ctx.sfx('buy');
    await ctx.say(`You took ${room.owner || 'their'}’s flag.\fThey will know. That is the game.`);
    ctx.shareFlag();
    return;
  }

  await ctx.say(room.note
    ? `Your board reads:\f“${room.note}”`
    : 'A blank board. Somebody else will read whatever goes on it.');
  const pick = await ctx.ask('The board.', ['Leave a line', 'Just look', 'Nothing']);
  if (pick !== 0) return;
  const text = await ctx.askText('What should it say?', NOTE_MAX);
  if (!text) return;
  leaveNote(room, text, ctx.state.player.name);
  ctx.sfx('select');
  await ctx.say('You scratched it into the board.');
  if (ctx.linked()) { ctx.shareBase(); await ctx.say(`${ctx.partnerName()} will see it next time they are down here.`); }
};

/** The Underground Man's other counter: spheres in, furniture out. */
SCRIPTS.baseGoods = async (ctx) => {
  const st = ctx.state;
  const ug = st.underground;
  if (!ug.base) {
    await ctx.say('Goods Trader: Bring me a room and I will fill it.\fNo room, no furniture. That is the arrangement.');
    return;
  }
  for (;;) {
    const spheres = sphereCount(st.inventory);
    if (!spheres) {
      await ctx.say('Goods Trader: Spheres, please. I do not take money.\fMoney is for people who live above ground.');
      return;
    }
    const affordable = GOODS_IDS.filter((id) => costOf(id) <= spheres);
    if (!affordable.length) {
      await ctx.say(`Goods Trader: ${spheres} sphere${spheres === 1 ? '' : 's'} does not reach anything I have.\fGo and dig.`);
      return;
    }
    const options = affordable.map((id) => `${GOODS[id].name} (${costOf(id)})`).concat('Nothing today');
    const pick = await ctx.ask(`Goods Trader: You have ${spheres} sphere${spheres === 1 ? '' : 's'}.`, options);
    if (pick < 0 || pick >= affordable.length) { await ctx.say('Goods Trader: The tunnels will still be here.'); return; }
    const id = affordable[pick];

    if (ug.base.decor.length >= ROOM.maxDecor) {
      await ctx.say('Goods Trader: Your room is full. Take something out of it first.');
      continue;
    }
    const spot = freeSpot(ug.base, id);
    if (!spot) { await ctx.say('Goods Trader: There is nowhere in your room that would fit.'); continue; }

    spendSpheres(ctx, costOf(id));
    place(ug.base, id, spot.x, spot.y);
    ctx.sfx('buy');
    await ctx.say(`Goods Trader: One ${GOODS[id].name}. It is in your room already.`);
    await ctx.say(GOODS[id].blurb);
    if (ctx.linked()) ctx.shareBase();
  }
};

/**
 * Pays in spheres, cheapest colour first, so the rare ones stay in the bag
 * until the player chooses to spend them.
 */
function spendSpheres(ctx, cost) {
  let left = cost;
  const order = [...SPHERES].sort((a, b) => (getItem(a).worth || 1) - (getItem(b).worth || 1));
  for (const id of order) {
    while (left > 0 && ctx.countItem(id) > 0) {
      ctx.take(id, 1);
      left -= getItem(id).worth || 1;
    }
    if (left <= 0) break;
  }
}

/** Taking something back out of your own room. */
SCRIPTS.baseTidy = async (ctx, npc) => {
  const ug = ctx.state.underground;
  const tile = npc && npc.data && npc.data.tile;
  if (!ug.base || ug.visiting || !tile) return;
  const gone = removeAt(ug.base, tile.x, tile.y);
  if (!gone) return;
  ctx.sfx('select');
  await ctx.say(`You put the ${GOODS[gone.id].name} away.`);
  if (ctx.linked()) ctx.shareBase();
};

// ---- field moves -----------------------------------------------------------
//
// The badge is permission and the move is capability, so there are two ways to
// be turned away here and they are different problems: one is solved at a Gym
// and the other in the party menu. Saying which is which is most of the value.

SCRIPTS.fieldMove = async (ctx, npc) => {
  const tile = npc && npc.data && npc.data.tile;
  if (!tile) return;
  const id = tile.id;
  const spec = FIELD_MOVES[id];
  if (!spec) return;
  const st = ctx.state;

  const u = usability(st, id);
  if (!u.ok) { await ctx.say(refusalText(st, id)); return; }

  // Surfing is a state, not a one-off: it opens the water rather than
  // clearing anything, so it needs no confirmation beyond stepping in.
  if (id === 'surf') {
    if (st.surfing) return;
    const yes = await ctx.ask(`${spec.prompt}\fUse ${spec.name}?`, ['Yes', 'No']);
    if (yes !== 0) return;
    st.surfing = true;
    ctx.sfx('warp');
    await ctx.say(`${displayName(u.mon)} ${spec.doing}.`);
    return;
  }

  if (isCleared(st, ctx.here().map, tile.x, tile.y)) return;

  const yes = await ctx.ask(`${spec.prompt}\fUse ${spec.name}?`, ['Yes', 'No']);
  if (yes !== 0) return;

  ctx.sfx(id === 'rocksmash' || id === 'strength' ? 'hit' : 'select');
  await ctx.say(`${displayName(u.mon)} used ${spec.name}!`);
  markCleared(st, ctx.here().map, tile.x, tile.y);
  ctx.shake(id === 'strength' ? 1 : 0.5);
  await ctx.wait(0.35);
  await ctx.say(`${displayName(u.mon)} ${spec.doing}.`);
  ctx.autosave();
};

// ---- Cynthia, and the move that opens the region ---------------------------

SCRIPTS.cynthiaCut = async (ctx) => {
  const st = ctx.state;
  if (ctx.hasItem('hm01')) {
    if (ctx.linked()) {
      await ctx.say('Cynthia: The two of you, travelling together.\fThat is how I did it, at your age. It is the better way.');
    } else {
      await ctx.say('Cynthia: A badge from Gardenia lets you use Cut out here.\fWithout it the move is just a move.');
    }
    return;
  }
  await ctx.say('Cynthia: You are the one who has been in Oreburgh Gate.\fWord travels. It usually travels to me first.');
  await ctx.say('Cynthia: My name is Cynthia. I study what Sinnoh was before it was Sinnoh.');
  if (st.flags.knowsTwist) {
    await ctx.say('Cynthia: Then you already know Team Galactic did not find that door.\fThey built the key for it.');
    await ctx.say('Cynthia: Which means they know exactly what is behind it.\fThat is the part that keeps me up.');
  }
  ctx.give('hm01', 1);
  ctx.sfx('badge');
  await ctx.say('Cynthia handed over HM01!');
  await ctx.say('Cynthia: Cut. Teach it to something and the thin trees stop being walls.',
    { speaker: 'Cynthia' });
  await ctx.say('Cynthia: Gardenia’s badge is what makes the world accept it.\fThe move on its own is not enough — it never is.');
  ctx.journal('metCynthia');
};

export function scriptFor(name) { return SCRIPTS[name] || null; }
