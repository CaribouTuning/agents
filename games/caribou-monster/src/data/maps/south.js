// The wet south: the marsh road, the town built on stilts beside it, and the
// lake Team Galactic get to first.
//
// This is where the campaign stops being a tour of Gyms. Lake Valor is the
// first time the player arrives somewhere and finds that the thing they came
// to see is already gone.
import { defineMap } from './define.js';

// ---------------------------------------------------------------------------
// Route 212 — Hearthome south into the wet country. It rains here too.
// ---------------------------------------------------------------------------
export const ROUTE212 = defineMap('route212', {
  name: 'Route 212', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::.....RR....T',
    'T....""""...::...........T',
    'T...........::....YYYY...T',
    'T..~~~~.....::....YYYY...T',
    'T.~~~~~~....::...........T',
    'T..~~~~.....::...........T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'T..RR.......::.......RR..T',
    'T...........::...........T',
    'T....OOO....::....YYYY...T',
    'T...........::....YYYY...T',
    'T..LLLLLL...::...........T',
    'T...........::....""""...T',
    'T....""""...::....""""...T',
    'T....""""...::...........T',
    'T.........S.::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 0, to: 'hearthome', tx: 12, ty: 26, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'hearthome', tx: 13, ty: 26, dir: 'up', edge: true },
    { x: 12, y: 21, to: 'pastoria', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 21, to: 'pastoria', tx: 13, ty: 1, dir: 'down', edge: true },
  ],
  signs: [
    { x: 10, y: 20, text: 'ROUTE 212\nHEARTHOME CITY — NORTH\nPASTORIA CITY — SOUTH\nThe ground stops being ground somewhere\nalong here.' },
  ],
  objects: [
    { id: 'r12_max', x: 2, y: 18, item: 'maxpotion', qty: 1 },
    { id: 'r12_ball', x: 21, y: 3, item: 'ultraball', qty: 2 },
  ],
  npcs: [
    { id: 'r12_t1', x: 8, y: 10, look: 'lass', trainer: 'r12_lass', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r12_t2', x: 19, y: 18, look: 'sailor', trainer: 'r12_sailor', facing: 'up', sight: 4, movement: 'still' },
    {
      id: 'r12_walker', x: 6, y: 13, look: 'hiker', name: 'Corr', movement: 'lookAround', facing: 'right',
      dialogue: [
        {
          when: { flag: 'galacticHQ' },
          lines: ['You have been in that Veilstone building. It is all over your face.',
            'Then you will want to know: a lorry of grey coats\nwent down this road on Tuesday.',
            'Heading for the lake. Nobody stopped them.',
            'Nobody ever does.'],
        },
        {
          lines: ['South is Pastoria. Built on stilts, most of it, and for good reason.',
            'The marsh beside it has things in it nobody has finished counting.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 22, max: 26,
      table: [[194, 22], [418, 20], [453, 18], [278, 14], [400, 12], [193, 8], [451, 6]],
      night: { min: 22, max: 26, table: [[194, 24], [92, 20], [453, 18], [431, 14], [41, 14], [451, 10]] },
    },
    fish: { min: 15, max: 24, table: [[129, 40], [118, 22], [418, 22], [194, 16]] },
  },
});

// ---------------------------------------------------------------------------
// Pastoria City — a town on stilts with a Water Gym and a marsh next door.
// ---------------------------------------------------------------------------
export const PASTORIA = defineMap('pastoria', {
  name: 'Pastoria City', kind: 'town', music: 'city',
  tiles: [
    'TTTTTTTTTTTTjjTTTTTTTTTTTTTTTT',
    'T...........jj...............T',
    'T..AAAAAAAA.jj......EEEEEE...T',
    'T.TAAAAAAAA.jj......EEEEEE.T.T',
    'T..VVVVVVVV.jj......VVVVVV...T',
    'T..#WFFDFFW.jj......#WWDWW...T',
    'T.....j.....jj..........j....T',
    'T.....jjjjjjjjjjjjjjjjjjjjjjjj',
    'T.....j.....jj..........j....T',
    'T.TS..j.....jj..........j...TT',
    'T.....j..KKKKKKKKKK.....j....T',
    'T.....j..KKKKKKKKKK.....j....T',
    'T.....j..VVVVVVVVVV.....j....T',
    'T.....j..NQNNddNNQN.....j....T',
    'T.....j..I.S....S.I.....j....T',
    'T.....jjjjjjjjjjjjjjjjjjjj...T',
    'T........8..jj.............8.T',
    'T..~~j~~....jj....~~~j~~~~...T',
    'T.~~~j~~~...jj...~~~~j~~~~~..T',
    'T..~~j~~....jj....~~~j~~~~...T',
    'T.8......T..jj...............T',
    'T..S........jj..T...........ST',
    'TTTTTTTTTTTTjjTTTTTTTTTTTTTTTT',
  ],

  warps: [
    { x: 12, y: 0, to: 'route212', tx: 12, ty: 20, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route212', tx: 13, ty: 20, dir: 'up', edge: true },
    { x: 12, y: 22, to: 'route213', tx: 2, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 22, to: 'route213', tx: 3, ty: 1, dir: 'down', edge: true },
    { x: 29, y: 7, to: 'route214', tx: 1, ty: 18, dir: 'right', edge: true },
    { x: 7, y: 5, to: 'pastoria_center', tx: 6, ty: 6, dir: 'up' },
    { x: 23, y: 5, to: 'great_marsh', tx: 8, ty: 14, dir: 'up' },
    { x: 13, y: 13, to: 'pastoria_gym', tx: 7, ty: 14, dir: 'up' },
    { x: 14, y: 13, to: 'pastoria_gym', tx: 8, ty: 14, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 8, text: 'POKéMON CENTER' },
    { x: 20, y: 4, w: 6, text: 'GREAT MARSH' },
    { x: 9, y: 12, w: 10, text: 'PASTORIA GYM', tone: '#f8e070' },
  ],
  signs: [
    { x: 3, y: 9, text: 'PASTORIA CITY\n"Half of it is on stilts and the other half\nregrets not being."' },
    { x: 11, y: 14, text: 'PASTORIA CITY POKéMON GYM\nLEADER: Crasher Wake\nThe Torrential Tag-Team\nWater-type. He announces himself. Loudly.' },
    { x: 16, y: 14, text: 'The Gym floor floods and drains on a\ntimer. Read the water, not the map.' },
    { x: 3, y: 21, text: 'The Great Marsh is a nature reserve.\nYou get thirty minutes and a bag of balls.' },
    { x: 28, y: 21, text: 'ROUTE 214 — EAST\nVEILSTONE CITY, the long way round.\nVALOR LAKEFRONT on the way.' },
  ],
  objects: [],
  healPoint: { map: 'pastoria_center', x: 6, y: 7 },
  npcs: [
    {
      id: 'pa_guide', x: 16, y: 15, look: 'youngster', name: 'Gym Guide', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge5' },
          lines: ['The Fen Badge! Wake shouts about everything but he does not hand those out.',
            'East is Route 214 and the Valor Lakefront.',
            'Something is going on up there. People have been turned back.'],
        },
        {
          lines: ['This is the PASTORIA GYM. Crasher Wake is Water-type and very loud about it.',
            'Grass and Electric moves are what get through Water.',
            'And watch the floor. It floods on a timer and he knows the timer.'],
        },
      ],
    },
    {
      id: 'pa_ranger', x: 22, y: 9, look: 'worker', name: 'Marsh Warden', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you? Go in together. Half an hour each, same marsh.',
            'People see completely different things in there on the same afternoon.',
            'Compare notes after. That is most of the fun of it.'],
        },
        {
          lines: ['The Great Marsh is a reserve. Thirty minutes, a bag of balls, no battling.',
            'There are things in there that are not anywhere else in Sinnoh.',
            'And a good deal of mud. Mostly mud, if I am honest.'],
        },
      ],
    },
    {
      id: 'pa_local', x: 8, y: 20, look: 'oldMan', name: 'Wend', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { flag: 'lakeValor' },
          lines: ['You saw what they did to the lake, then.',
            'My father fished that water. His father fished that water.',
            'And they emptied it in an afternoon because they wanted what was in it.'],
        },
        {
          when: { flag: 'galacticHQ' },
          lines: ['There were grey coats on the lakefront road all last week.',
            'They had a lorry with no plates and they would not say a word to anybody.',
            'The road up there is closed now. Closed by who, is what I want to know.'],
        },
        {
          lines: ['Whole town is on stilts. Has to be. The water comes up every spring.',
            'You get used to living above the thing that could take your house.'],
        },
      ],
    },
  ],
  encounters: {
    grass: null,
    fish: { min: 18, max: 28, table: [[129, 34], [118, 22], [418, 22], [194, 14], [278, 8]] },
  },
});

