// The centre of Sinnoh: the mountain, and the city on the other side of it.
//
// Route 207 climbs east into Mt. Coronet, which is the spine of the region in
// every sense — Platinum's whole story eventually runs up it — and out the far
// side onto Route 208 and Hearthome City. Fantina's Gym is here, third rather
// than fifth, which is the change that makes Platinum a different game from
// Diamond and Pearl.
import { defineMap } from './define.js';

// ---------------------------------------------------------------------------
// Mt. Coronet, south. The first taste of the mountain; the climb comes later.
// ---------------------------------------------------------------------------
export const MT_CORONET_SOUTH = defineMap('mt_coronet', {
  name: 'Mt. Coronet', kind: 'cave', music: 'cave',
  tiles: [
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CccccccCCCCCCCCCCccccccccC',
    'CccccccccccCCCCCcccccccccC',
    'CCCCCCCcccccccccccCCCCcccC',
    'CccccCCCcccCCCCcccCCCCcccC',
    'Ccccccccccccccccccccccccc:',
    ':ccccccCCCCCCcccccCCCcccCC',
    'CcccCCCCCcccccccccCCCCcccC',
    'CcccccccccccrccccccccccccC',
    'CCCCCcccCCCCcCCCCccccCCCCC',
    'CccccccccCCCcCCCCccccccccC',
    'CccCCCCCCCCCCCCCCCCCCCCccC',
    'CccccccccccccccccccccccccC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCC',
  ],
  warps: [
    { x: 0, y: 6, to: 'route207', tx: 24, ty: 6, dir: 'left', edge: true },
    { x: 25, y: 5, to: 'route208', tx: 1, ty: 7, dir: 'right', edge: true },
  ],
  signs: [],
  objects: [
    { id: 'mc_escape', x: 2, y: 12, item: 'escaperope', qty: 2 },
    // Behind the cracked rock: the reward for coming back with Roark's badge.
    { id: 'mc_star', x: 12, y: 10, item: 'starpiece', qty: 1 },
  ],
  npcs: [
    { id: 'mc_t1', x: 8, y: 2, look: 'hiker', trainer: 'mc_hiker', facing: 'down', sight: 3, movement: 'still' },
    {
      id: 'mc_watcher', x: 20, y: 12, look: 'scientist', name: 'Ivo', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { flag: 'knowsTwist' },
          lines: ['This mountain runs the whole length of Sinnoh.',
            'Everything the old stories say about time and space, they say about here.',
            'And there are people in grey coats halfway up it. I do not like the arithmetic.'],
        },
        {
          lines: ['Mt. Coronet is the backbone of the region.',
            'You are in the very bottom of it. It goes up a long way.',
            'One day somebody will want the top of it. I hope I have retired.'],
        },
      ],
    },
  ],
  encounters: {
    cave: {
      min: 14, max: 18,
      table: [[74, 26], [436, 22], [95, 14], [63, 12], [433, 12], [35, 8], [442, 6]],
      night: { min: 14, max: 18, table: [[41, 26], [436, 20], [92, 16], [63, 14], [200, 12], [442, 12]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Route 208 — down out of the mountain into the lowlands.
// ---------------------------------------------------------------------------
export const ROUTE208 = defineMap('route208', {
  name: 'Route 208', kind: 'route', music: 'route',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T..............................T',
    'T....""""........RR............T',
    'T....""""......................T',
    'T..........TTT.......""""......T',
    'T.........TTTTT......""""......T',
    'T..........TTT.................T',
    '::::::::::::::::f::::::::::::::.',
    'T..............................T',
    'T....RR......LLLLLL........""""T',
    'T........................""""..T',
    'T....""""......................T',
    'T....""""...TTT................T',
    'T..........TTTTT.....OOO.....S.T',
    'T...........TTT................T',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 0, y: 7, to: 'mt_coronet', tx: 24, ty: 5, dir: 'left', edge: true },
    { x: 31, y: 7, to: 'hearthome', tx: 1, ty: 12, dir: 'right', edge: true },
  ],
  signs: [
    { x: 29, y: 13, text: 'ROUTE 208\nMT. CORONET — WEST\nHEARTHOME CITY — EAST\nThe berries here belong to nobody.' },
  ],
  objects: [
    { id: 'r8_ether', x: 2, y: 10, item: 'ether', qty: 2 },
    { id: 'r8_ball', x: 28, y: 2, item: 'ultraball', qty: 1 },
  ],
  npcs: [
    { id: 'r8_t1', x: 9, y: 3, look: 'lass', trainer: 'r8_lass', facing: 'down', sight: 4, movement: 'still' },
    { id: 'r8_t2', x: 22, y: 11, look: 'youngster', trainer: 'r8_youngster', facing: 'up', sight: 4, movement: 'still' },
    {
      id: 'r8_gardener', x: 20, y: 12, look: 'mom', name: 'Wilda', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'gotBerries' },
          lines: ['You keep berries. I can always tell.',
            'The soil along this road is the best in Sinnoh and nobody works it.',
            'Put something in. Whoever finds it next will think of you.'],
        },
        {
          lines: ['Hearthome is east. Big place. Too big, if you ask me.',
            'They have a Contest Hall and a park where Pokémon walk beside you.',
            'And a Gym that half the trainers who go in come straight back out of.'],
        },
      ],
    },
  ],
  encounters: {
    grass: {
      min: 14, max: 18,
      table: [[406, 20], [63, 18], [396, 16], [415, 14], [403, 12], [265, 12], [455, 8]],
      night: { min: 14, max: 18, table: [[92, 24], [163, 20], [41, 18], [200, 16], [434, 12], [63, 10]] },
    },
  },
});

