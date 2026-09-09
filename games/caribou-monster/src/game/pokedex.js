// Pokédex records. Two flat sets keep it cheap to update and to serialise.
import { SPECIES_LIST, getSpecies } from '../data/species.js';

export function createDex() { return { seen: {}, caught: {} }; }

export function recordSeen(dex, speciesId) {
  if (dex.seen[speciesId]) return false;
  dex.seen[speciesId] = 1;
  return true;
}

export function recordCaught(dex, speciesId) {
  dex.seen[speciesId] = 1;
  if (dex.caught[speciesId]) return false;
  dex.caught[speciesId] = 1;
  return true;
}

export const seenCount = (dex) => Object.keys(dex.seen).length;
export const caughtCount = (dex) => Object.keys(dex.caught).length;

export function dexEntries(dex) {
  return SPECIES_LIST.map((sp) => ({
    sp,
    seen: !!dex.seen[sp.id],
    caught: !!dex.caught[sp.id],
  }));
}

export function dexEntry(id) { return getSpecies(id); }
