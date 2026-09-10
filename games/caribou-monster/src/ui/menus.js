// The pause menu and everything under it.
//
// Every screen here follows the same rules: D-pad or a direct tap both work,
// B always goes back, and nothing ever traps the player.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade, typeColor } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, hpBar, expBar, listMenu, moveCursor,
  drawTextCentered, drawTextRight, drawText, statusChip, genderMark, typeChip,
  shadeScreen, money, LINE,
} from './kit.js';
import { renderMonster } from '../render/monsterart.js';
import { drawChar, lookFor } from '../render/sprites.js';
import { getSpecies, SPECIES_LIST, natureName } from '../data/species.js';
import { getMove } from '../data/moves.js';
import { getItem, POCKETS } from '../data/items.js';
import {
  maxHp, displayName, isFainted, expProgress, expToNext, allStats, STAT_SHORT, healFully,
} from '../game/monster.js';
import { pocketContents, removeItem, addItem } from '../game/inventory.js';
import { swapParty, formatPlayTime, badgeCount } from '../game/state.js';
import { seenCount, caughtCount } from '../game/pokedex.js';
import { tryStone } from '../game/evolution.js';
import { abilityDescription } from '../game/battle/abilities.js';
import { friendshipLabel } from '../game/friendship.js';
import { net } from '../net/NetworkManager.js';
import { drawControls, drawBackChip } from './controls.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

// ===========================================================================

export class MainMenuScreen extends Screen {
  constructor(game) {
    super(game);
    this.seeThrough = true;
    this.index = 0;
  }

  get entries() {
    const st = this.game.state;
    const out = [];
    if (st.flags.gotStarter) out.push({ key: 'dex', text: 'POKéDEX' });
    if (st.party.length) out.push({ key: 'party', text: 'POKéMON' });
    if (st.flags.gotStarter) out.push({ key: 'journal', text: 'JOURNAL' });
    out.push({ key: 'bag', text: 'BAG' });
    out.push({ key: 'card', text: st.player.name.toUpperCase() });
    if (st.circuit && st.circuit.joined) out.push({ key: 'circuit', text: 'CIRCUIT' });
    out.push({ key: 'link', text: 'LINK' });
    out.push({ key: 'save', text: 'SAVE' });
    out.push({ key: 'options', text: 'OPTIONS' });
    out.push({ key: 'close', text: 'CLOSE' });
    return out;
  }

  update(dt, isTop) {
    if (!isTop) return;
    const items = this.entries;
    const { x, y, w } = this._box();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < items.length; i++) {
        if (hit(tap, x, y + 5 + i * LINE, w, LINE)) { this.index = i; audio.sfx('select'); this._pick(items[i].key); return; }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + items.length) % items.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % items.length; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._pick(items[this.index].key); }
    if (input.pressed('b') || input.pressed('start')) { audio.sfx('back'); this.game.screens.pop(); }
  }

  _pick(key) {
    const g = this.game;
    switch (key) {
      case 'dex': g.openDex(); break;
      case 'party': g.openParty(); break;
      case 'journal': g.openJournal(); break;
      case 'bag': g.openBag(); break;
      case 'card': g.openCard(); break;
      case 'circuit': g.openCircuit(); break;
      case 'link': g.openMultiplayer(); break;
      case 'save': g.openSave(); break;
      case 'options': g.openOptions(); break;
      default: g.screens.pop();
    }
  }

  _box() {
    const W = this.game.display.width;
    const w = 92;
    return { x: W - w - 4, y: 4, w };
  }

  render(ctx) {
    const items = this.entries;
    const { x, y, w } = this._box();
    const h = items.length * LINE + 10;
    window9(ctx, x, y, w, h);
    items.forEach((it, i) => {
      const iy = y + 5 + i * LINE;
      if (i === this.index) cursor(ctx, x + 4, iy);
      label(ctx, it.text, x + 12, iy);
    });
    if (net.inRoom) {
      const snap = net.snapshot();
      drawText(ctx, '●', x + w - 12, y + 5 + 4 * LINE, { color: snap.connected ? '#48c04a' : '#d8493f' });
    }
  }
}

// ===========================================================================

export class PartyScreen extends Screen {
  constructor(game, opts = {}) {
    super(game);
    this.index = 0;
    this.mode = opts.mode || 'browse';   // browse | pick | swap
    this.onPick = opts.onPick || null;
    this.prompt = opts.prompt || null;
    this.swapFrom = -1;
    this.sub = null;      // action menu
    this.subIndex = 0;
    this.detail = null;
  }

  _rowRect(i) {
    const W = this.game.display.width;
    const colW = Math.floor((W - 12) / 2);
    const col = i === 0 ? 0 : 1;
    const row = i === 0 ? 0 : i - 1;
    if (i === 0) return { x: 4, y: 14, w: colW - 2, h: 34 };
    return { x: 4 + colW + 4, y: 14 + row * 22, w: colW - 6, h: 20 };
  }

