// Move data. The battle engine reads only these fields — adding a move is
// data, never code.
//
//  power    0 for status moves
//  acc      0 = never misses
//  pp       base PP
//  cls      'physical' | 'special' | 'status' (defaults from the type)
//  effect   { kind, ... } handled by battle/effects.js
//  priority default 0
//  flags    ['contact', 'sound', 'punch', ...]

import { damageClassOf } from './types.js';

const M = (id, name, type, power, acc, pp, extra = {}) => ({
  id, name, type, power, acc, pp,
  cls: extra.cls || (power === 0 ? 'status' : damageClassOf(type)),
  priority: extra.priority || 0,
  crit: extra.crit || 0,
  effect: extra.effect || null,
  flags: extra.flags || [],
  desc: extra.desc || '',
});

export const MOVES = {};
const add = (...args) => { const m = M(...args); MOVES[m.id] = m; return m; };

// ---- Normal ----------------------------------------------------------
add('tackle', 'Tackle', 'Normal', 40, 100, 35, { flags: ['contact'], desc: 'A full-body charge.' });
add('scratch', 'Scratch', 'Normal', 40, 100, 35, { flags: ['contact'], desc: 'Rakes the foe with claws.' });
add('pound', 'Pound', 'Normal', 40, 100, 35, { flags: ['contact'], desc: 'A blow with forelegs or tail.' });
add('quickattack', 'Quick Attack', 'Normal', 40, 100, 30, { priority: 1, flags: ['contact'], desc: 'Always strikes first.' });
add('headbutt', 'Headbutt', 'Normal', 70, 100, 15, { flags: ['contact'], effect: { kind: 'status', status: 'flinch', chance: 0.3 }, desc: 'May make the foe flinch.' });
add('bodyslam', 'Body Slam', 'Normal', 85, 100, 15, { flags: ['contact'], effect: { kind: 'status', status: 'PAR', chance: 0.3 }, desc: 'May paralyse the foe.' });
add('slam', 'Slam', 'Normal', 80, 75, 20, { flags: ['contact'], desc: 'A heavy tail slam.' });
add('takedown', 'Take Down', 'Normal', 90, 85, 20, { flags: ['contact'], effect: { kind: 'recoil', fraction: 0.25 }, desc: 'A reckless charge that also hurts the user.' });
add('doubleedge', 'Double-Edge', 'Normal', 120, 100, 15, { flags: ['contact'], effect: { kind: 'recoil', fraction: 0.33 }, desc: 'A life-risking tackle.' });
add('hyperfang', 'Hyper Fang', 'Normal', 80, 90, 15, { flags: ['contact'], crit: 1, desc: 'Sharp fangs. High critical-hit ratio.' });
add('furyswipes', 'Fury Swipes', 'Normal', 18, 80, 15, { flags: ['contact'], effect: { kind: 'multihit', min: 2, max: 5 }, desc: 'Strikes 2 to 5 times.' });
add('growl', 'Growl', 'Normal', 0, 100, 40, { effect: { kind: 'stat', target: 'foe', stat: 'atk', stages: -1 }, flags: ['sound'], desc: 'Lowers the foe’s Attack.' });
add('tailwhip', 'Tail Whip', 'Normal', 0, 100, 30, { effect: { kind: 'stat', target: 'foe', stat: 'def', stages: -1 }, desc: 'Lowers the foe’s Defense.' });
add('leer', 'Leer', 'Normal', 0, 100, 30, { effect: { kind: 'stat', target: 'foe', stat: 'def', stages: -1 }, desc: 'A frightening glare that lowers Defense.' });
add('harden', 'Harden', 'Normal', 0, 0, 30, { effect: { kind: 'stat', target: 'self', stat: 'def', stages: 1 }, desc: 'Stiffens the body to raise Defense.' });
add('defensecurl', 'Defense Curl', 'Normal', 0, 0, 40, { effect: { kind: 'stat', target: 'self', stat: 'def', stages: 1 }, desc: 'Curls up to raise Defense.' });
add('growth', 'Growth', 'Normal', 0, 0, 20, { effect: { kind: 'stat', target: 'self', stat: 'spa', stages: 1 }, desc: 'Forces the body to grow, raising Sp. Atk.' });
add('swordsdance', 'Swords Dance', 'Normal', 0, 0, 20, { effect: { kind: 'stat', target: 'self', stat: 'atk', stages: 2 }, desc: 'A frenetic dance. Sharply raises Attack.' });
add('screech', 'Screech', 'Normal', 0, 85, 40, { effect: { kind: 'stat', target: 'foe', stat: 'def', stages: -2 }, flags: ['sound'], desc: 'Sharply lowers the foe’s Defense.' });
add('doubleteam', 'Double Team', 'Normal', 0, 0, 15, { effect: { kind: 'stat', target: 'self', stat: 'eva', stages: 1 }, desc: 'Creates illusory copies to raise evasiveness.' });
add('sandattack', 'Sand Attack', 'Ground', 0, 100, 15, { effect: { kind: 'stat', target: 'foe', stat: 'acc', stages: -1 }, desc: 'Hurls sand to lower accuracy.' });
add('supersonic', 'Supersonic', 'Normal', 0, 55, 20, { effect: { kind: 'status', status: 'CNF', chance: 1 }, flags: ['sound'], desc: 'Odd sound waves that confuse the foe.' });
add('recover', 'Recover', 'Normal', 0, 0, 10, { effect: { kind: 'heal', fraction: 0.5 }, desc: 'Restores up to half of max HP.' });
add('rest', 'Rest', 'Psychic', 0, 0, 10, { effect: { kind: 'rest' }, desc: 'Sleeps to fully restore HP and status.' });
add('helpinghand', 'Helping Hand', 'Normal', 0, 0, 20, { priority: 5, effect: { kind: 'stat', target: 'self', stat: 'spa', stages: 1 }, desc: 'Boosts the user’s spirit.' });

