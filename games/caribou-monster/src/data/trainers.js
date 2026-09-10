// Trainer data. A trainer is a name, a look, a team, an AI level, a purse
// and two lines of dialogue — nothing about a specific battle lives in code.
//
//  ai: 0 random (rookie) · 1 picks by type matchup · 2 also switches and
//      uses items (gym leaders and the rival)

const T = (id, o) => ({ id, prize: 0, ai: 1, look: 'youngster', ...o });

export const TRAINERS = {};
const add = (id, o) => { TRAINERS[id] = T(id, o); };

const mon = (species, level, moves, extra = {}) => ({ species, level, moves, ...extra });

// ---- Route 201 -----------------------------------------------------------
add('r1_youngster', {
  name: 'Youngster Cal', cls: 'Youngster', look: 'youngster', ai: 0, prize: 240,
  intro: 'My Pokémon and I trained all summer for this!',
  defeat: 'All summer... for that?',
  team: [mon(399, 5, ['tackle', 'growl']), mon(396, 6, ['tackle', 'growl'])],
});
add('r1_lass', {
  name: 'Lass Mira', cls: 'Lass', look: 'lass', ai: 0, prize: 288,
  intro: 'You look like you know what you are doing. Prove it!',
  defeat: 'You really did know what you were doing.',
  team: [mon(403, 6, ['tackle', 'leer']), mon(401, 6, ['bugbite', 'stringshot'])],
});

// ---- Route 202 -------------------------------------------------
add('ww_bug1', {
  name: 'Bug Catcher Denny', cls: 'Bug Catcher', look: 'bugCatcher', ai: 0, prize: 224,
  intro: 'The forest is full of bugs! I caught most of them myself.',
  defeat: 'Aww. Back to the net.',
  team: [mon(401, 7, ['bugbite', 'growl']), mon(401, 8, ['bugbite', 'stringshot'])],
});
add('ww_bug2', {
  name: 'Bug Catcher Rio', cls: 'Bug Catcher', look: 'bugCatcher', ai: 1, prize: 288,
  intro: 'Denny is the loud one. I am the one who wins.',
  defeat: 'I was the one who wins.',
  team: [mon(402, 9, ['furycutter', 'stringshot', 'growl'])],
});
add('ww_lass', {
  name: 'Lass Petra', cls: 'Lass', look: 'lass', ai: 1, prize: 320,
  intro: 'Shh! You will scare the Buneary.',
  defeat: 'There they go...',
  team: [mon(427, 8, ['pound', 'defensecurl']), mon(406, 8, ['absorb', 'growth'])],
});
add('ww_grunt', {
  name: 'Galactic Grunt', cls: 'Team Galactic', look: 'grunt', ai: 1, prize: 480,
  intro: 'Team Galactic is measuring this forest. Move along or be measured.',
  defeat: 'Fine. Measure it yourself.',
  team: [mon(41, 9, ['astonish', 'supersonic']), mon(401, 10, ['bugbite', 'furycutter'])],
});

// ---- Route 203 -----------------------------------------------------------
add('r3_youngster', {
  name: 'Youngster Pell', cls: 'Youngster', look: 'youngster', ai: 1, prize: 352,
  intro: 'Jubilife kids are soft. I walk this road every day.',
  defeat: 'I walk it every day and I still lost on it.',
  team: [mon(396, 9, ['tackle', 'growl', 'quickattack']), mon(399, 10, ['tackle', 'defensecurl'])],
});
add('r3_lass', {
  name: 'Lass Nima', cls: 'Lass', look: 'lass', ai: 1, prize: 400,
  intro: 'Everyone here is going to Oreburgh. Nobody here is ready for Oreburgh.',
  defeat: 'You might be, actually.',
  team: [mon(403, 10, ['tackle', 'leer', 'spark']), mon(401, 9, ['bugbite', 'stringshot'])],
});
add('r3_bug', {
  name: 'Bug Catcher Odo', cls: 'Bug Catcher', look: 'bugCatcher', ai: 0, prize: 320,
  intro: 'There are better bugs on this route than in the whole forest!',
  defeat: 'There are better trainers on it too, apparently.',
  team: [mon(415, 10, ['bugbite', 'gust']), mon(401, 11, ['bugbite', 'furycutter'])],
});

