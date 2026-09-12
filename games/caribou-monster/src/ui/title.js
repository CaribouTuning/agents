// Title, new game and character creation.
import { Screen, FADE } from './screen.js';
import { drawBackChip, getBackChip } from './controls.js';
import { KEY_ROWS, keyGrid } from './naming.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, drawTextCentered, drawTextRight, drawText,
  shadeScreen, LINE,
} from './kit.js';
import { renderMonster } from '../render/monsterart.js';
import { drawChar, lookFor } from '../render/sprites.js';
import { getSpecies } from '../data/species.js';
import { PLAYERS } from '../game/players.js';

// The Everlight itself, on the ridge behind the logo.
const DIALGA = 483;
import { MUSIC } from '../data/music.js';
import { formatPlayTime } from '../game/state.js';
import { openRestorePanel } from '../save/restoreui.js';
import { slotForLook } from '../save/SaveManager.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

export class TitleScreen extends Screen {
  // A root: it owns the whole screen and there is nothing behind it to go
  // back to, so the stack does not hang a BACK chip on it.
  isRoot = true;

  constructor(game, saves) {
    super(game);
    // `saves` is one entry per character who has a game here — the store is
    // shared by the two of them, so there can be two, and the title has to
    // offer both rather than assuming there is one.
    this.saves = Array.isArray(saves) ? saves : (saves ? [{ slot: null, meta: saves }] : []);
    this.index = 0;
    this.t = 0;
    this.starT = Array.from({ length: 26 }, () => ({
      x: Math.random(), y: Math.random() * 0.6, s: 0.2 + Math.random() * 0.8,
    }));
  }

  /**
   * The durable store answering after the first paint. CONTINUE appears
   * (or, on a genuinely fresh save, stays away) without the boot having had
   * to wait for the network. The cursor is kept on whatever the player was
   * already pointing at rather than jumping under their thumb.
   */
  /** A one-line note about where saves are going. Visible, so a failure is. */
  _storageNote() {
    const g = this.game;
    // A restore in progress, or its result, outranks the storage note: it is
    // the thing the player just did and the thing they are waiting on.
    if (this.note) return this.note;
    if (g.saveProviders === undefined) return 'checking for a saved game...';
    const d = g.save.backend.diagnose ? g.save.backend.diagnose() : null;
    if (!d) return g.saveIsDurable ? 'saving to this account' : 'saving to this device only';
    if (d.lastError) return `cloud save failed: ${String(d.lastError).slice(0, 28)}`;
    switch (d.permission) {
      case 'granted': return 'cloud save on — this game will keep';
      case 'prompt': return 'cloud save will ask permission when you save';
      case 'denied': return 'cloud save REFUSED — this device only';
      case 'unavailable': return 'no cloud save here — this device only';
      default: return 'checking where saves go...';
    }
  }

  setSave(saves) {
    const wasOn = this.options[this.index] && this.options[this.index].key;
    this.saves = Array.isArray(saves) ? saves : (saves ? [{ slot: null, meta: saves }] : []);
    const again = this.options.findIndex((o) => o.key === wasOn);
    this.index = again >= 0 ? again : 0;
  }

  /** The save the cursor is currently pointing at, for the info panel. */
  get saveMeta() {
    const o = this.options[this.index];
    const pick = o && o.slot !== undefined ? this.saves.find((sv) => sv.slot === o.slot) : null;
    return (pick && pick.meta) || (this.saves[0] && this.saves[0].meta) || null;
  }

  get options() {
    const out = [];
    // One row per game that exists. With two saves the rows are named, so
    // nobody has to guess which CONTINUE is theirs.
    const many = this.saves.length > 1;
    for (const sv of this.saves) {
      const who = (sv.meta && sv.meta.name) || 'TRAINER';
      out.push({
        key: `continue:${sv.slot}`,
        slot: sv.slot,
        text: many ? `CONTINUE ${String(who).toUpperCase()}` : 'CONTINUE',
      });
    }
    out.push({ key: 'new', text: 'NEW GAME' });
    out.push({ key: 'options', text: 'OPTIONS' });
    // The escape hatch. If the cloud save is refused, unavailable or simply
    // broken on this device, a backup file still brings a playthrough back —
    // and it needs no capability at all to read one.
    out.push({ key: 'restore', text: 'LOAD BACKUP' });
    // Always here, on the first screen, with no prerequisite. Test mode that
    // can only be switched on from inside a running game is useless to
    // somebody who cannot get a running game to persist.
    out.push({ key: 'test', text: 'TEST MODE' });
    return out;
  }

