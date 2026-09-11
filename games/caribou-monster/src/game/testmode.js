// Test mode: a command console and a chapter jump.
//
// The reason this exists is simple — without it the only way to look at
// anything in the back half of the game is to play the front half again.
// That makes the late content effectively untestable, by me or by anybody
// else.
//
// The interpreter is deliberately kept out of the UI so it can be unit
// tested without a browser: `runCommand` takes a game-shaped object and a
// line of text and returns what to print. The screen in ui/admin.js is a
// thin wrapper around it.
import { MAPS } from '../data/maps/index.js';
import { SPECIES_LIST, getSpecies } from '../data/species.js';
import { ITEMS } from '../data/items.js';
import { BEATS, GYMS } from '../data/campaign.js';
import { FLAGS } from './storyflags.js';
import { tileDef } from '../render/tiles.js';
import { debugGive, debugGiveItem, healParty, awardBadge } from './state.js';

/** Every flag the game knows about, for `/flag` completion and validation. */
export const KNOWN_FLAGS = Object.values(FLAGS);

/**
 * A spot on a map that the player can legitimately stand on.
 *
 * `/warp somewhere` with no coordinates has to land the player somewhere
 * real. Preferring the heal point, then a door, then the first walkable
 * tile means a warp never drops anybody inside a tree.
 */
export function spawnPointFor(mapId) {
  const map = MAPS[mapId];
  if (!map) return null;
  if (map.healPoint && map.healPoint.map === mapId) {
    return { x: map.healPoint.x, y: map.healPoint.y };
  }
  for (const other of Object.values(MAPS)) {
    for (const w of other.warps) {
      if (w.to !== mapId) continue;
      const d = tileDef(map.tiles[w.ty] && map.tiles[w.ty][w.tx]);
      if (d && !d.solid) return { x: w.tx, y: w.ty };
    }
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const d = tileDef(map.tiles[y][x]);
      if (d && !d.solid && !d.water) return { x, y };
    }
  }
  return null;
}

/**
 * Everything true at a given story beat.
 *
 * Derived from the campaign spine rather than written out again, so a
 * chapter can never drift from the story it is meant to be a snapshot of.
 * Jumping to a beat sets every beat before it too — the game is a line and
 * arriving in the middle of it with the earlier flags unset is not a state
 * the game was ever in.
 */
export function chapterState(flag) {
  const idx = BEATS.findIndex((b) => b.flag === flag);
  if (idx < 0) return null;
  const upTo = BEATS.slice(0, idx + 1);
  const flags = {};
  for (const b of upTo) flags[b.flag] = true;
  // Badges are their own list as well as flags, and the two have to agree.
  const badges = GYMS.filter((g) => flags[`badge${g.n}`]).map((g) => g.n);
  return { flags, badges, where: BEATS[idx].where, text: BEATS[idx].text };
}

/** The chapters that have somewhere to stand — the ones built so far. */
export function playableChapters() {
  return BEATS.filter((b) => MAPS[b.where]);
}

function ok(text) { return { ok: true, text }; }
function no(text) { return { ok: false, text }; }

/** Resolve a species by dex number or by name, case-insensitively. */
function findSpecies(token) {
  if (/^\d+$/.test(token)) return getSpecies(Number(token)) || null;
  const want = token.toLowerCase();
  return SPECIES_LIST.find((s) => s.name.toLowerCase() === want)
    || SPECIES_LIST.find((s) => s.name.toLowerCase().startsWith(want))
    || null;
}

const HM_IDS = ['hm01', 'hm02', 'hm03', 'hm04', 'hm05', 'hm06', 'hm07', 'hm08']
  .filter((id) => ITEMS[id]);

export const COMMANDS = [
  ['/help', 'this list'],
  ['/where', 'what map you are on'],
  ['/warp <map> [x y]', 'go anywhere'],
  ['/maps [text]', 'list map names'],
  ['/chapter <beat>', 'jump to a point in the story'],
  ['/chapters', 'list the story beats'],
  ['/give <item> [n]', 'put an item in the bag'],
  ['/items [text]', 'list item ids'],
  ['/mon <name|dex> [lv]', 'add a Pokémon to the party'],
  ['/shiny', 'make the lead Pokémon shiny'],
  ['/level <n>', 'set the whole party to a level'],
  ['/heal', 'heal the party'],
  ['/badge [n]', 'award a badge, or the next one'],
  ['/badges', 'award all eight'],
  ['/hms', 'every HM, so every obstacle answers'],
  ['/money <n>', 'set the wallet'],
  ['/flag <name> [off]', 'set or clear a story flag'],
  ['/flags [text]', 'list flags and their state'],
  ['/dex', 'fill in the Pokédex'],
];

/**
 * Run one console line.
 *
 * `game` needs `state`, and — for anything that moves the player — an
 * `overworld.world.load(map, x, y, dir)`. Commands that need the world say
 * so rather than throwing when it is absent, which is what lets the unit
 * test drive the whole interpreter with a bare state object.
 */
