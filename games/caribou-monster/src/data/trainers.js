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

// ---- Mt. Coronet, Route 208 and the Hearthome Gym ---------------------------
// The middle of the campaign. Fantina is third in Platinum rather than fifth,
// so her Ghosts arrive while a lot of teams still have nothing that can touch
// them — which is the point, and why her Gym guide spells it out.

add('mc_hiker', {
  name: 'Hiker Tam', cls: 'Hiker', look: 'hiker', ai: 2, prize: 960,
  intro: 'Bottom of Coronet. People think this is the mountain. This is the doorstep.',
  defeat: 'Go on up, then. Mind what is up there.',
  team: [mon(74, 20, ['rockthrow', 'magnitude', 'defensecurl']), mon(95, 20, ['rockthrow', 'rocktomb', 'harden'])],
});
add('r8_lass', {
  name: 'Lass Juno', cls: 'Lass', look: 'lass', ai: 2, prize: 880,
  intro: 'Everyone crossing this road is on their way to lose to Fantina.',
  defeat: 'Maybe not everyone.',
  team: [mon(406, 21, ['absorb', 'growth', 'megadrain']), mon(315, 22, ['magicalleaf', 'growth', 'poisonsting'])],
});
add('r8_youngster', {
  name: 'Youngster Pike', cls: 'Youngster', look: 'youngster', ai: 2, prize: 880,
  intro: 'I have been to the Gym. I am not going back yet. I am training out here.',
  defeat: 'I am going to be out here a while longer.',
  team: [mon(63, 20, ['confusion', 'teleport']), mon(403, 21, ['spark', 'quickattack', 'charge']), mon(396, 21, ['wingattack', 'quickattack'])],
});

// ---- the Hearthome Gym --------------------------------------------------------
add('gym3_a', {
  name: 'Lass Neve', cls: 'Lass', look: 'lass', ai: 2, prize: 1040,
  intro: 'You cannot hit what is not really there. That is not a riddle. It is the type chart.',
  defeat: 'You had something that could reach them. Good.',
  team: [mon(92, 23, ['lick', 'spite', 'hypnosis']), mon(355, 23, ['astonish', 'nightshade', 'disable'])],
});
add('gym3_b', {
  name: 'Youngster Odo', cls: 'Youngster', look: 'youngster', ai: 2, prize: 1040,
  intro: 'The floor moves you. The Pokemon move you. Nothing in here stays put.',
  defeat: 'You worked out the floor faster than I did.',
  team: [mon(200, 24, ['astonish', 'confuseray', 'psybeam']), mon(92, 23, ['lick', 'hypnosis', 'dreameater'])],
});
add('gym3_c', {
  name: 'Bug Catcher Sel', cls: 'Bug Catcher', look: 'bugCatcher', ai: 2, prize: 1040,
  intro: 'Fantina is at the far end. If you can find the far end.',
  defeat: 'Straight on. Or whatever the floor decides straight on means.',
  team: [mon(355, 24, ['astonish', 'nightshade', 'willowisp']), mon(93, 24, ['lick', 'hypnosis', 'shadowball'])],
});
add('gym3_leader', {
  name: 'Fantina', cls: 'Gym Leader', look: 'lass', ai: 3, prize: 4200, leader: true,
  badge: 3, badgeName: 'Relic Badge', tm: 'tm05',
  intro: 'Everything in this room is a Ghost, and so, on a good day, am I.\nThe floor does not agree with you about where you are. Nor do I.',
  defeat: 'You found me twice. Nobody finds me twice. The Relic Badge is yours.',
  team: [
    mon(355, 24, ['astonish', 'willowisp', 'nightshade', 'disable']),
    mon(93, 24, ['lick', 'hypnosis', 'shadowball', 'confuseray']),
    mon(429, 26, ['shadowball', 'confuseray', 'psybeam', 'magicalleaf']),
  ],
});

// ---- the graveyard road, Solaceon and Veilstone -------------------------------
// The middle third of the campaign. Levels run high twenties into low thirties,
// and Team Galactic stops being a rumour somewhere around here.

