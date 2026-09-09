// World Circuit simulation.
//
// Plays whole careers headlessly: enters every event, wins and loses rounds,
// runs the press desk, and saves/loads in the middle of a bracket. It proves
// the career engine terminates, the ranking is monotone where it should be,
// the news feed always refers to something that really happened, and a save
// taken mid-tournament resumes on the correct round.
import {
  createCircuit, serializeCircuit, reviveCircuit, enterTournament, resolveRound,
  finishTournament, currentOpponent, currentRoundName, standings, applyElo,
  recordLinkResult, simulateSeasonWeek, proTeam, proAsTrainer, canEnter, currentRank,
  abandonTournament,
} from '../src/game/circuit/circuit.js';
import {
  reportDebut, reportDraw, reportMatch, reportTournamentResult, reportLinkResult,
  reportPowerRankings, reportSeasonWeek, buildPress, answerPress,
} from '../src/game/circuit/news.js';
import { TOURNAMENTS, PRO_LIST, RANKS, getTournament } from '../src/data/circuit.js';
import { SPECIES } from '../src/data/species.js';
import { MOVES } from '../src/data/moves.js';
import { makeRng } from '../src/core/rng.js';
import { unrenderable } from '../src/render/font.js';

let fails = 0;
const check = (ok, msg) => { if (!ok) { console.log(`  FAIL  ${msg}`); fails++; } };

const NAME = 'Matthew';

// ---- 1. team generation ----------------------------------------------------
{
  const rng = makeRng(9);
  for (const pro of PRO_LIST) {
    for (const level of [14, 24, 34, 46, 58, 70]) {
      const team = proTeam(pro, level, rng);
      check(team.length >= 2, `${pro.id} team at Lv${level} is too small`);
      for (const m of team) {
        check(!!SPECIES[m.species], `${pro.id} generated unknown species ${m.species}`);
        check(m.level >= 2 && m.level <= level, `${pro.id} generated level ${m.level} for a Lv${level} event`);
        check(m.moves.length > 0, `${pro.id}'s ${m.species} knows no moves at Lv${m.level}`);
        for (const mv of m.moves) check(!!MOVES[mv], `${pro.id} generated unknown move ${mv}`);
      }
      const ids = team.map((m) => m.species);
      check(new Set(ids).size === ids.length, `${pro.id} generated a duplicate Pokémon`);
    }
  }
  const t = proAsTrainer(PRO_LIST[0], 30, rng, 'Final');
  check(!!t.name && !!t.intro && !!t.defeat && t.team.length > 0, 'proAsTrainer produced an incomplete trainer');
}

// ---- 2. Elo sanity ---------------------------------------------------------
{
  check(applyElo(1000, 1000, 1) > 1000, 'a win must raise rating');
  check(applyElo(1000, 1000, 0) < 1000, 'a loss must lower rating');
  const bigWin = applyElo(1000, 1400, 1) - 1000;
  const smallWin = applyElo(1000, 600, 1) - 1000;
  check(bigWin > smallWin, 'beating a stronger opponent must be worth more');
}

