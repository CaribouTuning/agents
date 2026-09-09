// One place for every colour in the game. Keeping the palette small and
// shared is what makes procedurally-drawn tiles and sprites look like they
// came from the same art team.

export const PAL = {
  // UI chrome — the classic handheld cream/navy window.
  uiFrame: '#2b3450',
  uiFrameLight: '#5a6a94',
  uiBg: '#f8f4e4',
  uiBgAlt: '#e6dfc6',
  uiText: '#2b3450',
  uiTextDim: '#7b8099',
  uiTextLight: '#f8f4e4',
  uiShadow: '#b9b096',
  uiHighlight: '#ffd75e',
  uiSelect: '#3f6fd4',
  uiDanger: '#d8493f',

  // World.
  grass: '#6cb04a',
  grassDark: '#4f8c37',
  grassTall: '#3f7a2c',
  grassTallLight: '#57a03a',
  path: '#d9c290',
  pathDark: '#c0a672',
  sand: '#e8d69c',
  water: '#4a8fd8',
  waterDark: '#3670b4',
  waterLight: '#7bb6ec',
  treeLeaf: '#2f7a3c',
  treeLeafLight: '#46a052',
  treeLeafDark: '#1f5a2c',
  treeTrunk: '#7a5230',
  rock: '#9a9284',
  rockDark: '#6e685e',
  rockLight: '#bdb5a6',
  cliff: '#a08668',
  cliffDark: '#7a6249',
  floorWood: '#c99a5e',
  floorWoodDark: '#a87a44',
  floorTile: '#d8d4c6',
  floorTileAlt: '#c2beb0',
  carpet: '#c8504e',
  carpetDark: '#a03a38',
  wallIn: '#e9d9b8',
  wallInDark: '#c8b48c',
  roofRed: '#c8504e',
  roofRedDark: '#9c3a38',
  roofBlue: '#4a6fc0',
  roofBlueDark: '#37539a',
  roofGreen: '#3f9060',
  roofGreenDark: '#2e6c48',
  roofGrey: '#8a8fa0',
  roofGreyDark: '#666b7c',
  wallOut: '#e8dcc0',
  wallOutDark: '#c4b493',
  window: '#7fd4f0',
  windowDark: '#4fa8cc',
  door: '#8a5a32',
  doorDark: '#6a4224',
  snow: '#eef4fa',
  snowDark: '#cfdcea',
  caveFloor: '#7a6f66',
  caveFloorDark: '#5e544c',
  caveWall: '#4a4249',
  caveWallDark: '#332d33',
  flowerRed: '#e05a5a',
  flowerYellow: '#f0d055',
  flowerPink: '#f090c0',
  flowerWhite: '#f4f0e0',
  sign: '#9a6a3a',
  ledge: '#b99a68',
  bridge: '#b98a54',
  bridgeDark: '#94693c',

  // Battle.
  hpGreen: '#48c04a',
  hpYellow: '#f0c030',
  hpRed: '#e04838',
  expBlue: '#48b8e0',
  battleGroundA: '#8cc86a',
  battleGroundB: '#6ea84e',
  battleSky: '#a8dcf4',

  // Status chips.
  statusPSN: '#a850c0',
  statusBRN: '#e06830',
  statusPAR: '#e0c030',
  statusSLP: '#8890a8',
  statusFRZ: '#68c8e8',
  statusFNT: '#606878',

  black: '#0d1020',
  white: '#ffffff',
};

// Type colours — used by the Pokédex, move lists and battle chips.
export const TYPE_COLORS = {
  Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Grass: '#78c850',
  Electric: '#f8d030', Ice: '#98d8d8', Fighting: '#c03028', Poison: '#a040a0',
  Ground: '#e0c068', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820',
  Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848',
  Steel: '#b8b8d0',
};

export function typeColor(t) { return TYPE_COLORS[t] || '#a8a878'; }

// Darken/lighten helpers for procedural shading.
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amount >= 0) {
    r += (255 - r) * amount; g += (255 - g) * amount; b += (255 - b) * amount;
  } else {
    r *= 1 + amount; g *= 1 + amount; b *= 1 + amount;
  }
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1)}`;
}
