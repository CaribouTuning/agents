// The numbers that are the game.
//
// Everything else here can be rebuilt. The jump arc cannot: it is found by
// hand, it is what the levels are designed around, and a refactor that moves
// it by ten percent silently invalidates every gap in the world. So the arc,
// the glide and the two forgivenesses are pinned.
import { makeHero, updateHero, STATE } from '../src/game/hero.js';
import { MOVE } from '../src/game/physics.js';
import { PLAYGROUND } from '../src/data/levels.js';

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};
const NONE = { left: 0, right: 0, up: 0, down: 0, jump: 0, jumpHeld: 0, fist: 0 };
const inp = (o) => ({ ...NONE, ...o });

/** Drop a hero onto the ground and let them settle. */
function grounded() {
  const h = makeHero(PLAYGROUND.spawn.x, PLAYGROUND.spawn.y);
  for (let i = 0; i < 200 && !h.body.onGround; i++) updateHero(h, PLAYGROUND, NONE, 1 / 60);
  return h;
}

console.log('--- standing on the ground ---');
{
  const h = grounded();
  check(h.body.onGround, 'the hero falls to the floor and stops', `y=${h.body.y}`);
  check(h.state === STATE.STAND, 'and stands there', h.state);
}

console.log('\n--- the jump ---');
{
  const h = grounded();
  const floor = h.body.y;
  let peak = floor;
  updateHero(h, PLAYGROUND, inp({ jump: 1, jumpHeld: 1 }), 1 / 60);
  for (let i = 0; i < 120; i++) {
    updateHero(h, PLAYGROUND, inp({ jumpHeld: 1 }), 1 / 60);
    peak = Math.min(peak, h.body.y);
    if (h.body.onGround && i > 4) break;
  }
  const held = floor - peak;
  check(held > 40 && held < 60, 'a held jump clears about three tiles', `${held.toFixed(1)}px`);
  check(h.body.onGround, 'and comes back down');

  // The same jump, released immediately, must be markedly shorter.
  const t = grounded();
  const floor2 = t.body.y;
  let peak2 = floor2;
  updateHero(t, PLAYGROUND, inp({ jump: 1, jumpHeld: 1 }), 1 / 60);
  for (let i = 0; i < 120; i++) {
    updateHero(t, PLAYGROUND, NONE, 1 / 60);
    peak2 = Math.min(peak2, t.body.y);
    if (t.body.onGround && i > 4) break;
  }
  const tapped = floor2 - peak2;
  check(tapped < held * 0.62, 'a tapped jump is much shorter than a held one',
    `${tapped.toFixed(1)}px vs ${held.toFixed(1)}px`);
  check(tapped > 8, 'but still a real hop', `${tapped.toFixed(1)}px`);
}

console.log('\n--- the helicopter ---');
{
  const h = grounded();
  updateHero(h, PLAYGROUND, inp({ jump: 1, jumpHeld: 1 }), 1 / 60);
  let sawGlide = false;
  let fallSpeed = 0;
  for (let i = 0; i < 200; i++) {
    updateHero(h, PLAYGROUND, inp({ jumpHeld: 1 }), 1 / 60);
    // Sample the drift only while he is still in the air: the frame he
    // touches down is also a glide frame, and its vy is zero because the
    // floor has just stopped him.
    if (h.state === STATE.GLIDE && !h.body.onGround) { sawGlide = true; fallSpeed = h.body.vy; }
    if (h.body.onGround && i > 6) break;
  }
  check(sawGlide, 'holding jump through the apex starts the glide');
  check(Math.abs(fallSpeed - MOVE.glideFall) < 0.01, 'and the fall settles to a drift',
    `vy=${fallSpeed.toFixed(2)}`);

  // The point of the move: it has to cross a gap a jump cannot.
  const plain = grounded();
  updateHero(plain, PLAYGROUND, inp({ jump: 1, jumpHeld: 1, right: 1 }), 1 / 60);
  const x0 = plain.body.x;
  for (let i = 0; i < 200; i++) {
    updateHero(plain, PLAYGROUND, inp({ right: 1 }), 1 / 60);
    if (plain.body.onGround && i > 6) break;
  }
  const jumpRange = plain.body.x - x0;

  const glider = grounded();
  updateHero(glider, PLAYGROUND, inp({ jump: 1, jumpHeld: 1, right: 1 }), 1 / 60);
  const x1 = glider.body.x;
  for (let i = 0; i < 200; i++) {
    updateHero(glider, PLAYGROUND, inp({ right: 1, jumpHeld: 1 }), 1 / 60);
    if (glider.body.onGround && i > 6) break;
  }
  const glideRange = glider.body.x - x1;
  check(glideRange > jumpRange * 1.4, 'and carries you much further than a jump alone',
    `${glideRange.toFixed(0)}px vs ${jumpRange.toFixed(0)}px`);
}

