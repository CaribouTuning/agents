// The battle engine.
//
// Two properties matter above everything else here:
//
//  1. It is PURE with respect to presentation. resolveTurn() mutates battle
//     state and returns a list of events; nothing in this file knows a
//     canvas exists. The battle UI is a player of those events.
//  2. It is DETERMINISTIC. All randomness comes from a seeded RNG carried in
//     the battle object. Give two clients the same seed and the same pair of
//     actions and they produce byte-identical results — which is what makes
//     networked PvP possible without a referee server.
import { makeRng } from '../../core/rng.js';
import { getMove } from '../../data/moves.js';
import { typeMultiplier, effectivenessText } from '../../data/types.js';
import * as ability from './abilities.js';
import * as weather from './weather.js';
import { onLevelUp, onWonBattle, onFainted } from '../friendship.js';
import { getSpecies } from '../../data/species.js';
import { getItem } from '../../data/items.js';
import {
  maxHp, statValue, displayName, typesOf, isFainted, gainExp, expYield, awardEvs, expProgress, speciesOf,
} from '../monster.js';

export const STAGE_MULT = [2 / 8, 2 / 7, 2 / 6, 2 / 5, 2 / 4, 2 / 3, 1, 3 / 2, 4 / 2, 5 / 2, 6 / 2, 7 / 2, 8 / 2];
const ACC_MULT = [3 / 9, 3 / 8, 3 / 7, 3 / 6, 3 / 5, 3 / 4, 1, 4 / 3, 5 / 3, 6 / 3, 7 / 3, 8 / 3, 9 / 3];

const stage = (n) => STAGE_MULT[Math.max(-6, Math.min(6, n)) + 6];
const accStage = (n) => ACC_MULT[Math.max(-6, Math.min(6, n)) + 6];

export const STATUS_NAMES = { PSN: 'poisoned', BRN: 'burned', PAR: 'paralysed', SLP: 'asleep', FRZ: 'frozen solid' };
export const STATUS_SHORT = { PSN: 'PSN', BRN: 'BRN', PAR: 'PAR', SLP: 'SLP', FRZ: 'FRZ' };

function newBoosts() {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
}
function newVolatile() {
  // tookPhysical / tookSpecial are what Counter and Mirror Coat read: the
  // damage this side absorbed since its own last action, cleared each turn.
  return {
    confusion: 0, flinch: false, focus: false, furyCutter: 0, protect: false, firstTurn: true,
    tookPhysical: 0, tookSpecial: 0,
  };
}

export function makeSide(cfg) {
  return {
    id: cfg.id,
    name: cfg.name,
    isPlayer: !!cfg.isPlayer,
    isRemote: !!cfg.isRemote,
    trainer: cfg.trainer || null,
    party: cfg.party,
    active: cfg.party.findIndex((m) => m && !isFainted(m)),
    boosts: newBoosts(),
    volatile: newVolatile(),
    bag: cfg.bag || null,
    itemsUsed: 0,
    runAttempts: 0,
    participants: new Set(),
    lastMove: null,
    fled: false,
  };
}

export function createBattle(cfg) {
  const seed = cfg.seed >>> 0;
  const b = {
    seed,
    rng: makeRng(seed),
    kind: cfg.kind || 'wild',           // wild | trainer | pvp
    difficulty: cfg.difficulty || 'easy',
    sides: [makeSide(cfg.a), makeSide(cfg.b)],
    turn: 0,
    over: false,
    result: null,                        // 'win' | 'lose' | 'run' | 'caught' | 'draw'
    caught: null,
    // The sky. A wild battle can start under one (a sandstorm on a desert
    // route, say); everything else starts clear.
    weather: cfg.weather || null,
    weatherTurns: cfg.weather ? cfg.weatherTurns || weather.DEFAULT_TURNS : 0,
    canRun: cfg.canRun !== false,
    canCatch: cfg.kind === 'wild',
    battleLocation: cfg.location || null,
    announcedFaints: new Set(),
    // Scratch RNG for previews and AI heuristics. Kept separate from
    // `rng` so evaluating options never shifts the shared random stream
    // that both clients of a networked battle depend on.
    scratch: makeRng((seed ^ 0x5bf03635) >>> 0),
  };
  if (b.sides[0].active >= 0) b.sides[0].participants.add(b.sides[0].active);
  return b;
}

export const activeOf = (side) => side.party[side.active];
export const foeIndex = (i) => (i === 0 ? 1 : 0);

// ---- accessors used by both the engine and the UI ---------------------

export function effectiveStat(battle, sideIdx, key, viewer = null) {
  const side = battle.sides[sideIdx];
  const mon = activeOf(side);
  let v = statValue(mon, key);
  // Unaware looks at the raw number: the foe's boosts simply are not there.
  const blind = viewer && ability.ignoresBoosts(viewer);
  v = Math.floor(v * (blind ? 1 : stage(side.boosts[key] || 0)));
  v = Math.floor(v * ability.defenseStatMultiplier(mon, key));
  if (battle.weather) {
    const sky = activeWeather(battle);
    v = Math.floor(v * weather.statMultiplier(sky, key, typesOf(mon)));
    v = Math.floor(v * ability.weatherStatMultiplier(mon, key, sky));
  }
  if (key === 'atk' && mon.status === 'BRN') v = Math.floor(v / 2);
  if (key === 'spe' && mon.status === 'PAR') v = Math.floor(v / 4);
  return Math.max(1, v);
}

export function hpFraction(mon) { return Math.max(0, mon.hp) / maxHp(mon); }

// ---- events ------------------------------------------------------------

const ev = (list) => ({
  text: (s, opts = {}) => list.push({ t: 'text', s, ...opts }),
  push: (e) => list.push(e),
});

// ---- turn resolution ---------------------------------------------------

/**
 * actions: [actionForSide0, actionForSide1]
 *   { type:'move', index } | { type:'switch', index }
 *   { type:'item', item, target } | { type:'run' }
 * Returns the event list for the UI to play back.
 */
