#!/usr/bin/env python3
"""Embed the downloaded sprites in the bundle.

The whole game is one self-contained HTML file with no external requests, and
that has to stay true — a page that fetches 1050 images from someone else's
CDN is a page that breaks the day the CDN moves, and it would not work offline
on a phone at all. So the PNGs go in as base64, keyed by the same `art.key`
slug every call site already carries.

Palette PNGs of a 32x32 icon or an 80x80 sprite are ~600 bytes each, so the
whole DS-era Pokedex costs well under a megabyte.
"""
import base64
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'sprites')
OUT = os.path.join(ROOT, 'src', 'render', '_gen_sprites.js')
SETS = ['f', 'b', 'fs', 'bs', 'i']


def main():
    species = json.load(open(os.path.join(ROOT, 'src', 'data', '_gen_species.json'), encoding='utf8'))
    rows = []
    total = 0
    missing = 0
    for entry in species:
        slug = entry['art']['key']
        parts = []
        for name in SETS:
            path = os.path.join(SRC, name, f"{entry['id']}.png")
            if not os.path.exists(path):
                missing += 1
                continue
            raw = open(path, 'rb').read()
            total += len(raw)
            parts.append(f"{name}:'{base64.b64encode(raw).decode('ascii')}'")
        if parts:
            rows.append(f"  '{slug}':{{{','.join(parts)}}},")

    header = '''// DS-era sprites — generated, do not hand-edit.
//
//   tools/getsprites.py   pokemondb  -> assets/sprites/
//   tools/packsprites.py  those PNGs -> this file
//
// Keyed by the same `art.key` slug the generated species table already
// carries, so every existing call site reaches these without changing.
//
//   f   80x80 front, normal        b   80x80 back, normal
//   fs  80x80 front, shiny         bs  80x80 back, shiny
//   i   32x32 menu icon
//
// These are Game Freak's sprites, in a private game for two people. Do not
// publish this build anywhere public.

export const SPRITE_SHEETS = {
'''
    with open(OUT, 'w', encoding='utf8') as f:
        f.write(header)
        f.write('\n'.join(rows))
        f.write('\n};\n')

    size = os.path.getsize(OUT)
    print(f'{len(rows)} species, {total // 1024} KB of PNG -> {size // 1024} KB of module')
    if missing:
        print(f'{missing} sprite file(s) missing')
    return 0


if __name__ == '__main__':
    sys.exit(main())
