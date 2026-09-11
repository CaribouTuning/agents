// The player's entire game state.
//
// Deliberately one plain object graph: it is what the save layer writes, what
// the debug menu inspects, and what a future cloud backend would sync. Two
// co-op players each own a completely separate GameState — only the room and
// the shared story milestones are common.
import { createInventory, addItem } from './inventory.js';
import { PLAYERS, playerByLook, playerByName } from './players.js';
import { createDex, recordSeen, recordCaught } from './pokedex.js';
import { createFlags, setFlag, getFlag, FLAGS, storyProgress } from './storyflags.js';
import {
  createMonster, healFully, isFainted, reviveMonster, serializeMonster, displayName,
} from './monster.js';
import { createCircuit, serializeCircuit, reviveCircuit } from './circuit/circuit.js';
import { createJournal, serializeJournal, reviveJournal } from './journal.js';
import { createDaycare, serializeDaycare, reviveDaycare } from './daycare.js';
import { createPatches, serializePatches, revivePatches } from './berries.js';
import { createUnderground, serializeUnderground, reviveUnderground } from './underground/site.js';
import { serializeCleared, reviveCleared } from './fieldmoves.js';

export const MAX_PARTY = 6;
export const BOX_COUNT = 8;
export const BOX_SIZE = 30;

export function createGameState(opts = {}) {
  // You wake up in your own house, and which one that is depends on which
  // of the two you picked: the left-hand house in Twinleaf is Matthew's and
  // the right-hand one is Sammy's, always, whoever is holding the phone.
  const home = (playerByLook(opts.look) || playerByName(opts.name) || PLAYERS[0]).house;
  return {
    version: 1,
    player: {
      name: opts.name || 'Matthew',
      look: opts.look || 'boy',
      id: opts.id || Math.floor(Math.random() * 65536),
      map: home,
      x: 5, y: 5, dir: 'down',
      running: false,
    },
    party: [],
    boxes: Array.from({ length: BOX_COUNT }, (_, i) => ({ name: `BOX ${i + 1}`, mons: [] })),
    inventory: createInventory({
      money: 3000,
      items: { pokeball: 5, potion: 3 },
    }),
    dex: createDex(),
    flags: createFlags(),
    badges: [],
    difficulty: opts.difficulty || 'easy',
    playTimeMs: 0,
    startedAt: Date.now(),
    lastHealPoint: { map: home, x: 5, y: 6 },
    // Who is walking with you. A generic slot: usually the other one, but
    // the story hands it to Looker and to Riley too.
    companion: { look: null, name: null, key: null, active: false },
    repelSteps: 0,
    starterBase: null,
    stats: { battlesWon: 0, caught: 0, steps: 0 },
    // The World Circuit career runs alongside the badge quest.
    circuit: createCircuit(),
    // What the player has worked out so far, and what they are doing next.
    journal: createJournal(),
    daycare: createDaycare(),
    // Berries in the ground, keyed by where they are.
    patches: createPatches(),
    // The Underground: where you climbed down from, and which seams are spent.
    underground: createUnderground(),
    // Every place you have stood in. The Town Map draws only these.
    visited: {},
    // Trees cut down, rocks smashed, walls climbed: obstacles stay cleared.
    cleared: {},
    settings: { textSpeed: 1, music: true, sfx: true, showGrid: false, guide: true, testMode: false },
  };
}

// ---- party ------------------------------------------------------------

export function partyCount(st) { return st.party.length; }
export function livingParty(st) { return st.party.filter((m) => !isFainted(m)); }
export function hasUsableMon(st) { return st.party.some((m) => !isFainted(m)); }
export function firstLiving(st) { return st.party.findIndex((m) => !isFainted(m)); }

export function addToParty(st, mon) {
  if (st.party.length >= MAX_PARTY) return false;
  st.party.push(mon);
  return true;
}

// Adds to the party if there is room, otherwise to the first box with space.
// Returns { where:'party'|'box', box?, boxName? } or null if everything is full.
export function receiveMonster(st, mon) {
  recordCaught(st.dex, mon.species);
  if (addToParty(st, mon)) return { where: 'party' };
  for (let i = 0; i < st.boxes.length; i++) {
    if (st.boxes[i].mons.length < BOX_SIZE) {
      st.boxes[i].mons.push(mon);
      return { where: 'box', box: i, boxName: st.boxes[i].name };
    }
  }
  return null;
}

export function healParty(st) {
  for (const m of st.party) healFully(m);
}

export function swapParty(st, i, j) {
  if (i === j) return;
  const a = st.party[i];
  st.party[i] = st.party[j];
  st.party[j] = a;
}

export function partyToBox(st, partyIndex, boxIndex) {
  if (st.party.length <= 1) return false;
  const box = st.boxes[boxIndex];
  if (!box || box.mons.length >= BOX_SIZE) return false;
  box.mons.push(st.party.splice(partyIndex, 1)[0]);
  return true;
}

export function boxToParty(st, boxIndex, monIndex) {
  if (st.party.length >= MAX_PARTY) return false;
  const box = st.boxes[boxIndex];
  if (!box || !box.mons[monIndex]) return false;
  st.party.push(box.mons.splice(monIndex, 1)[0]);
  return true;
}