export function resolveTurn(battle, actions) {
  const out = [];
  const E = ev(out);
  battle.turn++;

  // The leads never went through a switch, so their entry abilities have not
  // fired. Doing it on the first turn rather than in createBattle keeps the
  // events in the stream the UI plays, instead of happening before it exists.
  if (!battle.opened) {
    battle.opened = true;
    for (let i = 0; i < 2; i++) {
      const mon = activeOf(battle.sides[i]);
      if (!mon || isFainted(mon)) continue;
      ability.onSwitchIn(battle, i, abilityCtx(battle, i, out, mon));
      const summoned = ability.summonsWeather(mon);
      if (summoned && battle.weather !== summoned) {
        out.push({ t: 'text', s: `${displayName(mon)}'s ${mon.ability}!` });
        setWeather(battle, summoned, weather.DEFAULT_TURNS, out);
      }
    }
  }

  for (const s of battle.sides) { s.volatile.flinch = false; }

  const order = buildOrder(battle, actions);

  for (const { side, action } of order) {
    if (battle.over) break;
    const me = battle.sides[side];
    if (me.fled) continue;
    const mon = activeOf(me);
    if (!mon || isFainted(mon)) continue;

    switch (action.type) {
      case 'switch': doSwitch(battle, side, action.index, out); break;
      case 'item': doItem(battle, side, action, out); break;
      case 'run': doRun(battle, side, out); break;
      case 'move': doMove(battle, side, action, out); break;
      default: break;
    }
    checkFaints(battle, out);
  }

  if (!battle.over) endOfTurn(battle, out);
  if (!battle.over) checkFaints(battle, out);
  if (!battle.over) checkBattleEnd(battle, out);

  return out;
}

function buildOrder(battle, actions) {
  const entries = actions.map((action, side) => ({ side, action }));
  const rank = (e) => {
    if (e.action.type === 'run') return 8;
    if (e.action.type === 'item') return 7;
    if (e.action.type === 'switch') return 6;
    const mon = activeOf(battle.sides[e.side]);
    if (!mon) return -99;
    const idx = e.action.index;
    const slot = mon.moves[idx];
    return slot ? getMove(slot.id).priority : 0;
  };
  const speed = (e) => effectiveStat(battle, e.side, 'spe');
  entries.sort((x, y) => {
    const dr = rank(y) - rank(x);
    if (dr) return dr;
    const ds = speed(y) - speed(x);
    if (ds) return ds;
    // Speed ties resolve off the battle RNG, keeping both clients in step.
    return battle.rng() < 0.5 ? -1 : 1;
  });
  return entries;
}

// ---- individual actions ------------------------------------------------

/**
 * The handful of engine operations an ability is allowed to perform. Passing
 * this rather than the engine keeps abilities/engine free of a cycle and keeps
 * the surface an ability can touch small enough to reason about.
 */
function abilityCtx(battle, sideIdx, out, mon) {
  return {
    mon,
    get name() { return displayName(mon); },
    say: (text) => out.push({ t: 'text', s: text }),
    statChange: (target, stat, delta) => applyStatChange(battle, target, stat, delta, out),
    passStatus: (target, status) => {
      const t = activeOf(battle.sides[target]);
      if (!t || isFainted(t) || t.status) return;
      applyStatus(battle, target, { status }, out);
    },
    hp: (side, m) => out.push({ t: 'hp', side, uid: m.uid, hp: m.hp }),
    stat: (m, key) => statValue(m, key),
    foeMon: () => activeOf(battle.sides[foeIndex(sideIdx)]),
    // Anticipation reads the foe's move list, which is exactly what the real
    // ability does — it is not the AI peeking, it is the ability's whole point.
    foeHasSuperEffective: () => {
      const foe = activeOf(battle.sides[foeIndex(sideIdx)]);
      if (!foe || !mon) return false;
      return (foe.moves || []).some((slot) => {
        const mv = getMove(slot.id);
        return mv.power > 0 && typeMultiplier(mv.type, typesOf(mon)) > 1;
      });
    },
  };
}

function doSwitch(battle, sideIdx, index, out) {
  const side = battle.sides[sideIdx];
  const target = side.party[index];
  if (!target || isFainted(target) || index === side.active) return;
  const leaving = activeOf(side);
  if (leaving && !isFainted(leaving)) {
    ability.onSwitchOut(battle, sideIdx, abilityCtx(battle, sideIdx, out, leaving), leaving);
    out.push({ t: 'text', s: `${side.isPlayer ? '' : `${side.name} withdrew `}${displayName(leaving)}${side.isPlayer ? ', come back!' : '!'}` });
  }
  out.push({ t: 'withdraw', side: sideIdx });
  side.active = index;
  side.boosts = newBoosts();
  side.volatile = newVolatile();
  side.participants.add(index);
  out.push({ t: 'sendout', side: sideIdx, index });
  out.push({ t: 'text', s: `${side.isPlayer ? 'Go!' : `${side.name} sent out`} ${displayName(target)}!` });
  ability.onSwitchIn(battle, sideIdx, abilityCtx(battle, sideIdx, out, target));
  // Drizzle, Sand Stream and Snow Warning bring their own sky with them.
  const summoned = ability.summonsWeather(target);
  if (summoned && battle.weather !== summoned) {
    out.push({ t: 'text', s: `${displayName(target)}'s ${target.ability}!` });
    setWeather(battle, summoned, weather.DEFAULT_TURNS, out);
  }
}

function doItem(battle, sideIdx, action, out) {
  const side = battle.sides[sideIdx];
  const item = getItem(action.item);
  if (!item) return;
  side.itemsUsed++;

  if (item.use && item.use.kind === 'ball') {
    doCatch(battle, sideIdx, item, out);
    return;
  }
  const target = side.party[action.target != null ? action.target : side.active];
  if (!target) return;
  out.push({ t: 'text', s: `${side.isPlayer ? 'You' : side.name} used the ${item.name}.` });
  applyItemEffect(item, target, out, sideIdx, side);
}

export function applyItemEffect(item, mon, out, sideIdx = 0, side = null) {
  const u = item.use;
  if (!u) return false;
  if (u.kind === 'heal') {
    if (isFainted(mon)) { out.push({ t: 'text', s: 'It had no effect.' }); return false; }
    const before = mon.hp;
    mon.hp = Math.min(maxHp(mon), mon.hp + u.amount);
    out.push({ t: 'hp', side: sideIdx, uid: mon.uid, hp: mon.hp });
    out.push({ t: 'text', s: `${displayName(mon)} recovered ${mon.hp - before} HP.` });
    return mon.hp > before;
  }
  if (u.kind === 'revive') {
    if (!isFainted(mon)) { out.push({ t: 'text', s: 'It had no effect.' }); return false; }
    mon.hp = Math.max(1, Math.floor(maxHp(mon) * u.fraction));
    mon.status = null;
    if (side && side.battleRef) side.battleRef.announcedFaints.delete(mon.uid);
    out.push({ t: 'hp', side: sideIdx, uid: mon.uid, hp: mon.hp });
    out.push({ t: 'text', s: `${displayName(mon)} was revived!` });
    return true;
  }
  if (u.kind === 'cure') {
    let did = false;
    if (mon.status && u.status.includes(mon.status)) { mon.status = null; mon.statusCounter = 0; did = true; }
    if (u.status.includes('CNF') && side && side.volatile.confusion) { side.volatile.confusion = 0; did = true; }
    out.push({ t: 'text', s: did ? `${displayName(mon)} is looking healthy again.` : 'It had no effect.' });
    return did;
  }
  if (u.kind === 'pp') {
    const slot = mon.moves.find((m) => m.pp < m.ppMax);
    if (!slot) { out.push({ t: 'text', s: 'It had no effect.' }); return false; }
    slot.pp = Math.min(slot.ppMax, slot.pp + u.amount);
    out.push({ t: 'text', s: `${getMove(slot.id).name} regained PP.` });
    return true;
  }
  return false;
}

