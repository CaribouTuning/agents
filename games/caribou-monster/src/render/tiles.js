// Tile artwork. Every tile is drawn procedurally into a 16x16 cell of an
// atlas once at boot, then blitted — no image assets, no per-frame work.
//
// Maps are authored as ASCII grids (see data/maps/*), so the character in
// the map string IS the tile key. That keeps map data readable and diffable.
import { PAL, shade } from './palette.js';
import { TILE, makeSurface } from './canvas.js';

// Cheap deterministic hash so texture speckle is stable per tile pixel.
function h(x, y, s = 0) {
  let n = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const px = (c, x, y, w = 1, hh = 1) => { c.fillRect(x, y, w, hh); };

// ---- individual tile painters ---------------------------------------
// Each receives a context already translated to the tile's top-left, plus
// the animation frame index.

function grass(c, f, seed = 0) {
  c.fillStyle = PAL.grass; px(c, 0, 0, 16, 16);
  // Two scales of noise. The coarse one puts broad patches of lighter and
  // darker turf across the tile so a field stops reading as one flat colour;
  // the fine one is the blade speckle on top of it.
  const light = shade(PAL.grass, 0.09);
  const mid = shade(PAL.grass, -0.06);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const coarse = h(x >> 2, y >> 2, seed + 3);
      if (coarse > 0.62) { c.fillStyle = light; px(c, x, y); }
      else if (coarse < 0.3) { c.fillStyle = mid; px(c, x, y); }
      const r = h(x, y, seed + 7);
      if (r > 0.9) { c.fillStyle = shade(PAL.grass, 0.16); px(c, x, y); }
      else if (r < 0.07) { c.fillStyle = PAL.grassDark; px(c, x, y); }
    }
  }
  // A few standing blades, so the ground has a direction.
  c.fillStyle = PAL.grassDark;
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(h(i, seed, 19) * 15);
    const by = 2 + Math.floor(h(i, seed, 23) * 12);
    px(c, bx, by); px(c, bx, by - 1);
  }
}

function grassTuft(c, f) {
  grass(c, f, 3);
  c.fillStyle = PAL.grassDark;
  px(c, 4, 10, 1, 3); px(c, 5, 9, 1, 3); px(c, 6, 11, 1, 2);
  px(c, 11, 5, 1, 3); px(c, 12, 4, 1, 3); px(c, 10, 6, 1, 2);
}

function tallGrass(c, f) {
  grass(c, f, 11);
  const sway = f === 1 ? 1 : 0;
  c.fillStyle = PAL.grassTall;
  for (let i = 0; i < 5; i++) {
    const bx = 1 + i * 3;
    const bh = 7 + ((i * 5) % 4);
    for (let k = 0; k < bh; k++) {
      const off = Math.round((k / bh) * (i % 2 ? 2 : -2)) + (k > bh - 3 ? sway : 0);
      px(c, bx + off, 15 - k);
    }
  }
  c.fillStyle = PAL.grassTallLight;
  for (let i = 0; i < 5; i++) {
    const bx = 1 + i * 3;
    const bh = 7 + ((i * 5) % 4);
    const off = Math.round((i % 2 ? 2 : -2)) + sway;
    px(c, bx + off, 15 - bh + 1);
  }
}

function flowers(c, f) {
  grass(c, f, 5);
  const cols = [PAL.flowerRed, PAL.flowerYellow, PAL.flowerPink, PAL.flowerWhite];
  const spots = [[3, 4], [10, 3], [6, 10], [12, 11]];
  spots.forEach((s, i) => {
    c.fillStyle = cols[(i + (f ? 1 : 0)) % cols.length];
    px(c, s[0], s[1] - 1); px(c, s[0] - 1, s[1]); px(c, s[0] + 1, s[1]); px(c, s[0], s[1] + 1);
    c.fillStyle = PAL.flowerYellow === cols[i % 4] ? PAL.flowerRed : PAL.flowerYellow;
    px(c, s[0], s[1]);
  });
}

function path(c) {
  c.fillStyle = PAL.path; px(c, 0, 0, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const coarse = h(x >> 2, y >> 2, 17);
      if (coarse > 0.66) { c.fillStyle = shade(PAL.path, 0.07); px(c, x, y); }
      else if (coarse < 0.28) { c.fillStyle = shade(PAL.path, -0.07); px(c, x, y); }
      const r = h(x, y, 21);
      if (r > 0.93) { c.fillStyle = shade(PAL.path, 0.14); px(c, x, y); }
      else if (r < 0.06) { c.fillStyle = PAL.pathDark; px(c, x, y); }
    }
  }
  // Loose stones pressed into the track.
  for (let i = 0; i < 3; i++) {
    const sx = 1 + Math.floor(h(i, 5, 27) * 13);
    const sy = 1 + Math.floor(h(i, 9, 27) * 13);
    c.fillStyle = PAL.pathDark; px(c, sx, sy, 2, 1); px(c, sx, sy + 1, 2, 1);
    c.fillStyle = shade(PAL.path, 0.2); px(c, sx, sy, 1, 1);
  }
}

