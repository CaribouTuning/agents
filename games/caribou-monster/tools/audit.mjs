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
import fs from 'node:fs';
import { MAPS } from '../src/data/maps/index.js';
import {
  WORLD_POS, worldGraph, reachableFrom, edgeOf, linksOf, directionHolds, OPPOSITE,
} from '../src/data/maps/world.js';
import { tileDef } from '../src/render/tiles.js';
import { FIELD_MOVES, badgeFor, storyGateFor, moveForTile } from '../src/game/fieldmoves.js';
import { GYMS, builtGyms } from '../src/data/campaign.js';
import * as STORY_MOD from '../src/data/story.js';
import { unrenderable } from '../src/render/font.js';
import { objective, OBJECTIVE_MAX, ENTRIES as JOURNAL_ENTRIES } from '../src/game/journal.js';
import { PHASES, phaseAt, tintFor } from '../src/game/clock.js';
import { SPECIES } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';
import { TYPES } from '../src/data/types.js';
import { ITEMS, martStock, departmentStock } from '../src/data/items.js';
import { TRAINERS } from '../src/data/trainers.js';
import { PROS, TOURNAMENTS, RANKS, PRO_LIST, roundsFor, pointsForFinish } from '../src/data/circuit.js';
import { HEADLINES, BODIES, PRESS_QUESTIONS, OUTLETS, ANALYSTS } from '../src/data/news.js';
import {
  isKnownSlot, isKnownClause, worldSnapshot, RANK_IDS,
} from '../src/game/overworld/gossip.js';
import { PLAYERS } from '../src/game/players.js';
import { FLAGS } from '../src/game/storyflags.js';
import { SCRIPTS } from '../src/game/overworld/scripts.js';
import { ABILITIES, INERT_ABILITIES } from '../src/game/battle/abilities.js';
import { createGameState } from '../src/game/state.js';

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
    // Somebody who walks off when a flag flips is a locked door, not a wall.
    // Same reasoning as a cuttable tree: the player gets past them eventually,
    // so the loose pass treats them as passable and the strict pass does not —
    // which is what makes the "only reachable if an NPC moves" warning useful.
    if (!strict && n.goneWhen) continue;
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
  // An obstacle that answers to a field move is a locked door, not a wall:
  // the player gets through it eventually, so reachability has to treat it as
  // passable. Whether they can ever hold the key is checked separately below.
  if (def.field) return { x: nx, y: ny };
  // Deep water answers to Surf the way a cuttable tree answers to Cut. It has
  // no obstacle tile of its own — Surf changes what counts as ground — so it
  // has to be named here or every water crossing reads as a dead end.
  if (def.water && !def.ledge) return { x: nx, y: ny };
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
  // A warp that lands on its own map is a lift, not a door: Byron's Gym is
  // three galleries with no stairs, and walking the tiles alone would report
  // two thirds of it as unreachable. Stepping on a pad IS a way to get where
  // it goes, so the flood fill follows it.
  const pads = new Map();
  for (const w of map.warps) if (w.to === map.id) pads.set(`${w.x},${w.y}`, { x: w.tx, y: w.ty });
  const visit = (p) => {
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) return;
    seen.add(k);
    queue.push(p);
    const pad = pads.get(k);
    if (pad) visit(pad);
  };
  {
    const pad = pads.get(`${start.x},${start.y}`);
    if (pad) visit(pad);
  }
  while (queue.length) {
    const cur = queue.shift();
    for (const dir of Object.keys(DIRS)) {
      const next = step(map, block, cur.x, cur.y, dir);
      if (!next) continue;
      visit(next);
    }
  }
  return seen;
}

// Which edge of a map a warp landing sits against. A landing is always a
// tile or two inside the border — you arrive next to the seam, not on it —
// so this is a band test. Anything further in than BAND is not an edge
// landing at all, which is its own (softer) complaint.
const BAND = 3;
function landingEdge(map, x, y) {
  const d = [
    ['north', y], ['south', map.height - 1 - y],
    ['west', x], ['east', map.width - 1 - x],
  ].filter(([, v]) => v >= 0 && v <= BAND).sort((a, b) => a[1] - b[1]);
  return d.length ? d[0][0] : null;
}

// Flags the story actually sets: the fixed table, a `beat_<trainer>` per
// trainer, and a `badge<n>` per badge. A `when: { flag: ... }` naming anything
// else is a branch that can never fire.
const KNOWN_FLAGS = new Set([
  ...Object.values(FLAGS),
  ...Object.keys(TRAINERS).map((id) => `beat_${id}`),
  ...Array.from({ length: 8 }, (_, i) => `badge${i + 1}`),
]);

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
  if (map.id === 'matthew_house' || map.id === 'sammy_house') {
    pts.push({ x: 5, y: 5, from: 'new game spawn' });
  }
  return pts;
}

// ---- how big a place ought to feel -----------------------------------------
//
// Twinleaf was larger than Sandgem, which meant the two-house village the
// game opens in sprawled and the coastal town with the beach felt cramped.
// Footprint is most of what makes a place read as a village or a city, so
// the intended order is written down rather than left to whoever last edited
// a tile grid. The bands are deliberately loose — this catches "these two are
// the wrong way round", not "this is forty tiles out".
const SIZE_BANDS = {
  village: ['twinleaf', 'floaroma', 'celestic', 'solaceon'],
  town: ['sandgem', 'pastoria', 'oreburgh'],
  city: ['eterna', 'canalave', 'hearthome', 'veilstone', 'jubilife'],
};

function checkTownSizes() {
  const area = (id) => (MAPS[id] ? MAPS[id].width * MAPS[id].height : null);
  const biggest = (band) => Math.max(...SIZE_BANDS[band].map(area).filter(Boolean));
  const smallest = (band) => Math.min(...SIZE_BANDS[band].map(area).filter(Boolean));

  if (biggest('village') >= smallest('town')) {
    for (const v of SIZE_BANDS.village) {
      for (const t of SIZE_BANDS.town) {
        if (area(v) && area(t) && area(v) >= area(t)) {
          err(`[size] ${v} (${area(v)}) is not smaller than ${t} (${area(t)}) — a village should not sprawl further than a town`);
        }
      }
    }
  }
  if (biggest('town') >= smallest('city')) {
    for (const t of SIZE_BANDS.town) {
      for (const c of SIZE_BANDS.city) {
        if (area(t) && area(c) && area(t) >= area(c)) {
          warn(`[size] ${t} (${area(t)}) is not smaller than ${c} (${area(c)})`);
        }
      }
    }
  }
  // Twinleaf is where the game starts and the smallest thing in it.
  const smallestTown = Object.values(MAPS)
    .filter((m) => m.kind === 'town' || m.kind === 'city')
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
  if (smallestTown && smallestTown.id !== 'twinleaf') {
    err(`[size] ${smallestTown.id} is smaller than twinleaf — Twinleaf should be the smallest place in Sinnoh`);
  }
}

// ---- checks ---------------------------------------------------------------

