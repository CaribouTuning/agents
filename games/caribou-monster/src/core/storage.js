// Persistence, in the only way that actually survives a phone.
//
// This file has been rewritten because the previous version did not work, and
// the reason it did not work is worth writing down so nobody does it again:
// it asked for the host storage API **once, synchronously, at script eval
// time**. The bundle is one inline script that runs the instant the page
// parses, and the host injects its API a beat later — so the check always
// missed, we always fell back to localStorage, and the artifact viewer wipes
// localStorage when the artifact is closed. Every session opened on a fresh
// new game.
//
// So: nothing here checks for a provider once. Everything polls until a
// provider appears or a deadline passes, and every write goes to every
// provider we have, because the cost of a redundant write is nothing and the
// cost of a lost save is an evening.
//
// Providers, in order of durability:
//
//   1. `window.storage`          — host key/value store, if this build has one
//   2. `claude.use('db')`        — the artifact document store
//   3. `localStorage`            — works everywhere, survives least
//
// Reads take the newest coherent payload across all of them, so a save
// written on one device shows up on the other, and a save written before a
// provider existed is not lost when one appears.

const PREFIX = 'caribou:';

/** The key the host store is asked for. One save file, one name. */
export const HOST_KEY = 'monsterGameSave';

// How long to keep looking for a provider before deciding there is not one.
// Generous on purpose: a slow phone on a bad connection is the exact case
// this whole file exists for.
const PROVIDER_DEADLINE_MS = 15000;
const POLL_MS = 150;

const now = () => Date.now();

/** Polls for `pick()` to return something truthy, or gives up. */
function waitFor(pick, deadlineMs = PROVIDER_DEADLINE_MS) {
  return new Promise((resolve) => {
    const got = pick();
    if (got) { resolve(got); return; }
    if (typeof window === 'undefined') { resolve(null); return; }
    const until = now() + deadlineMs;
    const timer = setInterval(() => {
      let v = null;
      try { v = pick(); } catch { v = null; }
      if (v) { clearInterval(timer); resolve(v); return; }
      if (now() > until) { clearInterval(timer); resolve(null); }
    }, POLL_MS);
  });
}

// ---- provider 1: window.storage -------------------------------------------

function hostStore() {
  const s = typeof window !== 'undefined' ? window.storage : null;
  return s && typeof s.get === 'function' && typeof s.set === 'function' ? s : null;
}

const hostProvider = {
  name: 'window.storage',
  ready: null,
  handle: null,
  async init() {
    this.handle = await waitFor(hostStore);
    return this.handle;
  },
  async read(slot) {
    if (!this.handle) return null;
    const raw = await this.handle.get(`${HOST_KEY}:${slot}`);
    if (raw == null) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  },
  async write(slot, value) {
    if (!this.handle) return false;
    await this.handle.set(`${HOST_KEY}:${slot}`, JSON.stringify(value));
    return true;
  },
  async remove(slot) {
    if (!this.handle) return;
    if (typeof this.handle.delete === 'function') await this.handle.delete(`${HOST_KEY}:${slot}`);
    else await this.handle.set(`${HOST_KEY}:${slot}`, null);
  },
};

// ---- provider 2: the artifact document store -------------------------------

function claudeUse() {
  const c = typeof window !== 'undefined' ? window.claude : null;
  return c && typeof c.use === 'function' ? c : null;
}

const dbProvider = {
  name: 'artifact-db',
  handle: null,
  async init() {
    const c = await waitFor(claudeUse);
    if (!c) return null;
    // `use` itself resolves late — the contract says never within the first
    // script run, and up to ten seconds after. Racing it against a deadline
    // keeps a missing capability from hanging the boot.
    this.handle = await Promise.race([
      Promise.resolve(c.use('db')).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), PROVIDER_DEADLINE_MS)),
    ]).catch(() => null);
    return this.handle;
  },
  async read(slot) {
    if (!this.handle) return null;
    const snap = await this.handle.doc(`saves/${slot}`).get();
    if (!snap || !snap.exists || !snap.data || !snap.data.payload) return null;
    return JSON.parse(snap.data.payload);
  },
  async write(slot, value) {
    if (!this.handle) return false;
    // One JSON string rather than a nested document: a save is deeply nested
    // and the store caps nesting, so flattening keeps party, bag and flags
    // out of that limit entirely.
    await this.handle.doc(`saves/${slot}`).set({
      payload: JSON.stringify(value),
      savedAt: (value && value.savedAt) || now(),
      name: (value && value.meta && value.meta.name) || '',
      badges: (value && value.meta && value.meta.badges) || 0,
    });
    return true;
  },
  async remove(slot) {
    if (!this.handle) return;
    await this.handle.doc(`saves/${slot}`).delete();
  },
};

