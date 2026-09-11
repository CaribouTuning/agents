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
import { CASS, ROWAN, MARS, EVERLIGHT, DOCUMENTS, BANDIT, cassLook } from '../../data/story.js';
import { playerByLook, buddyOf, playerOf, buddyPlayerOf } from '../players.js';

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

  await cassTakesHers(ctx, base);
  await buddyTakesTheirs(ctx);
  await banditJoins(ctx);
};

/**
 * The other one, taking the last of the three.
 *
 * Mum says Rowan called them both down, so they have to actually be here and
 * actually leave with something. In co-op they are a real player and pick for
 * themselves, so this only runs when the player is on their own.
 */
async function buddyTakesTheirs(ctx) {
  const st = ctx.state;
  if (st.link && st.link.connected && st.link.partner) return;
  // On the link they are a real player and pick for themselves; solo, they
  // are the person who walked in here with you and there is one left.
  if (!ctx.companionHere()) return;
  const who = buddyOf(st);
  await ctx.wait(0.3);
  await ctx.say(`${who}: Right. Me next, then.`, { speaker: who });
  await ctx.say(`${who}: I have been looking at the last one for twenty minutes\nand pretending I had not decided.`);
  await ctx.say('Prof. Rowan: Go on. It has been looking at you for twenty minutes too.',
    { speaker: 'Prof. Rowan' });
  ctx.sfx('caught');
  await ctx.say(`${who} took the last Pokémon.`);
  await ctx.say(`${who}: Come on. I want to be out of here before Cass says\nsomething else about seven o'clock.`);
  ctx.setFlag('buddyHasStarter', true);
}

/**
 * Cass, taking the one that beats yours, while you are stood there.
 *
 * She has been in the lab the whole time — she got up at seven, which she
 * will tell you about for the rest of the game. Watching her do it is the
 * difference between a rival and a line of dialogue claiming there is one.
 */
async function cassTakesHers(ctx, playerBase) {
  const hers = rivalStarterBase(playerBase);
  const mine = getSpecies(playerBase);
  const theirs = getSpecies(hers);

  await ctx.wait(0.4);
  const cass = ctx.spawnNpc({
    id: 'cass_lab', look: cassLook(ctx.state), x: ctx.player.x + 1, y: ctx.player.y,
    dir: 'left', name: CASS.name,
  });
  ctx.sfx('bump');
  await ctx.say('*Somebody has been sat on the bench by the door this whole time,\nand gets up.*');
  await ctx.say(`Cass: Right. That is the ${mine.name} gone, then.`, { speaker: 'Cass Wren' });
  await ctx.say('Cass: I have been sat there since seven waiting to see which one\nyou would take.');
  await ctx.showMonster(hers);
  ctx.cry(hers);
  await ctx.say(`Cass: So I will have the ${theirs.name}. The ${theirs.types.join('/')} type.`);
  await ctx.say(`Cass: ${theirs.name} beats ${mine.name}. That is the entire reason.\fI am not going to pretend it is anything else.`);
  ctx.hideMonster();
  ctx.dex.seen(hers);
  await ctx.say('Prof. Rowan: Cass. It is a Pokémon, not a chess piece.', { speaker: 'Prof. Rowan' });
  await ctx.say('Cass: It can be both.', { speaker: 'Cass Wren' });
  await ctx.say('Cass: Route 201. The north gate. Twenty minutes.');
  await ctx.say('Cass: Do not make me stand there for an hour. I will, and I will\nbring it up for years.');
  await ctx.say('*She goes out of the door without waiting for an answer.*');
  await ctx.walk(cass, 'down', 5);
  ctx.despawn(cass);
  ctx.sfx('door');
  ctx.setFlag(FLAGS.MET_RIVAL);
}

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
  ctx.setFlag(FLAGS.BANDIT_WITH_US, true);
  ctx.journal('bandit');
}

// ---- Rival battles ---------------------------------------------------------

