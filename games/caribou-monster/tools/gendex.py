#!/usr/bin/env python3
"""Generates the Pokédex from the veekun dataset.

The roster used to be 54 species written by hand, which is fine for a prototype
and wrong for a game about collecting things. This builds the real extended
Sinnoh dex — the 210 entries Platinum ships with — from the public veekun CSV
dump: real base stats, types, abilities, catch rates, growth curves, gender
ratios, evolutions and Platinum's own level-up learnsets.

Everything it emits is data the engine already understands. Where the engine
cannot honour something (a move effect it has no implementation for) the move
still exists with its real name, type, power and accuracy, and the effect is
dropped rather than faked — and the count is reported at the end.

Run:  python3 tools/gendex.py /tmp/dex
"""
import csv, os, sys, json
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/dex'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data')

PLATINUM_VG = 9        # version group
PLATINUM_VER = 14      # version, for flavour text
SINNOH_DEX = 6         # extended-sinnoh: the 210-entry Platinum dex
EN = 9                 # language

def rows(name):
    with open(os.path.join(SRC, name + '.csv'), newline='', encoding='utf8') as f:
        return list(csv.DictReader(f))

def num(v, d=0):
    try: return int(v)
    except (TypeError, ValueError):
        try: return float(v)
        except (TypeError, ValueError): return d

# ---- load -------------------------------------------------------------------
species   = {int(r['id']): r for r in rows('pokemon_species')}
pokemon   = {int(r['id']): r for r in rows('pokemon')}
types_by  = {int(r['id']): r['identifier'] for r in rows('types')}
shapes    = {int(r['id']): r['identifier'] for r in rows('pokemon_shapes')}
colors    = {int(r['id']): r['identifier'] for r in rows('pokemon_colors')}
growths   = {1: 'slow', 2: 'mediumFast', 3: 'fast', 4: 'mediumSlow', 5: 'slow', 6: 'fast'}

dexnums = {}
for r in rows('pokemon_dex_numbers'):
    if int(r['pokedex_id']) == SINNOH_DEX:
        dexnums[int(r['species_id'])] = int(r['pokedex_number'])

# default form only: pokemon.id == species.id for the base form
default_mon = {}
for pid, r in pokemon.items():
    if r.get('is_default') == '1':
        default_mon[int(r['species_id'])] = pid

stats = defaultdict(dict)
STAT_KEY = {1: 'hp', 2: 'atk', 3: 'def', 4: 'spa', 5: 'spd', 6: 'spe'}
for r in rows('pokemon_stats'):
    k = STAT_KEY.get(int(r['stat_id']))
    if k: stats[int(r['pokemon_id'])][k] = int(r['base_stat'])

ptypes = defaultdict(list)
for r in rows('pokemon_types'):
    ptypes[int(r['pokemon_id'])].append((int(r['slot']), types_by[int(r['type_id'])]))

ability_names = {}
for r in rows('ability_names'):
    if int(r['local_language_id']) == EN:
        ability_names[int(r['ability_id'])] = r['name']

pabilities = defaultdict(list)
for r in rows('pokemon_abilities'):
    # Gen 4 has no hidden abilities.
    if r['is_hidden'] == '1': continue
    pabilities[int(r['pokemon_id'])].append((int(r['slot']), ability_names.get(int(r['ability_id']), '')))

sp_names = {}
for r in rows('pokemon_species_names'):
    if int(r['local_language_id']) == EN:
        sp_names[int(r['pokemon_species_id'])] = r['name']

# Platinum's own dex entries, falling back to any gen-4 text.
flavour = {}
for r in rows('pokemon_species_flavor_text'):
    if int(r['language_id']) != EN: continue
    sid = int(r['species_id'])
    v = int(r['version_id'])
    if v == PLATINUM_VER or (sid not in flavour and v in (12, 13)):
        flavour[sid] = ' '.join(r['flavor_text'].split())

triggers = {int(r['id']): r['identifier'] for r in rows('evolution_triggers')}
evolutions = defaultdict(list)
for r in rows('pokemon_evolution'):
    evolutions[int(r['evolved_species_id'])].append(r)

move_names = {}
for r in rows('move_names'):
    if int(r['local_language_id']) == EN:
        move_names[int(r['move_id'])] = r['name']