function doRun(battle, sideIdx, out) {
  const side = battle.sides[sideIdx];
  const foe = battle.sides[foeIndex(sideIdx)];
  if (battle.kind !== 'wild') {
    out.push({ t: 'text', s: 'There is no running from a trainer battle!' });
    return;
  }
  const mine = effectiveStat(battle, sideIdx, 'spe');
  const theirs = effectiveStat(battle, foeIndex(sideIdx), 'spe');
  side.runAttempts += 1;
  const attempts = side.runAttempts;
  const odds = theirs > 0 ? ((mine * 128) / theirs + 30 * attempts) % 256 : 256;
  const runner = activeOf(side);
  if (ability.alwaysFlees(runner) || mine >= theirs || battle.rng.int(256) < odds) {
    out.push({ t: 'sfx', s: 'escape' });
    out.push({ t: 'text', s: 'Got away safely!' });
    battle.over = true;
    battle.result = 'run';
  } else {
    out.push({ t: 'text', s: "Couldn't get away!" });
  }
  void foe;
}

// ---- catching -----------------------------------------------------------

export function catchChance(battle, ball) {
  const foe = activeOf(battle.sides[1]);
  const sp = getSpecies(foe.species);
  let bonus = ball.use.rate || 1;
  if (ball.use.bonusTypes && ball.use.bonusTypes.some((t) => sp.types.includes(t))) bonus = ball.use.bonus;
  const statusBonus = foe.status === 'SLP' || foe.status === 'FRZ' ? 2
    : (foe.status === 'PAR' || foe.status === 'PSN' || foe.status === 'BRN') ? 1.5 : 1;
  const mhp = maxHp(foe);
  const a = ((3 * mhp - 2 * foe.hp) * sp.catchRate * bonus * statusBonus) / (3 * mhp);
  return { a, sp };
}

function doCatch(battle, sideIdx, ball, out) {
  const side = battle.sides[sideIdx];
  const foeSide = battle.sides[foeIndex(sideIdx)];
  const foe = activeOf(foeSide);

  if (battle.kind !== 'wild') {
    out.push({ t: 'text', s: 'You cannot throw a ball at another trainer’s Pokémon!' });
    return;
  }
  out.push({ t: 'text', s: `${side.name} threw a ${ball.name}!` });
  out.push({ t: 'throwball', ball: ball.id });

  const { a } = catchChance(battle, ball);
  // Easy mode nudges the odds; it never guarantees a catch.
  const aAdj = battle.difficulty === 'easy' ? a * 1.35 : a;
  const shakeProb = aAdj >= 255 ? 65536 : Math.floor(65536 / Math.pow(255 / Math.min(254.9, aAdj), 0.25));

  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (aAdj >= 255 || battle.rng.int(65536) < shakeProb) shakes++;
    else break;
  }
  if (shakes >= 4) {
    out.push({ t: 'wobble', count: 3, caught: true });
    out.push({ t: 'sfx', s: 'caught' });
    out.push({ t: 'text', s: `Gotcha! ${displayName(foe)} was caught!` });
    battle.over = true;
    battle.result = 'caught';
    battle.caught = { mon: foe, ball: ball.id };
  } else {
    out.push({ t: 'wobble', count: shakes, caught: false });
    const lines = [
      'Oh no! The Pokémon broke free!',
      'Aww! It appeared to be caught!',
      'Aargh! Almost had it!',
      'Shoot! It was so close, too!',
    ];
    out.push({ t: 'text', s: lines[Math.min(shakes, 3)] });
  }
}

// ---- moves ---------------------------------------------------------------

function doMove(battle, sideIdx, action, out) {
  const side = battle.sides[sideIdx];
  const foeSide = battle.sides[foeIndex(sideIdx)];
  const user = activeOf(side);
  const target = activeOf(foeSide);
  if (!user || !target) return;

  const slot = user.moves[action.index];
  const move = slot ? getMove(slot.id) : getMove('struggle');
  const isStruggle = !slot || slot.pp <= 0;
  const used = isStruggle ? getMove('struggle') : move;

  // --- pre-move status gates ---
  if (user.status === 'FRZ') {
    if (battle.rng() < 0.2) {
      user.status = null;
      out.push({ t: 'text', s: `${displayName(user)} thawed out!` });
    } else {
      out.push({ t: 'text', s: `${displayName(user)} is frozen solid!` });
      return;
    }
  }
  if (user.status === 'SLP') {
    user.statusCounter -= ability.sleepTicks(user);
    if (user.statusCounter <= 0) {
      user.status = null;
      out.push({ t: 'text', s: `${displayName(user)} woke up!` });
    } else {
      out.push({ t: 'text', s: `${displayName(user)} is fast asleep.` });
      return;
    }
  }
  if (side.volatile.flinch) {
    out.push({ t: 'text', s: `${displayName(user)} flinched!` });
    ability.onFlinch(battle, sideIdx, abilityCtx(battle, sideIdx, out, user));
    return;
  }
  if (user.status === 'PAR' && battle.rng() < 0.25) {
    out.push({ t: 'text', s: `${displayName(user)} is paralysed! It can't move!` });
    return;
  }
  if (side.volatile.confusion > 0) {
    side.volatile.confusion--;
    if (side.volatile.confusion <= 0) {
      out.push({ t: 'text', s: `${displayName(user)} snapped out of its confusion!` });
    } else {
      out.push({ t: 'text', s: `${displayName(user)} is confused!` });
      if (battle.rng() < 0.5) {
        const dmg = Math.max(1, Math.floor(confusionDamage(battle, sideIdx)));
        user.hp = Math.max(0, user.hp - dmg);
        out.push({ t: 'sfx', s: 'hit' });
        out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp, shake: true });
        out.push({ t: 'text', s: 'It hurt itself in its confusion!' });
        return;
      }
    }
  }

  // Pressure is the defender's ability charging the attacker extra PP.
  if (!isStruggle) slot.pp = Math.max(0, slot.pp - (1 + ability.extraPpCost(target)));
  side.lastMove = used.id;

  out.push({ t: 'usemove', side: sideIdx, move: used.id });
  out.push({ t: 'text', s: `${side.isPlayer ? '' : 'Foe '}${displayName(user)} used ${used.name}!` });

  // Soundproof and friends: the move is simply refused.
  if (ability.blocksMove(target, user, used)) {
    out.push({ t: 'text', s: `${displayName(target)}'s ${target.ability} blocked ${used.name}!` });
    return;
  }

  // --- accuracy ---
  if (used.acc > 0) {
    const accMod = accStage((side.boosts.acc || 0) - (foeSide.boosts.eva || 0));
    const chance = (used.acc / 100) * accMod
      * ability.accuracyMultiplier(user, used)
      * weather.accuracyMultiplier(activeWeather(battle), used.id)
      / ability.evasionMultiplier(target, foeSide)
      / ability.weatherEvasion(target, activeWeather(battle));
    // The roll is spent either way: No Guard must not shift the shared stream.
    const missed = battle.rng() >= chance;
    if (missed && !ability.neverMisses(user, target)) {
      out.push({ t: 'text', s: `${displayName(user)}'s attack missed!` });
      if (used.id === 'furycutter') side.volatile.furyCutter = 0;
      return;
    }
  }

  if (used.power > 0 || used.variable) {
    applyDamagingMove(battle, sideIdx, used, out);
  } else {
    applyStatusMove(battle, sideIdx, used, out);
  }
}

