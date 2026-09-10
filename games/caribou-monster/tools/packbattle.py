#!/usr/bin/env python3
"""Embed the battle backdrop and its bases, same reasoning as the sprites."""
import base64
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'battle')
OUT = os.path.join(ROOT, 'src', 'render', '_gen_battle.js')
PARTS = ['field-day', 'base-foe', 'base-player']


def main():
    rows = []
    total = 0
    for name in PARTS:
        path = os.path.join(SRC, f'{name}.png')
        raw = open(path, 'rb').read()
        total += len(raw)
        w, h = Image.open(path).size
        key = name.replace('-', '_')
        rows.append(f"  {key}: {{ w: {w}, h: {h}, png: '{base64.b64encode(raw).decode('ascii')}' }},")

    body = '''// The battle scene — generated, do not hand-edit.
//
//   tools/packbattle.py  assets/battle/*.png -> this file
//
// Platinum's own Field (Day) backdrop and its Grass (Day) bases, at the DS's
// own 256x152. Everything is drawn at native size and pinned to the bottom of
// the screen, so a wider phone sees more sky and more field rather than a
// stretched picture.
//
// These are Game Freak's assets, in a private game for two people. Do not
// publish this build anywhere public.

export const BATTLE_ART = {
'''
    open(OUT, 'w', encoding='utf8').write(body + '\n'.join(rows) + '\n};\n')
    print(f'{len(PARTS)} images, {total // 1024} KB -> {os.path.getsize(OUT) // 1024} KB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