// ---- provider 3: localStorage ----------------------------------------------

const localProvider = {
  name: 'localStorage',
  handle: null,
  async init() {
    try {
      const k = `${PREFIX}__probe`;
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      this.handle = localStorage;
    } catch { this.handle = null; }
    return this.handle;
  },
  async read(slot) {
    if (!this.handle) return null;
    const raw = this.handle.getItem(PREFIX + slot);
    return raw == null ? null : JSON.parse(raw);
  },
  async write(slot, value) {
    if (!this.handle) return false;
    this.handle.setItem(PREFIX + slot, JSON.stringify(value));
    return true;
  },
  async remove(slot) {
    if (!this.handle) return;
    this.handle.removeItem(PREFIX + slot);
  },
};

const PROVIDERS = [hostProvider, dbProvider, localProvider];

// ---- the layer -------------------------------------------------------------

let readyPromise = null;

/**
 * Brings up every provider that exists. Safe to call as often as you like;
 * the work happens once.
 */
export function storageReady() {
  if (!readyPromise) {
    readyPromise = Promise.all(PROVIDERS.map(async (p) => {
      try { await p.init(); } catch { p.handle = null; }
      return p;
    })).then(() => PROVIDERS.filter((p) => p.handle));
  }
  return readyPromise;
}

/** Which providers came up. Shown in test mode so a failure is visible. */
export function providerReport() {
  return PROVIDERS.map((p) => ({ name: p.name, up: !!p.handle }));
}

/** True once at least one provider that outlives the tab is up. */
export function isDurable() {
  return !!(hostProvider.handle || dbProvider.handle);
}

export const storage = {
  available() { return PROVIDERS.some((p) => p.handle); },

  /**
   * The newest payload any provider has.
   *
   * Taking the newest rather than the first means a save written on the phone
   * beats a stale one in this tab's localStorage, which is what makes the two
   * players' devices agree.
   */
  async read(slot) {
    await storageReady();
    let best = null;
    for (const p of PROVIDERS) {
      if (!p.handle) continue;
      try {
        const v = await p.read(slot);
        if (!v) continue;
        if (!best || (v.savedAt || 0) > (best.savedAt || 0)) best = v;
      } catch (err) {
        console.warn(`[storage] ${p.name} read failed`, err);
      }
    }
    return best;
  },

  /** Reads only what is in this tab, without waiting for the network. */
  readLocalNow(slot) {
    try {
      const raw = localStorage.getItem(PREFIX + slot);
      return raw == null ? null : JSON.parse(raw);
    } catch { return null; }
  },

  /**
   * Writes everywhere. localStorage first and synchronously, so that even if
   * the page is killed in the next millisecond something survives; the
   * durable providers follow.
   */
  async write(slot, value) {
    let any = false;
    try { localStorage.setItem(PREFIX + slot, JSON.stringify(value)); any = true; } catch { /* full or blocked */ }
    await storageReady();
    for (const p of PROVIDERS) {
      if (!p.handle || p === localProvider) continue;
      try { any = (await p.write(slot, value)) || any; } catch (err) {
        console.warn(`[storage] ${p.name} write failed`, err);
      }
    }
    return any;
  },

  async remove(slot) {
    await storageReady();
    for (const p of PROVIDERS) {
      if (!p.handle) continue;
      try { await p.remove(slot); } catch { /* ignore */ }
    }
  },

  async keys() {
    await storageReady();
    const out = new Set();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out.add(k.slice(PREFIX.length));
      }
    } catch { /* ignore */ }
    return [...out];
  },
};