export function releaseFromBox(st, boxIndex, monIndex) {
  const box = st.boxes[boxIndex];
  if (!box || !box.mons[monIndex]) return null;
  return box.mons.splice(monIndex, 1)[0];
}

export function findMonByUid(st, uid) {
  const p = st.party.findIndex((m) => m.uid === uid);
  if (p >= 0) return { mon: st.party[p], where: 'party', index: p };
  for (let b = 0; b < st.boxes.length; b++) {
    const i = st.boxes[b].mons.findIndex((m) => m.uid === uid);
    if (i >= 0) return { mon: st.boxes[b].mons[i], where: 'box', box: b, index: i };
  }
  return null;
}

export function removeMonByUid(st, uid) {
  const found = findMonByUid(st, uid);
  if (!found) return null;
  if (found.where === 'party') return st.party.splice(found.index, 1)[0];
  return st.boxes[found.box].mons.splice(found.index, 1)[0];
}

// ---- badges & flags -----------------------------------------------------

export function awardBadge(st, n, name) {
  if (st.badges.includes(n)) return false;
  st.badges.push(n);
  st.badges.sort((a, b) => a - b);
  setFlag(st.flags, `badge${n}`, true);
  return true;
}

export const badgeCount = (st) => st.badges.length;
export const flag = (st, k) => getFlag(st.flags, k);
export const setStoryFlag = (st, k, v = true) => setFlag(st.flags, k, v);
export const progress = (st) => storyProgress(st.flags);

// ---- play time ----------------------------------------------------------

export function tickPlayTime(st, dtMs) { st.playTimeMs += dtMs; }

export function formatPlayTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

// ---- serialisation -------------------------------------------------------

export function serializeState(st) {
  return {
    version: st.version,
    player: { ...st.player },
    party: st.party.map(serializeMonster),
    boxes: st.boxes.map((b) => ({ name: b.name, mons: b.mons.map(serializeMonster) })),
    inventory: { money: st.inventory.money, items: { ...st.inventory.items } },
    dex: { seen: { ...st.dex.seen }, caught: { ...st.dex.caught } },
    flags: { ...st.flags },
    badges: [...st.badges],
    difficulty: st.difficulty,
    playTimeMs: st.playTimeMs,
    startedAt: st.startedAt,
    lastHealPoint: { ...st.lastHealPoint },
    starterBase: st.starterBase,
    stats: { ...st.stats },
    settings: { ...st.settings },
    companion: { ...(st.companion || {}) },
    circuit: serializeCircuit(st.circuit),
    journal: serializeJournal(st.journal),
    daycare: serializeDaycare(st.daycare),
    patches: serializePatches(st.patches),
    underground: serializeUnderground(st.underground),
    visited: { ...st.visited },
    cleared: serializeCleared(st.cleared),
  };
}

export function deserializeState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const st = createGameState({ name: raw.player?.name });
  st.version = raw.version || 1;
  Object.assign(st.player, raw.player || {});
  st.party = (raw.party || []).map(reviveMonster).filter(Boolean).slice(0, MAX_PARTY);
  if (Array.isArray(raw.boxes)) {
    raw.boxes.forEach((b, i) => {
      if (!st.boxes[i]) return;
      st.boxes[i].name = b.name || st.boxes[i].name;
      st.boxes[i].mons = (b.mons || []).map(reviveMonster).filter(Boolean).slice(0, BOX_SIZE);
    });
  }
  st.inventory = createInventory(raw.inventory || {});
  st.dex = { seen: { ...(raw.dex?.seen || {}) }, caught: { ...(raw.dex?.caught || {}) } };
  st.flags = { ...(raw.flags || {}) };
  st.badges = Array.isArray(raw.badges) ? [...raw.badges] : [];
  st.difficulty = raw.difficulty === 'normal' ? 'normal' : 'easy';
  st.playTimeMs = raw.playTimeMs || 0;
  st.startedAt = raw.startedAt || Date.now();
  st.lastHealPoint = raw.lastHealPoint || st.lastHealPoint;
  st.starterBase = raw.starterBase ?? null;
  Object.assign(st.stats, raw.stats || {});
  Object.assign(st.settings, raw.settings || {});
  if (raw.companion) Object.assign(st.companion, raw.companion);
  st.circuit = reviveCircuit(raw.circuit);
  st.journal = reviveJournal(raw.journal);
  st.daycare = reviveDaycare(raw.daycare, reviveMonster);
  st.patches = revivePatches(raw.patches);
  st.underground = reviveUnderground(raw.underground);
  st.visited = {};
  for (const k of Object.keys(raw.visited || {})) if (typeof k === 'string') st.visited[k] = true;
  st.cleared = reviveCleared(raw.cleared);
  return st;
}

// ---- debug helpers (used by the developer menu) ---------------------------

export function debugGive(st, speciesId, level = 5) {
  const mon = createMonster(speciesId, level);
  mon.ot = st.player.name;
  mon.otId = st.player.id;
  return receiveMonster(st, mon);
}

export function debugGiveItem(st, id, qty = 1) { return addItem(st.inventory, id, qty); }

export { FLAGS, recordSeen, recordCaught, displayName };