function dirt(c) {
  c.fillStyle = PAL.pathDark; px(c, 0, 0, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = h(x, y, 33);
    if (r > 0.88) { c.fillStyle = PAL.path; px(c, x, y); }
    else if (r < 0.1) { c.fillStyle = shade(PAL.pathDark, -0.15); px(c, x, y); }
  }
}

function sand(c) {
  c.fillStyle = PAL.sand; px(c, 0, 0, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (h(x, y, 41) > 0.9) { c.fillStyle = shade(PAL.sand, -0.08); px(c, x, y); }
  }
}

function snow(c) {
  c.fillStyle = PAL.snow; px(c, 0, 0, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (h(x, y, 55) > 0.92) { c.fillStyle = PAL.snowDark; px(c, x, y); }
  }
}

function water(c, f) {
  c.fillStyle = PAL.water; px(c, 0, 0, 16, 16);
  const o = f * 4;
  c.fillStyle = PAL.waterDark;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if ((x + y * 2 + o) % 9 === 0) px(c, x, y);
    }
  }
  c.fillStyle = PAL.waterLight;
  px(c, (2 + o) % 14, 3, 3, 1);
  px(c, (9 + o) % 14, 10, 4, 1);
  px(c, (5 + o) % 14, 13, 2, 1);
}

function waterShallow(c, f) {
  water(c, f);
  c.fillStyle = PAL.waterLight;
  for (let x = 0; x < 16; x++) if ((x + f) % 3) px(c, x, 0, 1, 2);
  c.fillStyle = shade(PAL.sand, -0.1);
  for (let x = 0; x < 16; x++) if (h(x, 0, 61) > 0.5) px(c, x, 0, 1, 1);
}

function tree(c) {
  c.fillStyle = PAL.grass; px(c, 0, 0, 16, 16);
  // The shadow the canopy throws on its own tile, so the tree sits on the
  // ground rather than floating on it.
  c.fillStyle = shade(PAL.grass, -0.22); px(c, 3, 13, 11, 3); px(c, 2, 14, 13, 1);

  c.fillStyle = shade(PAL.treeTrunk, -0.35); px(c, 6, 10, 5, 6);
  c.fillStyle = PAL.treeTrunk; px(c, 7, 10, 3, 6);
  c.fillStyle = shade(PAL.treeTrunk, 0.18); px(c, 7, 10, 1, 6);

  const lobe = (cx, cy, r, col) => {
    c.fillStyle = col;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + 1) px(c, cx + x, cy + y);
    }
  };
  // Outline first, then the canopy inside it: a dark rim is what makes a
  // 16px tree read as a tree at this scale.
  lobe(8, 7, 7, shade(PAL.treeLeafDark, -0.45));
  lobe(8, 7, 6, PAL.treeLeafDark);
  lobe(7, 6, 5, PAL.treeLeaf);
  lobe(6, 5, 3, PAL.treeLeafLight);
  lobe(6, 4, 1, shade(PAL.treeLeafLight, 0.2));
  c.fillStyle = PAL.treeLeafDark;
  for (let i = 0; i < 12; i++) {
    const x = 3 + Math.floor(h(i, 3, 9) * 10), y = 3 + Math.floor(h(i, 7, 9) * 8);
    px(c, x, y);
  }
}

function pine(c) {
  c.fillStyle = PAL.grass; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.treeTrunk; px(c, 7, 13, 2, 3);
  for (let tier = 0; tier < 3; tier++) {
    const top = 1 + tier * 4;
    const wBase = 4 + tier * 3;
    for (let y = 0; y < 5; y++) {
      const w = Math.round((y / 4) * wBase) + 1;
      c.fillStyle = y < 2 ? PAL.treeLeafLight : PAL.treeLeaf;
      px(c, 8 - w, top + y, w * 2, 1);
    }
    c.fillStyle = PAL.treeLeafDark;
    px(c, 8 - wBase - 1, top + 4, wBase * 2 + 2, 1);
  }
}

function rock(c) {
  c.fillStyle = PAL.grass; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.rockDark;
  px(c, 2, 6, 12, 9);
  c.fillStyle = PAL.rock;
  px(c, 3, 5, 10, 9);
  c.fillStyle = PAL.rockLight;
  px(c, 4, 5, 6, 3); px(c, 4, 8, 3, 2);
  c.fillStyle = PAL.rockDark;
  px(c, 9, 10, 4, 2); px(c, 5, 12, 3, 1);
}

function boulder(c) {
  c.fillStyle = PAL.grass; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.rockDark; px(c, 1, 3, 14, 13);
  c.fillStyle = PAL.rock; px(c, 2, 2, 12, 12);
  c.fillStyle = PAL.rockLight; px(c, 4, 4, 5, 4);
  c.fillStyle = PAL.rockDark; px(c, 3, 11, 10, 2); px(c, 10, 6, 3, 4);
}

