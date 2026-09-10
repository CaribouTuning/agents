// Caribou Monster — entry point.
//
// `Game` is the only object that knows about every layer. Everything else
// talks to it, or to the bus, and never to each other. That is what keeps the
// engine, the network and the UI independently testable.
import { display, TILE } from './render/canvas.js';
import { GameLoop } from './core/loop.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { bus } from './core/events.js';
import { buildTileAtlas } from './render/tiles.js';
import { tickCursor } from './ui/kit.js';
import { computeLayout, beginControlsFrame, getLayout } from './ui/controls.js';
import { ScreenManager, FADE } from './ui/screen.js';
import { TitleScreen } from './ui/title.js';
import { dialogue } from './ui/dialogue.js';
import { OverworldScreen } from './ui/overworld.js';
import { BattleScreen } from './ui/battle.js';
import { MainMenuScreen, PartyScreen, BagScreen, DexScreen, TrainerCardScreen, OptionsScreen, SaveScreen } from './ui/menus.js';
import { PCScreen } from './ui/pc.js';
import { ShopScreen } from './ui/shop.js';
import { MultiplayerScreen } from './ui/multiplayer.js';
import { TradeScreen } from './ui/trade.js';
import { DebugScreen } from './ui/debug.js';
import { DigScreen } from './ui/dig.js';
import { TownMapScreen } from './ui/townmap.js';
import { CircuitScreen, TournamentScreen, PressScreen } from './ui/circuit.js';
import { resolveDialogue, worldSnapshot } from './game/overworld/gossip.js';
import { NicknameScreen, TextEntryScreen } from './ui/naming.js';
import { JournalScreen } from './ui/journal.js';
import * as journalApi from './game/journal.js';
import { createGameState, healParty, setStoryFlag } from './game/state.js';
import { createMonster, healFully, isFainted, learnMove, knowsMove, canLearnTm } from './game/monster.js';
import { createBattle } from './game/battle/engine.js';
import { getSpecies } from './data/species.js';
import { getMap, MAPS } from './data/maps/index.js';
import { SCRIPTS } from './game/overworld/scripts.js';
import { forceHour, currentPhase, shiftHours } from './game/clock.js';
import { addItem } from './game/inventory.js';
import { randomSeed } from './core/rng.js';
import { saveManager } from './save/SaveManager.js';
import { net } from './net/NetworkManager.js';
import { RoomManager, TRADE_STATE, PVP_STATE } from './net/RoomManager.js';
import { MUSIC } from './data/music.js';
import { Career } from './game/circuit/career.js';

class Game {
  constructor() {
    this.state = createGameState();
    this.display = display;
    this.screens = new ScreenManager(display);
    this.save = saveManager;
    this.rooms = null;
    this.loop = null;
    this.debugEnabled = false;
    this.overworld = null;
    this.lastTick = performance.now();
    // Handed to menus so they do not each import the monster module.
    this.monsterApi = { learnMove, knowsMove, canLearnTm };
    // Exposed for the debug menu and the integration tests; the game itself
    // always goes through `net` directly.
    this.netForTest = net;
    // Lets the touch test aim at the real on-screen control positions.
    this.controlsLayout = getLayout;
    this.mapsForTest = { MAPS };
    this.dialogueForTest = dialogue;
    this.gossipForTest = { resolveDialogue, worldSnapshot };
    this.clockForTest = { forceHour, currentPhase, shiftHours };
    this.scriptsForTest = SCRIPTS;
    this.journalForTest = journalApi;
    // The World Circuit career. It reads and writes state.circuit, so it is
    // rebuilt cheaply rather than serialized.
    this.career = new Career(this);
  }

  async boot(canvas) {
    display.attach(canvas);
    input.attach(canvas, display);
    buildTileAtlas();
    display.onResize = (w, h) => computeLayout(w, h, display.portrait);
    computeLayout(display.width, display.height, display.portrait);

    // Audio can only start from a real gesture on mobile.
    const unlock = () => { audio.unlock(); audio.resume(); };
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
      window.addEventListener(ev, unlock, { once: false, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) audio.stopMusic();
      else if (this.screens.top && this.screens.top.playMusic) this.screens.top.playMusic();
    });

    // The network comes up in the background; the game never waits for it.
    net.init(this.state).then((kind) => {
      console.info(`[caribou] network transport: ${kind}`);
    });
    this.rooms = new RoomManager(this.state);
    this._wireSessions();

