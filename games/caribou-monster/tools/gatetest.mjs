// Progression gates.
//
// The rule this suite exists to protect: a badge is permission and a move is
// capability, and an obstacle needs both. Get that wrong in either direction
// and you either hand the player the whole region on the first morning or lock
// them out of it forever.
import {
  FIELD_MOVES, FIELD_IDS, tileFor, moveForTile, badgeFor, storyGateFor,
  isAuthorised, bearerOf, usability, canUse, refusalText,
  isCleared, markCleared, serializeCleared, reviveCleared,
} from '../src/game/fieldmoves.js';
import { GYMS, gymByNumber, nextGym, currentBeat, BEATS, builtGyms } from '../src/data/campaign.js';
import { createGameState, serializeState, deserializeState } from '../src/game/state.js';
import { createMonster } from '../src/game/monster.js';
import { MAPS } from '../src/data/maps/index.js';
import { ITEMS } from '../src/data/items.js';
import { MOVES } from '../src/data/moves.js';
import { tileDef } from '../src/render/tiles.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

const withMove = (st, moveId) => {
  const mon = createMonster(387, 20);
  mon.moves = [{ id: moveId, pp: 20, ppMax: 20 }];
  st.party = [mon];
  return st;
};

// ---- 1. the eight, in Platinum's order ------------------------------------
{
  check(GYMS.length === 8, 'there are eight Gyms on the spine', String(GYMS.length));
  const order = GYMS.map((g) => g.leader);
  check(order[0] === 'Roark' && order[1] === 'Gardenia' && order[2] === 'Fantina',
    'Fantina is third, as she is in Platinum and is not in Diamond/Pearl',
    order.slice(0, 4).join(' -> '));
  check(order.join(',') === 'Roark,Gardenia,Fantina,Maylene,Crasher Wake,Byron,Candice,Volkner',
    'and the whole order is Platinum’s', order.join(', '));
  check(GYMS.every((g, i) => g.n === i + 1), 'the badge numbers run 1 to 8 in order');
  check(new Set(GYMS.map((g) => g.badge)).size === 8, 'and no two Gyms give the same badge');
  check(GYMS.every((g) => g.level > 0) && GYMS.every((g, i) => i === 0 || g.level >= GYMS[i - 1].level - 3),
    'the leaders get harder as you go', GYMS.map((g) => g.level).join(','));
  check(builtGyms(MAPS).length >= 2, 'and some of them are built', `${builtGyms(MAPS).length} of 8`);
}

// ---- 2. the badge is permission -------------------------------------------
console.log('\n--- permission ---');
{
  const st = withMove(createGameState({ name: 'Matthew' }), 'cut');
  check(bearerOf(st, 'cut') !== null, 'a Pokémon in the party knows Cut');
  check(!isAuthorised(st, 'cut'), 'but without the badge the world says no');
  check(!canUse(st, 'cut'), 'so Cut cannot be used outside');
  check(usability(st, 'cut').why === 'badge', 'and the reason given is the badge',
    usability(st, 'cut').why);
  check(refusalText(st, 'cut').includes('Forest Badge'),
    'which names the badge that would settle it', refusalText(st, 'cut'));

  st.flags.badge2 = true;
  check(canUse(st, 'cut'), 'with Gardenia’s badge it works');
}

// ---- 3. the move is capability ---------------------------------------------
console.log('\n--- capability ---');
{
  const st = createGameState({ name: 'Sammy' });
  st.flags.badge2 = true;
  st.party = [createMonster(393, 20)];      // knows no Cut
  check(isAuthorised(st, 'cut'), 'the badge is held');
  check(bearerOf(st, 'cut') === null, 'but nothing in the party knows the move');
  check(!canUse(st, 'cut'), 'so it still cannot be used');
  check(usability(st, 'cut').why === 'nobody', 'and the reason given is the party',
    usability(st, 'cut').why);
  check(refusalText(st, 'cut').includes('Cut'), 'which says so plainly', refusalText(st, 'cut'));

  // An Egg is not a Pokémon that can cut down a tree.
  const egg = createMonster(387, 1);
  egg.isEgg = true;
  egg.moves = [{ id: 'cut', pp: 20, ppMax: 20 }];
  st.party = [egg];
  check(bearerOf(st, 'cut') === null, 'and an Egg cannot cut down a tree');
}

// ---- 4. every gate is authorised by the right badge ---------------------------
console.log('\n--- which badge opens what ---');
{
  // Read off the spine rather than written down twice: move a Gym and the
  // gates move with it.
  for (const id of FIELD_IDS) {
    const n = badgeFor(id);
    const story = storyGateFor(id);
    check(n !== null || !!story, `${id} is authorised by something`,
      n !== null ? `badge ${n}` : `story: ${story.after}`);
    if (n !== null) {
      const gym = gymByNumber(n);
      check(gym.field === id, `and badge ${n} (${gym.leader}) is the Gym that grants ${id}`);
    }
  }
  check(badgeFor('surf') === null && storyGateFor('surf').after === 'lakeValor',
    'Surf comes from the story, not a Gym — as it does in Platinum');

  const st = createGameState({ name: 'Matthew' });
  withMove(st, 'surf');
  check(!canUse(st, 'surf'), 'so eight badges would not open the water on their own');
  st.flags.lakeValor = true;
  check(canUse(st, 'surf'), 'the lake does');
}

