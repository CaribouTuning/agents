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
import { unrenderable } from '../src/render/font.js';
import { SPECIES } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';
import { ITEMS } from '../src/data/items.js';
import { TRAINERS } from '../src/data/trainers.js';
import { PROS, TOURNAMENTS, RANKS, PRO_LIST, roundsFor, pointsForFinish } from '../src/data/circuit.js';
import { HEADLINES, BODIES, PRESS_QUESTIONS, OUTLETS, ANALYSTS } from '../src/data/news.js';
import {
  isKnownSlot, isKnownClause, worldSnapshot, RANK_IDS,
} from '../src/game/overworld/gossip.js';
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

// Flags the story actually sets: the fixed table, a `beat_<trainer>` per
// trainer, and a `badge<n>` per badge. A `when: { flag: ... }` naming anything
// else is a branch that can never fire.
const KNOWN_FLAGS = new Set([
  ...Object.values(FLAGS),
  ...Object.keys(TRAINERS).map((id) => `beat_${id}`),
  ...Array.from({ length: 8 }, (_, i) => `badge${i + 1}`),
]);
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

// ---- report ---------------------------------------------------------------

for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  ERR   ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s) across ${Object.keys(MAPS).length} maps`);
process.exit(errors.length ? 1 : 0);
