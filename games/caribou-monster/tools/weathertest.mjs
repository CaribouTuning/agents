// Weather.
//
// Fifteen abilities and four moves were dead code until this system existed,
// so this suite proves each rule against its own absence: the same battle,
// the same seed, with and without the sky.
import {
  createBattle, resolveTurn, computeDamage, activeOf, activeWeather, setWeather, effectiveStat,
} from '../src/game/battle/engine.js';
import { createMonster, maxHp, typesOf } from '../src/game/monster.js';
import { getSpecies, SPECIES_LIST } from '../src/data/species.js';
import { getMove, MOVES } from '../src/data/moves.js';
import * as W from '../src/game/battle/weather.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};
const flat = (v) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v });
const first = (id) => getSpecies(id).abilities[0];
const text = (events) => events.filter((e) => e.t === 'text').map((e) => e.s).join(' | ');

function duel(a, b, opts = {}) {
  const fixed = { ivs: flat(20), evs: flat(0), nature: 0, gender: 'M', shiny: false };
  const ma = createMonster(a, opts.aLevel || 40, { ...fixed, ability: opts.aAbility || first(a) });
  const mb = createMonster(b, opts.bLevel || 40, { ...fixed, ability: opts.bAbility || first(b) });
  if (opts.aMoves) ma.moves = opts.aMoves.map((id) => ({ id, pp: 30, ppMax: 30 }));
  if (opts.bMoves) mb.moves = opts.bMoves.map((id) => ({ id, pp: 30, ppMax: 30 }));
  const battle = createBattle({
    seed: opts.seed || 4242, kind: 'trainer', difficulty: 'normal', weather: opts.weather || null,
    a: { id: 'p', name: 'A', isPlayer: true, party: [ma], trainer: { ai: 1 } },
    b: { id: 'e', name: 'B', party: [mb], trainer: { name: 'B', ai: 1 } },
  });
  return { battle, a: ma, b: mb };
}

// A Fire type, a Water type and a Grass type from the dex, for the rules below.
const TURTWIG = 387, CHIMCHAR = 390, PIPLUP = 393, GEODUDE = 74, SNEASEL = 215;

// ---- 1. the four skies exist and read back --------------------------------
{
  for (const kind of ['sun', 'rain', 'sand', 'hail']) {
    const { battle } = duel(TURTWIG, PIPLUP, { weather: kind });
    check(activeWeather(battle) === kind, `a battle can start in ${kind}`);
  }
  const { battle } = duel(TURTWIG, PIPLUP);
  check(activeWeather(battle) === null, 'and starts clear by default');
}

// ---- 2. the moves set it ---------------------------------------------------
{
  for (const [id, kind] of [['sunnyday', 'sun'], ['raindance', 'rain'], ['sandstorm', 'sand'], ['hail', 'hail']]) {
    const mv = getMove(id);
    check(mv.effect && mv.effect.kind === 'weather' && mv.effect.weather === kind,
      `${mv.name} is a weather move in the table`, JSON.stringify(mv.effect));
    const { battle } = duel(TURTWIG, PIPLUP, { aMoves: [id], bMoves: ['tackle'] });
    resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    check(battle.weather === kind, `using ${mv.name} sets ${kind}`, String(battle.weather));
  }
}

// ---- 3. sun and rain move the damage ---------------------------------------
{
  const fire = (weather) => {
    const { battle } = duel(CHIMCHAR, TURTWIG, { aMoves: ['ember'], weather });
    return computeDamage(battle, 0, getMove('ember'), { peek: true }).dmg;
  };
  const clear = fire(null);
  check(fire('sun') > clear, 'Fire hits harder in sun', `${fire('sun')} vs ${clear}`);
  check(fire('rain') < clear, 'and is smothered by rain', `${fire('rain')} vs ${clear}`);

  const water = (weather) => {
    const { battle } = duel(PIPLUP, CHIMCHAR, { aMoves: ['watergun'], weather });
    return computeDamage(battle, 0, getMove('watergun'), { peek: true }).dmg;
  };
  const wc = water(null);
  check(water('rain') > wc, 'Water hits harder in rain', `${water('rain')} vs ${wc}`);
  check(water('sun') < wc, 'and evaporates in sun', `${water('sun')} vs ${wc}`);
}

// ---- 4. sand and hail bite, and spare their own ----------------------------
{
  const chip = (weather, species) => {
    const { battle, a } = duel(species, PIPLUP, { aMoves: ['splash'], bMoves: ['splash'], weather });
    const before = a.hp;
    resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    return before - a.hp;
  };
  check(chip('sand', TURTWIG) > 0, 'a sandstorm hurts a Grass type', String(chip('sand', TURTWIG)));
  check(chip('sand', GEODUDE) === 0, 'and leaves a Rock type alone');
  check(chip('hail', TURTWIG) > 0, 'hail hurts a Grass type');
  check(chip('hail', SNEASEL) === 0, 'and leaves an Ice type alone');
  check(chip(null, TURTWIG) === 0, 'clear weather hurts nobody');

  check(W.chipsAway('sand', ['Ground']) === false, 'Ground is safe in sand');
  check(W.chipsAway('sand', ['Steel']) === false, 'Steel is safe in sand');
}

// ---- 5. the sky runs out ----------------------------------------------------
{
  const { battle } = duel(TURTWIG, PIPLUP, { aMoves: ['splash'], bMoves: ['splash'], weather: 'rain' });
  let sawEnd = false;
  for (let i = 0; i < W.DEFAULT_TURNS + 2 && !battle.over; i++) {
    const ev = resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    if (/rain stopped/i.test(text(ev))) sawEnd = true;
  }
  check(sawEnd, 'weather announces itself ending');
  check(battle.weather === null, 'and is gone afterwards', String(battle.weather));
}

