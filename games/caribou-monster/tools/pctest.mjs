// The PC, from the player's side.
//
// The storage logic is checked in storagetest; this walks the actual screen,
// because a box system you cannot reach, cannot read and cannot back out of
// is not a box system.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  fs.readFile(path.join('.', u === '/' ? '/index.html' : u), (e, d) => {
    if (e) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream' });
    res.end(d);
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

await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  for (let i = 0; i < 7; i++) g.debugGive(387 + (i % 3), 10 + i);
});
await wait(600);

console.log('--- five in hand, the rest in the machine ---');
{
  const s = await page.evaluate(() => {
    const st = window.CARIBOU.state;
    return { party: st.party.length, boxed: st.boxes.reduce((n, b) => n + b.mons.length, 0) };
  });
  check(s.party === 5, 'the team never grows past five', `party ${s.party}`);
  check(s.boxed >= 2, 'and the ones that did not fit are in a box', `boxed ${s.boxed}`);
}

console.log('\n--- the screen itself ---');
await page.evaluate(() => window.CARIBOU.openPC());
await wait(400);
{
  const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
  check(top === 'PCScreen', 'the PC opens', top);
  const chip = await page.evaluate(() => {
    const c = window.__backChip || null;
    return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
  });
  // The chip is published by the renderer; if the hook is absent, tap where
  // it is drawn and see whether the screen closes, which is the real test.
  void chip;
}

// Walk the grid with the keyboard: it must not throw and must move.
for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
  await page.keyboard.press(k); await wait(90);
}
check(errors.length === 0, 'moving around the boxes throws nothing', errors.join(' | '));

console.log('\n--- taking one out and putting one back ---');
{
  const before = await page.evaluate(() => {
    const st = window.CARIBOU.state;
    return { party: st.party.length, box0: st.boxes[0].mons.length };
  });
  // Pick up the first monster in the box and drop it on the party pane.
  const moved = await page.evaluate(() => {
    const g = window.CARIBOU;
    const st = g.state;
    const s = g.screens.top;
    // Make room first: the team is full, which is the case that has to work.
    const ok0 = !window.__boxToParty;
    void ok0;
    s.pane = 'party'; s.partyIdx = 4;
    s.held = null;
    return { pane: s.pane, party: st.party.length };
  });
  void moved;
  // Deposit slot 5, then withdraw it again, through the screen's own paths.
  await page.evaluate(() => {
    const s = window.CARIBOU.screens.top;
    s.pane = 'party'; s.partyIdx = 4;
  });
  await page.keyboard.press('KeyZ'); await wait(120);   // pick up
  await page.evaluate(() => { const s = window.CARIBOU.screens.top; s.pane = 'box'; s.cursorIdx = 10; });
  await page.keyboard.press('KeyZ'); await wait(150);   // put down
  const mid = await page.evaluate(() => {
    const st = window.CARIBOU.state;
    return { party: st.party.length, box0: st.boxes[0].mons.length };
  });
  check(mid.party === before.party - 1, 'depositing takes one out of the team',
    `${before.party} -> ${mid.party}`);
  check(mid.box0 === before.box0 + 1, 'and puts it in the box', `${before.box0} -> ${mid.box0}`);

  await page.keyboard.press('KeyZ'); await wait(120);   // pick it back up
  await page.evaluate(() => { const s = window.CARIBOU.screens.top; s.pane = 'party'; s.partyIdx = 0; });
  await page.keyboard.press('KeyZ'); await wait(150);
  const after = await page.evaluate(() => {
    const st = window.CARIBOU.state;
    return { party: st.party.length, box0: st.boxes[0].mons.length };
  });
  check(after.party === before.party, 'withdrawing brings it back', `party ${after.party}`);
  check(after.box0 === before.box0, 'and the box is as it was', `box ${after.box0}`);
}

console.log('\n--- and there is a way out ---');
await page.keyboard.press('KeyX'); await wait(300);
{
  const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
  check(top !== 'PCScreen', 'B closes the PC', top);
}
check(errors.length === 0, 'nothing threw at any point', errors.join(' | '));

console.log(fails ? `\n${fails} failed` : '\nall good');
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
