// One place for every colour.
//
// The other game in this repo is a handheld RPG and its palette is muted and
// sprite-like. This one is painted: Rayman's world is warm, saturated and
// slightly unreal, so the greens go yellow in the light and blue in the
// shade rather than just getting darker.

export const PAL = {
  // Sky, in bands from the top down. Drawn as a gradient, so these are stops.
  skyHigh: '#3d6fd0',
  skyMid: '#6fb8e8',
  skyLow: '#b8e4f0',
  skyGlow: '#f6e7b8',

  // Far hills and canopy, flattened and blued by distance.
  farHill: '#4a6f9e',
  farHillLit: '#5f86b4',
  midHill: '#3f7a63',
  midHillLit: '#57997a',

  // The ground you stand on.
  turf: '#54a83c',
  turfLit: '#7cc94e',
  turfDeep: '#2f7330',
  soil: '#8a5a34',
  soilDark: '#5f3a20',
  soilLit: '#a8743f',
  root: '#6b4526',

  // Wood: branches, platforms, the roots you walk along.
  bark: '#7a5230',
  barkLit: '#a06e40',
  barkDark: '#4e331d',

  // Stone: the ruins and the sanctuaries.
  stone: '#8e8f9a',
  stoneLit: '#b3b4bd',
  stoneDark: '#5c5d68',

  // Water.
  water: '#3f8fd8',
  waterLit: '#7fc4ef',
  waterDeep: '#2a5f9e',

  // The collectibles. A lum is the one thing on screen that emits.
  lum: '#ffe06a',
  lumCore: '#fffbe0',
  lumRed: '#ff7a6a',
  lumGreen: '#8ef07a',
  lumBlue: '#7ac8ff',
  lumPurple: '#c08aff',

  // The hero.
  skin: '#f0c49a',
  skinShade: '#d19a70',
  hair: '#f2c14e',
  hairDark: '#c2912c',
  shirt: '#e8543f',
  shirtDark: '#b23528',
  shoe: '#f0f0f0',
  shoeDark: '#c2c2cc',
  glove: '#f4f4f4',
  gloveDark: '#cfcfd8',
  scarf: '#f0f0f0',

  // UI.
  ink: '#231a2e',
  paper: '#fdf6e3',
  paperShade: '#e6dcc2',
  uiGold: '#ffcb45',
  uiDanger: '#e3573f',
  white: '#ffffff',
  black: '#120c1a',
};

/** Lighten (positive) or darken (negative) a hex colour. */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amount >= 0) { r += (255 - r) * amount; g += (255 - g) * amount; b += (255 - b) * amount; }
  else { r *= 1 + amount; g *= 1 + amount; b *= 1 + amount; }
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1)}`;
}

/** Blend two colours. `t` 0 gives `a`, 1 gives `b`. */
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sa, sb) => Math.round(sa + (sb - sa) * t);
  const r = c((pa >> 16) & 255, (pb >> 16) & 255);
  const g = c((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = c(pa & 255, pb & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