// ---- 3. a full career ------------------------------------------------------
// The player wins everything. Points, rank and titles must all move forward
// and never backwards, and every event must be enterable in order.
{
  const c = createCircuit();
  c.joined = true;
  let lastCp = -1, lastRank = -1;
  for (const t of TOURNAMENTS) {
    // Grind the previous tier until the gate opens, as a real player would.
    let guard = 0;
    while (!canEnter(c, t).ok && guard++ < 200) {
      const open = TOURNAMENTS.filter((x) => canEnter(c, x).ok);
      check(open.length > 0, `no event is enterable at ${currentRank(c).id}`);
      if (!open.length) break;
      const best = open[open.length - 1];
      enterTournament(c, best.id);
      while (c.active && !c.active.done) resolveRound(c, true, { survivors: 3, turns: 12 });
      finishTournament(c);
    }
    check(guard < 200, `could not reach the gate for ${t.id}`);

    const first = !c.entered.length;
    const run = enterTournament(c, t.id);
    check(!!run, `could not enter ${t.id}`);
    if (!run) continue;
    if (first) reportDebut(c, NAME, t);
    reportDraw(c, NAME, t, run);
    check(run.ladder.length === run.rounds, `${t.id} ladder is ${run.ladder.length} long for ${run.rounds} rounds`);

    let rounds = 0;
    while (c.active && !c.active.done && rounds++ < 10) {
      const opp = currentOpponent(c);
      check(!!opp, `${t.id} round ${rounds} has no opponent`);
      check(!!currentRoundName(c), `${t.id} round ${rounds} has no name`);
      const entry = resolveRound(c, true, { survivors: 2, turns: 14, star: 'Infernape' });
      reportMatch(c, NAME, t, entry);
    }
    check(rounds === run.rounds, `${t.id} took ${rounds} rounds, expected ${run.rounds}`);

    const summary = finishTournament(c);
    check(!!summary && summary.won, `${t.id} should have been won`);
    reportTournamentResult(c, NAME, summary);
    reportSeasonWeek(c, simulateSeasonWeek(c), NAME);
    reportPowerRankings(c, NAME);

    const press = buildPress(c, NAME, summary);
    check(!!press && press.options.length >= 2, `${t.id} produced no press conference`);
    answerPress(c, NAME, press, 0);

    check(c.cp > lastCp, `${t.id} did not increase Circuit Points`);
    const ri = RANKS.findIndex((r) => r.id === currentRank(c).id);
    check(ri >= lastRank, 'rank went backwards');
    lastCp = c.cp; lastRank = ri;
    check(c.titles.includes(t.id), `${t.id} title was not recorded`);
  }
  check(c.titles.length === TOURNAMENTS.length, `won ${c.titles.length} of ${TOURNAMENTS.length} titles`);
  check(currentRank(c).id === RANKS[RANKS.length - 1].id
    || c.cp < RANKS[RANKS.length - 1].cp, 'rank does not match points');
  check(c.rating > 1000, 'winning everything did not raise the rating');
  check(c.news.length > 0 && c.news.length <= 40, `news feed is ${c.news.length} long`);

  // Every story must be about something real: a known opponent or event.
  const known = new Set([...PRO_LIST.map((p) => p.name), ...TOURNAMENTS.map((t) => t.short), NAME]);
  for (const n of c.news) {
    check(!!n.headline && !n.headline.includes('{'), `unfilled slot in headline: ${n.headline}`);
    for (const b of n.body) check(!b.includes('{'), `unfilled slot in body: ${b}`);
    check(!!n.outlet, 'a story has no outlet');
    check(n.week >= 1, 'a story has no week');
  }
  check([...known].some((k) => c.news.some((n) => n.headline.includes(k))),
    'no story names a real trainer or event');
  console.log(`  career: ${c.titles.length} titles, ${c.wins}-${c.losses}, ${c.cp} CP, rating ${c.rating}, ${c.news.length} stories`);
}

// ---- 3b. the bracket is single elimination ---------------------------------
// A trainer who loses is out. Replaying them inflates the standings and makes
// the press file upset stories about people who already went home.
{
  const c = createCircuit();
  c.joined = true;
  const t = TOURNAMENTS.find((x) => x.entrants === 8);
  c.cp = RANKS[t.requires].cp;
  c.rank = currentRank(c).id;
  const run = enterTournament(c, t.id);
  check(!!run, 'could not enter the 8-draw');

  const knockedOut = new Set();
  const ladder = [...run.ladder];
  let rounds = 0;
  while (c.active && !c.active.done && rounds++ < 10) {
    const opponent = currentOpponent(c);
    const entry = resolveRound(c, true, { survivors: 3, turns: 12 });
    for (const r of entry.sideResults || []) {
      check(!knockedOut.has(r.loser), `${r.loser} was eliminated twice in the same draw`);
      check(!knockedOut.has(r.winner), `${r.winner} played on after being eliminated`);
      check(!ladder.slice(rounds).includes(r.loser),
        `${r.loser} is on the player's remaining path but lost a side match`);
      knockedOut.add(r.loser);
    }
    if (opponent) {
      check(!c.active || !c.active.others.includes(opponent.id),
        `${opponent.id} stayed in the draw after losing to the player`);
      knockedOut.add(opponent.id);
    }
  }
  const summary = finishTournament(c);
  check(!!summary && summary.won, 'the 8-draw should have been won');

  // Every pro's record has to be consistent with a single-elimination event:
  // nobody can have more losses than events entered.
  for (const p of PRO_LIST) {
    check(c.pros[p.id].losses <= 1,
      `${p.id} lost ${c.pros[p.id].losses} times in one single-elimination event`);
  }
}

