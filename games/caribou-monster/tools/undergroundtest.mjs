// The Underground.
//
// Three systems that only meet at the bottom of a hole: a wall of rock, the
// things buried in it, and a room somebody else can walk into. The dig is
// seeded, so every assertion here is about a wall that can be dug again
// exactly — which is also what lets two people work the same seam.
import {
  createDig, strike, stability, depthAt, itemAt, isExposed, shapeBox, found, missed,
  isDone, TOOLS, SHAPES, MAX_DEPTH, MAX_STRIKES,
} from '../src/game/underground/dig.js';
import { TABLES, tableFor, SPHERES, isSphere, sphereCount } from '../src/game/underground/treasure.js';
import {
  createUnderground, serializeUnderground, reviveUnderground, isReady, coolingFor,
  coolingText, markDug, seedFor, REFRESH_HOURS,
} from '../src/game/underground/site.js';
import {
  GOODS, GOODS_IDS, ROOM, createBase, digBase, place, fits, freeSpot, removeAt,
  describe, leaveNote, NOTE_MAX, costOf, canAfford, shareable, acceptShared,
  serializeBase, reviveBase,
} from '../src/game/underground/base.js';
import { makeRng } from '../src/core/rng.js';
import { ITEMS } from '../src/data/items.js';
import { MAPS } from '../src/data/maps/index.js';
import { LADDERS, ladderFor, BASE_ENTRY, BASE_ORIGIN, BASE_BOARD } from '../src/data/maps/underground.js';
import { tileDef } from '../src/render/tiles.js';
import { shiftHours, resetClock, now } from '../src/game/clock.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

const LOOT = [{ item: 'redsphere', shape: 'small', weight: 1 }];

/** Clears a whole wall with a pick, cell by cell, ignoring the roof. */
function excavate(dig) {
  for (let y = 0; y < dig.h; y++) {
    for (let x = 0; x < dig.w; x++) {
      while (depthAt(dig, x, y) > 0) {
        dig.strikes = 0;             // the roof is not what is under test here
        dig.collapsed = false;
        strike(dig, x, y, 'pick');
      }
    }
  }
}

// ---- 1. the wall ------------------------------------------------------------
{
  const dig = createDig(LOOT, makeRng(11), { count: 2 });
  check(dig.w > 0 && dig.h > 0, 'a wall has a size', `${dig.w}x${dig.h}`);
  check(dig.depth.length === dig.h && dig.depth.every((r) => r.length === dig.w),
    'and rock everywhere in it');
  check(dig.depth.every((r) => r.every((d) => d >= 1 && d <= MAX_DEPTH)),
    'no cell starts already cleared');
  check(new Set(dig.depth.flat()).size > 1, 'and the rock is not flat',
    [...new Set(dig.depth.flat())].join(','));
  check(dig.items.length === 2, 'the things asked for are in it', String(dig.items.length));

  // Nothing overlaps anything else.
  const cells = new Set();
  let overlap = false;
  for (const it of dig.items) {
    for (const [dx, dy] of shapeBox(it.shape).cells) {
      const k = `${it.x + dx},${it.y + dy}`;
      if (cells.has(k)) overlap = true;
      cells.add(k);
    }
  }
  check(!overlap, 'and none of them are buried inside each other');

  // Everything fits inside the wall.
  const outside = dig.items.some((it) => {
    const b = shapeBox(it.shape);
    return it.x < 0 || it.y < 0 || it.x + b.w > dig.w || it.y + b.h > dig.h;
  });
  check(!outside, 'and none of them stick out of it');
}

// ---- 2. the same wall twice --------------------------------------------------
console.log('\n--- the same seam, twice ---');
{
  const a = createDig(tableFor('deep'), makeRng(4242), { count: 3 });
  const b = createDig(tableFor('deep'), makeRng(4242), { count: 3 });
  check(JSON.stringify(a.depth) === JSON.stringify(b.depth), 'the same seed lays the same rock');
  check(JSON.stringify(a.items) === JSON.stringify(b.items), 'and buries the same things');

  const c = createDig(tableFor('deep'), makeRng(4243), { count: 3 });
  check(JSON.stringify(a.items) !== JSON.stringify(c.items), 'and a different seed does not');

  // Which is what makes two people at one seam dig one wall.
  const s1 = seedFor(12, 3);
  const s2 = seedFor(12, 3);
  check(s1 === s2, 'a seam has one seed at one moment', String(s1));
  check(seedFor(12, 3) !== seedFor(13, 3), 'and a different seam has another');
  const later = seedFor(12, 3, now() + REFRESH_HOURS * 3600 * 1000 * 2);
  check(later !== s1, 'and the same seam is a different wall tomorrow');
}

