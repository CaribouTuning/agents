// Weather.
//
// Fifteen abilities in the Pokédex were marked "no weather system" and did
// nothing, four moves that exist in the move table did nothing, and the type
// chart had no way to say "Fire is weaker in the rain". This is that system.
//
// The four kinds are the series' own, and so are their rules:
//
//   sun    Fire x1.5, Water x0.5. Solar Beam needs no charge; Synthesis and
//          friends heal two thirds instead of a half.
//   rain   Water x1.5, Fire x0.5. Thunder never misses; healing drops to a
//          quarter.
//   sand   Rock, Ground and Steel are unharmed; everything else loses a
//          sixteenth of its health each turn. Rock's Sp. Def rises by half.
//   hail   Ice is unharmed; everything else loses a sixteenth each turn.
//
// Every rule is a pure function of (weather, thing) so the battle engine
// stays readable and none of this has to know about the engine's shape.

export const WEATHER = {
  sun: { name: 'sun', start: 'The sunlight turned harsh!', end: 'The sunlight faded.', tick: 'The sunlight is strong.' },
  rain: { name: 'rain', start: 'It started to rain!', end: 'The rain stopped.', tick: 'Rain continues to fall.' },
  sand: { name: 'sand', start: 'A sandstorm kicked up!', end: 'The sandstorm subsided.', tick: 'The sandstorm rages.' },
  hail: { name: 'hail', start: 'It started to hail!', end: 'The hail stopped.', tick: 'Hail continues to fall.' },
};

export const DEFAULT_TURNS = 5;

/** What a move's damage is multiplied by in this weather. */
export function damageMultiplier(weather, moveType) {
  if (weather === 'sun') {
    if (moveType === 'Fire') return 1.5;
    if (moveType === 'Water') return 0.5;
  } else if (weather === 'rain') {
    if (moveType === 'Water') return 1.5;
    if (moveType === 'Fire') return 0.5;
  }
  return 1;
}

/** Sandstorm gives Rock types half again their Special Defence. */
export function statMultiplier(weather, key, types) {
  if (weather === 'sand' && key === 'spd' && types.includes('Rock')) return 1.5;
  return 1;
}

const SAFE_FROM = { sand: ['Rock', 'Ground', 'Steel'], hail: ['Ice'] };

/** True when the weather itself hurts this Pokémon at the end of the turn. */
export function chipsAway(weather, types) {
  const safe = SAFE_FROM[weather];
  return !!safe && !types.some((t) => safe.includes(t));
}

export function chipText(weather, name) {
  return weather === 'sand' ? `${name} is buffeted by the sandstorm!` : `${name} is pelted by hail!`;
}

/** Accuracy multiplier: Thunder cannot miss in rain, and is poor in sun. */
export function accuracyMultiplier(weather, moveId) {
  if (moveId === 'thunder') {
    if (weather === 'rain') return Infinity;      // never misses
    if (weather === 'sun') return 0.5;
  }
  if (moveId === 'blizzard' && weather === 'hail') return Infinity;
  return 1;
}

/** Weather-sensitive healing: two thirds in sun, a quarter in rain or ash. */
export function healFraction(weather, base, moveId) {
  if (!['synthesis', 'moonlight', 'morningsun'].includes(moveId)) return base;
  if (weather === 'sun') return 2 / 3;
  if (weather === 'rain' || weather === 'sand' || weather === 'hail') return 0.25;
  return base;
}

/** Weather Ball takes the weather's type, and hits twice as hard in it. */
export function weatherBall(weather) {
  const byWeather = { sun: 'Fire', rain: 'Water', sand: 'Rock', hail: 'Ice' };
  const type = byWeather[weather];
  return type ? { type, power: 100 } : { type: 'Normal', power: 50 };
}
