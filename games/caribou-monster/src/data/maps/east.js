// North and east out of Hearthome: the graveyard road, the town that sits on
// top of a ruin, and the city Team Galactic built a headquarters in.
//
// This is where Platinum's story stops being about badges. Up to Hearthome the
// coats are a rumour; from Solaceon on they are ahead of you on every road.
import { defineMap } from './define.js';

// ---------------------------------------------------------------------------
// Route 209 — the road past the Lost Tower.
// ---------------------------------------------------------------------------
export const ROUTE209 = defineMap('route209', {
  name: 'Route 209', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::.....RR....T',
    'T....""""...::...........T',
    'T...........::..EEEEEE...T',
    'T..~~~~.....::..EEEEEE...T',
    'T.~~~~~~....::..VVVVVV...T',
    'T..~~~~.....::..#WWDWW...T',
    'T...........::.....:.....T',
    'T:::::::::::::::::::.....T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'T..LLLLLL...::...LLLLLL..T',
    'T...........::...........T',
    'T....OOO....::.....RR....T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'T.........S.::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 22, to: 'hearthome', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 22, to: 'hearthome', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'solaceon', tx: 12, ty: 16, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'solaceon', tx: 13, ty: 16, dir: 'up', edge: true },
    { x: 19, y: 7, to: 'lost_tower', tx: 9, ty: 11, dir: 'up' },
  ],
  labels: [
    { x: 16, y: 6, w: 6, text: 'LOST TOWER' },
  ],
  signs: [
    { x: 10, y: 21, text: 'ROUTE 209\nHEARTHOME CITY — SOUTH\nSOLACEON TOWN — NORTH\nThe Tower is not a landmark. People leave\nthings there.' },
  ],
  objects: [
    { id: 'r9_revive', x: 2, y: 18, item: 'revive', qty: 2 },
    { id: 'r9_scale', x: 21, y: 16, item: 'heartscale', qty: 3 },
  ],
  npcs: [
    { id: 'r9_t1', x: 8, y: 11, look: 'lass', trainer: 'r9_lass', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r9_t2', x: 19, y: 19, look: 'youngster', trainer: 'r9_youngster', facing: 'up', sight: 4, movement: 'still' },
    {
      id: 'r9_mourner', x: 17, y: 9, look: 'oldMan', name: 'Wen', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['The two of you go up there together, if you go at all.',
            'It is not a frightening place. It is a sad one. Those are different.',
            'Sad places are much easier with somebody.'],
        },
        {
          lines: ['People bring their Pokémon here at the end. Have done for centuries.',
            'It is five floors of other people’s goodbyes.',
            'Go up if you like. Just be quiet about it.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 16, max: 20,
      table: [[431, 22], [63, 18], [415, 16], [406, 14], [396, 12], [455, 10], [442, 8]],
      night: { min: 16, max: 20, table: [[92, 26], [200, 22], [431, 18], [41, 14], [355, 12], [442, 8]] },
    },
    fish: { min: 10, max: 18, table: [[129, 50], [118, 22], [339, 16], [418, 12]] },
  },
});

// ---------------------------------------------------------------------------
// The Lost Tower. Five floors in Platinum; three here, because a tower is
// about the climb and the top, and two extra identical floors are neither.
// ---------------------------------------------------------------------------
const towerFloor = (id, up, down, npcs, objects) => defineMap(id, {
  name: 'Lost Tower', kind: 'indoor', music: 'cave', darkEdges: false,
  tiles: [
    '||||||||||||||||||',
    '|+<++++++++++++++|',
    '|+!!++!!++!!++!!+|',
    '|++++++++++++++++|',
    '|+!!++!!++!!++!!+|',
    '|++++++++++++++++|',
    '|+!!++!!++!!++!!+|',
    '|++++++++++++++++|',
    '|+!!++!!++!!++!!+|',
    '|++++++++++++++++|',
    '|+!!++!!++!!++!!+|',
    '|++++++++++++++++|',
    '|++++++++>+++++++|',
    '||||||||||||||||||',
  ],
  warps: [
    ...(up ? [{ x: 2, y: 1, to: up.to, tx: up.tx, ty: up.ty, dir: 'up' }] : []),
    ...(down ? [{ x: 9, y: 12, to: down.to, tx: down.tx, ty: down.ty, dir: 'down' }] : []),
  ],
  npcs, objects,
  encounters: {
    cave: { min: 17, max: 21, table: [[92, 34], [355, 26], [200, 22], [442, 10], [93, 8]] },
  },
});