function cliff(c) {
  c.fillStyle = PAL.cliff; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.cliffDark;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (h(x, y, 77) > 0.82) px(c, x, y);
  }
  c.fillStyle = shade(PAL.cliff, 0.15);
  px(c, 0, 0, 16, 2);
  c.fillStyle = PAL.cliffDark;
  px(c, 4, 4, 1, 6); px(c, 11, 7, 1, 7); px(c, 7, 2, 1, 4);
}

function ledge(c) {
  c.fillStyle = PAL.grass; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.ledge; px(c, 0, 0, 16, 8);
  c.fillStyle = shade(PAL.ledge, -0.25); px(c, 0, 6, 16, 3);
  c.fillStyle = shade(PAL.ledge, 0.2); px(c, 0, 0, 16, 2);
  c.fillStyle = PAL.grassDark;
  for (let x = 0; x < 16; x += 4) px(c, x, 9, 2, 1);
}

function bridge(c) {
  c.fillStyle = PAL.bridge; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.bridgeDark;
  for (let y = 0; y < 16; y += 4) px(c, 0, y, 16, 1);
  px(c, 0, 0, 1, 16); px(c, 15, 0, 1, 16);
  c.fillStyle = shade(PAL.bridge, 0.15);
  for (let y = 1; y < 16; y += 4) px(c, 1, y, 14, 1);
}

function sign(c) {
  grass(c, 0, 13);
  c.fillStyle = shade(PAL.sign, -0.3); px(c, 7, 10, 2, 6);
  c.fillStyle = PAL.sign; px(c, 2, 3, 12, 8);
  c.fillStyle = shade(PAL.sign, 0.2); px(c, 3, 4, 10, 6);
  c.fillStyle = shade(PAL.sign, -0.35);
  px(c, 4, 5, 8, 1); px(c, 4, 7, 6, 1); px(c, 4, 9, 7, 1);
}

function fence(c) {
  grass(c, 0, 17);
  c.fillStyle = shade(PAL.sign, 0.1);
  px(c, 2, 4, 2, 11); px(c, 11, 4, 2, 11);
  px(c, 0, 6, 16, 2); px(c, 0, 11, 16, 2);
  c.fillStyle = shade(PAL.sign, -0.3);
  px(c, 0, 8, 16, 1); px(c, 0, 13, 16, 1);
}

// ---- buildings -------------------------------------------------------

function wallOut(c) {
  c.fillStyle = PAL.wallOut; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.wallOutDark;
  for (let y = 0; y < 16; y += 4) px(c, 0, y, 16, 1);
  for (let y = 0; y < 16; y += 4) {
    const off = (y / 4) % 2 ? 4 : 0;
    for (let x = off; x < 16; x += 8) px(c, x, y, 1, 4);
  }
  // The shadow the roof overhang throws down the wall, and a plinth course
  // at the bottom — the two details that give a flat wall a front and a base.
  c.fillStyle = shade(PAL.wallOutDark, -0.3);
  c.globalAlpha = 0.5; px(c, 0, 0, 16, 2); c.globalAlpha = 1;
  c.fillStyle = shade(PAL.wallOut, -0.18); px(c, 0, 14, 16, 2);
  c.fillStyle = shade(PAL.wallOut, 0.12); px(c, 0, 14, 16, 1);
}

function windowTile(c) {
  wallOut(c);
  c.fillStyle = shade(PAL.wallOutDark, -0.2); px(c, 2, 3, 12, 10);
  c.fillStyle = PAL.window; px(c, 3, 4, 10, 8);
  c.fillStyle = PAL.windowDark; px(c, 3, 8, 10, 4);
  c.fillStyle = shade(PAL.window, 0.35); px(c, 4, 5, 3, 2);
  c.fillStyle = shade(PAL.wallOutDark, -0.2); px(c, 8, 3, 1, 10); px(c, 2, 7, 12, 1);
}

function roof(base, dark) {
  return (c) => {
    c.fillStyle = base; px(c, 0, 0, 16, 16);
    c.fillStyle = dark;
    for (let y = 0; y < 16; y += 4) {
      px(c, 0, y + 3, 16, 1);
      const off = (y / 4) % 2 ? 3 : 0;
      for (let x = off; x < 16; x += 6) px(c, x, y, 1, 3);
    }
    c.fillStyle = shade(base, 0.18);
    for (let y = 0; y < 16; y += 4) px(c, 0, y, 16, 1);
    // Roofs are lit from the upper left, like everything else.
    c.fillStyle = shade(base, 0.10); px(c, 0, 0, 16, 1);
    c.fillStyle = shade(dark, -0.25); px(c, 15, 0, 1, 16);
  };
}

function door(c) {
  c.fillStyle = PAL.wallOut; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.doorDark; px(c, 2, 2, 12, 14);
  c.fillStyle = PAL.door; px(c, 3, 3, 10, 13);
  c.fillStyle = PAL.doorDark; px(c, 8, 3, 1, 13);
  c.fillStyle = PAL.uiHighlight; px(c, 10, 9, 2, 2);
  c.fillStyle = shade(PAL.door, 0.2); px(c, 4, 4, 4, 5);
}