for (const map of Object.values(MAPS)) {
  const tag = `[${map.id}]`;
  const entries = entryPoints(map);

  // A map with no inbound warp is fine if a script walks the player into it —
  // proved by reading the script source rather than trusting a flag on the map.
  const scriptEntered = Object.values(SCRIPTS).some((fn) => String(fn).includes(`'${map.id}'`));
  if (!entries.length && map.warps.length && !scriptEntered) {
    warn(`${tag} nothing warps into this map and no script enters it`);
  }

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
    // A gated warp names a flag. A typo there is a door that never opens.
    if (w.requires) {
      if (!KNOWN_FLAGS.has(w.requires)) {
        err(`${tag} warp at ${w.x},${w.y} waits on unknown flag "${w.requires}"`);
      }
      if (!w.refuse) {
        warn(`${tag} warp at ${w.x},${w.y} is gated but says nothing when it refuses`);
      }
    }
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

    // Walking north off the top of a map has to put you at the BOTTOM of the
    // next one. Landing on the same side you left from is the bug that made
    // the region feel like one road that kept extending north: you stepped
    // off Route 201 heading up and arrived at the top of Sandgem, facing a
    // town you had just walked past the far side of.
    // Only region seams. A door out of a shop is on the building's south
    // wall too, and there is nothing wrong with that.
    const leaves = w.edge ? edgeOf(map, w) : null;
    if (leaves) {
      const want = OPPOSITE[leaves];
      const got = landingEdge(dest, w.tx, w.ty);
      if (got && got !== want) {
        err(`${tag} warp at ${w.x},${w.y} leaves the ${leaves} edge but lands on the `
          + `${got} edge of ${w.to} — it should land ${want}`);
      } else if (!got) {
        warn(`${tag} warp at ${w.x},${w.y} leaves the ${leaves} edge but lands in the `
          + `middle of ${w.to} at ${w.tx},${w.ty}`);
      }
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

  // 9. Encounter tables must reference real species — including the ones the
  // clock swaps in. A nocturnal roster nobody validates is a roster that
  // crashes the first time somebody plays after eight at night.
  const tables = [];
  for (const slot of [map.encounters?.grass, map.encounters?.cave, map.encounters?.fish]) {
    if (!slot) continue;
    tables.push([slot, 'default']);
    for (const phase of ['morning', 'day', 'night']) {
      if (slot[phase]) tables.push([slot[phase], phase]);
    }
  }
  for (const [t, when] of tables) {
    if (!Array.isArray(t.table)) { err(`${tag} ${when} encounter table has no entries`); continue; }
    if (!(t.min <= t.max)) err(`${tag} ${when} encounter level range is inverted (${t.min}-${t.max})`);
    for (const [id] of t.table) {
      if (!SPECIES[id]) err(`${tag} ${when} encounter table references unknown species ${id}`);
    }
  }
  if (map.kind === 'route' && !map.encounters) {
    const hasGrass = map.tiles.some((r) => r.includes('"'));
    if (hasGrass) err(`${tag} has tall grass but no encounter table`);
  }
  // Grass with no table (or a table with no grass) is a content mistake.
  const hasTall = map.tiles.some((r) => r.includes('"'));
  if (hasTall && !map.encounters?.grass) err(`${tag} has tall grass but no grass encounters`);
  if (map.encounters?.grass && !hasTall) warn(`${tag} defines grass encounters but has no tall grass`);

  // Water you can fish, and water you cannot. A rod that says "nothing lives
  // in this water" on every coast in the game is a rod nobody uses twice.
  const hasWater = map.tiles.some((r) => r.includes('~') || r.includes('-'));
  if (map.encounters?.fish && !hasWater) err(`${tag} defines a fishing table but has no water`);
  if (hasWater && map.kind !== 'indoor' && !map.encounters?.fish) {
    warn(`${tag} has water but nothing to catch in it`);
  }

  // Soft soil has to be somewhere you can stand next to and face. A bed you
  // can only stand *on* is a bed you can never plant in.
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!tileDef(map.tiles[y][x]).soil) continue;
      const spot = { x, y, id: `soil ${x},${y}` };
      if (!adjacentOk(spot)) err(`${tag} soft soil at ${x},${y} cannot be reached to plant in`);
      if (map.npcs.some((n) => n.x === x && n.y === y)) err(`${tag} soft soil at ${x},${y} has an NPC standing in it`);
      if (map.objects.some((o) => o.x === x && o.y === y)) err(`${tag} soft soil at ${x},${y} has an item lying in it`);
      if (map.warps.some((w) => w.x === x && w.y === y)) err(`${tag} soft soil at ${x},${y} is also a warp`);
    }
  }
}

// ---- the region as a whole -------------------------------------------------
//
// A world made of correct maps can still be a bad world. These are the checks
// about the shape of the region rather than the contents of any one map: that
// travel is two-way, that the geography agrees with the doors, and that the
// place is a network rather than a corridor.
{
  const g = worldGraph();

  for (const map of Object.values(MAPS)) {
    if (map.kind === 'indoor') continue;
    if (map.subArea) continue;
    if (!WORLD_POS[map.id]) err(`[world] ${map.id} is an outdoor map with no world position`);
  }
  for (const id of Object.keys(WORLD_POS)) {
    if (!MAPS[id]) err(`[world] world position for ${id}, which is not a map`);
  }

  for (const id of g.ids) {
    const node = g.nodes[id];
    for (const [dir, to] of linksOf(id)) {
      const other = g.nodes[to];
      if (!other) continue;

      // Going somewhere has to mean you can come back the way you came.
      const backs = linksOf(to).filter(([, t]) => t === id);
      if (!backs.length) {
        // A map whose only way in is a cutscene is allowed a one-way door out.
        if (MAPS[id].scriptEntry) continue;
        err(`[world] ${id} leads ${dir} to ${to}, but ${to} has no way back`);
        continue;
      }
      if (!backs.some(([d]) => d === OPPOSITE[dir])) {
        err(`[world] ${id} goes ${dir} to ${to}, but ${to} comes back ${backs.map(([d]) => d).join('/')} — that is not a direction, it is a knot`);
      }

      // And the geography has to agree with the door. This is the check that
      // would have caught the region being one road that only ever went up.
      if (!directionHolds(dir, node, other)) {
        err(`[world] ${id} leads ${dir} to ${to}, but ${to} is at ${other.x},${other.y} and ${id} is at ${node.x},${node.y}`);
      }
    }
    // Two places may not sit on the same square of the region.
    for (const other of g.ids) {
      if (other <= id) continue;
      const o = g.nodes[other];
      if (o.x === node.x && o.y === node.y) {
        err(`[world] ${id} and ${other} are both at ${node.x},${node.y}`);
      }
    }
  }

  // Everywhere has to be walkable to from the start of the game.
  const reach = reachableFrom('twinleaf');
  const marooned = g.ids.filter((id) => !reach.has(id)
    && g.nodes[id].kind !== 'underground'
    && !MAPS[id].scriptEntry
    && MAPS[id].warps.length);
  for (const id of marooned) warn(`[world] ${id} cannot be walked to from Twinleaf`);

  // And the region has to actually branch. A chain of maps is not a world,
  // however many maps are in it.
  const junctions = g.ids.filter((id) => Object.values(g.nodes[id].links).filter((l) => l.length).length >= 3);
  if (junctions.length < 2) {
    err(`[world] only ${junctions.length} place(s) have three ways out — this is a corridor, not a region`);
  }
  const dirsUsed = new Set();
  for (const id of g.ids) for (const [d] of linksOf(id)) dirsUsed.add(d);
  for (const d of ['north', 'south', 'east', 'west']) {
    if (!dirsUsed.has(d)) err(`[world] nothing in the region leads ${d}`);
  }

  // Every warp that sits on the edge of a map must be marked as one, or the
  // graph will quietly miss a road.
  for (const map of Object.values(MAPS)) {
    if (map.kind === 'indoor') continue;
    for (const w of map.warps) {
      const onEdge = edgeOf(map, w);
      const target = MAPS[w.to];
      if (onEdge && target && target.kind !== 'indoor' && !w.edge
        && WORLD_POS[map.id] && WORLD_POS[w.to]) {
        warn(`[${map.id}] warp at ${w.x},${w.y} is on the ${onEdge} edge but is not marked edge:true`);
      }
    }
  }
}

