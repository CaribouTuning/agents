// Evolution actually happens.
//
// Reported as not working. The data is right (Turtwig at 18, Chimchar at 14,
// Piplup at 16, all matching the real games) and the plumbing looks right, so
// this drives the real path end to end rather than reading it: give a monster
// enough experience to cross its threshold and check what comes out.
import { createMonster, gainExp, maxHp } from '../src/game/monster.js';
import { evolutionFor, evolveNow } from '../src/game/evolution.js';
import { getSpecies, SPECIES_LIST } from '../src/data/species.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}${extra ? `  ${extra}` : ''}`);
  if (!ok) fails++;
};

console.log('--- the level-up path emits an evolution ---');
for (const [id, at, into] of [[387, 18, 388], [390, 14, 391], [393, 16, 394]]) {
  const mon = createMonster(id, at - 1);
  // Enough experience to cross one level, and then some.
  const events = gainExp(mon, 100000);
  const evo = events.find((e) => e.type === 'evolve');
  check(!!evo, `${getSpecies(id).name} past Lv${at} produces an evolve event`,
    evo ? `-> ${getSpecies(evo.into).name}` : events.map((e) => e.type).join(','));
  if (evo) check(evo.into === into, 'and it evolves into the right thing', String(evo.into));
}

console.log('\n--- and evolving applies ---');
{
  const mon = createMonster(387, 18);
  const before = { species: mon.species, hp: maxHp(mon) };
  const evo = evolutionFor(mon, 'level');
  check(!!evo, 'a Turtwig at 18 is eligible', evo ? String(evo.into) : 'none');
  evolveNow(mon, evo.into);
  check(mon.species === 388, 'it becomes Grotle', String(mon.species));
  check(maxHp(mon) > before.hp, 'and its stats go up', `${before.hp} -> ${maxHp(mon)}`);
}

console.log('\n--- nothing evolves before its level ---');
{
  const mon = createMonster(387, 17);
  check(!evolutionFor(mon, 'level'), 'a Turtwig at 17 is not eligible');
}

console.log('\n--- every level-up evolution in the dex is reachable ---');
{
  let checked = 0;
  for (const sp of SPECIES_LIST) {
    for (const evo of sp.evolutions || []) {
      if (evo.method !== 'level') continue;
      checked++;
      const target = getSpecies(evo.into);
      if (!target) { check(false, `${sp.name} evolves into a species that does not exist`, String(evo.into)); continue; }
      if (!(evo.level > 0 && evo.level <= 100)) {
        check(false, `${sp.name} -> ${target.name} has a nonsense level`, String(evo.level));
        continue;
      }
      // The real games never have a Pokemon evolve into something weaker.
      const sum = (b) => b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
      if (sum(target.base) <= sum(sp.base)) {
        check(false, `${sp.name} -> ${target.name} does not gain stats`,
          `${sum(sp.base)} -> ${sum(target.base)}`);
      }
    }
  }
  check(checked > 0, `${checked} level-up evolutions checked`);
}

console.log(fails ? `\n${fails} failure(s)` : '\nevolution: all checks passed');
process.exit(fails ? 1 : 0);