// ---- civic buildings -------------------------------------------------
// A Pokemon Center, a Mart and a Gym drawn as three identical coloured
// rectangles is the reason a player can walk into a city and not know a Gym
// is in it. Each one gets its own facade panel with its own emblem, its own
// door, and a name board the renderer writes across the front.

/** The panel under a Center's roof: white, with the red cross and a ball. */
function centerFront(c) {
  c.fillStyle = '#f0ece0'; px(c, 0, 0, 16, 16);
  c.fillStyle = shade('#f0ece0', -0.12); px(c, 0, 0, 16, 2);
  c.fillStyle = '#d8493f';
  px(c, 6, 4, 4, 8); px(c, 4, 6, 8, 4);
  c.fillStyle = '#ffffff'; px(c, 7, 5, 1, 2);
  c.fillStyle = shade('#f0ece0', -0.2); px(c, 0, 14, 16, 2);
}

/** The Mart panel: the blue stripe and a ball. */
function martFront(c) {
  c.fillStyle = '#f0ece0'; px(c, 0, 0, 16, 16);
  c.fillStyle = shade('#f0ece0', -0.12); px(c, 0, 0, 16, 2);
  c.fillStyle = '#4a6fc0'; px(c, 0, 4, 16, 3);
  ball(c, 8, 11, 4);
  c.fillStyle = shade('#f0ece0', -0.2); px(c, 0, 14, 16, 2);
}

/** A Poke Ball, drawn as a disc split by a dark band. */
function ball(c, cx, cy, r) {
  c.fillStyle = '#20283a';
  for (let y = -r - 1; y <= r + 1; y++) {
    for (let x = -r - 1; x <= r + 1; x++) {
      if (x * x + y * y <= (r + 1) * (r + 1)) px(c, cx + x, cy + y);
    }
  }
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      c.fillStyle = y < -1 ? '#e05248' : y > 0 ? '#f4f4f8' : '#20283a';
      px(c, cx + x, cy + y);
    }
  }
  c.fillStyle = '#f4f4f8'; px(c, cx - 1, cy, 2, 1);
}

/**
 * The Gym facade. Dark stone, a badge plate, and a heavy base course — it
 * has to be recognisable as a Gym from across the map with no text at all.
 */
function gymFront(c) {
  const stone = '#6b7488';
  c.fillStyle = stone; px(c, 0, 0, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = h(x, y, 131);
      if (r > 0.9) { c.fillStyle = shade(stone, 0.1); px(c, x, y); }
      else if (r < 0.1) { c.fillStyle = shade(stone, -0.12); px(c, x, y); }
    }
  }
  // Ashlar courses.
  c.fillStyle = shade(stone, -0.28);
  for (let y = 4; y < 16; y += 5) px(c, 0, y, 16, 1);
  for (let y = 0; y < 16; y += 5) {
    const off = (y / 5) % 2 ? 4 : 0;
    for (let x = off; x < 16; x += 8) px(c, x, y, 1, 4);
  }
  c.fillStyle = shade(stone, 0.16); px(c, 0, 0, 16, 1);
  c.fillStyle = shade(stone, -0.35); px(c, 0, 14, 16, 2);
}

/** The badge plate that sits over a Gym's door: a gold eight-point badge. */
function gymBadge(c) {
  gymFront(c);
  c.fillStyle = '#2b3450'; px(c, 2, 3, 12, 10);
  c.fillStyle = '#f0c840';
  for (let y = -4; y <= 4; y++) {
    for (let x = -5; x <= 5; x++) {
      if (Math.abs(x) / 5 + Math.abs(y) / 4 <= 1) px(c, 8 + x, 8 + y);
    }
  }
  c.fillStyle = '#f8e8a0'; px(c, 5, 6, 3, 2);
  c.fillStyle = '#a07818'; px(c, 8, 9, 3, 2);
  c.fillStyle = '#2b3450'; px(c, 7, 7, 3, 3);
}

/** A Gym's double door: taller and heavier than a house's. */
function gymDoor(c) {
  gymFront(c);
  c.fillStyle = '#20283a'; px(c, 1, 1, 14, 15);
  c.fillStyle = '#3f4a68'; px(c, 2, 2, 12, 14);
  c.fillStyle = '#2b3450'; px(c, 7, 2, 2, 14);
  c.fillStyle = '#5a6a94'; px(c, 3, 3, 4, 6); px(c, 9, 3, 4, 6);
  c.fillStyle = '#f0c840'; px(c, 5, 10, 1, 2); px(c, 10, 10, 1, 2);
}

/** A stone marker either side of a Gym door. */
function statue(c) {
  c.fillStyle = PAL.grass; px(c, 0, 0, 16, 16);
  c.fillStyle = shade(PAL.grass, -0.22); px(c, 2, 13, 12, 3);
  c.fillStyle = PAL.rockDark; px(c, 3, 12, 10, 4);
  c.fillStyle = PAL.rock; px(c, 4, 2, 8, 11);
  c.fillStyle = PAL.rockLight; px(c, 5, 3, 3, 9);
  c.fillStyle = PAL.rockDark; px(c, 10, 4, 2, 8);
  c.fillStyle = '#f0c840'; px(c, 6, 5, 4, 4);
  c.fillStyle = PAL.rockDark; px(c, 7, 6, 2, 2);
}