// ---- Fire ------------------------------------------------------------
add('ember', 'Ember', 'Fire', 40, 100, 25, { effect: { kind: 'status', status: 'BRN', chance: 0.1 }, desc: 'A small flame. May burn.' });
add('flamewheel', 'Flame Wheel', 'Fire', 60, 100, 25, { flags: ['contact'], effect: { kind: 'status', status: 'BRN', chance: 0.1 }, desc: 'A fiery charge. May burn.' });
add('firefang', 'Fire Fang', 'Fire', 65, 95, 15, { flags: ['contact'], effect: { kind: 'status', status: 'BRN', chance: 0.1 }, desc: 'Bites with flaming fangs.' });
add('flamethrower', 'Flamethrower', 'Fire', 90, 100, 15, { effect: { kind: 'status', status: 'BRN', chance: 0.1 }, desc: 'A searing jet of flame.' });
add('fireblast', 'Fire Blast', 'Fire', 110, 85, 5, { effect: { kind: 'status', status: 'BRN', chance: 0.1 }, desc: 'An all-consuming blast.' });
add('flareblitz', 'Flare Blitz', 'Fire', 120, 100, 15, { flags: ['contact'], effect: { kind: 'recoil', fraction: 0.33 }, desc: 'A cloaked-in-fire charge that hurts the user.' });
add('willowisp', 'Will-O-Wisp', 'Fire', 0, 85, 15, { effect: { kind: 'status', status: 'BRN', chance: 1 }, desc: 'Sinister flames that burn the foe.' });

// ---- Water -----------------------------------------------------------
add('watergun', 'Water Gun', 'Water', 40, 100, 25, { desc: 'Squirts water to attack.' });
add('bubble', 'Bubble', 'Water', 40, 100, 30, { effect: { kind: 'stat', target: 'foe', stat: 'spe', stages: -1, chance: 0.1 }, desc: 'A spray of bubbles. May lower Speed.' });
add('bubblebeam', 'Bubble Beam', 'Water', 65, 100, 20, { effect: { kind: 'stat', target: 'foe', stat: 'spe', stages: -1, chance: 0.1 }, desc: 'A forceful spray. May lower Speed.' });
add('aquajet', 'Aqua Jet', 'Water', 40, 100, 20, { priority: 1, flags: ['contact'], desc: 'Strikes first at blinding speed.' });
add('brine', 'Brine', 'Water', 65, 100, 10, { desc: 'Doubles in power if the foe is weakened.' });
add('surf', 'Surf', 'Water', 90, 100, 15, { desc: 'A huge wave crashes down.' });
add('hydropump', 'Hydro Pump', 'Water', 110, 80, 5, { desc: 'A tremendous blast of water.' });
add('waterpulse', 'Water Pulse', 'Water', 60, 100, 20, { effect: { kind: 'status', status: 'CNF', chance: 0.2 }, desc: 'An ultrasonic pulse. May confuse.' });

