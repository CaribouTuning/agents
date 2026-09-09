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
  team: [mon(13, 5, ['tackle', 'growl']), mon(10, 6, ['tackle', 'growl'])],
});
add('r1_lass', {
  name: 'Lass Mira', cls: 'Lass', look: 'lass', ai: 0, prize: 288,
  intro: 'You look like you know what you are doing. Prove it!',
  defeat: 'You really did know what you were doing.',
  team: [mon(15, 6, ['tackle', 'leer']), mon(18, 6, ['bugbite', 'strugglebug'])],
});

// ---- Route 202 -------------------------------------------------
add('ww_bug1', {
  name: 'Bug Catcher Denny', cls: 'Bug Catcher', look: 'bugCatcher', ai: 0, prize: 224,
  intro: 'The forest is full of bugs! I caught most of them myself.',
  defeat: 'Aww. Back to the net.',
  team: [mon(18, 7, ['bugbite', 'growl']), mon(18, 8, ['bugbite', 'strugglebug'])],
});
add('ww_bug2', {
  name: 'Bug Catcher Rio', cls: 'Bug Catcher', look: 'bugCatcher', ai: 1, prize: 288,
  intro: 'Denny is the loud one. I am the one who wins.',
  defeat: 'I was the one who wins.',
  team: [mon(19, 9, ['furycutter', 'strugglebug', 'growl'])],
});
add('ww_lass', {
  name: 'Lass Petra', cls: 'Lass', look: 'lass', ai: 1, prize: 320,
  intro: 'Shh! You will scare the Buneary.',
  defeat: 'There they go...',
  team: [mon(22, 8, ['pound', 'defensecurl']), mon(20, 8, ['absorb', 'growth'])],
});
add('ww_grunt', {
  name: 'Galactic Grunt', cls: 'Team Galactic', look: 'grunt', ai: 1, prize: 480,
  intro: 'Team Galactic is measuring this forest. Move along or be measured.',
  defeat: 'Fine. Measure it yourself.',
  team: [mon(24, 9, ['astonish', 'supersonic']), mon(18, 10, ['bugbite', 'furycutter'])],
});

// ---- Oreburgh Gym -------------------------------------------------------
add('gym1_hiker1', {
  name: 'Hiker Bost', cls: 'Hiker', look: 'hiker', ai: 1, prize: 560,
  intro: 'Rock is not slow. Rock is patient. There is a difference.',
  defeat: 'Patience did not help.',
  team: [mon(26, 12, ['tackle', 'defensecurl', 'rockthrow'])],
});
add('gym1_worker', {
  name: 'Worker Kell', cls: 'Worker', look: 'worker', ai: 1, prize: 600,
  intro: 'I dug every stone in this gym out of the quarry myself.',
  defeat: 'Should have dug a bigger one.',
  team: [mon(26, 11, ['tackle', 'rockthrow']), mon(29, 12, ['lowkick', 'leer', 'karatechop'])],
});
add('gym1_hiker2', {
  name: 'Hiker Jun', cls: 'Hiker', look: 'hiker', ai: 1, prize: 640,
  intro: 'Get past me and Roark is next. Nobody gets past me.',
  defeat: 'Somebody got past me.',
  team: [mon(26, 13, ['rockthrow', 'defensecurl', 'magnitude']), mon(24, 12, ['astonish', 'bite'])],
});
add('gym1_leader', {
  name: 'Roark', cls: 'Gym Leader', look: 'leaderRock', ai: 2, prize: 2400, leader: true,
  badge: 1, badgeName: 'Coal Badge', tm: 'tm01',
  intro: 'Oreburgh was cut out of the hillside by people who did not give up.\nShow me you have the same in you.',
  defeat: 'Straight through the stone. That is the Coal Badge — you have earned it.',
  team: [
    mon(26, 12, ['rockthrow', 'defensecurl', 'magnitude']),
    mon(28, 12, ['rockthrow', 'harden', 'rocktomb']),
    mon(52, 14, ['rockthrow', 'defensecurl', 'rocktomb', 'bulldoze']),
  ],
});

