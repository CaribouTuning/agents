// The World Circuit engine.
//
// Owns the player's competitive career: rating, points, rank, records, the
// live bracket, and the pro standings that keep moving whether or not the
// player is entered. Like the battle engine it is pure state plus functions —
// it never touches a canvas, which is what lets the UI, the tests and the
// news generator all read the same career.
import {
  RANKS, PROS, PRO_LIST, TOURNAMENTS, RIVAL_PRO, getPro, getTournament,
  rankForCp, rankIndex, nextRank, roundName, roundsFor, pointsForFinish, aiForStyle,
} from '../../data/circuit.js';
import { getSpecies } from '../../data/species.js';
import { movesAtLevel } from '../monster.js';
import { makeRng } from '../../core/rng.js';

// ---- career state ----------------------------------------------------------

export function createCircuit() {
  return {
    joined: false,
    cp: 0,
    rating: 1000,
    peakRating: 1000,
    rank: 'rookie',
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    titles: [],                  // tournament ids won
    entered: [],                 // tournament ids attempted
    hype: 10,                    // press attention, 0-100
    respect: 10,                 // peer standing, 0-100
    week: 1,
    // Pro ratings live here so they drift with results across a save.
    pros: Object.fromEntries(PRO_LIST.map((p) => [p.id, {
      rating: p.rating, wins: 0, losses: 0, titles: 0,
    }])),
    h2h: {},                     // proId -> { w, l }
    news: [],                    // newest first, capped
    active: null,                // live tournament run
    lastPress: null,
    seed: (Math.random() * 0xffffffff) >>> 0,
  };
}

export function serializeCircuit(c) {
  if (!c) return null;
  return {
    ...c,
    pros: JSON.parse(JSON.stringify(c.pros)),
    h2h: JSON.parse(JSON.stringify(c.h2h)),
    titles: [...c.titles],
    entered: [...c.entered],
    news: c.news.slice(0, 40).map((n) => ({ ...n, body: [...n.body] })),
    active: c.active ? JSON.parse(JSON.stringify(c.active)) : null,
  };
}

export function reviveCircuit(raw) {
  const c = createCircuit();
  if (!raw || typeof raw !== 'object') return c;
  Object.assign(c, {
    joined: !!raw.joined,
    cp: Number(raw.cp) || 0,
    rating: Number(raw.rating) || 1000,
    peakRating: Number(raw.peakRating) || 1000,
    wins: Number(raw.wins) || 0,
    losses: Number(raw.losses) || 0,
    streak: Number(raw.streak) || 0,
    bestStreak: Number(raw.bestStreak) || 0,
    hype: Number(raw.hype) || 10,
    respect: Number(raw.respect) || 10,
    week: Number(raw.week) || 1,
    seed: (Number(raw.seed) || 1) >>> 0,
  });
  c.titles = Array.isArray(raw.titles) ? raw.titles.filter((t) => getTournament(t)) : [];
  c.entered = Array.isArray(raw.entered) ? raw.entered.filter((t) => getTournament(t)) : [];
  c.news = Array.isArray(raw.news) ? raw.news.slice(0, 40) : [];
  c.h2h = raw.h2h && typeof raw.h2h === 'object' ? { ...raw.h2h } : {};
  // Pro table is rebuilt from data so a roster change never corrupts a save.
  for (const p of PRO_LIST) {
    const saved = raw.pros && raw.pros[p.id];
    c.pros[p.id] = {
      rating: Number(saved?.rating) || p.rating,
      wins: Number(saved?.wins) || 0,
      losses: Number(saved?.losses) || 0,
      titles: Number(saved?.titles) || 0,
    };
  }
  c.active = raw.active && getTournament(raw.active.id) ? raw.active : null;
  c.lastPress = raw.lastPress && typeof raw.lastPress === 'object' ? raw.lastPress : null;
  c.rank = rankForCp(c.cp).id;
  return c;
}

// ---- rating ----------------------------------------------------------------

const K = 28;
export function expectedScore(a, b) { return 1 / (1 + 10 ** ((b - a) / 400)); }

export function applyElo(ratingA, ratingB, scoreA, k = K) {
  return Math.round(ratingA + k * (scoreA - expectedScore(ratingA, ratingB)));
}

// ---- queries ---------------------------------------------------------------

