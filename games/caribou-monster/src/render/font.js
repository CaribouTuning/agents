// Hand-authored 5x7 bitmap font. Rendered once into a white-on-transparent
// atlas, then tinted per colour and cached — text draws are plain
// drawImage calls, no per-pixel work at runtime.
//
// Each glyph is 7 rows of 5 columns, '#' = ink.

const GLYPHS = {
  ' ': '.....' + '.....' + '.....' + '.....' + '.....' + '.....' + '.....',
  A: '.###.' + '#...#' + '#...#' + '#####' + '#...#' + '#...#' + '#...#',
  B: '####.' + '#...#' + '#...#' + '####.' + '#...#' + '#...#' + '####.',
  C: '.###.' + '#...#' + '#....' + '#....' + '#....' + '#...#' + '.###.',
  D: '####.' + '#...#' + '#...#' + '#...#' + '#...#' + '#...#' + '####.',
  E: '#####' + '#....' + '#....' + '####.' + '#....' + '#....' + '#####',
  F: '#####' + '#....' + '#....' + '####.' + '#....' + '#....' + '#....',
  G: '.###.' + '#...#' + '#....' + '#..##' + '#...#' + '#...#' + '.###.',
  H: '#...#' + '#...#' + '#...#' + '#####' + '#...#' + '#...#' + '#...#',
  I: '.###.' + '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '.###.',
  J: '..###' + '...#.' + '...#.' + '...#.' + '...#.' + '#..#.' + '.##..',
  K: '#...#' + '#..#.' + '#.#..' + '##...' + '#.#..' + '#..#.' + '#...#',
  L: '#....' + '#....' + '#....' + '#....' + '#....' + '#....' + '#####',
  M: '#...#' + '##.##' + '#.#.#' + '#.#.#' + '#...#' + '#...#' + '#...#',
  N: '#...#' + '#...#' + '##..#' + '#.#.#' + '#..##' + '#...#' + '#...#',
  O: '.###.' + '#...#' + '#...#' + '#...#' + '#...#' + '#...#' + '.###.',
  P: '####.' + '#...#' + '#...#' + '####.' + '#....' + '#....' + '#....',
  Q: '.###.' + '#...#' + '#...#' + '#...#' + '#.#.#' + '#..#.' + '.##.#',
  R: '####.' + '#...#' + '#...#' + '####.' + '#.#..' + '#..#.' + '#...#',
  S: '.####' + '#....' + '#....' + '.###.' + '....#' + '....#' + '####.',
  T: '#####' + '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '..#..',
  U: '#...#' + '#...#' + '#...#' + '#...#' + '#...#' + '#...#' + '.###.',
  V: '#...#' + '#...#' + '#...#' + '#...#' + '#...#' + '.#.#.' + '..#..',
  W: '#...#' + '#...#' + '#...#' + '#.#.#' + '#.#.#' + '##.##' + '#...#',
  X: '#...#' + '#...#' + '.#.#.' + '..#..' + '.#.#.' + '#...#' + '#...#',
  Y: '#...#' + '#...#' + '.#.#.' + '..#..' + '..#..' + '..#..' + '..#..',
  Z: '#####' + '....#' + '...#.' + '..#..' + '.#...' + '#....' + '#####',
  a: '.....' + '.....' + '.###.' + '....#' + '.####' + '#...#' + '.####',
  b: '#....' + '#....' + '####.' + '#...#' + '#...#' + '#...#' + '####.',
  c: '.....' + '.....' + '.###.' + '#....' + '#....' + '#....' + '.###.',
  d: '....#' + '....#' + '.####' + '#...#' + '#...#' + '#...#' + '.####',
  e: '.....' + '.....' + '.###.' + '#...#' + '#####' + '#....' + '.###.',
  f: '..##.' + '.#...' + '.#...' + '####.' + '.#...' + '.#...' + '.#...',
  g: '.....' + '.####' + '#...#' + '#...#' + '.####' + '....#' + '.###.',
  h: '#....' + '#....' + '####.' + '#...#' + '#...#' + '#...#' + '#...#',
  i: '..#..' + '.....' + '.##..' + '..#..' + '..#..' + '..#..' + '.###.',
  j: '...#.' + '.....' + '..##.' + '...#.' + '...#.' + '#..#.' + '.##..',
  k: '#....' + '#....' + '#..#.' + '#.#..' + '##...' + '#.#..' + '#..#.',
  l: '.##..' + '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '.###.',
  m: '.....' + '.....' + '##.#.' + '#.#.#' + '#.#.#' + '#.#.#' + '#.#.#',
  n: '.....' + '.....' + '####.' + '#...#' + '#...#' + '#...#' + '#...#',
  o: '.....' + '.....' + '.###.' + '#...#' + '#...#' + '#...#' + '.###.',
  p: '.....' + '####.' + '#...#' + '#...#' + '####.' + '#....' + '#....',
  q: '.....' + '.####' + '#...#' + '#...#' + '.####' + '....#' + '....#',
  r: '.....' + '.....' + '#.##.' + '##...' + '#....' + '#....' + '#....',
  s: '.....' + '.....' + '.####' + '#....' + '.###.' + '....#' + '####.',
  t: '.#...' + '.#...' + '####.' + '.#...' + '.#...' + '.#..#' + '..##.',
  u: '.....' + '.....' + '#...#' + '#...#' + '#...#' + '#..##' + '.##.#',
  v: '.....' + '.....' + '#...#' + '#...#' + '#...#' + '.#.#.' + '..#..',
  w: '.....' + '.....' + '#...#' + '#.#.#' + '#.#.#' + '#.#.#' + '.#.#.',
  x: '.....' + '.....' + '#...#' + '.#.#.' + '..#..' + '.#.#.' + '#...#',
  y: '.....' + '#...#' + '#...#' + '#...#' + '.####' + '....#' + '.###.',
  z: '.....' + '.....' + '#####' + '...#.' + '..#..' + '.#...' + '#####',
  0: '.###.' + '#...#' + '#..##' + '#.#.#' + '##..#' + '#...#' + '.###.',
  1: '..#..' + '.##..' + '..#..' + '..#..' + '..#..' + '..#..' + '.###.',
  2: '.###.' + '#...#' + '....#' + '...#.' + '..#..' + '.#...' + '#####',
  3: '#####' + '...#.' + '..#..' + '...#.' + '....#' + '#...#' + '.###.',
  4: '...#.' + '..##.' + '.#.#.' + '#..#.' + '#####' + '...#.' + '...#.',
  5: '#####' + '#....' + '####.' + '....#' + '....#' + '#...#' + '.###.',
  6: '..##.' + '.#...' + '#....' + '####.' + '#...#' + '#...#' + '.###.',
  7: '#####' + '....#' + '...#.' + '..#..' + '.#...' + '.#...' + '.#...',
  8: '.###.' + '#...#' + '#...#' + '.###.' + '#...#' + '#...#' + '.###.',
  9: '.###.' + '#...#' + '#...#' + '.####' + '....#' + '...#.' + '.##..',
  '.': '.....' + '.....' + '.....' + '.....' + '.....' + '.##..' + '.##..',
  ',': '.....' + '.....' + '.....' + '.....' + '.##..' + '.##..' + '.#...',
  '!': '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '.....' + '..#..',
  '?': '.###.' + '#...#' + '....#' + '...#.' + '..#..' + '.....' + '..#..',
  "'": '..#..' + '..#..' + '.....' + '.....' + '.....' + '.....' + '.....',
  '"': '.#.#.' + '.#.#.' + '.....' + '.....' + '.....' + '.....' + '.....',
  '-': '.....' + '.....' + '.....' + '#####' + '.....' + '.....' + '.....',
  '+': '.....' + '..#..' + '..#..' + '#####' + '..#..' + '..#..' + '.....',
  ':': '.....' + '.##..' + '.##..' + '.....' + '.##..' + '.##..' + '.....',
  ';': '.....' + '.##..' + '.##..' + '.....' + '.##..' + '.##..' + '.#...',
  '/': '....#' + '....#' + '...#.' + '..#..' + '.#...' + '#....' + '#....',
  '(': '...#.' + '..#..' + '.#...' + '.#...' + '.#...' + '..#..' + '...#.',
  ')': '.#...' + '..#..' + '...#.' + '...#.' + '...#.' + '..#..' + '.#...',
  '[': '..###' + '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '..###',
  ']': '###..' + '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '###..',
  '<': '...#.' + '..#..' + '.#...' + '#....' + '.#...' + '..#..' + '...#.',
  '>': '.#...' + '..#..' + '...#.' + '....#' + '...#.' + '..#..' + '.#...',
  '=': '.....' + '.....' + '#####' + '.....' + '#####' + '.....' + '.....',
  '*': '.....' + '#.#.#' + '.###.' + '#####' + '.###.' + '#.#.#' + '.....',
  '#': '.#.#.' + '#####' + '.#.#.' + '.#.#.' + '#####' + '.#.#.' + '.....',
  '%': '##..#' + '##.#.' + '..#..' + '.#.##' + '#..##' + '.....' + '.....',
  $: '..#..' + '.####' + '#.#..' + '.###.' + '..#.#' + '####.' + '..#..',
  '_': '.....' + '.....' + '.....' + '.....' + '.....' + '.....' + '#####',
  '\u00e9': '..#..' + '.#...' + '.###.' + '#...#' + '#####' + '#....' + '.###.',
  // Symbols the UI leans on.
  '♂': '...##' + '....#' + '..###' + '.###.' + '#...#' + '#...#' + '.###.', // male
  '♀': '.###.' + '#...#' + '#...#' + '.###.' + '..#..' + '.###.' + '..#..', // female
  '▶': '#....' + '##...' + '###..' + '####.' + '###..' + '##...' + '#....', // cursor
  '▼': '.....' + '#####' + '.###.' + '.###.' + '..#..' + '.....' + '.....', // more-text
  '▲': '.....' + '..#..' + '.###.' + '.###.' + '#####' + '.....' + '.....',
  '●': '.....' + '.###.' + '#####' + '#####' + '#####' + '.###.' + '.....', // filled dot
  '○': '.....' + '.###.' + '#...#' + '#...#' + '#...#' + '.###.' + '.....', // hollow dot
  '★': '..#..' + '..#..' + '#####' + '.###.' + '##.##' + '.....' + '.....', // star
  '×': '.....' + '.....' + '#...#' + '.#.#.' + '..#..' + '.#.#.' + '#...#', // times
  '…': '.....' + '.....' + '.....' + '.....' + '.....' + '.....' + '#.#.#', // ellipsis
  '→': '.....' + '..#..' + '...#.' + '#####' + '...#.' + '..#..' + '.....', // right arrow
  '←': '.....' + '..#..' + '.#...' + '#####' + '.#...' + '..#..' + '.....', // left arrow
  '✓': '.....' + '....#' + '...#.' + '#..#.' + '.##..' + '.....' + '.....', // tick
  '◀': '....#' + '...##' + '..###' + '.####' + '..###' + '...##' + '....#', // cursor, left
  '▸': '#....' + '##...' + '###..' + '####.' + '###..' + '##...' + '#....', // guide-bar chevron
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const CHAR_ADVANCE = 6;   // 5px glyph + 1px gap
export const LINE_HEIGHT = 10;

// Typography the writing uses but the 5x7 set does not carry. Mapping them
// here means prose can be written naturally and still render.
const FOLD = {
  '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"',
  '\u2013': '-', '\u2014': '-', '\u00b7': '.', '\u00a0': ' ',
  '\u00e8': '\u00e9', '\u00ea': '\u00e9', '\u00c9': 'E',
  '\u00e0': 'a', '\u00e1': 'a', '\u00e2': 'a', '\u00ee': 'i', '\u00f4': 'o', '\u00fc': 'u',
};

/**
 * Characters the font cannot draw, in the order they appear.
 *
 * Anything with neither a glyph nor a fold is rendered as a blank, so a stray
 * symbol in a string is invisible at runtime and obvious only to whoever is
 * holding the console. tools/audit.mjs runs every piece of text in the game
 * through this, which is how a currency symbol that printed as "?" was caught.
 */
export function unrenderable(str) {
  const out = [];
  for (const ch of String(str)) {
    if (ch === '\n' || ch === '\f') continue;
    const folded = FOLD[ch] || ch;
    if (GLYPHS[folded] === undefined && !out.includes(ch)) out.push(ch);
  }
  return out;
}

export function canRender(str) { return unrenderable(str).length === 0; }

const ORDER = Object.keys(GLYPHS);
const INDEX = new Map(ORDER.map((c, i) => [c, i]));
const COLS = 16;
const ROWS = Math.ceil(ORDER.length / COLS);

let atlas = null;
const tinted = new Map();

function buildAtlas() {
  const cv = document.createElement('canvas');
  cv.width = COLS * GLYPH_W;
  cv.height = ROWS * GLYPH_H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(cv.width, cv.height);
  ORDER.forEach((ch, i) => {
    const gx = (i % COLS) * GLYPH_W;
    const gy = Math.floor(i / COLS) * GLYPH_H;
    const bits = GLYPHS[ch];
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (bits[y * GLYPH_W + x] !== '#') continue;
        const o = ((gy + y) * cv.width + (gx + x)) * 4;
        img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; img.data[o + 3] = 255;
      }
    }
  });
  ctx.putImageData(img, 0, 0);
  atlas = cv;
}

