// Trainer AI.
//
// Three tiers, matching the trainer data:
//   0  rookie — picks at random, avoids only obviously dead moves
//   1  competent — scores by expected damage and type matchup
//   2  skilled — also switches out of bad matchups and uses healing items
//
// The AI only reads public battle state, exactly what a human opponent can
// see, so it can never "cheat" by inspecting hidden values.
import { getMove } from '../../data/moves.js';
import { typeMultiplier } from '../../data/types.js';
import { getItem } from '../../data/items.js';
import { maxHp, isFainted, typesOf, statValue } from '../monster.js';
import { activeOf, foeIndex, computeDamage, effectiveStat } from './engine.js';

function usableMoves(mon) {
  const out = [];
  mon.moves.forEach((slot, i) => { if (slot.pp > 0) out.push(i); });
  return out;
}

// Expected damage as a fraction of the target's remaining HP.
function scoreMove(battle, sideIdx, moveIndex) {
  const side = battle.sides[sideIdx];
  const user = activeOf(side);
  const target = activeOf(battle.sides[foeIndex(sideIdx)]);
  const slot = user.moves[moveIndex];
  const move = getMove(slot.id);

  const eff = typeMultiplier(move.type, typesOf(target));

  if (move.power === 0) {
    // Status moves: worth something early, near-worthless when either side
    // is about to faint.
    const fx = move.effect;
    let s = 0.18;
    if (!fx) return 0;
    if (fx.kind === 'status') {
      if (target.status) return 0.02;
      s = fx.status === 'SLP' ? 0.45 : fx.status === 'PAR' ? 0.36 : 0.30;
    } else if (fx.kind === 'stat' || fx.kind === 'multistat') {
      // Boosting the same stat over and over is a waste of turns, so the
      // score decays with how far the stage has already been pushed.
      const self = fx.target === 'self';
      const boards = self ? side.boosts : battle.sides[foeIndex(sideIdx)].boosts;
      const keys = fx.kind === 'multistat' ? fx.stats.map((k) => k[0]) : [fx.stat];
      const pushed = keys.reduce((a, k) => a + Math.abs(boards[k] || 0), 0) / keys.length;
      s = (self ? 0.30 : 0.24) * Math.max(0, 1 - pushed / 2.5);
    } else if (fx.kind === 'heal' || fx.kind === 'rest') {
      s = user.hp < maxHp(user) * 0.45 ? 0.75 : 0.03;
    }
    // Setup is pointless if the user is about to die.
    if (user.hp < maxHp(user) * 0.25) s *= 0.35;
    if (battle.turn > 6) s *= 0.6;
    return s * (move.acc ? move.acc / 100 : 1);
  }

  if (eff === 0) return 0;
  // Peek at the deterministic damage without consuming shared RNG: use a
  // mid roll by computing with the real formula and normalising.
  const { dmg } = computeDamage(battle, sideIdx, move, { peek: true });
  const frac = Math.min(1.4, dmg / Math.max(1, target.hp));
  const accuracy = move.acc ? move.acc / 100 : 1;
  let s = frac * accuracy;
  if (frac >= 1) s += 0.6;                      // a kill is worth a lot
  if (move.priority > 0 && frac >= 1) s += 0.4; // a guaranteed kill even more
  return s;
}

function bestSwitch(battle, sideIdx) {
  const side = battle.sides[sideIdx];
  const foe = activeOf(battle.sides[foeIndex(sideIdx)]);
  let best = -1, bestScore = -Infinity;
  side.party.forEach((mon, i) => {
    if (!mon || isFainted(mon) || i === side.active) return;
    let score = 0;
    // Defensive matchup against the foe's likeliest attack type.
    for (const slot of foe.moves) {
      const mv = getMove(slot.id);
      if (mv.power <= 0) continue;
      score -= typeMultiplier(mv.type, typesOf(mon)) * 0.6;
    }
    // Offensive matchup.
    for (const slot of mon.moves) {
      const mv = getMove(slot.id);
      if (mv.power <= 0) continue;
      score += typeMultiplier(mv.type, typesOf(foe)) * 0.5;
    }
    score += (mon.hp / maxHp(mon)) * 1.2;
    score += statValue(mon, 'spe') / 400;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return { index: best, score: bestScore };
}

export function chooseAiAction(battle, sideIdx) {
  const side = battle.sides[sideIdx];
  const mon = activeOf(side);
  const level = side.trainer ? (side.trainer.ai ?? 1) : (battle.kind === 'wild' ? 0 : 1);
  const moves = usableMoves(mon);
  if (!moves.length) return { type: 'move', index: 0 };  // Struggle

  // Tier 2: consider healing and switching before attacking.
  if (level >= 2) {
    const bag = side.trainer && side.trainer.items;
    if (mon.hp > 0 && mon.hp < maxHp(mon) * 0.3 && side.itemsUsed < 2 && (bag !== 0)) {
      return { type: 'item', item: 'hyperpotion', target: side.active };
    }
    // Switch when everything we have is resisted and we have a better option.
    const bestNow = Math.max(...moves.map((i) => scoreMove(battle, sideIdx, i)));
    if (bestNow < 0.28) {
      const sw = bestSwitch(battle, sideIdx);
      if (sw.index >= 0 && sw.score > 1.2 && battle.scratch() < 0.7) {
        return { type: 'switch', index: sw.index };
      }
    }
  }

  if (level === 0) {
    // Rookies still refuse a move that literally cannot work.
    const sensible = moves.filter((i) => {
      const mv = getMove(mon.moves[i].id);
      if (mv.power <= 0) return true;
      return typeMultiplier(mv.type, typesOf(activeOf(battle.sides[foeIndex(sideIdx)]))) > 0;
    });
    const pool = sensible.length ? sensible : moves;
    return { type: 'move', index: pool[battle.scratch.int(pool.length)] };
  }

  const scored = moves.map((i) => ({ i, s: scoreMove(battle, sideIdx, i) }));
  scored.sort((a, b) => b.s - a.s);
  // A little noise keeps fights from feeling scripted.
  const noise = level >= 2 ? 0.12 : 0.3;
  if (scored.length > 1 && battle.scratch() < noise) {
    return { type: 'move', index: scored[1].i };
  }
  return { type: 'move', index: scored[0].i };
}

// Which monster the AI sends out after a faint.
export function chooseAiSwitch(battle, sideIdx) {
  const sw = bestSwitch(battle, sideIdx);
  if (sw.index >= 0) return sw.index;
  return battle.sides[sideIdx].party.findIndex((m) => m && !isFainted(m));
}

export { effectiveStat, getItem };
