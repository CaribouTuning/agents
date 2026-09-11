// Poké Mart.
import { Screen } from './screen.js';
import { drawBackChip } from './controls.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, moveCursor, drawTextCentered,
  drawTextRight, drawText, money, LINE, scrollbar, hitScroll, dragList, pageBy,
} from './kit.js';
import { getItem, martStock, departmentStock } from '../data/items.js';
import { addItem, removeItem, spend, earn, sellPrice, pocketContents } from '../game/inventory.js';
import { POCKETS } from '../data/items.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

export class ShopScreen extends Screen {
  constructor(game, onClose, kind = 'mart') {
    super(game);
    this.onClose = onClose;
    this.kind = kind;
    this.mode = 'menu';       // menu | buy | sell | quantity
    this.index = 0;
    this.scroll = 0;
    this.qty = 1;
    this.pending = null;
    this.message = 'Welcome! What can I get you?';
  }

  get stock() {
    const badges = this.game.state.badges.length;
    const ids = this.kind === 'department' ? departmentStock(badges) : martStock(badges);
    return ids.map((id) => getItem(id)).filter(Boolean);
  }

  get sellable() {
    const inv = this.game.state.inventory;
    const out = [];
    for (const p of POCKETS) {
      if (p === 'Key Items') continue;
      for (const e of pocketContents(inv, p)) if (sellPrice(e.id) > 0) out.push(e);
    }
    return out;
  }

  get rows() { return Math.floor((this.game.display.height - 58) / LINE); }

  update(dt, isTop) {
    if (!isTop) return;
    if (this.mode === 'menu') this._updateMenu();
    else if (this.mode === 'quantity') this._updateQty();
    else this._updateList();
  }