function rivalTeam(st, trainerId) {
  const t = { ...getTrainer(trainerId) };
  // The rival in the battle looks like the rival on the map: a boy for
  // Matthew, a girl for Sammy.
  t.look = cassLook(st);
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
    id: 'rival', look: cassLook(ctx.state), x: ctx.player.x, y: ctx.player.y - 3,
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
    id: 'rival', look: cassLook(ctx.state), x: ctx.player.x, y: ctx.player.y - 2,
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
    id: 'rival', look: cassLook(ctx.state), x: ctx.player.x, y: ctx.player.y - 2,
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
 * The Veilstone Department Store, which carries what a Mart does not.
 *
 * The stones live here rather than being scattered as one-off field items,
 * because an evolution you can only reach by having walked over the right
 * tile once is an evolution most people never see.
 */
SCRIPTS.departmentStore = async (ctx) => {
  await ctx.say('Clerk: Four floors, in theory. One floor, in practice.\fWe do carry the stones, though. Everybody asks.',
    { instant: true });
  await ctx.openShop('department');
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

  const first = !st.flags[FLAGS.EVERLIGHT_SEEN];
  await speak(ctx, first ? EVERLIGHT.firstSight
    : (st.flags[FLAGS.EVERLIGHT_RESOLVED] ? EVERLIGHT.again : EVERLIGHT.firstSight.slice(-1)));

  // The seam opens in the first act, because Mars leaves the charm there on
  // purpose. Understanding what is standing in the chamber does not: that is
  // in a book in Canalave, six badges later. Until then this is a sighting —
  // the thing the whole middle of the game is about, seen once, unreadable.
  // Letting it resolve here would put the end of the story two hours into it.
  if (!st.flags[FLAGS.CANALAVE_TRUTH]) {
    ctx.dex.seen(EVERLIGHT_SPECIES);
    await ctx.showMonster(EVERLIGHT_SPECIES);
    ctx.cry(EVERLIGHT_SPECIES);
    await ctx.wait(0.6);
    ctx.hideMonster();
    await speak(ctx, EVERLIGHT.tooEarly);
    if (first) {
      ctx.setFlag(FLAGS.EVERLIGHT_SEEN);
      ctx.shareMilestone(FLAGS.EVERLIGHT_SEEN);
      ctx.journal('sawEverlight');
      ctx.autosave();
    }
    return;
  }

  if (!first) await speak(ctx, EVERLIGHT.understood);
  ctx.setFlag(FLAGS.EVERLIGHT_SEEN);

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
/**
 * Home, after.
 *
 * The cool-down. No fight, no reward, no flag that unlocks a door — the two
 * of you walk back to the town you started in and sit on a step, because the
 * end of a story is not the last thing that happens in it, it is the first
 * quiet thing after the last loud one.
 */
/**
 * Eterna Forest: a Galactic grunt taking readings, in Act II.
 *
 * The first time the player sees Galactic doing something that is not theft.
 * He is not guarding anything, he does not want a fight, and he will not
 * explain — he is measuring light in a wood, and the reason that matters is
 * four acts away, in a library in Canalave. This is the beat `forestGrunt`
 * was declared for: the flag existed, was listed as a co-op milestone the two
 * players keep in step on, and nothing in the game ever set it because the
 * scene was never written.
 */
SCRIPTS.forestGrunt = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.FOREST_GRUNT]) {
    await ctx.say('*The patch of moss he was kneeling on is still flattened.*');
    return;
  }

  const grunt = ctx.spawnNpc({
    id: 'ef_grunt', look: 'grunt', x: ctx.player.x, y: Math.max(1, ctx.player.y - 2),
    dir: 'down', name: 'Galactic Grunt',
  });
  ctx.exclaim(grunt);
  await ctx.wait(0.5);
  await ctx.say('*There is somebody kneeling in the moss with a handheld meter,\nholding it up at the canopy.*');
  await ctx.say('Grunt: Do not stand there. You are in it.', { speaker: 'Grunt' });
  await ctx.say('*You move. He does not look up.*');
  await ctx.wait(0.3);
  await ctx.say('Grunt: Four hundred and ten. Under a full canopy, at this hour.\nThat is not right.');
  await ctx.say('Grunt: It is the third wood this month that is not right.');
  await ctx.wait(0.3);

  const opt = await ctx.ask('Say something?', ['What are you measuring?', 'Leave him to it']);
  if (opt === 0) {
    await ctx.say('Grunt: Light.', { speaker: 'Grunt' });
    await ctx.say('Grunt: Not sunlight. There is a difference and I am not going to\nstand in a wood explaining it to a child.');
    await ctx.say('Grunt: Ask me again in a year. You will not have to.');
  } else {
    await ctx.say('*You leave him to it. He does not notice you go.*');
  }

  // No battle. The first time Galactic turn up they are not a threat, and a
  // fight here would teach the player to read them as one for the rest of it.
  await ctx.wait(0.4);
  await ctx.say('*He packs the meter into a case with a foam cutout shaped exactly\nfor it, which means there are a lot of these.*');
  await ctx.walk(grunt, 'up', 4);
  ctx.despawn(grunt);
  ctx.sfx('leave');

  ctx.setFlag(FLAGS.FOREST_GRUNT);
  ctx.shareMilestone(FLAGS.FOREST_GRUNT);
  ctx.journal('forestGrunt');
  ctx.autosave();
};

