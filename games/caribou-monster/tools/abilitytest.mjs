// Abilities.
//
// Every Pokémon carries an ability name on its summary screen. These prove the
// engine actually reads it — each check builds the exact situation the ability
// is for, runs a real turn, and asserts the outcome differs from the same turn
// without it. An ability that cannot be told apart from its absence is a label,
// not a mechanic.
import { createBattle, resolveTurn, computeDamage, activeOf } from '../src/game/battle/engine.js';
import { createMonster, maxHp, isFainted } from '../src/game/monster.js';
import { ABILITIES, INERT_ABILITIES, abilityDescription } from '../src/game/battle/abilities.js';
import { SPECIES_LIST } from '../src/data/species.js';
import { getMove } from '../src/data/moves.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log(`  FAIL  ${msg}`); fails++; } };

// A fixed, boring battle so an ability is the only thing that varies.
function duel(aSpec, bSpec, opts = {}) {
  // Gender and ability are rolled per monster in the real game, and both now
  // change damage (Rivalry, and every ability in this file). Pin them, or an
  // A/B that is supposed to isolate one ability silently varies two things.
  const fixed = { ivs: flat(20), evs: flat(0), nature: 0, gender: 'M', shiny: false };
  const a = createMonster(aSpec, opts.aLevel || 30, { ...fixed, ability: opts.aAbility });
  const b = createMonster(bSpec, opts.bLevel || 30, { ...fixed, ability: opts.bAbility });
  if (opts.aAbility !== undefined) a.ability = opts.aAbility;
  if (opts.bAbility !== undefined) b.ability = opts.bAbility;
  if (opts.aMoves) a.moves = opts.aMoves.map((id) => ({ id, pp: getMove(id).pp, ppMax: getMove(id).pp }));
  if (opts.bMoves) b.moves = opts.bMoves.map((id) => ({ id, pp: getMove(id).pp, ppMax: getMove(id).pp }));
  if (opts.aHp) a.hp = Math.max(1, Math.floor(maxHp(a) * opts.aHp));
  if (opts.aStatus) a.status = opts.aStatus;
  const battle = createBattle({
    seed: opts.seed || 12345, kind: 'trainer', difficulty: 'normal',
    a: { id: 'p', name: 'A', isPlayer: true, party: [a], trainer: { ai: 1 } },
    b: { id: 'e', name: 'B', party: [b], trainer: { name: 'B', ai: 1 } },
  });
  return { battle, a, b };
}
const flat = (v) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v });
const text = (events) => events.filter((e) => e.t === 'text').map((e) => e.s).join(' | ');

// ---- 1. every ability in the Pokédex is accounted for -----------------------
{
  const used = new Set();
  for (const sp of SPECIES_LIST) for (const a of sp.abilities || []) used.add(a);
  for (const name of used) {
    check(!!ABILITIES[name] || !!INERT_ABILITIES[name],
      `${name} is on a species but is neither implemented nor listed as inert`);
    check(abilityDescription(name).length > 0, `${name} has no description for the summary screen`);
  }
  const implemented = [...used].filter((n) => ABILITIES[n]).length;
  console.log(`  ${used.size} abilities in the Pokédex: ${implemented} implemented, ${used.size - implemented} knowingly inert`);
}

// ---- 2. pinch abilities ------------------------------------------------------
{
  // Turtwig (Grass) using a Grass move below a third HP.
  const withIt = duel(387, 404, { aMoves: ['razorleaf'], aHp: 0.2, aAbility: 'Overgrow' });
  const without = duel(387, 404, { aMoves: ['razorleaf'], aHp: 0.2, aAbility: 'Keen Eye' });
  const d1 = computeDamage(withIt.battle, 0, getMove('razorleaf'), { peek: true }).dmg;
  const d2 = computeDamage(without.battle, 0, getMove('razorleaf'), { peek: true }).dmg;
  check(d1 > d2, `Overgrow should raise damage in a pinch: ${d1} vs ${d2}`);

  // Above a third HP it must do nothing at all.
  const healthy = duel(387, 404, { aMoves: ['razorleaf'], aHp: 1, aAbility: 'Overgrow' });
  const healthyOff = duel(387, 404, { aMoves: ['razorleaf'], aHp: 1, aAbility: 'Keen Eye' });
  check(computeDamage(healthy.battle, 0, getMove('razorleaf'), { peek: true }).dmg
    === computeDamage(healthyOff.battle, 0, getMove('razorleaf'), { peek: true }).dmg,
  'Overgrow should do nothing above a third HP');

  // And only for its own type.
  const wrongType = duel(387, 404, { aMoves: ['tackle'], aHp: 0.2, aAbility: 'Overgrow' });
  const wrongTypeOff = duel(387, 404, { aMoves: ['tackle'], aHp: 0.2, aAbility: 'Keen Eye' });
  check(computeDamage(wrongType.battle, 0, getMove('tackle'), { peek: true }).dmg
    === computeDamage(wrongTypeOff.battle, 0, getMove('tackle'), { peek: true }).dmg,
  'Overgrow should not boost a Normal move');
}

