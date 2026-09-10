// Map definition + validation.
//
// Lives apart from the registry so map files can import `defineMap` without
// the registry importing them back — a cycle that works in ES modules but is
// needless fragility.
import { TILES } from '../../render/tiles.js';

export function defineMap(id, def) {
  const rows = def.tiles;
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) {
      throw new Error(`[map ${id}] row ${i} is ${r.length} wide, expected ${w}: "${r}"`);
    }
    for (const ch of r) {
      if (!TILES[ch]) throw new Error(`[map ${id}] row ${i} uses unknown tile '${ch}'`);
    }
  });
  return {
    id,
    name: def.name || id,
    kind: def.kind || 'route',      // town | route | indoor | cave
    music: def.music || 'route',
    tiles: rows,
    width: w,
    height: rows.length,
    warps: def.warps || [],
    npcs: def.npcs || [],
    objects: def.objects || [],     // ground items
    signs: def.signs || [],
    // Names written across the front of a building, so a player can read the
    // city instead of guessing at it.
    labels: def.labels || [],
    encounters: def.encounters || null,
    events: def.events || [],       // scripted triggers on step
    darkEdges: def.darkEdges !== false,
    healPoint: def.healPoint || null,
  };
}