// ---------------------------------------------------------------------------
// Hearthome City — the biggest place in the region, and the one that is not
// about badges. The Contest Hall, Amity Square, and a Gym full of ghosts.
// ---------------------------------------------------------------------------
export const HEARTHOME = defineMap('hearthome', {
  name: 'Hearthome City', kind: 'town', music: 'city',
  tiles: [
    'TTTTTTTTTTTTqqTTTTTTTTTTTTTTTTTTTT',
    'T................................T',
    'T..AAAAAAAA..........BBBBBBBB....T',
    'T..AAAAAAAA..........BBBBBBBB.T..T',
    'T..VVVVVVVV..........VVVVVVVV....T',
    'T..#WFFDFFW..........#WJJDJJW....T',
    'T.....q....................q.....T',
    'T.....qqqqqqqqqqqqqqqqqqqqqq.....T',
    'T.T...q....................q.....T',
    'T..S..q.T.GGGGGGGG.........q...T.T',
    'T.....q...GGGGGGGG.........q.....T',
    'T.....q...VVVVVVVV.........q.....T',
    'qqqqqqqqqq#WWDDWW#.........q.....T',
    'T.....q.T.............T....q.....T',
    'T.T...q...KKKKKKKKKK.......q.....T',
    'T.....q...KKKKKKKKKK.......q.T...T',
    'T.....q.T.KKKKKKKKKK....T..q.....T',
    'T.....q...VVVVVVVVVV.......q.....T',
    'T.T...q...NQNNddNNQN.......q.....T',
    'T.....q...I.S....S.I.......q.....T',
    'T.....qqqqqqqqqqqqqqqqqqqqq....T.T',
    'T...........lq...................T',
    'T.EEEEEEEE..qq.tq9q9qt(**(...S...T',
    'T.EEEEEEEE..qq.qqq0qqq(**(.......T',
    'T.VVVVVVVV..lq.qqqqqqq...........T',
    'T.#WWDDWW#..qq.qyqqqyq...........T',
    'T...........qq................T..T',
    'TTTTTTTTTTTTqqTTTTTTTTTTTTTTTTTTTT',
  ],

  warps: [
    { x: 0, y: 12, to: 'route208', tx: 30, ty: 7, dir: 'left', edge: true },
    { x: 12, y: 0, to: 'route209', tx: 12, ty: 21, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'route209', tx: 13, ty: 21, dir: 'up', edge: true },
    { x: 12, y: 27, to: 'route212', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 27, to: 'route212', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 7, y: 5, to: 'hearthome_center', tx: 6, ty: 6, dir: 'up' },
    { x: 25, y: 5, to: 'hearthome_mart', tx: 4, ty: 5, dir: 'up' },
    { x: 13, y: 12, to: 'contest_hall', tx: 7, ty: 9, dir: 'up' },
    { x: 14, y: 12, to: 'contest_hall', tx: 8, ty: 9, dir: 'up' },
    { x: 14, y: 18, to: 'hearthome_gym', tx: 7, ty: 14, dir: 'up' },
    { x: 15, y: 18, to: 'hearthome_gym', tx: 8, ty: 14, dir: 'up' },
    { x: 5, y: 25, to: 'amity_square', tx: 9, ty: 13, dir: 'up' },
    { x: 6, y: 25, to: 'amity_square', tx: 10, ty: 13, dir: 'up' },
  ],
  labels: [
    { x: 3, y: 4, w: 8, text: 'POKéMON CENTER' },
    { x: 21, y: 4, w: 8, text: 'POKéMON MART' },
    { x: 10, y: 11, w: 8, text: 'CONTEST HALL' },
    { x: 10, y: 17, w: 10, text: 'HEARTHOME GYM', tone: '#f8e070' },
    { x: 9, y: 24, w: 8, text: 'AMITY SQUARE' },
  ],
  signs: [
    { x: 3, y: 9, text: 'HEARTHOME CITY\n"Warmest place in Sinnoh, and it is not\nthe weather."' },
    { x: 12, y: 19, text: 'HEARTHOME CITY POKéMON GYM\nLEADER: Fantina\nThe Lady of Lanterns\nGhost-type. Nothing here stays where\nyou left it.' },
    { x: 17, y: 19, text: 'The Gym floor is laid out to confuse.\nSo is the Leader. Neither is an accident.' },
    { x: 29, y: 22, text: 'AMITY SQUARE — SOUTH\nWalk with a Pokémon that likes you.\nThe gate knows which ones do.' },
  ],
  objects: [],
  healPoint: { map: 'hearthome_center', x: 6, y: 7 },
  npcs: [
    {
      id: 'hh_guide', x: 17, y: 20, look: 'youngster', name: 'Gym Guide', movement: 'still', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge3' },
          lines: ['The Relic Badge! Fantina does not lose often.',
            'North out of the city is Route 209 and the Lost Tower.',
            'Then Solaceon, then Veilstone. That is where the coats have gone.'],
        },
        {
          lines: ['This is the HEARTHOME GYM. Fantina is Ghost-type, top to bottom.',
            'Ghosts do not answer to Normal or Fighting moves at all. Nothing happens.',
            'Dark and Ghost moves are what get through. Bring one or bring patience.',
            'And the floor moves you about. Do not fight it — read it.'],
        },
      ],
    },
    {
      id: 'hh_contest', x: 9, y: 13, look: 'lass', name: 'Rue', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you! You should enter a Contest as a pair.',
            'It is not about who wins. That is the whole point of it.',
            'Everyone says that, and almost nobody means it. I mean it.'],
        },
        {
          lines: ['The Contest Hall is for the other kind of trainer.',
            'No badges. No rankings. Just whether your Pokémon looks happy.',
            'People sneer at it right up until they try it.'],
        },
      ],
    },
    {
      id: 'hh_local', x: 24, y: 21, look: 'oldMan', name: 'Perrin', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { flag: 'knowsTwist' },
          lines: ['There were grey coats through here a fortnight ago. Six of them.',
            'They went north, towards Solaceon. Nobody stopped them.',
            'Nobody ever stops six people walking in a line. That is the trick of it.'],
        },
        {
          when: { linked: true },
          lines: ['The two of you came over Coronet together, did you?',
            'My wife and I did that road in ’71. Snowed the whole way.',
            'Fifty years on I still could not tell you why that was a good week.'],
        },
        {
          lines: ['Hearthome grew up where the roads meet, so everybody passes through.',
            'Half the region has stood where you are standing.',
            'Most of them were looking for the Gym. It is the one with the lanterns.'],
        },
      ],
    },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// The Gym. Fantina's floor is laid out to turn you around: a lantern-lit