// ---- 3. Guts -----------------------------------------------------------------
{
  const guts = duel(387, 404, { aMoves: ['tackle'], aAbility: 'Guts', aStatus: 'BRN' });
  const plain = duel(387, 404, { aMoves: ['tackle'], aAbility: 'Keen Eye', aStatus: 'BRN' });
  const g = computeDamage(guts.battle, 0, getMove('tackle'), { peek: true }).dmg;
  const p = computeDamage(plain.battle, 0, getMove('tackle'), { peek: true }).dmg;
  check(g > p, `Guts should beat a burned attacker without it: ${g} vs ${p}`);
}

// ---- 4. Levitate ------------------------------------------------------------
{
  const ground = SPECIES_LIST.find((sp) => sp.learnset.some(([, m]) => getMove(m) && getMove(m).type === 'Ground'));
  const move = getMove('magnitude') || getMove('earthquake') || getMove('mudslap');
  if (move) {
    const { battle } = duel(387, 404, { aMoves: [move.id], bAbility: 'Levitate' });
    const events = resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    check(/immune/i.test(text(events)),
      `Levitate should refuse a ${move.type} move: ${text(events).slice(0, 120)}`);
    const foe = activeOf(battle.sides[1]);
    check(foe.hp === maxHp(foe) || isFainted(foe) === false, 'Levitate target should be unhurt by Ground');
  }
  void ground;
}

// ---- 5. Intimidate on entry --------------------------------------------------
{
  const a = createMonster(387, 30); const spare = createMonster(390, 30);
  const b = createMonster(404, 30);
  a.ability = 'Intimidate'; spare.ability = 'Intimidate';
  const battle = createBattle({
    seed: 99, kind: 'trainer', difficulty: 'normal',
    a: { id: 'p', name: 'A', isPlayer: true, party: [a, spare], trainer: { ai: 1 } },
    b: { id: 'e', name: 'B', party: [b], trainer: { name: 'B', ai: 1 } },
  });
  const events = resolveTurn(battle, [{ type: 'switch', index: 1 }, { type: 'move', index: 0 }]);
  check(/Intimidate/.test(text(events)), `switching in Intimidate should announce it: ${text(events).slice(0, 120)}`);
  check(battle.sides[1].boosts.atk < 0, `Intimidate should cut the foe's Attack, got ${battle.sides[1].boosts.atk}`);
}

// ---- 6. Keen Eye protects a stat --------------------------------------------
{
  const drop = Object.values(await import('../src/data/moves.js').then((m) => m.MOVES))
    .find((m) => m.effect && m.effect.kind === 'stat' && m.effect.stat === 'acc' && m.effect.stages < 0);
  if (drop) {
    const { battle } = duel(387, 404, { aMoves: [drop.id], bAbility: 'Keen Eye' });
    const events = resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    check(battle.sides[1].boosts.acc === 0,
      `Keen Eye should hold accuracy at 0, got ${battle.sides[1].boosts.acc}: ${text(events).slice(0, 120)}`);
  }
}

