#!/usr/bin/env python3
"""Write src/data/species.js and src/data/moves.js from the generated dex.

tools/gendex.py turns the veekun CSV dump into _gen_species.json /
_gen_moves.json; this turns those into the two source files the game
actually imports. Keeping the two steps apart means the slow CSV crunch
runs once and the emit can be re-run freely.

The public shape of both modules is unchanged — every consumer (battle
engine, Pokedex UI, sprite generator, save/load) keeps working.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data')

species = json.load(open(os.path.join(DATA, '_gen_species.json'), encoding='utf8'))
moves = json.load(open(os.path.join(DATA, '_gen_moves.json'), encoding='utf8'))

NAMES = {s['name'].upper(): s['name'] for s in species}


def prose(text):
    """Platinum flavour text shouts species names. Our font renders lower
    case, and shouting reads as a bug rather than as style."""
    # Soft hyphens and non-breaking spaces are invisible in the CSV and
    # undrawable in our font.
    text = text.replace('\u00ad', '').replace('\u00a0', ' ').replace('\u2019', '’')
    text = text.replace('POKéMON', 'Pokémon').replace('POKEMON', 'Pokémon')
    text = re.sub(r'\b[A-Z]{2,}\b', lambda m: NAMES.get(m.group(0), m.group(0).title()), text)
    return text.replace("'", '’').replace('\n', ' ').strip()


def js(v):
    """A JS literal, single-quoted, matching the file's existing style."""
    if v is None:
        return 'null'
    if v is True:
        return 'true'
    if v is False:
        return 'false'
    if isinstance(v, float):
        return repr(round(v, 3))
    if isinstance(v, int):
        return str(v)
    if isinstance(v, str):
        return "'" + v.replace('\\', '\\\\').replace("'", "\\'") + "'"
    if isinstance(v, list):
        return '[' + ', '.join(js(x) for x in v) + ']'
    if isinstance(v, dict):
        return '{ ' + ', '.join(f'{k}: {js(x)}' for k, x in v.items()) + ' }'
    raise TypeError(v)


def wrap(prefix, body, indent, width=118):
    """Break a long literal across lines without breaking a token."""
    out, line = [], prefix
    for piece in body:
        if len(line) + len(piece) + 2 > width and line.strip() != prefix.strip():
            out.append(line.rstrip())
            line = indent
        line += piece + ', '
    out.append(line.rstrip().rstrip(','))
    return '\n'.join(out)


# ---- species ---------------------------------------------------------------
lines = ["""// Species data — generated, do not hand-edit.
//
//   tools/gendex.py   veekun CSV dump  ->  _gen_species.json
//   tools/emitdex.py  _gen_species.json -> this file
//
// 210 Pokemon: the extended Sinnoh Pokedex exactly as Platinum ships it,
// with that game's base stats, abilities, catch rates, growth curves,
// level-up learnsets, TM compatibility and evolution methods.
//
// Everything a monster is lives here as plain data. The battle engine, the
// Pokedex and the sprite generator all read from this one table.

const S = (hp, atk, def, spa, spd, spe) => ({ hp, atk, def, spa, spd, spe });

export const GROWTH = {
  fast: (n) => Math.floor(4 * n * n * n / 5),
  mediumFast: (n) => n * n * n,
  mediumSlow: (n) => Math.max(0, Math.floor(1.2 * n ** 3 - 15 * n ** 2 + 100 * n - 140)),
  slow: (n) => Math.floor(5 * n * n * n / 4),
  erratic: (n) => Math.floor(n ** 3 * (100 - n) / 50),
  fluctuating: (n) => Math.floor(n ** 3 * (n / 2 + 32) / 50),
};

const list = ["""]

for s in species:
    b = s['base']
    art = s['art']
    head = (f"  {{ id: {s['id']}, name: {js(s['name'])}, types: {js(s['types'])}, "
            f"base: S({b['hp']}, {b['atk']}, {b['def']}, {b['spa']}, {b['spd']}, {b['spe']}),")
    lines.append(head)
    lines.append(f"    catchRate: {s['catchRate']}, baseExp: {s['baseExp']}, growth: {js(s['growth'])}, "
                 f"genderRatio: {js(s['genderRatio'])}, height: {js(s['height'])}, weight: {js(s['weight'])},")
    lines.append(f"    abilities: {js(s['abilities'])}, legendary: {js(s['legendary'])},")
    lines.append(f"    dex: {js(prose(s['dex']))},")
    lines.append(wrap('    learnset: [', [js(e) for e in s['learnset']], '      ') + '],')
    lines.append(f"    evolutions: {js(s['evolutions'])},")
    lines.append(wrap('    tms: [', [str(n) for n in s['tms']], '      ') + '],')
    lines.append(f"    art: {js(art)} }},")