/**
 * The Great Marsh. A reserve rather than a route: nothing to battle, a lot to
 * catch, and things that live nowhere else in the region.
 */
export const GREAT_MARSH = defineMap('great_marsh', {
  subArea: true,
  name: 'Great Marsh', kind: 'route', music: 'forest',
  tiles: [
    'TTTTTTTTTTTTTTTTTT',
    'T""""""~~~~""""""T',
    'T""""""~~~~""""""T',
    'T""""~~~~~~~~""""T',
    'T""~~~~""""~~~~""T',
    'T""~~""""""""~~""T',
    'T""~~""~~~~""~~""T',
    'T""~~""~~~~""~~""T',
    'T""~~""""""""~~""T',
    'T""~~~~""""~~~~""T',
    'T""""~~~~~~~~""""T',
    'T""""""~~~~""""""T',
    'T""""""""""""""""T',
    'T""""""""""""""""T',
    'T.......::.......T',
    'TTTTTTTT::TTTTTTTT',
  ],
  warps: [
    { x: 8, y: 15, to: 'pastoria', tx: 23, ty: 6, dir: 'down' },
    { x: 9, y: 15, to: 'pastoria', tx: 23, ty: 6, dir: 'down' },
  ],
  signs: [],
  objects: [],
  npcs: [],
  encounters: {
    grass: {
      min: 24, max: 28,
      table: [[194, 20], [193, 16], [55, 14], [453, 12], [114, 12], [451, 10], [278, 10], [357, 6]],
      night: { min: 24, max: 28, table: [[194, 22], [193, 18], [92, 16], [451, 14], [114, 12], [55, 10], [431, 8]] },
    },
    fish: { min: 20, max: 30, table: [[129, 30], [194, 26], [118, 20], [418, 16], [55, 8]] },
  },
});

