// The northern branch.
//
// Everything in this file exists to stop the region being a corridor. Before
// it, every road out of every town ran north into the next town, and the world
// was a single line you walked up. Jubilife is the hinge: Route 202 leaves it
// south, Route 203 leaves it east, and Route 204 leaves it north — and the
// north road eventually bends back round to meet the east one, which is what
// turns a line into a region.
import { defineMap } from './define.js';

// ---------------------------------------------------------------------------
// Route 204 — Jubilife up to the Ravaged Path.
// ---------------------------------------------------------------------------
export const ROUTE204 = defineMap('route204', {
  name: 'Route 204', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::.....RR....T',
    'T....""""...::...........T',
    'T...........::....""""...T',
    'T..YYYY.....::....""""...T',
    'T..YYYY.....::...........T',
    'T...........::...........T',
    'T....OOO....::..YYYY.....T',
    'T...........::..YYYY.....T',
    'T:::::::::::::...........T',
    'T...........::...........T',
    'T....""""...::....~~~~...T',
    'T....""""...::...~~~~~~..T',
    'T...........::....~~~~...T',
    'T..RR.......::...........T',
    'T...........::....""""...T',
    'T...LLLLLL..::....""""...T',
    'T...........::...........T',
    'T....""""...::..YYYY.....T',
    'T....""""...::..YYYY.....T',
    'T...........::...........T',
    'T.........S.::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 23, to: 'jubilife', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 23, to: 'jubilife', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'ravaged_path', tx: 8, ty: 10, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'ravaged_path', tx: 9, ty: 10, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 22, text: 'ROUTE 204\nJUBILIFE CITY — SOUTH\nFLOAROMA TOWN — NORTH, through the\nRavaged Path.' },
  ],
  objects: [
    { id: 'r4_repel', x: 2, y: 12, item: 'repel', qty: 2 },
    { id: 'r4_ether', x: 21, y: 20, item: 'ether', qty: 1 },
  ],
  npcs: [
    { id: 'r4_t1', x: 8, y: 6, look: 'bugCatcher', trainer: 'r4_bug', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r4_t2', x: 18, y: 17, look: 'lass', trainer: 'r4_lass', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'r4_hiker', x: 6, y: 15, look: 'hiker', name: 'Marek', movement: 'lookAround', facing: 'right',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you on the north road. Good.',
            'The Ravaged Path is dark and it goes on longer than it looks.',
            'Nicer with somebody. Most things are.'],
        },
        {
          lines: ['North of here the road goes through the Ravaged Path.',
            'It is not much of a cave. It is enough of one at night.',
            'Floaroma is on the other side. You will smell it before you see it.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 6, max: 10,
      table: [[396, 22], [399, 20], [401, 16], [415, 14], [403, 12], [406, 10], [265, 6]],
      night: { min: 6, max: 10, table: [[163, 28], [41, 22], [401, 16], [399, 14], [198, 12], [434, 8]] },
      morning: { min: 6, max: 10, table: [[396, 30], [415, 22], [399, 18], [401, 16], [403, 14]] },
    },
    fish: { min: 5, max: 10, table: [[129, 62], [118, 20], [339, 12], [422, 6]] },
  },
});

// ---------------------------------------------------------------------------
// The Ravaged Path — a short, wet cave. Not a dungeon; a doorway.
// ---------------------------------------------------------------------------
export const RAVAGED_PATH = defineMap('ravaged_path', {
  name: 'Ravaged Path', kind: 'cave', music: 'cave',
  tiles: [
    'CCCCCCCCccCCCCCCCC',
    'CccccccccccccccCCC',
    'CccccccccccccccCCC',
    'CCCCcccCCCcccccccC',
    'CccccccCCCCCCcccCC',
    'CcccccccccccccccCC',
    'CCCcccCCCCCcccccCC',
    'CcccccccccccccccCC',
    'CcccCCCCCCcccccccC',
    'CccccccccCCCCcccCC',
    'CcccccccccccccccCC',
    'CCCCCCCCccCCCCCCCC',
  ],
  warps: [
    { x: 8, y: 11, to: 'route204', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 9, y: 11, to: 'route204', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 8, y: 0, to: 'floaroma', tx: 12, ty: 16, dir: 'up', edge: true },
    { x: 9, y: 0, to: 'floaroma', tx: 13, ty: 16, dir: 'up', edge: true },
  ],
  signs: [],
  objects: [
    { id: 'rp_stone', x: 2, y: 5, item: 'waterstone', qty: 1 },
  ],
  npcs: [],
  encounters: {
    cave: { min: 7, max: 11, table: [[41, 40], [74, 26], [63, 14], [95, 10], [433, 10]] },
  },
});

