import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const f = path.join('.', u === '/' ? '/index.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 667, height: 375 }, hasTouch: true })).newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  g.state.flags.leftTown = true;
  g.state.flags.reachedOreburgh = true;
  Object.assign(g.state.flags, { badge1: 1, beatCommander: 1, gotCharm: 1, everlightOpened: 1, everlightSeen: 1 });
  g.debugGive(387, 12);
});
await wait(900);
await page.evaluate(() => window.CARIBOU.teleport('route210'));
await wait(1400);
console.log('logical width:', await page.evaluate(() => window.CARIBOU.display.width));
console.log('objective:', JSON.stringify(await page.evaluate(() => window.CARIBOU.objectiveForTest())));
await page.screenshot({ path: '/tmp/guidebar.png' });
console.log('shot -> /tmp/guidebar.png');
await browser.close(); server.close();