  _updateMenu() {
    const opts = ['BUY', 'SELL', 'LEAVE'];
    const { width: W } = this.game.display;
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < 3; i++) if (hit(tap, W - 74, 20 + i * LINE, 68, LINE)) { this.index = i; audio.sfx('select'); this._pickMenu(i); return; }
    }
    if (input.repeated('up')) { this.index = (this.index + 2) % 3; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % 3; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._pickMenu(this.index); }
    if (input.pressed('b')) { audio.sfx('back'); this._close(); }
  }

  _pickMenu(i) {
    if (i === 0) { this.mode = 'buy'; this.index = 0; this.scroll = 0; }
    else if (i === 1) {
      if (!this.sellable.length) { this.message = 'You have nothing I can buy.'; audio.sfx('deny'); return; }
      this.mode = 'sell'; this.index = 0; this.scroll = 0;
    } else this._close();
  }

  _close() {
    this.game.screens.pop();
    if (this.onClose) this.onClose();
  }

  _list() { return this.mode === 'buy' ? this.stock : this.sellable; }

  _updateList() {
    const list = this._list();
    const rows = this.rows;
    if (dragList(this, list.length, rows)) return;
    const tap = input.consumeTap();
    if (tap && this.bar && hitScroll(tap, this.bar)) {
      pageBy(this, list.length, rows, hitScroll(tap, this.bar));
      audio.sfx('cursor');
      return;
    }
    if (tap) {
      for (let i = 0; i < Math.min(rows, list.length - this.scroll); i++) {
        if (hit(tap, 6, 22 + i * LINE, this.game.display.width - 12, LINE)) {
          this.index = this.scroll + i; audio.sfx('select'); this._choose(); return;
        }
      }
    }
    if (input.repeated('up')) { const r = moveCursor(this.index, list.length, -1, rows, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
    if (input.repeated('down')) { const r = moveCursor(this.index, list.length, 1, rows, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._choose(); }
    if (input.pressed('b')) { audio.sfx('back'); this.mode = 'menu'; this.index = 0; }
  }

  _choose() {
    const list = this._list();
    const entry = list[this.index];
    if (!entry) return;
    this.pending = this.mode === 'buy'
      ? { buy: true, item: entry, unit: entry.price, max: Math.max(1, Math.min(99, Math.floor(this.game.state.inventory.money / Math.max(1, entry.price)))) }
      : { buy: false, item: entry.item, unit: sellPrice(entry.id), max: entry.qty };
    if (this.pending.buy && this.pending.max < 1) { this.message = 'You cannot afford that.'; audio.sfx('deny'); this.pending = null; return; }
    this.qty = 1;
    this.mode = 'quantity';
  }

  _updateQty() {
    const p = this.pending;
    const { width: W, height: H } = this.game.display;
    if (input.repeated('up')) { this.qty = Math.min(p.max, this.qty + 1); audio.sfx('cursor'); }
    if (input.repeated('down')) { this.qty = Math.max(1, this.qty - 1); audio.sfx('cursor'); }
    if (input.repeated('right')) { this.qty = Math.min(p.max, this.qty + 10); audio.sfx('cursor'); }
    if (input.repeated('left')) { this.qty = Math.max(1, this.qty - 10); audio.sfx('cursor'); }
    const tap = input.consumeTap();
    if (tap) {
      if (hit(tap, W / 2 - 62, H / 2 + 8, 56, 14)) { this._commit(); return; }
      if (hit(tap, W / 2 + 6, H / 2 + 8, 56, 14)) { this.mode = this.pending.buy ? 'buy' : 'sell'; this.pending = null; return; }
      if (hit(tap, W / 2 + 30, H / 2 - 14, 16, 12)) { this.qty = Math.min(p.max, this.qty + 1); audio.sfx('cursor'); return; }
      if (hit(tap, W / 2 - 46, H / 2 - 14, 16, 12)) { this.qty = Math.max(1, this.qty - 1); audio.sfx('cursor'); return; }
    }
    if (input.pressed('a')) this._commit();
    if (input.pressed('b')) { audio.sfx('back'); this.mode = this.pending.buy ? 'buy' : 'sell'; this.pending = null; }
  }

  _commit() {
    const p = this.pending;
    const inv = this.game.state.inventory;
    const total = p.unit * this.qty;
    if (p.buy) {
      if (!spend(inv, total)) { audio.sfx('deny'); this.message = 'You do not have enough money.'; return; }
      addItem(inv, p.item.id, this.qty);
      this.message = `${p.item.name} x${this.qty}. Thank you!`;
    } else {
      removeItem(inv, p.item.id, this.qty);
      earn(inv, total);
      this.message = `Sold ${p.item.name} x${this.qty} for ${money(total)}.`;
    }
    audio.sfx('buy');
    this.pending = null;
    this.mode = 'menu';
    this.index = 0;
    if (this.game.save) this.game.save.markDirty();
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade(PAL.roofBlue, -0.45));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade(PAL.roofBlue, -0.4));

    window9(ctx, 4, 2, 96, 15);
    drawText(ctx, money(this.game.state.inventory.money), 10, 6);

    if (this.mode === 'menu') {
      window9(ctx, W - 78, 14, 72, 3 * LINE + 10);
      ['BUY', 'SELL', 'LEAVE'].forEach((s, i) => {
        const y = 20 + i * LINE;
        if (i === this.index) cursor(ctx, W - 74, y);
        label(ctx, s, W - 66, y);
      });
    } else if (this.mode === 'buy' || this.mode === 'sell') {
      const list = this._list();
      const rows = this.rows;
      window9(ctx, 2, 16, W - 4, rows * LINE + 10);
      this.bar = scrollbar(ctx, W - 12, 22, rows * LINE + 4, { index: this.scroll, count: list.length, rows });
      list.slice(this.scroll, this.scroll + rows).forEach((e, i) => {
        const idx = this.scroll + i;
        const y = 22 + i * LINE;
        const item = this.mode === 'buy' ? e : e.item;
        const price = this.mode === 'buy' ? e.price : sellPrice(e.id);
        if (idx === this.index) cursor(ctx, 6, y);
        label(ctx, item.name, 14, y);
        drawTextRight(ctx, money(price), W - 10, y, { color: PAL.uiTextDim });
        if (this.mode === 'sell') drawTextRight(ctx, `x${e.qty}`, W - 66, y, { color: PAL.uiShadow });
      });
      const sel = list[this.index];
      const item = this.mode === 'buy' ? sel : sel?.item;
      window9(ctx, 2, H - 30, W - 4, 28);
      if (item) {
        const maxc = Math.floor((W - 16) / 6);
        let line = '', y = H - 25;
        for (const wd of item.desc.split(' ')) {
          if ((line + ' ' + wd).length > maxc) { labelDim(ctx, line, 8, y); y += 9; line = wd; }
          else line = line ? `${line} ${wd}` : wd;
        }
        if (line) labelDim(ctx, line, 8, y);
      }
      return;
    }

    if (this.mode === 'quantity') {
      const p = this.pending;
      window9(ctx, W / 2 - 70, H / 2 - 34, 140, 62);
      drawTextCentered(ctx, p.item.name, W / 2, H / 2 - 28);
      rect(ctx, W / 2 - 46, H / 2 - 14, 16, 12, PAL.uiBgAlt);
      drawTextCentered(ctx, '-', W / 2 - 38, H / 2 - 12);
      drawTextCentered(ctx, `x${this.qty}`, W / 2, H / 2 - 12);
      rect(ctx, W / 2 + 30, H / 2 - 14, 16, 12, PAL.uiBgAlt);
      drawTextCentered(ctx, '+', W / 2 + 38, H / 2 - 12);
      drawTextCentered(ctx, money(p.unit * this.qty), W / 2, H / 2 - 2, { color: PAL.uiSelect });
      rect(ctx, W / 2 - 62, H / 2 + 8, 56, 14, PAL.hpGreen);
      drawTextCentered(ctx, p.buy ? 'BUY' : 'SELL', W / 2 - 34, H / 2 + 11, { color: '#ffffff' });
      rect(ctx, W / 2 + 6, H / 2 + 8, 56, 14, PAL.uiBgAlt);
      drawTextCentered(ctx, 'CANCEL', W / 2 + 34, H / 2 + 11);
      return;
    }

    window9(ctx, 2, H - 30, W - 4, 28);
    label(ctx, this.message, 8, H - 25);
    drawBackChip(ctx, W - 52, 2);
  }
}
