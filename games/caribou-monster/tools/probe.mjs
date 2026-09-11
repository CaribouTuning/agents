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
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  g.debugGive(387, 12);
});
await wait(900);
await page.evaluate(() => window.CARIBOU.teleport('route201'));
await wait(900);
await page.evaluate(() => {
  const w = window.CARIBOU.overworld.world;
  w.companionJoin({ look: 'rivalGirl', name: 'Buddy', key: 'buddy' });
  w.petJoin({ species: 449, name: 'Bandit' });
});
await wait(400);
const shot = () => page.evaluate(() => {
  const w = window.CARIBOU.overworld.world, p = w.player;
  const one = (b) => (b && b.visible ? `${b.x},${b.y}${b.moving ? '*' : ''}(q${b.trail.length})` : '-');
  return `P ${p.x},${p.y}${p.moving ? '*' : ''} | comp ${one(w.companion)} | pet ${one(w.pet)} | foll ${one(w.follower)}`;
});
console.log('at join:  ', await shot());
console.log('map size: ', await page.evaluate(() => {
  const m = window.CARIBOU.overworld.world.map; return `${m.id} ${m.width}x${m.height}`;
}));
for (let i = 0; i < 40; i++) {
  const key = i % 8 < 4 ? 'ArrowDown' : 'ArrowUp';
  await page.keyboard.down(key); await wait(90); await page.keyboard.up(key); await wait(40);
  if (i > 30 || i < 6) console.log(String(i).padStart(2), key.slice(5).padEnd(5), await shot());
}
await browser.close(); server.close();