  onEnter() {
    audio.playMusic(MUSIC.title, 'title');
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    const opts = this.options;
    const { x, y, w } = this._menuBox();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < opts.length; i++) {
        if (hit(tap, x, y + 5 + i * LINE, w, LINE)) { this.index = i; audio.sfx('select'); this._pick(opts[i].key); return; }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + opts.length) % opts.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % opts.length; audio.sfx('cursor'); }
    if (input.pressed('a') || input.pressed('start')) { audio.sfx('select'); this._pick(opts[this.index].key); }
  }

  _pick(key) {
    const g = this.game;
    if (key.startsWith('continue')) {
      const slot = key.slice('continue:'.length);
      g.screens.fade(FADE.BLACK, () => g.continueGame(slot === 'null' ? null : slot));
    } else if (key === 'new') {
      // No blanket "this overwrites your save" any more: the two of them have
      // a slot each, so starting a new game as Sammy cannot touch Matthew's.
      // The warning now comes at the moment a character who already has a
      // game is picked, and names them.
      g.screens.push(new CharacterScreen(g, this.saves));
    } else if (key === 'restore') {
      this._restore();
    } else if (key === 'test') {
      // Straight into a playable game with test mode already on, so the
      // console is one tap away instead of a playthrough away.
      g.screens.fade(FADE.BLACK, () => {
        g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
        g.state.settings.testMode = true;
        g.debugEnabled = true;
        g.state.flags.gotStarter = true;
        g.debugGive(387, 5);
        g.openDebug();
      });
    } else {
      g.screens.push(new TitleOptionsScreen(g));
    }
  }

  /**
   * Reads a backup file and makes it the live save, then walks straight into
   * it. Nothing is overwritten until the file has parsed and been recognised,
   * so picking the wrong file costs a sentence, not a playthrough.
   */
  async _restore() {
    this.note = 'pick your backup file...';
    // A real DOM panel, because the file picker will not open from inside the
    // game loop: by the time a tap reaches this code the browser no longer
    // counts a gesture as in progress, and the picker is silently refused.
    const got = await openRestorePanel();
    if (!got.ok) { this.note = got.text; audio.sfx('deny'); return; }
    this.note = 'restoring...';
    const res = await this.game.save.restore(got.raw);
    if (!res.ok) { this.note = `restore failed: ${String(res.error || '?').slice(0, 24)}`; audio.sfx('deny'); return; }
    audio.sfx('save');
    this.note = null;
    this.game.screens.fade(FADE.BLACK, () => this.game.continueGame(res.slot));
  }

  _menuBox() {
    const { width: W, height: H } = this.game.display;
    const w = 96;
    return { x: W / 2 - w / 2, y: H - this.options.length * LINE - 26, w };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    // Aurora sky — the region's motif.
    for (let y = 0; y < H; y++) {
      const t = y / H;
      const r = Math.round(12 + t * 20), g = Math.round(16 + t * 34), b = Math.round(38 + t * 46);
      rect(ctx, 0, y, W, 1, `rgb(${r},${g},${b})`);
    }
    for (let i = 0; i < 4; i++) {
      const phase = this.t * 0.25 + i * 1.3;
      for (let x = 0; x < W; x += 2) {
        const yy = 26 + i * 9 + Math.sin(x * 0.03 + phase) * 9 + Math.sin(x * 0.011 - phase * 0.7) * 5;
        const a = 0.10 + 0.07 * Math.sin(x * 0.02 + phase * 1.4);
        ctx.globalAlpha = Math.max(0, a);
        rect(ctx, x, yy, 2, 16, i % 2 ? '#7ae0b0' : '#9ab8ff');
      }
    }
    ctx.globalAlpha = 1;
    for (const s of this.starT) {
      ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(this.t * s.s + s.x * 9));
      rect(ctx, Math.round(s.x * W), Math.round(s.y * H), 1, 1, '#ffffff');
    }
    ctx.globalAlpha = 1;

    // Ground silhouette.
    rect(ctx, 0, H - 46, W, 46, '#101a24');
    for (let x = 0; x < W; x += 3) {
      const hgt = 8 + Math.sin(x * 0.06) * 5 + Math.sin(x * 0.017) * 7;
      rect(ctx, x, H - 46 - hgt, 3, hgt + 2, '#0b1420');
    }

    // The legendary stands on the ridge.
    const img = renderMonster(getSpecies(DIALGA).art, { size: 80 });
    ctx.globalAlpha = 0.92;
    ctx.drawImage(img, Math.round(W - 78), Math.round(H - 100 + Math.sin(this.t * 0.9) * 1.5));
    ctx.globalAlpha = 1;

    // Logo.
    const cx = W / 2;
    drawTextCentered(ctx, 'POK\u00e9MON', cx - 1, 20, { color: '#0a0e18', scale: 3 });
    drawTextCentered(ctx, 'POK\u00e9MON', cx, 18, { color: '#f8e070', scale: 3 });
    drawTextCentered(ctx, 'FOR SAMMY & MATT', cx - 1, 42, { color: '#0a0e18', scale: 1 });
    drawTextCentered(ctx, 'FOR SAMMY & MATT', cx, 41, { color: '#e8f4ff', scale: 1 });
    drawTextCentered(ctx, 'S I N N O H   R E G I O N', cx, 54, { color: '#9ab8ff' });

    const { x, y, w } = this._menuBox();
    const opts = this.options;
    window9(ctx, x, y, w, opts.length * LINE + 10);
    opts.forEach((o, i) => {
      const iy = y + 5 + i * LINE;
      if (i === this.index) cursor(ctx, x + 5, iy);
      label(ctx, o.text, x + 14, iy);
    });

    // Where saves are going, said out loud. A storage problem should be
    // visible on the first screen, not discovered a day later.
    //
    // Along the top, where nothing else is drawn. It used to sit at the foot
    // of the screen and run straight under the option box, so the first thing
    // anybody saw on opening the game was two lines of text on top of each
    // other.
    labelDim(ctx, this._storageNote(), 6, 4);
    const meta = this.saveMeta;
    if (meta) {
      window9(ctx, 4, H - 40, 96, 36);
      labelDim(ctx, meta.name || 'Trainer', 9, H - 36);
      labelDim(ctx, `Badges ${meta.badges}`, 9, H - 27);
      labelDim(ctx, `Time ${formatPlayTime(meta.playTimeMs || 0)}`, 9, H - 18);
    }
    drawTextCentered(ctx, 'A private fan project, for the two of us.', cx, H - 12, { color: '#5a6a94' });
  }
}

