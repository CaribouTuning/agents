// Drawing somebody with no arms and no legs.
//
// This is the one place where the reference design is a gift rather than a
// problem. A character made of a head, a body and four detached parts is
// almost impossible to draw badly at this size, needs no sprite sheet, and —
// the part that matters here — can be drawn from shapes we own outright
// rather than from anybody's copyrighted art.
//
// Nothing is posed. The hands and feet arrive wherever `hero.js` sprung them
// to, and this file only decides what a hand looks like once it is there.

import { PAL, shade } from './palette.js';
import { STATE } from '../game/hero.js';

const TAU = Math.PI * 2;

/** Per-character colours. Two of them, because there are two of you. */
export const LOOKS = {
  matthew: {
    hair: '#3c2a1c', hairLit: '#5b422c',
    shirt: PAL.shirt, shirtDark: PAL.shirtDark,
    scarf: '#f4f0e6',
  },
  sammy: {
    hair: '#a8632c', hairLit: '#c8834a',
    shirt: '#5aa0e0', shirtDark: '#3a72ac',
    scarf: '#ffd9e8',
  },
};

function disc(c, x, y, r, fill) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = fill;
  c.fill();
}

/**
 * One hand. A rounded mitten with a cuff, turned to face the way it is
 * travelling so a thrown fist reads as a punch rather than as a floating egg.
 */
function drawHand(c, p, look, scale, angle) {
  const r = 3.3 * scale;
  c.save();
  c.translate(p.x, p.y);
  c.rotate(angle || 0);
  disc(c, 0.4, 0.4, r, 'rgba(20,14,30,0.22)');
  disc(c, 0, 0, r, PAL.glove);
  disc(c, -r * 0.3, -r * 0.35, r * 0.55, shade(PAL.glove, 0.5));
  // The cuff, in the shirt colour, is what ties a detached hand to a person.
  c.fillStyle = look.shirt;
  c.fillRect(-r * 0.9, r * 0.35, r * 1.8, r * 0.7);
  c.restore();
}

/** One shoe. Flatter than a hand, with a sole, and it leans as it moves. */
function drawFoot(c, p, scale, lean) {
  const w = 5.4 * scale, h = 4.0 * scale;
  c.save();
  c.translate(p.x, p.y);
  c.rotate((lean || 0) * 0.25);
  c.fillStyle = 'rgba(20,14,30,0.22)';
  c.beginPath(); c.ellipse(0.4, 0.8, w / 2, h / 2, 0, 0, TAU); c.fill();
  c.fillStyle = PAL.shoe;
  c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU); c.fill();
  c.fillStyle = PAL.shoeDark;
  c.beginPath(); c.ellipse(0, h * 0.28, w / 2, h * 0.22, 0, 0, TAU); c.fill();
  c.fillStyle = shade(PAL.shoe, 0.6);
  c.beginPath(); c.ellipse(-w * 0.18, -h * 0.22, w * 0.2, h * 0.18, 0, 0, TAU); c.fill();
  c.restore();
}

/**
 * The whole character, at a world position already offset by the camera.
 *
 * `squash` runs from -1 (stretched, just left the ground) through 0 to 1
 * (squashed, just landed) and is the cheapest possible weight cue.
 */
