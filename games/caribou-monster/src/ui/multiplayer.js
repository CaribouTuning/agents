// The LINK screen: create or join a room, see who is connected, and read an
// honest account of what the current transport can and cannot do.
import { Screen } from './screen.js';
import { MAPS } from '../data/maps/index.js';
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
      out.push({ k: 'battle', text: 'BATTLE PARTNER' });
      out.push({ k: 'trade', text: 'TRADE' });
    }
    if (this.snap.transport === 'offline') out.push({ k: 'retry', text: 'RETRY CONNECTION' });
    out.push({ k: 'info', text: 'HOW LINKING WORKS' });
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
        this.notice = r.ok ? 'Room created. Share the code!' : 'No connection available.';
        if (!r.ok) audio.sfx('deny'); else audio.sfx('join');
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
    this.notice = `Joined room ${code}. Waiting for your partner...`;
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

    if (s.code) {
      window9(ctx, 10, 46, W - 144, 30, { bg: PAL.uiBgAlt });
      labelDim(ctx, 'ROOM CODE', 16, 49);
      drawText(ctx, s.code, 16, 60, { color: PAL.uiText, scale: 2 });
      labelDim(ctx, s.isHost ? 'You created this room' : 'You joined this room', 10, 80);
    } else {
      labelDim(ctx, 'Not in a room yet.', 10, 50);
    }

    const py = s.code ? 92 : 64;
    if (s.partner) {
      drawText(ctx, '●', 10, py, { color: PAL.hpGreen });
      label(ctx, `${s.partner.name} connected`, 20, py);
      const pr = s.partner.presence;
      if (pr) {
        // Where they actually are, so the two of you can decide to meet.
        const place = (MAPS[pr.map] && MAPS[pr.map].name) || 'somewhere';
        labelDim(ctx, `${pr.badges} badge${pr.badges === 1 ? '' : 's'}  ·  ${pr.party} in party  ·  ${place}`, 10, py + 10);
        // And the one thing about co-op that is worth saying out loud, because
        // being at different points in the story is normal and fine.
        labelDim(ctx, 'You each keep your own story. The link shares the world,', 10, py + 22);
        labelDim(ctx, 'not the plot — neither of you can skip the other ahead.', 10, py + 32);
      }
    } else if (s.code) {
      labelDim(ctx, 'Waiting for your partner to join...', 10, py);
      const dots = '.'.repeat(1 + Math.floor(this.t * 2) % 3);
      labelDim(ctx, dots, 10, py + 10);
    }

    if (this.notice) labelDim(ctx, this.notice, 10, H - 16);

    // Menu.
    const box = this._menuBox();
    const opts = this.options;
    window9(ctx, box.x, box.y, box.w, opts.length * LINE + 10);
    opts.forEach((o, i) => {
      const y = box.y + 5 + i * LINE;
      if (i === this.index) cursor(ctx, box.x + 4, y);
      label(ctx, o.text, box.x + 12, y, { color: o.k === 'back' ? PAL.uiTextDim : PAL.uiText });
    });
    drawTextRight(ctx, 'LINK', W - 6, 8, { color: '#9ee0a0', shadow: PAL.black });
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
