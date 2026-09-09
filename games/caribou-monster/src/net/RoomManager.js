// RoomManager — the co-op session layer.
//
// NetworkManager moves bytes. RoomManager owns the two things two players
// actually DO with each other: trading and battling. Both are handshakes with
// a strict state machine, because both must be safe when a phone goes into a
// tunnel mid-way.
//
// Trade safety rule (non-negotiable): a monster only ever leaves a party once
// BOTH sides are known to have confirmed. Any cancel, timeout or disconnect
// before that point ends the session with nothing moved on either device.
//
// Battle safety rule: a networked battle never touches the real party. Both
// sides fight with clones, so a disconnect costs a battle, never a monster.
import { bus } from '../core/events.js';
import { net, MSG, TOPICS } from './NetworkManager.js';
import { encodeTeam, encodeAction, decodeAction } from './protocol.js';
import { reviveMonster, healFully, displayName, isFainted } from '../game/monster.js';
import { createBattle, resolveTurn, needsSwitch, forceSwitch, battleChecksum } from '../game/battle/engine.js';
import { removeMonByUid, receiveMonster } from '../game/state.js';

const REQUEST_TIMEOUT = 30000;
const ACTION_TIMEOUT = 60000;

// ===========================================================================
// Trade
// ===========================================================================

export const TRADE_STATE = {
  IDLE: 'idle',
  REQUESTED: 'requested',       // we asked, waiting on them
  INVITED: 'invited',           // they asked, waiting on us
  SELECTING: 'selecting',       // both in, choosing monsters
  REVIEW: 'review',             // both offered, confirming
  COMMITTING: 'committing',     // both confirmed, performing the swap
  DONE: 'done',
  CANCELLED: 'cancelled',
};

export class TradeSession {
  constructor(state) {
    this.state = state;                  // the local player's GameState
    this.reset();
  }

  reset() {
    this.phase = TRADE_STATE.IDLE;
    this.myOffer = null;                 // uid of the monster we put up
    this.theirOffer = null;              // their monster, as received data
    this.myConfirm = false;
    this.theirConfirm = false;
    this.partnerName = 'Trainer';
    this.message = '';
    this.deadline = 0;
    this.result = null;
  }

  get active() {
    return this.phase !== TRADE_STATE.IDLE && this.phase !== TRADE_STATE.DONE
      && this.phase !== TRADE_STATE.CANCELLED;
  }

  // ---- outbound -----------------------------------------------------------

  request() {
    if (!net.hasPartner) return false;
    this.reset();
    this.phase = TRADE_STATE.REQUESTED;
    this.partnerName = net.partner.presence?.name || 'Trainer';
    this.deadline = Date.now() + REQUEST_TIMEOUT;
    this.message = `Waiting for ${this.partnerName}...`;
    net.setBusy('trade');
    net.sendTradeAction(MSG.TRADE_REQUEST, { name: this.state.player.name });
    this._changed();
    return true;
  }

  accept() {
    if (this.phase !== TRADE_STATE.INVITED) return;
    this.phase = TRADE_STATE.SELECTING;
    this.message = 'Choose a monster to offer.';
    net.setBusy('trade');
    net.sendTradeAction(MSG.TRADE_ACCEPT, {});
    this._changed();
  }

  decline() {
    if (this.phase !== TRADE_STATE.INVITED) return;
    net.sendTradeAction(MSG.TRADE_DECLINE, {});
    this._finish(TRADE_STATE.CANCELLED, 'Trade declined.');
  }

  offer(uid) {
    if (this.phase !== TRADE_STATE.SELECTING && this.phase !== TRADE_STATE.REVIEW) return false;
    // Never offer away the last monster that can still fight.
    const usable = this.state.party.filter((m) => !isFainted(m));
    if (this.state.party.length <= 1) { this.message = 'You cannot trade your last monster!'; this._changed(); return false; }
    if (usable.length === 1 && usable[0].uid === uid) {
      this.message = 'That is your only monster able to battle!';
      this._changed();
      return false;
    }
    const mon = this.state.party.find((m) => m.uid === uid);
    if (!mon) return false;
    this.myOffer = uid;
    this.myConfirm = false;
    this.theirConfirm = false;      // any change invalidates both confirms
    net.sendTradeAction(MSG.TRADE_OFFER, { mon: encodeTeam([mon])[0] });
    this._recheckPhase();
    return true;
  }