console.log('\n--- the two forgivenesses nobody notices ---');
{
  // Coyote: walk off a ledge, then press jump a few frames later.
  const h = grounded();
  for (let i = 0; i < 400; i++) {
    updateHero(h, PLAYGROUND, inp({ right: 1 }), 1 / 60);
    if (!h.body.onGround) break;
  }
  const fellAt = h.body.y;
  updateHero(h, PLAYGROUND, inp({ right: 1 }), 1 / 60);
  updateHero(h, PLAYGROUND, inp({ right: 1 }), 1 / 60);
  updateHero(h, PLAYGROUND, inp({ right: 1, jump: 1, jumpHeld: 1 }), 1 / 60);
  check(h.body.vy < 0, 'a jump pressed just after walking off an edge still fires',
    `vy=${h.body.vy.toFixed(2)} (fell from y=${fellAt.toFixed(0)})`);
}
{
  // Buffer: press jump while still in the air, land, and it should fire.
  const h = grounded();
  // A full-height jump: the button has to be HELD, or the jump-cut turns it
  // into a hop that never falls fast enough to be worth buffering. Getting
  // that wrong is what made this test fail against a working game.
  updateHero(h, PLAYGROUND, inp({ jump: 1, jumpHeld: 1 }), 1 / 60);
  for (let i = 0; i < 40 && h.body.vy < 0; i++) {
    updateHero(h, PLAYGROUND, inp({ jumpHeld: 1 }), 1 / 60);
  }
  let pressed = false;
  let firedOnLanding = false;
  for (let i = 0; i < 200; i++) {
    // One press, while still falling and clearly above the ground, and then
    // nothing at all. Without a buffer it is simply lost.
    const press = !pressed && h.body.vy > 4.2 && !h.body.onGround;
    if (press) pressed = true;
    updateHero(h, PLAYGROUND, press ? inp({ jump: 1, jumpHeld: 1 }) : NONE, 1 / 60);
    if (pressed && h.body.justLeftGround && h.body.vy < -1) { firedOnLanding = true; break; }
    if (pressed && h.body.onGround && i > 30) break;
  }
  check(pressed, 'the test got a fast-falling frame to press on');
  check(firedOnLanding, 'a jump pressed just before landing fires on landing');
}

console.log('\n--- he cannot walk through the world ---');
{
  const h = grounded();
  for (let i = 0; i < 900; i++) updateHero(h, PLAYGROUND, inp({ left: 1 }), 1 / 60);
  check(h.body.x >= 0, 'running at the left edge stops at it', `x=${h.body.x.toFixed(1)}`);
  const below = h.body.y + h.body.h;
  check(below <= PLAYGROUND.height * 16 + 1, 'and he never ends up under the floor',
    `bottom=${below.toFixed(1)}`);
}

console.log(fails ? `\n${fails} failed` : '\nthe feel is where it was left');
process.exit(fails ? 1 : 0);
