// Network transports.
//
// All three implement the same small interface, so NetworkManager — and
// therefore the whole game — never knows which one is live:
//
//   init()            -> Promise<boolean>
//   isConnected()     -> boolean
//   setPresence(obj)  -> void        (high frequency, last-value-wins)
//   emit(topic, data) -> void        (low frequency events)
//   on(topic, fn)     -> unsubscribe
//   onPeers(fn)       -> unsubscribe
//   onConnection(fn)  -> unsubscribe
//   peers()           -> Peer[]      ({ peer, presence, isMe, sameTab })
//   dispose()
//
// ArtifactRoomAdapter is the real one: it reaches other DEVICES.
// BroadcastChannelAdapter is real too, but only reaches other TABS on the
// same device — useful for developing and testing two-player flows solo.
// OfflineAdapter is the honest no-op so single-player never has a code path
// of its own.
import { OPEN_TOPICS } from './protocol.js';

// ---------------------------------------------------------------------------

export class OfflineAdapter {
  constructor() { this.name = 'offline'; this.kind = 'offline'; }
  async init() { return true; }
  isConnected() { return false; }
  setPresence() {}
  emit() {}
  on() { return () => {}; }
  onPeers(fn) { queueMicrotask(() => fn({ peers: [], joined: [], left: [], updated: [] })); return () => {}; }
  onConnection(fn) { queueMicrotask(() => fn(false)); return () => {}; }
  peers() { return []; }
  dispose() {}
}

// ---------------------------------------------------------------------------

/**
 * Real multiplayer across devices, via the artifact runtime's `room`
 * capability. Everyone with the page open is in one transport-level room;
 * the six-character game room code is a filter layered on top (see
 * RoomManager), which is what keeps two different pairs of players from
 * seeing each other.
 */
export class ArtifactRoomAdapter {
  constructor() {
    this.name = 'artifact-room';
    this.kind = 'online';
    this.room = null;
    this.ready = false;
  }

  async init() {
    try {
      if (!globalThis.claude || typeof claude.use !== 'function') return false;
      const room = await claude.use('room');
      if (!room) return false;
      this.room = room;
      this.ready = true;
      return true;
    } catch (err) {
      console.warn('[net] artifact room unavailable', err);
      return false;
    }
  }

  isConnected() {
    try { return !!this.room && this.room.connected(); } catch { return false; }
  }

  setPresence(patch) {
    if (!this.room) return;
    // presence() rejects rather than throwing; a dropped presence update is
    // never fatal because the next one carries absolute state anyway.
    this.room.presence(patch).catch(() => {});
  }

  emit(topic, data) {
    if (!this.room) return;
    this.room.emit(topic, data).catch((e) => {
      if (e && e.code === 'not_permitted') {
        console.warn(`[net] topic "${topic}" is not open to this viewer`);
      }
    });
  }

  on(topic, handler) {
    if (!this.room) return () => {};
    return this.room.on(topic, (msg) => {
      // Skip our own echo; the sender already applied its own action.
      if (msg.isMe && msg.sameTab) return;
      handler({ peer: msg.peer, data: msg.data, isMe: msg.isMe, kind: msg.kind });
    }, () => {});
  }

  onPeers(handler) {
    if (!this.room) return () => {};
    return this.room.onPeers((change) => handler({
      peers: change.peers.map(mapPeer),
      joined: change.joined.map(mapPeer),
      left: change.left.map(mapPeer),
      updated: change.updated.map(mapPeer),
    }), () => {});
  }

  onConnection(handler) {
    if (!this.room) return () => {};
    return this.room.onConnection(handler, () => {});
  }

  peers() {
    if (!this.room) return [];
    try { return this.room.peers().map(mapPeer); } catch { return []; }
  }

  dispose() { this.room = null; this.ready = false; }
}

const mapPeer = (p) => ({
  peer: p.peer,
  presence: p.presence || {},
  isMe: !!p.isMe,
  sameTab: !!p.sameTab,
  kind: p.kind,
  updatedAt: p.updatedAt,
});

// ---------------------------------------------------------------------------

/**
 * Cross-TAB multiplayer on one device, over BroadcastChannel.
 *
 * This is genuinely two independent game instances talking to each other —
 * separate saves, separate parties, separate battle state — which makes it a
 * real test of the multiplayer code. It is NOT cross-device: two phones can
 * never see each other through this adapter, and the UI says so.
 */
export class BroadcastChannelAdapter {
  constructor(channelName = 'caribou-monster') {
    this.name = 'broadcast-channel';
    this.kind = 'local';
    this.channelName = channelName;
    this.ch = null;
    this.myPeer = `t${Math.random().toString(36).slice(2, 10)}`;
    this.myPresence = {};
    this.remote = new Map();       // peer -> { presence, lastSeen }
    this.topicHandlers = new Map();
    this.peerHandlers = new Set();
    this.connHandlers = new Set();
    this.beat = null;
    this.sweep = null;
  }