// ---- progression gates -----------------------------------------------------
//
// A locked door is only fair if the key exists. These check that every field
// move the world uses can actually be obtained, that the badge authorising it
// comes from a Gym that has been built, and that no obstacle is standing in
// the way of something the player needs before they could possibly clear it.
{
  const usedTiles = new Map();      // field id -> [where]
  for (const map of Object.values(MAPS)) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const id = moveForTile(map.tiles[y][x]);
        if (!id) continue;
        if (!usedTiles.has(id)) usedTiles.set(id, []);
        usedTiles.get(id).push(`${map.id}@${x},${y}`);
      }
    }
  }

  for (const [id, where] of usedTiles) {
    const spec = FIELD_MOVES[id];
    // The move has to be a real move.
    if (!MOVES[spec.move]) {
      err(`[gate] ${id} clears tiles but ${spec.move} is not a move`);
      continue;
    }
    // Something in the world has to hand it over.
    const hmId = Object.keys(ITEMS).find((i) => ITEMS[i].hm && ITEMS[i].move === spec.move);
    if (!hmId) { err(`[gate] ${id} blocks the way at ${where[0]} but no HM teaches ${spec.move}`); continue; }
    const placed = Object.values(MAPS).some((m) => m.objects.some((o) => o.item === hmId))
      || Object.values(SCRIPTS).some((fn) => String(fn).includes(`'${hmId}'`));
    if (!placed) err(`[gate] ${hmId} exists but nothing in the world gives it out`);

    // And the badge that authorises it has to come from a Gym that is built.
    const n = badgeFor(id);
    if (n !== null) {
      const gym = GYMS.find((g) => g.n === n);
      if (!gym) err(`[gate] ${id} is authorised by badge ${n}, which no Gym gives`);
      else if (!MAPS[gym.map]) {
        err(`[gate] ${id} blocks the way at ${where[0]}, but ${gym.leader}'s Gym is not built yet`);
      }
    } else if (!storyGateFor(id)) {
      err(`[gate] nothing authorises ${id}, so its obstacles can never be cleared`);
    }
  }

  // Every Gym on the spine that exists must give the badge the spine says.
  for (const g of GYMS) {
    if (!MAPS[g.map]) continue;
    const t = TRAINERS[g.trainer];
    if (!t) { err(`[campaign] ${g.leader}'s Gym is built but trainer ${g.trainer} is missing`); continue; }
    if (t.badge !== g.n) err(`[campaign] ${g.leader} gives badge ${t.badge}, the spine says ${g.n}`);
    if (t.badgeName !== g.badge) err(`[campaign] ${g.leader} gives the ${t.badgeName}, the spine says the ${g.badge}`);
    if (g.tm && !ITEMS[g.tm]) err(`[campaign] ${g.leader} rewards ${g.tm}, which is not an item`);
  }
  // Gyms must be built in order: a player cannot reach the fourth badge with
  // no third Gym in the world to take it from.
  const built = GYMS.filter((g) => MAPS[g.map]).map((g) => g.n);
  for (let i = 0; i < built.length; i++) {
    if (built[i] !== i + 1) {
      err(`[campaign] Gyms are built out of order: have ${built.join(',')}`);
      break;
    }
  }
}

// ---- data-level checks ----------------------------------------------------

// Held items. The engine understands exactly three kinds; anything else in the
// table is a description of an effect that does not happen, which is the one
// thing this project refuses to ship.
const HELD_KINDS = ['pinch-heal', 'pinch-cure', 'boost-type', 'friendship'];
for (const [id, item] of Object.entries(ITEMS)) {
  if (!item.held) continue;
  if (!HELD_KINDS.includes(item.held.kind)) {
    err(`[item ${id}] held effect '${item.held.kind}' is not implemented by the engine`);
  }
  if (item.held.kind === 'boost-type' && !TYPES.includes(item.held.type)) {
    err(`[item ${id}] boosts unknown type ${item.held.type}`);
  }
}


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

// ---- conditional dialogue ---------------------------------------------------
// NPC lines are data, and data that never runs is data that rots. Every branch
// is checked here: the conditions have to be ones the resolver understands,
// the slots have to be ones it can fill, and every tree has to end in a line
// that is always true — otherwise an NPC would one day say nothing at all.

const SNAP = worldSnapshot(createGameState({ name: 'Audit' }));

function checkLine(tag, line) {
  if (typeof line !== 'string') { err(`${tag} has a non-string line`); return; }
  for (const m of line.matchAll(/\{(\w+)\}/g)) {
    if (!isKnownSlot(m[1])) err(`${tag} uses unknown slot {${m[1]}}`);
  }
  // Each authored line becomes its own dialogue page. The narrowest screen the
  // game supports fits 33 characters across and 3 lines down, so anything over
  // 99 characters splits mid-sentence across two pages.
  if (line.length > 99) warn(`${tag} has a ${line.length}-character line; it will split across two pages in portrait`);
}

const SPECIES_NAMES = new Set(Object.values(SPECIES).map((sp) => sp.name));

function checkCondition(tag, when) {
  if (!when) return;
  const clauses = Array.isArray(when) ? when : [when];
  for (const c of clauses) {
    for (const [k, v] of Object.entries(c)) {
      if (k === 'all' || k === 'any') {
        if (!Array.isArray(v) || !v.length) err(`${tag} has an empty "${k}"`);
        else for (const sub of v) checkCondition(tag, sub);
        continue;
      }
      if (k === 'not') { checkCondition(tag, v); continue; }
      // The clause list comes from the resolver itself, so this cannot drift
      // from what `matches` actually implements.
      if (!isKnownClause(k)) { err(`${tag} uses unknown condition "${k}"`); continue; }

      // Keys are not enough: a value the resolver cannot resolve is just as
      // dead as a key it does not know, and reads as if it works.
      if (k === 'rank' && !RANK_IDS.includes(v)) {
        err(`${tag} names unknown rank "${v}" (expected one of ${RANK_IDS.join(', ')})`);
      }
      if ((k === 'flag' || k === 'notFlag') && !KNOWN_FLAGS.has(v)) {
        err(`${tag} names unknown flag "${v}"`);
      }
      // A `playing` clause naming somebody who is not one of the two is a
      // branch that can never fire — the exact shape of bug that leaves an
      // NPC saying the wrong thing forever.
      if (k === 'playing' && !PLAYERS.some((pl) => pl.key === v || pl.look === v)) {
        err(`${tag} names unknown player "${v}"`);
      }
      if (k === 'starter' && !SPECIES_NAMES.has(v)) {
        err(`${tag} names unknown starter species "${v}"`);
      }
      if (['badges', 'maxBadges', 'caught', 'party', 'leadLevel', 'titles', 'streak',
        'hype', 'respect'].includes(k) && typeof v !== 'number') {
        err(`${tag} condition "${k}" expects a number, got ${JSON.stringify(v)}`);
      }
      if (['joined', 'champion', 'beatRival', 'inEvent', 'topTen'].includes(k) && typeof v !== 'boolean') {
        err(`${tag} condition "${k}" expects true or false, got ${JSON.stringify(v)}`);
      }
    }
  }
}

