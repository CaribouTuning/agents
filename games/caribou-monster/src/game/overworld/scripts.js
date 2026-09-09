// Story scripts.
//
// A script is an async function that receives a small `ctx` of primitives —
// say, ask, battle, give, wait, move — and awaits them. Writing cutscenes as
// straight-line async code keeps them readable, and keeps the sequencing out
// of the render loop entirely.
import { STARTER_LINES, rivalStarterBase, getTrainer } from '../../data/trainers.js';
import { getSpecies } from '../../data/species.js';
import { createMonster } from '../monster.js';
import { FLAGS } from '../storyflags.js';

export const SCRIPTS = {};

// ---- Professor Rowan: choosing a starter ---------------------------------

SCRIPTS.starter = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.GOT_STARTER]) {
    await ctx.say('Prof. Rowan: How is it settling in? Keep it close and it will keep you close.');
    return;
  }

  await ctx.say('Prof. Rowan: There you are.\fI have three young Pokémon here and nobody to raise them. Take a look.');

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
  await ctx.say('Prof. Rowan: Good choice. They all are.\fTake this too — you will want to know what you are looking at out there.');
  ctx.give('pokedex', 1);
  ctx.give('pokeball', 5);
  await ctx.say('You received the Pokédex and 5 Poké Balls!');
  await ctx.say('Prof. Rowan: Oreburgh City is north, past Route 202.\fThe road there is the whole point. Go and walk it.');

  ctx.setFlag(FLAGS.GOT_STARTER);
  ctx.shareMilestone(FLAGS.GOT_STARTER);
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

  const rival = ctx.spawnNpc({
    id: 'rival', look: st.player.look === 'girl' ? 'rivalBoy' : 'rivalGirl',
    x: ctx.player.x, y: ctx.player.y - 3, dir: 'down', name: 'Rival',
  });
  ctx.sfx('bump');
  await ctx.wait(0.35);
  await ctx.walk(rival, 'down', 2);
  await ctx.say('Rival: There you are! I heard the professor had one left over.\fWhich did you end up with?');
  await ctx.say('Rival: Never mind, I can see it from here.\fCome on then. First one is for practice.');

  const t = rivalTeam(st, 'rival_1');
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) {
    await ctx.say('Rival: Ha! Told you. Go patch them up and we will do it again.');
    ctx.despawn(rival);
    return;
  }
  await ctx.say('Rival: Fine. You picked better. This time.\fI am heading north. Try to keep up.');
  await ctx.walk(rival, 'up', 4);
  ctx.despawn(rival);
  ctx.setFlag(FLAGS.BEAT_RIVAL_1);
  ctx.setFlag(FLAGS.MET_RIVAL);
  ctx.setFlag(FLAGS.LEFT_TOWN);
  ctx.shareMilestone(FLAGS.LEFT_TOWN);
};

SCRIPTS.rival2 = async (ctx) => {
  const st = ctx.state;
  if (st.flags[FLAGS.BEAT_RIVAL_2] || !st.flags[FLAGS.BEAT_RIVAL_1]) {
    ctx.setFlag(FLAGS.REACHED_ALDERMERE);
    return;
  }
  const rival = ctx.spawnNpc({
    id: 'rival', look: st.player.look === 'girl' ? 'rivalBoy' : 'rivalGirl',
    x: ctx.player.x, y: ctx.player.y - 2, dir: 'down', name: 'Rival',
  });
  await ctx.wait(0.3);
  await ctx.say('Rival: Oreburgh already? You have been busy.\fSo have I. Show me.');

  const t = rivalTeam(st, 'rival_2');
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (won) {
    await ctx.say('Rival: You have been busier. Noted.\fRoark is in that grey building. She does not go easy on anyone.');
    ctx.setFlag(FLAGS.BEAT_RIVAL_2);
  } else {
    await ctx.say('Rival: Better luck next time. The Centre is right there — the red roof.');
  }
  await ctx.walk(rival, 'up', 3);
  ctx.despawn(rival);
  ctx.setFlag(FLAGS.REACHED_ALDERMERE);
  ctx.shareMilestone(FLAGS.REACHED_ALDERMERE);
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
  for (const line of npc.data.after || []) await ctx.say(`${t.name}: ${line}`, { speaker: t.name });
};

// ---- Team Galactic ---------------------------------------------------------------

SCRIPTS.commander = async (ctx, npc) => {
  const t = getTrainer(npc.data.trainer);
  if (ctx.state.flags[`beat_${t.id}`]) {
    for (const line of npc.data.after || []) await ctx.say(`Mars: ${line}`, { speaker: 'Mars' });
    return;
  }
  await ctx.say('A figure in a long coat is standing over a seam of pale light in the rock.');
  await ctx.say(`Mars: ${t.intro}`, { speaker: 'Mars' });
  const won = await ctx.battle({ trainer: t, kind: 'trainer' });
  if (!won) return;
  await ctx.say(`Mars: ${t.defeat}`, { speaker: 'Mars' });
  await ctx.say('The light in the seam pulses once, slowly, like something turning over in its sleep.');
  ctx.setFlag(FLAGS.BEAT_COMMANDER);
  ctx.shareMilestone(FLAGS.BEAT_COMMANDER);
  for (const line of npc.data.after || []) await ctx.say(`Mars: ${line}`, { speaker: 'Mars' });
};

export function scriptFor(name) { return SCRIPTS[name] || null; }
