// Map registry.
//
// A map is: an ASCII tile grid, plus warps, NPCs, objects, signs and an
// encounter table. `defineMap` validates the grid at load so a mis-typed
// row is a loud error at boot instead of a mysterious hole in the world.
import { defineMap } from './define.js';
import { TWINLEAF, OREBURGH } from './towns.js';
import { ROUTE201, ROUTE207 } from './routes.js';
import { ROUTE202, OREBURGH_GATE, EVERLIGHT_CHAMBER } from './wilds.js';
import { INTERIORS } from './interiors.js';

export { defineMap };

const ALL = [TWINLEAF, OREBURGH, ROUTE201, ROUTE207, ROUTE202, OREBURGH_GATE,
  EVERLIGHT_CHAMBER, ...INTERIORS];

export const MAPS = {};
for (const m of ALL) MAPS[m.id] = m;

export function getMap(id) {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export const MAP_IDS = Object.keys(MAPS);

