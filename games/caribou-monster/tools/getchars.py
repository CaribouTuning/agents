#!/usr/bin/env python3
"""Cut the DS overworld character sprites out of the rip sheets.

The game drew its people procedurally — a palette and a 16x20 template — which
is why a new NPC cost a line of data instead of an artist. It also meant every
person in the world was the same person in a different jumper. These are
Platinum's own 32x32 overworld sprites.

Three sheet layouts are involved:

  col9   one character per 32px column, nine rows:
         down-stand, up-stand, side-stand, up-1, up-2, side-1, down-1,
         down-2, side-2. There is no right-facing art; it is the side art
         mirrored, which is what the DS does too.
  grid4  the player characters, four rows of four at a 34px pitch:
         a row per direction, frames [stand, step, stand, other step].

Everything is cut into one atlas: a row per look, twelve 32x32 frames
(down/up/left/right x three), which is the shape the renderer wants.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'assets', 'chars')
ATLAS = os.path.join(SHEETS, '_atlas.png')
META = os.path.join(SHEETS, '_atlas.json')

CELL = 32
DIRS = ['down', 'up', 'left', 'right']

# col9 row indices per direction, and which three make a walk cycle.
COL9 = {'down': [0, 6, 7], 'up': [1, 3, 4], 'side': [2, 5, 8]}
GRID4_ROW = {'down': 0, 'up': 1, 'left': 2, 'right': 3}
GRID4_FRAMES = [0, 1, 3]

# Blocks of characters inside each sheet: (file, x0, y0, rows-per-character,
# columns, bands). A "band" is a further block of `rows` stacked below.
BLOCKS = {
    'npc':    ('npcs.png',    17,   97, 9, 17, 4),
    'other':  ('npcs.png',    17, 1561, 9, 16, 1),
    'leader': ('leaders.png', 65,  113, 9,  8, 1),
}

# look -> where its art comes from.
#   ('grid4', file)             a player-character sheet
#   ('col9', block, index)      a column in one of the blocks above
LOOKS = {
    'matthew':    ('grid4', 'lucas.png'),
    'sammy':      ('grid4', 'dawn.png'),
    'rivalBoy':   ('grid4', 'barry.png'),
    'rivalGirl':  ('col9', 'npc', 16),

    'youngster':  ('col9', 'npc', 5),
    'lass':       ('col9', 'npc', 10),
    'bugCatcher': ('col9', 'npc', 19),
    'hiker':      ('col9', 'npc', 40),
    'worker':     ('col9', 'npc', 45),
    'sailor':     ('col9', 'npc', 39),
    'scientist':  ('col9', 'npc', 43),
    'professor':  ('col9', 'npc', 61),
    'nurse':      ('col9', 'other', 5),
    'clerk':      ('col9', 'other', 10),
    'mom':        ('col9', 'npc', 23),
    'oldMan':     ('col9', 'npc', 49),
    'kid':        ('col9', 'npc', 36),
    'grunt':      ('col9', 'other', 1),
    'gruntF':     ('col9', 'other', 2),
    'boss':       ('col9', 'other', 0),
    'leaderRock': ('col9', 'leader', 0),
}


# Sammy has reddish-blonde hair, and Dawn's sprite does not. Her hair is one
# flat tone at this size — everything else in the sprite is the hat, the scarf
# or the outline — so it is a single swap, applied to every frame.
RECOLOUR = {
    'sammy': {(56, 64, 80): (200, 118, 58)},
}


def recolour(cell, table):
    px = cell.load()
    for y in range(cell.height):
        for x in range(cell.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in table:
                px[x, y] = (*table[(r, g, b)], a)
    return cell


def sheet(name):
    return Image.open(os.path.join(SHEETS, name)).convert('RGBA')


def dekey(cell):
    """Make the sheet's backdrop transparent.

    Every rip keys on a flat colour, but which colour differs per sheet and
    even per character column, so it is read from the cell's own corner rather
    than hardcoded. The player sheets use two: a cell backdrop inside a wider
    page colour.
    """
    px = cell.load()
    keys = {px[0, 0][:3], px[cell.width - 1, 0][:3]}
    for y in range(cell.height):
        for x in range(cell.width):
            if px[x, y][:3] in keys:
                px[x, y] = (0, 0, 0, 0)
    return cell


def frames_col9(img, x0, y0, rows, cols, bands, index):
    band, col = divmod(index, cols)
    if band >= bands:
        raise SystemExit(f'character {index} is outside the block')
    bx = x0 + col * CELL
    by = y0 + band * rows * CELL
    got = {}
    for facing, idx in COL9.items():
        got[facing] = [dekey(img.crop((bx, by + i * CELL, bx + CELL, by + i * CELL + CELL)))
                       for i in idx]
    out = {'down': got['down'], 'up': got['up'], 'left': got['side'],
           'right': [f.transpose(Image.FLIP_LEFT_RIGHT) for f in got['side']]}
    return out


def frames_grid4(img):
    out = {}
    for facing, row in GRID4_ROW.items():
        out[facing] = [dekey(img.crop((2 + c * 34, 2 + row * 34, 2 + c * 34 + CELL, 2 + row * 34 + CELL)))
                       for c in GRID4_FRAMES]
    return out


def main():
    names = list(LOOKS)
    atlas = Image.new('RGBA', (12 * CELL, len(names) * CELL), (0, 0, 0, 0))
    meta = {'cell': CELL, 'dirs': DIRS, 'rows': {}}
    for row, look in enumerate(names):
        spec = LOOKS[look]
        if spec[0] == 'grid4':
            got = frames_grid4(sheet(spec[1]))
        else:
            _, block, index = spec
            f, x0, y0, rows, cols, bands = BLOCKS[block]
            got = frames_col9(sheet(f), x0, y0, rows, cols, bands, index)
        table = RECOLOUR.get(look)
        for d, facing in enumerate(DIRS):
            for i, frame in enumerate(got[facing]):
                if table:
                    frame = recolour(frame, table)
                atlas.paste(frame, ((d * 3 + i) * CELL, row * CELL))
        meta['rows'][look] = row

    # Palette + alpha keeps the file small; FASTOCTREE is the only quantiser
    # that handles RGBA, and these sprites use few enough colours that it is
    # lossless in practice.
    atlas = atlas.quantize(colors=255, method=Image.FASTOCTREE)
    atlas.save(ATLAS, optimize=True)
    json.dump(meta, open(META, 'w'), indent=1)
    print(f'{len(names)} looks -> {ATLAS} ({os.path.getsize(ATLAS) // 1024} KB) {atlas.size}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
