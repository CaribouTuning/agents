// The Town Map.
//
// Not a picture of Sinnoh — a drawing of the actual map graph. Every place on
// it is a real map at its authored world position, and every line between two
// places is a door you can genuinely walk through, because both come out of
// `worldGraph()` rather than out of an artist's idea of the region.
//
// It shows the WHOLE region from the first morning — Sinnoh is a real place
// and a map of it does not grow as you walk. What it does not do is tell you
// anything about a place you have not been: an unvisited town is a marker
// with no name on it, and you cannot travel to somewhere you have never
// stood. Discovery is what unlocks the journey, not the drawing.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import {
  PAL, shade, rect, stroke, window9, drawText, drawTextCentered, drawTextRight,
} from './kit.js';
import { drawBackChip, getBackChip } from './controls.js';
import { worldGraph, worldBounds, linksOf } from '../data/maps/world.js';
import { MAPS } from '../data/maps/index.js';
import { FADE } from './screen.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

// A colour per kind of place, so the region reads at a glance.
const KIND = {
  town:        { fill: '#e8c060', label: 'Town' },
  city:        { fill: '#e07a4a', label: 'City' },
  route:       { fill: '#7ec46a', label: 'Route' },
  cave:        { fill: '#8a7f74', label: 'Cave' },
  forest:      { fill: '#3f8a3a', label: 'Forest' },
  special:     { fill: '#6aa8e0', label: '' },
  underground: { fill: '#6b5236', label: '' },
};

export class TownMapScreen extends Screen {
  constructor(game) {
    super(game);
    this.index = 0;
    this.places = [];
  }

  onEnter() {
    audio.sfx('select');
    const g = worldGraph();
    const st = this.game.state;
    // The Underground is not part of the region above ground and would put a
    // node in the sea, so it is left off the paper. Everything else is on it,
    // visited or not.
    this.places = g.ids
      .filter((id) => g.nodes[id].kind !== 'underground')
      .map((id) => g.nodes[id]);
    const here = this.places.findIndex((p) => p.id === st.player.map);
    this.index = here >= 0 ? here : 0;
    this.confirm = null;
  }

  /** Somewhere counts as known once you have stood in it. */
  _visited(id) {
    const seen = this.game.state.visited;
    return !!(seen && seen[id]) || id === this.game.state.player.map;
  }

  /** Test mode sees the whole region as walked, because that is its job. */
  _known(id) {
    return this._visited(id) || !!(this.game.state.settings || {}).testMode;
  }

  /**
   * Somewhere you can travel to: a town or city you have stood in.
   *
   * Routes are not destinations — you walk a route, you do not arrive at one —
   * and a place you have never been is not somewhere you know the way to.
   */
  _canTravelTo(p) {
    if (!p || p.id === this.game.state.player.map) return false;
    if (p.kind !== 'town' && p.kind !== 'city') return false;
    return this._known(p.id);
  }

  /**
   * Where you land: the doorstep of the town's Pokemon Center when it has
   * one, because that is where somebody arriving in a town wants to be.
   */
  _landing(mapId) {
    const map = MAPS[mapId];
    if (!map) return null;
    const door = map.warps.find((w) => String(w.to).endsWith('_center'));
    if (door) {
      const below = { x: door.x, y: door.y + 1 };
      if (below.y < map.height) return below;
    }
    return null;
  }

  _travel() {
    const p = this.selected;
    if (!this._canTravelTo(p)) { audio.sfx('deny'); return; }
    const g = this.game;
    audio.sfx('warp');
    const at = this._landing(p.id);
    g.screens.fade(FADE.BLACK, () => {
      g.screens.pop();                    // the map itself
      g.teleport(p.id, at ? at.x : null, at ? at.y : null);
    });
  }

  get selected() { return this.places[this.index] || null; }

