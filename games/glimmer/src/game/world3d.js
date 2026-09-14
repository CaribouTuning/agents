// A place to be.
//
// The world is authored as a short list of parts — islands, platforms, trees,
// stepping stones — and each part contributes BOTH the boxes you collide with
// and the triangles you see. Keeping those two in one declaration is the
// whole trick: there is no way for the thing you can see and the thing you
// can stand on to drift apart, which in a 3D platformer is the bug that eats
// a week.

import { Builder, box, sphere, tube, groundPatch } from '../gl/shapes.js';
import { Collision, solid } from './actor.js';
import { makeSet, line, arc, ring, single } from './glimmers.js';

const PALETTE = {
  grass: '#63b246', grassLit: '#86cf5c', grassDeep: '#3f8a36',
  rock: '#8d8b9a', rockLit: '#b0aebb', rockDark: '#5d5b68',
  soil: '#8a5f3a', soilDark: '#5f4128',
  bark: '#7a5230', barkLit: '#9a6c42',
  leaf: '#3f9a4e', leafLit: '#62bb63', leafDeep: '#2c7038',
  plank: '#c08b57', plankDark: '#7d5432',
};

/** Stable per-place noise, so a world looks the same every time it is built. */
function n2(x, z, s = 0) {
  let v = Math.sin(x * 12.9898 + z * 78.233 + s * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * A grassy island: a rounded slab of soil with a green top.
 *
 * The collision is a single box — deliberately, because a player needs to be
 * able to predict where the edge is, and a stepped collision mesh under a
 * smooth-looking rim is how you get invisible ledges that eat jumps.
 */
function island(b, world, x, y, z, rx, rz, opts = {}) {
  const depth = opts.depth || 2.2;
  const top = y;
  world.add(solid(x, top - depth / 2, z, rx, depth / 2, rz, 'ground'));

  // The green top, faceted, with a gentle roll so it is not a table.
  b.push(x, top, z);
  groundPatch(b, rx * 2, rz * 2, Math.max(3, Math.round(rx)), Math.max(3, Math.round(rz)),
    (px, pz) => (n2(px * 0.3 + x, pz * 0.3 + z, 1) - 0.5) * 0.14 - 0.02,
    (px, pz, ny) => {
      const t = n2(Math.floor(px * 1.4), Math.floor(pz * 1.4), 3);
      const base = ny > 0.92 ? (t > 0.6 ? PALETTE.grassLit : PALETTE.grass) : PALETTE.grassDeep;
      return hexToRGB(base);
    });
  b.pop();

  // The soil underneath, tapering in so the island reads as floating rock.
  // Each slab's TOP has to sit below the grass, not above it. It did not,
  // and the soil covered the meadow: the first island in the game was a
  // brown table with trees on it, and the grass was there the whole time
  // underneath.
  b.push(x, top - 0.1, z);
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * 0.26;
    b.push(0, -0.46 - i * 0.62, 0);
    box(b, rx * k, 0.34, rz * k, i === 0 ? PALETTE.soil : PALETTE.soilDark, 0.26);
    b.pop();
  }
  b.push(0, -2.2, 0);
  tube(b, Math.min(rx, rz) * 0.42, 0.05, -1.6, PALETTE.soilDark, 7, false);
  b.pop();
  b.pop();
}

/** A wooden platform you can land on. */
function platform(b, world, x, y, z, rx, rz) {
  world.add(solid(x, y - 0.16, z, rx, 0.16, rz, 'plank'));
  b.push(x, y - 0.16, z);
  box(b, rx, 0.16, rz, PALETTE.plank, 0.3);
  for (const [dx, dz] of [[-rx + 0.2, -rz + 0.2], [rx - 0.2, -rz + 0.2],
    [-rx + 0.2, rz - 0.2], [rx - 0.2, rz - 0.2]]) {
    b.push(dx, -0.5, dz);
    box(b, 0.1, 0.5, 0.1, PALETTE.plankDark);
    b.pop();
  }
  b.pop();
}

/** A tree: trunk you bump into, canopy you do not. */
function tree(b, world, x, y, z, scale = 1) {
  world.add(solid(x, y + 1.2 * scale, z, 0.3 * scale, 1.2 * scale, 0.3 * scale, 'tree'));
  b.push(x, y, z);
  b.push(0, 0, 0);
  tube(b, 0.34 * scale, 0.22 * scale, 2.6 * scale, PALETTE.bark, 8, false);
  b.pop();
  const blobs = [[0, 2.7, 0, 1.1], [-0.7, 2.4, 0.3, 0.75], [0.65, 2.5, -0.35, 0.8],
    [0.1, 3.3, 0.4, 0.7], [-0.3, 3.1, -0.5, 0.65]];
  for (const [bx, by, bz, r] of blobs) {
    b.push(bx * scale, by * scale, bz * scale);
    sphere(b, r * scale, n2(x + bx, z + bz, 5) > 0.5 ? PALETTE.leaf : PALETTE.leafLit, 7, 10, 0.82);
    b.pop();
  }
  b.push(0, 2.2 * scale, 0);
  sphere(b, 0.8 * scale, PALETTE.leafDeep, 6, 8, 0.5);
  b.pop();
  b.pop();
}

/** A standing stone, for landmarks you can see from across the valley. */
function menhir(b, world, x, y, z, h = 3) {
  world.add(solid(x, y + h / 2, z, 0.5, h / 2, 0.5, 'stone'));
  b.push(x, y, z);
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.14;
    b.push(0, h * (i / 4) + h / 8, 0);
    box(b, 0.5 * k, h / 8, 0.5 * k, i % 2 ? PALETTE.rock : PALETTE.rockLit, 0.3);
    b.pop();
  }
  b.pop();
}

function hexToRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * The first place: a meadow with somewhere to climb, a gap only the glide
 * crosses, and a view. Nothing to do in it yet, on purpose.
 */
export function buildTestWorld() {
  const world = new Collision(8);
  const b = new Builder();

  // The main meadow.
  island(b, world, 0, 0, 0, 11, 9);

  // A stair of platforms up to a lookout on the left. The lookout has to be
  // the HIGHEST thing here, because everything else on this side of the world
  // is reached by gliding down from it — and you cannot glide upward. The
  // first draft put the shelf above the lookout, which made the shelf, and
  // every glimmer hanging round it, unreachable by anything.
  // Every step is 1.2, because the jump lifts 1.5 and no further. The first
  // three drafts of this stair rose 1.6 to 1.8 a step: the whole west side of
  // the world, the lookout, the shelf and forty of the glimmers were behind a
  // climb that nothing in the movement set could make.
  platform(b, world, -6.5, 1.2, -5.5, 1.4, 1.4);
  platform(b, world, -8.0, 2.4, -7.2, 1.2, 1.2);
  platform(b, world, -9.2, 3.6, -7.8, 1.1, 1.1);
  island(b, world, -13, 4.8, -12, 3.5, 3.0, { depth: 1.6 });
  menhir(b, world, -13, 4.8, -13.5, 3.4);

  // Stepping stones out across a gap. The last one is far enough that only
  // the helicopter reaches it, which is the one thing this field is for.
  platform(b, world, 8, 0.9, 2, 1.2, 1.2);
  platform(b, world, 12, 1.4, 3.5, 1.1, 1.1);
  platform(b, world, 16.5, 1.8, 5, 1.0, 1.0);
  // Far enough out that the jump cannot make it. A standing jump carries 4.7
  // metres; this gap is 5.5, so it is the glide or nothing — which is the one
  // thing this whole eastern run exists to teach.
  island(b, world, 28, 0.9, 8, 5, 4.5, { depth: 1.8 });

  // A shelf you can only reach by gliding down from the lookout. The glide
  // falls about a third of a metre for every metre it covers, so at ten
  // metres out this has to sit roughly three below where you jumped from.
  island(b, world, 4, 3.2, -14, 3.2, 2.6, { depth: 1.4 });
  menhir(b, world, 4, 3.2, -15.4, 2.2);

  // Trees, scattered but never where you land. Each one carries the height of
  // the ground it stands on: working it out from the position with a chain of
  // conditionals meant every time an island moved, a tree stayed behind and
  // floated.
  for (const [tx, gy, tz, s] of [
    [-5, 0, 3, 1], [-8, 0, 0.5, 0.85], [6, 0, -4, 1.1], [3, 0, 5, 0.9],
    [-2, 0, -7, 1.05], [9, 0, -1, 0.8],
    [26, 0.9, 10, 0.95], [30, 0.9, 6, 1.1],
    [-13, 4.8, -10.5, 0.8],
  ]) {
    tree(b, world, tx, gy, tz, s);
  }

  const mesh = b.build();
  return { world, mesh, glimmers: placeGlimmers(), spawn: { x: 0, y: 1.2, z: 4 },
    vertexCount: b.size };
}

/**
 * Where the glimmers go, which is the level design.
 *
 * Every group here is a sentence. The first line is "come this way". The arcs
 * over the platforms are "that jump works". The long shallow descent over the
 * gap is the only way to explain the glide without a tutorial box, because it
 * is shaped like the thing it is asking you to do — falling slowly, forward,
 * for a long way.
 */
function placeGlimmers() {
  const g = makeSet();

  // Out of the spawn and into the meadow. The first thing you see.
  line(g, 0.5, 1.1, 2.6, 3.4, 1.1, -1.4, 5);

  // Round the tree you would otherwise walk straight past, so the first thing
  // you learn about this world is that it is worth going round things.
  ring(g, -5, 1.15, 3, 2.1, 7);

  // The stair up to the lookout, one arc per jump, on the real trajectory.
  arc(g, -3.8, 1.0, -3.0, -6.5, 2.2, -5.5, 0.9, 5);
  arc(g, -6.5, 2.3, -5.5, -8.0, 3.4, -7.2, 0.7, 4);
  arc(g, -8.0, 3.5, -7.2, -9.2, 4.6, -7.8, 0.6, 4);
  arc(g, -9.2, 4.7, -7.8, -11.5, 5.7, -10.2, 0.6, 5);

  // The reward for getting up there: a ring round the standing stone, which
  // from below reads as a crown and is visible from the whole meadow.
  ring(g, -13, 5.9, -13.5, 1.9, 8);

  // The stepping stones east. Tighter arcs — these are small jumps.
  arc(g, 5.6, 1.1, 0.4, 8, 2.0, 2, 0.7, 4);
  arc(g, 8, 2.0, 2, 12, 2.5, 3.5, 0.8, 5);
  arc(g, 12, 2.5, 3.5, 16.5, 2.9, 5, 0.8, 5);

  // The gap. A long shallow DESCENT, because that is what a glide looks like,
  // and the last few hang out over nothing until you are already committed.
  line(g, 17.2, 3.0, 5.2, 23.8, 1.9, 7.0, 9);

  // The far island, so arriving is worth something.
  ring(g, 28, 2.0, 8, 3.2, 9);

  // And the shelf, which you can only get to by gliding down from the
  // lookout. This run is drawn ON the glide slope — it has to descend, and at
  // the rate a glide actually descends, or it is a row of lights leading
  // somewhere the player cannot follow.
  single(g, -8.6, 5.4, -12.6);
  line(g, -7.4, 5.1, -12.8, 0.6, 3.9, -13.8, 8);
  ring(g, 4, 4.3, -15.4, 1.6, 6);

  return g;
}

export { PALETTE };