// ---- Grass -----------------------------------------------------------
add('absorb', 'Absorb', 'Grass', 20, 100, 25, { effect: { kind: 'drain', fraction: 0.5 }, desc: 'Drains half the damage dealt.' });
add('megadrain', 'Mega Drain', 'Grass', 40, 100, 15, { effect: { kind: 'drain', fraction: 0.5 }, desc: 'Drains half the damage dealt.' });
add('gigadrain', 'Giga Drain', 'Grass', 75, 100, 10, { effect: { kind: 'drain', fraction: 0.5 }, desc: 'Drains half the damage dealt.' });
add('razorleaf', 'Razor Leaf', 'Grass', 55, 95, 25, { crit: 1, desc: 'Sharp leaves. High critical-hit ratio.' });
add('magicalleaf', 'Magical Leaf', 'Grass', 60, 0, 20, { desc: 'Glowing leaves that never miss.' });
add('energyball', 'Energy Ball', 'Grass', 90, 100, 10, { effect: { kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 0.1 }, desc: 'A concentrated blast of nature.' });
add('leafstorm', 'Leaf Storm', 'Grass', 130, 90, 5, { effect: { kind: 'stat', target: 'self', stat: 'spa', stages: -2 }, desc: 'A leaf whirlwind. Harshly lowers Sp. Atk.' });
add('woodhammer', 'Wood Hammer', 'Grass', 120, 100, 15, { flags: ['contact'], effect: { kind: 'recoil', fraction: 0.33 }, desc: 'Slams with the body. Hurts the user.' });
add('synthesis', 'Synthesis', 'Grass', 0, 0, 5, { effect: { kind: 'heal', fraction: 0.5 }, desc: 'Restores HP using sunlight.' });
add('sleeppowder', 'Sleep Powder', 'Grass', 0, 75, 15, { effect: { kind: 'status', status: 'SLP', chance: 1 }, flags: ['powder'], desc: 'Scatters a sleep-inducing dust.' });
add('stunspore', 'Stun Spore', 'Grass', 0, 75, 30, { effect: { kind: 'status', status: 'PAR', chance: 1 }, flags: ['powder'], desc: 'Scatters a paralysing powder.' });
add('poisonpowder', 'Poison Powder', 'Poison', 0, 75, 35, { effect: { kind: 'status', status: 'PSN', chance: 1 }, flags: ['powder'], desc: 'Scatters a poisonous dust.' });
add('worryseed', 'Worry Seed', 'Grass', 0, 100, 10, { effect: { kind: 'stat', target: 'foe', stat: 'spa', stages: -1 }, desc: 'Plants a seed of doubt.' });

// ---- Electric --------------------------------------------------------
add('thundershock', 'Thunder Shock', 'Electric', 40, 100, 30, { effect: { kind: 'status', status: 'PAR', chance: 0.1 }, desc: 'A jolt that may paralyse.' });
add('spark', 'Spark', 'Electric', 65, 100, 20, { flags: ['contact'], effect: { kind: 'status', status: 'PAR', chance: 0.3 }, desc: 'An electrified charge. May paralyse.' });
add('thunderbolt', 'Thunderbolt', 'Electric', 90, 100, 15, { effect: { kind: 'status', status: 'PAR', chance: 0.1 }, desc: 'A strong jolt. May paralyse.' });
add('discharge', 'Discharge', 'Electric', 80, 100, 15, { effect: { kind: 'status', status: 'PAR', chance: 0.3 }, desc: 'A flare of electricity. May paralyse.' });
add('thunderwave', 'Thunder Wave', 'Electric', 0, 90, 20, { effect: { kind: 'status', status: 'PAR', chance: 1 }, desc: 'A weak jolt that paralyses.' });
add('charge', 'Charge', 'Electric', 0, 0, 20, { effect: { kind: 'stat', target: 'self', stat: 'spd', stages: 1 }, desc: 'Charges power and raises Sp. Def.' });

