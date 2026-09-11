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


const ALL_STATS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];

/** Absorb abilities all say the same thing: no damage, a quarter back. */
function healQuarter(label) {
  return function onImmune(battle, sideIdx, ctx) {
    const mon = ctx.mon;
    const cap = maxHp(mon);
    if (mon.hp >= cap) { ctx.say(`${ctx.name}'s ${label} had no effect.`); return; }
    mon.hp = Math.min(cap, mon.hp + Math.max(1, Math.floor(cap / 4)));
    ctx.hp(sideIdx, mon);
    ctx.say(`${ctx.name}'s ${label} restored its health!`);
  };
}

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

  // ---- crit and STAB -------------------------------------------------------

  'Battle Armor': { describe: 'Blocks critical hits.', noCrit: true },
  'Shell Armor': { describe: 'Blocks critical hits.', noCrit: true },
  Sniper: { describe: 'Critical hits do even more damage.', critMultiplier: 3 },
  'Super Luck': { describe: 'Lands critical hits more often.', critBonus: 1 },
  Adaptability: { describe: 'Same-type moves hit far harder.', stab: 2 },

  // ---- flat damage multipliers --------------------------------------------

  'Huge Power': { describe: 'Doubles its physical power.', physicalMultiplier: 2 },
  'Pure Power': { describe: 'Doubles its physical power.', physicalMultiplier: 2 },
  Hustle: {
    describe: 'Trades accuracy for physical power.',
    physicalMultiplier: 1.5,
    accuracyMultiplier(move) { return move.cls === 'physical' ? 0.8 : 1; },
  },
  Technician: {
    describe: 'Powers up its weaker moves.',
    moveMultiplier(move) { return move.power > 0 && move.power <= 60 ? 1.5 : 1; },
  },
  'Tinted Lens': { describe: 'Doubles the damage of not-very-effective moves.', tintedLens: true },
  Rivalry: {
    describe: 'Hits harder against the same gender, softer against the other.',
    versus(user, target) {
      if (!user.gender || !target.gender || user.gender === 'N' || target.gender === 'N') return 1;
      return user.gender === target.gender ? 1.25 : 0.75;
    },
  },

  // ---- damage taken --------------------------------------------------------

  'Solid Rock': { describe: 'Softens super-effective hits.', reduceSuperEffective: 0.75 },
  Filter: { describe: 'Softens super-effective hits.', reduceSuperEffective: 0.75 },
  'Thick Fat': { describe: 'Halves Fire and Ice damage.', takes: { Fire: 0.5, Ice: 0.5 } },
  Heatproof: { describe: 'Halves Fire damage.', takes: { Fire: 0.5 } },
  'Marvel Scale': {
    describe: 'Defense rises when it has a status problem.',
    defenseStat(mon, key) { return key === 'def' && mon.status ? 1.5 : 1; },
  },
  'Magic Guard': { describe: 'Only takes damage from attacks.', noIndirectDamage: true },

  // ---- type absorption -----------------------------------------------------

  'Water Absorb': { describe: 'Water moves heal it instead.', immuneTo: 'Water', onImmune: healQuarter('Water Absorb') },
  'Volt Absorb': { describe: 'Electric moves heal it instead.', immuneTo: 'Electric', onImmune: healQuarter('Volt Absorb') },
  'Dry Skin': {
    describe: 'Water heals it; Fire hurts more.',
    immuneTo: 'Water',
    onImmune: healQuarter('Dry Skin'),
    takes: { Fire: 1.25 },
  },
  'Motor Drive': {
    describe: 'Electric moves make it faster instead.',
    immuneTo: 'Electric',
    onImmune(battle, sideIdx, ctx) {
      ctx.say(`${ctx.name}'s Motor Drive kicked in!`);
      ctx.statChange(sideIdx, 'spe', 1);
    },
  },
  Soundproof: { describe: 'Immune to sound-based moves.', blocksFlag: 'sound' },

  // ---- accuracy ------------------------------------------------------------

  'Compound Eyes': { describe: 'Raises the accuracy of its moves.', accuracyMultiplier() { return 1.3; } },
  'No Guard': { describe: 'Every move hits, in both directions.', neverMisses: true },

  // ---- status immunities ---------------------------------------------------

  Immunity: { describe: 'Cannot be poisoned.', statusImmunity: ['PSN'] },
  Limber: { describe: 'Cannot be paralysed.', statusImmunity: ['PAR'] },
  'Water Veil': { describe: 'Cannot be burned.', statusImmunity: ['BRN'] },
  'Magma Armor': { describe: 'Cannot be frozen.', statusImmunity: ['FRZ'] },
  Insomnia: { describe: 'Cannot fall asleep.', statusImmunity: ['SLP'] },
  'Vital Spirit': { describe: 'Cannot fall asleep.', statusImmunity: ['SLP'] },
  'Own Tempo': { describe: 'Cannot be confused.', statusImmunity: ['CNF'] },
  'Tangled Feet': { describe: 'Harder to hit while it is confused.', evasionWhenConfused: 1.2 },
  'Early Bird': { describe: 'Wakes from sleep twice as fast.', sleepTicks: 2 },

  // ---- stat protection -----------------------------------------------------

  'Clear Body': { describe: 'Its stats cannot be lowered.', protectedStats: ALL_STATS },
  'White Smoke': { describe: 'Its stats cannot be lowered.', protectedStats: ALL_STATS },
  Unaware: { describe: 'Ignores the foe’s stat changes.', ignoresBoosts: true },
  'Mold Breaker': { describe: 'Moves land regardless of the foe’s ability.', ignoresAbility: true },

  // ---- weather -------------------------------------------------------------

  Drizzle: { describe: 'Summons rain on entry.', summons: 'rain' },
  'Sand Stream': { describe: 'Summons a sandstorm on entry.', summons: 'sand' },
  'Snow Warning': { describe: 'Summons hail on entry.', summons: 'hail' },

  Chlorophyll: { describe: 'Doubles its Speed in sunshine.', speedIn: { sun: 2 } },
  'Swift Swim': { describe: 'Doubles its Speed in rain.', speedIn: { rain: 2 } },
  'Solar Power': {
    describe: 'Sunshine raises its Sp. Atk, and burns it away.',
    specialIn: { sun: 1.5 },
    burnsIn: ['sun'],
  },
  'Flower Gift': { describe: 'Sunshine raises its Attack and Sp. Def.', attackIn: { sun: 1.5 }, defenseIn: { sun: 1.5 } },

  'Sand Veil': { describe: 'Harder to hit in a sandstorm.', evadeIn: { sand: 1.25 }, weatherProof: ['sand'] },
  'Snow Cloak': { describe: 'Harder to hit in hail.', evadeIn: { hail: 1.25 }, weatherProof: ['hail'] },
  'Ice Body': { describe: 'Hail heals it instead of hurting it.', healsIn: { hail: 1 / 16 }, weatherProof: ['hail'] },
  'Rain Dish': { describe: 'Rain slowly heals it.', healsIn: { rain: 1 / 16 } },
  Hydration: { describe: 'Rain washes away its status problems.', curesIn: ['rain'] },
  'Leaf Guard': { describe: 'Sunshine keeps status problems off it.', statusProofIn: ['sun'] },

  'Cloud Nine': { describe: 'Nothing on the field feels the weather.', suppressesWeather: true },
  'Air Lock': { describe: 'Nothing on the field feels the weather.', suppressesWeather: true },

  // ---- reactions -----------------------------------------------------------

  'Serene Grace': { describe: 'Added effects happen twice as often.', secondaryMultiplier: 2 },
  Static: { describe: 'Contact may paralyse the attacker.', contactStatus: 'PAR', contactChance: 0.3 },
  'Flame Body': { describe: 'Contact may burn the attacker.', contactStatus: 'BRN', contactChance: 0.3 },
  'Poison Point': { describe: 'Contact may poison the attacker.', contactStatus: 'PSN', contactChance: 0.3 },
  'Effect Spore': { describe: 'Contact may poison, paralyse or send to sleep.', contactSpore: true, contactChance: 0.3 },
  'Rough Skin': { describe: 'Hurts anything that touches it.', contactDamage: 1 / 8 },
  Aftermath: { describe: 'Hurts the attacker that knocks it out by contact.', aftermath: 1 / 4 },
  'Liquid Ooze': { describe: 'Draining from it hurts the drainer instead.', liquidOoze: true },
  'Speed Boost': {
    describe: 'Its Speed rises every turn.',
    onEndOfTurn(battle, sideIdx, ctx) { ctx.statChange(sideIdx, 'spe', 1); },
  },
  Klutz: { describe: 'Cannot use a held item.', noHeldItem: true },
  Trace: {
    describe: 'Copies the foe’s ability on entry.',
    onSwitchIn(battle, sideIdx, ctx) {
      const foe = ctx.foeMon();
      if (!foe || !foe.ability || !ABILITIES[foe.ability] || foe.ability === 'Trace') return;
      ctx.mon.ability = foe.ability;
      ctx.say(`${ctx.name} traced ${foe.ability}!`);
    },
  },
  Download: {
    describe: 'Sizes up the foe and raises its better attacking stat on entry.',
    onSwitchIn(battle, sideIdx, ctx) {
      const foe = ctx.foeMon();
      if (!foe) return;
      const physical = ctx.stat(foe, 'def') <= ctx.stat(foe, 'spd');
      ctx.say(`${ctx.name} downloaded the foe’s data!`);
      ctx.statChange(sideIdx, physical ? 'atk' : 'spa', 1);
    },
  },
  Anticipation: {
    describe: 'Shudders when the foe is carrying something dangerous.',
    onSwitchIn(battle, sideIdx, ctx) {
      if (ctx.foeHasSuperEffective && ctx.foeHasSuperEffective()) ctx.say(`${ctx.name} shuddered!`);
    },
  },

  // ---- the National Dex arrivals -------------------------------------------
  // Everything below came in with the other 283 species. Each one is either
  // implemented here or listed inert underneath with the reason; nothing new
  // is allowed to quietly do nothing.

  Drought: { describe: 'Summons harsh sunlight on entry.', summons: 'sun' },

  'Quick Feet': {
    describe: 'Speed rises when it has a status problem.',
    speedWhenStatus: 1.5,
    // The point of Quick Feet is that paralysis makes it FASTER, so the
    // normal quarter-speed cut has to be lifted as well as the bonus applied.
    ignoresParalysisDrop: true,
  },

  'Poison Heal': {
    describe: 'Poison heals it instead of hurting it.',
    healsFromPoison: 1 / 8,
  },

  'Anger Point': {
    describe: 'A critical hit sends its Attack through the roof.',
    onCritTaken(battle, sideIdx, ctx) {
      ctx.say(`${ctx.name}'s Anger Point maxed its Attack!`);
      // Six stages from wherever it is now: "maxed", not "raised".
      for (let i = 0; i < 6; i++) ctx.statChange(sideIdx, 'atk', 1);
    },
  },

  'Skill Link': {
    describe: 'Multi-strike moves always hit the maximum number of times.',
    maxMultiHit: true,
  },

  'Bad Dreams': {
    describe: 'Hurts a sleeping foe every turn.',
    onEndOfTurn(battle, sideIdx, ctx) {
      const foe = ctx.foeMon();
      if (!foe || foe.status !== 'SLP' || foe.hp <= 0) return;
      ctx.damageFoe(Math.max(1, Math.floor(maxHp(foe) / 8)),
        `${displayName(foe)} is tormented by Bad Dreams!`);
    },
  },

  Forewarn: {
    describe: 'Senses the foe’s most dangerous move on entry.',
    onSwitchIn(battle, sideIdx, ctx) {
      const foe = ctx.foeMon();
      if (!foe || !foe.moves || !foe.moves.length) return;
      let worst = null;
      let power = -1;
      for (const slot of foe.moves) {
        const mv = slot && ctx.move(slot.id);
        if (!mv) continue;
        // Status moves read as 0 here, which is what Platinum does too: a
        // sleep move only gets named if there is nothing with power on the set.
        const p = mv.power || 0;
        if (p > power) { power = p; worst = mv; }
      }
      if (worst) ctx.say(`${ctx.name}'s Forewarn sensed ${worst.name}!`);
    },
  },

  Stall: {
    describe: 'Always moves last, whatever its Speed.',
    movesLast: true,
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
  Pickup: 'no post-battle item pickup',
  'Cute Charm': 'no infatuation status',
  Oblivious: 'no infatuation status',

  Forecast: 'rewriting a Pokémon\u2019s own types mid-battle is a mechanic this engine does not have',

  // Single battles only, so a redirect has nothing to redirect from.
  'Lightning Rod': 'redirection only matters in double battles',
  'Storm Drain': 'redirection only matters in double battles',

  // Faithful to Platinum: these do nothing there either, or need a
  // mechanic this engine does not have.
  Sturdy: 'in Platinum, Sturdy only blocks one-hit-KO moves, and this game has none',
  Stench: 'in Platinum, Stench has no in-battle effect',
  'Suction Cups': 'nothing in this game forces a switch',
  Unburden: 'nothing in this game knocks a held item loose mid-battle',
  'Magnet Pull': 'no switch-trapping; both trainers may always switch freely',
  'Arena Trap': 'no switch-trapping; both trainers may always switch freely',
  'Shadow Tag': 'no switch-trapping; both trainers may always switch freely',
  'Wonder Guard': 'no species in this Pokédex has it',
  Truant: 'turn-skipping would desync a link battle against a peer that resolved it differently',

  // Arrived with the National Dex. Each of these needs a mechanic this
  // engine does not have, or does nothing in Platinum either.
  Illuminate: 'in Platinum, Illuminate only raises the wild encounter rate, and has no effect in a battle',
  Plus: 'the partner bonus only exists in double battles, and this game has none',
  Minus: 'the partner bonus only exists in double battles, and this game has none',
  'Color Change': 'rewriting a Pokémon\u2019s own types mid-battle is a mechanic this engine does not have',
  Multitype: 'Arceus changes type by held Plate, and no Plate exists in this game',
  Gluttony: 'a pinch berry is already eaten at half health here, which is what Gluttony does',
  Normalize: 'move types are read from the move table and never rewritten',
  'Slow Start': 'no multi-turn entry counter survives the switch-in event',
  Frisk: 'nothing shows the foe’s held item',
  Scrappy: 'no Normal-versus-Ghost immunity override in the type chart',
  Reckless: 'recoil moves are already the strongest thing in the table',
  'Iron Fist': 'punch flags are carried but nothing reads them yet',
  Steadfast_: '',
};
delete INERT_ABILITIES.Steadfast_;

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
  if (a.physicalMultiplier && move.cls === 'physical') m *= a.physicalMultiplier;
  if (a.moveMultiplier) m *= a.moveMultiplier(move);
  // Flash Fire's stored charge lives on the side, not the Pokémon, so it
  // clears when the Pokémon leaves the field — same as the real thing.
  if (side && side.volatile.flashFire && move.type === 'Fire') m *= 1.5;
  return m;
}