// ---- Oreburgh Gym -------------------------------------------------------
add('gym1_hiker1', {
  name: 'Hiker Bost', cls: 'Hiker', look: 'hiker', ai: 1, prize: 560,
  intro: 'Rock is not slow. Rock is patient. There is a difference.',
  defeat: 'Patience did not help.',
  team: [mon(74, 12, ['tackle', 'defensecurl', 'rockthrow'])],
});
add('gym1_worker', {
  name: 'Worker Kell', cls: 'Worker', look: 'worker', ai: 1, prize: 600,
  intro: 'I dug every stone in this gym out of the quarry myself.',
  defeat: 'Should have dug a bigger one.',
  team: [mon(74, 11, ['tackle', 'rockthrow']), mon(66, 12, ['lowkick', 'leer', 'karatechop'])],
});
add('gym1_hiker2', {
  name: 'Hiker Jun', cls: 'Hiker', look: 'hiker', ai: 1, prize: 640,
  intro: 'Get past me and Roark is next. Nobody gets past me.',
  defeat: 'Somebody got past me.',
  team: [mon(74, 13, ['rockthrow', 'defensecurl', 'magnitude']), mon(41, 12, ['astonish', 'bite'])],
});
add('gym1_leader', {
  name: 'Roark', cls: 'Gym Leader', look: 'leaderRock', ai: 2, prize: 2400, leader: true,
  badge: 1, badgeName: 'Coal Badge', tm: 'tm01',
  intro: 'Oreburgh was cut out of the hillside by people who did not give up.\nShow me you have the same in you.',
  defeat: 'Straight through the stone. That is the Coal Badge — you have earned it.',
  team: [
    mon(74, 12, ['rockthrow', 'defensecurl', 'magnitude']),
    mon(95, 12, ['rockthrow', 'harden', 'rocktomb']),
    mon(185, 14, ['rockthrow', 'defensecurl', 'rocktomb', 'magnitude']),
  ],
});

// ---- Route 207 --------------------------------------------------------------
add('r2_youngster', {
  name: 'Youngster Pell', cls: 'Youngster', look: 'youngster', ai: 1, prize: 480,
  intro: 'Past this route the caves start. Better warm up on me.',
  defeat: 'Consider yourself warm.',
  team: [mon(403, 15, ['spark', 'leer']), mon(400, 15, ['tackle', 'watergun'])],
});
add('r2_hiker', {
  name: 'Hiker Marl', cls: 'Hiker', look: 'hiker', ai: 1, prize: 680,
  intro: 'Oreburgh Gate eats hikers. I am the one it spat back out.',
  defeat: 'Back down the hill I go.',
  team: [mon(74, 16, ['rockthrow', 'magnitude']), mon(66, 16, ['karatechop', 'lowkick'])],
});

// ---- Oreburgh Gate --------------------------------------------------------
add('cave_grunt1', {
  name: 'Galactic Grunt', cls: 'Team Galactic', look: 'grunt', ai: 1, prize: 720,
  intro: 'This cave belongs to Team Galactic now. Turn around.',
  defeat: 'The commander is not going to like this.',
  team: [mon(41, 16, ['bite', 'supersonic', 'wingattack']), mon(74, 16, ['rockthrow', 'defensecurl'])],
});
add('cave_grunt2', {
  name: 'Galactic Grunt', cls: 'Team Galactic', look: 'gruntF', ai: 1, prize: 760,
  intro: 'You are standing where the light comes through. Move.',
  defeat: 'Stand wherever you like.',
  team: [mon(42, 17, ['bite', 'confusion']), mon(66, 17, ['karatechop', 'furyswipes'])],
});
add('cave_commander', {
  name: 'Commander Mars', cls: 'Team Galactic', look: 'boss', ai: 2, prize: 3000,
  intro: 'The Everlight sleeps under this hill, and Galactic intends to wake it.\nYou are one trainer. Reconsider.',
  defeat: 'One trainer. Noted. We will not make that mistake twice.',
  team: [
    mon(42, 18, ['bite', 'confusion', 'airslash']),
    mon(64, 18, ['confusion', 'psybeam', 'doubleteam']),
    mon(67, 19, ['karatechop', 'brickbreak', 'revenge']),
  ],
});