/** The blank board a building's name is written across. */
function nameBoard(c) {
  c.fillStyle = '#2b3450'; px(c, 0, 3, 16, 10);
  c.fillStyle = '#5a6a94'; px(c, 0, 3, 16, 1);
  c.fillStyle = '#1b2135'; px(c, 0, 12, 16, 1);
}

// ---- interiors -------------------------------------------------------

function woodFloor(c) {
  c.fillStyle = PAL.floorWood; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.floorWoodDark;
  px(c, 0, 7, 16, 1); px(c, 0, 15, 16, 1);
  px(c, 5, 0, 1, 8); px(c, 12, 8, 1, 8);
  c.fillStyle = shade(PAL.floorWood, 0.12);
  px(c, 0, 0, 16, 1); px(c, 0, 8, 16, 1);
}

function tileFloor(c) {
  c.fillStyle = PAL.floorTile; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.floorTileAlt; px(c, 0, 0, 8, 8); px(c, 8, 8, 8, 8);
  c.fillStyle = shade(PAL.floorTileAlt, -0.12);
  px(c, 0, 7, 16, 1); px(c, 7, 0, 1, 16);
}

function carpetTile(c) {
  c.fillStyle = PAL.carpet; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.carpetDark;
  for (let y = 0; y < 16; y += 2) for (let x = (y / 2) % 2; x < 16; x += 2) px(c, x, y);
}

function gymFloor(c) {
  c.fillStyle = shade(PAL.floorTile, -0.05); px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.uiFrame; px(c, 0, 0, 16, 1); px(c, 0, 0, 1, 16);
  c.fillStyle = shade(PAL.uiFrameLight, 0.2); px(c, 1, 1, 14, 2);
  c.fillStyle = shade(PAL.floorTile, -0.14); px(c, 2, 4, 12, 11);
}

function wallIn(c) {
  c.fillStyle = PAL.wallIn; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.wallInDark;
  px(c, 0, 12, 16, 4);
  for (let x = 0; x < 16; x += 4) px(c, x, 0, 1, 12);
  c.fillStyle = shade(PAL.wallInDark, -0.2); px(c, 0, 12, 16, 1);
}

function counter(c) {
  woodFloor(c);
  c.fillStyle = shade(PAL.floorWoodDark, -0.25); px(c, 0, 2, 16, 14);
  c.fillStyle = PAL.floorWood; px(c, 0, 0, 16, 4);
  c.fillStyle = shade(PAL.floorWood, 0.2); px(c, 0, 0, 16, 1);
}

function pcTile(c) {
  tileFloor(c);
  c.fillStyle = shade(PAL.uiFrame, 0.1); px(c, 2, 2, 12, 13);
  c.fillStyle = PAL.uiFrame; px(c, 2, 13, 12, 2);
  c.fillStyle = '#3ad0e8'; px(c, 4, 4, 8, 6);
  c.fillStyle = '#bff4ff'; px(c, 5, 5, 3, 2);
  c.fillStyle = PAL.uiFrameLight; px(c, 4, 11, 8, 1);
}

function healMachine(c) {
  tileFloor(c);
  c.fillStyle = shade(PAL.uiFrame, 0.12); px(c, 1, 3, 14, 12);
  c.fillStyle = shade(PAL.uiFrame, -0.15); px(c, 1, 13, 14, 2);
  c.fillStyle = '#f0f4ff'; px(c, 3, 5, 10, 5);
  const dots = ['#e04838', '#f0c030', '#48c04a', '#48b8e0', '#a850c0', '#e05a9a'];
  dots.forEach((d, i) => { c.fillStyle = d; px(c, 3 + i * 2, 11, 1, 1); });
}

function martShelf(c) {
  tileFloor(c);
  c.fillStyle = shade(PAL.floorWoodDark, -0.1); px(c, 1, 1, 14, 14);
  c.fillStyle = PAL.floorWood; px(c, 1, 1, 14, 1); px(c, 1, 7, 14, 1);
  const goods = ['#e04838', '#48b8e0', '#f0c030', '#48c04a'];
  for (let i = 0; i < 4; i++) {
    c.fillStyle = goods[i]; px(c, 2 + i * 3, 3, 2, 4);
    c.fillStyle = goods[(i + 2) % 4]; px(c, 2 + i * 3, 9, 2, 4);
  }
}

function bed(c) {
  woodFloor(c);
  c.fillStyle = shade(PAL.sign, -0.1); px(c, 1, 0, 14, 16);
  c.fillStyle = '#e8e4f0'; px(c, 2, 1, 12, 6);
  c.fillStyle = '#5aa0e0'; px(c, 2, 7, 12, 8);
  c.fillStyle = shade('#5aa0e0', -0.2); px(c, 2, 7, 12, 1);
  c.fillStyle = '#f8f8ff'; px(c, 4, 2, 8, 3);
}

