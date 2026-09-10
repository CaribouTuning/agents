// Save integrity.
//
// A save is the only thing in this game that has to survive a closed tab, a
// dead battery and a content update. This suite proves three things:
//
//   1. round trip: everything the player earned comes back byte-identical
//   2. migration: a save written before the real Pokedex still opens, with
//      the right Pokemon in it
//   3. refusal: a save this build does not understand is rejected loudly
//      rather than opened half-way
//
// It runs on the source modules with an in-memory backend, so it needs no
// browser and no localStorage.
import { SaveManager, SAVE_VERSION } from '../src/save/SaveManager.js';
import { createGameState, serializeState, deserializeState, awardBadge, setStoryFlag } from '../src/game/state.js';
import { createMonster, maxHp } from '../src/game/monster.js';
import { createCircuit } from '../src/game/circuit/circuit.js';
import { record as journalRecord, ENTRIES as JOURNAL_ENTRIES } from '../src/game/journal.js';

const JOURNAL_SECOND = JOURNAL_ENTRIES[1].id;
import { migrateV1toV2 } from '../src/save/migrations.js';
import { getSpecies } from '../src/data/species.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

class MemoryBackend {
  constructor() { this.name = 'memory'; this.slots = new Map(); }
  available() { return true; }
  async read(slot) { const v = this.slots.get(slot); return v ? JSON.parse(v) : null; }
  // Stored as a string on purpose: this is what a real backend does, and it
  // catches anything in the payload that JSON cannot carry.
  async write(slot, data) { this.slots.set(slot, JSON.stringify(data)); return true; }
  async remove(slot) { this.slots.delete(slot); return true; }
  async list() { return [...this.slots.keys()]; }
}

// ---- a save worth losing ----------------------------------------------------