  withdrawOffer() {
    if (!this.myOffer) return;
    this.myOffer = null;
    this.myConfirm = false;
    this.theirConfirm = false;
    net.sendTradeAction(MSG.TRADE_UNOFFER, {});
    this._recheckPhase();
  }

  confirm() {
    if (this.phase !== TRADE_STATE.REVIEW || this.myConfirm) return;
    this.myConfirm = true;
    this.deadline = Date.now() + ACTION_TIMEOUT;
    net.sendTradeAction(MSG.TRADE_CONFIRM, {});
    this._maybeCommit();
    this._changed();
  }

  unconfirm() {
    if (!this.myConfirm || this.phase === TRADE_STATE.COMMITTING) return;
    this.myConfirm = false;
    net.sendTradeAction(MSG.TRADE_UNCONFIRM, {});
    this._changed();
  }

  cancel(reason = 'Trade cancelled.') {
    if (!this.active) return;
    if (this.phase === TRADE_STATE.COMMITTING) return;   // too late to back out
    net.sendTradeAction(MSG.TRADE_CANCEL, {});
    this._finish(TRADE_STATE.CANCELLED, reason);
  }

  // ---- inbound -------------------------------------------------------------

  handle(kind, data) {
    switch (kind) {
      case MSG.TRADE_REQUEST:
        if (this.active) { net.sendTradeAction(MSG.TRADE_DECLINE, { busy: true }); return; }
        this.reset();
        this.phase = TRADE_STATE.INVITED;
        this.partnerName = String(data.name || 'Trainer').slice(0, 12);
        this.deadline = Date.now() + REQUEST_TIMEOUT;
        this.message = `${this.partnerName} wants to trade!`;
        this._changed();
        break;

      case MSG.TRADE_ACCEPT:
        if (this.phase !== TRADE_STATE.REQUESTED) return;
        this.phase = TRADE_STATE.SELECTING;
        this.message = 'Choose a monster to offer.';
        this._changed();
        break;

      case MSG.TRADE_DECLINE:
        this._finish(TRADE_STATE.CANCELLED,
          data.busy ? `${this.partnerName} is busy right now.` : `${this.partnerName} declined.`);
        break;

      case MSG.TRADE_OFFER: {
        if (!this.active) return;
        const mon = reviveMonster(data.mon);
        if (!mon) return;
        this.theirOffer = mon;
        this.myConfirm = false;
        this.theirConfirm = false;
        this._recheckPhase();
        break;
      }

      case MSG.TRADE_UNOFFER:
        if (!this.active) return;
        this.theirOffer = null;
        this.myConfirm = false;
        this.theirConfirm = false;
        this._recheckPhase();
        break;

      case MSG.TRADE_CONFIRM:
        if (this.phase !== TRADE_STATE.REVIEW) return;
        this.theirConfirm = true;
        this._maybeCommit();
        this._changed();
        break;

      case MSG.TRADE_UNCONFIRM:
        if (this.phase === TRADE_STATE.COMMITTING) return;
        this.theirConfirm = false;
        this._changed();
        break;

      case MSG.TRADE_CANCEL:
        this._finish(TRADE_STATE.CANCELLED, `${this.partnerName} cancelled the trade.`);
        break;

      default: break;
    }
  }

  // A partner vanishing is the case the whole design exists for.
  onPartnerLost() {
    if (!this.active) return;
    if (this.phase === TRADE_STATE.COMMITTING) {
      // The swap already ran locally on both sides; nothing to roll back.
      this._finish(TRADE_STATE.DONE, 'Trade completed, but your partner disconnected.');
      return;
    }
    this._finish(TRADE_STATE.CANCELLED,
      'Your partner disconnected. The trade was cancelled and nothing changed hands.');
  }

  tick() {
    if (!this.active) return;
    if (this.deadline && Date.now() > this.deadline) {
      if (this.phase === TRADE_STATE.REQUESTED || this.phase === TRADE_STATE.INVITED) {
        this._finish(TRADE_STATE.CANCELLED, 'Trade request timed out.');
      } else if (this.phase === TRADE_STATE.COMMITTING) {
        this._finish(TRADE_STATE.CANCELLED, 'The trade did not complete. Nothing changed hands.');
      }
    }
  }

  // ---- internals ------------------------------------------------------------

