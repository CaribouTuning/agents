#!/usr/bin/env python3
"""Embed the character atlas in the bundle, same reasoning as the sprites."""
import base64
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS = os.path.join(ROOT, 'assets', 'chars', '_atlas.png')
META = os.path.join(ROOT, 'assets', 'chars', '_atlas.json')
OUT = os.path.join(ROOT, 'src', 'render', '_gen_chars.js')


def main():
    raw = open(ATLAS, 'rb').read()
    meta = json.load(open(META, encoding='utf8'))
    body = f'''// DS overworld characters — generated, do not hand-edit.
//
//   tools/getchars.py   rip sheets -> assets/chars/_atlas.png
//   tools/packchars.py  that atlas -> this file
//
// One row per look, twelve {meta['cell']}x{meta['cell']} frames: down, up, left, right,
// three frames each (stand, step, other step). The feet sit on row 30 of
// every cell, which is what the renderer anchors to.
//
// These are Game Freak's sprites, in a private game for two people. Do not
// publish this build anywhere public.

export const CHAR_CELL = {meta['cell']};
export const CHAR_DIRS = {json.dumps(meta['dirs'])};
export const CHAR_ROWS = {json.dumps(meta['rows'], indent=1)};
export const CHAR_ATLAS = '{base64.b64encode(raw).decode('ascii')}';
'''
    open(OUT, 'w', encoding='utf8').write(body)
    print(f"{len(meta['rows'])} looks, {len(raw) // 1024} KB of PNG -> {os.path.getsize(OUT) // 1024} KB")
    return 0


if __name__ == '__main__':
    sys.exit(main())