function playedGame() {
  const st = createGameState({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  st.starterBase = 387;
  st.party = [
    createMonster(389, 36, { gender: 'M', ability: 'Overgrow', nickname: 'Tank' }),
    createMonster(405, 34, { gender: 'F', ability: 'Rivalry' }),
    createMonster(448, 40, { gender: 'M', ability: 'Steadfast' }),
  ];
  st.party[0].hp = 12;
  st.party[0].status = 'BRN';
  st.party[1].heldItem = 'oranberry';
  st.party[1].friendship = 210;
  st.party[2].moves[0].pp = 3;
  st.boxes[0].mons = [createMonster(129, 12, { gender: 'F' }), createMonster(483, 47, { gender: 'N' })];
  st.boxes[0].name = 'CAVE';
  for (const id of [387, 389, 396, 403, 405, 448, 483]) { st.dex.seen[id] = 1; st.dex.caught[id] = 1; }
  st.inventory.money = 41230;
  st.inventory.items.pokeball = 17;
  st.inventory.items.auroracharm = 1;
  awardBadge(st, 1, 'Coal Badge');
  setStoryFlag(st, 'gotStarter');
  setStoryFlag(st, 'caughtEverlight');
  st.player.map = 'oreburgh';
  st.player.x = 14; st.player.y = 9; st.player.dir = 'left';
  st.playTimeMs = 3_600_000 + 42_000;
  st.circuit = createCircuit();
  st.circuit.joined = true;
  st.circuit.cp = 250;
  st.circuit.wins = 4;
  st.circuit.losses = 1;
  st.circuit.rating = 1180;
  st.circuit.titles = ['rookie_cup'];
  journalRecord(st, 'gotStarter');
  journalRecord(st, JOURNAL_SECOND);
  return st;
}

// ---- 1. round trip ----------------------------------------------------------

{
  const save = new SaveManager(new MemoryBackend());
  const before = playedGame();
  const wrote = await save.save(before);
  check(wrote, 'a played game writes to the backend');

  const after = await save.load();
  check(!!after, 'and reads back into a state object');

  const a = JSON.stringify(serializeState(before));
  const b = JSON.stringify(serializeState(after));
  check(a === b, 'the reloaded save serialises identically to the original',
    a === b ? `${a.length} bytes` : firstDiff(a, b));

  // Then spot-check the things a player would actually notice.
  check(after.party.length === 3, 'the party came back whole', `${after.party.length}`);
  check(after.party[0].nickname === 'Tank', 'a nickname survives');
  check(after.party[0].hp === 12 && after.party[0].status === 'BRN',
    'damage and status survive', `${after.party[0].hp} hp, ${after.party[0].status}`);
  check(after.party[1].heldItem === 'oranberry', 'a held item survives');
  check(after.party[1].friendship === 210, 'friendship survives');
  check(after.party[1].ability === 'Rivalry', 'the rolled ability survives', after.party[1].ability);
  check(after.party[2].moves[0].pp === 3, 'spent PP survives');
  check(after.boxes[0].mons.length === 2 && after.boxes[0].name === 'CAVE', 'the box survives');
  check(after.inventory.money === 41230, 'money survives');
  check(after.inventory.items.pokeball === 17, 'the bag survives');
  check(after.badges.length === 1, 'the badge survives');
  check(after.flags.caughtEverlight === true, 'story flags survive');
  check(after.player.map === 'oreburgh' && after.player.x === 14 && after.player.y === 9,
    'the player comes back where they stood', `${after.player.map} ${after.player.x},${after.player.y}`);
  check(Object.keys(after.dex.caught).length === 7, 'the Pokedex survives');
  check(after.circuit.joined && after.circuit.rating === 1180 && after.circuit.titles.length === 1,
    'the circuit career survives', `rating ${after.circuit.rating}`);
  check(after.journal.seen.length === 2, 'the journal survives', `${after.journal.seen.length} entries`);
  check(after.difficulty === 'easy', 'the difficulty survives');
}

// ---- 2. saving twice, and reloading in between ------------------------------

{
  const backend = new MemoryBackend();
  const save = new SaveManager(backend);
  const st = playedGame();
  await save.save(st);
  const first = await save.load();

  first.inventory.money += 500;
  first.party[0].hp = maxHp(first.party[0]);
  await save.save(first);
  const second = await save.load();

  check(second.inventory.money === 41730, 'a second save overwrites the first', `${second.inventory.money}`);
  check(second.party[0].hp === maxHp(second.party[0]), 'a heal made between saves is kept');
  check((await backend.list()).length === 1, 'saving twice leaves one slot, not two');

  const meta = await save.peek();
  check(meta && meta.name === 'Matthew' && meta.badges === 1,
    'the continue screen can read the save without loading it', JSON.stringify(meta && meta.party));
}

// ---- 3. a save from before the real Pokedex ---------------------------------

{
  const legacy = {
    v: 1,
    savedAt: Date.now(),
    state: {
      version: 1,
      player: { name: 'Sammy', look: 'sammy', map: 'route201', x: 4, y: 9, dir: 'up' },
      // Old ids: 1 Turtwig, 16 Staravia, 37 the Everlight.
      party: [{ species: 1, level: 14, moves: [{ id: 'tackle', pp: 30, ppMax: 35 }], ivs: {}, evs: {}, hp: 30 }],
      boxes: [{ name: 'BOX 1', mons: [{ species: 16, level: 9, moves: [], ivs: {}, evs: {}, hp: 20 }] }],
      dex: { seen: { 1: 1, 16: 1, 37: 1 }, caught: { 1: 1 } },
      starterBase: 1,
      inventory: { money: 900, items: { pokeball: 4 } },
      flags: { gotStarter: true },
      badges: [],
    },
  };

  const migrated = migrateV1toV2(legacy.state);
  check(migrated.party[0].species === 387, 'a v1 Turtwig is still a Turtwig', String(migrated.party[0].species));
  check(migrated.boxes[0].mons[0].species === 404 || migrated.boxes[0].mons[0].species === 403
    || getSpecies(migrated.boxes[0].mons[0].species) !== undefined,
    'a v1 box Pokemon maps to a real species', getSpecies(migrated.boxes[0].mons[0].species).name);
  check(!!migrated.dex.seen[483], 'a v1 Everlight sighting maps to Dialga');
  check(migrated.starterBase === 387, 'the recorded starter maps too');

  const backend = new MemoryBackend();
  await backend.write('save1', legacy);
  const save = new SaveManager(backend);
  const loaded = await save.load();
  check(!!loaded, 'a v1 save still opens');
  check(loaded.party.length === 1, 'and does not lose the party to unknown species',
    `${loaded.party.length} in party`);
  check(getSpecies(loaded.party[0].species).name === 'Turtwig',
    'and the Pokemon in it is the one the player caught',
    getSpecies(loaded.party[0].species).name);
  check(!!loaded.party[0].ability, 'a v1 Pokemon is given the ability it never stored',
    loaded.party[0].ability);
  check(loaded.player.name === 'Sammy', 'and it is still their game');
}

// ---- 4. a save this build does not understand -------------------------------

{
  const backend = new MemoryBackend();
  await backend.write('save1', { v: SAVE_VERSION + 5, state: { player: { name: 'Future' } } });
  const save = new SaveManager(backend);
  const loaded = await save.load();
  check(loaded === null, 'a save from a newer build is refused, not half-opened');

  await backend.write('save1', { v: 2, state: null });
  check((await save.load()) === null, 'a corrupt payload is refused');
  check((await save.peek()) === null, 'and the continue screen does not offer it');
}

// ---- 5. a fresh game is not a save ------------------------------------------

{
  const save = new SaveManager(new MemoryBackend());
  check(!(await save.hasSave()), 'an empty backend reports no save');
  check((await save.load()) === null, 'and loading it returns nothing');
}

// ---- 6. nothing in a save survives that should not ---------------------------

{
  const st = playedGame();
  const raw = serializeState(st);
  const json = JSON.stringify(raw);
  check(!json.includes('undefined'), 'the payload has no undefined in it');
  check(!/\[object Object\]/.test(json), 'nothing was stringified by accident');
  const round = deserializeState(JSON.parse(json));
  check(round.party.every((m) => m.hp <= maxHp(m)), 'no Pokemon comes back over its own max HP');
  check(round.party.every((m) => m.moves.length > 0), 'no Pokemon comes back with no moves');
}

function firstDiff(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `first difference at ${i}: ...${a.slice(Math.max(0, i - 40), i + 40)}`;
  }
  return 'same';
}

console.log(fails ? `\n${fails} failure(s)` : '\nsaves: all checks passed');
process.exit(fails ? 1 : 0);