  _recheckPhase() {
    if (this.myOffer && this.theirOffer) {
      this.phase = TRADE_STATE.REVIEW;
      this.message = 'Both monsters are on the table.';
      this.deadline = Date.now() + ACTION_TIMEOUT * 2;
    } else {
      this.phase = TRADE_STATE.SELECTING;
      this.message = this.myOffer ? 'Waiting for their monster...' : 'Choose a monster to offer.';
    }
    this._changed();
  }

  _maybeCommit() {
    if (!(this.myConfirm && this.theirConfirm)) return;
    if (this.phase === TRADE_STATE.COMMITTING || this.phase === TRADE_STATE.DONE) return;

    this.phase = TRADE_STATE.COMMITTING;
    this.deadline = Date.now() + 15000;

    // The swap. Both sides run this independently off state they already
    // hold, so no further round-trip is needed to complete it.
    const sent = removeMonByUid(this.state, this.myOffer);
    const got = this.theirOffer;
    got.ot = got.ot || this.partnerName;
    got.friendship = Math.max(got.friendship || 70, 70);
    receiveMonster(this.state, got);

    net.sendTradeAction(MSG.TRADE_COMMIT, {});
    this.result = { sent, got };
    this._finish(TRADE_STATE.DONE,
      `${sent ? displayName(sent) : 'Your monster'} and ${displayName(got)} were traded!`);
  }

  _finish(phase, message) {
    this.phase = phase;
    this.message = message;
    this.deadline = 0;
    net.setBusy('free');
    this._changed();
    bus.emit('trade:finished', { phase, message, result: this.result });
  }

  _changed() { bus.emit('trade:changed', this); }
}

// ===========================================================================
// Player-vs-player battle
// ===========================================================================

export const PVP_STATE = {
  IDLE: 'idle',
  REQUESTED: 'requested',
  INVITED: 'invited',
  SYNCING: 'syncing',
  ACTIVE: 'active',
  ENDED: 'ended',
};

export class PvpSession {
  constructor(state) {
    this.state = state;
    this.reset();
  }

  reset() {
    this.phase = PVP_STATE.IDLE;
    this.battle = null;
    this.mySide = 0;               // 0 = host, 1 = guest
    this.myAction = null;
    this.theirAction = null;
    this.mySwitch = null;
    this.theirSwitch = null;
    this.partnerName = 'Trainer';
    this.message = '';
    this.mySeed = 0;
    this.theirSeed = 0;
    this.theirTeam = null;
    this.deadline = 0;
    this.result = null;
    this.desynced = false;
  }

  get active() { return this.phase === PVP_STATE.ACTIVE || this.phase === PVP_STATE.SYNCING; }

  // ---- handshake -----------------------------------------------------------

  request() {
    if (!net.hasPartner) return false;
    if (!this.state.party.some((m) => !isFainted(m))) return false;
    this.reset();
    this.phase = PVP_STATE.REQUESTED;
    this.partnerName = net.partner.presence?.name || 'Trainer';
    this.mySeed = (Math.random() * 0xffffffff) >>> 0;
    this.deadline = Date.now() + REQUEST_TIMEOUT;
    this.message = `Waiting for ${this.partnerName}...`;
    net.setBusy('battle');
    net.sendBattleAction(MSG.BATTLE_REQUEST, {
      name: this.state.player.name, seed: this.mySeed,
    });
    this._changed();
    return true;
  }

  accept() {
    if (this.phase !== PVP_STATE.INVITED) return;
    this.mySeed = (Math.random() * 0xffffffff) >>> 0;
    this.mySide = 1;                              // the inviter hosts
    this.phase = PVP_STATE.SYNCING;
    this.message = 'Linking teams...';
    net.setBusy('battle');
    net.sendBattleAction(MSG.BATTLE_ACCEPT, {
      seed: this.mySeed, team: encodeTeam(this.state.party),
    });
    this._changed();
  }

  decline() {
    if (this.phase !== PVP_STATE.INVITED) return;
    net.sendBattleAction(MSG.BATTLE_DECLINE, {});
    this._finish('Battle declined.');
  }

  forfeit() {
    if (!this.active) return;
    net.sendBattleAction(MSG.BATTLE_FORFEIT, {});
    this.result = 'lose';
    this._finish('You forfeited the battle.');
  }

  // ---- inbound ---------------------------------------------------------------

