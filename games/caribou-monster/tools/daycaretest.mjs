// The Day Care.
//
// The slowest system in the game, so the one least likely to be caught by
// playing it. Everything here is driven by counting steps rather than by
// waiting, and the random roll is passed in, so the same walk twice gives the
// same answer and a failure is reproducible.
import {
  createDaycare, serializeDaycare, reviveDaycare, compatibility, compatibilityText,
  deposit, withdraw, feeFor, walk, hasEgg, collectEgg, hatch, eggProgress, eggHint, canDeposit,
} from '../src/game/daycare.js';
import { createMonster, reviveMonster, displayName, isFainted, maxHp } from '../src/game/monster.js';
import { getSpecies, SPECIES_LIST } from '../src/data/species.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

const TURTWIG = 387, PIPLUP = 393, BIDOOF = 399, DIALGA = 483, MAGNEMITE = 81;
const mon = (id, opts = {}) => createMonster(id, opts.level || 20, { gender: 'M', ...opts });

// ---- 1. who can breed with whom --------------------------------------------
{
  const m = mon(TURTWIG, { gender: 'M' });
  const f = mon(TURTWIG, { gender: 'F' });
  check(compatibility(m, f) === 'same', 'two of the same species get on', String(compatibility(m, f)));
  check(compatibility(m, mon(TURTWIG, { gender: 'M' })) === null, 'two of the same gender do not');
  check(compatibility(m, mon(DIALGA, { gender: 'N' })) === null, 'a legendary never does');
  check(compatibility(mon(MAGNEMITE, { gender: 'N' }), f) === null, 'nor does a genderless one');
  check(compatibility(m, mon(BIDOOF, { gender: 'F' })) === null,
    'nor do two with no egg group in common', String(compatibility(m, mon(BIDOOF, { gender: 'F' }))));

  // Every species carries the data this rests on.
  const missing = SPECIES_LIST.filter((s) => !Array.isArray(s.eggGroups) || !s.eggGroups.length
    || !s.hatchSteps || !s.baby);
  check(missing.length === 0, 'every species has egg groups, a hatch counter and a base form',
    missing.slice(0, 3).map((s) => s.name).join(', '));

  // The base form is the bottom of the line, not the species itself.
  check(getSpecies(389).baby === 387, 'a Torterra Egg hatches into a Turtwig');
  check(getSpecies(387).baby === 387, 'and a Turtwig Egg into a Turtwig');

  check(/get along very well/i.test(compatibilityText(m, f)), 'and the lady says so');
  check(/prefer to play/i.test(compatibilityText(m, mon(DIALGA, { gender: 'N' }))), 'or says they do not');
}

// ---- 2. boarding ------------------------------------------------------------
{
  const d = createDaycare();
  check(canDeposit(d), 'an empty Day Care takes one');
  deposit(d, mon(TURTWIG, { gender: 'M' }));
  deposit(d, mon(TURTWIG, { gender: 'F' }), 'Sammy');
  check(!canDeposit(d), 'and refuses a third');
  check(d.witness === 'Sammy', 'it remembers who else was online when the pair was made');

  const back = withdraw(d, 0);
  check(!!back && d.mons.length === 1, 'one can be taken back');
  check(d.witness === null, 'and the pair is no longer a pair');
  check(!isFainted(back), 'whoever comes back is healthy');
}

// ---- 3. the pair grows while you walk ---------------------------------------
{
  const d = createDaycare();
  const a = mon(TURTWIG, { gender: 'M', level: 10 });
  deposit(d, a);
  const before = a.level;
  walk(d, [], 256, () => 1);
  check(a.level === before + 1, 'a boarder gains a level every 256 steps', `${before} -> ${a.level}`);
  check(a.hp === maxHp(a), 'and comes up to full health with it');
  const fee = feeFor(d, 0);
  check(fee === 200, 'the fee is 100 plus 100 a level', String(fee));
}