/**
 * The defender's ability as the attacker sees it. Mold Breaker is the one
 * ability that reaches across the field, so every defender-facing query goes
 * through here rather than calling abilityOf directly.
 */
function seenAbility(target, attacker) {
  const a = abilityOf(attacker);
  if (a && a.ignoresAbility) return null;
  return abilityOf(target);
}

export function ignoresAbility(mon) {
  const a = abilityOf(mon);
  return !!(a && a.ignoresAbility);
}

/** Battle Armor and Shell Armor: the roll still happens, the crit does not. */
export function blocksCrit(target, attacker) {
  const a = seenAbility(target, attacker);
  return !!(a && a.noCrit);
}

export function critBonus(user) {
  const a = abilityOf(user);
  return (a && a.critBonus) || 0;
}

export function critMultiplier(user) {
  const a = abilityOf(user);
  return (a && a.critMultiplier) || 2;
}

export function stabMultiplier(user) {
  const a = abilityOf(user);
  return (a && a.stab) || 1.5;
}

/** Everything the defender's ability does to one incoming damaging move. */
export function damageTakenMultiplier(target, attacker, move, eff) {
  const a = seenAbility(target, attacker);
  if (!a) return 1;
  let m = 1;
  if (a.takes && a.takes[move.type]) m *= a.takes[move.type];
  if (a.reduceSuperEffective && eff > 1) m *= a.reduceSuperEffective;
  return m;
}

