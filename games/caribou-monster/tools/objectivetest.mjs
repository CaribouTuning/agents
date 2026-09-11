// The guide bar, at every point in the story.
//
// This game is meant to be picked up on a Tuesday having last been touched
// three weeks ago, so the one line at the top of the screen is doing most of
// the work of telling two people what they are doing. It went five Gyms in
// the middle of the campaign without naming a single one — "keep going,
// somebody wrote it down" was all it said between the Everlight chamber and
// Canalave.
//
// So: walk the story flag by flag, in order, and check that the bar always
// says something, that it says something DIFFERENT as the story moves, that
// it fits the width it is drawn in, and that it names a place or a person
// rather than gesturing at one.
import { createGameState } from '../src/game/state.js';
import { objective } from '../src/game/journal.js';
import { builtGyms } from '../src/data/campaign.js';
import { MAPS } from '../src/data/maps/index.js';
import { unrenderable } from '../src/render/font.js';

let fails = 0;
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};

const gyms = builtGyms(MAPS);

// Everything true from the moment the player has a Pokemon and has reached
// Oreburgh — carried into every later step, because a player who has beaten
// Mars has not un-taken their starter.
const GOT = { gotStarter: 1, leftTown: 1, reachedOreburgh: 1 };

// The story, in the order the chapter list gives it.
const STEPS = [
  ['the very first morning', {}, 'matthew_house'],
  ['standing in the lab', {}, 'rowan_lab'],
  ['starter in hand, still in Twinleaf', { gotStarter: 1 }, 'twinleaf'],
  ['on Route 201', { gotStarter: 1 }, 'route201'],
  ['in Sandgem', { gotStarter: 1 }, 'sandgem'],
  ['in Jubilife', { gotStarter: 1 }, 'jubilife'],
  ['arrived in Oreburgh', { gotStarter: 1, reachedOreburgh: 1 }, 'oreburgh'],
  ['inside the first Gym', { gotStarter: 1, reachedOreburgh: 1 }, 'oreburgh_gym'],
  ['first badge won', { gotStarter: 1, reachedOreburgh: 1, badge1: 1 }, 'oreburgh'],
  ['under the Gate', { gotStarter: 1, reachedOreburgh: 1, badge1: 1, enteredCave: 1 }, 'oreburgh_gate'],
  ['Mars beaten', { ...GOT, badge1: 1, enteredCave: 1, beatCommander: 1 }, 'oreburgh_gate'],
  ['charm in hand', { ...GOT, badge1: 1, beatCommander: 1, gotCharm: 1 }, 'oreburgh_gate'],
  ['the seam is open', { ...GOT, badge1: 1, beatCommander: 1, gotCharm: 1, everlightOpened: 1 }, 'oreburgh_gate'],
  ['the chamber seen', { ...GOT, badge1: 1, beatCommander: 1, gotCharm: 1, everlightOpened: 1, everlightSeen: 1 }, 'everlight_chamber'],
];
// Then every remaining badge, which is where the bar used to go quiet.
const base = { ...GOT, badge1: 1, beatCommander: 1, gotCharm: 1, everlightOpened: 1, everlightSeen: 1 };
for (let i = 2; i <= gyms.length; i++) {
  const flags = { ...base };
  for (let k = 2; k < i; k++) flags[`badge${k}`] = 1;
  const g = gyms.find((x) => x.n === i);
  STEPS.push([`chasing badge ${i} (${g.leader})`, flags, 'route210']);
  STEPS.push([`standing in ${g.city} for badge ${i}`, flags, g.city]);
}
const allBadges = { ...base };
for (const g of gyms) allBadges[`badge${g.n}`] = 1;
STEPS.push(['every badge won', allBadges, 'canalave']);
STEPS.push(['in the library', allBadges, 'canalave_library']);
STEPS.push(['the truth known', { ...allBadges, canalaveTruth: 1 }, 'canalave']);
STEPS.push(['the Everlight resolved', { ...allBadges, canalaveTruth: 1, everlightResolved: 1 }, 'oreburgh_gate']);
STEPS.push(['Rowan debriefed', { ...allBadges, canalaveTruth: 1, everlightResolved: 1, rowanDebriefed: 1 }, 'route207']);
STEPS.push(['been home', { ...allBadges, canalaveTruth: 1, everlightResolved: 1, rowanDebriefed: 1, wentHome: 1 }, 'twinleaf']);

console.log('--- what the bar says, all the way through ---\n');
const seen = [];
// The bar wraps, so what matters is that the whole instruction fits the room
// it is allowed to take: three lines of the narrowest screen's thirty
// characters. Anything longer than that gets its tail cut off, and half an
// instruction is worse than none.
const NARROW = 30;
const LINES = 3;
const WIDTH = NARROW * LINES;
for (const [when, flags, map] of STEPS) {
  const st = createGameState({ name: 'Matthew', look: 'matthew' });
  Object.assign(st.flags, flags);
  st.badges = Object.keys(flags).filter((k) => /^badge\d+$/.test(k)).map((k) => +k.slice(5));
  st.player.map = map;
  const line = objective(st);
  console.log(`  ${when.padEnd(36)} ${JSON.stringify(line)}`);
  seen.push({ when, line, map });
}

console.log('');
for (const s of seen) {
  check(!!s.line && s.line.trim().length > 0, `${s.when}: the bar says something`);
  check(!/\{\w+\}/.test(s.line || ''), `${s.when}: with no unfilled slot in it`);
  check(!(unrenderable(String(s.line || '')).length), `${s.when}: that the font can draw`);
  // How many lines the bar would actually need at the narrowest width.
  const words = String(s.line || '').replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
  let rows = 1, cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= NARROW) { cur = next; continue; }
    rows++; cur = w;
  }
  check(rows <= LINES, `${s.when}: fits the bar on the narrowest screen`,
    `${rows} line(s) of ${NARROW}`);
}
// The middle of the game has to name its Gyms.
const middle = seen.filter((s) => s.when.startsWith('chasing badge') || s.when.startsWith('standing in'));
for (const s of middle) {
  const n = +s.when.replace(/\D+/g, '');
  const g = gyms.find((x) => x.n === n);
  check(g ? s.line.includes(g.leader) || s.line.includes(g.badge) : true,
    `${s.when}: names the Leader or the badge`, s.line);
}
// And it must actually change as the story moves, or it is not guidance.
const distinct = new Set(seen.map((s) => s.line));
check(distinct.size >= Math.floor(seen.length * 0.6),
  'the bar changes as the story moves', `${distinct.size} different lines across ${seen.length} points`);

console.log(fails ? `\n${fails} failure(s)` : '\nobjectives: all checks passed');
process.exit(fails ? 1 : 0);
