// The World Circuit hub — the side story's home screen.
//
// Four tabs over one career: your rank card, the events you can enter, the
// world ranking, and the press feed. The tournament run itself lives in
// TournamentScreen below, which is what actually starts the battles.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, drawText, drawTextCentered, drawTextRight,
  moveCursor, money, LINE,
} from './kit.js';
import { drawBackChip } from './controls.js';
import { drawChar, lookFor } from '../render/sprites.js';
import { TOURNAMENTS, RANKS, getPro, getTournament, rankIndex } from '../data/circuit.js';
import { standings, rankProgress, headToHead, roundName } from '../game/circuit/circuit.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;
const TABS = ['CAREER', 'EVENTS', 'RANKS', 'NEWS'];
const HEADER_H = 26;

function meter(ctx, x, y, w, frac, color) {
  rect(ctx, x, y, w, 4, shade(PAL.uiFrame, 0.35));
  rect(ctx, x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, frac)))), 2, color);
}

export class CircuitScreen extends Screen {
  constructor(game, opts = {}) {
    super(game);
    this.tab = opts.tab || 0;
    this.index = 0;
    this.scroll = 0;
    this.reading = null;      // a news item opened for reading
    this.notice = '';
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

  // Tabs 1-3 pair a list with a detail panel for whatever is highlighted, so
  // the list only gets the height that is left over.
  _detailH() { return this.tab === 0 ? 0 : LINE * 4 + 6; }

  _rows() {
    const box = this._listBox();
    return Math.max(2, Math.floor((box.h - 10 - this._detailH()) / LINE));
  }

  _listBox() {
    const { width: W, height: H } = this.game.display;
    return { x: 4, y: HEADER_H, w: W - 8, h: H - HEADER_H - 14 };
  }

  _tabRects() {
    const W = this.game.display.width;
    const tw = Math.floor((W - 8) / TABS.length);
    return TABS.map((name, i) => ({ name, i, x: 4 + i * tw, y: 4, w: tw - 2, h: 13 }));
  }

  _items() {
    if (this.tab === 1) {
      return TOURNAMENTS.map((t) => ({ t, gate: this.career.gateFor(t) }));
    }
    if (this.tab === 2) return standings(this.c, this.game.state.player.name);
    if (this.tab === 3) return this.c.news;
    return [];
  }

  // ---- input --------------------------------------------------------------

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (this.reading) {
      if (input.pressed('a') || input.pressed('b') || input.consumeTap()) {
        audio.sfx('back'); this.reading = null;
      }
      return;
    }

    const items = this._items();
    const rows = this._rows();
    const box = this._listBox();
    const tap = input.consumeTap();

    if (tap) {
      for (const r of this._tabRects()) {
        if (hit(tap, r.x, r.y, r.w, r.h)) { this._setTab(r.i); return; }
      }
      for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
        if (hit(tap, box.x, box.y + 4 + i * LINE, box.w, LINE)) {
          this.index = i + this.scroll; audio.sfx('select'); this._activate(); return;
        }
      }
    }

    if (input.repeated('left')) { this._setTab((this.tab - 1 + TABS.length) % TABS.length); }
    if (input.repeated('right')) { this._setTab((this.tab + 1) % TABS.length); }
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

  _setTab(i) {
    if (i === this.tab) return;
    this.tab = i; this.index = 0; this.scroll = 0; this.notice = '';
    audio.sfx('cursor');
  }

  _activate() {
    const items = this._items();
    const it = items[this.index];
    if (!it) return;
    if (this.tab === 1) {
      if (this.c.active && this.c.active.id === it.t.id) { this.game.resumeTournament(); return; }
      if (!it.gate.ok) { this.notice = it.gate.why; audio.sfx('deny'); return; }
      this.game.enterTournament(it.t.id);
      return;
    }
    if (this.tab === 3) { this.reading = it; return; }
  }

