import { defineMap } from './define.js';

export const ROUTE201 = defineMap('route201', {
  name: 'Route 201', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T...........::...........T',
    'T....""""...::...........T',
    'T....""""...::.....""""..T',
    'T...........::.....""""..T',
    'T..TTT......::...........T',
    'T.TTTTT.....::..TT.......T',
    'T..TTT......::.TTTT......T',
    'T...........::..TT.......T',
    'T...LLLLL...::...LLLLL...T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T:::::::::::::...........T',
    'T...........::...........T',
    'T....RR.....::...........T',
    'T...........::.....RR....T',
    'T..~~~~.....::...........T',
    'T.~~~~~~....::...........T',
    'T..~~~~.....::....""""...T',
    'T...........::....""""...T',
    'T....""""...::...........T',
    'T....""""...::..TTT......T',
    'T...........::.TTTTT.....T',
    'T...*...*...::..TTT......T',
    'T.........S.::...........T',
    'T...........::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 27, to: 'twinleaf', tx: 14, ty: 2, dir: 'down', edge: true },
    { x: 13, y: 27, to: 'twinleaf', tx: 15, ty: 2, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'sandgem', tx: 12, ty: 1, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'sandgem', tx: 13, ty: 1, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 25, text: 'ROUTE 201\nTwinleaf Town — Route 202' },
  ],
  objects: [
    { id: 'r1_potion', x: 1, y: 13, item: 'potion', qty: 1 },
    { id: 'r1_ball', x: 20, y: 5, item: 'pokeball', qty: 3 },
  ],
  npcs: [
    { id: 'r1_t1', x: 8, y: 16, look: 'youngster', trainer: 'r1_youngster', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r1_t2', x: 17, y: 12, look: 'lass', trainer: 'r1_lass', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'r1_walker', x: 15, y: 20, look: 'oldMan', name: 'Rambler', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { caught: 20 },
          lines: ['{caught} caught. You do not need an old man explaining balls to you any more.',
            'Go north. That is the only advice left that is worth anything.'],
        },
        {
          when: { badges: 1 },
          lines: ['Badge on you. The grass will not trouble you much now.',
            'It troubles everyone at the start though. That is what it is for.'],
        },
        {
          lines: ['Tall grass hides wild Pokémon. Walk through it and one will find you soon enough.',
            'Weaken it in battle first, then throw a ball. Throwing at a healthy one is throwing money away.'],
        },
      ],
    },
  ],
  encounters: {
    // Platinum's routes change roster with the clock, and it is the cheapest
    // way to make walking the same road at nine at night feel different.
    grass: {
      min: 2, max: 5,
      table: [[396, 30], [399, 28], [401, 18], [403, 12], [265, 7], [406, 5]],
      morning: { min: 2, max: 5, table: [[396, 34], [399, 26], [401, 16], [403, 14], [265, 10]] },
      night: { min: 2, max: 5, table: [[163, 30], [401, 24], [399, 18], [41, 16], [198, 12]] },
    },
  },
});

