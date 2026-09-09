// What the world is saying right now.
//
// An NPC's `dialogue` may be a plain array of lines (the simple case) or a
// list of conditional entries. Each entry carries a `when` clause; the first
// one whose clause holds is what that person says today. Lines are templated
// against a live snapshot of the save, so a villager who mentions the world
// champion names whoever is *actually* number one at that moment — and starts
// naming the player once the player takes the spot.
//
// The point is that none of this is scenery. Every fact an NPC states is read
// out of the same state the systems run on, so the world cannot drift out of
// step with itself.
import { RANKS, getPro, RIVAL_PRO, getTournament } from '../../data/circuit.js';
import { standings, currentRank, headToHead } from '../circuit/circuit.js';
import { displayName } from '../monster.js';
import { getSpecies } from '../../data/species.js';
import { caughtCount, seenCount } from '../pokedex.js';

/**
 * Everything an NPC is allowed to know. Built once per conversation so a long
 * exchange cannot contradict itself halfway through.
 */
export function worldSnapshot(state) {
  const c = state.circuit || {};
  const rows = c.pros ? standings(c, state.player.name) : [];
  const top = rows[0] || null;
  const me = rows.find((r) => r.isPlayer) || null;
  // The best trainer who is *not* the player. Once the player takes the top
  // spot, {champion} becomes them — so anything that needs to point at the
  // establishment ("I had their posters up") needs this instead.
  const topPro = rows.find((r) => !r.isPlayer) || null;
  const rank = c.pros ? currentRank(c) : RANKS[0];
  const rival = getPro(RIVAL_PRO);
  const h2h = c.h2h ? headToHead(c, RIVAL_PRO) : { w: 0, l: 0 };
  const lead = state.party && state.party[0];
  const lastTitleId = c.titles && c.titles.length ? c.titles[c.titles.length - 1] : null;
  const lastTitle = lastTitleId ? getTournament(lastTitleId) : null;
  const starter = state.starterBase != null ? getSpecies(state.starterBase) : null;

  return {
    state,
    flags: state.flags || {},
    badges: (state.badges || []).length,
    party: state.party || [],
    caught: caughtCount(state.dex),
    seen: seenCount(state.dex),
    money: state.inventory ? state.inventory.money : 0,

    playerName: state.player.name,
    starter: starter ? starter.name : 'your first partner',
    lead: lead ? displayName(lead) : 'your Pokémon',
    leadLevel: lead ? lead.level : 0,

    // Circuit standing. `champion` is whoever tops the live table — which is
    // the player, once the player is good enough.
    joined: !!c.joined,
    rank: rank.name,
    rankId: rank.id,
    cp: c.cp || 0,
    rating: c.rating || 0,
    titles: (c.titles || []).length,
    // How the press and the locker room see you — the running total of every
    // answer given at a press conference.
    hype: c.hype || 0,
    respect: c.respect || 0,
    lastTitle: lastTitle ? lastTitle.short : null,
    streak: c.streak || 0,
    place: me ? me.place : null,
    champion: top ? top.name : 'Nadia Sable',
    championTag: top && top.tag ? top.tag : 'The Standard',
    championIsPlayer: !!(top && top.isPlayer),
    topPro: topPro ? topPro.name : 'Nadia Sable',
    topProTag: topPro && topPro.tag ? topPro.tag : 'The Standard',
    rival: rival ? rival.name : 'Cass Wren',
    rivalRating: c.pros && rival ? c.pros[rival.id].rating : 0,
    rivalLead: `${h2h.w}-${h2h.l}`,
    beatRival: h2h.w > h2h.l,
    headline: c.news && c.news.length ? c.news[0].headline : null,
    activeEvent: c.active ? (getTournament(c.active.id) || {}).short : null,
  };
}

// ---- conditions -------------------------------------------------------------
// Small on purpose. Every clause is a plain object key, so a condition is
// readable in the map data and checkable by tools/audit.mjs.

const RANK_ORDER = RANKS.map((r) => r.id);

/**
 * Every clause `matches` understands. Exported so tools/audit.mjs checks
 * against the resolver itself rather than against a copy of this list that
 * somebody has to remember to update.
 */
export const CLAUSES = Object.freeze([
  'all', 'any', 'not',
  'flag', 'notFlag',
  'badges', 'maxBadges', 'caught', 'party', 'leadLevel', 'starter',
  'joined', 'rank', 'titles', 'streak', 'hype', 'respect',
  'champion', 'beatRival', 'inEvent', 'topTen',
]);
const CLAUSE_SET = new Set(CLAUSES);
export function isKnownClause(k) { return CLAUSE_SET.has(k); }

/** The rank ids a `when: { rank: ... }` clause may name. */
export const RANK_IDS = Object.freeze(RANK_ORDER.slice());