  // ---- render -------------------------------------------------------------

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade(PAL.uiSelect, -0.62));
    for (let y = 0; y < H; y += 6) rect(ctx, 0, y, W, 3, shade(PAL.uiSelect, -0.58));

    // Tab bar.
    for (const r of this._tabRects()) {
      const on = r.i === this.tab;
      rect(ctx, r.x, r.y, r.w, r.h, on ? PAL.uiBg : shade(PAL.uiFrame, -0.05));
      rect(ctx, r.x, r.y, r.w, 1, on ? PAL.uiHighlight : shade(PAL.uiFrame, 0.2));
      drawTextCentered(ctx, r.name, r.x + r.w / 2, r.y + 3,
        { color: on ? PAL.uiText : PAL.uiTextLight });
    }

    if (this.tab === 0) this._renderCareer(ctx, W, H);
    else if (this.tab === 1) this._renderEvents(ctx, W, H);
    else if (this.tab === 2) this._renderRanks(ctx, W, H);
    else this._renderNews(ctx, W, H);

    if (this.notice) {
      rect(ctx, 0, H - 12, W, 12, shade(PAL.uiDanger, -0.35));
      drawTextCentered(ctx, this.notice, W / 2, H - 10, { color: PAL.uiTextLight });
    }
    drawBackChip(ctx, W - 46, H - 14);
    if (this.reading) this._renderArticle(ctx, W, H);
  }

  _renderCareer(ctx, W, H) {
    const c = this.c;
    const st = this.game.state;
    const box = this._listBox();
    window9(ctx, box.x, box.y, box.w, box.h);
    const rank = this.career.rank();
    const prog = rankProgress(c);
    const place = standings(c, st.player.name).find((r) => r.isPlayer);

    const chars = Math.floor((box.w - 16) / 6);
    let y = box.y + 6;
    drawText(ctx, rank.name.toUpperCase(), box.x + 7, y, { color: PAL.uiText });
    drawTextRight(ctx, `WORLD #${place ? place.place : '-'}`, box.x + box.w - 8, y,
      { color: PAL.uiSelect });
    y += 11;
    labelDim(ctx, clip(rank.blurb, chars), box.x + 7, y);
    y += 12;

    // Points towards the next promotion. The meter stops short of the figure
    // so the two never collide on a narrow screen.
    const cpText = prog.next ? `${c.cp}/${prog.next.cp} CP` : `${c.cp} CP`;
    const cpW = cpText.length * 6 + 10;
    meter(ctx, box.x + 7, y + 2, Math.max(20, box.w - 15 - cpW), prog.frac, PAL.uiHighlight);
    drawTextRight(ctx, cpText, box.x + box.w - 8, y - 1, { color: PAL.uiTextDim });
    y += 12;
    if (prog.next) {
      labelDim(ctx, `${prog.need} points to ${prog.next.name}.`, box.x + 7, y);
      y += 11;
    }

    // Two columns of short pairs. Values stay terse so a narrow portrait
    // screen never runs a figure into the label beside it.
    const half = Math.floor(box.w / 2);
    const col2 = box.x + half + 4;
    const stat = (lx, ly, k, v, col) => {
      labelDim(ctx, k, lx, ly);
      drawTextRight(ctx, String(v), lx + half - 14, ly, { color: col || PAL.uiText });
    };
    stat(box.x + 7, y, 'RATING', `${c.rating}`);
    stat(col2, y, 'PEAK', `${c.peakRating}`);
    y += LINE;
    stat(box.x + 7, y, 'RECORD', `${c.wins}-${c.losses}`);
    stat(col2, y, 'STREAK', `${c.streak}`);
    y += LINE;
    stat(box.x + 7, y, 'TITLES', `${c.titles.length}`, c.titles.length ? PAL.uiHighlight : PAL.uiText);
    stat(col2, y, 'BEST RUN', `${c.bestStreak}`);
    y += LINE;
    stat(box.x + 7, y, 'MONEY', money(st.inventory.money));
    y += LINE + 2;

    labelDim(ctx, 'HYPE', box.x + 7, y);
    meter(ctx, box.x + 34, y + 2, 52, c.hype / 100, PAL.uiDanger);
    labelDim(ctx, 'RESPECT', col2, y);
    meter(ctx, col2 + 44, y + 2, 52, c.respect / 100, PAL.hpGreen);
    y += LINE + 2;

    const bottom = box.y + box.h - (c.active ? 20 : 6);
    const room = (n) => y + n * LINE <= bottom;
    if (c.titles.length && room(2)) {
      labelDim(ctx, 'HELD TITLES', box.x + 7, y);
      y += LINE;
      for (const id of c.titles.slice(0, 3)) {
        if (!room(1)) break;
        const t = getTournament(id);
        if (t) { drawText(ctx, clip(`★ ${t.name}`, chars), box.x + 9, y, { color: PAL.uiHighlight }); y += LINE; }
      }
      y += 2;
    }
    // Whatever vertical room is left goes to the feed — a tall portrait screen
    // should not be a card floating in an empty box.
    if (c.news.length && room(2)) {
      labelDim(ctx, 'LATEST', box.x + 7, y);
      y += LINE;
      for (const n of c.news) {
        if (!room(1)) break;
        drawText(ctx, clip(n.headline, chars - 2), box.x + 9, y,
          { color: n.big ? PAL.uiSelect : PAL.uiTextDim });
        y += LINE;
      }
    }
    if (c.active) {
      const t = getTournament(c.active.id);
      rect(ctx, box.x + 5, box.y + box.h - 15, box.w - 10, 12, PAL.uiSelect);
      drawTextCentered(ctx, `IN PROGRESS: ${t ? t.short : ''}`, box.x + box.w / 2, box.y + box.h - 13,
        { color: PAL.uiTextLight });
    }
    void W; void H;
  }

  // Tells the player there is more list than window.
  _nubs(ctx, box, count, rows) {
    if (this.scroll > 0) drawText(ctx, '▲', box.x + box.w - 11, box.y + 2, { color: PAL.uiTextDim });
    if (this.scroll + rows < count) {
      drawText(ctx, '▼', box.x + box.w - 11, box.y + rows * LINE - 4, { color: PAL.uiTextDim });
    }
  }

  _renderEvents(ctx, W, H) {
    const box = this._listBox();
    window9(ctx, box.x, box.y, box.w, box.h);
    const items = this._items();
    const rows = this._rows();
    for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
      const idx = i + this.scroll;
      const { t, gate } = items[idx];
      const y = box.y + 4 + i * LINE;
      const held = this.c.titles.includes(t.id);
      // Rank-locked and "you are mid-event" are different states and must not
      // look the same: one is a wall, the other is a door you left open.
      const locked = rankIndex(this.career.rank().id) < t.requires;
      const live = !!this.c.active && this.c.active.id === t.id;
      if (idx === this.index) cursor(ctx, box.x + 4, y);
      drawText(ctx, t.short, box.x + 12, y,
        { color: locked ? PAL.uiShadow : held ? PAL.uiHighlight : PAL.uiText });
      const right = live ? 'IN PROGRESS'
        : locked ? RANKS[t.requires].name
          : `Lv${t.level} · ${t.cp}CP`;
      drawTextRight(ctx, right, box.x + box.w - 8, y,
        { color: live ? PAL.uiSelect : locked ? PAL.uiShadow : PAL.uiTextDim });
      void gate;
    }
    this._nubs(ctx, box, items.length, rows);
    // Detail panel for the highlighted event.
    const sel = items[this.index];
    if (sel) {
      const dy = box.y + rows * LINE + 8;
      rect(ctx, box.x + 5, dy - 3, box.w - 10, 1, PAL.uiBgAlt);
      const chars = Math.floor((box.w - 16) / 6);
      labelDim(ctx, clip(`${sel.t.tier} · ${sel.t.entrants} entrants · ${sel.t.venue}`, chars), box.x + 7, dy);
      labelDim(ctx, clip(sel.t.blurb, chars), box.x + 7, dy + LINE);
      drawText(ctx, `Purse ${money(sel.t.prize)}`, box.x + 7, dy + LINE * 2, { color: PAL.uiText });
      const names = sel.t.field.map((id) => (getPro(id) || {}).name).filter(Boolean).join(', ');
      labelDim(ctx, clip(names, chars), box.x + 7, dy + LINE * 3);
    }
    void W; void H;
  }

  _renderRanks(ctx, W, H) {
    const box = this._listBox();
    window9(ctx, box.x, box.y, box.w, box.h);
    const items = this._items();
    const rows = this._rows();
    const wide = box.w > 250;
    for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
      const idx = i + this.scroll;
      const r = items[idx];
      const y = box.y + 4 + i * LINE;
      if (idx === this.index) cursor(ctx, box.x + 4, y);
      const col = r.isPlayer ? PAL.uiSelect : PAL.uiText;
      drawText(ctx, `${String(r.place).padStart(2, ' ')}`, box.x + 12, y, { color: PAL.uiTextDim });
      drawText(ctx, r.name, box.x + 26, y, { color: col });
      if (wide) {
        drawText(ctx, r.tag, box.x + 26 + 84, y, { color: PAL.uiTextDim });
        drawTextRight(ctx, `${r.wins}-${r.losses}`, box.x + box.w - 46, y, { color: PAL.uiTextDim });
      }
      drawTextRight(ctx, String(r.rating), box.x + box.w - 8, y, { color: col });
    }
    this._nubs(ctx, box, items.length, rows);
    const sel = items[this.index];
    if (sel && !sel.isPlayer) {
      const pro = getPro(sel.id);
      const dy = box.y + rows * LINE + 8;
      rect(ctx, box.x + 5, dy - 3, box.w - 10, 1, PAL.uiBgAlt);
      if (pro) {
        // The portrait sits in the right-hand 34px, so the prose stops short.
        const chars = Math.floor((box.w - 48) / 6);
        drawText(ctx, clip(`${pro.name} — "${pro.tag}"`, chars), box.x + 7, dy, { color: PAL.uiText });
        labelDim(ctx, clip(pro.bio, chars), box.x + 7, dy + LINE);
        const h = headToHead(this.c, pro.id);
        labelDim(ctx, clip(`${pro.region} · ${pro.style} · head to head ${h.w}-${h.l}`, chars),
          box.x + 7, dy + LINE * 2);
        drawChar(ctx, `crc:${pro.look}`, lookFor(pro.look), 'down', 0, box.x + box.w - 26, dy - 2);
      }
    }
    void W; void H;
  }

  _renderNews(ctx, W, H) {
    const box = this._listBox();
    window9(ctx, box.x, box.y, box.w, box.h);
    const items = this._items();
    if (!items.length) {
      labelDim(ctx, 'No stories yet. Enter an event and', box.x + 8, box.y + 8);
      labelDim(ctx, 'the press will find you.', box.x + 8, box.y + 8 + LINE);
      void W; void H;
      return;
    }
    const rows = this._rows();
    const maxChars = Math.floor((box.w - 22) / 6);
    for (let i = 0; i < rows && i + this.scroll < items.length; i++) {
      const idx = i + this.scroll;
      const n = items[idx];
      const y = box.y + 4 + i * LINE;
      if (idx === this.index) cursor(ctx, box.x + 4, y);
      const col = n.big ? PAL.uiSelect : PAL.uiText;
      drawText(ctx, clip(n.headline, maxChars), box.x + 12, y, { color: col });
    }
    this._nubs(ctx, box, items.length, rows);
    const sel = items[this.index];
    if (sel) {
      const dy = box.y + rows * LINE + 8;
      rect(ctx, box.x + 5, dy - 3, box.w - 10, 1, PAL.uiBgAlt);
      labelDim(ctx, `${sel.outlet} · week ${sel.week}`, box.x + 7, dy);
      labelDim(ctx, 'A: read the full story', box.x + 7, dy + LINE);
    }
    void W; void H;
  }

  _renderArticle(ctx, W, H) {
    const n = this.reading;
    rect(ctx, 0, 0, W, H, 'rgba(0,0,0,0.5)');
    const bx = 8, by = 12, bw = W - 16, bh = H - 28;
    window9(ctx, bx, by, bw, bh);
    const maxChars = Math.floor((bw - 16) / 6);
    rect(ctx, bx + 5, by + 4, bw - 10, 9, PAL.uiFrame);
    drawText(ctx, clip(n.outlet.toUpperCase(), maxChars), bx + 8, by + 5, { color: PAL.uiTextLight });
    let y = by + 17;
    for (const line of wrap(n.headline, maxChars)) {
      drawText(ctx, line, bx + 8, y, { color: PAL.uiText }); y += LINE;
    }
    y += 2;
    rect(ctx, bx + 6, y, bw - 12, 1, PAL.uiBgAlt);
    y += 4;
    for (const para of n.body) {
      for (const line of wrap(para, maxChars)) {
        if (y > by + bh - 14) break;
        labelDim(ctx, line, bx + 8, y); y += 9;
      }
      y += 3;
    }
    drawTextCentered(ctx, 'A / B: close', W / 2, H - 13, { color: PAL.uiTextLight });
  }
}

