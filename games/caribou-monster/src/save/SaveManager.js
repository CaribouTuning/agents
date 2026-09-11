// Saving.
//
// The backend is an interface, not localStorage. Today the only
// implementation is LocalBackend; a cloud backend (per-account slots synced
// across the two players' phones) drops in behind the same three methods
// without any game code changing.
import { storage, storageReady, isDurable, providerReport, saveDiagnosis } from '../core/storage.js';
import { serializeState, deserializeState } from '../game/state.js';
import { MIGRATIONS } from './migrations.js';

// One slot per character, not one slot per artifact.
//
// The artifact document store is shared by everyone who opens the page, and
// this page is opened by exactly two people. With a single slot, whichever of
// them saved last owned the only save there was. Matthew's game lives at
// `save-matthew`, Sammy's at `save-sammy`, and neither can tread on the
// other. `save1` is what the first builds wrote; it is still read, once, and
// adopted into whichever character it belongs to.
export const SAVE_SLOT = 'save1';
export const SLOT_PREFIX = 'save-';
export const SLOTS = ['save-matthew', 'save-sammy'];
export const SAVE_VERSION = 3;

/** The slot a given character's game belongs in. */
export function slotForLook(look) {
  const k = String(look || '').toLowerCase();
  return SLOTS.includes(SLOT_PREFIX + k) ? SLOT_PREFIX + k : SLOTS[0];
}

/** The slot a given state belongs in, however old the save is. */
export function slotForState(state) {
  const p = (state && state.player) || {};
  const byLook = SLOT_PREFIX + String(p.look || '').toLowerCase();
  if (SLOTS.includes(byLook)) return byLook;
  return slotForLook(String(p.name || '').toLowerCase());
}
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

  async save(state, slot = null, opts = {}) {
    slot = slot || slotForState(state);
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
      const res = await this.backend.write(slot, payload);
      // `res` reports where the write actually landed. A write that only
      // reached this device is not a failure, but it is not a save either,
      // and the game has to stop calling it one.
      const ok = res && (res.ok !== undefined ? res.ok : !!res);
      this.lastDurable = !!(res && res.durable);
      if (ok) { this.dirty = false; this.lastSaveAt = Date.now(); this.lastError = (res && res.error) || null; }
      else this.lastError = (res && res.error) || 'write failed';
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

  /** Whichever character saved most recently, or null if nobody has. */
  async newestSlot() {
    const all = await this.peekAll();
    return all.length ? all[0].slot : null;
  }

  async load(slot = null) {
    try {
      const use = slot || await this.newestSlot();
      if (!use) return null;
      const raw = await this.backend.read(use);
      if (!raw || !raw.state) return null;
      const st = deserializeState(this.migrate(raw).state);
      return st;
    } catch (err) {
      console.warn('[save] load failed', err);
      return null;
    }
  }

  /**
   * One save's headline, for a CONTINUE row. With no slot it answers for
   * whichever character saved most recently, which is what every caller that
   * predates per-character slots meant by "the save".
   */
  async peek(slot = null) {
    try {
      const use = slot || await this.newestSlot();
      if (!use) return null;
      const raw = await this.backend.read(use);
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

  /** Erases every slot. Only the "wipe this device" paths want this. */
  async eraseAll() {
    for (const slot of [...SLOTS, SAVE_SLOT]) {
      try { await this.backend.remove(slot); } catch { /* already gone */ }
    }
    return true;
  }

  /**
   * Takes a payload read out of a backup file and makes it the live save.
   *
   * It goes through the same migration and the same write path as any other
   * save, so a backup taken from an older build still loads, and the restored
   * game is immediately the one a CONTINUE would find.
   */
  async restore(raw, slot = null) {
    if (!raw || !raw.state) return { ok: false, error: 'not a save file' };
    slot = slot || slotForState(raw.state);
    let payload;
    try { payload = this.migrate(raw); } catch (err) { return { ok: false, error: String(err.message || err) }; }
    const res = await this.backend.write(slot, payload);
    const ok = res && (res.ok !== undefined ? res.ok : !!res);
    this.lastDurable = !!(res && res.durable);
    if (ok) { this.dirty = false; this.lastSaveAt = Date.now(); }
    return { ok: !!ok, slot, meta: payload.meta, error: (res && res.error) || null };
  }

  /**
   * Every character's save, newest first, so the title screen can offer the
   * right CONTINUE rows rather than assuming there is one game.
   *
   * A `save1` left by an older build is adopted here: it is read, written
   * into the slot its character belongs to, and then ignored forever.
   */
  async peekAll() {
    const out = [];
    for (const slot of SLOTS) {
      const meta = await this.peek(slot);
      if (meta) out.push({ slot, meta });
    }
    try {
      const legacy = await this.backend.read(SAVE_SLOT);
      if (legacy && legacy.state) {
        // Only adopt a legacy save this build can actually open. Copying one
        // it cannot migrate would put an unreadable game in a live slot and
        // hide the character's real save behind it.
        this.migrate(legacy);
        const slot = slotForState(legacy.state);
        if (!out.some((o) => o.slot === slot)) {
          await this.backend.write(slot, legacy);
          out.push({ slot, meta: { ...legacy.meta, savedAt: legacy.savedAt, version: legacy.v } });
        }
      }
    } catch { /* no legacy save, or it is unreadable; either way, move on */ }
    out.sort((a, b) => (b.meta.savedAt || 0) - (a.meta.savedAt || 0));
    return out;
  }

  /** The same, from this tab only, for the very first paint. */
  async peekAllFast() {
    const out = [];
    for (const slot of SLOTS) {
      const meta = await this.peekFast(slot);
      if (meta) out.push({ slot, meta });
    }
    out.sort((a, b) => (b.meta.savedAt || 0) - (a.meta.savedAt || 0));
    return out;
  }

  async hasSave(slot = null) {
    if (slot) return !!(await this.peek(slot));
    return (await this.peekAll()).length > 0;
  }

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
