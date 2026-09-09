// The World Circuit — the competitive side story.
//
// A parallel career track to the badge quest: sanctioned tournaments, a world
// ranking, a roster of professional trainers who play their own matches
// whether you are watching or not, and a press that reports on all of it.
//
// Everything here is data. The circuit engine (game/circuit/) reads it; no
// system hardcodes a tournament, a rank or an opponent.

// ---- ranks ----------------------------------------------------------------
// Circuit Points are the career currency. Rating (Elo) is separate and moves
// per match — points only ever go up, rating goes both ways, exactly like a
// real tour ranking sitting on top of a results record.

export const RANKS = [
  { id: 'rookie', name: 'Rookie', cp: 0, blurb: 'Unranked. Nobody has heard of you yet.' },
  { id: 'prospect', name: 'Prospect', cp: 150, blurb: 'Scouts have started writing your name down.' },
  { id: 'contender', name: 'Contender', cp: 400, blurb: 'You are on the card, not just in the draw.' },
  { id: 'regional', name: 'Regional Ace', cp: 850, blurb: 'The best in Sinnoh know your team sheet.' },
  { id: 'national', name: 'National Star', cp: 1600, blurb: 'You headline domestic events.' },
  { id: 'continental', name: 'Continental Elite', cp: 2800, blurb: 'A name on every continent.' },
  { id: 'world', name: 'World Class', cp: 4500, blurb: 'Top ten on the planet, and climbing.' },
  { id: 'legend', name: 'Circuit Legend', cp: 7000, blurb: 'They will be showing your matches in twenty years.' },
];

export function rankForCp(cp) {
  let r = RANKS[0];
  for (const rank of RANKS) if (cp >= rank.cp) r = rank;
  return r;
}

export function rankIndex(id) { return Math.max(0, RANKS.findIndex((r) => r.id === id)); }

export function nextRank(cp) {
  return RANKS.find((r) => r.cp > cp) || null;
}

// ---- professional roster ---------------------------------------------------
// Each pro is a persona plus a species pool. Teams are generated at the
// tournament's level, so one pro works at every tier of the circuit.
//
//  style   drives their AI tier and how the press describes them
//  rating  starting Elo; it moves as they win and lose
//  pool    species they draw from
//  lines   what they say — before, after winning, after losing

const P = (id, o) => ({ id, ai: 1, ...o });