// ---- Ice -------------------------------------------------------------
add('iceshard', 'Ice Shard', 'Ice', 40, 100, 30, { priority: 1, desc: 'Hurls a chunk of ice. Strikes first.' });
add('icywind', 'Icy Wind', 'Ice', 55, 95, 15, { effect: { kind: 'stat', target: 'foe', stat: 'spe', stages: -1, chance: 1 }, desc: 'A chilling gust that lowers Speed.' });
add('icefang', 'Ice Fang', 'Ice', 65, 95, 15, { flags: ['contact'], effect: { kind: 'status', status: 'FRZ', chance: 0.1 }, desc: 'Bites with icy fangs. May freeze.' });
add('icebeam', 'Ice Beam', 'Ice', 90, 100, 10, { effect: { kind: 'status', status: 'FRZ', chance: 0.1 }, desc: 'A freezing beam. May freeze.' });
add('blizzard', 'Blizzard', 'Ice', 110, 70, 5, { effect: { kind: 'status', status: 'FRZ', chance: 0.1 }, desc: 'A howling snowstorm. May freeze.' });
add('auroraveil', 'Aurora Beam', 'Ice', 65, 100, 20, { effect: { kind: 'stat', target: 'foe', stat: 'atk', stages: -1, chance: 0.1 }, desc: 'A rainbow beam. May lower Attack.' });

// ---- Fighting --------------------------------------------------------
add('karatechop', 'Karate Chop', 'Fighting', 50, 100, 25, { crit: 1, flags: ['contact'], desc: 'High critical-hit ratio.' });
add('lowkick', 'Low Kick', 'Fighting', 55, 100, 20, { flags: ['contact'], desc: 'A kick to the legs.' });
add('brickbreak', 'Brick Break', 'Fighting', 75, 100, 15, { flags: ['contact'], desc: 'A swift chop.' });
add('machpunch', 'Mach Punch', 'Fighting', 40, 100, 30, { priority: 1, flags: ['contact', 'punch'], desc: 'A blindingly fast punch.' });
add('closecombat', 'Close Combat', 'Fighting', 120, 100, 5, { flags: ['contact'], effect: { kind: 'stat', target: 'self', stat: 'def', stages: -1 }, desc: 'An all-out attack that lowers Defense.' });
add('focusenergy', 'Focus Energy', 'Normal', 0, 0, 30, { effect: { kind: 'focus' }, desc: 'Raises the critical-hit ratio.' });
add('revenge', 'Revenge', 'Fighting', 60, 100, 10, { flags: ['contact'], desc: 'Hits back with doubled force.' });

// ---- Poison ----------------------------------------------------------
add('poisonsting', 'Poison Sting', 'Poison', 15, 100, 35, { effect: { kind: 'status', status: 'PSN', chance: 0.3 }, desc: 'A toxic barb. May poison.' });
add('sludge', 'Sludge', 'Poison', 65, 100, 20, { effect: { kind: 'status', status: 'PSN', chance: 0.3 }, desc: 'Hurls filth. May poison.' });
add('sludgebomb', 'Sludge Bomb', 'Poison', 90, 100, 10, { effect: { kind: 'status', status: 'PSN', chance: 0.3 }, desc: 'Hurls sludge. May poison.' });
add('toxic', 'Toxic', 'Poison', 0, 90, 10, { effect: { kind: 'status', status: 'PSN', chance: 1, bad: true }, desc: 'Badly poisons the foe.' });
add('acid', 'Acid', 'Poison', 40, 100, 30, { effect: { kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 0.1 }, desc: 'Sprays acid. May lower Sp. Def.' });

