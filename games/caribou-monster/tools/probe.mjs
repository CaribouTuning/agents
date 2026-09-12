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
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  g.debugGive(392, 30);
});
await wait(900);
await page.evaluate(() => window.CARIBOU.startWildBattle(387, 28));
await wait(2600);
// Attack, then catch the frame while the pixels are still in the air.
for (let i = 0; i < 24; i++) { await page.keyboard.press('KeyZ'); await wait(60); }
for (let i = 0; i < 60; i++) {
  const bits = await page.evaluate(() => {
    const t = window.CARIBOU.screens.top;
    return t.hitBits ? t.hitBits.length : -1;
  });
  if (bits > 4) { console.log('particles in the air:', bits); break; }
  await page.keyboard.press('KeyZ');
  await wait(60);
}
await page.screenshot({ path: '/tmp/hit.png' });
console.log('shot -> /tmp/hit.png');
await browser.close(); server.close();
