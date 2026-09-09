// The circuit press desk.
//
// Turns things that actually happened into things the feed can print. Every
// item is generated from real career state — a headline never mentions a
// score, an opponent or a rank the engine did not produce. The templates live
// in data/news.js; the numbers come from here.
import {
  OUTLETS, ANALYSTS, HEADLINES, BODIES, ANALYST_QUOTES, PRESS_QUESTIONS, pickFrom,
} from '../../data/news.js';
import { getPro, getTournament, RIVAL_PRO } from '../../data/circuit.js';
import { makeRng } from '../../core/rng.js';
import { standings, headToHead, currentRank } from './circuit.js';

const MAX_ITEMS = 40;

// Each generated item gets its own deterministic stream so the same event
// always reads the same way, even after a save/load cycle.
function streamFor(c, salt) {
  c.seed = (c.seed * 1664525 + 1013904223) >>> 0;
  return makeRng((c.seed ^ (salt >>> 0)) >>> 0);
}

function hashOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

/** Pushes an item onto the feed, newest first, and trims the tail. */
export function pushNews(c, item) {
  c.news.unshift(item);
  if (c.news.length > MAX_ITEMS) c.news.length = MAX_ITEMS;
  return item;
}

function makeItem(c, rng, kind, headline, body, opts = {}) {
  return {
    id: `n${c.week}_${c.news.length}_${(rng() * 1e6) | 0}`,
    week: c.week,
    kind,
    outlet: (opts.outlet || pickFrom(OUTLETS, rng)).name,
    headline,
    body: body.filter(Boolean),
    big: !!opts.big,
  };
}

function analyst(rng) { return pickFrom(ANALYSTS, rng); }

function quoteBlock(rng, mood) {
  const bank = ANALYST_QUOTES[mood];
  if (!bank) return [];
  return [fill(pickFrom(BODIES.quoteIntro, rng), { analyst: analyst(rng) }), pickFrom(bank, rng)];
}

// ---- event reporters -------------------------------------------------------

/** The player files their first entry. */
export function reportDebut(c, playerName, tournament) {
  const rng = streamFor(c, hashOf(`debut${tournament.id}`));
  const vars = { p: playerName, t: tournament.short };
  return pushNews(c, makeItem(c, rng, 'debut',
    fill(pickFrom(HEADLINES.debut, rng), vars),
    [
      `${playerName} has been accepted into the ${tournament.name}, a ${tournament.tier.toLowerCase()} event at the ${tournament.venue}.`,
      tournament.blurb,
    ]));
}

/** The draw for a tournament the player just entered. */
export function reportDraw(c, playerName, tournament, run) {
  const rng = streamFor(c, hashOf(`draw${tournament.id}${c.week}`));
  const names = run.ladder.map((id) => (getPro(id) || {}).name).filter(Boolean);
  const vars = { p: playerName, t: tournament.short, n: tournament.entrants };
  const body = [
    `${tournament.entrants} trainers, ${run.rounds} rounds, single elimination at the ${tournament.venue}.`,
  ];
  if (names.length) {
    body.push(`${playerName}'s side of the draw: ${names.join(', then ')}.`);
  }
  const top = standings(c, playerName)[0];
  if (top) body.push(`${top.name} goes in as the highest-rated trainer in the field at ${top.rating}.`);
  return pushNews(c, makeItem(c, rng, 'preview',
    fill(pickFrom(HEADLINES.preview, rng), vars), body));
}

/**
 * A completed round. `entry` is what resolveRound returned; `detail` carries
 * the battle facts (survivors, turns, star Pokémon) so the copy is specific.
 */
export function reportMatch(c, playerName, tournament, entry) {
  const rng = streamFor(c, hashOf(`m${tournament.id}${entry.round}${entry.won}`));
  const survivors = Number(entry.survivors) || 0;
  const turns = Number(entry.turns) || 0;
  const close = entry.won ? survivors <= 1 : (Number(entry.oppSurvivors) || 0) <= 1;
  const dominant = entry.won && survivors >= 3;

  const bank = entry.won
    ? (dominant ? HEADLINES.matchWinDominant : close ? HEADLINES.matchWinClose : HEADLINES.matchWin)
    : (close ? HEADLINES.matchLossClose : HEADLINES.matchLoss);

  const vars = {
    p: playerName, o: entry.opponentName, t: tournament.short,
    round: entry.roundLabel.toLowerCase(), n: entry.won ? survivors : turns,
  };
  const body = [fill(pickFrom(entry.won ? BODIES.matchWin : BODIES.matchLoss, rng),
    { ...vars, n: turns || survivors })];

  const delta = Number(entry.ratingDelta) || 0;
  body.push(`Rating: ${c.rating} (${delta >= 0 ? '+' : ''}${delta}).`);

  if (entry.star) {
    body.push(fill(pickFrom(BODIES.star, rng), { mon: entry.star, p: playerName, n: c.wins }));
  }
  body.push(...quoteBlock(rng, dominant ? 'dominant' : entry.won ? 'rising' : 'struggling'));

  const item = pushNews(c, makeItem(c, rng, entry.won ? 'matchWin' : 'matchLoss',
    fill(pickFrom(bank, rng), vars), body, { big: !entry.won }));

  reportSideResults(c, tournament, entry.sideResults || []);
  if (entry.won && c.streak >= 3) reportStreak(c, playerName);
  if (entry.opponent === RIVAL_PRO) reportRivalry(c, playerName);
  return item;
}