/** Tinted Lens is the attacker's side of the same calculation. */
export function damageDealtMultiplier(user, eff) {
  const a = abilityOf(user);
  if (a && a.tintedLens && eff > 0 && eff < 1) return 2;
  return 1;
}

export function defenseStatMultiplier(mon, key) {
  const a = abilityOf(mon);
  return (a && a.defenseStat) ? a.defenseStat(mon, key) : 1;
}

export function accuracyMultiplier(user, move) {
  const a = abilityOf(user);
  return (a && a.accuracyMultiplier) ? a.accuracyMultiplier(move) : 1;
}

/** No Guard works from either side of the field. */
/** Tangled Feet: the confusion the ability reads lives on the side, not the mon. */
export function evasionMultiplier(target, side) {
  const a = abilityOf(target);
  if (!a || !a.evasionWhenConfused) return 1;
  return side && side.volatile && side.volatile.confusion > 0 ? a.evasionWhenConfused : 1;
}

export function neverMisses(user, target) {
  const ua = abilityOf(user);
  const ta = abilityOf(target);
  return !!((ua && ua.neverMisses) || (ta && ta.neverMisses));
}

export function blocksMove(target, attacker, move) {
  const a = seenAbility(target, attacker);
  if (!a || !a.blocksFlag) return false;
  return (move.flags || []).includes(a.blocksFlag);
}

