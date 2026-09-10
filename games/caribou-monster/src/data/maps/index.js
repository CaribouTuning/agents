// Map registry.
//
// A map is: an ASCII tile grid, plus warps, NPCs, objects, signs and an
// encounter table. `defineMap` validates the grid at load so a mis-typed
// row is a loud error at boot instead of a mysterious hole in the world.
import { defineMap } from './define.js';
import { TWINLEAF, SANDGEM, JUBILIFE, OREBURGH } from './towns.js';
import { ROUTE201, ROUTE203, ROUTE207 } from './routes.js';
import { ROUTE202, OREBURGH_GATE, EVERLIGHT_CHAMBER } from './wilds.js';
import { INTERIORS } from './interiors.js';

export { defineMap };

// The road, in the order a player walks it: Twinleaf, Route 201, Sandgem,
// Route 202, Jubilife, Route 203, Oreburgh — then Route 207 and the Gate.
const ALL = [TWINLEAF, ROUTE201, SANDGEM, ROUTE202, JUBILIFE, ROUTE203, OREBURGH,
  ROUTE207, OREBURGH_GATE, EVERLIGHT_CHAMBER, ...INTERIORS];

export const MAPS = {};
for (const m of ALL) MAPS[m.id] = m;

export function getMap(id) {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export const MAP_IDS = Object.keys(MAPS);

