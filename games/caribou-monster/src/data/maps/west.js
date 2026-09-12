// The west coast: the water road out of Jubilife, the port city built over a
// canal, and the island they dig iron out of.
//
// Canalave is where the story stops being a series of incidents and becomes
// one thing. The library on the east bank holds the oldest written copy of
// the Sinnoh myth, and it is where Looker finally has enough to say out loud
// what Team Galactic are actually doing — and, more to the point, what they
// have misunderstood about it.
import { defineMap } from './define.js';
import { makeMart } from './interiors.js';

// ---------------------------------------------------------------------------
// Route 218 — a channel with a sandbar either side. You cross it or you do
// not go to Canalave, which is why Surf is what opens the second half of the
// region rather than a badge.
// ---------------------------------------------------------------------------
export const ROUTE218 = defineMap('route218', {
  name: 'Route 218', kind: 'route', music: 'route',
  // The channel runs NORTH TO SOUTH, across the road, because the road runs
  // east to west.
  //
  // It used to lie ALONG the road: water through the middle, dry sand above
  // it, dry sand below it, and a path down both edges. A channel lying along
  // the way you are going cannot separate the near bank from the far one, so
  // Canalave, Byron and the revelation in the library were all reachable on
  // foot from the first morning with a level-five starter, and Surf — handed
  // over at Lake Valor — opened nothing at all.
  //
  // It now runs from the treeline in the north to the treeline in the south.
  // The only way across is Surf. Both banks keep their grass and their sand.
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T....................s~~~~sssT',
    'T..YYYY......YYYY....s~~~~sssT',
    'T..YYYY......YYYY....s~~~~sssT',
    'T....................s~~~~sssT',
    's....................s~~~~sss:',
    's....................s~~~~sss:',
    ':ss..................s~~~~sss:',
    ':ss..................s~~~~sss:',
    's....................s~~~~sss:',
    's....................s~~~~sss:',
    'T...................Ss~~~~sssT',
    'T...."""".....""""...s~~~~sssT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 29, y: 7, to: 'jubilife', tx: 1, ty: 7, dir: 'right', edge: true },
    { x: 29, y: 8, to: 'jubilife', tx: 1, ty: 8, dir: 'right', edge: true },
    { x: 0, y: 7, to: 'canalave', tx: 32, ty: 8, dir: 'left', edge: true },
    { x: 0, y: 8, to: 'canalave', tx: 32, ty: 8, dir: 'left', edge: true },
  ],
  signs: [
    { x: 20, y: 11, text: 'ROUTE 218\nJUBILIFE CITY — EAST\nCANALAVE CITY — WEST, across the water.\nThere is no bridge. There has never been a bridge.' },
  ],
  objects: [
    { id: 'r218_pearl', x: 4, y: 12, item: 'stardust', qty: 2 },
  ],
  npcs: [
    { id: 'r218_t1', x: 8, y: 2, look: 'sailor', trainer: 'r218_sailor', facing: 'down', sight: 4, movement: 'still' },
    { id: 'r218_t2', x: 18, y: 9, look: 'youngster', trainer: 'r218_fisher', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'r218_watcher', x: 12, y: 11, look: 'oldMan', name: 'Kesk', movement: 'lookAround', facing: 'right',
      dialogue: [
        {
          // The unsettling, arriving as a boring complaint about the weather.
          when: { flag: 'lakeValor' },
          lines: ['Water is wrong. I have crossed this channel twice a day for thirty years\nand it is wrong.',
            'Not rough. Not high. It does not sit right in the channel any more.',
            'You will think I am an old fool. My son thinks I am an old fool.'],
        },
        {
          lines: ['No bridge, before you ask. Canalave voted it down four times.',
            'They like being the far side of something. Always have.',
            'If you have got something that can carry you, you can go across yourself.'],
        },
      ],
    },
  ],
  // The far bank is the last ground before Byron, and it is only reachable
  // once Surf is in the bag, so nothing here can be met early. It used to top
  // out at 34 against a Leader who takes a team of 41 to beat — five levels
  // of grinding standing between the player and the last Gym. It reaches into
  // the high thirties now, which is what the road before a final Gym is for.
  encounters: {
    grass: {
      min: 33, max: 38,
      table: [[396, 22], [278, 20], [55, 16], [279, 14], [431, 14], [451, 14]],
      night: { min: 33, max: 38, table: [[198, 24], [279, 20], [55, 18], [431, 16], [92, 12], [278, 10]] },
    },
    surf: { min: 32, max: 39, table: [[279, 40], [278, 30], [130, 16], [129, 14]] },
    fish: { min: 30, max: 39, table: [[129, 32], [118, 24], [119, 18], [279, 14], [130, 12]] },
  },
});

