// Is the first fight in the game winnable?
//
// Cass stops the player on Route 201 when they own exactly one Pokemon, and
// hers is deliberately the one picked to beat theirs. That is the point of
// the scene, and it is also the easiest thing in the game to make impossible
// by accident — she used to bring a Starly as well, so the opening battle was
// two against one with the type advantage against you, on EASY, before the
// player has been given anything to spend.
//
// This plays that battle a few hundred times with the moves a beginner would
// actually pick — the strongest one they have — and no items at all.
import { createBattle, resolveTurn, needsSwitch, forceSwitch } from '../src/game/battle/engine.js';
import { chooseAiAction, chooseAiSwitch } from '../src/game/battle/ai.js';
import { createMonster, isFainted } from '../src/game/monster.js';
import { getMove } from '../src/data/moves.js';
import { TRAINERS, rivalStarterBase, STARTER_LINES } from '../src/data/trainers.js';
import { getSpecies } from '../src/data/species.js';
import { makeRng } from '../src/core/rng.js';

let fails = 0;
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};

/** The move a beginner picks: the one that hits hardest. */
function bestMove(mon) {
  let best = -1, power = -1;
  mon.moves.forEach((slot, i) => {
    if (!slot || slot.pp <= 0) return;
    const mv = getMove(slot.id);
    if (!mv || !mv.power) return;
    if (mv.power > power) { power = mv.power; best = i; }
  });
  return best;
}

function playOnce(seed, playerBase) {
  const r = makeRng(seed);
  const mine = [createMonster(playerBase, 5, { rng: r })];
  const t = { ...TRAINERS.rival_1 };
  const hersBase = rivalStarterBase(playerBase);
  t.team = t.team.map((entry) => (typeof entry === 'string'
    ? { species: hersBase, level: parseInt(entry.split(':')[1], 10) || 5, moves: null }
    : entry));
  const theirs = t.team.map((m) => createMonster(m.species, m.level, { rng: r, moves: m.moves }));
  const battle = createBattle({
    seed, kind: 'trainer', difficulty: 'easy',
    a: { id: 'p', name: 'Player', isPlayer: true, party: mine },
    b: { id: 'e', name: t.name, party: theirs, trainer: { name: t.name, ai: t.ai || 1, prize: t.prize || 0, defeat: '.' } },
  });
  let guard = 0;
  while (!battle.over && guard++ < 200) {
    for (let s = 0; s < 2; s++) {
      if (needsSwitch(battle, s)) { const i = chooseAiSwitch(battle, s); if (i >= 0) forceSwitch(battle, s, i); }
    }
    if (battle.over) break;
    const me = battle.sides[0].party[battle.sides[0].active];
    const pick = me ? bestMove(me) : -1;
    resolveTurn(battle, [{ type: 'move', index: pick }, chooseAiAction(battle, 1)]);
  }
  return { won: battle.result === 'win', turns: battle.turn, hpLeft: mine[0].hp };
}

console.log('--- the first battle, with no items and the obvious move ---');
const starters = (STARTER_LINES || []).map((l) => (Array.isArray(l) ? l[0] : (l.base || l))).filter(Boolean);
const bases = starters.length ? starters : [387, 390, 393];
let worst = null;
for (const base of bases) {
  let wins = 0;
  const runs = 300;
  for (let i = 0; i < runs; i++) if (playOnce(5000 + i, base).won) wins++;
  const rate = wins / runs;
  const name = (getSpecies(base) || {}).name || base;
  const her = (getSpecies(rivalStarterBase(base)) || {}).name || '?';
  console.log(`  ${String(name).padEnd(10)} vs her ${String(her).padEnd(10)} ${(rate * 100).toFixed(0)}% of 300`);
  if (!worst || rate < worst.rate) worst = { rate, name, her };
}

// A first fight the player loses more often than they win is a wall, not an
// introduction. Two in three is a fight you feel you earned.
check(worst.rate >= 0.6,
  'the worst starter still wins the opening more often than not',
  `${worst.name} vs ${worst.her} at ${(worst.rate * 100).toFixed(0)}%`);
check(TRAINERS.rival_1.team.length === 1,
  'and she brings one Pokemon to it, like the player does');

console.log(fails ? `\n${fails} failure(s)` : '\nopening: all checks passed');
process.exit(fails ? 1 : 0);
