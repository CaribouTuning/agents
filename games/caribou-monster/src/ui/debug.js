// Developer menu.
//
// Off by default and reachable only from OPTIONS, so it never gets in a
// player's way — but everything needed to test a system without playing to it
// is here. Flip `game.debugEnabled` to false to hide it entirely.
import { Screen } from './screen.js';
import { drawBackChip } from './controls.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, moveCursor, drawTextRight, drawText, money, LINE,
} from './kit.js';
import { SPECIES_LIST } from '../data/species.js';
import { ITEM_IDS, getItem } from '../data/items.js';
import { MAP_IDS, getMap } from '../data/maps/index.js';
import { TRAINERS } from '../data/trainers.js';
import { FLAGS } from '../game/storyflags.js';
import { runCommand, playableChapters, COMMANDS } from '../game/testmode.js';
import {
  debugGive, debugGiveItem, healParty, awardBadge, setStoryFlag, formatPlayTime,
} from '../game/state.js';
import { createMonster, healFully } from '../game/monster.js';
import { net } from '../net/NetworkManager.js';
import { currentHour, currentPhase, phaseLabel, forceHour, shiftHours } from '../game/clock.js';
import { simulateSeasonWeek } from '../game/circuit/circuit.js';
import { reportSeasonWeek, reportPowerRankings } from '../game/circuit/news.js';

// One off-screen week of pro results, plus the table it changes.
function simulateWeek(game) {
  const c = game.state.circuit;
  reportSeasonWeek(c, simulateSeasonWeek(c), game.state.player.name);
  reportPowerRankings(c, game.state.player.name);
}

// One tap walks the clock to the middle of the next phase, which is all a
// tester ever wants from it.
const NEXT_HOUR = { morning: 13, day: 22, night: 7 };

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

export class DebugScreen extends Screen {
  constructor(game) {
    super(game);
    this.page = 'main';
    this.index = 0;
    this.scroll = 0;
    this.message = '';
    this.level = 5;
  }