  update(dt, isTop) {
    if (!isTop) return;
    const party = this.game.state.party;
    if (this.detail) { this._updateDetail(); return; }
    if (this.sub) { this._updateSub(); return; }

    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < party.length; i++) {
        const r = this._rowRect(i);
        if (hit(tap, r.x, r.y, r.w, r.h)) { this.index = i; audio.sfx('select'); this._activate(); return; }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + party.length) % party.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % party.length; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._activate(); }
    if (input.pressed('b')) {
      audio.sfx('back');
      if (this.swapFrom >= 0) { this.swapFrom = -1; return; }
      if (this.mode === 'pick' && this.onPick) this.onPick(null);
      this.game.screens.pop();
    }
  }

  _activate() {
    const party = this.game.state.party;
    if (!party[this.index]) return;
    if (this.mode === 'pick') { const cb = this.onPick; this.game.screens.pop(); if (cb) cb(this.index); return; }
    if (this.swapFrom >= 0) {
      swapParty(this.game.state, this.swapFrom, this.index);
      this.swapFrom = -1;
      return;
    }
    // A Pokémon holding something offers TAKE; one with free hands offers GIVE.
    const mon = party[this.index];
    this.sub = ['SUMMARY', 'SWITCH', 'ITEM',
      mon && mon.heldItem ? 'TAKE ITEM' : 'GIVE ITEM', 'CANCEL'];
    this.subIndex = 0;
  }

  _updateSub() {
    const n = this.sub.length;
    const W = this.game.display.width;
    const x = W - 74, y = this.game.display.height - n * LINE - 14;
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < n; i++) {
        if (hit(tap, x, y + 5 + i * LINE, 70, LINE)) { this.subIndex = i; audio.sfx('select'); this._runSub(i); return; }
      }
    }
    if (input.repeated('up')) { this.subIndex = (this.subIndex - 1 + n) % n; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.subIndex = (this.subIndex + 1) % n; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._runSub(this.subIndex); }
    if (input.pressed('b')) { audio.sfx('back'); this.sub = null; }
  }

  _runSub(i) {
    const label_ = this.sub[i];
    this.sub = null;
    if (label_ === 'SUMMARY') this.detail = { page: 0 };
    else if (label_ === 'SWITCH') this.swapFrom = this.index;
    else if (label_ === 'ITEM') this.game.screens.push(new BagScreen(this.game, {
      mode: 'use', target: this.index,
    }));
    else if (label_ === 'GIVE ITEM') this._giveItem();
    else if (label_ === 'TAKE ITEM') this._takeItem();
  }

  _giveItem() {
    const mon = this.game.state.party[this.index];
    if (!mon) return;
    this.game.screens.push(new BagScreen(this.game, {
      mode: 'give',
      onPick: (itemId) => {
        if (!itemId) return;
        const st = this.game.state;
        // Swapping is a swap, not a loss: whatever it was holding comes back.
        if (mon.heldItem) addItem(st.inventory, mon.heldItem, 1);
        removeItem(st.inventory, itemId, 1);
        mon.heldItem = itemId;
        audio.sfx('select');
        if (this.game.save) this.game.save.markDirty();
      },
    }));
  }

  _takeItem() {
    const mon = this.game.state.party[this.index];
    if (!mon || !mon.heldItem) return;
    addItem(this.game.state.inventory, mon.heldItem, 1);
    mon.heldItem = null;
    audio.sfx('select');
    if (this.game.save) this.game.save.markDirty();
  }

  _updateDetail() {
    if (input.repeated('left')) { this.detail.page = (this.detail.page + 2) % 3; audio.sfx('cursor'); }
    if (input.repeated('right')) { this.detail.page = (this.detail.page + 1) % 3; audio.sfx('cursor'); }
    if (input.repeated('up') || input.repeated('down')) {
      const party = this.game.state.party;
      const d = input.repeated('up') ? -1 : 1;
      this.index = (this.index + d + party.length) % party.length;
      audio.sfx('cursor');
    }
    if (input.pressed('b') || input.pressed('a')) { audio.sfx('back'); this.detail = null; }
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade(PAL.uiSelect, -0.6));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade(PAL.uiSelect, -0.55));

    if (this.detail) { this._renderDetail(ctx, W, H); return; }

    const party = this.game.state.party;
    label(ctx, this.prompt || 'Choose a Pokémon.', 6, 4, { color: PAL.uiTextLight, shadow: PAL.black });

    party.forEach((m, i) => {
      const r = this._rowRect(i);
      const sel = i === this.index;
      const swapping = this.swapFrom === i;
      window9(ctx, r.x, r.y, r.w, r.h, {
        bg: swapping ? PAL.uiHighlight : sel ? shade(PAL.uiBg, 0.02) : PAL.uiBgAlt,
        frame: sel ? PAL.uiSelect : PAL.uiFrame,
      });
      const big = i === 0;
      const img = renderMonster(getSpecies(m.species).art, { size: big ? 30 : 18, shiny: m.shiny });
      ctx.drawImage(img, r.x + 3, r.y + (big ? 3 : 1));
      const tx = r.x + (big ? 36 : 23);
      label(ctx, displayName(m), tx, r.y + 3, { color: isFainted(m) ? PAL.uiShadow : PAL.uiText });
      genderMark(ctx, m.gender, tx + displayName(m).length * 6 + 2, r.y + 3);
      drawText(ctx, `Lv${m.level}`, tx, r.y + (big ? 14 : 11), { color: PAL.uiTextDim });
      hpBar(ctx, tx + 26, r.y + (big ? 16 : 13), r.w - (big ? 68 : 52), m.hp / maxHp(m));
      drawTextRight(ctx, `${m.hp}/${maxHp(m)}`, r.x + r.w - 4, r.y + 3, { color: PAL.uiTextDim });
      if (m.status) statusChip(ctx, m.status, r.x + r.w - 22, r.y + (big ? 22 : 11));
      if (big) expBar(ctx, r.x + 4, r.y + r.h - 5, r.w - 8, expProgress(m));
      if (m.shiny) drawText(ctx, '★', r.x + r.w - 10, r.y + 12, { color: PAL.uiHighlight });
      if (sel) cursor(ctx, r.x - 4, r.y + 4, { color: PAL.uiHighlight });
    });

    if (this.sub) {
      const n = this.sub.length;
      const x = W - 74, y = H - n * LINE - 14;
      window9(ctx, x, y, 70, n * LINE + 10);
      this.sub.forEach((s, i) => {
        const iy = y + 5 + i * LINE;
        if (i === this.subIndex) cursor(ctx, x + 4, iy);
        label(ctx, s, x + 12, iy);
      });
    } else {
      labelDim(ctx, this.swapFrom >= 0 ? 'Choose who to swap with.' : 'A: select   B: back', 6, H - 10);
    }
    drawControls(ctx, { alpha: 0.6, start: false, aLabel: 'A', bLabel: 'B' });
    drawBackChip(ctx, W - 52, 2);
  }

  _renderDetail(ctx, W, H) {
    const mon = this.game.state.party[this.index];
    if (!mon) { this.detail = null; return; }
    const sp = getSpecies(mon.species);
    window9(ctx, 2, 2, W - 4, H - 4);

    const img = renderMonster(sp.art, { size: 56, shiny: mon.shiny });
    ctx.drawImage(img, 8, 16);
    label(ctx, displayName(mon), 8, 6);
    genderMark(ctx, mon.gender, 8 + displayName(mon).length * 6 + 2, 6);
    drawText(ctx, `Lv${mon.level}`, 70, 6, { color: PAL.uiText });
    drawTextRight(ctx, `No.${String(sp.id).padStart(3, '0')}`, W - 8, 6, { color: PAL.uiTextDim });
    let cx = 8;
    for (const t of sp.types) cx += typeChip(ctx, t, cx, 74) + 3;

    const px = 76;
    const page = this.detail.page;
    if (page === 0) {
      const stats = allStats(mon);
      let y = 18;
      for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
        labelDim(ctx, STAT_SHORT[k], px, y);
        const bw = Math.min(70, Math.round(stats[k] / 3));
        rect(ctx, px + 26, y + 2, 72, 4, PAL.uiBgAlt);
        rect(ctx, px + 26, y + 2, bw, 4, shade(PAL.uiSelect, 0.15));
        drawTextRight(ctx, String(stats[k]), W - 10, y, { color: PAL.uiText });
        y += 10;
      }
      labelDim(ctx, `${natureName(mon.nature)} nature`, px, y);
    } else if (page === 1) {
      let y = 18;
      mon.moves.forEach((slot) => {
        const mv = getMove(slot.id);
        rect(ctx, px, y, W - px - 8, 9, shade(typeColor(mv.type), 0.55));
        drawText(ctx, mv.name, px + 3, y + 1, { color: PAL.uiText });
        drawTextRight(ctx, `${slot.pp}/${slot.ppMax}`, W - 12, y + 1, { color: PAL.uiTextDim });
        y += 11;
      });
      labelDim(ctx, `EXP to next: ${expToNext(mon)}`, px, y + 2);
    } else {
      labelDim(ctx, `OT: ${mon.ot || '???'}`, px, 18);
      labelDim(ctx, `ID: ${String(mon.otId ?? 0).padStart(5, '0')}`, px, 28);
      label(ctx, `Ability: ${mon.ability}`, px, 38, { color: PAL.uiText });
      // What the ability actually does, said plainly — including when the
      // honest answer is that this engine does not implement it.
      const abilityText = abilityDescription(mon.ability);
      if (abilityText) {
        labelDim(ctx, abilityText.slice(0, Math.floor((W - px - 12) / 6)), px, 48);
      }
      labelDim(ctx, `Friendship: ${friendshipLabel(mon)}`, px, 58);
      labelDim(ctx, `Met at Lv${mon.caughtLevel}`, px, 68);
      labelDim(ctx, mon.heldItem ? `Holding ${getItem(mon.heldItem).name}` : 'No held item', px, 78);
      const dex = sp.dex;
      const words = dex.split(' ');
      let line = '', y = 96;
      for (const wd of words) {
        if ((line + ' ' + wd).length > Math.floor((W - 16) / 6)) { label(ctx, line, 8, y); y += 9; line = wd; }
        else line = line ? `${line} ${wd}` : wd;
      }
      if (line) label(ctx, line, 8, y);
    }
    drawTextCentered(ctx, `${'○'.repeat(3).split('').map((c, i) => (i === page ? '●' : '○')).join(' ')}`, W / 2, H - 12, { color: PAL.uiTextDim });
    labelDim(ctx, '← →', 8, H - 12);
  }
}