export const LOST_TOWER = towerFloor('lost_tower',
  { to: 'lost_tower_2', tx: 9, ty: 11 }, { to: 'route209', tx: 19, ty: 8 },
  [
    { id: 'lt1_t1', x: 12, y: 5, look: 'lass', trainer: 'lt_lass', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'lt1_keeper', x: 4, y: 11, look: 'mom', name: 'Keeper', movement: 'still', facing: 'right',
      dialogue: [
        { lines: ['Quietly, please. People come here to sit.',
          'There are stairs at the back of each floor. The top is worth the climb.'] },
      ],
    },
  ],
  [{ id: 'lt1_ether', x: 14, y: 11, item: 'ether', qty: 2 }]);

export const LOST_TOWER_2 = towerFloor('lost_tower_2',
  { to: 'lost_tower_3', tx: 9, ty: 11 }, { to: 'lost_tower', tx: 2, ty: 3 },
  [
    { id: 'lt2_t1', x: 6, y: 7, look: 'youngster', trainer: 'lt_youngster', facing: 'down', sight: 4, movement: 'still' },
    { id: 'lt2_t2', x: 13, y: 9, look: 'bugCatcher', trainer: 'lt_bug', facing: 'left', sight: 3, movement: 'still' },
  ],
  [{ id: 'lt2_scale', x: 3, y: 5, item: 'heartscale', qty: 2 }]);

export const LOST_TOWER_3 = defineMap('lost_tower_3', {
  name: 'Lost Tower', kind: 'indoor', music: 'cave', darkEdges: false,
  tiles: [
    '||||||||||||||||||',
    '|++++++++++++++++|',
    '|++++!!!!!!++++++|',
    '|++++++++++++++++|',
    '|++!!++++++++!!++|',
    '|++++++++++++++++|',
    '|++++++++++++++++|',
    '|++!!++++++++!!++|',
    '|++++++++++++++++|',
    '|++++!!!!!!++++++|',
    '|++++++++++++++++|',
    '|++++++++++++++++|',
    '|++++++++>+++++++|',
    '||||||||||||||||||',
  ],
  warps: [
    { x: 9, y: 12, to: 'lost_tower_2', tx: 2, ty: 3, dir: 'down' },
  ],
  objects: [
    { id: 'lt3_stone', x: 2, y: 11, item: 'leafstone', qty: 1 },
  ],
  npcs: [
    {
      // The two sisters at the top of the tower. In Platinum they hand over
      // the Cleanse Tag; here they hand over the thing you actually want,
      // which is somebody telling you the road ahead has people on it.
      id: 'lt3_sister', x: 8, y: 5, look: 'mom', name: 'Rue', movement: 'still', facing: 'down',
      script: 'lostTowerTop',
      dialogue: [{ lines: ['You climbed all the way. Most people stop at the second floor.'] }],
    },
    {
      id: 'lt3_other', x: 10, y: 5, look: 'lass', name: 'Wren', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'knowsTwist' },
          lines: ['My sister says you have the look of somebody carrying something heavy.',
            'She is right about people. It is annoying.',
            'Whatever it is you know — do not carry it on your own. That is all.'],
        },
        {
          lines: ['We come up here most weeks. Our grandmother is on the fourth floor.',
            'Not literally. There is a stone. You know what I mean.'],
        },
      ],
    },
  ],
  encounters: {
    cave: { min: 18, max: 22, table: [[92, 32], [355, 26], [200, 22], [93, 12], [442, 8]] },
  },
});