  update(dt, isTop) {
    if (!isTop) return;
    const { width: W, height: H } = this.game.display;

    // The travel prompt sits on top of everything and answers first.
    if (this.confirm) {
      const tap = input.consumeTap();
      if (tap) {
        if (hit(tap, W / 2 - 62, H / 2 + 4, 56, 14)) { this.confirm = null; this._travel(); return; }
        if (hit(tap, W / 2 + 6, H / 2 + 4, 56, 14)) { this.confirm = null; audio.sfx('back'); return; }
        return;
      }
      if (input.repeated('left') || input.repeated('right')) {
        this.confirm.yes = !this.confirm.yes; audio.sfx('cursor');
      }
      if (input.pressed('a')) {
        const go = this.confirm.yes;
        this.confirm = null;
        if (go) this._travel(); else audio.sfx('back');
      }
      if (input.pressed('b')) { this.confirm = null; audio.sfx('back'); }
      return;
    }

    const tap = input.consumeTap();
    if (tap) {
      const back = getBackChip();
      if (back && hit(tap, back.x, back.y, back.w, back.h)) { this._close(); return; }
      const L = this._layout();
      for (let i = 0; i < this.places.length; i++) {
        const p = this.places[i];
        const { x, y } = this._at(L, p);
        if (hit(tap, x - 7, y - 7, 14, 14)) {
          // Tapping the place you are already on is how you ask to go there.
          if (this.index === i && this._canTravelTo(p)) { this._ask(); return; }
          this.index = i;
          audio.sfx('cursor');
          return;
        }
      }
      return;
    }
    if (input.pressed('a')) {
      if (this._canTravelTo(this.selected)) this._ask();
      else audio.sfx('deny');
      return;
    }
    if (input.pressed('b') || input.pressed('start')) { this._close(); return; }
    // The cursor walks the region rather than a list: pressing right goes to
    // the nearest place that is actually to the right.
    for (const [btn, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
      if (input.repeated(btn)) this._step(dx, dy);
    }
  }

  _step(dx, dy) {
    const from = this.selected;
    if (!from) return;
    let best = -1, bestScore = Infinity;
    this.places.forEach((p, i) => {
      if (p === from) return;
      const ox = p.x - from.x, oy = p.y - from.y;
      // Must be genuinely in that direction, and closest wins.
      if (dx && Math.sign(ox) !== dx) return;
      if (dy && Math.sign(oy) !== dy) return;
      if (dx && Math.abs(oy) > Math.abs(ox)) return;
      if (dy && Math.abs(ox) > Math.abs(oy)) return;
      const score = Math.abs(ox) + Math.abs(oy);
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { this.index = best; audio.sfx('cursor'); }
  }

  _ask() {
    audio.sfx('select');
    this.confirm = { yes: true };
  }

  _close() { audio.sfx('back'); this.game.screens.pop(); }

  hint() { return 'Move to look around · A travels · B closes'; }

  _layout() {
    const { width: W, height: H } = this.game.display;
    const b = worldBounds();
    const pad = 22;
    const top = 16, bottom = 34;
    const spanX = Math.max(1, b.maxX - b.minX);
    const spanY = Math.max(1, b.maxY - b.minY);
    const stepX = (W - pad * 2) / spanX;
    const stepY = (H - top - bottom) / spanY;
    return { W, H, b, pad, top, stepX, stepY };
  }

  _at(L, p) {
    return {
      x: Math.round(L.pad + (p.x - L.b.minX) * L.stepX),
      y: Math.round(L.top + (p.y - L.b.minY) * L.stepY),
    };
  }

  render(ctx) {
    const L = this._layout();
    const { W, H } = L;
    rect(ctx, 0, 0, W, H, '#2f4f73');
    for (let y = 0; y < H; y += 6) rect(ctx, 0, y, W, 3, '#2a4869');

    const seen = (id) => this._known(id);

    // Roads first, so the places sit on top of them. A road between two
    // places you have not walked is drawn faintly: the region is all there,
    // but only the parts you have been through are drawn in ink.
    for (const p of this.places) {
      const a = this._at(L, p);
      for (const [, to] of linksOf(p.id)) {
        const q = this.places.find((n) => n.id === to);
        if (!q) continue;
        const b = this._at(L, q);
        const walked = seen(p.id) && seen(to);
        ctx.strokeStyle = walked ? '#d9c290' : '#3d5f86';
        ctx.lineWidth = walked ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    const hereId = this.game.state.player.map;
    for (const p of this.places) {
      const { x, y } = this._at(L, p);
      const k = KIND[p.kind] || KIND.route;
      const big = p.kind === 'city' || p.kind === 'town';
      const r = big ? 5 : 4;
      const known = seen(p.id);
      rect(ctx, x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2, '#20283a');
      if (known) {
        rect(ctx, x - r, y - r, r * 2, r * 2, k.fill);
        if (big) rect(ctx, x - r + 1, y - r + 1, r * 2 - 2, 2, shade(k.fill, 0.35));
      } else {
        // Somewhere is there. That is all the paper is willing to say.
        rect(ctx, x - r, y - r, r * 2, r * 2, '#37527a');
        stroke(ctx, x - r, y - r, r * 2, r * 2, '#5c7ba8', 1);
        drawTextCentered(ctx, '?', x + 1, y - 3, { color: '#9fb8d8' });
      }
      if (p.id === hereId) {
        // You are here: a ring that blinks, the way the DS games mark it.
        const on = Math.floor(performance.now() / 320) % 2 === 0;
        if (on) stroke(ctx, x - r - 3, y - r - 3, r * 2 + 6, r * 2 + 6, '#ffffff', 1);
      }
      if (p === this.selected) stroke(ctx, x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4, '#ffd75e', 1);
    }

    const knownCount = this.places.filter((p) => seen(p.id)).length;
    drawText(ctx, 'SINNOH', 6, 4, { color: '#f8f4e4', shadow: '#1b2a40' });
    drawTextRight(ctx, `${knownCount}/${this.places.length}`, W - 44, 4, { color: '#a8c4e4' });
    drawBackChip(ctx, W - 40, 3, 'CLOSE');

    // The plate along the bottom: what the cursor is on, and how to leave it.
    const sel = this.selected;
    window9(ctx, 3, H - 30, W - 6, 27);
    if (sel && !seen(sel.id)) {
      drawText(ctx, '- - - - - - -', 8, H - 25, { color: PAL.uiTextDim });
      drawTextRight(ctx, 'UNDISCOVERED', W - 8, H - 25, { color: PAL.uiTextDim });
      drawText(ctx, 'You have not been here. Walk it first.', 8, H - 14, { color: PAL.uiTextDim });
    } else if (sel) {
      drawText(ctx, sel.name, 8, H - 25, { color: PAL.uiText });
      const kind = (KIND[sel.kind] || {}).label || '';
      if (kind) drawTextRight(ctx, kind, W - 8, H - 25, { color: PAL.uiTextDim });
      const ways = [...new Set(linksOf(sel.id)
        .filter(([, to]) => seen(to))
        .map(([dir]) => dir[0].toUpperCase() + dir.slice(1)))];
      let line;
      if (sel.id === hereId) line = ways.length ? `You are here. Roads: ${ways.join(', ')}` : 'You are here.';
      else if (this._canTravelTo(sel)) line = 'A to go here.';
      else line = ways.length ? `Roads: ${ways.join(', ')}` : 'A road you have walked.';
      drawText(ctx, line.slice(0, Math.floor((W - 16) / 6)), 8, H - 14, { color: PAL.uiTextDim });
    } else {
      drawTextCentered(ctx, 'You have not been anywhere yet.', W / 2, H - 20, { color: PAL.uiTextDim });
    }

    if (this.confirm) this._renderConfirm(ctx, W, H);
  }

  _renderConfirm(ctx, W, H) {
    const sel = this.selected;
    rect(ctx, 0, 0, W, H, 'rgba(8,11,24,0.55)');
    window9(ctx, W / 2 - 80, H / 2 - 30, 160, 56);
    drawTextCentered(ctx, `Travel to ${sel.name}?`, W / 2, H / 2 - 24, { color: PAL.uiText });
    drawTextCentered(ctx, 'You know the way from here.', W / 2, H / 2 - 12, { color: PAL.uiTextDim });
    ['GO', 'STAY'].forEach((label, i) => {
      const on = this.confirm.yes === (i === 0);
      const x = i === 0 ? W / 2 - 62 : W / 2 + 6;
      rect(ctx, x, H / 2 + 4, 56, 14, on ? PAL.uiSelect : PAL.uiBgAlt);
      drawTextCentered(ctx, label, x + 28, H / 2 + 7, { color: on ? '#ffffff' : PAL.uiText });
    });
  }
}