add('r9_lass', {
  name: 'Lass Perr', cls: 'Lass', look: 'lass', ai: 2, prize: 1120,
  intro: 'Everyone goes quiet near the Tower. I do not. I battle.',
  defeat: 'Fine. I will go and be quiet for a bit.',
  team: [mon(431, 26, ['scratch', 'growl', 'fakeout']), mon(63, 26, ['confusion', 'teleport'])],
});
add('r9_youngster', {
  name: 'Youngster Tobe', cls: 'Youngster', look: 'youngster', ai: 2, prize: 1120,
  intro: 'North is Solaceon. Nothing happens in Solaceon. That is the appeal.',
  defeat: 'Go on then. Go and have nothing happen to you.',
  team: [mon(396, 26, ['wingattack', 'quickattack', 'doubleteam']), mon(415, 26, ['gust', 'bugbite'])],
});
add('lt_lass', {
  name: 'Lass Nia', cls: 'Lass', look: 'lass', ai: 2, prize: 1200,
  intro: 'I come here to train because nobody else will.',
  defeat: 'It is quiet. That is all. It is only quiet.',
  team: [mon(92, 27, ['lick', 'hypnosis', 'nightshade']), mon(355, 27, ['astonish', 'willowisp'])],
});
add('lt_youngster', {
  name: 'Youngster Cale', cls: 'Youngster', look: 'youngster', ai: 2, prize: 1200,
  intro: 'Second floor. Most people turn back on the second floor.',
  defeat: 'You are going up, then. Say hello to the sisters.',
  team: [mon(200, 27, ['astonish', 'confuseray', 'psybeam']), mon(92, 27, ['lick', 'spite'])],
});
add('lt_bug', {
  name: 'Bug Catcher Nim', cls: 'Bug Catcher', look: 'bugCatcher', ai: 2, prize: 1200,
  intro: 'There are things in here that are not on anybody\u2019s list.',
  defeat: 'I have seen a Spiritomb on the third floor. Nobody believes me.',
  team: [mon(355, 27, ['astonish', 'nightshade']), mon(442, 28, ['shadowsneak', 'confuseray', 'suckerpunch'])],
});
add('r10_hiker', {
  name: 'Hiker Odd', cls: 'Hiker', look: 'hiker', ai: 2, prize: 1440,
  intro: 'You cannot see me properly and I cannot see you. Fair fight.',
  defeat: 'Well. You could see enough.',
  team: [mon(66, 29, ['karatechop', 'lowkick', 'foresight']), mon(74, 29, ['rockthrow', 'magnitude', 'defensecurl'])],
});
add('r10_lass', {
  name: 'Lass Wren', cls: 'Lass', look: 'lass', ai: 2, prize: 1400,
  intro: 'I have been standing in this fog for two hours waiting for somebody.',
  defeat: 'Worth the wait. I am going home.',
  team: [mon(307, 29, ['confusion', 'meditate', 'lowkick']), mon(431, 29, ['fakeout', 'furyswipes', 'growl'])],
});
add('r15_youngster', {
  name: 'Youngster Bray', cls: 'Youngster', look: 'youngster', ai: 2, prize: 1520,
  intro: 'Rains every day here. You get used to it or you leave.',
  defeat: 'I have not left yet.',
  team: [mon(418, 30, ['watergun', 'quickattack', 'pursuit']), mon(403, 30, ['spark', 'charge', 'quickattack'])],
});
add('r15_hiker', {
  name: 'Hiker Stond', cls: 'Hiker', look: 'hiker', ai: 3, prize: 1600,
  intro: 'Veilstone is down that way. Mind the grey coats when you get there.',
  defeat: 'You will see what I mean.',
  team: [
    mon(66, 30, ['karatechop', 'lowkick', 'seismictoss']),
    mon(95, 30, ['rockthrow', 'rocktomb', 'screech']),
    mon(453, 30, ['poisonsting', 'mudslap', 'revenge']),
  ],
});

