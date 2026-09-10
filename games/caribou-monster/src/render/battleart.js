// The battle scene, from the DS.
//
// The generated backdrop — a flat sky, a striped ground band and two drawn
// ellipses — is still here for caves and indoor fights, which Platinum's
// Field (Day) art would be wrong for. Outdoors, this is the real thing.
//
// The art is 256x152, the DS's own battle-screen size. Our logical screen is
// 192 tall and between 256 and 400 wide, so the backdrop is pinned to the
// BOTTOM and drawn at native size: a wider phone sees more field to the
// sides, never a stretched picture.
import { BATTLE_ART } from './_gen_battle.js';

const cache = new Map();

function part(name) {
  if (cache.has(name)) return cache.get(name);
  const rec = BATTLE_ART[name];
  if (!rec || typeof Image === 'undefined') { cache.set(name, null); return null; }
  const img = new Image();
  img.decoding = 'sync';
  img.src = `data:image/png;base64,${rec.png}`;
  cache.set(name, img);
  return img;
}

const ready = (img) => !!img && img.complete && img.naturalWidth > 0;

/** True once every piece of the outdoor scene has decoded. */
export function battleArtReady() {
  return ready(part('field_day')) && ready(part('base_foe')) && ready(part('base_player'));
}

/**
 * Draws the outdoor scene. Returns false if the art is not usable yet, so the
 * caller falls back to the drawn one rather than showing a blank screen.
 *
 * `foe` and `player` are the two platform centres the combatants stand on, in
 * logical pixels, so the sprites and the bases cannot drift apart. The bases
 * are drawn at native size — they are objects with a shape, not a gradient,
 * and stretching them would show.
 */
export function drawBattleScene(ctx, W, H, foe, player) {
  if (!battleArtReady()) return false;
  const bg = part('field_day');
  const bf = part('base_foe');
  const bp = part('base_player');

  // The backdrop is horizontal bands, so it stretches sideways to any width
  // without artefacts — and a stretch has no seam, which tiling a 256px image
  // across a 384px phone very visibly does.
  const top = Math.max(0, H - bg.naturalHeight);
  if (top > 0) {
    // Extend the topmost row upward rather than cutting the sky off flat.
    ctx.drawImage(bg, 0, 0, bg.naturalWidth, 1, 0, 0, W, top);
  }
  ctx.drawImage(bg, 0, 0, bg.naturalWidth, bg.naturalHeight, 0, top, W, bg.naturalHeight);

  ctx.drawImage(bf, Math.round(foe.x - bf.naturalWidth / 2), Math.round(foe.y - bf.naturalHeight / 2));
  ctx.drawImage(bp, Math.round(player.x - bp.naturalWidth / 2), Math.round(player.y - bp.naturalHeight / 2));
  return true;
}
