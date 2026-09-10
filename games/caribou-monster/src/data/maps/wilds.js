import { defineMap } from './define.js';

export const ROUTE202 = defineMap('route202', {
  name: 'Route 202', kind: 'route', music: 'forest',
  tiles: [
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
    'T...........::...........T',
    'T..YY.......::.......YY..T',
    'T..YY.......::.......YY..T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T..YYYY.....::.....YYYY..T',
    'T..YYYY.....::.....YYYY..T',
    'T...........::...........T',
    'T:::::::::::::...........T',
    'T...........::...........T',
    'T....""""...::....""""...T',
    'T....""""...::....""""...T',
    'T..YY..YY...::...YY..YY..T',
    'T..YY..YY...::...YY..YY..T',
    'T...........::...........T',
    'T...........:::::::::::::T',
    'T....""""...::...........T',
    'T....""""...::....""""...T',
    'T..YYYY.....::.....YYYY..T',
    'T..YYYY.....::.....YYYY..T',
    'T.........S.::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 23, to: 'route201', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 23, to: 'route201', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'oreburgh', tx: 14, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'oreburgh', tx: 15, ty: 22, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 22, text: 'ROUTE 202\nStay on the path and you will come out the other side.' },
  ],
  objects: [
    { id: 'ww_ether', x: 1, y: 10, item: 'ether', qty: 1 },
    { id: 'ww_net', x: 24, y: 17, item: 'netball', qty: 3 },
    { id: 'ww_oran', x: 9, y: 19, item: 'oranberry', qty: 2 },
  ],
  npcs: [
    { id: 'ww_t1', x: 9, y: 6, look: 'bugCatcher', trainer: 'ww_bug1', facing: 'right', sight: 3, movement: 'still' },
    { id: 'ww_t2', x: 17, y: 13, look: 'bugCatcher', trainer: 'ww_bug2', facing: 'left', sight: 4, movement: 'still' },
    { id: 'ww_t3', x: 6, y: 19, look: 'lass', trainer: 'ww_lass', facing: 'up', sight: 3, movement: 'still' },
    {
      id: 'ww_t4', x: 15, y: 4, look: 'grunt', trainer: 'ww_grunt', facing: 'left', sight: 4, movement: 'still',
      after: ['Fine. Measure it yourself. We are done here anyway.',
        'Commander Mars only wanted to know how far the light reaches. It reaches further every night.'],
    },
    {
      id: 'ww_hiker', x: 20, y: 10, look: 'hiker', name: 'Ferris', movement: 'lookAround', facing: 'down',
      dialogue: [
        {
          when: { titles: 1 },
          lines: ['You are the one off the results sheet. The {lastTitle}, was it not?',
            'I walk this route four times a week and nothing at all happens to me. Suits me fine.',
            'Oreburgh is straight north. Still is.'],
        },
        {
          when: { badges: 1 },
          lines: ['Badge already. You came through here about a week ago with nothing on you.',
            'The trees whisper because the wind comes off the quarry face. Not ghosts. Probably not ghosts.'],
        },
        {
          lines: ['The trees whisper because the wind comes off the quarry face. Not ghosts. Probably not ghosts.',
            'Oreburgh is straight north. You cannot miss it — it is the loud bit.'],
        },
      ],
    },
  ],
  encounters: {
    grass: { min: 4, max: 8, table: [[18, 20], [38, 16], [20, 14], [22, 14], [10, 12], [41, 10], [42, 8], [24, 4], [15, 2]] },
  },
});

// ---- The Everlight Chamber -------------------------------------------------
// Where four maps and a dozen NPCs have been pointing. Reachable only with the
// Aurora Charm, and only once Galactic has been cleared out of the Gate.

