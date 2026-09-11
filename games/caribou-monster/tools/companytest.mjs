// Whoever turns up is somebody you can SEE.
//
// Two faults this guards, both reported from a real playthrough:
//
//   * Anybody who joined you was folded onto the player's own tile so they
//     would not slide in from a corner. They were then drawn underneath the
//     player for the whole scene they had turned up for — the doorstep
//     conversation read as a voice from nowhere, and the speaker only became
//     visible once the scene ended and you took a step.
//   * Bandit was dismissed the moment Sammy was the one playing, on the
//     reasoning that she would be in Sammy's party. She is not in anybody's
//     party on that doorstep. Sammy got three paragraphs about a dog sitting
//     on her foot with no dog on the screen.
//
// Both protagonists are checked, because the opening is written for two and
// testing one proves half of it.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const f = path.join('.', u === '/' ? '/index.html' : u);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
let fails = 0;
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
page.on('pageerror', (e) => { console.log('  PAGE ERROR', e.message); fails++; });

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
const wait = (ms) => page.waitForTimeout(ms);

for (const who of ['matthew', 'sammy']) {
  console.log(`\n--- the first morning, as ${who} ---`);
  await page.evaluate((look) => {
    const g = window.CARIBOU;
    g.startNewGame({ name: look === 'sammy' ? 'Sammy' : 'Matthew', look, difficulty: 'easy' });
    g.state.settings.textSpeed = 2;
    g.dialogueForTest.speedIndex = 2;
  }, who);
  await wait(900);

  // Out of the house and onto the step, then run the scene that has been
  // reported as talking to nobody.
  await page.evaluate(() => window.CARIBOU.teleport('twinleaf'));
  await wait(900);
  for (let i = 0; i < 60; i++) {
    const busy = await page.evaluate(() => {
      const g = window.CARIBOU;
      return !!(g.overworld && g.overworld.script) || g.dialogueForTest.visible;
    });
    if (!busy) break;
    await page.keyboard.press('KeyZ');
    await wait(60);
  }
  await page.evaluate(() => window.CARIBOU.overworld.runScript('buddyWaiting'));
  await wait(1200);

  // Mid-scene is the moment that matters: this is when the player is reading
  // the conversation and looking for the person having it.
  const mid = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    const p = w.player;
    const body = (b) => (b && b.visible
      ? { visible: true, onPlayer: b.x === p.x && b.y === p.y, x: b.x, y: b.y }
      : { visible: false });
    return { player: { x: p.x, y: p.y }, companion: body(w.companion), pet: body(w.pet) };
  });

  check(mid.companion.visible, `${who}: the other one is on screen while they are talking`,
    JSON.stringify(mid.companion));
  check(mid.companion.visible && !mid.companion.onPlayer,
    `${who}: and is not standing inside the player`,
    `player ${mid.player.x},${mid.player.y}`);
  check(mid.pet.visible, `${who}: Bandit is on screen too`, JSON.stringify(mid.pet));
  check(mid.pet.visible && !mid.pet.onPlayer, `${who}: and she is not inside the player either`);
  check(!(mid.companion.visible && mid.pet.visible
    && mid.companion.x === mid.pet.x && mid.companion.y === mid.pet.y),
    `${who}: and the two of them are not stood on the same tile`,
    `${mid.companion.x},${mid.companion.y} vs ${mid.pet.x},${mid.pet.y}`);

  // Finish the scene and check she is still walking with them afterwards.
  for (let i = 0; i < 200; i++) {
    const busy = await page.evaluate(() => {
      const g = window.CARIBOU;
      return !!(g.overworld && g.overworld.script) || g.dialogueForTest.visible;
    });
    if (!busy) break;
    await page.evaluate(() => {
      const d = window.CARIBOU.dialogueForTest;
      d.shown = d.currentText.length;
      if (d.choice) d.answer(0); else d.advance();
    });
    await wait(50);
  }
  const after = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    return {
      pet: !!(w.pet && w.pet.visible),
      companion: !!(w.companion && w.companion.visible),
      withUs: !!window.CARIBOU.state.flags.banditWithUs,
    };
  });
  check(after.pet, `${who}: Bandit is still following once the scene is over`);
  check(after.companion, `${who}: and so is the other one`);
}

// And nobody a script conjures up arrives standing inside the player.
console.log('\n--- somebody a scene puts in front of you ---');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
});
await wait(800);
await page.evaluate(() => window.CARIBOU.teleport('route201'));
await wait(800);
const spawned = await page.evaluate(() => {
  const s = window.CARIBOU.overworld;
  const p = s.world.player;
  // Ask for the player's exact tile, which is what a careless scene does.
  let made = null;
  s.runScript(null, null, async (ctx) => {
    made = ctx.spawnNpc({ id: 'zz_probe', look: 'rivalGirl', x: p.x, y: p.y, dir: 'down', name: 'Probe' });
  });
  return made ? { x: made.x, y: made.y, px: p.x, py: p.y } : null;
});
check(!!spawned, 'a scene can put somebody on the map');
check(spawned && !(spawned.x === spawned.px && spawned.y === spawned.py),
  'and they do not arrive standing inside the player',
  spawned ? `asked for ${spawned.px},${spawned.py}, stood at ${spawned.x},${spawned.y}` : '');

console.log(fails ? `\n${fails} failure(s)` : '\ncompany: all checks passed');
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
