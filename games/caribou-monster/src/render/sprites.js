// Overworld character sprites.
//
// One 16x20 template per facing (down / up / side), painted with a
// per-character palette. Legs are drawn procedurally per walk frame, and a
// dark outline is derived automatically — so a new NPC costs a palette
// entry, not an art asset.
import { makeSurface, paintGrid } from './canvas.js';
import { shade } from './palette.js';
import { drawCharSprite } from './charsprites.js';

export const SPR_W = 16;
export const SPR_H = 20;
export const FOOT_OFFSET = 4;  // pixels the sprite overhangs above its tile

const PAD = 3; // left/right padding around the 10px-wide body

const pad = (rows) => rows.map((r) => '.'.repeat(PAD) + r + '.'.repeat(SPR_W - PAD - r.length));

// Rows 0..14 (head + torso). Rows 15..19 are the procedural legs.
//
// Proportions are deliberately chibi — the head is nine of the fifteen rows.
// A realistic 1:6 figure at sixteen pixels reads as a smudge; the DS games
// use a big head and a short body because at this size the face is the only
// part a player can actually see.
const BODY = {
  down: pad([
    '..HHHHHH..',
    '.HHHHHHHH.',
    'HHHHHHHHHH',
    'HHHHHHHHHH',
    'HSSSSSSSSH',
    'HSEESSEESH',
    'HSSSSSSSSH',
    '.SSSSSSSS.',
    '..SSSSSS..',
    '..CCCCCC..',
    '.CCCCCCCC.',
    'SCCCCCCCCS',
    'SCCCCCCCCS',
    '.CCCCCCCC.',
    '..PPPPPP..',
  ]),
  up: pad([
    '..HHHHHH..',
    '.HHHHHHHH.',
    'HHHHHHHHHH',
    'HHHHHHHHHH',
    'HHHHHHHHHH',
    'HHHHHHHHHH',
    'HHHHHHHHHH',
    '.HHHHHHHH.',
    '..HHHHHH..',
    '..CCCCCC..',
    '.CCCCCCCC.',
    'SCCCCCCCCS',
    'SCCCCCCCCS',
    '.CCCCCCCC.',
    '..PPPPPP..',
  ]),
  side: pad([
    '..HHHHHH..',
    '.HHHHHHHH.',
    '.HHHHHHHH.',
    '.HHHHHHHH.',
    '.HSSSSSHH.',
    '.HESSSSHH.',
    '.HSSSSSHH.',
    '..SSSSSS..',
    '...SSSS...',
    '..CCCCCC..',
    '.CCCCCCCC.',
    '.SCCCCCCC.',
    '.SCCCCCCC.',
    '..CCCCCC..',
    '..PPPPPP..',
  ]),
};

// Long hair adds volume behind the head and over the shoulders.
const LONG_HAIR = {
  down: [[PAD, 5], [PAD, 6], [PAD, 7], [PAD, 8], [PAD, 9],
         [PAD + 9, 5], [PAD + 9, 6], [PAD + 9, 7], [PAD + 9, 8], [PAD + 9, 9]],
  up: [[PAD, 8], [PAD, 9], [PAD, 10], [PAD, 11],
       [PAD + 9, 8], [PAD + 9, 9], [PAD + 9, 10], [PAD + 9, 11],
       [PAD + 1, 9], [PAD + 8, 9]],
  side: [[PAD + 7, 5], [PAD + 8, 5], [PAD + 8, 6], [PAD + 8, 7],
         [PAD + 8, 8], [PAD + 8, 9], [PAD + 7, 9]],
};

// A cap: brim points the way the character faces, and sits on the brow.
const HAT = {
  down: { crown: [[PAD, 0, 10, 4]], brim: [[PAD - 1, 4, 12, 1]] },
  up: { crown: [[PAD, 0, 10, 4]], brim: [[PAD, 4, 10, 1]] },
  side: { crown: [[PAD + 1, 0, 8, 4]], brim: [[PAD - 2, 4, 10, 1]] },
};