// ---- Ground ----------------------------------------------------------
add('mudslap', 'Mud-Slap', 'Ground', 20, 100, 10, { effect: { kind: 'stat', target: 'foe', stat: 'acc', stages: -1, chance: 1 }, desc: 'Hurls mud and reduces accuracy.' });
add('magnitude', 'Magnitude', 'Ground', 70, 100, 30, { desc: 'A quake of random intensity.' });
add('bulldoze', 'Bulldoze', 'Ground', 60, 100, 20, { effect: { kind: 'stat', target: 'foe', stat: 'spe', stages: -1, chance: 1 }, desc: 'Stomps the ground and lowers Speed.' });
add('earthquake', 'Earthquake', 'Ground', 100, 100, 10, { desc: 'A devastating tremor.' });

// ---- Flying ----------------------------------------------------------
add('gust', 'Gust', 'Flying', 40, 100, 35, { desc: 'Whips up a gust of wind.' });
add('peck', 'Peck', 'Flying', 35, 100, 35, { flags: ['contact'], desc: 'Jabs with a beak.' });
add('wingattack', 'Wing Attack', 'Flying', 60, 100, 35, { flags: ['contact'], desc: 'Strikes with spread wings.' });
add('aerialace', 'Aerial Ace', 'Flying', 60, 0, 20, { flags: ['contact'], desc: 'An unavoidable speed strike.' });
add('airslash', 'Air Slash', 'Flying', 75, 95, 15, { effect: { kind: 'status', status: 'flinch', chance: 0.3 }, desc: 'Slices with a blade of air. May flinch.' });
add('bravebird', 'Brave Bird', 'Flying', 120, 100, 15, { flags: ['contact'], effect: { kind: 'recoil', fraction: 0.33 }, desc: 'A reckless dive that hurts the user.' });
add('roost', 'Roost', 'Flying', 0, 0, 10, { effect: { kind: 'heal', fraction: 0.5 }, desc: 'Lands and rests to restore HP.' });

// ---- Psychic ---------------------------------------------------------
add('confusion', 'Confusion', 'Psychic', 50, 100, 25, { effect: { kind: 'status', status: 'CNF', chance: 0.1 }, desc: 'A telekinetic hit. May confuse.' });
add('psybeam', 'Psybeam', 'Psychic', 65, 100, 20, { effect: { kind: 'status', status: 'CNF', chance: 0.1 }, desc: 'A peculiar ray. May confuse.' });
add('psychic', 'Psychic', 'Psychic', 90, 100, 10, { effect: { kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 0.1 }, desc: 'A strong telekinetic force.' });
add('calmmind', 'Calm Mind', 'Psychic', 0, 0, 20, { effect: { kind: 'multistat', target: 'self', stats: [['spa', 1], ['spd', 1]] }, desc: 'Raises Sp. Atk and Sp. Def.' });
add('hypnosis', 'Hypnosis', 'Psychic', 0, 60, 20, { effect: { kind: 'status', status: 'SLP', chance: 1 }, desc: 'Hypnotic suggestion that induces sleep.' });
add('teleport', 'Teleport', 'Psychic', 0, 0, 20, { priority: -6, effect: { kind: 'flee' }, desc: 'Flees from wild battles.' });
add('futuresight', 'Future Sight', 'Psychic', 80, 100, 10, { desc: 'A chunk of psychic energy strikes later.' });

// ---- Bug -------------------------------------------------------------
add('bugbite', 'Bug Bite', 'Bug', 60, 100, 20, { flags: ['contact'], desc: 'Bites with sharp mandibles.' });
add('furycutter', 'Fury Cutter', 'Bug', 40, 95, 20, { flags: ['contact'], desc: 'Grows stronger each time it hits.' });
add('strugglebug', 'Struggle Bug', 'Bug', 50, 100, 20, { effect: { kind: 'stat', target: 'foe', stat: 'spa', stages: -1, chance: 1 }, desc: 'Resists and lowers the foe’s Sp. Atk.' });
add('xscissor', 'X-Scissor', 'Bug', 80, 100, 15, { flags: ['contact'], desc: 'Slashes in a crossing motion.' });
add('silverwind', 'Silver Wind', 'Bug', 60, 100, 5, { desc: 'A powder-filled wind.' });

