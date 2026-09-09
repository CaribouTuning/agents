// The World Circuit hub — the side story's home screen.
//
// Laid out like the handheld's other menus rather than as a wall of text: a
// coloured title band, a tab strip, one panel of content, and a hint bar that
// always says what A and B do. Four tabs over one career — your trainer card,
// the events you can enter, the world ranking, and the press feed.
//
// The tournament run itself lives in TournamentScreen below, which is what
// actually starts the battles.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, drawText, drawTextCentered, drawTextRight,
  titleBar, rowHighlight, pill, meterBar, rule, moveCursor, money, LINE,
} from './kit.js';
import { drawBackChip, hintBar } from './controls.js';
import { drawChar, lookFor } from '../render/sprites.js';
import { TOURNAMENTS, RANKS, getPro, getTournament, rankIndex } from '../data/circuit.js';
import { standings, rankProgress, headToHead, roundName } from '../game/circuit/circuit.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

const TABS = [
  { name: 'CARD', color: '#c85a3a' },
  { name: 'EVENTS', color: '#3f6fd4' },
  { name: 'RANKS', color: '#3f9060' },
  { name: 'NEWS', color: '#8a5ac8' },
];

// Chrome heights. Everything else is measured from these.
const BAND_H = 13;
const TAB_H = 13;
const CONTENT_Y = BAND_H + TAB_H + 2;
const FOOT_H = 11;

// One colour per tier so an event's weight reads before the words do.
const TIER_COLOR = {
  Local: '#7b8099', Regional: '#3f9060', National: '#3f6fd4',
  Continental: '#c85a3a', World: '#a848c0',
};
const OUTLET_COLOR = {
  'Sinnoh Battle Wire': '#3f6fd4', 'Poké Sports Network': '#c85a3a',
  'Circuit Weekly': '#3f9060', 'The Type Chart': '#8a5ac8', 'Global Battle Report': '#7b8099',
};
const outletColor = (n) => OUTLET_COLOR[n] || PAL.uiFrameLight;

// The medal a placing wears in the standings.
function placeColor(place) {
  return place === 1 ? '#e8c040' : place === 2 ? '#b8c0cc' : place === 3 ? '#c08a50' : null;
}

// Cuts to a whole word and marks the cut, so a line never ends mid-syllable
// or runs under whatever sits beside it.
function clip(str, maxChars) {
  const t = String(str);
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, Math.max(1, maxChars - 1));
  const sp = cut.lastIndexOf(' ');
  return (sp > maxChars * 0.5 ? cut.slice(0, sp) : cut) + '…';
}

function wrap(str, maxChars) {
  const out = [];
  let line = '';
  for (const word of String(str).split(/\s+/)) {
    if (!line.length) { line = word; continue; }
    if (line.length + 1 + word.length > maxChars) { out.push(line); line = word; }
    else line += ' ' + word;
  }
  if (line.length) out.push(line);
  return out;
}

// A row of stars for titles held, capped so a long career still fits.
function stars(ctx, n, x, y, color) {
  const shown = Math.min(6, n);
  for (let i = 0; i < shown; i++) drawText(ctx, '★', x + i * 7, y, { color });
  if (n > shown) drawText(ctx, `+${n - shown}`, x + shown * 7 + 1, y, { color });
  return shown * 7 + (n > shown ? 14 : 0);
}

export class CircuitScreen extends Screen {
  constructor(game, opts = {}) {
    super(game);
    this.tab = opts.tab || 0;
    this.index = 0;
    this.scroll = 0;
    this.reading = null;       // a news item opened for reading
    this.readScroll = 0;
    this.confirm = null;       // a pending "enter this event?" prompt
    this.confirmIndex = 1;
    this.notice = '';
    this.noticeT = 0;
    this.t = 0;
  }

  get career() { return this.game.career; }
  get c() { return this.game.state.circuit; }

  onEnter() {
    this.career.join();
    // Coming back from a run: drop straight onto the story that matters.
    if (this.career.pendingPress) this.game.openPress();
  }

  onResume() {
    if (this.career.pendingPress) this.game.openPress();
  }

  // ---- layout -------------------------------------------------------------

  _panel() {
    const { width: W, height: H } = this.game.display;
    return { x: 3, y: CONTENT_Y, w: W - 6, h: H - CONTENT_Y - FOOT_H - 2 };
  }

  // Tabs 1-3 pair a list with a detail card for whatever is highlighted, so
  // the list only gets the height that is left over.
  _detailH() { return this.tab === 0 ? 0 : LINE * 4 + 8; }

  _rowH() { return this.tab === 2 ? LINE : LINE + 2; }

  _rows() {
    const p = this._panel();
    return Math.max(2, Math.floor((p.h - 8 - this._detailH()) / this._rowH()));
  }

  _tabRects() {
    const W = this.game.display.width;
    const tw = Math.floor((W - 6) / TABS.length);
    return TABS.map((t, i) => ({
      ...t, i, x: 3 + i * tw, y: BAND_H, w: i === TABS.length - 1 ? W - 3 - (3 + i * tw) : tw - 1, h: TAB_H,
    }));
  }

  _items() {
    if (this.tab === 1) return TOURNAMENTS.map((t) => ({ t, gate: this.career.gateFor(t) }));
    if (this.tab === 2) return standings(this.c, this.game.state.player.name);
    if (this.tab === 3) return this.c.news;
    return [];
  }

  hint() {
    if (this.confirm) return 'A: choose   B: cancel';
    if (this.reading) return 'A / B: close   ▲▼: scroll';
    if (this.tab === 1) {
      const sel = this._items()[this.index];
      if (sel && this.c.active && this.c.active.id === sel.t.id) return 'A: resume event   ◀▶: tabs   B: back';
      return 'A: enter event   ◀▶: tabs   B: back';
    }
    if (this.tab === 3) return 'A: read story   ◀▶: tabs   B: back';
    return '◀▶: tabs   B: back';
  }

  // ---- input --------------------------------------------------------------

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (this.noticeT > 0) { this.noticeT -= dt; if (this.noticeT <= 0) this.notice = ''; }

    if (this.reading) { this._updateArticle(); return; }
    if (this.confirm) { this._updateConfirm(); return; }

    const items = this._items();
    const rows = this._rows();
    const p = this._panel();
    const rowH = this._rowH();
    const tap = input.consumeTap();

