// Abilities.
//
// Every Pokémon in this game already carries an ability name — it is on the
// summary screen and in the Pokédex — but until now nothing read it, so a
// Turtwig's Overgrow and a Bidoof's Simple were the same thing: decoration.
// This is the table that makes them mean something.
//
// Two rules hold the whole file together:
//
//  1. Hooks are pure functions of (battle, side, mon, ...). They may push text
//     events and mutate battle state, and they may use `battle.rng` — but only
//     `battle.rng`, never Math.random, because a link battle replays the same
//     stream on both phones and an ability that rolled its own dice would
//     desync the two clients on the first proc.
//  2. An ability this engine cannot honestly implement is listed as inert with
//     the reason, rather than quietly doing nothing. A silent no-op is how a
//     system rots: nobody can tell the unimplemented from the broken.
import { displayName, isFainted, maxHp, typesOf } from '../monster.js';

/** Pinch abilities: +50% to their own type once HP drops to a third. */
function pinch(type) {
  return {
    pinchType: type,
    describe: `Powers up ${type} moves in a pinch.`,
  };
}

export const ABILITIES = {
  Overgrow: pinch('Grass'),
  Blaze: pinch('Fire'),
  Torrent: pinch('Water'),
  Swarm: pinch('Bug'),

  Intimidate: {
    describe: 'Lowers the foe’s Attack on entry.',
    onSwitchIn(battle, sideIdx, ctx) {
      ctx.statChange(1 - sideIdx, 'atk', -1);
      ctx.say(`${ctx.name}'s Intimidate cut the foe's Attack!`);
    },
  },

  'Rock Head': {
    describe: 'Takes no recoil damage.',
    noRecoil: true,
  },

  Levitate: {
    describe: 'Immune to Ground moves.',
    immuneTo: 'Ground',
  },

  'Flash Fire': {
    describe: 'Fire moves miss, and power up its own.',
    immuneTo: 'Fire',
    onImmune(battle, sideIdx, ctx) {
      const side = battle.sides[sideIdx];
      if (!side.volatile.flashFire) {
        side.volatile.flashFire = true;
        ctx.say(`${ctx.name}'s Flash Fire raised its Fire power!`);
      }
    },
  },

  Guts: {
    describe: 'Attack rises when it has a status problem.',
    attackMultiplier(mon) { return mon.status ? 1.5 : 1; },
    ignoresBurnDrop: true,
  },

  'Natural Cure': {
    describe: 'Recovers from status on switching out.',
    onSwitchOut(battle, sideIdx, ctx, mon) {
      if (!mon.status) return;
      mon.status = null;
      mon.statusCounter = 0;
      mon.badPoison = false;
      ctx.say(`${displayName(mon)}'s Natural Cure healed its status!`);
    },
  },

  'Shed Skin': {
    describe: 'Sometimes sheds a status problem.',
    onEndOfTurn(battle, sideIdx, ctx, mon) {
      if (!mon.status) return;
      if (battle.rng() >= 1 / 3) return;
      mon.status = null;
      mon.statusCounter = 0;
      mon.badPoison = false;
      ctx.say(`${displayName(mon)} shed its skin and lost its status!`);
    },
  },

  'Inner Focus': {
    describe: 'Never flinches.',
    preventsFlinch: true,
  },

  Steadfast: {
    describe: 'Speed rises each time it flinches.',
    onFlinch(battle, sideIdx, ctx) {
      ctx.statChange(sideIdx, 'spe', 1);
    },
  },

  'Keen Eye': {
    describe: 'Its accuracy cannot be lowered.',
    protectedStats: ['acc'],
  },

  'Hyper Cutter': {
    describe: 'Its Attack cannot be lowered.',
    protectedStats: ['atk'],
  },

  Pressure: {
    describe: 'Makes the foe’s moves cost extra PP.',
    extraPpCost: 1,
  },

  'Shield Dust': {
    describe: 'Blocks the added effects of attacks.',
    blocksSecondary: true,
  },

  Synchronize: {
    describe: 'Passes poison, paralysis or burn back to the attacker.',
    onStatused(battle, sideIdx, ctx, mon, status) {
      if (!['PSN', 'PAR', 'BRN'].includes(status)) return;
      ctx.passStatus(1 - sideIdx, status);
    },
  },

  'Run Away': {
    describe: 'Always able to flee a wild battle.',
    alwaysFlees: true,
  },
};