function checkDialogue(tag, dialogue) {
  if (!dialogue) return;
  if (!Array.isArray(dialogue)) { err(`${tag} dialogue is not a list`); return; }
  const flat = dialogue.every((d) => typeof d === 'string');
  if (flat) { dialogue.forEach((l) => checkLine(tag, l)); return; }

  let hasFallback = false;
  dialogue.forEach((entry, i) => {
    if (typeof entry === 'string') { checkLine(tag, entry); hasFallback = true; return; }
    checkCondition(`${tag}[${i}]`, entry.when);
    if (!entry.when) hasFallback = true;
    const groups = entry.pool || (entry.lines ? [entry.lines] : []);
    if (!groups.length) err(`${tag}[${i}] has neither lines nor a pool`);
    groups.forEach((g, j) => {
      if (!Array.isArray(g) || !g.length) { err(`${tag}[${i}] pool entry ${j} is empty`); return; }
      g.forEach((l) => checkLine(`${tag}[${i}]`, l));
    });
    if (!entry.when && i !== dialogue.length - 1) {
      warn(`${tag}[${i}] is unconditional but not last; nothing after it can ever fire`);
    }
  });
  if (!hasFallback) err(`${tag} has no unconditional fallback; this NPC can fall silent`);
}

for (const map of Object.values(MAPS)) {
  for (const n of map.npcs) {
    // Whether an NPC is standing there at all is as much a story statement as
    // anything they say. A misspelt flag here means somebody is on the screen
    // during a scene about them having left it.
    for (const k of ['goneWhen', 'onlyWhen', 'removeAfter']) {
      if (n[k] && !KNOWN_FLAGS.has(n[k])) {
        err(`[${map.id}/${n.id}] ${k} names unknown flag "${n[k]}"`);
      }
    }
    checkDialogue(`[${map.id}/${n.id}] dialogue`, n.dialogue);
    checkDialogue(`[${map.id}/${n.id}] after`, n.after);
    if (n.dialogueAfter) checkDialogue(`[${map.id}/${n.id}] dialogueAfter`, n.dialogueAfter.lines);
  }
  for (const sg of map.signs || []) {
    for (const m of String(sg.text).matchAll(/\{(\w+)\}/g)) {
      if (!isKnownSlot(m[1])) err(`[${map.id}] sign at ${sg.x},${sg.y} uses unknown slot {${m[1]}}`);
    }
  }
}

// ---- World Circuit ---------------------------------------------------------
// The circuit generates teams and brackets at runtime, so a bad pool or an
// unreachable tier would only surface mid-tournament. Prove it here instead.

for (const pro of PRO_LIST) {
  if (!pro.pool.length) err(`[pro ${pro.id}] has an empty species pool`);
  for (const sp of pro.pool) if (!SPECIES[sp]) err(`[pro ${pro.id}] unknown species ${sp}`);
  // A team is built from distinct pool entries, up to four at the top tier.
  if (new Set(pro.pool).size < 4) err(`[pro ${pro.id}] pool has fewer than 4 distinct species`);
  for (const k of ['pre', 'win', 'lose']) {
    if (!pro.lines[k] || !pro.lines[k].length) err(`[pro ${pro.id}] has no '${k}' lines`);
  }
  if (!pro.tag || !pro.bio) err(`[pro ${pro.id}] is missing a tag or bio`);
}

for (const t of TOURNAMENTS) {
  const rounds = roundsFor(t.entrants);
  if (!Number.isInteger(rounds) || rounds < 1) err(`[event ${t.id}] entrants must be a power of two`);
  if (t.requires < 0 || t.requires >= RANKS.length) err(`[event ${t.id}] requires unknown rank ${t.requires}`);
  // The bracket needs enough distinct pros to fill every slot but the player's.
  if (t.field.length + 1 < t.entrants && PRO_LIST.length < t.entrants - 1) {
    err(`[event ${t.id}] cannot fill a ${t.entrants}-draw`);
  }
  if (new Set(t.field).size !== t.field.length) err(`[event ${t.id}] field lists a pro twice`);
  for (const id of t.field) if (!PROS[id]) err(`[event ${t.id}] unknown pro ${id}`);
  if (t.level < 2 || t.level > 100) err(`[event ${t.id}] level out of range: ${t.level}`);
  // Every finish must pay something, and winning must pay the most.
  for (let r = 0; r <= rounds; r++) {
    const pts = pointsForFinish(t, r);
    if (pts <= 0) err(`[event ${t.id}] finish at round ${r} pays nothing`);
    if (pts > t.cp) err(`[event ${t.id}] finish at round ${r} pays more than the title`);
  }
}

// Rank gates must be reachable: the points from the events a rank unlocks have
// to be able to carry the player to the next rank, or the ladder dead-ends.
{
  let cp = 0;
  for (let i = 0; i < RANKS.length - 1; i++) {
    const open = TOURNAMENTS.filter((t) => t.requires <= i);
    if (!open.length) { err(`[rank ${RANKS[i].id}] unlocks no events`); break; }
    const best = Math.max(...open.map((t) => t.cp));
    if (best <= 0) { err(`[rank ${RANKS[i].id}] unlocks no event worth points`); break; }
    // Repeatable events mean this is always eventually reachable; flag only a
    // gate that a full career of the best available event cannot clear.
    if (RANKS[i + 1].cp - cp > best * 40) {
      err(`[rank ${RANKS[i + 1].id}] is unreachable from ${RANKS[i].id}`);
    }
    cp = RANKS[i + 1].cp;
  }
}