// ---------------------------------------------------------------------------
// Canalave City — two banks and a canal, with a bridge at each end. The
// library is on the east bank and the Gym is on the west, which means the
// player crosses the water twice and looks at the ships both times.
// ---------------------------------------------------------------------------
export const CANALAVE = defineMap('canalave', {
  name: 'Canalave City', kind: 'town', music: 'city',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T...............~~...............T',
    'T..AAAAA........~~.....kkkkkkk...T',
    'T..AAAAA.....T..~~..T..kkkkkkk...T',
    'T..VVVVV........~~.....VVVVVVV...T',
    'T..#WDW#........~~.....#WWDWW#...T',
    'T....q..........~~........q......T',
    'T....qqqqqqqqqq.~~.qqqqqqq.......T',
    'T.T..q.........q==q.......q....T.q',
    'T....q..........~~........q......T',
    'T..NNNNNNN.....j~~j...AAAAAAA....T',
    'T..NQdNQNN.....j~~j...VVVVVVV....T',
    'T....q.........j~~j...#WWDWW#....T',
    'T....q.........j~~j.......q......T',
    'T....q...T.....j~~j.......q......T',
    'T.T..q.........j~~j.......q....T.T',
    'T....q...S.....j~~j..S....q......T',
    'T....q..........~~........q......T',
    'T....qqqqqqqqqq.==.qqqqqqq.......T',
    'T...............~~...............T',
    'T..ssssssssss...~~...ssssssssss..T',
    'T..ssssssssss...~~...ssssssssss..T',
    'T........T......~~........T......T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],

  warps: [
    { x: 33, y: 8, to: 'route218', tx: 1, ty: 8, dir: 'right', edge: true },
    { x: 5, y: 5, to: 'canalave_center', tx: 6, ty: 6, dir: 'up' },
    { x: 26, y: 5, to: 'canalave_library', tx: 8, ty: 10, dir: 'up' },
    { x: 5, y: 11, to: 'canalave_gym', tx: 7, ty: 14, dir: 'up' },
    { x: 25, y: 12, to: 'canalave_mart', tx: 5, ty: 5, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 5, text: 'POKéMON CENTER' },
    { x: 23, y: 4, w: 7, text: 'CANALAVE LIBRARY' },
    { x: 3, y: 10, w: 7, text: 'CANALAVE GYM', tone: '#f8e070' },
    { x: 22, y: 11, w: 7, text: 'MART' },
  ],
  signs: [
    { x: 9, y: 16, text: 'CANALAVE CITY\n"The port that reads."\nMore books than people, and they are proud of it.' },
    { x: 21, y: 16, text: 'CANALAVE GYM\nLEADER: Byron\nThe Rock-Solid Miner\nSteel-type. He has never once said a soft word\nabout his own son.' },
  ],
  objects: [],
  healPoint: { map: 'canalave_center', x: 6, y: 7 },
  npcs: [
    // The boat to Iron Island. He only sails once the Gym is done, because
    // the island is a working mine and Byron signs the passes.
    {
      id: 'cv_sailor', x: 8, y: 21, look: 'sailor', name: 'Eldon', movement: 'still', facing: 'down',
      script: 'ironBoat',
      dialogue: [{ lines: ['Eldon: Iron Island. Half an hour out, and rough for ten of it.'] }],
    },
    {
      id: 'cv_local', x: 20, y: 19, look: 'lass', name: 'Perrin', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { flag: 'canalaveTruth' },
          lines: ['You were in the library with the man in the coat, were you not.',
            'Whatever he read in there, he came out of it looking about ten years older.'],
        },
        {
          when: { flag: 'lakeValor' },
          lines: ['My uncle sails the Valor run. Sailed. There is nothing to sail on.',
            'He came home and sat in the kitchen for two days.',
            'You cannot tell a man his lake is gone. There is no way to say it.'],
        },
        {
          lines: ['Library is the oldest building in Sinnoh that is still a building.',
            'The oldest one that is not a building is up the mountain, obviously.'],
        },
      ],
    },
    {
      id: 'cv_reader', x: 27, y: 8, look: 'clerk', name: 'Ilsa', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'celestic' },
          lines: ['You have seen the Celestic mural. Then you should go inside.',
            'The mural is the picture. What is in here is the words that went with it.',
            'They do not say quite the same thing, and that has bothered me for years.'],
        },
        {
          lines: ['Everyone comes for the myth and leaves with the shipping records.',
            'The shipping records are better. Nobody believes me.'],
        },
      ],
    },
  ],
  encounters: {
    surf: { min: 20, max: 30, table: [[129, 40], [279, 30], [278, 20], [130, 10]] },
    fish: { min: 24, max: 36, table: [[129, 30], [118, 22], [119, 18], [130, 16], [279, 14]] },
  },
});