// maze where the warp pads move you, which is the closest this engine gets to
// a Ghost-type joke.
// ---------------------------------------------------------------------------
export const HEARTHOME_GYM = defineMap('hearthome_gym', {
  name: 'Hearthome Gym', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|gggggggggggggg|',
    '|gg!!!!gg!!!!gg|',
    '|gggggggggggggg|',
    '|!!gg!!!!!!gg!!|',
    '|ggggggwwgggggg|',
    '|!!!!gg!!gg!!!!|',
    '|gggggggggggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|!!gg!!gggg!!gg|',
    '|ggggggggwwgggg|',
    '|gg!!!!gg!!!!gg|',
    '|gggggggggggggg|',
    '|gggg!!gggg!!gg|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 15, to: 'hearthome', tx: 14, ty: 19, dir: 'down' },
    { x: 8, y: 15, to: 'hearthome', tx: 15, ty: 19, dir: 'down' },
    // The lanterns. Stepping on one puts you on the other, which is how a
    // Ghost-type Gym argues with you about where you thought you were going.
    { x: 7, y: 5, to: 'hearthome_gym', tx: 2, ty: 3, dir: 'down' },
    { x: 8, y: 5, to: 'hearthome_gym', tx: 3, ty: 3, dir: 'down' },
    { x: 9, y: 11, to: 'hearthome_gym', tx: 13, ty: 12, dir: 'up' },
    { x: 10, y: 11, to: 'hearthome_gym', tx: 14, ty: 12, dir: 'up' },
  ],
  npcs: [
    {
      id: 'gym3_leader', x: 7, y: 1, look: 'lass', trainer: 'gym3_leader',
      facing: 'down', sight: 0, movement: 'still', script: 'gymLeader',
      after: ['Come back when you have been further. I will have thought of something new.'],
      dialogue: [
        {
          lines: ['I am Fantina. Everything in this room is a Ghost, and so, on a good day, am I.',
            'You will have noticed the floor does not agree with you about where you are.',
            'That is not a trick. That is simply what my Pokémon are like.',
            'Take the RELIC BADGE off me, if you can find me twice.'],
        },
      ],
    },
    { id: 'gym3_t1', x: 3, y: 7, look: 'lass', trainer: 'gym3_a', facing: 'right', sight: 4, movement: 'still' },
    { id: 'gym3_t2', x: 12, y: 9, look: 'youngster', trainer: 'gym3_b', facing: 'left', sight: 4, movement: 'still' },
    { id: 'gym3_t3', x: 4, y: 13, look: 'bugCatcher', trainer: 'gym3_c', facing: 'up', sight: 3, movement: 'still' },
  ],
  encounters: null,
});