SCRIPTS.wentHome = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.WENT_HOME]) return;
  const me = playerOf(st);
  const them = buddyPlayerOf(st);
  const linked = ctx.linked();
  const who = linked ? them.name : them.name;

  await ctx.wait(0.4);
  await ctx.say('*Twinleaf, in the afternoon. The same three buildings and the same\none road out of it.*');
  await ctx.say('*It has not changed at all, which for some reason is the part that\ngets you.*');
  await ctx.wait(0.4);

  if (ctx.companionHere() || linked) {
    await ctx.say(who + ': I keep waiting to feel different.', { speaker: who });
    await ctx.say(who + ': We were under a hill this morning. There was a thing in it\nthat had been holding a door shut since before either of us was born.');
    await ctx.say(who + ': And now I am stood outside my mum\'s house and she is going\nto ask if I want a cup of tea.');
    await ctx.wait(0.3);
    await ctx.say(who + ': ...I do want a cup of tea. That is the annoying part.');
  } else {
    await ctx.say('*You stand in the road for a while. ' + them.name + ' is not here.*');
    await ctx.say('*You find that you are saving it up to tell them, which is its own\nkind of answer.*');
  }

  if (st.flags[FLAGS.BANDIT_WITH_US]) {
    await ctx.wait(0.3);
    ctx.cry(BANDIT.species);
    await ctx.say('*Bandit gets onto the step, turns around twice, and goes to sleep in\nthe sun as though none of it happened.*');
    await ctx.say('*Which, as far as she is concerned, it did not. You came back. That\nwas the whole of her involvement.*');
  }

  await ctx.wait(0.4);
  await ctx.say('Mum: There you are.', { speaker: 'Mum' });
  await ctx.say('Mum: I am not going to ask. You have got the face of somebody who\nwould have to start at the beginning.');
  await ctx.say('Mum: Kettle is on. Boots off.');
  await ctx.wait(0.3);
  await ctx.say('*You take your boots off.*');

  ctx.setFlag(FLAGS.WENT_HOME);
  ctx.shareMilestone(FLAGS.WENT_HOME);
  ctx.journal('wentHome');
  ctx.autosave();
  await ctx.wait(0.5);
  await ctx.say('*The Circuit has a Finals in the spring.*');
  await ctx.say('*There is nothing under the hill now. There is just a hill.*');
  ctx.journal('theFinals');
  void me;
};

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

// ---- the road east: the Tower, Looker, and the grey building ----------------

/** The sisters at the top of the Lost Tower. */
SCRIPTS.lostTowerTop = async (ctx) => {
  const st = ctx.state;
  if (!st.flags.lostTower) {
    await ctx.say('Rue: You climbed all the way up. Most people stop at the second floor.');
    await ctx.say('Rue: Our grandmother is here. Not here here. There is a stone.');
    await ctx.say('Rue: She walked this whole region twice and never earned a badge in her life.\fShe would have liked you.');
    ctx.give('hm05', 1);
    ctx.sfx('badge');
    await ctx.say('Rue handed over HM05!');
    await ctx.say('Rue: Defog. The fog on Route 210 has been there since before the road was.',
      { speaker: 'Rue' });
    await ctx.say('Rue: Fantina’s badge is what lets you use it out there.\fShe will not make it easy.');
    ctx.setFlag('lostTower', true);
    ctx.journal('lostTower');
    return;
  }
  if (ctx.linked()) {
    await ctx.say(`Rue: The two of you came up together. Good.\fMy sister and I have been climbing these stairs for thirty years.`);
    return;
  }
  await ctx.say('Rue: Defog clears the road north. Fantina’s badge is what makes the world accept it.');
};

/**
 * Looker. He is not a quest-giver standing in one spot — he turns up, tells
 * you slightly less than he knows, and goes somewhere else.
 */
SCRIPTS.looker = async (ctx) => {
  const st = ctx.state;
  if (st.flags.galacticHQ) {
    await ctx.say('Looker: You went inside. Of course you went inside.');
    await ctx.say('Looker: I have been watching that door for six weeks and taking notes,\fand you simply walked through it.');
    await ctx.say('Looker: I am not annoyed. I am reconsidering my methods.');
    return;
  }
  if (!st.flags.metLooker) {
    await ctx.say('Looker: You. Yes, you. A moment of your time.');
    await ctx.say('Looker: I am an international police officer. That is a real job.\fPeople laugh. It is still a real job.');
    await ctx.say('Looker: The grey building on that hill belongs to a company that\nfiles no accounts and sells nothing.');
    await ctx.say('Looker: I cannot go in. I have no cause. You are a trainer, and trainers\nwalk into buildings all day long and nobody stops them.');
    await ctx.say('Looker: I am not asking you to do anything. I am telling you a fact\nabout trainers.');
    ctx.setFlag('metLooker', true);
    ctx.journal('metLooker');
    return;
  }
  if (ctx.linked()) {
    await ctx.say(`Looker: Two of you. Even better. Two trainers walking into a building\nis half as suspicious as one, which makes no sense and is entirely true.`);
    return;
  }
  await ctx.say('Looker: The door is not locked. I have checked. Repeatedly.\fI have simply no cause to open it.');
};