export const PROS = {
  wren: P('wren', {
    name: 'Cass Wren', look: 'rivalGirl', region: 'Sinnoh', style: 'aggressive',
    rating: 1180, rival: true,
    pool: [17, 12, 49, 6, 54, 30],
    tag: 'The Metronome',
    bio: 'Came up through the same regional circuit as you, one season earlier.',
    lines: {
      pre: ['Same route, same year, and here we both are. Try to make it interesting.',
        'I have watched every match you have played. All of them.'],
      win: ['You are getting closer. That is not a compliment yet.',
        'Next time bring the team you actually practise with.'],
      lose: ['Fine. That one was yours.', 'I hate that you are good at this.'],
    },
  }),
  calder: P('calder', {
    name: 'Rhea Calder', look: 'lass', region: 'Unova', style: 'technical', rating: 1240,
    pool: [35, 47, 33, 9, 40, 21],
    tag: 'The Architect',
    bio: 'Builds a match three turns before it happens. Rarely improvises.',
    lines: {
      pre: ['I have modelled this. You have about eleven percent.'],
      win: ['Eleven percent was generous.'],
      lose: ['Then my model was wrong. Interesting.'],
    },
  }),
  vance: P('vance', {
    name: 'Dario Vance', look: 'youngster', region: 'Kalos', style: 'aggressive', rating: 1205,
    pool: [6, 12, 49, 17, 54, 3],
    tag: 'First Blood',
    bio: 'Has never once switched out on turn one. Not once.',
    lines: {
      pre: ['I do not play long matches. Hope you brought a fast one.'],
      win: ['Told you. Short.'],
      lose: ['You lasted. Nobody lasts.'],
    },
  }),
  park: P('park', {
    name: 'Sun-Mi Park', look: 'nurse', region: 'Johto', style: 'defensive', rating: 1265,
    pool: [9, 47, 45, 3, 52, 28],
    tag: 'The Wall',
    bio: 'Holds the circuit record for the longest sanctioned match: 148 turns.',
    lines: {
      pre: ['Take your time. I have plenty of it.'],
      win: ['You ran out of patience before you ran out of options.'],
      lose: ['You out-waited me. Very few people do.'],
    },
  }),
  kestrel: P('kestrel', {
    name: 'Bram Kestrel', look: 'hiker', region: 'Hoenn', style: 'balanced', rating: 1150,
    pool: [12, 27, 30, 49, 14, 52],
    tag: 'The Journeyman',
    bio: 'Nineteen seasons. Never won a major. Never finished outside the top sixteen.',
    lines: {
      pre: ['I have been doing this since before you had a Pokédex. Be gentle.'],
      win: ['Still here.'],
      lose: ['Good. The circuit needs new names.'],
    },
  }),
  osei: P('osei', {
    name: 'Imani Osei', look: 'sailor', region: 'Alola', style: 'aggressive', rating: 1222,
    pool: [49, 6, 40, 17, 33, 12],
    tag: 'Riptide',
    bio: 'Won her first major at seventeen and has not been out of the top ten since.',
    lines: {
      pre: ['Let us not make this a long afternoon for either of us.'],
      win: ['Clean. I like clean.'],
      lose: ['Ha! Where did that come from?'],
    },
  }),
  frost: P('frost', {
    name: 'Nikolai Frost', look: 'oldMan', region: 'Sinnoh', style: 'defensive', rating: 1290,
    pool: [47, 9, 28, 52, 45, 3],
    tag: 'The Glacier',
    bio: 'Two-time Continental champion. Speaks to the press roughly once a year.',
    lines: {
      pre: ['...'],
      win: ['Mm.'],
      lose: ['Good match.'],
    },
  }),
  bloom: P('bloom', {
    name: 'Yara Bloom', look: 'mom', region: 'Galar', style: 'technical', rating: 1198,
    pool: [21, 43, 40, 35, 54, 9],
    tag: 'The Gardener',
    bio: 'Coaches four juniors and still finds time to be ranked eighth in the world.',
    lines: {
      pre: ['My students are watching this one. Make me look good.'],
      win: ['A teaching moment. Thank you.'],
      lose: ['They are going to be insufferable about this.'],
    },
  }),
  quint: P('quint', {
    name: 'Teo Quint', look: 'clerk', region: 'Kanto', style: 'balanced', rating: 1120,
    pool: [14, 23, 12, 30, 33, 49],
    tag: 'The Analyst',
    bio: 'Retired from commentary to compete. The commentary was going better.',
    lines: {
      pre: ['I have called four hundred of these. Odd to be in one.'],
      win: ['I would have picked me too.'],
      lose: ['I would have picked me. Note that for the record.'],
    },
  }),
  ferris: P('ferris', {
    name: 'Odile Ferris', look: 'scientist', region: 'Unova', style: 'technical', rating: 1170,
    pool: [47, 35, 46, 9, 21, 45],
    tag: 'Cold Read',
    bio: 'Publishes her own matchup data after every event. Nobody asked her to.',
    lines: {
      pre: ['I will be writing this one up either way.'],
      win: ['The data holds.'],
      lose: ['Fascinating. Genuinely.'],
    },
  }),
  marek: P('marek', {
    name: 'Josip Marek', look: 'worker', region: 'Hoenn', style: 'aggressive', rating: 1135,
    pool: [30, 27, 52, 17, 6, 12],
    tag: 'The Hammer',
    bio: 'Trains in a quarry. This is not a metaphor.',
    lines: {
      pre: ['Big swings. That is all I do.'],
      win: ['Big swings.'],
      lose: ['Missed.'],
    },
  }),
  sable: P('sable', {
    name: 'Nadia Sable', look: 'boss', region: 'Kalos', style: 'technical', rating: 1330,
    pool: [54, 49, 9, 47, 12, 6],
    tag: 'The Standard',
    bio: 'World number one for eleven straight seasons. The rank everyone measures against.',
    lines: {
      pre: ['Everyone gets one match against me. Spend it well.'],
      win: ['That is the level. Come back to it.'],
      lose: ['...Well. The circuit just changed. Congratulations.'],
    },
  }),
};