function tv(c) {
  woodFloor(c);
  c.fillStyle = PAL.uiFrame; px(c, 1, 3, 14, 11);
  c.fillStyle = '#101828'; px(c, 3, 5, 10, 7);
  c.fillStyle = '#4a90d0'; px(c, 4, 6, 8, 5);
  c.fillStyle = '#a8dcf4'; px(c, 5, 7, 3, 2);
}

function bookshelf(c) {
  c.fillStyle = shade(PAL.floorWoodDark, -0.2); px(c, 0, 0, 16, 16);
  c.fillStyle = shade(PAL.floorWood, -0.1); px(c, 1, 1, 14, 14);
  const cols = ['#c8504e', '#4a6fc0', '#3f9060', '#f0c030', '#a850c0'];
  for (let row = 0; row < 3; row++) {
    c.fillStyle = shade(PAL.floorWoodDark, -0.3); px(c, 1, 5 + row * 5, 14, 1);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = cols[(i + row) % cols.length];
      px(c, 2 + i * 2, 1 + row * 5, 2, 4);
    }
  }
}

function plant(c) {
  woodFloor(c);
  c.fillStyle = shade(PAL.sign, -0.1); px(c, 5, 11, 6, 5);
  c.fillStyle = PAL.sign; px(c, 5, 11, 6, 1);
  c.fillStyle = PAL.treeLeaf;
  px(c, 6, 5, 4, 6); px(c, 4, 7, 8, 3);
  c.fillStyle = PAL.treeLeafLight; px(c, 6, 5, 2, 3); px(c, 5, 8, 2, 1);
  c.fillStyle = PAL.treeLeafDark; px(c, 9, 9, 3, 2);
}

function table(c) {
  woodFloor(c);
  c.fillStyle = shade(PAL.floorWoodDark, -0.15); px(c, 1, 4, 14, 10);
  c.fillStyle = PAL.floorWood; px(c, 1, 3, 14, 3);
  c.fillStyle = shade(PAL.floorWood, 0.15); px(c, 1, 3, 14, 1);
}

function pillar(c) {
  gymFloor(c);
  c.fillStyle = PAL.rockDark; px(c, 2, 0, 12, 16);
  c.fillStyle = PAL.rock; px(c, 3, 0, 10, 16);
  c.fillStyle = PAL.rockLight; px(c, 4, 0, 3, 16);
  c.fillStyle = PAL.rockDark; px(c, 2, 0, 12, 2); px(c, 2, 14, 12, 2);
}

function stairs(up) {
  return (c) => {
    c.fillStyle = PAL.floorTileAlt; px(c, 0, 0, 16, 16);
    for (let i = 0; i < 4; i++) {
      const y = up ? 12 - i * 4 : i * 4;
      c.fillStyle = shade(PAL.floorTile, i * 0.06 - 0.1); px(c, 0, y, 16, 4);
      c.fillStyle = shade(PAL.floorTileAlt, -0.3); px(c, 0, y, 16, 1);
    }
  };
}

function warpPad(c) {
  tileFloor(c);
  c.fillStyle = PAL.uiSelect; px(c, 2, 4, 12, 8);
  c.fillStyle = shade(PAL.uiSelect, 0.3); px(c, 3, 5, 10, 6);
  c.fillStyle = PAL.uiBg; px(c, 5, 7, 6, 2);
}

function caveFloor(c) {
  c.fillStyle = PAL.caveFloor; px(c, 0, 0, 16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const r = h(x, y, 91);
    if (r > 0.9) { c.fillStyle = shade(PAL.caveFloor, 0.12); px(c, x, y); }
    else if (r < 0.08) { c.fillStyle = PAL.caveFloorDark; px(c, x, y); }
  }
}

function caveWall(c) {
  c.fillStyle = PAL.caveWall; px(c, 0, 0, 16, 16);
  c.fillStyle = PAL.caveWallDark;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (h(x, y, 99) > 0.75) px(c, x, y);
  }
  c.fillStyle = shade(PAL.caveWall, 0.18); px(c, 0, 0, 16, 2);
  c.fillStyle = PAL.caveWallDark; px(c, 0, 14, 16, 2);
}

function voidTile(c) {
  c.fillStyle = PAL.black; px(c, 0, 0, 16, 16);
}

// ---- registry --------------------------------------------------------
// solid: blocks movement. tall: triggers wild encounters. ledge: jumpable
// in that direction only. water: needs Surf (not yet obtainable — solid).
// anim: number of animation frames.