lines.append('];')
lines.append(r"""
export const SPECIES = {};
for (const s of list) {
  s.art.key = s.art.key || String(s.id);
  s.genderRatio = s.genderRatio === undefined ? 0.5 : s.genderRatio;
  s.baseTotal = Object.values(s.base).reduce((a, b) => a + b, 0);
  SPECIES[s.id] = s;
}

export const SPECIES_LIST = list;
export const DEX_COUNT = list.length;

// Sinnoh order (the order the list is generated in) for Pokedex browsing,
// keyed by national id so save files never store a display position.
export const SINNOH_ORDER = list.map((s) => s.id);
export const SINNOH_NUMBER = {};
list.forEach((s, i) => { SINNOH_NUMBER[s.id] = i + 1; });

export function getSpecies(id) { return SPECIES[id]; }

export function speciesByName(name) {
  const key = String(name).toLowerCase();
  return list.find((s) => s.name.toLowerCase() === key);
}

export function expForLevel(growthKey, level) {
  return GROWTH[growthKey || 'mediumFast'](level);
}

// Natures: +10% to one stat, -10% to another (neutral when they match).
export const NATURES = [
  ['Hardy', null, null], ['Lonely', 'atk', 'def'], ['Brave', 'atk', 'spe'], ['Adamant', 'atk', 'spa'],
  ['Naughty', 'atk', 'spd'], ['Bold', 'def', 'atk'], ['Docile', null, null], ['Relaxed', 'def', 'spe'],
  ['Impish', 'def', 'spa'], ['Lax', 'def', 'spd'], ['Timid', 'spe', 'atk'], ['Hasty', 'spe', 'def'],
  ['Serious', null, null], ['Jolly', 'spe', 'spa'], ['Naive', 'spe', 'spd'], ['Modest', 'spa', 'atk'],
  ['Mild', 'spa', 'def'], ['Quiet', 'spa', 'spe'], ['Bashful', null, null], ['Rash', 'spa', 'spd'],
  ['Calm', 'spd', 'atk'], ['Gentle', 'spd', 'def'], ['Sassy', 'spd', 'spe'], ['Careful', 'spd', 'spa'],
  ['Quirky', null, null],
];

export function natureModifier(natureIndex, stat) {
  const n = NATURES[natureIndex % NATURES.length];
  if (!n || !n[1]) return 1;
  if (n[1] === stat) return 1.1;
  if (n[2] === stat) return 0.9;
  return 1;
}

export function natureName(i) { return NATURES[i % NATURES.length][0]; }""")

open(os.path.join(DATA, 'species.js'), 'w', encoding='utf8').write('\n'.join(lines) + '\n')

# ---- moves -----------------------------------------------------------------
mlines = ["""// Move data — generated, do not hand-edit.
//
//   tools/gendex.py   veekun CSV dump ->  _gen_moves.json
//   tools/emitdex.py  _gen_moves.json ->  this file
//
// Every move obtainable in Platinum, with that game's power, accuracy, PP,
// damage class, priority and crit rate. Secondary effects are mapped onto
// the kinds battle/effects.js actually implements; a move whose effect this
// engine cannot model is emitted as a plain move rather than a fake one, so
// nothing ever claims to do something it does not do.
//
//  power    0 for status moves
//  acc      0 = never misses
//  cls      'physical' | 'special' | 'status'
//  effect   { kind, ... } handled by battle/effects.js
//  tm       Platinum TM/HM number, or -1
//  variable a move whose power is computed at use time; the name of the rule
//           battle/engine.js applies. No move ever ships with power 0 and a
//           damage class but no rule — tools/gendex.py refuses to emit one.

export const MOVES = {};
const add = (m) => { MOVES[m.id] = m; return m; };
"""]

for m in moves:
    d = {
        'id': m['id'], 'name': m['name'], 'type': m['type'], 'power': m['power'],
        'acc': m['acc'], 'pp': m['pp'], 'cls': m['cls'], 'priority': m['priority'],
        'crit': m['crit'], 'effect': m['effect'], 'flags': m['flags'], 'tm': m['tm'],
    }
    if m.get('variable'):
        d['variable'] = m['variable']
    mlines.append('add(' + js(d) + ');')

mlines.append("""
// Fallback when a monster has no usable move. Not a Platinum TM, not
// learnable — the engine reaches for it directly.
add({ id: 'struggle', name: 'Struggle', type: 'Normal', power: 50, acc: 0, pp: 1, cls: 'physical',
  priority: 0, crit: 0, effect: { kind: 'recoil', fraction: 0.25 }, flags: ['contact'], tm: -1 });

export function getMove(id) {
  return MOVES[id] || MOVES.tackle;
}

export const MOVE_IDS = Object.keys(MOVES);""")

open(os.path.join(DATA, 'moves.js'), 'w', encoding='utf8').write('\n'.join(mlines) + '\n')

print(f'species.js  {len(species)} entries')
print(f'moves.js    {len(moves) + 1} entries')