// ---------------------------------------------------------------------------
// Floaroma Town — flowers, and the way further north.
// ---------------------------------------------------------------------------
export const FLOAROMA = defineMap('floaroma', {
  name: 'Floaroma Town', kind: 'town', music: 'town',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T..**..**...::...**..**..T',
    'T..**..**...::...**..**..T',
    'T...........::...........T',
    'T..AAAAAAAA.::.....GGGGG.T',
    'T..AAAAAAAA.::.....GGGGG.T',
    'T..VVVVVVVV.::.....#WDW#.T',
    'T..#WFFDFFW.::.......:...T',
    'T.....:.....::.......:...T',
    'T.....:::::::::::::::....T',
    'T.....:.....::...........T',
    'T..S..:..**.::..**...**..T',
    'T.....:..**.::..**...**..T',
    'T.....:.....::...........T',
    'T..OOO:.....::....OOO....T',
    'T.....:.....::...........T',
    'T.....::::::::...........T',
    'T...........::..........ST',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 18, to: 'ravaged_path', tx: 8, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 18, to: 'ravaged_path', tx: 9, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'route205', tx: 12, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route205', tx: 13, ty: 22, dir: 'up', edge: true },
    { x: 7, y: 7, to: 'floaroma_center', tx: 6, ty: 6, dir: 'up' },
    { x: 21, y: 6, to: 'floaroma_house', tx: 5, ty: 5, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 6, w: 8, text: 'POKéMON CENTER' },
  ],
  signs: [
    { x: 3, y: 11, text: 'FLOAROMA TOWN\n"Where the flowers never stop."\nThe soil here takes anything.' },
    { x: 24, y: 17, text: 'ROUTE 205 — NORTH\nValley Windworks lies east of the road.' },
  ],
  objects: [],
  healPoint: { map: 'floaroma_center', x: 6, y: 7 },
  npcs: [
    {
      id: 'fl_flowergirl', x: 9, y: 12, look: 'lass', name: 'Posy', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you! Plant something together in our soil.',
            'Things grown by two people come up better. I do not know why.',
            'I have stopped asking why about most things in this town.'],
        },
        {
          when: { flag: 'gotBerries' },
          lines: ['You have berries on you — I can tell, everybody here can.',
            'Our soil takes anything. Put one in and come back tomorrow.'],
        },
        {
          lines: ['Floaroma is built on flowers and not much else.',
            'There is soft soil all over town. Nobody owns it. Use it.'],
        },
      ],
    },
    {
      id: 'fl_worker', x: 18, y: 10, look: 'worker', name: 'Dorn', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { badges: 1 },
          lines: ['Badge already? Then the Windworks will not frighten you.',
            'It is east off Route 205. Big machines, loud, worth seeing.'],
        },
        {
          lines: ['The Valley Windworks is east of Route 205.',
            'It powers half the region and it whines like a kettle all day.'],
        },
      ],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Route 205 — north out of Floaroma, with the Windworks off to the east. The