// ---- Route 207 --------------------------------------------------------------
add('r2_youngster', {
  name: 'Youngster Pell', cls: 'Youngster', look: 'youngster', ai: 1, prize: 480,
  intro: 'Past this route the caves start. Better warm up on me.',
  defeat: 'Consider yourself warm.',
  team: [mon(15, 15, ['spark', 'leer']), mon(14, 15, ['tackle', 'watergun'])],
});
add('r2_hiker', {
  name: 'Hiker Marl', cls: 'Hiker', look: 'hiker', ai: 1, prize: 680,
  intro: 'Oreburgh Gate eats hikers. I am the one it spat back out.',
  defeat: 'Back down the hill I go.',
  team: [mon(26, 16, ['rockthrow', 'magnitude']), mon(29, 16, ['karatechop', 'lowkick'])],
});

// ---- Oreburgh Gate --------------------------------------------------------
add('cave_grunt1', {
  name: 'Galactic Grunt', cls: 'Team Galactic', look: 'grunt', ai: 1, prize: 720,
  intro: 'This cave belongs to Team Galactic now. Turn around.',
  defeat: 'The commander is not going to like this.',
  team: [mon(24, 16, ['bite', 'supersonic', 'wingattack']), mon(26, 16, ['rockthrow', 'defensecurl'])],
});
add('cave_grunt2', {
  name: 'Galactic Grunt', cls: 'Team Galactic', look: 'gruntF', ai: 1, prize: 760,
  intro: 'You are standing where the light comes through. Move.',
  defeat: 'Stand wherever you like.',
  team: [mon(25, 17, ['bite', 'confusion']), mon(29, 17, ['karatechop', 'furyswipes'])],
});
add('cave_commander', {
  name: 'Commander Mars', cls: 'Team Galactic', look: 'boss', ai: 2, prize: 3000,
  intro: 'The Everlight sleeps under this hill, and Galactic intends to wake it.\nYou are one trainer. Reconsider.',
  defeat: 'One trainer. Noted. We will not make that mistake twice.',
  team: [
    mon(25, 18, ['bite', 'confusion', 'airslash']),
    mon(35, 18, ['confusion', 'psybeam', 'doubleteam']),
    mon(30, 19, ['karatechop', 'brickbreak', 'revenge']),
  ],
});

// ---- Rival ------------------------------------------------------------------
// The rival's starter is chosen at runtime to counter the player's, exactly
// like the DS games. `starterOffset` picks the type-advantaged line.
add('rival_1', {
  name: 'Rival', cls: 'Rival', look: 'rivalBoy', ai: 1, prize: 400, rival: true,
  intro: 'You picked yours, I picked mine. Let us find out who picked better.',
  defeat: 'Ha! Fine. You picked better. This time.',
  team: [mon(10, 5, ['tackle', 'growl']), 'RIVAL_STARTER:5'],
});
add('rival_2', {
  name: 'Rival', cls: 'Rival', look: 'rivalBoy', ai: 2, prize: 900, rival: true,
  intro: 'Oreburgh already? You have been busy. So have I.',
  defeat: 'You have been busier. Noted.',
  team: [mon(11, 12, ['quickattack', 'wingattack', 'growl']), mon(15, 12, ['spark', 'leer']), 'RIVAL_STARTER:13'],
});
add('rival_3', {
  name: 'Rival', cls: 'Rival', look: 'rivalBoy', ai: 2, prize: 1600, rival: true,
  intro: 'Last time was last time. Come on.',
  defeat: 'Every single time. How.',
  team: [mon(11, 18, ['wingattack', 'quickattack', 'doubleteam']), mon(16, 18, ['spark', 'bite', 'leer']),
    mon(22, 17, ['quickattack', 'defensecurl']), 'RIVAL_STARTER:19'],
});

export function getTrainer(id) { return TRAINERS[id]; }

// The three starter lines, in the order they are offered. Index 0 beats
// index 1 beats index 2 beats index 0.
export const STARTER_LINES = [
  { base: 1, name: 'Turtwig' },
  { base: 4, name: 'Chimchar' },
  { base: 7, name: 'Piplup' },
];

// Which line the rival takes: the one that is strong against the player's.
export function rivalStarterBase(playerBase) {
  const idx = STARTER_LINES.findIndex((s) => s.base === playerBase);
  if (idx < 0) return STARTER_LINES[0].base;
  return STARTER_LINES[(idx + 1) % 3].base;
}