export function currentRank(c) { return rankForCp(c.cp); }
export function rankProgress(c) {
  const next = nextRank(c.cp);
  if (!next) return { next: null, frac: 1, need: 0 };
  const cur = currentRank(c);
  const span = next.cp - cur.cp;
  return { next, frac: span > 0 ? (c.cp - cur.cp) / span : 1, need: next.cp - c.cp };
}

export function canEnter(c, t) {
  if (c.active) return { ok: false, why: 'You are already in a tournament.' };
  return rankIndex(currentRank(c).id) >= t.requires
    ? { ok: true }
    : { ok: false, why: `Requires ${RANKS[t.requires].name}.` };
}

export function availableTournaments(c) {
  return TOURNAMENTS.map((t) => ({ t, gate: canEnter(c, t) }));
}

/** The world ranking: pros and the player in one table, best first. */
export function standings(c, playerName) {
  const rows = PRO_LIST.map((p) => ({
    id: p.id, name: p.name, tag: p.tag, region: p.region,
    rating: c.pros[p.id].rating,
    wins: c.pros[p.id].wins, losses: c.pros[p.id].losses, titles: c.pros[p.id].titles,
    isPlayer: false,
  }));
  rows.push({
    id: 'player', name: playerName, tag: currentRank(c).name, region: 'Sinnoh',
    rating: c.rating, wins: c.wins, losses: c.losses, titles: c.titles.length, isPlayer: true,
  });
  rows.sort((a, b) => b.rating - a.rating);
  rows.forEach((r, i) => { r.place = i + 1; });
  return rows;
}

export function playerPlace(c, playerName) {
  return standings(c, playerName).find((r) => r.isPlayer).place;
}

export function headToHead(c, proId) {
  return c.h2h[proId] || { w: 0, l: 0 };
}

// ---- opponents -------------------------------------------------------------

/**
 * Builds a pro's team at a given level. Their species pool is fixed, so a
 * trainer is recognisable across tiers while still scaling with the circuit.
 */
export function proTeam(pro, level, rng) {
  const size = level >= 46 ? 4 : level >= 24 ? 3 : 2;
  const pool = [...pro.pool];
  const team = [];
  for (let i = 0; i < size && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length) % pool.length;
    const species = pool.splice(idx, 1)[0];
    if (!getSpecies(species)) continue;
    const lv = Math.max(2, level - (i === 0 ? 0 : 1 + Math.floor(rng() * 2)));
    team.push({ species, level: lv, moves: movesAtLevel(species, lv) });
  }
  return team;
}

/** A pro packaged as a trainer the existing battle system already understands. */
export function proAsTrainer(pro, level, rng, roundLabel) {
  return {
    id: `circuit_${pro.id}`,
    name: pro.name,
    cls: pro.tag,
    look: pro.look,
    ai: aiForStyle(pro.style),
    prize: Math.round(level * 60),
    intro: pro.lines.pre[Math.floor(rng() * pro.lines.pre.length) % pro.lines.pre.length],
    defeat: pro.lines.lose[Math.floor(rng() * pro.lines.lose.length) % pro.lines.lose.length],
    team: proTeam(pro, level, rng),
    circuit: true,
    roundLabel,
  };
}

// ---- tournament run --------------------------------------------------------

/**
 * Starts a tournament. The bracket is drawn up-front and stored, so a save in
 * the middle of an event resumes exactly where it left off.
 */
export function enterTournament(c, tournamentId) {
  const t = getTournament(tournamentId);
  if (!t) return null;
  const gate = canEnter(c, t);
  if (!gate.ok) return null;

  const rng = makeRng((c.seed ^ (tournamentId.length * 2654435761)) >>> 0);
  c.seed = (c.seed * 1664525 + 1013904223) >>> 0;

  const field = t.field.slice(0, t.entrants - 1).map((id) => getPro(id)).filter(Boolean);
  // Fill any short field from the wider roster so a bracket is always complete.
  const spare = PRO_LIST.filter((p) => !field.includes(p));
  while (field.length < t.entrants - 1 && spare.length) {
    field.push(spare.splice(Math.floor(rng() * spare.length) % spare.length, 1)[0]);
  }

  c.active = {
    id: t.id,
    round: 0,
    rounds: roundsFor(t.entrants),
    // Opponents the player meets, seeded hardest-last.
    ladder: field
      .slice()
      .sort((a, b) => c.pros[a.id].rating - c.pros[b.id].rating)
      .slice(-roundsFor(t.entrants))
      .map((p) => p.id),
    others: field.map((p) => p.id),
    log: [],
    eliminated: false,
    done: false,
  };
  if (!c.entered.includes(t.id)) c.entered.push(t.id);
  return c.active;
}