// ---------------------------------------------------------------------------
// Hearthome's interiors.
// ---------------------------------------------------------------------------
export const HEARTHOME_CENTER = defineMap('hearthome_center', {
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
    { x: 6, y: 7, to: 'hearthome', tx: 7, ty: 6, dir: 'down' },
    { x: 7, y: 7, to: 'hearthome', tx: 7, ty: 6, dir: 'down' },
  ],
  npcs: [
    {
      id: 'hc_nurse', x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: [
        {
          when: { linked: true },
          lines: ['Welcome to Hearthome. {partner} is on the link network as well.',
            'Shall I heal your team to full health?'],
        },
        { lines: ['Welcome to the Hearthome Pokémon Center. Shall I heal your team to full health?'] },
      ],
    },
    {
      id: 'hc_pc', x: 10, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [{ lines: ['The storage system behind me holds anything your party cannot.',
        'Walk up to the terminal and press A.'] }],
    },
    {
      id: 'hc_beaten', x: 9, y: 5, look: 'youngster', name: 'Trainer', movement: 'wander', facing: 'down',
      dialogue: [
        {
          when: { flag: 'badge3' },
          lines: ['You got the Relic Badge? Off Fantina? Actually off her?',
            'I have been in there four times. Four.'],
        },
        {
          lines: ['Normal moves do nothing to a Ghost. Nothing at all. The move just... stops.',
            'I found that out with my whole team in there. Twice.'],
        },
      ],
    },
  ],
  encounters: null,
});

