// The overworld screen: walking around, talking, warping, running into
// monsters — and the host for every cutscene.
//
// Cutscenes are written as async functions (see game/overworld/scripts.js).
// This screen supplies the primitives they await, and blocks player input for
// as long as one is running.
import { Screen, FADE } from './screen.js';
import { BEATS } from '../data/campaign.js';
import { evolutionFor } from '../game/evolution.js';
import { World, DIRS } from '../game/overworld/world.js';
import { Camera, drawWorld, drawLocationBanner, drawGuideBar } from '../render/worldrender.js';
import { drawControls, hintBar, computeLayout } from './controls.js';
import { dialogue } from './dialogue.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/events.js';
import { PAL } from '../render/palette.js';
import { window9, label, labelLight, rect, money, drawTextCentered, drawText } from './kit.js';
import { TILE } from '../render/canvas.js';
import { getMap } from '../data/maps/index.js';
import { getTrainer } from '../data/trainers.js';
import { getItem } from '../data/items.js';
import { getSpecies } from '../data/species.js';
import { partnerLine, displayName } from '../game/monster.js';
import { BANDIT, companionLines } from '../data/story.js';
import { acceptShared, shareable, GOODS } from '../game/underground/base.js';
import { refusalText } from '../game/fieldmoves.js';
import { BASE_BOARD, BASE_ORIGIN } from '../data/maps/underground.js';
import { addItem, removeItem, hasItem } from '../game/inventory.js';
import { recordSeen, recordCaught } from '../game/pokedex.js';
import { awardBadge, healParty, setStoryFlag, progress } from '../game/state.js';
import { scriptFor } from '../game/overworld/scripts.js';
import { resolveDialogue, fillText } from '../game/overworld/gossip.js';
import { record as recordJournal, getEntry, objective } from '../game/journal.js';
import { renderMonster } from '../render/monsterart.js';
import { musicFor } from '../data/music.js';
import { net } from '../net/NetworkManager.js';

export class OverworldScreen extends Screen {
  // A root: it owns the whole screen and there is nothing behind it to go
  // back to, so the stack does not hang a BACK chip on it.
  isRoot = true;

  constructor(game) {
    super(game);
    this.world = new World(game.state);
    this.camera = new Camera();
    this.bannerT = 99;
    this.bannerName = '';
    this.timers = [];
    this.script = null;
    this.shakeT = 0;
    this.showcase = null;         // a monster held up during a cutscene
    this.netToast = null;
    this.netToastT = 0;
    this.encounterFlash = 0;
    this.world.onBump = () => audio.sfx('bump');
    // Inside a Secret Base the furniture and the board are save data, not
    // tiles, so the world asks this screen what is standing where.
    this.world.baseTarget = (x, y) => this._baseTarget(x, y);
    this.world.onStep = () => { if (this.game.save) this.game.save.markDirty(); };
  }

  onEnter() {
    const st = this.game.state;
    this.world.onHatch = (egg) => this._hatch(egg);
    this.world.load(st.player.map, st.player.x, st.player.y, st.player.dir);
    this.showBanner(this.world.map);
    this.playMusic();
    this._wireNet();
  }

  onResume() {
    this.playMusic();
    // A partner may have joined or left while a menu was open.
    this.syncRemotes();
    // The party may have changed too — a new lead, a fainted lead, a caught
    // Pokemon — so whoever is walking behind you is re-read from it.
    this.world.refreshFollower();
  }

  onExit() { for (const u of (this.netSubs || [])) u(); this.netSubs = []; }