function confusionDamage(battle, sideIdx) {
  const user = activeOf(battle.sides[sideIdx]);
  const a = effectiveStat(battle, sideIdx, 'atk');
  const d = effectiveStat(battle, sideIdx, 'def');
  return Math.floor(Math.floor(Math.floor((2 * user.level) / 5 + 2) * 40 * a / d) / 50) + 2;
}


/**
 * Moves whose power is decided at use time. Every rule here is named by the
 * move table (`variable:`), and tools/gendex.py refuses to emit a damaging
 * move that has neither a power nor a rule — so this switch and the data can
 * never drift apart into a move that silently does nothing.
 *
 * `kind: 'set'` means the move deals exactly `dmg` and skips the type and
 * damage formula entirely, the way Seismic Toss does.
 */
function variablePower(battle, sideIdx, move, opts) {
  const side = battle.sides[sideIdx];
  const foeSide = battle.sides[foeIndex(sideIdx)];
  const user = activeOf(side);
  const target = activeOf(foeSide);
  const roll = opts.peek ? battle.scratch : battle.rng;

  switch (move.variable) {
    case 'fixed20': return { kind: 'set', dmg: 20 };
    case 'fixed40': return { kind: 'set', dmg: 40 };
    case 'level': return { kind: 'set', dmg: user.level };
    case 'psywave': return { kind: 'set', dmg: Math.max(1, Math.floor(user.level * (0.5 + roll() * 1.0))) };
    case 'halfHp': return { kind: 'set', dmg: Math.max(1, Math.floor(target.hp / 2)) };
    case 'endeavor':
      return target.hp <= user.hp ? { kind: 'fail' } : { kind: 'set', dmg: target.hp - user.hp };
    case 'ohko':
      // Platinum's own rule: it never lands on something at a higher level.
      if (target.level > user.level) return { kind: 'fail' };
      return roll() < 0.3 ? { kind: 'set', dmg: maxHp(target), ohko: true } : { kind: 'miss' };
    case 'counter':
    case 'metalburst':
      return side.volatile.tookPhysical > 0
        ? { kind: 'set', dmg: Math.floor(side.volatile.tookPhysical * (move.variable === 'counter' ? 2 : 1.5)) }
        : { kind: 'fail' };
    case 'mirrorcoat':
      return side.volatile.tookSpecial > 0
        ? { kind: 'set', dmg: side.volatile.tookSpecial * 2 } : { kind: 'fail' };
    case 'weight': {
      const w = speciesOf(target).weight || 10;
      const p = w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20;
      return { kind: 'power', power: p };
    }
    case 'magnitude': {
      const table = [[10, 4], [30, 10], [50, 20], [70, 30], [90, 20], [110, 10], [150, 6]];
      let n = roll.int(100);
      let p = 70;
      for (const [pow, weight] of table) { if (n < weight) { p = pow; break; } n -= weight; }
      return { kind: 'power', power: p };
    }
    case 'friendship': return { kind: 'power', power: Math.max(1, Math.floor((user.friendship || 70) / 2.5)) };
    case 'frustrationRev': return { kind: 'power', power: Math.max(1, Math.floor((255 - (user.friendship || 70)) / 2.5)) };
    case 'lowHp': {
      const r = user.hp / maxHp(user);
      const p = r > 0.688 ? 20 : r > 0.354 ? 40 : r > 0.208 ? 80 : r > 0.104 ? 100 : r > 0.042 ? 150 : 200;
      return { kind: 'power', power: p };
    }
    case 'gyroball': {
      const mine = Math.max(1, effectiveStat(battle, sideIdx, 'spe'));
      const theirs = effectiveStat(battle, foeIndex(sideIdx), 'spe');
      return { kind: 'power', power: Math.max(1, Math.min(150, Math.floor(25 * theirs / mine))) };
    }
    case 'targetHp':
      return { kind: 'power', power: Math.max(1, Math.floor(120 * target.hp / maxHp(target))) };
    case 'punishment': {
      const boosts = Object.values(foeSide.boosts).reduce((a, b) => a + Math.max(0, b), 0);
      return { kind: 'power', power: Math.min(200, 60 + 20 * boosts) };
    }
    default: return { kind: 'power', power: move.power };
  }
}