function legRects(dir, frame) {
  // [x, y, w, h, isBoot]
  const P = PAD;
  if (dir === 'side') {
    if (frame === 1) return [[P + 2, 15, 3, 3, 0], [P + 1, 18, 4, 2, 1], [P + 5, 15, 3, 2, 0], [P + 6, 17, 4, 2, 1]];
    if (frame === 2) return [[P + 5, 15, 3, 3, 0], [P + 5, 18, 5, 2, 1], [P + 2, 15, 3, 2, 0], [P + 1, 17, 4, 2, 1]];
    return [[P + 3, 15, 3, 4, 0], [P + 2, 19, 5, 1, 1], [P + 5, 15, 3, 4, 0], [P + 5, 19, 5, 1, 1]];
  }
  if (frame === 1) return [[P + 1, 15, 3, 3, 0], [P + 1, 18, 3, 2, 1], [P + 6, 15, 3, 4, 0], [P + 6, 19, 3, 1, 1]];
  if (frame === 2) return [[P + 1, 15, 3, 4, 0], [P + 1, 19, 3, 1, 1], [P + 6, 15, 3, 3, 0], [P + 6, 18, 3, 2, 1]];
  return [[P + 1, 15, 3, 3, 0], [P + 1, 18, 3, 2, 1], [P + 6, 15, 3, 3, 0], [P + 6, 18, 3, 2, 1]];
}

// Adds a 1px dark outline around every opaque pixel. This is the single
// biggest thing that makes procedural sprites read as deliberate pixel art.
function outline(surf, color) {
  const { ctx, w, h } = surf;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) out.push([x, y]);
    }
  }
  ctx.fillStyle = color;
  for (const [x, y] of out) ctx.fillRect(x, y, 1, 1);
}

// A character "look" is pure data.
export function makeLook({ hair = '#4a3020', skin = '#f0c090', shirt = '#4a6fc0',
  pants = '#3a4050', boots = '#5a3a24', eye = '#20283a', hat = null,
  longHair = false, outlineColor = null } = {}) {
  return { hair, skin, shirt, pants, boots, eye, hat, longHair, outlineColor };
}

const sheets = new Map();

// Builds a 3-frames x 3-facings sheet. Right facing is the mirror of left,
// applied at draw time.
export function buildCharSheet(key, look) {
  if (sheets.has(key)) return sheets.get(key);
  const dirs = ['down', 'up', 'side'];
  const surf = makeSurface(SPR_W * 3, SPR_H * 3);
  const pal = {
    H: look.hair, S: look.skin, C: look.shirt, P: look.pants, E: look.eye,
  };

  dirs.forEach((dir, di) => {
    for (let frame = 0; frame < 3; frame++) {
      const ox = frame * SPR_W;
      const oy = di * SPR_H;
      const cell = makeSurface(SPR_W, SPR_H);
      const c = cell.ctx;

      paintGrid(c, BODY[dir], pal, 0, 0, 1);

      if (look.longHair) {
        c.fillStyle = look.hair;
        for (const [x, y] of LONG_HAIR[dir]) c.fillRect(x, y, 1, 1);
      }

      // Legs.
      for (const [x, y, w, hh, isBoot] of legRects(dir, frame)) {
        c.fillStyle = isBoot ? look.boots : look.pants;
        c.fillRect(x, y, w, hh);
      }

      // Shirt shading down the right side gives the sprite volume.
      c.fillStyle = shade(look.shirt, -0.22);
      c.fillRect(PAD + 7, 9, 2, 5);
      c.fillStyle = shade(look.skin, -0.18);
      c.fillRect(PAD + 8, 6, 1, 2);
      // A highlight on the crown, which is most of the sprite now.
      c.fillStyle = shade(look.hair, 0.22);
      c.fillRect(PAD + 2, 1, 3, 1);
      c.fillRect(PAD + 1, 2, 2, 1);

      if (look.hat) {
        const spec = HAT[dir];
        c.fillStyle = look.hat;
        for (const [x, y, w, hh] of spec.crown) c.fillRect(x, y, w, hh);
        c.fillStyle = shade(look.hat, -0.28);
        for (const [x, y, w, hh] of spec.brim) c.fillRect(x, y, w, hh);
      }

      outline(cell, look.outlineColor || shade(look.hair, -0.55));
      surf.ctx.drawImage(cell.canvas, ox, oy);
    }
  });

  sheets.set(key, surf.canvas);
  return surf.canvas;
}

const DIR_ROW = { down: 0, up: 1, left: 2, right: 2 };

// Draws a character. (x, y) is the top-left of the tile the character
// stands on; the sprite is lifted so its feet sit in that tile.
export function drawChar(ctx, key, look, dir, frame, x, y, opts = {}) {
  // The real DS sprite whenever the atlas has this look and has decoded.
  // Everything below is the generated stand-in, which still runs for a look
  // the atlas does not carry and for the frame or two before it decodes.
  if (drawCharSprite(ctx, look.name, dir, frame, x, y, opts.alpha == null ? 1 : opts.alpha)) return;

  const sheet = buildCharSheet(key, look);
  const row = DIR_ROW[dir] ?? 0;
  const sx = (frame % 3) * SPR_W;
  const sy = row * SPR_H;
  const dx = Math.round(x);
  const dy = Math.round(y - FOOT_OFFSET);

  if (opts.alpha != null) { ctx.save(); ctx.globalAlpha = opts.alpha; }
  if (dir === 'right') {
    ctx.save();
    ctx.translate(dx + SPR_W, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, SPR_W, SPR_H, 0, 0, SPR_W, SPR_H);
    ctx.restore();
  } else {
    ctx.drawImage(sheet, sx, sy, SPR_W, SPR_H, dx, dy, SPR_W, SPR_H);
  }
  if (opts.alpha != null) ctx.restore();
}

