// Berries, soft soil and the water's edge.
//
// A berry takes hours, so the only way to test one is to move the clock. That
// is why `now()` lives in game/clock.js rather than inside the berry code: the
// system under test never calls Date.now() itself, and this file can say "and
// then it was tomorrow" in one line.
import {
  createPatches, plant, patchAt, patchKey, stageOf, stageIndex, isRipe, cropOf,
  tend, harvest, patchText, hoursLeft, progress, serializePatches, revivePatches, STAGES,
} from '../src/game/berries.js';
import { shiftHours, resetClock, now } from '../src/game/clock.js';
import { ITEMS, getItem, BERRY_IDS, isBerry, martStock } from '../src/data/items.js';
import { MAPS } from '../src/data/maps/index.js';
import { SPECIES } from '../src/data/species.js';
import { tileDef } from '../src/render/tiles.js';
import { createBattle, resolveTurn, activeOf } from '../src/game/battle/engine.js';
import { createMonster, maxHp } from '../src/game/monster.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

// Every section starts from the real clock, so one section cannot leave the
// world four days in the future for the next one.
const fresh = () => { resetClock(); return createPatches(); };

// ---- 1. the berry table itself ---------------------------------------------
{
  check(BERRY_IDS.length >= 8, 'there are berries to plant', `${BERRY_IDS.length}`);

  const bad = BERRY_IDS.filter((id) => {
    const b = ITEMS[id].berry;
    return !(b.hours > 0) || !(b.crop > 0) || b.crop > 8;
  });
  check(bad.length === 0, 'every berry has an honest growth time and crop', bad.join(', '));

  // Sorted by how long they take, which is what the plant-a-berry list uses.
  const hours = BERRY_IDS.map((id) => ITEMS[id].berry.hours);
  check(hours.every((h, i) => i === 0 || hours[i - 1] <= h), 'the list is ordered by ripening time',
    hours.join(','));

  // A berry is only worth planting if it does something when eaten.
  const useless = BERRY_IDS.filter((id) => !ITEMS[id].use);
  check(useless.length === 0, 'every berry does something when you eat it', useless.join(', '));

  // The ones that cure something say which, and the statuses are real.
  const STATUSES = ['PSN', 'PAR', 'BRN', 'FRZ', 'SLP', 'CNF'];
  const wrong = BERRY_IDS.filter((id) => {
    const h = ITEMS[id].held;
    if (!h || h.kind !== 'pinch-cure') return false;
    return !Array.isArray(h.status) || h.status.some((s) => !STATUSES.includes(s));
  });
  check(wrong.length === 0, 'a status berry names statuses the engine has', wrong.join(', '));

  check(isBerry('oranberry') && !isBerry('potion'), 'a potion is not a berry');
  check(martStock(0).some((id) => isBerry(id)), 'you can buy a berry before your first badge');
}

// ---- 2. growing --------------------------------------------------------------
console.log('\n--- growing ---');
{
  const P = fresh();
  const p = plant(P, 'route201', 3, 26, 'oranberry');   // 4 hours
  check(!!p, 'a berry goes in the ground');
  check(patchAt(P, 'route201', 3, 26) === p, 'and the patch is found by where it is');
  check(patchAt(P, 'route201', 4, 26) === null, 'and only by where it is');

  check(stageOf(p) === 'planted', 'it starts as turned soil', stageOf(p));
  check(!isRipe(p), 'and is not ripe the moment you plant it');
  check(Math.round(hoursLeft(p)) === 4, 'four hours to go', hoursLeft(p).toFixed(2));

  shiftHours(1.5);
  check(stageOf(p) === 'sprout', 'an hour and a half in it is a sprout', stageOf(p));
  shiftHours(1.5);
  check(stageOf(p) === 'growing', 'three hours in it is a plant', stageOf(p));
  check(!isRipe(p), 'still not ripe at three hours');
  shiftHours(1);
  check(stageOf(p) === 'ripe', 'four hours in it is ripe', stageOf(p));
  check(progress(p) === 1, 'and progress is capped at one', String(progress(p)));

  shiftHours(100);
  check(stageOf(p) === 'ripe', 'and it does not rot if you leave it', stageOf(p));
  resetClock();
}

// ---- 3. what it gives back ---------------------------------------------------
console.log('\n--- the crop ---');
{
  const P = fresh();
  const alone = plant(P, 'route201', 3, 26, 'oranberry');
  check(cropOf(alone) === getItem('oranberry').berry.crop, 'left alone, you get the base crop',
    String(cropOf(alone)));

  // Tending is worth one, once per stage.
  check(tend(alone), 'you can look after it while it is growing');
  check(!tend(alone), 'but not twice in the same stage');
  check(cropOf(alone) === 5, 'tending is worth one berry', String(cropOf(alone)));
  shiftHours(1.5);
  check(tend(alone), 'and again once it has moved on');
  check(cropOf(alone) === 6, 'worth another', String(cropOf(alone)));

  shiftHours(4);
  check(!tend(alone), 'there is nothing to do for a ripe one');

  const got = harvest(P, 'route201', 3, 26);
  check(got && got.count === 6, 'and you pick everything it grew', got ? String(got.count) : 'null');
  check(got.berry === 'oranberry', 'and it is the berry you planted', got.berry);
  check(patchAt(P, 'route201', 3, 26) === null, 'the soil is empty again');
  check(harvest(P, 'route201', 3, 26) === null, 'and picking it twice gives nothing');
  resetClock();
}