export const EVERLIGHT_CHAMBER = defineMap('everlight_chamber', {
  name: 'Everlight Chamber', kind: 'cave', music: 'cave', darkEdges: true,
  tiles: [
    'CCCCCCCCCCCCCCC',
    'CCCCcccccccCCCC',
    'CCcccccccccccCC',
    'CcccccccccccccC',
    'CcccccccccccccC',
    'CcccccccccccccC',
    'CCcccccccccccCC',
    'CCCCcccccccCCCC',
    'CCCCCCCccCCCCCC',
  ],
  warps: [
    { x: 7, y: 8, to: 'oreburgh_gate', tx: 13, ty: 2, dir: 'down' },
    { x: 8, y: 8, to: 'oreburgh_gate', tx: 13, ty: 2, dir: 'down' },
  ],
  events: [
    // Rowan's own logbook, left in the chamber approach thirty-one years ago.
    { x: 4, y: 6, flag: 'doc_logbook_read', script: 'docLogbook' },
    { x: 11, y: 6, flag: 'doc_logbook_read', script: 'docLogbook' },
    // Standing in front of it is the encounter. It repeats until the thing is
    // caught, because a legendary you knocked out should not be gone forever.
    { x: 7, y: 4, flag: 'everlightResolved', script: 'everlightDialga', repeat: true },
    { x: 8, y: 4, flag: 'everlightResolved', script: 'everlightDialga', repeat: true },
  ],
  encounters: { grass: null, cave: null },
});

export const OREBURGH_GATE = defineMap('oreburgh_gate', {
  name: 'Oreburgh Gate', kind: 'cave', music: 'cave',
  tiles: [
    'CCCCCCCCCCCCCCCCCCCCCCCC',
    'CccccccccccccccccccccccC',
    'CcCCCCcccccccccccCCCCccC',
    'CccccccccccccoccccccccCC',
    'CccCCCCCCccccccccccccccC',
    'CccccccccccccccccRccccCC',
    'CccccccccCCCCCCCCccccccC',
    'CccccccccccccccccccccccC',
    'CcCCCCCCcccccccccCCCCccC',
    'CccccccccccoccccccccccCC',
    'CccccCCCCCCCCCCCCcccccCC',
    'CccccccccccccccccccccccC',
    'CccCCCCcccccccccccCCCccC',
    'CccccccccccccccccccccccC',
    'CccccRccccccccccccccccCC',
    'CCCCCCCCCCCccCCCCCCCCCCC',
  ],
  warps: [
    { x: 11, y: 15, to: 'route207', tx: 12, ty: 1, dir: 'down' },
    { x: 12, y: 15, to: 'route207', tx: 13, ty: 1, dir: 'down' },
  ],
  objects: [
    { id: 'sf_escape', x: 2, y: 1, item: 'escaperope', qty: 1 },
    { id: 'sf_revive', x: 21, y: 3, item: 'revive', qty: 1 },
    { id: 'sf_charm', x: 12, y: 1, item: 'auroracharm', qty: 1, story: true },
  ],
  events: [
    // Picking the charm up is the turn. The tile under it does the work.
    { x: 12, y: 1, flag: 'knowsTwist', script: 'charmFound', requires: 'beatCommander' },
    // Galactic left in a hurry and left their paperwork.
    { x: 11, y: 3, flag: 'doc_memo_read', script: 'docMemo' },
    // The seam in the rock the whole region has been talking about. It fires
    // every time you stand on it: shut without the charm, a door with it.
    { x: 12, y: 2, flag: 'everlightOpened', script: 'everlight', repeat: true },
  ],
  npcs: [
    { id: 'sf_t1', x: 6, y: 5, look: 'grunt', trainer: 'cave_grunt1', facing: 'right', sight: 4, movement: 'still' },
    { id: 'sf_t2', x: 18, y: 11, look: 'gruntF', trainer: 'cave_grunt2', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'sf_boss', x: 12, y: 3, look: 'boss', trainer: 'cave_commander', facing: 'down', sight: 3, movement: 'still',
      after: [
        {
          when: { champion: true },
          lines: ['One trainer. Noted.',
            'They tell me you are number one in the world now. Ratings. Points. Applause.',
            'None of it will matter to the thing under this hill. Keep the charm anyway.'],
        },
        {
          lines: ['One trainer. Noted.',
            'Keep the charm. It answers only to the mountain.',
            'And the mountain is not finished with either of us.'],
        },
      ],
    },
  ],
  encounters: {
    grass: null,
    cave: { min: 9, max: 14, table: [[24, 30], [26, 26], [29, 16], [46, 10], [34, 8], [50, 5], [28, 3], [53, 2]] },
  },
});