export function computeDamage(battle, sideIdx, move, opts = {}) {
  const side = battle.sides[sideIdx];
  const foeSide = battle.sides[foeIndex(sideIdx)];
  const user = activeOf(side);
  const target = activeOf(foeSide);

  const physical = move.cls === 'physical';
  const atkKey = physical ? 'atk' : 'spa';
  const defKey = physical ? 'def' : 'spd';

  let A = effectiveStat(battle, sideIdx, atkKey, target);
  let D = effectiveStat(battle, foeIndex(sideIdx), defKey, user);

  // Critical hits ignore the defender's positive defence boosts.
  const critStages = (move.crit || 0) + (side.volatile.focus ? 1 : 0) + ability.critBonus(user);
  const critOdds = [16, 8, 4, 3, 2][Math.min(4, critStages)];
  const roll = opts.peek ? battle.scratch : battle.rng;
  // Battle Armor cancels the crit, never the roll.
  const rolledCrit = opts.forceCrit || (opts.peek ? false : roll.int(critOdds) === 0);
  const crit = rolledCrit && !ability.blocksCrit(target, user);
  if (crit) {
    A = Math.max(A, statValue(user, atkKey));
    D = Math.min(D, statValue(target, defKey));
  }

  let power = move.power;
  if (move.variable) {
    const v = variablePower(battle, sideIdx, move, opts);
    if (v.kind === 'fail') return { dmg: 0, eff: 1, crit: false, fail: true };
    if (v.kind === 'miss') return { dmg: 0, eff: 1, crit: false, miss: true };
    if (v.kind === 'set') {
      const flat = ability.immuneToType(target, move.type)
        || typeMultiplier(move.type, typesOf(target)) === 0;
      if (flat) return { dmg: 0, eff: 0, crit: false };
      return { dmg: Math.max(1, v.dmg), eff: 1, crit: false, ohko: !!v.ohko };
    }
    power = v.power;
  }
  if (move.id === 'furycutter') power = Math.min(160, 40 * Math.pow(2, side.volatile.furyCutter));
  if (move.id === 'brine' && target.hp * 2 <= maxHp(target)) power *= 2;
  if (move.id === 'revenge' && opts.tookDamage) power *= 2;

  let dmg = Math.floor(Math.floor(Math.floor((2 * user.level) / 5 + 2) * power * A / D) / 50) + 2;

  const stab = typesOf(user).includes(move.type) ? ability.stabMultiplier(user) : 1;
  // An ability that grants outright immunity zeroes the type chart, so the
  // caller's existing "doesn't affect" path handles it with no new branch.
  const eff = ability.immuneToType(target, move.type)
    ? 0 : typeMultiplier(move.type, typesOf(target));
  dmg = Math.floor(dmg * stab);
  dmg = Math.floor(dmg * eff);
  dmg = Math.floor(dmg * ability.attackMultiplier(user, move, side));
  dmg = Math.floor(dmg * ability.versusMultiplier(user, target));
  dmg = Math.floor(dmg * ability.damageDealtMultiplier(user, eff));
  dmg = Math.floor(dmg * ability.damageTakenMultiplier(target, user, move, eff));
  dmg = Math.floor(dmg * weather.damageMultiplier(activeWeather(battle), move.type));
  if (crit) dmg = Math.floor(dmg * ability.critMultiplier(user));
  if (user.status === 'BRN' && physical && !ability.ignoresBurnDrop(user)) dmg = Math.floor(dmg * 0.5);
  // Damage roll: 85%..100%. A peek uses the average roll so the AI's
  // evaluation is stable and costs the shared stream nothing.
  dmg = Math.floor(dmg * (opts.peek ? 0.925 : 0.85 + battle.rng() * 0.15));

  // Easy mode: the player hits a little harder and takes a little less.
  if (battle.difficulty === 'easy') {
    dmg = Math.floor(dmg * (side.isPlayer ? 1.15 : 0.85));
  }

  return { dmg: Math.max(eff === 0 ? 0 : 1, dmg), eff, crit };
}

function applyDamagingMove(battle, sideIdx, move, out) {
  const side = battle.sides[sideIdx];
  const foeSide = battle.sides[foeIndex(sideIdx)];
  const user = activeOf(side);
  const target = activeOf(foeSide);

  const hits = move.effect && move.effect.kind === 'multihit'
    ? battle.rng.range(move.effect.min, move.effect.max) : 1;

  let total = 0;
  let lastEff = 1;
  for (let i = 0; i < hits; i++) {
    if (isFainted(target)) break;
    const { dmg, eff, crit, fail, miss, ohko } = computeDamage(battle, sideIdx, move);
    if (fail) { out.push({ t: 'text', s: 'But it failed!' }); return; }
    if (miss) { out.push({ t: 'text', s: `${displayName(user)}'s attack missed!` }); return; }
    if (ohko) out.push({ t: 'text', s: 'It was a one-hit KO!' });
    lastEff = eff;
    if (eff === 0) {
      if (ability.immuneToType(target, move.type)) {
        out.push({ t: 'text', s: `${displayName(target)}'s ${target.ability} made it immune!` });
        ability.onImmune(battle, foeIndex(sideIdx), abilityCtx(battle, foeIndex(sideIdx), out, target));
      } else {
        out.push({ t: 'text', s: `It doesn't affect ${displayName(target)}...` });
      }
      return;
    }
    target.hp = Math.max(0, target.hp - dmg);
    foeSide.volatile[move.cls === 'physical' ? 'tookPhysical' : 'tookSpecial'] = dmg;
    total += dmg;
    out.push({ t: 'sfx', s: eff >= 2 ? 'supereffective' : eff < 1 ? 'weak' : 'hit' });
    out.push({ t: 'hit', side: foeIndex(sideIdx), eff, crit, move: move.id });
    out.push({ t: 'hp', side: foeIndex(sideIdx), uid: target.uid, hp: target.hp, shake: true });
    if (crit) out.push({ t: 'text', s: 'A critical hit!' });
  }

  if (hits > 1) out.push({ t: 'text', s: `Hit ${hits} time${hits > 1 ? 's' : ''}!` });
  const effText = effectivenessText(lastEff);
  if (effText) out.push({ t: 'text', s: effText });

  if (move.id === 'furycutter') side.volatile.furyCutter++;

  applyContactReaction(battle, sideIdx, move, total, out);

  const fx = move.effect;
  if (fx && total > 0) {
    if (fx.kind === 'drain') {
      const amount = Math.max(1, Math.floor(total * fx.fraction));
      if (ability.drainBackfires(target, user)) {
        user.hp = Math.max(0, user.hp - amount);
        out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp, shake: true });
        out.push({ t: 'text', s: `${displayName(user)} sucked up the liquid ooze!` });
      } else {
        user.hp = Math.min(maxHp(user), user.hp + amount);
        out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp });
        out.push({ t: 'text', s: `${displayName(target)} had its energy drained!` });
      }
    }
    if (fx.kind === 'recoil' && !ability.noRecoil(user) && !ability.noIndirectDamage(user)) {
      const hurt = Math.max(1, Math.floor(total * fx.fraction));
      user.hp = Math.max(0, user.hp - hurt);
      out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp, shake: true });
      out.push({ t: 'text', s: `${displayName(user)} is hit with recoil!` });
    }
    // The roll happens either way, so an ability that blocks the effect cannot
    // shift the shared random stream a link battle replays on both phones.
    if (fx.kind === 'status' && (!fx.chance || battle.rng() < ability.secondaryChance(user, fx.chance))) {
      if (!ability.blocksSecondary(target)) applyStatus(battle, foeIndex(sideIdx), fx, out);
    }
    if (fx.kind === 'stat' && (!fx.chance || battle.rng() < ability.secondaryChance(user, fx.chance))
      && !(fx.target === 'foe' && ability.blocksSecondary(target))) {
      const tgt = fx.target === 'self' ? sideIdx : foeIndex(sideIdx);
      applyStatChange(battle, tgt, fx.stat, fx.stages, out);
    }
  }
}