export function activeTournament(c) {
  return c.active ? getTournament(c.active.id) : null;
}

/** The pro the player faces in the current round. */
export function currentOpponent(c) {
  if (!c.active || c.active.done) return null;
  const id = c.active.ladder[c.active.round];
  return id ? getPro(id) : null;
}

export function currentRoundName(c) {
  const t = activeTournament(c);
  if (!t || !c.active) return '';
  return roundName(t.entrants, c.active.round);
}

/**
 * Records the player's result for the current round and advances the bracket.
 * Returns a summary the caller turns into news.
 */
export function resolveRound(c, won, detail = {}) {
  if (!c.active || c.active.done) return null;
  const t = activeTournament(c);
  const pro = currentOpponent(c);
  const rng = makeRng((c.seed ^ (c.active.round + 1) * 40503) >>> 0);
  c.seed = (c.seed * 1664525 + 1013904223) >>> 0;

  const proRating = pro ? c.pros[pro.id].rating : 1100;
  const before = c.rating;
  c.rating = applyElo(c.rating, proRating, won ? 1 : 0);
  c.peakRating = Math.max(c.peakRating, c.rating);
  if (pro) {
    c.pros[pro.id].rating = applyElo(proRating, before, won ? 0 : 1);
    if (won) c.pros[pro.id].losses++; else c.pros[pro.id].wins++;
    const h = c.h2h[pro.id] || { w: 0, l: 0 };
    if (won) h.w++; else h.l++;
    c.h2h[pro.id] = h;
  }

  if (won) {
    c.wins++;
    c.streak = Math.max(0, c.streak) + 1;
    c.bestStreak = Math.max(c.bestStreak, c.streak);
  } else {
    c.losses++;
    c.streak = 0;
  }

  const roundLabel = roundName(t.entrants, c.active.round);
  const entry = {
    round: c.active.round,
    roundLabel,
    opponent: pro ? pro.id : null,
    opponentName: pro ? pro.name : 'a qualifier',
    won,
    ratingDelta: c.rating - before,
    ...detail,
  };
  c.active.log.push(entry);

  // Everyone else in the draw plays too.
  const sideResults = simulateOtherMatches(c, rng);
  entry.sideResults = sideResults;

  if (!won) {
    c.active.eliminated = true;
    c.active.done = true;
  } else {
    c.active.round++;
    if (c.active.round >= c.active.rounds) c.active.done = true;
  }
  return entry;
}

/**
 * Plays the rest of the round and shrinks the draw.
 *
 * This is single elimination, so the people who lose here are gone: `others`
 * is rewritten to the survivors each round. Without that the same trainer can
 * be knocked out twice, which shows up as phantom results in the standings and
 * as upset stories about people who are already on the plane home.
 *
 * Trainers still on the player's ladder are held out rather than simulated.
 * They are on the player's side of the draw and advance by beating opponents
 * this model does not track — if they could lose here, the bracket would
 * contradict the path the player was told they are walking.
 */
function simulateOtherMatches(c, rng) {
  const run = c.active;
  const out = [];
  const reserved = new Set(run.ladder.slice(run.round));
  const pool = run.others.filter((id) => !reserved.has(id));
  const survivors = [];

  for (let i = 0; i < pool.length; i += 2) {
    const a = pool[i], b = pool[i + 1];
    if (b === undefined) { survivors.push(a); continue; }   // odd one out gets a bye
    const ra = c.pros[a].rating, rb = c.pros[b].rating;
    const aWins = rng() < expectedScore(ra, rb);
    c.pros[a].rating = applyElo(ra, rb, aWins ? 1 : 0);
    c.pros[b].rating = applyElo(rb, ra, aWins ? 0 : 1);
    if (aWins) { c.pros[a].wins++; c.pros[b].losses++; } else { c.pros[b].wins++; c.pros[a].losses++; }
    survivors.push(aWins ? a : b);
    out.push({
      winner: aWins ? a : b,
      loser: aWins ? b : a,
      upset: Math.abs(ra - rb) > 60 && ((aWins && ra < rb) || (!aWins && rb < ra)),
    });
  }

  // The trainer the player just played is out too. (If the player was the one
  // who lost, the run ends and this list is never read again.)
  run.others = [...run.ladder.slice(run.round + 1), ...survivors];
  return out;
}

