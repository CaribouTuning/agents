// Saving.
//
// The backend is an interface, not localStorage. Today the only
// implementation is LocalBackend; a cloud backend (per-account slots synced
// across the two players' phones) drops in behind the same three methods
// without any game code changing.
import { storage } from '../core/storage.js';
import { ArtifactDbBackend } from './artifactdb.js';
import { serializeState, deserializeState } from '../game/state.js';
import { MIGRATIONS } from './migrations.js';

export const SAVE_SLOT = 'save1';
export const SAVE_VERSION = 2;
const AUTOSAVE_MS = 45000;

export class LocalBackend {
  constructor() { this.name = 'local'; }
  available() { return storage.available(); }
  async read(slot) { return storage.read(slot); }
  async write(slot, data) { return storage.write(slot, data); }
  async remove(slot) { storage.remove(slot); return true; }
  async list() { return storage.keys().filter((k) => k.startsWith('save')); }
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
    if (this.saving) return false;
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
}

// The default backend keeps a local copy AND, when the page is running as a
// claude.ai artifact, a server-side one. Inside the artifact viewer the local
// copy alone is not durable — closing the artifact can drop it — which is why
// the durable half exists at all.
export const saveManager = new SaveManager(new ArtifactDbBackend(new LocalBackend()));

/** Resolves once we know whether durable storage is available. */
export function saveReady() {
  const b = saveManager.backend;
  return b && typeof b.ready === 'function' ? b.ready() : Promise.resolve(null);
}
