// A monster instance: the thing that lives in a party, a box, or a battle.
//
// Instances are plain serialisable objects — no class instances, no
// functions — so a monster can be written to a save file or sent across the
// network with JSON.stringify and nothing is lost.
import { getSpecies, expForLevel, natureModifier, natureName, NATURES } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { rng } from '../core/rng.js';

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_NAMES = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' };
export const STAT_SHORT = { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SPA', spd: 'SPD', spe: 'SPE' };

let uidCounter = 1;
export function newUid(prefix = 'm') {
  return `${prefix}${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// The four most recent level-up moves at or below `level`.
export function movesAtLevel(speciesId, level) {
  const sp = getSpecies(speciesId);
  const learned = sp.learnset.filter(([lv]) => lv <= level).map(([, id]) => id);
  const unique = [];
  for (const id of learned) if (!unique.includes(id)) unique.push(id);
  return unique.slice(-4);
}

export function makeMoveSlot(id) {
  const mv = getMove(id);
  return { id, pp: mv.pp, ppMax: mv.pp };
}

export function createMonster(speciesId, level, opts = {}) {
  const sp = getSpecies(speciesId);
  if (!sp) throw new Error(`unknown species ${speciesId}`);
  const r = opts.rng || rng;

  const ivs = opts.ivs || {
    hp: r.int(32), atk: r.int(32), def: r.int(32), spa: r.int(32), spd: r.int(32), spe: r.int(32),
  };
  const evs = opts.evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  let gender = 'N';
  if (sp.genderRatio >= 0) gender = r() < sp.genderRatio ? 'M' : 'F';

  const moveIds = opts.moves && opts.moves.length ? opts.moves.slice(0, 4) : movesAtLevel(speciesId, level);

  const mon = {
    uid: opts.uid || newUid(),
    species: speciesId,
    nickname: opts.nickname || null,
    level,
    exp: expForLevel(sp.growth, level),
    nature: opts.nature != null ? opts.nature : r.int(NATURES.length),
    gender,
    shiny: opts.shiny != null ? opts.shiny : r.int(1024) === 0,
    ability: sp.abilities[0],
    ivs,
    evs,
    moves: moveIds.map(makeMoveSlot),
    status: null,
    statusCounter: 0,
    heldItem: opts.heldItem || null,
    friendship: opts.friendship != null ? opts.friendship : 70,
    ot: opts.ot || null,
    otId: opts.otId || null,
    caughtBall: opts.caughtBall || 'pokeball',
    caughtAt: opts.caughtAt || null,
    caughtLevel: opts.caughtLevel != null ? opts.caughtLevel : level,
    hp: 0,
  };
  mon.hp = maxHp(mon);
  return mon;
}

export function statValue(mon, key) {
  const sp = getSpecies(mon.species);
  const base = sp.base[key];
  const iv = mon.ivs[key] || 0;
  const ev = Math.floor((mon.evs[key] || 0) / 4);
  if (key === 'hp') {
    if (sp.base.hp === 1) return 1; // future shedinja-likes
    return Math.floor(((2 * base + iv + ev) * mon.level) / 100) + mon.level + 10;
  }
  const raw = Math.floor(((2 * base + iv + ev) * mon.level) / 100) + 5;
  return Math.floor(raw * natureModifier(mon.nature, key));
}

export function maxHp(mon) { return statValue(mon, 'hp'); }

export function allStats(mon) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = statValue(mon, k);
  return out;
}

export function displayName(mon) {
  return mon.nickname || getSpecies(mon.species).name;
}

export function speciesOf(mon) { return getSpecies(mon.species); }
export function typesOf(mon) { return getSpecies(mon.species).types; }
export function natureOf(mon) { return natureName(mon.nature); }

export function isFainted(mon) { return mon.hp <= 0; }

export function healFully(mon) {
  mon.hp = maxHp(mon);
  mon.status = null;
  mon.statusCounter = 0;
  for (const m of mon.moves) m.pp = m.ppMax;
}

export function restorePP(mon) { for (const m of mon.moves) m.pp = m.ppMax; }

// ---- experience ------------------------------------------------------

export function expToNext(mon) {
  const sp = getSpecies(mon.species);
  if (mon.level >= 100) return 0;
  return expForLevel(sp.growth, mon.level + 1) - mon.exp;
}

export function expProgress(mon) {
  const sp = getSpecies(mon.species);
  if (mon.level >= 100) return 1;
  const lo = expForLevel(sp.growth, mon.level);
  const hi = expForLevel(sp.growth, mon.level + 1);
  if (hi <= lo) return 1;
  return Math.max(0, Math.min(1, (mon.exp - lo) / (hi - lo)));
}

// Awards exp and returns a list of things that happened, for the battle log
// to narrate: [{ type:'level', level }, { type:'move', move }, ...]
export function gainExp(mon, amount) {
  const sp = getSpecies(mon.species);
  const events = [];
  if (mon.level >= 100) return events;
  mon.exp += amount;
  while (mon.level < 100 && mon.exp >= expForLevel(sp.growth, mon.level + 1)) {
    const before = maxHp(mon);
    mon.level++;
    const after = maxHp(mon);
    mon.hp += after - before;   // level-ups grant the new HP immediately
    events.push({ type: 'level', level: mon.level });
    for (const [lv, moveId] of sp.learnset) {
      if (lv === mon.level) events.push({ type: 'learn', move: moveId });
    }
    for (const evo of sp.evolutions) {
      if (evo.method === 'level' && mon.level >= evo.level) {
        events.push({ type: 'evolve', into: evo.into });
        break;
      }
    }
  }
  return events;
}

// Exp yield for defeating `loser`, awarded to one participant.
export function expYield(loser, winnerLevel, isTrainerBattle, participants = 1) {
  const sp = getSpecies(loser.species);
  const a = isTrainerBattle ? 1.5 : 1;
  return Math.max(1, Math.floor((sp.baseExp * loser.level * a) / (7 * Math.max(1, participants))));
}

// A small, readable EV spread: the defeated species' best stat.
export function awardEvs(mon, loser) {
  const sp = getSpecies(loser.species);
  let best = 'hp', bestV = -1;
  for (const k of STAT_KEYS) if (sp.base[k] > bestV) { bestV = sp.base[k]; best = k; }
  const total = STAT_KEYS.reduce((a, k) => a + (mon.evs[k] || 0), 0);
  if (total >= 510) return;
  mon.evs[best] = Math.min(252, (mon.evs[best] || 0) + Math.max(1, Math.round(sp.baseTotal / 120)));
}

// ---- moves -----------------------------------------------------------

export function knowsMove(mon, moveId) { return mon.moves.some((m) => m.id === moveId); }

export function learnMove(mon, moveId, replaceIndex = -1) {
  if (knowsMove(mon, moveId)) return false;
  if (mon.moves.length < 4) { mon.moves.push(makeMoveSlot(moveId)); return true; }
  if (replaceIndex >= 0 && replaceIndex < 4) { mon.moves[replaceIndex] = makeMoveSlot(moveId); return true; }
  return false;
}

// TM compatibility: a species can learn a TM if the move is in its learnset
// or shares one of its types. Deliberately generous — this is a co-op game.
export function canLearnTm(mon, moveId) {
  const sp = getSpecies(mon.species);
  if (sp.learnset.some(([, id]) => id === moveId)) return true;
  const mv = getMove(moveId);
  return sp.types.includes(mv.type) || mv.type === 'Normal';
}

// ---- serialisation ---------------------------------------------------
// Instances are already plain data; these exist to version the shape and to
// repair anything a future roster change invalidates.

export function serializeMonster(mon) { return { ...mon, ivs: { ...mon.ivs }, evs: { ...mon.evs }, moves: mon.moves.map((m) => ({ ...m })) }; }

export function reviveMonster(raw) {
  if (!raw || !getSpecies(raw.species)) return null;
  const mon = { ...raw };
  mon.ivs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(raw.ivs || {}) };
  mon.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(raw.evs || {}) };
  mon.moves = (raw.moves || []).filter((m) => m && m.id).map((m) => ({ id: m.id, pp: m.pp ?? 0, ppMax: m.ppMax ?? getMove(m.id).pp }));
  if (!mon.moves.length) mon.moves = movesAtLevel(mon.species, mon.level).map(makeMoveSlot);
  mon.hp = Math.max(0, Math.min(maxHp(mon), raw.hp ?? maxHp(mon)));
  return mon;
}