// Templates: every slot a headline uses must be one the press desk fills.
// Kept in step with the slot table at the top of data/news.js. Each one means
// exactly one thing; a generic {n} used to mean four, and the reporters
// disagreed about which.
const KNOWN_SLOTS = new Set([
  'p', 'o', 't', 'r', 'mon', 'round', 'blurb', 'analyst',
  'surv', 'turns', 'cp', 'wins', 'streak', 'record', 'entrants', 'week',
]);
for (const [kind, list] of Object.entries(HEADLINES)) {
  if (!list.length) err(`[news ${kind}] has no headlines`);
  for (const tpl of list) {
    for (const m of tpl.matchAll(/\{(\w+)\}/g)) {
      if (!KNOWN_SLOTS.has(m[1])) err(`[news ${kind}] unknown slot {${m[1]}}`);
    }
  }
}
for (const [kind, list] of Object.entries(BODIES)) {
  for (const tpl of list) {
    for (const m of tpl.matchAll(/\{(\w+)\}/g)) {
      if (!KNOWN_SLOTS.has(m[1])) err(`[news body ${kind}] unknown slot {${m[1]}}`);
    }
  }
}
for (const [kind, q] of Object.entries(PRESS_QUESTIONS)) {
  if (q.options.length < 2) err(`[press ${kind}] needs at least two answers`);
  for (const o of q.options) {
    if (!o.line || !o.text) err(`[press ${kind}] an option is missing text`);
  }
}
if (!OUTLETS.length || !ANALYSTS.length) err('[news] no outlets or analysts defined');

// ---- abilities ---------------------------------------------------------------
// Every ability printed on a summary screen has to be either implemented or on
// the knowingly-inert list. A third state — a name the engine has never heard
// of — is how a mechanic silently stops existing.

for (const sp of Object.values(SPECIES)) {
  for (const name of sp.abilities || []) {
    if (!ABILITIES[name] && !INERT_ABILITIES[name]) {
      err(`[species ${sp.name}] has ability "${name}", which is neither implemented nor listed as inert`);
    }
  }
}
for (const name of Object.keys(INERT_ABILITIES)) {
  if (ABILITIES[name]) err(`[ability ${name}] is both implemented and listed as inert`);
}

// ---- renderable text --------------------------------------------------------
// The font draws a blank for anything it has no glyph and no fold for, so a
// stray symbol is invisible in game and fine in the source. Every string the
// player can read goes through the font, so every one of them is checked here.

function checkText(tag, text) {
  if (text == null) return;
  if (Array.isArray(text)) { text.forEach((t) => checkText(tag, t)); return; }
  if (typeof text === 'object') {
    for (const v of Object.values(text)) checkText(tag, v);
    return;
  }
  if (typeof text !== 'string') return;
  // Slot markers are replaced before anything reaches the font, so they are
  // not the font's problem — the slot names themselves are checked elsewhere.
  const bad = unrenderable(text.replace(/\{\w+\}/g, ''));
  if (bad.length) err(`${tag} contains characters the font cannot draw: ${bad.map((c) => JSON.stringify(c)).join(' ')}`);
}

for (const sp of Object.values(SPECIES)) {
  checkText(`[species ${sp.id}]`, [sp.name, sp.dex, ...(sp.abilities || [])]);
}
for (const mv of Object.values(MOVES)) checkText(`[move ${mv.id}]`, [mv.name, mv.desc]);
for (const it of Object.values(ITEMS)) checkText(`[item ${it.id}]`, [it.name, it.desc, it.pocket]);
for (const t of Object.values(TRAINERS)) {
  checkText(`[trainer ${t.id}]`, [t.name, t.cls, t.intro, t.defeat, t.badgeName]);
}
for (const map of Object.values(MAPS)) {
  checkText(`[map ${map.id}] name`, map.name);
  for (const n of map.npcs) checkText(`[map ${map.id}/${n.id}]`, [n.name, n.dialogue, n.after]);
  for (const sg of map.signs || []) checkText(`[map ${map.id}] sign ${sg.x},${sg.y}`, sg.text);
}
for (const r of RANKS) checkText(`[rank ${r.id}]`, [r.name, r.blurb]);
for (const pro of PRO_LIST) {
  checkText(`[pro ${pro.id}]`, [pro.name, pro.tag, pro.bio, pro.region, pro.style, pro.lines]);
}
for (const t of TOURNAMENTS) checkText(`[event ${t.id}]`, [t.name, t.short, t.venue, t.tier, t.blurb]);
checkText('[news]', [HEADLINES, BODIES, PRESS_QUESTIONS, ANALYSTS]);
for (const o of OUTLETS) checkText(`[outlet ${o.id}]`, o.name);

/**
 * Every Key Item the game can act on has to be handed to somebody.
 *
 * The Town Map was defined, had a working screen behind it, and was given out
 * by nobody — so the map simply did not exist in the game. Nothing caught it
 * because every individual piece was fine. This checks the join: an item the
 * UI knows how to use must appear in a `give` somewhere, or on the ground, or
 * in a shop.
 */
function checkKeyItemsReachable() {
  const src = [
    fs.readFileSync(new URL('../src/game/overworld/scripts.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'),
  ].join('\n');
  const onGround = new Set();
  for (const m of Object.values(MAPS)) for (const o of m.objects || []) onGround.add(o.item);

  for (const [id, item] of Object.entries(ITEMS)) {
    if (!item.key) continue;
    const given = src.includes(`'${id}'`) || onGround.has(id);
    if (given) continue;
    // An HM belongs to a Gym. If that Gym is not built yet, the HM having no
    // owner is unfinished content rather than a broken join.
    const gym = GYMS.find((g) => g.tm === id || `hm0${g.n}` === id);
    const pending = /^hm\d\d$/.test(id) && GYMS.some((g) => !MAPS[g.map]);
    if (pending) {
      warn(`[item] "${item.name}" has no owner yet — the Gym that hands it over is not built`);
    } else {
      err(`[item] key item "${item.name}" (${id}) is never given to the player — it exists but cannot be got`);
    }
    void gym;
  }
}

/**
 * Every evolution has to be one the world can actually trigger.
 *
 * This rule exists because stone evolution in this game never once fired: the
 * dex emitted veekun's numeric item id, the bag passed the string on the
 * item, and the two were compared to each other forever. Nothing was broken
 * enough to crash, so nothing said so.
 */
function checkEvolutionsReachable() {
  const stoneItems = new Map();      // stone key -> item id
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.use && it.use.kind === 'stone') stoneItems.set(it.use.stone, id);
  }
  const sold = new Set([...martStock(8), ...departmentStock(8)]);
  const onGround = new Set();
  for (const map of Object.values(MAPS)) {
    for (const o of map.objects || []) if (o.item) onGround.add(o.item);
  }
  const givenBy = fs.readFileSync(new URL('../src/game/overworld/scripts.js', import.meta.url), 'utf8');

  const seenStones = new Set();
  const seenMaps = new Set();
  for (const sp of Object.values(SPECIES)) {
    for (const evo of sp.evolutions || []) {
      if (evo.method === 'stone') {
        if (!stoneItems.has(evo.stone)) {
          err(`[species ${sp.name}] evolves with a "${evo.stone}" stone, and no item is one`);
          continue;
        }
        seenStones.add(evo.stone);
      } else if (evo.method === 'location') {
        if (!MAPS[evo.map]) seenMaps.add(evo.map);
      }
    }
  }
  for (const stone of seenStones) {
    const item = stoneItems.get(stone);
    const reachable = sold.has(item) || onGround.has(item) || givenBy.includes(`'${item}'`);
    if (!reachable) err(`[item] the ${stone} stone exists but nothing in the world hands one over`);
  }
  for (const m of seenMaps) {
    warn(`[species] an evolution happens at "${m}", which is not built yet`);
  }
}