export function drawHero(c, h, sx, sy) {
  const look = LOOKS[h.look] || LOOKS.matthew;
  const b = h.body;
  const cx = sx + b.w / 2;
  const cy = sy + b.h / 2;
  const f = h.facing;

  // The hands and feet are simulated in WORLD space — they have to be, since
  // they chase positions derived from the body's world position — but they
  // are drawn here in SCREEN space alongside everything else. Without this
  // offset they stay where the camera first saw them and the character
  // gradually comes apart across the level, which is exactly what it looked
  // like: four white blobs left behind at the start of the field.
  const ox = sx - b.x;
  const oy = sy - b.y;
  const at = (p) => ({ x: p.x + ox, y: p.y + oy });

  // Blink out of existence every other frame while hurt, the old way.
  if (h.invuln > 0 && Math.floor(h.invuln / 4) % 2 === 0) return;

  const sq = h.squash;
  const stretchY = 1 - sq * 0.22;
  const stretchX = 1 + sq * 0.2;

  // --- the ground shadow ---------------------------------------------
  c.save();
  c.globalAlpha = 0.22;
  c.fillStyle = PAL.black;
  c.beginPath();
  c.ellipse(cx, sy + b.h + 1, 6.8, 2.1, 0, 0, TAU);
  c.fill();
  c.restore();

  // --- feet and the far hand go behind the body ------------------------
  drawFoot(c, at(h.footL), 1, b.vx * 0.2);
  drawFoot(c, at(h.footR), 1, b.vx * 0.2);
  drawHand(c, at(f > 0 ? h.handL : h.handR), look, 1, 0);

  // --- body ------------------------------------------------------------
  c.save();
  c.translate(cx, cy + 3);
  c.scale(stretchX, stretchY);
  // A small torso, most of which is the scarf ring.
  c.fillStyle = look.shirtDark;
  c.beginPath(); c.ellipse(0, 2.0, 4.6, 4.1, 0, 0, TAU); c.fill();
  c.fillStyle = look.shirt;
  c.beginPath(); c.ellipse(0, 1.5, 4.1, 3.6, 0, 0, TAU); c.fill();
  c.fillStyle = look.scarf;
  c.beginPath(); c.ellipse(0, -1.4, 5.4, 2.2, 0, 0, TAU); c.fill();
  c.fillStyle = shade(look.scarf, -0.14);
  c.beginPath(); c.ellipse(0, -0.6, 5.4, 1.4, 0, 0, TAU); c.fill();
  c.restore();

  // --- head -------------------------------------------------------------
  c.save();
  c.translate(cx, cy - 5.5);
  c.scale(stretchX, stretchY);

  // Hair first, so the face sits on top of it. While gliding it is a blur
  // above him rather than a shape — that is the whole joke of the move.
  const spin = h.hairSpin;
  if (h.state === STATE.GLIDE && spin > 0.4) {
    // A propeller is not three shapes, it is the smear three shapes leave.
    // Drawn as stacked translucent arcs with one solid blade catching the
    // light, which at this size is the difference between a helicopter and
    // a pair of ears.
    c.save();
    c.translate(0, -10.2);
    for (let ring = 0; ring < 3; ring++) {
      c.globalAlpha = 0.22 + ring * 0.1;
      c.fillStyle = ring === 2 ? shade(look.hairLit, 0.35) : look.hair;
      c.beginPath();
      c.ellipse(0, 0, 10.5 - ring * 1.6, 2.3 - ring * 0.4, 0, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    // One blade you can actually follow, so the spin has a speed.
    c.rotate(spin);
    c.fillStyle = look.hairLit;
    c.beginPath(); c.ellipse(6.6, 0, 4.4, 1.5, 0, 0, TAU); c.fill();
    c.fillStyle = look.hair;
    c.beginPath(); c.ellipse(-6.6, 0, 4.4, 1.5, 0, 0, TAU); c.fill();
    c.restore();
    // The stalk it all spins on.
    c.fillStyle = look.hair;
    c.fillRect(-1.0, -10.4, 2.0, 5.4);
  } else {
    // At rest it is a swept tuft, leaning with the run.
    const lean = Math.max(-1.2, Math.min(1.2, b.vx * 0.35));
    c.fillStyle = look.hair;
    c.beginPath();
    c.moveTo(-2.6, -3.4);
    c.quadraticCurveTo(-1 - lean, -8.4, 3.2 - lean * 1.6, -6.2);
    c.quadraticCurveTo(0.6, -5.2, 2.4, -3.2);
    c.closePath();
    c.fill();
    c.fillStyle = look.hairLit;
    c.beginPath();
    c.moveTo(-1.6, -4.2);
    c.quadraticCurveTo(-0.6 - lean, -7.2, 1.8 - lean, -6.0);
    c.quadraticCurveTo(0.2, -5.4, 0.8, -4.0);
    c.closePath();
    c.fill();
  }

  // The face. Two big whites side by side is the entire read at this size.
  disc(c, 0, 0, 6.0, PAL.skinShade);
  disc(c, 0, -0.45, 5.6, PAL.skin);

  const eyeX = 1.9 * (f > 0 ? 1 : -1);
  disc(c, eyeX - 2.5 * f, -1.1, 2.4, PAL.white);
  disc(c, eyeX + 1.2 * f, -1.1, 2.4, PAL.white);
  const look2 = h.state === STATE.FALL || h.state === STATE.HURT ? 0.5 : 0;
  c.fillStyle = PAL.ink;
  disc(c, eyeX - 2.5 * f + 0.45 * f, -1.0 + look2, 1.1, PAL.ink);
  disc(c, eyeX + 1.2 * f + 0.45 * f, -1.0 + look2, 1.1, PAL.ink);

  // Brows do the acting: angry falling, raised gliding, level otherwise.
  c.strokeStyle = look.hair;
  c.lineWidth = 1.0;
  c.beginPath();
  const browY = h.state === STATE.GLIDE ? -4.6 : -3.9;
  c.moveTo(eyeX - 4.8 * f, browY + (h.state === STATE.HURT ? 1.1 : 0));
  c.lineTo(eyeX + 3.2 * f, browY - (h.state === STATE.HURT ? 0.6 : 0));
  c.stroke();

  // A small nose, and a mouth that opens when he is working.
  disc(c, eyeX + 0.3 * f, 1.5, 1.2, PAL.skinShade);
  if (h.state === STATE.RUN || h.state === STATE.JUMP || h.state === STATE.GLIDE) {
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.ellipse(eyeX - 0.4 * f, 3.4, 1.4, h.state === STATE.GLIDE ? 1.2 : 0.8, 0, 0, TAU);
    c.fill();
  }
  c.restore();

  // --- the near hand, in front ------------------------------------------
  const near = f > 0 ? h.handR : h.handL;
  const angle = h.fist && h.fist.hand === 'R' ? Math.atan2(h.fist.vy, h.fist.vx) : 0;
  drawHand(c, at(near), look, 1, angle);
}

/** The trail a thrown fist leaves, drawn before the fist itself. */
export function drawFist(c, fist) {
  if (!fist) return;
  c.save();
  c.globalAlpha = 0.3;
  c.strokeStyle = PAL.lumCore;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(fist.x - fist.vx * 2.5, fist.y - fist.vy * 2.5);
  c.lineTo(fist.x, fist.y);
  c.stroke();
  c.restore();
}
