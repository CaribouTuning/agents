// Does the difficulty curve make sense with the story?
//
// Every mandatory fight, in the order the story puts them, played out against
// a team at the level the region would actually have given the player by then.
// It answers two questions a player feels immediately and a level table never
// shows: is the next Gym a step or a wall, and does the ground you walk over
// on the way there prepare you for it.
//
// "What level would they be" is not guessed: it is the highest wild level on
// the ground the player can actually reach before that Gym, which is what a
// person who fights what they meet ends up somewhere near.
import { createBattle, resolveTurn, needsSwitch, forceSwitch } from '../src/game/battle/engine.js';
import { chooseAiAction, chooseAiSwitch } from '../src/game/battle/ai.js';
import { createMonster } from '../src/game/monster.js';
import { getMove } from '../src/data/moves.js';
import { TRAINERS } from '../src/data/trainers.js';
import { MAPS } from '../src/data/maps/index.js';
import { GYMS, builtGyms } from '../src/data/campaign.js';
import { FIELD_MOVES } from '../src/game/fieldmoves.js';
import { tileDef } from '../src/render/tiles.js';
import { makeRng } from '../src/core/rng.js';
import { getSpecies } from '../src/data/species.js';

/**
 * The form a Pokemon of this line would actually be at this level.
 *
 * Measuring the curve with a level-45 Turtwig is measuring nothing a player
 * ever has: a team that reaches 45 evolved twice on the way, and a first-stage
 * body at that level has first-stage stats. It made every late Gym look like a
 * wall when the wall was the test team.
 */
function grownUp(baseId, level) {
  let id = baseId;
  for (let step = 0; step < 3; step++) {
    const sp = getSpecies(id);
    if (!sp || !sp.evolutions) break;
    const next = sp.evolutions.find((e) => e.method === 'level' && level >= e.level);
    if (!next) break;
    id = next.into;
  }
  return id;
}

let fails = 0;
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
const obstacle = (ch) => (Object.entries(FIELD_MOVES).find(([, f]) => f.tile === ch) || [null])[0];

/** Everywhere you can walk with a given set of field moves. */
function reachable(have) {
  const seen = new Set();
  const reachedTiles = new Map();
  const tiles = new Map();
  const pending = [['twinleaf', [[10, 12], [11, 12], [4, 12]]]];
  while (pending.length) {
    const [id, starts] = pending.pop();
    const m = MAPS[id];
    if (!m) continue;
    seen.add(id);
    const got = tiles.get(id) || new Set();
    tiles.set(id, got);
    reachedTiles.set(id, got);
    const key = (x, y) => `${x},${y}`;
    const q = [];
    for (const [x, y] of starts) if (!got.has(key(x, y))) { got.add(key(x, y)); q.push([x, y]); }
    for (let i = 0; i < q.length && i < 40000; i++) {
      const [x, y] = q[i];
      for (const w of (m.warps || [])) if (w.x === x && w.y === y && MAPS[w.to]) pending.push([w.to, [[w.tx, w.ty]]]);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
        if (got.has(key(nx, ny))) continue;
        const ch = m.tiles[ny][nx];
        const need = obstacle(ch);
        const def = tileDef(ch);
        if (need) { if (!have.has(need)) continue; }
        else if (def.water) { if (!have.has('surf')) continue; }
        else if (def.solid) continue;
        got.add(key(nx, ny)); q.push([nx, ny]);
      }
    }
  }
  return { maps: seen, tiles: reachedTiles };
}

/**
 * The highest wild level the player could actually meet here — counting only
 * ground they can stand on.
 *
 * Taking a map's whole encounter table is not the same thing: Route 218 keeps
 * its Pokemon on the far bank, and reading the table said a level-eight
 * wanderer could meet a level-39 one when the grass they would need is across
 * water they cannot cross.
 */
function wildTop(m, reached) {
  if (!m.encounters || !reached) return 0;
  let canGrass = false, canWater = false;
  for (const k of reached) {
    const [x, y] = k.split(',').map(Number);
    const ch = m.tiles[y] && m.tiles[y][x];
    if (!ch) continue;
    if (ch === '"') canGrass = true;
    if (tileDef(ch).water) canWater = true;
  }
  const lv = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.min === 'number') lv.push(o.max ?? o.min);
    for (const v of Object.values(o)) if (v && typeof v === 'object' && !Array.isArray(v)) walk(v);
  };
  if (canGrass) walk(m.encounters.grass);
  if (canWater) { walk(m.encounters.surf); walk(m.encounters.fish); }
  return lv.length ? Math.max(...lv) : 0;
}