// ---------------------------------------------------------------------------

/**
 * "You already have a game as this one." Asked once, about one character,
 * with their name in it — and it calls back rather than deciding, so the
 * character screen keeps its place either way.
 */
export class ConfirmNewGameScreen extends Screen {
  constructor(game, who, onYes) {
    super(game);
    this.seeThrough = true;
    this.index = 1;
    this.who = who || 'this trainer';
    this.onYes = onYes || (() => {});
  }

  _yes() { this.game.screens.pop(); this.onYes(); }

  update(dt, isTop) {
    if (!isTop) return;
    if (input.repeated('up') || input.repeated('down')) { this.index = 1 - this.index; audio.sfx('cursor'); }
    if (input.pressed('a')) {
      audio.sfx('select');
      if (this.index === 0) this._yes();
      else this.game.screens.pop();
    }
    if (input.pressed('b')) { audio.sfx('back'); this.game.screens.pop(); }
    const tap = input.consumeTap();
    if (tap) {
      const { width: W, height: H } = this.game.display;
      if (hit(tap, W / 2 - 60, H / 2 + 4, 50, 12)) this._yes();
      else if (hit(tap, W / 2 + 10, H / 2 + 4, 50, 12)) this.game.screens.pop();
    }
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    shadeScreen(ctx, W, H, 0.6);
    window9(ctx, W / 2 - 90, H / 2 - 26, 180, 52);
    drawTextCentered(ctx, `${this.who} already has a game here.`, W / 2, H / 2 - 20);
    drawTextCentered(ctx, 'Starting over will erase it.', W / 2, H / 2 - 10, { color: PAL.uiDanger });
    ['OVERWRITE', 'CANCEL'].forEach((s, i) => {
      const x = i === 0 ? W / 2 - 60 : W / 2 + 10;
      rect(ctx, x, H / 2 + 4, 50, 12, i === this.index ? PAL.uiSelect : PAL.uiBgAlt);
      drawTextCentered(ctx, s, x + 25, H / 2 + 6, { color: i === this.index ? '#ffffff' : PAL.uiText });
    });
  }
}