moves = {int(r['id']): r for r in rows('moves')}
meta = {int(r['move_id']): r for r in rows('move_meta')}
ailments = {int(r['id']): r['identifier'] for r in rows('move_meta_ailments')}
mstats = defaultdict(list)
for r in rows('move_meta_stat_changes'):
    mstats[int(r['move_id'])].append((int(r['stat_id']), int(r['change'])))

# The only flags anything downstream cares about. Emitting the other fifteen
# would be data nobody reads.
KEEP_FLAGS = {'contact', 'sound', 'punch', 'bite', 'pulse', 'powder'}

move_flags = {int(r['id']): r['identifier'] for r in rows('move_flags')}
flags_of = defaultdict(list)
for r in rows('move_flag_map'):
    f = move_flags.get(int(r['move_flag_id']))
    if f in KEEP_FLAGS:
        flags_of[int(r['move_id'])].append(f)

# Platinum level-up learnsets, plus every other move a Platinum Pokemon can
# legally know (TM/HM/tutor/egg) so the move table covers what a player can
# actually put on a team, not only what levelling gives them.
learn = defaultdict(list)
machine_learners = defaultdict(set)
platinum_moves = set()
with open(os.path.join(SRC, 'pokemon_moves.csv'), newline='', encoding='utf8') as f:
    for r in csv.DictReader(f):
        if r['version_group_id'] != str(PLATINUM_VG): continue
        platinum_moves.add(int(r['move_id']))
        if r['pokemon_move_method_id'] == '4':     # 4 = machine (TM/HM)
            machine_learners[int(r['pokemon_id'])].add(int(r['move_id']))
        if r['pokemon_move_method_id'] != '1':        # 1 = level-up
            continue
        learn[int(r['pokemon_id'])].append((int(r['level']) or 1, int(r['move_id'])))

# TM/HM numbers, so the Pokedex and any future TM item can name them.
machine_of = {}
for r in rows('machines'):
    if int(r['version_group_id']) != PLATINUM_VG: continue
    machine_of[int(r['move_id'])] = int(r['machine_number'])


# ---- variable-power moves ---------------------------------------------------
# veekun stores no power for these because the number is computed at use time.
# Emitting them with power 0 would silently turn them into no-op status moves,
# so each one either names the rule battle/engine.js implements, or is dropped
# from the table entirely. A move nobody can learn beats a move that lies.
VARIABLE = {
    'sonicboom': 'fixed20', 'dragonrage': 'fixed40',
    'seismictoss': 'level', 'nightshade': 'level', 'psywave': 'psywave',
    'superfang': 'halfHp', 'endeavor': 'endeavor',
    'lowkick': 'weight', 'grassknot': 'weight',
    'magnitude': 'magnitude',
    'return': 'friendship', 'frustration': 'frustrationRev',
    'flail': 'lowHp', 'reversal': 'lowHp',
    'gyroball': 'gyroball',
    'wringout': 'targetHp', 'crushgrip': 'targetHp',
    'punishment': 'punishment',
    'guillotine': 'ohko', 'horndrill': 'ohko', 'fissure': 'ohko', 'sheercold': 'ohko',
    'counter': 'counter', 'mirrorcoat': 'mirrorcoat', 'metalburst': 'metalburst',
}
# Depend on stockpiling, held items or party state this engine does not model.
DROP_MOVES = {'bide', 'present', 'naturalgift', 'fling', 'trumpcard', 'spitup', 'beatup'}

# ---- move translation -------------------------------------------------------
AILMENT_TO_STATUS = {
    'paralysis': 'PAR', 'sleep': 'SLP', 'freeze': 'FRZ', 'burn': 'BRN',
    'poison': 'PSN', 'confusion': 'CNF',
}
# Abilities introduced after generation 4 cannot appear in a Platinum dex.
LATE_ABILITIES = {ability_names[int(r['id'])] for r in rows('abilities')
                  if int(r['generation_id']) > 4 and int(r['id']) in ability_names}
ABILITY_OVERRIDE = {
    'gengar': ['Levitate'],      # Cursed Body is generation 7; in Platinum it levitates
}