// ---- logic that does not make sense ---------------------------------------
//
// This block exists because of Hearthome. You walked in from the south, took
// one step, and were standing in a park — because the Amity Square door was
// on the arrival tile's doorstep and the building it belonged to blocked the
// entire road. Nothing in the audit was wrong about it, because nothing in
// the audit was looking at what a person actually does when they arrive.
//
// So these rules are written from the player's side: walk in, and check that
// what happens next makes sense.

/** No door may be waiting on the tile you arrive on, or the one after it. */
function checkDoorsInYourFace() {
  for (const map of Object.values(MAPS)) {
    const warpAt = new Map();
    for (const w of map.warps) warpAt.set(key(w), w);
    for (const src of Object.values(MAPS)) {
      for (const w of src.warps) {
        if (w.to !== map.id) continue;
        const landed = { x: w.tx, y: w.ty };
        const here = warpAt.get(key(landed));
        if (here) {
          err(`[${map.id}] arriving from ${src.id} lands ON the door to ${here.to}`);
          continue;
        }
        for (const n of neighbours(landed)) {
          const other = warpAt.get(key(n));
          // A door back the way you came is correct and expected; any other
          // door one step from where you land is a trap.
          if (other && other.to !== src.id) {
            err(`[${map.id}] arriving from ${src.id} at ${w.tx},${w.ty} puts the door to `
              + `${other.to} one step away at ${n.x},${n.y}`);
          }
        }
      }
    }
  }
}

/**
 * Every door on a map has to be reachable from every way into it, on foot.
 *
 * The old rule checked reachability from one arbitrary reference tile, which
 * is fine for proving a map is not in two halves and useless for proving you
 * can get from the south gate to the Gym.
 */
function checkEveryDoorReachableFromEveryEntrance() {
  for (const map of Object.values(MAPS)) {
    const entries = entryPoints(map);
    if (!entries.length) continue;
    for (const e of entries) {
      const seen = reachable(map, e, { strict: false });
      if (!seen.has(key(e))) continue;      // the entry itself is broken; said elsewhere
      for (const w of map.warps) {
        if (seen.has(key(w))) continue;
        // A gated warp you cannot reach yet is a gate, not a bug.
        if (w.requires) continue;
        err(`[${map.id}] you cannot walk from the ${e.from} entrance to the door at ${w.x},${w.y} `
          + `(to ${w.to}) without going through another door`);
      }
    }
  }
}

/** Somebody standing in a doorway is somebody blocking a doorway. */
function checkNobodyBlocksADoor() {
  for (const map of Object.values(MAPS)) {
    for (const n of map.npcs) {
      const d = at(map, n.x, n.y);
      if (!d) { err(`[${map.id}] ${n.id} stands outside the map at ${n.x},${n.y}`); continue; }
      // `overCounter` NPCs are meant to be standing on scenery: a shop clerk
      // behind a counter is the whole point of them.
      if (d.solid && !n.overCounter) {
        err(`[${map.id}] ${n.id} stands inside a solid '${d.name}' at ${n.x},${n.y}`);
      }
      const w = map.warps.find((ww) => ww.x === n.x && ww.y === n.y);
      if (w && !n.goneWhen && !n.removeAfter) {
        err(`[${map.id}] ${n.id} is standing in the doorway to ${w.to}`);
      }
    }
  }
}

/**
 * Flags that nothing sets, and flags that nothing reads.
 *
 * A gate waiting on a flag no script ever sets is a door that never opens; a
 * flag set by a script and read by nobody is a scene that changes nothing.
 * Both read as "the game is broken" long before anyone can say why.
 */
