// The two of you, built out of spheres.
//
// These are original characters — Matt and Sam, two small explorers with
// scarves, drawn from primitives here rather than taken from anywhere. The
// hands and boots float free of the body, which is a stylisation this whole
// design is built around: it means the character needs no skeleton, no
// weights and no animation data, and every pose is four springs arriving
// somewhere slightly late. The lag IS the performance.
//
// Each part is its own mesh so it can be placed independently. That is four
// draw calls per character, which at this triangle count is free.

import { Builder, sphere, box, tube, disc } from '../gl/shapes.js';

export const LOOKS = {
  matt: {
    skin: '#f0c49a', skinDark: '#cf9b70',
    hair: '#3b2a1d', hairLit: '#5a4230',
    coat: '#d9503c', coatDark: '#a5382a',
    scarf: '#f5efe2', scarfDark: '#d8d0bd',
    glove: '#fbfbf6', boot: '#4a5568', bootDark: '#333c4d',
    hairStyle: 'short',
  },
  sam: {
    skin: '#f5cba4', skinDark: '#d4a279',
    hair: '#a9602c', hairLit: '#c8814a',
    coat: '#4f9ad8', coatDark: '#356fa6',
    scarf: '#ffd6e6', scarfDark: '#e0aec2',
    glove: '#fbfbf6', boot: '#57506b', bootDark: '#3c3750',
    hairStyle: 'bob',
  },
};

/**
 * The head: a ball of hair with a face pushed forward out of it.
 *
 * The obvious way — a skin ball with a squashed hair ball sitting on top —
 * does not survive being looked at. Two spheres of similar size intersect in
 * a scalloped circle, so the hairline comes out as a row of triangular teeth
 * with forehead showing between them, and any tuft built from a cone reads as
 * a horn. Offsetting the FACE forward instead makes the boundary a clean
 * circle running behind the cheeks, which is a haircut.
 *
 * Eyes are geometry rather than a texture — two white spheres sunk into the
 * skull with a dark one in front of each. At this polygon count that is
 * cheaper than a texture atlas and it means the eyes catch the light.
 */
function buildHead(look) {
  const b = new Builder();

  // The hair, which is the whole head from behind.
  b.push(0, 0.03, -0.05);
  sphere(b, 0.44, look.hair, 10, 14, 0.97);
  b.pop();

  // A longer cut falls past the jaw at the sides and gathers at the nape.
  if (look.hairStyle === 'bob') {
    for (const sx of [-1, 1]) {
      b.push(sx * 0.31, -0.2, -0.11);
      sphere(b, 0.145, look.hair, 7, 9, 1.7);
      b.pop();
      b.push(sx * 0.26, -0.4, -0.13);
      sphere(b, 0.1, look.hairLit, 6, 8, 1.1);
      b.pop();
    }
    b.push(0, -0.18, -0.26);
    sphere(b, 0.17, look.hair, 7, 9, 1.15);
    b.pop();
  } else {
    b.push(0, -0.1, -0.26);
    sphere(b, 0.19, look.hair, 7, 9, 0.9);
    b.pop();
  }

  // The face, pushed forward so the hairline is a clean circle behind it.
  b.push(0, -0.035, 0.1);
  sphere(b, 0.4, look.skin, 10, 14);
  b.pop();

  // A fringe: three soft blobs sitting on the hairline, swept to one side.
  // Spheres, not cones — a cone here is a horn, every time.
  const sweep = [[-0.19, 0.27, 0.24, 0.15], [0.03, 0.31, 0.26, 0.17],
    [0.24, 0.27, 0.2, 0.14]];
  for (const [x, y, z, r] of sweep) {
    b.push(x, y, z);
    sphere(b, r, look.hairLit, 7, 9, 0.72);
    b.pop();
  }
  // Sideburns, which stop the face reading as a mask stuck on a ball.
  for (const sx of [-1, 1]) {
    b.push(sx * 0.33, 0.02, 0.12);
    sphere(b, 0.13, look.hair, 6, 8, 1.25);
    b.pop();
  }

  // Eyes, facing +Z. The face is 0.1 forward, so these are too.
  for (const s of [-1, 1]) {
    b.push(s * 0.16, 0.02, 0.38);
    sphere(b, 0.145, '#ffffff', 8, 10);
    b.pop();
    b.push(s * 0.17, 0.02, 0.49);
    sphere(b, 0.06, '#1b1426', 6, 8);
    b.pop();
    // A brow, which is most of the expression at this size. It has to sit ON
    // the forehead, not in front of it: pushed out to meet the eyes it clears
    // the cheek entirely and floats beside the head in three-quarter view.
    b.push(s * 0.17, 0.185, 0.355);
    box(b, 0.1, 0.026, 0.05, look.hair);
    b.pop();
  }
  // Nose.
  b.push(0, -0.1, 0.47);
  sphere(b, 0.07, look.skinDark, 6, 8);
  b.pop();
  return b.build();
}

