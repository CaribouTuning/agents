// Overworld renderer.
//
// Draws only the tiles the camera can see, sorts entities by their feet so
// characters walk behind things correctly, and re-draws the top half of tall
// grass over anyone standing in it — the small detail that sells the
// perspective in the games this is modelled on.
import { TILE } from './canvas.js';
import { drawTile, tileDef } from './tiles.js';
import { drawChar, lookFor, SPR_W, FOOT_OFFSET } from './sprites.js';
import { PAL, shade } from './palette.js';
import { drawTextCentered, drawText } from './font.js';

export class Camera {
  constructor() { this.x = 0; this.y = 0; }

  follow(world, viewW, viewH) {
    const map = world.map;
    const p = world.renderPos(world.player);
    const mapW = map.width * TILE;
    const mapH = map.height * TILE;
    let cx = p.x + TILE / 2 - viewW / 2;
    let cy = p.y + TILE / 2 - viewH / 2;
    // Small maps sit centred rather than sliding around inside the view.
    this.x = mapW <= viewW ? Math.round((mapW - viewW) / 2) : Math.round(clamp(cx, 0, mapW - viewW));
    this.y = mapH <= viewH ? Math.round((mapH - viewH) / 2) : Math.round(clamp(cy, 0, mapH - viewH));
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function drawWorld(ctx, world, camera, viewW, viewH, opts = {}) {
  const map = world.map;
  const frame = world.animFrame;

  // Backdrop for maps smaller than the viewport.
  ctx.fillStyle = map.kind === 'indoor' ? shade(PAL.uiFrame, -0.5)
    : map.kind === 'cave' ? PAL.caveWallDark : PAL.grassDark;
  ctx.fillRect(0, 0, viewW, viewH);

  const x0 = Math.max(0, Math.floor(camera.x / TILE));
  const y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.min(map.width - 1, Math.ceil((camera.x + viewW) / TILE));
  const y1 = Math.min(map.height - 1, Math.ceil((camera.y + viewH) / TILE));

  // --- ground pass ---
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = map.tiles[y][x];
      drawTile(ctx, ch, x * TILE - camera.x, y * TILE - camera.y, frame);
    }
  }

  // --- entity pass, sorted by feet ---
  const drawables = [];
  for (const e of world.entities) {
    if (!e.visible) continue;
    if (e.kind === 'item') { drawables.push({ e, sortY: e.y, item: true }); continue; }
    drawables.push({ e, sortY: e.y });
  }
  for (const r of world.remotesHere()) drawables.push({ e: r, sortY: r.y, remote: true });
  drawables.sort((a, b) => a.sortY - b.sortY || (a.e.kind === 'player' ? 1 : -1));

  for (const d of drawables) {
    const e = d.e;
    if (d.item) { drawItemBall(ctx, e, camera); continue; }
    if (d.remote) { drawRemote(ctx, e, camera, opts); continue; }
    const pos = world.renderPos(e);
    const sx = pos.x - camera.x;
    const sy = pos.y - camera.y - pos.lift;
    if (sx < -SPR_W || sy < -32 || sx > viewW + SPR_W || sy > viewH + 32) continue;
    drawShadow(ctx, sx, pos.y - camera.y, pos.lift);
    drawChar(ctx, `${e.look}:${e.id}`, lookFor(e.look), e.dir, e.frame, sx, sy);
  }

  // --- tall-grass overlay: the top of the blades covers ankles ---
  for (const d of drawables) {
    const e = d.e;
    if (d.item) continue;
    const pos = d.remote ? { x: e.rx, y: e.ry } : world.renderPos(e);
    const tx = Math.round(pos.x / TILE), ty = Math.round(pos.y / TILE);
    if (ty < 0 || ty >= map.height || tx < 0 || tx >= map.width) continue;
    if (!tileDef(map.tiles[ty][tx]).tall) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx * TILE - camera.x, ty * TILE - camera.y + 6, TILE, TILE - 6);
    ctx.clip();
    drawTile(ctx, map.tiles[ty][tx], tx * TILE - camera.x, ty * TILE - camera.y, frame);
    ctx.restore();
  }

  // --- caves are lit only near the player ---
  if (map.kind === 'cave' && opts.caveLight !== false) {
    const p = world.renderPos(world.player);
    drawCaveLight(ctx, p.x - camera.x + TILE / 2, p.y - camera.y + TILE / 2, viewW, viewH);
  }

  // Remote name tags go last so nothing draws over them.
  for (const r of world.remotesHere()) drawNameTag(ctx, r, camera, viewW, viewH);
}

