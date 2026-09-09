// NetworkManager — the one door between the game and the network.
//
// Nothing outside src/net imports a transport, a topic string, or a peer id.
// Game systems call these methods and subscribe to these events, and that is
// the entire surface:
//
//   createRoom()             joinRoom(code)          leaveRoom()
//   sendPlayerPosition()     sendBattleAction()      sendTradeAction()
//   sendStoryEvent()         subscribeToState()
//
// The game is fully playable with no network at all — every method below is
// safe to call offline and simply does nothing.
import { bus } from '../core/events.js';
import { selectAdapter, OfflineAdapter } from './adapters.js';
import {
  TOPICS, MSG, makeMessage, validateMessage, makePresence, sanitisePresence,
  generateRoomCode, normaliseRoomCode, isValidRoomCode,
} from './protocol.js';

export const NET_STATUS = {
  OFFLINE: 'offline',      // no transport at all
  READY: 'ready',          // transport up, not in a room
  HOSTING: 'hosting',      // in a room we created, waiting or joined
  JOINED: 'joined',        // in someone else's room
};

const PRESENCE_HZ = 12;    // position updates per second

class NetworkManager {
  constructor() {
    this.adapter = new OfflineAdapter();
    this.status = NET_STATUS.OFFLINE;
    this.code = null;
    this.isHost = false;
    this.connected = false;
    this.partner = null;         // { peer, presence } of the other player
    this.selfPeer = null;
    this.unsubs = [];
    this.lastPresenceAt = 0;
    this.pendingPresence = null;
    this.presenceTimer = null;
    this.state = null;           // GameState, set by main
    this.busy = 'free';
    this.listeners = new Set();
    this.transportKind = 'offline';
    this.lastError = null;
  }

  // ---- lifecycle ---------------------------------------------------------

  async init(gameState, opts = {}) {
    this.state = gameState;
    this.adapter = await selectAdapter(opts);
    this.transportKind = this.adapter.kind;
    this._wire();
    this.status = this.adapter.kind === 'offline' ? NET_STATUS.OFFLINE : NET_STATUS.READY;
    this._publish();
    return this.transportKind;
  }

  // Lets the player retry after starting the game offline.
  async reconnect(opts = {}) {
    this._unwire();
    try { this.adapter.dispose(); } catch { /* already gone */ }
    const wasCode = this.code;
    const wasHost = this.isHost;
    this.code = null; this.partner = null; this.isHost = false;
    await this.init(this.state, opts);
    if (wasCode && this.transportKind !== 'offline') {
      if (wasHost) this._enterRoom(wasCode, true); else this._enterRoom(wasCode, false);
    }
    return this.transportKind;
  }

  _wire() {
    this._unwire();
    const a = this.adapter;
    this.unsubs.push(a.onConnection((c) => {
      this.connected = c;
      this._publish();
    }));
    this.unsubs.push(a.onPeers((change) => this._onPeers(change)));
    for (const topic of Object.values(TOPICS)) {
      this.unsubs.push(a.on(topic, (msg) => this._onMessage(topic, msg)));
    }
    this.connected = a.isConnected();
  }

  _unwire() {
    for (const u of this.unsubs) { try { u(); } catch { /* already gone */ } }
    this.unsubs = [];
    if (this.presenceTimer) { clearTimeout(this.presenceTimer); this.presenceTimer = null; }
  }

  dispose() {
    this.leaveRoom();
    this._unwire();
    try { this.adapter.dispose(); } catch { /* already gone */ }
  }

  // ---- rooms --------------------------------------------------------------

  get online() { return this.transportKind !== 'offline'; }
  get crossDevice() { return this.transportKind === 'online'; }
  get inRoom() { return !!this.code; }
  get hasPartner() { return !!this.partner; }

  createRoom() {
    if (!this.online) return { ok: false, reason: 'offline' };
    const code = generateRoomCode();
    this._enterRoom(code, true);
    return { ok: true, code };
  }

  joinRoom(input) {
    if (!this.online) return { ok: false, reason: 'offline' };
    const code = normaliseRoomCode(input);
    if (!isValidRoomCode(code)) return { ok: false, reason: 'badcode' };
    this._enterRoom(code, false);
    return { ok: true, code };
  }

  _enterRoom(code, host) {
    this.code = code;
    this.isHost = host;
    this.status = host ? NET_STATUS.HOSTING : NET_STATUS.JOINED;
    this.partner = null;
    this._pushPresence(true);
    this._send(TOPICS.SYS, MSG.HELLO, null, { name: this.state?.player?.name || 'Trainer' });
    this._publish();
    // A peer already in the room may have announced before we joined, so
    // reconcile against the current snapshot rather than waiting for an event.
    this._onPeers({ peers: this.adapter.peers(), joined: [], left: [], updated: [] });
  }

  leaveRoom() {
    if (!this.code) return;
    this._send(TOPICS.SYS, MSG.BYE, null, {});
    this.adapter.setPresence({ code: null, busy: null });
    this.code = null;
    this.isHost = false;
    this.partner = null;
    this.status = this.online ? NET_STATUS.READY : NET_STATUS.OFFLINE;
    this._publish();
    bus.emit('net:partnerLeft', { reason: 'self' });
  }

  // ---- presence -----------------------------------------------------------

