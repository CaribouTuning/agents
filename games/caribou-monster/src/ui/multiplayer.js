// The LINK screen: create or join a room, see who is connected, and read an
// honest account of what the current transport can and cannot do.
import { Screen } from './screen.js';
import { MAPS } from '../data/maps/index.js';
import { TILES } from '../render/tiles.js';
import { drawBackChip } from './controls.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL, shade } from '../render/palette.js';
import {
  window9, rect, label, labelDim, cursor, drawTextCentered, drawTextRight, drawText, LINE,
} from './kit.js';
import { net } from '../net/NetworkManager.js';
import { normaliseRoomCode } from '../net/protocol.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;
const KEYS = ['BCDFGH', 'JKLMNP', 'QRSTVW', 'XYZ234', '56789 '];

export class MultiplayerScreen extends Screen {
  constructor(game) {
    super(game);
    this.mode = 'menu';        // menu | joining | info
    this.index = 0;
    this.entry = '';
    this.kx = 0; this.ky = 0;
    this.t = 0;
    this.snap = net.snapshot();
    this.unsub = null;
    this.notice = '';
  }

  onEnter() {
    this.unsub = net.subscribeToState((s) => { this.snap = s; });
  }

  onExit() { if (this.unsub) this.unsub(); }

  get options() {
    const out = [];
    if (this.snap.code) {
      out.push({ k: 'leave', text: 'LEAVE ROOM' });
    } else {
      out.push({ k: 'create', text: 'CREATE ROOM' });
      out.push({ k: 'join', text: 'JOIN ROOM' });
    }
    if (this.snap.partner) {
      // The first thing two linked players want, and the thing that was
      // missing: they each start in their own house, so the link comes up
      // with the two of them on different maps and nothing on screen to say
      // so or to do about it.
      if (!this._together()) out.push({ k: 'goto', text: 'GO TO PARTNER' });
      out.push({ k: 'battle', text: 'BATTLE PARTNER' });
      out.push({ k: 'trade', text: 'TRADE' });
    }
    if (this.snap.transport === 'offline') out.push({ k: 'retry', text: 'RETRY CONNECTION' });
    out.push({ k: 'info', text: 'HOW IT WORKS' });
    out.push({ k: 'back', text: 'BACK' });
    return out;
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    if (this.mode === 'joining') { this._updateJoin(); return; }
    if (this.mode === 'info') {
      if (input.pressed('a') || input.pressed('b') || input.consumeTap()) { audio.sfx('back'); this.mode = 'menu'; }
      return;
    }

    const opts = this.options;
    this.index = Math.min(this.index, opts.length - 1);
    const box = this._menuBox();
    const tap = input.consumeTap();
    if (tap) {
      for (let i = 0; i < opts.length; i++) {
        if (hit(tap, box.x, box.y + 5 + i * LINE, box.w, LINE)) { this.index = i; audio.sfx('select'); this._pick(opts[i].k); return; }
      }
    }
    if (input.repeated('up')) { this.index = (this.index - 1 + opts.length) % opts.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.index = (this.index + 1) % opts.length; audio.sfx('cursor'); }
    if (input.pressed('a')) { audio.sfx('select'); this._pick(opts[this.index].k); }
    if (input.pressed('b')) { audio.sfx('back'); this.game.screens.pop(); }
  }

  async _pick(k) {
    switch (k) {
      case 'create': {
        const r = net.createRoom();
        if (!r.ok) { audio.sfx('deny'); this.notice = 'No connection available.'; break; }
        audio.sfx('join');
        // A same-device fallback reaches other TABS and nothing else. Saying
        // so here, rather than only on the info page, is the difference
        // between "they are joining" and an hour of two people staring at a
        // light that says everything is fine.
        this.notice = net.crossDevice
          ? 'Room created. Send the code to your partner.'
          : 'Same-device link only — another PHONE cannot join this code.';
        break;
      }
      case 'join':
        this.mode = 'joining';
        this.entry = '';
        break;
      case 'leave':
        net.leaveRoom();
        this.notice = 'You left the room.';
        audio.sfx('leave');
        break;
      case 'goto': this._goToPartner(); break;
      case 'battle':
        this.game.screens.pop();
        this.game.requestPvp();
        break;
      case 'trade':
        this.game.screens.pop();
        this.game.requestTrade();
        break;
      case 'retry': {
        this.notice = 'Reconnecting...';
        const kind = await net.reconnect();
        this.notice = kind === 'offline' ? 'Still offline.' : 'Connected.';
        break;
      }
      case 'info': this.mode = 'info'; break;
      default: this.game.screens.pop();
    }
  }