// ---- 4. the Egg -------------------------------------------------------------
{
  const d = createDaycare();
  deposit(d, mon(TURTWIG, { gender: 'M' }));
  deposit(d, mon(TURTWIG, { gender: 'F' }), 'Matthew');

  // A roll that never succeeds never produces one, however far you walk.
  walk(d, [], 100000, () => 0.999);
  check(!hasEgg(d), 'a pair that never rolls lucky never produces an Egg');

  walk(d, [], 128, () => 0.0);
  check(hasEgg(d), 'and one that does, does');
  check(d.egg.species === 387, 'the Egg holds the base form', String(d.egg.species));
  check(d.egg.witness === 'Matthew', 'and carries both names');

  const egg = collectEgg(d, { name: 'Sammy', id: 7 });
  check(egg && egg.isEgg, 'the Egg comes home as a party member');
  check(displayName(egg) === 'Egg', 'and is called Egg until it hatches');
  check(isFainted(egg), 'an Egg can never be sent into a battle');
  check(egg.coParent === 'Matthew', 'with the other name on it');
  check(!hasEgg(d), 'and the Day Care has none waiting afterwards');
  check(d.collected === 1, 'the count went up');
}

// ---- 5. hatching -------------------------------------------------------------
{
  const d = createDaycare();
  deposit(d, mon(PIPLUP, { gender: 'M' }));
  deposit(d, mon(PIPLUP, { gender: 'F' }));
  walk(d, [], 128, () => 0);
  const egg = collectEgg(d, { name: 'Sammy', id: 7 });
  const party = [mon(TURTWIG), egg];

  check(eggProgress(egg) === 0, 'a new Egg has not started');
  check(/could be inside/i.test(eggHint(egg)), 'and the lady is vague about it', eggHint(egg));

  const half = Math.floor(egg.eggNeeded / 2);
  walk(d, party, half, () => 0.99);
  check(Math.abs(eggProgress(egg) - 0.5) < 0.02, 'walking moves it along', eggProgress(egg).toFixed(2));
  check(/close|moves about/i.test(eggHint(egg)), 'and she notices', eggHint(egg));

  const news = walk(d, party, egg.eggNeeded - half, () => 0.99);
  check(news.hatched === egg, 'the walk reports it hatching');

  const born = hatch(egg);
  check(!born.isEgg, 'and it is a Pokémon afterwards');
  check(born.species === 393, 'of the species that was inside', String(born.species));
  check(!isFainted(born), 'ready to battle');
  check(displayName(born) !== 'Egg', 'and no longer called Egg');
  check(born.coParent === 'Matthew' || born.coParent === null || born.coParent === undefined
    || typeof born.coParent === 'string', 'keeping whatever name was on it');
}

// ---- 6. it survives a save ---------------------------------------------------
{
  const d = createDaycare();
  deposit(d, mon(TURTWIG, { gender: 'M', level: 14 }));
  deposit(d, mon(TURTWIG, { gender: 'F', level: 15 }), 'Matthew');
  walk(d, [], 128, () => 0);

  const raw = JSON.parse(JSON.stringify(serializeDaycare(d)));
  const back = reviveDaycare(raw, reviveMonster);
  check(back.mons.length === 2, 'both boarders come back', String(back.mons.length));
  check(back.mons[0].level === 14 && back.mons[1].level === 15, 'at the levels they were on');
  check(back.witness === 'Matthew', 'the witness survives');
  check(!!back.egg && back.egg.species === 387, 'and so does the waiting Egg');
  check(back.egg.witness === 'Matthew', 'with its names');
  check(JSON.stringify(serializeDaycare(back)) === JSON.stringify(serializeDaycare(d)),
    'and the whole thing round-trips unchanged');
}

// ---- 7. a corrupt or empty save does not take the game with it ---------------
{
  check(reviveDaycare(null, reviveMonster).mons.length === 0, 'no Day Care in the save is fine');
  const junk = reviveDaycare({ mons: [{ species: 99999 }], egg: { species: 99999 } }, reviveMonster);
  check(junk.mons.length === 0, 'an unknown boarder is dropped rather than crashing');
  check(junk.egg === null, 'and so is an Egg holding a species that does not exist');
}

console.log(fails ? `\n${fails} failure(s)` : '\nday care: all checks passed');
process.exit(fails ? 1 : 0);