  _wireNet() {
    this.netSubs = [
      bus.on('net:partnerJoined', ({ name }) => {
        this.toast(`${name} joined!`);
        audio.sfx('join');
      }),
      bus.on('net:partnerLeft', ({ name, reason }) => {
        if (reason === 'self') return;
        this.toast(`${name || 'Your partner'} left.`);
        audio.sfx('leave');
      }),
      bus.on('story:partnerMilestone', ({ key }) => {
        // NEWS, NOT PROGRESS.
        //
        // This used to ADOPT the partner's milestone into your own save, to
        // "keep the two saves compatible". What it actually did was hand the
        // player who is behind the story they have not played yet: link up
        // with somebody a long way ahead, watch them beat a Gym, and your own
        // game quietly marks that Gym beaten, your guide bar jumps to the
        // endgame, and the five chapters in between are gone. For two people
        // playing this through together for the first time that is the worst
        // thing it could possibly do.
        //
        // Neither of you joins the other's story. You each keep your own, at
        // your own pace, and the link tells you what the other one just did —
        // which is the good part, and costs nothing.
        const beat = BEATS.find((b) => b.flag === key);
        const snap = net.snapshot() || {};
        const who = (snap.partner && snap.partner.name) || 'Your partner';
        this.toast(beat ? `${who}: ${beat.text}` : `${who} reached a milestone.`);
        audio.sfx('select');
      }),
      // A partner's Secret Base arrives whole. It is another player's data, so
      // it is rebuilt field by field before anything in this game touches it.
      bus.on('net:base', ({ kind, data }) => {
        const ug = this.game.state.underground;
        if (kind === 'base.share') {
          const base = acceptShared(data && data.base);
          if (!base) return;
          const first = !ug.partnerBase;
          ug.partnerBase = base;
          if (first) this.toast(`${base.owner || 'Your partner'} has a base down there`);
        } else if (kind === 'base.flag') {
          if (ug.base) ug.base.flagTaken++;
          this.toast('Your flag has been taken!');
          audio.sfx('deny');
        }
      }),
      bus.on('trade:changed', () => this.game.openTradeIfNeeded()),
      bus.on('pvp:changed', () => this.game.openPvpIfNeeded()),
    ];
  }

  playMusic() {
    const track = musicFor(this.world.map.music);
    audio.playMusic(track, this.world.map.music);
  }

  showBanner(map) {
    if (map.kind === 'indoor') return;
    this.bannerName = map.name;
    this.bannerT = 0;
  }

  toast(text) { this.netToast = text; this.netToastT = 0; }

  // ---- update -----------------------------------------------------------

  update(dt, isTop) {
    const { display } = this.game;
    this.bannerT += dt;
    if (this.netToast) { this.netToastT += dt; if (this.netToastT > 3.2) this.netToast = null; }
    if (this.encounterFlash > 0) this.encounterFlash -= dt;

    // Cutscene timers.
    for (let i = this.timers.length - 1; i >= 0; i--) {
      this.timers[i].t -= dt;
      if (this.timers[i].t <= 0) { this.timers[i].resolve(); this.timers.splice(i, 1); }
    }

    dialogue.update(dt, isTop && !this.game.screens.busy);

    const blocked = !isTop || dialogue.busy || !!this.script || this.game.screens.busy;
    this.world.busy = blocked;

    let moveDir = null;
    let running = false;
    if (!blocked) {
      moveDir = input.direction();
      // The shoes are a real item Mum hands over with a small speech, so
      // holding B before you have them should do nothing. It used to run
      // regardless, which made the scene a lie and the item decoration.
      running = input.isDown('b') && hasItem(this.game.state.inventory, 'runningshoes');
    }
    this.world.update(dt, !blocked, moveDir, running);
    this.camera.follow(this.world, display.width, display.height);

    if (!blocked) this._handleInput();
    this._handleWorldEvents();
    this.syncRemotes();
    this._pushPresence(moveDir);
  }

  syncRemotes() {
    if (!net.inRoom) { this.world.remotes.clear(); return; }
    this.world.syncRemotes(net.roomPeers());
  }

  _pushPresence(moveDir) {
    if (!net.inRoom) return;
    net.sendPlayerPosition({
      moving: this.world.player.moving,
      frame: this.world.player.frame,
      story: progress(this.game.state),
    });
    void moveDir;
  }

  _handleInput() {
    if (input.pressed('start')) { audio.sfx('select'); this.game.openMenu(); return; }
    if (input.pressed('a') && !this.world.player.moving) this._interact();
  }

  _interact() {
    const target = this.world.facingTarget();
    if (!target) return;
    audio.sfx('select');

    // Signs are templated too, so a noticeboard can carry a live standing.
    if (target.type === 'sign') {
      this.say(fillText(target.sign.text, this.game.state, net.snapshot()));
      return;
    }
    if (target.type === 'companion') { this._companionTalk(); return; }
    if (target.type === 'flavour') { this.say(target.text); return; }
    if (target.type === 'soil') { this.runScript('berryPatch', { data: { tile: target } }); return; }
    if (target.type === 'dig') { this.runScript('digWall', { data: { tile: target } }); return; }
    if (target.type === 'field') { this.runScript('fieldMove', { data: { tile: target } }); return; }
    if (target.type === 'board') { this.runScript('baseBoard'); return; }
    if (target.type === 'decor') { this.runScript('baseTidy', { data: { tile: target } }); return; }
    if (target.type === 'baseWall') { this.runScript('secretBase', { data: { tile: target } }); return; }
    if (target.type === 'water') {
      // A rod turns the water's edge into somewhere to stand for ten minutes.
      // Without one it stays what it was: a nice view.
      if ((this.game.state.inventory.items.oldrod || 0) > 0) { this.runScript('fish'); return; }
      this.say(refusalText(this.game.state, 'surf') || 'The water is clear and deep.');
      return;
    }
    if (target.type === 'partner') { this._talkToPartner(target.mon); return; }
    if (target.type === 'pc') { this.game.openPC(); return; }
    if (target.type === 'item') { this._pickUp(target.entity); return; }
    if (target.type === 'player') { this._interactPlayer(target.entity); return; }
    if (target.type === 'npc') { this._talkTo(target.entity); return; }
  }