function bestMove(mon) {
  let best = -1, power = -1;
  mon.moves.forEach((slot, i) => {
    if (!slot || slot.pp <= 0) return;
    const mv = getMove(slot.id);
    if (!mv || !mv.power) return;
    if (mv.power > power) { power = mv.power; best = i; }
  });
  return best;
}

/** Plays one fight with a team at `level` and says whether it was won. */
function fight(seed, level, trainerId, species) {
  const r = makeRng(seed);
  const t = TRAINERS[trainerId];
  const mine = species.map((sp, i) => {
    const lv = Math.max(2, level - (i ? 1 : 0));
    return createMonster(grownUp(sp, lv), lv, { rng: r });
  });
  const theirs = t.team.filter((m) => typeof m !== 'string')
    .map((m) => createMonster(m.species, m.level, { rng: r, moves: m.moves }));
  const battle = createBattle({
    seed, kind: 'trainer', difficulty: 'easy',
    a: { id: 'p', name: 'Player', isPlayer: true, party: mine },
    b: { id: 'e', name: t.name, party: theirs, trainer: { name: t.name, ai: t.ai || 2, prize: 0, defeat: '.' } },
  });
  let guard = 0;
  while (!battle.over && guard++ < 300) {
    for (let s = 0; s < 2; s++) {
      if (needsSwitch(battle, s)) { const i = chooseAiSwitch(battle, s); if (i >= 0) forceSwitch(battle, s, i); }
    }
    if (battle.over) break;
    const me = battle.sides[0].party[battle.sides[0].active];
    resolveTurn(battle, [{ type: 'move', index: me ? bestMove(me) : -1 }, chooseAiAction(battle, 1)]);
  }
  return battle.result === 'win';
}

/** The lowest level at which this fight is won at least `want` of the time. */
function levelNeeded(trainerId, species, want = 0.7, cap = 70) {
  for (let lv = 5; lv <= cap; lv++) {
    let wins = 0;
    const runs = 60;
    for (let i = 0; i < runs; i++) if (fight(9000 + i, lv, trainerId, species)) wins++;
    if (wins / runs >= want) return lv;
  }
  return null;
}

// A plain team: the Grass starter's line plus two ordinary route Pokemon, which
// is what somebody who catches what they meet actually walks in with.
const TEAM = [387, 396, 403];

console.log('--- what each Gym asks, and what the road before it gives ---\n');
console.log('gym  leader          ace  need lvl  best wild you could have met  verdict');
const gyms = builtGyms(MAPS);
const have = new Set();
const rows = [];
for (let i = 0; i < gyms.length; i++) {
  if (i > 0) {
    const prev = GYMS.find((g) => g.n === gyms[i - 1].n);
    if (prev && prev.field) have.add(prev.field);
    if (gyms[i - 1].n >= 5) have.add('surf');
  }
  const g = gyms[i];
  const t = TRAINERS[g.trainer];
  const ace = Math.max(...t.team.filter((m) => typeof m !== 'string').map((m) => m.level));
  const open = reachable(new Set(have));
  let wild = 0;
  for (const id of open.maps) {
    const w = wildTop(MAPS[id], open.tiles.get(id));
    if (w > wild) wild = w;
  }
  const need = levelNeeded(g.trainer, TEAM);
  const gap = need === null ? null : need - wild;
  const ok = need !== null && need <= wild;
  rows.push({ g, ace, need, wild, ok });
  console.log(`  ${g.n}  ${String(g.leader).padEnd(14)} ${String(ace).padStart(3)}  ${String(need ?? '>70').padStart(7)}  ${String(wild).padStart(24)}  ${ok ? 'fair' : `NEEDS ${gap} MORE THAN THE GROUND GIVES`}`);
}

console.log('');
for (const r of rows) {
  check(r.need !== null,
    `${r.g.leader} can be beaten at all with an ordinary team`);
  check(r.need !== null && r.need <= r.wild + 2,
    `${r.g.leader} does not ask for more than the road before them gives`,
    r.need === null ? '' : `needs ${r.need}, the ground offers ${r.wild}`);
}
// And the demand has to climb, or the order of the Gyms is arbitrary.
for (let i = 1; i < rows.length; i++) {
  check(rows[i].need === null || rows[i - 1].need === null || rows[i].need >= rows[i - 1].need,
    `${rows[i].g.leader} asks at least as much as ${rows[i - 1].g.leader}`,
    `${rows[i - 1].need} then ${rows[i].need}`);
}

console.log(fails ? `\n${fails} failure(s)` : '\ncurve: all checks passed');
process.exit(fails ? 1 : 0);
