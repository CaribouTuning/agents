// Glimmer — entry point.
//
// A movement test, at this stage, and deliberately nothing more. There is one
// field, no enemies, no collectibles and no reason to be there. If it is not
// already fun to run to the far ledge and glide down off it, the answer is to
// keep editing the numbers in hero.js, not to add a world.

import { display, TILE } from './render/canvas.js';
import { GameLoop } from './core/loop.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { PAL } from './render/palette.js';
import { drawSky, drawParallax, drawLevel } from './render/worldrender.js';
import { drawHero } from './render/heroart.js';
import { makeHero, updateHero, heroCentre, STATE } from './game/hero.js';
import { PLAYGROUND } from './data/levels.js';
import { MOVE } from './game/physics.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class Game {
  constructor() {
    this.display = display;
    this.level = PLAYGROUND;
    this.hero = makeHero(this.level.spawn.x, this.level.spawn.y, 'matthew');
    this.cam = { x: 0, y: 0 };
    this.dust = [];
    this.loop = null;
    this.showHelp = 240;
  }

  boot(canvas) {
    display.attach(canvas);
    input.attach(canvas, display);
    const unlock = () => { audio.unlock(); audio.resume(); };
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
      window.addEventListener(ev, unlock, { passive: true });
    }
    this.snapCamera();
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: () => this.render() });
    this.loop.start();
  }

  /** The buttons, from a keyboard or from the two big circles on the glass. */
  readInput() {
    return {
      left: input.isDown('left'),
      right: input.isDown('right'),
      up: input.isDown('up'),
      down: input.isDown('down'),
      jump: input.pressed('a'),
      jumpHeld: input.isDown('a'),
      fist: input.pressed('b'),
    };
  }

  update(dt) {
    const h = this.hero;
    const before = h.state;
    updateHero(h, this.level, this.readInput(), dt);

    if (h.body.justLanded) this.puff(h, 5);
    if (before !== STATE.GLIDE && h.state === STATE.GLIDE) audio.sfx('select');
    if (h.state === STATE.RUN && h.body.onGround && Math.random() < 0.18) this.puff(h, 1);

    // Fell out of the world: put him back rather than falling for ever.
    if (h.body.y > this.level.height * TILE + 40) {
      h.body.x = this.level.spawn.x;
      h.body.y = this.level.spawn.y;
      h.body.vx = 0; h.body.vy = 0;
    }

    this.tickDust();
    this.followCamera();
    if (this.showHelp > 0) this.showHelp--;
    input.endFrame();
  }

  puff(h, n) {
    const b = h.body;
    for (let i = 0; i < n; i++) {
      this.dust.push({
        x: b.x + b.w / 2 + (Math.random() - 0.5) * b.w,
        y: b.y + b.h,
        vx: (Math.random() - 0.5) * 0.8 - b.vx * 0.25,
        vy: -Math.random() * 0.5,
        life: 1,
      });
    }
  }

  tickDust() {
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.x += d.vx; d.y += d.vy;
      d.vy += 0.02;
      d.life -= 0.045;
      if (d.life <= 0) this.dust.splice(i, 1);
    }
  }

  /**
   * The camera leads where he is going.
   *
   * A camera centred on the player shows you as much of where you have been
   * as where you are heading, which is exactly backwards. The lookahead is
   * eased rather than snapped so turning round does not whip the view.
   */
  followCamera() {
    const { width: W, height: H } = display;
    const c = heroCentre(this.hero);
    const lead = clamp(this.hero.body.vx / MOVE.runMax, -1, 1) * (W * 0.16);
    const targetX = c.x - W / 2 + lead;
    // Vertically: hold a band rather than track, so small hops do not move
    // the world under the player's feet.
    const band = H * 0.12;
    const eyeY = c.y - H / 2;
    let targetY = this.cam.y;
    if (eyeY < this.cam.y - band) targetY = eyeY + band;
    if (eyeY > this.cam.y + band) targetY = eyeY - band;

    this.cam.x += (targetX - this.cam.x) * 0.11;
    this.cam.y += (targetY - this.cam.y) * 0.09;
    this.clampCamera();
  }

  clampCamera() {
    const { width: W, height: H } = display;
    const maxX = Math.max(0, this.level.width * TILE - W);
    const maxY = Math.max(0, this.level.height * TILE - H);
    this.cam.x = clamp(this.cam.x, 0, maxX);
    this.cam.y = clamp(this.cam.y, 0, maxY);
  }

  snapCamera() {
    const { width: W, height: H } = display;
    const c = heroCentre(this.hero);
    this.cam.x = c.x - W / 2;
    this.cam.y = c.y - H / 2;
    this.clampCamera();
  }

  render() {
    const c = display.begin();
    const { width: W, height: H } = display;

    drawSky(c, W, H, this.cam.y);
    drawParallax(c, W, H, this.cam.x, this.cam.y);
    drawLevel(c, this.level, this.cam, W, H);

    for (const d of this.dust) {
      c.globalAlpha = d.life * 0.5;
      c.fillStyle = PAL.paper;
      c.beginPath();
      c.arc(d.x - this.cam.x, d.y - this.cam.y, 1.6 * d.life + 0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    const h = this.hero;
    drawHero(c, h, h.body.x - this.cam.x, h.body.y - this.cam.y);

    this.drawControls(c, W, H);
    if (this.showHelp > 0) this.drawHelp(c, W, H);
  }

  /** Two thumbs, landscape: steering on the left, jump on the right. */
  drawControls(c, W, H) {
    const pad = { x: 30, y: H - 34, r: 20 };
    const jump = { x: W - 34, y: H - 34, r: 21 };
    c.globalAlpha = 0.34;
    c.fillStyle = PAL.ink;
    c.beginPath(); c.arc(pad.x - 21, pad.y, pad.r * 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(pad.x + 21, pad.y, pad.r * 0.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2e6fd0';
    c.beginPath(); c.arc(jump.x, jump.y, jump.r, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = PAL.paper;
    const tri = (x, y, dir) => {
      c.beginPath();
      c.moveTo(x + 5 * dir, y - 6); c.lineTo(x + 5 * dir, y + 6); c.lineTo(x - 5 * dir, y);
      c.closePath(); c.fill();
    };
    tri(pad.x - 21, pad.y, 1);
    tri(pad.x + 21, pad.y, -1);
    c.globalAlpha = 0.9;
    c.beginPath(); c.arc(jump.x, jump.y - 3, 6, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    input.hitTest = (x, y) => {
      const near = (p, r) => (x - p.x) ** 2 + (y - p.y) ** 2 < r * r;
      if (near({ x: pad.x - 21, y: pad.y }, pad.r)) return 'left';
      if (near({ x: pad.x + 21, y: pad.y }, pad.r)) return 'right';
      if (near(jump, jump.r + 6)) return 'a';
      return null;
    };
  }

  drawHelp(c, W, H) {
    const a = Math.min(1, this.showHelp / 60);
    c.globalAlpha = a * 0.85;
    c.fillStyle = PAL.ink;
    c.fillRect(0, 8, W, 30);
    c.globalAlpha = a;
    c.fillStyle = PAL.paper;
    c.font = '9px ui-monospace, Menlo, monospace';
    c.textAlign = 'center';
    c.fillText('MOVE  ← →      JUMP  Z / tap', W / 2, 21);
    c.fillText('HOLD JUMP WHILE FALLING TO GLIDE', W / 2, 33);
    c.textAlign = 'left';
    c.globalAlpha = 1;
  }
}

const game = new Game();
function start() {
  const canvas = document.getElementById('game');
  game.boot(canvas);
  window.GLIMMER = game;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

export { Game };