    if (tap) {
      for (const r of this._tabRects()) {
        if (hit(tap, r.x, r.y, r.w, r.h)) { this._setTab(r.i); return; }
      }
      for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
        if (hit(tap, p.x, p.y + 4 + i * rowH, p.w, rowH)) {
          this.index = i + this.scroll; audio.sfx('select'); this._activate(); return;
        }
      }
    }

    if (input.repeated('left')) this._setTab((this.tab - 1 + TABS.length) % TABS.length);
    if (input.repeated('right')) this._setTab((this.tab + 1) % TABS.length);
    if (items.length) {
      if (input.repeated('up')) {
        const m = moveCursor(this.index, items.length, -1, rows, this.scroll);
        this.index = m.index; this.scroll = m.scroll; audio.sfx('cursor');
      }
      if (input.repeated('down')) {
        const m = moveCursor(this.index, items.length, 1, rows, this.scroll);
        this.index = m.index; this.scroll = m.scroll; audio.sfx('cursor');
      }
      if (input.pressed('a')) { audio.sfx('select'); this._activate(); }
    }
    if (input.pressed('b') || input.pressed('start')) { audio.sfx('back'); this.game.screens.pop(); }
  }

  _confirmBox() {
    const { width: W, height: H } = this.game.display;
    const w = Math.min(200, W - 24);
    const h = 62;
    return { x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) - 6, w, h };
  }

  _updateConfirm() {
    const b = this._confirmBox();
    const tap = input.consumeTap();
    const optW = Math.floor((b.w - 20) / 2);
    if (tap) {
      for (let i = 0; i < 2; i++) {
        if (hit(tap, b.x + 7 + i * (optW + 6), b.y + b.h - 20, optW, 14)) {
          this.confirmIndex = i; this._resolveConfirm(); return;
        }
      }
      // A tap anywhere else backs out, which is what a player expects.
      audio.sfx('back'); this.confirm = null; return;
    }
    if (input.repeated('left') || input.repeated('right')) {
      this.confirmIndex = 1 - this.confirmIndex; audio.sfx('cursor');
    }
    if (input.pressed('a')) this._resolveConfirm();
    if (input.pressed('b')) { audio.sfx('back'); this.confirm = null; }
  }

  _resolveConfirm() {
    const t = this.confirm;
    this.confirm = null;
    if (this.confirmIndex !== 0 || !t) { audio.sfx('back'); return; }
    audio.sfx('select');
    this.game.enterTournament(t.id);
  }

  _renderConfirm(ctx, W, H) {
    const t = this.confirm;
    const b = this._confirmBox();
    rect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.5)');
    window9(ctx, b.x, b.y, b.w, b.h);
    const chars = Math.floor((b.w - 14) / 6);
    titleBar(ctx, b.x + 3, b.y + 3, b.w - 6, clip(t.name.toUpperCase(), chars),
      { color: TIER_COLOR[t.tier] || PAL.uiSelect, h: 11 });
    labelDim(ctx, clip(`${t.entrants} entrants · Lv${t.level} · ${t.cp} CP to win`, chars), b.x + 7, b.y + 18);
    labelDim(ctx, clip(`Purse ${money(t.prize)}`, chars), b.x + 7, b.y + 27);
    drawText(ctx, clip('Enter this event?', chars), b.x + 7, b.y + 38, { color: PAL.uiText });

    const optW = Math.floor((b.w - 20) / 2);
    ['ENTER', 'NOT YET'].forEach((txt, i) => {
      const ox = b.x + 7 + i * (optW + 6);
      const oy = b.y + b.h - 20;
      const on = i === this.confirmIndex;
      const col = i === 0 ? PAL.uiSelect : PAL.uiShadow;
      rect(ctx, ox, oy, optW, 14, shade(on ? col : PAL.uiBgAlt, -0.35));
      rect(ctx, ox, oy, optW, 13, on ? col : PAL.uiBgAlt);
      drawTextCentered(ctx, txt, ox + optW / 2, oy + 3, { color: on ? PAL.uiTextLight : PAL.uiText });
    });
  }

  _updateArticle() {
    const lines = this._articleLines();
    const view = this._articleRows();
    if (input.repeated('up')) this.readScroll = Math.max(0, this.readScroll - 1);
    if (input.repeated('down')) this.readScroll = Math.min(Math.max(0, lines.length - view), this.readScroll + 1);
    if (input.pressed('a') || input.pressed('b') || input.consumeTap()) {
      audio.sfx('back'); this.reading = null;
    }
  }

  _setTab(i) {
    if (i === this.tab) return;
    this.tab = i; this.index = 0; this.scroll = 0; this.notice = '';
    audio.sfx('cursor');
  }

  _flash(msg) { this.notice = msg; this.noticeT = 2.2; audio.sfx('deny'); }

  _activate() {
    const it = this._items()[this.index];
    if (!it) return;
    if (this.tab === 1) {
      if (this.c.active && this.c.active.id === it.t.id) { this.game.resumeTournament(); return; }
      if (!it.gate.ok) { this._flash(it.gate.why); return; }
      // Entering is a commitment — withdrawing later costs rating — so it is
      // always confirmed, which also lets a single tap act everywhere else.
      this.confirm = it.t;
      this.confirmIndex = 0;
      return;
    }
    if (this.tab === 3) { this.reading = it; this.readScroll = 0; }
  }

  // ---- render -------------------------------------------------------------

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const tabCol = TABS[this.tab].color;

    // Backdrop: a dim wash in the active tab's colour so each section has its
    // own identity without repainting the whole UI.
    rect(ctx, 0, 0, W, H, shade(tabCol, -0.7));
    for (let y = 0; y < H; y += 6) rect(ctx, 0, y, W, 3, shade(tabCol, -0.64));

    // The BACK chip lives in the band's right end, so the rank caption stops
    // short of it rather than sliding underneath.
    const rank = this.career.rank();
    titleBar(ctx, 0, 0, W, 'WORLD CIRCUIT', { color: shade(tabCol, -0.15), h: BAND_H });
    const rankCap = rank.name.toUpperCase();
    if (W - 58 - rankCap.length * 6 > 90) {
      drawTextRight(ctx, rankCap, W - 56, 3,
        { color: shade(tabCol, 0.55), shadow: shade(tabCol, -0.5) });
    }

    // Tab strip: the active tab is the same cream as the panel and joins it.
    for (const r of this._tabRects()) {
      const on = r.i === this.tab;
      rect(ctx, r.x, r.y, r.w, r.h, on ? PAL.uiBg : shade(r.color, -0.42));
      rect(ctx, r.x, r.y, r.w, 1, on ? r.color : shade(r.color, -0.25));
      if (on) rect(ctx, r.x, r.y + r.h - 1, r.w, 3, PAL.uiBg);
      drawTextCentered(ctx, r.name, r.x + r.w / 2, r.y + 3,
        { color: on ? PAL.uiText : shade(r.color, 0.45) });
    }

    const p = this._panel();
    window9(ctx, p.x, p.y, p.w, p.h, { shadow: false });

    if (this.tab === 0) this._renderCard(ctx, p);
    else if (this.tab === 1) this._renderEvents(ctx, p);
    else if (this.tab === 2) this._renderRanks(ctx, p);
    else this._renderNews(ctx, p);

    if (this.notice) {
      rect(ctx, 0, H - FOOT_H, W, FOOT_H, shade(PAL.uiDanger, -0.25));
      drawTextCentered(ctx, clip(this.notice, Math.floor(W / 6)), W / 2, H - FOOT_H + 2,
        { color: PAL.uiTextLight });
    } else {
      hintBar(ctx, W, H, this.hint());
    }
    drawBackChip(ctx, W - 46, 0);
    if (this.confirm) this._renderConfirm(ctx, W, H);
    if (this.reading) this._renderArticle(ctx, W, H);
  }

  // ---- CARD ---------------------------------------------------------------

  _renderCard(ctx, p) {
    const c = this.c;
    const st = this.game.state;
    const rank = this.career.rank();
    const prog = rankProgress(c);
    const place = standings(c, st.player.name).find((r) => r.isPlayer);
    const chars = Math.floor((p.w - 14) / 6);
    const narrow = p.w < 290;

    // --- identity block: portrait, rank, and progress to the next one -------
    const idH = 46;
    rect(ctx, p.x + 3, p.y + 3, p.w - 6, idH, shade(TABS[0].color, 0.72));
    rect(ctx, p.x + 3, p.y + 3, p.w - 6, 1, shade(TABS[0].color, 0.4));

    // Framed portrait, the way a trainer card carries one.
    const px0 = p.x + 7, py0 = p.y + 7;
    rect(ctx, px0, py0, 22, 26, PAL.uiFrame);
    rect(ctx, px0 + 1, py0 + 1, 20, 24, shade(TABS[0].color, 0.5));
    drawChar(ctx, `card:${st.player.look}`, lookFor(st.player.look), 'down', 0, px0 + 3, py0 + 4);

    const tx = px0 + 28;
    const tw = p.x + p.w - 7 - tx;
    drawText(ctx, rank.name.toUpperCase(), tx, p.y + 8, { color: PAL.uiText });
    if (place) {
      const cap = `WORLD #${place.place}`;
      const pw = cap.length * 6 + 8;
      pill(ctx, cap, p.x + p.w - 7 - pw, p.y + 7,
        { w: pw, color: placeColor(place.place) || PAL.uiSelect });
    }
    labelDim(ctx, clip(`${st.player.name} · ID ${String(st.player.id).padStart(5, '0')}`,
      Math.floor(tw / 6)), tx, p.y + 19);

    // Circuit Points towards the next promotion.
    const cpText = prog.next ? `${c.cp} / ${prog.next.cp}` : `${c.cp} CP`;
    meterBar(ctx, tx, p.y + 31, Math.max(24, tw - cpText.length * 6 - 8), prog.frac, PAL.uiHighlight);
    drawTextRight(ctx, cpText, p.x + p.w - 7, p.y + 29, { color: PAL.uiText });
    labelDim(ctx, clip(prog.next ? `${prog.need} CP to ${prog.next.name}` : 'Top of the ladder.',
      Math.floor(tw / 6)), tx, p.y + 39);

    // --- stat grid ----------------------------------------------------------
    let y = p.y + idH + 7;
    const cols = narrow ? 2 : 4;
    const cw = Math.floor((p.w - 12) / cols);
    const cell = (i, k, v, col) => {
      const cx = p.x + 6 + (i % cols) * cw;
      const cy = y + Math.floor(i / cols) * 20;
      labelDim(ctx, k, cx, cy);
      drawText(ctx, String(v), cx, cy + 9, { color: col || PAL.uiText });
    };
    cell(0, 'RATING', c.rating);
    cell(1, 'PEAK', c.peakRating);
    cell(2, 'RECORD', `${c.wins}-${c.losses}`);
    cell(3, 'STREAK', c.streak > 0 ? `W${c.streak}` : '—',
      c.streak >= 3 ? PAL.hpGreen : PAL.uiText);
    y += Math.ceil(4 / cols) * 20 + 2;

    // --- titles -------------------------------------------------------------
    rule(ctx, p.x + 6, y, p.w - 12);
    y += 5;
    labelDim(ctx, 'TITLES', p.x + 6, y);
    if (c.titles.length) {
      stars(ctx, c.titles.length, p.x + 48, y, PAL.uiHighlight);
      const last = getTournament(c.titles[c.titles.length - 1]);
      if (last && p.w > 250) {
        drawTextRight(ctx, clip(last.short, 16), p.x + p.w - 7, y, { color: PAL.uiTextDim });
      }
    } else {
      labelDim(ctx, 'none yet', p.x + 48, y);
    }
    y += LINE + 2;

    // --- standing with the public and with the field -------------------------
    const half = Math.floor((p.w - 12) / 2);
    labelDim(ctx, 'HYPE', p.x + 6, y);
    meterBar(ctx, p.x + 6, y + 9, half - 8, c.hype / 100, PAL.uiDanger);
    labelDim(ctx, 'RESPECT', p.x + 6 + half, y);
    meterBar(ctx, p.x + 6 + half, y + 9, half - 8, c.respect / 100, PAL.hpGreen);
    y += 20;

    // --- the feed fills whatever room is left --------------------------------
    // A tall portrait screen should not be a card floating in an empty box.
    const feedBottom = p.y + p.h - 22;
    if (c.news.length && y + LINE * 2 < feedBottom) {
      rule(ctx, p.x + 6, y - 4, p.w - 12);
      labelDim(ctx, 'LATEST', p.x + 6, y);
      y += LINE;
      for (const n of c.news) {
        if (y + LINE > feedBottom) break;
        rect(ctx, p.x + 6, y + 2, 2, 5, n.big ? PAL.uiHighlight : outletColor(n.outlet));
        drawText(ctx, clip(n.headline, chars - 3), p.x + 11, y,
          { color: n.big ? PAL.uiText : PAL.uiTextDim });
        y += LINE;
      }
    }

    // --- what to do next ----------------------------------------------------
    const cta = this._nextAction();
    if (cta) {
      const by = p.y + p.h - 17;
      rect(ctx, p.x + 4, by, p.w - 8, 14, shade(cta.color, -0.3));
      rect(ctx, p.x + 4, by, p.w - 8, 13, cta.color);
      rect(ctx, p.x + 5, by + 1, p.w - 10, 1, shade(cta.color, 0.3));
      drawTextCentered(ctx, clip(cta.text, chars), p.x + p.w / 2, by + 3, { color: PAL.uiTextLight });
    }
  }

  /** The single most useful thing the player could do next. */
  _nextAction() {
    const c = this.c;
    if (c.active) {
      const t = getTournament(c.active.id);
      const pro = this.career.opponent();
      return {
        color: PAL.uiSelect,
        text: pro ? `${this.career.roundName()} vs ${pro.name} — EVENTS tab`
          : `${t ? t.short : 'Event'} in progress — EVENTS tab`,
      };
    }
    const open = TOURNAMENTS.filter((t) => this.career.gateFor(t).ok);
    const next = open[open.length - 1];
    if (next) return { color: TIER_COLOR[next.tier] || PAL.uiSelect, text: `Open now: ${next.name}` };
    return null;
  }

  // ---- EVENTS -------------------------------------------------------------

  _renderEvents(ctx, p) {
    const items = this._items();
    const rows = this._rows();
    const rowH = this._rowH();
    const listH = rows * rowH;
    const g = this._gutter();

    for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
      const idx = i + this.scroll;
      const { t } = items[idx];
      const y = p.y + 4 + i * rowH;
      const held = this.c.titles.includes(t.id);
      const locked = rankIndex(this.career.rank().id) < t.requires;
      const live = !!this.c.active && this.c.active.id === t.id;
      const sel = idx === this.index;

      if (sel) rowHighlight(ctx, p.x + 3, y, p.w - 6, rowH, TABS[1].color);
      // Tier stripe: the event's weight, readable before the words are.
      rect(ctx, p.x + 5, y + 2, 3, rowH - 4, locked ? PAL.uiShadow : (TIER_COLOR[t.tier] || PAL.uiFrameLight));

      const nameCol = sel ? PAL.uiTextLight : locked ? PAL.uiShadow : PAL.uiText;
      let nx = p.x + 12;
      if (held) { drawText(ctx, '★', nx, y + 2, { color: sel ? PAL.uiHighlight : '#d8a820' }); nx += 8; }
      drawText(ctx, clip(t.short, Math.floor((p.w - 90) / 6)), nx, y + 2, { color: nameCol });

      if (live) {
        pill(ctx, 'LIVE', p.x + p.w - 34 - g, y + 1, { w: 28, color: PAL.uiHighlight, textColor: PAL.uiText });
      } else if (locked) {
        drawTextRight(ctx, clip(RANKS[t.requires].name, 16), p.x + p.w - 7 - g, y + 2,
          { color: sel ? shade(TABS[1].color, 0.6) : PAL.uiShadow });
      } else {
        drawTextRight(ctx, `Lv${t.level}  ${t.cp}CP`, p.x + p.w - 7 - g, y + 2,
          { color: sel ? PAL.uiTextLight : PAL.uiTextDim });
      }
    }
    this._nubs(ctx, p, items.length, rows, rowH);

    // --- detail card for the highlighted event ------------------------------
    const sel = items[this.index];
    if (!sel) return;
    const dy = p.y + 4 + listH + 2;
    const chars = Math.floor((p.w - 16) / 6);
    titleBar(ctx, p.x + 3, dy, p.w - 6, sel.t.name.toUpperCase().slice(0, chars),
      { color: TIER_COLOR[sel.t.tier] || PAL.uiFrameLight, right: sel.t.tier.toUpperCase(), h: 11 });
    let ty = dy + 14;
    labelDim(ctx, clip(`${sel.t.entrants} entrants · ${sel.t.venue} · purse ${money(sel.t.prize)}`, chars),
      p.x + 7, ty);
    ty += LINE;
    labelDim(ctx, clip(sel.t.blurb, chars), p.x + 7, ty);
    ty += LINE;
    const names = sel.t.field.map((id) => (getPro(id) || {}).name).filter(Boolean).join(', ');
    drawText(ctx, clip(`Field: ${names}`, chars), p.x + 7, ty, { color: PAL.uiText });
  }

  // ---- RANKS --------------------------------------------------------------

  _renderRanks(ctx, p) {
    const items = this._items();
    const rows = this._rows();
    const rowH = this._rowH();
    const wide = p.w > 280;
    const g = this._gutter();

    for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
      const idx = i + this.scroll;
      const r = items[idx];
      const y = p.y + 4 + i * rowH;
      const sel = idx === this.index;

      if (sel) rowHighlight(ctx, p.x + 3, y, p.w - 6, rowH, TABS[2].color);
      else if (r.isPlayer) rect(ctx, p.x + 3, y, p.w - 6, rowH, shade(PAL.uiSelect, 0.72));

      // Medal for the podium, plain number for everyone else.
      const medal = placeColor(r.place);
      if (medal) pill(ctx, String(r.place), p.x + 6, y + 1, { w: 13, color: medal, textColor: PAL.uiFrame });
      else drawTextRight(ctx, String(r.place), p.x + 18, y + 1,
        { color: sel ? shade(TABS[2].color, 0.65) : PAL.uiTextDim });

      const col = sel ? PAL.uiTextLight : r.isPlayer ? PAL.uiSelect : PAL.uiText;
      const nameW = wide ? 15 : Math.floor((p.w - 66 - g) / 6);
      drawText(ctx, clip(r.name, nameW), p.x + 22, y + 1, { color: col });
      if (wide) {
        drawText(ctx, clip(r.tag, 16), p.x + 22 + 92, y + 1,
          { color: sel ? shade(TABS[2].color, 0.6) : PAL.uiTextDim });
        drawTextRight(ctx, `${r.wins}-${r.losses}`, p.x + p.w - 42 - g, y + 1,
          { color: sel ? shade(TABS[2].color, 0.6) : PAL.uiTextDim });
      }
      drawTextRight(ctx, String(r.rating), p.x + p.w - 7 - g, y + 1, { color: col });
    }
    this._nubs(ctx, p, items.length, rows, rowH);

    // --- dossier for the highlighted trainer --------------------------------
    const r = items[this.index];
    if (!r) return;
    const dy = p.y + 4 + rows * rowH + 2;
    const chars = Math.floor((p.w - 16 - 30) / 6);
    const pro = r.isPlayer ? null : getPro(r.id);
    titleBar(ctx, p.x + 3, dy, p.w - 6,
      clip(pro ? `${pro.name} — "${pro.tag}"` : `${r.name} — ${r.tag}`, Math.floor((p.w - 60) / 6)),
      { color: r.isPlayer ? PAL.uiSelect : TABS[2].color, right: `#${r.place}`, h: 11 });
    let ty = dy + 14;
    if (pro) {
      drawChar(ctx, `crc:${pro.look}`, lookFor(pro.look), 'down', 0, p.x + p.w - 28, dy + 12);
      labelDim(ctx, clip(pro.bio, chars), p.x + 7, ty);
      ty += LINE;
      labelDim(ctx, clip(`${pro.region} · ${pro.style} · rating ${r.rating}`, chars), p.x + 7, ty);
      ty += LINE;
      const h = headToHead(this.c, pro.id);
      const played = h.w + h.l;
      drawText(ctx, played
        ? `You lead ${h.w}-${h.l}`.replace('You lead', h.w >= h.l ? 'You lead' : 'They lead')
          .replace(`${h.w}-${h.l}`, h.w >= h.l ? `${h.w}-${h.l}` : `${h.l}-${h.w}`)
        : 'You have never played them.',
      p.x + 7, ty, { color: played ? (h.w >= h.l ? PAL.hpGreen : PAL.uiDanger) : PAL.uiTextDim });
    } else {
      const c = this.c;
      drawChar(ctx, `crc:${this.game.state.player.look}`, lookFor(this.game.state.player.look),
        'down', 0, p.x + p.w - 28, dy + 12);
      labelDim(ctx, clip(`${this.career.rank().blurb}`, chars), p.x + 7, ty);
      ty += LINE;
      labelDim(ctx, clip(`Peak ${c.peakRating} · ${c.cp} CP · ${c.titles.length} titles`, chars), p.x + 7, ty);
      ty += LINE;
      drawText(ctx, `Best run: ${c.bestStreak} straight`, p.x + 7, ty, { color: PAL.uiText });
    }
  }

  // ---- NEWS ---------------------------------------------------------------

  _renderNews(ctx, p) {
    const items = this._items();
    if (!items.length) {
      const chars = Math.floor((p.w - 16) / 6);
      labelDim(ctx, clip('No stories yet.', chars), p.x + 8, p.y + 10);
      labelDim(ctx, clip('Enter an event and the press will', chars), p.x + 8, p.y + 10 + LINE);
      labelDim(ctx, clip('find you soon enough.', chars), p.x + 8, p.y + 10 + LINE * 2);
      return;
    }
    const rows = this._rows();
    const rowH = this._rowH();
    const maxChars = Math.floor((p.w - 24 - this._gutter()) / 6);

    for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
      const idx = i + this.scroll;
      const n = items[idx];
      const y = p.y + 4 + i * rowH;
      const sel = idx === this.index;
      if (sel) rowHighlight(ctx, p.x + 3, y, p.w - 6, rowH, TABS[3].color);
      // Outlet stripe, plus a gold edge for the stories that mattered.
      rect(ctx, p.x + 5, y + 2, 3, rowH - 4, n.big ? PAL.uiHighlight : outletColor(n.outlet));
      drawText(ctx, clip(n.headline, maxChars), p.x + 12, y + 2,
        { color: sel ? PAL.uiTextLight : n.big ? PAL.uiText : PAL.uiTextDim });
    }
    this._nubs(ctx, p, items.length, rows, rowH);

    const sel = items[this.index];
    if (!sel) return;
    const dy = p.y + 4 + rows * rowH + 2;
    const chars = Math.floor((p.w - 16) / 6);
    titleBar(ctx, p.x + 3, dy, p.w - 6, sel.outlet.toUpperCase(),
      { color: outletColor(sel.outlet), right: `WEEK ${sel.week}`, h: 11 });
    let ty = dy + 14;
    for (const line of wrap(sel.body[0] || '', chars).slice(0, 2)) {
      labelDim(ctx, line, p.x + 7, ty); ty += LINE;
    }
    drawText(ctx, 'A: read the full story', p.x + 7, dy + 14 + LINE * 2, { color: TABS[3].color });
  }

  // ---- article overlay ----------------------------------------------------

  _articleBox() {
    const { width: W, height: H } = this.game.display;
    return { x: 5, y: 6, w: W - 10, h: H - 18 };
  }

  _articleRows() {
    const b = this._articleBox();
    return Math.max(2, Math.floor((b.h - 34) / 9));
  }

  _articleLines() {
    const n = this.reading;
    if (!n) return [];
    const b = this._articleBox();
    const chars = Math.floor((b.w - 18) / 6);
    const out = [];
    for (const para of n.body) {
      for (const line of wrap(para, chars)) out.push(line);
      out.push('');
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out;
  }

  _renderArticle(ctx, W, H) {
    const n = this.reading;
    const b = this._articleBox();
    rect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.55)');
    window9(ctx, b.x, b.y, b.w, b.h);

    const chars = Math.floor((b.w - 18) / 6);
    titleBar(ctx, b.x + 3, b.y + 3, b.w - 6, clip(n.outlet.toUpperCase(), chars),
      { color: outletColor(n.outlet), right: `WEEK ${n.week}`, h: 11 });

    let y = b.y + 18;
    for (const line of wrap(n.headline, chars).slice(0, 2)) {
      drawText(ctx, line, b.x + 8, y, { color: PAL.uiText }); y += LINE;
    }
    rule(ctx, b.x + 7, y + 1, b.w - 14);
    y += 5;

    const lines = this._articleLines();
    const view = this._articleRows();
    for (let i = 0; i < view && i + this.readScroll < lines.length; i++) {
      labelDim(ctx, lines[i + this.readScroll], b.x + 8, y + i * 9);
    }
    if (this.readScroll > 0) drawText(ctx, '▲', b.x + b.w - 12, y - 1, { color: PAL.uiTextDim });
    if (this.readScroll + view < lines.length) {
      drawText(ctx, '▼', b.x + b.w - 12, b.y + b.h - 12, { color: PAL.uiTextDim });
    }
  }

  /**
   * Tells the player there is more list than window. Rows reserve `_gutter()`
   * on their right for these, so a nub never lands on top of a rating.
   */
  _nubs(ctx, p, count, rows, rowH) {
    if (count <= rows) return;
    if (this.scroll > 0) drawText(ctx, '▲', p.x + p.w - 11, p.y + 1, { color: PAL.uiTextDim });
    if (this.scroll + rows < count) {
      drawText(ctx, '▼', p.x + p.w - 11, p.y + 3 + rows * rowH - 8, { color: PAL.uiTextDim });
    }
  }

  _gutter() { return this._items().length > this._rows() ? 9 : 0; }
}

