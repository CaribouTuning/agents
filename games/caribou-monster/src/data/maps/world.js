// The region, as a graph.
//
// Every map already knows its own doors, so the connections between maps are
// *derived* from the warps rather than authored a second time. A hand-written
// connection table is a second source of truth, and the moment somebody moves
// a warp the two disagree — the map says you can go north and the graph says
// you cannot. Here there is nothing to disagree with: if you can walk it, it
// is in the graph.
//
// The one thing that cannot be derived is where a place *is*. `WORLD_POS` is
// authored, in the region's own coordinates (x east, y south), and it is what
// the Town Map draws and what the audit checks travel directions against.
import { MAPS } from './index.js';

/**
 * Where each outdoor place sits in Sinnoh, laid out from the region map.
 * Twinleaf is the bottom-left corner of the world, as it is in Platinum.
 */
export const WORLD_POS = {
  // The south-western corner, where the game starts.
  twinleaf:       { x: 2, y: 14, kind: 'town' },
  lake_verity:    { x: 0, y: 13, kind: 'special' },
  route201:       { x: 2, y: 13, kind: 'route' },
  sandgem:        { x: 2, y: 12, kind: 'town' },
  route202:       { x: 2, y: 11, kind: 'route' },
  // Jubilife is the hinge of the region: three roads leave it.
  jubilife:       { x: 2, y: 10, kind: 'city' },
  // East, to the mining town and the mountain behind it.
  route203:       { x: 4, y: 10, kind: 'route' },
  oreburgh:       { x: 6, y: 10, kind: 'city' },
  route207:       { x: 6, y: 8, kind: 'route' },
  oreburgh_gate:  { x: 6, y: 6, kind: 'cave' },
  everlight_chamber: { x: 6, y: 4, kind: 'special' },
  // North, through the flower town and the forest.
  route204:       { x: 2, y: 8, kind: 'route' },
  ravaged_path:   { x: 2, y: 7, kind: 'cave' },
  floaroma:       { x: 2, y: 6, kind: 'town' },
  route205:       { x: 2, y: 4, kind: 'route' },
  windworks:      { x: 4, y: 4, kind: 'special' },
  eterna_forest:  { x: 2, y: 3, kind: 'forest' },
  eterna:         { x: 2, y: 2, kind: 'city' },
  // And the road that closes the ring, back down to Route 207.
  route206:       { x: 4, y: 3, kind: 'route' },
  // Underneath all of it. A Secret Base is a room off these tunnels rather
  // than a place in the region, so it has no position on the paper at all.
  underground:    { x: 2, y: 16, kind: 'underground' },
};

/** The four ways out of a map, and which way each moves you in the world. */
export const DIRS = {
  north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0],
};

/**
 * Which edge of a map a warp sits on. A warp in the middle of a map is a
 * door, not a way out of the region, and has no edge.
 */
export function edgeOf(map, warp) {
  if (warp.y <= 0) return 'north';
  if (warp.y >= map.height - 1) return 'south';
  if (warp.x <= 0) return 'west';
  if (warp.x >= map.width - 1) return 'east';
  return null;
}

/**
 * The whole region: every outdoor map, where it is, and what it touches.
 * Built once and cached, because nothing in it can change at runtime.
 */
let cached = null;

export function worldGraph() {
  if (cached) return cached;
  const nodes = {};
  for (const [id, pos] of Object.entries(WORLD_POS)) {
    const map = MAPS[id];
    if (!map) continue;
    nodes[id] = {
      id, name: map.name, kind: pos.kind,
      x: pos.x, y: pos.y,
      // direction -> [map id]. A route really can have two roads north — the
      // one over the cliffs and the one through the tunnel — and a model that
      // only allows one silently loses the second.
      links: { north: [], south: [], east: [], west: [] },
      neighbours: new Set(),
      doors: [],          // interiors reachable from here
    };
  }
  for (const [id, node] of Object.entries(nodes)) {
    const map = MAPS[id];
    for (const w of map.warps) {
      if (!nodes[w.to]) { node.doors.push(w.to); continue; }
      const dir = edgeOf(map, w);
      if (dir && !node.links[dir].includes(w.to)) node.links[dir].push(w.to);
      node.neighbours.add(w.to);
    }
    node.doors = [...new Set(node.doors)];
  }
  cached = { nodes, ids: Object.keys(nodes) };
  return cached;
}

/** Everywhere you can walk to from `start`, without going through a door. */
export function reachableFrom(start = 'twinleaf') {
  const g = worldGraph();
  if (!g.nodes[start]) return new Set();
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const id = stack.pop();
    for (const to of g.nodes[id].neighbours) {
      if (!g.nodes[to] || seen.has(to)) continue;
      seen.add(to);
      stack.push(to);
    }
  }
  return seen;
}

/**
 * How many genuinely different ways out a place has.
 *
 * The number this project cares about: a region where every node scores 2 is
 * a corridor, however many maps are in it.
 */
export function branchiness(id) {
  const node = worldGraph().nodes[id];
  if (!node) return 0;
  return Object.values(node.links).filter((list) => list.length).length;
}

/** Every [direction, target] pair leaving a place, flattened. */
export function linksOf(id) {
  const node = worldGraph().nodes[id];
  if (!node) return [];
  return Object.entries(node.links).flatMap(([dir, list]) => list.map((to) => [dir, to]));
}

export const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

/**
 * Whether `to` really lies `dir` of `from`.
 *
 * Deliberately not strict: a road may run north-east and still be the north
 * road. What it may not do is run south while calling itself north, which is
 * the mistake that turned this region into a single street.
 */
export function directionHolds(dir, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const [wx, wy] = DIRS[dir];
  if (wy) return Math.sign(dy) === wy && Math.abs(dy) >= Math.abs(dx);
  return Math.sign(dx) === wx && Math.abs(dx) >= Math.abs(dy);
}

/** The bounding box of the region, for anything that has to draw it. */
export function worldBounds() {
  const g = worldGraph();
  const xs = g.ids.map((id) => g.nodes[id].x);
  const ys = g.ids.map((id) => g.nodes[id].y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}