export function matches(when, s) {
  if (!when) return true;
  if (Array.isArray(when)) return when.every((w) => matches(w, s));

  for (const [k, v] of Object.entries(when)) {
    switch (k) {
      case 'all': if (!v.every((w) => matches(w, s))) return false; break;
      case 'any': if (!v.some((w) => matches(w, s))) return false; break;
      case 'not': if (matches(v, s)) return false; break;

      case 'flag': if (!s.flags[v]) return false; break;
      case 'notFlag': if (s.flags[v]) return false; break;

      case 'badges': if (s.badges < v) return false; break;
      case 'maxBadges': if (s.badges > v) return false; break;
      case 'caught': if (s.caught < v) return false; break;
      case 'party': if (s.party.length < v) return false; break;
      case 'leadLevel': if (s.leadLevel < v) return false; break;
      case 'starter': if (s.starter !== v) return false; break;

      case 'joined': if (s.joined !== v) return false; break;
      case 'rank': {
        // Resolved strictly rather than through rankIndex(), which clamps an
        // unknown id to 0 — that made a typo'd rank a condition that always
        // passed, firing an end-game line on a brand-new save.
        const want = RANK_ORDER.indexOf(v);
        if (want < 0 || RANK_ORDER.indexOf(s.rankId) < want) return false;
        break;
      }
      case 'titles': if (s.titles < v) return false; break;
      case 'streak': if (s.streak < v) return false; break;
      case 'hype': if (s.hype < v) return false; break;
      case 'respect': if (s.respect < v) return false; break;
      case 'champion': if (s.championIsPlayer !== v) return false; break;
      case 'beatRival': if (s.beatRival !== v) return false; break;
      case 'inEvent': if (!!s.activeEvent !== v) return false; break;
      case 'topTen': if ((s.place == null || s.place > 10) === v) return false; break;

      default: return false;   // an unknown clause never silently passes
    }
  }
  return true;
}

// ---- templating -------------------------------------------------------------

const SLOTS = new Set([
  'player', 'starter', 'lead', 'leadLevel', 'badges', 'caught', 'seen',
  'champion', 'championTag', 'topPro', 'topProTag', 'rank', 'cp', 'rating', 'place', 'titles',
  'lastTitle', 'streak', 'rival', 'rivalRating', 'rivalLead', 'event', 'headline',
  'hype', 'respect',
]);

export function isKnownSlot(name) { return SLOTS.has(name); }

export function fill(line, s) {
  return String(line).replace(/\{(\w+)\}/g, (m, k) => {
    switch (k) {
      case 'player': return s.playerName;
      case 'starter': return s.starter;
      case 'lead': return s.lead;
      case 'leadLevel': return String(s.leadLevel);
      case 'badges': return String(s.badges);
      case 'caught': return String(s.caught);
      case 'seen': return String(s.seen);
      case 'champion': return s.championIsPlayer ? s.playerName : s.champion;
      case 'championTag': return s.championTag;
      case 'topPro': return s.topPro;
      case 'topProTag': return s.topProTag;
      case 'rank': return s.rank;
      case 'cp': return String(s.cp);
      case 'rating': return String(s.rating);
      case 'place': return s.place == null ? '—' : String(s.place);
      case 'titles': return String(s.titles);
      case 'lastTitle': return s.lastTitle || 'nothing yet';
      case 'streak': return String(s.streak);
      case 'hype': return String(s.hype);
      case 'respect': return String(s.respect);
      case 'rival': return s.rival;
      case 'rivalRating': return String(s.rivalRating);
      case 'rivalLead': return s.rivalLead;
      case 'event': return s.activeEvent || 'the circuit';
      case 'headline': return s.headline || 'nothing much';
      default: return m;
    }
  });
}

/** Fills a single string against the live world. Used for signs and notices. */
export function fillText(text, state) { return fill(text, worldSnapshot(state)); }

// ---- resolution -------------------------------------------------------------

/**
 * Picks what this NPC says now.
 *
 * `dialogue` is either a flat array of lines, or a list of entries:
 *   { when: <condition>, lines: [...] }          one fixed conversation
 *   { when: <condition>, pool: [[...], [...]] }  rotates on each talk
 *
 * Entries are tried in order and the first match wins, so author the most
 * specific (latest-game) entry first and leave an unconditional one last.
 * `turn` rotates pooled remarks so talking to someone twice is not a repeat.
 */
export function resolveDialogue(dialogue, state, turn = 0) {
  if (!dialogue) return null;
  const s = worldSnapshot(state);
  const flat = Array.isArray(dialogue) && dialogue.every((d) => typeof d === 'string');
  if (flat) return dialogue.map((l) => fill(l, s));

  for (const entry of dialogue) {
    if (typeof entry === 'string') return [fill(entry, s)];
    if (!matches(entry.when, s)) continue;
    let lines = entry.lines;
    if (entry.pool && entry.pool.length) {
      lines = entry.pool[Math.abs(turn) % entry.pool.length];
    }
    if (!lines || !lines.length) continue;
    return lines.map((l) => fill(l, s));
  }
  return null;
}