// Cuts to a whole word and marks the cut, so a bio never ends mid-syllable
// or runs under the portrait beside it.
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

// ===========================================================================

/**
 * A live tournament run. Shows the ladder, who is next, and the one button
 * that matters. Stays on the stack across every battle in the event so the
 * bracket is never lost mid-run.
 */
export class TournamentScreen extends Screen {
  constructor(game) {
    super(game);
    this.index = 0;
    this.busy = false;
    this.summary = null;
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

  update(dt, isTop) {
    if (!isTop) return;
    // A run that has just ended settles the moment this screen is on top
    // again, whichever way it ended.
    if (!this.summary) {
      if (!this.c.active) { this.game.screens.pop(); return; }
      if (this.c.active.done) this._settle();
    }
    if (this.busy) return;
    const opts = this.options;
    const box = this._btnBox();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < opts.length; i++) {
        if (hit(tap, box.x, box.y + i * 15, box.w, 13)) {
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
    return { x: W - 108, y: H - 42, w: 100 };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    const c = this.c;
    const t = c.active ? getTournament(c.active.id) : (this.summary && this.summary.tournament);
    rect(ctx, 0, 0, W, H, shade(PAL.uiFrame, -0.4));
    for (let y = 0; y < H; y += 10) rect(ctx, 0, y, W, 5, shade(PAL.uiFrame, -0.32));
    if (!t) return;

    window9(ctx, 4, 4, W - 8, H - 8);
    drawText(ctx, t.name.toUpperCase(), 11, 9, { color: PAL.uiText });
    drawTextRight(ctx, `${t.tier} · Lv${t.level}`, W - 12, 9, { color: PAL.uiTextDim });
    rect(ctx, 11, 19, W - 22, 1, PAL.uiBgAlt);

    if (this.summary) { this._renderSummary(ctx, W, H); return; }

    const run = c.active;
    // The ladder is name on the left, rating hard right; the name is clipped
    // to whatever is left so the two columns can never overlap.
    const ratingX = W - 12;
    const nameChars = Math.max(8, Math.floor((W - 12 - 21 - 30) / 6));
    let y = 25;
    labelDim(ctx, 'YOUR PATH', 11, y);
    y += LINE;
    run.ladder.forEach((id, i) => {
      const pro = getPro(id);
      if (!pro) return;
      const past = i < run.round;
      const now = i === run.round;
      const rn = roundName(t.entrants, i);
      const col = past ? PAL.hpGreen : now ? PAL.uiText : PAL.uiShadow;
      drawText(ctx, now ? '▶' : past ? '✓' : '·', 11, y, { color: col });
      drawText(ctx, clip(`${rn}: ${pro.name}`, nameChars), 21, y, { color: col });
      drawTextRight(ctx, String(c.pros[id].rating), ratingX, y, { color: PAL.uiTextDim });
      y += LINE;
    });

    const pro = this.career.opponent();
    if (pro) {
      y += 4;
      rect(ctx, 11, y, W - 22, 1, PAL.uiBgAlt);
      y += 5;
      // The opponent's portrait sits beside their card, not over the ladder.
      drawChar(ctx, `trn:${pro.look}`, lookFor(pro.look), 'down', 0, W - 40, y - 2);
      const chars = Math.max(10, Math.floor((W - 22 - 34) / 6));
      drawText(ctx, clip(`NEXT: ${pro.name}`, chars), 11, y, { color: PAL.uiSelect });
      y += LINE;
      labelDim(ctx, clip(`"${pro.tag}" · ${pro.region} · ${pro.style}`, chars), 11, y);
      y += LINE;
      const h = headToHead(c, pro.id);
      labelDim(ctx, clip(`Head to head ${h.w}-${h.l}`, chars), 11, y);
      y += LINE;
      labelDim(ctx, clip(`Your rating ${c.rating}`, chars), 11, y);
      y += LINE;
      labelDim(ctx, clip(`Career ${c.wins}-${c.losses}`, chars), 11, y);
      y += LINE + 4;
    }

    // The rest of the draw, when the screen is tall enough to carry it. Real
    // entrants with real ratings — this is who the player is not facing yet.
    const box = this._btnBox();
    const others = run.others.filter((id) => !run.ladder.includes(id));
    if (others.length && y + LINE * 2 < box.y - 6) {
      labelDim(ctx, 'ELSEWHERE IN THE DRAW', 11, y);
      y += LINE;
      for (const id of others) {
        if (y + LINE > box.y - 6) break;
        const p = getPro(id);
        if (!p) continue;
        drawText(ctx, clip(`${p.name}`, nameChars), 21, y, { color: PAL.uiShadow });
        drawTextRight(ctx, String(c.pros[id].rating), ratingX, y, { color: PAL.uiShadow });
        y += LINE;
      }
    }

    this.options.forEach((o, i) => {
      const by = box.y + i * 15;
      const on = i === this.index;
      rect(ctx, box.x, by, box.w, 13, on ? PAL.uiSelect : PAL.uiBgAlt);
      drawTextCentered(ctx, o.text, box.x + box.w / 2, by + 3,
        { color: on ? PAL.uiTextLight : PAL.uiText });
    });
  }

  _renderSummary(ctx, W, H) {
    const s = this.summary;
    let y = 26;
    drawTextCentered(ctx, s.won ? 'CHAMPION' : 'ELIMINATED', W / 2, y,
      { color: s.won ? PAL.uiHighlight : PAL.uiDanger, scale: 2 });
    y += 20;
    drawTextCentered(ctx, s.won
      ? `${this.game.state.player.name} wins the ${s.tournament.short}.`
      : `Out at the ${roundName(s.tournament.entrants, s.roundsSurvived)} stage.`,
    W / 2, y, { color: PAL.uiText });
    y += 14;
    drawTextCentered(ctx, `+${s.points} Circuit Points   ${money(s.prize)}`, W / 2, y,
      { color: PAL.uiTextDim });
    y += 12;
    if (s.rankedUp) {
      drawTextCentered(ctx, `PROMOTED — ${s.newRank.name}`, W / 2, y, { color: PAL.uiSelect });
      y += 12;
    }
    drawTextCentered(ctx, `Rating ${this.c.rating}   Record ${this.c.wins}-${this.c.losses}`,
      W / 2, y, { color: PAL.uiTextDim });

    const box = this._btnBox();
    rect(ctx, box.x, box.y, box.w, 13, PAL.uiSelect);
    drawTextCentered(ctx, 'CONTINUE', box.x + box.w / 2, box.y + 3, { color: PAL.uiTextLight });
    void H;
  }
}

// ===========================================================================

/** The post-event press conference. One question, three ways to answer it. */
export class PressScreen extends Screen {
  constructor(game, press) {
    super(game);
    this.press = press;
    this.index = 0;
    this.answer = null;
    this.t = 0;
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (this.answer) {
      if (this.t > 0.4 && (input.pressed('a') || input.pressed('b') || input.consumeTap())) {
        audio.sfx('back'); this.game.screens.pop();
      }
      return;
    }
    const opts = this.press.options;
    const box = this._box();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < opts.length; i++) {
        if (hit(tap, box.x, box.y + i * 15, box.w, 13)) { this.index = i; this._answer(i); return; }
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
  }

  _box() {
    const { width: W, height: H } = this.game.display;
    const w = Math.min(240, W - 24);
    return { x: Math.round((W - w) / 2), y: H - 62, w };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade(PAL.uiFrame, -0.5));
    // Camera flashes.
    for (let i = 0; i < 6; i++) {
      const on = ((this.t * 3 + i * 0.37) % 1) < 0.14;
      if (!on) continue;
      const fx = 12 + ((i * 53) % Math.max(1, W - 24));
      rect(ctx, fx, 6 + (i % 3) * 7, 3, 3, PAL.white);
    }
    window9(ctx, 6, 6, W - 12, H - 12);
    drawText(ctx, 'PRESS CONFERENCE', 13, 11, { color: PAL.uiText });
    rect(ctx, 13, 21, W - 26, 1, PAL.uiBgAlt);

    const maxChars = Math.floor((W - 30) / 6);
    let y = 27;
    for (const line of wrap(this.press.question, maxChars)) {
      labelDim(ctx, line, 13, y); y += LINE;
    }

    const box = this._box();
    if (this.answer) {
      y += 4;
      for (const line of wrap(this.answer.line, maxChars)) {
        drawText(ctx, line, 13, y, { color: PAL.uiText }); y += LINE;
      }
      y += 4;
      const c = this.game.state.circuit;
      drawText(ctx, `Hype ${c.hype}   Respect ${c.respect}`, 13, y, { color: PAL.uiSelect });
      drawTextCentered(ctx, 'A: done', W / 2, H - 16, { color: PAL.uiTextDim });
      return;
    }
    this.press.options.forEach((o, i) => {
      const by = box.y + i * 15;
      const on = i === this.index;
      rect(ctx, box.x, by, box.w, 13, on ? PAL.uiSelect : PAL.uiBgAlt);
      drawText(ctx, o.text, box.x + 6, by + 3, { color: on ? PAL.uiTextLight : PAL.uiText });
      drawTextRight(ctx, `HYPE ${o.hype >= 0 ? '+' : ''}${o.hype}`, box.x + box.w - 6, by + 3,
        { color: on ? PAL.uiTextLight : PAL.uiTextDim });
    });
  }
}
