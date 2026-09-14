// Glimmer — entry point.
//
// A 3D exploration platformer. At this stage: one meadow, two characters
// built from spheres, and a camera. Nothing to collect and nowhere to go,
// because the first question is still the only question — is running around
// it, jumping, and catching yourself on the way down a pleasure?

import { initGL, getGL } from './gl/gl.js';
import { Scene } from './render/scene.js';
import { GameLoop } from './core/loop.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { buildTestWorld } from './game/world3d.js';
import { buildCharacter, buildRotor, drawCharacter } from './render/heroart3d.js';
import { makeHero, updateHero, heroPose, STATE } from './game/hero3d.js';
import { clamp, angleDelta } from './gl/math.js';

const DPR_CAP = 2;

class Game {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.scene = null;
    this.w = 1; this.h = 1;

    this.world = null;
    this.hero = null;
    this.arts = {};
    this.rotors = {};

    // The camera orbits the hero. `yaw` is where it sits, `wantYaw` where it
    // is heading — it follows the character round rather than snapping.
    this.camYaw = 0;
    this.camPitch = 0.30;
    this.camDist = 7.0;
    this.camHeight = 2.1;
    this.camLook = { x: 0, y: 0, z: 0 };
    this.dragging = null;
    this.stick = { x: 0, z: 0, active: false, id: null, ox: 0, oy: 0 };
    this.showHelp = 6;
    this.fps = 60;
  }

  boot(canvas) {
    this.canvas = canvas;
    this.gl = initGL(canvas);
    if (!this.gl) {
      document.body.innerHTML = '<p style="color:#fff;font:14px sans-serif;padding:2em">'
        + 'This device cannot run WebGL, which this game needs.</p>';
      return;
    }
    this.scene = new Scene();

    const built = buildTestWorld();
    this.world = built.world;
    this.worldMesh = built.mesh;
    this.vertexCount = built.vertexCount;

    // Both of them are built at boot. The game is about the two of us, so
    // whichever one you are, the other has to exist from the first frame —
    // there is no version of this where one of them is a later feature.
    this.arts = {};
    this.rotors = {};
    for (const look of ['matt', 'sam']) {
      this.arts[look] = buildCharacter(look);
      this.rotors[look] = buildRotor(look);
    }
    this.hero = makeHero(built.spawn.x, built.spawn.y, built.spawn.z, 'matt');

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.attachTouch();

    const unlock = () => { audio.unlock(); audio.resume(); };
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
      window.addEventListener(ev, unlock, { passive: true });
    }

    this.camYaw = this.hero.yaw;
    this.snapCamera();
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: () => this.render() });
    this.loop.start();
  }

  /** Who you are playing. The other one is the one walking with you. */
  setLook(look) {
    if (!this.arts[look]) return;
    this.hero.look = look;
  }

  get art() { return this.arts[this.hero.look]; }
  get rotor() { return this.rotors[this.hero.look]; }

  /** One physics frame with no input — for settling the character to a pose. */
  updateHeroFrame(dt) {
    updateHero(this.hero, this.world,
      { mx: 0, mz: 0, jump: false, jumpHeld: false, camYaw: this.camYaw }, dt);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    this.cssW = w; this.cssH = h;
  }

  /**
   * Two thumbs. The left half of the glass is a floating stick — it appears
   * wherever the thumb lands, which on a phone with no edges to feel for is
   * the only kind that works. The right half jumps, and dragging there turns
   * the camera.
   */
  attachTouch() {
    const cv = this.canvas;
    const pt = (t) => {
      const r = cv.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const onStart = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const p = pt(t);
        if (p.x < this.cssW * 0.45) {
          this.stick.id = t.identifier;
          this.stick.ox = p.x; this.stick.oy = p.y;
          this.stick.active = true;
          this.stick.x = 0; this.stick.z = 0;
        } else {
          this.dragging = { id: t.identifier, x: p.x, y: p.y, moved: 0 };
          this.jumpDown = true;
          this.jumpEdge = true;
        }
      }
    };
    const onMove = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const p = pt(t);
        if (this.stick.active && t.identifier === this.stick.id) {
          const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy;
          const max = Math.min(this.cssW, this.cssH) * 0.11;
          const l = Math.hypot(dx, dy);
          const k = l > max ? max / l : 1;
          this.stick.x = (dx * k) / max;
          this.stick.z = (dy * k) / max;
        } else if (this.dragging && t.identifier === this.dragging.id) {
          const dx = p.x - this.dragging.x;
          this.camYaw -= dx * 0.007;
          this.dragging.moved += Math.abs(dx);
          this.dragging.x = p.x; this.dragging.y = p.y;
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (this.stick.active && t.identifier === this.stick.id) {
          this.stick.active = false; this.stick.x = 0; this.stick.z = 0; this.stick.id = null;
        }
        if (this.dragging && t.identifier === this.dragging.id) {
          this.dragging = null;
          this.jumpDown = false;
        }
      }
    };
    cv.addEventListener('touchstart', onStart, { passive: false });
    cv.addEventListener('touchmove', onMove, { passive: false });
    cv.addEventListener('touchend', onEnd, { passive: false });
    cv.addEventListener('touchcancel', onEnd, { passive: false });
  }

  readInput() {
    // Keyboard for the desk, the glass for the phone; whichever is pushing.
    let mx = 0, mz = 0;
    if (input.isDown('left')) mx -= 1;
    if (input.isDown('right')) mx += 1;
    if (input.isDown('up')) mz -= 1;
    if (input.isDown('down')) mz += 1;
    if (this.stick.active) { mx += this.stick.x; mz += this.stick.z; }
    const jumpHeld = input.isDown('a') || !!this.jumpDown;
    const jump = input.pressed('a') || !!this.jumpEdge;
    this.jumpEdge = false;
    return { mx: clamp(mx, -1, 1), mz: clamp(mz, -1, 1), jump, jumpHeld, camYaw: this.camYaw };
  }

  update(dt) {
    const h = this.hero;
    const was = h.state;
    updateHero(h, this.world, this.readInput(), dt);
    if (was !== STATE.GLIDE && h.state === STATE.GLIDE) audio.sfx('select');
    if (h.a.justLanded) audio.sfx('cursor');

    // Fell off the world.
    if (h.a.y < -25) {
      h.a.x = 0; h.a.y = 3; h.a.z = 4;
      h.a.vx = h.a.vy = h.a.vz = 0;
    }

    this.followCamera(dt);
    if (this.showHelp > 0) this.showHelp -= dt;
    input.endFrame();
  }

  /**
   * The camera drifts round to sit behind the hero when they are running, and
   * stays put when they are not — so it never fights a player who has just
   * turned the view on purpose.
   */
  followCamera(dt) {
    const h = this.hero;
    const a = h.a;
    const moving = Math.hypot(a.vx, a.vz) > 1.2;
    if (moving && !this.dragging) {
      this.camYaw += angleDelta(this.camYaw, h.yaw) * Math.min(1, 1.1 * dt);
    }
    const lookY = a.y + 0.9;
    this.camLook.x += (a.x - this.camLook.x) * Math.min(1, 9 * dt);
    this.camLook.y += (lookY - this.camLook.y) * Math.min(1, 5 * dt);
    this.camLook.z += (a.z - this.camLook.z) * Math.min(1, 9 * dt);

    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const s = this.scene;
    s.target[0] = this.camLook.x;
    s.target[1] = this.camLook.y;
    s.target[2] = this.camLook.z;
    s.eye[0] = this.camLook.x - Math.sin(this.camYaw) * this.camDist * cp;
    s.eye[1] = this.camLook.y + this.camHeight + sp * this.camDist * 0.6;
    s.eye[2] = this.camLook.z - Math.cos(this.camYaw) * this.camDist * cp;
  }

  snapCamera() {
    const a = this.hero.a;
    this.camLook.x = a.x; this.camLook.y = a.y + 0.9; this.camLook.z = a.z;
    this.followCamera(1);
  }

  render() {
    const s = this.scene;
    s.clear(this.w, this.h);
    s.begin(this.w, this.h);
    s.draw(this.worldMesh, 0, 0, 0, 0, 1, 1, 1);

    const h = this.hero;
    drawCharacter(s, this.art, heroPose(h));

    if (h.state === STATE.GLIDE || h.rotor > 0.3) {
      s.draw(this.rotor, h.a.x, h.a.y + 1.62, h.a.z, h.rotor, 1, 1, 1);
    }
  }
}

const game = new Game();
function start() {
  const canvas = document.getElementById('game');
  input.attach(canvas, { width: window.innerWidth, height: window.innerHeight });
  game.boot(canvas);
  window.GLIMMER = game;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

export { Game };