    const meta = await this.save.peek();
    this.screens.push(new TitleScreen(this, meta));

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      render: () => this.render(),
    });
    this.loop.start();

    window.addEventListener('beforeunload', () => {
      if (this.overworld && this.state.flags.gotStarter) this.save.save(this.state);
    });
  }

  // ---- frame ---------------------------------------------------------------

  update(dt) {
    tickCursor(dt);
    this.screens.update(dt);
    if (this.rooms) this.rooms.tick();

    if (this.overworld && this.screens.contains('OverworldScreen')) {
      this.state.playTimeMs += dt * 1000;
      const quiet = this.screens.top === this.overworld && !this.screens.busy;
      this.save.maybeAutosave(this.state, quiet && !!this.state.flags.gotStarter);
    }
    input.endFrame();
  }

  render() {
    const ctx = display.begin();
    // Touch targets are re-registered by whichever screen draws them, so
    // neither the BACK chip nor the gamepad can linger as an invisible tap
    // target on a screen that shows neither.
    beginControlsFrame();
    this.screens.render(ctx);
  }

  applySettings() {
    const s = this.state.settings;
    audio.setEnabled(s.music || s.sfx);
    audio.setMusicVolume(s.music ? 0.35 : 0);
    audio.sfxVolume = s.sfx ? 0.5 : 0;
    if (audio.unlocked) audio.sfxGain.gain.value = s.sfx ? 0.5 : 0;
  }

  // ---- lifecycle -------------------------------------------------------------

  startNewGame({ name, look, difficulty }) {
    this.state = createGameState({ name, look, difficulty });
    net.state = this.state;
    if (this.rooms) this.rooms.dispose();
    this.rooms = new RoomManager(this.state);
    this._wireSessions();
    this.overworld = new OverworldScreen(this);
    this.screens.clearTo(this.overworld);
    this.save.markDirty();
  }

  async continueGame() {
    const loaded = await this.save.load();
    if (loaded) this.state = loaded;
    net.state = this.state;
    if (this.rooms) this.rooms.dispose();
    this.rooms = new RoomManager(this.state);
    this._wireSessions();
    this.applySettings();
    this.overworld = new OverworldScreen(this);
    this.screens.clearTo(this.overworld);
  }

  currentMapName() {
    try { return getMap(this.state.player.map).name; } catch { return '???'; }
  }

  teleport(mapId, atX = null, atY = null, onDone = null) {
    const map = getMap(mapId);
    // Land on the first walkable tile near the middle of the map.
    let tx = Math.floor(map.width / 2), ty = Math.floor(map.height / 2);
    outer:
    for (let r = 0; r < Math.max(map.width, map.height); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = Math.floor(map.width / 2) + dx, y = Math.floor(map.height / 2) + dy;
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          const ch = map.tiles[y][x];
          if (ch === '.' || ch === ':' || ch === '_' || ch === '+' || ch === 'c' || ch === 'g' || ch === ',') {
            tx = x; ty = y; break outer;
          }
        }
      }
    }
    if (atX != null && atY != null) { tx = atX; ty = atY; }
    this.screens.popTo('OverworldScreen');
    dialogue.hide();
    this.screens.fade(FADE.BLACK, () => {
      this.overworld.world.load(mapId, tx, ty, 'down');
      this.overworld.showBanner(getMap(mapId));
      this.overworld.playMusic();
    }, { onDone });
  }

  escapeToHealPoint() {
    const hp = this.state.lastHealPoint;
    this.screens.popTo('OverworldScreen');
    this.screens.fade(FADE.BLACK, () => {
      this.overworld.world.load(hp.map, hp.x, hp.y, 'down');
      this.overworld.showBanner(getMap(hp.map));
      this.overworld.playMusic();
    });
  }

  // ---- menus ----------------------------------------------------------------

  openMenu() { this.screens.push(new MainMenuScreen(this)); }
  openParty(opts) { return this.screens.push(new PartyScreen(this, opts)); }
  openBag(opts) { return this.screens.push(new BagScreen(this, opts)); }
  openDex() { this.screens.push(new DexScreen(this)); }
  openCard() { this.screens.push(new TrainerCardScreen(this)); }
  openOptions() { this.screens.push(new OptionsScreen(this)); }
  openSave() { this.screens.push(new SaveScreen(this)); }
  openPC() { this.screens.push(new PCScreen(this)); }
  openMultiplayer() { this.screens.push(new MultiplayerScreen(this)); }
  openCircuit(opts) { return this.screens.push(new CircuitScreen(this, opts)); }
  openJournal() { return this.screens.push(new JournalScreen(this)); }
  /** Opens the nickname keyboard for a Pokémon. Used after a catch. */
  openNickname(mon, onDone) { return this.screens.push(new NicknameScreen(this, mon, onDone)); }
  openPress() {
    const p = this.career.pendingPress;
    if (!p || this.screens.contains('PressScreen')) return null;
    return this.screens.push(new PressScreen(this, p));
  }

  /** Signs up for an event and opens the run. */
  enterTournament(id) {
    if (!this.career.enter(id)) return null;
    this.career.healBetweenRounds();
    this.save.markDirty();
    return this.screens.push(new TournamentScreen(this));
  }

  /** Re-opens a run that a save was taken in the middle of. */
  resumeTournament() {
    if (!this.state.circuit.active) return null;
    return this.screens.push(new TournamentScreen(this));
  }
  openShop(onClose) { this.screens.push(new ShopScreen(this, onClose)); }
  openDebug() { this.screens.push(new DebugScreen(this)); }

  // A wall of rock, and whatever is in it. `cfg` is already a dig from
  // game/underground/dig.js — this only owns the screen.
  openDig(dig, onFinish) { this.screens.push(new DigScreen(this, dig, onFinish)); }

  openTownMap() { this.screens.push(new TownMapScreen(this)); }

  openTextEntry(prompt, maxLen, onDone) {
    this.screens.push(new TextEntryScreen(this, prompt, maxLen, onDone));
  }

  // Puts an item in the bag. Same purpose as debugGive: the debug menu and
  // the integration tests both need a way to hand the player something.
  debugGiveItem(id, qty = 1) { return addItem(this.state.inventory, id, qty); }

  // Adds a monster to the party — used by the debug menu and by tools/coop.mjs.
  debugGive(speciesId, level = 5) {
    const mon = createMonster(speciesId, level);
    mon.ot = this.state.player.name;
    mon.otId = this.state.player.id;
    if (this.state.party.length < 6) this.state.party.push(mon);
    return mon;
  }

  // ---- battles ----------------------------------------------------------------

  _terrainFor(mapId) {
    try {
      const k = getMap(mapId).kind;
      return k === 'cave' ? 'cave' : k === 'indoor' ? 'indoor' : 'grass';
    } catch { return 'grass'; }
  }

  startWildBattle(speciesId, level, opts = {}) {
    const st = this.state;
    const wild = createMonster(speciesId, level, opts.monster || {});
    const battle = createBattle({
      seed: randomSeed(),
      kind: 'wild',
      difficulty: st.difficulty,
      location: st.player.map,
      canRun: opts.canRun !== false,
      a: { id: 'player', name: st.player.name, isPlayer: true, party: st.party, bag: st.inventory },
      b: { id: 'wild', name: opts.name || `Wild ${getSpecies(speciesId).name}`, party: [wild] },
    });
    return this.screens.push(new BattleScreen(this, battle, {
      terrain: this._terrainFor(st.player.map),
      location: st.player.map,
      // A static encounter wants to know how it ended, not just that it did.
      onFinish: opts.onFinish || null,
      music: opts.music || null,
    }));
  }

  startTrainerBattle(trainer, onFinish, opts = {}) {
    const st = this.state;
    const team = trainer.team.map((m) => {
      const mon = createMonster(m.species, m.level, { moves: m.moves || null });
      if (st.difficulty === 'easy') {
        // EASY trims a level off each opponent rather than gutting them.
        mon.level = Math.max(2, mon.level - 1);
        healFully(mon);
      }
      return mon;
    });
    const battle = createBattle({
      seed: randomSeed(),
      kind: 'trainer',
      difficulty: st.difficulty,
      canRun: false,
      a: { id: 'player', name: st.player.name, isPlayer: true, party: st.party, bag: st.inventory },
      b: { id: trainer.id, name: trainer.name, party: team, trainer },
    });
    return this.screens.push(new BattleScreen(this, battle, {
      terrain: this._terrainFor(st.player.map),
      onFinish: onFinish || opts.onFinish || null,
      // Circuit rounds handle their own consequences: losing a tournament
      // match ends the run, it does not send you home with a lighter wallet.
      noBlackout: !!opts.noBlackout,
      circuit: !!opts.circuit,
    }));
  }

  startPvpBattle(session) {
    this.screens.push(new BattleScreen(this, session.battle, {
      terrain: 'grass',
      pvp: session,
    }));
  }

  // Called after every battle resolves.
  afterBattle(result, opts) {
    const st = this.state;
    if (result === 'lose' && opts && opts.noBlackout) {
      // A sanctioned loss: patched up on site, no black-out, no penalty.
      healParty(st);
      if (this.overworld) this.overworld.playMusic();
      this.save.markDirty();
      return;
    }
    if (result === 'lose') {
      const hp = st.lastHealPoint;
      healParty(st);
      st.inventory.money = Math.max(0, Math.floor(st.inventory.money * 0.9));
      this.screens.popTo('OverworldScreen');
      this.screens.fade(FADE.BLACK, () => {
        this.overworld.world.load(hp.map, hp.x, hp.y, 'down');
        this.overworld.showBanner(getMap(hp.map));
        this.overworld.playMusic();
      });
    } else if (this.overworld) {
      this.overworld.playMusic();
    }
    this.save.markDirty();
    void opts;
  }

  // ---- co-op sessions ----------------------------------------------------------

  _wireSessions() {
    bus.on('pvp:started', (session) => {
      if (this.screens.contains('BattleScreen')) return;
      this.screens.fade(FADE.BATTLE, () => this.startPvpBattle(session), { outMs: 500, inMs: 140 });
    });
    // Link battles are sanctioned play: they move the world ranking, but only
    // once the player has actually joined the circuit.
    bus.on('pvp:finished', ({ result, desynced, ranked }) => {
      if (!ranked || desynced || (result !== 'win' && result !== 'lose')) return;
      const snap = net.snapshot();
      this.career.recordLink(result === 'win', snap.partner ? snap.partner.name : 'a linked trainer');
    });
  }

  requestTrade() {
    if (!net.hasPartner) { this._flash('No partner connected.'); return; }
    if (this.rooms.trade.request()) this.screens.push(new TradeScreen(this, this.rooms.trade));
  }

  requestPvp() {
    if (!net.hasPartner) { this._flash('No partner connected.'); return; }
    if (!this.state.party.some((m) => !isFainted(m))) { this._flash('Your Pokémon need healing first.'); return; }
    this.rooms.pvp.request();
  }

  // Opens the trade screen when the partner is the one who started it.
  openTradeIfNeeded() {
    const t = this.rooms.trade;
    if (t.phase === TRADE_STATE.INVITED && !this.screens.contains('TradeScreen')) {
      this.screens.push(new TradeScreen(this, t));
    }
  }

  openPvpIfNeeded() {
    const p = this.rooms.pvp;
    if (p.phase === PVP_STATE.INVITED && !this.screens.contains('PvpInviteScreen')
      && !this.screens.contains('BattleScreen')) {
      this.screens.push(new PvpInviteScreen(this, p));
    }
  }

  _flash(text) {
    if (this.overworld) this.overworld.toast(text);
  }
}