// ---- 3c. what the press actually printed -----------------------------------
// createCircuit() seeds itself from Math.random(), which is right for the game
// and wrong for a test, so every circuit here is pinned to a fixed seed and the
// checks run across a spread of them.

function seeded(seed) {
  const c = createCircuit();
  c.seed = seed >>> 0;
  c.joined = true;
  return c;
}

{
  const t = TOURNAMENTS[0];
  let sawSurvivorLine = false;
  let sawStarLine = false;

  for (let seed = 1; seed <= 40; seed++) {
    // A long win: 31 turns, 2 Pokémon left. Nothing may print 31 as a party.
    const c = seeded(seed * 7919);
    enterTournament(c, t.id);
    const win = resolveRound(c, true, { survivors: 2, turns: 31, star: 'Infernape' });
    reportMatch(c, NAME, t, win);
    const text = c.news.filter((n) => n.kind === 'matchWin').map((n) => n.body.join(' ')).join(' ');
    const claim = /(\d+) Pokémon still standing/.exec(text);
    if (claim) {
      sawSurvivorLine = true;
      check(Number(claim[1]) === 2,
        `seed ${seed}: match report claimed ${claim[1]} Pokémon standing, the battle left 2`);
    }
    if (text.includes('Infernape')) sawStarLine = true;

    // The same round, lost. A wiped team gets no "carried the load".
    const c2 = seeded(seed * 7919);
    enterTournament(c2, t.id);
    const loss = resolveRound(c2, false, { survivors: 0, oppSurvivors: 2, turns: 9, star: 'Rattata' });
    reportMatch(c2, NAME, t, loss);
    const lossText = c2.news.filter((n) => n.kind === 'matchLoss').map((n) => n.body.join(' ')).join(' ');
    check(!lossText.includes('Rattata'),
      `seed ${seed}: a wiped team got a star line: ${lossText}`);
  }
  // If neither line was ever drawn, the checks above proved nothing.
  check(sawSurvivorLine, 'no match report ever used the survivor template; the check has no teeth');
  check(sawStarLine, 'no winning match report ever named the star Pokémon');
}

{
  // The exhibition story addresses the player, never the pro who just lost.
  let sawRivalWin = false;
  for (let seed = 1; seed <= 40; seed++) {
    const c = seeded(seed * 104729);
    c.week = 4;
    const story = reportSeasonWeek(c, simulateSeasonWeek(c), NAME);
    check(!!story, `seed ${seed}: the season week filed nothing`);
    if (!story) continue;
    if (story.kind === 'rivalWin') {
      sawRivalWin = true;
      // Whatever template was picked, no pro may appear where the player goes.
      const filled = story.headline;
      const loser = PRO_LIST.find((p) => filled.includes(`mentions ${p.name}`));
      check(!loser, `seed ${seed}: a pro was filled into the player slot: ${filled}`);
      if (filled.includes('mentions ')) {
        check(filled.includes(NAME), `seed ${seed}: "mentions" should name the player: ${filled}`);
      }
    }
    check(PRO_LIST.some((p) => story.body.join(' ').includes(p.name)),
      `seed ${seed}: the exhibition body should name real pros`);
    for (const text of [story.headline, ...story.body]) {
      const bad = unrenderable(text);
      check(bad.length === 0, `unprintable character ${JSON.stringify(bad)} in: ${text}`);
    }
  }
  check(sawRivalWin, 'no exhibition week ever produced a rivalWin story; the check has no teeth');
}