// ---- 3. swinging ------------------------------------------------------------
console.log('\n--- swinging ---');
{
  const dig = createDig(LOOT, makeRng(7), { count: 1 });
  const before = depthAt(dig, 5, 3);
  const res = strike(dig, 5, 3, 'pick');
  check(res.ok, 'a swing lands');
  check(depthAt(dig, 5, 3) < before, 'and takes rock off where you hit',
    `${before} -> ${depthAt(dig, 5, 3)}`);
  check(res.cells.length > 1, 'and off the cells around it too', String(res.cells.length));

  // The hammer is wider and costs more roof.
  const h = createDig(LOOT, makeRng(7), { count: 1 });
  const hres = strike(h, 5, 3, 'hammer');
  check(hres.cells.length > res.cells.length, 'the hammer clears more ground',
    `${hres.cells.length} vs ${res.cells.length}`);
  check(TOOLS.hammer.cost > TOOLS.pick.cost, 'and costs more roof to swing',
    `${TOOLS.hammer.cost} vs ${TOOLS.pick.cost}`);
  check(stability(h) < stability(dig), 'which the meter shows',
    `${stability(h).toFixed(2)} vs ${stability(dig).toFixed(2)}`);

  // Hitting bare floor is refused rather than charged.
  const flat = createDig(LOOT, makeRng(7), { count: 0 });
  for (let i = 0; i < 6; i++) { flat.strikes = 0; strike(flat, 0, 0, 'pick'); }
  check(depthAt(flat, 0, 0) === 0, 'a cell can be cleared to the floor');
  const spent = flat.strikes;
  const wasted = strike(flat, 0, 0, 'pick');
  check(wasted.wasted && !wasted.ok, 'and swinging at bare floor is refused');
  check(flat.strikes === spent, 'and costs nothing', `${flat.strikes} vs ${spent}`);

  // And a swing outside the wall does nothing at all.
  const out = strike(flat, 99, 99, 'pick');
  check(!out.ok && !out.wasted, 'a swing off the edge of the wall does nothing');
}

// ---- 4. the roof --------------------------------------------------------------
console.log('\n--- the roof ---');
{
  const dig = createDig(LOOT, makeRng(3), { count: 1, maxStrikes: 4 });
  check(stability(dig) === 1, 'the roof starts sound');
  strike(dig, 1, 1, 'pick');
  check(stability(dig) < 1 && !dig.collapsed, 'and comes down as you work',
    stability(dig).toFixed(2));
  let guard = 0;
  while (!dig.collapsed && guard++ < 20) strike(dig, (guard * 3) % dig.w, guard % dig.h, 'hammer');
  check(dig.collapsed, 'and eventually comes in', `after ${guard} swings`);
  check(stability(dig) === 0, 'the meter reads empty when it does');
  check(isDone(dig), 'and the dig is over');
  const after = strike(dig, 2, 2, 'pick');
  check(!after.ok, 'you cannot swing at a wall that has fallen on you');
}

// ---- 5. what comes out ---------------------------------------------------------
console.log('\n--- what comes out ---');
{
  const dig = createDig(LOOT, makeRng(21), { count: 1 });
  const it = dig.items[0];
  check(!!it, 'there is something in the wall');
  check(!isExposed(dig, it) || dig.depth.flat().every((d) => d === 0),
    'and it starts buried');
  check(itemAt(dig, it.x, it.y) === it, 'and it is under the cells it is under');
  check(itemAt(dig, it.x, it.y) !== null, 'which itemAt finds');

  excavate(dig);
  check(isExposed(dig, it), 'clearing the rock exposes it');
  check(it.found, 'and finding it is recorded on it');
  check(found(dig).length === 1 && missed(dig).length === 0, 'and it counts as found');
  check(isDone(dig), 'with nothing left worth swinging at');
}
{
  // A big shape needs every cell of itself, not just a corner.
  const dig = createDig([{ item: 'skullfossil', shape: 'big', weight: 1 }], makeRng(5), { count: 1 });
  const it = dig.items[0];
  const box = shapeBox('big');
  // Clear all but one cell of it.
  for (const [dx, dy] of box.cells.slice(0, -1)) {
    while (depthAt(dig, it.x + dx, it.y + dy) > 0) {
      dig.strikes = 0; dig.collapsed = false;
      strike(dig, it.x + dx, it.y + dy, 'pick');
    }
  }
  check(!it.found, 'a fossil three-quarters out is not out');
  const [lx, ly] = box.cells[box.cells.length - 1];
  while (depthAt(dig, it.x + lx, it.y + ly) > 0) {
    dig.strikes = 0; dig.collapsed = false;
    strike(dig, it.x + lx, it.y + ly, 'pick');
  }
  check(it.found, 'and the last corner is what frees it');
}

