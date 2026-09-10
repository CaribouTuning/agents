// Overworld renderer.
//
// Draws only the tiles the camera can see, sorts entities by their feet so
// characters walk behind things correctly, and re-draws the top half of tall
// grass over anyone standing in it — the small detail that sells the
// perspective in the games this is modelled on.
import { TILE } from './canvas.js';
import { drawTile, tileDef, drawEdge, drawCastShadow, drawRoofEdge, groundOf, groundRank, EDGE_DIRS } from './tiles.js';
import { drawChar, lookFor, SPR_W, FOOT_OFFSET } from './sprites.js';
import { renderMonster } from './monsterart.js';
import { getSpecies } from '../data/species.js';
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

  // --- autotile pass: stronger ground creeps over weaker, so the map stops
  // reading as a grid of squares ---
  const at = (x, y) => (y >= 0 && y < map.height && x >= 0 && x < map.width ? map.tiles[y][x] : null);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const mine = groundOf(map.tiles[y][x]);
      if (!mine) continue;
      const rank = groundRank(mine);
      const sx = x * TILE - camera.x;
      const sy = y * TILE - camera.y;
      for (let d = 0; d < EDGE_DIRS.length; d++) {
        const ch = at(x + EDGE_DIRS[d][0], y + EDGE_DIRS[d][1]);
        if (ch === null) continue;
        const theirs = groundOf(ch);
        if (!theirs || theirs === mine || groundRank(theirs) <= rank) continue;
        // A corner only softens when neither of its two sides already did,
        // otherwise the overlap stacks into a hard dark blob.
        if (d >= 4) {
          const [dx, dy] = EDGE_DIRS[d];
          const sideA = groundOf(at(x + dx, y));
          const sideB = groundOf(at(x, y + dy));
          if (sideA === theirs || sideB === theirs) continue;
        }
        drawEdge(ctx, theirs, d, sx, sy);
      }
    }
  }

  // --- roof ridges and eaves ---
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!tileDef(map.tiles[y][x]).roof) continue;
      const isRoof = (cx, cy) => { const c = at(cx, cy); return !!(c && tileDef(c).roof); };
      drawRoofEdge(ctx, x * TILE - camera.x, y * TILE - camera.y, {
        up: !isRoof(x, y - 1), down: !isRoof(x, y + 1),
        left: !isRoof(x - 1, y), right: !isRoof(x + 1, y),
      });
    }
  }

  // --- shadows cast by trees and buildings onto the ground beside them ---
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!groundOf(map.tiles[y][x])) continue;
      const above = at(x, y - 1);
      const left = at(x - 1, y);
      const fromAbove = !!(above && tileDef(above).casts);
      const fromLeft = !!(left && tileDef(left).casts);
      if (!fromAbove && !fromLeft) continue;
      drawCastShadow(ctx, x * TILE - camera.x, y * TILE - camera.y, fromAbove, fromLeft);
    }
  }

  // --- building name boards ---
  // The DS games put the building's name on the building. Without it a city
  // is a row of coloured rectangles and the player has to open every door to
  // find the Gym.
  for (const lb of map.labels || []) {
    const sx = lb.x * TILE - camera.x;
    const sy = lb.y * TILE - camera.y;
    if (sx < -160 || sx > viewW + 40 || sy < -20 || sy > viewH + 20) continue;
    drawBoardText(ctx, lb, sx, sy);
  }

  // --- entity pass, sorted by feet ---
  const drawables = [];
  for (const e of world.entities) {
    if (!e.visible) continue;
    if (e.kind === 'item') { drawables.push({ e, sortY: e.y, item: true }); continue; }
    drawables.push({ e, sortY: e.y });
  }
  for (const r of world.remotesHere()) drawables.push({ e: r, sortY: r.y, remote: true });
  // The walking partner sorts by its feet like everything else, so it passes
  // behind a tree and in front of the grass exactly as the player does.
  if (world.follower && world.follower.visible && world.follower.mon) {
    drawables.push({ e: world.follower, sortY: world.follower.y - 0.01, partner: true });
  }
  drawables.sort((a, b) => a.sortY - b.sortY || (a.e.kind === 'player' ? 1 : -1));

  for (const d of drawables) {
    const e = d.e;
    if (d.item) { drawItemBall(ctx, e, camera); continue; }
    if (d.partner) { drawPartner(ctx, world, e, camera); continue; }
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

/**
 * One building's name, centred across the board tiles it was authored over.
 * `w` is in tiles; the text is drawn at half scale if it would not fit, so a
 * long name never spills onto the roof.
 */
function drawBoardText(ctx, lb, sx, sy) {
  const w = (lb.w || 2) * TILE;
  const cx = sx + w / 2;
  const cy = sy + 6;
  drawTextCentered(ctx, lb.text, cx + 1, cy + 1, { color: '#10162a' });
  drawTextCentered(ctx, lb.text, cx, cy, { color: lb.tone || '#f8f4e4' });
}

function drawShadow(ctx, sx, groundY, lift) {
  if (lift <= 0.5) return;
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(Math.round(sx + 4), Math.round(groundY + 12), 8, 3);
  ctx.globalAlpha = 1;
}

/**
 * The lead Pokemon, walking. It is drawn from the same generated artwork the
 * battle screen uses, scaled to fit a tile, with a small bob so it reads as
 * moving rather than sliding, and a ground shadow so it is standing on the
 * map instead of floating over it.
 */
const PARTNER_SIZE = 24;

function drawPartner(ctx, world, e, camera) {
  const sp = getSpecies(e.mon.species);
  if (!sp) return;
  const pos = world.renderPos(e);
  const sx = Math.round(pos.x - camera.x - (PARTNER_SIZE - TILE) / 2);
  const sy = Math.round(pos.y - camera.y - (PARTNER_SIZE - TILE));
  const bob = e.moving ? Math.round(Math.sin(e.moveT * 0.55) * 1.2) : 0;

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(Math.round(pos.x - camera.x) + 3, Math.round(pos.y - camera.y) + 12, 10, 3);
  ctx.globalAlpha = 1;

  const img = renderMonster(sp.art, { size: PARTNER_SIZE, shiny: !!e.mon.shiny });
  // Facing right mirrors the sprite, the same trick the character sheets use.
  if (e.dir === 'right') {
    ctx.save();
    ctx.translate(sx + PARTNER_SIZE, sy + bob);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy + bob);
  }
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

/**
 * The guide bar: what to do next, pinned to the screen.
 *
 * The journal has always known the objective, but it was three taps deep in a
 * menu, which is the same as not existing. A player who walks into a new city
 * and cannot tell what the game wants from them has been failed by the game,
 * not by their attention. So it lives on the overworld now, one line, always
 * true, and switchable off in OPTIONS for anyone who would rather find their
 * own way.
 */
export function drawGuideBar(ctx, text, W, H, opts = {}) {
  if (!text) return;
  const yBelow = opts.belowBanner ? 24 : 6;
  // The MENU and LINK chips own the top-right corner, so the bar stops short
  // of them rather than sliding underneath.
  const maxChars = Math.max(8, Math.floor((W - 76) / 6));
  const line = text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  const w = line.length * 6 + 16;
  const x = 4;
  const y = yBelow;
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = PAL.uiFrame;
  ctx.fillRect(x, y, w, 13);
  ctx.fillStyle = shade(PAL.uiFrame, 0.22);
  ctx.fillRect(x, y, w, 1);
  ctx.globalAlpha = 1;
  // A small chevron, so it reads as an instruction rather than a caption.
  drawText(ctx, '\u25b8', x + 4, y + 3, { color: PAL.uiHighlight });
  drawText(ctx, line, x + 11, y + 3, { color: PAL.uiTextLight });
  void H;
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
