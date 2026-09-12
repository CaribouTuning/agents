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
  g.debugGive(387, 20);   // a Turtwig well past its evolution level
});
await wait(1500);
console.log('does the character notice?', JSON.stringify(await page.evaluate(() => {
  const d = window.CARIBOU.dialogueForTest;
  return { visible: d.visible, text: (d.pages || []).flat().join(' ').slice(0, 90) };
})));
// Clear it, then use the party menu to evolve.
for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyZ'); await wait(90); }
await page.evaluate(() => window.CARIBOU.openParty());
await wait(500);
await page.keyboard.press('KeyZ'); await wait(400);
console.log('party actions:', JSON.stringify(await page.evaluate(() => window.CARIBOU.screens.top.sub)));
await page.keyboard.press('KeyZ'); await wait(500);
console.log('after choosing the first action:', await page.evaluate(() => window.CARIBOU.screens.top.constructor.name));
for (let i = 0; i < 90; i++) {
  const t = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
  if (t !== 'EvolveScreen') break;
  await wait(120);
}
console.log('party now:', JSON.stringify(await page.evaluate(() => window.CARIBOU.state.party.map(m => `${m.species}@${m.level}`))));
await browser.close(); server.close();
