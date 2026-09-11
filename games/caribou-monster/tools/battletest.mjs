import { createBattle, resolveTurn, needsSwitch, forceSwitch, activeOf, battleChecksum } from '../src/game/battle/engine.js';
import { chooseAiAction, chooseAiSwitch } from '../src/game/battle/ai.js';
import { createMonster, isFainted, displayName, healFully } from '../src/game/monster.js';
import { SPECIES_LIST } from '../src/data/species.js';
import { makeRng } from '../src/core/rng.js';

function team(r, n, lvl) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const sp = SPECIES_LIST[r.int(SPECIES_LIST.length)];
    out.push(createMonster(sp.id, lvl, { rng: r }));
  }
  return out;
}

function run(seed, { verbose = false, difficulty = 'easy' } = {}) {
  const r = makeRng(seed);
  const a = team(r, 3, 15), b = team(r, 3, 15);
  const battle = createBattle({
    seed, kind: 'trainer', difficulty,
    a: { id: 'p', name: 'Matthew', isPlayer: true, party: a, trainer: { ai: 2, prize: 100 } },
    b: { id: 'e', name: 'Rival', party: b, trainer: { name: 'Rival', ai: 2, prize: 100, defeat: 'gg' } },
  });
  let guard = 0;
  const log = [];
  while (!battle.over && guard++ < 300) {
    for (let s = 0; s < 2; s++) {
      if (needsSwitch(battle, s)) {
        const idx = chooseAiSwitch(battle, s);
        if (idx >= 0) forceSwitch(battle, s, idx);
      }
    }
    if (battle.over) break;
    const acts = [chooseAiAction(battle, 0), chooseAiAction(battle, 1)];
    const events = resolveTurn(battle, acts);
    for (const e of events) if (e.t === 'text') log.push(e.s);
  }
  if (verbose) console.log(log.slice(0, 40).join('\n'));
  return { result: battle.result, turns: battle.turn, sum: battleChecksum(battle), guard, log };
}

// 1) Stress: no crashes, all battles terminate
let fails = 0, results = {};
for (let i = 0; i < 400; i++) {
  try {
    const rr = run(1000 + i);
    results[rr.result] = (results[rr.result] || 0) + 1;
    if (rr.guard >= 300) { console.log('STALLED at seed', 1000 + i); fails++; }
  } catch (e) { console.log('CRASH seed', 1000 + i, e.message); fails++; if (fails > 3) break; }
}
console.log('400 battles ->', JSON.stringify(results), 'failures:', fails);

// 2) Determinism: identical seeds must produce identical outcomes
const x = run(4242), y = run(4242);
console.log('determinism:', x.sum === y.sum && x.turns === y.turns && x.log.length === y.log.length ? 'OK' : 'MISMATCH');

// 3) Sample transcript
console.log('\n--- sample transcript (seed 7) ---');
const s = run(7, { verbose: false });
console.log(s.log.slice(0, 30).join('\n'));
console.log('...\nresult:', s.result, 'turns:', s.turns);

// 4) A Pokémon with nothing left still has something to do.
//
// In a trainer battle there is no running away, so a party with every move
// at zero PP had no legal action at all: the move menu refused each of the
// four in turn and the fight could not be finished or left. The engine has
// always known how to Struggle — this proves the empty-handed case reaches
// it, and that the battle actually ends.
{
  const r = makeRng(99);
  const mine = team(r, 1, 30), theirs = team(r, 1, 30);
  for (const m of mine) for (const slot of m.moves) slot.pp = 0;
  const battle = createBattle({
    seed: 99, kind: 'trainer', difficulty: 'easy',
    a: { id: 'p', name: 'Matthew', isPlayer: true, party: mine, trainer: { ai: 1, prize: 10 } },
    b: { id: 'e', name: 'Trainer', party: theirs, trainer: { name: 'Trainer', ai: 1, prize: 10, defeat: '.' } },
  });
  let sawStruggle = false, guard = 0;
  while (!battle.over && guard++ < 200) {
    for (let s = 0; s < 2; s++) {
      if (needsSwitch(battle, s)) { const i = chooseAiSwitch(battle, s); if (i >= 0) forceSwitch(battle, s, i); }
    }
    if (battle.over) break;
    // index -1 is what the menu now submits when nothing has PP left.
    const events = resolveTurn(battle, [{ type: 'move', index: -1 }, chooseAiAction(battle, 1)]);
    for (const e of events) if (e.t === 'text' && /Struggle/i.test(String(e.s))) sawStruggle = true;
  }
  console.log('\n--- with no PP anywhere ---');
  console.log(sawStruggle ? '  PASS  an empty-handed Pokemon struggles' : '  FAIL  nothing struggled');
  console.log(battle.over ? `  PASS  the battle still ended (${battle.result})` : '  FAIL  the battle never ended');
  if (!sawStruggle || !battle.over) process.exitCode = 1;
}