  get rows() {
    const st = this.game.state;
    switch (this.page) {
      case 'main': return [
        { t: 'Console (/commands)...', a: () => this._console() },
        { t: 'Jump to a chapter...', a: () => { this.page = 'chapters'; this.index = 0; this.scroll = 0; } },
        { t: 'Heal party', a: () => { healParty(st); this._msg('Party healed.'); audio.sfx('heal'); } },
        { t: 'Give monster...', a: () => { this.page = 'species'; this.index = 0; this.scroll = 0; } },
        { t: 'Give item...', a: () => { this.page = 'items'; this.index = 0; this.scroll = 0; } },
        { t: 'Teleport...', a: () => { this.page = 'maps'; this.index = 0; this.scroll = 0; } },
        { t: 'Trigger battle...', a: () => { this.page = 'trainers'; this.index = 0; this.scroll = 0; } },
        { t: 'Story flags...', a: () => { this.page = 'flags'; this.index = 0; this.scroll = 0; } },
        { t: `Give ${money(10000)}`, a: () => { st.inventory.money = Math.min(999999, st.inventory.money + 10000); this._msg('Money added.'); } },
        { t: 'Award next badge', a: () => { const n = st.badges.length + 1; awardBadge(st, n, `Badge ${n}`); this._msg(`Badge ${n} awarded.`); audio.sfx('badge'); } },
        { t: `Level +5 (party)`, a: () => { for (const m of st.party) { m.level = Math.min(100, m.level + 5); healFully(m); } this._msg('Party levelled.'); } },
        { t: `Time of day: ${phaseLabel()}`, right: `${String(currentHour()).padStart(2, '0')}:00`,
          a: () => { forceHour(NEXT_HOUR[currentPhase()]); this._msg(`It is now ${phaseLabel()}.`); } },
        // Berries take hours on the real clock, so the only way to look at
        // one growing is to move the clock the berries read.
        { t: 'Skip 6 hours (berries)',
          a: () => { shiftHours(6); this._msg('Six hours later. Go and look at the soil.'); } },
        { t: 'Circuit...', a: () => { this.page = 'circuit'; this.index = 0; this.scroll = 0; } },
        { t: 'Network state...', a: () => { this.page = 'net'; this.index = 0; } },
        { t: 'Reset save', a: () => { this.page = 'reset'; this.index = 1; } },
        { t: 'Close', a: () => this.game.screens.pop() },
      ];
      // Jumping to a point in the story. This is the one that makes the back
      // half of the game testable at all: it sets every beat up to the one
      // picked, levels the party to match, hands over the HMs, and puts the
      // player where the beat happens.
      // Whatever the last console line printed. Rows rather than a text blob
      // so the existing scrolling works on a long list of flags or maps.
      case 'output': return String(this.output || '').split('\n').map((line) => ({
        t: line, a: () => this._console(),
      })).concat([
        { t: '> type another', a: () => this._console() },
        { t: 'Back', a: () => { this.page = 'main'; this.index = 0; this.scroll = 0; } },
      ]);
      case 'chapters': return playableChapters().map((b) => ({
        t: b.text,
        right: b.flag,
        a: () => { const r = runCommand(this.game, `/chapter ${b.flag}`); this._msg(r.text.split('\n')[0]); audio.sfx('badge'); },
      })).concat([{ t: 'Back', a: () => { this.page = 'main'; this.index = 0; this.scroll = 0; } }]);
      case 'species': return SPECIES_LIST.map((sp) => ({
        t: `${String(sp.id).padStart(3, '0')} ${sp.name}`,
        right: sp.types.join('/'),
        a: () => { debugGive(st, sp.id, this.level); this._msg(`${sp.name} Lv${this.level} added.`); audio.sfx('caught'); },
      }));
      case 'items': return ITEM_IDS.map((id) => ({
        t: getItem(id).name,
        right: getItem(id).pocket,
        a: () => { debugGiveItem(st, id, 5); this._msg(`${getItem(id).name} x5 added.`); audio.sfx('buy'); },
      }));
      case 'maps': return MAP_IDS.map((id) => ({
        t: getMap(id).name,
        right: id,
        a: () => { this.game.teleport(id); this._msg(`Warped to ${id}.`); },
      }));
      case 'trainers': return Object.values(TRAINERS).map((t) => ({
        t: t.name, right: t.cls,
        a: () => { this.game.screens.pop(); this.game.startTrainerBattle(t, () => {}); },
      }));
      case 'flags': return Object.values(FLAGS).map((f) => ({
        t: f, right: st.flags[f] ? 'ON' : 'off',
        a: () => { setStoryFlag(st, f, !st.flags[f]); this._msg(`${f} = ${st.flags[f]}`); },
      }));
      // Reaching the World Circuit legitimately means walking to Oreburgh and
      // grinding a ladder. These skip to any point on it.
      case 'circuit': {
        const c = st.circuit;
        const g = this.game;
        return [
          { t: 'Register on the circuit', right: c.joined ? 'joined' : 'no',
            a: () => { g.career.join(); this._msg('Registered.'); audio.sfx('badge'); } },
          { t: 'Open circuit hub', a: () => { g.screens.pop(); g.openCircuit(); } },
          { t: 'Give 500 Circuit Points', right: `${c.cp} CP`,
            a: () => { c.cp += 500; c.rank = g.career.rank().id; this._msg(`${c.cp} CP — ${g.career.rank().name}.`); } },
          { t: 'Rating +50', right: `${c.rating}`,
            a: () => { c.rating += 50; c.peakRating = Math.max(c.peakRating, c.rating); this._msg(`Rating ${c.rating}.`); } },
          { t: 'Simulate a season week', right: `week ${c.week}`,
            a: () => { c.week++; simulateWeek(g); this._msg(`Week ${c.week} played.`); } },
          { t: 'Abandon active run', right: c.active ? c.active.id : 'none',
            a: () => { g.career.withdraw(); this._msg('Run abandoned.'); } },
          { t: 'Back', a: () => { this.page = 'main'; this.index = 0; this.scroll = 0; } },
        ];
      }
      case 'net': {
        const s = net.snapshot();
        return [
          { t: `Transport: ${s.transport}`, a: () => {} },
          { t: `Connected: ${s.connected}`, a: () => {} },
          { t: `Room: ${s.code || '(none)'}`, a: () => {} },
          { t: `Host: ${s.isHost}`, a: () => {} },
          { t: `Self peer: ${(s.selfPeer || '-').slice(0, 14)}`, a: () => {} },
          { t: `Partner: ${s.partner ? s.partner.name : '(none)'}`, a: () => {} },
          { t: 'Force reconnect', a: async () => { this._msg('Reconnecting...'); const k = await net.reconnect(); this._msg(`Transport: ${k}`); } },
          { t: 'Force disconnect', a: () => { net.leaveRoom(); this._msg('Left room.'); } },
          { t: 'Back', a: () => { this.page = 'main'; this.index = 0; } },
        ];
      }
      case 'reset': return [
        { t: 'ERASE SAVE AND RESTART', a: async () => { await this.game.save.erase(); location.reload(); } },
        { t: 'Cancel', a: () => { this.page = 'main'; this.index = 0; } },
      ];
      default: return [];
    }
  }