STAT_ID = {1: 'hp', 2: 'atk', 3: 'def', 4: 'spa', 5: 'spd', 6: 'spe', 7: 'acc', 8: 'eva'}
CLS = {1: 'status', 2: 'physical', 3: 'special'}

def slug(name):
    return ''.join(ch for ch in name.lower() if ch.isalnum())

unsupported = defaultdict(int)

def move_effect(mid):
    """Maps veekun's move metadata onto the effects this engine implements."""
    m = meta.get(mid)
    if not m: return None, None
    ail = ailments.get(num(m['meta_ailment_id']), 'none')
    ail_chance = num(m['ailment_chance'])
    flinch = num(m['flinch_chance'])
    drain = num(m['drain'])
    healing = num(m['healing'])
    minh, maxh = num(m['min_hits']), num(m['max_hits'])
    crit = num(m['crit_rate'])
    changes = mstats.get(mid, [])
    stat_chance = num(m['stat_chance'])

    if minh and maxh and maxh > 1:
        return {'kind': 'multihit', 'min': minh, 'max': maxh}, crit
    if drain > 0:
        return {'kind': 'drain', 'fraction': drain / 100.0}, crit
    if drain < 0:
        return {'kind': 'recoil', 'fraction': abs(drain) / 100.0}, crit
    if healing > 0:
        return {'kind': 'heal', 'fraction': healing / 100.0}, crit
    if ail in AILMENT_TO_STATUS:
        fx = {'kind': 'status', 'status': AILMENT_TO_STATUS[ail]}
        if ail_chance: fx['chance'] = ail_chance / 100.0
        if ail == 'poison' and mid in (188, 474):    # sludge bomb / toxic-like
            pass
        return fx, crit
    if ail == 'none' and flinch:
        return {'kind': 'status', 'status': 'flinch', 'chance': flinch / 100.0}, crit
    if changes:
        good = [(STAT_ID[s], c) for s, c in changes if s in STAT_ID and STAT_ID[s] != 'hp']
        if len(good) == 1:
            stat, chg = good[0]
            target = 'self' if chg > 0 else 'foe'
            fx = {'kind': 'stat', 'target': target, 'stat': stat, 'stages': chg}
            if stat_chance: fx['chance'] = stat_chance / 100.0
            return fx, crit
        if len(good) > 1:
            target = 'self' if good[0][1] > 0 else 'foe'
            return {'kind': 'multistat', 'target': target,
                    'stats': [g[0] for g in good], 'stages': good[0][1]}, crit
    if ail not in ('none', 'unknown'):
        unsupported[ail] += 1
    return None, crit

# ---- art assignment ---------------------------------------------------------
SHAPE_ARCH = {
    'ball': 'blob', 'squiggle': 'serpent', 'fish': 'fish', 'arms': 'blob',
    'blob': 'blob', 'upright': 'biped', 'legs': 'biped', 'quadruped': 'quadruped',
    'wings': 'bird', 'tentacles': 'blob', 'heads': 'serpent', 'humanoid': 'biped',
    'bug-wings': 'bug', 'armor': 'golem',
}
COLOR_HEX = {
    'black': '#4a4a58', 'blue': '#4a78c8', 'brown': '#a87848', 'gray': '#98a0a8',
    'green': '#68b850', 'pink': '#f090b8', 'purple': '#9868c0', 'red': '#d85848',
    'white': '#e8e8f0', 'yellow': '#f0c840',
}
TYPE_FEATURE = {
    'grass': 'leaf', 'fire': 'flameTail', 'water': 'fins', 'electric': 'spikes',
    'flying': 'wingsFeather', 'bug': 'wingsBug', 'rock': 'armour', 'steel': 'armour',
    'ground': 'spikes', 'psychic': 'halo', 'ghost': 'halo', 'dragon': 'horn',
    'dark': 'earsPointed', 'ice': 'crest', 'fighting': 'collar', 'poison': 'gem',
    'fairy': 'bloom', 'normal': 'earsRound',
}
# A few the shape data gets wrong for our purposes, or that deserve better.
ARCH_OVERRIDE = {
    'pikachu': 'rodent', 'raichu': 'rodent', 'pachirisu': 'rodent', 'bidoof': 'rodent',
    'bibarel': 'rodent', 'rattata': 'rodent', 'raticate': 'rodent', 'sentret': 'rodent',
    'furret': 'rodent', 'buneary': 'rodent', 'lopunny': 'biped', 'plusle': 'rodent',
    'minun': 'rodent', 'zubat': 'bat', 'golbat': 'bat', 'crobat': 'bat',
    'gligar': 'bat', 'gliscor': 'bat', 'stantler': 'stag', 'girafarig': 'stag',
    'shinx': 'quadruped', 'luxio': 'quadruped', 'luxray': 'quadruped',
    'geodude': 'golem', 'graveler': 'golem', 'golem': 'golem', 'onix': 'serpent',
    'steelix': 'serpent', 'bronzor': 'blob', 'bronzong': 'golem',
    'magikarp': 'fish', 'gyarados': 'serpent', 'dialga': 'quadruped',
    'palkia': 'biped', 'giratina': 'serpent', 'garchomp': 'biped',
}