export class TitleOptionsScreen extends Screen {
  constructor(game) { super(game); this.index = 0; }

  get rows() {
    const s = this.game.state.settings;
    return [
      { k: 'diff', label: 'DIFFICULTY', v: this.game.state.difficulty.toUpperCase() },
      { k: 'music', label: 'MUSIC', v: s.music ? 'ON' : 'OFF' },
      { k: 'sfx', label: 'SOUND', v: s.sfx ? 'ON' : 'OFF' },
      { k: 'back', label: 'BACK', v: '' },
    ];
  }

  update(dt, isTop) {
    if (!isTop) return;
    const rows = this.rows;
    if (input.repeated('up')) { this.index = (this.index - 1 + rows.length) % rows.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % rows.length; audio.sfx('cursor'); }
    const act = input.pressed('a') || input.repeated('left') || input.repeated('right');
    const tap = input.consumeTap();
    let picked = -1;
    if (tap) {
      const W = this.game.display.width;
      for (let i = 0; i < rows.length; i++) if (hit(tap, 20, 30 + i * 14, W - 40, 12)) picked = i;
    }
    if (picked >= 0) this.index = picked;
    if (act || picked >= 0) {
      audio.sfx('select');
      const r = rows[this.index];
      const s = this.game.state.settings;
      if (r.k === 'diff') this.game.state.difficulty = this.game.state.difficulty === 'easy' ? 'normal' : 'easy';
      else if (r.k === 'music') { s.music = !s.music; this.game.applySettings(); }
      else if (r.k === 'sfx') { s.sfx = !s.sfx; this.game.applySettings(); }
      else this.game.screens.pop();
    }
    if (input.pressed('b')) { audio.sfx('back'); this.game.screens.pop(); }
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    shadeScreen(ctx, W, H, 0.7);
    window9(ctx, 12, 12, W - 24, H - 24);
    label(ctx, 'OPTIONS', 20, 18);
    this.rows.forEach((r, i) => {
      const y = 32 + i * 14;
      if (i === this.index) cursor(ctx, 18, y);
      label(ctx, r.label, 26, y);
      if (r.v) drawTextRight(ctx, r.v, W - 26, y, { color: PAL.uiSelect });
    });
    labelDim(ctx, 'EASY is gentler. You can change this any time.', 20, H - 24);
  }
}

// ---------------------------------------------------------------------------

const ROWS = KEY_ROWS;

export class CharacterScreen extends Screen {
  constructor(game, saves = []) {
    super(game);
    this.saves = saves || [];
    this.warned = {};
    this.step = 0;         // 0 look, 1 name, 2 difficulty, 3 confirm
    this.look = PLAYERS[0].look;
    this.name = '';
    this.difficulty = 'easy';
    this.kx = 0; this.ky = 0;
    this.lookIndex = 0;
    this.diffIndex = 0;
    this.t = 0;
    // Two players, because that is how many people this game is for.
    this.looks = PLAYERS.map((p) => ({ key: p.look, label: p.label, defaultName: p.name, blurb: p.blurb }));
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (this.step === 0) this._updateLook();
    else if (this.step === 1) this._updateName();
    else if (this.step === 2) this._updateDifficulty();
    else this._updateConfirm();
  }

  // One layout for the two cards, used by both the hit test and the render
  // so a tap always lands exactly where the card is drawn.
  _lookCards() {
    const { width: W, height: H } = this.game.display;
    const n = this.looks.length;
    const cw = 58; const ch = 58; const gap = 10;
    const total = n * cw + (n - 1) * gap;
    return this.looks.map((l, i) => ({
      l, i, x: Math.round(W / 2 - total / 2 + i * (cw + gap)), y: Math.round(H / 2 - 32), w: cw, h: ch,
    }));
  }

