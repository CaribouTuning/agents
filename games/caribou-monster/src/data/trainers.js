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