  /**
   * What is standing on this square of a Secret Base — the board, or a piece
   * of furniture. Coordinates are the map's; the room's own grid starts at
   * BASE_ORIGIN, which is what the decorations are stored against.
   */
  _baseTarget(x, y) {
    const ug = this.game.state.underground;
    const room = ug.visiting ? ug.partnerBase : ug.base;
    if (!room) return null;
    if (x === BASE_BOARD.x && y === BASE_BOARD.y) return { type: 'board' };
    const rx = x - BASE_ORIGIN.x, ry = y - BASE_ORIGIN.y;
    for (const d of room.decor) {
      const g = GOODS[d.id];
      if (!g) continue;
      if (rx >= d.x && rx < d.x + g.w && ry >= d.y && ry < d.y + g.h) {
        return ug.visiting
          ? { type: 'flavour', text: `${g.name}. ${g.blurb}` }
          : { type: 'decor', x: rx, y: ry, id: d.id };
      }
    }
    return null;
  }

  /**
   * Turning round to talk to whoever is walking behind you. Bandit has his
   * own lines, because he is a specific dog and not a generic one.
   */
  _talkToPartner(mon) {
    const own = (mon.nickname === BANDIT.nickname && mon.species === BANDIT.species)
      ? BANDIT.talk : null;
    this.say(partnerLine(mon, this.game.state.stats.steps, own));
    audio.cry(mon.species, 1.1);
  }

  /** An Egg hatching, mid-walk. The scene itself lives with the other ones. */
  _hatch(egg) {
    if (this.script || egg.hatching) return;
    egg.hatching = true;
    this.runScript('eggHatch', { data: { egg } });
  }

  _pickUp(e) {
    const item = getItem(e.data.item);
    const qty = e.data.qty || 1;
    addItem(this.game.state.inventory, e.data.item, qty);
    setStoryFlag(this.game.state, `item_${e.data.id}`, true);
    this.world.removeEntity(e.id);
    audio.sfx('buy');
    this.say(`You found ${qty > 1 ? `${qty} ` : ''}${item.name}${qty > 1 ? 's' : ''}!`);
    if (this.game.save) this.game.save.markDirty();
  }

  _interactPlayer(e) {
    if (!net.hasPartner) { this.say('They seem to be somewhere else right now.'); return; }
    if (e.busy && e.busy !== 'free') {
      this.say(`${e.name} is busy right now.`);
      return;
    }
    dialogue.ask(`${e.name} is right here.\nWhat would you like to do?`,
      ['Battle', 'Trade', 'Nothing'], (pick) => {
        if (pick === 0) this.game.requestPvp();
        else if (pick === 1) this.game.requestTrade();
      }, { width: this.game.display.width });
  }

  _talkTo(e) {
    this.world.faceEntityToPlayer(e);
    const d = e.data;

    if (d.trainer) { this._trainerTalk(e); return; }
    if (d.script) { this.runScript(d.script, e); return; }

    // Everyone remembers how many times you have bothered them today, which is
    // what lets a pooled remark rotate instead of repeating.
    e.talkCount = (e.talkCount || 0) + 1;

    const link = net.snapshot();
    let lines = resolveDialogue(d.dialogue, this.game.state, e.talkCount - 1, link);
    // The older `dialogueAfter` shape still works; conditional dialogue is
    // simply the general case of it.
    if (d.dialogueAfter && this.game.state.flags[d.dialogueAfter.flag]) {
      lines = resolveDialogue(d.dialogueAfter.lines, this.game.state, e.talkCount - 1, link);
    }
    if (!lines || !lines.length) lines = ['...'];
    // Names are authored text too: the partner's plate is written as
    // "{buddy}" so it says Sammy to Matthew and Matthew to Sammy. Without
    // filling it, the nameplate read "{buddy}" out loud.
    const speaker = d.name ? fillText(d.name, this.game.state, link) : null;
    this.say(lines.join('\f'), { speaker });
  }