  /** True when the two of you are already standing in the same place. */
  _together() {
    const pr = this.snap.partner && this.snap.partner.presence;
    return !!(pr && pr.map === this.game.state.player.map);
  }

  /**
   * Walk over to wherever they are.
   *
   * Only to somewhere you have already been: a link is not a way past a door
   * the story has not opened for you, and being dropped into the middle of
   * an act you have not reached would ruin the game for the person behind.
   * When you have not been there, it says so, which is the cue for the other
   * one to come to you instead.
   */
  _goToPartner() {
    const pr = this.snap.partner && this.snap.partner.presence;
    if (!pr || !pr.map || !MAPS[pr.map]) { audio.sfx('deny'); this.notice = 'They are not anywhere you can reach.'; return; }
    if (pr.busy && pr.busy !== 'free') {
      audio.sfx('deny');
      this.notice = `${this.snap.partner.name} is in the middle of something.`;
      return;
    }
    const st = this.game.state;
    const known = !!(st.visited && st.visited[pr.map]) || pr.map === st.player.map;
    if (!known) {
      audio.sfx('deny');
      this.notice = `You have not been to ${MAPS[pr.map].name} yet. Ask them to come to you.`;
      return;
    }
    // Land beside them rather than on them, and never inside scenery.
    const map = MAPS[pr.map];
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
      const def = TILES[map.tiles[y][x]];
      return !def || def.solid;
    };
    let spot = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (!solid(pr.x + dx, pr.y + dy)) { spot = { x: pr.x + dx, y: pr.y + dy }; break; }
    }
    audio.sfx('warp');
    this.game.screens.pop();
    this.game.teleport(pr.map, spot ? spot.x : null, spot ? spot.y : null);
  }

  _updateJoin() {
    const g = this._keyGrid();
    const tap = input.consumeTap();
    if (tap) {
      for (const c of g.cells) if (hit(tap, c.x, c.y, c.w, c.h)) { this._type(c.ch); return; }
      if (hit(tap, g.okX, g.okY, 52, 14)) { this._submit(); return; }
      if (hit(tap, g.delX, g.delY, 52, 14)) { this._del(); return; }
    }
    if (input.repeated('left')) { this.kx = (this.kx - 1 + 6) % 6; audio.sfx('cursor'); }
    if (input.repeated('right')) { this.kx = (this.kx + 1) % 6; audio.sfx('cursor'); }
    if (input.repeated('up')) { this.ky = (this.ky - 1 + KEYS.length) % KEYS.length; audio.sfx('cursor'); }
    if (input.repeated('down')) { this.ky = (this.ky + 1) % KEYS.length; audio.sfx('cursor'); }
    if (input.pressed('a')) this._type(KEYS[this.ky][this.kx]);
    if (input.pressed('b')) this._del();
    if (input.pressed('start')) this._submit();
  }

  _type(ch) {
    if (!ch || ch === ' ') return;
    if (this.entry.length >= 6) { audio.sfx('deny'); return; }
    this.entry += ch;
    audio.sfx('select');
    if (this.entry.length === 6) this._submit();
  }

  _del() {
    if (!this.entry.length) { this.mode = 'menu'; audio.sfx('back'); return; }
    this.entry = this.entry.slice(0, -1);
    audio.sfx('back');
  }

  _submit() {
    const code = normaliseRoomCode(this.entry);
    const r = net.joinRoom(code);
    if (!r.ok) {
      audio.sfx('deny');
      this.notice = r.reason === 'badcode' ? 'That code is not six characters.' : 'No connection available.';
      return;
    }
    audio.sfx('join');
    this.notice = net.crossDevice
      ? `Joined ${code}. Waiting for your partner...`
      : `Same-device link only — you will not reach another phone.`;
    this.mode = 'menu';
    this.index = 0;
  }

  _menuBox() {
    const { width: W } = this.game.display;
    return { x: W - 116, y: 44, w: 110 };
  }

  _keyGrid() {
    const { width: W, height: H } = this.game.display;
    const cw = 22, ch = 15;
    const gx = W / 2 - (cw * 6) / 2;
    const gy = 52;
    const cells = [];
    KEYS.forEach((row, r) => {
      for (let c = 0; c < 6; c++) {
        if (row[c] === ' ') continue;
        cells.push({ ch: row[c], x: gx + c * cw, y: gy + r * ch, w: cw - 2, h: ch - 2, r, c });
      }
    });
    return { cells, gx, gy, cw, ch, okX: W / 2 + 4, okY: gy + KEYS.length * ch + 3, delX: W / 2 - 56, delY: gy + KEYS.length * ch + 3, H };
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, shade('#3f9060', -0.55));
    for (let y = 0; y < H; y += 8) rect(ctx, 0, y, W, 4, shade('#3f9060', -0.5));

    if (this.mode === 'info') { this._renderInfo(ctx, W, H); return; }
    if (this.mode === 'joining') { this._renderJoin(ctx, W, H); return; }

    // Status panel.
    window9(ctx, 4, 4, W - 124, H - 8);
    label(ctx, 'LINK', 10, 8);
    rect(ctx, 10, 17, W - 138, 1, PAL.uiBgAlt);

    const s = this.snap;
    const transportLabel = s.transport === 'online' ? 'Online (device to device)'
      : s.transport === 'local' ? 'Local (other tabs on this device)'
        : 'Offline (single player)';
    const dotCol = s.transport === 'offline' ? PAL.uiDanger : (s.connected ? PAL.hpGreen : PAL.uiHighlight);
    drawText(ctx, '●', 10, 22, { color: dotCol });
    const word = s.transport === 'offline' ? 'OFFLINE'
      : !s.connected ? 'CONNECTING'
        : s.transport === 'online' ? 'ONLINE' : 'LOCAL LINK';
    label(ctx, word, 20, 22);
    labelDim(ctx, transportLabel, 10, 33);
    if (s.transport === 'local') {
      drawTextRight(ctx, 'THIS DEVICE ONLY', W - 6, 33, { color: PAL.uiDanger });
    }

    if (s.code) {
      window9(ctx, 10, 46, W - 144, 30, { bg: PAL.uiBgAlt });
      labelDim(ctx, 'ROOM CODE', 16, 49);
      drawText(ctx, s.code, 16, 60, { color: PAL.uiText, scale: 2 });
      labelDim(ctx, s.isHost ? 'You made this room' : 'You joined this room', 10, 80);
    } else {
      labelDim(ctx, 'Not in a room yet.', 10, 50);
    }

    const py = s.code ? 92 : 64;
    // Everything on the left has the menu beside it, so it gets clipped to
    // the gap rather than written across it. At 256 logical pixels that gap
    // is about twenty characters, and a sentence that ignores it comes out
    // underneath the options.
    const room = Math.max(12, Math.floor((this._menuBox().x - 16) / 6));
    const fit = (t) => (t.length > room ? `${t.slice(0, room - 1)}\u2026` : t);
    if (s.partner) {
      drawText(ctx, '●', 10, py, { color: PAL.hpGreen });
      label(ctx, fit(`${s.partner.name} connected`), 20, py);
      const pr = s.partner.presence;
      if (pr) {
        // Where they actually are, so the two of you can decide to meet.
        const place = (MAPS[pr.map] && MAPS[pr.map].name) || 'somewhere';
        labelDim(ctx, fit(place), 10, py + 10);
        labelDim(ctx, fit(`${pr.badges} badge${pr.badges === 1 ? '' : 's'} \u00b7 ${pr.party} with them`), 10, py + 20);
        // And the one thing about co-op worth saying out loud, because being
        // at different points in the story is normal and fine.
        labelDim(ctx, fit('You each keep your own'), 10, py + 32);
        labelDim(ctx, fit('story. The link shares'), 10, py + 41);
        labelDim(ctx, fit('the world, not the plot.'), 10, py + 50);
      }
    } else if (s.code) {
      labelDim(ctx, 'Waiting for your partner to join...', 10, py);
      const dots = '.'.repeat(1 + Math.floor(this.t * 2) % 3);
      labelDim(ctx, dots, 10, py + 10);
    }

    // The notice runs the full width — nothing is beside it down there.
    if (this.notice) {
      const wide = Math.max(16, Math.floor((W - 20) / 6));
      const t = this.notice.length > wide ? `${this.notice.slice(0, wide - 1)}\u2026` : this.notice;
      labelDim(ctx, t, 10, H - 16);
    }

    // Menu.
    const box = this._menuBox();
    const opts = this.options;
    window9(ctx, box.x, box.y, box.w, opts.length * LINE + 10);
    opts.forEach((o, i) => {
      const y = box.y + 5 + i * LINE;
      if (i === this.index) cursor(ctx, box.x + 4, y);
      label(ctx, o.text, box.x + 12, y, { color: o.k === 'back' ? PAL.uiTextDim : PAL.uiText });
    });
    // The panel already says LINK across its top-left; a second one up here
    // only ever printed underneath the BACK chip.
    // A thumb needs something to aim at: on a phone there is no B key.
    drawBackChip(ctx, W - 52, 2);
  }

  _renderJoin(ctx, W, H) {
    drawTextCentered(ctx, 'Enter your partner\'s room code', W / 2, 8, { color: PAL.uiTextLight, shadow: PAL.black });
    window9(ctx, W / 2 - 60, 20, 120, 24);
    const shown = (this.entry + '______').slice(0, 6).split('').join(' ');
    drawTextCentered(ctx, shown, W / 2, 26, { scale: 2 });
    const g = this._keyGrid();
    for (const c of g.cells) {
      const sel = c.r === this.ky && c.c === this.kx;
      rect(ctx, c.x, c.y, c.w, c.h, sel ? PAL.uiHighlight : PAL.uiBg);
      drawTextCentered(ctx, c.ch, c.x + c.w / 2, c.y + 4, { color: PAL.uiText });
    }
    rect(ctx, g.delX, g.delY, 52, 14, PAL.uiBgAlt);
    drawTextCentered(ctx, 'DEL', g.delX + 26, g.delY + 4);
    rect(ctx, g.okX, g.okY, 52, 14, PAL.hpGreen);
    drawTextCentered(ctx, 'JOIN', g.okX + 26, g.okY + 4, { color: '#ffffff' });
    void H;
  }

  _renderInfo(ctx, W, H) {
    window9(ctx, 6, 6, W - 12, H - 12);
    label(ctx, 'HOW LINKING WORKS', 12, 10);
    rect(ctx, 12, 20, W - 24, 1, PAL.uiBgAlt);
    const s = this.snap;
    const lines = s.transport === 'online' ? [
      'This copy is connected through the artifact',
      'runtime, so two PHONES really can see each',
      'other. One player creates a room, the other',
      'types the six-character code.',
      '',
      'Both players need the page open at the same',
      'time, and it must be shared with both of you.',
      'Positions, battles and trades all travel over',
      'that link — nothing is faked locally.',
    ] : s.transport === 'local' ? [
      'No cross-device link is available here, so the',
      'game fell back to a same-device link.',
      '',
      'Open this page in a SECOND TAB and the two',
      'tabs will genuinely see each other: separate',
      'saves, separate parties, real battles and',
      'trades. Two different phones cannot connect',
      'through this fallback.',
    ] : [
      'No link is available in this environment.',
      '',
      'Everything single-player works normally.',
      'The multiplayer code is all still here — it',
      'just has no transport to run on. Try RETRY',
      'CONNECTION, or open the published page where',
      'the runtime provides one.',
    ];
    lines.forEach((l, i) => labelDim(ctx, l, 12, 26 + i * 9));
    drawTextCentered(ctx, 'A / B: back', W / 2, H - 16, { color: PAL.uiText });
  }
}
