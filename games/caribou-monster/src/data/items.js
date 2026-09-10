// Item data. The bag, the shop, and battle item use all read this table.
// `use` describes an effect declaratively so no system hardcodes item names.

export const POCKETS = ['Items', 'Medicine', 'Poké Balls', 'TMs', 'Key Items'];

const I = (id, name, pocket, price, use, desc, extra = {}) =>
  ({ id, name, pocket, price, use, desc, ...extra });

export const ITEMS = {};
const add = (...a) => { const it = I(...a); ITEMS[it.id] = it; return it; };

// ---- Poké Balls -------------------------------------------------------
add('pokeball', 'Poké Ball', 'Poké Balls', 200,
  { kind: 'ball', rate: 1 }, 'A device for catching wild Pokémon.');
add('greatball', 'Great Ball', 'Poké Balls', 600,
  { kind: 'ball', rate: 1.5 }, 'A good ball with a higher catch rate than a Poké Ball.');
add('ultraball', 'Ultra Ball', 'Poké Balls', 1200,
  { kind: 'ball', rate: 2 }, 'An ultra-performance ball with a very high catch rate.');
add('netball', 'Net Ball', 'Poké Balls', 1000,
  { kind: 'ball', rate: 1, bonusTypes: ['Bug', 'Water'], bonus: 3 },
  'Works especially well on Bug and Water Pokémon.');

// ---- Medicine ---------------------------------------------------------
add('potion', 'Potion', 'Medicine', 300,
  { kind: 'heal', amount: 20 }, 'Restores 20 HP to one Pokémon.');
add('superpotion', 'Super Potion', 'Medicine', 700,
  { kind: 'heal', amount: 50 }, 'Restores 50 HP to one Pokémon.');
add('hyperpotion', 'Hyper Potion', 'Medicine', 1200,
  { kind: 'heal', amount: 120 }, 'Restores 120 HP to one Pokémon.');
add('maxpotion', 'Max Potion', 'Medicine', 2500,
  { kind: 'heal', amount: 9999 }, 'Fully restores one Pokémon’s HP.');
add('revive', 'Revive', 'Medicine', 1500,
  { kind: 'revive', fraction: 0.5 }, 'Revives a fainted Pokémon with half its HP.');
add('maxrevive', 'Max Revive', 'Medicine', 4000,
  { kind: 'revive', fraction: 1 }, 'Revives a fainted Pokémon with full HP.');
add('antidote', 'Antidote', 'Medicine', 100,
  { kind: 'cure', status: ['PSN'] }, 'Cures a poisoned Pokémon.');
add('parlyzheal', 'Paralyze Heal', 'Medicine', 200,
  { kind: 'cure', status: ['PAR'] }, 'Cures a paralysed Pokémon.');
add('burnheal', 'Burn Heal', 'Medicine', 250,
  { kind: 'cure', status: ['BRN'] }, 'Cures a burned Pokémon.');
add('iceheal', 'Ice Heal', 'Medicine', 250,
  { kind: 'cure', status: ['FRZ'] }, 'Thaws out a frozen Pokémon.');
add('awakening', 'Awakening', 'Medicine', 250,
  { kind: 'cure', status: ['SLP'] }, 'Wakes a sleeping Pokémon.');
add('fullheal', 'Full Heal', 'Medicine', 600,
  { kind: 'cure', status: ['PSN', 'PAR', 'BRN', 'FRZ', 'SLP', 'CNF'] },
  'Cures any status problem.');
add('ether', 'Ether', 'Medicine', 1200,
  { kind: 'pp', amount: 10 }, 'Restores 10 PP to one move.');

// ---- Items ------------------------------------------------------------
add('repel', 'Repel', 'Items', 350,
  { kind: 'repel', steps: 100 }, 'Keeps weak wild Pokémon away for 100 steps.');
add('superrepel', 'Super Repel', 'Items', 500,
  { kind: 'repel', steps: 200 }, 'Keeps weak wild Pokémon away for 200 steps.');
add('escaperope', 'Escape Rope', 'Items', 550,
  { kind: 'escape' }, 'Returns you to the last Pokémon Center you visited.');
