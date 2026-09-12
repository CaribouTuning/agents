// Evolution, outside a battle.
//
// The battle screen has always been able to evolve a Pokémon, with the whole
// strobe-and-cross-fade beat. Nothing else could. So a Pokémon that came back
// from the Day Care already past its level, or one whose evolution the player
// stopped with B and later changed their mind about, had no way of ever
// evolving again — it just sat in the party being the wrong shape forever.
//
// This is that same moment, on its own screen, so the party menu can offer it.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL } from '../render/palette.js';
import { rect, window9, label, labelDim } from './kit.js';
import { renderMonster } from '../render/monsterart.js';
import { getSpecies } from '../data/species.js';
import { displayName } from '../game/monster.js';
import { evolveNow } from '../game/evolution.js';

const MON = 64;

export class EvolveScreen extends Screen {
  constructor(game, mon, into, onDone = null) {
    super(game);
    this.pausesBelow = true;
    this.mon = mon;
    this.into = into;
    this.onDone = onDone;
    this.wasCalled = displayName(mon);
    this.t = 0;
    this.done = false;
    this.cancelled = false;
    // The room goes quiet for it, the way the battle screen does.
    audio.stopMusic();
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;

    // Stopping it is a real choice, and it stays possible right up until the
    // moment it finishes — the same window the battle gives.
    if (!this.done && !this.cancelled
      && (input.pressed('b') || input.pressed('exit'))) {
      this.cancelled = true;
      audio.sfx('back');
      this.t = 0;
      return;
    }
    if (this.cancelled) {
      if (this.t > 1.6 || input.pressed('a') || input.consumeTap()) this._finish();
      return;
    }
    if (!this.done && this.t >= 3.2) {
      this.done = true;
      this.t = 0;
      evolveNow(this.mon, this.into);
      audio.sfx('badge');
      return;
    }
    if (this.done && (this.t > 2.6 || input.pressed('a') || input.consumeTap())) this._finish();
  }

  _finish() {
    this.game.screens.pop();
    if (this.game.save) this.game.save.markDirty();
    if (this.onDone) this.onDone(!this.cancelled);
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    rect(ctx, 0, 0, W, H, PAL.black);
    const from = getSpecies(this.mon.species).art;
    const to = getSpecies(this.into).art;
    const cx = W / 2 - 32;
    const cy = H / 2 - 44;

    // The classic beat: a cross-fade with an accelerating strobe.
    const p = this.done || this.cancelled ? 1 : Math.min(1, this.t / 3.2);
    const freq = 2 + p * 22;
    const showNew = this.done || (!this.cancelled && Math.sin(this.t * freq) > 0 && p > 0.25);
    const art = showNew ? to : from;
    const img = renderMonster(art, { size: MON, shiny: this.mon.shiny });
    if (!this.cancelled) {
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(this.t * freq)) * 0.55 * p;
      for (let r = 40; r > 0; r -= 8) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + 32 - r, cy + 32 - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, Math.round(cx), Math.round(cy));

    const y = H - 46;
    window9(ctx, 4, y, W - 8, 42);
    if (this.cancelled) {
      label(ctx, `${this.wasCalled} stopped evolving.`, 12, y + 10);
      labelDim(ctx, 'It can still change its mind later.', 12, y + 24);
    } else if (this.done) {
      label(ctx, `${this.wasCalled} evolved into ${getSpecies(this.into).name}!`, 12, y + 10);
    } else {
      label(ctx, `What? ${this.wasCalled} is evolving!`, 12, y + 10);
      labelDim(ctx, 'B: stop it evolving', 12, y + 24);
    }
  }
}
