// Connectivity guard for map edits.
//
// A map is a place you walk around. The one way to ruin one with a
// decoration is to drop it where it cuts the place in two, so this walks the
// floor from every door and shouts if anything a player has to reach — a
// door, a sign, a person, an item — has stopped being reachable from the
// rest.
import { MAPS } from '../src/data/maps/index.js';
import { TILES } from '../src/render/tiles.js';

const passable = (ch) => {
  const d = TILES[ch];
  if (!d) return false;
  // Field-move obstacles and water open up later, so they count as floor for
  // the purpose of "is this place still one place".
  if (d.field || d.water) return true;
  return !d.solid;
};

let bad = 0;
const only = process.argv.slice(2);
for (const map of Object.values(MAPS)) {
  if (only.length && !only.includes(map.id)) continue;
  const at = (x, y) => (y >= 0 && y < map.height && x >= 0 && x < map.width ? map.tiles[y][x] : null);
  // Everything a player has to be able to stand on or next to.
  const wants = [];
  for (const w of map.warps) wants.push([w.x, w.y, `warp -> ${w.to}`]);
  const beside = (o, what) => {
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const ch = at(o.x + dx, o.y + dy);
      if (ch && passable(ch)) { wants.push([o.x + dx, o.y + dy, what]); return; }
    }
    wants.push([o.x, o.y, `${what} (walled in)`]);
  };
  for (const n of map.npcs || []) beside(n, `npc ${n.id || n.name || ''}`);
  for (const g of map.signs || []) beside(g, `sign at ${g.x},${g.y}`);
  for (const o of map.objects || []) wants.push([o.x, o.y, `item ${o.item || ''}`]);
  for (const e of map.events || []) wants.push([e.x, e.y, `event ${e.script || e.flag || ''}`]);
  if (!wants.length) continue;

  // A warp that lands in its own map is a lift or a ladder, not a way out:
  // it joins two parts of the floor that no step connects.
  const lifts = new Map();
  for (const w of map.warps) {
    if (w.to === map.id && w.tx !== undefined) lifts.set(`${w.x},${w.y}`, [w.tx, w.ty]);
  }

  const [sx, sy] = wants[0];
  const seen = new Set();
  const key = (x, y) => `${x},${y}`;
  const stack = [[sx, sy]];
  seen.add(key(sx, sy));
  while (stack.length) {
    const [x, y] = stack.pop();
    const lift = lifts.get(key(x, y));
    if (lift && !seen.has(key(lift[0], lift[1]))) {
      seen.add(key(lift[0], lift[1]));
      stack.push(lift);
    }
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      const ch = at(nx, ny);
      if (!ch || !passable(ch) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      stack.push([nx, ny]);
    }
  }
  for (const [x, y, what] of wants) {
    if (!seen.has(key(x, y))) {
      console.log(`  CUT OFF  ${map.id}: ${what} at ${x},${y}`);
      bad++;
    }
  }
}
console.log(bad ? `\n${bad} thing(s) cut off` : '\nnothing is cut off');
process.exit(bad ? 1 : 0);
