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
// A real phone shape, portrait AND landscape.
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await (await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true })).newPage();
  page.on('pageerror', (e) => console.log('  PAGE ERROR', e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
  const wait = (ms) => page.waitForTimeout(ms);
  await page.evaluate(() => {
    const g = window.CARIBOU;
    g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
    g.state.flags.gotStarter = true;
    g.debugGive(387, 8);
    for (let i = 1; i <= 60; i++) { g.state.dex.seen[i] = true; if (i % 2) g.state.dex.caught[i] = true; }
  });
  await wait(900);
  console.log(`\n=== ${vp.width}x${vp.height} (${vp.width > vp.height ? 'landscape' : 'portrait'}) ===`);
  // Tap the BACK chip where it is drawn, converting logical -> page pixels.
  const tapBack = async () => {
    const at = await page.evaluate(() => {
      const g = window.CARIBOU;
      const top = g.screens.top;
      const chip = g.controlsForTest && g.controlsForTest.backChip();
      const c = document.getElementById('game').getBoundingClientRect();
      const d = g.display;
      if (!chip) return null;
      return {
        x: c.left + (chip.x + chip.w / 2) * (c.width / d.width),
        y: c.top + (chip.y + chip.h / 2) * (c.height / d.height),
        top: top.constructor.name,
      };
    });
    if (!at) return null;
    await page.touchscreen.tap(at.x, at.y);
    await wait(400);
    return at;
  };
  for (const [name, open] of [['DexScreen', 'openDex'], ['BagScreen', 'openBag'], ['PartyScreen', 'openParty']]) {
    await page.evaluate(() => { while (window.CARIBOU.screens.stack.length > 1) window.CARIBOU.screens.pop(); });
    await wait(200);
    await page.evaluate((o) => window.CARIBOU[o](), open);
    await wait(500);
    const got = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    const chip = await tapBack();
    const after = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    let escapedByKey = after;
    if (after === got) { await page.keyboard.press('KeyX'); await wait(400); escapedByKey = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name); }
    console.log(`  ${name.padEnd(12)} opened=${got.padEnd(12)} chip=${chip ? 'drawn' : 'NONE'} afterTap=${after.padEnd(14)} afterKeyX=${escapedByKey}`);
  }
  await page.close();
}
await browser.close(); server.close();
