// Every menu has a way out.
//
// The bug this exists for: on a phone, some screens could be entered and not
// left. There is no keyboard there, so a screen whose only exit is a key
// press is a trap, and a screen that draws no BACK chip gives a thumb
// nothing to aim at.
//
// So this opens every screen the game can put in front of a player and
// proves three things about each one:
//
//   1. pressing B pops it (the controller answer)
//   2. it draws a BACK chip, or a labelled key that leaves (the thumb answer)
//   3. tapping that chip pops it
//
// A screen that is deliberately a root — the overworld, the title — is
// exempt, and says so by name rather than by being quietly skipped.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '/tmp/menutest';
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
// A phone, because that is where a trapped menu actually traps somebody.
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });

let fails = 0;
const check = (ok, msg, extra = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}${extra ? `  ${extra}` : ''}`);
  if (!ok) fails++;
};
const wait = (ms) => page.waitForTimeout(ms);
const tapKey = async (code, ms = 120) => {
  await page.keyboard.down(code); await wait(ms); await page.keyboard.up(code); await wait(160);
};

// A game far enough along that every menu has something to show.
await page.evaluate(async () => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
  const { runCommand } = await import('./src/game/testmode.js');
  runCommand(g, '/chapter badge4');
  runCommand(g, '/mon turtwig 30');
  runCommand(g, '/give potion 5');
  g.state.circuit.joined = true;
  g.state.settings.testMode = true;
  g.applySettings();
});
await wait(700);

const depth = () => page.evaluate(() => window.CARIBOU.screens.stack.length);
const top = () => page.evaluate(() => window.CARIBOU.screens.top.constructor.name);

/** Where the BACK chip is, in CSS pixels, or null if none is registered. */
const backChip = () => page.evaluate(() => {
  const g = window.CARIBOU;
  const c = g.controlsForTest && g.controlsForTest.backChip();
  if (!c) return null;
  const d = g.display;
  return { x: (c.x + c.w / 2) * d.scale, y: (c.y + c.h / 2) * d.scale };
});

// Screens a player can reach, and how they get there. Anything needing a
// live opponent (battle, trade) is proved by its own suite.
const SCREENS = [
  ['MainMenuScreen', 'openMenu'],
  ['PartyScreen', 'openParty'],
  ['BagScreen', 'openBag'],
  ['DexScreen', 'openDex'],
  ['JournalScreen', 'openJournal'],
  ['TrainerCardScreen', 'openCard'],
  ['OptionsScreen', 'openOptions'],
  ['SaveScreen', 'openSave'],
  ['PCScreen', 'openPC'],
  ['MultiplayerScreen', 'openMultiplayer'],
  ['CircuitScreen', 'openCircuit'],
  ['TownMapScreen', 'openTownMap'],
  ['DebugScreen', 'openDebug'],
];

console.log('--- B closes every screen ---');
for (const [name, opener] of SCREENS) {
  const base = await depth();
  const opened = await page.evaluate((o) => { window.CARIBOU[o](); return true; }, opener);
  await wait(320);
  const nowTop = await top();
  if (!opened || nowTop !== name) {
    check(false, `${name} opens`, `top is ${nowTop}`);
    // Get back to a known state before the next one.
    await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
    continue;
  }
  await tapKey('KeyX');            // B
  await wait(260);
  const after = await depth();
  check(after === base, `${name} closes on B`, `${base} -> ${after}`);
  if (after !== base) {
    await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
  }
}

console.log('\n--- and a thumb has something to aim at ---');
for (const [name, opener] of SCREENS) {
  const base = await depth();
  await page.evaluate((o) => window.CARIBOU[o](), opener);
  await wait(320);
  if (await top() !== name) {
    await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
    continue;
  }
  const chip = await backChip();
  check(!!chip, `${name} draws a BACK chip`, chip ? `${Math.round(chip.x)},${Math.round(chip.y)}` : 'none');
  if (chip) {
    await page.touchscreen.tap(chip.x, chip.y);
    await wait(320);
    const after = await depth();
    check(after === base, `${name} closes when the chip is tapped`, `${base} -> ${after}`);
  }
  await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
}

// The text screens are the ones with no BACK chip at all today: B types a
// backspace there, so the only way out is the grid's own SKIP key.
console.log('\n--- the typing screens ---');
for (const [name, open] of [
  ['TextEntryScreen', () => window.CARIBOU.openTextEntry('Command', 24, () => {})],
  ['NicknameScreen', () => {
    const m = window.CARIBOU.state.party[0];
    window.CARIBOU.openNickname(m, () => {});
  }],
]) {
  const base = await depth();
  await page.evaluate(open);
  await wait(320);
  check(await top() === name, `${name} opens`, await top());
  const chip = await backChip();
  check(!!chip, `${name} draws a BACK chip`, chip ? 'yes' : 'none — a thumb has no way out');
  if (chip) {
    await page.touchscreen.tap(chip.x, chip.y);
    await wait(320);
    check(await depth() === base, `${name} closes when the chip is tapped`);
  }
  await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
}

if (errs.length) { console.log(`  page errors: ${errs.slice(0, 4).join(' | ')}`); fails += errs.length; }
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nevery menu has a way out');
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
