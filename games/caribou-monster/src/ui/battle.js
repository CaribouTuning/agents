// The battle screen.
//
// The engine produces a list of events; this screen is a player for that
// list. Keeping the two apart is what lets the identical engine drive a wild
// encounter, a gym leader and a networked link battle with no special cases.
import { Screen, FADE } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/events.js';
import { PAL, shade, typeColor } from '../render/palette.js';
import {
  window9, panel, rect, label, labelDim, cursor, hpBar, expBar, hpColor,
  drawTextCentered, drawTextRight, drawText, statusChip, genderMark, typeChip, LINE, money,
  rowHighlight,
} from './kit.js';
import { renderMonster } from '../render/monsterart.js';
import { drawBattleScene } from '../render/battleart.js';
import { spriteFoot } from '../render/monstersprites.js';

// Platinum's sprites are 80x80 and this screen is 192 logical pixels tall,
// which is the DS's own screen height. Drawing them at anything else is
// throwing away the reason for having them.
const MON = 80;
import { NicknameScreen } from './naming.js';
import { drawChar, lookFor } from '../render/sprites.js';
import { drawBackChip } from './controls.js';
import { getSpecies } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { getItem } from '../data/items.js';
import {
  activeOf, resolveTurn, needsSwitch, forceSwitch, hpFraction, activeWeather,
} from '../game/battle/engine.js';
import { chooseAiAction, chooseAiSwitch } from '../game/battle/ai.js';
import {
  maxHp, displayName, isFainted, expProgress, learnMove, knowsMove, typesOf,
} from '../game/monster.js';
import { removeItem, battleUsable } from '../game/inventory.js';
import { receiveMonster } from '../game/state.js';
import { recordSeen, recordCaught } from '../game/pokedex.js';
import { battleMusic, battleMusicKey, MUSIC } from '../data/music.js';
import { evolveNow, evolutionFor } from '../game/evolution.js';
import { PVP_STATE } from '../net/RoomManager.js';

const MODE = {
  INTRO: 'intro', COMMAND: 'command', MOVES: 'moves', BAG: 'bag', PARTY: 'party',
  PLAY: 'play', SWITCH: 'switch', LEARN: 'learn', EVOLVE: 'evolve',
  WAIT_PEER: 'waitPeer', END: 'end',
};

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

export class BattleScreen extends Screen {
  constructor(game, battle, opts = {}) {
    super(game);
    this.battle = battle;
    this.opts = opts;
    this.onFinish = opts.onFinish || null;
    this.pvp = opts.pvp || null;
    this.mySide = this.pvp ? this.pvp.mySide : 0;
    this.foeSide = this.mySide === 0 ? 1 : 0;

    this.mode = MODE.INTRO;
    this.queue = [];
    this.current = null;
    this.animT = 0;
    this.msg = '';
    this.msgShown = 0;
    this.msgHold = 0;

    this.cmdIndex = 0;
    this.moveIndex = 0;
    this.bagIndex = 0;
    this.bagScroll = 0;
    this.bagPocket = 0;
    this.partyIndex = 0;
    this.learnIndex = 0;

    // Display values that lag the real ones so bars animate.
    this.dispHp = [0, 0];
    this.dispExp = 0;
    this.shake = [0, 0];
    this.flash = [0, 0];
    this.slide = [1, 1];        // 0 = off-screen, 1 = in place
    this.faintDrop = [0, 0];
    this.ballAnim = null;
    this.introT = 0;
    this.learnData = null;
    this.evolveData = null;
    this.result = null;
    this.tapRects = [];
    this.caughtRecorded = false;
    this.forcedSwitchSide = -1;
  }

  onEnter() {
    const foe = activeOf(this.battle.sides[this.foeSide]);
    const me = activeOf(this.battle.sides[this.mySide]);
    this.dispHp[this.foeSide] = foe ? foe.hp : 0;
    this.dispHp[this.mySide] = me ? me.hp : 0;
    this.dispExp = me ? expProgress(me) : 0;
    this.slide = [0, 0];

    const t = this.battle.sides[this.foeSide].trainer;
    audio.playMusic(
      battleMusic(this.battle.kind, { leader: t && t.leader, villain: t && t.cls === 'Team Galactic' }),
      battleMusicKey(this.battle.kind, { leader: t && t.leader, villain: t && t.cls === 'Team Galactic' }),
    );

    if (this.battle.kind === 'wild' && foe) {
      recordSeen(this.game.state.dex, foe.species);
      audio.cry(foe.species);
    }
    this._buildIntro();

    if (this.pvp) {
      this.pvpSub = bus.on('pvp:events', ({ events }) => {
        this.queue.push(...events);
        if (this.mode === MODE.WAIT_PEER) this.mode = MODE.PLAY;
      });
      this.pvpEnd = bus.on('pvp:finished', ({ message }) => {
        this.queue.push({ t: 'text', s: message });
        this.queue.push({ t: 'finish' });
      });
    }
  }

  onExit() {
    if (this.pvpSub) this.pvpSub();
    if (this.pvpEnd) this.pvpEnd();
  }

  _buildIntro() {
    const foeSide = this.battle.sides[this.foeSide];
    const mySideObj = this.battle.sides[this.mySide];
    const foe = activeOf(foeSide);
    const me = activeOf(mySideObj);
    this.queue = [];
    if (this.battle.kind === 'wild') {
      this.queue.push({ t: 'text', s: `A wild ${displayName(foe)} appeared!` });
    } else if (this.battle.kind === 'pvp') {
      this.queue.push({ t: 'text', s: `${foeSide.name} wants to battle!` });
      this.queue.push({ t: 'text', s: `${foeSide.name} sent out ${displayName(foe)}!` });
    } else {
      this.queue.push({ t: 'text', s: `${foeSide.name} wants to battle!` });
      this.queue.push({ t: 'text', s: `${foeSide.name} sent out ${displayName(foe)}!` });
    }
    this.queue.push({ t: 'slidein', side: this.mySide });
    this.queue.push({ t: 'text', s: `Go! ${displayName(me)}!` });
    this.queue.push({ t: 'command' });
    this.mode = MODE.PLAY;
  }

  // ---- update ---------------------------------------------------------------

  update(dt, isTop) {
    if (!isTop) return;
    this.introT += dt;
    this.t = (this.t || 0) + dt;
    for (let i = 0; i < 2; i++) {
      if (this.shake[i] > 0) this.shake[i] = Math.max(0, this.shake[i] - dt * 4);
      if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt * 5);
      if (this.slide[i] < 1) this.slide[i] = Math.min(1, this.slide[i] + dt * 4.5);
    }
    this._animateBars(dt);

