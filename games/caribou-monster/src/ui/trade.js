// The trade screen.
//
// Mirrors the TradeSession state machine exactly, and never lets the player
// past a step the session has not reached. The confirm button only becomes
// live once both monsters are on the table, and the swap itself is performed
// by the session — this screen cannot move a monster on its own.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, hpBar, drawTextCentered, drawTextRight,
  drawText, genderMark, typeChip, LINE,
} from './kit.js';
import { renderMonster } from '../render/monsterart.js';
import { getSpecies } from '../data/species.js';
import { maxHp, displayName, natureOf } from '../game/monster.js';
import { TRADE_STATE } from '../net/RoomManager.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

export class TradeScreen extends Screen {
  constructor(game, session) {
    super(game);
    this.s = session;
    this.index = 0;
    this.t = 0;
    this.anim = 0;
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    const s = this.s;

    if (s.phase === TRADE_STATE.DONE) this.anim = Math.min(1, this.anim + dt / 1.4);

    if (s.phase === TRADE_STATE.IDLE) { this.game.screens.pop(); return; }

    if (s.phase === TRADE_STATE.INVITED) { this._updateInvite(); return; }
    if (s.phase === TRADE_STATE.SELECTING) { this._updateSelect(); return; }
    if (s.phase === TRADE_STATE.REVIEW) { this._updateReview(); return; }

    // Requested / committing / done / cancelled are all waiting states.
    if (s.phase === TRADE_STATE.DONE || s.phase === TRADE_STATE.CANCELLED) {
      if (this.t > 0.6 && (input.pressed('a') || input.pressed('b') || input.consumeTap())) {
        audio.sfx('select');
        s.reset();
        this.game.screens.pop();
      }
      return;
    }
    if (input.pressed('b')) { audio.sfx('back'); s.cancel(); }
  }

