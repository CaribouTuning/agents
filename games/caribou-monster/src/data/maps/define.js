// Map definition + validation.
//
// Lives apart from the registry so map files can import `defineMap` without
// the registry importing them back — a cycle that works in ES modules but is
// needless fragility.
import { TILES } from '../../render/tiles.js';

/**
 * Deterministic hash: the same map always scatters the same way, on every
 * device and in both halves of a link session.
 */
function hash(id, x, y) {
  let n = 2166136261;
  for (let i = 0; i < id.length; i++) n = ((n ^ id.charCodeAt(i)) * 16777619) >>> 0;
  n = ((n ^ (x * 374761393)) * 16777619) >>> 0;
  n = ((n ^ (y * 668265263)) * 16777619) >>> 0;
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}

// Ground a map author left plain, and the worn variants that get sprinkled
// over it.
//
// Scattering tufts and cracks over a blank field turns it into somewhere, and
// costs no map editing. Every replacement is walkable, triggers nothing and
// keeps the same ground kind as its base, so a scatter can never change where
// a player may go — which is what makes doing it automatically safe. Tiles
// anything is standing on, warping through or scripted on are left alone.
const SCATTER = {
  '.': [[0.10, ','], [0.04, '*']],   // turf clumps and wildflowers
  'q': [[0.07, '3']],                // cracked slabs in a paved street
  'z': [[0.11, '4']],                // moss between old cobbles
  ';': [[0.10, '5']],                // pebbles pressed into a dirt road
  's': [[0.08, '6']],                // shells and drift on a beach
  'j': [[0.07, '7']],                // a rope coil on the planks
};

function scatter(id, rows, def) {
  if (def.scatter === false) return rows;
  // A map may thicken or thin any row of the table — Floaroma wants flowers
  // everywhere, a swept plaza wants nothing.
  const table = { ...SCATTER, ...(def.scatter && typeof def.scatter === 'object' ? def.scatter : {}) };
  const taken = new Set();
  const claim = (o) => { if (o && o.x !== undefined) taken.add(`${o.x},${o.y}`); };
  (def.warps || []).forEach(claim);
  (def.npcs || []).forEach(claim);
  (def.objects || []).forEach(claim);
  (def.events || []).forEach(claim);
  (def.signs || []).forEach(claim);
  // Warp landing spots and the tile in front of a door are walked over
  // constantly; leave a clear apron around them.
  for (const wp of def.warps || []) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) taken.add(`${wp.x + dx},${wp.y + dy}`);
  }
  return rows.map((row, y) => {
    let out = '';
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const list = table[ch];
      if (!list || taken.has(`${x},${y}`)) { out += ch; continue; }
      // Clumping. Weeds, moss and shells grow in patches, not in an even
      // spray of single pixels: a coarse field over 3x3 blocks roughly
      // doubles the odds inside a patch and halves them outside, so the same
      // overall density reads as a meadow instead of as noise.
      const clump = 0.45 + hash(id, Math.floor(x / 3), Math.floor(y / 3)) * 1.5;
      const r = hash(id, x, y);
      let acc = 0;
      let pick = ch;
      for (const [p, t] of list) { acc += p * clump; if (r < acc) { pick = t; break; } }
      out += pick;
    }
    return out;
  });
}

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
  const painted = scatter(id, rows, def);
  return {
    id,
    name: def.name || id,
    kind: def.kind || 'route',      // town | route | indoor | cave
    music: def.music || 'route',
    tiles: painted,
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
    events: def.events || [],       // scripted triggers on step (any extra
                                    // keys on an event ride along to the script)
    darkEdges: def.darkEdges !== false,
    healPoint: def.healPoint || null,
    // A tile that runs a script when you step on it and leads out of the map.
    // Used where a warp cannot say where it goes — the Underground's ladders
    // come up wherever you went down, and a Secret Base's door comes out at
    // whichever wall its owner cut it into.
    stepOut: def.stepOut || null,
    // A map you can only be put into by a cutscene — the Everlight door opens
    // from the tunnel side and there is no warp back through it.
    scriptEntry: !!def.scriptEntry,
    // Reached through a gate rather than off a road: a park or a marsh behind
    // a building, not a place on the region map.
    subArea: !!def.subArea,
  };
}
