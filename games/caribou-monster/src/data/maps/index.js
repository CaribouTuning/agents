// Map registry.
//
// A map is: an ASCII tile grid, plus warps, NPCs, objects, signs and an
// encounter table. `defineMap` validates the grid at load so a mis-typed
// row is a loud error at boot instead of a mysterious hole in the world.
import { defineMap } from './define.js';
import { BRACKENVALE, ALDERMERE } from './towns.js';
import { ROUTE1, ROUTE2 } from './routes.js';
import { WHISPERWOOD, STONEFALL } from './wilds.js';
import { INTERIORS } from './interiors.js';

export { defineMap };

const ALL = [BRACKENVALE, ALDERMERE, ROUTE1, ROUTE2, WHISPERWOOD, STONEFALL, ...INTERIORS];

export const MAPS = {};
for (const m of ALL) MAPS[m.id] = m;

export function getMap(id) {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export const MAP_IDS = Object.keys(MAPS);

// Region order, used by the Town Map and by "where can I go" checks.
export const REGION_ORDER = [
  'brackenvale', 'route1', 'whisperwood', 'aldermere', 'route2', 'stonefall',
];