  _updateInvite() {
    const { width: W, height: H } = this.game.display;
    const tap = input.consumeTap();
    if (tap) {
      if (hit(tap, W / 2 - 62, H / 2 + 10, 56, 14)) { audio.sfx('select'); this.s.accept(); return; }
      if (hit(tap, W / 2 + 6, H / 2 + 10, 56, 14)) { audio.sfx('back'); this.s.decline(); return; }
    }
    if (input.repeated('left') || input.repeated('right')) { this.index = 1 - this.index; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); if (this.index === 0) this.s.accept(); else this.s.decline(); }
    if (input.pressed('b')) { audio.sfx('back'); this.s.decline(); }
  }

  _updateSelect() {
    const party = this.game.state.party;
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < party.length; i++) {
        const r = this._slotRect(i);
        if (hit(tap, r.x, r.y, r.w, r.h)) { this.index = i; audio.sfx('select'); this.s.offer(party[i].uid); return; }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + party.length) % party.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % party.length; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this.s.offer(party[this.index].uid); }
    if (input.pressed('b')) {
      audio.sfx('back');
      if (this.s.myOffer) this.s.withdrawOffer(); else this.s.cancel();
    }
  }

  _updateReview() {
    const { width: W, height: H } = this.game.display;
    const tap = input.consumeTap();
    const confirmRect = { x: W / 2 - 62, y: H - 22, w: 56, h: 16 };
    const cancelRect = { x: W / 2 + 6, y: H - 22, w: 56, h: 16 };
    if (tap) {
      if (hit(tap, confirmRect.x, confirmRect.y, confirmRect.w, confirmRect.h)) {
        audio.sfx('select');
        if (this.s.myConfirm) this.s.unconfirm(); else this.s.confirm();
        return;
      }
      if (hit(tap, cancelRect.x, cancelRect.y, cancelRect.w, cancelRect.h)) { audio.sfx('back'); this.s.cancel(); return; }
    }
    if (input.pressed('a')) { audio.sfx('select'); if (this.s.myConfirm) this.s.unconfirm(); else this.s.confirm(); }
    if (input.pressed('b')) { audio.sfx('back'); if (this.s.myConfirm) this.s.unconfirm(); else this.s.withdrawOffer(); }
  }

  _slotRect(i) {
    const { height: H } = this.game.display;
    return { x: 6, y: 34 + i * 20, w: 130, h: 18, H };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const s = this.s;
    rect(ctx, 0, 0, W, H, shade('#a850c0', -0.55));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade('#a850c0', -0.5));

    drawText(ctx, 'LINK TRADE', 6, 4, { color: PAL.uiTextLight, shadow: PAL.black });
    drawTextRight(ctx, s.partnerName, W - 6, 4, { color: '#e0b0f0', shadow: PAL.black });

    if (s.phase === TRADE_STATE.INVITED) { this._renderInvite(ctx, W, H); return; }
    if (s.phase === TRADE_STATE.REQUESTED) { this._renderWaiting(ctx, W, H, s.message); return; }
    if (s.phase === TRADE_STATE.DONE || s.phase === TRADE_STATE.CANCELLED) { this._renderResult(ctx, W, H); return; }

    // Party list (left).
    const party = this.game.state.party;
    window9(ctx, 2, 16, 138, party.length * 20 + 22);
    labelDim(ctx, 'YOUR PARTY', 8, 20);
    party.forEach((m, i) => {
      const r = this._slotRect(i);
      const sel = i === this.index && s.phase === TRADE_STATE.SELECTING;
      const offered = s.myOffer === m.uid;
      rect(ctx, r.x, r.y, r.w, r.h, offered ? PAL.uiHighlight : sel ? shade(PAL.uiBgAlt, 0.15) : PAL.uiBgAlt);
      const img = renderMonster(getSpecies(m.species).art, { size: 16, shiny: m.shiny, egg: m.isEgg });
      ctx.drawImage(img, r.x + 1, r.y + 1);
      label(ctx, displayName(m), r.x + 20, r.y + 2, { color: PAL.uiText });
      drawTextRight(ctx, `Lv${m.level}`, r.x + r.w - 4, r.y + 2, { color: PAL.uiTextDim });
      hpBar(ctx, r.x + 20, r.y + 13, r.w - 26, m.hp / maxHp(m), { h: 2 });
      if (sel) cursor(ctx, r.x - 4, r.y + 4, { color: PAL.uiHighlight });
    });

    // The table (right): the two monsters on offer.
    const px = 146;
    window9(ctx, px, 16, W - px - 2, H - 42);
    this._offerCard(ctx, px + 4, 20, W - px - 10, 'YOU OFFER',
      s.myOffer ? party.find((m) => m.uid === s.myOffer) : null, s.myConfirm);
    this._offerCard(ctx, px + 4, 20 + (H - 42) / 2 - 4, W - px - 10, 'THEY OFFER',
      s.theirOffer, s.theirConfirm);

    // Footer. In REVIEW the buttons take the right half, so the status line
    // is truncated to whatever is actually left.
    window9(ctx, 2, H - 24, W - 4, 22);
    const room = s.phase === TRADE_STATE.REVIEW ? W / 2 - 70 : W - 16;
    const maxc = Math.max(6, Math.floor(room / 6));
    label(ctx, s.message.length > maxc ? s.message.slice(0, maxc - 1) + '\u2026' : s.message, 8, H - 20);

    if (s.phase === TRADE_STATE.REVIEW) {
      const ready = s.myConfirm;
      rect(ctx, W / 2 - 62, H - 22, 56, 16, ready ? PAL.uiShadow : PAL.hpGreen);
      drawTextCentered(ctx, ready ? 'WAIT...' : 'CONFIRM', W / 2 - 34, H - 18, { color: '#ffffff' });
      rect(ctx, W / 2 + 6, H - 22, 56, 16, PAL.uiDanger);
      drawTextCentered(ctx, 'CANCEL', W / 2 + 34, H - 18, { color: '#ffffff' });
    }
    if (s.phase === TRADE_STATE.COMMITTING) {
      drawTextCentered(ctx, 'Trading...', W / 2, H - 18, { color: PAL.uiText });
    }
  }

  _offerCard(ctx, x, y, w, title, mon, confirmed) {
    const h = 58;
    rect(ctx, x, y, w, h, PAL.uiBgAlt);
    labelDim(ctx, title, x + 3, y + 2);
    if (confirmed) drawTextRight(ctx, 'READY', x + w - 3, y + 2, { color: PAL.hpGreen });
    if (!mon) {
      labelDim(ctx, '(nothing yet)', x + 6, y + 22);
      return;
    }
    const sp = getSpecies(mon.species);
    const img = renderMonster(sp.art, { size: 32, shiny: mon.shiny, egg: mon.isEgg });
    ctx.drawImage(img, x + 3, y + 12);
    label(ctx, displayName(mon), x + 40, y + 14);
    genderMark(ctx, mon.gender, x + 42 + displayName(mon).length * 6, y + 14);
    labelDim(ctx, `Lv${mon.level}  ${natureOf(mon)}`, x + 40, y + 24);
    let cx = x + 40;
    for (const t of sp.types) cx += typeChip(ctx, t, cx, y + 34) + 2;
    if (mon.shiny) drawText(ctx, '★', x + w - 10, y + 14, { color: PAL.uiHighlight });
  }

  _renderInvite(ctx, W, H) {
    window9(ctx, W / 2 - 92, H / 2 - 34, 184, 62);
    drawTextCentered(ctx, `${this.s.partnerName} wants to trade!`, W / 2, H / 2 - 28);
    drawTextCentered(ctx, 'Nothing moves until you both confirm.', W / 2, H / 2 - 14, { color: PAL.uiTextDim });
    ['ACCEPT', 'DECLINE'].forEach((s, i) => {
      const x = i === 0 ? W / 2 - 62 : W / 2 + 6;
      const sel = i === this.index;
      rect(ctx, x, H / 2 + 10, 56, 14, sel ? (i === 0 ? PAL.hpGreen : PAL.uiDanger) : PAL.uiBgAlt);
      drawTextCentered(ctx, s, x + 28, H / 2 + 13, { color: sel ? '#ffffff' : PAL.uiText });
    });
  }

  _renderWaiting(ctx, W, H, msg) {
    window9(ctx, W / 2 - 80, H / 2 - 20, 160, 40);
    const dots = '.'.repeat(1 + Math.floor(this.t * 2) % 3);
    drawTextCentered(ctx, msg + dots, W / 2, H / 2 - 12);
    drawTextCentered(ctx, 'B: cancel', W / 2, H / 2 + 6, { color: PAL.uiTextDim });
  }

  _renderResult(ctx, W, H) {
    const s = this.s;
    const ok = s.phase === TRADE_STATE.DONE;
    if (ok && s.result) {
      // Two monsters cross the screen.
      const p = this.anim;
      const sent = s.result.sent, got = s.result.got;
      if (sent) {
        const img = renderMonster(getSpecies(sent.species).art, { size: 40, shiny: sent.shiny, egg: sent.isEgg });
        ctx.drawImage(img, Math.round(20 + (W - 80) * p), Math.round(H / 2 - 50));
      }
      if (got) {
        const img = renderMonster(getSpecies(got.species).art, { size: 40, shiny: got.shiny, egg: got.isEgg });
        ctx.drawImage(img, Math.round(W - 60 - (W - 80) * p), Math.round(H / 2 + 6));
      }
    }
    window9(ctx, 8, H - 46, W - 16, 40);
    const words = s.message.split(' ');
    let line = '', y = H - 40;
    const maxc = Math.floor((W - 28) / 6);
    for (const wd of words) {
      if ((line + ' ' + wd).length > maxc) { label(ctx, line, 14, y, { color: ok ? PAL.uiText : PAL.uiDanger }); y += 9; line = wd; }
      else line = line ? `${line} ${wd}` : wd;
    }
    if (line) label(ctx, line, 14, y, { color: ok ? PAL.uiText : PAL.uiDanger });
    if (this.t > 0.6) drawTextRight(ctx, 'A: close', W - 14, H - 14, { color: PAL.uiTextDim });
    void LINE; void labelDim;
  }
}