// ---- 5. the tiles ------------------------------------------------------------
console.log('\n--- the obstacles ---');
{
  for (const id of FIELD_IDS) {
    const t = tileFor(id);
    if (id === 'surf') { check(t === null, 'Surf has no obstacle tile — it changes what counts as ground'); continue; }
    check(!!t, `${id} has an obstacle tile`, String(t));
    const def = tileDef(t);
    check(def.solid, `and ${def.name} is solid until it is cleared`);
    check(def.field === id, 'and the tile knows which move clears it');
    check(!!def.clearsTo, 'and what it leaves behind', def.clearsTo);
    check(moveForTile(t) === id, 'and the lookup round-trips');
  }
  check(moveForTile('.') === null, 'ordinary grass is not an obstacle');
}

// ---- 6. the key exists before the lock ------------------------------------------
console.log('\n--- every lock has a key ---');
{
  const used = new Set();
  for (const map of Object.values(MAPS)) {
    for (const row of map.tiles) for (const ch of row) {
      const id = moveForTile(ch);
      if (id) used.add(id);
    }
  }
  check(used.size > 0, 'the world actually uses gates', [...used].join(', '));

  for (const id of used) {
    const spec = FIELD_MOVES[id];
    check(!!MOVES[spec.move], `${spec.move} is a real move`);
    const hmId = Object.keys(ITEMS).find((i) => ITEMS[i].hm && ITEMS[i].move === spec.move);
    check(!!hmId, `an HM teaches ${spec.name}`, String(hmId));
    check(ITEMS[hmId].key === true, 'and it is a Key Item, so it cannot be thrown away');
    const gym = GYMS.find((g) => g.field === id);
    if (gym) check(!!MAPS[gym.map], `and ${gym.leader}'s Gym exists to authorise it`);
  }

  // All eight HMs are defined, even the ones nothing uses yet.
  for (let i = 1; i <= 8; i++) {
    const id = `hm${String(i).padStart(2, '0')}`;
    check(!!ITEMS[id], `${id} is defined`, ITEMS[id] && ITEMS[id].name);
  }
}

// ---- 7. clearing an obstacle sticks ---------------------------------------------
console.log('\n--- what stays cleared ---');
{
  const st = createGameState({ name: 'Matthew' });
  check(!isCleared(st, 'route206', 21, 3), 'a tree starts standing');
  markCleared(st, 'route206', 21, 3);
  check(isCleared(st, 'route206', 21, 3), 'and can be cut down');
  check(!isCleared(st, 'route206', 21, 4), 'which says nothing about the one beside it');
  check(!isCleared(st, 'route205', 21, 3), 'or the same square on another map');

  const back = deserializeState(JSON.parse(JSON.stringify(serializeState(st))));
  check(isCleared(back, 'route206', 21, 3), 'and it is still down after a save');

  check(Object.keys(reviveCleared(null)).length === 0, 'no cleared tiles in the save is fine');
  check(Object.keys(reviveCleared({ nonsense: true, 'a b:1,2': true })).length === 0,
    'and rubbish in it is dropped rather than crashing');
  check(Object.keys(serializeCleared(undefined)).length === 0, 'and nothing to write is fine too');
}

// ---- 8. the campaign knows where you are ----------------------------------------
console.log('\n--- the spine ---');
{
  const st = createGameState({ name: 'Matthew' });
  check(nextGym(st).leader === 'Roark', 'a fresh save is looking for Roark');
  st.flags.badge1 = true;
  check(nextGym(st).leader === 'Gardenia', 'then Gardenia');
  st.flags.badge2 = true;
  check(nextGym(st).leader === 'Fantina', 'then Fantina — Platinum’s order');
  for (const g of GYMS) st.flags[`badge${g.n}`] = true;
  check(nextGym(st) === null, 'and after eight there is no next Gym');

  const fresh = createGameState({ name: 'Sammy' });
  check(currentBeat(fresh).flag === 'gotStarter', 'the story starts at the starter',
    currentBeat(fresh).text);
  check(BEATS.length >= 20, 'and runs the length of Platinum', `${BEATS.length} beats`);
  check(new Set(BEATS.map((b) => b.flag)).size === BEATS.length, 'with no beat listed twice');
  const badgeBeats = BEATS.filter((b) => /^badge\d$/.test(b.flag));
  check(badgeBeats.length === 8, 'all eight badges are beats in the story', String(badgeBeats.length));
  check(badgeBeats.every((b, i) => b.flag === `badge${i + 1}`), 'and they happen in order');
}

console.log(fails === 0 ? '\ngates: all checks passed' : `\ngates: ${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