export const TILES = {
  ' ': { name: 'void', draw: voidTile, solid: true },
  '.': { name: 'grass', draw: (c, f) => grass(c, f), ground: 'grass' },
  ',': { name: 'grass tuft', draw: grassTuft, ground: 'grass' },
  '"': { name: 'tall grass', draw: tallGrass, tall: true, anim: 2, ground: 'grass' },
  '*': { name: 'flowers', draw: flowers, anim: 2, ground: 'grass' },
  ':': { name: 'path', draw: path, ground: 'path' },
  ';': { name: 'dirt', draw: dirt, ground: 'dirt' },
  's': { name: 'sand', draw: sand, ground: 'sand' },
  'n': { name: 'snow', draw: snow, ground: 'snow' },
  '~': { name: 'water', draw: water, solid: true, water: true, anim: 4, ground: 'water' },
  '-': { name: 'shallows', draw: waterShallow, solid: true, water: true, anim: 4, ground: 'water' },
  'T': { name: 'tree', draw: tree, solid: true, casts: true },
  'Y': { name: 'pine', draw: pine, solid: true, casts: true },
  'R': { name: 'rock', draw: rock, solid: true, casts: true },
  'o': { name: 'boulder', draw: boulder, solid: true, casts: true },
  '^': { name: 'cliff', draw: cliff, solid: true, casts: true },
  'L': { name: 'ledge', draw: ledge, ledge: 'down' },
  '=': { name: 'bridge', draw: bridge },
  'S': { name: 'sign', draw: sign, solid: true, sign: true, casts: true },
  '/': { name: 'fence', draw: fence, solid: true, casts: true },
  '#': { name: 'wall', draw: wallOut, solid: true, casts: true },
  'W': { name: 'window', draw: windowTile, solid: true, casts: true },
  'A': { roof: true, name: 'red roof', draw: roof(PAL.roofRed, PAL.roofRedDark), solid: true },
  'B': { roof: true, name: 'blue roof', draw: roof(PAL.roofBlue, PAL.roofBlueDark), solid: true },
  'G': { roof: true, name: 'green roof', draw: roof(PAL.roofGreen, PAL.roofGreenDark), solid: true },
  'E': { roof: true, name: 'grey roof', draw: roof(PAL.roofGrey, PAL.roofGreyDark), solid: true },
  'D': { name: 'door', draw: door, casts: true },
  'K': { roof: true, name: 'gym roof', draw: roof('#7a8398', '#525a70'), solid: true },
  'N': { name: 'gym wall', draw: gymFront, solid: true, casts: true },
  'Q': { name: 'gym badge plate', draw: gymBadge, solid: true, casts: true },
  'd': { name: 'gym door', draw: gymDoor, casts: true },
  'I': { name: 'stone marker', draw: statue, solid: true, casts: true },
  'F': { name: 'centre front', draw: centerFront, solid: true, casts: true },
  'J': { name: 'mart front', draw: martFront, solid: true, casts: true },
  'V': { name: 'name board', draw: nameBoard, solid: true, casts: true },
  '|': { name: 'inner wall', draw: wallIn, solid: true },
  '_': { name: 'wood floor', draw: woodFloor },
  '+': { name: 'tile floor', draw: tileFloor },
  '%': { name: 'carpet', draw: carpetTile },
  'g': { name: 'gym floor', draw: gymFloor },
  'x': { name: 'counter', draw: counter, solid: true },
  'P': { name: 'PC', draw: pcTile, solid: true },
  'H': { name: 'heal machine', draw: healMachine, solid: true },
  'M': { name: 'shelf', draw: martShelf, solid: true },
  'b': { name: 'bed', draw: bed },
  'v': { name: 'TV', draw: tv, solid: true },
  'k': { name: 'bookshelf', draw: bookshelf, solid: true },
  'p': { name: 'plant', draw: plant, solid: true },
  'e': { name: 'table', draw: table, solid: true },
  '!': { name: 'pillar', draw: pillar, solid: true },
  '<': { name: 'stairs up', draw: stairs(true) },
  '>': { name: 'stairs down', draw: stairs(false) },
  'w': { name: 'warp pad', draw: warpPad },
  'c': { name: 'cave floor', draw: caveFloor, ground: 'cave' },
  'C': { name: 'cave wall', draw: caveWall, solid: true },
};

export const MAX_ANIM = 4;

let atlas = null;
const slot = new Map();   // tile char -> atlas column

// Builds one atlas: columns are tiles, rows are animation frames.
export function buildTileAtlas() {
  const chars = Object.keys(TILES);
  const surf = makeSurface(chars.length * TILE, MAX_ANIM * TILE);
  chars.forEach((ch, i) => {
    slot.set(ch, i);
    const def = TILES[ch];
    const frames = def.anim || 1;
    for (let f = 0; f < MAX_ANIM; f++) {
      const src = f % frames;
      surf.ctx.save();
      surf.ctx.translate(i * TILE, f * TILE);
      surf.ctx.beginPath();
      surf.ctx.rect(0, 0, TILE, TILE);
      surf.ctx.clip();
      def.draw(surf.ctx, src);
      surf.ctx.restore();
    }
  });
  atlas = surf.canvas;
  return atlas;
}

export function drawTile(ctx, ch, x, y, frame = 0) {
  if (!atlas) buildTileAtlas();
  const i = slot.get(ch);
  if (i === undefined) return;
  ctx.drawImage(atlas, i * TILE, (frame % MAX_ANIM) * TILE, TILE, TILE, x, y, TILE, TILE);
}

export function tileDef(ch) { return TILES[ch] || TILES[' ']; }