  handle(kind, data) {
    switch (kind) {
      case MSG.BATTLE_REQUEST:
        if (this.active || this.phase !== PVP_STATE.IDLE) { net.sendBattleAction(MSG.BATTLE_DECLINE, { busy: true }); return; }
        this.reset();
        this.phase = PVP_STATE.INVITED;
        this.partnerName = String(data.name || 'Trainer').slice(0, 12);
        this.theirSeed = (data.seed | 0) >>> 0;
        this.deadline = Date.now() + REQUEST_TIMEOUT;
        this.message = `${this.partnerName} wants to battle!`;
        this._changed();
        break;

      case MSG.BATTLE_ACCEPT: {
        if (this.phase !== PVP_STATE.REQUESTED) return;
        this.mySide = 0;
        this.theirSeed = (data.seed | 0) >>> 0;
        this.theirTeam = data.team;
        this.phase = PVP_STATE.SYNCING;
        net.sendBattleAction(MSG.BATTLE_TEAM, { team: encodeTeam(this.state.party) });
        this._start();
        break;
      }

      case MSG.BATTLE_TEAM:
        if (this.phase !== PVP_STATE.SYNCING) return;
        this.theirTeam = data.team;
        this._start();
        break;

      case MSG.BATTLE_DECLINE:
        this._finish(data.busy ? `${this.partnerName} is busy right now.` : `${this.partnerName} declined.`);
        break;

      case MSG.BATTLE_ACTION: {
        if (this.phase !== PVP_STATE.ACTIVE) return;
        const a = decodeAction(data.a);
        if (!a) return;
        this.theirAction = a;
        this._maybeResolve();
        break;
      }

      case MSG.BATTLE_SWITCH:
        if (this.phase !== PVP_STATE.ACTIVE) return;
        this.theirSwitch = Math.max(0, Math.min(5, data.index | 0));
        this._maybeSwitch();
        break;

      case MSG.BATTLE_FORFEIT:
        if (!this.active) return;
        this.result = 'win';
        this._finish(`${this.partnerName} forfeited. You win!`);
        break;

      case MSG.BATTLE_SYNC: {
        if (this.phase !== PVP_STATE.ACTIVE || !this.battle) return;
        const mine = battleChecksum(this.battle);
        if (((data.sum | 0) >>> 0) !== mine) {
          this.desynced = true;
          this._finish('The battle lost sync with your partner and had to stop.');
        }
        break;
      }
      default: break;
    }
  }

  onPartnerLost() {
    if (this.phase === PVP_STATE.IDLE || this.phase === PVP_STATE.ENDED) return;
    this.result = this.active ? 'win' : null;
    this._finish('Your partner disconnected. Nothing was lost — link battles never affect your team.');
  }

  tick() {
    if (this.phase === PVP_STATE.IDLE || this.phase === PVP_STATE.ENDED) return;
    if (this.deadline && Date.now() > this.deadline) {
      this._finish('The link timed out.');
    }
  }

  // ---- battle plumbing ----------------------------------------------------------

  _start() {
    if (!this.theirTeam) return;
    const theirs = this.theirTeam.map(reviveMonster).filter(Boolean);
    if (!theirs.length) { this._finish('Your partner has no monsters able to battle.'); return; }

    // Link battles are fought with CLONES on both sides. Nothing that happens
    // here can hurt a real party — which is exactly why a mid-battle
    // disconnect is survivable.
    const mine = this.state.party.map((m) => JSON.parse(JSON.stringify(m)));

    // Neither player controls the seed alone.
    const seed = ((this.mySeed ^ this.theirSeed) >>> 0) || 12345;
    const hostTeam = this.mySide === 0 ? mine : theirs;
    const guestTeam = this.mySide === 0 ? theirs : mine;
    const hostName = this.mySide === 0 ? this.state.player.name : this.partnerName;
    const guestName = this.mySide === 0 ? this.partnerName : this.state.player.name;

    this.battle = createBattle({
      seed, kind: 'pvp', difficulty: 'normal', canRun: false,
      a: { id: 'host', name: hostName, isPlayer: this.mySide === 0, isRemote: this.mySide !== 0, party: hostTeam },
      b: { id: 'guest', name: guestName, isPlayer: this.mySide === 1, isRemote: this.mySide !== 1, party: guestTeam },
    });
    this.phase = PVP_STATE.ACTIVE;
    this.message = '';
    this.deadline = 0;
    bus.emit('pvp:started', this);
    this._changed();
  }

