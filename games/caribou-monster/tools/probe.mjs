// Enter each Gym by its front door and see whether the Leader can be reached
// on foot — following the lifts inside the Gym, which are warps, not tiles.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const f = path.join('.', u === '/' ? '/index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  g.debugGive(392, 80);
  for (let n = 1; n <= 6; n++) g.state.flags['badge' + n] = true;
});
await wait(900);

const gyms = await page.evaluate(() => window.CARIBOU.gymsForTest());
for (const gym of gyms) {
  // Walk in through the front door, exactly like a player.
  const entry = await page.evaluate((m) => {
    const MAPS = window.CARIBOU.mapsForTest.MAPS;
    for (const other of Object.values(MAPS)) {
      for (const w of (other.warps || [])) if (w.to === m) return { from: other.id, x: w.tx, y: w.ty };
    }
    return null;
  }, gym.map);
  await page.evaluate(([m, x, y]) => window.CARIBOU.teleport(m, x, y), [gym.map, entry.x, entry.y]);
  await wait: 0;
}
await browser.close();
server.close();
