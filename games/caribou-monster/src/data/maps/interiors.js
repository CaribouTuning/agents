import { defineMap } from './define.js';

const PLAYER_HOUSE = defineMap('player_house', {
  name: 'Home', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|k_v____bb_|',
    '|__________|',
    '|_e________|',
    '|__________|',
    '|_____p____|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'brackenvale', tx: 5, ty: 13, dir: 'down' }],
  npcs: [
    {
      id: 'ph_mom', x: 3, y: 4, look: 'mom', name: 'Mum', movement: 'still', facing: 'down',
      dialogue: ['Professor Aspen came by looking for you. Something about a monster she wants you to have.',
        'Go on. I already packed your bag.'],
      dialogueAfter: {
        flag: 'gotStarter',
        lines: ['Look at you, a real trainer.', 'If your team gets tired, come home any time — or use a Monster Centre.'],
      },
      heals: true,
    },
  ],
  healPoint: { map: 'player_house', x: 5, y: 6 },
});

const RIVAL_HOUSE = defineMap('rival_house', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|kk_____bb_|',
    '|__________|',
    '|______e___|',
    '|__________|',
    '|_p________|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'brackenvale', tx: 22, ty: 13, dir: 'down' }],
  npcs: [
    {
      id: 'rh_parent', x: 7, y: 4, look: 'oldMan', name: 'Neighbour', movement: 'still', facing: 'down',
      dialogue: ['Ran out of here at dawn shouting about the lab. You know how it is.',
        'Try not to let them win every argument. It only encourages it.'],
    },
  ],
});

const ASPEN_LAB = defineMap('aspen_lab', {
  name: "Professor Aspen's Lab", kind: 'indoor', music: 'lab', darkEdges: false,
  tiles: [
    '||||||||||||||',
    '|kkk______kkk|',
    '|____________|',
    '|_e__e____e__|',
    '|____________|',
    '|__P______P__|',
    '|____________|',
    '|_____p______|',
    '||||||D|||||||',
  ],
  warps: [{ x: 6, y: 8, to: 'brackenvale', tx: 6, ty: 6, dir: 'down' }],
  npcs: [
    {
      id: 'lab_aspen', x: 6, y: 2, look: 'professor', name: 'Prof. Aspen', movement: 'still', facing: 'down',
      script: 'starter',
      dialogue: ['There you are. I have three monsters on that table and no one to raise them.',
        'Pick whichever one looks back at you. That is the only method that has ever worked.'],
    },
    {
      id: 'lab_aide', x: 10, y: 6, look: 'scientist', name: 'Aide', movement: 'still', facing: 'left',
      dialogue: ['The MonsterDex records every species you see and every one you catch.',
        'The professor pretends it is for science. It is mostly for bragging.'],
    },
  ],
});

const ALDERMERE_CENTER = defineMap('aldermere_center', {
  name: 'Monster Centre', kind: 'indoor', music: 'center', darkEdges: false,
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
    { x: 6, y: 7, to: 'aldermere', tx: 6, ty: 7, dir: 'down' },
    { x: 7, y: 7, to: 'aldermere', tx: 6, ty: 7, dir: 'down' },
  ],
  npcs: [
    {
      id: 'ac_nurse', x: 4, y: 1, look: 'nurse', name: 'Nurse', movement: 'still', facing: 'down',
      script: 'heal', overCounter: true,
      dialogue: ['Welcome to the Aldermere Monster Centre. Shall I heal your team to full health?'],
    },
    {
      id: 'ac_pc', x: 11, y: 1, look: 'clerk', name: 'Attendant', movement: 'still', facing: 'down',
      overCounter: true,
      dialogue: ['The storage system behind me holds anything your party cannot.',
        'Walk up to the terminal and press A.'],
    },
    {
      id: 'ac_trainer', x: 9, y: 4, look: 'youngster', name: 'Trainer', movement: 'wander', facing: 'down',
      dialogue: ['Healing here is free. I still feel guilty about it every single time.'],
    },
  ],
  pc: { x: 11, y: 1 },
  healPoint: { map: 'aldermere_center', x: 6, y: 5 },
});