/** The body: a rounded torso in a coat, wearing a scarf that hides the neck. */
function buildBody(look) {
  const b = new Builder();
  b.push(0, 0.02, 0);
  sphere(b, 0.34, look.coat, 9, 12, 1.15);
  b.pop();
  b.push(0, -0.18, 0);
  sphere(b, 0.29, look.coatDark, 7, 10, 0.7);
  b.pop();
  // The scarf: a fat ring at the shoulders and a tail trailing behind.
  // It has to be WIDER than the head is at that height or it vanishes inside
  // it, which is how the first pass shipped a character with no scarf.
  b.push(0, 0.3, 0);
  sphere(b, 0.35, look.scarf, 8, 14, 0.4);
  b.pop();
  // The tail. Three blobs tapering down and back, because a scarf is cloth
  // and cloth is not a rectangle — the flat card this replaced read as a
  // luggage label pinned to her back.
  for (const [ty, tz, tr, tc] of [[0.2, -0.3, 0.14, look.scarf],
    [0.02, -0.36, 0.11, look.scarfDark], [-0.14, -0.38, 0.08, look.scarf]]) {
    b.push(0, ty, tz);
    sphere(b, tr, tc, 6, 9, 1.25);
    b.pop();
  }
  return b.build();
}

/** A hand: a mitten with a cuff. Drawn facing +Z, turned by the caller. */
function buildHand(look) {
  const b = new Builder();
  sphere(b, 0.15, look.glove, 7, 10);
  b.push(0, 0, -0.13);
  sphere(b, 0.115, look.coat, 6, 8, 0.8);
  b.pop();
  // A thumb, so a hand has a direction.
  b.push(0.1, 0.06, 0.05);
  sphere(b, 0.06, look.glove, 5, 6);
  b.pop();
  return b.build();
}

/** A boot: a squashed ball with a sole and a turned-up toe. */
function buildBoot(look) {
  const b = new Builder();
  b.push(0, 0.02, 0.02);
  sphere(b, 0.18, look.boot, 7, 10, 0.68);
  b.pop();
  b.push(0, -0.06, 0.06);
  sphere(b, 0.165, look.bootDark, 6, 8, 0.35);
  b.pop();
  b.push(0, 0.0, 0.16);
  sphere(b, 0.1, look.boot, 5, 8, 0.8);
  b.pop();
  return b.build();
}

/** The soft blob under everything, which is what plants a character. */
function buildShadow() {
  const b = new Builder();
  disc(b, 0.42, '#1a1a28', 16, 0);
  return b.build();
}

/**
 * One character's meshes. Built once; the game holds two of these.
 */
export function buildCharacter(lookName) {
  const look = LOOKS[lookName] || LOOKS.matt;
  return {
    look,
    head: buildHead(look),
    body: buildBody(look),
    hand: buildHand(look),
    boot: buildBoot(look),
    shadow: buildShadow(),
  };
}

/**
 * Draws a character from its parts.
 *
 * `pose` carries where the springs have got to — four world positions and a
 * facing — so this function makes no decisions at all. Everything expressive
 * happened in the update.
 */
export function drawCharacter(scene, art, pose) {
  const { x, y, z, yaw, squash, shadowY, shadowScale } = pose;

  if (shadowScale > 0.01) {
    scene.draw(art.shadow, x, shadowY + 0.02, z, 0, shadowScale, 1, shadowScale,
      0.28 * shadowScale);
  }

  const sy = 1 - squash * 0.18;
  const sxz = 1 + squash * 0.16;

  // Boots and the far hand first: no depth sorting is needed because the
  // depth buffer handles it, but drawing the body last keeps the silhouette
  // clean when parts intersect.
  for (const p of pose.boots) {
    scene.draw(art.boot, p.x, p.y, p.z, p.yaw !== undefined ? p.yaw : yaw, 1, 1, 1, 1, p.pitch || 0);
  }
  for (const p of pose.hands) {
    scene.draw(art.hand, p.x, p.y, p.z, p.yaw !== undefined ? p.yaw : yaw, 1, 1, 1, 1, p.pitch || 0);
  }

  scene.draw(art.body, x, y + 0.62 * sy, z, yaw, sxz, sy, sxz);
  scene.draw(art.head, x, y + 1.24 * sy, z, yaw, sxz, sy, sxz);
}

/**
 * The spinning hair, drawn only while gliding.
 *
 * Built as a separate mesh because it is a different thing from the hair on
 * the head: a blurred disc with two blades, turned fast about the vertical.
 */
export function buildRotor(lookName) {
  const look = LOOKS[lookName] || LOOKS.matt;
  const b = new Builder();
  for (const s of [-1, 1]) {
    b.push(s * 0.3, 0, 0);
    sphere(b, 0.3, look.hairLit, 5, 8, 0.16);
    b.pop();
  }
  b.push(0, 0, 0);
  sphere(b, 0.09, look.hair, 5, 6, 1.4);
  b.pop();
  return b.build();
}
