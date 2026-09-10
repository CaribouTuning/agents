// Monster storage — the PC boxes.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from './kit.js';
import {
  window9, rect, label, labelDim, cursor, hpBar, drawTextCentered, drawTextRight,
  drawText, statusChip, genderMark, LINE,
} from './kit.js';
import { renderMonster } from '../render/monsterart.js';
import { drawBackChip } from './controls.js';
import { getSpecies } from '../data/species.js';
import { maxHp, displayName, isFainted, natureOf } from '../game/monster.js';
import { partyToBox, boxToParty, releaseFromBox, BOX_SIZE } from '../game/state.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;
const COLS = 6;

export class PCScreen extends Screen {
  constructor(game) {
    super(game);
    this.box = 0;
    this.cursorIdx = 0;
    this.pane = 'box';        // box | party
    this.partyIdx = 0;
    this.held = null;         // { from:'box'|'party', index }
    this.message = 'Move Pokémon between your party and the boxes.';
    this.confirmRelease = null;
  }

  get boxData() { return this.game.state.boxes[this.box]; }

  update(dt, isTop) {
    if (!isTop) return;
    if (this.confirmRelease) { this._updateConfirm(); return; }
    const tap = input.consumeTap();
    if (tap) this._handleTap(tap);

    if (input.pressed('start')) { this.pane = this.pane === 'box' ? 'party' : 'box'; audio.sfx('cursor'); }

    if (this.pane === 'box') this._updateBoxPane();
    else this._updatePartyPane();

    if (input.pressed('b')) {
      audio.sfx('back');
      if (this.held) { this.held = null; this.message = 'Put it back.'; return; }
      this.game.screens.pop();
    }
  }

  _updateBoxPane() {
    const rows = Math.ceil(BOX_SIZE / COLS);
    if (input.repeated('left')) { this.cursorIdx = (this.cursorIdx - 1 + BOX_SIZE) % BOX_SIZE; audio.sfx('cursor'); }
    if (input.repeated('right')) { this.cursorIdx = (this.cursorIdx + 1) % BOX_SIZE; audio.sfx('cursor'); }
    if (input.repeated('up')) {
      if (this.cursorIdx < COLS) { this._changeBox(-1); }
      else { this.cursorIdx -= COLS; audio.sfx('cursor'); }
    }
    if (input.repeated('down')) {
      if (this.cursorIdx >= (rows - 1) * COLS) { this.pane = 'party'; audio.sfx('cursor'); }
      else { this.cursorIdx += COLS; audio.sfx('cursor'); }
    }
    if (input.pressed('a')) this._actBox();
  }

  _updatePartyPane() {
    const party = this.game.state.party;
    if (input.repeated('left')) { this.partyIdx = (this.partyIdx - 1 + Math.max(1, party.length)) % Math.max(1, party.length); audio.sfx('cursor'); }
    if (input.repeated('right')) { this.partyIdx = (this.partyIdx + 1) % Math.max(1, party.length); audio.sfx('cursor'); }
    if (input.repeated('up')) { this.pane = 'box'; audio.sfx('cursor'); }
    if (input.pressed('a')) this._actParty();
  }

  _changeBox(d) {
    const n = this.game.state.boxes.length;
    this.box = (this.box + d + n) % n;
    audio.sfx('cursor');
  }

  _actBox() {
    const box = this.boxData;
    const mon = box.mons[this.cursorIdx];
    if (this.held) {
      // Drop into the box.
      if (this.held.from === 'party') {
        if (box.mons.length >= BOX_SIZE) { audio.sfx('deny'); this.message = 'This box is full.'; return; }
        if (this.game.state.party.length <= 1) { audio.sfx('deny'); this.message = 'You need at least one Pokémon with you!'; return; }
        partyToBox(this.game.state, this.held.index, this.box);
        this.message = 'Stored.';
      } else {
        this.message = 'Put it back.';
      }
      this.held = null;
      audio.sfx('select');
      if (this.game.save) this.game.save.markDirty();
      return;
    }
    if (!mon) { audio.sfx('deny'); return; }
    audio.sfx('select');
    this.held = { from: 'box', index: this.cursorIdx };
    this.message = `${displayName(mon)} picked up. Choose a party slot.`;
    this.pane = 'party';
  }

  _actParty() {
    const st = this.game.state;
    if (this.held) {
      if (this.held.from === 'box') {
        if (st.party.length >= 6) { audio.sfx('deny'); this.message = 'Your party is full.'; return; }
        boxToParty(st, this.box, this.held.index);
        this.message = 'Added to your party.';
        this.held = null;
        audio.sfx('select');
        if (this.game.save) this.game.save.markDirty();
        return;
      }
      this.held = null;
      return;
    }
    const mon = st.party[this.partyIdx];
    if (!mon) { audio.sfx('deny'); return; }
    if (st.party.length <= 1) { audio.sfx('deny'); this.message = 'That is your only Pokémon!'; return; }
    audio.sfx('select');
    this.held = { from: 'party', index: this.partyIdx };
    this.message = `${displayName(mon)} picked up. Choose a box slot.`;
    this.pane = 'box';
  }

  _handleTap(tap) {
    const g = this._grid();
    if (hit(tap, g.prevX, g.tabY, 14, 11)) { this._changeBox(-1); return; }
    if (hit(tap, g.nextX, g.tabY, 14, 11)) { this._changeBox(1); return; }
    for (let i = 0; i < BOX_SIZE; i++) {
      const c = this._cell(i);
      if (hit(tap, c.x, c.y, c.w, c.h)) { this.pane = 'box'; this.cursorIdx = i; this._actBox(); return; }
    }
    const party = this.game.state.party;
    for (let i = 0; i < party.length; i++) {
      const c = this._partyCell(i);
      if (hit(tap, c.x, c.y, c.w, c.h)) { this.pane = 'party'; this.partyIdx = i; this._actParty(); return; }
    }
  }