export const ROUTE207 = defineMap('route207', {
  name: 'Route 207', kind: 'route', music: 'route',
  tiles: [
    '^^^^^^^^^^^^DD^^^^^^^^^^^^',
    'T...........::...........T',
    'T..RRR......::......RRR..T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'T..~~~~~....::...........T',
    'T.~~~~~~~...::..TTT......T',
    'T..~~~~~....::.TTTTT.....T',
    'T...........::..TTT......T',
    'T...LLLLL...::...LLLLL...T',
    'T...........::...........T',
    'T....""""...::.....RR....T',
    'T....""""...::...........T',
    'T...........::....""""...T',
    'T...*...*.S.::....""""...T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 17, to: 'oreburgh', tx: 14, ty: 2, dir: 'down', edge: true },
    { x: 13, y: 17, to: 'oreburgh', tx: 15, ty: 2, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'oreburgh_gate', tx: 11, ty: 14, dir: 'up' },
    { x: 13, y: 0, to: 'oreburgh_gate', tx: 12, ty: 14, dir: 'up' },
  ],
  signs: [
    { x: 10, y: 16, text: 'ROUTE 207\nOreburgh City — Oreburgh Gate\nMind the ledges.' },
  ],
  objects: [
    { id: 'r2_super', x: 2, y: 13, item: 'superpotion', qty: 1 },
    { id: 'r2_great', x: 22, y: 4, item: 'greatball', qty: 2 },
  ],
  events: [
    // Cass, standing in the way, one tile short of the Gate.
    { x: 12, y: 1, flag: 'beatRival3', script: 'rival3' },
    { x: 13, y: 1, flag: 'beatRival3', script: 'rival3' },
    // Rowan waits out here afterwards. He could not go in. He tried.
    { x: 12, y: 2, flag: 'rowanDebriefed', script: 'rowanAfter', requires: 'everlightResolved' },
    { x: 13, y: 2, flag: 'rowanDebriefed', script: 'rowanAfter', requires: 'everlightResolved' },
  ],
  npcs: [
    { id: 'r2_t1', x: 9, y: 6, look: 'youngster', trainer: 'r2_youngster', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r2_t2', x: 18, y: 12, look: 'hiker', trainer: 'r2_hiker', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'r2_grunt_watch', x: 16, y: 3, look: 'grunt', name: 'Galactic Grunt', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { flag: 'beatCommander' },
          lines: ['You are the one who went in after Mars. I know exactly who you are.',
            'The readings did not stop when you came out. They went up.',
            'Go home. Genuinely. That is not a threat, it is advice.'],
        },
        {
          when: { flag: 'enteredCave' },
          lines: ['You have been down there. Do not bother denying it, the dust is on you.',
            'Readings are up forty percent since last week. Something under that hill is waking up.'],
        },
        {
          when: { joined: true },
          lines: ['Readings are up forty percent since last week. Something under that hill is waking up.',
            'And no, I am not explaining that to a circuit trainer with a rating and a backpack.'],
        },
        {
          lines: ['Readings are up forty percent since last week. Something under that hill is waking up.',
            'And no, I am not going to explain what that means to a kid with a backpack.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 10, max: 14,
      table: [[403, 22], [399, 16], [77, 12], [54, 10], [427, 12], [396, 12], [438, 8], [422, 5], [129, 3]],
      night: { min: 10, max: 14, table: [[41, 26], [163, 20], [200, 14], [434, 12], [427, 12], [399, 10], [438, 6]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Route 203 — Jubilife down to Oreburgh. Where the road stops being a footpath
// between two villages and starts having other trainers on it.
// ---------------------------------------------------------------------------

export const ROUTE203 = defineMap('route203', {
  name: 'Route 203', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::......RR....',
    'T....""""...::...........T',
    'T...........::...........T',
    'T..TTT......::....""""...T',
    'T.TTTTT.....::....""""...T',
    'T..TTT......::...........T',
    'T...........::...........T',
    'T:::::::::::::::.........T',
    'T...........::..:........T',
    'T...RR......::..:........T',
    'T...........::..:...TTT..T',
    'T....""""...::..:..TTTTT.T',
    'T....""""...::..:...TTT..T',
    'T...........::..:........T',
    'T..LLLLLL...::..:........T',
    'T...........::..:........T',
    'T...........::::::.......T',
    'T....""""...::...........T',
    'T....""""...::.....""""..T',
    'T...........::.....""""..T',
    'T....S......::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 0, to: 'jubilife', tx: 14, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'jubilife', tx: 15, ty: 22, dir: 'up', edge: true },
    { x: 12, y: 23, to: 'oreburgh', tx: 14, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 23, to: 'oreburgh', tx: 15, ty: 1, dir: 'down', edge: true },
  ],
  objects: [
    { id: 'r3_potion', x: 2, y: 11, item: 'potion', qty: 2 },
    { id: 'r3_ball', x: 20, y: 20, item: 'pokeball', qty: 5 },
  ],
  signs: [
    { x: 5, y: 22, text: 'ROUTE 203\nOREBURGH CITY — SOUTH\nJUBILIFE CITY — NORTH\nThe Gym in Oreburgh takes challengers.' },
  ],
  npcs: [
    { id: 'r3_t1', x: 8, y: 9, look: 'youngster', trainer: 'r3_youngster', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r3_t2', x: 18, y: 15, look: 'lass', trainer: 'r3_lass', facing: 'left', sight: 4, movement: 'still' },
    { id: 'r3_t3', x: 6, y: 19, look: 'bugCatcher', trainer: 'r3_bug', facing: 'down', sight: 3, movement: 'still' },
    {
      id: 'r3_walker', x: 20, y: 6, look: 'hiker', name: 'Rambler', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { badges: 1 },
          lines: ['Coal Badge. Good. Roark makes people work for it.',
            'Rest at the Center in Oreburgh before you go up Route 207.\fWhat is up there is not friendly.'],
        },
        {
          lines: ['Oreburgh is south. Mining town, and the Gym there is Rock-type.',
            'If you have got anything Grass or Water, bring it.',
            'If you have not, the grass on this route has both.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 5, max: 9,
      table: [[396, 24], [399, 20], [403, 18], [401, 14], [415, 10], [406, 8], [265, 6]],
      night: { min: 5, max: 9, table: [[163, 26], [402, 20], [41, 18], [399, 14], [198, 12], [434, 10]] },
    },
  },
});
