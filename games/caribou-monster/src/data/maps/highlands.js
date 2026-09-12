// The highlands: the fog road north of Solaceon, the oldest town in Sinnoh,
// and the shrine the whole myth is written on.
//
// Celestic is where the story stops being about a company doing something
// suspicious and starts being about what they think they are doing. The
// mural on the shrine wall says it in pictures a thousand years older than
// anybody who has ever worn a grey coat.
import { defineMap } from './define.js';

// ---------------------------------------------------------------------------
// Route 210 north — the permanent fog, and the Psyduck sitting in it.
//
// The road narrows to two tiles between the pines. That neck is the gate:
// a line of Psyduck with headaches sits in it and will not be reasoned with
// until somebody turns up holding the one thing that helps.
// ---------------------------------------------------------------------------
export const ROUTE210_NORTH = defineMap('route210_north', {
  name: 'Route 210', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'TYYYYYYYYYYY::YYYYYYYYYYYT',
    'TYYYYYYYYYYY::YYYYYYYYYYYT',
    'T...........::...........T',
    'T..RR.......::.......RR..T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T...........::...........T',
    'T..YYYY.....::.....YYYY..T',
    'T..YYYY.....::.....YYYY..T',
    'T...........::...........T',
    'T....OOO....::...........T',
    'T...........::...........T',
    'T.........S.::...........T',
    'T...........::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 19, to: 'route210', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 19, to: 'route210', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'celestic', tx: 12, ty: 20, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'celestic', tx: 13, ty: 20, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 17, text: 'ROUTE 210 — NORTH\nCELESTIC TOWN, through the fog.\nThe road narrows. Mind what is sitting in it.' },
  ],
  objects: [
    { id: 'r10n_ether', x: 7, y: 16, item: 'ether', qty: 1 },
    { id: 'r10n_fullheal', x: 21, y: 11, item: 'fullheal', qty: 2 },
  ],
  npcs: [
    // The neck. Four of them, filling both lanes, going nowhere.
    {
      id: 'psy1', species: 54, x: 12, y: 6, name: 'Psyduck', movement: 'still', facing: 'down',
      script: 'psyducks', goneWhen: 'psyducks',
      dialogue: [{ lines: ['Psyduck: ...Psy. Psy-yi-yi.'] }],
    },
    { id: 'psy2', species: 54, x: 13, y: 6, name: 'Psyduck', movement: 'still', facing: 'down', goneWhen: 'psyducks',
      dialogue: [{ lines: ['Psyduck: Psy... psy... *It has both hands on its head.*'] }] },
    { id: 'psy3', species: 54, x: 11, y: 7, name: 'Psyduck', movement: 'still', facing: 'down', goneWhen: 'psyducks',
      dialogue: [{ lines: ['Psyduck: *It does not appear to have noticed you at all.*'] }] },
    { id: 'psy4', species: 54, x: 14, y: 7, name: 'Psyduck', movement: 'still', facing: 'down', goneWhen: 'psyducks',
      dialogue: [{ lines: ['Psyduck: PSY. *Everything nearby flinches.*'] }] },
    { id: 'r10n_t1', x: 8, y: 10, look: 'hiker', trainer: 'r10n_hiker', facing: 'right', sight: 4, movement: 'still' },
    { id: 'r10n_t2', x: 18, y: 13, look: 'lass', trainer: 'r10n_lass', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'r10n_warden', x: 9, y: 8, look: 'oldMan', name: 'Ferrin', movement: 'lookAround', facing: 'right',
      dialogue: [
        {
          when: { flag: 'psyducks' },
          lines: ['You got them moving. I have been trying that for eleven days.',
            'Celestic is up there. Small place. Older than everywhere else put together.'],
        },
        {
          when: { flag: 'lakeValor' },
          lines: ['You have been down at Valor. It is on your boots and it is on your face.',
            'The Psyduck started their headaches the same morning the lake went.',
            'Something big woke up and every psychic thing in Sinnoh felt it.'],
        },
        {
          lines: ['Road is shut. Not by anybody — by ducks.',
            'Four of them, all with headaches, all in the narrow bit.',
            'There is a medicine for it. Celestic has it, and Celestic is the other side.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 26, max: 30,
      table: [[55, 22], [431, 18], [307, 16], [114, 14], [441, 12], [66, 10], [396, 8]],
      night: { min: 26, max: 30, table: [[55, 24], [198, 20], [431, 16], [92, 14], [441, 14], [396, 12]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Celestic Town — a bowl in the highlands with a shrine cut into the back of
// it. Two houses, a Centre, and a thousand-year-old wall.
// ---------------------------------------------------------------------------
export const CELESTIC = defineMap('celestic', {
  name: 'Celestic Town', kind: 'town', music: 'city',
  tiles: [
    '^^^^^^^^^^^^^^^^^^^^^^^^^^',
    '^^^^^^^^^^^IIII^^^^^^^^^^^',
    '^^^^^^^^^^^IDDI^^^^^^^^^^^',
    '^.........I.zz.I.........^',
    '^..AAAAA....zz....AAAAA..^',
    '^..AAAAA....zz....AAAAA..^',
    '^..VVVVV....zz....VVVVV..^',
    '^..#WDW#....zz....#WDW#..^',
    '^....z......zz......z....^',
    '^....zzzzzzzzzzzzzzzz....^',
    '^.R.........zz.........R.^',
    '^.S.........zz.........S.^',
    'zzzzzzzzzzzzzz...........^',
    '^....R......zz......R....^',
    '^..,,,,.....zz.....,,,,..^',
    '^..,,,,.....zz.....,,,,..^',
    '^.o...o.....zz.....o...o.^',
    '^..~~~~~....zz....~~~~~..^',
    '^..~~~~~....zz....~~~~~..^',
    '^.......R...zz...........^',
    '^..R......S.zz........R..^',
    '^^^^^^^^^^^^zz^^^^^^^^^^^^',
  ],

  warps: [
    { x: 12, y: 21, to: 'route210_north', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 21, to: 'route210_north', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 0, y: 12, to: 'route211', tx: 24, ty: 8, dir: 'left', edge: true },
    { x: 12, y: 2, to: 'celestic_ruins', tx: 7, ty: 10, dir: 'up' },
    { x: 13, y: 2, to: 'celestic_ruins', tx: 8, ty: 10, dir: 'up' },
    { x: 5, y: 7, to: 'celestic_center', tx: 6, ty: 6, dir: 'up' },
    { x: 20, y: 7, to: 'celestic_house', tx: 5, ty: 5, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 6, w: 5, text: 'POKéMON CENTER' },
    { x: 18, y: 6, w: 5, text: 'ELDER' },
  ],
  signs: [
    { x: 2, y: 11, text: 'CELESTIC TOWN\n"Where the myth was written down first."\nPopulation: fewer than the mural has figures.' },
    { x: 23, y: 11, text: 'The shrine is not a tourist attraction.\nThe elder decides who goes in. She has\nnever once said no, but she decides.' },
    { x: 10, y: 20, text: 'ROUTE 210 — SOUTH, through the fog.\nROUTE 211 — WEST, toward the mountain.' },
  ],
  objects: [
    { id: 'cel_stone', x: 4, y: 19, item: 'oddkeystone', qty: 1 },
  ],
  healPoint: { map: 'celestic_center', x: 6, y: 7 },
  npcs: [
    // Two grey coats stood in the shrine doorway, which is how the town found
    // out that Team Galactic read history books.
    {
      id: 'cel_grunt1', x: 12, y: 3, look: 'grunt', name: 'Galactic Grunt', movement: 'still', facing: 'down',
      trainer: 'celestic_grunt1', script: 'celesticGrunt', goneWhen: 'celestic',
      dialogue: [{ lines: ['Grunt: The wall in there is a schematic. Nobody in this town knows that.'] }],
    },
    {
      id: 'cel_grunt2', x: 13, y: 3, look: 'gruntF', name: 'Galactic Grunt', movement: 'still', facing: 'down',
      goneWhen: 'celestic',
      dialogue: [{ lines: ['Grunt: We are not stealing anything. We are reading.', 'Grunt: You cannot arrest somebody for reading.'] }],
    },
    {
      id: 'cel_local', x: 8, y: 13, look: 'oldWoman', name: 'Nell', movement: 'lookAround', facing: 'right',
      dialogue: [
        {
          when: { flag: 'celestic' },
          lines: ['You moved them on. Nobody here could have.',
            'The elder wants you. She has wanted somebody for about forty years.'],
        },
        {
          lines: ['Two of them in grey have been stood at the shrine since Tuesday.',
            'Not doing anything. Just looking at the wall and writing.',
            'That is worse, somehow. I would rather they smashed it.'],
        },
      ],
    },
    {
      id: 'cel_kid', x: 17, y: 19, look: 'youngster', name: 'Pell', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you! Nobody comes here. Nobody ever comes here.',
            'Are you together-together? Nell says you can tell by the walking.'],
        },
        {
          lines: ['My gran says the mural is a map. My dad says it is a warning.',
            'They have been arguing about it my whole life and neither will go and look.'],
        },
      ],
    },
  ],
  encounters: {
    fish: { min: 20, max: 30, table: [[129, 34], [54, 26], [55, 16], [118, 14], [55, 10]] },
  },
});

// ---------------------------------------------------------------------------
// The shrine. One room, one wall, and everything the campaign is about.
// ---------------------------------------------------------------------------
export const CELESTIC_RUINS = defineMap('celestic_ruins', {
  subArea: true,
  name: 'Celestic Shrine', kind: 'cave', music: 'cave', darkEdges: false,
  tiles: [
    'CCCCCCCCCCCCCCCC',
    'CccccccccccccccC',
    'Cc!cccccccccc!cC',
    'CccccIIIIIIccccC',
    'CccccI;;;;IccccC',
    'CccccI;SS;IccccC',
    'CccccI;II;IccccC',
    'CccccI;;;;IccccC',
    'CccccII;;IIccccC',
    'CccccccccccccccC',
    'CCCCCCCccCCCCCCC',
    'CCCCCCCccCCCCCCC',
  ],
  warps: [
    { x: 7, y: 11, to: 'celestic', tx: 12, ty: 3, dir: 'down' },
    { x: 8, y: 11, to: 'celestic', tx: 13, ty: 3, dir: 'down' },
  ],
  signs: [
    {
      x: 7, y: 5,
      text: 'THE MURAL — LEFT HALF\nThree small figures at three waters. Above\nthem a fourth, larger, with no face drawn.',
    },
    {
      x: 8, y: 5,
      text: 'THE MURAL — RIGHT HALF\nThe same four, and the world behind them\nrolled up like a sheet being taken off a bed.',
    },
  ],
  objects: [],
  npcs: [
    {
      id: 'cel_elder', x: 6, y: 4, look: 'oldWoman', name: 'Elder Carolina', movement: 'still', facing: 'right',
      script: 'celesticElder',
      dialogue: [{ lines: ['Elder: Stand where you are and look at it properly first.'] }],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Route 211 — Celestic west, toward the far side of Mt. Coronet.
// ---------------------------------------------------------------------------
export const ROUTE211 = defineMap('route211', {
  name: 'Route 211', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T........................T',
    'T..YYYY..........YYYY....T',
    'T..YYYY..........YYYY....T',
    'T........................T',
    'T....""""......""""......T',
    'T....""""......""""......T',
    'T........................T',
    'T:::::::::::::::::::::::::',
    'T........................T',
    'T..RR............RR......T',
    'T........................T',
    'T....""""......""""......T',
    'T....""""......""""......T',
    'T.........S..............T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 25, y: 8, to: 'celestic', tx: 1, ty: 12, dir: 'right', edge: true },
  ],
  signs: [
    { x: 10, y: 14, text: 'ROUTE 211\nCELESTIC TOWN — EAST.\nThe mountain door is west, and it is shut\nfrom the inside.' },
  ],
  objects: [
    { id: 'r11_ether', x: 4, y: 1, item: 'ether', qty: 1 },
  ],
  npcs: [
    { id: 'r11_t1', x: 7, y: 5, look: 'hiker', trainer: 'r11_hiker', facing: 'down', sight: 4, movement: 'still' },
    { id: 'r11_t2', x: 17, y: 12, look: 'youngster', trainer: 'r11_youngster', facing: 'up', sight: 4, movement: 'still' },
    {
      id: 'r11_watcher', x: 4, y: 9, look: 'clerk', name: 'Ines', movement: 'lookAround', facing: 'left',
      dialogue: [
        {
          when: { flag: 'celestic' },
          lines: ['The elder let you look at the wall. She does not do that often.',
            'West is the mountain\'s other door. It has been bolted since I was small.',
            'It will not be bolted much longer. They have been carrying things in for a month.'],
        },
        {
          lines: ['I walk up to the mountain door and back, twice a day, for the exercise.',
            'Lately there are lorries doing the same walk, and they are not doing it for the exercise.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 27, max: 31,
      table: [[74, 20], [95, 18], [307, 16], [67, 14], [441, 12], [436, 12], [111, 8]],
      night: { min: 27, max: 31, table: [[74, 22], [95, 20], [41, 18], [198, 14], [441, 14], [436, 12]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Interiors.
// ---------------------------------------------------------------------------
export const CELESTIC_CENTER = defineMap('celestic_center', {
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
    { x: 6, y: 7, to: 'celestic', tx: 5, ty: 8, dir: 'down' },
    { x: 7, y: 7, to: 'celestic', tx: 5, ty: 8, dir: 'down' },
  ],
  npcs: [
    {
      id: 'celestic_center_nurse', x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: [
        { when: { linked: true }, lines: ['Welcome to Celestic. {partner} is on the link as well.', 'Shall I heal your team to full health?'] },
        { lines: ['Welcome to the Celestic Pokémon Center. Shall I heal your team to full health?'] },
      ],
    },
    {
      id: 'celestic_center_pc', x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [{ lines: ['The storage system behind me holds anything your party cannot.', 'Walk up to the terminal and press A.'] }],
    },
    {
      id: 'celestic_center_local', x: 9, y: 5, look: 'hiker', name: 'Trainer', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { flag: 'celestic' },
          lines: ['Word went round the town in about four minutes.',
            'Somebody finally stood in front of the shrine instead of writing about it.'],
        },
        {
          lines: ['Four houses and a shrine. That is the whole town.',
            'People act like that means nothing happens here. Something happened here first.'],
        },
      ],
    },
  ],
  encounters: null,
});

export const CELESTIC_HOUSE = defineMap('celestic_house', {
  name: "Elder's House", kind: 'indoor', music: 'town', darkEdges: false,
  tiles: [
    '||||||||||',
    '|_k_e__b_|',
    '|_k______|',
    '|________|',
    '|_p____p_|',
    '|________|',
    '||||DD||||',
  ],
  warps: [
    { x: 4, y: 6, to: 'celestic', tx: 20, ty: 8, dir: 'down' },
    { x: 5, y: 6, to: 'celestic', tx: 20, ty: 8, dir: 'down' },
  ],
  npcs: [
    {
      id: 'cel_house_keeper', x: 7, y: 3, look: 'oldWoman', name: 'Rell', movement: 'lookAround', facing: 'left',
      dialogue: [
        {
          when: { flag: 'celestic' },
          lines: ['She went straight back up to the shrine, of course she did.',
            'Ninety-one years old and she takes that path like it owes her money.'],
        },
        {
          lines: ['The elder is not in. The elder is never in.',
            'She is at the shrine, standing in front of two people in grey coats,',
            'and she has been there since Tuesday, and she will not move first.'],
        },
      ],
    },
  ],
  encounters: null,
});