/**
 * Closes out the run: awards points, money and rank. Returns what changed so
 * the press has something to report.
 */
export function finishTournament(c) {
  if (!c.active) return null;
  const t = activeTournament(c);
  const won = !c.active.eliminated;
  const roundsSurvived = won ? c.active.rounds : c.active.round;
  const points = pointsForFinish(t, roundsSurvived);

  const rankBefore = currentRank(c).id;
  c.cp += points;
  c.rank = currentRank(c).id;
  const rankedUp = c.rank !== rankBefore;

  if (won) {
    if (!c.titles.includes(t.id)) c.titles.push(t.id);
    c.hype = Math.min(100, c.hype + 12);
    c.respect = Math.min(100, c.respect + 8);
  } else {
    c.hype = Math.min(100, c.hype + 3);
  }
  c.week++;

  const summary = {
    tournament: t,
    won,
    points,
    prize: won ? t.prize : Math.round(t.prize * (roundsSurvived / Math.max(1, c.active.rounds)) * 0.4),
    roundsSurvived,
    rankedUp,
    newRank: currentRank(c),
    log: c.active.log,
    firstTitle: won && c.titles.length === 1,
  };
  c.active = null;
  return summary;
}

export function abandonTournament(c) {
  if (!c.active) return;
  c.losses++;
  c.streak = 0;
  c.rating = Math.max(600, c.rating - 12);
  c.active = null;
}

// ---- ranked link play ------------------------------------------------------

/** A player-versus-player link battle counts towards the world ranking. */
export function recordLinkResult(c, won, opponentName) {
  const before = c.rating;
  // Peers on the link ladder are treated as an even-money opponent; the
  // circuit cannot verify their rating, so it never over-rewards a win.
  c.rating = applyElo(c.rating, c.rating, won ? 1 : 0, 16);
  if (won) {
    c.wins++;
    c.streak = Math.max(0, c.streak) + 1;
    c.bestStreak = Math.max(c.bestStreak, c.streak);
    c.cp += 25;
    c.hype = Math.min(100, c.hype + 2);
  } else {
    c.losses++;
    c.streak = 0;
    c.cp += 5;
  }
  const rankBefore = c.rank;
  c.rank = currentRank(c).id;
  return {
    won, opponentName, ratingDelta: c.rating - before,
    rankedUp: c.rank !== rankBefore, newRank: currentRank(c),
  };
}

// ---- off-screen season -----------------------------------------------------

/**
 * Advances the pro season without the player. Called when a tournament ends so
 * the ladder above them keeps moving — the thing that makes a rank feel earned
 * rather than handed out.
 */
export function simulateSeasonWeek(c) {
  const rng = makeRng((c.seed ^ (c.week * 2246822519)) >>> 0);
  c.seed = (c.seed * 1664525 + 1013904223) >>> 0;
  const ids = PRO_LIST.map((p) => p.id);
  const results = [];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const a = ids[i], b = ids[i + 1];
    const ra = c.pros[a].rating, rb = c.pros[b].rating;
    const aWins = rng() < expectedScore(ra, rb);
    c.pros[a].rating = applyElo(ra, rb, aWins ? 1 : 0);
    c.pros[b].rating = applyElo(rb, ra, aWins ? 0 : 1);
    if (aWins) { c.pros[a].wins++; c.pros[b].losses++; } else { c.pros[b].wins++; c.pros[a].losses++; }
    results.push({ winner: aWins ? a : b, loser: aWins ? b : a,
      upset: Math.abs(ra - rb) > 60 && ((aWins && ra < rb) || (!aWins && rb < ra)) });
  }
  return results;
}

export { RANKS, PROS, PRO_LIST, TOURNAMENTS, RIVAL_PRO, getPro, getTournament, roundName };