  _updateLook() {
    const n = this.looks.length;
    const tap = input.consumeTap();
    if (tap) {
      for (const card of this._lookCards()) {
        if (hit(tap, card.x, card.y, card.w, card.h)) {
          this.lookIndex = card.i; audio.sfx('select'); this._confirmLook(); return;
        }
      }
    }
    if (input.repeated('left')) { this.lookIndex = (this.lookIndex - 1 + n) % n; audio.sfx('cursor'); }
    if (input.repeated('right')) { this.lookIndex = (this.lookIndex + 1) % n; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._confirmLook(); }
    if (input.pressed('b')) { audio.sfx('back'); this.game.screens.pop(); }
  }

  _confirmLook() {
    const pick = this.looks[this.lookIndex];
    const existing = this.saves.find((sv) => sv.slot === slotForLook(pick.key));
    if (existing && !this.warned[pick.key]) {
      const who = (existing.meta && existing.meta.name) || pick.defaultName;
      this.game.screens.push(new ConfirmNewGameScreen(this.game, who, () => {
        this.warned[pick.key] = true;
        this._confirmLook();
      }));
      return;
    }
    this.look = pick.key;
    this.name = pick.defaultName;
    this.step = 1;
  }

  _updateName() {
    const tap = input.consumeTap();
    const grid = this._keyGrid();
    if (tap) {
      for (const cell of grid.cells) {
        if (hit(tap, cell.x, cell.y, cell.w, cell.h)) { this._type(cell.ch); return; }
      }
      if (hit(tap, grid.okX, grid.okY, 44, 13)) { this._finishName(); return; }
      if (hit(tap, grid.delX, grid.delY, 44, 13)) { this._backspace(); return; }
    }
    if (input.repeated('left')) { this.kx = (this.kx - 1 + 10) % 10; audio.sfx('cursor'); }
    if (input.repeated('right')) { this.kx = (this.kx + 1) % 10; audio.sfx('cursor'); }
    if (input.repeated('up')) { this.ky = (this.ky - 1 + ROWS.length) % ROWS.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.ky = (this.ky + 1) % ROWS.length; audio.sfx('cursor'); }
    if (input.pressed('a')) this._type(ROWS[this.ky][this.kx]);
    if (input.pressed('b')) this._backspace();
    if (input.pressed('start')) this._finishName();
  }

  _type(ch) {
    if (ch === ' ' || !ch) return;
    if (this.name.length >= 10) { audio.sfx('deny'); return; }
    this.name += ch;
    audio.sfx('select');
  }

  _backspace() {
    if (!this.name.length) { audio.sfx('deny'); return; }
    this.name = this.name.slice(0, -1);
    audio.sfx('back');
  }

  _finishName() {
    if (!this.name.trim().length) { this.name = this.looks[this.lookIndex].defaultName; }
    audio.sfx('select');
    this.step = 2;
  }

