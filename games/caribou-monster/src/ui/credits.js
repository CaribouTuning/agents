// The credits.
//
// Not a wall of names — a wall of what happened. The game is for two people,
// so the roll is the story they just finished, in the order they did it, with
// their own names in it and their own team on the last card.
//
// It scrolls on its own, a drag or the D-pad moves it faster, and B leaves.
// Nothing here is a trap: the post-game is already unlocked by the time this
// opens, so skipping the credits costs nothing at all.
import { Screen } from './screen.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { PAL } from '../render/palette.js';
import { rect, drawTextCentered, LINE } from './kit.js';
import { drawBackChip, getBackChip } from './controls.js';
import { renderMonster } from '../render/monsterart.js';
import { getSpecies } from '../data/species.js';
import { displayName } from '../game/monster.js';
import { buddyOf } from '../game/players.js';
import { formatPlayTime } from '../game/state.js';
import { MUSIC } from '../data/music.js';

const hit = (tap, x, y, w, h) => !!tap && tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h;

const SPEED = 16;          // logical pixels per second
const GAP = 14;

/** A line of the roll. `big` is a heading, `art` draws the party instead. */
const L = (text, opts = {}) => ({ text, ...opts });

export class CreditsScreen extends Screen {
  constructor(game, onDone = null) {
    super(game);
    this.onDone = onDone;
    this.y = 0;
    this.t = 0;
    this.lines = this._roll();
  }

  onEnter() { audio.playMusic(MUSIC.title, 'credits'); }

  _roll() {
    const st = this.game.state;
    const me = st.player.name;
    const them = buddyOf(st);
    const f = st.flags || {};
    const out = [
      L('POK\u00e9MON', { big: true }),
      L('FOR SAMMY & MATT', { big: true }),
      L('Sinnoh Region'),
      L(''),
      L('— what happened —', { dim: true }),
      L(''),
      L('A morning in Twinleaf Town'),
      L(`${me} and ${them}, who did not knock`),
      L(''),
      L('Prof. Rowan, who logs ambient light'),
      L('out of an old habit'),
      L(''),
      L('Cass Wren, one year ahead,'),
      L('and getting less so'),
      L(''),
    ];
    if (f.hasBandit || f.banditWithUs) {
      out.push(L('Bandit, who chose a person'), L('and never wavered'), L(''));
    }
    out.push(
      L('Mars, who left the key on the floor'),
      L('because she would not turn it'),
      L(''),
      L('Looker, eight months of paperwork,'),
      L('one minute of it that mattered'),
      L(''),
      L('The Canalave library, Volume III:'),
      L('"They are not keys.'),
      L('Nothing here is a door."'),
      L(''),
      L('— under the hill —', { dim: true }),
      L(''),
      L('Something stood with its back to a door'),
      L('for thirty-one years'),
      L('and nobody came'),
      L(''),
      L('Until two people from Twinleaf'),
      L('worked out what the floor was for'),
      L(''),
    );
    if (f.caughtEverlight) {
      out.push(L('The Everlight came with you.'), L('The rock is just rock now.'), L(''));
    } else {
      out.push(L('The Everlight stayed where it was,'), L('which was always its choice.'), L(''));
    }
    out.push(
      L('— and then —', { dim: true }),
      L(''),
      L('The World Circuit Finals'),
      L(`${me}, number one in the world`),
      L(''),
      L('Somebody asked what the hardest match'),
      L('of the run had been'),
      L(''),
      L('It was not a match.'),
      L(''),
      L('', { art: true }),
      L(''),
      L(`Badges  ${(st.badges || []).length}`),
      L(`Caught  ${Object.keys(st.dex.caught || {}).length}`),
      L(`Time    ${formatPlayTime(st.playTimeMs || 0)}`),
      L(''),
      L('— made for two —', { dim: true }),
      L(''),
      L('for Matthew and Sammy'),
      L(''),
      L('THE END', { big: true }),
      L(''),
      L('Sinnoh is quiet.', { dim: true }),
      L('Keep it that way.', { dim: true }),
      L(''),
    );
    return out;
  }

  get _height() {
    return this.lines.reduce((n, l) => n + (l.art ? 40 : LINE), 0) + this.game.display.height;
  }

  update(dt, isTop) {
    if (!isTop) return;
    this.t += dt;
    let speed = SPEED;
    if (input.isDown('down') || input.isDown('a')) speed = SPEED * 5;
    if (input.isDown('up')) speed = -SPEED * 5;
    const dragged = input.consumeDragRows(1);
    this.y = Math.max(0, this.y + speed * dt - dragged);

    const tap = input.consumeTap();
    const back = getBackChip();
    if (tap && back && hit(tap, back.x, back.y, back.w, back.h)) { this._close(); return; }
    if (input.pressed('b') || input.pressed('start')) { this._close(); return; }
    // It ends by itself, rather than scrolling into an empty screen forever.
    if (this.y > this._height) this._close();
  }

  _close() {
    audio.sfx('back');
    this.game.screens.pop();
    if (this.onDone) this.onDone();
  }

  render(ctx) {
    const { width: W, height: H } = this.game.display;
    // The aurora, one last time.
    for (let y = 0; y < H; y++) {
      const t = y / H;
      const r = Math.round(10 + t * 16), g = Math.round(14 + t * 28), b = Math.round(32 + t * 40);
      rect(ctx, 0, y, W, 1, `rgb(${r},${g},${b})`);
    }
    for (let i = 0; i < 3; i++) {
      const phase = this.t * 0.2 + i * 1.7;
      for (let x = 0; x < W; x += 2) {
        const yy = 20 + i * 11 + Math.sin(x * 0.028 + phase) * 8;
        ctx.globalAlpha = Math.max(0, 0.08 + 0.05 * Math.sin(x * 0.02 + phase * 1.3));
        rect(ctx, x, yy, 2, 14, i % 2 ? '#7ae0b0' : '#9ab8ff');
      }
    }
    ctx.globalAlpha = 1;

    let y = H - this.y;
    for (const l of this.lines) {
      if (l.art) {
        if (y > -44 && y < H + 4) this._party(ctx, W, y);
        y += 40;
        continue;
      }
      if (y > -LINE && y < H + LINE && l.text) {
        drawTextCentered(ctx, l.text, W / 2, y, {
          color: l.big ? '#f8e070' : l.dim ? '#7b8099' : '#e8f4ff',
          scale: l.big ? 2 : 1,
        });
      }
      y += LINE;
    }
    drawBackChip(ctx, W - 40, 3, 'CLOSE');
  }

  /** The team that did it, small, in a row. */
  _party(ctx, W, y) {
    const party = (this.game.state.party || []).slice(0, 6);
    if (!party.length) return;
    const size = 28;
    const total = party.length * (size + 2);
    party.forEach((m, i) => {
      const sp = getSpecies(m.species);
      if (!sp) return;
      const img = renderMonster(sp.art, { size, shiny: m.shiny });
      ctx.drawImage(img, Math.round(W / 2 - total / 2 + i * (size + 2)), Math.round(y));
      void displayName;
    });
  }
}
