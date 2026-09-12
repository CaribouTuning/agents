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
page.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  g.debugGive(387, 20);
});
await wait(900);
// The title-side screens, and the circuit ones.
for (const [what, how] of [
  ['TitleOptionsScreen', () => window.CARIBOU.openOptions && window.CARIBOU.screens.push(new (window.CARIBOU.screens.top.constructor)(window.CARIBOU))],
  ['CircuitScreen', () => window.CARIBOU.openCircuit()],
  ['MultiplayerScreen', () => window.CARIBOU.openMultiplayer()],
  ['PCScreen', () => window.CARIBOU.openPC()],
  ['JournalScreen', () => window.CARIBOU.openJournal()],
]) {
  await page.evaluate(() => { while (window.CARIBOU.screens.stack.length > 1) window.CARIBOU.screens.pop(); });
  await wait(200);
  try { await page.evaluate(how); } catch { /* skip */ }
  await wait(450);
  const r = await page.evaluate(() => {
    const g = window.CARIBOU;
    const c = g.controlsForTest && g.controlsForTest.backChip();
    return { top: g.screens.top.constructor.name, chip: !!c, x: c && Math.round(c.x), y: c && Math.round(c.y) };
  });
  console.log(`  ${String(r.top).padEnd(20)} chip=${r.chip ? `yes (${r.x},${r.y})` : 'NO'}`);
}
await browser.close(); server.close();