/** Saturn, at the top of Galactic HQ. */
SCRIPTS.saturn = async (ctx, npc) => {
  const st = ctx.state;
  const t = getTrainer('galactic_saturn');
  if (st.flags[`beat_${t.id}`]) {
    await ctx.say('Saturn: The building is a building. Look round it if you must.');
    await ctx.say('Saturn: Everything that mattered left for the lakes a week ago.');
    return;
  }
  await ctx.say('Saturn: You are in a building you were not invited into.', { speaker: 'Saturn' });
  await ctx.say('Saturn: People keep calling us a company. We have never once said we were.\fThey say it, and then they stop worrying, and we get on.');
  if (st.flags.knowsTwist) {
    await ctx.say('Saturn: You have seen the seam under Oreburgh. I can tell — everyone who has\nlooks at me the same way.');
    await ctx.say('Saturn: Then you already understand. That was not a discovery.\fThat was a rehearsal.');
  }
  await ctx.say('Saturn: Cyrus is not here and would not explain himself if he were.\fI will do neither, but I will battle you.');
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) return;

  await ctx.say(`Saturn: ${t.defeat}`, { speaker: 'Saturn' });
  await ctx.say('Saturn: You want to know what this building is for.');
  await ctx.say('Saturn: It is for storing what we take out of the lakes.\fThere are three of them, and there is something asleep in each one.');
  await ctx.say('Saturn: We are already at the first. We were always going to be already there.');
  ctx.setFlag('galacticHQ', true);
  ctx.shareMilestone('galacticHQ');
  ctx.journal('galacticHQ');
  ctx.sfx('badge');
  await ctx.say('Saturn: Go to Pastoria. Go anywhere. It changes nothing —\fbut you will feel better for having gone.');

  // He empties a drawer at you on the way past. It is the only thing in this
  // building anybody in Sinnoh will ever need, and he does not know that.
  await ctx.say('Saturn: And take this out of my drawer. Somebody in Celestic sends it every\nmonth and I have never once wanted it.');
  ctx.give('secretpotion', 1);
  ctx.sfx('buy');
  await ctx.say('You received the SECRET POTION!');
  void npc;
};

// ---- Lake Valor ------------------------------------------------------------
//
// The player arrives after it has already happened. That is the whole scene:
// Team Galactic are not a threat you head off, they are a thing that has been
// going on while you were earning badges, and this is where that lands.

SCRIPTS.lakeValor = async (ctx) => {
  const st = ctx.state;
  ctx.sfx('warp');
  await ctx.wait(0.6);
  await ctx.say('*You come out of the trees expecting water.*');
  await ctx.say('*There is no water.*');
  await ctx.wait(0.5);
  await ctx.say('The deepest lake in Sinnoh is a bowl of cracked mud four hundred feet\ndeep, and it is completely dry, and there is grass coming up in it.');
  await ctx.say('There are tyre tracks. A lot of tyre tracks.');

  if (st.flags.galacticHQ) {
    await ctx.say('Saturn said they were already at the first one.\fHe said it the way you would mention a train being on time.');
  }

  ctx.shake(1.2);
  await ctx.wait(0.7);
  await ctx.say('*Something goes through you. Not a sound — a pressure, once, like a\nheld breath let go a long way underground.*');
  await ctx.say('*Whatever was asleep in this lake is awake now, and it is not here.*');

  // The Lakefront ranger has been waiting at the road for somebody to come
  // down and say what they saw.
  await ctx.say('Ranger: You went up. Nobody has been allowed up for a week.');
  await ctx.say('Ranger: My family has worked this water for four generations.\fI have nothing to do. There is nothing to work.');
  await ctx.say('Ranger: Take this. It is no use to me now. There is nothing to sail on.');
  ctx.give('hm03', 1);
  ctx.sfx('badge');
  await ctx.say('You received HM03!');
  await ctx.say('Ranger: Surf. Teach it to something that can carry you.', { speaker: 'Ranger' });
  await ctx.say('Ranger: The lakes are what this region is. If they are taking the lakes,\nthey are taking the region.');
  await ctx.say('Ranger: Go and be somewhere they are not finished with yet.');

  ctx.setFlag('lakeValor', true);
  ctx.shareMilestone('lakeValor');
  ctx.journal('lakeValor');
  ctx.autosave();
};

// ---------------------------------------------------------------------------
// The fog road, the shrine, and the wall with the whole plot on it.
// ---------------------------------------------------------------------------

/**
 * Four Psyduck with headaches, sitting in the narrowest part of Route 210.
 *
 * The gate is the Secret Potion, which Saturn shrugs at you in Veilstone on
 * his way out — so the road opens because of something that happened two
 * towns back, not because a door decided to be open.
 */
SCRIPTS.psyducks = async (ctx) => {
  await ctx.say('*Four Psyduck are sitting in the road with their hands on their heads.*');
  await ctx.say('*None of them are going to move on their own.*');

  if (!ctx.hasItem('secretpotion')) {
    await ctx.say('*You have nothing that would help, and shoving a Psyduck with a headache\nis how people end up asleep in a ditch.*');
    await ctx.say('*Somebody said Celestic makes a remedy for this. Celestic is the far side\nof the ducks.*');
    return;
  }

  await ctx.say('*You still have the Secret Potion Saturn shrugged at you in Veilstone.*');
  await ctx.say('*It smells appalling. The nearest Psyduck opens one eye.*');
  ctx.sfx('heal');
  await ctx.wait(0.6);
  await ctx.say('Psyduck: ...Psy?');
  await ctx.say('*One by one they get up and wander off into the fog, entirely unbothered,\nas though none of this had ever been happening.*');
  ctx.setFlag('psyducks', true);
  ctx.autosave();
  await ctx.say('The road north is clear.');
};

