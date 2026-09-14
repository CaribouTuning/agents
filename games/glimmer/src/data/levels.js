// The world, as ASCII.
//
// Each level is one screen-and-a-bit wide at minimum and can be as large as
// it likes; the camera scrolls. Legend lives in tiles.js.
//
// This first one exists to answer one question and no others: is running,
// jumping and gliding around it a pleasure? So it is a field with some
// ledges at every interesting height, a gap only the glide crosses, a pit
// with thorns, some water, and nothing at all to do.

import { LEGAL } from './tiles.js';

function defineLevel(id, def) {
  const rows = def.rows;
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`[level ${id}] row ${i} is ${r.length} wide, expected ${w}`);
    for (const ch of r) {
      if (!LEGAL.has(ch)) throw new Error(`[level ${id}] row ${i} uses unknown tile '${ch}'`);
    }
  });
  // Where the hero starts, taken out of the grid so nothing has to know the
  // spawn character exists at runtime.
  let spawn = def.spawn || null;
  const cleaned = rows.map((r, y) => {
    let out = '';
    for (let x = 0; x < r.length; x++) {
      if (r[x] === '@') { spawn = { x: x * 16, y: y * 16 }; out += '.'; }
      else out += r[x];
    }
    return out;
  });
  return {
    id,
    name: def.name || id,
    rows: cleaned,
    width: w,
    height: rows.length,
    spawn: spawn || { x: 32, y: 32 },
    sky: def.sky || 'day',
  };
}

export const PLAYGROUND = defineLevel('playground', {
  name: 'The Long Meadow',
  rows: [
    '................................................................',
    '................................................................',
    '.........................l......................................',
    '..........l.............lll.................l...................',
    '.........lll...........................l...lll..................',
    '..............................................................._',
    '.........................................____...................',
    '...........____.................................................',
    '....@...........................................................',
    '..........................._____................................',
    '=====.........f.......m.........................................',
    '#####==========================.....................===========.',
    '###############################.....................###########.',
    '##########################^^^^#.....................###########.',
    '###############################......~~~~~~~~~~~~~~~###########.',
    '###############################......~~~~~~~~~~~~~~~###########.',
    '###############################......~~~~~~~~~~~~~~~###########.',
    '################################################################',
  ],
});

export const LEVELS = { playground: PLAYGROUND };
export { defineLevel };
