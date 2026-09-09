// Per-player inventory. Every player owns their own instance — nothing here
// is global, which is what keeps two co-op players' bags separate.
import { getItem, POCKETS } from '../data/items.js';

export function createInventory(seed = {}) {
  const inv = { items: {}, money: seed.money != null ? seed.money : 3000 };
  for (const [id, qty] of Object.entries(seed.items || {})) inv.items[id] = qty;
  return inv;
}

export function addItem(inv, id, qty = 1) {
  if (!getItem(id)) return false;
  inv.items[id] = (inv.items[id] || 0) + qty;
  return true;
}

export function removeItem(inv, id, qty = 1) {
  const have = inv.items[id] || 0;
  if (have < qty) return false;
  if (have === qty) delete inv.items[id];
  else inv.items[id] = have - qty;
  return true;
}

export function countItem(inv, id) { return inv.items[id] || 0; }
export function hasItem(inv, id) { return (inv.items[id] || 0) > 0; }

export function pocketContents(inv, pocket) {
  return Object.entries(inv.items)
    .map(([id, qty]) => ({ id, qty, item: getItem(id) }))
    .filter((e) => e.item && e.item.pocket === pocket)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

export function nonEmptyPockets(inv) {
  return POCKETS.filter((p) => pocketContents(inv, p).length > 0);
}

export function spend(inv, amount) {
  if (inv.money < amount) return false;
  inv.money -= amount;
  return true;
}

export function earn(inv, amount) {
  inv.money = Math.min(999999, inv.money + amount);
}

export function sellPrice(id) {
  const it = getItem(id);
  if (!it) return 0;
  if (it.sell) return it.sell;
  return Math.floor((it.price || 0) / 2);
}

// Items that may be used from the bag during a battle.
export function battleUsable(inv) {
  const out = [];
  for (const pocket of ['Poké Balls', 'Medicine', 'Items']) {
    for (const e of pocketContents(inv, pocket)) {
      const u = e.item.use;
      if (!u) continue;
      if (['ball', 'heal', 'revive', 'cure', 'pp'].includes(u.kind)) out.push(e);
    }
  }
  return out;
}

/**
 * The one place money is turned into text. The press desk and the UI both
 * print prize money, and they have to agree — an ad-hoc currency symbol in
 * one of them rendered as "?" because the font has no glyph for it.
 */
export function formatMoney(n) {
  return `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