/**
 * Two grey coats in the shrine doorway. Beating the one who talks clears both
 * and opens the room behind them.
 */
SCRIPTS.celesticGrunt = async (ctx, npc) => {
  const t = getTrainer('celestic_grunt1');
  await ctx.say('Grunt: You do not want to be here. Nothing here is being taken.', { speaker: 'Galactic Grunt' });
  await ctx.say('Grunt: We are copying a wall. That is all this is. Copying a wall.');
  if (ctx.state.flags.lakeValor) {
    await ctx.say('Grunt: You were at Valor. Everyone who was has that face.\fThen you know we are not making any of this up.');
  }
  await ctx.say('Grunt: Elder. Step aside.');
  await ctx.say('Elder: No.', { speaker: 'Elder Carolina' });
  await ctx.say('Elder: I have been stood here since Tuesday and you have not managed it yet.');
  await ctx.say('Grunt: Fine. YOU, then, since she will not be moved.');

  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) return;

  await ctx.say(`Grunt: ${t.defeat}`, { speaker: 'Galactic Grunt' });
  await ctx.say('*The pair of them go down the road without hurrying, which is somehow\nthe worst part of it.*');
  await ctx.say('Elder: Forty years I have wanted somebody to do that.', { speaker: 'Elder Carolina' });
  await ctx.say('Elder: Come up to the shrine. You have earned the wall.');
  ctx.setFlag('celestic', true);
  ctx.shareMilestone('celestic');
  ctx.journal('celestic');
  ctx.sfx('badge');
  ctx.autosave();
  void npc;
};

/** Elder Carolina, in front of the mural, explaining what it is. */
SCRIPTS.celesticElder = async (ctx) => {
  const st = ctx.state;
  if (!st.flags.celestic) {
    await ctx.say('Elder: Not while they are stood in my doorway.', { speaker: 'Elder Carolina' });
    return;
  }
  if (st.flags.celesticRead) {
    await ctx.say('Elder: Read it again. It says the same thing. That is rather the point.', { speaker: 'Elder Carolina' });
    return;
  }
  await ctx.say('Elder: Everyone calls it a legend because it is old. Old is not the same\nas made up.', { speaker: 'Elder Carolina' });
  await ctx.say('Elder: Three waters. Three small ones asleep in them, one to a lake.\fKnowledge, emotion, willpower. That is what they are for.');
  await ctx.say('Elder: And above them the fourth. No face. Nobody has ever drawn it a face\nbecause nobody agreed what it was looking at.');
  await ctx.say('Elder: The three are not its servants. They are its locks.');
  await ctx.wait(0.5);
  await ctx.say('Elder: Those two in grey worked that out about a month ago.');
  await ctx.say('Elder: They are not robbers, child. They want to take the locks off.');
  if (st.flags.knowsTwist) {
    await ctx.say('Elder: You have been under Oreburgh. Then you have seen what it looks like\nwhen the world is asked to hold still.');
  }
  await ctx.say('Elder: Whatever is behind that door, they think the world would be better\nmade again without any of us in it.');
  await ctx.say('Elder: They are quite sincere. That is the frightening part.');
  ctx.setFlag('celesticRead', true);
  ctx.autosave();
};

/**
 * Lake Verity, after Valor. This one you get to in time to watch, which is
 * worse — Mars is already leaving and there is nothing to stop.
 */
SCRIPTS.lakeVerity = async (ctx) => {
  const st = ctx.state;
  ctx.sfx('warp');
  await ctx.wait(0.5);
  await ctx.say('*There are lorries on the shore of Lake Verity. There is a lake, still,\nwhich is more than Valor has.*');
  await ctx.say('*Nobody is stopping you. Nobody is looking at you.*');

  const t = getTrainer('lv_mars');
  await ctx.say('Mars: Oh, it is YOU. Honestly, at this point you are practically staff.',
    { speaker: 'Mars' });
  await ctx.say('Mars: You are four minutes late, by the way. Four. We were quick.');
  await ctx.say('Mars: The small one that lives here is in a box on that lorry\fand the lorry is going to Veilstone, and you are going to be four\nminutes late for that as well.');
  if (st.flags.celestic) {
    await ctx.say('Mars: You have been to the shrine. Good. Then you can stop pretending\nnot to understand what this is for.');
  }
  await ctx.say('Mars: I am not going to explain it. I am going to beat you and drive off.');

  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) return;

  await ctx.say(`Mars: ${t.defeat}`, { speaker: 'Mars' });
  await ctx.say('Mars: Fine. FINE. It does not matter, that is the thing about it,\fit genuinely does not matter whether you win these.');
  await ctx.say('*She gets into the lorry. The lorry leaves. The lake sits there being\na lake, with nothing in it.*');
  await ctx.wait(0.6);
  await ctx.say('*Two down. Acuity is the far north, past the mountain, in the snow.*');

  ctx.setFlag('lakeVerity', true);
  ctx.shareMilestone('lakeVerity');
  ctx.journal('lakeVerity');
  ctx.autosave();
};