export const PRO_LIST = Object.values(PROS);
export function getPro(id) { return PROS[id]; }
export const RIVAL_PRO = 'wren';

const STYLE_AI = { aggressive: 1, balanced: 1, defensive: 2, technical: 2 };
export function aiForStyle(style) { return STYLE_AI[style] ?? 1; }

// ---- tournaments -----------------------------------------------------------
//
//  entrants   bracket size (4 = two rounds, 8 = three)
//  level      the level opponents are built at
//  cp         Circuit Points for winning it (semi/final losses scale down)
//  requires   minimum rank index to enter
//  field      pros who show up, in seeding order

const T = (id, o) => ({ id, entrants: 4, ...o });

export const TOURNAMENTS = [
  T('rookie_cup', {
    name: 'Oreburgh Rookie Cup', short: 'Rookie Cup', venue: 'Oreburgh Battle Hall',
    tier: 'Local', level: 14, cp: 70, prize: 3000, requires: 0, entrants: 4,
    field: ['quint', 'marek', 'kestrel'],
    blurb: 'Open entry. Where every career on the circuit starts.',
  }),
  T('sinnoh_open', {
    name: 'Sinnoh Open', short: 'Sinnoh Open', venue: 'Oreburgh Battle Hall',
    tier: 'Regional', level: 24, cp: 140, prize: 8000, requires: 1, entrants: 4,
    field: ['kestrel', 'wren', 'quint'],
    blurb: 'The domestic season opener. Televised, for the first time in your career.',
  }),
  T('regional_invitational', {
    name: 'Regional Invitational', short: 'Invitational', venue: 'Oreburgh Battle Hall',
    tier: 'Regional', level: 34, cp: 260, prize: 18000, requires: 2, entrants: 8,
    field: ['wren', 'marek', 'quint', 'kestrel', 'bloom', 'ferris', 'osei'],
    blurb: 'Eight invited trainers. Only the winner leaves with ranking points that matter.',
  }),
  T('national_champs', {
    name: 'National Championship', short: 'Nationals', venue: 'Oreburgh Battle Hall',
    tier: 'National', level: 46, cp: 450, prize: 40000, requires: 3, entrants: 8,
    field: ['wren', 'frost', 'bloom', 'ferris', 'kestrel', 'marek', 'osei'],
    blurb: 'The title that decides who represents the region abroad.',
  }),
  T('continental_cup', {
    name: 'Continental Cup', short: 'Continental', venue: 'Oreburgh Battle Hall',
    tier: 'Continental', level: 58, cp: 800, prize: 90000, requires: 4, entrants: 8,
    field: ['calder', 'park', 'vance', 'osei', 'frost', 'bloom', 'wren'],
    blurb: 'Four regions, one bracket, no second chances.',
  }),
  T('world_finals', {
    name: 'World Circuit Finals', short: 'World Finals', venue: 'Oreburgh Battle Hall',
    tier: 'World', level: 70, cp: 1500, prize: 250000, requires: 5, entrants: 8,
    field: ['sable', 'calder', 'frost', 'park', 'vance', 'osei', 'wren'],
    blurb: 'The eight best trainers alive. Winner takes the season.',
  }),
];

export function getTournament(id) { return TOURNAMENTS.find((t) => t.id === id) || null; }

// Rounds are named from the back so a 4-draw and an 8-draw read correctly.
export function roundName(entrants, round) {
  const remaining = entrants >> round;
  if (remaining <= 2) return 'Final';
  if (remaining === 4) return 'Semi-final';
  if (remaining === 8) return 'Quarter-final';
  return `Round of ${remaining}`;
}

export function roundsFor(entrants) { return Math.log2(entrants); }

// Points awarded for reaching each stage — winning is worth the headline
// number, everything else a documented fraction of it.
export function pointsForFinish(tournament, roundsSurvived) {
  const total = roundsFor(tournament.entrants);
  if (roundsSurvived >= total) return tournament.cp;
  const share = [0.12, 0.28, 0.5][Math.min(2, roundsSurvived)] ?? 0.12;
  return Math.max(10, Math.round(tournament.cp * share));
}
