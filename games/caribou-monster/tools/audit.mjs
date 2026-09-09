// Static world audit.
//
// Walks every map with the same movement rules the game uses and proves the
// world is actually playable: you can always move, always get out, always
// reach the people and things a map contains, and every warp leads somewhere
// real and comes back.
//
// This exists because a softlock is the worst class of bug in this game — it
// costs the player their session — and it is entirely preventable at build
// time. Run it before shipping.
import { MAPS } from '../src/data/maps/index.js';
import { tileDef } from '../src/render/tiles.js';
import { SPECIES } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';
import { ITEMS } from '../src/data/items.js';
import { TRAINERS } from '../src/data/trainers.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---- movement model (mirrors game/overworld/world.js) --------------------

function blockers(map, { strict }) {
  // Item balls and motionless NPCs occupy their tile permanently. Wanderers
  // move, so a strict pass treats them as solid and a lenient pass does not.
  const set = new Set();
  for (const o of map.objects) set.add(`${o.x},${o.y}`);
  for (const n of map.npcs) {
    if (strict || (n.movement || 'still') === 'still') set.add(`${n.x},${n.y}`);
  }
  return set;
}

function at(map, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  return tileDef(map.tiles[y][x]);
}

// Returns the tile actually landed on when stepping `dir` from (x,y), or null.
function step(map, block, x, y, dir) {
  const [dx, dy] = DIRS[dir];
  const nx = x + dx, ny = y + dy;
  const def = at(map, nx, ny);
  if (!def) return null;
  if (def.ledge) {
    if (def.ledge !== dir) return null;
    const lx = nx + dx, ly = ny + dy;
    const ldef = at(map, lx, ly);
    if (!ldef || ldef.solid || block.has(`${lx},${ly}`)) return null;
    return { x: lx, y: ly };
  }
  if (def.solid) return null;
  if (block.has(`${nx},${ny}`)) return null;
  return { x: nx, y: ny };
}

