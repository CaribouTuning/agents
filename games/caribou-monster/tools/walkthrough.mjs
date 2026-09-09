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
  'oreburgh_mart', 'oreburgh_gym', 'oreburgh_house', 'oreburgh_house2',
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

if (errs.length) { console.log(`  page errors: ${errs.slice(0, 5).join(' | ')}`); failures += errs.length; }
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall walkthrough checks passed');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
