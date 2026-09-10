// The Town Map.
//
// Not a picture of Sinnoh — a drawing of the actual map graph. Every place on
// it is a real map at its authored world position, and every line between two
// places is a door you can genuinely walk through, because both come out of
// `worldGraph()` rather than out of an artist's idea of the region.
//
// It only shows where you have been. A map that hands you the whole region on
// the first morning is a map that takes the region away from you.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import {
  PAL, shade, rect, stroke, window9, drawText, drawTextCentered, drawTextRight,
} from './kit.js';
import { drawBackChip, getBackChip } from './controls.js';
import { worldGraph, worldBounds, linksOf } from '../data/maps/world.js';

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
    // node in the sea, so it is left off the paper.
    this.places = g.ids
      .filter((id) => g.nodes[id].kind !== 'underground')
      .filter((id) => this._visited(id) || id === st.player.map)
      .map((id) => g.nodes[id]);
    const here = this.places.findIndex((p) => p.id === st.player.map);
    this.index = here >= 0 ? here : 0;
  }

  /** Somewhere counts as known once you have stood in it. */
  _visited(id) {
    const seen = this.game.state.visited;
    return !!(seen && seen[id]);
  }

  get selected() { return this.places[this.index] || null; }

  update(dt, isTop) {
    if (!isTop) return;
    const tap = input.consumeTap();
    if (tap) {
      const back = getBackChip();
      if (back && hit(tap, back.x, back.y, back.w, back.h)) { this._close(); return; }
      const L = this._layout();
      for (let i = 0; i < this.places.length; i++) {
        const p = this.places[i];
        const { x, y } = this._at(L, p);
        if (hit(tap, x - 7, y - 7, 14, 14)) { this.index = i; audio.sfx('cursor'); return; }
      }
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

  _close() { audio.sfx('back'); this.game.screens.pop(); }

  hint() { return 'Move to look around · B closes'; }

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

    const known = new Set(this.places.map((p) => p.id));

    // Roads first, so the places sit on top of them.
    for (const p of this.places) {
      const a = this._at(L, p);
      for (const [, to] of linksOf(p.id)) {
        if (!known.has(to)) continue;
        const q = this.places.find((n) => n.id === to);
        if (!q) continue;
        const b = this._at(L, q);
        ctx.strokeStyle = '#d9c290';
        ctx.lineWidth = 2;
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
      rect(ctx, x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2, '#20283a');
      rect(ctx, x - r, y - r, r * 2, r * 2, k.fill);
      if (big) rect(ctx, x - r + 1, y - r + 1, r * 2 - 2, 2, shade(k.fill, 0.35));
      if (p.id === hereId) {
        // You are here: a ring that blinks, the way the DS games mark it.
        const on = Math.floor(performance.now() / 320) % 2 === 0;
        if (on) stroke(ctx, x - r - 3, y - r - 3, r * 2 + 6, r * 2 + 6, '#ffffff', 1);
      }
      if (p === this.selected) stroke(ctx, x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4, '#ffd75e', 1);
    }

    drawText(ctx, 'SINNOH', 6, 4, { color: '#f8f4e4', shadow: '#1b2a40' });
    drawTextRight(ctx, `${this.places.length} known`, W - 44, 4, { color: '#a8c4e4' });
    drawBackChip(ctx, W - 40, 3, 'CLOSE');

    // The plate along the bottom: what the cursor is on, and how to leave it.
    const sel = this.selected;
    window9(ctx, 3, H - 30, W - 6, 27);
    if (sel) {
      drawText(ctx, sel.name, 8, H - 25, { color: PAL.uiText });
      const kind = (KIND[sel.kind] || {}).label || '';
      if (kind) drawTextRight(ctx, kind, W - 8, H - 25, { color: PAL.uiTextDim });
      const ways = [...new Set(linksOf(sel.id)
        .filter(([, to]) => known.has(to))
        .map(([dir]) => dir[0].toUpperCase() + dir.slice(1)))];
      const line = sel.id === hereId
        ? (ways.length ? `You are here. Roads: ${ways.join(', ')}` : 'You are here.')
        : (ways.length ? `Roads: ${ways.join(', ')}` : 'No road you have walked.');
      drawText(ctx, line.slice(0, Math.floor((W - 16) / 6)), 8, H - 14, { color: PAL.uiTextDim });
    } else {
      drawTextCentered(ctx, 'You have not been anywhere yet.', W / 2, H - 20, { color: PAL.uiTextDim });
    }
  }
}