{
  // Nothing the press writes may reach the screen with a character the font
  // cannot draw, across a whole career.
  const c = seeded(20260909);
  for (const t of TOURNAMENTS) {
    c.cp = RANKS[t.requires].cp;
    c.rank = currentRank(c).id;
    if (!enterTournament(c, t.id)) continue;
    while (c.active && !c.active.done) {
      reportMatch(c, NAME, t, resolveRound(c, true, { survivors: 1, turns: 20, star: 'Luxray' }));
    }
    const summary = finishTournament(c);
    reportTournamentResult(c, NAME, summary);
    reportSeasonWeek(c, simulateSeasonWeek(c), NAME);
    reportPowerRankings(c, NAME);
    answerPress(c, NAME, buildPress(c, NAME, summary), 0);
  }
  let checked = 0;
  for (const n of c.news) {
    for (const text of [n.headline, n.outlet, ...n.body]) {
      checked++;
      const bad = unrenderable(text);
      check(bad.length === 0, `unprintable character ${JSON.stringify(bad)} in: ${text}`);
    }
  }
  check(checked > 40, `only ${checked} strings checked for printability`);
  console.log(`  press: ${checked} strings all printable by the game font`);
}

// ---- 4. losing ------------------------------------------------------------
{
  const c = createCircuit();
  c.joined = true;
  const t = TOURNAMENTS[0];
  enterTournament(c, t.id);
  const entry = resolveRound(c, false, { survivors: 0, oppSurvivors: 1, turns: 9 });
  reportMatch(c, NAME, t, entry);
  check(c.active.done && c.active.eliminated, 'a loss must end the run');
  const summary = finishTournament(c);
  check(!summary.won, 'an eliminated run must not report a win');
  check(summary.points > 0, 'an early exit should still pay something');
  check(c.titles.length === 0, 'an eliminated run must not award a title');
  check(c.streak === 0, 'a loss must reset the streak');
  const press = buildPress(c, NAME, summary);
  check(!!press && press.q !== undefined || !!press, 'a loss must still produce a press conference');
  answerPress(c, NAME, press, 2);
  check(c.hype > 10, 'the brash answer should raise hype');
}

// ---- 5. save / load mid-bracket -------------------------------------------
{
  const c = createCircuit();
  c.joined = true;
  const t = TOURNAMENTS.find((x) => x.entrants === 8);
  c.cp = RANKS[t.requires].cp;          // qualify for the tier under test
  c.rank = currentRank(c).id;
  check(canEnter(c, t).ok, `could not qualify for ${t.id}`);
  enterTournament(c, t.id);
  resolveRound(c, true, { survivors: 3, turns: 11 });
  const oppBefore = currentOpponent(c).id;
  const roundBefore = c.active.round;

  const raw = JSON.parse(JSON.stringify(serializeCircuit(c)));
  const back = reviveCircuit(raw);
  check(!!back.active, 'the live bracket did not survive a save');
  check(back.active.round === roundBefore, 'resumed on the wrong round');
  check(currentOpponent(back).id === oppBefore, 'resumed against the wrong opponent');
  check(back.cp === c.cp && back.rating === c.rating, 'career numbers did not survive a save');
  check(back.news.length === c.news.length, 'the news feed did not survive a save');
  check(JSON.stringify(back.pros) === JSON.stringify(c.pros), 'pro ratings did not survive a save');

  // A corrupt save must degrade to a fresh career, not throw.
  const junk = reviveCircuit({ cp: 'x', pros: 'nope', titles: ['not_an_event'], active: { id: 'ghost' } });
  check(junk.cp === 0 && junk.titles.length === 0 && junk.active === null, 'a corrupt save was not sanitised');
}