  _msg(m) { this.message = m; if (this.game.save) this.game.save.markDirty(); }

  update(dt, isTop) {
    if (!isTop) return;
    const rows = this.rows;
    const visible = Math.floor((this.game.display.height - 40) / LINE);
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < Math.min(visible, rows.length - this.scroll); i++) {
        if (hit(tap, 6, 24 + i * LINE, this.game.display.width - 12, LINE)) {
          this.index = this.scroll + i; audio.sfx('select'); rows[this.index].a(); return;
        }
      }
    }
    if (input.repeated('up')) { const r = moveCursor(this.index, rows.length, -1, visible, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
    if (input.repeated('down')) { const r = moveCursor(this.index, rows.length, 1, visible, this.scroll); this.index = r.index; this.scroll = r.scroll; audio.sfx('cursor'); }
    if (this.page === 'species') {
      if (input.repeated('left')) { this.level = Math.max(1, this.level - 5); audio.sfx('cursor'); }
      if (input.repeated('right')) { this.level = Math.min(100, this.level + 5); audio.sfx('cursor'); }
    }
    if (input.pressed('a')) { audio.sfx('select'); rows[this.index]?.a(); }
    if (input.pressed('b')) {
      audio.sfx('back');
      if (this.page === 'main') this.game.screens.pop();
      else { this.page = 'main'; this.index = 0; this.scroll = 0; }
    }
  }

  /**
   * The text console. Typing is the only interface that can express
   * "/warp snowpoint" without a menu of every map in the game, and the
   * on-screen keyboard means it works on a phone.
   */
  _console() {
    const g = this.game;
    const hint = COMMANDS.length ? `/help lists ${COMMANDS.length} commands` : '';
    g.openTextEntry(hint || 'Command', 28, (line) => {
      if (!line) return;
      const r = runCommand(g, line);
      this.output = r.text;
      this.page = 'output';
      this.index = 0; this.scroll = 0;
      audio.sfx(r.ok ? 'select' : 'deny');
    });
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade('#20283a', 0.02));
    window9(ctx, 2, 2, W - 4, H - 4, { bg: '#f0f4f8' });
    label(ctx, `DEBUG — ${this.page}`, 8, 6, { color: PAL.uiDanger });
    if (this.page === 'species') drawTextRight(ctx, `Lv ${this.level}  (< >)`, W - 8, 6, { color: PAL.uiTextDim });
    else drawTextRight(ctx, `${formatPlayTime(this.game.state.playTimeMs)}  ${this.game.loop ? this.game.loop.fps : 0}fps`, W - 8, 6, { color: PAL.uiTextDim });
    rect(ctx, 8, 16, W - 16, 1, PAL.uiBgAlt);

    const rows = this.rows;
    const visible = Math.floor((H - 40) / LINE);
    rows.slice(this.scroll, this.scroll + visible).forEach((r, i) => {
      const idx = this.scroll + i;
      const y = 24 + i * LINE;
      if (idx === this.index) cursor(ctx, 6, y);
      label(ctx, r.t, 14, y);
      if (r.right) drawTextRight(ctx, r.right, W - 10, y, { color: PAL.uiTextDim });
    });
    drawBackChip(ctx, W - 52, 2);
    if (this.message) {
      rect(ctx, 4, H - 14, W - 8, 12, PAL.uiBgAlt);
      drawText(ctx, this.message, 8, H - 12, { color: PAL.uiText });
    }
    void labelDim; void createMonster;
  }
}