// ===========================================================================

export class BagScreen extends Screen {
  constructor(game, opts = {}) {
    super(game);
    this.pocket = 0;
    this.index = 0;
    this.scroll = 0;
    this.mode = opts.mode || 'browse';   // browse | use | sell | pick | give
    this.target = opts.target ?? null;
    this.onPick = opts.onPick || null;
    this.message = null;
    this.messageT = 0;
  }

  get pockets() { return POCKETS; }
  get items() { return pocketContents(this.game.state.inventory, POCKETS[this.pocket]); }

  update(dt, isTop) {
    if (!isTop) return;
    if (this.messageT > 0) { this.messageT -= dt; if (this.messageT <= 0) this.message = null; }
    const items = this.items;
    const rows = Math.floor((this.game.display.height - 46) / LINE);
    const tap = input.consumeTap();
    if (tap) {
      const tabW = Math.floor(this.game.display.width / POCKETS.length);
      if (tap.y < 14) {
        const p = Math.floor(tap.x / tabW);
        if (p >= 0 && p < POCKETS.length) { this.pocket = p; this.index = 0; this.scroll = 0; audio.sfx('cursor'); return; }
      }
      for (let i = 0; i < Math.min(rows, items.length - this.scroll); i++) {
        if (hit(tap, 6, 20 + i * LINE, this.game.display.width - 12, LINE)) {
          this.index = this.scroll + i; audio.sfx('select'); this._use(); return;
        }
      }
    }
    if (input.repeated('left')) { this.pocket = (this.pocket - 1 + POCKETS.length) % POCKETS.length; this.index = 0; this.scroll = 0; audio.sfx('cursor'); }
    if (input.repeated('right')) { this.pocket = (this.pocket + 1) % POCKETS.length; this.index = 0; this.scroll = 0; audio.sfx('cursor'); }
    if (items.length) {
      if (input.repeated('up')) { const r = moveCursor(this.index, items.length, -1, rows, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
      if (input.repeated('down')) { const r = moveCursor(this.index, items.length, 1, rows, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
      if (input.pressed('a')) { audio.sfx('select'); this._use(); }
    }
    if (input.pressed('b')) { audio.sfx('back'); if (this.onPick) this.onPick(null); this.game.screens.pop(); }
  }

  _use() {
    const entry = this.items[this.index];
    if (!entry) return;
    const st = this.game.state;
    const item = entry.item;

    if (this.mode === 'pick' || this.mode === 'give') {
      if (this.mode === 'give' && !this._holdable(item)) {
        this._say(`${item.name} is not something a Pokémon can hold.`);
        audio.sfx('deny');
        return;
      }
      const cb = this.onPick; this.game.screens.pop(); if (cb) cb(item.id); return;
    }

    const u = item.use;
    if (!u) { this._say(item.desc); return; }

    if (u.kind === 'heal' || u.kind === 'revive' || u.kind === 'cure' || u.kind === 'pp' || u.kind === 'stone' || u.kind === 'tm') {
      const targetIdx = this.mode === 'use' && this.target != null ? this.target : null;
      if (targetIdx == null) {
        this.game.screens.push(new PartyScreen(this.game, {
          mode: 'pick', prompt: `Use ${item.name} on which Pokémon?`,
          onPick: (i) => { if (i != null) this._apply(item, st.party[i]); },
        }));
        return;
      }
      this._apply(item, st.party[targetIdx]);
      return;
    }
    if (u.kind === 'repel') {
      removeItem(st.inventory, item.id, 1);
      st.repelSteps = u.steps;
      this._say(`${item.name} used. Weak Pokémon will stay away.`);
      audio.sfx('select');
      return;
    }
    if (u.kind === 'escape') {
      removeItem(st.inventory, item.id, 1);
      this.game.escapeToHealPoint();
      return;
    }
    this._say(item.desc);
  }

  _apply(item, mon) {
    if (!mon) return;
    const st = this.game.state;
    const u = item.use;
    let ok = false;
    if (u.kind === 'heal') {
      if (isFainted(mon) || mon.hp >= maxHp(mon)) { this._say('It would have no effect.'); return; }
      const before = mon.hp;
      mon.hp = Math.min(maxHp(mon), mon.hp + u.amount);
      this._say(`${displayName(mon)} recovered ${mon.hp - before} HP.`);
      ok = true;
    } else if (u.kind === 'revive') {
      if (!isFainted(mon)) { this._say('It would have no effect.'); return; }
      mon.hp = Math.max(1, Math.floor(maxHp(mon) * u.fraction));
      this._say(`${displayName(mon)} was revived.`);
      ok = true;
    } else if (u.kind === 'cure') {
      if (!mon.status || !u.status.includes(mon.status)) { this._say('It would have no effect.'); return; }
      mon.status = null; mon.statusCounter = 0;
      this._say(`${displayName(mon)} is healthy again.`);
      ok = true;
    } else if (u.kind === 'pp') {
      const slot = mon.moves.find((m) => m.pp < m.ppMax);
      if (!slot) { this._say('It would have no effect.'); return; }
      slot.pp = Math.min(slot.ppMax, slot.pp + u.amount);
      this._say(`${getMove(slot.id).name} regained PP.`);
      ok = true;
    } else if (u.kind === 'stone') {
      const into = tryStone(mon, u.stone);
      if (!into) { this._say('It would have no effect.'); return; }
      audio.sfx('evolve');
      this._say(`${displayName(mon)} evolved into ${getSpecies(into).name}!`);
      ok = true;
    } else if (u.kind === 'tm') {
      const { canLearnTm, learnMove, knowsMove } = this.game.monsterApi;
      if (knowsMove(mon, u.move)) { this._say(`${displayName(mon)} already knows that move.`); return; }
      if (!canLearnTm(mon, u.move)) { this._say(`${displayName(mon)} cannot learn that move.`); return; }
      if (mon.moves.length < 4) {
        learnMove(mon, u.move);
        audio.sfx('levelup');
        this._say(`${displayName(mon)} learned ${getMove(u.move).name}!`);
      } else {
        this.game.screens.push(new ForgetMoveScreen(this.game, mon, u.move, (replaced) => {
          if (replaced) { audio.sfx('levelup'); this._say(`${displayName(mon)} learned ${getMove(u.move).name}!`); }
        }));
        return;
      }
      ok = true;
    }
    if (ok) {
      audio.sfx('heal');
      if (!item.key && u.kind !== 'tm') removeItem(st.inventory, item.id, 1);
      if (this.game.save) this.game.save.markDirty();
      if (this.mode === 'use') this.game.screens.pop();
    }
  }

  /** Key items stay in the bag; everything else can be carried. */
  _holdable(item) { return !item.key && item.pocket !== 'Key Items'; }

  _say(text) { this.message = text; this.messageT = 2.4; }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade('#c88a40', -0.45));
    for (let y = 0; y < H; y += 10) rect(ctx, 0, y, W, 5, shade('#c88a40', -0.4));

    const tabW = Math.floor(W / POCKETS.length);
    POCKETS.forEach((p, i) => {
      const sel = i === this.pocket;
      rect(ctx, i * tabW, 0, tabW - 1, 13, sel ? PAL.uiBg : shade(PAL.uiFrame, 0.1));
      drawTextCentered(ctx, p.replace('\u00e9', 'e').replace('Poke ', '').toUpperCase().slice(0, 8), i * tabW + tabW / 2, 3,
        { color: sel ? PAL.uiText : PAL.uiTextLight });
    });

    const items = this.items;
    const rows = Math.floor((H - 46) / LINE);
    window9(ctx, 2, 14, W - 4, rows * LINE + 10);
    if (!items.length) {
      labelDim(ctx, 'Nothing here.', 10, 20);
    } else {
      items.slice(this.scroll, this.scroll + rows).forEach((e, i) => {
        const idx = this.scroll + i;
        const iy = 20 + i * LINE;
        if (idx === this.index) cursor(ctx, 6, iy);
        label(ctx, e.item.name, 14, iy);
        if (!e.item.key) drawTextRight(ctx, `x${e.qty}`, W - 10, iy, { color: PAL.uiTextDim });
      });
    }

    const sel = items[this.index];
    window9(ctx, 2, H - 30, W - 4, 28);
    if (this.message) {
      label(ctx, this.message, 8, H - 25);
    } else if (sel) {
      const words = sel.item.desc.split(' ');
      let line = '', y = H - 25;
      const maxc = Math.floor((W - 16) / 6);
      for (const wd of words) {
        if ((line + ' ' + wd).length > maxc) { labelDim(ctx, line, 8, y); y += 9; line = wd; }
        else line = line ? `${line} ${wd}` : wd;
      }
      if (line) labelDim(ctx, line, 8, y);
    }
    drawTextRight(ctx, money(this.game.state.inventory.money), W - 8, H - 12, { color: PAL.uiText });
  }
}

// ===========================================================================

export class ForgetMoveScreen extends Screen {
  constructor(game, mon, newMove, onDone) {
    super(game);
    this.mon = mon;
    this.newMove = newMove;
    this.onDone = onDone;
    this.index = 0;
  }

  update(dt, isTop) {
    if (!isTop) return;
    const n = 5;
    const tap = input.consumeTap();
    const { x, y } = this._pos();
    if (tap) {
      for (let i = 0; i < n; i++) if (hit(tap, x, y + 12 + i * LINE, 150, LINE)) { this.index = i; audio.sfx('select'); this._pick(); return; }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + n) % n; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % n; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._pick(); }
    if (input.pressed('b')) { audio.sfx('back'); this.game.screens.pop(); if (this.onDone) this.onDone(false); }
  }

  _pick() {
    const { learnMove } = this.game.monsterApi;
    if (this.index >= 4) { this.game.screens.pop(); if (this.onDone) this.onDone(false); return; }
    learnMove(this.mon, this.newMove, this.index);
    this.game.screens.pop();
    if (this.onDone) this.onDone(true);
  }

  _pos() {
    const W = this.game.display.width;
    return { x: W / 2 - 80, y: 20 };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    shadeScreen(ctx, W, H, 0.6);
    const { x, y } = this._pos();
    window9(ctx, x - 4, y - 4, 168, 5 * LINE + 26);
    label(ctx, `Forget a move to learn`, x, y);
    label(ctx, getMove(this.newMove).name + '?', x, y + 9);
    this.mon.moves.forEach((slot, i) => {
      const iy = y + 24 + i * LINE;
      if (i === this.index) cursor(ctx, x - 1, iy);
      const mv = getMove(slot.id);
      label(ctx, mv.name, x + 8, iy);
      drawTextRight(ctx, mv.type.toUpperCase(), x + 156, iy, { color: typeColor(mv.type) });
    });
    const iy = y + 24 + 4 * LINE;
    if (this.index === 4) cursor(ctx, x - 1, iy);
    label(ctx, 'Do not learn it', x + 8, iy, { color: PAL.uiDanger });
  }
}

// ===========================================================================

export class TrainerCardScreen extends Screen {
  update(dt, isTop) {
    if (!isTop) return;
    if (input.pressed('a') || input.pressed('b') || input.consumeTap()) { audio.sfx('back'); this.game.screens.pop(); }
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const st = this.game.state;
    rect(ctx, 0, 0, W, H, shade(PAL.uiSelect, -0.5));
    window9(ctx, 6, 6, W - 12, H - 12, { bg: shade(PAL.uiSelect, 0.42) });

    label(ctx, 'TRAINER CARD', 14, 12, { color: PAL.uiText });
    rect(ctx, 14, 22, W - 28, 1, PAL.uiFrame);

    labelDim(ctx, 'NAME', 14, 28);
    label(ctx, st.player.name, 60, 28);
    labelDim(ctx, 'MONEY', 14, 40);
    label(ctx, money(st.inventory.money), 60, 40);
    labelDim(ctx, 'DEX', 14, 52);
    label(ctx, `${caughtCount(st.dex)} caught / ${seenCount(st.dex)} seen`, 60, 52);
    labelDim(ctx, 'TIME', 14, 64);
    label(ctx, formatPlayTime(st.playTimeMs), 60, 64);
    labelDim(ctx, 'ID', 14, 76);
    label(ctx, String(st.player.id).padStart(5, '0'), 60, 76);

    // Trainer portrait.
    drawChar(ctx, `card:${st.player.look}`, lookFor(st.player.look), 'down', 0, W - 40, 34);

    labelDim(ctx, 'BADGES', 14, H - 34);
    for (let i = 0; i < 8; i++) {
      const bx = 14 + i * 20, by = H - 24;
      const has = st.badges.includes(i + 1);
      rect(ctx, bx, by, 16, 16, has ? PAL.uiHighlight : shade(PAL.uiFrame, 0.25));
      rect(ctx, bx + 1, by + 1, 14, 14, has ? shade(PAL.uiHighlight, 0.25) : shade(PAL.uiFrame, 0.15));
      if (has) drawTextCentered(ctx, '★', bx + 8, by + 4, { color: shade(PAL.uiHighlight, -0.5) });
    }
    drawTextRight(ctx, `${badgeCount(st)}/8`, W - 14, H - 34, { color: PAL.uiText });
  }
}

// ===========================================================================

export class DexScreen extends Screen {
  constructor(game) {
    super(game);
    this.index = 0;
    this.scroll = 0;
    this.detail = false;
  }