function tintedAtlas(color) {
  if (tinted.has(color)) return tinted.get(color);
  if (!atlas) buildAtlas();
  const cv = document.createElement('canvas');
  cv.width = atlas.width; cv.height = atlas.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(atlas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, cv.width, cv.height);
  tinted.set(color, cv);
  return cv;
}

export function textWidth(str, scale = 1) {
  return str.length * CHAR_ADVANCE * scale - (str.length ? scale : 0);
}

// Draws `str` with its top-left at (x, y). `limit` renders only the first
// N characters — that is how the dialogue typewriter works.
export function drawText(ctx, str, x, y, opts = {}) {
  const { color = '#20283a', scale = 1, shadow = null, limit = Infinity } = opts;
  const n = Math.min(str.length, Math.max(0, Math.floor(limit)));
  if (n <= 0) return;
  if (shadow) {
    const sh = tintedAtlas(shadow);
    blit(ctx, sh, str, x + scale, y + scale, scale, n);
  }
  const at = tintedAtlas(color);
  blit(ctx, at, str, x, y, scale, n);
}

function blit(ctx, sheet, str, x, y, scale, n) {
  for (let i = 0; i < n; i++) {
    let ch = str[i];
    if (!INDEX.has(ch) && FOLD[ch]) ch = FOLD[ch];
    const idx = INDEX.has(ch) ? INDEX.get(ch) : INDEX.get('?');
    if (ch === ' ') continue;
    const sx = (idx % COLS) * GLYPH_W;
    const sy = Math.floor(idx / COLS) * GLYPH_H;
    ctx.drawImage(sheet, sx, sy, GLYPH_W, GLYPH_H,
      Math.round(x + i * CHAR_ADVANCE * scale), Math.round(y), GLYPH_W * scale, GLYPH_H * scale);
  }
}

export function drawTextCentered(ctx, str, cx, y, opts = {}) {
  const scale = opts.scale || 1;
  drawText(ctx, str, Math.round(cx - textWidth(str, scale) / 2), y, opts);
}

export function drawTextRight(ctx, str, rx, y, opts = {}) {
  const scale = opts.scale || 1;
  drawText(ctx, str, Math.round(rx - textWidth(str, scale)), y, opts);
}

// Greedy word wrap that also honours explicit \n.
export function wrapText(str, maxChars) {
  const lines = [];
  for (const para of String(str).split('\n')) {
    if (!para.length) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      if (!line.length) { line = word; continue; }
      if (line.length + 1 + word.length <= maxChars) line += ' ' + word;
      else { lines.push(line); line = word; }
    }
    if (line.length) lines.push(line);
  }
  return lines;
}