// ---------------------------------------------------------------------------
// Solaceon Town — a farming village sitting on top of something much older.
// ---------------------------------------------------------------------------
export const SOLACEON = defineMap('solaceon', {
  name: 'Solaceon Town', kind: 'town', music: 'town',
  tiles: [
    'TTTTTTTTTTTT;;TTTTTTTTTTTT',
    'T...........;;...........T',
    'T..AAAAAAAA.;;.....GGGGG.T',
    'T..AAAAAAAA.;;.....GGGGG.T',
    'T..VVVVVVVV.;;.....#WDW#.T',
    'T..#WFFDFFW.;;.......;...T',
    'T...T.;.....;;.......;...T',
    'T.....;;;;;;;;;;;;;;;....T',
    'T.T...;.....;;..........TT',
    'T..S..;..OOO;;....**.....T',
    'T.....;/.../;;....**.....T',
    'T.....;/OOO/;;.........)TT',
    'T.....;.....;;..BBBBBB...T',
    'T.....;.....;;..BBBBBB...T',
    'T...).;.....;;..VVVVVV...T',
    'T.....;;;;;;;;..#WWDWW...T',
    'T.T........T;;..........ST',
    'TTTTTTTTTTTT;;TTTTTTTTTTTT',
  ],

  warps: [
    { x: 12, y: 17, to: 'route209', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 17, to: 'route209', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'route210', tx: 12, ty: 20, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route210', tx: 13, ty: 20, dir: 'up', edge: true },
    { x: 7, y: 5, to: 'solaceon_center', tx: 6, ty: 6, dir: 'up' },
    { x: 21, y: 4, to: 'solaceon_house', tx: 5, ty: 5, dir: 'up' },
    { x: 19, y: 15, to: 'solaceon_ruins', tx: 9, ty: 11, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 8, text: 'POKéMON CENTER' },
    { x: 16, y: 14, w: 6, text: 'THE RUINS' },
  ],
  signs: [
    { x: 3, y: 9, text: 'SOLACEON TOWN\n"Older underneath than on top."\nThe ruins were here first. The town is\nthe recent part.' },
    { x: 24, y: 16, text: 'ROUTE 210 — NORTH\nThe fog up there does not lift. Bring\nsomething that can clear it.' },
  ],
  objects: [],
  healPoint: { map: 'solaceon_center', x: 6, y: 7 },
  npcs: [
    {
      id: 'so_digger', x: 22, y: 12, look: 'scientist', name: 'Ora', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { flag: 'knowsTwist' },
          lines: ['You have been in Oreburgh Gate. It is on you like dust.',
            'The writing in our ruins says what that seam says.',
            'Something made the world and something can unmake it.',
            'We wrote that down.\fThen we forgot to be frightened of it.'],
        },
        {
          lines: ['The ruins under this town are older than writing and full of writing.',
            'Every character down there is a Pokémon.\fThey arrange themselves into words.',
            'I have been reading them for eleven years. I am about a third done.'],
        },
      ],
    },
    {
      id: 'so_farmer', x: 8, y: 10, look: 'worker', name: 'Bell', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { flag: 'gotBerries' },
          lines: ['Berries, is it? Put one in our soil and it comes up twice the size.',
            'Something in the ground here. We do not ask what.'],
        },
        {
          lines: ['North is Route 210 and the fog sits on it all year.',
            'You cannot see a trainer until you are standing on them.',
            'There is a move that shifts it. Fantina hands out the badge for it.'],
        },
      ],
    },
    {
      id: 'so_watcher', x: 19, y: 9, look: 'oldMan', name: 'Hollis', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge3' },
          lines: ['Relic Badge. Then the fog on 210 will part for you.',
            'Grey coats went through here a week back, heading for Veilstone.',
            'They walked in a line and nobody said a word to them.'],
        },
        {
          lines: ['Quiet town, this. Everything happens underneath it.',
            'Get the Hearthome badge before you go north, or you will be feeling your way.'],
        },
      ],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Solaceon Ruins — the Unown, and the writing on the walls.
// ---------------------------------------------------------------------------
export const SOLACEON_RUINS = defineMap('solaceon_ruins', {
  subArea: true,
  name: 'Solaceon Ruins', kind: 'cave', music: 'cave',
  tiles: [
    'CCCCCCCCCCCCCCCCCCCC',
    'CccccccccccccccccccC',
    'CcCCCCCCCCCCCCCCCCcC',
    'CcCcccccccccccccCCcC',
    'CcCcCCCCCCCCCCccCCcC',
    'CcCcCccccccccCccCCcC',
    'CcCcCcCCCCCrCCccCCcC',
    'CcCcCcCccccccCccCCcC',
    'CcCcCcCCCCCCCCccCCcC',
    'CcCcCcccccccccccCCcC',
    'CcCcCCCCCCCCCCCCCCcC',
    'CcCcccccccccccccccc:',
    'CCCCCCCCCccCCCCCCCCC',
  ],
  warps: [
    { x: 9, y: 12, to: 'solaceon', tx: 19, ty: 16, dir: 'down' },
    { x: 10, y: 12, to: 'solaceon', tx: 19, ty: 16, dir: 'down' },
  ],
  signs: [
    { x: 11, y: 12, text: 'The wall is covered in characters. They are\nnot letters. They are looking back.' },
  ],
  objects: [
    { id: 'sr_odd', x: 11, y: 7, item: 'oddkeystone', qty: 1 },
    { id: 'sr_star', x: 17, y: 1, item: 'starpiece', qty: 1 },
  ],
  npcs: [],
  encounters: {
    // Nothing but Unown, which is what makes the ruins the ruins.
    cave: { min: 16, max: 20, table: [[201, 100]] },
  },
});