  update(dt, isTop) {
    if (!isTop) return;
    const n = SPECIES_LIST.length;
    const rows = Math.floor((this.game.display.height - 24) / LINE);
    const tap = input.consumeTap();
    if (tap && !this.detail) {
      for (let i = 0; i < rows; i++) {
        if (hit(tap, 4, 16 + i * LINE, 130, LINE)) { this.index = this.scroll + i; audio.sfx('select'); this.detail = true; return; }
      }
    } else if (tap && this.detail) { this.detail = false; audio.sfx('back'); return; }

    if (input.repeated('up')) { const r = moveCursor(this.index, n, -1, rows, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
    if (input.repeated('down')) { const r = moveCursor(this.index, n, 1, rows, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
    if (input.pressed('a')) {
      audio.sfx('select');
      this.detail = !this.detail;
      if (this.detail) {
        const sp = SPECIES_LIST[this.index];
        if (this.game.state.dex.seen[sp.id]) audio.cry(sp.id);
      }
    }
    if (input.pressed('b')) {
      audio.sfx('back');
      if (this.detail) this.detail = false; else this.game.screens.pop();
    }
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const st = this.game.state;
    rect(ctx, 0, 0, W, H, shade(PAL.uiDanger, -0.45));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade(PAL.uiDanger, -0.4));

    const rows = Math.floor((H - 24) / LINE);
    window9(ctx, 2, 12, 136, rows * LINE + 8);
    drawText(ctx, `SEEN ${seenCount(st.dex)}`, 6, 3, { color: PAL.uiTextLight, shadow: PAL.black });
    drawText(ctx, `CAUGHT ${caughtCount(st.dex)}`, 62, 3, { color: PAL.uiTextLight, shadow: PAL.black });

    SPECIES_LIST.slice(this.scroll, this.scroll + rows).forEach((sp, i) => {
      const idx = this.scroll + i;
      const iy = 16 + i * LINE;
      const seen = st.dex.seen[sp.id];
      const caught = st.dex.caught[sp.id];
      if (idx === this.index) cursor(ctx, 5, iy);
      drawText(ctx, String(sp.id).padStart(3, '0'), 13, iy, { color: PAL.uiTextDim });
      label(ctx, seen ? sp.name : '----------', 36, iy, { color: seen ? PAL.uiText : PAL.uiShadow });
      if (caught) drawText(ctx, '●', 126, iy, { color: PAL.uiDanger });
    });

    const sp = SPECIES_LIST[this.index];
    const seen = st.dex.seen[sp.id];
    const px = 142;
    window9(ctx, px, 12, W - px - 2, H - 24);
    if (!seen) {
      labelDim(ctx, 'No data.', px + 8, 24);
      return;
    }
    const img = renderMonster(sp.art, { size: 48 });
    ctx.drawImage(img, px + 6, 18);
    label(ctx, sp.name, px + 58, 18);
    let cx = px + 58;
    for (const t of sp.types) cx += typeChip(ctx, t, cx, 28) + 3;
    labelDim(ctx, `HT ${sp.height.toFixed(1)}m`, px + 58, 42);
    labelDim(ctx, `WT ${sp.weight.toFixed(1)}kg`, px + 58, 52);

    if (this.detail) {
      const maxc = Math.floor((W - px - 18) / 6);
      let line = '', y = 72;
      for (const wd of sp.dex.split(' ')) {
        if ((line + ' ' + wd).length > maxc) { label(ctx, line, px + 8, y); y += 9; line = wd; }
        else line = line ? `${line} ${wd}` : wd;
      }
      if (line) label(ctx, line, px + 8, y);
    } else {
      labelDim(ctx, 'A: read entry', px + 8, 72);
    }
  }
}

// ===========================================================================

export class OptionsScreen extends Screen {
  constructor(game) {
    super(game);
    this.index = 0;
  }

  get rows() {
    const s = this.game.state.settings;
    return [
      { key: 'text', label: 'TEXT SPEED', value: ['SLOW', 'NORMAL', 'FAST'][s.textSpeed] },
      { key: 'difficulty', label: 'DIFFICULTY', value: this.game.state.difficulty.toUpperCase() },
      { key: 'music', label: 'MUSIC', value: s.music ? 'ON' : 'OFF' },
      { key: 'sfx', label: 'SOUND', value: s.sfx ? 'ON' : 'OFF' },
      { key: 'debug', label: 'DEBUG MENU', value: this.game.debugEnabled ? 'ON' : 'OFF' },
      { key: 'back', label: 'BACK', value: '' },
    ];
  }

  update(dt, isTop) {
    if (!isTop) return;
    const rows = this.rows;
    const tap = input.consumeTap();
    const x = 10, y = 20;
    if (tap) {
      for (let i = 0; i < rows.length; i++) {
        if (hit(tap, x, y + i * 14, this.game.display.width - 20, 12)) { this.index = i; audio.sfx('select'); this._toggle(1); return; }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + rows.length) % rows.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % rows.length; audio.sfx('cursor'); }
    if (input.repeated('left')) { this._toggle(-1); }
    if (input.repeated('right')) { this._toggle(1); }
    if (input.pressed('a')) { audio.sfx('select'); this._toggle(1); }
    if (input.pressed('b')) { audio.sfx('back'); this.game.screens.pop(); }
  }

  _toggle(dir) {
    const s = this.game.state.settings;
    const row = this.rows[this.index];
    switch (row.key) {
      case 'text': s.textSpeed = (s.textSpeed + dir + 3) % 3; this.game.applySettings(); break;
      case 'difficulty': this.game.state.difficulty = this.game.state.difficulty === 'easy' ? 'normal' : 'easy'; break;
      case 'music': s.music = !s.music; this.game.applySettings(); break;
      case 'sfx': s.sfx = !s.sfx; this.game.applySettings(); break;
      case 'debug': this.game.debugEnabled = !this.game.debugEnabled; break;
      case 'back': this.game.screens.pop(); return;
      default: break;
    }
    audio.sfx('cursor');
    if (this.game.save) this.game.save.markDirty();
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade(PAL.uiFrame, 0.05));
    window9(ctx, 4, 4, W - 8, H - 8);
    label(ctx, 'OPTIONS', 10, 8);
    rect(ctx, 10, 17, W - 20, 1, PAL.uiBgAlt);
    this.rows.forEach((r, i) => {
      const y = 22 + i * 14;
      if (i === this.index) cursor(ctx, 8, y);
      label(ctx, r.label, 16, y);
      if (r.value) drawTextRight(ctx, r.value, W - 14, y, { color: PAL.uiSelect });
    });
    labelDim(ctx, 'Difficulty affects wild levels, AI and rewards.', 10, H - 14);
  }
}

// ===========================================================================

export class SaveScreen extends Screen {
  constructor(game) {
    super(game);
    this.state = 'confirm';
    this.index = 0;
    this.t = 0;
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (this.state === 'confirm') {
      if (input.repeated('up') || input.repeated('down')) { this.index = 1 - this.index; audio.sfx('cursor'); }
      const tap = input.consumeTap();
      const W = this.game.display.width;
      if (tap) {
        if (hit(tap, W - 62, 60, 56, 12)) { this.index = 0; this._doSave(); return; }
        if (hit(tap, W - 62, 72, 56, 12)) { this.game.screens.pop(); return; }
      }
      if (input.pressed('a')) { audio.sfx('select'); if (this.index === 0) this._doSave(); else this.game.screens.pop(); }
      if (input.pressed('b')) { audio.sfx('back'); this.game.screens.pop(); }
    } else if (this.state === 'done' && this.t > 0.8) {
      if (input.pressed('a') || input.pressed('b') || input.consumeTap()) { this.game.screens.pop(); }
    }
  }

  async _doSave() {
    this.state = 'saving';
    this.t = 0;
    const ok = await this.game.save.save(this.game.state);
    audio.sfx(ok ? 'save' : 'deny');
    this.ok = ok;
    this.state = 'done';
    this.t = 0;
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const st = this.game.state;
    shadeScreen(ctx, W, H, 0.5);
    window9(ctx, 6, 6, 130, 74);
    label(ctx, st.player.name, 12, 11);
    labelDim(ctx, 'BADGES', 12, 24); drawTextRight(ctx, String(badgeCount(st)), 130, 24, { color: PAL.uiText });
    labelDim(ctx, 'DEX', 12, 34); drawTextRight(ctx, String(caughtCount(st.dex)), 130, 34, { color: PAL.uiText });
    labelDim(ctx, 'TIME', 12, 44); drawTextRight(ctx, formatPlayTime(st.playTimeMs), 130, 44, { color: PAL.uiText });
    labelDim(ctx, 'PLACE', 12, 54);
    drawTextRight(ctx, this.game.currentMapName(), 130, 54, { color: PAL.uiText });

    if (this.state === 'confirm') {
      window9(ctx, W - 66, 54, 60, 34);
      label(ctx, 'Save?', W - 60, 46);
      ['YES', 'NO'].forEach((s, i) => {
        const y = 60 + i * 12;
        if (i === this.index) cursor(ctx, W - 62, y);
        label(ctx, s, W - 54, y);
      });
    } else if (this.state === 'saving') {
      window9(ctx, 6, H - 32, W - 12, 28);
      label(ctx, 'Saving...', 14, H - 24);
    } else {
      window9(ctx, 6, H - 32, W - 12, 28);
      label(ctx, this.ok ? `${st.player.name} saved the game.` : 'Saving failed — storage is unavailable.',
        14, H - 24, { color: this.ok ? PAL.uiText : PAL.uiDanger });
    }
  }
}