  /**
   * A word with whoever is walking with you.
   *
   * Reads from the same conditional-dialogue machinery as any other NPC, so
   * what they say tracks the story without a special case per beat.
   */
  _companionTalk() {
    const st = this.game.state;
    const slot = st.companion || {};
    const lines = resolveDialogue(companionLines(st), st, 0, net.snapshot());
    this.say((lines && lines.length ? lines : ['...']).join('\f'),
      { speaker: fillText(slot.name || '{buddy}', st, net.snapshot()) });
  }

  _trainerTalk(e) {
    const t = getTrainer(e.data.trainer);
    if (!t) return;
    if (t.leader) { this.runScript('gymLeader', e); return; }
    if (t.id === 'cave_commander') { this.runScript('commander', e); return; }

    if (this.game.state.flags[`beat_${t.id}`]) {
      const after = resolveDialogue(e.data.after || [t.defeat], this.game.state,
        e.talkCount || 0, net.snapshot()) || [t.defeat];
      e.talkCount = (e.talkCount || 0) + 1;
      this.say(after.join('\f'), { speaker: t.name });
      return;
    }
    this.runScript(null, e, async (ctx) => {
      await ctx.say(t.intro, { speaker: t.name });
      await ctx.battle({ trainer: t, kind: 'trainer' });
    });
  }

  /**
   * A gated door turning the player away. They bumped it rather than stepped
   * onto it, so there is nothing to undo — just the reason why.
   */
  _refuseWarp(warp) {
    this.say(warp.refuse || 'You should not go this way yet.');
  }

  /**
   * Says something when a Pokemon is ready to evolve.
   *
   * Evolution used to happen only at the end of a battle, so it announced
   * itself. One that comes back from the Day Care already past its level, or
   * one whose evolution was stopped with B, just sits in the party being the
   * wrong shape and nothing anywhere says so — the player has no reason ever
   * to open the menu and look. So the character notices out loud, once per
   * Pokemon, the way a person would.
   */
  _noticeEvolutions() {
    if (this.script || dialogue.visible) return;
    const st = this.game.state;
    if (!st.noticedEvolve) st.noticedEvolve = {};
    for (const mon of st.party) {
      if (!mon || mon.isEgg) continue;
      const e = evolutionFor(mon, 'level');
      const key = `${mon.id || mon.species}:${mon.species}`;
      if (!e) { delete st.noticedEvolve[key]; continue; }
      if (st.noticedEvolve[key]) continue;
      st.noticedEvolve[key] = true;
      audio.sfx('select');
      this.say(`${displayName(mon)} looks like it is about to change.`
        + `\fOpen the party menu and choose EVOLVE when you are ready.`);
      return;
    }
  }

  _handleWorldEvents() {
    const w = this.world;
    if (this.script) return;
    this._noticeEvolutions();

    if (w.pendingWarp) { const warp = w.pendingWarp; w.pendingWarp = null; this._doWarp(warp); return; }
    // A door the story has not opened yet. Say why, and step the player back
    // off it so they are not standing on a warp that will refuse them again
    // on the next frame.
    if (w.pendingBlocked) {
      const warp = w.pendingBlocked;
      w.pendingBlocked = null;
      this._refuseWarp(warp);
      return;
    }
    if (w.pendingEncounter) {
      const enc = w.pendingEncounter;
      w.pendingEncounter = null;
      this._startWildBattle(enc);
      return;
    }
    if (w.pendingLadder) {
      const out = w.pendingLadder;
      w.pendingLadder = null;
      this.runScript(out.script || 'surface');
      return;
    }
    if (w.pendingTrainer) {
      const npc = w.pendingTrainer;
      w.pendingTrainer = null;
      this._trainerSpotted(npc);
      return;
    }
    if (w.pendingEvent) {
      const ev = w.pendingEvent;
      w.pendingEvent = null;
      if (ev.requires && !this.game.state.flags[ev.requires]) return;
      this.runScript(ev.script);
    }
  }

  _doWarp(warp) {
    const kind = warp.edge ? FADE.BLACK : FADE.DOOR;
    if (!warp.edge) audio.sfx('door');
    this.game.screens.fade(kind, () => {
      this.world.load(warp.to, warp.tx, warp.ty, warp.dir || 'down');
      this.camera.follow(this.world, this.game.display.width, this.game.display.height);
      this.showBanner(this.world.map);
      this.playMusic();
      const st = this.game.state;
      // Arriving somewhere new is a natural autosave point.
      if (this.game.save) this.game.save.touch(st);
      const map = getMap(warp.to);
      if (map.kind === 'cave') setStoryFlag(st, 'enteredCave', true);
      if (warp.to === 'route202') setStoryFlag(st, 'enteredForest', true);
      this._arriveEvent(map);
    }, { outMs: warp.edge ? 240 : 300, inMs: warp.edge ? 260 : 320 });
  }