export const HEARTHOME_MART = defineMap('hearthome_mart', {
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
    { x: 4, y: 6, to: 'hearthome', tx: 25, ty: 6, dir: 'down' },
    { x: 5, y: 6, to: 'hearthome', tx: 25, ty: 6, dir: 'down' },
  ],
  npcs: [
    {
      id: 'hm_clerk', x: 3, y: 1, look: 'clerk', name: 'Clerk', movement: 'still', facing: 'down',
      script: 'shop', overCounter: true,
      dialogue: [{ lines: ['Welcome! What can I get you?'] }],
    },
    {
      id: 'hm_shopper', x: 7, y: 4, look: 'lass', name: 'Shopper', movement: 'still', facing: 'left',
      dialogue: [{ lines: ['Buy the Super Potions before the Gym, not after.',
        'Everyone learns that in the wrong order.'] }],
    },
  ],
  encounters: null,
});

/**
 * The Contest Hall. There are no badges in here and nothing to win that the
 * ranking cares about, which is exactly why it is worth having in a game two
 * people play together.
 */
export const CONTEST_HALL = defineMap('contest_hall', {
  name: 'Contest Hall', kind: 'indoor', music: 'center', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|%%%%%%%%%%%%%%|',
    '|%%_________%%%|',
    '|%%_xxxxxx__%%%|',
    '|%%_________%%%|',
    '|%%%%%%%%%%%%%%|',
    '|_p__________p_|',
    '|______________|',
    '|______________|',
    '|______________|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 10, to: 'hearthome', tx: 13, ty: 13, dir: 'down' },
    { x: 8, y: 10, to: 'hearthome', tx: 13, ty: 13, dir: 'down' },
  ],
  npcs: [
    {
      id: 'ch_host', x: 6, y: 2, look: 'lass', name: 'Compere', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two of you, together? Oh, the hall likes a pair.',
            'We judge on how a Pokémon carries itself. Nothing else.',
            'Bring the ones that have walked the furthest with you. It shows.'],
        },
        {
          lines: ['Welcome to the Contest Hall!',
            'No badges here. No ratings. We judge how a Pokémon carries itself.',
            'A Pokémon that likes the person holding its ball carries itself very well.'],
        },
      ],
    },
    {
      id: 'ch_regular', x: 11, y: 8, look: 'mom', name: 'Odile', movement: 'wander', facing: 'down',
      dialogue: [
        { lines: ['I have never earned a badge in my life.',
          'I have four ribbons and a Roselia that thinks she is famous.',
          'I would not swap.'] },
      ],
    },
  ],
  encounters: null,
});

/**
 * Amity Square. A park you may only enter with a Pokémon that actually likes
 * you — which the game already tracks, so the gate is a real one.
 */
export const AMITY_SQUARE = defineMap('amity_square', {
  subArea: true,
  name: 'Amity Square', kind: 'route', music: 'town',
  tiles: [
    'TTTTTTTTTTTTTTTTTTTT',
    'T..****....****....T',
    'T..****....****....T',
    'T..................T',
    'T....TTT....TTT....T',
    'T...TTTTT..TTTTT...T',
    'T....TTT....TTT....T',
    'T..................T',
    'T..**..........**..T',
    'T..**..........**..T',
    'T..................T',
    'T....OOO....OOO....T',
    'T..................T',
    'T........::........T',
    'TTTTTTTTT::TTTTTTTTT',
  ],
  warps: [
    { x: 9, y: 14, to: 'hearthome', tx: 5, ty: 26, dir: 'down' },
    { x: 10, y: 14, to: 'hearthome', tx: 6, ty: 26, dir: 'down' },
  ],
  signs: [
    { x: 3, y: 14, text: 'AMITY SQUARE\nWalk here with a Pokémon that is fond of\nyou. It will find things you would not.' },
  ],
  objects: [],
  npcs: [
    {
      id: 'as_keeper', x: 14, y: 12, look: 'oldMan', name: 'Groundsman', movement: 'still', facing: 'left',
      dialogue: [
        {
          when: { linked: true },
          lines: ['Two trainers and their Pokémon out walking. That is the whole idea of this place.',
            'People think a park with no trainers in it is a park with nothing in it.',
            'Those people are always in a hurry and never notice anything.'],
        },
        {
          lines: ['Nothing to battle in here. That is deliberate.',
            'Let the one walking behind you go where it wants for a bit.',
            'They bring things back. Berries, mostly. Sometimes better.'],
        },
      ],
    },
  ],
  encounters: null,
});