/**
 * Static, Rough Skin, Aftermath and the rest: what touching something costs.
 * The roll is taken unconditionally so the shared random stream is identical
 * on both phones in a link battle whether or not an ability is present.
 */
function applyContactReaction(battle, sideIdx, move, total, out) {
  const side = battle.sides[sideIdx];
  const foeSide = battle.sides[foeIndex(sideIdx)];
  const user = activeOf(side);
  const target = activeOf(foeSide);
  if (!user || !target || total <= 0) return;
  if (!(move.flags || []).includes('contact')) return;

  const rolled = battle.rng() < (ability.contactChanceOf(target, user) || 0.3);
  if (!isFainted(user)) {
    const react = ability.contactReaction(target, user, rolled);
    if (react && react.kind === 'damage') {
      const hurt = Math.max(1, Math.floor(maxHp(user) * react.fraction));
      user.hp = Math.max(0, user.hp - hurt);
      out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp, shake: true });
      out.push({ t: 'text', s: `${displayName(user)} was hurt by ${react.name}!` });
    } else if (react && react.kind === 'status' && !user.status) {
      out.push({ t: 'text', s: `${displayName(target)}'s ${react.name} took hold!` });
      applyStatus(battle, sideIdx, { status: react.status }, out);
    } else if (react && react.kind === 'spore' && !user.status) {
      const pick = ['PSN', 'PAR', 'SLP'][battle.rng.range(0, 2)];
      out.push({ t: 'text', s: `${displayName(target)}'s ${react.name} took hold!` });
      applyStatus(battle, sideIdx, { status: pick }, out);
    }
  }

  // Aftermath fires on the knockout, not on the hit.
  if (isFainted(target) && !isFainted(user)) {
    const frac = ability.aftermathFraction(target, user);
    if (frac) {
      const hurt = Math.max(1, Math.floor(maxHp(user) * frac));
      user.hp = Math.max(0, user.hp - hurt);
      out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp, shake: true });
      out.push({ t: 'text', s: `${displayName(user)} was caught in the aftermath!` });
    }
  }
}

function applyStatusMove(battle, sideIdx, move, out) {
  const side = battle.sides[sideIdx];
  const foeSide = battle.sides[foeIndex(sideIdx)];
  const user = activeOf(side);
  const fx = move.effect;

  if (!fx) { out.push({ t: 'text', s: 'But nothing happened!' }); return; }

  switch (fx.kind) {
    case 'stat':
      applyStatChange(battle, fx.target === 'self' ? sideIdx : foeIndex(sideIdx), fx.stat, fx.stages, out);
      break;
    case 'multistat':
      for (const [st, n] of fx.stats) applyStatChange(battle, sideIdx, st, n, out);
      break;
    case 'status':
      applyStatus(battle, foeIndex(sideIdx), fx, out);
      break;
    case 'heal': {
      if (user.hp >= maxHp(user)) { out.push({ t: 'text', s: 'But it failed!' }); break; }
      // Synthesis and its cousins read the sky: two thirds in sun, a quarter
      // in anything that blocks it.
      const frac = weather.healFraction(activeWeather(battle), fx.fraction, move.id);
      user.hp = Math.min(maxHp(user), user.hp + Math.floor(maxHp(user) * frac));
      out.push({ t: 'sfx', s: 'heal' });
      out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp });
      out.push({ t: 'text', s: `${displayName(user)} regained health!` });
      break;
    }
    case 'rest': {
      if (user.hp >= maxHp(user)) { out.push({ t: 'text', s: 'But it failed!' }); break; }
      user.hp = maxHp(user);
      user.status = 'SLP';
      user.statusCounter = 2;
      out.push({ t: 'hp', side: sideIdx, uid: user.uid, hp: user.hp });
      out.push({ t: 'text', s: `${displayName(user)} slept and became healthy!` });
      break;
    }
    case 'weather': {
      if (battle.weather === fx.weather) { out.push({ t: 'text', s: 'But it failed!' }); break; }
      setWeather(battle, fx.weather, weather.DEFAULT_TURNS, out);
      break;
    }
    case 'focus':
      side.volatile.focus = true;
      out.push({ t: 'text', s: `${displayName(user)} is getting pumped!` });
      break;
    case 'flee':
      if (battle.kind === 'wild') {
        out.push({ t: 'text', s: `${displayName(user)} teleported away!` });
        battle.over = true; battle.result = 'run';
      } else out.push({ t: 'text', s: 'But it failed!' });
      break;
    default:
      out.push({ t: 'text', s: 'But nothing happened!' });
  }
  void foeSide;
}

/**
 * The weather in play, or null.
 *
 * Cloud Nine and Air Lock suppress it without clearing it: the storm is still
 * running its clock, nothing can feel it while they are on the field, and it
 * is there again when they leave.
 */
export function activeWeather(battle) {
  if (!battle.weather) return null;
  for (const side of battle.sides) {
    const mon = activeOf(side);
    if (mon && !isFainted(mon) && ability.suppressesWeather(mon)) return null;
  }
  return battle.weather;
}

export function setWeather(battle, kind, turns, out) {
  const info = weather.WEATHER[kind];
  if (!info) return;
  battle.weather = kind;
  battle.weatherTurns = turns;
  out.push({ t: 'weather', weather: kind });
  out.push({ t: 'text', s: info.start });
}