// ---- 6. the abilities that were waiting on it -------------------------------
{
  // Drizzle brings its own sky the moment it is on the field.
  {
    const { battle } = duel(TURTWIG, PIPLUP,
      { aAbility: 'Drizzle', aMoves: ['splash'], bMoves: ['splash'] });
    check(battle.weather === null, 'a Drizzle battle has not rained before it starts');
    const ev = resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    check(battle.weather === 'rain', 'and rains on the first turn', String(battle.weather));
    check(/Drizzle/.test(text(ev)), 'announcing itself', text(ev).slice(0, 60));
  }

  // Chlorophyll doubles Speed in sun, and only in sun.
  {
    const speedIn = (ability, sky) => {
      const { battle } = duel(TURTWIG, PIPLUP, { aAbility: ability, weather: sky });
      return effectiveStat(battle, 0, 'spe');
    };
    check(speedIn('Chlorophyll', 'sun') > speedIn('Chlorophyll', null),
      'Chlorophyll is faster in sun', `${speedIn('Chlorophyll', 'sun')} vs ${speedIn('Chlorophyll', null)}`);
    check(speedIn('Chlorophyll', 'rain') === speedIn('Chlorophyll', null),
      'and ordinary in the rain');
    check(speedIn('Swift Swim', 'rain') > speedIn('Swift Swim', null),
      'Swift Swim is faster in rain');
  }

  // Sand Veil is not bothered by its own storm.
  const chipVeil = (ability) => {
    const { battle: b, a } = duel(TURTWIG, PIPLUP,
      { aAbility: ability, aMoves: ['splash'], bMoves: ['splash'], weather: 'sand' });
    const before = a.hp;
    resolveTurn(b, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    return before - a.hp;
  };
  check(chipVeil('Sand Veil') === 0, 'Sand Veil shrugs off its own sandstorm');
  check(chipVeil('Overgrow') > 0, 'and an ordinary ability does not');

  // Ice Body turns hail into healing.
  const { battle: ib, a: icy } = duel(TURTWIG, PIPLUP,
    { aAbility: 'Ice Body', aMoves: ['splash'], bMoves: ['splash'], weather: 'hail' });
  icy.hp = Math.floor(maxHp(icy) / 2);
  const before = icy.hp;
  resolveTurn(ib, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
  check(icy.hp > before, 'Ice Body heals in hail', `${before} -> ${icy.hp}`);

  // Leaf Guard keeps status off in sun.
  const guard = (ability, weather) => {
    const { battle: b, a } = duel(TURTWIG, PIPLUP,
      { aAbility: ability, aMoves: ['splash'], bMoves: ['willowisp'], weather, seed: 99 });
    for (let i = 0; i < 4 && !a.status; i++) {
      resolveTurn(b, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
    }
    return a.status;
  };
  check(guard('Leaf Guard', 'sun') === null, 'Leaf Guard blocks a burn in sunshine');
  check(guard('Overgrow', 'sun') !== null, 'and an ordinary ability takes it');

  // Cloud Nine switches the whole sky off without clearing it.
  const { battle: cn } = duel(TURTWIG, PIPLUP, { aAbility: 'Cloud Nine', weather: 'sand' });
  check(cn.weather === 'sand', 'Cloud Nine leaves the storm running');
  check(activeWeather(cn) === null, 'but nothing on the field can feel it');
}

// ---- 7. Thunder never misses in the rain ------------------------------------
{
  check(W.accuracyMultiplier('rain', 'thunder') === Infinity, 'Thunder cannot miss in rain');
  check(W.accuracyMultiplier('sun', 'thunder') < 1, 'and is unreliable in sun');
  check(W.accuracyMultiplier('hail', 'blizzard') === Infinity, 'Blizzard cannot miss in hail');
  check(W.accuracyMultiplier(null, 'tackle') === 1, 'and an ordinary move is unaffected');
}

// ---- 8. the sky never crashes a battle --------------------------------------
{
  let crashes = 0;
  for (const kind of [null, 'sun', 'rain', 'sand', 'hail']) {
    for (let i = 0; i < 12; i++) {
      try {
        const { battle } = duel(
          SPECIES_LIST[(i * 13) % SPECIES_LIST.length].id,
          SPECIES_LIST[(i * 29 + 5) % SPECIES_LIST.length].id,
          { weather: kind, seed: 500 + i },
        );
        let guard = 0;
        while (!battle.over && guard++ < 300) {
          resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }]);
        }
      } catch (e) { console.log(`  CRASH ${kind}: ${e.message}`); crashes++; }
    }
  }
  check(crashes === 0, '60 battles across every sky, no crashes');
}

// ---- 9. determinism, which a link battle depends on -------------------------
{
  const run = (seed) => {
    const { battle } = duel(CHIMCHAR, PIPLUP, { weather: 'sand', seed });
    const log = [];
    let guard = 0;
    while (!battle.over && guard++ < 60) {
      log.push(text(resolveTurn(battle, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }])));
    }
    return log.join('\n');
  };
  for (const seed of [7, 77, 777]) {
    check(run(seed) === run(seed), `seed ${seed}: weather kept the battle deterministic`);
  }
}

void MOVES; void typesOf; void setWeather;
console.log(fails ? `\n${fails} failure(s)` : '\nweather: all checks passed');
process.exit(fails ? 1 : 0);