  _updateDifficulty() {
    const { width: W, height: H } = this.game.display;
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < 2; i++) {
        if (hit(tap, W / 2 - 76, H / 2 - 12 + i * 26, 152, 22)) { this.diffIndex = i; audio.sfx('select'); this._confirmDiff(); return; }
      }
    }
    if (input.repeated('up') || input.repeated('down')) { this.diffIndex = 1 - this.diffIndex; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._confirmDiff(); }
    if (input.pressed('b')) { audio.sfx('back'); this.step = 1; }
  }

  _confirmDiff() {
    this.difficulty = this.diffIndex === 0 ? 'easy' : 'normal';
    this.step = 3;
  }

  _updateConfirm() {
    if (input.pressed('a') || input.consumeTap()) {
      audio.sfx('select');
      this.game.screens.fade(FADE.WHITE, () => {
        this.game.startNewGame({ name: this.name, look: this.look, difficulty: this.difficulty });
      }, { outMs: 420, inMs: 500 });
    }
    if (input.pressed('b')) { audio.sfx('back'); this.step = 2; }
  }

  // One keyboard in the game, shared with the nickname screen.
  _keyGrid() { return keyGrid(this.game.display, 44); }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade(PAL.uiSelect, -0.55));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade(PAL.uiSelect, -0.5));

    if (this.step === 0) {
      drawTextCentered(ctx, 'Who are you?', W / 2, 14, { color: PAL.uiTextLight, shadow: PAL.black });
      const cards = this._lookCards();
      for (const card of cards) {
        const sel = card.i === this.lookIndex;
        window9(ctx, card.x, card.y, card.w, card.h,
          { bg: sel ? PAL.uiBg : PAL.uiBgAlt, frame: sel ? PAL.uiHighlight : PAL.uiFrame });
        drawChar(ctx, `cc:${card.l.key}`, lookFor(card.l.key), 'down',
          sel ? (Math.floor(this.t * 5) % 3) : 0, card.x + card.w / 2 - 8, card.y + 20);
        drawTextCentered(ctx, card.l.label, card.x + card.w / 2, card.y + card.h - 12,
          { color: sel ? PAL.uiText : PAL.uiTextDim });
      }
      const chosen = this.looks[this.lookIndex];
      drawTextCentered(ctx, chosen.blurb || '', W / 2, H - 30, { color: PAL.uiTextLight });
      drawTextCentered(ctx, 'The other one is who you link with.', W / 2, H - 18, { color: '#9ab8ff' });
    } else if (this.step === 1) {
      drawTextCentered(ctx, 'What is your name?', W / 2, 8, { color: PAL.uiTextLight, shadow: PAL.black });
      window9(ctx, W / 2 - 60, 20, 120, 16);
      drawTextCentered(ctx, this.name + ((this.t * 2) % 1 < 0.5 ? '_' : ''), W / 2, 24);
      const g = this._keyGrid();
      for (const cell of g.cells) {
        const sel = cell.r === this.ky && cell.c === this.kx;
        rect(ctx, cell.x, cell.y, cell.w, cell.h, sel ? PAL.uiHighlight : PAL.uiBg);
        drawTextCentered(ctx, cell.ch, cell.x + cell.w / 2, cell.y + 3, { color: PAL.uiText });
      }
      rect(ctx, g.delX, g.delY, 44, 13, PAL.uiBgAlt);
      drawTextCentered(ctx, 'DEL', g.delX + 22, g.delY + 3);
      rect(ctx, g.okX, g.okY, 44, 13, PAL.hpGreen);
      drawTextCentered(ctx, 'OK', g.okX + 22, g.okY + 3, { color: '#ffffff' });
    } else if (this.step === 2) {
      drawTextCentered(ctx, 'Choose a difficulty', W / 2, 20, { color: PAL.uiTextLight, shadow: PAL.black });
      const rows = [
        ['EASY', 'Gentler levels, kinder AI, more EXP.'],
        ['NORMAL', 'Classic pacing and smarter trainers.'],
      ];
      rows.forEach((r, i) => {
        const y = H / 2 - 12 + i * 26;
        const sel = i === this.diffIndex;
        window9(ctx, W / 2 - 76, y, 152, 22, { bg: sel ? PAL.uiBg : PAL.uiBgAlt, frame: sel ? PAL.uiHighlight : PAL.uiFrame });
        label(ctx, r[0], W / 2 - 70, y + 3, { color: sel ? PAL.uiText : PAL.uiTextDim });
        labelDim(ctx, r[1], W / 2 - 70, y + 12);
      });
      drawTextCentered(ctx, 'You can change this later in OPTIONS.', W / 2, H - 16, { color: '#9ab8ff' });
    } else {
      drawTextCentered(ctx, 'Ready?', W / 2, 18, { color: PAL.uiTextLight, shadow: PAL.black });
      window9(ctx, W / 2 - 80, 32, 160, H - 62);
      drawChar(ctx, `cc2:${this.look}`, lookFor(this.look), 'down', Math.floor(this.t * 5) % 3, W / 2 - 8, 48);
      drawTextCentered(ctx, this.name, W / 2, 68);
      drawTextCentered(ctx, this.difficulty.toUpperCase(), W / 2, 80, { color: PAL.uiSelect });
      drawTextCentered(ctx, 'Twinleaf Town is waiting.', W / 2, 96, { color: PAL.uiTextDim });
      drawTextCentered(ctx, 'A: begin      B: back', W / 2, H - 22, { color: PAL.uiTextLight, shadow: PAL.black });
    }
  }
}