  /**
   * A scene that fires because you ARRIVED somewhere, not because you walked
   * onto a tile.
   *
   * Step events only run on a completed step, so a scene meant to happen the
   * moment you come out of your own front door could never fire: you land on
   * the doorstep, and landing is not stepping. That is exactly how the whole
   * opening broke — Mum said the other one was waiting outside, and then
   * nobody was, because the scene that puts them there was sitting on a tile
   * the player had no reason to walk onto.
   *
   * An `arrive: true` event fires on the tile you land on, or anywhere on the
   * map if it gives no coordinates.
   */
  _arriveEvent(map) {
    const st = this.game.state;
    const p = this.world.player;
    const ev = (map.events || []).find((e) => e.arrive
      && (e.x === undefined || (e.x === p.x && e.y === p.y))
      && (e.repeat || !st.flags[e.flag])
      && (!e.requires || st.flags[e.requires]));
    if (ev) this.world.pendingEvent = ev;
  }

  // ---- battles -------------------------------------------------------------

  _startWildBattle(enc) {
    const st = this.game.state;
    if (!st.party.some((m) => m.hp > 0)) return;
    recordSeen(st.dex, enc.species);
    audio.sfx('encounter');
    this.encounterFlash = 0.45;
    this.game.screens.fade(FADE.BATTLE, () => {
      this.game.startWildBattle(enc.species, enc.level);
    }, { outMs: 620, inMs: 120 });
  }

  _trainerSpotted(npc) {
    const t = getTrainer(npc.data.trainer);
    if (!t) return;
    // A trainer with a script of its own is a story fight, and the script owns
    // the whole encounter — the speech before it, the flags after it, the
    // thing it leaves behind. Running the generic "walk up and battle" instead
    // is how Mars became a Galactic commander you could beat in a cave with
    // nothing whatsoever happening as a result, which left the Aurora Charm
    // unobtainable and the back half of the story unreachable.
    if (npc.data.script) { this.runScript(npc.data.script, npc); return; }
    this.runScript(null, npc, async (ctx) => {
      ctx.exclaim(npc);
      audio.sfx('encounter');
      await ctx.wait(0.7);
      // Walk the trainer up to the player.
      await ctx.approach(npc);
      await ctx.say(t.intro, { speaker: t.name });
      await ctx.battle({ trainer: t, kind: 'trainer' });
    });
  }

  // ---- cutscene runtime ------------------------------------------------------

  say(text, opts = {}) {
    dialogue.show(fillText(text, this.game.state, net.snapshot()),
      { ...opts, width: this.game.display.width });
  }

  /** Runs a named script (or an inline one) as a cutscene. */
  runScript(name, npc = null, inline = null) {
    if (this.script) return;
    const fn = inline || scriptFor(name);
    if (!fn) return;
    const ctx = this._makeCutsceneContext();
    this.script = fn(ctx, npc)
      .catch((err) => console.error('[script]', err))
      .finally(() => {
        this.script = null;
        this.showcase = null;
        input.releaseAll();
        // A cutscene can change the party — a starter, an Egg, a trade — so
        // whoever is walking beside you is re-read once it ends.
        this.world.refreshFollower();
        if (this.game.save) this.game.save.markDirty();
      });
  }