// ---- Rival ------------------------------------------------------------------
// The rival's starter is chosen at runtime to counter the player's, exactly
// like the DS games. `starterOffset` picks the type-advantaged line.
add('rival_1', {
  name: 'Cass Wren', cls: 'Rival', look: 'rivalGirl', ai: 1, prize: 400, rival: true,
  intro: 'One year. That is how far ahead I am.',
  defeat: 'That is not what a year is supposed to look like.',
  team: [mon(396, 5, ['tackle', 'growl']), 'RIVAL_STARTER:5'],
});
add('rival_2', {
  name: 'Cass Wren', cls: 'Rival', look: 'rivalGirl', ai: 2, prize: 900, rival: true,
  intro: 'Badge first. Roark does not care what anyone is rated.',
  defeat: 'You have got faster. Not better. Faster.',
  team: [mon(397, 12, ['quickattack', 'wingattack', 'growl']), mon(403, 12, ['spark', 'leer']), 'RIVAL_STARTER:13'],
});
add('rival_3', {
  name: 'Cass Wren', cls: 'Rival', look: 'rivalGirl', ai: 3, prize: 1600, rival: true,
  intro: 'You are going in having beaten me, or you are not going in.',
  defeat: 'I am not going to pretend I am not annoyed about that.',
  team: [mon(397, 18, ['wingattack', 'quickattack', 'doubleteam']), mon(404, 18, ['spark', 'bite', 'leer']),
    mon(427, 17, ['quickattack', 'defensecurl']), 'RIVAL_STARTER:19'],
});

export function getTrainer(id) { return TRAINERS[id]; }

// The three starter lines, in the order they are offered. Index 0 beats
// index 1 beats index 2 beats index 0.
export const STARTER_LINES = [
  { base: 387, name: 'Turtwig' },
  { base: 390, name: 'Chimchar' },
  { base: 393, name: 'Piplup' },
];

// Which line the rival takes: the one that is strong against the player's.
export function rivalStarterBase(playerBase) {
  const idx = STARTER_LINES.findIndex((s) => s.base === playerBase);
  if (idx < 0) return STARTER_LINES[0].base;
  return STARTER_LINES[(idx + 1) % 3].base;
}

// ---- the northern branch -----------------------------------------------------
// Route 204 up through Floaroma, the Windworks, Eterna Forest and Route 206 —
// the loop road. Levels climb as the ring turns, so coming round the long way
// from Oreburgh is a harder walk than going up from Jubilife, which is the
// point of having two ways round.

