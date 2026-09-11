#!/usr/bin/env python3
"""Fetch the DS-era Platinum sprites for every species in the dex.

The game's own artwork is generated at boot from data, which is what let the
Pokedex grow to 210 entries without an art pipeline. It does not look like a
DS game, because it is not a DS game's art. This pulls the real thing.

Four battle sets (front/back, normal/shiny) plus the small menu icon, keyed by
national dex number so nothing downstream has to know a slug.
"""
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'sprites')
BASE = 'https://img.pokemondb.net/sprites'

# The Black/White menu-icon set names a few species by form where the battle
# sets do not. Three of ours land in that gap.
ICON_SLUG = {
    'wormadam': 'wormadam-plant',
    'giratina': 'giratina-origin',
    'rotom': 'rotom-normal',
    'deoxys': 'deoxys-normal',
    'shaymin': 'shaymin-land',
}

SETS = {
    'f': 'platinum/normal',
    'b': 'platinum/back-normal',
    'fs': 'platinum/shiny',
    'bs': 'platinum/back-shiny',
    'i': 'black-white/icon',
}

# pokemondb's slug differs from veekun's identifier for a handful of species.
SLUG_FIX = {
    'mr-mime': 'mr-mime', 'mime-jr': 'mime-jr',
    'nidoran-f': 'nidoran-f', 'nidoran-m': 'nidoran-m',
    'porygon-z': 'porygon-z', 'farfetchd': 'farfetchd',
}


def slug_for(entry):
    key = entry['art']['key']
    return SLUG_FIX.get(key, key)


def fetch(url, dest, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'caribou-monster/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            if not data.startswith(b'\x89PNG'):
                return None
            with open(dest, 'wb') as f:
                f.write(data)
            return len(data)
        except Exception as err:                       # noqa: BLE001 - report and retry
            if attempt == tries - 1:
                print(f'  MISS {url}  ({err})', file=sys.stderr)
                return None
            time.sleep(1 + attempt)
    return None


def main():
    species = json.load(open(os.path.join(ROOT, 'src', 'data', '_gen_species.json'), encoding='utf8'))
    for name in SETS:
        os.makedirs(os.path.join(OUT, name), exist_ok=True)

    # One job per image, already-downloaded ones filtered out first, so a
    # re-run after a patched slug only fetches what is actually missing.
    # 493 species is 2465 images; serially that is a quarter of an hour of
    # waiting on one connection at a time.
    jobs = []
    have = 0
    for entry in species:
        slug = slug_for(entry)
        for name, path in SETS.items():
            dest = os.path.join(OUT, name, f"{entry['id']}.png")
            if os.path.exists(dest) and os.path.getsize(dest) > 0:
                have += os.path.getsize(dest)
                continue
            use = ICON_SLUG.get(slug, slug) if name == 'i' else slug
            jobs.append((f'{BASE}/{path}/{use}.png', dest, f"{entry['name']}/{name}"))

    total = have
    missing = []
    done = 0
    if jobs:
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = {pool.submit(fetch, url, dest): tag for url, dest, tag in jobs}
            for fut in as_completed(futures):
                n = fut.result()
                if n is None:
                    missing.append(futures[fut])
                else:
                    total += n
                done += 1
                if done % 100 == 0:
                    print(f'  {done}/{len(jobs)}  {total // 1024} KB', flush=True)

    print(f'{len(species)} species, {total // 1024} KB on disk')
    if missing:
        missing.sort()
        print(f'{len(missing)} missing: {", ".join(missing[:40])}')
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
