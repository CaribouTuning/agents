import { defineMap } from './define.js';

export const ROUTE1 = defineMap('route1', {
  name: 'Route 1', kind: 'route', music: 'route',
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
    'T...........::...........T',
    'T...........::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 27, to: 'brackenvale', tx: 14, ty: 2, dir: 'down', edge: true },
    { x: 13, y: 27, to: 'brackenvale', tx: 15, ty: 2, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'whisperwood', tx: 12, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'whisperwood', tx: 13, ty: 22, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 25, text: 'ROUTE 1\nBrackenvale Town — Whisperwood Forest' },
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
      dialogue: ['Tall grass hides wild monsters. Walk through it and one will find you soon enough.',
        'Weaken it in battle first, then throw a ball. Throwing at a healthy one is throwing money away.'],
    },
  ],
  encounters: {
    grass: { min: 2, max: 5, table: [[10, 30], [13, 30], [15, 20], [18, 15], [20, 5]] },
  },
});

export const ROUTE2 = defineMap('route2', {
  name: 'Route 2', kind: 'route', music: 'route',
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
    'T...*...*...::....""""...T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 17, to: 'aldermere', tx: 14, ty: 2, dir: 'down', edge: true },
    { x: 13, y: 17, to: 'aldermere', tx: 15, ty: 2, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'stonefall', tx: 11, ty: 14, dir: 'up' },
    { x: 13, y: 0, to: 'stonefall', tx: 12, ty: 14, dir: 'up' },
  ],
  signs: [
    { x: 10, y: 16, text: 'ROUTE 2\nAldermere City — Stonefall Cave\nMind the ledges.' },
  ],
  objects: [
    { id: 'r2_super', x: 2, y: 13, item: 'superpotion', qty: 1 },
    { id: 'r2_great', x: 22, y: 4, item: 'greatball', qty: 2 },
  ],
  npcs: [
    { id: 'r2_t1', x: 9, y: 6, look: 'youngster', trainer: 'r2_youngster', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r2_t2', x: 18, y: 12, look: 'hiker', trainer: 'r2_hiker', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'r2_grunt_watch', x: 16, y: 3, look: 'grunt', name: 'Meridian Grunt', movement: 'lookAround', facing: 'down',
      dialogue: ['Readings are up forty percent since last week. Something under that hill is waking up.',
        'And no, I am not going to explain what that means to a kid with a backpack.'],
    },
  ],
  encounters: {
    grass: { min: 10, max: 14, table: [[15, 25], [13, 20], [31, 15], [32, 10], [22, 15], [10, 15]] },
  },
});