// ---------------------------------------------------------------------------
// Canalave: the three volumes, and the room where it is finally said.
// ---------------------------------------------------------------------------

/**
 * The oldest written copy of the Sinnoh myth, in three short volumes.
 *
 * Deliberately not one long exposition NPC. The player reads three pages in
 * whatever order they find them, and the picture assembles in their head
 * before anybody says it out loud — which is the only way a revelation of
 * this size does not land as a lecture.
 */
const VOLUMES = {
  1: {
    title: 'VOLUME I — OF THE THREE WATERS',
    lines: [
      '"There were three waters made, and a keeper set in each,\nand the keepers were not put there to be found."',
      '"To the first was given knowing. To the second, feeling.\nTo the third, the will to go on."',
      '"These were not gifts to the world. These were what the keepers\nwere made of, so that they would be heavy enough."',
      '*Heavy enough for what, the volume does not say. The next page has\nbeen torn out, a very long time ago, by somebody in a hurry.*',
    ],
  },
  2: {
    title: 'VOLUME II — OF THE MOUNTAIN',
    lines: [
      '"Under the mountain there is a light that does not warm anything."',
      '"It was here before the mountain. The mountain was put on top of it,\nand that was the first thing anybody in this country ever built."',
      '"It does not want. It does not intend. Do not go to it expecting\nto be answered, and do not go expecting to be refused."',
      '"It is not sleeping the way a beast sleeps. It is sleeping the way\na weight sits at the bottom of a well."',
    ],
  },
  3: {
    title: 'VOLUME III — A NOTE, ADDED LATER',
    lines: [
      '*This one is four lines long and in a different hand.*',
      '"They will come and read the first book and say: three keepers,\nthree waters, three keys."',
      '"They are not keys. Nothing here is a door."',
      '"They are the weight. Take the weight off and see what you have\nopened, and then try to put it back."',
    ],
  },
};

SCRIPTS.libraryBook = async (ctx, ev) => {
  const n = (ev && ev.volume) || 1;
  const v = VOLUMES[n];
  await ctx.say(`*${v.title}*`);
  for (const line of v.lines) await ctx.say(line);
  ctx.setFlag(`readVolume${n}`, true);

  const st = ctx.state;
  const all = st.flags.readVolume1 && st.flags.readVolume2 && st.flags.readVolume3;
  if (all && !st.flags.canalaveTruth) {
    await ctx.wait(0.4);
    await ctx.say('*You put the third volume down and stand there for a moment with your\nhand still on it.*');
    await ctx.say('*Somebody at the far table has stopped pretending to read.*');
  }
  ctx.autosave();
};

/**
 * Looker, at the far table, with the whole thing assembled.
 *
 * He is not clever here. He is a man who has been doing paperwork for eight
 * months and has just understood what the paperwork was about.
 */
SCRIPTS.lookerLibrary = async (ctx) => {
  const st = ctx.state;
  const all = st.flags.readVolume1 && st.flags.readVolume2 && st.flags.readVolume3;

  if (st.flags.canalaveTruth) {
    await ctx.say('Looker: Mount Coronet. That is where this ends. I have said it out loud\nnow, so it is real, and I would like it to stop being real.',
      { speaker: 'Looker' });
    return;
  }
  if (!all) {
    await ctx.say('Looker: You again. Good. Sit down, do not sit down, I do not mind.',
      { speaker: 'Looker' });
    await ctx.say('Looker: There are three volumes here and I have read two of them\nfour times each.');
    await ctx.say('Looker: Read them. All three. I want to know whether you get the same\nanswer I did, because I would very much like to be wrong.');
    return;
  }

  await ctx.say('Looker: You have got the same face I had.', { speaker: 'Looker' });
  await ctx.wait(0.4);
  await ctx.say('Looker: Right. Here is eight months of my life in one minute.');
  await ctx.say('Looker: Oreburgh was not a robbery. It was a test.\fThey wanted to know whether a machine could touch that thing at all.');
  await ctx.say('Looker: It could. Something came out. You were there — you know better\nthan I do what came out.');
  if (st.flags.caughtEverlight) {
    await ctx.say('Looker: And it went with you. Not with them. With YOU.\fMars has written four reports about that and none of them are calm.');
  } else {
    await ctx.say('Looker: And it stayed. Standing in that chamber, where they could not\nreach it. It has been there ever since.');
  }
  await ctx.say('Looker: So they stopped trying to take the thing itself and started\ntaking what is holding it down.');
  await ctx.say('Looker: Valor. Verity. Acuity. Three lakes, three keepers,\nand a schedule Saturn was rude enough to mention to you.');
  await ctx.wait(0.5);
  await ctx.say('Looker: Volume Three is four lines long and somebody added it later,\nwhich means somebody had already made this mistake once.');
  await ctx.say('Looker: "They are not keys. Nothing here is a door."');
  await ctx.say('Looker: Cyrus thinks he is unlocking something.\fHe is taking the weight off a lid.');
  await ctx.wait(0.4);
  await ctx.say('Looker: The lakes were never the destination. They are the method.');
  await ctx.say('Looker: The destination is the mountain, and it always was.');

  ctx.setFlag('canalaveTruth', true);
  ctx.shareMilestone('canalaveTruth');
  ctx.journal('canalaveTruth');
  ctx.sfx('badge');
  ctx.autosave();

  await ctx.say('Looker: I am going to Celestic to shout at somebody with authority.');
  await ctx.say('Looker: You are going to do whatever it is you do, which so far has\nworked considerably better than anything I have tried.');
};