export function applyStatus(battle, sideIdx, fx, out) {
  const side = battle.sides[sideIdx];
  const mon = activeOf(side);
  if (!mon || isFainted(mon)) return;

  if (fx.status === 'flinch') {
    // Flinch only lands if the target has not moved yet this turn; the
    // engine approximates that by only setting it when the target is slower.
    if (ability.preventsFlinch(mon)) return;
    side.volatile.flinch = true;
    return;
  }
  if (fx.status === 'CNF') {
    if (ability.immuneToStatus(mon, 'CNF', fx.from)) {
      out.push({ t: 'text', s: `${displayName(mon)}'s ${mon.ability} kept it clear-headed!` });
      return;
    }
    if (side.volatile.confusion > 0) { out.push({ t: 'text', s: `${displayName(mon)} is already confused.` }); return; }
    side.volatile.confusion = battle.rng.range(2, 5);
    out.push({ t: 'text', s: `${displayName(mon)} became confused!` });
    return;
  }
  if (mon.status) {
    out.push({ t: 'text', s: `${displayName(mon)} is already ${STATUS_NAMES[mon.status] || 'affected'}.` });
    return;
  }
  // Type immunities.
  const types = typesOf(mon);
  const immune = (fx.status === 'PSN' && (types.includes('Poison') || types.includes('Steel')))
    || (fx.status === 'BRN' && types.includes('Fire'))
    || (fx.status === 'FRZ' && types.includes('Ice'))
    || (fx.status === 'PAR' && types.includes('Electric'));
  if (immune) { out.push({ t: 'text', s: "It doesn't affect it..." }); return; }
  if (ability.immuneToStatus(mon, fx.status, fx.from)) {
    out.push({ t: 'text', s: `${displayName(mon)}'s ${mon.ability} prevents that!` });
    return;
  }
  if (ability.statusProofIn(mon, activeWeather(battle))) {
    out.push({ t: 'text', s: `${displayName(mon)}'s ${mon.ability} kept it safe!` });
    return;
  }

  mon.status = fx.status;
  mon.statusCounter = fx.status === 'SLP' ? battle.rng.range(1, 3) : (fx.bad ? 1 : 0);
  mon.badPoison = !!fx.bad;
  out.push({ t: 'status', side: sideIdx, status: fx.status });
  out.push({ t: 'text', s: `${displayName(mon)} was ${STATUS_NAMES[fx.status]}!` });
  ability.onStatused(battle, sideIdx, abilityCtx(battle, sideIdx, out, mon), mon, fx.status);
}

export function applyStatChange(battle, sideIdx, stat, delta, out) {
  const side = battle.sides[sideIdx];
  const mon = activeOf(side);
  if (!mon || isFainted(mon)) return;
  if (delta < 0 && ability.protectsStat(mon, stat)) {
    out.push({ t: 'text', s: `${displayName(mon)}'s ${mon.ability} prevents stat loss!` });
    return;
  }
  const cur = side.boosts[stat] || 0;
  const next = Math.max(-6, Math.min(6, cur + delta));
  const label = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness' }[stat] || stat;
  if (next === cur) {
    out.push({ t: 'text', s: `${displayName(mon)}'s ${label} won't go ${delta > 0 ? 'higher' : 'lower'}!` });
    return;
  }
  side.boosts[stat] = next;
  const mag = Math.abs(delta) >= 2 ? 'sharply ' : '';
  out.push({ t: 'stat', side: sideIdx, stat, delta });
  out.push({ t: 'text', s: `${displayName(mon)}'s ${label} ${mag}${delta > 0 ? 'rose' : 'fell'}!` });
}

// ---- end of turn ---------------------------------------------------------

function endOfTurn(battle, out) {
  for (let i = 0; i < 2; i++) {
    const side = battle.sides[i];
    const mon = activeOf(side);
    if (!mon || isFainted(mon)) continue;
    const guarded = ability.noIndirectDamage(mon);
    if (mon.status === 'PSN' && !guarded) {
      const frac = mon.badPoison ? Math.min(15, ++mon.statusCounter) / 16 : 1 / 8;
      const dmg = Math.max(1, Math.floor(maxHp(mon) * frac));
      mon.hp = Math.max(0, mon.hp - dmg);
      out.push({ t: 'hp', side: i, uid: mon.uid, hp: mon.hp, shake: true });
      out.push({ t: 'text', s: `${displayName(mon)} is hurt by poison!` });
    } else if (mon.status === 'BRN' && !guarded) {
      const dmg = Math.max(1, Math.floor(maxHp(mon) / 8));
      mon.hp = Math.max(0, mon.hp - dmg);
      out.push({ t: 'hp', side: i, uid: mon.uid, hp: mon.hp, shake: true });
      out.push({ t: 'text', s: `${displayName(mon)} is hurt by its burn!` });
    }
    ability.onEndOfTurn(battle, i, abilityCtx(battle, i, out, mon), mon);
    // Held berry that triggers in a pinch.
    if (mon.heldItem && ability.usesHeldItem(mon)) {
      const held = getItem(mon.heldItem);
      if (held && held.held && held.held.kind === 'pinch-heal' && mon.hp > 0 && mon.hp <= maxHp(mon) / 2) {
        mon.hp = Math.min(maxHp(mon), mon.hp + held.held.amount);
        mon.heldItem = null;
        out.push({ t: 'hp', side: i, uid: mon.uid, hp: mon.hp });
        out.push({ t: 'text', s: `${displayName(mon)} ate its ${held.name}!` });
      }
      // A status berry goes the moment the status lands, which is the whole
      // reason to carry one. Confusion is a volatile rather than a status,
      // so it is checked separately or a Lum Berry would ignore it.
      const cures = held && held.held && held.held.kind === 'pinch-cure' ? held.held.status : null;
      if (cures && mon.hp > 0) {
        const confused = battle.sides[i].volatile.confusion > 0 && cures.includes('CNF');
        if (mon.status && cures.includes(mon.status)) {
          mon.status = null; mon.statusCounter = 0;
          mon.heldItem = null;
          out.push({ t: 'status', side: i, uid: mon.uid, status: null });
          out.push({ t: 'text', s: `${displayName(mon)} ate its ${held.name} and shook it off!` });
        } else if (confused) {
          battle.sides[i].volatile.confusion = 0;
          mon.heldItem = null;
          out.push({ t: 'text', s: `${displayName(mon)} ate its ${held.name} and cleared its head!` });
        }
      }
    }
  }
  weatherEndOfTurn(battle, out);

  for (const s of battle.sides) {
    s.volatile.firstTurn = false;
    s.volatile.tookPhysical = 0;
    s.volatile.tookSpecial = 0;
  }
}

/**
 * The sandstorm bites, the hail falls, and the clock runs down.
 *
 * Runs after everything else in the turn so a Pokémon that survived on one
 * hit point still gets taken by the storm, which is how the games do it and
 * is the whole reason weather is a threat rather than a stat buff.
 */