export function immuneToStatus(mon, status, attacker) {
  const a = seenAbility(mon, attacker);
  return !!(a && a.statusImmunity && a.statusImmunity.includes(status));
}

export function sleepTicks(mon) {
  const a = abilityOf(mon);
  return (a && a.sleepTicks) || 1;
}

export function secondaryChance(user, chance) {
  const a = abilityOf(user);
  const m = (a && a.secondaryMultiplier) || 1;
  return Math.min(1, chance * m);
}

export function ignoresBoosts(mon) {
  const a = abilityOf(mon);
  return !!(a && a.ignoresBoosts);
}

export function noIndirectDamage(mon) {
  const a = abilityOf(mon);
  return !!(a && a.noIndirectDamage);
}

export function usesHeldItem(mon) {
  const a = abilityOf(mon);
  return !(a && a.noHeldItem);
}

export function drainBackfires(target, attacker) {
  const a = seenAbility(target, attacker);
  return !!(a && a.liquidOoze);
}

export function versusMultiplier(user, target) {
  const a = abilityOf(user);
  return (a && a.versus) ? a.versus(user, target) : 1;
}

/**
 * The defender's ability answering a contact move: Static and friends, Rough
 * Skin, Aftermath. Returns the effect for the engine to apply, so this file
 * still never touches HP or status directly except through ctx.
 *
 * The chance roll is made by the caller from `battle.rng`, and is made whether
 * or not an ability is present — same reason as everywhere else in this file.
 */