def art_for(sid, ident, tps, shape, color, base_total):
    arch = ARCH_OVERRIDE.get(ident) or SHAPE_ARCH.get(shape, 'blob')
    primary = COLOR_HEX.get(color, '#98a0a8')
    feats = []
    for t in tps:
        f = TYPE_FEATURE.get(t)
        if f and f not in feats: feats.append(f)
    if arch in ('bird', 'bat') and 'wingsFeather' not in feats and 'wingsBug' not in feats:
        feats.append('wingsFeather')
    if arch == 'stag': feats.append('antlers')
    if arch == 'fish' and 'fins' not in feats: feats.append('fins')
    if species[sid]['is_legendary'] == '1' or species[sid]['is_mythical'] == '1':
        if 'gem' not in feats: feats.append('gem')
    feats = feats[:3]
    # Bigger, later-stage Pokémon read as bulkier.
    scale = min(1.35, max(0.85, base_total / 420.0))
    return {
        'key': ident, 'arch': arch, 'features': feats,
        'build': {'bodyW': round(0.26 * scale, 3), 'bodyH': round(0.21 * scale, 3)},
        'colors': {
            'primary': primary,
            'secondary': COLOR_HEX.get(color, '#98a0a8'),
            'accent': primary,
            'belly': '#e8e0c8',
        },
    }

# ---- build ------------------------------------------------------------------
wanted = sorted(dexnums.items(), key=lambda kv: kv[1])
out_species = []
used_moves = set()

for sid, _dexno in wanted:
    sp = species[sid]
    pid = default_mon.get(sid)
    if not pid: continue
    ident = sp['identifier']
    tps = [t for _, t in sorted(ptypes[pid])]
    st = stats[pid]
    # veekun carries current-generation abilities. Two of our 210 were given
    # a post-Platinum ability, so drop anything introduced after generation 4
    # and fall back to what the species actually had in Platinum.
    abil = [a for _, a in sorted(pabilities[pid]) if a not in LATE_ABILITIES]
    abil = ABILITY_OVERRIDE.get(ident, abil) or ['Pressure']
    total = sum(st.values())

    gr = int(sp['gender_rate'])
    gender = -1 if gr < 0 else (8 - gr) / 8.0     # chance of being male

    evos = []
    for child_id, recs in evolutions.items():
        if species.get(child_id, {}).get('evolves_from_species_id') != str(sid):
            continue
        for r in recs:
            trig = triggers.get(num(r['evolution_trigger_id']), '')
            if trig == 'level-up' and r['minimum_level']:
                evos.append({'method': 'level', 'level': int(r['minimum_level']), 'into': child_id})
            elif trig == 'level-up' and r['minimum_happiness']:
                evos.append({'method': 'friendship', 'friendship': int(r['minimum_happiness']), 'into': child_id})
            elif trig == 'use-item' and r['trigger_item_id']:
                evos.append({'method': 'stone', 'stone': num(r['trigger_item_id']), 'into': child_id})
            elif trig == 'trade':
                evos.append({'method': 'trade', 'into': child_id})
            elif r['minimum_level']:
                evos.append({'method': 'level', 'level': int(r['minimum_level']), 'into': child_id})
    # Deduplicate and keep the cheapest path.
    seen = set(); uniq = []
    for e in evos:
        if e['into'] in seen: continue
        seen.add(e['into']); uniq.append(e)

    ls = sorted(set(learn.get(pid, [])))
    if not ls:
        ls = [(1, 33)]        # Tackle, so nothing is ever moveless
    lset = []
    for lv, mid in ls:
        if mid not in moves: continue
        mslug = slug(move_names.get(mid, moves[mid]['identifier']))
        if mslug in DROP_MOVES: continue
        used_moves.add(mid)
        lset.append([lv, mslug])
    # Dropping an unmodellable move must never leave a species that knows
    # nothing at level 1 — it would be sent out with no move at all.
    if not lset:
        lset = [[1, 'tackle']]
    elif not any(lv <= 1 for lv, _ in lset):
        lset.insert(0, [1, lset[0][1]])

    mon = pokemon[pid]
    out_species.append({
        'id': sid,
        'name': sp_names.get(sid, ident.title()),
        'types': [t.title() for t in tps],
        'base': st,
        'catchRate': int(sp['capture_rate']),
        'baseExp': num(mon.get('base_experience'), 60) or 60,
        'growth': growths.get(int(sp['growth_rate_id']), 'mediumFast'),
        'genderRatio': gender,
        'height': num(mon['height']) / 10.0,
        'weight': num(mon['weight']) / 10.0,
        'abilities': abil,
        'legendary': sp['is_legendary'] == '1' or sp['is_mythical'] == '1',
        'dex': flavour.get(sid, 'Little is known about this Pokémon.'),
        'learnset': lset,
        'tms': sorted(machine_of[m] for m in machine_learners.get(pid, ()) if m in machine_of),
        'evolutions': uniq,
        'art': art_for(sid, ident, tps, shapes[int(sp['shape_id'])] if sp['shape_id'] else 'blob',
                       colors[int(sp['color_id'])], total),
    })