  _makeCutsceneContext() {
    const screen = this;
    const st = this.game.state;
    return {
      state: st,
      get player() { return screen.world.player; },

      // Every line a cutscene says goes through the same slot filler that NPC
      // dialogue does. It did not, and the moment a script used a slot the
      // player was shown the raw "{leagueBadges}" in Rowan's mouth. One place
      // to be right, rather than a rule every script has to remember.
      say: (text, opts = {}) => new Promise((resolve) => {
        dialogue.show(fillText(text, screen.game.state, net.snapshot()),
          { ...opts, width: screen.game.display.width, onDone: resolve });
      }),

      ask: (text, options, opts = {}) => new Promise((resolve) => {
        dialogue.ask(text, options, resolve, { ...opts, width: screen.game.display.width });
      }),

      wait: (sec) => new Promise((resolve) => screen.timers.push({ t: sec, resolve })),

      /** Opens the party as a picker and resolves with the index, or -1. */
      pickFromParty: (prompt) => new Promise((resolve) => {
        // The picker pops itself, and hands back null when the player backs
        // out, which every caller here wants as -1.
        screen.game.openParty({
          mode: 'pick',
          prompt,
          onPick: (index) => resolve(index === null || index === undefined ? -1 : index),
        });
      }),

      sfx: (n) => audio.sfx(n),

      // Walks an entity `n` tiles and resolves when it stops.
      //
      // The wait is on wall-clock time but `moving` only changes when the
      // world ticks, so anything that stops the world mid-step would leave
      // this spinning and the script waiting on it forever. Every step is
      // given a deadline for that reason: a walk that does not finish gives
      // up and lets the scene carry on, because a scene that ends in the
      // wrong place is recoverable and one that never ends is not.
      walk: (entity, dir, n) => new Promise((resolve) => {
        let left = n;
        const step = () => {
          if (left <= 0 || !screen.world.startMove(entity, dir)) { resolve(); return; }
          left--;
          const started = performance.now();
          const check = setInterval(() => {
            if (!entity.moving) { clearInterval(check); step(); return; }
            if (performance.now() - started > 4000) {
              clearInterval(check);
              entity.moving = false;
              resolve();
            }
          }, 16);
        };
        step();
      }),

      // Trainer walks until adjacent to the player.
      approach: (npc) => new Promise((resolve) => {
        const p = screen.world.player;
        const [dx, dy] = DIRS[npc.dir];
        const dist = Math.abs(p.x - npc.x) + Math.abs(p.y - npc.y);
        let steps = Math.max(0, dist - 1);
        const step = () => {
          if (steps <= 0) {
            p.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[npc.dir];
            resolve();
            return;
          }
          if (!screen.world.startMove(npc, npc.dir)) { resolve(); return; }
          steps--;
          const started = performance.now();
          const check = setInterval(() => {
            if (!npc.moving) { clearInterval(check); step(); return; }
            if (performance.now() - started > 4000) {
              clearInterval(check);
              npc.moving = false;
              resolve();
            }
          }, 16);
        };
        void dx; void dy;
        step();
      }),

      exclaim: (npc) => { npc.exclaimT = performance.now(); },

      spawnNpc: (cfg) => {
        const e = screen.world.entities.find((x) => x.id === cfg.id);
        if (e) return e;
        const w = screen.world;
        const made = { ...cfg, kind: 'npc', movement: 'still' };
        // Nobody arrives standing inside the player. A scene that spawns
        // somebody on the player's own tile reads as a voice from nowhere:
        // they are drawn underneath and do not become visible until the scene
        // ends and the player takes a step. Step them off to the nearest free
        // tile instead, so whoever is talking is somebody you can see.
        if (made.x === w.player.x && made.y === w.player.y) {
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = made.x + dx, ny = made.y + dy;
            if (nx < 0 || ny < 0 || nx >= w.map.width || ny >= w.map.height) continue;
            if (w.defAt(nx, ny).solid || w.entityAt(nx, ny)) continue;
            made.x = nx; made.y = ny;
            break;
          }
        }
        w.entities.push(makeNpc(made));
        return w.entities[w.entities.length - 1];
      },

      despawn: (entity) => screen.world.removeEntity(entity.id),

      battle: (cfg) => new Promise((resolve) => {
        screen.game.startTrainerBattle(cfg.trainer, resolve);
      }),

      // A one-off wild encounter a script can await — a legendary standing in
      // a room rather than something that walked out of the grass. Resolves
      // with the battle's own result, so the script can tell "caught" from
      // "it got away" and behave differently next time.
      wild: (speciesId, level, opts = {}) => new Promise((resolve) => {
        const scr = screen.game.startWildBattle(speciesId, level, {
          ...opts,
          onFinish: () => resolve(scr ? scr.result : null),
        });
      }),

      warpTo: (mapId, x, y) => new Promise((resolve) => {
        // Resolved by the fade itself: this screen stops updating while a
        // transition runs, so its own timers would never come back.
        screen.game.teleport(mapId, x, y, resolve);
      }),

      give: (itemId, qty) => addItem(st.inventory, itemId, qty),

      take: (itemId, qty = 1) => removeItem(st.inventory, itemId, qty),

      countItem: (itemId) => st.inventory.items[itemId] || 0,

      // Where the player is standing, and what the water here holds. Berries
      // and fishing both need to know which square of the world they are on;
      // nothing else in a cutscene does.
      here: () => ({ map: screen.world.mapId, x: screen.world.player.x, y: screen.world.player.y }),

      fishTable: () => (screen.world.map.encounters && screen.world.map.encounters.fish) || null,

      // Whether anybody in the bag could actually take a bite. Grass and
      // trainers already ask this before they start anything; fishing did
      // not, which meant a rod and a fainted team could open a battle
      // nobody could fight.
      canBattle: () => screen.world.canBattle(),

      // Hands the player a wall of rock and resolves with what came out of
      // it. The screen above owns the minigame; this just awaits its answer.
      dig: (cfg) => new Promise((resolve) => { screen.game.openDig(cfg, resolve); }),

      // A line of text, typed on the same keyboard that named the player.
      askText: (prompt, maxLen) => new Promise((resolve) => {
        screen.game.openTextEntry(prompt, maxLen, resolve);
      }),

      // Publishing a Secret Base, and owning up to taking somebody's flag.
      shareBase: () => net.sendBase(shareable(st.underground.base, st.player.name)),
      shareFlag: () => net.sendFlagTaken(),

      hasItem: (itemId) => (st.inventory.items[itemId] || 0) > 0,

      cry: (speciesId) => audio.cry(speciesId),

      // Records a journal entry, and flashes it so the player knows the book
      // has something new in it without being dragged into a menu.
      journal: (id) => {
        if (recordJournal(st, id)) {
          const entry = getEntry(id);
          if (entry) screen.toast(`Journal: ${entry.title}`);
        }
      },

      // Fills {starter}, {player} and friends in a block of story lines, so
      // the bible can name the Pokémon the player actually chose.
      fill: (lines) => lines.map((l) => fillText(l, st, net.snapshot())),
      linked: () => {
        const snap = net.snapshot();
        return !!(snap.connected && snap.partner);
      },
      partnerName: () => {
        const snap = net.snapshot();
        return (snap.partner && snap.partner.name) || null;
      },

      askNickname: (mon) => new Promise((resolve) => {
        screen.game.openNickname(mon, () => resolve());
      }),

      // A one-shot screen kick, for a mountain opening.
      shake: (strength = 1) => { screen.shakeT = Math.max(screen.shakeT || 0, strength); },

      setFlag: (k, v = true) => setStoryFlag(st, k, v),

      shareMilestone: (k) => net.sendStoryEvent(k),

      // Somebody starts, or stops, walking with you. `who` is a plain
      // {look, name, key} so any character can take the slot.
      companionJoin: (who) => screen.world.companionJoin(who),
      companionLeave: () => screen.world.companionLeave(),
      companionHere: () => !!(screen.world.companion && screen.world.companion.visible),
      petJoin: (who) => screen.world.petJoin(who),
      petLeave: () => screen.world.petLeave(),

      awardBadge: (n, name) => awardBadge(st, n, name),

      dex: { seen: (id) => recordSeen(st.dex, id), caught: (id) => recordCaught(st.dex, id) },

      showMonster: (speciesId) => new Promise((resolve) => {
        screen.showcase = { species: speciesId, t: 0 };
        audio.cry(speciesId);
        screen.timers.push({ t: 0.35, resolve });
      }),
      hideMonster: () => { screen.showcase = null; },

      healAnimation: () => new Promise((resolve) => {
        audio.sfx('heal');
        healParty(st);
        if (screen.game.save) screen.game.save.touch(st);
        screen.healFlash = 1.1;
        screen.timers.push({ t: 1.2, resolve });
      }),

      setHealPoint: () => {
        const hp = screen.world.map.healPoint;
        if (hp) st.lastHealPoint = { ...hp };
      },

      openShop: (kind) => new Promise((resolve) => screen.game.openShop(resolve, kind)),

      // World Circuit hooks. The screens they open sit above the overworld,
      // so the script resolves immediately and the player is handed over.
      joinCircuit: () => screen.game.career.join(),
      openCircuit: () => { screen.game.openCircuit({ tab: 1 }); },
      resumeTournament: () => { screen.game.resumeTournament(); },

      autosave: () => { if (screen.game.save) screen.game.save.save(st); },
    };
  }

  // ---- render -----------------------------------------------------------------

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    // A script-driven camera kick. Applied to the camera rather than the
    // canvas transform so the HUD and the dialogue box stay put.
    let shakeX = 0, shakeY = 0;
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - 1 / 60);
      const mag = this.shakeT * 4;
      shakeX = Math.round(Math.sin(this.shakeT * 47) * mag);
      shakeY = Math.round(Math.cos(this.shakeT * 61) * mag);
      this.camera.x += shakeX;
      this.camera.y += shakeY;
    }
    const ug = this.game.state.underground;
    drawWorld(ctx, this.world, this.camera, W, H, {
      patches: this.game.state.patches,
      room: ug.visiting ? ug.partnerBase : ug.base,
      origin: BASE_ORIGIN,
    });
    this.camera.x -= shakeX;
    this.camera.y -= shakeY;

    // Trainer "!" bubble.
    for (const e of this.world.entities) {
      if (!e.exclaimT) continue;
      const age = (performance.now() - e.exclaimT) / 1000;
      if (age > 0.9) { e.exclaimT = 0; continue; }
      const p = this.world.renderPos(e);
      const x = p.x - this.camera.x + 4;
      const y = p.y - this.camera.y - 16 - Math.min(4, age * 30);
      rect(ctx, x, y, 9, 12, PAL.uiBg);
      rect(ctx, x + 1, y - 1, 7, 14, PAL.uiBg);
      drawText(ctx, '!', x + 2, y + 2, { color: PAL.uiDanger });
    }

    if (this.healFlash > 0) {
      this.healFlash -= 1 / 60;
      ctx.globalAlpha = Math.max(0, Math.min(0.5, this.healFlash * 0.5));
      rect(ctx, 0, 0, W, H, '#ffffff');
      ctx.globalAlpha = 1;
    }
    if (this.encounterFlash > 0) {
      ctx.globalAlpha = Math.min(0.7, this.encounterFlash);
      rect(ctx, 0, 0, W, H, '#ffffff');
      ctx.globalAlpha = 1;
    }

    drawLocationBanner(ctx, this.bannerName, this.bannerT, W);
    // While the banner is sliding in it owns the top-left corner, so the
    // guide bar steps underneath it rather than fighting it.
    if (this.game.state.settings.guide !== false && !dialogue.visible && !this.script) {
      drawGuideBar(ctx, objective(this.game.state), W, H, { belowBanner: this.bannerT < 2.4 });
    }
    this._drawNetBadge(ctx, W);

    if (this.showcase) {
      const img = renderMonster(getSpecies(this.showcase.species).art, { size: 80 });
      const bx = W / 2 - 40, by = H / 2 - 78;
      window9(ctx, bx - 6, by - 6, 92, 92);
      ctx.drawImage(img, Math.round(bx), Math.round(by));
    }

    if (dialogue.visible) dialogue.render(ctx, W, H);

    if (this.netToast) {
      const a = this.netToastT < 0.2 ? this.netToastT / 0.2 : this.netToastT > 2.8 ? (3.2 - this.netToastT) / 0.4 : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      const w = this.netToast.length * 6 + 16;
      window9(ctx, W / 2 - w / 2, 22, w, 15);
      drawTextCentered(ctx, this.netToast, W / 2, 27);
      ctx.globalAlpha = 1;
    }

    // While text is on screen the gamepad would sit on top of the box, so it
    // steps aside and a tap anywhere advances instead.
    const textUp = dialogue.visible;
    if (!textUp) {
      drawControls(ctx, {
        alpha: this.script ? 0.5 : 0.82,
        aLabel: 'A', bLabel: 'B',
        startLabel: 'MENU',
      });
    } else if (dialogue.choice) {
      drawControls(ctx, { alpha: 0.7, dirs: true, start: false });
    }
    void hintBar; void labelLight; void label; void money; void computeLayout; void TILE;
  }

  _drawNetBadge(ctx, W) {
    const snap = net.snapshot();
    if (!snap.code && snap.transport === 'offline') return;
    const online = snap.connected && snap.code;
    const text = snap.code ? snap.code : (snap.connected ? 'LINK' : 'OFF');
    const w = text.length * 6 + 16;
    const x = W - w - 4, y = 19;
    ctx.globalAlpha = 0.85;
    rect(ctx, x, y, w, 11, PAL.uiFrame);
    ctx.globalAlpha = 1;
    drawText(ctx, '●', x + 3, y + 2, { color: online ? '#48c04a' : '#d8493f' });
    drawText(ctx, text, x + 11, y + 2, { color: PAL.uiTextLight });
    if (snap.partner) {
      const pw = snap.partner.name.length * 6 + 10;
      ctx.globalAlpha = 0.85;
      rect(ctx, W - pw - 4, y + 12, pw, 11, PAL.uiFrame);
      ctx.globalAlpha = 1;
      drawText(ctx, snap.partner.name, W - pw, y + 14, { color: '#9ee0a0' });
    }
  }
}

// Small local helper so scripts can add a walk-on character.
function makeNpc(cfg) {
  return {
    id: cfg.id, kind: 'npc', x: cfg.x, y: cfg.y, dir: cfg.dir || 'down',
    look: cfg.look, name: cfg.name || null, moving: false, moveT: 0, moveDur: 14,
    fromX: cfg.x, fromY: cfg.y, frame: 0, stepPhase: 0, solid: true, data: cfg,
    movement: 'still', homeX: cfg.x, homeY: cfg.y, think: 999999, visible: true,
    hopping: 0, alpha: 1,
  };
}