export function contactReaction(target, attacker, rolled) {
  const a = seenAbility(target, attacker);
  if (!a) return null;
  if (a.contactDamage) return { kind: 'damage', fraction: a.contactDamage, name: target.ability };
  if (!rolled) return null;
  if (a.contactStatus) return { kind: 'status', status: a.contactStatus, name: target.ability };
  if (a.contactSpore) return { kind: 'spore', name: target.ability };
  return null;
}

export function contactChanceOf(target, attacker) {
  const a = seenAbility(target, attacker);
  return (a && a.contactChance) || 0;
}

export function aftermathFraction(target, attacker) {
  const a = seenAbility(target, attacker);
  return (a && a.aftermath) || 0;
}

/**
 * Speed, and what a status problem does to it.
 *
 * Two answers in one place because they are the same question: Quick Feet
 * both adds its own bonus and cancels paralysis's cut, and a caller that got
 * one without the other would be wrong in one direction or the other.
 */
export function statusSpeedMultiplier(mon) {
  const a = abilityOf(mon);
  if (!a || !mon || !mon.status) return 1;
  return a.speedWhenStatus || 1;
}

export function ignoresParalysisDrop(mon) {
  const a = abilityOf(mon);
  return !!(a && a.ignoresParalysisDrop);
}

/** Poison Heal: the fraction of max HP poison restores instead of removing. */
export function healsFromPoison(mon) {
  const a = abilityOf(mon);
  return (a && a.healsFromPoison) || 0;
}

