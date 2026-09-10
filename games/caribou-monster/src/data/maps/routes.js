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
    { x: 12, y: 0, to: 'route202', tx: 12, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route202', tx: 13, ty: 22, dir: 'up', edge: true },
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
    grass: { min: 2, max: 5, table: [[10, 30], [13, 28], [18, 18], [15, 12], [38, 7], [20, 5]] },
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
    grass: { min: 10, max: 14, table: [[15, 22], [13, 16], [31, 12], [32, 10], [22, 12], [10, 12], [51, 8], [44, 5], [48, 3]] },
  },
});