// ===========================================================================

/**
 * A live tournament run. Shows the bracket you are climbing, who is across the
 * floor, and the one button that matters. Stays on the stack across every
 * battle in the event so the bracket is never lost mid-run.
 */
export class TournamentScreen extends Screen {
  constructor(game) {
    super(game);
    this.index = 0;
    this.busy = false;
    this.summary = null;
    this.t = 0;
  }

  get career() { return this.game.career; }
  get c() { return this.game.state.circuit; }

  onResume() {
    this.busy = false;
    // The battle screen records its result *after* it pops, so the run's state
    // is checked in update() rather than here; all this does is patch the team
    // up when there is another round to play.
    if (this.c.active && !this.c.active.done) this.career.healBetweenRounds();
  }

  _settle() {
    this.summary = this.career.settle();
    audio.sfx(this.summary && this.summary.won ? 'levelup' : 'back');
  }

  get options() {
    if (this.summary) return [{ k: 'close', text: 'CONTINUE' }];
    return [{ k: 'fight', text: 'TAKE THE FLOOR' }, { k: 'quit', text: 'WITHDRAW' }];
  }

  hint() {
    if (this.summary) return 'A: continue';
    return 'A: choose   ▲▼: move';
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (!this.summary) {
      // A run that has just ended settles the moment this screen is on top
      // again, whichever way it ended.
      if (!this.c.active) { this.game.screens.pop(); return; }
      if (this.c.active.done) this._settle();
    }
    if (this.busy) return;

    const opts = this.options;
    const box = this._btnBox();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < opts.length; i++) {
        if (hit(tap, box.x, box.y + i * 16, box.w, 14)) {
          this.index = i; audio.sfx('select'); this._pick(opts[i].k); return;
        }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + opts.length) % opts.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % opts.length; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._pick(opts[this.index].k); }
    if (input.pressed('b') && this.summary) this._pick('close');
  }

  _pick(k) {
    if (k === 'fight') {
      this.busy = true;
      const started = this.career.startRound(() => { this.busy = false; });
      if (!started) { this.busy = false; this.game.screens.pop(); }
      return;
    }
    if (k === 'quit') {
      this.career.withdraw();
      this.game.screens.pop();
      return;
    }
    this.game.screens.pop();
    if (this.career.pendingPress) this.game.openPress();
  }

  _btnBox() {
    const { width: W, height: H } = this.game.display;
    const w = Math.min(120, W - 16);
    return { x: W - w - 6, y: H - FOOT_H - 4 - (this.summary ? 14 : 30), w };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const c = this.c;
    const t = c.active ? getTournament(c.active.id) : (this.summary && this.summary.tournament);
    const accent = t ? (TIER_COLOR[t.tier] || PAL.uiSelect) : PAL.uiSelect;

    rect(ctx, 0, 0, W, H, shade(accent, -0.72));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade(accent, -0.66));
    if (!t) return;

    titleBar(ctx, 0, 0, W, t.name.toUpperCase(), {
      color: shade(accent, -0.1), right: `${t.tier.toUpperCase()} · Lv${t.level}`, h: BAND_H,
    });

    const p = { x: 3, y: BAND_H + 2, w: W - 6, h: H - BAND_H - FOOT_H - 4 };
    window9(ctx, p.x, p.y, p.w, p.h, { shadow: false });

    if (this.summary) { this._renderSummary(ctx, p, W, H); return; }
    this._renderBracket(ctx, p, t, accent);
    hintBar(ctx, W, H, this.hint());
  }

  _renderBracket(ctx, p, t, accent) {
    const c = this.c;
    const run = c.active;
    const box = this._btnBox();
    const chars = Math.floor((p.w - 16) / 6);

    // --- the ladder, drawn as a bracket you climb ---------------------------
    labelDim(ctx, 'YOUR PATH TO THE TITLE', p.x + 7, p.y + 5);
    let y = p.y + 5 + LINE;
    const nameChars = Math.max(8, Math.floor((p.w - 70) / 6));
    run.ladder.forEach((id, i) => {
      const pro = getPro(id);
      if (!pro) return;
      const past = i < run.round;
      const now = i === run.round;
      const rn = roundName(t.entrants, i);
      // Rung: a connector line, a state mark, the round and the opponent.
      if (i > 0) rect(ctx, p.x + 10, y - 3, 1, 3, PAL.uiBgAlt);
      if (now) rowHighlight(ctx, p.x + 4, y - 2, p.w - 8, LINE + 3, accent);
      const col = now ? PAL.uiTextLight : past ? PAL.hpGreen : PAL.uiShadow;
      drawText(ctx, now ? '▶' : past ? '✓' : '·', p.x + 8, y, { color: col });
      drawText(ctx, clip(`${rn}: ${pro.name}`, nameChars), p.x + 17, y, { color: col });
      drawTextRight(ctx, String(c.pros[id].rating), p.x + p.w - 8, y,
        { color: now ? shade(accent, 0.6) : PAL.uiTextDim });
      y += LINE + 4;
    });

    // --- the opponent card ---------------------------------------------------
    const pro = this.career.opponent();
    if (!pro) return;
    y += 2;
    const cardH = Math.min(52, box.y - y - 4);
    if (cardH < 24) return;
    rect(ctx, p.x + 4, y, p.w - 8, cardH, shade(accent, 0.76));
    rect(ctx, p.x + 4, y, p.w - 8, 1, shade(accent, 0.45));

    rect(ctx, p.x + 8, y + 4, 22, 26, PAL.uiFrame);
    rect(ctx, p.x + 9, y + 5, 20, 24, shade(accent, 0.56));
    drawChar(ctx, `trn:${pro.look}`, lookFor(pro.look), 'down', 0, p.x + 11, y + 8);

    const tx = p.x + 34;
    const twChars = Math.max(8, Math.floor((p.w - 46) / 6));
    drawText(ctx, clip(pro.name, twChars), tx, y + 5, { color: PAL.uiText });
    labelDim(ctx, clip(`"${pro.tag}" · ${pro.region} · ${pro.style}`, twChars), tx, y + 15);
    const h = headToHead(c, pro.id);
    const record = h.w + h.l
      ? `Head to head ${h.w}-${h.l}`
      : 'First meeting';
    drawText(ctx, clip(record, twChars), tx, y + 25,
      { color: h.w + h.l === 0 ? PAL.uiTextDim : h.w >= h.l ? PAL.hpGreen : PAL.uiDanger });
    if (cardH >= 44) {
      labelDim(ctx, clip(`You: ${c.rating}   Them: ${c.pros[pro.id].rating}`, twChars), tx, y + 35);
    }
    y += cardH + 6;

    // --- what is at stake, and who else is still in ---------------------------
    // A tall screen has room for the rest of the story; a short one does not,
    // and each block only draws if it fits above the buttons.
    if (y + LINE * 2 < box.y - 4) {
      rule(ctx, p.x + 7, y - 3, p.w - 14);
      labelDim(ctx, 'ON THE LINE', p.x + 7, y);
      drawTextRight(ctx, clip(`${t.cp} CP  ·  ${money(t.prize)}`, chars), p.x + p.w - 8, y,
        { color: PAL.uiText });
      y += LINE + 4;
    }
    const others = run.others.filter((id) => !run.ladder.includes(id));
    if (others.length && y + LINE * 2 < box.y - 4) {
      labelDim(ctx, 'ELSEWHERE IN THE DRAW', p.x + 7, y);
      y += LINE;
      for (const id of others) {
        if (y + LINE > box.y - 4) break;
        const other = getPro(id);
        if (!other) continue;
        drawText(ctx, clip(other.name, nameChars), p.x + 17, y, { color: PAL.uiTextDim });
        drawTextRight(ctx, String(c.pros[id].rating), p.x + p.w - 8, y, { color: PAL.uiShadow });
        y += LINE;
      }
    }

    this._renderButtons(ctx);
  }

  _renderButtons(ctx) {
    const box = this._btnBox();
    this.options.forEach((o, i) => {
      const by = box.y + i * 16;
      const on = i === this.index;
      const col = o.k === 'quit' ? PAL.uiShadow : PAL.uiSelect;
      rect(ctx, box.x, by, box.w, 14, shade(on ? col : PAL.uiBgAlt, -0.35));
      rect(ctx, box.x, by, box.w, 13, on ? col : PAL.uiBgAlt);
      rect(ctx, box.x + 1, by + 1, box.w - 2, 1, shade(on ? col : PAL.uiBgAlt, 0.3));
      if (on) cursor(ctx, box.x + 3, by + 3, { color: PAL.uiTextLight });
      drawTextCentered(ctx, o.text, box.x + box.w / 2 + (on ? 4 : 0), by + 3,
        { color: on ? PAL.uiTextLight : PAL.uiText });
    });
  }

  _renderSummary(ctx, p, W, H) {
    const s = this.summary;
    const won = s.won;
    const accent = won ? PAL.uiHighlight : PAL.uiDanger;

    // A result banner with a little movement, so a title feels like one.
    const pulse = won ? Math.sin(this.t * 4) * 0.5 + 0.5 : 0;
    let y = p.y + 8;
    rect(ctx, p.x + 4, y - 2, p.w - 8, 20, shade(accent, -0.05 - pulse * 0.12));
    drawTextCentered(ctx, won ? 'CHAMPION' : 'ELIMINATED', p.x + p.w / 2, y + 1,
      { color: won ? PAL.uiFrame : PAL.uiTextLight, scale: 2 });
    y += 24;

    const chars = Math.floor((p.w - 16) / 6);
    drawTextCentered(ctx, clip(won
      ? `${this.game.state.player.name} wins the ${s.tournament.short}.`
      : `Out at the ${roundName(s.tournament.entrants, s.roundsSurvived)} stage.`, chars),
    p.x + p.w / 2, y, { color: PAL.uiText });
    y += LINE + 4;

    // The payout, as a scoreboard rather than a sentence.
    const half = Math.floor((p.w - 16) / 2);
    const stat = (i, k, v, col) => {
      const cx = p.x + 8 + (i % 2) * half;
      const cy = y + Math.floor(i / 2) * 20;
      labelDim(ctx, k, cx, cy);
      drawText(ctx, String(v), cx, cy + 9, { color: col || PAL.uiText });
    };
    stat(0, 'CIRCUIT POINTS', `+${s.points}`, PAL.uiHighlight);
    stat(1, 'PRIZE MONEY', money(s.prize), PAL.hpGreen);
    stat(2, 'RATING', `${this.c.rating}`);
    stat(3, 'RECORD', `${this.c.wins}-${this.c.losses}`);
    y += 42;

    if (s.rankedUp) {
      rect(ctx, p.x + 4, y, p.w - 8, 13, PAL.uiSelect);
      drawTextCentered(ctx, clip(`PROMOTED — ${s.newRank.name.toUpperCase()}`, chars),
        p.x + p.w / 2, y + 3, { color: PAL.uiTextLight });
    }

    this._renderButtons(ctx);
    hintBar(ctx, W, H, this.hint());
  }
}