/** Skill Link: a multi-strike move stops rolling and simply hits the maximum. */
export function alwaysMaxHits(mon) {
  const a = abilityOf(mon);
  return !!(a && a.maxMultiHit);
}

/** Stall: sorts below everything else at the same move priority. */
export function movesLast(mon) {
  const a = abilityOf(mon);
  return !!(a && a.movesLast);
}

/** Anger Point, when a critical hit lands on this Pokemon. */
export function onCritTaken(battle, sideIdx, ctx, mon) {
  const a = abilityOf(mon);
  if (a && a.onCritTaken) a.onCritTaken(battle, sideIdx, ctx, mon);
}

// ---- weather ---------------------------------------------------------------

export function summonsWeather(mon) {
  const a = abilityOf(mon);
  return (a && a.summons) || null;
}

export function suppressesWeather(mon) {
  const a = abilityOf(mon);
  return !!(a && a.suppressesWeather);
}

/** Everything an ability does to a stat because of the sky. */
export function weatherStatMultiplier(mon, key, sky) {
  const a = abilityOf(mon);
  if (!a || !sky) return 1;
  let m = 1;
  if (key === 'spe' && a.speedIn && a.speedIn[sky]) m *= a.speedIn[sky];
  if (key === 'spa' && a.specialIn && a.specialIn[sky]) m *= a.specialIn[sky];
  if (key === 'atk' && a.attackIn && a.attackIn[sky]) m *= a.attackIn[sky];
  if (key === 'spd' && a.defenseIn && a.defenseIn[sky]) m *= a.defenseIn[sky];
  return m;
}

export function weatherEvasion(mon, sky) {
  const a = abilityOf(mon);
  return (a && a.evadeIn && a.evadeIn[sky]) || 1;
}

/** Sand Veil and Snow Cloak are also simply not bothered by their own storm. */
export function shrugsOffWeather(mon, sky) {
  const a = abilityOf(mon);
  return !!(a && a.weatherProof && a.weatherProof.includes(sky));
}

export function weatherHealing(mon, sky) {
  const a = abilityOf(mon);
  return (a && a.healsIn && a.healsIn[sky]) || 0;
}

export function curesStatusIn(mon, sky) {
  const a = abilityOf(mon);
  return !!(a && a.curesIn && a.curesIn.includes(sky));
}

export function statusProofIn(mon, sky) {
  const a = abilityOf(mon);
  return !!(a && a.statusProofIn && a.statusProofIn.includes(sky));
}

/** Solar Power's own cost: the sun powers it up and wears it down. */
export function burnsInWeather(mon, sky) {
  const a = abilityOf(mon);
  return !!(a && a.burnsIn && a.burnsIn.includes(sky));
}

export { isFainted, typesOf };