// The stock cast. NPC data refers to these by name.
export const LOOKS = {
  // The two players. `boy` and `girl` stay as aliases so a save written
  // before they had names still loads, and so NPC looks that borrowed them
  // keep working.
  matthew: makeLook({ hair: '#3a2418', shirt: '#3f6fd4', pants: '#2b3450', hat: '#d84838', boots: '#3a2a20' }),
  sammy: makeLook({ hair: '#c8763a', shirt: '#e0609a', pants: '#f0f0f8', longHair: true, boots: '#c04868' }),
  rivalBoy: makeLook({ hair: '#e0a030', shirt: '#f0f0f4', pants: '#4a5060', boots: '#804830' }),
  rivalGirl: makeLook({ hair: '#20304a', shirt: '#f0e070', pants: '#4a5060', longHair: true, boots: '#804830' }),
  professor: makeLook({ hair: '#c8c8d0', shirt: '#f4f4f8', pants: '#5a6070', boots: '#404850' }),
  nurse: makeLook({ hair: '#f090b0', shirt: '#f8f8fc', pants: '#f8f8fc', longHair: true, hat: '#f8f8fc', boots: '#e05a7a' }),
  clerk: makeLook({ hair: '#3a3a48', shirt: '#4a90d0', pants: '#2b3450', boots: '#2b3450' }),
  mom: makeLook({ hair: '#8a4a20', shirt: '#f0a050', pants: '#c05a30', longHair: true, boots: '#8a4a20' }),
  youngster: makeLook({ hair: '#3a2418', shirt: '#68c060', pants: '#3a4a68', hat: '#f0f0f4', boots: '#4a3020' }),
  lass: makeLook({ hair: '#f0d060', shirt: '#f070a0', pants: '#f8f8fc', longHair: true, boots: '#d04070' }),
  hiker: makeLook({ hair: '#5a3a20', shirt: '#c87840', pants: '#4a5a3a', boots: '#3a2a1a' }),
  bugCatcher: makeLook({ hair: '#3a2418', shirt: '#f0e070', pants: '#68a048', hat: '#f0e070', boots: '#5a4030' }),
  worker: makeLook({ hair: '#4a3020', shirt: '#f09030', pants: '#4a5060', hat: '#f0c030', boots: '#3a3a3a' }),
  grunt: makeLook({ hair: '#20242e', shirt: '#2b3450', pants: '#20242e', hat: '#5a6a94', boots: '#101420', outlineColor: '#080a12' }),
  gruntF: makeLook({ hair: '#20242e', shirt: '#2b3450', pants: '#20242e', longHair: true, boots: '#101420', outlineColor: '#080a12' }),
  leaderRock: makeLook({ hair: '#8a5a30', shirt: '#a86840', pants: '#5a4a3a', boots: '#3a2a1a' }),
  oldMan: makeLook({ hair: '#d0d0d8', shirt: '#8a9aa8', pants: '#5a6070', boots: '#4a4a52' }),
  oldWoman: makeLook({ hair: '#e0e0e8', shirt: '#b08aa8', pants: '#6a5a70', longHair: true, boots: '#4a4a52' }),
  kid: makeLook({ hair: '#4a3020', shirt: '#f0d060', pants: '#68a048', boots: '#8a5a30' }),
  sailor: makeLook({ hair: '#20304a', shirt: '#f0f0f8', pants: '#2b3450', hat: '#f0f0f8', boots: '#20283a' }),
  scientist: makeLook({ hair: '#3a3a48', shirt: '#f4f4f8', pants: '#8a9aa8', boots: '#4a4a52' }),
  boss: makeLook({ hair: '#c8b088', shirt: '#20283a', pants: '#101828', longHair: true, boots: '#0a0e18', outlineColor: '#05070d' }),
};

// Each look learns its own name, so drawChar can ask the sprite atlas for it
// without every call site having to pass the name alongside the object.
for (const [name, look] of Object.entries(LOOKS)) look.name = look.name || name;

LOOKS.boy = LOOKS.matthew;
LOOKS.girl = LOOKS.sammy;

export function lookFor(name) { return LOOKS[name] || LOOKS.youngster; }
