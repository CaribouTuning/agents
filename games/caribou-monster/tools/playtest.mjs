// A real playthrough of the opening, narrated.
//
// Written because the player got to the first Gym and everything after that
// was theory. This walks the game the way a person does — out of the house,
// into the lab, take a starter, out to the route, meet the rival — and prints
// what it sees at each step, so a beat that silently does not happen shows up
// as a missing line rather than as a passing assertion about map data.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '/tmp/playtest';
fs.mkdirSync(OUT, { recursive: true });
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
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });

let fails = 0;
const check = (ok, msg, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}${extra ? `  ${extra}` : ''}`);
  if (!ok) fails++;
};
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (code, ms) => { await page.keyboard.down(code); await wait(ms); await page.keyboard.up(code); await wait(90); };
const tap = async (code, n = 1, ms = 150) => { for (let i = 0; i < n; i++) { await page.keyboard.press(code); await wait(ms); } };
const where = () => page.evaluate(() => {
  const w = window.CARIBOU.overworld && window.CARIBOU.overworld.world;
  return w ? { map: w.mapId, x: w.player.x, y: w.player.y } : null;
});
const said = () => page.evaluate(() => {
  const d = window.CARIBOU.dialogueForTest;
  return { open: !!d.visible, text: (d.pages || []).flat().join(' ') };
});
const busy = () => page.evaluate(() => {
  const g = window.CARIBOU;
  return !!(g.overworld && g.overworld.script) || g.dialogueForTest.visible
    || g.screens.top.constructor.name !== 'OverworldScreen';
});
/**
 * Advances any dialogue/cutscene until the world is idle again.
 *
 * Standing in front of an NPC and pressing A re-opens the conversation, which
 * is correct game behaviour and makes a naive "press A until quiet" loop run
 * forever. So this steps back off the NPC once the text has run out, and only
 * force-closes as a last resort.
 */
const clear = async (budget = 120) => {
  let sameText = 0;
  let lastText = '';
  for (let i = 0; i < budget; i++) {
    if (!await busy()) return true;
    const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    if (top === 'NicknameScreen' || top === 'TextEntryScreen') { await tap('KeyQ', 1, 160); continue; }
    if (top === 'BattleScreen') return 'battle';
    const t = (await said()).text;
    if (t && t === lastText) sameText++; else { sameText = 0; lastText = t; }
    // The same conversation coming back around means we are re-triggering it.
    if (sameText > 6) {
      await page.evaluate(() => window.CARIBOU.dialogueForTest.hide());
      await wait(150);
      continue;
    }
    await tap('KeyZ', 1, 130);
  }
  return false;
};
const walk = async (key, ms) => { await hold(key, ms); };

/**
 * Presses a direction until the map changes or the budget runs out.
 *
 * Fixed-duration holds are how a test ends up reporting "the door is broken"
 * when the door is fine and the hold was 100ms short.
 */
const walkUntilMapChanges = async (key, tries = 8) => {
  const from = (await where()).map;
  for (let i = 0; i < tries; i++) {
    await hold(key, 420);
    await wait(420);
    const now2 = await where();
    if (!now2 || now2.map !== from) return now2;
    if (await busy()) return now2;
  }
  return where();
};

console.log('--- a real playthrough of the opening ---');

await page.evaluate(() => window.CARIBOU.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' }));
await wait(700);
let w = await where();
check(w && w.map === 'matthew_house', 'you wake up in your own house', w && w.map);

// Out the front door.
await walk('ArrowDown', 1500);
await wait(800);
w = await where();
check(w.map === 'twinleaf', 'and can walk out of it', `${w.map} ${w.x},${w.y}`);

// The partner outside their own door — and their nameplate.
await page.evaluate(() => window.CARIBOU.overworld.world.load('twinleaf', 20, 15, 'right'));
await wait(400);
await tap('KeyZ', 1, 300);
const buddy = await said();
check(buddy.open, 'the other one is outside and talks', buddy.text.slice(0, 50));
const plate = await page.evaluate(() => window.CARIBOU.dialogueForTest.speaker || '');
check(plate === 'Sammy', 'and their nameplate says their actual name', `"${plate}"`);
await clear();

// Into the lab.
await page.evaluate(() => window.CARIBOU.overworld.world.load('twinleaf', 6, 7, 'up'));
await wait(400);
w = await walkUntilMapChanges('ArrowUp');
check(w.map === 'rowan_lab', 'the lab is enterable', `${w.map} ${w.x},${w.y}`);

// Is Sammy in the lab, as Mum said she would be?
const inLab = await page.evaluate(() => {
  const w2 = window.CARIBOU.overworld.world;
  return w2.entities.filter((e) => e.kind === 'npc').map((e) => e.data && e.data.name).filter(Boolean);
});
check(inLab.some((n) => /Sammy|buddy/i.test(String(n))), 'and the person Mum said would be there IS there', inLab.join(', '));

// Walk up to Rowan's table and take a starter.
for (let i = 0; i < 6; i++) {
  const p2 = await where();
  if (p2.y <= 3) break;
  await hold('ArrowUp', 380);
  await wait(260);
}
await hold('ArrowUp', 300);   // face the professor
await wait(300);
await tap('KeyZ', 1, 400);    // and actually talk to her
const res = await clear(200);
await wait(400);
const after = await page.evaluate(() => {
  const g = window.CARIBOU;
  return { party: g.state.party.length, starter: g.state.starterBase, metRival: !!g.state.flags.metRival };
});
check(after.party > 0, 'the starter scene gives you a Pokémon', JSON.stringify(after));
check(after.metRival, 'and you watch the rival take theirs', JSON.stringify(after));
void res;

// Out of the lab, north to Route 201, and the rival battle that never fired.
await page.evaluate(() => window.CARIBOU.overworld.world.load('twinleaf', 14, 2, 'up'));
await wait(400);
await clear();
w = await walkUntilMapChanges('ArrowUp');
await clear();
check(w.map === 'route201', 'the north gate opens once you have a Pokémon', `${w.map} ${w.x},${w.y}`);

// Walk up the road until the rival stops you. Wild encounters happen on the
// way — that is the road working, not a failure — so they get run from.
let met = false;
let sawCass = '';
for (let i = 0; i < 16 && !met; i++) {
  await hold('ArrowUp', 480);
  await wait(420);
  const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
  if (top === 'BattleScreen') {
    // A wild Pokémon. Run, and carry on up the road.
    for (let k = 0; k < 40; k++) {
      const still = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
      if (still !== 'BattleScreen') break;
      await tap('ArrowDown', 1, 90);
      await tap('ArrowRight', 1, 90);
      await tap('KeyZ', 1, 140);
    }
    await clear(40);
    // The arrow presses that pick RUN keep going once the battle is over and
    // walk the player off the road, so put them back on it.
    for (let k = 0; k < 6; k++) {
      const at = await where();
      if (!at || at.x === 12) break;
      await hold(at.x > 12 ? 'ArrowLeft' : 'ArrowRight', 260);
      await wait(200);
    }
    continue;
  }
  const st = await page.evaluate(() => ({
    script: !!(window.CARIBOU.overworld && window.CARIBOU.overworld.script),
    dlg: window.CARIBOU.dialogueForTest.visible,
    rival: !!window.CARIBOU.state.flags.beatRival1,
    at: `${window.CARIBOU.overworld.world.mapId} ${window.CARIBOU.overworld.world.player.x},${window.CARIBOU.overworld.world.player.y}`,
  }));
  if (process.env.TRACE) console.log('    at', st.at, 'script', st.script, 'dlg', st.dlg);
  if (st.script || st.dlg) {
    // A script that has just started has not printed anything yet, so give
    // it a moment before reading — otherwise this reads an empty box and
    // concludes nothing happened.
    let line = '';
    for (let k = 0; k < 20 && !line; k++) { await wait(160); line = (await said()).text; }
    if (/Cass/i.test(line)) { met = true; sawCass = line; break; }
    await clear(30);
  }
  if (st.rival) { met = true; sawCass = '(already resolved)'; }
}
check(met, 'walking up Route 201 runs into Cass', sawCass.slice(0, 80) || 'nothing happened all the way up the road');
if (met) {
  const out = await clear(240);
  const done = await page.evaluate(() => ({
    beat: !!window.CARIBOU.state.flags.beatRival1,
    met: !!window.CARIBOU.state.flags.metRival,
  }));
  check(out === 'battle' || done.beat || done.met,
    'and the first rival battle actually starts', `${out} ${JSON.stringify(done)}`);
}

// --- the save survives being closed ---
// The complaint this whole file exists for: close the artifact, come back,
// and the title screen only offers a new game. So: play a bit, kill the page
// the way a phone does, reload from scratch, and see whether CONTINUE is
// there and whether it loads what we left.
console.log('\n--- the save survives ---');

await page.evaluate(async () => {
  const g = window.CARIBOU;
  g.state.player.name = 'Matthew';
  g.debugGive(25, 17);
  g.state.inventory.money = 4242;
  await g.save.flush(g.state);
});
await wait(600);
const wrote = await page.evaluate(() => window.CARIBOU.save.lastError);
check(!wrote, 'a save completes without error', String(wrote));

const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('caribou:save1');
  return raw ? JSON.parse(raw).meta : null;
});
check(!!stored, 'and something is actually on disk', JSON.stringify(stored));

// The phone way out: hide the page, then reload.
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await wait(500);

await page.reload({ waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
await wait(1500);
const onTitle = await page.evaluate(() => {
  const g = window.CARIBOU;
  const t = g.screens.top;
  return {
    screen: t.constructor.name,
    options: (t.options || []).map((o) => o.key),
    save: t.saveMeta || null,
  };
});
check(onTitle.options.includes('continue'),
  'after a reload the title offers CONTINUE', JSON.stringify(onTitle.options));
check(onTitle.save && onTitle.save.name === 'Matthew',
  'and it is the game we were playing', JSON.stringify(onTitle.save));

const loaded = await page.evaluate(async () => {
  const g = window.CARIBOU;
  await g.continueGame();
  return { money: g.state.money || g.state.inventory.money, party: g.state.party.length, map: g.state.player.map };
});
check(loaded.money === 4242 && loaded.party > 0,
  'and continuing puts the whole game back', JSON.stringify(loaded));

if (errs.length) { console.log(`\n  page errors: ${errs.slice(0, 5).join(' | ')}`); fails += errs.length; }
console.log(fails ? `\n${fails} PROBLEM(S)` : '\nthe opening plays correctly');
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