/** Upsets elsewhere in the bracket. Only the notable ones get printed. */
function reportSideResults(c, tournament, results) {
  for (const r of results) {
    if (!r.upset) continue;
    const loser = getPro(r.loser);
    const winner = getPro(r.winner);
    if (!loser || !winner) continue;
    const rng = streamFor(c, hashOf(`u${tournament.id}${r.loser}${r.winner}${c.week}`));
    pushNews(c, makeItem(c, rng, 'upset',
      fill(pickFrom(HEADLINES.upset, rng), { o: loser.name, t: tournament.short }),
      [
        `${winner.name} (${c.pros[r.winner].rating}) beat ${loser.name} (${c.pros[r.loser].rating}) on the other side of the ${tournament.short} draw.`,
        ...quoteBlock(rng, 'upset'),
      ]));
    break; // one upset story per round is plenty
  }
}

function reportStreak(c, playerName) {
  const rng = streamFor(c, hashOf(`streak${c.streak}`));
  pushNews(c, makeItem(c, rng, 'streak',
    fill(pickFrom(HEADLINES.streak, rng), { p: playerName, streak: c.streak }),
    [
      `${playerName} has won ${c.streak} sanctioned matches in a row. Career best: ${c.bestStreak}.`,
      ...(c.streak >= 5 ? quoteBlock(rng, 'rising') : []),
    ]));
}

function reportRivalry(c, playerName) {
  const rival = getPro(RIVAL_PRO);
  if (!rival) return;
  const h = headToHead(c, RIVAL_PRO);
  if (h.w + h.l < 2) return;
  const rng = streamFor(c, hashOf(`rivalry${h.w}${h.l}`));
  const leader = h.w >= h.l ? playerName : rival.name;
  const trailer = h.w >= h.l ? rival.name : playerName;
  pushNews(c, makeItem(c, rng, 'rivalry',
    fill(pickFrom(HEADLINES.rivalry, rng),
      { p: leader, o: trailer, n: `${Math.max(h.w, h.l)}-${Math.min(h.w, h.l)}` }),
    [
      `${playerName} and ${rival.name} have now met ${h.w + h.l} times.`,
      h.w === h.l
        ? `The series is level at ${h.w}-${h.l}.`
        : `${leader} leads the series ${Math.max(h.w, h.l)}-${Math.min(h.w, h.l)}.`,
      ...quoteBlock(rng, 'rivalry'),
    ], { big: true }));
}

/** The end of a run: title, or elimination, plus any promotion. */
export function reportTournamentResult(c, playerName, summary) {
  const t = summary.tournament;
  const rng = streamFor(c, hashOf(`fin${t.id}${summary.won}${c.week}`));
  const vars = { p: playerName, t: t.short, n: summary.points, r: summary.newRank.name };

  if (summary.won) {
    const bank = summary.firstTitle ? HEADLINES.titleWinFirst : HEADLINES.titleWin;
    pushNews(c, makeItem(c, rng, 'titleWin',
      fill(pickFrom(bank, rng), { ...vars, t: t.short.toUpperCase() }),
      [
        fill(pickFrom(BODIES.titleWin, rng), vars),
        `Prize money: ₽${summary.prize.toLocaleString('en-US')}. Circuit Points: +${summary.points}.`,
        `${playerName} is now ranked #${playerPlaceSafe(c, playerName)} in the world at ${c.rating}.`,
        ...quoteBlock(rng, 'dominant'),
      ], { big: true }));
  }

  if (summary.rankedUp) {
    const r2 = streamFor(c, hashOf(`rank${summary.newRank.id}`));
    pushNews(c, makeItem(c, r2, 'rankUp',
      fill(pickFrom(HEADLINES.rankUp, r2), vars),
      [
        fill(pickFrom(BODIES.rankUp, r2), { ...vars, blurb: summary.newRank.blurb, n: c.cp }),
        `Career record: ${c.wins}-${c.losses}. Titles: ${c.titles.length}.`,
      ], { big: true }));
  }
  return c.news[0];
}

