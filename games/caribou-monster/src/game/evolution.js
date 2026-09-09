// Evolution.
//
// Level-up evolution is what the first region needs, but the data shape and
// this resolver already handle stones, friendship, trade, held items,
// time of day and location — so adding those later is content, not surgery.
import { getSpecies } from '../data/species.js';
import { maxHp, movesAtLevel, makeMoveSlot, knowsMove } from './monster.js';

/**
 * Returns the evolution a monster is eligible for right now, or null.
 * `trigger` narrows it: 'level' | 'stone' | 'trade' | 'friendship'.
 */
export function evolutionFor(mon, trigger = 'level', ctx = {}) {
  const sp = getSpecies(mon.species);
  if (!sp || !sp.evolutions) return null;
  for (const evo of sp.evolutions) {
    switch (evo.method) {
      case 'level':
        if (trigger === 'level' && mon.level >= evo.level) return evo;
        break;
      case 'stone':
        if (trigger === 'stone' && ctx.stone === evo.stone) return evo;
        break;
      case 'friendship':
        if (trigger === 'level' && (mon.friendship || 0) >= (evo.friendship || 220)) return evo;
        break;
      case 'trade':
        if (trigger === 'trade' && (!evo.item || mon.heldItem === evo.item)) return evo;
        break;
      case 'item':
        if (trigger === 'level' && mon.heldItem === evo.item) return evo;
        break;
      case 'location':
        if (trigger === 'level' && ctx.map === evo.map && mon.level >= (evo.level || 1)) return evo;
        break;
      default: break;
    }
  }
  return null;
}

/**
 * Performs the evolution in place. Keeps HP proportional so a monster never
 * evolves into an instant faint, and teaches any move the new species knows
 * at this level that it is missing.
 */
export function evolveNow(mon, intoId) {
  const target = getSpecies(intoId);
  if (!target) return false;
  const beforeMax = maxHp(mon);
  const ratio = beforeMax > 0 ? mon.hp / beforeMax : 1;

  mon.species = intoId;
  mon.ability = target.abilities[0];
  if (mon.nickname === getSpecies(mon.species).name) mon.nickname = null;

  const afterMax = maxHp(mon);
  mon.hp = Math.max(1, Math.round(afterMax * ratio));

  // A newly evolved monster picks up anything it should already know.
  if (mon.moves.length < 4) {
    for (const id of movesAtLevel(intoId, mon.level)) {
      if (mon.moves.length >= 4) break;
      if (!knowsMove(mon, id)) mon.moves.push(makeMoveSlot(id));
    }
  }
  return true;
}

/** Uses an evolution stone from the bag. Returns the new species id or null. */
export function tryStone(mon, stone) {
  const evo = evolutionFor(mon, 'stone', { stone });
  if (!evo) return null;
  evolveNow(mon, evo.into);
  return evo.into;
}

/** Checked after a trade completes. */
export function tryTradeEvolution(mon) {
  const evo = evolutionFor(mon, 'trade');
  if (!evo) return null;
  evolveNow(mon, evo.into);
  return evo.into;
}