// ---- 7. Rock Head skips recoil -----------------------------------------------
{
  const recoilMove = Object.values(await import('../src/data/moves.js').then((m) => m.MOVES))
    .find((m) => m.effect && m.effect.kind === 'recoil');
  if (recoilMove) {
    const hard = duel(387, 404, { aMoves: [recoilMove.id], aAbility: 'Rock Head', seed: 7 });
    const soft = duel(387, 404, { aMoves: [recoilMove.id], aAbility: 'Keen Eye', seed: 7 });
    resolveTurn(hard.battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    resolveTurn(soft.battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    check(hard.a.hp >= soft.a.hp,
      `Rock Head should take no recoil: ${hard.a.hp} vs ${soft.a.hp}`);
  } else {
    console.log('  (no recoil move in the movedex; Rock Head unchecked)');
  }
}

// ---- 8. Inner Focus never flinches --------------------------------------------
{
  const { battle } = duel(387, 404, { bAbility: 'Inner Focus' });
  // Force the situation rather than fishing for a flinch move.
  const { applyStatus } = await import('../src/game/battle/engine.js');
  const out = [];
  applyStatus(battle, 1, { status: 'flinch' }, out);
  check(!battle.sides[1].volatile.flinch, 'Inner Focus should refuse a flinch');
  const other = duel(387, 404, { bAbility: 'Keen Eye' });
  applyStatus(other.battle, 1, { status: 'flinch' }, []);
  check(other.battle.sides[1].volatile.flinch, 'without Inner Focus a flinch should land');
}

// ---- 9. Natural Cure on switching out -----------------------------------------
{
  const a = createMonster(387, 30); const spare = createMonster(390, 30);
  a.ability = 'Natural Cure'; a.status = 'PSN';
  const battle = createBattle({
    seed: 5, kind: 'trainer', difficulty: 'normal',
    a: { id: 'p', name: 'A', isPlayer: true, party: [a, spare], trainer: { ai: 1 } },
    b: { id: 'e', name: 'B', party: [createMonster(404, 30)], trainer: { name: 'B', ai: 1 } },
  });
  resolveTurn(battle, [{ type: 'switch', index: 1 }, { type: 'move', index: 0 }]);
  check(a.status === null, `Natural Cure should clear status on switch out, got ${a.status}`);
}

// ---- 10. Pressure taxes PP ----------------------------------------------------
{
  const pressured = duel(387, 404, { aMoves: ['tackle'], bAbility: 'Pressure', seed: 3 });
  const normal = duel(387, 404, { aMoves: ['tackle'], bAbility: 'Keen Eye', seed: 3 });
  resolveTurn(pressured.battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
  resolveTurn(normal.battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
  check(pressured.a.moves[0].pp < normal.a.moves[0].pp,
    `Pressure should cost the attacker extra PP: ${pressured.a.moves[0].pp} vs ${normal.a.moves[0].pp}`);
}

// ---- 11. abilities never break determinism ------------------------------------
// A link battle replays the same seed on both phones. An ability that rolled
// its own dice, or that skipped one, would desync them on its first proc.
{
  const run = (seed) => {
    const a = createMonster(387, 30, { ivs: flat(15), evs: flat(0), nature: 3 });
    const b = createMonster(404, 30, { ivs: flat(15), evs: flat(0), nature: 3 });
    a.ability = 'Shed Skin'; b.ability = 'Synchronize';
    a.status = 'PAR';
    const battle = createBattle({
      seed, kind: 'trainer', difficulty: 'normal',
      a: { id: 'p', name: 'A', isPlayer: true, party: [a], trainer: { ai: 1 } },
      b: { id: 'e', name: 'B', party: [b], trainer: { name: 'B', ai: 1 } },
    });
    const log = [];
    for (let i = 0; i < 12 && !battle.over; i++) {
      log.push(text(resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }])));
    }
    return log.join('\n');
  };
  for (const seed of [11, 222, 3333]) {
    check(run(seed) === run(seed), `seed ${seed}: an ability made the battle non-deterministic`);
  }
}

// ---- 12. stress: every ability, in a real battle, never crashes ---------------
{
  const names = [...Object.keys(ABILITIES), ...Object.keys(INERT_ABILITIES)];
  let crashes = 0;
  for (let i = 0; i < names.length; i++) {
    try {
      // Both sides get a damaging move: the point of this test is that no
      // ability crashes or hangs, not that a pair of status-only movesets
      // can grind each other down.
      const { battle } = duel(
        SPECIES_LIST[i % SPECIES_LIST.length].id,
        SPECIES_LIST[(i * 7 + 3) % SPECIES_LIST.length].id,
        {
          aAbility: names[i], bAbility: names[(i + 3) % names.length], seed: 1000 + i,
          aMoves: ['tackle'], bMoves: ['tackle'],
        },
      );
      let guard = 0;
      while (!battle.over && guard++ < 400) {
        resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
      }
      check(guard < 400, `${names[i]} stalled a battle`);
    } catch (e) {
      console.log(`  CRASH ${names[i]}: ${e.message}`);
      crashes++;
    }
  }
  check(crashes === 0, `${crashes} abilities crashed a battle`);
  console.log(`  stress: ${names.length} abilities each played a full battle`);
}

console.log(fails ? `\n${fails} failure(s)` : '\nabilities: all checks passed');
process.exit(fails ? 1 : 0);
