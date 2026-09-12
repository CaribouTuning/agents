// Two things a player runs straight into, and both were open.
//
//  1. EVOLVING. Only the battle screen could ever evolve anything. A Pokemon
//     that came back from the Day Care already past its level, or one whose
//     evolution the player stopped with B and later thought better of, had no
//     way of ever evolving at all — and nothing anywhere said so, so there was
//     no reason to go looking.
//  2. THE BATTLE HALL. It is the League's building and the League takes the
//     badges, and it stood open from the first afternoon. A player could walk
//     in at level eight and be offered the Finals.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const f = path.join('.', u === '/' ? '/index.html' : u);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
let fails = 0;
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
page.on('pageerror', (e) => { console.log('  PAGE ERROR', e.message); fails++; });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
const top = () => page.evaluate(() => window.CARIBOU.screens.top.constructor.name);

const fresh = async (setup = () => {}) => {
  await page.evaluate(() => {
    const g = window.CARIBOU;
    g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
    g.state.flags.gotStarter = true;
  });
  await wait(700);
  await page.evaluate(setup);
  await wait(400);
};

console.log('--- a Pokemon that is ready to evolve ---');
await fresh(() => window.CARIBOU.debugGive(387, 20));
await wait(900);
const noticed = await page.evaluate(() => {
  const d = window.CARIBOU.dialogueForTest;
  return { visible: d.visible, text: (d.pages || []).flat().join(' ') };
});
check(noticed.visible && /about to change/i.test(noticed.text),
  'the character says so out loud, unprompted', noticed.text.slice(0, 60));

for (let i = 0; i < 14; i++) { await page.keyboard.press('KeyZ'); await wait(80); }
await page.evaluate(() => window.CARIBOU.openParty());
await wait(420);
await page.keyboard.press('KeyZ');
await wait(380);
const actions = await page.evaluate(() => window.CARIBOU.screens.top.sub || []);
check(actions[0] === 'EVOLVE', 'the party menu offers EVOLVE, first', JSON.stringify(actions));

await page.keyboard.press('KeyZ');
await wait(420);
check(await top() === 'EvolveScreen', 'and choosing it plays the evolution', await top());
for (let i = 0; i < 100; i++) {
  if (await top() !== 'EvolveScreen') break;
  await wait(120);
}
const after = await page.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));
check(after[0] === 388, 'and the Pokemon is actually evolved afterwards', JSON.stringify(after));

console.log('\n--- and one that is not ready ---');
await fresh(() => window.CARIBOU.debugGive(387, 5));
await page.evaluate(() => window.CARIBOU.openParty());
await wait(420);
await page.keyboard.press('KeyZ');
await wait(380);
const noEvo = await page.evaluate(() => window.CARIBOU.screens.top.sub || []);
check(!noEvo.includes('EVOLVE'), 'is not offered it', JSON.stringify(noEvo));

console.log('\n--- the Battle Hall door ---');
await fresh(() => window.CARIBOU.debugGive(387, 20));
await page.evaluate(() => window.CARIBOU.teleport('oreburgh'));
await wait(1200);
const shut = await page.evaluate(() => {
  const g = window.CARIBOU;
  const w = g.overworld.world;
  const door = (w.map.warps || []).find((x) => x.to === 'oreburgh_hall');
  return { requires: door && door.requires, open: !!g.state.flags.leagueOpen };
});
check(shut.requires === 'leagueOpen', 'is shut behind every badge', JSON.stringify(shut));
check(!shut.open, 'and is not open with no badges at all');

await page.evaluate(() => {
  const g = window.CARIBOU;
  const gyms = g.gymsForTest();
  for (const gym of gyms) g.awardBadgeForTest(gym.n, gym.badge);
});
await wait(400);
const opened = await page.evaluate(() => ({
  open: !!window.CARIBOU.state.flags.leagueOpen,
  badges: window.CARIBOU.state.badges.length,
}));
check(opened.open, 'and opens once they are all in', JSON.stringify(opened));

// ---- two of the same, one ready and one not --------------------------------
//
// The notice used to be keyed on the species. Carrying a Turtwig that could
// change and a Turtwig that could not made the two of them take it in turns —
// the young one cleared the mark, the old one set it again — and the box came
// back for ever. This is that exact party.
{
  console.log('\n--- a spare of the same species does not trap you ---');
  await page.evaluate(() => {
    const g = window.CARIBOU;
    g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
    g.state.flags.gotStarter = true;
    g.state.party = [];
    g.debugGive(387, 30);       // ready to change
    g.debugGive(387, 5);        // not
    g.teleport('twinleaf', 10, 8);
  });
  await page.waitForTimeout(700);
  let seen = 0;
  for (let i = 0; i < 40; i++) {
    const up = await page.evaluate(() => window.CARIBOU.dialogueForTest.visible);
    if (up) { seen++; await page.keyboard.press('KeyZ'); await page.waitForTimeout(90); await page.keyboard.press('KeyZ'); }
    await page.waitForTimeout(80);
  }
  const stuck = await page.evaluate(() => window.CARIBOU.dialogueForTest.visible);
  check(seen <= 3, 'the notice comes once, not on a loop', `${seen} boxes`);
  check(!stuck, 'and the world is walkable again afterwards');
}

console.log(fails ? `\n${fails} failed` : '\nall good');

await browser.close();
server.close();
process.exit(fails ? 1 : 0);