// ---- 6. the tables -------------------------------------------------------------
console.log('\n--- the tables ---');
{
  for (const [name, table] of Object.entries(TABLES)) {
    const unknown = table.filter((t) => !ITEMS[t.item]);
    check(unknown.length === 0, `${name}: everything in it is a real item`,
      unknown.map((t) => t.item).join(', '));
    const badShape = table.filter((t) => !SHAPES[t.shape]);
    check(badShape.length === 0, `${name}: every shape exists`, badShape.map((t) => t.shape).join(', '));
    check(table.every((t) => t.weight > 0), `${name}: everything in it can come up`);
  }
  check(tableFor('deep') === TABLES.deep && tableFor('shallow') === TABLES.shallow,
    'the depth picks the table');
  check(tableFor(undefined) === TABLES.shallow, 'and anything else is the shallow one');

  // Deep rock is worth walking to.
  const deepOnly = TABLES.deep.filter((t) => !TABLES.shallow.some((s) => s.item === t.item));
  check(deepOnly.length >= 5, 'deep rock holds things shallow rock does not',
    deepOnly.map((t) => t.item).join(', '));

  check(SPHERES.every((id) => ITEMS[id] && ITEMS[id].sphere), 'every sphere is an item that says so');
  check(SPHERES.every((id) => !ITEMS[id].sell), 'and no sphere can be sold for money');
  check(isSphere('redsphere') && !isSphere('potion'), 'a potion is not a sphere');
  check(sphereCount({ items: { redsphere: 2, palesphere: 1, potion: 9 } }) === 3,
    'spheres are counted by the handful, not by colour');
}

// ---- 7. seams come back ----------------------------------------------------------
console.log('\n--- seams come back ---');
{
  resetClock();
  const ug = createUnderground();
  check(isReady(ug, 4, 4), 'an untouched seam is ready');
  markDug(ug, 4, 4, 2);
  check(!isReady(ug, 4, 4), 'and a worked one is not');
  check(isReady(ug, 5, 4), 'which says nothing about the seam next to it');
  check(ug.digs === 1 && ug.finds === 2, 'the card counts digs and finds', `${ug.digs}/${ug.finds}`);
  check(coolingText(coolingFor(ug, 4, 4)).includes('hour'), 'and it says how long in hours',
    coolingText(coolingFor(ug, 4, 4)));

  shiftHours(REFRESH_HOURS - 0.02);
  check(!isReady(ug, 4, 4), 'still not ready just before the time is up');
  check(coolingText(coolingFor(ug, 4, 4)).includes('minute'), 'and it counts down in minutes at the end',
    coolingText(coolingFor(ug, 4, 4)));
  shiftHours(0.1);
  check(isReady(ug, 4, 4), 'and ready once it is');
  resetClock();
}

// ---- 8. the room ------------------------------------------------------------------
console.log('\n--- a room of your own ---');
{
  const ug = createUnderground();
  check(!ug.base, 'you start without one');
  const base = digBase(ug, 2, 7, 'Matthew');
  check(ug.base === base && base.x === 2 && base.y === 7, 'cutting one puts it where you cut it');
  check(base.owner === 'Matthew', 'and it has your name on it');
  check(describe(base) === 'Bare rock, and room to put things.', 'and it starts empty', describe(base));

  check(place(base, 'lamp', 0, 0), 'you can put something in it');
  check(!fits(base, 'chair', 0, 0), 'and not on top of it');
  check(fits(base, 'chair', 1, 0), 'but beside it is fine');
  check(!fits(base, 'table', ROOM.w - 1, 0), 'and a wide thing will not go in a narrow gap');
  check(!fits(base, 'lamp', -1, 0) && !fits(base, 'lamp', 0, ROOM.h), 'nor outside the room at all');

  const spot = freeSpot(base, 'hearth');
  check(!!spot && fits(base, 'hearth', spot.x, spot.y), 'the trader can always find somewhere it goes',
    spot ? `${spot.x},${spot.y}` : 'nowhere');

  check(describe(base).includes('Pit Lamp'), 'the room describes itself', describe(base));
  const gone = removeAt(base, 0, 0);
  check(gone && gone.id === 'lamp', 'and you can take something back out');
  check(base.decor.length === 0, 'which leaves the floor clear');

  // The room holds only so much.
  let placed = 0;
  for (let i = 0; i < 40; i++) {
    const s = freeSpot(base, 'lamp');
    if (!s || !place(base, 'lamp', s.x, s.y)) break;
    placed++;
  }
  check(placed === ROOM.maxDecor, 'a room fills up', `${placed} pieces`);
}

