import { defineMap } from './define.js';

export const WHISPERWOOD = defineMap('whisperwood', {
  name: 'Whisperwood Forest', kind: 'route', music: 'forest',
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
    'T...........::...........T',
    'TTTTTTTTTTTT::TTTTTTTTTTTT',
  ],
  warps: [
    { x: 12, y: 23, to: 'route1', tx: 12, ty: 1, dir: 'down', edge: true },
    { x: 13, y: 23, to: 'route1', tx: 13, ty: 1, dir: 'down', edge: true },
    { x: 12, y: 0, to: 'aldermere', tx: 14, ty: 22, dir: 'up', edge: true },
    { x: 13, y: 0, to: 'aldermere', tx: 15, ty: 22, dir: 'up', edge: true },
  ],
  signs: [
    { x: 10, y: 22, text: 'WHISPERWOOD FOREST\nStay on the path and you will come out the other side.' },
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
        'Commander Vesper only wanted to know how far the light reaches. It reaches further every night.'],
    },
    {
      id: 'ww_hiker', x: 20, y: 10, look: 'hiker', name: 'Ferris', movement: 'lookAround', facing: 'down',
      dialogue: ['The trees whisper because the wind comes off the quarry face. Not ghosts. Probably not ghosts.',
        'Aldermere is straight north. You cannot miss it — it is the loud bit.'],
    },
  ],
  encounters: {
    grass: { min: 4, max: 8, table: [[18, 25], [20, 20], [22, 20], [10, 15], [24, 10], [15, 10]] },
  },
});

export const STONEFALL = defineMap('stonefall', {
  name: 'Stonefall Cave', kind: 'cave', music: 'cave',
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
    'CccccccccccRccccccccccCC',
    'CCCCCCCCCCCccCCCCCCCCCCC',
  ],
  warps: [
    { x: 11, y: 15, to: 'route2', tx: 12, ty: 1, dir: 'down' },
    { x: 12, y: 15, to: 'route2', tx: 13, ty: 1, dir: 'down' },
  ],
  objects: [
    { id: 'sf_escape', x: 2, y: 1, item: 'escaperope', qty: 1 },
    { id: 'sf_revive', x: 21, y: 3, item: 'revive', qty: 1 },
    { id: 'sf_charm', x: 12, y: 1, item: 'auroracharm', qty: 1, story: true },
  ],
  npcs: [
    { id: 'sf_t1', x: 6, y: 5, look: 'grunt', trainer: 'cave_grunt1', facing: 'right', sight: 4, movement: 'still' },
    { id: 'sf_t2', x: 18, y: 11, look: 'gruntF', trainer: 'cave_grunt2', facing: 'left', sight: 4, movement: 'still' },
    {
      id: 'sf_boss', x: 12, y: 3, look: 'boss', trainer: 'cave_commander', facing: 'down', sight: 3, movement: 'still',
      after: ['One trainer. Noted.',
        'Keep the charm. It only answers to the mountain, and the mountain is not finished with either of us.'],
    },
  ],
  encounters: {
    grass: null,
    cave: { min: 9, max: 14, table: [[24, 35], [26, 30], [29, 20], [34, 10], [28, 5]] },
  },
});