function checkFlagsJoinUp() {
  const src = [
    fs.readFileSync(new URL('../src/game/overworld/scripts.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../src/ui/overworld.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../src/game/fieldmoves.js', import.meta.url), 'utf8'),
    fs.readFileSync(new URL('../src/ui/battle.js', import.meta.url), 'utf8'),
  ].join('\n');

  const set = new Set();
  // Flags can be set four ways, and a rule that only knows one of them
  // reports three quarters of the game as broken.
  for (const m of src.matchAll(/setFlag\(\s*'([A-Za-z0-9_]+)'/g)) set.add(m[1]);
  for (const m of src.matchAll(/setStoryFlag\([^,]+,\s*'([A-Za-z0-9_]+)'/g)) set.add(m[1]);
  for (const m of src.matchAll(/setFlag\(\s*FLAGS\.([A-Z0-9_]+)/g)) {
    if (FLAGS[m[1]]) set.add(FLAGS[m[1]]);
  }
  for (const m of src.matchAll(/flags\.([A-Za-z0-9_]+)\s*=/g)) set.add(m[1]);
  // Flags built from a template — `readVolume${n}`, `${id}_read` — cannot be
  // named statically, so the fixed part of the name is recorded as a pattern
  // and anything matching it counts as set.
  const patterns = [];
  for (const m of src.matchAll(/setFlag\(\s*`([^`]+)`/g)) {
    const lit = m[1].replace(/\$\{[^}]*\}/g, '\u0000');
    patterns.push(new RegExp(`^${lit.split('\u0000').map(escapeRe).join('[A-Za-z0-9_]+')}$`));
  }
  // A gym badge sets its own flag through the campaign, not through a script.
  for (let i = 1; i <= 8; i++) set.add(`badge${i}`);
  for (const id of Object.keys(TRAINERS)) set.add(`beat_${id}`);
  // A map event's `flag` is its own once-only marker: the event system writes
  // it the moment the event fires, so it is set by definition.
  for (const map of Object.values(MAPS)) {
    for (const ev of map.events || []) if (ev.flag) set.add(ev.flag);
  }
  const isSet = (f) => set.has(f) || patterns.some((re) => re.test(f));

  const read = new Set();
  for (const map of Object.values(MAPS)) {
    for (const w of map.warps) if (w.requires) read.add(w.requires);
    for (const n of map.npcs) {
      for (const k of ['goneWhen', 'onlyWhen', 'removeAfter']) if (n[k]) read.add(n[k]);
      for (const d of [...(n.dialogue || []), ...(n.after || [])]) collectFlags(d && d.when, read);
    }
    for (const ev of map.events || []) if (ev.flag) read.add(ev.flag);
  }
  for (const m of src.matchAll(/flags\.([A-Za-z0-9_]+)/g)) read.add(m[1]);
  for (const m of src.matchAll(/FLAGS\.([A-Z0-9_]+)/g)) if (FLAGS[m[1]]) read.add(FLAGS[m[1]]);
  // `storyflags.js` inside an import path is not a flag called "js".
  read.delete('js');

  for (const f of read) {
    if (!isSet(f)) err(`[flag] "${f}" is waited on, but nothing in the game ever sets it`);
  }
  for (const f of Object.values(FLAGS)) {
    if (isSet(f) && !read.has(f)) warn(`[flag] "${f}" is set but nothing ever reads it`);
  }
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function collectFlags(when, into) {
  if (!when) return;
  const clauses = Array.isArray(when) ? when : [when];
  for (const c of clauses) {
    for (const [k, v] of Object.entries(c)) {
      if (k === 'all' || k === 'any') { for (const sub of v) collectFlags(sub, into); continue; }
      if (k === 'not') { collectFlags(v, into); continue; }
      if (k === 'flag' || k === 'notFlag') into.add(v);
    }
  }
}

/** Every script a map names has to exist, and every trainer has to be fightable. */
function checkScriptsAndTrainers() {
  for (const map of Object.values(MAPS)) {
    const named = [
      ...map.npcs.map((n) => [n.id, n.script]),
      ...(map.events || []).map((e, i) => [`event ${i}`, e.script]),
      ...(map.objects || []).map((o) => [o.id, o.script]),
    ];
    for (const [who, sc] of named) {
      if (sc && !SCRIPTS[sc]) err(`[${map.id}] ${who} runs a script "${sc}" that does not exist`);
    }
    for (const n of map.npcs) {
      if (!n.trainer) continue;
      const t = TRAINERS[n.trainer];
      if (!t) { err(`[${map.id}] ${n.id} is trainer "${n.trainer}", who does not exist`); continue; }
      if (!t.team || !t.team.length) err(`[trainer ${n.trainer}] has no Pokemon to send out`);
    }
  }
  for (const [id, t] of Object.entries(TRAINERS)) {
    for (const e of t.team || []) {
      // The rival's starter is not known until the player picks theirs, so it
      // is carried as `RIVAL_STARTER:<level>` and resolved at battle time.
      if (typeof e === 'string') {
        const m = /^RIVAL_STARTER:(\d+)$/.exec(e);
        if (!m) err(`[trainer ${id}] has an unreadable team entry "${e}"`);
        else if (!(+m[1] > 0 && +m[1] <= 100)) err(`[trainer ${id}] rival starter at level ${m[1]}`);
        continue;
      }
      if (!SPECIES[e.species]) err(`[trainer ${id}] has unknown species ${e.species}`);
      for (const mv of e.moves || []) {
        if (!MOVES[mv]) err(`[trainer ${id}] knows a move "${mv}" that does not exist`);
      }
      if (!(e.level > 0 && e.level <= 100)) err(`[trainer ${id}] has a Pokemon at level ${e.level}`);
    }
  }
}

/** A town you can heal in has to heal you somewhere you can stand. */
function checkHealPointsBelongToTheirTown() {
  for (const map of Object.values(MAPS)) {
    const hp = map.healPoint;
    if (!hp) continue;
    const home = MAPS[hp.map];
    if (!home) continue;   // said elsewhere
    // Healing in Hearthome must not put you in Solaceon. The heal point is
    // either this map or a building that warps back into it.
    if (hp.map !== map.id) {
      const comesBack = home.warps.some((w) => w.to === map.id);
      if (!comesBack) {
        err(`[${map.id}] heals you into ${hp.map}, which has no way back here`);
      }
    }
  }
}

/**
 * Nobody may state a number of Gyms, or put a Gym in the wrong town.
 *
 * Rowan told every player that Roark's Gym was in Jubilife — two towns early —
 * and that eight badges would get them into the League, in a game with six
 * Gyms in it. Neither line was wrong in any way a test could see, because
 * both were just prose. So the prose gets checked: a written-out number of
 * badges is refused outright (use the {leagueBadges} slot), and naming a Gym
 * leader in the same breath as a town has to be the town they are actually in.
 */
const STORY = STORY_MOD;

function checkNobodyMisstatesTheRoad() {
  const towns = {};
  for (const g of builtGyms(MAPS)) {
    towns[g.leader.toLowerCase()] = (MAPS[g.city] ? MAPS[g.city].name : g.city).toLowerCase();
  }
  // Two shapes, because the line that actually shipped was neither a plain
  // "eight badges" nor a plain "eight Gyms": it was "Eight of those and the
  // League has to let you in", which counts badges without naming them.
  const NUM = '(one|two|three|four|five|six|seven|eight|nine|ten)';
  const COUNT = new RegExp(`\\b${NUM}\\s+(?:more\\s+)?(gyms?|badges?)\\b`, 'i');
  const OF_THOSE = new RegExp(`\\b${NUM}\\s+of (?:those|them)\\b`, 'i');

  const lines = [];
  const take = (tag, d) => {
    if (!d) return;
    for (const entry of d) {
      if (typeof entry === 'string') { lines.push([tag, entry]); continue; }
      for (const g of entry.pool || (entry.lines ? [entry.lines] : [])) {
        for (const l of g) lines.push([tag, l]);
      }
    }
  };
  for (const map of Object.values(MAPS)) {
    for (const n of map.npcs) {
      take(`${map.id}/${n.id}`, n.dialogue);
      take(`${map.id}/${n.id}`, n.after);
    }
    for (const sg of map.signs || []) lines.push([`${map.id} sign`, sg.text]);
  }
  for (const [key, val] of Object.entries(STORY)) {
    const walk = (v, path) => {
      if (typeof v === 'string') { lines.push([`story.${path}`, v]); return; }
      if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(val, key);
  }

  for (const [tag, line] of lines) {
    const m = COUNT.exec(line) || (/badge|league|gym/i.test(line) && OF_THOSE.exec(line));
    if (m) {
      err(`[${tag}] writes out "${m[0]}" — use the {leagueBadges} slot so it cannot go stale`);
    }
    for (const [leader, town] of Object.entries(towns)) {
      if (!new RegExp(`\\b${leader}\\b`, 'i').test(line)) continue;
      // Only complain when the line names a DIFFERENT town in the same breath.
      for (const other of Object.values(MAPS)) {
        if (other.kind !== 'town' && other.kind !== 'city') continue;
        const nm = other.name.replace(/ (Town|City)$/, '');
        if (nm.toLowerCase() === town.replace(/ (town|city)$/, '')) continue;
        if (new RegExp(`\\b${nm}\\b`).test(line) && /gym/i.test(line)) {
          err(`[${tag}] puts ${leader}'s Gym near "${nm}" — it is in ${town}`);
        }
      }
    }
  }
}

/**
 * A scene nothing can reach is a scene that is not in the game.
 *
 * `SCRIPTS.commander` — Mars, the Galactic commander whose defeat is the ONLY
 * thing that sets `beatCommander`, which is the only thing that puts the
 * Aurora Charm on the floor, which is the only thing that opens the seam — was
 * written, tested by hand, and then placed on no map at all. She stood in the
 * cave as an ordinary trainer. You could beat her and nothing happened, and
 * the entire back half of the story was unreachable from a save that had done
 * everything right.
 */