// ---- 4. planted together -----------------------------------------------------
console.log('\n--- two names on it ---');
{
  const P = fresh();
  const solo = plant(P, 'route201', 3, 26, 'lumberry');
  const pair = plant(P, 'route201', 4, 26, 'lumberry', 'Sammy');
  check(solo.witness === null, 'a berry planted alone has one name on it');
  check(pair.witness === 'Sammy', 'and one planted together has two', String(pair.witness));
  check(cropOf(pair) === cropOf(solo) + 1, 'the shared one gives more',
    `${cropOf(solo)} vs ${cropOf(pair)}`);

  // The witness is written at planting and never afterwards.
  const before = solo.witness;
  shiftHours(30);
  check(solo.witness === before, 'and a partner logging on later does not change it');

  const got = harvest(P, 'route201', 4, 26);
  check(got.witness === 'Sammy', 'picking it remembers who you planted it with', String(got.witness));
  resetClock();
}

// ---- 5. what it says out loud ------------------------------------------------
console.log('\n--- what the patch says ---');
{
  const P = fresh();
  const p = plant(P, 'route201', 3, 26, 'sitrusberry');   // 12 hours
  const said = [];
  for (const at of [0, 5, 9, 13]) {
    resetClock(); shiftHours(at);
    said.push(patchText(p));
  }
  check(new Set(said).size === said.length, 'every stage reads differently', said.length + ' lines');
  check(said[3].includes('ripe'), 'and the last one says it is ripe', said[3]);
  check(said.every((s) => s.length <= 90), 'and none of them overrun a dialogue line',
    String(Math.max(...said.map((s) => s.length))));
  check(said[0].includes('Sitrus Berry'), 'and it names the berry while it is small', said[0]);
  resetClock();
}

// ---- 6. the soil is really in the world --------------------------------------
console.log('\n--- soft soil in the maps ---');
{
  const beds = [];
  for (const map of Object.values(MAPS)) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (tileDef(map.tiles[y][x]).soil) beds.push(`${map.id}:${x},${y}`);
      }
    }
  }
  check(beds.length >= 6, 'there is soft soil to plant in', `${beds.length} squares`);
  const maps = new Set(beds.map((b) => b.split(':')[0]));
  check(maps.size >= 3, 'in more than one place', [...maps].join(', '));

  // And a plant can go in every one of them.
  const P = fresh();
  let planted = 0;
  for (const bed of beds) {
    const [mapId, xy] = bed.split(':');
    const [x, y] = xy.split(',').map(Number);
    if (plant(P, mapId, x, y, 'cheriberry')) planted++;
  }
  check(planted === beds.length, 'every bed takes a berry', `${planted}/${beds.length}`);
  check(Object.keys(P).length === beds.length, 'and each is its own patch');
  resetClock();
}

// ---- 7. fishing ---------------------------------------------------------------
console.log('\n--- the water ---');
{
  const withWater = Object.values(MAPS).filter(
    (m) => m.kind !== 'indoor' && m.tiles.some((r) => r.includes('~') || r.includes('-')));
  check(withWater.length > 0, 'there is water in the world', withWater.map((m) => m.id).join(', '));

  const dry = withWater.filter((m) => !m.encounters || !m.encounters.fish);
  check(dry.length === 0, 'and every stretch of it has something in it', dry.map((m) => m.id).join(', '));

  for (const m of withWater) {
    const t = m.encounters.fish;
    const unknown = t.table.filter(([id]) => !SPECIES[id]);
    check(unknown.length === 0, `${m.id}: everything it can land is a real species`,
      unknown.map(([id]) => id).join(', '));
    check(t.min <= t.max && t.min >= 2, `${m.id}: the level range makes sense`, `${t.min}-${t.max}`);
    check(t.table.every(([, w]) => w > 0), `${m.id}: every entry can actually come up`);
  }

  // The Old Rod is a key item you are given, not one you can buy.
  const rod = getItem('oldrod');
  check(!!rod && rod.key === true, 'the Old Rod is a key item');
  check(!martStock(8).includes('oldrod'), 'and no shop sells one');
}

