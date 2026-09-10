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
import { UNDERGROUND, SECRET_BASE } from './underground.js';
import {
  ROUTE204, RAVAGED_PATH, FLOAROMA, ROUTE205, WINDWORKS, ETERNA_FOREST, ETERNA,
  ROUTE206, LAKE_VERITY, ETERNA_GYM, FLOAROMA_CENTER, FLOAROMA_HOUSE,
  ETERNA_CENTER, ETERNA_MART, WINDWORKS_IN,
} from './north.js';
import {
  MT_CORONET_SOUTH, ROUTE208, HEARTHOME, HEARTHOME_GYM, HEARTHOME_CENTER,
  HEARTHOME_MART, CONTEST_HALL, AMITY_SQUARE,
} from './central.js';

export { defineMap };

// The road, in the order a player walks it: Twinleaf, Route 201, Sandgem,
// Route 202, Jubilife, Route 203, Oreburgh — then Route 207 and the Gate.
const ALL = [TWINLEAF, ROUTE201, SANDGEM, ROUTE202, JUBILIFE, ROUTE203, OREBURGH,
  ROUTE207, OREBURGH_GATE, EVERLIGHT_CHAMBER, UNDERGROUND, SECRET_BASE,
  // The northern branch and the loop road: what stops the region being a line.
  LAKE_VERITY, ROUTE204, RAVAGED_PATH, FLOAROMA, ROUTE205, WINDWORKS,
  ETERNA_FOREST, ETERNA, ROUTE206,
  ETERNA_GYM, FLOAROMA_CENTER, FLOAROMA_HOUSE, ETERNA_CENTER, ETERNA_MART, WINDWORKS_IN,
  // Over the mountain: Route 208 and Hearthome, where Fantina is.
  MT_CORONET_SOUTH, ROUTE208, HEARTHOME, HEARTHOME_GYM, HEARTHOME_CENTER,
  HEARTHOME_MART, CONTEST_HALL, AMITY_SQUARE,
  ...INTERIORS];

export const MAPS = {};
for (const m of ALL) MAPS[m.id] = m;

export function getMap(id) {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export const MAP_IDS = Object.keys(MAPS);