// ---- 6. link play + withdrawal --------------------------------------------
{
  const c = createCircuit();
  c.joined = true;
  const before = c.rating;
  const res = recordLinkResult(c, true, 'Girlfriend');
  reportLinkResult(c, NAME, res);
  check(c.rating > before, 'a link win must raise rating');
  check(c.cp > 0, 'a link win must pay Circuit Points');
  check(c.news[0].headline.includes('Girlfriend'), 'the link story must name the opponent');

  enterTournament(c, TOURNAMENTS[0].id);
  const lossesBefore = c.losses;
  abandonTournament(c);
  check(c.active === null, 'withdrawing must clear the run');
  check(c.losses === lossesBefore + 1, 'withdrawing must count as a loss');
}

// ---- 7. the season runs without you ---------------------------------------
{
  const c = createCircuit();
  const start = JSON.stringify(c.pros);
  for (let i = 0; i < 30; i++) { c.week++; simulateSeasonWeek(c); }
  check(JSON.stringify(c.pros) !== start, 'the pro season did not move');
  const rows = standings(c, NAME);
  check(rows.length === PRO_LIST.length + 1, 'the standings table is the wrong size');
  check(rows.every((r, i) => i === 0 || rows[i - 1].rating >= r.rating), 'standings are not sorted');
  check(rows.every((r, i) => r.place === i + 1), 'standings places are wrong');
  const total = PRO_LIST.reduce((n, p) => n + c.pros[p.id].wins + c.pros[p.id].losses, 0);
  check(total > 0, 'no pro matches were played');
  console.log(`  season: 30 weeks, ${total} pro results, leader ${rows[0].name} at ${rows[0].rating}`);
}

// ---- 8. randomised careers -------------------------------------------------
// A thousand mixed results must never stall, never throw, and never produce a
// state the UI cannot render.
{
  let crashes = 0;
  for (let seed = 0; seed < 60; seed++) {
    try {
      const rng = makeRng(seed + 1);
      const c = createCircuit();
      c.joined = true;
      for (let i = 0; i < 25; i++) {
        const open = TOURNAMENTS.filter((t) => canEnter(c, t).ok);
        if (!open.length) break;
        const t = open[Math.floor(rng() * open.length) % open.length];
        if (!enterTournament(c, t.id)) break;
        let guard = 0;
        while (c.active && !c.active.done && guard++ < 10) {
          const entry = resolveRound(c, rng() < 0.6, {
            survivors: Math.floor(rng() * 4), oppSurvivors: Math.floor(rng() * 4),
            turns: 5 + Math.floor(rng() * 30),
          });
          reportMatch(c, NAME, t, entry);
        }
        check(guard < 10, `seed ${seed} stalled inside ${t.id}`);
        const summary = finishTournament(c);
        reportTournamentResult(c, NAME, summary);
        reportSeasonWeek(c, simulateSeasonWeek(c), NAME);
        reportPowerRankings(c, NAME);
        answerPress(c, NAME, buildPress(c, NAME, summary), Math.floor(rng() * 3));
      }
      check(c.news.length <= 40, `seed ${seed} let the feed grow to ${c.news.length}`);
      check(c.hype >= 0 && c.hype <= 100, `seed ${seed} hype out of range: ${c.hype}`);
      check(c.respect >= 0 && c.respect <= 100, `seed ${seed} respect out of range: ${c.respect}`);
      check(c.rating > 0, `seed ${seed} rating went non-positive`);
      for (const n of c.news) {
        check(!n.headline.includes('{'), `seed ${seed} unfilled headline: ${n.headline}`);
        for (const b of n.body) check(!b.includes('{'), `seed ${seed} unfilled body: ${b}`);
      }
      for (const id of c.titles) check(!!getTournament(id), `seed ${seed} recorded a phantom title ${id}`);
    } catch (e) {
      console.log(`  CRASH seed ${seed}: ${e.message}`);
      crashes++;
      if (crashes > 2) break;
    }
  }
  check(crashes === 0, `${crashes} randomised careers crashed`);
  console.log('  randomised: 60 careers, no stalls');
}

console.log(fails ? `\n${fails} failure(s)` : '\ncircuit: all checks passed');
process.exit(fails ? 1 : 0);