// ===========================================================================

/**
 * The post-event press conference. Built to read like the game's own dialogue
 * boxes — a speaker tag, a text box, and a choice window — because that is the
 * grammar the player already knows.
 */
export class PressScreen extends Screen {
  constructor(game, press) {
    super(game);
    this.press = press;
    this.index = 0;
    this.answer = null;
    this.t = 0;
    this.shown = 0;
  }

  get _text() {
    return this.answer ? this.answer.line : this.press.question;
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    this.shown += dt * 90;

    if (this.answer) {
      if (this.t > 0.35 && (input.pressed('a') || input.pressed('b') || input.consumeTap())) {
        audio.sfx('back'); this.game.screens.pop();
      }
      return;
    }
    const opts = this.press.options;
    const box = this._box();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < opts.length; i++) {
        if (hit(tap, box.x, box.y + i * (LINE + 4), box.w, LINE + 3)) { this.index = i; this._answer(i); return; }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + opts.length) % opts.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % opts.length; audio.sfx('cursor'); }
    if (input.pressed('a')) this._answer(this.index);
  }

  _answer(i) {
    audio.sfx('select');
    this.answer = this.game.career.answerPress(i);
    this.t = 0;
    this.shown = 0;
  }

  _boxY() {
    const H = this.game.display.height;
    return H - 46;
  }

  _box() {
    const { width: W } = this.game.display;
    const longest = this.press.options.reduce((a, o) => Math.max(a, o.text.length), 0);
    const w = Math.min(W - 12, longest * 6 + 74);
    return { x: W - w - 6, y: this._boxY() - this.press.options.length * (LINE + 4) - 7, w };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    // A press room: dark, with camera flashes going off.
    rect(ctx, 0, 0, W, H, '#1a1f2e');
    for (let i = 0; i < 9; i++) {
      const on = ((this.t * 2.4 + i * 0.31) % 1) < 0.1;
      if (!on) continue;
      const fx = 8 + ((i * 41) % Math.max(1, W - 20));
      const fy = 16 + (i % 4) * 9;
      rect(ctx, fx, fy, 4, 4, PAL.white);
      rect(ctx, fx - 2, fy + 1, 8, 2, shade(PAL.white, -0.3));
      rect(ctx, fx + 1, fy - 2, 2, 8, shade(PAL.white, -0.3));
    }
    const boxTop = this._boxY();
    // A step-and-repeat sponsor backdrop, a floor, and a podium in front of it.
    const wallY = BAND_H;
    const floorY = Math.max(wallY + 24, boxTop - 26);
    rect(ctx, 0, wallY, W, floorY - wallY, '#243049');
    for (let row = 0; row * 16 < floorY - wallY - 6; row++) {
      const ry = wallY + 5 + row * 16;
      if (ry + 8 > floorY - 2) break;
      for (let x = 3 + (row % 2 ? 20 : 0); x < W; x += 40) {
        rect(ctx, x, ry, 30, 8, shade('#243049', row % 2 ? 0.1 : 0.16));
        rect(ctx, x + 3, ry + 2, 24, 1, shade('#243049', 0.26));
        rect(ctx, x + 3, ry + 5, 16, 1, shade('#243049', 0.22));
      }
    }
    rect(ctx, 0, floorY - 2, W, 2, shade('#243049', -0.35));
    rect(ctx, 0, floorY, W, boxTop - floorY, '#1b2436');

    titleBar(ctx, 0, 0, W, 'PRESS CONFERENCE', { color: '#c85a3a', h: BAND_H });

    // The player, at the podium, mics in front of them. Kept to the left third
    // so the answer window never covers the person answering.
    const st = this.game.state;
    const cx = Math.round(W * 0.26);
    const deskY = floorY + 6;
    drawChar(ctx, `press:${st.player.look}`, lookFor(st.player.look), 'down', 0, cx - 8, deskY - 26);
    rect(ctx, cx - 22, deskY - 8, 44, 12, '#3c2a1e');
    rect(ctx, cx - 22, deskY - 8, 44, 2, '#5a4030');
    rect(ctx, cx - 18, deskY - 5, 36, 1, shade('#3c2a1e', -0.4));
    for (const mx of [cx - 8, cx + 4]) {
      rect(ctx, mx, deskY - 15, 1, 8, '#8890a8');
      rect(ctx, mx - 2, deskY - 18, 5, 4, '#8890a8');
    }

    // The text box, in the game's own dialogue chrome.
    const boxY = this._boxY();
    const h = H - boxY - 4;
    window9(ctx, 4, boxY, W - 8, h);
    const speaker = this.answer ? st.player.name : 'THE PRESS';
    const sw = speaker.length * 6 + 10;
    window9(ctx, 8, boxY - 11, sw, 13, { bg: this.answer ? PAL.uiSelect : PAL.uiHighlight });
    label(ctx, speaker, 13, boxY - 8, { color: this.answer ? PAL.uiTextLight : PAL.uiText });

    const chars = Math.floor((W - 24) / 6);
    const lines = wrap(this._text, chars).slice(0, Math.max(1, Math.floor((h - 12) / LINE)));
    let remaining = Math.floor(this.shown);
    lines.forEach((line, i) => {
      const n = Math.max(0, Math.min(line.length, remaining));
      remaining -= line.length + 1;
      if (n > 0) label(ctx, line, 12, boxY + 6 + i * LINE, { limit: n });
    });

    if (this.answer) {
      const c = this.game.state.circuit;
      drawTextRight(ctx, `HYPE ${c.hype}  ·  RESPECT ${c.respect}`, W - 12, boxY + h - 12,
        { color: PAL.uiSelect });
      if (this.t > 0.35) {
        const bob = Math.floor(this.t * 5) % 2;
        drawText(ctx, '▼', W - 16, boxY + h - 11 + bob, { color: PAL.uiText });
      }
      hintBar(ctx, W, H, 'A: done');
      return;
    }

    // The answers, as a choice window with what each one costs you.
    const box = this._box();
    const bh = this.press.options.length * (LINE + 4) + 8;
    window9(ctx, box.x, box.y - 4, box.w, bh);
    this.press.options.forEach((o, i) => {
      const by = box.y + i * (LINE + 4);
      const on = i === this.index;
      if (on) rowHighlight(ctx, box.x + 3, by - 1, box.w - 6, LINE + 3, PAL.uiSelect);
      drawText(ctx, o.text, box.x + 8, by + 1, { color: on ? PAL.uiTextLight : PAL.uiText });
      const tone = o.respect >= 4 ? PAL.hpGreen : o.hype >= 9 ? PAL.uiDanger : PAL.uiTextDim;
      drawTextRight(ctx, `H+${o.hype} R${o.respect >= 0 ? '+' : ''}${o.respect}`,
        box.x + box.w - 7, by + 1, { color: on ? shade(PAL.uiSelect, 0.65) : tone });
    });
    hintBar(ctx, W, H, 'A: answer   ▲▼: choose');
  }
}
