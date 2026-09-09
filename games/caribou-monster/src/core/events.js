// Minimal synchronous event bus. Keeps game systems decoupled from UI:
// systems publish, screens subscribe. No wildcard matching on purpose.
export class EventBus {
  constructor() { this.handlers = new Map(); }

  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(fn);
    return () => this.off(name, fn);
  }

  once(name, fn) {
    const un = this.on(name, (...a) => { un(); fn(...a); });
    return un;
  }

  off(name, fn) {
    const set = this.handlers.get(name);
    if (set) set.delete(fn);
  }

  emit(name, payload) {
    const set = this.handlers.get(name);
    if (!set) return;
    // Copy so handlers may unsubscribe during dispatch.
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus:${name}]`, err); }
    }
  }

  clear() { this.handlers.clear(); }
}

export const bus = new EventBus();
