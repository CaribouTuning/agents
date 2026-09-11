// Unified input: physical keyboard (desktop dev) + on-canvas virtual
// gamepad (phones). Everything downstream reads logical buttons only, so
// no screen or system ever needs to know which one the player used.

// `exit` is not a physical button. It is the virtual one behind the BACK
// chip on screens where B already means something else — backspace, on the
// typing screens — so a thumb still has a way off them.
export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select', 'exit'];

const KEY_MAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyZ: 'a', Enter: 'a', Space: 'a',
  KeyX: 'b', Escape: 'b', Backspace: 'b',
  KeyQ: 'start', Tab: 'start',
  KeyE: 'select',
};

class Input {
  constructor() {
    this.held = new Set();
    this.edge = new Set();        // pressed since last endFrame()
    this.released = new Set();
    this.repeatAt = new Map();    // button -> next auto-repeat time
    this.touchButtons = new Map();// touch id -> button
    this.hitTest = null;          // set by the control-layout renderer
    this.anyInputAt = 0;
    this.enabled = true;
    // Taps that did NOT land on the virtual gamepad. Menus consume these so
    // the player can just touch the option they want instead of steering a
    // cursor to it — the single biggest usability win on a phone.
    this.taps = [];
    this.pending = new Map();   // touch id -> {x, y, t, moved}
  }

  attach(canvas, display) {
    // The canvas backing store is logical * dpr * scale, but every hit test
    // in the game is in logical pixels. Pointer coordinates must be mapped
    // into that same space or nothing on screen is touchable.
    this.display = display || null;
    window.addEventListener('keydown', (e) => {
      const b = KEY_MAP[e.code];
      if (!b) return;
      e.preventDefault();
      if (!e.repeat) this.press(b);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      const b = KEY_MAP[e.code];
      if (!b) return;
      e.preventDefault();
      this.release(b);
    }, { passive: false });

    window.addEventListener('blur', () => this.releaseAll());

    const point = (t) => {
      const r = canvas.getBoundingClientRect();
      const lw = this.display ? this.display.width : canvas.width;
      const lh = this.display ? this.display.height : canvas.height;
      return {
        x: ((t.clientX - r.left) / r.width) * lw,
        y: ((t.clientY - r.top) / r.height) * lh,
      };
    };

    const onStart = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        const p = point(t);
        const b = this.hitTest && this.hitTest(p.x, p.y);
        if (b) { this.touchButtons.set(t.identifier, b); this.press(b); }
        else this.pending.set(t.identifier, { x: p.x, y: p.y, t: performance.now(), moved: false });
      }
    };

    // Sliding a thumb from one control to another hands the press over,
    // otherwise D-pad rolls feel sticky.
    const onMove = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        const pend = this.pending.get(t.identifier);
        if (pend) {
          const q = point(t);
          if (Math.hypot(q.x - pend.x, q.y - pend.y) > 6) pend.moved = true;
        }
        if (!this.touchButtons.has(t.identifier)) continue;
        const p = point(t);
        const next = this.hitTest && this.hitTest(p.x, p.y);
        const prev = this.touchButtons.get(t.identifier);
        if (next === prev) continue;
        if (prev) this.release(prev);
        if (next) { this.touchButtons.set(t.identifier, next); this.press(next); }
        else this.touchButtons.delete(t.identifier);
      }
    };

    const onEnd = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const b = this.touchButtons.get(t.identifier);
        if (b) this.release(b);
        this.touchButtons.delete(t.identifier);
        const pend = this.pending.get(t.identifier);
        this.pending.delete(t.identifier);
        if (pend && !pend.moved && performance.now() - pend.t < 700 && this.enabled) {
          this.taps.push({ x: pend.x, y: pend.y });
          this.anyInputAt = performance.now();
        }
      }
    };

    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('touchcancel', onEnd, { passive: false });

    // Mouse mirrors touch so the virtual pad is testable on a desktop.
    let mouseBtn = null;
    let mouseDownAt = null;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      const p = point(e);
      const b = this.hitTest && this.hitTest(p.x, p.y);
      if (b) { mouseBtn = b; this.press(b); }
      else mouseDownAt = { ...p, t: performance.now() };
    });
    window.addEventListener('mouseup', (e) => {
      if (mouseBtn) { this.release(mouseBtn); mouseBtn = null; return; }
      if (mouseDownAt && this.enabled) {
        const p = point(e);
        if (Math.hypot(p.x - mouseDownAt.x, p.y - mouseDownAt.y) < 6) this.taps.push({ x: p.x, y: p.y });
      }
      mouseDownAt = null;
    });
  }

  press(b) {
    this.anyInputAt = performance.now();
    if (!this.held.has(b)) {
      this.held.add(b);
      this.edge.add(b);
      this.repeatAt.set(b, performance.now() + 260);
    }
  }

  release(b) {
    this.held.delete(b);
    this.repeatAt.delete(b);
    this.released.add(b);
  }

  releaseAll() {
    for (const b of [...this.held]) this.release(b);
    this.touchButtons.clear();
    this.pending.clear();
    this.taps.length = 0;
  }

  isDown(b) { return this.held.has(b); }

  // True once per physical press.
  pressed(b) { return this.edge.has(b); }

  // True on press and then on auto-repeat — for menu cursors.
  repeated(b) {
    if (this.edge.has(b)) return true;
    if (!this.held.has(b)) return false;
    const now = performance.now();
    const at = this.repeatAt.get(b) ?? Infinity;
    if (now >= at) { this.repeatAt.set(b, now + 90); return true; }
    return false;
  }

  // Pops the oldest unhandled tap, if any. Screens call this once per frame
  // and hit-test it against whatever they have on screen.
  consumeTap() { return this.taps.length ? this.taps.shift() : null; }
  clearTaps() { this.taps.length = 0; }

  // Called by the loop at the end of every logic tick.
  endFrame() { this.edge.clear(); this.released.clear(); this.taps.length = 0; }

  direction() {
    if (this.isDown('up')) return 'up';
    if (this.isDown('down')) return 'down';
    if (this.isDown('left')) return 'left';
    if (this.isDown('right')) return 'right';
    return null;
  }
}

export const input = new Input();