/** Eldon's boat. He will not sail before Byron signs the pass. */
SCRIPTS.ironBoat = async (ctx) => {
  const st = ctx.state;
  if (!st.flags.badge6) {
    await ctx.say('Eldon: Iron Island is a working mine, not a day out.', { speaker: 'Eldon' });
    await ctx.say('Eldon: Byron signs the passes and Byron is up the Gym.\fBeat him and he will sign anything, he is like that.');
    return;
  }
  const go = await ctx.ask('Sail out to Iron Island?', ['Yes', 'Not yet']);
  if (go !== 0) { await ctx.say('Eldon: She will be here.'); return; }
  await ctx.say('Eldon: Half an hour out. Rough for ten of it. Hold something.');
  ctx.sfx('warp');
  await ctx.warpTo('iron_island', 1, 13);
};

/**
 * Riley, who hands over Strength — and, without making a speech of it, the
 * first person to say the thing the ending is about.
 */
SCRIPTS.riley = async (ctx) => {
  const st = ctx.state;
  if (st.flags.rileyDone) {
    await ctx.say('Riley: Still here. The rock is still talking. It is not in a hurry\nand neither am I.', { speaker: 'Riley' });
    return;
  }
  await ctx.say('Riley: You are the one from Oreburgh.', { speaker: 'Riley' });
  await ctx.say('Riley: Do not look like that. Half of Sinnoh is the one from Oreburgh\nby now. It is a small country and it gossips.');
  await ctx.say('Riley: I come out here because the island is honest. Rock either moves\nor it does not, and it tells you which straight away.');
  await ctx.wait(0.4);
  await ctx.say('Riley: People are not like that, which is the whole trouble with them,\nand the whole point of them.');
  await ctx.say('Riley: Here. You will want this before the mountain.');
  ctx.give('hm04', 1);
  ctx.sfx('badge');
  await ctx.say('You received HM04!');
  await ctx.say('Riley: Strength. It does not make you strong. It means something\nheavy will move if you and it agree to move it.');
  await ctx.say('Riley: That is most things, in my experience.');
  ctx.setFlag('rileyDone', true);
  ctx.journal('riley');
  ctx.autosave();
};

// ---------------------------------------------------------------------------
// The opening, as the two of them actually live it.
//
// Whichever one you picked is the one holding the phone; the other is a real
// person in the world who was waiting on the step. Every line below is
// written to read correctly in both directions, because it is the same code
// in both directions — there is no Matthew version and no Sammy version.
// ---------------------------------------------------------------------------

/** Your mum, catching you at the door before you get out of it. */
SCRIPTS.mumDoor = async (ctx) => {
  const st = ctx.state;
  if (st.flags.mumSentYouOff) return;
  const who = buddyOf(st);
  ctx.sfx('bump');
  await ctx.say('Mum: Not out the door without me saying something at you first.',
    { speaker: 'Mum' });
  await ctx.say('Mum: Professor Rowan rang. She wants you at the lab. She wants BOTH\nof you at the lab, she was very clear about it.');
  await ctx.say(`Mum: ${who} is already outside. Has been for a while, I think.\fThey did not knock. They never knock, they just stand there.`);
  await ctx.wait(0.3);
  await ctx.say('Mum: And take this. I am not having you wandering about Sinnoh\nasking strangers which way is up.');
  ctx.give('townmap', 1);
  ctx.sfx('badge');
  await ctx.say('You received the TOWN MAP!');
  await ctx.say('Mum: It is in the menu. It fills itself in as you go, so it will be\nmostly blank and that is not a fault.');
  await ctx.wait(0.3);
  await ctx.say('Mum: These too. You have worn through two pairs already this year.');
  ctx.give('runningshoes', 1);
  await ctx.say('You received the RUNNING SHOES!');
  await ctx.say('Mum: Hold B and they do the rest.');
  await ctx.wait(0.3);
  await ctx.say('Mum: Go on. Take your time and do not take too long, which I am aware\nis two different instructions.');
  ctx.setFlag('mumSentYouOff', true);
  ctx.autosave();
};

/**
 * The other one, waiting on the step, joining you.
 *
 * If you are Sammy then Bandit gets in first, because she always does, and
 * because a dog does not wait politely for a conversation to finish.
 */