// first road in the region that branches sideways rather than just continuing.
// ---------------------------------------------------------------------------
export const ROUTE205 = defineMap('route205', {
  name: 'Route 205', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::.....RR....T',
    'T....""""...::...........T',
    'T...........::....YYYY...T',
    'T..~~~~.....::....YYYY...T',
    'T.~~~~~~....::...........T',
    'T..~~~~.....::...........T',
    'T...........::::::::::::::',
    'T....""""...::...........T',
    'T....""""...::....""""...T',
    'T...........::....""""...T',
    'T..YYYY.....::...........T',
    'T..YYYY.....::.....RR....T',
    'T...........::...........T',
    'T....OOO....::....YYYY...T',
    'T...........::....YYYY...T',
    'T..LLLLLL...::...........T',
    'T...........::....""""...T',
    'T....""""...::....""""...T',
    'T....""""...::...........T',
    'T...........::...........T',
    'T.........S.::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 23, to: 'floaroma', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 23, to: 'floaroma', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'eterna_forest', tx: 9, ty: 16, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'eterna_forest', tx: 10, ty: 16, dir: 'up', edge: true },
    { x: 25, y: 8, to: 'windworks', tx: 1, ty: 6, dir: 'right', edge: true },
  ],
  signs: [
    { x: 10, y: 22, text: 'ROUTE 205\nFLOAROMA TOWN — SOUTH\nETERNA FOREST — NORTH\nVALLEY WINDWORKS — EAST' },
  ],
  objects: [
    { id: 'r5_super', x: 2, y: 19, item: 'superpotion', qty: 2 },
  ],
  npcs: [
    { id: 'r5_t1', x: 8, y: 10, look: 'youngster', trainer: 'r5_youngster', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r5_t2', x: 19, y: 19, look: 'bugCatcher', trainer: 'r5_bug', facing: 'up', sight: 4, movement: 'still' },
    {
      id: 'r5_fisher', x: 6, y: 8, look: 'sailor', name: 'Wend', movement: 'still', facing: 'up',
      dialogue: [
        { lines: ['The water up here runs off the mountain. Cold, and full of things.',
          'If you have a rod, use it. If you have not, Bram in Sandgem has spares.'] },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 8, max: 12,
      table: [[396, 20], [415, 20], [401, 16], [406, 14], [399, 12], [403, 10], [265, 8]],
      night: { min: 8, max: 12, table: [[163, 26], [41, 22], [198, 16], [401, 14], [434, 12], [399, 10]] },
    },
    fish: { min: 6, max: 12, table: [[129, 58], [118, 20], [339, 14], [422, 8]] },
  },
});

// ---------------------------------------------------------------------------
// Valley Windworks — a dead end worth walking to, which is what a side branch
// has to be if the branch is going to mean anything.
// ---------------------------------------------------------------------------
export const WINDWORKS = defineMap('windworks', {
  name: 'Valley Windworks', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTTTTTTTT',
    'T................T',
    'T..EEEEEE........T',
    'T..EEEEEE...RR...T',
    'T..VVVVVV........T',
    'T..#WWDWW#.......T',
    '::......:........T',
    'T.......:........T',
    'T..""...:....""..T',
    'T..""...:....""..T',
    'T.......:........T',
    'T..OOO..:...RR...T',
    'T.......:........T',
    'T..S....:........T',
    'TTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 0, y: 6, to: 'route205', tx: 24, ty: 8, dir: 'left', edge: true },
    { x: 6, y: 5, to: 'windworks_in', tx: 5, ty: 6, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 6, text: 'WINDWORKS' },
  ],
  signs: [
    { x: 3, y: 13, text: 'VALLEY WINDWORKS\nGenerating for the whole region since\nbefore anyone here was born.' },
  ],
  objects: [
    { id: 'ww_nugget', x: 15, y: 12, item: 'nugget', qty: 1 },
  ],
  npcs: [
    { id: 'ww_t1', x: 13, y: 8, look: 'worker', trainer: 'ww_worker', facing: 'left', sight: 4, movement: 'still' },
  ],
  encounters: {
    grass: {
      min: 9, max: 13,
      table: [[403, 30], [81, 22], [399, 18], [396, 16], [434, 14]],
      night: { min: 9, max: 13, table: [[81, 30], [403, 24], [41, 20], [434, 16], [198, 10]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Eterna Forest — dark, close, and full of Bug types. The classic one.
// ---------------------------------------------------------------------------
export const ETERNA_FOREST = defineMap('eterna_forest', {
  name: 'Eterna Forest', kind: 'route', music: 'forest', dark: true,
  tiles: [
    'YYYYYYYYY::YYYYYYYY',
    'Y.......:::.......Y',
    'Y.""""..:.:..""""'+'.Y',
    'Y.""""..:.:..""""'+'.Y',
    'Y...YY..:.:..YY...Y',
    'Y...YY..:.:..YY...Y',
    'Y.......:.:.......Y',
    'Y.""""..:.:..""""'+'.Y',
    'Y.""""..:::..""""'+'.Y',
    'Y....YYYY.YYYY....Y',
    'Y.......:.:.......Y',
    'Y.""""..:.:..""""'+'.Y',
    'Y.""""..:.:..""""'+'.Y',
    'Y...YY..:.:..YY...Y',
    'Y...YY..:.:..YY...Y',
    'Y.......:::.......Y',
    'Y.""""...:...""""'+'.Y',
    'YYYYYYYYY::YYYYYYYY',
  ],
  warps: [
    { x: 9, y: 17, to: 'route205', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 10, y: 17, to: 'route205', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 9, y: 0, to: 'eterna', tx: 12, ty: 24, dir: 'up', edge: true },
    { x: 10, y: 0, to: 'eterna', tx: 13, ty: 24, dir: 'up', edge: true },
  ],
  signs: [],
  objects: [
    { id: 'ef_ball', x: 2, y: 9, item: 'greatball', qty: 3 },
  ],
  npcs: [
    { id: 'ef_t1', x: 6, y: 10, look: 'bugCatcher', trainer: 'ef_bug', facing: 'right', sight: 3, movement: 'still' },
  ],
  encounters: {
    grass: {
      min: 10, max: 14,
      table: [[265, 28], [415, 22], [401, 18], [406, 14], [402, 10], [455, 8]],
      night: { min: 10, max: 14, table: [[163, 26], [92, 20], [200, 18], [401, 16], [434, 12], [455, 8]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Eterna City — the top of the northern branch, and the corner where it turns
// back east toward Route 206 and the road home.
// ---------------------------------------------------------------------------
export const ETERNA = defineMap('eterna', {
  name: 'Eterna City', kind: 'town', music: 'city',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T..............................T',
    'T..AAAAAAAA.........BBBBBBBB...T',
    'T..AAAAAAAA.........BBBBBBBB...T',
    'T..VVVVVVVV.........VVVVVVVV...T',
    'T..#WFFDFFW.........#WJJDJJW...T',
    'T.....:...................:....T',
    'T.....:::::::::::::::::::::::...',
    'T.....:...................:....T',
    'T..S..:....II.........II..:....T',
    'T.....:...................:....T',
    'T.....:...KKKKKKKKKK......:....T',
    'T.....:...KKKKKKKKKK......:....T',
    'T.....:...VVVVVVVVVV......:....T',
    'T.....:...NQNNddNNQN......:....T',
    'T.....:...I.S....S.I......:....T',
    'T.....:::::::::::::::::::::....T',
    'T..............................T',
    'T..OOO....**......**.....OOO...T',
    'T.........**......**...........T',
    'T............::................T',
    'T..............................T',
    'T..............................T',
    'T..............................T',
    'T..............................T',
    'TTTTTTTTTTTT::TTTTTTTTTTTTTTT..T',
  ],

  warps: [
    { x: 12, y: 25, to: 'eterna_forest', tx: 9, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 25, to: 'eterna_forest', tx: 10, ty: 1, dir: 'down', edge: true },
    { x: 31, y: 7, to: 'route206', tx: 1, ty: 6, dir: 'right', edge: true },
    { x: 7, y: 5, to: 'eterna_center', tx: 6, ty: 6, dir: 'up' },
    { x: 24, y: 5, to: 'eterna_mart', tx: 4, ty: 5, dir: 'up' },
    { x: 14, y: 14, to: 'eterna_gym', tx: 7, ty: 14, dir: 'up' },
    { x: 15, y: 14, to: 'eterna_gym', tx: 8, ty: 14, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 8, text: 'POKéMON CENTER' },
    { x: 20, y: 4, w: 8, text: 'POKéMON MART' },
    { x: 10, y: 13, w: 10, text: 'ETERNA GYM', tone: '#f8e070' },
  ],
  signs: [
    { x: 3, y: 9, text: 'ETERNA CITY\n"Old before the rest of us."\nThe GYM here is Grass-type.' },
    { x: 12, y: 15, text: 'ETERNA CITY POKéMON GYM\nLEADER: Gardenia\nThe Forest’s Own\nGrass-type. Bring fire, or bring patience.' },
    { x: 17, y: 15, text: 'A challenger must earn the Forest Badge\nhere before the road east will let them\npast the tollgate on Route 206.' },
  ],
  objects: [],
  healPoint: { map: 'eterna_center', x: 6, y: 7 },
  npcs: [
    {
      id: 'et_guide', x: 16, y: 16, look: 'youngster', name: 'Gym Guide', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge2' },
          lines: ['Forest Badge! Gardenia does not give those away.',
            'Route 206 is east. It runs south all the way back to Oreburgh.',
            'You have walked a circle round the region. Most people never notice.'],
        },
        {
          lines: ['This is the ETERNA GYM. Gardenia is Grass-type, all the way through.',
            'Fire, Flying and Bug moves will do the work for you.',
            'Beat her and you get the FOREST BADGE.'],
        },
      ],
    },
    {
      // Cynthia. Long before she is the Champion she is just the woman who
      // knows more about this region than anyone and keeps turning up.
      id: 'et_cynthia', x: 20, y: 18, look: 'mom', name: 'Cynthia',
      movement: 'still', facing: 'down', script: 'cynthiaCut',
      dialogue: [{ lines: ['There is more history under Sinnoh than on top of it.'] }],
    },
    {
      id: 'et_old', x: 8, y: 18, look: 'oldMan', name: 'Hest', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you, this far north. That is a proper walk.',
            'Take the east road home rather than back through the forest.',
            'Different way round is a different walk. Worth it.'],
        },
        {
          lines: ['Eterna was here before the roads were.',
            'East of town the road bends south and runs all the way to Oreburgh.',
            'You can go round rather than back. That is worth knowing.'],
        },
      ],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Route 206 — the road that closes the loop. South and east out of Eterna,
// joining Route 207 above Oreburgh, so the region is a ring and not a tree.
// ---------------------------------------------------------------------------
export const ROUTE206 = defineMap('route206', {
  name: 'Route 206', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T...................TTT..T',
    'T..""""........RR...T.T..T',
    'T.."""".............TfT..T',
    'T................TTT.....T',
    'T..OOO..........TTTTT....T',
    '::::::::::::::...TTT.....T',
    'T............:...........T',
    'T..""""......:....""""...T',
    'T..""""......:....""""...T',
    'T............:...........T',
    'T..RR........:......LL...T',
    'T............:...........T',
    'T..""""......:....YYYY...T',
    'T..""""......:....YYYY...T',
    'T.......S....:...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 0, y: 6, to: 'eterna', tx: 30, ty: 7, dir: 'left', edge: true },
    { x: 12, y: 16, to: 'route207', tx: 4, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 16, to: 'route207', tx: 5, ty: 1, dir: 'down', edge: true },
  ],
  signs: [
    { x: 8, y: 15, text: 'ROUTE 206\nETERNA CITY — WEST\nROUTE 207 — SOUTH, then Oreburgh.\nYou have come round in a circle.' },
  ],
  objects: [
    { id: 'r6_hyper', x: 21, y: 2, item: 'hyperpotion', qty: 1 },
  ],
  npcs: [
    { id: 'r6_t1', x: 8, y: 9, look: 'hiker', trainer: 'r6_hiker', facing: 'right', sight: 4, movement: 'still' },
    {
      id: 'r6_walker', x: 19, y: 12, look: 'lass', name: 'Rin', movement: 'wander', facing: 'down',
      dialogue: [
        { lines: ['South from here is Route 207, and then Oreburgh.',
          'I walked out of Jubilife going east and came back to it going west.',
          'Took me two days and I would do it again.'] },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 11, max: 15,
      table: [[74, 24], [396, 18], [403, 16], [415, 14], [66, 12], [95, 10], [436, 6]],
      night: { min: 11, max: 15, table: [[41, 26], [74, 22], [163, 18], [200, 14], [434, 12], [95, 8]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Interiors for the northern branch.
// ---------------------------------------------------------------------------

const center = (id, town, name, nurseLine) => defineMap(id, {
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
    { x: 6, y: 7, to: town.id, tx: town.x, ty: town.y, dir: 'down' },
    { x: 7, y: 7, to: town.id, tx: town.x, ty: town.y, dir: 'down' },
  ],
  npcs: [
    {
      id: `${id}_nurse`, x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: [
        {
          when: { linked: true },
          lines: [`Welcome to ${name}. {partner} is showing as connected too.`,
            'Shall I heal your team to full health?'],
        },
        { lines: [`Welcome to the ${name} Pokémon Center. Shall I heal your team to full health?`] },
      ],
    },
    {
      id: `${id}_pc`, x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [{ lines: ['The storage system behind me holds anything your party cannot.',
        'Walk up to the terminal and press A.'] }],
    },
    {
      id: `${id}_local`, x: 9, y: 5, look: 'lass', name: 'Trainer', movement: 'wander', facing: 'down',
      dialogue: [{ lines: nurseLine }],
    },
  ],
  encounters: null,
});

const mart = (id, town, line) => defineMap(id, {
  name: 'Poké Mart', kind: 'indoor', music: 'mart', darkEdges: false,
  tiles: [
    '||||||||||',
    '|________|',
    '|_xxxx___|',
    '|_M____M_|',
    '|________|',
    '|________|',
    '||||DD||||',
  ],
  warps: [
    { x: 4, y: 6, to: town.id, tx: town.x, ty: town.y, dir: 'down' },
    { x: 5, y: 6, to: town.id, tx: town.x, ty: town.y, dir: 'down' },
  ],
  npcs: [
    {
      id: `${id}_clerk`, x: 3, y: 1, look: 'clerk', name: 'Clerk', movement: 'still', facing: 'down',
      script: 'shop', overCounter: true,
      dialogue: [{ lines: ['Welcome! What can I get you?'] }],
    },
    {
      id: `${id}_browser`, x: 7, y: 4, look: 'youngster', name: 'Shopper', movement: 'still', facing: 'left',
      dialogue: [{ lines: line }],
    },
  ],
  encounters: null,
});

export const FLOAROMA_CENTER = center('floaroma_center', { id: 'floaroma', x: 7, y: 8 }, 'Floaroma',
  ['Everything in this town smells of flowers. Even in here.',
    'There is soft soil all over Floaroma. Plant something before you go north.']);

export const ETERNA_CENTER = center('eterna_center', { id: 'eterna', x: 7, y: 6 }, 'Eterna',
  ['Gardenia is Grass-type and she is very good at it.',
    'Come back here when she has finished with you. Everybody does.']);

export const ETERNA_MART = mart('eterna_mart', { id: 'eterna', x: 24, y: 6 },
  ['Buy the Antidotes. The forest south of here is nothing but Bug types.',
    'Ask me how I know.']);

export const FLOAROMA_HOUSE = defineMap('floaroma_house', {
  name: 'Floaroma House', kind: 'indoor', music: 'home', darkEdges: false,
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
    { x: 4, y: 6, to: 'floaroma', tx: 21, ty: 7, dir: 'down' },
    { x: 5, y: 6, to: 'floaroma', tx: 21, ty: 7, dir: 'down' },
  ],
  npcs: [
    {
      id: 'fh_gran', x: 2, y: 3, look: 'mom', name: 'Wren', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you walking together. Oh, that is lovely.',
            'My husband and I did this road the year we met.',
            'We argued at the Windworks and made it up in the forest.'],
        },
        {
          lines: ['I have lived in Floaroma sixty years and never once gone further north.',
            'Never needed to. Everything I wanted turned up here eventually.'],
        },
      ],
    },
  ],
  encounters: null,
});

export const WINDWORKS_IN = defineMap('windworks_in', {
  name: 'Valley Windworks', kind: 'indoor', music: 'mart', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|P___ee___P|',
    '|__________|',
    '|_xxxx_____|',
    '|__________|',
    '|_p______p_|',
    '|__________|',
    '|||||DD|||||',
  ],
  warps: [
    { x: 5, y: 7, to: 'windworks', tx: 6, ty: 6, dir: 'down' },
    { x: 6, y: 7, to: 'windworks', tx: 6, ty: 6, dir: 'down' },
  ],
  npcs: [
    {
      id: 'wi_eng', x: 3, y: 4, look: 'scientist', name: 'Engineer', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'knowsTwist' },
          lines: ['You have been in Oreburgh Gate, then. I can tell.',
            'Our meters went strange the same week. Every gauge in the building.',
            'Whatever is under that hill, it is on the grid whether we like it or not.'],
        },
        {
          lines: ['Four turbines, and they have run without stopping for thirty years.',
            'Every light in Jubilife comes off this floor.',
            'People never think about where it comes from. I think about nothing else.'],
        },
      ],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// The Eterna Gym. Grass-type, and the second badge in the region.
// The floor is laid out as hedgerows: the way through is a maze, which is what
// a Gym is for — the leader is the last thing you reach, not the first.
// ---------------------------------------------------------------------------
export const ETERNA_GYM = defineMap('eterna_gym', {
  name: 'Eterna Gym', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|gggggggggggggg|',
    '|gggggg!!gggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|!!!!gg!!!!gg!!|',
    '|gggggggggggggg|',
    '|gg!!!!gggg!!gg|',
    '|gggggggggggggg|',
    '|!!gggg!!!!gggg|',
    '|gggggggggggggg|',
    '|gg!!!!gg!!!!gg|',
    '|gggggggggggggg|',
    '|gggg!!gggg!!gg|',
    '|gggggggggggggg|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 15, to: 'eterna', tx: 14, ty: 15, dir: 'down' },
    { x: 8, y: 15, to: 'eterna', tx: 15, ty: 15, dir: 'down' },
  ],
  npcs: [
    {
      id: 'gym2_leader', x: 7, y: 1, look: 'lass', trainer: 'gym2_leader',
      facing: 'down', sight: 0, movement: 'still', script: 'gymLeader',
      after: ['Come back and battle me again when you have grown. I will have grown too.'],
      dialogue: [
        {
          lines: ['I am Gardenia. Everything in this room is Grass, including me, more or less.',
            'People think Grass is the gentle one. People are wrong about a lot of things.',
            'Take the FOREST BADGE off me if you can.'],
        },
      ],
    },
    { id: 'gym2_t1', x: 3, y: 6, look: 'lass', trainer: 'gym2_a', facing: 'right', sight: 4, movement: 'still' },
    { id: 'gym2_t2', x: 12, y: 10, look: 'bugCatcher', trainer: 'gym2_b', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'gym2_guide', x: 4, y: 13, look: 'youngster', name: 'Gym Guide', movement: 'still', facing: 'right',
      dialogue: [
        { lines: ['Gardenia is up at the far end. You have to get through her trainers first.',
          'Fire, Flying, Bug, Ice, Poison — any of those. Grass folds to all of them.',
          'Do not bring anything Water. She will laugh at you, kindly, and then win.'] },
      ],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Lake Verity — west off Route 201, and the first time the region asks you to
// go sideways rather than onward. There is nothing here you need. That is what
// makes walking to it a choice.
// ---------------------------------------------------------------------------
export const LAKE_VERITY = defineMap('lake_verity', {
  name: 'Lake Verity', kind: 'route', music: 'forest',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTT',
    'T..................T',
    'T....TTTTTTTT......T',
    'T..TT........TT....T',
    'T.T....~~~~~~..T...T',
    'T.T..~~~~~~~~~~T...T',
    'T.T.~~~~~~~~~~~.T..T',
    'T...~~~~~~~~~~~~..::',
    'T...~~~~~~~~~~~~...T',
    'T.T..~~~~~~~~~~T...T',
    'T.T....~~~~~~..T...T',
    'T..TT..OOO...TT....T',
    'T....TTTTTTTT..S...T',
    'TTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 19, y: 7, to: 'route201', tx: 1, ty: 13, dir: 'right', edge: true },
  ],
  // The second lake. It only happens once Valor has gone, which is what
  // `requires` is for — walk in before that and it is just a lake.
  events: [
    { x: 17, y: 7, flag: 'lakeVerity', requires: 'lakeValor', script: 'lakeVerity' },
    { x: 17, y: 8, flag: 'lakeVerity', requires: 'lakeValor', script: 'lakeVerity' },
  ],
  signs: [
    { x: 15, y: 12, text: 'LAKE VERITY\nThe water has never once been measured\nall the way to the bottom.' },
  ],
  objects: [
    { id: 'lv_scale', x: 3, y: 2, item: 'heartscale', qty: 2 },
  ],
  npcs: [
    {
      id: 'lv_watcher', x: 17, y: 6, look: 'oldMan', name: 'Ori', movement: 'lookAround', facing: 'left',
      dialogue: [
        {
          when: { flag: 'caughtEverlight' },
          lines: ['The lake went still the night the sky went out.',
            'Not calm. Still. There is a difference and I have never wanted to know it.',
            'Whatever you brought up out of that hill — it has family here.'],
        },
        {
          when: { flag: 'knowsTwist' },
          lines: ['You have the look of somebody who has worked something out.',
            'There are three lakes in this region and something asleep in each one.',
            'Rowan has known that for thirty years. Ask him what he did about it.'],
        },
        {
          when: { linked: true },
          lines: ['Two of you, all the way out here, for a lake.',
            'Nothing to catch, nothing to win, nothing anybody needs.',
            'Best kind of walk there is.'],
        },
        {
          lines: ['People walk straight past the turning and go north.',
            'This lake has been here longer than the road has.',
            'Sit a minute. It does not ask anything of you.'],
        },
      ],
    },
  ],
  encounters: {
    grass: null,
    fish: { min: 4, max: 9, table: [[129, 55], [118, 22], [339, 13], [349, 6], [422, 4]] },
  },
});