// ---- 9. the goods -------------------------------------------------------------------
console.log('\n--- the goods ---');
{
  check(GOODS_IDS.length >= 6, 'there are things to buy', String(GOODS_IDS.length));
  const bad = GOODS_IDS.filter((id) => !(GOODS[id].cost > 0) || !GOODS[id].blurb || !GOODS[id].name);
  check(bad.length === 0, 'each has a price, a name and something to say about it', bad.join(', '));
  const tooBig = GOODS_IDS.filter((id) => GOODS[id].w > ROOM.w || GOODS[id].h > ROOM.h);
  check(tooBig.length === 0, 'and none of them is bigger than the room', tooBig.join(', '));
  check(costOf('lamp') > 0 && costOf('nonsense') === 0, 'a price is a price');
  check(canAfford(10, 'lamp') && !canAfford(1, 'hearth'), 'and spheres are what pays it');

  // The cheapest thing is reachable from one good dig.
  const cheapest = Math.min(...GOODS_IDS.map(costOf));
  check(cheapest <= 3, 'the first thing for your room is one evening away', String(cheapest));
}

// ---- 10. the board ---------------------------------------------------------------------
console.log('\n--- the board ---');
{
  const base = createBase(2, 7, 'Matthew');
  check(base.note === '', 'the board starts blank');
  leaveNote(base, 'come and look at the hearth', 'Matthew');
  check(base.note === 'come and look at the hearth', 'and takes a line', base.note);
  check(base.noteBy === 'Matthew', 'signed by whoever left it');
  const long = 'x'.repeat(NOTE_MAX + 40);
  leaveNote(base, long, 'Matthew');
  check(base.note.length === NOTE_MAX, 'a line is only ever a line long', String(base.note.length));
}

// ---- 11. across the link ------------------------------------------------------------------
console.log('\n--- across the link ---');
{
  const base = createBase(2, 7, 'Matthew');
  place(base, 'banner', 0, 0);
  place(base, 'hearth', 3, 0);
  leaveNote(base, 'the kettle is on', 'Matthew');

  const wire = JSON.parse(JSON.stringify(shareable(base, 'Matthew')));
  const back = acceptShared(wire);
  check(!!back, 'a base survives the wire');
  check(back.x === 2 && back.y === 7, 'and comes out at the same wall');
  check(back.decor.length === 2, 'with its furniture', String(back.decor.length));
  check(back.note === 'the kettle is on' && back.noteBy === 'Matthew', 'and its note');

  // And nothing on the wire is trusted.
  check(acceptShared(null) === null, 'rubbish off the wire is refused');
  check(acceptShared('a string') === null, 'and so is a string pretending to be a base');
  const hostile = acceptShared({
    x: 2, y: 7, owner: 'x'.repeat(400),
    decor: [{ id: 'nonsense', x: 0, y: 0 }, { id: 'lamp', x: 900, y: -4 },
      ...Array.from({ length: 60 }, () => ({ id: 'lamp', x: 0, y: 0 }))],
    note: 'y'.repeat(9000),
  });
  check(hostile.owner.length <= 16, 'a very long name is cut down', String(hostile.owner.length));
  check(!hostile.decor.some((d) => d.id === 'nonsense'), 'furniture that does not exist is dropped');
  check(hostile.decor.every((d) => d.x >= 0 && d.x < ROOM.w && d.y >= 0 && d.y < ROOM.h),
    'furniture outside the room is pulled back into it');
  check(hostile.decor.length <= ROOM.maxDecor, 'and a room cannot be stuffed past full',
    String(hostile.decor.length));
  check(hostile.note.length <= NOTE_MAX, 'a note is still only a line', String(hostile.note.length));
}