// ---------------------------------------------------------------------------
// Crasher Wake's Gym. The floor is water and walkway, and the walkway is
// narrow, because a Water Gym should make you commit to a route.
// ---------------------------------------------------------------------------
export const PASTORIA_GYM = defineMap('pastoria_gym', {
  name: 'Pastoria Gym', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|gggggggggggggg|',
    '|g~~~~~~~~~~~~g|',
    '|g~gggggggggg~g|',
    '|g~g~~~~~~~~g~g|',
    '|g~g~gggggg~g~g|',
    '|g~g~g~g~~g~g~g|',
    '|g~ggg~gg~g~g~g|',
    '|g~g~g~gg~g~g~g|',
    '|g~g~g~~~~g~g~g|',
    '|g~g~gggggg~g~g|',
    '|g~g~~~~~~~~g~g|',
    '|g~gggggggggg~g|',
    '|g~~~~~g~~~~~~g|',
    '|gggggggggggggg|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 15, to: 'pastoria', tx: 13, ty: 14, dir: 'down' },
    { x: 8, y: 15, to: 'pastoria', tx: 14, ty: 14, dir: 'down' },
  ],
  npcs: [
    {
      id: 'gym5_leader', x: 7, y: 7, look: 'sailor', trainer: 'gym5_leader',
      facing: 'down', sight: 0, movement: 'still', script: 'gymLeader',
      after: ['COME BACK ANY TIME! I mean that at this volume!'],
      dialogue: [
        {
          lines: ['I AM CRASHER WAKE! You have heard of me! Everybody has heard of me!',
            'I shout because the marsh is loud and I got into the habit.',
            'Water does not crash into you. Water gets underneath you and waits.',
            'COME AND TAKE THE FEN BADGE!'],
        },
      ],
    },
    { id: 'gym5_t1', x: 1, y: 5, look: 'sailor', trainer: 'gym5_a', facing: 'down', sight: 4, movement: 'still' },
    { id: 'gym5_t2', x: 14, y: 9, look: 'youngster', trainer: 'gym5_b', facing: 'up', sight: 4, movement: 'still' },
    { id: 'gym5_t3', x: 5, y: 3, look: 'lass', trainer: 'gym5_c', facing: 'right', sight: 4, movement: 'still' },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Route 213 — the beach south of Pastoria. A dead end until Surf, and worth
// the walk regardless, which is the whole argument for side branches.
// ---------------------------------------------------------------------------
export const ROUTE213 = defineMap('route213', {
  name: 'Route 213', kind: 'route', music: 'route',
  tiles: [
    'TT::TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T.............................',
    'T....""""...........RR........',
    'T...."""".....................',
    'T.............................',
    'Tsssssssssssssssssssssssssssss',
    'Tsssssssssssssssssssssssssssss',
    'Tss~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'Ts~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'T~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 2, y: 0, to: 'pastoria', tx: 12, ty: 21, dir: 'up', edge: true },
    { x: 3, y: 0, to: 'pastoria', tx: 13, ty: 21, dir: 'up', edge: true },
  ],
  signs: [
    { x: 20, y: 2, text: 'ROUTE 213\nThe sand goes on for miles and the water\ngoes on further. Nothing that way yet.' },
  ],
  objects: [
    { id: 'r13_scale', x: 25, y: 3, item: 'heartscale', qty: 3 },
    { id: 'r13_star', x: 6, y: 6, item: 'starpiece', qty: 1 },
  ],
  npcs: [
    { id: 'r13_t1', x: 12, y: 3, look: 'sailor', trainer: 'r13_sailor', facing: 'down', sight: 4, movement: 'still' },
    {
      id: 'r13_beach', x: 18, y: 6, look: 'lass', name: 'Sela', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you on the beach. Nobody comes down here.',
            'It goes nowhere, that is why. You cannot get across the water.',
            'Best place in Sinnoh to sit and not go anywhere, though.'],
        },
        {
          lines: ['This beach does not lead anywhere. Not without something to ride.',
            'People come, look at the water, and walk back up. Every day.',
            'I quite like that about it.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 24, max: 28,
      table: [[278, 30], [418, 24], [400, 18], [194, 14], [453, 8], [451, 6]],
      night: { min: 24, max: 28, table: [[278, 26], [418, 22], [92, 18], [194, 16], [451, 10], [41, 8]] },
    },
    fish: { min: 20, max: 32, table: [[129, 30], [118, 22], [418, 20], [278, 16], [55, 12]] },
  },
});

// ---------------------------------------------------------------------------
// Route 214 — Pastoria east and north to the Valor Lakefront, and on to
// Veilstone. It closes a second ring: the whole east of the region is now a
// circuit rather than a spur.
// ---------------------------------------------------------------------------
export const ROUTE214 = defineMap('route214', {
  name: 'Route 214', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::.....RR....T',
    'T....""""...::...........T',
    'T...........::....YYYY...T',
    'T..RR.......::....YYYY...T',
    'T...........::...........T',
    'T....OOO....::...........T',
    'T...........::....""""...T',
    'T..LLLLLL...::....""""...T',
    'T...........::...........T',
    'T....""""...::.......RR..T',
    'T....""""...::...........T',
    'T...........::....YYYY...T',
    'T..YYYY.....::....YYYY...T',
    'T..YYYY.....::...........T',
    'T...........::...........T',
    'T.........S.::...........T',
    '::::::::::::::...........T',
    'T...........::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 0, y: 18, to: 'pastoria', tx: 28, ty: 7, dir: 'left', edge: true },
    { x: 12, y: 0, to: 'valor_lakefront', tx: 12, ty: 14, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'valor_lakefront', tx: 13, ty: 14, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 17, text: 'ROUTE 214\nPASTORIA CITY — WEST\nVALOR LAKEFRONT — NORTH\nThe lake road has been busy lately.' },
  ],
  objects: [
    { id: 'r14_revive', x: 21, y: 2, item: 'maxrevive', qty: 1 },
  ],
  npcs: [
    { id: 'r14_t1', x: 8, y: 12, look: 'hiker', trainer: 'r14_hiker', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r14_t2', x: 19, y: 6, look: 'lass', trainer: 'r14_lass', facing: 'down', sight: 4, movement: 'still' },
    {
      id: 'r14_turned', x: 6, y: 4, look: 'worker', name: 'Ost', movement: 'still', facing: 'right',
      dialogue: [
        {
          when: { flag: 'lakeValor' },
          lines: ['They have gone. Whole lot of them, overnight.',
            'And the lake is still empty. That is the part nobody wants to say.'],
        },
        {
          lines: ['They turned me back at the lakefront. Grey coats, no badges, no names.',
            'Said it was a survey. There is no survey. I work for the water board.',
            'I would know about a survey.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 24, max: 28,
      table: [[449, 22], [66, 18], [453, 16], [431, 14], [451, 12], [74, 10], [194, 8]],
      night: { min: 24, max: 28, table: [[92, 22], [449, 20], [453, 18], [431, 16], [451, 14], [41, 10]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Valor Lakefront, and the lake itself. Getting here late is the point.
// ---------------------------------------------------------------------------
export const VALOR_LAKEFRONT = defineMap('valor_lakefront', {
  name: 'Valor Lakefront', kind: 'route', music: 'forest',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T..YYYY.....::.....YYYY..T',
    'T..YYYY.....::.....YYYY..T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'T..AAAAA....::....RR.....T',
    'T..AAAAA....::...........T',
    'T..VVVVV....::...........T',
    'T..#WDW#....::....OOO....T',
    'T....:......::...........T',
    'T....::::::::::..........T',
    'T...........::...........T',
    'T.........S.::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 16, to: 'route214', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 16, to: 'route214', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'lake_valor', tx: 11, ty: 17, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'lake_valor', tx: 12, ty: 17, dir: 'up', edge: true },
    { x: 5, y: 11, to: 'lakefront_center', tx: 6, ty: 6, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 10, w: 5, text: 'RESORT' },
  ],
  signs: [
    { x: 10, y: 15, text: 'VALOR LAKEFRONT\nLAKE VALOR — NORTH\nROUTE 214 — SOUTH\nThe lake is the deepest water in Sinnoh.\nNobody has been to the bottom of it.' },
  ],
  objects: [],
  healPoint: { map: 'lakefront_center', x: 6, y: 7 },
  npcs: [
    {
      id: 'vl_turned', x: 17, y: 12, look: 'scientist', name: 'Ivo', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { flag: 'lakeValor' },
          lines: ['I measured that lake every month for nine years.',
            'It was four hundred feet deep on the first of the month.',
            'It is a field now. There is grass coming up in it.'],
        },
        {
          when: { flag: 'galacticHQ' },
          lines: ['They are up there now. You can hear the machinery from here if the wind drops.',
            'I have called everyone I can think of. Nobody has jurisdiction over a lake.'],
        },
        {
          lines: ['Deepest water in the region and nobody has ever touched the bottom.',
            'Something lives down there. Every story this region has says so.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 25, max: 29,
      table: [[449, 20], [431, 18], [453, 16], [451, 14], [66, 12], [194, 12], [193, 8]],
      night: { min: 25, max: 29, table: [[92, 22], [431, 20], [449, 16], [451, 14], [41, 14], [355, 14]] },
    },
  },
});

/**
 * Lake Valor. The player arrives after it has already happened, which is the
 * only way this scene works — Team Galactic are not a threat you head off,
 * they are a thing that has been happening while you earned badges.
 */
export const LAKE_VALOR = defineMap('lake_valor', {
  name: 'Lake Valor', kind: 'route', music: 'forest',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'TT....................TT',
    'TT..""""........""""..TT',
    'TT..""""........""""..TT',
    'TT....................TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT...;;;;;;;;;;;;;;...TT',
    'TT....................TT',
    'TT..""""........""""..TT',
    'TT..""""........""""..TT',
    'TT....................TT',
    'TTTTTTTTTTT..TTTTTTTTTTT',
    'TTTTTTTTTTT::TTTTTTTTTTT',
  ],
  warps: [
    { x: 11, y: 18, to: 'valor_lakefront', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 18, to: 'valor_lakefront', tx: 13, ty: 1, dir: 'down', edge: true },
  ],
  events: [
    // Standing on the empty lakebed is the scene. It fires once.
    { x: 11, y: 12, flag: 'lakeValor', script: 'lakeValor' },
    { x: 12, y: 12, flag: 'lakeValor', script: 'lakeValor' },
  ],
  signs: [],
  objects: [],
  npcs: [],
  encounters: {
    grass: {
      min: 26, max: 30,
      table: [[194, 30], [451, 22], [449, 20], [453, 16], [431, 12]],
      night: { min: 26, max: 30, table: [[194, 28], [92, 22], [451, 20], [449, 18], [355, 12]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Interiors for the south.
// ---------------------------------------------------------------------------
const southCenter = (id, town, place, extra) => defineMap(id, {
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
        { when: { linked: true }, lines: [`Welcome to ${place}. {partner} is on the link as well.`, 'Shall I heal your team to full health?'] },
        { lines: [`Welcome to the ${place} Pokémon Center. Shall I heal your team to full health?`] },
      ],
    },
    {
      id: `${id}_pc`, x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [{ lines: ['The storage system behind me holds anything your party cannot.', 'Walk up to the terminal and press A.'] }],
    },
    { id: `${id}_local`, x: 9, y: 5, look: 'lass', name: 'Trainer', movement: 'wander', facing: 'down', dialogue: extra },
  ],
  encounters: null,
});

export const PASTORIA_CENTER = southCenter('pastoria_center', { id: 'pastoria', x: 7, y: 6 }, 'Pastoria', [
  {
    when: { flag: 'badge5' },
    lines: ['You beat Wake? He is still shouting about it, I expect.',
      'He shouts when he wins as well. It is not a mood, it is a volume.'],
  },
  {
    lines: ['Wake floods his own Gym floor. On purpose. On a timer.',
      'I fell in twice and he apologised at a hundred decibels both times.'],
  },
]);

export const LAKEFRONT_CENTER = southCenter('lakefront_center', { id: 'valor_lakefront', x: 5, y: 12 }, 'the Lakefront', [
  {
    when: { flag: 'lakeValor' },
    lines: ['Nobody has checked in since it happened. Not one booking.',
      'People do not come to look at where a lake used to be.'],
  },
  {
    when: { flag: 'galacticHQ' },
    lines: ['We are full of people who came to see the lake and cannot get to it.',
      'The road is closed. Nobody will say who closed it.'],
  },
  {
    lines: ['Resort hotel, this. People come for the water.',
      'Deepest lake in Sinnoh and you can see straight down thirty feet.'],
  },
]);
