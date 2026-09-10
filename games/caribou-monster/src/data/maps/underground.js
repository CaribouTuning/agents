// The Underground.
//
// Gen 4's best idea and the only one built for a touch screen: a second
// Sinnoh under the first one, with nothing in it but rock, the things buried
// in the rock, and — if somebody else is down there — them. There are no wild
// Pokémon, no trainers and no story. It is the part of the game you go to when
// you want to be somewhere with the other person rather than somewhere in the
// plot.
//
// One map, three ladders. The ladder you come up is the one you went down, so
// the Underground is a shortcut only in the sense that it is a nicer walk.
import { defineMap } from './define.js';

export const UNDERGROUND = defineMap('underground', {
  name: 'The Underground', kind: 'cave', music: 'cave', dark: true,
  tiles: [
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CccccccCCCCCXccccccCCCCCXcccccccCC',
    'Cc<cccccccccccccccccccccccccccccCC',
    'CccccccCCCCCcccccccCCCCCcccccccXCC',
    'CCCCXccCCCCCcCCCCCcCCCCCcCCCCCccCC',
    'CCCCcccccccccCCCCCcccccccCCCCCccCC',
    'CCCCcCCCCCCCCCCCCCcCCCCCcCCCCCccCC',
    'CCUccccccccccccccccccccccccccccccC',
    'CCCCcCCCCCCcCCCCCcCCCCCCCCCCCCccCC',
    'CCCCcCCCCCCcCCCCCcCCCCCCCCCCCCccCC',
    'CCCCcccccccccccccccccccccccZCCccCC',
    'CCCCcCCCCCCcCCCCCcCCCCCcccccccccCC',
    'CCCCcCCCCCCcCCCCCcCCCCCcCCCCCCccCC',
    'CCXcccccccccccCCCcccccccCCCCCCccCC',
    'CCCCCCCCCCCCCcCCCcCCCCCcCCCCCCccCC',
    'CCcccccc<ccccccCCcccccccccccccccCC',
    'CCcCCCCCCCCCCCCCCCCCCCCCCCCCCCCcCC',
    'CCccccccccccccccccccccccccZcccc<CC',
    'CCCCCCCCCCCCCCCCUCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  ],
  // Nothing warps out of here by walking. The ladders are scripted, because
  // where each one comes up depends on which one you went down.
  warps: [],
  signs: [
    { x: 0, y: 2, text: 'DIG SITE — NORTH-WEST\nThe rock here is soft and the seams are\nshallow. A good place to learn on.' },
    { x: 32, y: 17, text: 'DIG SITE — SOUTH-EAST\nOlder rock. What is in it is older still.\nMind the roof.' },
  ],
  objects: [],
  npcs: [
    {
      // The only person who lives down here, and the only counter that takes
      // spheres. What you dig up in the Underground is spent in the
      // Underground, which keeps its economy closed and its spheres worth
      // carrying.
      id: 'ug_goods', x: 16, y: 7, look: 'worker', name: 'Goods Trader',
      movement: 'still', facing: 'down', script: 'baseGoods',
      dialogue: [
        { lines: ['Spheres only. I do not take money.'] },
      ],
    },
  ],
  // The one map in the game with nothing living in it. That is the point.
  encounters: null,
  // Every ladder in the tunnels leads back up where you came from.
  stepOut: { tile: '<', script: 'surface' },
});

/**
 * The inside of a Secret Base.
 *
 * One room, cut into rock, the same shape for everybody. What makes it yours
 * is what you put in it — and the decorations are entities drawn from the
 * save, not tiles, because two people looking at the same room have to be
 * looking at the same data rather than at two copies of a map.
 */
export const SECRET_BASE = defineMap('secret_base', {
  name: 'Secret Base', kind: 'indoor', music: 'home', darkEdges: false,
  tiles: [
    'CCCCCCCCCCC',
    'CcccccccccC',
    'CcccccccccC',
    'CcccccccccC',
    'CcccccccccC',
    'CcccccccccC',
    'CCCCCcCCCCC',
  ],
  // No warp out. The door is a step trigger, because where it comes out
  // depends on whose room this is and where in the tunnels they cut it.
  warps: [],
  signs: [],
  objects: [],
  npcs: [],
  encounters: null,
  stepOut: { x: 5, y: 6, script: 'leaveBase' },
});

/** Where a visitor stands when they come in, and where the board is. */
export const BASE_ENTRY = { x: 5, y: 5 };
export const BASE_BOARD = { x: 5, y: 0 };
/** The top-left tile of the 9x5 area decorations live in. */
export const BASE_ORIGIN = { x: 1, y: 1 };

/**
 * Where each ladder comes up, and where each surface map goes down.
 *
 * A player using the Explorer Kit drops in at the ladder nearest to wherever
 * they were standing; the nearest one for anywhere unlisted is the first.
 */
export const LADDERS = [
  { x: 2, y: 2, drop: [2, 3], name: 'North-west shaft', surface: ['twinleaf', 'route201', 'sandgem'] },
  { x: 8, y: 15, drop: [7, 15], name: 'Central shaft', surface: ['route202', 'jubilife', 'route203'] },
  { x: 31, y: 17, drop: [30, 17], name: 'South-east shaft', surface: ['oreburgh', 'route207', 'oreburgh_gate'] },
];

/** The ladder a player standing on `mapId` drops down to. */
export function ladderFor(mapId) {
  return LADDERS.find((l) => l.surface.includes(mapId)) || LADDERS[0];
}