SCRIPTS.buddyWaiting = async (ctx) => {
  const st = ctx.state;
  if (st.flags.buddyJoined) return;
  const me = playerOf(st);
  const them = buddyPlayerOf(st);
  const iAmSammy = me.key === 'sammy';

  // EVERYONE IS ON SCREEN BEFORE ANYBODY SPEAKS.
  //
  // This scene used to talk first and put people on the map afterwards, so
  // the player stood alone on a doorstep listening to a voice from nowhere
  // and then watched the speaker appear at the end, already mid-conversation.
  // The other one has been waiting on this step for an hour. They are here
  // when the door opens, because that is the entire point of the scene.
  ctx.companionJoin({ look: them.look, name: them.name, key: them.key });
  // And so is the dog, whichever of the two is holding the phone.
  //
  // She used to be dismissed outright when Sammy was the player, on the
  // reasoning that she would be in Sammy's party and the Pokemon follower
  // would draw her. She is not in anybody's party on that doorstep — the
  // starter is still an hour away — so Sammy got three paragraphs about a dog
  // hitting her at knee height and sitting on her foot, with no dog anywhere
  // on the screen. She joins for both of them now, and the walking body hides
  // itself if the party follower ever ends up drawing her instead.
  ctx.petJoin({ species: BANDIT.species, name: BANDIT.nickname });
  await ctx.wait(0.45);

  // The two beats, in the order the person playing would experience them.
  //
  //   Sammy  — the dog is on HER step and gets to you first, then Matthew.
  //   Matthew — Sammy is at HIS door; the dog came with her, and says hello
  //             after, because she is greeting you second-hand.
  //
  // Both scenes happen for both players. They used to be Sammy-only, so
  // choosing Matthew deleted Bandit from the opening entirely while leaving
  // every line about her in place.
  const banditHello = async () => {
    if (st.flags.banditHello) return;
    ctx.sfx('bump');
    ctx.cry(BANDIT.species);
    if (iAmSammy) {
      await ctx.say('*Something hits you at knee height before you have finished\nshutting the door.*');
      await ctx.say('Bandit: *She has been sat on this step since it got light and she is\nnot going to let you forget it.*', { speaker: 'Bandit' });
      await ctx.say('*She does a full circuit of you, twice, and then sits down on your\nfoot to make the arrangement official.*');
    } else {
      await ctx.say('*There is a dog sitting on your doorstep. She is not your dog.*');
      await ctx.say('Bandit: *She looks up at you, then back at ' + them.name + ', to check that\nthis is a person they approve of.*', { speaker: 'Bandit' });
      await ctx.say('*Apparently it is. She leans her entire weight against your shin and\nstays there.*');
    }
    ctx.setFlag('banditHello', true);
    ctx.setFlag(FLAGS.BANDIT_WITH_US, true);
  };

  const buddyHello = async () => {
    await ctx.say(them.name + ': There you are.', { speaker: them.name });
    await ctx.say(them.name + ': I have been stood on this step for an hour and your mum has\nlooked out of that window four times.');
    if (iAmSammy) {
      await ctx.say(them.name + ': She waved. I waved. It got worse each time.');
    } else {
      await ctx.say(them.name + ': I did wave at her. I do not think it helped.');
      await ctx.say('*' + BANDIT.nickname + ' has not moved off your foot. ' + them.name + ' pretends not to\nnotice, and then scratches her ear without looking down.*');
    }
  };

  if (iAmSammy) { await banditHello(); await ctx.wait(0.3); await buddyHello(); }
  else { await buddyHello(); await ctx.wait(0.3); await banditHello(); }

  await ctx.wait(0.3);
  await ctx.say(them.name + ': Rowan wants us both. Both, she said, like she thought one of us\nwould try to go without the other.', { speaker: them.name });
  await ctx.say(them.name + ': As if.');
  await ctx.say(them.name + ': Right. You lead. You always know where you are going and I\nalways pretend I do.');

  ctx.setFlag('buddyJoined', true);
  ctx.setFlag(FLAGS.BANDIT_WITH_US, true);
  ctx.shareMilestone('buddyJoined');
  ctx.autosave();
  await ctx.say(them.name + ' is coming with you!');
};


/** The Eterna bike shop. One bicycle, given away, for reasons of his own. */
SCRIPTS.bikeShop = async (ctx) => {
  const st = ctx.state;
  if (ctx.hasItem('bicycle')) {
    await ctx.say('Rad: How is she riding? Do not answer that, I will only worry.',
      { speaker: 'Rad Rickshaw' });
    return;
  }
  if (!st.flags.badge2) {
    await ctx.say('Rad: Bicycles. That is the shop.', { speaker: 'Rad Rickshaw' });
    await ctx.say('Rad: I am not selling you one. I have never sold one.\fI give them to people who have beaten Gardenia, and I could not\ntell you why I started.');
    await ctx.say('Rad: Go and beat Gardenia. Then we will talk about wheels.');
    return;
  }
  await ctx.say('Rad: Forest Badge. Right.', { speaker: 'Rad Rickshaw' });
  await ctx.say('Rad: Take it. Folding frame, holds a corner, does not complain.');
  ctx.give('bicycle', 1);
  ctx.sfx('badge');
  await ctx.say('You received the BICYCLE!');
  await ctx.say('Rad: Do not thank me. Everybody thanks me and it makes it weird.');
  ctx.autosave();
};

export function scriptFor(name) { return SCRIPTS[name] || null; }