add('r4_bug', {
  name: 'Bug Catcher Odell', cls: 'Bug Catcher', look: 'bugCatcher', ai: 1, prize: 448,
  intro: 'North road is the good road. Everything up here is bigger.',
  defeat: 'Bigger is not the same as better. I know that now.',
  team: [mon(415, 12, ['gust', 'bugbite']), mon(401, 12, ['bugbite', 'stringshot'])],
});
add('r4_lass', {
  name: 'Lass Bree', cls: 'Lass', look: 'lass', ai: 1, prize: 480,
  intro: 'Everyone goes east to Oreburgh. Nobody comes north. Their loss.',
  defeat: 'Well. Somebody came north.',
  team: [mon(399, 13, ['tackle', 'defensecurl', 'rollout']), mon(396, 12, ['quickattack', 'growl', 'wingattack'])],
});
add('r5_youngster', {
  name: 'Youngster Calder', cls: 'Youngster', look: 'youngster', ai: 1, prize: 560,
  intro: 'The Windworks is that way. I am this way. Deal with me first.',
  defeat: 'Fine. Go and look at the turbines.',
  team: [mon(403, 14, ['spark', 'leer', 'quickattack']), mon(406, 14, ['absorb', 'growth'])],
});
add('r5_bug', {
  name: 'Bug Catcher Wexley', cls: 'Bug Catcher', look: 'bugCatcher', ai: 1, prize: 560,
  intro: 'Wait until you see the forest. This is nothing. This is the garden.',
  defeat: 'The forest will sort you out. It sorted me out.',
  team: [mon(265, 14, ['tackle', 'stringshot']), mon(401, 15, ['bugbite', 'stringshot']), mon(415, 14, ['gust', 'bugbite'])],
});
add('ww_worker', {
  name: 'Worker Fen', cls: 'Worker', look: 'worker', ai: 2, prize: 700,
  intro: 'Thirty years these turbines have run. I am not letting a trainer stop them.',
  defeat: 'Nobody stopped anything. Go on, have a look round.',
  team: [mon(81, 16, ['thundershock', 'supersonic', 'spark']), mon(74, 16, ['rockthrow', 'magnitude'])],
});
add('ef_bug', {
  name: 'Bug Catcher Ines', cls: 'Bug Catcher', look: 'bugCatcher', ai: 2, prize: 640,
  intro: 'You cannot see the sky in here. That is how you know it is a proper forest.',
  defeat: 'Follow the path. Do not follow anything else.',
  team: [mon(406, 16, ['absorb', 'growth']), mon(455, 16, ['bite', 'growth', 'vinewhip'])],
});
add('r6_hiker', {
  name: 'Hiker Bruck', cls: 'Hiker', look: 'hiker', ai: 2, prize: 880,
  intro: 'South from here runs all the way to Oreburgh. Long road. Good road.',
  defeat: 'Take it slowly and it will treat you well.',
  team: [mon(74, 18, ['rockthrow', 'magnitude', 'defensecurl']), mon(66, 18, ['karatechop', 'lowkick']), mon(95, 17, ['rockthrow', 'rocktomb'])],
});

// ---- the Eterna Gym ----------------------------------------------------------
add('gym2_a', {
  name: 'Lass Thea', cls: 'Lass', look: 'lass', ai: 2, prize: 720,
  intro: 'Gardenia taught me. That should worry you.',
  defeat: 'She taught me. She did not teach me enough.',
  team: [mon(406, 17, ['absorb', 'growth', 'sweetscent']), mon(455, 17, ['vinewhip', 'bite', 'growth'])],
});
add('gym2_b', {
  name: 'Bug Catcher Norr', cls: 'Bug Catcher', look: 'bugCatcher', ai: 2, prize: 720,
  intro: 'Grass and Bug together. Nothing gets through that. Nothing sensible.',
  defeat: 'You were not sensible.',
  team: [mon(415, 17, ['gust', 'bugbite']), mon(402, 18, ['bugbite', 'fury swipes'.replace(' ',''), 'sing'])],
});
add('gym2_leader', {
  name: 'Gardenia', cls: 'Gym Leader', look: 'lass', ai: 3, prize: 3600, leader: true,
  badge: 2, badgeName: 'Forest Badge', tm: 'tm08',
  intro: 'Everything in this room grew here, including me.\nPeople think Grass is the gentle one. Show me what you think.',
  defeat: 'Right through the hedge. That is the Forest Badge, and you earned every leaf of it.',
  team: [
    mon(406, 19, ['absorb', 'growth', 'sweetscent']),
    mon(455, 19, ['vinewhip', 'bite', 'growth', 'sweetscent']),
    mon(407, 22, ['magicalleaf', 'growth', 'poisonsting', 'sweetscent']),
  ],
});
