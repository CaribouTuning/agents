// A save backend that survives the artifact being closed.
//
// localStorage is not durable inside the claude.ai artifact viewer. The page
// runs in a sandboxed frame whose site data the host is free to drop the
// moment the artifact is closed — which is exactly what was happening: every
// session opened on a fresh new-game screen with no save to continue. The
// `db` capability is server-side, scoped to this artifact, and outlives the
// page, the app being killed, and a republish. It is also shared between the
// two players' devices, which is what makes a save written on one phone
// visible on the other.
//
// Two things shape the design:
//
//  * `claude.use('db')` resolves LATE — never during the first script run,
//    and up to ten seconds later, or `null` if this view cannot run it. So
//    the game must boot without it and pick it up when it lands. `ready()`
//    is what the title screen waits on before deciding whether to offer
//    Continue.
//  * It can be absent for good (running from a file, from the dev server,
//    or in the test harnesses). Every path therefore falls back to
//    localStorage rather than failing.

const COLLECTION = 'saves';
const RESOLVE_TIMEOUT_MS = 10000;

/** Resolves the db namespace once, or null. Never throws, never hangs. */
function resolveDb() {
  const c = typeof window !== 'undefined' ? window.claude : null;
  if (!c || typeof c.use !== 'function') return Promise.resolve(null);
  return Promise.race([
    Promise.resolve(c.use('db')).catch(() => null),
    new Promise((r) => setTimeout(() => r(null), RESOLVE_TIMEOUT_MS)),
  ]).catch(() => null);
}

export class ArtifactDbBackend {
  constructor(fallback) {
    this.name = 'artifact-db';
    this.fallback = fallback;      // LocalBackend, used when db is absent
    this.db = null;
    this.lastError = null;
    this._ready = resolveDb().then((db) => { this.db = db; return db; });
  }

  /**
   * Resolves once we know whether durable storage exists. Callers that need
   * a truthful answer to "is there a save?" — the title screen, chiefly —
   * await this first; everything else can just call and take the fallback.
   */
  ready() { return this._ready; }

  available() { return !!this.db || this.fallback.available(); }

  /** True once we know the save is going somewhere that outlives the tab. */
  durable() { return !!this.db; }

  _doc(slot) { return this.db.doc(`${COLLECTION}/${slot}`); }

  async read(slot) {
    await this._ready;
    if (this.db) {
      try {
        const snap = await this._doc(slot).get();
        // Absence is not an error here — a first-run player has no save.
        if (snap && snap.exists && snap.data && snap.data.payload) {
          return JSON.parse(snap.data.payload);
        }
        // Nothing in the store yet. A save may still exist locally from a
        // session before this backend arrived, so keep looking.
      } catch (err) {
        this.lastError = String((err && err.message) || err);
        console.warn('[save] db read failed, falling back', err);
      }
    }
    return this.fallback.read(slot);
  }

  /**
   * The local copy only, without waiting for the durable half to resolve.
   * The title screen draws from this so the game is on screen immediately,
   * then upgrades itself when `ready()` lands.
   */
  readLocal(slot) { return this.fallback.read(slot); }

  async write(slot, data) {
    // The local copy is written first and unconditionally: it costs nothing,
    // it is instant, and it means a db hiccup never loses a save outright.
    const local = await this.fallback.write(slot, data);
    await this._ready;
    if (!this.db) return local;
    try {
      // One JSON string rather than a nested document: a save is deeply
      // nested and the store caps nesting at 32 levels, so flattening it
      // here keeps party members, bag and flags out of that limit entirely.
      await this._doc(slot).set({
        payload: JSON.stringify(data),
        savedAt: data && data.savedAt ? data.savedAt : Date.now(),
        // Denormalised so a save list can be drawn without parsing.
        name: (data && data.meta && data.meta.name) || '',
        badges: (data && data.meta && data.meta.badges) || 0,
      });
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = String((err && err.message) || err);
      console.warn('[save] db write failed; local copy kept', err);
      return local;
    }
  }

  async remove(slot) {
    await this.fallback.remove(slot);
    await this._ready;
    if (!this.db) return true;
    try { await this._doc(slot).delete(); } catch (err) {
      console.warn('[save] db delete failed', err);
    }
    return true;
  }

  async list() {
    await this._ready;
    if (this.db) {
      try {
        const snap = await this.db.collection(COLLECTION).get();
        const ids = (snap && snap.docs ? snap.docs : []).map((d) => d.id);
        if (ids.length) return ids;
      } catch (err) {
        console.warn('[save] db list failed', err);
      }
    }
    return this.fallback.list();
  }
}
