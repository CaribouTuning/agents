// Signposts at every way out, derived from the world graph.
//
// The Town Map draws Sinnoh as a graph of places joined by roads, and it is
// correct — every line on it is a door you can genuinely walk through. What
// the WORLD did not do was say so: you could stand at a junction on Route 207
// with four ways off it and nothing anywhere telling you which was which, and
// then open the map and see four roads you had no way to identify. Twelve
// maps were like this. Jubilife had four exits and named none of them.
//
// Rather than hand-write thirty signs that can drift out of step the first
// time a road moves, every edge exit gets a small board naming where it goes,
// built from the same `linksOf` the map screen reads. A road cannot be
// mislabelled here, because nothing here is written down twice.
// No imports: the registry is handed in. Importing the map index from here
// would close a cycle (index -> signposts -> index) and the bundler refuses
// it, correctly — a module that decorates a registry should not also be the
// thing that builds it.
// The font draws these four and not the arrow glyphs most people would reach
// for first; `unrenderable()` in render/font.js is the list that decides.
const ARROW = { north: '▲', south: '▼', east: '>', west: '<' };

/** Which edge a warp sits on, or null if it is a door inside the map. */
function edgeOf(map, w) {
  if (w.y <= 0) return 'north';
  if (w.y >= map.height - 1) return 'south';
  if (w.x <= 0) return 'west';
  if (w.x >= map.width - 1) return 'east';
  return null;
}

/**
 * A board for every edge exit, placed just inside the map beside the door.
 *
 * One per destination per edge, so a two-tile road gets one sign rather than
 * two stacked on top of each other.
 */
export function signpostsFor(map, maps) {
  const out = [];
  const seen = new Set();
  for (const w of map.warps) {
    if (!w.edge) continue;
    const dest = maps[w.to];
    if (!dest) continue;
    const side = edgeOf(map, w);
    if (!side) continue;
    const key = `${side}:${w.to}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name = dest.name.toUpperCase();
    const text = `${ARROW[side] || ''} ${name}`.trim();
    // Tucked one tile in from the edge so the board is on screen when the
    // player is standing at the door rather than half off it.
    let x = w.x;
    let y = w.y;
    if (side === 'north') y += 1;
    else if (side === 'south') y -= 1;
    else if (side === 'west') x += 1;
    else x -= 1;
    out.push({ x, y, w: Math.max(6, Math.ceil(text.length / 2)), text, exit: true });
  }
  return out;
}

/** Adds the generated boards to every outdoor map, once, at boot. */
export function addSignposts(maps) {
  for (const map of Object.values(maps)) {
    if (map.kind === 'indoor') continue;
    if (map._signposted) continue;
    map._signposted = true;
    map.labels = [...(map.labels || []), ...signpostsFor(map, maps)];
  }
}