const ALDERMERE_MART = defineMap('aldermere_mart', {
  name: 'Poké Mart', kind: 'indoor', music: 'mart', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|MMMM______|',
    '|__________|',
    '|_xxx______|',
    '|__________|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 6, to: 'aldermere', tx: 25, ty: 7, dir: 'down' }],
  npcs: [
    {
      id: 'am_clerk', x: 3, y: 2, look: 'clerk', name: 'Clerk', movement: 'still', facing: 'down',
      script: 'shop', overCounter: true,
      dialogue: ['Welcome! What can I get you?'],
    },
    {
      id: 'am_shopper', x: 8, y: 4, look: 'lass', name: 'Shopper', movement: 'still', facing: 'left',
      dialogue: ['Buy more balls than you think you need. You always need more balls.'],
    },
  ],
  shop: true,
});

const ALDERMERE_GYM = defineMap('aldermere_gym', {
  name: 'Aldermere Gym', kind: 'indoor', music: 'gym', darkEdges: false,
  tiles: [
    '||||||||||||||||',
    '|gggggggggggggg|',
    '|gggggg!!gggggg|',
    '|!!!!gg!!gg!!!!|',
    '|gggggggggggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|!!!!!!gg!!!!!!|',
    '|gggggggggggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|!!!!gg!!gg!!!!|',
    '|gggggggggggggg|',
    '|gg!!!!!!!!!!gg|',
    '|gggggggggggggg|',
    '|||||||DD|||||||',
  ],
  warps: [
    { x: 7, y: 15, to: 'aldermere', tx: 14, ty: 19, dir: 'down' },
    { x: 8, y: 15, to: 'aldermere', tx: 15, ty: 19, dir: 'down' },
  ],
  npcs: [
    { id: 'gym1_a', x: 2, y: 12, look: 'hiker', trainer: 'gym1_hiker1', facing: 'right', sight: 4, movement: 'still' },
    { id: 'gym1_b', x: 13, y: 8, look: 'worker', trainer: 'gym1_worker', facing: 'left', sight: 4, movement: 'still' },
    { id: 'gym1_c', x: 5, y: 4, look: 'hiker', trainer: 'gym1_hiker2', facing: 'down', sight: 3, movement: 'still' },
    {
      id: 'gym1_leader', x: 7, y: 1, look: 'leaderRock', trainer: 'gym1_leader',
      facing: 'down', sight: 0, movement: 'still',
      after: ['Straight through the stone.',
        'Route 2 runs north out of the city. Take the Quarry Badge with you — some doors only open for it.'],
    },
  ],
});

const ALDERMERE_HOUSE = defineMap('aldermere_house', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|k__v___bb_|',
    '|__________|',
    '|__e_______|',
    '|__________|',
    '|_______p__|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'aldermere', tx: 5, ty: 15, dir: 'down' }],
  npcs: [
    {
      id: 'ah_man', x: 4, y: 4, look: 'oldMan', name: 'Resident', movement: 'still', facing: 'down',
      dialogue: ['A monster can only hold four moves. Learning a fifth means forgetting one.',
        'Choose carefully. I have regretted a forgotten move for thirty years.'],
    },
  ],
});

const ALDERMERE_HOUSE2 = defineMap('aldermere_house2', {
  name: 'House', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    '||||||||||||',
    '|kk____v___|',
    '|__________|',
    '|_____e____|',
    '|__________|',
    '|_p________|',
    '|__________|',
    '|||||D||||||',
  ],
  warps: [{ x: 5, y: 7, to: 'aldermere', tx: 26, ty: 15, dir: 'down' }],
  npcs: [
    {
      id: 'ah2_girl', x: 6, y: 4, look: 'lass', name: 'Resident', movement: 'still', facing: 'down',
      dialogue: ['Two trainers can link up out on the routes, you know. My cousin does it every weekend.',
        'They battle, they trade, they argue about who carried. Sounds lovely.'],
    },
    {
      id: 'ah2_kid', x: 9, y: 5, look: 'kid', name: 'Kid', movement: 'wander', facing: 'down',
      dialogue: ['A monster that faints still comes back! Just take it to the Centre. Or use a Revive.'],
    },
  ],
});

export const INTERIORS = [
  PLAYER_HOUSE, RIVAL_HOUSE, ASPEN_LAB, ALDERMERE_CENTER, ALDERMERE_MART,
  ALDERMERE_GYM, ALDERMERE_HOUSE, ALDERMERE_HOUSE2,
];