// ---- the Galactic buildings -----------------------------------------------------
add('gw_grunt', {
  name: 'Galactic Grunt', cls: 'Galactic', look: 'grunt', ai: 2, prize: 1280,
  intro: 'This is a storage facility. You are trespassing in a storage facility.',
  defeat: 'It is a storage facility. That part was true.',
  team: [mon(431, 29, ['fakeout', 'furyswipes', 'hypnosis']), mon(453, 29, ['revenge', 'mudslap', 'poisonsting'])],
});
add('hq_grunt1', {
  name: 'Galactic Grunt', cls: 'Galactic', look: 'grunt', ai: 3, prize: 1440,
  intro: 'Nobody walks into this building. Nobody has ever walked into this building.',
  defeat: 'Somebody has now.',
  team: [mon(431, 31, ['fakeout', 'furyswipes', 'hypnosis']), mon(198, 31, ['pursuit', 'feintattack', 'torment'])],
});
add('hq_grunt2', {
  name: 'Galactic Grunt', cls: 'Galactic', look: 'gruntF', ai: 3, prize: 1440,
  intro: 'Commander Saturn is upstairs and he does not like being interrupted.',
  defeat: 'Go up, then. See how that goes for you.',
  team: [mon(453, 31, ['revenge', 'mudslap', 'swagger']), mon(41, 31, ['wingattack', 'bite', 'astonish'])],
});
add('galactic_saturn', {
  name: 'Saturn', cls: 'Galactic Commander', look: 'boss', ai: 3, prize: 4000,
  intro: 'You have walked into a building you were not invited into, and now you\nwould like me to explain myself. Nobody explains themselves to trespassers.',
  defeat: 'That was not the outcome I had allowed for. I will allow for it next time.',
  team: [
    mon(431, 32, ['fakeout', 'furyswipes', 'hypnosis', 'assist']),
    mon(453, 32, ['revenge', 'mudslap', 'swagger', 'poisonsting']),
    mon(198, 34, ['feintattack', 'pursuit', 'torment', 'wingattack']),
  ],
});

// ---- the Veilstone Gym -------------------------------------------------------------
add('gym4_a', {
  name: 'Youngster Rell', cls: 'Youngster', look: 'youngster', ai: 3, prize: 1400,
  intro: 'Shoes off. Maylene\u2019s rule, not mine, and I would not argue with her.',
  defeat: 'Straight on. She is at the end.',
  team: [mon(66, 30, ['karatechop', 'lowkick', 'foresight']), mon(307, 30, ['confusion', 'meditate'])],
});
add('gym4_b', {
  name: 'Hiker Bors', cls: 'Hiker', look: 'hiker', ai: 3, prize: 1400,
  intro: 'She trains everybody in this room herself. Every morning. Before school.',
  defeat: 'Before school. Think about that on your way up.',
  team: [mon(67, 31, ['karatechop', 'seismictoss', 'lowkick']), mon(453, 30, ['revenge', 'mudslap'])],
});
add('gym4_c', {
  name: 'Bug Catcher Ives', cls: 'Bug Catcher', look: 'bugCatcher', ai: 3, prize: 1400,
  intro: 'Flying moves. Psychic moves. That is what you want and I am telling you\nbecause you will still lose.',
  defeat: 'You had one. Of course you had one.',
  team: [mon(307, 31, ['confusion', 'meditate', 'lowkick']), mon(66, 31, ['karatechop', 'foresight', 'seismictoss'])],
});
add('gym4_leader', {
  name: 'Maylene', cls: 'Gym Leader', look: 'lass', ai: 3, prize: 5200, leader: true,
  badge: 4, badgeName: 'Cobble Badge', tm: 'tm03',
  intro: 'I am Maylene. I know what you are thinking, and everybody thinks it.\nNo shoes on my floor and no tricks in my Gym. Just what we both brought.',
  defeat: 'You were better than me today. I am going to train until you are not.',
  team: [
    mon(307, 30, ['confusion', 'meditate', 'lowkick', 'detect']),
    mon(67, 31, ['karatechop', 'seismictoss', 'foresight', 'lowkick']),
    mon(448, 32, ['forcepalm', 'quickattack', 'metalclaw', 'screech']),
  ],
});

// ---- the wet south ------------------------------------------------------------
// Levels in the low thirties: this is the stretch where a team that has been
// coasting on a starter stops coasting.