  _updateConfirm() {
    if (input.pressed('a')) {
      audio.sfx('select');
      releaseFromBox(this.game.state, this.box, this.confirmRelease);
      this.confirmRelease = null;
    }
    if (input.pressed('b')) { audio.sfx('back'); this.confirmRelease = null; }
  }

  _grid() {
    const { width: W } = this.game.display;
    const cell = Math.min(22, Math.floor((W - 24) / COLS));
    const gx = 8;
    const gy = 26;
    return { cell, gx, gy, tabY: 12, prevX: 8, nextX: 8 + COLS * cell - 14 };
  }

  _cell(i) {
    const g = this._grid();
    return { x: g.gx + (i % COLS) * g.cell, y: g.gy + Math.floor(i / COLS) * g.cell, w: g.cell - 2, h: g.cell - 2 };
  }

  _partyCell(i) {
    const { height: H } = this.game.display;
    return { x: 8 + i * 24, y: H - 30, w: 22, h: 26 };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const st = this.game.state;
    rect(ctx, 0, 0, W, H, shade(PAL.uiSelect, -0.5));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade(PAL.uiSelect, -0.45));

    const g = this._grid();
    // Box tabs.
    rect(ctx, g.prevX, g.tabY, 14, 11, PAL.uiBgAlt);
    drawTextCentered(ctx, '<', g.prevX + 7, g.tabY + 2);
    rect(ctx, g.nextX, g.tabY, 14, 11, PAL.uiBgAlt);
    drawTextCentered(ctx, '>', g.nextX + 7, g.tabY + 2);
    drawTextCentered(ctx, this.boxData.name, (g.prevX + g.nextX) / 2 + 7, g.tabY + 2,
      { color: PAL.uiTextLight, shadow: PAL.black });

    // Box grid.
    const rows = Math.ceil(BOX_SIZE / COLS);
    window9(ctx, g.gx - 4, g.gy - 4, COLS * g.cell + 6, rows * g.cell + 6);
    for (let i = 0; i < BOX_SIZE; i++) {
      const c = this._cell(i);
      const mon = this.boxData.mons[i];
      const sel = this.pane === 'box' && i === this.cursorIdx;
      rect(ctx, c.x, c.y, c.w, c.h, sel ? PAL.uiHighlight : PAL.uiBgAlt);
      if (mon) {
        const img = renderMonster(getSpecies(mon.species).art, { size: c.w - 2, shiny: mon.shiny, egg: mon.isEgg });
        ctx.drawImage(img, c.x + 1, c.y + 1);
      }
    }

    // Party strip.
    window9(ctx, 4, H - 34, W - 8, 32);
    st.party.forEach((m, i) => {
      const c = this._partyCell(i);
      const sel = this.pane === 'party' && i === this.partyIdx;
      rect(ctx, c.x, c.y, c.w, c.h, sel ? PAL.uiHighlight : PAL.uiBgAlt);
      const img = renderMonster(getSpecies(m.species).art, { size: 20, shiny: m.shiny, egg: m.isEgg });
      ctx.drawImage(img, c.x + 1, c.y + 1);
      hpBar(ctx, c.x + 2, c.y + 22, 18, m.hp / maxHp(m), { h: 2 });
    });

    // Info panel for whatever is under the cursor.
    const focus = this.pane === 'box' ? this.boxData.mons[this.cursorIdx] : st.party[this.partyIdx];
    const px = g.gx + COLS * g.cell + 6;
    if (px < W - 60) {
      window9(ctx, px, g.gy - 4, W - px - 4, rows * g.cell + 6);
      if (focus) {
        const sp = getSpecies(focus.species);
        const img = renderMonster(sp.art, { size: 40, shiny: focus.shiny });
        ctx.drawImage(img, px + 4, g.gy);
        label(ctx, displayName(focus), px + 4, g.gy + 42);
        genderMark(ctx, focus.gender, px + 6 + displayName(focus).length * 6, g.gy + 42);
        labelDim(ctx, `Lv${focus.level}  ${sp.types.join('/')}`, px + 4, g.gy + 52);
        labelDim(ctx, natureOf(focus), px + 4, g.gy + 62);
        hpBar(ctx, px + 4, g.gy + 74, W - px - 14, focus.hp / maxHp(focus));
        if (focus.status) statusChip(ctx, focus.status, px + 4, g.gy + 80);
      } else {
        labelDim(ctx, 'Empty', px + 6, g.gy + 6);
      }
    }

    // Held monster follows the cursor.
    if (this.held) {
      const src = this.held.from === 'box' ? this.boxData.mons[this.held.index] : st.party[this.held.index];
      if (src) {
        const c = this.pane === 'box' ? this._cell(this.cursorIdx) : this._partyCell(this.partyIdx);
        const img = renderMonster(getSpecies(src.species).art, { size: 20, shiny: src.shiny, egg: src.isEgg });
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, c.x + 2, c.y - 8);
        ctx.globalAlpha = 1;
      }
    }

    const msg = this.message.length > Math.floor((W - 70) / 6)
      ? this.message.slice(0, Math.floor((W - 70) / 6) - 1) + '\u2026' : this.message;
    label(ctx, msg, 6, 2, { color: PAL.uiTextLight, shadow: PAL.black });
    drawBackChip(ctx, W - 52, 0);
    void cursor; void LINE; void drawText; void isFainted;
  }
}