// ---------------------------------------------------------------------------
// Byron's Gym. Three galleries stacked with no stairs between them: the only
// way up is the lift plates, which is a mine, which is the joke.
// ---------------------------------------------------------------------------
export const CANALAVE_GYM = defineMap('canalave_gym', {
  name: 'Canalave Gym', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|+++++++++++w++|',
    '|++++++++++++++|',
    '|!!!!!!!!!!!!!!|',
    '|++++++++++++++|',
    '|+w+++++++++w++|',
    '|++++++++++++++|',
    '|!!!!!!!!!!!!!!|',
    '|++++++++++++++|',
    '|+w++++++++++++|',
    '|++++++++++++++|',
    '|++++++++++++++|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 15, to: 'canalave', tx: 5, ty: 12, dir: 'down' },
    { x: 8, y: 15, to: 'canalave', tx: 5, ty: 12, dir: 'down' },
    // The lifts. Each is one-way onto a plain plate, so a pad can never
    // bounce you straight back into itself.
    { x: 2, y: 12, to: 'canalave_gym', tx: 3, ty: 8, dir: 'up' },
    { x: 2, y: 8, to: 'canalave_gym', tx: 3, ty: 12, dir: 'down' },
    { x: 12, y: 8, to: 'canalave_gym', tx: 11, ty: 4, dir: 'up' },
    { x: 12, y: 4, to: 'canalave_gym', tx: 11, ty: 8, dir: 'down' },
  ],
  npcs: [
    {
      id: 'gym6_leader', x: 7, y: 2, look: 'hiker', trainer: 'gym6_leader',
      facing: 'down', sight: 0, movement: 'still', script: 'gymLeader',
      after: ['Byron: Come back when your steel has been in a fire. Mine has.'],
      dialogue: [
        {
          lines: ['Byron: You came up the plates.',
            'Byron: Most people stand at the bottom and wait for somebody\nto explain them to you.',
            'Byron: I dig. That is the whole of it.',
            'Byron: You put a bar in a seam and you lean on it until\nthe world gives.',
            'Byron: Steel is not hard because it started hard.',
            'Byron: Steel is hard because somebody made it that way,\non purpose, over a long time.',
            'Byron: Let us find out what you are made of.'],
        },
      ],
    },
    { id: 'gym6_t1', x: 4, y: 13, look: 'worker', trainer: 'gym6_a', facing: 'up', sight: 4, movement: 'still' },
    { id: 'gym6_t2', x: 8, y: 9, look: 'worker', trainer: 'gym6_b', facing: 'left', sight: 5, movement: 'still' },
    { id: 'gym6_t3', x: 5, y: 4, look: 'hiker', trainer: 'gym6_c', facing: 'right', sight: 4, movement: 'still' },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// The Canalave Library. The oldest words in Sinnoh, and the room where the
// whole plot finally gets said out loud.
// ---------------------------------------------------------------------------
export const CANALAVE_LIBRARY = defineMap('canalave_library', {
  name: 'Canalave Library', kind: 'indoor', music: 'lab', darkEdges: false,
  tiles: [
    '||||||||||||||||||',
    '|kkkkkk__kkkkkkkk|',
    '|________________|',
    '|kkkkkk__kkkkkkkk|',
    '|________________|',
    '|kkkkkk__kkkkkkkk|',
    '|________________|',
    '|__e__________e__|',
    '|________________|',
    '|_p____________p_|',
    '|________________|',
    '||||||||DD||||||||',
  ],
  warps: [
    { x: 8, y: 11, to: 'canalave', tx: 26, ty: 6, dir: 'down' },
    { x: 9, y: 11, to: 'canalave', tx: 26, ty: 6, dir: 'down' },
  ],
  // The three volumes. Standing at a shelf and reading is the interaction;
  // Looker's scene only unlocks once the player has all three, so the
  // revelation is assembled rather than delivered.
  events: [
    { x: 3, y: 2, flag: 'readVolume1', script: 'libraryBook', volume: 1 },
    { x: 12, y: 4, flag: 'readVolume2', script: 'libraryBook', volume: 2 },
    { x: 4, y: 6, flag: 'readVolume3', script: 'libraryBook', volume: 3 },
  ],
  signs: [],
  objects: [],
  npcs: [
    {
      id: 'lib_looker', x: 12, y: 7, look: 'clerk', name: 'Looker', movement: 'still',
      facing: 'left', script: 'lookerLibrary',
      dialogue: [{ lines: ['Looker: One moment. I am nearly at the end of a sentence I do not like.'] }],
    },
    {
      id: 'lib_keeper', x: 3, y: 9, look: 'oldWoman', name: 'Librarian', movement: 'still', facing: 'right',
      dialogue: [
        {
          when: { flag: 'canalaveTruth' },
          lines: ['You have read the three. Not many do. Most read the first and decide\nthey have got the shape of it.',
            'The shape of it is in the third one, and the third one is very short.'],
        },
        {
          when: { flag: 'celestic' },
          lines: ['Celestic has the picture. We have the words.',
            'Read all three volumes, in any order, then come back and\ntell me what you think it says.',
            'People always tell me. I never ask. They always tell me.'],
        },
        {
          lines: ['Quietly, please.',
            'Two of my regulars are asleep and one of them is a Bronzor.'],
        },
      ],
    },
  ],
  encounters: null,
});

export const CANALAVE_CENTER = defineMap('canalave_center', {
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
    { x: 6, y: 7, to: 'canalave', tx: 5, ty: 6, dir: 'down' },
    { x: 7, y: 7, to: 'canalave', tx: 5, ty: 6, dir: 'down' },
  ],
  npcs: [
    {
      id: 'canalave_center_nurse', x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: [
        { when: { linked: true }, lines: ['Welcome to Canalave. {partner} is on the link as well.', 'Shall I heal your team to full health?'] },
        { lines: ['Welcome to the Canalave Pokémon Center. Shall I heal your team to full health?'] },
      ],
    },
    {
      id: 'canalave_center_pc', x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [{ lines: ['The storage system behind me holds anything your party cannot.', 'Walk up to the terminal and press A.'] }],
    },
    {
      id: 'canalave_center_local', x: 9, y: 5, look: 'sailor', name: 'Trainer', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge6' },
          lines: ['You took the Mine Badge off Byron. He will be unbearable about it.',
            'Not to you. To his son. He is only ever unbearable to his son.'],
        },
        {
          lines: ['Byron digs. That is not a figure of speech, he is down the island\nthree days a week with a bar.'],
        },
      ],
    },
  ],
  encounters: null,
});