// ---- 8. the save ---------------------------------------------------------------
console.log('\n--- the save ---');
{
  const P = fresh();
  plant(P, 'route201', 3, 26, 'oranberry', 'Sammy');
  plant(P, 'twinleaf', 4, 16, 'lumberry');
  tend(P[patchKey('route201', 3, 26)]);

  const back = revivePatches(JSON.parse(JSON.stringify(serializePatches(P))));
  check(Object.keys(back).length === 2, 'both patches come back', String(Object.keys(back).length));
  const a = patchAt(back, 'route201', 3, 26);
  check(a.berry === 'oranberry' && a.witness === 'Sammy' && a.tended === 1,
    'with their berry, their partner and their care intact');
  check(a.planted === P[patchKey('route201', 3, 26)].planted,
    'and the moment they went in is kept exactly');

  // The plant grows while the game is shut. That is the whole feature.
  shiftHours(5);
  check(isRipe(a), 'a berry planted before the save is ripe after it', stageOf(a));

  check(Object.keys(revivePatches(null)).length === 0, 'no patches in the save is fine');
  check(Object.keys(revivePatches({ 'route201:3,26': { berry: 'notaberry', planted: 1 } })).length === 0,
    'a berry that no longer exists is dropped rather than crashing');
  check(Object.keys(revivePatches({ 'nonsense': { berry: 'oranberry', planted: 1 } })).length === 0,
    'and so is a patch that is not anywhere');

  // A save written by a clock running fast should not leave a plant stuck.
  const future = revivePatches({ 'route201:3,26': { berry: 'oranberry', planted: now() + 9e9 } });
  const f = patchAt(future, 'route201', 3, 26);
  check(stageIndex(f) === 0 && STAGES[stageIndex(f)] === 'planted',
    'a berry planted in the future is simply not ready yet', stageOf(f));
  resetClock();
}

// ---- 9. a held berry, proved against its own absence --------------------------
//
// The same rule the abilities live under: an effect you cannot tell apart from
// its absence is a label, not a mechanic. So each of these runs the identical
// turn twice, once holding the berry and once holding nothing.
console.log('\n--- held berries in a real battle ---');
{
  const flat = (v) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v });
  const fixed = { ivs: flat(20), evs: flat(0), nature: 0, gender: 'M', shiny: false };

  const duel = (held, setup) => {
    const a = createMonster(387, 40, { ...fixed });        // Turtwig
    const b = createMonster(393, 40, { ...fixed });        // Piplup
    a.moves = [{ id: 'tackle', pp: 30, ppMax: 30 }];
    b.moves = [{ id: 'tackle', pp: 30, ppMax: 30 }];
    a.heldItem = held;
    const battle = createBattle({
      seed: 9090, kind: 'trainer', difficulty: 'normal',
      a: { id: 'p', name: 'A', isPlayer: true, party: [a], trainer: { ai: 1 } },
      b: { id: 'e', name: 'B', party: [b], trainer: { name: 'B', ai: 1 } },
    });
    setup(battle, a);
    const events = resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    return { a, battle, text: events.filter((e) => e.t === 'text').map((e) => e.s).join(' | ') };
  };

  // A Cheri Berry cures paralysis and is used up doing it.
  const burn = (battle, mon) => { mon.status = 'PAR'; mon.statusCounter = 0; };
  const withCheri = duel('cheriberry', burn);
  const without = duel(null, burn);
  check(without.a.status === 'PAR', 'without a berry the paralysis stays', String(without.a.status));
  check(withCheri.a.status === null, 'a held Cheri Berry cures it', String(withCheri.a.status));
  check(withCheri.a.heldItem === null, 'and the berry is eaten');
  check(withCheri.text.includes('Cheri Berry'), 'and the battle says so', withCheri.text.slice(0, 90));

  // A berry only answers to the status it is for.
  const poisoned = (battle, mon) => { mon.status = 'PSN'; mon.statusCounter = 0; };
  const wrongBerry = duel('cheriberry', poisoned);
  check(wrongBerry.a.status === 'PSN' && wrongBerry.a.heldItem === 'cheriberry',
    'a Cheri Berry does nothing about poison', String(wrongBerry.a.status));

  // A Lum Berry answers to all of them, confusion included.
  for (const st of ['PSN', 'PAR', 'BRN', 'FRZ', 'SLP']) {
    const r = duel('lumberry', (battle, mon) => { mon.status = st; mon.statusCounter = 0; });
    check(r.a.status === null, `a Lum Berry clears ${st}`, String(r.a.status));
  }
  const confused = duel('lumberry', (battle) => { battle.sides[0].volatile.confusion = 4; });
  check(confused.battle.sides[0].volatile.confusion === 0, 'and clears confusion too',
    String(confused.battle.sides[0].volatile.confusion));

  // An Oran Berry waits until you are actually in trouble.
  const healthy = duel('oranberry', (battle, mon) => { mon.hp = maxHp(mon); });
  check(healthy.a.heldItem === 'oranberry', 'a healing berry is not wasted at full HP');
  // Low enough to trigger it, high enough to survive the turn: a berry eaten
  // by a fainted Pokemon proves nothing.
  const hurt = duel('oranberry', (battle, mon) => { mon.hp = Math.floor(maxHp(mon) / 2); });
  check(hurt.a.heldItem === null, 'but is eaten in a pinch', `hp ${hurt.a.hp}/${maxHp(hurt.a)}`);
  check(hurt.text.includes('Oran Berry'), 'and the battle says so too', hurt.text.slice(-70));
  void activeOf;
}

console.log(fails === 0 ? '\nberries: all checks passed' : `\nberries: ${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
