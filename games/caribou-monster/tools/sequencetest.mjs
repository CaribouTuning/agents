// Can the story be walked round?
//
// Every gate in this game is a flag, and a flag is only a gate if there is no
// path to the thing behind it. This suite goes looking for the paths: it puts
// a player in the world with nothing done, and checks that the things the
// story has not given them yet are genuinely not there.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((rq, rs) => {
  const u = decodeURIComponent(rq.url.split('?')[0]);
  if (u === '/favicon.ico') { rs.writeHead(204); rs.end(); return; }
  fs.readFile(path.join('.', u === '/' ? '/index.html' : u), (e, d) => {
    if (e) { rs.writeHead(404); rs.end(''); return; }
    rs.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream' });
    rs.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 667, height: 375 }, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);

let fails = 0;
const check = (ok, msg, extra = '') => {
  if (ok) console.log(`  PASS  ${msg}${extra ? `  ${extra}` : ''}`);
  else { console.log(`  FAIL  ${msg}${extra ? `  ${extra}` : ''}`); fails++; }
};

const fresh = () => page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  g.debugGive(392, 60);
});

console.log('--- a ball the story has not put there yet ---');
{
  await fresh();
  await wait(400);
  await page.evaluate(() => window.CARIBOU.teleport('oreburgh_gate', 11, 1));
  await wait(700);
  const before = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    return (w.entities || []).filter((e) => e.kind === 'item').map((e) => (e.data && e.data.item) || e.id);
  });
  check(!before.includes('auroracharm'),
    'the Aurora Charm is not on the floor before Mars is beaten', before.join(', ') || 'nothing');
  check(before.length > 0, 'but the ordinary items in the cave still are', before.join(', '));

  // And with the commander beaten it is there, or the story cannot continue.
  await page.evaluate(() => {
    const g = window.CARIBOU;
    g.state.flags.beatCommander = true;
    g.teleport('oreburgh_gate', 11, 1);
  });
  await wait(700);
  const after = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    return (w.entities || []).filter((e) => e.kind === 'item').map((e) => (e.data && e.data.item) || e.id);
  });
  check(after.includes('auroracharm'), 'and it is there once she is', after.join(', '));
}

console.log('\n--- and it appears in the room you are standing in ---');
{
  // Mars is fought inside Oreburgh Gate. Spawning gated items only at map
  // load meant you won the fight, walked round the corner, and found bare
  // rock: the charm did not exist until you left the cave and came back, and
  // nothing on screen said so.
  await fresh();
  await wait(400);
  await page.evaluate(() => window.CARIBOU.teleport('oreburgh_gate', 11, 1));
  await wait(700);
  const before = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    return (w.entities || []).filter((e) => e.kind === 'item').length;
  });
  // Flip the flag the way beating her does, then end a scene.
  await page.evaluate(() => {
    const g = window.CARIBOU;
    g.state.flags.beatCommander = true;
    g.overworld.runScript(null, null, async () => {});
  });
  await wait(600);
  const after = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    return (w.entities || []).filter((e) => e.kind === 'item')
      .map((e) => (e.data && e.data.item) || e.id);
  });
  check(after.includes('auroracharm'),
    'the charm is on the floor the moment the scene ends, without leaving the cave',
    `${before} -> ${after.length}: ${after.join(', ')}`);
}

console.log('\n--- the door under the hill ---');
{
  await fresh();
  await wait(400);
  await page.evaluate(() => window.CARIBOU.teleport('oreburgh_gate', 11, 2));
  await wait(400);
  // Stand on the seam with no charm. It must refuse rather than open.
  await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    w.player.x = 12; w.player.y = 2;
    window.CARIBOU.overworld.runScript('everlight', null);
  });
  for (let i = 0; i < 30; i++) { await page.keyboard.press('KeyZ'); await wait(70); }
  const where = await page.evaluate(() => window.CARIBOU.state.player.map);
  check(where !== 'everlight_chamber', 'the seam will not open without the charm', where);
}

console.log('\n--- the Battle Hall door ---');
{
  await fresh();
  await wait(400);
  const shut = await page.evaluate(() => {
    const M = window.CARIBOU.mapsForTest.MAPS;
    const w = (M.oreburgh.warps || []).find((x) => x.to === 'oreburgh_hall');
    return w ? { requires: w.requires, refuses: !!w.refuse, open: !!window.CARIBOU.state.flags[w.requires] } : null;
  });
  if (shut) check(shut.requires && !shut.open, 'is shut until the League opens', JSON.stringify(shut));
  else console.log('  ....  no Battle Hall warp in Oreburgh to check');
}

console.log(errors.length ? `\nPAGE ERRORS: ${errors.join(' | ')}` : '\nno page errors');
console.log(fails ? `\n${fails} failed` : '\nnothing can be walked round');
await browser.close();
server.close();
process.exit(fails || errors.length ? 1 : 0);