function weatherEndOfTurn(battle, out) {
  const active = activeWeather(battle);
  if (active) {
    for (let i = 0; i < 2; i++) {
      const mon = activeOf(battle.sides[i]);
      if (!mon || isFainted(mon)) continue;
      if (ability.noIndirectDamage(mon)) continue;
      if (ability.shrugsOffWeather(mon, active)) continue;
      if (!weather.chipsAway(active, typesOf(mon))) continue;
      const dmg = Math.max(1, Math.floor(maxHp(mon) / 16));
      mon.hp = Math.max(0, mon.hp - dmg);
      out.push({ t: 'hp', side: i, uid: mon.uid, hp: mon.hp, shake: true });
      out.push({ t: 'text', s: weather.chipText(active, displayName(mon)) });
    }
    // Hydration washes a status off, and Solar Power charges what it costs.
    for (let i = 0; i < 2; i++) {
      const mon = activeOf(battle.sides[i]);
      if (!mon || isFainted(mon)) continue;
      if (mon.status && ability.curesStatusIn(mon, active)) {
        mon.status = null; mon.statusCounter = 0; mon.badPoison = false;
        out.push({ t: 'status', side: i, status: null });
        out.push({ t: 'text', s: `${displayName(mon)}'s ${mon.ability} washed it clean!` });
      }
      if (ability.burnsInWeather(mon, active) && !ability.noIndirectDamage(mon)) {
        const cost = Math.max(1, Math.floor(maxHp(mon) / 8));
        mon.hp = Math.max(0, mon.hp - cost);
        out.push({ t: 'hp', side: i, uid: mon.uid, hp: mon.hp, shake: true });
        out.push({ t: 'text', s: `${displayName(mon)} is scorched by ${mon.ability}!` });
      }
    }
    // Ice Body and Rain Dish read the same sky and give it back.
    for (let i = 0; i < 2; i++) {
      const mon = activeOf(battle.sides[i]);
      if (!mon || isFainted(mon)) continue;
      const heal = ability.weatherHealing(mon, active);
      if (!heal || mon.hp >= maxHp(mon)) continue;
      mon.hp = Math.min(maxHp(mon), mon.hp + Math.max(1, Math.floor(maxHp(mon) * heal)));
      out.push({ t: 'hp', side: i, uid: mon.uid, hp: mon.hp });
      out.push({ t: 'text', s: `${displayName(mon)} is soothed by ${mon.ability}!` });
    }
  }

  // The clock runs even while something is suppressing the weather.
  if (battle.weather) {
    battle.weatherTurns--;
    if (battle.weatherTurns <= 0) {
      out.push({ t: 'text', s: weather.WEATHER[battle.weather].end });
      out.push({ t: 'weather', weather: null });
      battle.weather = null;
    }
  }
}

// ---- faints, exp, end ------------------------------------------------------

function checkFaints(battle, out) {
  for (let i = 0; i < 2; i++) {
    const side = battle.sides[i];
    const mon = activeOf(side);
    if (!mon || !isFainted(mon) || battle.announcedFaints.has(mon.uid)) continue;
    battle.announcedFaints.add(mon.uid);
    onFainted(mon);
    out.push({ t: 'sfx', s: 'faint' });
    out.push({ t: 'faint', side: i });
    out.push({ t: 'text', s: `${side.isPlayer ? '' : 'Foe '}${displayName(mon)} fainted!` });

    const winnerIdx = foeIndex(i);
    const winner = battle.sides[winnerIdx];
    if (winner.isPlayer && battle.kind !== 'pvp') awardExperience(battle, winnerIdx, mon, out);
  }
  checkBattleEnd(battle, out);
}

function awardExperience(battle, sideIdx, loser, out) {
  const side = battle.sides[sideIdx];
  const participants = [...side.participants].filter((idx) => side.party[idx] && !isFainted(side.party[idx]));
  const n = Math.max(1, participants.length);
  for (const idx of participants) {
    const mon = side.party[idx];
    const amount = expYield(loser, mon.level, battle.kind === 'trainer', n);
    const scaled = battle.difficulty === 'easy' ? Math.floor(amount * 1.5) : amount;
    const before = { level: mon.level, progress: expProgress(mon) };
    out.push({ t: 'text', s: `${displayName(mon)} gained ${scaled} EXP. Points!` });
    onWonBattle(mon);
    awardEvs(mon, loser);
    const events = gainExp(mon, scaled);
    out.push({
      t: 'exp', uid: mon.uid, index: idx, amount: scaled,
      before, after: { level: mon.level, progress: expProgress(mon) },
    });
    for (const e of events) {
      if (e.type === 'level') {
        onLevelUp(mon);
        out.push({ t: 'sfx', s: 'levelup' });
        out.push({ t: 'levelup', uid: mon.uid, index: idx, level: e.level });
        out.push({ t: 'text', s: `${displayName(mon)} grew to Lv. ${e.level}!` });
      } else if (e.type === 'learn') {
        out.push({ t: 'learn', uid: mon.uid, index: idx, move: e.move });
      } else if (e.type === 'evolve') {
        out.push({ t: 'evolve', uid: mon.uid, index: idx, into: e.into });
      }
    }
  }
}

function checkBattleEnd(battle, out) {
  if (battle.over) return;
  const alive = (s) => s.party.some((m) => m && !isFainted(m));
  const aAlive = alive(battle.sides[0]);
  const bAlive = alive(battle.sides[1]);

  if (!aAlive && !bAlive) { battle.over = true; battle.result = 'draw'; return; }
  if (!bAlive) {
    battle.over = true;
    battle.result = 'win';
    const t = battle.sides[1].trainer;
    if (t) {
      out.push({ t: 'text', s: `${battle.sides[1].name} was defeated!` });
      if (t.defeat) out.push({ t: 'text', s: t.defeat, portrait: t.look });
      out.push({ t: 'prize', amount: t.prize || 0 });
    }
    return;
  }
  if (!aAlive) {
    battle.over = true;
    battle.result = 'lose';
  }
}

// True when a side needs to choose a replacement before the next turn.
export function needsSwitch(battle, sideIdx) {
  const side = battle.sides[sideIdx];
  const mon = activeOf(side);
  return !!mon && isFainted(mon) && side.party.some((m) => m && !isFainted(m));
}

export function forceSwitch(battle, sideIdx, index) {
  const side = battle.sides[sideIdx];
  const target = side.party[index];
  if (!target || isFainted(target)) return [];
  side.active = index;
  side.boosts = newBoosts();
  side.volatile = newVolatile();
  side.participants.add(index);
  return [
    { t: 'sendout', side: sideIdx, index },
    { t: 'text', s: `${side.isPlayer ? 'Go!' : `${side.name} sent out`} ${displayName(target)}!` },
  ];
}

// A compact snapshot for the network layer: enough for a peer to verify its
// own simulation matched, without shipping the whole battle object.
export function battleChecksum(battle) {
  let h = 2166136261;
  const mix = (n) => { h ^= n | 0; h = Math.imul(h, 16777619); };
  mix(battle.turn);
  for (const s of battle.sides) {
    mix(s.active);
    for (const m of s.party) { if (!m) continue; mix(m.hp); mix(m.level); mix(m.status ? m.status.charCodeAt(0) : 0); }
  }
  return h >>> 0;
}