add('oranberry', 'Oran Berry', 'Items', 80,
  { kind: 'heal', amount: 10 }, 'A berry that restores 10 HP.', { held: { kind: 'pinch-heal', amount: 10 } });
add('sitrusberry', 'Sitrus Berry', 'Items', 200,
  { kind: 'heal', amount: 30 }, 'A berry that restores 30 HP.', { held: { kind: 'pinch-heal', amount: 30 } });
add('nugget', 'Nugget', 'Items', 0,
  null, 'A nugget of pure gold. It sells for a high price.', { sell: 5000 });
add('stardust', 'Stardust', 'Items', 0,
  null, 'Lovely red sand. It sells for a good price.', { sell: 1000 });

// Evolution stones — the evolution system already supports them, so they
// are here ready for the species that will use them.
add('firestone', 'Fire Stone', 'Items', 2100, { kind: 'stone', stone: 'fire' }, 'A stone that radiates heat.');
add('waterstone', 'Water Stone', 'Items', 2100, { kind: 'stone', stone: 'water' }, 'A stone with a clear blue heart.');
add('thunderstone', 'Thunder Stone', 'Items', 2100, { kind: 'stone', stone: 'thunder' }, 'A stone with a thunderbolt pattern.');
add('leafstone', 'Leaf Stone', 'Items', 2100, { kind: 'stone', stone: 'leaf' }, 'A stone with a leaf pattern.');

// ---- TMs ---------------------------------------------------------------
const tm = (n, moveId, name, price) =>
  add(`tm${String(n).padStart(2, '0')}`, `TM${String(n).padStart(2, '0')} ${name}`, 'TMs', price,
    { kind: 'tm', move: moveId }, `Teaches ${name} to a compatible Pokémon.`, { tmNumber: n, move: moveId });

tm(1, 'rocktomb', 'Rock Tomb', 3000);
tm(2, 'aerialace', 'Aerial Ace', 3000);
tm(3, 'brickbreak', 'Brick Break', 3000);
tm(4, 'thunderwave', 'Thunder Wave', 2000);
tm(5, 'shadowball', 'Shadow Ball', 4000);
tm(6, 'icywind', 'Icy Wind', 3000);
tm(7, 'magnitude', 'Magnitude', 3000);
tm(8, 'doubleteam', 'Double Team', 2000);

// ---- Key items ---------------------------------------------------------
add('runningshoes', 'Running Shoes', 'Key Items', 0, { kind: 'key' },
  'Hold the B button to move at double speed.', { key: true });
add('townmap', 'Town Map', 'Key Items', 0, { kind: 'map' },
  'A map of the whole Sinnoh region.', { key: true });
add('pokedex', 'Pokédex', 'Key Items', 0, { kind: 'dex' },
  'A digital encyclopedia that records every Pokémon you meet.', { key: true });
add('bicycle', 'Bicycle', 'Key Items', 0, { kind: 'bike' },
  'A folding bicycle. Much faster than walking.', { key: true });
add('oldrod', 'Old Rod', 'Key Items', 0, { kind: 'rod' },
  'An old fishing rod. Use it at the water’s edge.', { key: true });
add('auroracharm', 'Aurora Charm', 'Key Items', 0, { kind: 'story' },
  'A cold, faintly glowing charm. It hums near old stone.', { key: true });
add('gymbadge1', 'Coal Badge', 'Key Items', 0, null,
  'Proof of victory over the Oreburgh Gym.', { key: true, badge: 1 });

export function getItem(id) { return ITEMS[id]; }
export const ITEM_IDS = Object.keys(ITEMS);

// Shop stock unlocks with badge count, exactly like the DS games.
export function martStock(badges) {
  const stock = ['pokeball', 'potion', 'antidote', 'parlyzheal', 'escaperope'];
  if (badges >= 1) stock.push('greatball', 'superpotion', 'repel', 'burnheal', 'iceheal', 'awakening');
  if (badges >= 3) stock.push('ultraball', 'hyperpotion', 'revive', 'superrepel');
  if (badges >= 5) stock.push('maxpotion', 'fullheal');
  return stock;
}