function playerPlaceSafe(c, playerName) {
  const row = standings(c, playerName).find((r) => r.isPlayer);
  return row ? row.place : '-';
}

/** A ranked link battle against the other human. */
export function reportLinkResult(c, playerName, res) {
  const rng = streamFor(c, hashOf(`link${res.opponentName}${c.wins}${c.losses}`));
  const vars = { p: playerName, o: res.opponentName || 'a linked trainer' };
  const bank = res.won ? HEADLINES.linkWin : HEADLINES.linkLoss;
  pushNews(c, makeItem(c, rng, res.won ? 'linkWin' : 'linkLoss',
    fill(pickFrom(bank, rng), vars),
    [
      `Result recorded as a sanctioned link match. Rating: ${c.rating} (${res.ratingDelta >= 0 ? '+' : ''}${res.ratingDelta}).`,
      `${playerName} is ${c.wins}-${c.losses} on the circuit.`,
    ]));
  if (res.rankedUp) {
    const r2 = streamFor(c, hashOf(`linkrank${res.newRank.id}`));
    pushNews(c, makeItem(c, r2, 'rankUp',
      fill(pickFrom(HEADLINES.rankUp, r2), { p: playerName, r: res.newRank.name, t: 'link play' }),
      [`${playerName} reaches ${res.newRank.name}. ${res.newRank.blurb}`], { big: true }));
  }
  return c.news[0];
}

/** The weekly table. Printed after every event so the ladder stays visible. */
export function reportPowerRankings(c, playerName) {
  const rng = streamFor(c, hashOf(`pr${c.week}`));
  const rows = standings(c, playerName).slice(0, 5);
  const body = rows.map((r) => `${r.place}. ${r.name}${r.isPlayer ? ' (you)' : ''} — ${r.rating}`);
  const me = standings(c, playerName).find((r) => r.isPlayer);
  if (me && me.place > 5) body.push(`...${me.place}. ${playerName} (you) — ${me.rating}`);
  return pushNews(c, makeItem(c, rng, 'powerRankings',
    fill(pickFrom(HEADLINES.powerRankings, rng), { n: c.week }), body));
}

/** Off-screen pro results between events. */
export function reportSeasonWeek(c, results) {
  if (!results || !results.length) return null;
  const rng = streamFor(c, hashOf(`week${c.week}`));
  const upset = results.find((r) => r.upset) || results[0];
  const w = getPro(upset.winner), l = getPro(upset.loser);
  if (!w || !l) return null;
  return pushNews(c, makeItem(c, rng, upset.upset ? 'upset' : 'rivalWin',
    upset.upset
      ? fill(pickFrom(HEADLINES.upset, rng), { o: l.name, t: 'exhibition circuit' })
      : fill(pickFrom(HEADLINES.rivalWin, rng), { o: w.name, p: l.name }),
    [
      `Week ${c.week} exhibition results: ${w.name} def. ${l.name}.`,
      results.slice(0, 3).map((r) => `${(getPro(r.winner) || {}).name} def. ${(getPro(r.loser) || {}).name}`).join(' · '),
    ]));
}

// ---- press conference ------------------------------------------------------

/** Builds the post-event question. Returns null when there is nothing to ask. */
export function buildPress(c, playerName, summary) {
  if (!summary) return null;
  const rng = streamFor(c, hashOf(`press${summary.tournament.id}${summary.won}`));
  const q = summary.won ? PRESS_QUESTIONS.win : PRESS_QUESTIONS.loss;
  return {
    tournamentId: summary.tournament.id,
    won: summary.won,
    question: fill(q.q, { analyst: analyst(rng), t: summary.tournament.short, p: playerName }),
    options: q.options.map((o) => ({ ...o })),
  };
}

/** Applies the player's answer and prints the quote. */
export function answerPress(c, playerName, press, optionIndex) {
  if (!press) return null;
  const opt = press.options[optionIndex] || press.options[0];
  const rng = streamFor(c, hashOf(`ans${press.tournamentId}${optionIndex}`));
  c.hype = Math.max(0, Math.min(100, c.hype + opt.hype));
  c.respect = Math.max(0, Math.min(100, c.respect + opt.respect));
  const t = getTournament(press.tournamentId);
  pushNews(c, makeItem(c, rng, 'press',
    `${playerName} speaks after the ${t ? t.short : 'event'}`,
    [press.question, opt.line, `Hype ${c.hype} · Respect ${c.respect}`]));
  c.lastPress = null;
  return opt;
}

export { currentRank };