add('r12_lass', {
  name: 'Lass Fen', cls: 'Lass', look: 'lass', ai: 3, prize: 1680,
  intro: 'The ground round here is not ground. Mind your footing.',
  defeat: 'You are all right on the mud, then.',
  team: [mon(194, 32, ['watergun', 'mudshot', 'slam']), mon(418, 32, ['aquajet', 'quickattack', 'pursuit'])],
});
add('r12_sailor', {
  name: 'Sailor Bosch', cls: 'Sailor', look: 'sailor', ai: 3, prize: 1760,
  intro: 'I have worked this water twenty years. I know what is under it.',
  defeat: 'Most of it. I know most of what is under it.',
  team: [mon(418, 32, ['aquajet', 'watergun', 'pursuit']), mon(55, 33, ['watergun', 'confusion', 'furyswipes'])],
});
add('r13_sailor', {
  name: 'Sailor Orl', cls: 'Sailor', look: 'sailor', ai: 3, prize: 1840,
  intro: 'Nothing down this beach but sand and me.',
  defeat: 'Now there is sand and me and a bad mood.',
  team: [mon(278, 33, ['wingattack', 'watergun', 'supersonic']), mon(418, 33, ['aquajet', 'pursuit', 'swift'])],
});
add('r14_hiker', {
  name: 'Hiker Vosk', cls: 'Hiker', look: 'hiker', ai: 3, prize: 1920,
  intro: 'They turned me back at the lakefront. I am in a mood about it.',
  defeat: 'Now I am in a worse one. Go on, see for yourself.',
  team: [mon(449, 34, ['bite', 'sandtomb', 'dig']), mon(67, 34, ['karatechop', 'seismictoss', 'lowkick'])],
});
add('r14_lass', {
  name: 'Lass Iri', cls: 'Lass', look: 'lass', ai: 3, prize: 1880,
  intro: 'There is machinery running up at the lake. You can hear it from here.',
  defeat: 'Listen for it. You will not un-hear it.',
  team: [mon(431, 34, ['fakeout', 'furyswipes', 'hypnosis']), mon(451, 34, ['poisonsting', 'bite', 'pinmissile'])],
});

// ---- the Pastoria Gym -----------------------------------------------------------
add('gym5_a', {
  name: 'Sailor Dree', cls: 'Sailor', look: 'sailor', ai: 3, prize: 1800,
  intro: 'Wake trained me. I am half as loud and about a third as good.',
  defeat: 'Both of those numbers were generous.',
  team: [mon(418, 33, ['aquajet', 'watergun', 'swift']), mon(194, 33, ['mudshot', 'watergun', 'slam'])],
});
add('gym5_b', {
  name: 'Youngster Kell', cls: 'Youngster', look: 'youngster', ai: 3, prize: 1800,
  intro: 'The floor floods in about a minute. I would not stand there.',
  defeat: 'Told you about the floor.',
  team: [mon(55, 34, ['watergun', 'confusion', 'furyswipes']), mon(278, 33, ['wingattack', 'watergun'])],
});
add('gym5_c', {
  name: 'Lass Bree', cls: 'Lass', look: 'lass', ai: 3, prize: 1800,
  intro: 'Grass or Electric. That is what you want and I am telling you anyway.',
  defeat: 'You had Electric. Everybody has Electric.',
  team: [mon(194, 34, ['mudshot', 'watergun', 'slam']), mon(453, 34, ['revenge', 'mudslap', 'poisonsting'])],
});
add('gym5_leader', {
  name: 'Crasher Wake', cls: 'Gym Leader', look: 'sailor', ai: 3, prize: 6000, leader: true,
  badge: 5, badgeName: 'Fen Badge', tm: 'tm06',
  intro: 'I AM CRASHER WAKE! Water does not crash into you — water gets underneath\nyou and waits! COME AND TAKE THE FEN BADGE!',
  defeat: 'HA! You got underneath ME! That is the Fen Badge and you have earned it!',
  team: [
    mon(195, 34, ['mudshot', 'watergun', 'yawn', 'slam']),
    mon(419, 35, ['aquajet', 'crunch', 'swift', 'pursuit']),
    mon(55, 37, ['surf', 'confusion', 'furyswipes', 'screech']),
  ],
});