export const CANALAVE_MART = makeMart('canalave_mart', {
  town: 'canalave', backX: 25, backY: 13,
  extras: [{
    id: 'cm_shopper', x: 8, y: 4, look: 'sailor', name: 'Shopper',
    movement: 'still', facing: 'left',
    dialogue: [{
      when: { flag: 'lakeValor' },
      lines: ['Stock up before you go north. The road past Coronet is a bad road\nand it has got worse this month.'],
    }, {
      lines: ['Byron buys his own repels here like everybody else.',
        'Man runs a Gym and still queues.'],
    }],
  }],
});

// ---------------------------------------------------------------------------
// Iron Island. A working mine with a man in a hat standing in it, and the
// place the player learns to move something that will not move.
// ---------------------------------------------------------------------------
export const IRON_ISLAND = defineMap('iron_island', {
  subArea: true,
  name: 'Iron Island', kind: 'cave', music: 'cave',
  tiles: [
    'CCCCCCCCCCCCCCCCCCCCCCCC',
    'CccccccccccccccccccccccC',
    'CccCCCCCCCCCCCCCCCCCcccC',
    'CccCcccccccccccccccCcccC',
    'CccCcccCCCCCCCCCcccCcccC',
    'CccCcccCcccccccCcccCcccC',
    'CccCcccCcccrcccCcccCcccC',
    'CccCcccCcccccccCcccCcccC',
    'CccCcccCCCCCcccCcccCcccC',
    'CccCcccccccccccCcccCcccC',
    'CccCCCCCCCCCCCCCcccCcccC',
    'CcccccccccccccccccсCcccC'.replace('с', 'c'),
    'CCCCCCCCCCCCCCCCCCCCcccC',
    'CccccccccccccccccccccccC',
    'CCCCCCCCCCCCCCCCCCCCCCCC',
  ],
  warps: [
    { x: 1, y: 13, to: 'canalave', tx: 8, ty: 20, dir: 'down' },
  ],
  signs: [],
  objects: [
    { id: 'ii_hardstone', x: 11, y: 7, item: 'hardstone', qty: 1 },
    { id: 'ii_starpiece', x: 5, y: 6, item: 'starpiece', qty: 1 },
  ],
  npcs: [
    {
      id: 'ii_riley', x: 12, y: 9, look: 'boss', name: 'Riley', movement: 'still', facing: 'down',
      script: 'riley',
      dialogue: [{ lines: ['Riley: Give me a moment. The rock is telling me something.'] }],
    },
    { id: 'ii_t1', x: 6, y: 3, look: 'worker', trainer: 'ii_worker', facing: 'right', sight: 4, movement: 'still' },
    { id: 'ii_t2', x: 17, y: 5, look: 'hiker', trainer: 'ii_hiker', facing: 'down', sight: 4, movement: 'still' },
  ],
  encounters: {
    cave: {
      min: 30, max: 34,
      table: [[95, 20], [436, 20], [304, 16], [431, 12], [74, 12], [208, 6], [75, 14]],
    },
  },
});