function drawShadow(ctx, sx, groundY, lift) {
  if (lift <= 0.5) return;
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(Math.round(sx + 4), Math.round(groundY + 12), 8, 3);
  ctx.globalAlpha = 1;
}

function drawItemBall(ctx, e, camera) {
  const x = e.x * TILE - camera.x + 4;
  const y = e.y * TILE - camera.y + 4;
  const bob = Math.sin(performance.now() / 420 + e.x) * 0.8;
  ctx.fillStyle = '#20283a';
  ctx.fillRect(x, y + bob + 1, 8, 8);
  ctx.fillStyle = e.data.story ? '#f0c030' : '#e05248';
  ctx.fillRect(x + 1, y + bob + 1, 6, 3);
  ctx.fillStyle = '#f4f4f8';
  ctx.fillRect(x + 1, y + bob + 4, 6, 3);
  ctx.fillStyle = '#20283a';
  ctx.fillRect(x + 1, y + bob + 4, 6, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 2, y + bob + 2, 2, 1);
}

function drawRemote(ctx, e, camera, opts) {
  const sx = Math.round(e.rx - camera.x);
  const sy = Math.round(e.ry - camera.y);
  ctx.save();
  // A partner in a battle or a trade is shown faded, so you can see at a
  // glance that walking up to them will not do anything right now.
  if (e.busy && e.busy !== 'free') ctx.globalAlpha = 0.55;
  drawChar(ctx, `${e.look}:${e.id}`, lookFor(e.look), e.dir, e.frame, sx, sy);
  ctx.restore();
  void opts;
}

function drawNameTag(ctx, e, camera, viewW, viewH) {
  const sx = Math.round(e.rx - camera.x) + SPR_W / 2;
  const sy = Math.round(e.ry - camera.y) - FOOT_OFFSET - 9;
  if (sx < -40 || sx > viewW + 40 || sy < -20 || sy > viewH + 20) return;
  const name = (e.name || 'Trainer').slice(0, 10);
  const w = name.length * 6 + 6;
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = PAL.uiFrame;
  ctx.fillRect(Math.round(sx - w / 2), sy, w, 9);
  ctx.globalAlpha = 1;
  drawTextCentered(ctx, name, sx, sy + 1, { color: PAL.uiTextLight });
  if (e.busy === 'battle') drawText(ctx, '!', Math.round(sx + w / 2 + 1), sy + 1, { color: PAL.uiHighlight });
  if (e.busy === 'trade') drawText(ctx, '=', Math.round(sx + w / 2 + 1), sy + 1, { color: PAL.uiHighlight });
}

// Radial darkness with a soft edge; cheap because it is drawn as scanlines.
function drawCaveLight(ctx, cx, cy, w, h) {
  const r = 74;
  const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, 'rgba(4,6,12,0.45)');
  g.addColorStop(1, 'rgba(4,6,12,0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// The location banner that slides in when you enter a new area.
export function drawLocationBanner(ctx, name, t, W) {
  const dur = 2.4;
  if (t > dur) return;
  const slide = t < 0.3 ? t / 0.3 : t > dur - 0.4 ? (dur - t) / 0.4 : 1;
  const w = Math.max(90, name.length * 6 + 22);
  const x = -w + (w + 8) * Math.min(1, slide);
  const y = 6;
  ctx.fillStyle = PAL.uiFrame;
  ctx.fillRect(x, y, w, 15);
  ctx.fillStyle = PAL.uiFrameLight;
  ctx.fillRect(x, y + 1, w - 1, 13);
  ctx.fillStyle = PAL.uiBg;
  ctx.fillRect(x + 1, y + 2, w - 3, 11);
  drawTextCentered(ctx, name, x + w / 2, y + 4, { color: PAL.uiText });
  void W;
}
