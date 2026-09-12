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
import { tintFor } from '../game/clock.js';
import { patchAt, stageIndex } from '../game/berries.js';
import { GOODS } from '../game/underground/base.js';
import { BASE_BOARD } from '../data/maps/underground.js';
import { getItem } from '../data/items.js';
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

  // --- tree crowns ---
  // A tree is one 16x32 picture across two tiles: the map holds the trunk,
  // and its crown is drawn into the tile above. Before the entity pass, so a
  // player standing under a canopy is in front of it rather than inside it.
  for (let y = y0; y <= y1 + 1; y++) {
    for (let x = x0; x <= x1; x++) {
      const ch = at(x, y);
      const def = ch && tileDef(ch);
      if (!def || !def.over) continue;
      drawTile(ctx, def.over, x * TILE - camera.x, y * TILE - camera.y - TILE, frame);
    }
  }

  // --- berry plants ---
  // Drawn between the crowns and the entities, so you stand in front of your
  // own garden. The soil is a tile; what is growing out of it is save data,
  // which is why it cannot be part of the atlas.
  const patches = opts.patches;
  if (patches) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!tileDef(map.tiles[y][x]).soil) continue;
        const patch = patchAt(patches, world.mapId, x, y);
        if (!patch) continue;
        drawBerryPlant(ctx, patch, x * TILE - camera.x, y * TILE - camera.y, frame);
      }
    }
  }

  // --- a Secret Base's furniture ---
  // The room is a map; what is in it is save data, so it is drawn from the
  // room the player is standing in rather than from the tiles.
  const room = opts.room;
  if (room && world.mapId === 'secret_base') {
    drawBoard(ctx, BASE_BOARD, camera, room);
    for (const d of room.decor) {
      const g = GOODS[d.id];
      if (!g) continue;
      drawFurniture(ctx, d.id, (opts.origin.x + d.x) * TILE - camera.x,
        (opts.origin.y + d.y) * TILE - camera.y, g);
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
    // An NPC that is a Pokemon draws through the partner path.
    if (e.mon) { drawables.push({ e, sortY: e.y, partner: true }); continue; }
    drawables.push({ e, sortY: e.y });
  }
  for (const r of world.remotesHere()) drawables.push({ e: r, sortY: r.y, remote: true });
  // The walking partner sorts by its feet like everything else, so it passes
  // behind a tree and in front of the grass exactly as the player does.
  if (world.follower && world.follower.visible && world.follower.mon) {
    drawables.push({ e: world.follower, sortY: world.follower.y - 0.01, partner: true });
  }
  // The person walking with you sorts by their feet like everybody else.
  if (world.companion && world.companion.visible && world.companion.look) {
    drawables.push({ e: world.companion, sortY: world.companion.y - 0.005 });
  }
  // Their dog, drawn the same way your own Pokemon is.
  if (world.pet && world.pet.visible && world.pet.species) {
    drawables.push({ e: world.pet, sortY: world.pet.y - 0.008, partner: true });
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

  // --- the time of day ---
  // Outdoors only. A cave is dark whatever the hour, and the one place the
  // light never changes is indoors.
  if (map.kind !== 'cave' && map.kind !== 'indoor') {
    const tint = tintFor();
    if (tint.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = tint.alpha;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = tint.color;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    }
  }

  // --- the street lamps come on ---
  // Painted over the night tint rather than under it, so a lamp is a light
  // and not just a slightly paler patch of dark. Only the lamp posts glow:
  // a town where every window blazes reads as a fire, not as an evening.
  if (map.kind !== 'cave' && map.kind !== 'indoor') {
    const tint = tintFor();
    if (tint.alpha > 0.12) {
      const strength = Math.min(1, (tint.alpha - 0.12) / 0.35);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (map.tiles[y][x] !== 'l') continue;
          const cx = x * TILE - camera.x + 8;
          const cy = y * TILE - camera.y + 4;
          const r = 30;
          const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
          g.addColorStop(0, `rgba(255,226,150,${0.42 * strength})`);
          g.addColorStop(0.45, `rgba(255,206,120,${0.16 * strength})`);
          g.addColorStop(1, 'rgba(255,200,110,0)');
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
      ctx.restore();
    }
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
/**
 * A berry plant, in four stages: a mound of turned earth, a shoot, a bush,
 * and a bush with fruit on it. The fruit takes the berry's own colour, so a
 * row of them reads at a glance without a single label.
 */
const BERRY_COLORS = {
  cheriberry: '#e0413e', chestoberry: '#8b5bd6', pechaberry: '#f08cc0',
  rawstberry: '#4aa7e0', aspearberry: '#f0a026', oranberry: '#4f7fe0',
  leppaberry: '#e06a3c', sitrusberry: '#f2d03c', lumberry: '#f0eec4',
};

function drawBerryPlant(ctx, patch, sx, sy, frame) {
  const stage = stageIndex(patch);
  const sway = frame === 1 || frame === 2 ? 1 : 0;
  const leaf = '#3f8a3a';
  const leafDark = '#24521f';

  if (stage === 0) return;                 // just turned earth; the tile says it

  ctx.fillStyle = leafDark;
  ctx.fillRect(sx + 7, sy + 11 - stage * 2, 2, 3 + stage * 2);

  if (stage === 1) {
    ctx.fillStyle = leaf;
    ctx.fillRect(sx + 4 + sway, sy + 8, 3, 2);
    ctx.fillRect(sx + 9 - sway, sy + 8, 3, 2);
    ctx.fillStyle = leafDark;
    ctx.fillRect(sx + 4 + sway, sy + 10, 3, 1);
    ctx.fillRect(sx + 9 - sway, sy + 10, 3, 1);
    return;
  }

  // A bush, built row by row so it is a round-ish shape rather than a green
  // rectangle sitting on the soil.
  //            [x offset, width] per row, from the top of the plant down
  const ROWS = [[5, 6], [3, 10], [2, 12], [2, 12], [2, 12], [3, 10], [4, 8]];
  ctx.fillStyle = leafDark;
  ROWS.forEach(([ox, w], i) => ctx.fillRect(sx + ox + sway, sy + 3 + i, w, 1));
  ctx.fillStyle = leaf;
  ROWS.forEach(([ox, w], i) => {
    if (i === 0 || i === ROWS.length - 1) return;
    ctx.fillRect(sx + ox + 1 + sway, sy + 3 + i, w - 2, 1);
  });
  ctx.fillStyle = shade(leaf, 0.22);
  ctx.fillRect(sx + 5 + sway, sy + 4, 4, 1);

  if (stage < 3) return;

  // Fruit. Outlined, because a berry the colour of a leaf is a highlight.
  const c = BERRY_COLORS[patch.berry] || '#e0413e';
  const berry = (bx, by) => {
    ctx.fillStyle = leafDark;
    ctx.fillRect(sx + bx - 1, sy + by - 1, 5, 5);
    ctx.fillStyle = c;
    ctx.fillRect(sx + bx, sy + by, 3, 3);
    ctx.fillStyle = shade(c, 0.4);
    ctx.fillRect(sx + bx, sy + by, 1, 1);
  };
  berry(4 + sway, 7);
  berry(9 + sway, 5);
}


/**
 * The board on the back wall of a Secret Base — the thing the whole room is
 * really for. It is drawn with something on it whenever there is something on
 * it, so you can see from the door that somebody has been.
 */
function drawBoard(ctx, board, camera, room) {
  const sx = board.x * TILE - camera.x;
  const sy = board.y * TILE - camera.y;
  ctx.fillStyle = '#3a2c1e'; ctx.fillRect(sx + 1, sy + 2, 14, 12);
  ctx.fillStyle = '#6b5236'; ctx.fillRect(sx + 2, sy + 3, 12, 10);
  ctx.fillStyle = '#8a6d49'; ctx.fillRect(sx + 2, sy + 3, 12, 1);
  if (room && room.note) {
    ctx.fillStyle = '#efe6c8'; ctx.fillRect(sx + 4, sy + 5, 8, 6);
    ctx.fillStyle = '#7b6a4a';
    ctx.fillRect(sx + 5, sy + 6, 6, 1);
    ctx.fillRect(sx + 5, sy + 8, 5, 1);
  } else {
    ctx.fillStyle = '#c8ad74'; ctx.fillRect(sx + 7, sy + 5, 2, 2);
  }
}

/**
 * One piece of furniture. Small, flat shapes with a shadow under them: the
 * room is 9x5 and every piece has to read at a glance from the door.
 */
const FURN = {
  lamp: ['#f0d060', '#8a6a20'],
  rug: ['#b8506a', '#7c2f44'],
  chair: ['#8a6a44', '#5a4429'],
  table: ['#a8814e', '#6d5231'],
  plant: ['#4f9c46', '#2f6b2c'],
  shelf: ['#9a8a72', '#66594a'],
  banner: ['#e8c060', '#a5822c'],
  hearth: ['#e07a3c', '#8a4520'],
};

function drawFurniture(ctx, id, sx, sy, g) {
  const [light, dark] = FURN[id] || ['#9a8a72', '#66594a'];
  const w = g.w * TILE, h = g.h * TILE;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(sx + 2, sy + h - 4, w - 4, 3);
  ctx.fillStyle = dark; ctx.fillRect(sx + 1, sy + 3, w - 2, h - 5);
  ctx.fillStyle = light; ctx.fillRect(sx + 2, sy + 4, w - 4, h - 7);
  if (id === 'lamp' || id === 'hearth') {
    ctx.fillStyle = '#fff4c0';
    ctx.fillRect(sx + Math.floor(w / 2) - 2, sy + 6, 4, 3);
  }
  if (id === 'plant') {
    ctx.fillStyle = dark;
    ctx.fillRect(sx + 4, sy + 1, 2, 4); ctx.fillRect(sx + 10, sy + 1, 2, 4);
    ctx.fillStyle = light;
    ctx.fillRect(sx + 6, sy, 4, 5);
  }
  if (id === 'banner') {
    ctx.fillStyle = '#2b3450';
    ctx.fillRect(sx + 5, sy + 7, 3, 2); ctx.fillRect(sx + w - 8, sy + 7, 3, 2);
  }
}


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
  // Your own Pokemon carries a full monster; the companion's dog is just a
  // species id, because she belongs to somebody else's party.
  const sp = getSpecies(e.mon ? e.mon.species : e.species);
  if (!sp) return;
  const pos = world.renderPos(e);
  const sx = Math.round(pos.x - camera.x - (PARTNER_SIZE - TILE) / 2);
  const sy = Math.round(pos.y - camera.y - (PARTNER_SIZE - TILE));
  const bob = e.moving ? Math.round(Math.sin(e.moveT * 0.55) * 1.2) : 0;

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = PAL.black;
  ctx.fillRect(Math.round(pos.x - camera.x) + 3, Math.round(pos.y - camera.y) + 12, 10, 3);
  ctx.globalAlpha = 1;

  const img = renderMonster(sp.art, { size: PARTNER_SIZE, shiny: !!(e.mon && e.mon.shiny) });
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

  // WRAP, do not truncate.
  //
  // The narrowest screen this runs on fits thirty characters here, and the
  // bar used to cut the line off with an ellipsis: "Leave Twinleaf to the n…"
  // is not an instruction, it is the first half of one. The whole point of
  // this bar is that somebody picking the game up after three weeks knows
  // what they were doing, so it takes the room it needs — up to three lines,
  // which is more than anything it says.
  const words = String(text).replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) { line = next; continue; }
    if (line) lines.push(line);
    line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
  }
  if (line) lines.push(line);
  while (lines.length > 3) lines.pop();

  const w = Math.max(...lines.map((l) => l.length)) * 6 + 16;
  const h = 4 + lines.length * 9;
  const x = 4;
  const y = yBelow;
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = PAL.uiFrame;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(PAL.uiFrame, 0.22);
  ctx.fillRect(x, y, w, 1);
  ctx.globalAlpha = 1;
  // A small chevron, so it reads as an instruction rather than a caption.
  drawText(ctx, '\u25b8', x + 4, y + 3, { color: PAL.uiHighlight });
  lines.forEach((l, i) => drawText(ctx, l, x + 11, y + 3 + i * 9, { color: PAL.uiTextLight }));
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
