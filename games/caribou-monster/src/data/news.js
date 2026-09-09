// The circuit press.
//
// Templates, outlets and voices for the news feed. Everything here is a shape
// with slots; game/circuit/news.js fills the slots from what actually
// happened, so a headline always refers to a real result, a real opponent and
// a real number. That is the whole trick — the feed is a report, not flavour.

export const OUTLETS = [
  { id: 'wire', name: 'Sinnoh Battle Wire', voice: 'plain' },
  { id: 'psn', name: 'Poké Sports Network', voice: 'loud' },
  { id: 'weekly', name: 'Circuit Weekly', voice: 'considered' },
  { id: 'chart', name: 'The Type Chart', voice: 'analytical' },
  { id: 'global', name: 'Global Battle Report', voice: 'formal' },
];

export const ANALYSTS = [
  'Marlo Quint', 'Dr. Petra Shale', 'Coach Beniko', 'Rosalind Ferrow',
  'the desk at PSN', 'former champion Elias Poole',
];

// ---- headline banks --------------------------------------------------------
// Every slot means exactly one thing, everywhere. A generic {n} was a bug
// waiting to happen: the same template bank gets filled by several reporters,
// and the first one to disagree about what {n} meant printed "finishing with
// 14 Pokémon still standing".
//
//   {p} player          {o} opponent        {t} tournament      {r} rank
//   {mon} a Pokémon     {round} round name  {blurb} rank blurb  {analyst} name
//   {surv} Pokémon left {turns} turn count  {cp} Circuit Points {wins} career wins
//   {streak} win streak {record} a head-to-head like "3-1"
//   {entrants} field size                   {week} week number

export const HEADLINES = {
  debut: [
    'Unranked {p} files entry for the {t}',
    '{p} enters first sanctioned event',
    'Who is {p}? The {t} is about to find out',
  ],
  matchWin: [
    '{p} takes down {o}',
    '{p} through, past {o}',
    '{o} falls to {p} at the {t}',
    '{p} advances — {o} never settled',
  ],
  matchWinDominant: [
    '{p} dismantles {o} without losing a Pokémon',
    'Not close: {p} sweeps {o}',
    '{p} runs {o} off the floor',
  ],
  matchWinClose: [
    '{p} survives {o} in a one-Pokémon finish',
    'Down to the last: {p} edges {o}',
    '{p} steals it from {o}',
  ],
  matchLoss: [
    '{o} ends {p}’s run at the {t}',
    '{p} out, beaten by {o}',
    '{o} too much for {p}',
  ],
  matchLossClose: [
    '{p} falls one Pokémon short against {o}',
    'So close: {o} survives {p}',
  ],
  titleWin: [
    '{p} WINS THE {t}',
    'Champion: {p} takes the {t}',
    '{p} lifts the {t} title',
  ],
  titleWinFirst: [
    'FIRST BLOOD: {p} wins a maiden title at the {t}',
    'From nowhere — {p} takes the {t}',
  ],
  rankUp: [
    '{p} promoted to {r}',
    'Ranking update: {p} enters {r}',
    '{p} climbs into {r} after {t}',
  ],
  streak: [
    '{p} makes it {streak} straight',
    '{streak} in a row for {p}',
    'The {p} streak reaches {streak}',
  ],
  upset: [
    'UPSET: {o} out early at the {t}',
    '{o} bounced in the opening round',
    'Bracket chaos as {o} exits the {t}',
  ],
  rivalWin: [
    '{o} wins again — and mentions {p}',
    '{o} keeps pace at the top',
  ],
  rivalry: [
    '{p} and {o}: the circuit’s best argument',
    'Head to head: {p} leads {o} {record}',
    '{p} and {o} are {record} and counting',
  ],
  linkWin: [
    'Sanctioned link match: {p} defeats {o}',
    '{p} takes a ranked link battle from {o}',
  ],
  linkLoss: [
    'Ranked link: {o} defeats {p}',
  ],
  preview: [
    'Preview: the {t} draw is out',
    '{t} field confirmed — {entrants} entered',
    'What to watch at the {t}',
  ],
  powerRankings: [
    'Power Rankings: week {week}',
    'The Top Ten, updated',
  ],
};

// ---- body paragraphs -------------------------------------------------------

export const BODIES = {
  matchWin: [
    '{p} beat {o} in the {round} of the {t}, finishing with {surv} still standing.',
    'It took {p} {turns} turns to put {o} away in the {round}.',
    '{o} led early. {p} did not care.',
  ],
  matchLoss: [
    '{o} eliminated {p} in the {round} of the {t}.',
    '{p} exits the {t} at the {round} stage.',
  ],
  titleWin: [
    '{p} is the {t} champion, taking the final and {cp} Circuit Points with it.',
    'The {t} belongs to {p}. It is a result that moves the ranking.',
  ],
  rankUp: [
    'The promotion puts {p} in {r} — {blurb}',
    '{p} now sits at {cp} Circuit Points.',
  ],
  // Printed only after a win — see game/circuit/news.js. "Carried the load"
  // over a wiped team reads as a joke at the player's expense.
  star: [
    '{mon} carried the load again.',
    'Once more it was {mon} doing the closing.',
    '{mon} has now closed out {wins} matches for {p}.',
  ],
  quoteIntro: [
    '{analyst}, afterwards:',
    'Speaking on the broadcast, {analyst} said:',
    '{analyst} had this:',
  ],
};

export const ANALYST_QUOTES = {
  rising: [
    '"You can see it in the switches. Six months ago that team did not switch."',
    '"I have stopped calling it a surprise. That is just the level now."',
    '"Whoever is coaching that team, keep them."',
  ],
  dominant: [
    '"That was not a match, it was a demonstration."',
    '"I have called finals with less control than that quarter-final."',
  ],
  struggling: [
    '"The team is fine. The decisions in the back half are not."',
    '"Too many turns spent reacting. That is a fixable problem."',
  ],
  upset: [
    '"Brackets do this. It is why we play them."',
    '"Somebody is going to have a very long flight home."',
  ],
  rivalry: [
    '"Every era needs two people who cannot stand losing to each other."',
    '"They have played enough now that the matches have their own grammar."',
  ],
};

// ---- press conference ------------------------------------------------------
// After a tournament the player answers one question. The choice nudges Hype,
// which is what the press amplifies and what sponsors pay for.

export const PRESS_QUESTIONS = {
  win: {
    q: '{analyst}: "You just won the {t}. What changed?"',
    options: [
      { text: 'Credit the team.', tone: 'humble', hype: 4, respect: 6,
        line: '"Nothing changed. My Pokémon got better and I got out of their way."' },
      { text: 'Say you expected it.', tone: 'confident', hype: 9, respect: 1,
        line: '"Nothing changed. I have been this good for a while. You were late."' },
      { text: 'Call out the field.', tone: 'brash', hype: 12, respect: -4,
        line: '"Nothing changed. The bracket got easier."' },
    ],
  },
  loss: {
    q: '{analyst}: "Tough exit at the {t}. Where did it go wrong?"',
    options: [
      { text: 'Take it on the chin.', tone: 'humble', hype: 2, respect: 6,
        line: '"I was out-played. That is the whole answer."' },
      { text: 'Point at the details.', tone: 'analytical', hype: 3, respect: 4,
        line: '"Two switches. Both mine. Both wrong."' },
      { text: 'Promise a rematch.', tone: 'brash', hype: 8, respect: 0,
        line: '"Ask me again next event."' },
    ],
  },
};

export function pickFrom(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}