function reachable(map, start, opts = { strict: false }) {
  const block = blockers(map, opts);
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const dir of Object.keys(DIRS)) {
      const next = step(map, block, cur.x, cur.y, dir);
      if (!next) continue;
      const key = `${next.x},${next.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
}

const key = (p) => `${p.x},${p.y}`;
const neighbours = (p) => Object.values(DIRS).map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));

// ---- where the player can legitimately arrive on a map -------------------

function entryPoints(map) {
  const pts = [];
  for (const m of Object.values(MAPS)) {
    for (const w of m.warps) {
      if (w.to === map.id) pts.push({ x: w.tx, y: w.ty, from: `${m.id}(${w.x},${w.y})` });
    }
  }
  if (map.healPoint && map.healPoint.map === map.id) {
    pts.push({ x: map.healPoint.x, y: map.healPoint.y, from: 'heal point' });
  }
  if (map.id === 'player_house') pts.push({ x: 5, y: 5, from: 'new game spawn' });
  return pts;
}

// ---- checks ---------------------------------------------------------------

for (const map of Object.values(MAPS)) {
  const tag = `[${map.id}]`;
  const entries = entryPoints(map);

  if (!entries.length && map.warps.length) warn(`${tag} nothing warps into this map`);

  for (const e of entries) {
    const def = at(map, e.x, e.y);
    if (!def) { err(`${tag} entry from ${e.from} is outside the map at ${e.x},${e.y}`); continue; }

    // 1. You must not arrive standing inside scenery.
    if (def.solid) err(`${tag} entry from ${e.from} lands on a solid '${def.name}' at ${e.x},${e.y}`);

    // 2. You must be able to move at all. This is the softlock check.
    const block = blockers(map, { strict: false });
    const moves = Object.keys(DIRS).filter((d) => step(map, block, e.x, e.y, d));
    if (!moves.length) {
      err(`${tag} SOFTLOCK: entry from ${e.from} at ${e.x},${e.y} has no legal move in any direction`);
      continue;
    }

    // 3. You must be able to leave again.
    const seen = reachable(map, { x: e.x, y: e.y });
    const exits = map.warps.filter((w) => seen.has(`${w.x},${w.y}`));
    if (map.warps.length && !exits.length) {
      err(`${tag} SOFTLOCK: entry from ${e.from} at ${e.x},${e.y} cannot reach any exit warp`);
    }

    // 4. Arriving directly on top of an exit is fragile — one stray step and
    //    the player bounces straight back out.
    if (map.warps.some((w) => w.x === e.x && w.y === e.y)) {
      warn(`${tag} entry from ${e.from} lands directly on an exit warp at ${e.x},${e.y}`);
    }
  }

  // Use the first sound entry as the reference for reachability checks.
  const ref = entries.find((e) => {
    const d = at(map, e.x, e.y);
    return d && !d.solid;
  }) || entries[0];
  if (!ref) continue;
  const seen = reachable(map, { x: ref.x, y: ref.y });
  const seenStrict = reachable(map, { x: ref.x, y: ref.y }, { strict: true });

  // 5. Everything interactive must be standable-next-to.
  const adjacentOk = (p) => neighbours(p).some((n) => seen.has(key(n)));

  for (const n of map.npcs) {
    const d = at(map, n.x, n.y);
    if (!d) { err(`${tag} npc ${n.id} is outside the map at ${n.x},${n.y}`); continue; }
    if (d.solid) err(`${tag} npc ${n.id} stands on a solid '${d.name}' at ${n.x},${n.y}`);
    if (map.warps.some((w) => w.x === n.x && w.y === n.y)) {
      err(`${tag} npc ${n.id} stands on a warp at ${n.x},${n.y}`);
    }
    if (!adjacentOk(n) && !n.overCounter) err(`${tag} npc ${n.id} at ${n.x},${n.y} cannot be talked to`);
    if (n.trainer && !TRAINERS[n.trainer]) err(`${tag} npc ${n.id} references unknown trainer ${n.trainer}`);
  }

  for (const o of map.objects) {
    const d = at(map, o.x, o.y);
    if (!d) { err(`${tag} item ${o.id} is outside the map at ${o.x},${o.y}`); continue; }
    if (d.solid) err(`${tag} item ${o.id} sits on a solid '${d.name}' at ${o.x},${o.y}`);
    if (!adjacentOk(o)) err(`${tag} item ${o.id} at ${o.x},${o.y} cannot be reached`);
    if (!ITEMS[o.item]) err(`${tag} item ${o.id} references unknown item ${o.item}`);
    if (!seenStrict.has(key(o)) && !neighbours(o).some((n) => seenStrict.has(key(n)))) {
      warn(`${tag} item ${o.id} is only reachable if an NPC moves out of the way`);
    }
  }

  for (const s of map.signs) {
    const d = at(map, s.x, s.y);
    if (!d) { err(`${tag} sign at ${s.x},${s.y} is outside the map`); continue; }
    if (!d.solid) warn(`${tag} sign at ${s.x},${s.y} is on walkable '${d.name}' — it can be stood on`);
    if (!adjacentOk(s)) err(`${tag} sign at ${s.x},${s.y} cannot be read`);
  }

  // 6. Two entities must never share a tile.
  const occupied = new Map();
  for (const e of [...map.npcs, ...map.objects]) {
    const k = `${e.x},${e.y}`;
    if (occupied.has(k)) err(`${tag} ${e.id} and ${occupied.get(k)} both occupy ${k}`);
    occupied.set(k, e.id);
  }

  // 7. Warps must be sound in both directions.
  for (const w of map.warps) {
    const src = at(map, w.x, w.y);
    if (!src) { err(`${tag} warp at ${w.x},${w.y} is outside the map`); continue; }
    if (src.solid) err(`${tag} warp at ${w.x},${w.y} sits on a solid '${src.name}'`);
    if (!seen.has(key(w))) warn(`${tag} warp at ${w.x},${w.y} is unreachable from ${ref.x},${ref.y}`);
    const dest = MAPS[w.to];
    if (!dest) { err(`${tag} warp at ${w.x},${w.y} targets unknown map ${w.to}`); continue; }
    const dd = at(dest, w.tx, w.ty);
    if (!dd) { err(`${tag} warp at ${w.x},${w.y} lands outside ${w.to} at ${w.tx},${w.ty}`); continue; }
    // A way home must exist from where we land.
    const back = reachable(dest, { x: w.tx, y: w.ty });
    if (!dest.warps.some((b) => back.has(key(b)) && b.to === map.id)) {
      warn(`${tag} warp to ${w.to} has no reachable way back to ${map.id}`);
    }
  }

  // 8. Heal points must be somewhere you can stand.
  if (map.healPoint) {
    const hp = map.healPoint;
    const hm = MAPS[hp.map];
    if (!hm) err(`${tag} heal point targets unknown map ${hp.map}`);
    else {
      const d = at(hm, hp.x, hp.y);
      if (!d || d.solid) err(`${tag} heal point lands on a solid tile at ${hp.map} ${hp.x},${hp.y}`);
    }
  }

  // 9. Encounter tables must reference real species.
  const tables = [map.encounters?.grass, map.encounters?.cave].filter(Boolean);
  for (const t of tables) {
    if (t.min > t.max) err(`${tag} encounter level range is inverted (${t.min}-${t.max})`);
    for (const [id] of t.table) if (!SPECIES[id]) err(`${tag} encounter table references unknown species ${id}`);
  }
  if (map.kind === 'route' && !map.encounters) {
    const hasGrass = map.tiles.some((r) => r.includes('"'));
    if (hasGrass) err(`${tag} has tall grass but no encounter table`);
  }
  // Grass with no table (or a table with no grass) is a content mistake.
  const hasTall = map.tiles.some((r) => r.includes('"'));
  if (hasTall && !map.encounters?.grass) err(`${tag} has tall grass but no grass encounters`);
  if (map.encounters?.grass && !hasTall) warn(`${tag} defines grass encounters but has no tall grass`);
}

// ---- data-level checks ----------------------------------------------------

for (const [id, t] of Object.entries(TRAINERS)) {
  for (const m of t.team) {
    if (typeof m === 'string') continue;    // rival placeholder, resolved at runtime
    if (!SPECIES[m.species]) err(`[trainer ${id}] unknown species ${m.species}`);
    for (const mv of m.moves || []) if (!MOVES[mv]) err(`[trainer ${id}] unknown move ${mv}`);
    if (m.level < 2 || m.level > 100) err(`[trainer ${id}] level out of range: ${m.level}`);
  }
  if (t.tm && !ITEMS[t.tm]) err(`[trainer ${id}] unknown TM reward ${t.tm}`);
}

for (const sp of Object.values(SPECIES)) {
  for (const [lv, mv] of sp.learnset) {
    if (!MOVES[mv]) err(`[species ${sp.name}] unknown move ${mv}`);
    if (lv < 1 || lv > 100) err(`[species ${sp.name}] learnset level out of range: ${lv}`);
  }
  for (const evo of sp.evolutions) {
    if (!SPECIES[evo.into]) err(`[species ${sp.name}] evolves into unknown species ${evo.into}`);
    if (evo.method === 'level' && !evo.level) err(`[species ${sp.name}] level evolution has no level`);
  }
  // A species you can meet must be able to act on the turn you meet it.
  if (!sp.learnset.some(([lv]) => lv <= 1)) err(`[species ${sp.name}] knows no move at level 1`);
}

for (const it of Object.values(ITEMS)) {
  if (it.use?.kind === 'tm' && !MOVES[it.use.move]) err(`[item ${it.id}] TM teaches unknown move ${it.use.move}`);
}

// ---- report ---------------------------------------------------------------

for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  ERR   ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s) across ${Object.keys(MAPS).length} maps`);
process.exit(errors.length ? 1 : 0);