  async init() {
    if (typeof BroadcastChannel === 'undefined') return false;
    try {
      this.ch = new BroadcastChannel(this.channelName);
    } catch { return false; }

    this.ch.onmessage = (e) => this._receive(e.data);
    // Heartbeat doubles as presence re-assertion, so a tab that opens later
    // learns about everyone within one beat.
    this.beat = setInterval(() => this._announce(), 900);
    this.sweep = setInterval(() => this._sweep(), 1500);
    this._announce();
    queueMicrotask(() => { for (const fn of this.connHandlers) fn(true); this._emitPeers([], []); });
    return true;
  }

  isConnected() { return !!this.ch; }

  setPresence(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete this.myPresence[k];
      else this.myPresence[k] = v;
    }
    this._announce();
  }

  emit(topic, data) {
    if (!this.ch) return;
    this._post({ kind: 'event', peer: this.myPeer, topic, data });
  }

  on(topic, handler) {
    if (!this.topicHandlers.has(topic)) this.topicHandlers.set(topic, new Set());
    this.topicHandlers.get(topic).add(handler);
    return () => this.topicHandlers.get(topic)?.delete(handler);
  }

  onPeers(handler) {
    this.peerHandlers.add(handler);
    queueMicrotask(() => handler({ peers: this.peers(), joined: this.peers(), left: [], updated: [] }));
    return () => this.peerHandlers.delete(handler);
  }

  onConnection(handler) {
    this.connHandlers.add(handler);
    queueMicrotask(() => handler(this.isConnected()));
    return () => this.connHandlers.delete(handler);
  }

  peers() {
    const out = [{ peer: this.myPeer, presence: this.myPresence, isMe: true, sameTab: true, kind: 'viewer' }];
    for (const [peer, rec] of this.remote) {
      out.push({ peer, presence: rec.presence, isMe: false, sameTab: false, kind: 'viewer' });
    }
    return out;
  }

  dispose() {
    clearInterval(this.beat);
    clearInterval(this.sweep);
    if (this.ch) { this._post({ kind: 'bye', peer: this.myPeer }); this.ch.close(); }
    this.ch = null;
  }

  // --- internals ---
  _post(msg) { try { this.ch.postMessage(msg); } catch { /* channel closed */ } }
  _announce() { if (this.ch) this._post({ kind: 'presence', peer: this.myPeer, presence: this.myPresence }); }

  _receive(msg) {
    if (!msg || msg.peer === this.myPeer) return;
    if (msg.kind === 'presence') {
      const known = this.remote.has(msg.peer);
      this.remote.set(msg.peer, { presence: msg.presence || {}, lastSeen: Date.now() });
      const p = { peer: msg.peer, presence: msg.presence || {}, isMe: false, sameTab: false, kind: 'viewer' };
      this._emitPeers(known ? [] : [p], [], known ? [p] : []);
      if (!known) this._announce();   // greet the newcomer
    } else if (msg.kind === 'bye') {
      const rec = this.remote.get(msg.peer);
      this.remote.delete(msg.peer);
      if (rec) this._emitPeers([], [{ peer: msg.peer, presence: rec.presence, isMe: false, sameTab: false }]);
    } else if (msg.kind === 'event') {
      const set = this.topicHandlers.get(msg.topic);
      if (set) for (const fn of [...set]) fn({ peer: msg.peer, data: msg.data, isMe: false, kind: 'viewer' });
    }
  }

  _sweep() {
    const now = Date.now();
    const gone = [];
    for (const [peer, rec] of this.remote) {
      if (now - rec.lastSeen > 4000) { gone.push({ peer, presence: rec.presence, isMe: false, sameTab: false }); this.remote.delete(peer); }
    }
    if (gone.length) this._emitPeers([], gone);
  }

  _emitPeers(joined, left, updated = []) {
    const change = { peers: this.peers(), joined, left, updated };
    for (const fn of [...this.peerHandlers]) fn(change);
  }
}

// ---------------------------------------------------------------------------

/**
 * Picks the best transport available right now. Order matters: real
 * cross-device first, cross-tab second, honest offline last.
 */
export async function selectAdapter({ preferLocal = false } = {}) {
  if (!preferLocal) {
    const artifact = new ArtifactRoomAdapter();
    if (await artifact.init()) return artifact;
  }
  const bc = new BroadcastChannelAdapter();
  if (await bc.init()) return bc;
  const off = new OfflineAdapter();
  await off.init();
  return off;
}

export { OPEN_TOPICS };