# Any evolution pointing outside the dex would be a dangling reference.
ids = {s['id'] for s in out_species}
for s in out_species:
    s['evolutions'] = [e for e in s['evolutions'] if e['into'] in ids]

# ---- emit moves -------------------------------------------------------------
move_out = []
for mid in sorted(used_moves | platinum_moves):
    m = moves[mid]
    name = move_names.get(mid, m['identifier'].replace('-', ' ').title())
    if slug(name) in DROP_MOVES: continue
    fx, crit = move_effect(mid)
    move_out.append({
        'id': slug(name),
        'name': name,
        'type': types_by[int(m['type_id'])].title(),
        'power': num(m['power']),
        'acc': num(m['accuracy'], 0) or 0,
        'pp': num(m['pp'], 10) or 10,
        'cls': CLS.get(num(m['damage_class_id']), 'status'),
        'priority': num(m['priority']),
        'crit': 1 if (crit or 0) > 0 else 0,
        'effect': fx,
        'flags': sorted(flags_of.get(mid, [])),
        'tm': machine_of.get(mid, -1),
    })
    if move_out[-1]['id'] in VARIABLE:
        move_out[-1]['variable'] = VARIABLE[move_out[-1]['id']]

for m in move_out:
    if m['power'] == 0 and m['cls'] != 'status' and 'variable' not in m:
        raise SystemExit(f"{m['id']} deals damage but has no power and no rule")

# Slugs must be unique — two moves colliding would silently overwrite one.
by_slug = {}
for m in move_out:
    if m['id'] in by_slug:
        raise SystemExit(f"slug collision: {m['id']} ({m['name']} vs {by_slug[m['id']]['name']})")
    by_slug[m['id']] = m

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, '_gen_species.json'), 'w', encoding='utf8') as f:
    json.dump(out_species, f, ensure_ascii=False)
with open(os.path.join(OUT, '_gen_moves.json'), 'w', encoding='utf8') as f:
    json.dump(move_out, f, ensure_ascii=False)

print(f'species: {len(out_species)}')
print(f'moves:   {len(move_out)}')
print(f'learnset entries: {sum(len(s["learnset"]) for s in out_species)}')
print(f'with effects: {sum(1 for m in move_out if m["effect"])}')
if unsupported:
    top = sorted(unsupported.items(), key=lambda kv: -kv[1])[:10]
    print('effects this engine has no implementation for (dropped, not faked):')
    for k, v in top: print(f'   {k}: {v}')