/**
 * Abilities carried by species in this game that the engine deliberately does
 * not implement, and why. Kept as data so tools/audit.mjs can prove every
 * ability in the Pokédex is either implemented or knowingly inert — and so a
 * player reading the summary screen is not told about an effect that is not
 * there.
 */
export const INERT_ABILITIES = {
  Simple: 'stat-stage doubling would need the boost system to distinguish source',
  'Sticky Hold': 'nothing in this game steals held items',
  Damp: 'no self-destructing moves exist',
  'Honey Gather': 'no post-battle item pickup',
  Chlorophyll: 'no weather system',
  'Flower Gift': 'no weather system',
  'Swift Swim': 'no weather system',
  'Cute Charm': 'no infatuation status',
};

export function abilityOf(mon) {
  return (mon && mon.ability && ABILITIES[mon.ability]) || null;
}

export function abilityName(mon) { return (mon && mon.ability) || null; }

/** Text for the summary screen: honest about the inert ones. */
export function abilityDescription(name) {
  if (ABILITIES[name]) return ABILITIES[name].describe;
  if (INERT_ABILITIES[name]) return 'Has no effect in battle here.';
  return '';
}

// ---- the hooks the engine calls --------------------------------------------
// Each takes a small `ctx` of the few engine operations an ability may perform,
// so this file never imports the engine and the two cannot form a cycle.

export function onSwitchIn(battle, sideIdx, ctx) {
  const a = abilityOf(ctx.mon);
  if (a && a.onSwitchIn) a.onSwitchIn(battle, sideIdx, ctx);
}

export function onSwitchOut(battle, sideIdx, ctx, mon) {
  const a = abilityOf(mon);
  if (a && a.onSwitchOut) a.onSwitchOut(battle, sideIdx, ctx, mon);
}

export function onEndOfTurn(battle, sideIdx, ctx, mon) {
  const a = abilityOf(mon);
  if (a && a.onEndOfTurn) a.onEndOfTurn(battle, sideIdx, ctx, mon);
}

export function onStatused(battle, sideIdx, ctx, mon, status) {
  const a = abilityOf(mon);
  if (a && a.onStatused) a.onStatused(battle, sideIdx, ctx, mon, status);
}

export function onFlinch(battle, sideIdx, ctx) {
  const a = abilityOf(ctx.mon);
  if (a && a.onFlinch) a.onFlinch(battle, sideIdx, ctx);
}

/** True if this Pokémon simply is not hit by moves of `type`. */
export function immuneToType(mon, type) {
  const a = abilityOf(mon);
  return !!(a && a.immuneTo === type);
}

export function onImmune(battle, sideIdx, ctx) {
  const a = abilityOf(ctx.mon);
  if (a && a.onImmune) a.onImmune(battle, sideIdx, ctx);
}

export function preventsFlinch(mon) {
  const a = abilityOf(mon);
  return !!(a && a.preventsFlinch);
}

export function blocksSecondary(mon) {
  const a = abilityOf(mon);
  return !!(a && a.blocksSecondary);
}

export function protectsStat(mon, stat) {
  const a = abilityOf(mon);
  return !!(a && a.protectedStats && a.protectedStats.includes(stat));
}

export function noRecoil(mon) {
  const a = abilityOf(mon);
  return !!(a && a.noRecoil);
}

export function ignoresBurnDrop(mon) {
  const a = abilityOf(mon);
  return !!(a && a.ignoresBurnDrop);
}

export function alwaysFlees(mon) {
  const a = abilityOf(mon);
  return !!(a && a.alwaysFlees);
}

/** Extra PP the *defending* side's ability charges the attacker. */
export function extraPpCost(defender) {
  const a = abilityOf(defender);
  return (a && a.extraPpCost) || 0;
}

/**
 * Every multiplier an attacker's ability applies to one damaging move.
 * Returns 1 when nothing applies, so the caller can multiply unconditionally.
 */
export function attackMultiplier(user, move, side) {
  const a = abilityOf(user);
  if (!a) return 1;
  let m = 1;
  if (a.pinchType && move.type === a.pinchType && user.hp * 3 <= maxHp(user)) m *= 1.5;
  if (a.attackMultiplier) m *= a.attackMultiplier(user);
  // Flash Fire's stored charge lives on the side, not the Pokémon, so it
  // clears when the Pokémon leaves the field — same as the real thing.
  if (side && side.volatile.flashFire && move.type === 'Fire') m *= 1.5;
  return m;
}

export { isFainted, typesOf };
