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
    skin: '#f6c9a0', skinWarm: '#ffd9b4', skinDark: '#cf9268',
    hair: '#38271a', hairLit: '#5d422c',
    coat: '#e04a34', coatDark: '#9e2f20', coatTrim: '#f7a08a',
    scarf: '#fbf4e2', scarfDark: '#cfc3aa',
    glove: '#fffdf6', gloveDark: '#d9d2c0',
    boot: '#3f4a63', bootDark: '#252d40', sole: '#e6e0cf',
    hairStyle: 'short',
  },
  sam: {
    skin: '#fbd2ac', skinWarm: '#ffe2c4', skinDark: '#d69b72',
    hair: '#b35d24', hairLit: '#d9853f',
    coat: '#3d92dd', coatDark: '#22629f', coatTrim: '#9ed2f6',
    scarf: '#ffd3e4', scarfDark: '#dfa0ba',
    glove: '#fffdf6', gloveDark: '#d9d2c0',
    boot: '#5a4d75', bootDark: '#362d4b', sole: '#e6e0cf',
    hairStyle: 'bob',
  },
};

// Characters are built smoother than the world they stand in. The landscape is
// deliberately faceted; if the people are faceted to match, they sink into it.
// The extra bands cost nothing at this scale and they are what makes a
// character read as the thing on screen that is alive.
const FINE = [14, 20];

/**
 * The head.
 *
 * Not a ball with a face painted on the front — that was the first version and
 * it is why these two looked dead. A head needs VOLUME below the eyes: a cheek
 * and jaw mass pushed down and forward off the cranium, so the face turns a
 * corner instead of being a decal on a sphere. The eyes get a highlight, which
 * is one extra sphere each and does more for whether anybody is home behind
 * them than everything else in this file put together.
 *
 * The whole head is then scaled down at the end. It was as wide as the entire
 * torso, which is not a style — it is a proportion nobody chose.
 */
function buildHead(look) {
  const b = new Builder();
  b.push(0, 0, 0, 0.88);

  // Hair shell, which is the whole head from behind.
  b.push(0, 0.05, -0.05);
  sphere(b, 0.44, look.hair, FINE[0], FINE[1], 0.97);
  b.pop();

  if (look.hairStyle === 'bob') {
    for (const sx of [-1, 1]) {
      b.push(sx * 0.31, -0.2, -0.11);
      sphere(b, 0.15, look.hair, 8, 10, 1.7);
      b.pop();
      b.push(sx * 0.26, -0.42, -0.13);
      sphere(b, 0.105, look.hairLit, 7, 9, 1.1);
      b.pop();
    }
    b.push(0, -0.18, -0.27);
    sphere(b, 0.18, look.hair, 8, 10, 1.15);
    b.pop();
  } else {
    b.push(0, -0.1, -0.27);
    sphere(b, 0.2, look.hair, 8, 10, 0.9);
    b.pop();
  }

  // The face, forward of the hair so the hairline is a clean curve.
  b.push(0, -0.03, 0.11);
  sphere(b, 0.4, look.skin, FINE[0], FINE[1]);
  b.pop();
  // Cheeks and jaw: the mass that stops the face being a flat disc. Lower and
  // further forward than the cranium, and a shade warmer so the light breaks
  // across the join instead of gliding over it.
  b.push(0, -0.19, 0.16);
  sphere(b, 0.33, look.skinWarm, 12, 16, 0.82);
  b.pop();
  b.push(0, -0.3, 0.13);
  sphere(b, 0.21, look.skin, 10, 12, 0.78);
  b.pop();

  // A fringe sitting on the hairline, swept across.
  for (const [x, y, z, r] of [[-0.2, 0.28, 0.24, 0.155], [0.02, 0.32, 0.27, 0.175],
    [0.24, 0.28, 0.21, 0.145]]) {
    b.push(x, y, z);
    sphere(b, r, look.hairLit, 9, 11, 0.72);
    b.pop();
  }
  for (const sx of [-1, 1]) {
    b.push(sx * 0.34, 0.02, 0.12);
    sphere(b, 0.13, look.hair, 8, 10, 1.25);
    b.pop();
  }

  // Eyes. Big, set into the face, each with a dark pupil and a highlight
  // catching the sun from the same side the world is lit from.
  for (const s of [-1, 1]) {
    b.push(s * 0.155, 0.05, 0.39);
    sphere(b, 0.165, '#ffffff', 12, 14);
    b.pop();
    b.push(s * 0.168, 0.04, 0.51);
    sphere(b, 0.072, '#221a2e', 10, 12);
    b.pop();
    b.push(s * 0.21, 0.105, 0.53);
    sphere(b, 0.032, '#ffffff', 6, 8);
    b.pop();
    // A brow, seated ON the forehead — pushed out to meet the eyes it clears
    // the cheek and floats beside the head in three-quarter view.
    b.push(s * 0.175, 0.225, 0.36);
    box(b, 0.105, 0.03, 0.05, look.hair);
    b.pop();
  }
  b.push(0, -0.12, 0.47);
  sphere(b, 0.062, look.skinDark, 8, 10);
  b.pop();

  b.pop();
  return b.build();
}