function checkEveryScriptIsReachable() {
  const placed = new Set();
  for (const map of Object.values(MAPS)) {
    for (const n of map.npcs) if (n.script) placed.add(n.script);
    for (const e of map.events || []) if (e.script) placed.add(e.script);
    for (const o of map.objects || []) if (o.script) placed.add(o.script);
    if (map.stepOut && map.stepOut.script) placed.add(map.stepOut.script);
  }
  // Some scripts are called by other scripts or by the engine rather than
  // being placed on a tile. Those are reached, just not from the map data.
  // A script can also be run by the engine or by a menu — the Explorer Kit
  // starts the dig from the bag, not from a tile — so the whole of the UI and
  // game source counts as a place a script can be reached from.
  const dirs = ['../src/ui', '../src/game', '../src/game/overworld'];
  let src = '';
  for (const d of dirs) {
    const dir = new URL(`${d}/`, import.meta.url);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.js')) continue;
      src += fs.readFileSync(new URL(f, dir), 'utf8') + '\n';
    }
  }
  src += fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  for (const name of Object.keys(SCRIPTS)) {
    if (placed.has(name)) continue;
    const calledByName = new RegExp(`runScript\\(\\s*'${name}'|SCRIPTS\\.${name}\\s*\\(|scriptFor\\(\\s*'${name}'`).test(src);
    if (calledByName) continue;
    err(`[script] "${name}" is written but nothing on any map runs it`);
  }
}

/**
 * Every road out of a map has to be named inside the map.
 *
 * The Town Map draws Sinnoh as places joined by roads and is correct about
 * every one of them. The world said nothing: you could stand on Route 207
 * with four ways off it and no way at all to tell which was which, then open
 * the map and see four roads you could not identify. Twelve maps were like
 * that; Jubilife had four exits and named none of them.
 */
function checkEveryExitIsNamed() {
  for (const map of Object.values(MAPS)) {
    if (map.kind === 'indoor') continue;
    const links = linksOf(map.id);
    if (links.length < 2) continue;
    const said = [
      ...(map.labels || []).map((l) => l.text),
      ...(map.signs || []).map((sg) => sg.text),
    ].join(' ').toLowerCase();
    for (const [, to] of links) {
      const dest = MAPS[to];
      if (!dest) continue;
      const key = dest.name.replace(/ (Town|City)$/, '').toLowerCase();
      if (!said.includes(key)) {
        err(`[${map.id}] has a road to ${dest.name} and nothing in the map says so`);
      }
    }
  }
}

checkEveryExitIsNamed();
checkEveryScriptIsReachable();
checkNobodyMisstatesTheRoad();
checkKeyItemsReachable();
checkEvolutionsReachable();
checkTownSizes();
checkDoorsInYourFace();
checkEveryDoorReachableFromEveryEntrance();
checkNobodyBlocksADoor();
checkFlagsJoinUp();
checkScriptsAndTrainers();
checkHealPointsBelongToTheirTown();

// NOTE: the report is printed at the very BOTTOM of this file, after every
// check has run. It used to be printed here, in the middle, which meant every
// rule written below it counted its findings into the total and then never
// showed them — the audit would say "1 error" and print nothing at all. That
// has now happened twice. The printing goes last, permanently.
// ---- the guide bar tells the truth, in a line that fits -------------------
// The objective is the only instruction most of the world gives the player,
// and it is drawn in one strip on a phone. A line too long to fit is cut off
// mid-word, and a cut-off instruction is worse than none.
{
  const stages = [
    {}, { map: 'rowan_lab' },
    { f: { gotStarter: 1 }, map: 'twinleaf' },
    { f: { gotStarter: 1 }, map: 'route201' },
    { f: { gotStarter: 1 }, map: 'sandgem' },
    { f: { gotStarter: 1 }, map: 'route202' },
    { f: { gotStarter: 1 }, map: 'jubilife' },
    { f: { gotStarter: 1 }, map: 'jubilife_school' },
    { f: { gotStarter: 1 }, map: 'route203' },
    { f: { gotStarter: 1, reachedOreburgh: 1 }, map: 'oreburgh' },
    { f: { gotStarter: 1, reachedOreburgh: 1 }, map: 'oreburgh_gym' },
    { f: { gotStarter: 1, reachedOreburgh: 1 }, map: 'oreburgh_center' },
    { f: { gotStarter: 1, reachedOreburgh: 1, badge1: 1 }, map: 'oreburgh' },
    { f: { gotStarter: 1, reachedOreburgh: 1, badge1: 1 }, map: 'route207' },
    { f: { gotStarter: 1, reachedOreburgh: 1, badge1: 1 }, map: 'oreburgh_gate' },
    { f: { gotStarter: 1, reachedOreburgh: 1, badge1: 1, beatCommander: 1 } },
    { f: { gotStarter: 1, reachedOreburgh: 1, badge1: 1, beatCommander: 1, gotCharm: 1 } },
    { f: { gotStarter: 1, badge1: 1, beatCommander: 1, gotCharm: 1, everlightOpened: 1 } },
    { f: { gotStarter: 1, badge1: 1, beatCommander: 1, gotCharm: 1, everlightOpened: 1, everlightResolved: 1 } },
  ];
  const seen = new Set();
  for (const stage of stages) {
    const st = createGameState({ name: 'Matthew' });
    Object.assign(st.flags, stage.f || {});
    if (stage.map) st.player.map = stage.map;
    const line = objective(st);
    seen.add(line);
    if (!line) err(`[journal] ` + 'the guide bar has nothing to say at some point in the story');
    else if (line.length > OBJECTIVE_MAX) {
      err(`[journal] ` + `objective is ${line.length} chars, over the ${OBJECTIVE_MAX} the guide bar fits: "${line}"`);
    }
    const bad = unrenderable(line);
    if (bad.length) err(`[journal] ` + `objective contains characters the font cannot draw: ${JSON.stringify(bad)}`);
  }
  if (seen.size < 8) err(`[journal] ` + `only ${seen.size} distinct objectives across the whole story`);
  for (const e of JOURNAL_ENTRIES) {
    const bad = unrenderable(`${e.title} ${e.body.join(' ')} ${e.next || ''}`);
    if (bad.length) err(`[journal] ` + `entry ${e.id} contains undrawable characters: ${JSON.stringify(bad)}`);
  }
}

// ---- the world clock ------------------------------------------------------
// Phases have to tile the whole 24 hours with no gap and no overlap, or there
// is an hour of the day when the game does not know what time it is.
{
  const seen = {};
  for (let h = 0; h < 24; h++) {
    const p = phaseAt(h);
    if (!PHASES.includes(p)) err(`[clock] ` + `hour ${h} is in unknown phase "${p}"`);
    seen[p] = (seen[p] || 0) + 1;
  }
  for (const p of PHASES) {
    if (!seen[p]) err(`[clock] ` + `no hour of the day falls in "${p}"`);
  }
  const day = tintFor('day');
  if (day.alpha !== 0) err(`[clock] ` + 'daytime should be drawn with no wash at all');
  for (const p of PHASES) {
    const t = tintFor(p);
    if (!(t.alpha >= 0 && t.alpha <= 1)) err(`[clock] ` + `${p} tint alpha ${t.alpha} is out of range`);
    if (!/^#[0-9a-f]{6}$/i.test(t.color)) err(`[clock] ` + `${p} tint colour ${t.color} is not a hex colour`);
  }
}

// ---- report ---------------------------------------------------------------
// Last thing in the file, so nothing can be counted without being shown.

for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  ERR   ${e}`);

console.log(`\n${errors.length} error(s), ${warnings.length} warning(s) across ${Object.keys(MAPS).length} maps`);

process.exit(errors.length ? 1 : 0);