// ---- Rock ------------------------------------------------------------
add('rockthrow', 'Rock Throw', 'Rock', 50, 90, 15, { desc: 'Hurls a small rock.' });
add('rocktomb', 'Rock Tomb', 'Rock', 60, 95, 15, { effect: { kind: 'stat', target: 'foe', stat: 'spe', stages: -1, chance: 1 }, desc: 'Blocks the foe with rocks and lowers Speed.' });
add('rockslide', 'Rock Slide', 'Rock', 75, 90, 10, { effect: { kind: 'status', status: 'flinch', chance: 0.3 }, desc: 'Large boulders. May flinch.' });
add('stoneedge', 'Stone Edge', 'Rock', 100, 80, 5, { crit: 1, desc: 'Sharp stones. High critical-hit ratio.' });
add('rockpolish', 'Rock Polish', 'Rock', 0, 0, 20, { effect: { kind: 'stat', target: 'self', stat: 'spe', stages: 2 }, desc: 'Polishes the body to sharply raise Speed.' });

// ---- Ghost / Dark ----------------------------------------------------
add('astonish', 'Astonish', 'Ghost', 30, 100, 15, { flags: ['contact'], effect: { kind: 'status', status: 'flinch', chance: 0.3 }, desc: 'A sudden shout. May flinch.' });
add('shadowsneak', 'Shadow Sneak', 'Ghost', 40, 100, 30, { priority: 1, flags: ['contact'], desc: 'Strikes first from the shadows.' });
add('shadowball', 'Shadow Ball', 'Ghost', 80, 100, 15, { effect: { kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 0.2 }, desc: 'Hurls a shadowy blob.' });
add('bite', 'Bite', 'Dark', 60, 100, 25, { flags: ['contact'], effect: { kind: 'status', status: 'flinch', chance: 0.3 }, desc: 'Bites with sharp fangs. May flinch.' });
add('crunch', 'Crunch', 'Dark', 80, 100, 15, { flags: ['contact'], effect: { kind: 'stat', target: 'foe', stat: 'def', stages: -1, chance: 0.2 }, desc: 'Crunches with sharp fangs.' });
add('nightslash', 'Night Slash', 'Dark', 70, 100, 15, { crit: 1, flags: ['contact'], desc: 'A ruthless slash. High critical-hit ratio.' });
add('taunt', 'Taunt', 'Dark', 0, 100, 20, { effect: { kind: 'stat', target: 'foe', stat: 'spa', stages: -1 }, desc: 'Enrages the foe.' });

// ---- Dragon / Steel --------------------------------------------------
add('dragonbreath', 'Dragon Breath', 'Dragon', 60, 100, 20, { effect: { kind: 'status', status: 'PAR', chance: 0.3 }, desc: 'A shock wave. May paralyse.' });
add('dragonclaw', 'Dragon Claw', 'Dragon', 80, 100, 15, { flags: ['contact'], desc: 'Slashes with huge claws.' });
add('metalclaw', 'Metal Claw', 'Steel', 50, 95, 35, { flags: ['contact'], effect: { kind: 'stat', target: 'self', stat: 'atk', stages: 1, chance: 0.1 }, desc: 'Steel claws. May raise Attack.' });
add('irontail', 'Iron Tail', 'Steel', 100, 75, 15, { flags: ['contact'], effect: { kind: 'stat', target: 'foe', stat: 'def', stages: -1, chance: 0.3 }, desc: 'A hard tail slam. May lower Defense.' });
add('flashcannon', 'Flash Cannon', 'Steel', 80, 100, 10, { effect: { kind: 'stat', target: 'foe', stat: 'spd', stages: -1, chance: 0.1 }, desc: 'A blast of light.' });
add('irondefense', 'Iron Defense', 'Steel', 0, 0, 15, { effect: { kind: 'stat', target: 'self', stat: 'def', stages: 2 }, desc: 'Hardens to sharply raise Defense.' });

// Fallback when a monster has no usable move.
add('struggle', 'Struggle', 'Normal', 50, 0, 1, { flags: ['contact'], effect: { kind: 'recoil', fraction: 0.25 }, desc: 'Used only when out of PP.' });

export function getMove(id) {
  return MOVES[id] || MOVES.tackle;
}

export const MOVE_IDS = Object.keys(MOVES);