// ---- autotile edges --------------------------------------------------
// A grid of independent 16x16 squares reads as a grid. The DS games hide
// that by letting the "stronger" ground creep a few pixels over its
// neighbour, so a path through grass has a soft, irregular border rather
// than a staircase of hard corners.
//
// Each ground family gets a rank. When two ground tiles meet, the higher
// rank paints a dithered lip over the lower one — eight pieces per family
// (four sides, four corners), all pre-rendered into one atlas at boot.

const GROUND = {
  //          rank  colours the lip is painted in
  water: { rank: 5, edge: () => [PAL.water, PAL.waterDark] },
  sand: { rank: 4, edge: () => [PAL.sand, shade(PAL.sand, -0.1)] },
  path: { rank: 3, edge: () => [PAL.path, PAL.pathDark] },
  dirt: { rank: 2, edge: () => [PAL.pathDark, shade(PAL.pathDark, -0.12)] },
  snow: { rank: 6, edge: () => [PAL.snow, PAL.snowDark] },
  cave: { rank: 1, edge: () => [PAL.caveFloor, PAL.caveFloorDark] },
  grass: { rank: 0, edge: () => [PAL.grass, PAL.grassDark] },
};

// N, E, S, W, then the four corners. Index order is fixed: worldrender.js
// looks pieces up by this array's index.
export const EDGE_DIRS = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];
const DEPTH = 5;

/** How far into the tile the lip reaches at (x, y) for one direction. */
function reach(dir, x, y) {
  switch (dir) {
    case 0: return DEPTH - y;                 // from the north edge
    case 1: return DEPTH - (15 - x);          // east
    case 2: return DEPTH - (15 - y);          // south
    case 3: return DEPTH - x;                 // west
    case 4: return DEPTH - Math.max(y, 15 - x);
    case 5: return DEPTH - Math.max(15 - y, 15 - x);
    case 6: return DEPTH - Math.max(15 - y, x);
    default: return DEPTH - Math.max(y, x);
  }
}

function paintEdge(c, family, dir) {
  const [base, dark] = GROUND[family].edge();
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = reach(dir, x, y);
      if (d <= 0) continue;
      // Dither: solid at the boundary, thinning to nothing over DEPTH px.
      const keep = d / DEPTH;
      if (h(x, y, dir * 31 + 5) > keep * keep) continue;
      c.fillStyle = d <= 1 ? dark : base;
      px(c, x, y);
    }
  }
}

let edgeAtlas = null;
const edgeSlot = new Map();   // family -> atlas row

function buildEdgeAtlas() {
  const families = Object.keys(GROUND);
  const surf = makeSurface(EDGE_DIRS.length * TILE, families.length * TILE);
  families.forEach((fam, row) => {
    edgeSlot.set(fam, row);
    for (let dir = 0; dir < EDGE_DIRS.length; dir++) {
      surf.ctx.save();
      surf.ctx.translate(dir * TILE, row * TILE);
      surf.ctx.beginPath();
      surf.ctx.rect(0, 0, TILE, TILE);
      surf.ctx.clip();
      paintEdge(surf.ctx, fam, dir);
      surf.ctx.restore();
    }
  });
  edgeAtlas = surf.canvas;
}

export function groundOf(ch) { return tileDef(ch).ground || null; }
export function groundRank(family) { return family ? GROUND[family].rank : -1; }

/** Blit one family's lip for one direction over the tile at (x, y). */
export function drawEdge(ctx, family, dir, x, y) {
  if (!edgeAtlas) buildEdgeAtlas();
  const row = edgeSlot.get(family);
  if (row === undefined) return;
  ctx.drawImage(edgeAtlas, dir * TILE, row * TILE, TILE, TILE, x, y, TILE, TILE);
}

/**
 * The soft shadow a tree or a building throws onto the ground south of it.
 * Drawn as three translucent bands rather than a gradient so it stays crisp
 * at the small logical resolution everything else is drawn at.
 */
/**
 * A roof is authored as a rectangle of identical tiles, which reads as a flat
 * slab. Picking out its ridge and its eaves from the neighbours gives the
 * building a top and a front without any new tile art.
 */
export function drawRoofEdge(ctx, x, y, open) {
  ctx.save();
  if (open.up) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, y + 1, TILE, 1);
  }
  if (open.down) {
    ctx.fillStyle = 'rgba(16,24,40,0.40)';
    ctx.fillRect(x, y + TILE - 2, TILE, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x, y + TILE - 3, TILE, 1);
  }
  if (open.left) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x, y, 1, TILE); }
  if (open.right) { ctx.fillStyle = 'rgba(16,24,40,0.30)'; ctx.fillRect(x + TILE - 1, y, 1, TILE); }
  ctx.restore();
}

export function drawCastShadow(ctx, x, y, fromAbove, fromLeft) {
  ctx.save();
  ctx.fillStyle = '#101828';
  if (fromAbove) {
    ctx.globalAlpha = 0.20;
    ctx.fillRect(x, y, TILE, 3);
    ctx.globalAlpha = 0.12;
    ctx.fillRect(x, y + 3, TILE, 2);
  }
  if (fromLeft) {
    ctx.globalAlpha = 0.14;
    ctx.fillRect(x, y, 3, TILE);
  }
  ctx.restore();
}