    switch (this.mode) {
      case MODE.PLAY: this._updatePlay(dt); break;
      case MODE.COMMAND: this._updateCommand(); break;
      case MODE.MOVES: this._updateMoves(); break;
      case MODE.BAG: this._updateBag(); break;
      case MODE.PARTY: this._updateParty(); break;
      case MODE.SWITCH: this._updateSwitch(); break;
      case MODE.LEARN: this._updateLearn(); break;
      case MODE.EVOLVE: this._updateEvolve(dt); break;
      case MODE.WAIT_PEER: this._updateWaitPeer(dt); break;
      case MODE.END: this._updateEnd(); break;
      default: break;
    }
  }

  _animateBars(dt) {
    for (let s = 0; s < 2; s++) {
      const mon = activeOf(this.battle.sides[s]);
      if (!mon) continue;
      const target = mon.hp;
      if (this.dispHp[s] !== target) {
        const speed = Math.max(1, maxHp(mon) * dt * 1.6);
        if (this.dispHp[s] > target) this.dispHp[s] = Math.max(target, this.dispHp[s] - speed);
        else this.dispHp[s] = Math.min(target, this.dispHp[s] + speed);
      }
    }
    const me = activeOf(this.battle.sides[this.mySide]);
    if (me && this.expTarget != null) {
      const d = this.expTarget - this.dispExp;
      if (Math.abs(d) < 0.005) { this.dispExp = this.expTarget; this.expTarget = null; }
      else this.dispExp += Math.sign(d) * Math.min(Math.abs(d), dt * 0.9);
    }
  }

  // ---- event playback ---------------------------------------------------------

  _updatePlay(dt) {
    // Finish the current animation before pulling the next event.
    if (this.current) {
      this.animT += dt;
      const e = this.current;
      const barsSettled = Math.abs(this.dispHp[0] - (activeOf(this.battle.sides[0])?.hp ?? 0)) < 0.6
        && Math.abs(this.dispHp[1] - (activeOf(this.battle.sides[1])?.hp ?? 0)) < 0.6;

      if (e.t === 'text') {
        const full = e.s;
        const speed = input.isDown('a') || input.isDown('b') ? 3 : 1;
        this.msgShown = Math.min(full.length, this.msgShown + dt * 1000 / 18 * speed);
        if (this.msgShown >= full.length) {
          this.msgHold += dt * speed;
          const need = e.hold != null ? e.hold : 0.55;
          if (this.msgHold >= need && barsSettled) this.current = null;
          if (input.pressed('a') || input.consumeTap()) this.current = null;
        }
        return;
      }
      if (this.animT >= (e.dur || 0) && barsSettled) this.current = null;
      return;
    }

    if (!this.queue.length) {
      // Nothing left: decide what happens next.
      this._afterEvents();
      return;
    }
    this._begin(this.queue.shift());
  }

  _begin(e) {
    this.current = e;
    this.animT = 0;
    switch (e.t) {
      case 'text':
        this.msg = e.s;
        this.msgShown = 0;
        this.msgHold = 0;
        break;
      case 'sfx': audio.sfx(e.s); this.current = null; break;
      case 'hit':
        this.shake[e.side] = 1;
        this.flash[e.side] = 1;
        e.dur = e.eff >= 2 ? 0.32 : 0.22;
        break;
      case 'hp': e.dur = 0.05; break;
      case 'faint':
        this.faintDrop[e.side] = 1;
        e.dur = 0.55;
        break;
      case 'withdraw':
        this.slide[e.side] = 1;
        e.dur = 0.2;
        break;
      case 'sendout': {
        this.slide[e.side] = 0;
        this.faintDrop[e.side] = 0;
        const mon = activeOf(this.battle.sides[e.side]);
        if (mon) { this.dispHp[e.side] = mon.hp; if (e.side === this.mySide) this.dispExp = expProgress(mon); }
        if (mon && e.side === this.foeSide) audio.cry(mon.species);
        e.dur = 0.35;
        break;
      }
      case 'slidein': this.slide[e.side] = 0; e.dur = 0.35; break;
      case 'usemove': e.dur = 0.18; break;
      case 'status': e.dur = 0.2; break;
      case 'stat': e.dur = 0.15; break;
      case 'exp':
        this.expTarget = e.after.level > e.before.level ? 1 : e.after.progress;
        this._pendingExpAfter = e.after;
        e.dur = 0.5;
        break;
      case 'levelup':
        this.dispExp = 0;
        this.expTarget = e.index === this._activeIndex() ? expProgress(this.game.state.party[e.index]) : 0;
        e.dur = 0.4;
        break;
      case 'learn':
        this._queueLearn(e);
        this.current = null;
        break;
      case 'evolve':
        this._queueEvolve(e);
        this.current = null;
        break;
      case 'throwball':
        this.ballAnim = { t: 0, phase: 'throw', ball: e.ball };
        e.dur = 0.55;
        break;
      case 'wobble':
        this.ballAnim = { t: 0, phase: 'wobble', count: e.count, caught: e.caught, ball: this.ballAnim?.ball };
        e.dur = 0.5 + e.count * 0.42;
        break;
      case 'prize': {
        const amount = e.amount || 0;
        this.game.state.inventory.money = Math.min(999999, this.game.state.inventory.money + amount);
        this.queue.unshift({ t: 'text', s: `You got ${money(amount)} for winning!` });
        this.current = null;
        break;
      }
      case 'nickname': {
        // Ask once, on top of the battle screen; the queue resumes when the
        // keyboard pops, so a skipped nickname costs nothing but a tap.
        const mon = e.mon;
        this.current = null;
        if (mon) this.game.screens.push(new NicknameScreen(this.game, mon, null));
        break;
      }
      case 'openLearn': this.pendingLearnOpen = true; this.current = null; break;
      case 'openEvolve': this.current = null; break;
      case 'finishEvolve': this.current = null; break;
      case 'command': this.mode = MODE.COMMAND; this.current = null; this.msg = ''; break;
      case 'finish': this._finish(); this.current = null; break;
      default: this.current = null;
    }
  }

  _activeIndex() { return this.battle.sides[this.mySide].active; }

  _queueLearn(e) {
    const mon = this.battle.sides[this.mySide].party[e.index];
    if (!mon || knowsMove(mon, e.move)) return;
    const mv = getMove(e.move);
    if (mon.moves.length < 4) {
      learnMove(mon, e.move);
      this.queue.unshift({ t: 'text', s: `${displayName(mon)} learned ${mv.name}!` });
      this.queue.unshift({ t: 'sfx', s: 'levelup' });
      return;
    }
    this.pendingLearn = { mon, move: e.move };
    this.queue.unshift({ t: 'openLearn' });
    this.queue.unshift({ t: 'text', s: `${displayName(mon)} wants to learn ${mv.name},\nbut it already knows four moves.` });
  }

  _queueEvolve(e) {
    const mon = this.battle.sides[this.mySide].party[e.index];
    if (!mon) return;
    this.pendingEvolve = { mon, into: e.into };
    this.queue.push({ t: 'openEvolve' });
  }

  _afterEvents() {
    // Interactive interludes queued by learn/evolve.
    if (this.pendingLearnOpen) { this.pendingLearnOpen = false; this.mode = MODE.LEARN; return; }
    if (this.pendingEvolve && this.battle.over) { this._startEvolve(); return; }

    if (this.battle.over) {
      if (!this.endHandled) { this.endHandled = true; this._handleEnd(); }
      return;
    }
    // Someone fainted and must be replaced.
    if (needsSwitch(this.battle, this.mySide)) {
      if (this.pvp) {
        this.mode = MODE.SWITCH;
        this.forcedSwitchSide = this.mySide;
        return;
      }
      this.mode = MODE.SWITCH;
      this.forcedSwitchSide = this.mySide;
      return;
    }
    if (needsSwitch(this.battle, this.foeSide)) {
      const idx = chooseAiSwitch(this.battle, this.foeSide);
      if (idx >= 0) { this.queue.push(...forceSwitch(this.battle, this.foeSide, idx)); return; }
    }
    this.mode = MODE.COMMAND;
    this.msg = '';
  }

  // ---- player commands ------------------------------------------------------

  _updateCommand() {
    const tap = input.consumeTap();
    const cmds = this._commandRects();
    if (tap) {
      for (let i = 0; i < cmds.length; i++) {
        if (hit(tap, cmds[i].x, cmds[i].y, cmds[i].w, cmds[i].h)) {
          this.cmdIndex = i;
          audio.sfx('select');
          this._runCommand(i);
          return;
        }
      }
    }
    if (input.repeated('left') && this.cmdIndex % 2 === 1) { this.cmdIndex--; audio.sfx('cursor'); }
    else if (input.repeated('right') && this.cmdIndex % 2 === 0) { this.cmdIndex++; audio.sfx('cursor'); }
    else if (input.repeated('up') && this.cmdIndex >= 2) { this.cmdIndex -= 2; audio.sfx('cursor'); }
    else if (input.repeated('down') && this.cmdIndex < 2) { this.cmdIndex += 2; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._runCommand(this.cmdIndex); }
  }

  _runCommand(i) {
    if (i === 0) { this.mode = MODE.MOVES; this.moveIndex = 0; }
    else if (i === 1) { this.mode = MODE.BAG; this.bagIndex = 0; this.bagScroll = 0; this.bagPocket = 0; }
    else if (i === 2) { this.mode = MODE.PARTY; this.partyIndex = 0; }
    else this._tryRun();
  }

  _updateMoves() {
    const mon = activeOf(this.battle.sides[this.mySide]);
    const n = mon.moves.length;
    const rects = this._moveRects();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < n; i++) {
        if (hit(tap, rects[i].x, rects[i].y, rects[i].w, rects[i].h)) {
          this.moveIndex = i; audio.sfx('select'); this._chooseMove(i); return;
        }
      }
    }
    if (input.repeated('left') && this.moveIndex % 2 === 1) { this.moveIndex--; audio.sfx('cursor'); }
    else if (input.repeated('right') && this.moveIndex % 2 === 0 && this.moveIndex + 1 < n) { this.moveIndex++; audio.sfx('cursor'); }
    else if (input.repeated('up') && this.moveIndex >= 2) { this.moveIndex -= 2; audio.sfx('cursor'); }
    else if (input.repeated('down') && this.moveIndex + 2 < n) { this.moveIndex += 2; audio.sfx('cursor'); }
    if (input.pressed('b')) { audio.sfx('back'); this.mode = MODE.COMMAND; return; }
    if (input.pressed('a')) { audio.sfx('select'); this._chooseMove(this.moveIndex); }
  }

  _chooseMove(i) {
    const mon = activeOf(this.battle.sides[this.mySide]);
    const slot = mon.moves[i];
    if (!slot) return;
    if (slot.pp <= 0) {
      audio.sfx('deny');
      this._say('There is no PP left for that move!');
      return;
    }
    this._submit({ type: 'move', index: i });
  }

  // ---- battle bag ---------------------------------------------------------
  // Pocketed like the field bag, because reaching for a ball is the single
  // most time-critical thing a player does in this game and hunting for it in
  // a flat list is the wrong feel.

  BAG_ROWS = 4;

  /** The pockets that have something usable in them right now. */
  _bagPockets() {
    const inv = this.game.state.inventory;
    const all = battleUsable(inv);
    const order = ['Poké Balls', 'Medicine', 'Items'];
    const pockets = order
      .map((name) => ({ name, items: all.filter((e) => e.item.pocket === name) }))
      .filter((p) => p.items.length);
    // Balls are meaningless in a trainer battle, so the pocket is not offered.
    return this.battle.canCatch ? pockets : pockets.filter((p) => p.name !== 'Poké Balls');
  }

  _bagItems() {
    const pockets = this._bagPockets();
    if (!pockets.length) return [];
    this.bagPocket = Math.max(0, Math.min(this.bagPocket, pockets.length - 1));
    return pockets[this.bagPocket].items;
  }

  /**
   * One source of truth for where the bag's rows are. Hit-testing used to
   * compute its own geometry and disagree with the drawing by 18 pixels, so
   * every row's tap target sat below the row it belonged to — which is why a
   * Poké Ball could not be tapped at all.
   */
  /**
   * The bag takes the bottom of the screen rather than squeezing into the
   * message box: four rows of 10 pixels did not fit in 46, and a row a thumb
   * has to hit needs more than ten pixels anyway.
   */
  _bagBox() {
    const { width: W } = this.game.display;
    return { x: 4, y: this._boxY() - 30, w: W - 8, h: 76 };
  }

  BAG_ROW_H = 12;

  _bagRects() {
    const b = this._bagBox();
    const items = this._bagItems();
    const shown = Math.min(this.BAG_ROWS, Math.max(0, items.length - this.bagScroll));
    const out = [];
    for (let i = 0; i < shown; i++) {
      out.push({
        x: b.x + 4, y: b.y + 17 + i * this.BAG_ROW_H, w: b.w - 8, h: this.BAG_ROW_H,
        index: this.bagScroll + i,
      });
    }
    return out;
  }

  /** Tabs across the top of the bag window, one per non-empty pocket. */
  _bagTabRects() {
    const b = this._bagBox();
    const pockets = this._bagPockets();
    if (pockets.length < 2) return [];
    // Inside the window, with room kept clear on the right for the BACK chip.
    const room = b.w - 8 - 50;
    const tw = Math.min(84, Math.floor(room / pockets.length) - 2);
    return pockets.map((p, i) => ({ ...p, i, x: b.x + 4 + i * (tw + 2), y: b.y + 3, w: tw, h: 11 }));
  }

  _updateBag() {
    const pockets = this._bagPockets();
    const items = this._bagItems();
    const rows = this.BAG_ROWS;
    const tap = input.consumeTap();

    if (tap) {
      for (const t of this._bagTabRects()) {
        if (hit(tap, t.x, t.y, t.w, t.h)) { this._setBagPocket(t.i); return; }
      }
      for (const r of this._bagRects()) {
        if (hit(tap, r.x, r.y, r.w, r.h)) {
          this.bagIndex = r.index; audio.sfx('select'); this._useItem(items[this.bagIndex]); return;
        }
      }
    }

    if (!pockets.length) {
      if (input.pressed('a') || input.pressed('b') || tap) { audio.sfx('back'); this.mode = MODE.COMMAND; }
      return;
    }
    if (input.repeated('left')) this._setBagPocket((this.bagPocket - 1 + pockets.length) % pockets.length);
    if (input.repeated('right')) this._setBagPocket((this.bagPocket + 1) % pockets.length);
    if (input.repeated('up')) { this.bagIndex = (this.bagIndex - 1 + items.length) % items.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.bagIndex = (this.bagIndex + 1) % items.length; audio.sfx('cursor'); }
    this.bagScroll = Math.max(0, Math.min(this.bagIndex - rows + 1, Math.max(0, items.length - rows)));
    if (this.bagIndex < this.bagScroll) this.bagScroll = this.bagIndex;
    if (input.pressed('b')) { audio.sfx('back'); this.mode = MODE.COMMAND; return; }
    if (input.pressed('a')) { audio.sfx('select'); this._useItem(items[this.bagIndex]); }
  }

  _setBagPocket(i) {
    if (i === this.bagPocket) return;
    this.bagPocket = i;
    this.bagIndex = 0;
    this.bagScroll = 0;
    audio.sfx('cursor');
  }

  _useItem(entry) {
    if (!entry) return;
    const item = entry.item;
    if (item.use.kind === 'ball' && this.battle.kind !== 'wild') {
      audio.sfx('deny');
      this._say('You cannot catch another trainer’s Pokémon!');
      return;
    }
    if (this.pvp) { audio.sfx('deny'); this._say('Items are switched off in link battles.'); return; }
    removeItem(this.game.state.inventory, item.id, 1);
    const target = item.use.kind === 'ball' ? null : this.battle.sides[this.mySide].active;
    this._submit({ type: 'item', item: item.id, target });
  }

  _updateParty() {
    const party = this.battle.sides[this.mySide].party;
    const tap = input.consumeTap();
    const bx = 6, by = 14;
    if (tap) {
      for (let i = 0; i < party.length; i++) {
        if (hit(tap, bx, by + i * 22, 150, 20)) { this.partyIndex = i; audio.sfx('select'); this._chooseSwitch(i); return; }
      }
    }
    if (input.repeated('up')) { this.partyIndex = (this.partyIndex - 1 + party.length) % party.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.partyIndex = (this.partyIndex + 1) % party.length; audio.sfx('cursor'); }
    if (input.pressed('b')) { audio.sfx('back'); this.mode = MODE.COMMAND; return; }
    if (input.pressed('a')) { audio.sfx('select'); this._chooseSwitch(this.partyIndex); }
  }

  _chooseSwitch(i) {
    const side = this.battle.sides[this.mySide];
    const mon = side.party[i];
    if (!mon) return;
    if (isFainted(mon)) { audio.sfx('deny'); this._say(`${displayName(mon)} has no energy left to fight!`); return; }
    if (i === side.active) { audio.sfx('deny'); this._say(`${displayName(mon)} is already out!`); return; }
    this._submit({ type: 'switch', index: i });
  }

  _tryRun() {
    if (this.pvp) {
      this.pvp.forfeit();
      return;
    }
    if (this.battle.kind !== 'wild') {
      this._say('There is no running from a trainer battle!');
      return;
    }
    this._submit({ type: 'run' });
  }

  // Shows a line and then returns to the command menu.
  _say(text) {
    this.queue.unshift({ t: 'command' });
    this.queue.unshift({ t: 'text', s: text });
    this.mode = MODE.PLAY;
  }

  // ---- submitting a turn ---------------------------------------------------------

  _submit(action) {
    this.msg = '';
    if (this.pvp) {
      this.pvp.submitAction(action);
      this.mode = MODE.WAIT_PEER;
      this.waitT = 0;
      return;
    }
    const foeAction = chooseAiAction(this.battle, this.foeSide);
    const actions = [];
    actions[this.mySide] = action;
    actions[this.foeSide] = foeAction;
    const events = resolveTurn(this.battle, actions);
    this.queue.push(...events);
    this.mode = MODE.PLAY;
  }

  _updateWaitPeer(dt) {
    this.waitT += dt;
    if (this.pvp && this.pvp.phase === PVP_STATE.ENDED) {
      this.mode = MODE.PLAY;
    }
  }

  _updateSwitch() {
    const side = this.battle.sides[this.mySide];
    const party = side.party;
    const tap = input.consumeTap();
    const bx = 6, by = 14;
    if (tap) {
      for (let i = 0; i < party.length; i++) {
        if (hit(tap, bx, by + i * 22, 150, 20) && !isFainted(party[i])) {
          audio.sfx('select'); this._doForcedSwitch(i); return;
        }
      }
    }
    if (input.repeated('up')) { this.partyIndex = (this.partyIndex - 1 + party.length) % party.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.partyIndex = (this.partyIndex + 1) % party.length; audio.sfx('cursor'); }
    if (input.pressed('a')) {
      if (isFainted(party[this.partyIndex])) { audio.sfx('deny'); return; }
      audio.sfx('select');
      this._doForcedSwitch(this.partyIndex);
    }
  }

  _doForcedSwitch(i) {
    if (this.pvp) {
      this.pvp.submitSwitch(i);
      this.mode = MODE.WAIT_PEER;
      return;
    }
    this.queue.push(...forceSwitch(this.battle, this.mySide, i));
    // The AI replaces its own fainted monster at the same time.
    if (needsSwitch(this.battle, this.foeSide)) {
      const idx = chooseAiSwitch(this.battle, this.foeSide);
      if (idx >= 0) this.queue.push(...forceSwitch(this.battle, this.foeSide, idx));
    }
    this.queue.push({ t: 'command' });
    this.mode = MODE.PLAY;
  }

  // ---- learn / evolve --------------------------------------------------------------

  _updateLearn() {
    const { mon, move } = this.pendingLearn || {};
    if (!mon) { this.mode = MODE.PLAY; return; }
    const n = 5;
    const tap = input.consumeTap();
    const x = 8, y = this._boxY() - 46;
    if (tap) {
      for (let i = 0; i < n; i++) {
        if (hit(tap, x, y + 6 + i * LINE, 130, LINE)) { this.learnIndex = i; audio.sfx('select'); this._resolveLearn(i); return; }
      }
    }
    if (input.repeated('up')) { this.learnIndex = (this.learnIndex - 1 + n) % n; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.learnIndex = (this.learnIndex + 1) % n; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._resolveLearn(this.learnIndex); }
    if (input.pressed('b')) { audio.sfx('back'); this._resolveLearn(4); }
    void move;
  }

  _resolveLearn(index) {
    const { mon, move } = this.pendingLearn;
    this.pendingLearn = null;
    const mv = getMove(move);
    if (index >= 4) {
      this.queue.unshift({ t: 'text', s: `${displayName(mon)} did not learn ${mv.name}.` });
    } else {
      const old = getMove(mon.moves[index].id);
      learnMove(mon, move, index);
      audio.sfx('levelup');
      this.queue.unshift({ t: 'text', s: `${displayName(mon)} forgot ${old.name}\nand learned ${mv.name}!` });
    }
    this.mode = MODE.PLAY;
  }

  _startEvolve() {
    this.evolveData = { ...this.pendingEvolve, t: 0, phase: 'grow', cancelled: false };
    this.pendingEvolve = null;
    this.mode = MODE.EVOLVE;
    audio.stopMusic();
    audio.sfx('evolve');
  }

  _updateEvolve(dt) {
    const e = this.evolveData;
    if (!e) { this.mode = MODE.PLAY; return; }
    e.t += dt;
    // B cancels, exactly like the games.
    if (input.pressed('b') && e.t < 2.6) {
      e.cancelled = true;
      this.evolveData = null;
      this.queue.push({ t: 'text', s: `${displayName(e.mon)} stopped evolving.` });
      this.mode = MODE.PLAY;
      return;
    }
    if (e.t > 3.2 && !e.done) {
      e.done = true;
      const before = displayName(e.mon);
      evolveNow(e.mon, e.into);
      recordCaught(this.game.state.dex, e.into);
      audio.sfx('caught');
      audio.cry(e.into);
      this.queue.push({ t: 'text', s: `Congratulations! ${before} evolved into ${getSpecies(e.into).name}!` });
      const learns = getSpecies(e.into).learnset.filter(([lv]) => lv <= e.mon.level).map(([, id]) => id);
      for (const id of learns.slice(-1)) {
        if (!knowsMove(e.mon, id)) {
          const idx = this.battle.sides[this.mySide].party.indexOf(e.mon);
          this.queue.push({ t: 'learn', index: idx, move: id, uid: e.mon.uid });
        }
      }
      this.queue.push({ t: 'finishEvolve' });
    }
    if (e.done && e.t > 4.2) { this.evolveData = null; this.mode = MODE.PLAY; }
  }

  // ---- ending -------------------------------------------------------------------

  _handleEnd() {
    const st = this.game.state;
    const b = this.battle;

    if (b.result === 'caught' && b.caught && !this.caughtRecorded) {
      this.caughtRecorded = true;
      const mon = b.caught.mon;
      mon.ot = st.player.name;
      mon.otId = st.player.id;
      mon.caughtBall = b.caught.ball;
      mon.caughtAt = this.opts.location || st.player.map;
      mon.caughtLevel = mon.level;
      const dest = receiveMonster(st, mon);
      st.stats.caught++;
      const newEntry = recordCaught(st.dex, mon.species);
      if (newEntry) this.queue.push({ t: 'text', s: `${displayName(mon)}'s data was added to the Pokédex.` });
      if (dest && dest.where === 'box') {
        this.queue.push({ t: 'text', s: `Your party is full, so ${displayName(mon)}\nwas sent to ${dest.boxName}.` });
      }
      // The moment it stops being a species and becomes yours.
      this.queue.push({ t: 'nickname', mon });
      this.queue.push({ t: 'finish' });
      this.mode = MODE.PLAY;
      return;
    }

    if (b.result === 'win') {
      st.stats.battlesWon++;
      const t = b.sides[this.foeSide].trainer;
      if (t && t.id) this.game.state.flags[`beat_${t.id}`] = true;
      audio.playMusic(MUSIC.victory, 'victory');
    }
    if (b.result === 'lose') {
      this.queue.push({ t: 'text', s: `${st.player.name} is out of usable Pokémon!` });
      if (this.opts.noBlackout) {
        // Sanctioned events have medical staff at the side of the floor.
        this.queue.push({ t: 'text', s: 'The match is over. Officials take your team\nstraight to the recovery room.' });
      } else {
        this.queue.push({ t: 'text', s: `${st.player.name} panicked and ran all the way\nto the last Pokémon Center...` });
      }
    }
    if (this.pendingEvolve) { this._startEvolve(); return; }
    this.queue.push({ t: 'finish' });
    this.mode = MODE.PLAY;
  }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    const result = this.battle.result;
    this.result = result;
    if (this.pvp && this.pvp.phase !== PVP_STATE.ENDED) this.pvp.finishBattle();
    const cb = this.onFinish;
    this.game.screens.fade(FADE.BLACK, () => {
      this.game.screens.pop();
      if (cb) cb(result === 'win' || result === 'caught' || result === 'run');
      this.game.afterBattle(result, this.opts);
    }, { outMs: 260, inMs: 300 });
    this.mode = MODE.END;
  }

  _updateEnd() { /* waiting on the fade */ }

  // ---- rendering ----------------------------------------------------------------

  _boxY() { return this.game.display.height - 46; }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    this._drawBackdrop(ctx, W, H);
    this._drawWeather(ctx, W, H);
    this._drawCombatants(ctx, W, H);
    this._drawHuds(ctx, W, H);

    if (this.evolveData) { this._drawEvolution(ctx, W, H); return; }

    switch (this.mode) {
      case MODE.COMMAND: this._drawCommand(ctx, W, H); break;
      case MODE.MOVES: this._drawMoves(ctx, W, H); drawBackChip(ctx, 4, this._boxY() - 26); break;
      case MODE.BAG: this._drawBag(ctx, W, H); break;
      case MODE.PARTY:
        this._drawPartyPicker(ctx, W, H); drawBackChip(ctx, W - 52, 4); break;
      case MODE.SWITCH: this._drawPartyPicker(ctx, W, H); break;
      case MODE.LEARN: this._drawLearn(ctx, W, H); break;
      case MODE.WAIT_PEER: this._drawWaiting(ctx, W, H); break;
      default: this._drawMessage(ctx, W, H); break;
    }
  }

  /** Where the two fighters stand. One source, so bases and sprites agree. */
  _platforms(W, H) {
    return { foe: { x: W - 74, y: H * 0.42 + 12 }, player: { x: 46, y: H * 0.66 + 8 } };
  }

  _drawBackdrop(ctx, W, H) {
    const kind = this.opts.terrain || 'grass';
    // Outdoors, the DS's own scene. A cave or a gym is not a grass field, so
    // those keep the drawn backdrop.
    if (kind !== 'cave' && kind !== 'indoor') {
      const p = this._platforms(W, H);
      if (drawBattleScene(ctx, W, H, p.foe, p.player)) return;
    }
    const sky = kind === 'cave' ? shade(PAL.caveWall, 0.1)
      : kind === 'indoor' ? shade(PAL.wallIn, -0.05) : PAL.battleSky;
    rect(ctx, 0, 0, W, H, sky);
    // Ground band.
    const groundY = H * 0.42;
    rect(ctx, 0, groundY, W, H - groundY,
      kind === 'cave' ? PAL.caveFloor : kind === 'indoor' ? PAL.floorTile : PAL.battleGroundB);
    for (let y = groundY; y < H; y += 6) {
      rect(ctx, 0, y, W, 3, kind === 'cave' ? shade(PAL.caveFloor, 0.05)
        : kind === 'indoor' ? shade(PAL.floorTile, -0.04) : PAL.battleGroundA);
    }
    // Platforms: simple ellipses so the fighters sit in the world.
    this._platform(ctx, W - 74, groundY + 6, 62, 14, kind);
    this._platform(ctx, 46, H * 0.66, 80, 15, kind);
  }

  _platform(ctx, cx, cy, rx, ry, kind) {
    const base = kind === 'cave' ? PAL.caveFloorDark : kind === 'indoor' ? PAL.floorTileAlt : PAL.grassDark;
    for (let y = -ry; y <= ry; y++) {
      const half = rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
      ctx.fillStyle = y < -ry * 0.4 ? shade(base, 0.18) : base;
      ctx.fillRect(Math.round(cx - half), Math.round(cy + y), Math.round(half * 2), 1);
    }
  }

  _drawCombatants(ctx, W, H) {
    const foeSide = this.battle.sides[this.foeSide];
    const mySide = this.battle.sides[this.mySide];
    const foe = activeOf(foeSide);
    const me = activeOf(mySide);

    // Drawn at the sprites' own 80px, not scaled down to fit: the logical
    // screen is 192 tall, exactly like the DS's, so native size IS the right
    // size and every pixel of the artwork survives.
    if (foe) {
      const art = getSpecies(foe.species).art;
      const img = renderMonster(art, { size: MON, shiny: foe.shiny });
      const p = this._platforms(W, H).foe;
      const sx = p.x - MON / 2 + this._shakeOffset(this.foeSide) + (1 - this.slide[this.foeSide]) * 60;
      const sy = p.y - spriteFoot(art.key, false, MON) + this.faintDrop[this.foeSide] * 34;
      this._drawSprite(ctx, img, sx, sy, this.flash[this.foeSide], this.faintDrop[this.foeSide]);
    }
    if (me) {
      const art = getSpecies(me.species).art;
      const img = renderMonster(art, { size: MON, back: true, shiny: me.shiny });
      const p = this._platforms(W, H).player;
      const sx = p.x - MON / 2 + this._shakeOffset(this.mySide) - (1 - this.slide[this.mySide]) * 80;
      const sy = p.y - spriteFoot(art.key, true, MON) + this.faintDrop[this.mySide] * 40;
      this._drawSprite(ctx, img, sx, sy, this.flash[this.mySide], this.faintDrop[this.mySide]);
    }
    if (this.ballAnim) this._drawBall(ctx, W, H);
  }

  /**
   * The sky, over the backdrop and behind the fighters.
   *
   * Rain and hail fall, sand blows sideways, and sun is a warm wash with a
   * slow shimmer — all driven off the animation clock rather than stored
   * particles, so it costs nothing and cannot drift between two linked
   * clients that are watching the same battle.
   */
  _drawWeather(ctx, W, H) {
    const sky = activeWeather(this.battle);
    if (!sky) return;
    const t = this.t || 0;

    if (sky === 'sun') {
      ctx.save();
      ctx.globalAlpha = 0.10 + Math.sin(t * 1.4) * 0.03;
      ctx.fillStyle = '#ffd870';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }

    ctx.save();
    if (sky === 'sand') {
      ctx.globalAlpha = 0.11;
      ctx.fillStyle = '#d8b878';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#c8a058';
      for (let i = 0; i < 60; i++) {
        const y = (i * 37) % H;
        const x = ((i * 97) + t * 260) % (W + 40) - 20;
        ctx.fillRect(Math.round(x), y, 5, 1);
      }
    } else if (sky === 'rain') {
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = '#3a5a90';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#a8c8f0';
      for (let i = 0; i < 70; i++) {
        const x = ((i * 53) - t * 60) % (W + 30);
        const y = ((i * 71) + t * 420) % (H + 20) - 10;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 5);
      }
    } else if (sky === 'hail') {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#a8d8f0';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#eaf6ff';
      for (let i = 0; i < 46; i++) {
        const x = ((i * 61) + Math.sin((t + i) * 2) * 6) % (W + 20) - 10;
        const y = ((i * 83) + t * 200) % (H + 16) - 8;
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
    ctx.restore();
  }

  _drawSprite(ctx, img, x, y, flash, drop) {
    ctx.save();
    if (drop > 0) {
      ctx.globalAlpha = Math.max(0, 1 - drop * 1.1);
      ctx.beginPath();
      ctx.rect(x, y, img.width, img.height * Math.max(0, 1 - drop));
      ctx.clip();
    }
    ctx.drawImage(img, Math.round(x), Math.round(y));
    if (flash > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = flash * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, img.width, img.height);
    }
    ctx.restore();
  }

  _shakeOffset(side) {
    if (this.shake[side] <= 0) return 0;
    return Math.round(Math.sin(this.shake[side] * 40) * this.shake[side] * 4);
  }

  _drawBall(ctx, W, H) {
    const a = this.ballAnim;
    a.t += 1 / 60;
    const tx = W - 74, ty = H * 0.42 - 14;
    if (a.phase === 'throw') {
      const p = Math.min(1, a.t / 0.5);
      const x = 40 + (tx - 40) * p;
      const y = H * 0.72 - 20 - Math.sin(p * Math.PI) * 40 + p * 8;
      this._ballSprite(ctx, x, y, a.ball, p * 8);
    } else {
      const x = tx, y = ty + 20;
      const wob = Math.sin(a.t * 9) * Math.max(0, 1 - a.t / (0.5 + a.count * 0.42)) * 4;
      this._ballSprite(ctx, x + wob, y, a.ball, 0);
      if (a.caught && a.t > 0.5 + a.count * 0.42 - 0.2) {
        drawText(ctx, '★', Math.round(x - 10), Math.round(y - 10), { color: PAL.uiHighlight });
        drawText(ctx, '★', Math.round(x + 8), Math.round(y - 8), { color: PAL.uiHighlight });
      }
    }
  }

  _ballSprite(ctx, x, y, ballId, spin) {
    const top = ballId === 'greatball' ? '#3f6fd4' : ballId === 'ultraball' ? '#20283a'
      : ballId === 'netball' ? '#3fa8b4' : '#e05248';
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#20283a';
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = top;
    ctx.fillRect(x - 4, y - 4, 8, 4);
    ctx.fillStyle = '#f4f4f8';
    ctx.fillRect(x - 4, y, 8, 4);
    ctx.fillStyle = '#20283a';
    ctx.fillRect(x - 4, y - 1 + (Math.round(spin) % 2), 8, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - 3, 2, 1);
  }

  // ---- HUD -------------------------------------------------------------------

  _drawHuds(ctx, W, H) {
    const foe = activeOf(this.battle.sides[this.foeSide]);
    const me = activeOf(this.battle.sides[this.mySide]);
    if (foe) this._monHud(ctx, foe, 6, 8, false, this.dispHp[this.foeSide]);
    // The bag takes the lower half of the screen, the way the DS bag takes the
    // lower screen — drawing your own HUD under it just leaves a sliced panel.
    if (me && this.mode !== MODE.BAG) {
      this._monHud(ctx, me, W - 122, H * 0.44, true, this.dispHp[this.mySide]);
    }
    this._partyPips(ctx, W, H);
  }

  _monHud(ctx, mon, x, y, mine, dispHp) {
    const w = 116, h = mine ? 34 : 26;
    window9(ctx, x, y, w, h, { shadow: true });
    const name = displayName(mon);
    label(ctx, name, x + 6, y + 4);
    genderMark(ctx, mon.gender, x + 8 + name.length * 6, y + 4);
    drawTextRight(ctx, `Lv${mon.level}`, x + w - 6, y + 4, { color: PAL.uiText });
    hpBar(ctx, x + 20, y + 15, w - 28, dispHp / maxHp(mon));
    labelDim(ctx, 'HP', x + 6, y + 13);
    if (mon.status) statusChip(ctx, mon.status, x + 6, y + 20);
    if (mine) {
      drawTextRight(ctx, `${Math.max(0, Math.round(dispHp))}/${maxHp(mon)}`, x + w - 6, y + 20, { color: PAL.uiText });
      expBar(ctx, x + 6, y + 30, w - 12, this.dispExp);
    }
    if (mon.shiny) drawText(ctx, '★', x + w - 10, y + 12, { color: PAL.uiHighlight });
  }

  _partyPips(ctx, W, H) {
    const draw = (side, x, y, dir) => {
      const party = this.battle.sides[side].party;
      party.forEach((m, i) => {
        const px = x + i * 7 * dir;
        const col = !m ? PAL.uiShadow : isFainted(m) ? PAL.statusFNT : (m.status ? PAL.statusPAR : PAL.hpGreen);
        rect(ctx, px, y, 5, 5, PAL.uiFrame);
        rect(ctx, px + 1, y + 1, 3, 3, col);
      });
    };
    if (this.battle.kind !== 'wild') draw(this.foeSide, 6, 36, 1);
    draw(this.mySide, W - 12, H * 0.44 + 36, -1);
  }

  // ---- message + menus ---------------------------------------------------------

  _drawMessage(ctx, W, H) {
    const y = this._boxY();
    window9(ctx, 4, y, W - 8, 42);
    const lines = String(this.msg).split('\n');
    let remaining = this.msgShown;
    lines.forEach((ln, i) => {
      const n = Math.max(0, Math.min(ln.length, Math.floor(remaining)));
      remaining -= ln.length + 1;
      if (n > 0) label(ctx, ln, 12, y + 8 + i * LINE, { limit: n });
    });
  }

  _commandRects() {
    const { width: W, height: H } = this.game.display;
    const y = this._boxY();
    const bw = (W - 16) / 2 - 4, bh = 17;
    const out = [];
    for (let i = 0; i < 4; i++) {
      out.push({
        x: 8 + (i % 2) * (bw + 6),
        y: y + 4 + Math.floor(i / 2) * (bh + 3),
        w: bw, h: bh,
      });
    }
    void H;
    return out;
  }

  _drawCommand(ctx, W, H) {
    const y = this._boxY();
    window9(ctx, 4, y, W - 8, 42);
    const names = ['FIGHT', 'BAG', 'POKéMON', this.pvp ? 'FORFEIT' : (this.battle.kind === 'wild' ? 'RUN' : 'RUN')];
    const cols = [PAL.uiDanger, '#e08a30', '#3f9060', '#5a6a94'];
    this._commandRects().forEach((r, i) => {
      const sel = i === this.cmdIndex;
      rect(ctx, r.x, r.y, r.w, r.h, sel ? cols[i] : shade(cols[i], 0.55));
      rect(ctx, r.x, r.y, r.w, 1, shade(cols[i], 0.4));
      rect(ctx, r.x, r.y + r.h - 1, r.w, 1, shade(cols[i], -0.3));
      drawTextCentered(ctx, names[i], r.x + r.w / 2, r.y + 5,
        { color: sel ? '#ffffff' : PAL.uiText, shadow: sel ? shade(cols[i], -0.5) : null });
      if (sel) cursor(ctx, r.x + 3, r.y + 5, { color: '#ffffff' });
    });
    void H;
  }

  _moveRects() {
    const { width: W } = this.game.display;
    const y = this._boxY();
    const bw = (W - 16) / 2 - 4, bh = 15;
    const out = [];
    for (let i = 0; i < 4; i++) {
      out.push({ x: 8 + (i % 2) * (bw + 6), y: y + 3 + Math.floor(i / 2) * (bh + 3), w: bw, h: bh });
    }
    return out;
  }

  _drawMoves(ctx, W, H) {
    const y = this._boxY();
    const mon = activeOf(this.battle.sides[this.mySide]);
    window9(ctx, 4, y, W - 8, 42);
    const rects = this._moveRects();
    mon.moves.forEach((slot, i) => {
      const mv = getMove(slot.id);
      const r = rects[i];
      const sel = i === this.moveIndex;
      const col = typeColor(mv.type);
      rect(ctx, r.x, r.y, r.w, r.h, sel ? col : shade(col, 0.6));
      rect(ctx, r.x, r.y, r.w, 1, shade(col, 0.4));
      const out = slot.pp <= 0;
      drawText(ctx, mv.name, r.x + 4, r.y + 4,
        { color: out ? PAL.uiShadow : (sel ? '#ffffff' : PAL.uiText), shadow: sel ? shade(col, -0.5) : null });
      drawTextRight(ctx, `${slot.pp}/${slot.ppMax}`, r.x + r.w - 3, r.y + 4,
        { color: out ? PAL.uiDanger : (sel ? '#ffffff' : PAL.uiTextDim) });
    });
    // Detail strip for the highlighted move.
    const mv = getMove(mon.moves[this.moveIndex]?.id || 'tackle');
    const dy = y - 13;
    window9(ctx, 4, dy, W - 8, 13, { bg: PAL.uiBgAlt });
    typeChip(ctx, mv.type, 8, dy + 2);
    drawText(ctx, mv.power ? `PWR ${mv.power}` : 'STATUS', 62, dy + 3, { color: PAL.uiText });
    drawText(ctx, mv.acc ? `ACC ${mv.acc}` : 'ACC --', 118, dy + 3, { color: PAL.uiText });
    drawTextRight(ctx, mv.cls.toUpperCase(), W - 8, dy + 3, { color: PAL.uiTextDim });
    void H;
  }

  _drawBag(ctx, W, H) {
    const b = this._bagBox();
    const pockets = this._bagPockets();
    window9(ctx, b.x, b.y, b.w, b.h);
    drawBackChip(ctx, b.x + b.w - 48, b.y + 3);
    if (!pockets.length) {
      label(ctx, 'You have nothing you can use here.', b.x + 8, b.y + 20);
      labelDim(ctx, 'B: back', b.x + 8, b.y + 34);
      void W; void H;
      return;
    }

    // Pocket tabs sit on the window's top edge, the way the hub's do.
    for (const t of this._bagTabRects()) {
      const on = t.i === this.bagPocket;
      const col = t.name === 'Poké Balls' ? PAL.uiDanger : t.name === 'Medicine' ? '#3f9060' : '#e08a30';
      rect(ctx, t.x, t.y, t.w, t.h + 2, on ? col : shade(col, 0.5));
      rect(ctx, t.x, t.y, t.w, 1, shade(col, 0.35));
      drawTextCentered(ctx, t.name === 'Poké Balls' ? 'BALLS' : t.name.toUpperCase(),
        t.x + t.w / 2, t.y + 2, { color: on ? '#ffffff' : PAL.uiText });
    }

    const items = this._bagItems();
    for (const r of this._bagRects()) {
      const e = items[r.index];
      if (!e) continue;
      const sel = r.index === this.bagIndex;
      // The highlight covers exactly the tap target — no more, no less, so
      // what the player can see is what the player can hit.
      if (sel) rowHighlight(ctx, r.x, r.y, r.w, r.h, PAL.uiSelect);
      const ty = r.y + Math.floor((r.h - 7) / 2);
      label(ctx, e.item.name, r.x + 5, ty, { color: sel ? PAL.uiTextLight : PAL.uiText });
      drawTextRight(ctx, `x${e.qty}`, r.x + r.w - 14, ty,
        { color: sel ? shade(PAL.uiSelect, 0.7) : PAL.uiTextDim });
    }

    // What the highlighted item does, and where you are in the pocket.
    const sel = items[this.bagIndex];
    if (sel) {
      const count = `${this.bagIndex + 1}/${items.length}`;
      drawTextRight(ctx, count, b.x + b.w - 6, b.y + b.h - 10, { color: PAL.uiTextDim });
      labelDim(ctx, (sel.item.desc || '').slice(0, Math.floor((b.w - 22 - count.length * 6) / 6)),
        b.x + 6, b.y + b.h - 10);
    }
    if (this.bagScroll > 0) drawText(ctx, '▲', b.x + b.w - 11, b.y + 18, { color: PAL.uiTextDim });
    if (this.bagScroll + this.BAG_ROWS < items.length) {
      drawText(ctx, '▼', b.x + b.w - 11, b.y + 17 + (this.BAG_ROWS - 1) * this.BAG_ROW_H,
        { color: PAL.uiTextDim });
    }
    void W; void H;
  }

  _drawPartyPicker(ctx, W, H) {
    const party = this.battle.sides[this.mySide].party;
    rect(ctx, 0, 0, W, H, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55; rect(ctx, 0, 0, W, H, PAL.black); ctx.globalAlpha = 1;
    const bx = 6, by = 14;
    window9(ctx, bx - 4, by - 10, 164, party.length * 22 + 18);
    label(ctx, this.mode === MODE.SWITCH ? 'Send out which Pokémon?' : 'Switch to which Pokémon?', bx, by - 6);
    party.forEach((m, i) => {
      const iy = by + i * 22;
      const sel = i === this.partyIndex;
      rect(ctx, bx, iy, 150, 20, sel ? PAL.uiHighlight : PAL.uiBgAlt);
      rect(ctx, bx, iy, 150, 1, shade(sel ? PAL.uiHighlight : PAL.uiBgAlt, 0.3));
      const img = renderMonster(getSpecies(m.species).art, { size: 20, shiny: m.shiny });
      ctx.drawImage(img, bx + 1, iy);
      label(ctx, displayName(m), bx + 24, iy + 2, { color: isFainted(m) ? PAL.uiShadow : PAL.uiText });
      drawText(ctx, `Lv${m.level}`, bx + 24, iy + 11, { color: PAL.uiTextDim });
      hpBar(ctx, bx + 62, iy + 13, 60, m.hp / maxHp(m));
      drawTextRight(ctx, `${m.hp}/${maxHp(m)}`, bx + 148, iy + 2, { color: PAL.uiTextDim });
      if (m.status) statusChip(ctx, m.status, bx + 100, iy + 1);
      if (i === this.battle.sides[this.mySide].active) drawText(ctx, '▶', bx - 5, iy + 6, { color: PAL.uiDanger });
    });
    if (this.mode !== MODE.SWITCH) labelDim(ctx, 'B: back', bx, by + party.length * 22 + 2);
  }

  _drawLearn(ctx, W, H) {
    const { mon, move } = this.pendingLearn || {};
    if (!mon) return;
    const x = 8, y = this._boxY() - 46;
    window9(ctx, x - 4, y - 4, 150, 5 * LINE + 14);
    label(ctx, 'Forget which move?', x, y - 1);
    mon.moves.forEach((slot, i) => {
      const iy = y + 10 + i * LINE;
      if (i === this.learnIndex) cursor(ctx, x - 1, iy);
      const mv = getMove(slot.id);
      label(ctx, mv.name, x + 8, iy);
      drawTextRight(ctx, `${slot.pp}/${slot.ppMax}`, x + 138, iy, { color: PAL.uiTextDim });
    });
    const iy = y + 10 + 4 * LINE;
    if (this.learnIndex === 4) cursor(ctx, x - 1, iy);
    label(ctx, `Give up on ${getMove(move).name}`, x + 8, iy, { color: PAL.uiDanger });
    void W; void H;
  }

  _drawWaiting(ctx, W, H) {
    const y = this._boxY();
    window9(ctx, 4, y, W - 8, 42);
    const dots = '.'.repeat(1 + (Math.floor(this.waitT * 2) % 3));
    label(ctx, `Waiting for ${this.pvp ? this.pvp.partnerName : 'your partner'}${dots}`, 12, y + 10);
    labelDim(ctx, 'Both trainers pick at the same time.', 12, y + 24);
    void W; void H;
  }

  _drawEvolution(ctx, W, H) {
    const e = this.evolveData;
    rect(ctx, 0, 0, W, H, PAL.black);
    const from = getSpecies(e.mon.species).art;
    const to = getSpecies(e.into).art;
    const cx = W / 2 - 32, cy = H / 2 - 40;

    // Cross-fade with an accelerating strobe, the classic evolution beat.
    const p = Math.min(1, e.t / 3.2);
    const freq = 2 + p * 22;
    const showNew = e.done || (Math.sin(e.t * freq) > 0 && p > 0.25);
    const img = renderMonster(showNew ? to : from, { size: MON, shiny: e.mon.shiny });
    const glow = 0.25 + Math.abs(Math.sin(e.t * freq)) * 0.55 * p;
    ctx.globalAlpha = glow;
    for (let r = 40; r > 0; r -= 8) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 32 - r, cy + 32 - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(img, Math.round(cx), Math.round(cy));

    const y = this._boxY();
    window9(ctx, 4, y, W - 8, 42);
    label(ctx, e.done ? '' : `What? ${displayName(e.mon)} is evolving!`, 12, y + 10);
    if (!e.done) labelDim(ctx, 'B: stop it evolving', 12, y + 24);
  }
}

export { evolutionFor };
