// Saving.
//
// The backend is an interface, not localStorage. Today the only
// implementation is LocalBackend; a cloud backend (per-account slots synced
// across the two players' phones) drops in behind the same three methods
// without any game code changing.
import { storage } from '../core/storage.js';
import { serializeState, deserializeState } from '../game/state.js';

export const SAVE_SLOT = 'save1';
const SAVE_VERSION = 1;
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

  async hasSave(slot = SAVE_SLOT) { return !!(await this.peek(slot)); }

  async erase(slot = SAVE_SLOT) { return this.backend.remove(slot); }

  // Forward-compatibility hook. Old saves are upgraded here rather than being
  // rejected, so a content update never costs the players their game.
  migrate(raw) {
    let data = raw;
    if (!data.v || data.v < 1) data = { ...data, v: 1 };
    return data;
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

export const saveManager = new SaveManager();
