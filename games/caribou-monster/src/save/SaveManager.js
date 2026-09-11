// Saving.
//
// The backend is an interface, not localStorage. Today the only
// implementation is LocalBackend; a cloud backend (per-account slots synced
// across the two players' phones) drops in behind the same three methods
// without any game code changing.
import { storage, storageReady, isDurable, providerReport, saveDiagnosis } from '../core/storage.js';
import { serializeState, deserializeState } from '../game/state.js';
import { MIGRATIONS } from './migrations.js';

export const SAVE_SLOT = 'save1';
export const SAVE_VERSION = 3;
const AUTOSAVE_MS = 45000;
const FLUSH_DEBOUNCE_MS = 700;

/**
 * The only backend now. `core/storage.js` fans every write out to whichever
 * of the host store, the artifact document store and localStorage exist, and
 * reads back the newest of them, so there is nothing left for a backend to
 * choose between.
 */
export class LocalBackend {
  constructor() { this.name = 'storage'; }
  available() { return storage.available(); }
  ready() { return storageReady(); }
  durable() { return isDurable(); }
  providers() { return providerReport(); }
  diagnose() { return saveDiagnosis(); }
  readLocal(slot) { return storage.readLocalNow(slot); }
  async read(slot) { return storage.read(slot); }
  async write(slot, data) { return storage.write(slot, data); }
  async remove(slot) { await storage.remove(slot); return true; }
  async list() { return (await storage.keys()).filter((k) => k.startsWith('save')); }
}

// Kept deliberately small: it is the shape a server endpoint would need to
// implement, and nothing more.
export class CloudBackend {
  constructor(transport) { this.name = 'cloud'; this.transport = transport; }
  available() { return !!this.transport; }
  async read(slot) { return this.transport.get(slot); }
  async write(slot, data) { return this.transport.put(slot, data); }
  async remove(slot) { return this.transport.del(slot); }
  async list() { return this.transport.list(); }
}

export class SaveManager {
  constructor(backend = new LocalBackend()) {
    this.backend = backend;
    this.lastSaveAt = 0;
    this.dirty = false;
    this.saving = false;
    this.lastError = null;
  }

  available() { return this.backend.available(); }

  markDirty() { this.dirty = true; }

  async save(state, slot = SAVE_SLOT, opts = {}) {
    // A save already in flight used to make this a no-op, which meant the
    // flush on the way out could be the one that got dropped. Queue instead.
    if (this.saving) { this._again = { state, slot }; return false; }
    this.saving = true;
    try {
      const payload = {
        v: SAVE_VERSION,
        savedAt: Date.now(),
        state: serializeState(state),
        meta: {
          name: state.player.name,
          badges: state.badges.length,
          dex: Object.keys(state.dex.caught).length,
          playTimeMs: state.playTimeMs,
          map: state.player.map,
          party: state.party.map((m) => ({ species: m.species, level: m.level, shiny: !!m.shiny })),
        },
      };
      const ok = await this.backend.write(slot, payload);
      if (ok) { this.dirty = false; this.lastSaveAt = Date.now(); this.lastError = null; }
      else this.lastError = 'write failed';
      return !!ok;
    } catch (err) {
      this.lastError = String(err && err.message || err);
      console.warn('[save] failed', err);
      return false;
    } finally {
      this.saving = false;
      void opts;
      const again = this._again;
      this._again = null;
      if (again) this.save(again.state, again.slot);
    }
  }

  async load(slot = SAVE_SLOT) {
    try {
      const raw = await this.backend.read(slot);
      if (!raw || !raw.state) return null;
      const st = deserializeState(this.migrate(raw).state);
      return st;
    } catch (err) {
      console.warn('[save] load failed', err);
      return null;
    }
  }

  async peek(slot = SAVE_SLOT) {
    try {
      const raw = await this.backend.read(slot);
      if (!raw || !raw.state) return null;
      return { ...raw.meta, savedAt: raw.savedAt, version: raw.v };
    } catch { return null; }
  }

  /**
   * A peek that never waits on the network. Used for the first paint of the
   * title screen: showing the menu instantly and adding CONTINUE a moment
   * later beats staring at a blank screen for ten seconds.
   */
  async peekFast(slot = SAVE_SLOT) {
    try {
      const b = this.backend;
      const raw = typeof b.readLocal === 'function' ? await b.readLocal(slot) : await b.read(slot);
      if (!raw || !raw.state) return null;
      return { ...raw.meta, savedAt: raw.savedAt, version: raw.v };
    } catch { return null; }
  }

  async hasSave(slot = SAVE_SLOT) { return !!(await this.peek(slot)); }

  async erase(slot = SAVE_SLOT) { return this.backend.remove(slot); }

  /**
   * Old saves are upgraded here rather than rejected, so a content update
   * never costs the players their game. Steps run in order from whatever
   * version the payload claims up to SAVE_VERSION, so a save may skip any
   * number of releases.
   */
  migrate(raw) {
    let v = Number(raw && raw.v) || 1;
    let state = raw.state;
    for (const step of MIGRATIONS) {
      if (v !== step.from) continue;
      state = step.apply(state);
      v = step.to;
    }
    if (v > SAVE_VERSION) {
      // A save from a newer build. Loading it would silently discard
      // whatever that build added, so say so rather than guessing.
      throw new Error(`save version ${v} is newer than this build (${SAVE_VERSION})`);
    }
    return { ...raw, v, state };
  }

  // Autosave is opportunistic: it never runs during a battle or a trade,
  // because a save captured mid-transaction is the one thing worse than no save.
  maybeAutosave(state, canSave) {
    if (!this.dirty || !canSave) return false;
    if (Date.now() - this.lastSaveAt < AUTOSAVE_MS) return false;
    this.save(state);
    return true;
  }

  /**
   * "Something happened worth keeping" — a Pokemon caught, a battle won, a
   * badge, a heal, a map crossed.
   *
   * Debounced rather than immediate because several of these fire together
   * at the end of a battle, and one write is enough. The debounce is short
   * enough that swiping away a second later still lands, and `flush` cancels
   * it and writes now.
   */
  touch(state) {
    this.dirty = true;
    if (this._pending) clearTimeout(this._pending);
    this._pending = setTimeout(() => { this._pending = null; this.save(state); }, FLUSH_DEBOUNCE_MS);
  }

  /**
   * Write right now, cancelling any debounce. Called when the page is going
   * away, where there is no later.
   */
  flush(state) {
    if (this._pending) { clearTimeout(this._pending); this._pending = null; }
    return this.save(state);
  }
}

export const saveManager = new SaveManager(new LocalBackend());

/** Resolves once every storage provider that exists has come up. */
export function saveReady() { return storageReady(); }