  /**
   * Called every frame by the overworld. Rate-limited internally, so callers
   * never have to think about it.
   */
  sendPlayerPosition(extra = {}) {
    if (!this.code || !this.state) return;
    const now = performance.now();
    this.pendingPresence = makePresence(this.state, { ...extra, code: this.code, busy: this.busy });
    if (now - this.lastPresenceAt >= 1000 / PRESENCE_HZ) this._flushPresence();
    else if (!this.presenceTimer) {
      this.presenceTimer = setTimeout(() => { this.presenceTimer = null; this._flushPresence(); },
        Math.max(0, 1000 / PRESENCE_HZ - (now - this.lastPresenceAt)));
    }
  }

  _flushPresence() {
    if (!this.pendingPresence) return;
    this.lastPresenceAt = performance.now();
    this.adapter.setPresence(this.pendingPresence);
    this.pendingPresence = null;
  }

  _pushPresence(force = false) {
    if (!this.state || !this.code) return;
    this.pendingPresence = makePresence(this.state, { code: this.code, busy: this.busy });
    if (force) this._flushPresence();
  }

  setBusy(kind) {
    if (this.busy === kind) return;
    this.busy = kind;
    this._pushPresence(true);
  }

  // ---- outbound events -------------------------------------------------------

  sendBattleAction(kind, data = {}) { this._send(TOPICS.BATTLE, kind, this.partner?.peer, data); }
  sendTradeAction(kind, data = {}) { this._send(TOPICS.TRADE, kind, this.partner?.peer, data); }
  sendStoryEvent(milestone, value = true) {
    this._send(TOPICS.STORY, MSG.STORY_MILESTONE, null, { m: milestone, v: value });
  }
  sendChat(text) { this._send(TOPICS.CHAT, MSG.HELLO, null, { text: String(text).slice(0, 120) }); }

  _send(topic, kind, to, data) {
    if (!this.code) return;
    this.adapter.emit(topic, makeMessage(kind, this.code, to, data));
  }

  // ---- inbound ------------------------------------------------------------------

  _onMessage(topic, msg) {
    const m = validateMessage(msg.data, this.code);
    if (!m) return;                                  // wrong room, or malformed
    if (m.to && this.selfPeer && m.to !== this.selfPeer) return;

    // Learn who our partner is from the first valid message in our room.
    if (!this.partner && msg.peer) this._adoptPartner(msg.peer);

    if (m.kind === MSG.HELLO && topic === TOPICS.SYS) {
      // Answer so the other side learns about us immediately.
      this._send(TOPICS.SYS, MSG.HELLO, msg.peer, { name: this.state?.player?.name || 'Trainer', ack: true });
      return;
    }
    if (m.kind === MSG.BYE) { this._dropPartner('left'); return; }

    bus.emit(`net:${topic}`, { kind: m.kind, data: m.data, from: msg.peer });
  }

  _onPeers(change) {
    const all = change.peers || [];
    const me = all.find((p) => p.isMe && p.sameTab);
    if (me) this.selfPeer = me.peer;

    if (!this.code) { this._publish(); return; }

    // Our partner is any peer in the same game room code that is not us.
    const candidates = all.filter((p) => !p.isMe && p.presence && p.presence.code === this.code);
    const next = candidates[0] || null;

    if (next && (!this.partner || this.partner.peer !== next.peer)) {
      this.partner = { peer: next.peer, presence: sanitisePresence(next.presence) };
      bus.emit('net:partnerJoined', { name: this.partner.presence?.name || 'Trainer' });
    } else if (next && this.partner) {
      this.partner.presence = sanitisePresence(next.presence);
    } else if (!next && this.partner) {
      this._dropPartner('left');
    }
    this._publish();
  }

  _adoptPartner(peer) {
    const p = this.adapter.peers().find((x) => x.peer === peer);
    if (!p) return;
    this.partner = { peer, presence: sanitisePresence(p.presence) };
    bus.emit('net:partnerJoined', { name: this.partner.presence?.name || 'Trainer' });
    this._publish();
  }

  _dropPartner(reason) {
    if (!this.partner) return;
    const name = this.partner.presence?.name || 'Your partner';
    this.partner = null;
    bus.emit('net:partnerLeft', { reason, name });
    this._publish();
  }

  // ---- subscriptions ---------------------------------------------------------

  /**
   * The single "what is the network doing" subscription the UI uses.
   * Fires immediately with the current snapshot, then on every change.
   */
  subscribeToState(fn) {
    this.listeners.add(fn);
    queueMicrotask(() => fn(this.snapshot()));
    return () => this.listeners.delete(fn);
  }

  snapshot() {
    return {
      status: this.status,
      transport: this.transportKind,          // online | local | offline
      crossDevice: this.crossDevice,
      connected: this.connected && this.online,
      code: this.code,
      isHost: this.isHost,
      partner: this.partner
        ? { name: this.partner.presence?.name || 'Trainer', presence: this.partner.presence }
        : null,
      selfPeer: this.selfPeer,
    };
  }

  _publish() {
    const snap = this.snapshot();
    for (const fn of [...this.listeners]) { try { fn(snap); } catch (e) { console.error(e); } }
    bus.emit('net:state', snap);
  }

  // Everyone in our room, for rendering other players in the overworld.
  roomPeers() {
    if (!this.code) return [];
    return this.adapter.peers()
      .filter((p) => !p.isMe && p.presence && p.presence.code === this.code)
      .map((p) => ({ peer: p.peer, presence: sanitisePresence(p.presence) }))
      .filter((p) => p.presence);
  }
}

export const net = new NetworkManager();
export { MSG, TOPICS };