/**
 * The body: a flared tunic with shoulders on top of it.
 *
 * The first version was a sphere, and a sphere has no silhouette — it is the
 * same shape from every angle and it told you nothing about which way the
 * character was facing or where their shoulders were. A cone does both for the
 * same number of triangles: narrow at the top, wide at the hem, so the eye
 * gets a direction and the coat gets a hang to it.
 */
function buildBody(look) {
  const b = new Builder();

  // The tunic. Only a gentle taper — a steep one is a traffic cone, and a
  // traffic cone has no shoulders, which is what the second attempt at this
  // shipped: a smooth red funnel with a stripe down it.
  b.push(0, -0.24, 0);
  tube(b, 0.40, 0.34, 0.57, look.coat, 16, false);
  b.pop();
  // A darker hem, which separates the coat from the legs below it.
  b.push(0, -0.29, 0);
  tube(b, 0.42, 0.41, 0.07, look.coatDark, 16, false);
  b.pop();
  b.push(0, -0.29, 0);
  disc(b, 0.42, look.coatDark, 16, 0);
  b.pop();

  // Shoulders. WIDER than the top of the tunic, which is the entire point:
  // the step out from the body is what the eye reads as a pair of shoulders,
  // and without it a character has a neck going straight into a skirt.
  b.push(0, 0.33, 0);
  sphere(b, 0.37, look.coat, 13, 18, 0.6);
  b.pop();
  for (const sx of [-1, 1]) {
    b.push(sx * 0.3, 0.29, 0);
    sphere(b, 0.15, look.coatDark, 9, 11, 0.85);
    b.pop();
  }
  // A trim stripe down the front, so there is a front.
  b.push(0, -0.04, 0.3);
  box(b, 0.05, 0.26, 0.05, look.coatTrim);
  b.pop();

  // The scarf, wide enough to clear the jaw above it and read as a ring.
  b.push(0, 0.43, 0);
  sphere(b, 0.40, look.scarf, 12, 18, 0.4);
  b.pop();
  b.push(0, 0.38, 0);
  sphere(b, 0.32, look.scarfDark, 10, 14, 0.38);
  b.pop();
  // The tail: blobs tapering down and back, because cloth is not a rectangle.
  for (const [ty, tz, tr, tc] of [[0.3, -0.34, 0.15, look.scarf],
    [0.1, -0.4, 0.12, look.scarfDark], [-0.08, -0.43, 0.085, look.scarf]]) {
    b.push(0, ty, tz);
    sphere(b, tr, tc, 8, 11, 1.25);
    b.pop();
  }
  return b.build();
}

/**
 * A hand: a mitten with a thumb and a cuff.
 *
 * A bare sphere is not a hand. It has no front, so it cannot point, and with
 * nothing to catch the light it reads as a dropped ball rather than something
 * attached to a person. The thumb gives it a direction and the cuff gives the
 * arm that is not there somewhere to have ended.
 */
function buildHand(look) {
  const b = new Builder();
  b.push(0, -0.02, 0.03);
  sphere(b, 0.155, look.glove, 11, 14, 1.12);
  b.pop();
  // A groove suggesting fingers, one shade down.
  b.push(0, -0.12, 0.07);
  sphere(b, 0.115, look.gloveDark, 9, 11, 0.62);
  b.pop();
  b.push(0.115, 0.02, 0.07);
  sphere(b, 0.062, look.glove, 8, 10, 1.15);
  b.pop();
  // The cuff, in the coat colour, so the hands belong to the outfit.
  b.push(0, 0.13, -0.03);
  sphere(b, 0.125, look.coat, 10, 12, 0.6);
  b.pop();
  b.push(0, 0.18, -0.03);
  sphere(b, 0.1, look.coatDark, 8, 10, 0.45);
  b.pop();
  return b.build();
}

/**
 * A boot: a rounded shell with a turned-up toe and a pale sole.
 *
 * The sole is the point. Two grey lumps under a character are two grey lumps;
 * the same lumps with a light band along the bottom read as footwear, and they
 * separate from the ground instead of melting into it.
 */
function buildBoot(look) {
  const b = new Builder();
  b.push(0, 0.06, 0);
  sphere(b, 0.185, look.boot, 11, 13, 0.78);
  b.pop();
  b.push(0, 0.02, 0.15);
  sphere(b, 0.145, look.boot, 10, 12, 0.72);
  b.pop();
  b.push(0, -0.055, 0.04);
  sphere(b, 0.185, look.sole, 10, 13, 0.3);
  b.pop();
  // A cuff at the ankle, dark, which caps the leg that is not there.
  b.push(0, 0.19, -0.01);
  sphere(b, 0.135, look.bootDark, 9, 11, 0.55);
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
  scene.draw(art.head, x, y + 1.42 * sy, z, yaw, sxz, sy, sxz);
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