// ---- 12. the save --------------------------------------------------------------------------
console.log('\n--- the save ---');
{
  resetClock();
  const ug = createUnderground();
  ug.unlocked = true;
  ug.returnTo = { map: 'oreburgh', x: 10, y: 23, dir: 'down' };
  markDug(ug, 12, 3, 2);
  const base = digBase(ug, 2, 7, 'Matthew');
  place(base, 'hearth', 0, 0);
  leaveNote(base, 'back in ten', 'Matthew');
  ug.flagsTaken = 3;

  const back = reviveUnderground(JSON.parse(JSON.stringify(serializeUnderground(ug))));
  check(back.unlocked, 'the kit stays used');
  check(back.returnTo.map === 'oreburgh' && back.returnTo.x === 10, 'the way up is remembered');
  check(!isReady(back, 12, 3), 'a worked seam is still worked');
  check(back.digs === 1 && back.finds === 2, 'the tally survives');
  check(back.base && back.base.x === 2 && back.base.decor.length === 1, 'and so does the room');
  check(back.base.note === 'back in ten', 'and what is on its board');
  check(back.flagsTaken === 3, 'and how many flags you have taken');
  check(back.partnerBase === null, 'but never their room — that arrives over the link or not at all');

  check(reviveUnderground(null).unlocked === false, 'no Underground in the save is fine');
  check(Object.keys(reviveUnderground({ walls: { nonsense: 1, '2,3': 'soon' } }).walls).length === 0,
    'and a nonsense seam is dropped rather than crashing');
  check(reviveUnderground({ returnTo: { x: 1 } }).returnTo === null,
    'and a way up that names no map is no way up');
  check(reviveBase(null) === null, 'a save with no room has no room');
  check(serializeBase(null) === null, 'and writes none');
}

// ---- 13. the tunnels are really there ---------------------------------------------------------
console.log('\n--- the tunnels ---');
{
  const ug = MAPS.underground;
  check(!!ug, 'the Underground is a map in the world');
  check(ug.encounters === null, 'with nothing living in it');

  const seams = [];
  const bases = [];
  for (let y = 0; y < ug.height; y++) {
    for (let x = 0; x < ug.width; x++) {
      const d = tileDef(ug.tiles[y][x]);
      if (d.dig) seams.push([x, y, d.dig]);
      if (d.base) bases.push([x, y]);
    }
  }
  check(seams.length >= 5, 'there are seams to dig', `${seams.length}`);
  check(seams.some(([, , d]) => d === 'deep'), 'and some of them are deep');
  check(bases.length >= 2, 'and walls to cut a room into', `${bases.length}`);

  check(LADDERS.length >= 3, 'there are ways in and out', String(LADDERS.length));
  for (const l of LADDERS) {
    check(tileDef(ug.tiles[l.y][l.x]).name === 'stairs up', `${l.name} is on a ladder tile`);
    const d = tileDef(ug.tiles[l.drop[1]][l.drop[0]]);
    check(!d.solid, `${l.name} drops you somewhere you can stand`, d.name);
  }
  check(ug.stepOut && ug.stepOut.tile === '<', 'and standing on a ladder takes you up');

  // Every surface map the ladders claim to serve is a map.
  const claimed = LADDERS.flatMap((l) => l.surface);
  const missing = claimed.filter((id) => !MAPS[id]);
  check(missing.length === 0, 'and each shaft names a real place above it', missing.join(', '));
  check(ladderFor('oreburgh').name.includes('South-east'), 'Oreburgh drops you at its own shaft',
    ladderFor('oreburgh').name);
  check(ladderFor('nowhere-at-all') === LADDERS[0], 'and anywhere else drops you at the first');

  // The room itself.
  const room = MAPS.secret_base;
  check(!!room, 'a Secret Base is a map too');
  check(!tileDef(room.tiles[BASE_ENTRY.y][BASE_ENTRY.x]).solid, 'you can stand where you come in');
  check(tileDef(room.tiles[BASE_BOARD.y][BASE_BOARD.x]).solid, 'the board is on the wall');
  check(room.stepOut && room.stepOut.script === 'leaveBase', 'and the door leads back out');
  // The 9x5 the decorations live in has to be inside the room and walkable.
  let ok = true;
  for (let y = 0; y < ROOM.h; y++) {
    for (let x = 0; x < ROOM.w; x++) {
      const d = tileDef(room.tiles[BASE_ORIGIN.y + y][BASE_ORIGIN.x + x]);
      if (d.solid) ok = false;
    }
  }
  check(ok, 'and everything you can place fits on the floor');
}

console.log(fails === 0 ? '\nunderground: all checks passed' : `\nunderground: ${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