  get me() { return this.battle ? this.battle.sides[this.mySide] : null; }
  get them() { return this.battle ? this.battle.sides[this.mySide === 0 ? 1 : 0] : null; }

  submitAction(action) {
    if (this.phase !== PVP_STATE.ACTIVE || this.myAction) return;
    this.myAction = action;
    this.deadline = Date.now() + ACTION_TIMEOUT;
    net.sendBattleAction(MSG.BATTLE_ACTION, { a: encodeAction(action) });
    this._maybeResolve();
    this._changed();
  }

  submitSwitch(index) {
    if (this.phase !== PVP_STATE.ACTIVE || this.mySwitch != null) return;
    this.mySwitch = index;
    net.sendBattleAction(MSG.BATTLE_SWITCH, { index });
    this._maybeSwitch();
  }

  _maybeSwitch() {
    if (!this.battle) return;
    const needMe = needsSwitch(this.battle, this.mySide);
    const otherSide = this.mySide === 0 ? 1 : 0;
    const needThem = needsSwitch(this.battle, otherSide);
    if (needMe && this.mySwitch == null) return;
    if (needThem && this.theirSwitch == null) return;

    const events = [];
    if (needMe) events.push(...forceSwitch(this.battle, this.mySide, this.mySwitch));
    if (needThem) events.push(...forceSwitch(this.battle, otherSide, this.theirSwitch));
    this.mySwitch = null;
    this.theirSwitch = null;
    if (events.length) bus.emit('pvp:events', { events, session: this });
  }

  _maybeResolve() {
    if (!this.myAction || !this.theirAction || !this.battle) return;
    const hostAction = this.mySide === 0 ? this.myAction : this.theirAction;
    const guestAction = this.mySide === 0 ? this.theirAction : this.myAction;
    this.myAction = null;
    this.theirAction = null;
    this.deadline = 0;

    const events = resolveTurn(this.battle, [hostAction, guestAction]);
    net.sendBattleAction(MSG.BATTLE_SYNC, { sum: battleChecksum(this.battle) });
    bus.emit('pvp:events', { events, session: this });

    if (this.battle.over) {
      const won = (this.battle.result === 'win' && this.mySide === 0)
        || (this.battle.result === 'lose' && this.mySide === 1);
      this.result = this.battle.result === 'draw' ? 'draw' : (won ? 'win' : 'lose');
    }
    this._changed();
  }

  finishBattle() {
    const r = this.result;
    this._finish(r === 'win' ? 'You won the link battle!' : r === 'lose' ? 'You lost the link battle.' : 'The link battle ended in a draw.');
    return r;
  }

  _finish(message) {
    this.phase = PVP_STATE.ENDED;
    this.message = message;
    this.deadline = 0;
    net.setBusy('free');
    this._changed();
    bus.emit('pvp:finished', { message, result: this.result, desynced: this.desynced });
  }

  _changed() { bus.emit('pvp:changed', this); }
}

// ===========================================================================
// RoomManager — owns both sessions and routes network traffic into them.
// ===========================================================================

export class RoomManager {
  constructor(state) {
    this.state = state;
    this.trade = new TradeSession(state);
    this.pvp = new PvpSession(state);
    this.subs = [];
    this.wire();
  }

  wire() {
    this.subs.push(bus.on(`net:${TOPICS.TRADE}`, ({ kind, data }) => this.trade.handle(kind, data)));
    this.subs.push(bus.on(`net:${TOPICS.BATTLE}`, ({ kind, data }) => this.pvp.handle(kind, data)));
    this.subs.push(bus.on(`net:${TOPICS.STORY}`, ({ data }) => this._onStory(data)));
    this.subs.push(bus.on('net:partnerLeft', () => {
      this.trade.onPartnerLost();
      this.pvp.onPartnerLost();
    }));
  }

  // Shared story milestones. A partner reaching a milestone we have not is
  // recorded so the two saves stay compatible rather than silently diverging.
  _onStory(data) {
    if (!data || typeof data.m !== 'string') return;
    const key = data.m.slice(0, 32);
    if (this.state.flags[key]) return;
    bus.emit('story:partnerMilestone', { key });
  }

  tick() { this.trade.tick(); this.pvp.tick(); }

  dispose() { for (const u of this.subs) u(); this.subs = []; }
}

export { net };
