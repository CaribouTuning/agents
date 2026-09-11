// What happens in the first rival battle, frame by frame.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const f = path.join('.', u === '/' ? '/index.html' : u);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
const tap = async (c, ms = 90) => { await page.keyboard.press(c); await wait(ms); };

await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
});
await wait(900);
// Give a starter and a team, set the flags the rival battle wants.
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.state.starterBase = 387;
  g.state.flags.gotStarter = true;
  g.debugGive(387, 20);
});
await wait(300);
// Clear whatever is on screen.
for (let i = 0; i < 80; i++) {
  const s = await page.evaluate(() => {
    const g = window.CARIBOU;
    return { top: g.screens.top.constructor.name, dlg: g.dialogueForTest.visible, script: !!(g.overworld && g.overworld.script) };
  });
  if (s.top === 'OverworldScreen' && !s.dlg && !s.script) break;
  await tap(s.top === 'OverworldScreen' ? 'KeyZ' : 'KeyQ');
}
await page.evaluate(() => window.CARIBOU.teleport('route201'));
await wait(800);

console.log('running rival1...');
await page.evaluate(() => window.CARIBOU.overworld.runScript('rival1'));
await wait(600);

console.log('party moves:', JSON.stringify(await page.evaluate(() => {
  const g = window.CARIBOU;
  return g.state.party.map((m) => ({ sp: m.species, lvl: m.level, hp: m.hp, maxHp: m.maxHp,
    moves: m.moves, best: g.bestMoveForTest ? g.bestMoveForTest(null) : 'no hook' }));
}), null, 1));

for (let i = 0; i < 400; i++) {
  const s = await page.evaluate(() => {
    const g = window.CARIBOU;
    const top = g.screens.top;
    if (top.constructor.name !== 'BattleScreen') return { top: top.constructor.name };
    for (const m of g.state.party) { m.hp = m.maxHp || m.hp; m.status = null; }
    const pick = g.bestMoveForTest ? g.bestMoveForTest(top) : -1;
    if (pick >= 0) top.moveIndex = pick;
    return { top: 'BattleScreen', mode: top.mode, moveIndex: top.moveIndex, pick,
      foeHp: top.foeMon ? top.foeMon.hp : (top.enemy ? top.enemy.hp : null),
      keys: Object.keys(top).slice(0, 45) };
  });
  if (i % 20 === 0 || s.top !== 'BattleScreen') console.log(i, JSON.stringify(s));
  const done = await page.evaluate(() => {
    const g = window.CARIBOU;
    return g.screens.top.constructor.name === 'OverworldScreen'
      && !g.dialogueForTest.visible && !(g.overworld && g.overworld.script);
  });
  if (done && i > 6) { console.log('everything is over at', i); break; }
  await tap('KeyZ', 60);
}
console.log('final:', JSON.stringify(await page.evaluate(() => ({
  top: window.CARIBOU.screens.top.constructor.name,
  beat: !!window.CARIBOU.state.flags.beatRival1,
}))));
await browser.close();
server.close();