// ---------------------------------------------------------------------------
// Route 210 — the fog road. Defog is Fantina's badge, which is the reason
// Platinum moves her to third: without her the north is a wall.
// ---------------------------------------------------------------------------
export const ROUTE210 = defineMap('route210', {
  name: 'Route 210', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T..YYYY.....::.....YYYY..T',
    'T..YYYY.....::.....YYYY..T',
    'T...........::...........T',
    '::::::::::::::...........T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'T..RR.......::.......RR..T',
    'T...........::...........T',
    'T..YYYY.....::.....YYYY..T',
    'T..YYYY.....::.....YYYY..T',
    'T...........::...........T',
    'T....OOO....::....""""...T',
    'T...........::....""""...T',
    'T.........S.::...........T',
    'T...........::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 21, to: 'solaceon', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 21, to: 'solaceon', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 0, y: 7, to: 'route215', tx: 30, ty: 8, dir: 'left', edge: true },
    { x: 12, y: 0, to: 'route210_north', tx: 12, ty: 18, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route210_north', tx: 13, ty: 18, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 19, text: 'ROUTE 210\nSOLACEON TOWN — SOUTH\nROUTE 215 — WEST, toward Veilstone.\nThe fog is permanent. Mind the trainers.' },
  ],
  objects: [
    { id: 'r10_max', x: 21, y: 2, item: 'maxpotion', qty: 1 },
  ],
  npcs: [
    { id: 'r10_t1', x: 8, y: 9, look: 'hiker', trainer: 'r10_hiker', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r10_t2', x: 18, y: 15, look: 'lass', trainer: 'r10_lass', facing: 'down', sight: 4, movement: 'still' },
    {
      id: 'r10_lost', x: 9, y: 17, look: 'youngster', name: 'Ide', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge3' },
          lines: ['You have got the Relic Badge. Then you can see further than I can.',
            'West is Route 215 and then Veilstone. Big place. Getting bigger.',
            'There is a company put a building up there. Nobody knows what they make.'],
        },
        {
          lines: ['I have been walking in circles for an hour.',
            'You cannot see a thing out here and there are trainers in it.',
            'Somebody said there is a move that clears fog. I do not have it.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 18, max: 22,
      table: [[431, 20], [307, 18], [66, 16], [415, 14], [63, 12], [453, 12], [406, 8]],
      night: { min: 18, max: 22, table: [[92, 24], [200, 20], [431, 18], [355, 16], [41, 12], [453, 10]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Route 215 — the wet road down into Veilstone. It rains here permanently.
// ---------------------------------------------------------------------------
export const ROUTE215 = defineMap('route215', {
  name: 'Route 215', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T..............................T',
    'T....""""..........RR..........T',
    'T....""""......................T',
    'T..........TTT........"""".....T',
    'T.........TTTTT......."""".....T',
    'T..........TTT.................T',
    'T..............................T',
    '::::::::::::::::::::::::::::::::',
    'T..............................T',
    'T....RR.......LLLLLL...........T',
    'T.........................""""..',
    'T....""""..................""""T',
    'T....""""...TTT................T',
    'T..........TTTTT......OOO....S.T',
    'T...........TTT................T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 31, y: 8, to: 'route210', tx: 1, ty: 7, dir: 'right', edge: true },
    { x: 0, y: 8, to: 'veilstone', tx: 32, ty: 10, dir: 'left', edge: true },
  ],
  signs: [
    { x: 29, y: 14, text: 'ROUTE 215\nROUTE 210 — EAST\nVEILSTONE CITY — WEST\nIt has rained on this road every day for\nas long as anyone has kept records.' },
  ],
  objects: [
    { id: 'r15_hyper', x: 2, y: 12, item: 'hyperpotion', qty: 2 },
    { id: 'r15_ball', x: 28, y: 2, item: 'ultraball', qty: 2 },
  ],
  npcs: [
    { id: 'r15_t1', x: 9, y: 3, look: 'youngster', trainer: 'r15_youngster', facing: 'down', sight: 4, movement: 'still' },
    { id: 'r15_t2', x: 22, y: 12, look: 'hiker', trainer: 'r15_hiker', facing: 'up', sight: 4, movement: 'still' },
    {
      id: 'r15_watcher', x: 18, y: 9, look: 'scientist', name: 'Pell', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'knowsTwist' },
          lines: ['They came down this road in a lorry. Grey coats, no markings, nobody talking.',
            'Whatever is in that Veilstone building, they did not build it to make anything.',
            'You do not need a warehouse that size to make things. You need one to keep them.'],
        },
        {
          lines: ['Rains here every day. Has done since before the road was a road.',
            'Veilstone is west. Mind yourself — it has grown fast and not evenly.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 19, max: 23,
      table: [[453, 22], [66, 18], [307, 16], [431, 14], [418, 12], [63, 10], [415, 8]],
      night: { min: 19, max: 23, table: [[92, 22], [453, 20], [431, 18], [200, 16], [41, 14], [355, 10]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Veilstone City — the biggest thing in Sinnoh that nobody planned. A quarry
// town that grew into a city, with a department store, a Fighting Gym, and a
// grey building on the hill that everyone has decided not to ask about.
// ---------------------------------------------------------------------------
export const VEILSTONE = defineMap('veilstone', {
  name: 'Veilstone City', kind: 'town', music: 'city',
  tiles: [
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^................................^',
    '^....EEEEEEEE..........EEEEEE..T.^',
    '^....EEEEEEEE..........EEEEEE....^',
    '^....EEEEEEEE..........VVVVVV....^',
    '^....VVVVVVVV..........#WWDWW....^',
    '^....#WWDDWW#..............q.....^',
    '^.......qq.................q.....^',
    '^.T.....qq.................q.....^',
    '^..S....qqqqqqqqqqqqqqqqqqqqqqqqq.',
    '^.......ql.................q.....^',
    '^.......ql..88.............q.....^',
    '^..AAAAAAAA.8..............q...T.^',
    '^..AAAAAAAA................q.....^',
    '^..VVVVVVVV......KKKKKKKKKKq.....^',
    '^..#WFFDFFW......KKKKKKKKKKq.....^',
    '^.....q..........KKKKKKKKKKq.....^',
    '^.....q..........VVVVVVVVVVq.....^',
    '^.....q..........NQNNddNNQNq.....^',
    '^.....q..........I.S....S.Iq.....^',
    '^.....qqqqqqqqqqqqqqqqqqqqqq.....^',
    '^.T.........................T....^',
    '^..BBBBBB.T.........o........S...^',
    '^..BBBBBB....................o...^',
    '^..VVVVVV........................^',
    '^..#WWDWW......T.................^',
    '^........o....o.........T........^',
    '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
  ],

  warps: [
    { x: 33, y: 9, to: 'route215', tx: 1, ty: 8, dir: 'right', edge: true },
    { x: 8, y: 6, to: 'veilstone_store', tx: 7, ty: 7, dir: 'up' },
    { x: 9, y: 6, to: 'veilstone_store', tx: 8, ty: 7, dir: 'up' },
    { x: 26, y: 5, to: 'galactic_hq', tx: 7, ty: 11, dir: 'up' },
    { x: 7, y: 15, to: 'veilstone_center', tx: 6, ty: 6, dir: 'up' },
    { x: 21, y: 18, to: 'veilstone_gym', tx: 7, ty: 14, dir: 'up' },
    { x: 22, y: 18, to: 'veilstone_gym', tx: 8, ty: 14, dir: 'up' },
    { x: 6, y: 25, to: 'galactic_warehouse', tx: 4, ty: 8, dir: 'up' },
  ],
  labels: [
    { x: 5, y: 4, w: 8, text: 'DEPT. STORE' },
    { x: 23, y: 4, w: 6, text: 'GALACTIC', tone: '#c0a0e0' },
    { x: 3, y: 14, w: 8, text: 'POKéMON CENTER' },
    { x: 17, y: 17, w: 10, text: 'VEILSTONE GYM', tone: '#f8e070' },
  ],
  signs: [
    { x: 3, y: 9, text: 'VEILSTONE CITY\n"Built out of the hole it came from."\nDEPARTMENT STORE — north-west.\nGYM — south-east.' },
    { x: 19, y: 19, text: 'VEILSTONE CITY POKéMON GYM\nLEADER: Maylene\nThe Barefoot Champion\nFighting-type. She is fifteen. Do not\nlet that comfort you.' },
    { x: 24, y: 19, text: 'The Gym floor is bare boards. No shoes.\nNo excuses either.' },
    { x: 29, y: 22, text: 'That grey building is not on any plan\nfiled with the city. Nobody has asked why.' },
  ],
  objects: [],
  healPoint: { map: 'veilstone_center', x: 6, y: 7 },
  npcs: [
    {
      id: 'vs_guide', x: 24, y: 20, look: 'youngster', name: 'Gym Guide', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge4' },
          lines: ['The Cobble Badge! Off Maylene! She does not go easy on anybody.',
            'South out of the city is Route 214 and then Pastoria.',
            'And keep an eye on that grey building. It has been busy this week.'],
        },
        {
          lines: ['This is the VEILSTONE GYM. Maylene is Fighting-type, straight through.',
            'Flying and Psychic moves are what get past a Fighting type.',
            'She is fifteen years old and she has never lost at home. Both of those are true.'],
        },
      ],
    },
    {
      id: 'vs_looker', x: 25, y: 8, look: 'scientist', name: 'Looker', movement: 'still', facing: 'left',
      script: 'looker',
      dialogue: [{ lines: ['You. Yes, you. A moment of your time.'] }],
    },
    {
      id: 'vs_local', x: 12, y: 21, look: 'oldMan', name: 'Ard', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { flag: 'galacticHQ' },
          lines: ['So it is true about the grey building. I said it for a year and got laughed at.',
            'They bought the land off the city for nothing. Nobody asked what for.',
            'Now everyone is asking. Bit late.'],
        },
        {
          when: { linked: true },
          lines: ['Two of you walking the region together. Good.',
            'Veilstone is not a friendly city. It grew too fast to learn how.',
            'Places like this are much better with somebody beside you.'],
        },
        {
          lines: ['This was a quarry when I was a boy. One hole and forty people.',
            'Now look at it. Department store and everything.',
            'Grew too fast, mind. Things get in when a place grows that fast.'],
        },
      ],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Maylene's Gym. Bare boards and a straight run at her — no maze, because the
// joke of a Fighting Gym is that there is nowhere to hide.
// ---------------------------------------------------------------------------
export const VEILSTONE_GYM = defineMap('veilstone_gym', {
  name: 'Veilstone Gym', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|gggggggggggggg|',
    '|gggggggggggggg|',
    '|gg!!gggggg!!gg|',
    '|gg!!gggggg!!gg|',
    '|gggggggggggggg|',
    '|gggg!!!!!!gggg|',
    '|gggg!!!!!!gggg|',
    '|gggggggggggggg|',
    '|gg!!gggggg!!gg|',
    '|gg!!gggggg!!gg|',
    '|gggggggggggggg|',
    '|gggg!!!!!!gggg|',
    '|gggggggggggggg|',
    '|gggggggggggggg|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 15, to: 'veilstone', tx: 21, ty: 19, dir: 'down' },
    { x: 8, y: 15, to: 'veilstone', tx: 22, ty: 19, dir: 'down' },
  ],
  npcs: [
    {
      id: 'gym4_leader', x: 7, y: 1, look: 'lass', trainer: 'gym4_leader',
      facing: 'down', sight: 0, movement: 'still', script: 'gymLeader',
      after: ['Come back when you have been further. I train every day. So should you.'],
      dialogue: [
        {
          lines: ['I am Maylene. I run this Gym. I know what you are thinking.',
            'Everyone thinks it. Then we battle and they stop thinking it.',
            'No shoes on my floor, no tricks in my Gym. Just you and me and what we brought.',
            'Take the COBBLE BADGE if you can get through it.'],
        },
      ],
    },
    { id: 'gym4_t1', x: 3, y: 6, look: 'youngster', trainer: 'gym4_a', facing: 'right', sight: 5, movement: 'still' },
    { id: 'gym4_t2', x: 10, y: 9, look: 'hiker', trainer: 'gym4_b', facing: 'left', sight: 5, movement: 'still' },
    { id: 'gym4_t3', x: 3, y: 12, look: 'bugCatcher', trainer: 'gym4_c', facing: 'up', sight: 4, movement: 'still' },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Veilstone's interiors, and the two grey buildings.
// ---------------------------------------------------------------------------
export const SOLACEON_CENTER = defineMap('solaceon_center', {
  name: 'Pokémon Center', kind: 'indoor', music: 'center', darkEdges: false,
  tiles: [
    '||||||||||||||',
    '|__H_______P_|',
    '|_xxxxx______|',
    '|____________|',
    '|_p________p_|',
    '|____________|',
    '|____________|',
    '||||||DD||||||',
  ],
  warps: [
    { x: 6, y: 7, to: 'solaceon', tx: 7, ty: 6, dir: 'down' },
    { x: 7, y: 7, to: 'solaceon', tx: 7, ty: 6, dir: 'down' },
  ],
  npcs: [
    {
      id: 'sc_nurse', x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: [
        { when: { linked: true }, lines: ['Welcome to Solaceon. {partner} is on the link as well.', 'Shall I heal your team to full health?'] },
        { lines: ['Welcome to the Solaceon Pokémon Center. Shall I heal your team to full health?'] },
      ],
    },
    {
      id: 'sc_pc', x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [{ lines: ['The storage system behind me holds anything your party cannot.', 'Walk up to the terminal and press A.'] }],
    },
    {
      id: 'sc_digger', x: 9, y: 5, look: 'scientist', name: 'Researcher', movement: 'wander', facing: 'down',
      dialogue: [{ lines: ['Every character on those ruin walls is a living Pokémon.',
        'They arrange themselves into words. Nobody knows who taught them the words.'] }],
    },
  ],
  encounters: null,
});

export const SOLACEON_HOUSE = defineMap('solaceon_house', {
  name: 'Solaceon House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||',
    '|kk__ee_p|',
    '|________|',
    '|_b____v_|',
    '|________|',
    '|________|',
    '||||DD||||',
  ],
  warps: [
    { x: 4, y: 6, to: 'solaceon', tx: 21, ty: 5, dir: 'down' },
    { x: 5, y: 6, to: 'solaceon', tx: 21, ty: 5, dir: 'down' },
  ],
  npcs: [
    {
      id: 'sh_gran', x: 2, y: 3, look: 'mom', name: 'Edda', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you. Sit down, both of you, you look worn through.',
            'My husband and I walked to Snowpoint the year we married.',
            'He complained the entire way and talked about it for forty years.'],
        },
        {
          lines: ['You will want a rest before Route 210. That fog takes it out of you.',
            'And there are people on that road who should not be on it.'],
        },
      ],
    },
  ],
  encounters: null,
});

export const VEILSTONE_CENTER = defineMap('veilstone_center', {
  name: 'Pokémon Center', kind: 'indoor', music: 'center', darkEdges: false,
  tiles: [
    '||||||||||||||',
    '|__H_______P_|',
    '|_xxxxx______|',
    '|____________|',
    '|_p________p_|',
    '|____________|',
    '|____________|',
    '||||||DD||||||',
  ],
  warps: [
    { x: 6, y: 7, to: 'veilstone', tx: 7, ty: 16, dir: 'down' },
    { x: 7, y: 7, to: 'veilstone', tx: 7, ty: 16, dir: 'down' },
  ],
  npcs: [
    {
      id: 'vc_nurse', x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: [
        { when: { linked: true }, lines: ['Welcome to Veilstone. {partner} is on the link as well.', 'Shall I heal your team to full health?'] },
        { lines: ['Welcome to the Veilstone Pokémon Center. Shall I heal your team to full health?'] },
      ],
    },
    {
      id: 'vc_pc', x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [{ lines: ['The storage system behind me holds anything your party cannot.', 'Walk up to the terminal and press A.'] }],
    },
    {
      id: 'vc_worried', x: 9, y: 5, look: 'lass', name: 'Trainer', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { flag: 'galacticHQ' },
          lines: ['You went in there? Into the grey building?',
            'People have been walking past it for a year pretending it is offices.',
            'I am not sure I wanted to know.'],
        },
        {
          lines: ['Maylene beat me in about ninety seconds. Then she apologised.',
            'That was somehow worse.'],
        },
      ],
    },
  ],
  encounters: null,
});

/** The Department Store: a Mart with more of everything. */
export const VEILSTONE_STORE = defineMap('veilstone_store', {
  name: 'Veilstone Dept. Store', kind: 'indoor', music: 'mart', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|++++++++++++++|',
    '|+_xxxxxx_____+|',
    '|+____________+|',
    '|+_M__M__M__M_+|',
    '|+____________+|',
    '|+_M__M__M__M_+|',
    '|+____________+|',
    '|+++++++DD++++++',
  ],
  warps: [
    { x: 7, y: 8, to: 'veilstone', tx: 8, ty: 7, dir: 'down' },
    { x: 8, y: 8, to: 'veilstone', tx: 8, ty: 7, dir: 'down' },
  ],
  npcs: [
    {
      id: 'vst_clerk', x: 4, y: 1, look: 'clerk', name: 'Clerk', movement: 'still', facing: 'down',
      script: 'departmentStore', overCounter: true,
      dialogue: [{ lines: ['Four floors, in theory. One floor, in practice. What can I get you?'] }],
    },
    {
      id: 'vst_shopper', x: 11, y: 5, look: 'mom', name: 'Shopper', movement: 'wander', facing: 'down',
      dialogue: [{ lines: ['Everything in Sinnoh ends up on these shelves eventually.',
        'Half of it came out of the ground under this city.'] }],
    },
  ],
  encounters: null,
});

/**
 * The Galactic Warehouse. Locked, until the story says otherwise — the first
 * time the coats stop being a rumour and become a door you are standing at.
 */
export const GALACTIC_WAREHOUSE = defineMap('galactic_warehouse', {
  name: 'Galactic Warehouse', kind: 'indoor', music: 'cave', darkEdges: false,
  tiles: [
    '||||||||||',
    '|++++++++|',
    '|+MM++MM+|',
    '|++++++++|',
    '|+MM++MM+|',
    '|++++++++|',
    '|+MM++MM+|',
    '|++++++++|',
    '|++++++++|',
    '||||DD||||',
  ],
  warps: [
    { x: 4, y: 9, to: 'veilstone', tx: 6, ty: 26, dir: 'down' },
    { x: 5, y: 9, to: 'veilstone', tx: 6, ty: 26, dir: 'down' },
  ],
  objects: [
    { id: 'gw_ball', x: 2, y: 8, item: 'ultraball', qty: 3 },
  ],
  npcs: [
    {
      id: 'gw_grunt', x: 4, y: 2, look: 'grunt', trainer: 'gw_grunt',
      facing: 'down', sight: 4, movement: 'still',
      after: [{ lines: ['We are not a company. We never said we were a company.',
        'You said it. Everybody said it. We just did not correct anyone.'] }],
    },
    {
      id: 'gw_crate', x: 5, y: 6, look: 'gruntF', name: 'Grunt', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { flag: 'galacticHQ' },
          lines: ['So you have been up the hill as well. Then you know what we are for.',
            'It is not a secret any more. It was never really a secret.',
            'It was just too large for anyone to say out loud.'],
        },
        {
          lines: ['This is storage. Storage is boring. Go and be somewhere else.',
            'Everything worth looking at is up the hill and you cannot get in there either.'],
        },
      ],
    },
  ],
  encounters: null,
});

/**
 * Galactic HQ. The building on the hill that everyone in Veilstone has agreed
 * not to ask about, and the point where the Everlight stops being a thing that
 * happened under Oreburgh and becomes a plan with a schedule.
 */
export const GALACTIC_HQ = defineMap('galactic_hq', {
  name: 'Galactic HQ', kind: 'indoor', music: 'cave', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|++++++++++++++|',
    '|+P+++++++++P++|',
    '|++++++++++++++|',
    '|+!!++!!++!!+!+|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|+!!++!!++!!+!+|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|+M++++++++++M+|',
    '|++++++++++++++|',
    '|++++++DD++++++|',
    '||||||||||||||||',
  ],
  warps: [
    { x: 7, y: 12, to: 'veilstone', tx: 26, ty: 6, dir: 'down' },
    { x: 8, y: 12, to: 'veilstone', tx: 26, ty: 6, dir: 'down' },
  ],
  objects: [
    { id: 'gh_max', x: 2, y: 9, item: 'maxrevive', qty: 1 },
  ],
  npcs: [
    {
      id: 'gh_saturn', x: 7, y: 1, look: 'boss', name: 'Saturn', movement: 'still', facing: 'down',
      script: 'saturn',
      dialogue: [{ lines: ['You are in a building you were not invited into.'] }],
    },
    { id: 'gh_t1', x: 3, y: 6, look: 'grunt', trainer: 'hq_grunt1', facing: 'right', sight: 4, movement: 'still' },
    { id: 'gh_t2', x: 12, y: 8, look: 'gruntF', trainer: 'hq_grunt2', facing: 'left', sight: 4, movement: 'still' },
  ],
  encounters: null,
});