// A tiny screen for "your partner challenged you".
import { Screen } from './ui/screen.js';
import { window9, rect, drawTextCentered, shadeScreen } from './ui/kit.js';
import { PAL } from './render/palette.js';

class PvpInviteScreen extends Screen {
  constructor(game, session) { super(game); this.seeThrough = true; this.s = session; this.index = 0; this.t = 0; }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (this.s.phase !== PVP_STATE.INVITED) { this.game.screens.pop(); return; }
    if (input.repeated('left') || input.repeated('right')) { this.index = 1 - this.index; audio.sfx('cursor'); }
    const tap = input.consumeTap();
    const { width: W, height: H } = this.game.display;
    if (tap) {
      if (tap.x < W / 2 && tap.y > H / 2) { this._go(0); return; }
      if (tap.x >= W / 2 && tap.y > H / 2) { this._go(1); return; }
    }
    if (input.pressed('a')) this._go(this.index);
    if (input.pressed('b')) this._go(1);
  }

  _go(i) {
    audio.sfx(i === 0 ? 'select' : 'back');
    this.game.screens.pop();
    if (i === 0) this.s.accept(); else this.s.decline();
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    shadeScreen(ctx, W, H, 0.6);
    window9(ctx, W / 2 - 92, H / 2 - 34, 184, 64);
    drawTextCentered(ctx, `${this.s.partnerName} wants to battle!`, W / 2, H / 2 - 28);
    drawTextCentered(ctx, 'Link battles never hurt your team.', W / 2, H / 2 - 14, { color: PAL.uiTextDim });
    ['ACCEPT', 'DECLINE'].forEach((s, i) => {
      const x = i === 0 ? W / 2 - 62 : W / 2 + 6;
      const sel = i === this.index;
      rect(ctx, x, H / 2 + 8, 56, 16, sel ? (i === 0 ? PAL.hpGreen : PAL.uiDanger) : PAL.uiBgAlt);
      drawTextCentered(ctx, s, x + 28, H / 2 + 12, { color: sel ? '#ffffff' : PAL.uiText });
    });
  }
}

// ---- start ---------------------------------------------------------------

export const game = new Game();

function start() {
  let canvas = document.getElementById('game');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'game';
    document.body.appendChild(canvas);
  }
  game.boot(canvas);
  // Debug menu shortcut for development: press the ` key.
  window.addEventListener('keydown', (e) => {
    if (e.key === '`' && game.debugEnabled) game.openDebug();
  });
  globalThis.CARIBOU = game;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

export { Game, MUSIC, TILE, setStoryFlag, PartyScreen, BagScreen, DexScreen, TrainerCardScreen, OptionsScreen, SaveScreen };
