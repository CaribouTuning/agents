// What is buried down there.
//
// Platinum's Underground has three kinds of thing in it: spheres, which are
// the Underground's own currency; fossils and relics, which are worth money;
// and things you would otherwise have to buy. Keeping all three means a dig
// can be worth doing for three different reasons on three different days.
//
// The tables are keyed by how deep in the tunnels the wall is, so walking
// further is the thing that changes what you find — not luck alone.

/** `item` is an id in data/items.js; `shape` is one of dig.js's SHAPES. */
const T = (item, shape, weight) => ({ item, shape, weight });

export const TABLES = {
  // Near the entrance: spheres, shards, and the odd useful thing.
  shallow: [
    T('redsphere', 'small', 22),
    T('bluesphere', 'small', 20),
    T('greensphere', 'small', 18),
    T('redshard', 'small', 12),
    T('blueshard', 'small', 12),
    T('heartscale', 'small', 8),
    T('revive', 'bar', 5),
    T('hardstone', 'bar', 3),
  ],
  // Deeper: the fossils, the stones, and the things worth real money.
  deep: [
    T('redsphere', 'small', 14),
    T('bluesphere', 'small', 14),
    T('palesphere', 'small', 10),
    T('greenshard', 'small', 10),
    T('yellowshard', 'small', 10),
    T('heartscale', 'small', 8),
    T('starpiece', 'bar', 7),
    T('skullfossil', 'big', 6),
    T('armorfossil', 'big', 6),
    T('oddkeystone', 'tee', 5),
    T('firestone', 'ell', 4),
    T('waterstone', 'ell', 4),
    T('thunderstone', 'ell', 4),
    T('leafstone', 'ell', 4),
    T('maxrevive', 'tee', 3),
  ],
};

export function tableFor(depth) {
  return depth === 'deep' ? TABLES.deep : TABLES.shallow;
}

/**
 * The spheres. They are the Underground's money: nothing else buys a base
 * decoration, and nothing else is bought with them.
 */
export const SPHERES = ['redsphere', 'bluesphere', 'greensphere', 'palesphere'];

export function isSphere(id) { return SPHERES.includes(id); }

/** How many spheres of any colour the player is carrying. */
export function sphereCount(inventory) {
  return SPHERES.reduce((n, id) => n + (inventory.items[id] || 0), 0);
}
