// Scripted opening playthrough.
//
// Walks the real route a player takes — out of the house, into the lab, take a
// starter, back out — asserting at each step that the player can still move.
// The static audit proves the maps are sound; this proves the game actually
// plays through them.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PAGE = process.argv[2] || 'index.html';
const OUT = process.argv[3] || '/tmp/walk';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join('.', u === '/' ? '/index.html' : u);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 900, height: 460 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/${PAGE}`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 8000 });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (k, ms) => {
  await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(180);
};
const tap = async (k, n = 1, d = 200) => {
  for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(d); }
};
const where = () => page.evaluate(() => {
  const g = window.CARIBOU, w = g.overworld && g.overworld.world;
  return w ? { map: w.mapId, x: w.player.x, y: w.player.y, screen: g.screens.top.constructor.name } : null;
});
// The softlock predicate, evaluated live against the running world.
const canMove = () => page.evaluate(() => {
  const w = window.CARIBOU.overworld.world;
  const p = w.player;
  return ['up', 'down', 'left', 'right'].filter((d) => {
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
    return w.canEnter(p, p.x + dx, p.y + dy, d);
  });
});

console.log('--- opening playthrough ---');
await page.evaluate(() => window.CARIBOU.startNewGame({ name: 'Matthew', look: 'boy', difficulty: 'easy' }));
await wait(700);
check('game starts in the player house', (await where()).map === 'player_house');

// Walks toward a tile with short directional holds, re-checking as it goes.
// More robust than fixed durations, and it fails loudly rather than silently
// wandering off.
const walkTo = async (tx, ty, limit = 14) => {
  for (let i = 0; i < limit; i++) {
    const w = await where();
    if (!w) return false;
    if (w.x === tx && w.y === ty) return true;
    let key;
    if (w.x !== tx) key = w.x < tx ? 'ArrowRight' : 'ArrowLeft';
    else key = w.y < ty ? 'ArrowDown' : 'ArrowUp';
    const dist = w.x !== tx ? Math.abs(tx - w.x) : Math.abs(ty - w.y);
    const before = `${w.x},${w.y},${w.map}`;
    await hold(key, 150 + dist * 240);
    const after = await where();
    if (`${after.x},${after.y},${after.map}` === before) return false;  // stuck
    if (after.map !== w.map) return true;                              // warped
  }
  return false;
};

// Out the front door.
await hold('ArrowDown', 1400);
await wait(900);
let w = await where();
check('walked out into the town', w.map === 'twinleaf', `${w.map} ${w.x},${w.y}`);

// Town path: down to the main road, east to the crossroads, north, then west
// to the lab door at (6,5).
await walkTo(5, 14);
await walkTo(14, 14);
await walkTo(14, 6);
await walkTo(6, 6);
await hold('ArrowUp', 500);
await wait(900);
w = await where();
check('reached the lab', w.map === 'rowan_lab', `${w.map} ${w.x},${w.y}`);
await page.screenshot({ path: path.join(OUT, '01-inside-lab.png') });

// THE REPORTED BUG: can the player move at all after entering?
let moves = await canMove();
check('can move inside the lab', moves.length > 0, `legal moves: ${moves.join(',') || 'NONE'}`);

// Reach the professor at (6,2) and take a starter.
await walkTo(6, 3);
await hold('ArrowUp', 220);
await wait(300);
// Advance until the cutscene actually ends, rather than guessing a count.
for (let i = 0; i < 60; i++) {
  const done = await page.evaluate(() => {
    const g = window.CARIBOU;
    return !g.dialogueForTest.visible && !g.overworld.script;
  });
  if (done && i > 2) break;
  await page.keyboard.press('KeyZ');
  await wait(170);
}
await wait(400);
await page.screenshot({ path: path.join(OUT, '02-starter.png') });
const party = await page.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));
check('received a starter from the professor', party.length > 0, JSON.stringify(party));

// Back out of the lab.
await walkTo(6, 7);
await hold('ArrowDown', 700);
await wait(900);
w = await where();
check('left the lab again', w.map === 'twinleaf', `${w.map} ${w.x},${w.y}`);
await page.screenshot({ path: path.join(OUT, '03-back-outside.png') });

// Every interior, entered directly, must leave the player able to move.
const interiors = ['player_house', 'rival_house', 'rowan_lab', 'oreburgh_center',
  'oreburgh_mart', 'oreburgh_gym', 'oreburgh_house', 'oreburgh_house2', 'oreburgh_hall',
  'oreburgh_gate', 'route201', 'route207', 'route202', 'oreburgh', 'twinleaf'];
for (const id of interiors) {
  const res = await page.evaluate(async (mapId) => {
    const g = window.CARIBOU;
    // Enter the way a player does: through a warp that targets this map.
    const { MAPS } = g.mapsForTest;
    let entry = null;
    for (const m of Object.values(MAPS)) {
      for (const wp of m.warps) if (wp.to === mapId) { entry = { x: wp.tx, y: wp.ty }; break; }
      if (entry) break;
    }
    if (!entry) entry = { x: 5, y: 5 };
    g.overworld.world.load(mapId, entry.x, entry.y, 'down');
    const w = g.overworld.world, p = w.player;
    const legal = ['up', 'down', 'left', 'right'].filter((d) => {
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
      return w.canEnter(p, p.x + dx, p.y + dy, d);
    });
    return { entry, legal };
  }, id);
  check(`entering ${id} leaves the player mobile`, res.legal.length > 0,
    `at ${res.entry.x},${res.entry.y} moves: ${res.legal.join(',') || 'NONE'}`);
}

// --- the World Circuit, played end to end ---
// Walk into the Battle Hall, register at the desk, enter the Rookie Cup and
// actually fight a round. This is the only test that proves the side story
// connects to the real battle system rather than simulating one.
console.log('\n--- world circuit ---');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.overworld.world.load('oreburgh_hall', 7, 8, 'up');
});
await wait(500);
check('the Battle Hall is enterable', (await where()).map === 'oreburgh_hall');

await walkTo(7, 6);
await page.evaluate(() => { window.CARIBOU.overworld.world.player.dir = 'up'; });
await wait(150);

// Talk the desk script through: several lines, one Yes/No, then the hub opens.
for (let i = 0; i < 40; i++) {
  const done = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name === 'CircuitScreen');
  if (done) break;
  await tap('KeyZ', 1, 170);
}
const joined = await page.evaluate(() => ({
  screen: window.CARIBOU.screens.top.constructor.name,
  joined: window.CARIBOU.state.circuit.joined,
}));
check('the desk registers the player and opens the circuit', joined.joined && joined.screen === 'CircuitScreen',
  `${joined.screen} joined=${joined.joined}`);
await page.screenshot({ path: path.join(OUT, '04-circuit-hub.png') });

// Enter the Rookie Cup from the EVENTS tab.
await page.evaluate(() => { const s = window.CARIBOU.screens.top; s.tab = 1; s.index = 0; s.scroll = 0; });
await tap('KeyZ', 1, 500);
const bracket = await page.evaluate(() => ({
  screen: window.CARIBOU.screens.top.constructor.name,
  active: window.CARIBOU.state.circuit.active && window.CARIBOU.state.circuit.active.id,
  rounds: window.CARIBOU.state.circuit.active && window.CARIBOU.state.circuit.active.rounds,
}));
check('entering an event draws a bracket', bracket.screen === 'TournamentScreen' && bracket.active === 'rookie_cup',
  `${bracket.screen} ${bracket.active} rounds=${bracket.rounds}`);
await page.screenshot({ path: path.join(OUT, '05-bracket.png') });

// Take the floor: this must start a real trainer battle against the pro's
// generated team, not a scripted result.
const before = await where();
await tap('KeyZ', 1, 900);
const inBattle = await page.evaluate(() => {
  const g = window.CARIBOU;
  const s = g.screens.top;
  if (s.constructor.name !== 'BattleScreen') return { screen: s.constructor.name };
  const foe = s.battle.sides[1];
  return {
    screen: 'BattleScreen',
    foeName: foe.name,
    foeTeam: foe.party.map((m) => `${m.species}:L${m.level}`),
    noBlackout: !!s.opts.noBlackout,
  };
});
check('the bracket starts a real battle against the pro', inBattle.screen === 'BattleScreen',
  `${inBattle.screen} ${inBattle.foeName || ''} ${(inBattle.foeTeam || []).join(' ')}`);
check('a circuit match is flagged as a no-blackout battle', !!inBattle.noBlackout);
await page.screenshot({ path: path.join(OUT, '06-circuit-battle.png') });

// Play it out. A level-5 starter against a level-14 pro loses, which is the
// case worth proving: a sanctioned loss must not send the player home.
for (let i = 0; i < 500; i++) {
  const name = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
  if (name !== 'BattleScreen') break;
  await page.keyboard.press('KeyZ');
  await wait(90);
}
await wait(1200);
const after = await page.evaluate(() => {
  const g = window.CARIBOU;
  const c = g.state.circuit;
  return {
    screen: g.screens.top.constructor.name,
    map: g.overworld.world.mapId,
    x: g.overworld.world.player.x, y: g.overworld.world.player.y,
    losses: c.losses, wins: c.wins, cp: c.cp, active: !!c.active,
    news: c.news.length, press: !!c.lastPress, money: g.state.inventory.money,
  };
});
check('a circuit result was recorded', after.wins + after.losses > 0,
  `${after.wins}-${after.losses}, ${after.cp} CP`);
check('losing a sanctioned match does not send the player home',
  after.map === 'oreburgh_hall', `${after.map} ${after.x},${after.y}`);
check('the press filed a story', after.news > 0, `${after.news} stories`);
await page.screenshot({ path: path.join(OUT, '07-circuit-after.png') });

// Whatever the result, the run must settle and the press conference must open.
for (let i = 0; i < 12; i++) {
  const name = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
  if (name === 'PressScreen') break;
  await tap('KeyZ', 1, 400);
}
const press = await page.evaluate(() => ({
  screen: window.CARIBOU.screens.top.constructor.name,
  active: !!window.CARIBOU.state.circuit.active,
}));
check('the run settles into a press conference', press.screen === 'PressScreen' && !press.active,
  `${press.screen} active=${press.active}`);
await page.screenshot({ path: path.join(OUT, '08-press.png') });
await tap('KeyZ', 3, 350);

// The career must survive a save/load round trip.
const trip = await page.evaluate(async () => {
  const g = window.CARIBOU;
  await g.save.save(g.state);
  const raw = await g.save.load();
  return {
    cp: g.state.circuit.cp, loadedCp: raw && raw.circuit && raw.circuit.cp,
    news: g.state.circuit.news.length,
    loadedNews: raw && raw.circuit && raw.circuit.news ? raw.circuit.news.length : -1,
  };
});
check('the career survives a save', trip.loadedCp === trip.cp && trip.loadedNews === trip.news,
  `cp ${trip.cp}/${trip.loadedCp}, stories ${trip.news}/${trip.loadedNews}`);
void before;

if (errs.length) { console.log(`  page errors: ${errs.slice(0, 5).join(' | ')}`); failures += errs.length; }
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall walkthrough checks passed');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