export function runCommand(game, line) {
  const raw = String(line || '').trim();
  if (!raw) return no('');
  const parts = raw.replace(/^\//, '').split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  const st = game.state;

  switch (cmd) {
    case 'help':
      return ok(COMMANDS.map(([c, d]) => `${c} — ${d}`).join('\n'));

    case 'where': {
      const p = st.player;
      const m = MAPS[p.map];
      return ok(`${m ? m.name : p.map} (${p.map}) at ${p.x},${p.y}`);
    }

    case 'maps': {
      const f = (args[0] || '').toLowerCase();
      const ids = Object.keys(MAPS).filter((id) => !f || id.includes(f));
      if (!ids.length) return no(`no map matches "${f}"`);
      return ok(`${ids.length} map(s):\n${ids.join(', ')}`);
    }

    case 'warp': {
      if (!args[0]) return no('which map? try /maps');
      const id = args[0].toLowerCase();
      if (!MAPS[id]) return no(`no such map: ${id}`);
      let x = Number(args[1]);
      let y = Number(args[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        const spot = spawnPointFor(id);
        if (!spot) return no(`${id} has nowhere to stand`);
        x = spot.x; y = spot.y;
      }
      if (!game.overworld || !game.overworld.world) return no('not in the world yet');
      game.overworld.world.load(id, x, y, 'down');
      return ok(`warped to ${MAPS[id].name} at ${x},${y}`);
    }

    case 'chapters':
      return ok(playableChapters().map((b) => `${b.flag} — ${b.text}`).join('\n'));

    case 'chapter': {
      if (!args[0]) return no('which beat? try /chapters');
      const snap = chapterState(args[0]);
      if (!snap) return no(`no such beat: ${args[0]}`);
      Object.assign(st.flags, snap.flags);
      st.badges = snap.badges.slice();
      // A chapter is useless without a team that can survive it.
      if (!st.party.length) debugGive(st, 387, 5);
      const level = Math.max(5, 8 + snap.badges.length * 6);
      for (const m of st.party) if (!m.isEgg) m.level = Math.max(m.level, level);
      for (const id of HM_IDS) debugGiveItem(st, id, 1);
      healParty(st);
      if (MAPS[snap.where] && game.overworld && game.overworld.world) {
        const spot = spawnPointFor(snap.where);
        if (spot) game.overworld.world.load(snap.where, spot.x, spot.y, 'down');
      }
      return ok(`chapter: ${snap.text}\n${snap.badges.length} badge(s), party at Lv${level}`);
    }

    case 'give': {
      if (!args[0]) return no('which item? try /items');
      const id = args[0].toLowerCase();
      if (!ITEMS[id]) return no(`no such item: ${id}`);
      const n = Math.max(1, Number(args[1]) || 1);
      debugGiveItem(st, id, n);
      return ok(`${n}x ${ITEMS[id].name}`);
    }

    case 'items': {
      const f = (args[0] || '').toLowerCase();
      const ids = Object.keys(ITEMS).filter((id) => !f || id.includes(f));
      if (!ids.length) return no(`no item matches "${f}"`);
      return ok(`${ids.length} item(s):\n${ids.join(', ')}`);
    }

    case 'mon': {
      if (!args[0]) return no('which Pokémon?');
      const sp = findSpecies(args[0]);
      if (!sp) return no(`no such Pokémon: ${args[0]}`);
      const lv = Math.min(100, Math.max(1, Number(args[1]) || 5));
      debugGive(st, sp.id, lv);
      return ok(`${sp.name} Lv${lv} joined`);
    }

    case 'shiny': {
      const lead = st.party.find((m) => m && !m.isEgg);
      if (!lead) return no('no Pokémon to make shiny');
      lead.shiny = true;
      return ok(`${lead.nickname || getSpecies(lead.species).name} is shiny`);
    }

    case 'level': {
      const lv = Math.min(100, Math.max(1, Number(args[0]) || 0));
      if (!lv) return no('what level?');
      for (const m of st.party) if (!m.isEgg) m.level = lv;
      healParty(st);
      return ok(`party set to Lv${lv}`);
    }

    case 'heal':
      healParty(st);
      return ok('party healed');

    case 'badge': {
      const n = Number(args[0]) || st.badges.length + 1;
      const gym = GYMS.find((g) => g.n === n);
      if (!gym) return no(`there is no badge ${n}`);
      awardBadge(st, n, gym.badge);
      return ok(`${gym.badge} awarded`);
    }

    case 'badges':
      for (const g of GYMS) awardBadge(st, g.n, g.badge);
      return ok('all eight badges awarded');

    case 'hms': {
      if (!HM_IDS.length) return no('no HMs exist yet');
      for (const id of HM_IDS) debugGiveItem(st, id, 1);
      return ok(`${HM_IDS.length} HM(s) in the bag`);
    }

    case 'money': {
      const n = Number(args[0]);
      if (!Number.isFinite(n)) return no('how much?');
      st.inventory.money = Math.max(0, Math.min(999999, Math.floor(n)));
      return ok(`wallet set to ${st.inventory.money}`);
    }

    case 'flag': {
      if (!args[0]) return no('which flag? try /flags');
      const name = args[0];
      const off = (args[1] || '').toLowerCase() === 'off';
      st.flags[name] = !off;
      return ok(`${name} = ${!off}`);
    }

    case 'flags': {
      const f = (args[0] || '').toLowerCase();
      const names = [...new Set([...KNOWN_FLAGS, ...Object.keys(st.flags)])]
        .filter((n) => !f || n.toLowerCase().includes(f))
        .sort();
      if (!names.length) return no(`no flag matches "${f}"`);
      return ok(names.map((n) => `${st.flags[n] ? '[x]' : '[ ]'} ${n}`).join('\n'));
    }

    case 'dex': {
      for (const sp of SPECIES_LIST) {
        st.dex.seen[sp.id] = true;
        st.dex.caught[sp.id] = true;
      }
      return ok(`Pokédex filled: ${SPECIES_LIST.length} species`);
    }

    default:
      return no(`unknown command: /${cmd} — try /help`);
  }
}
