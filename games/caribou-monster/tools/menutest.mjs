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
/**
 * Logical game pixels -> page pixels.
 *
 * The canvas is CENTRED in the viewport, so multiplying by `scale` alone is
 * out by however wide the letterbox is — about 22px here. That is survivable
 * when you are aiming at a big chip and fatal when you are aiming at a
 * seven-pixel scrollbar, which is how this went unnoticed.
 */
const toPage = (lx, ly) => page.evaluate(([x, y]) => {
  const g = window.CARIBOU;
  const r = g.display.canvas.getBoundingClientRect();
  return { x: r.left + (x / g.display.width) * r.width, y: r.top + (y / g.display.height) * r.height };
}, [lx, ly]);

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

// --- every long list can be scrolled with a thumb ---
//
// The Pokedex could not be scrolled at all on a phone. The virtual D-pad is
// only drawn over the world, and tapping a row in a list SELECTS it, so a
// list longer than the screen simply ended there — with 493 species, that is
// most of the Pokedex. A way in and a way out is not enough; a list you
// cannot move through is a list you cannot use.
// --- and the way out survives whatever the screen is showing ------------
//
// A BACK chip drawn at the END of a render method is only drawn when the
// method reaches the end of itself. The Pokedex returned early whenever the
// highlighted entry was one you had not met — which is most of them, most of
// the time — and skipped its own way out. On a phone there is no B key, so
// that was a screen with no exit. Opening a screen in its happy state proves
// nothing; these are the awkward ones.
console.log('\n--- the way out is drawn whatever the screen is showing ---');
for (const [name, opener, setup, why] of [
  ['DexScreen', 'openDex', () => {
    const g = window.CARIBOU;
    g.state.dex.seen = {}; g.state.dex.caught = {};
  }, 'with an empty Pokedex'],
  ['DexScreen', 'openDex', () => {
    const g = window.CARIBOU;
    g.state.dex.seen = { 387: true }; g.state.dex.caught = { 387: true };
  }, 'with the cursor on an entry you have never met'],
  ['BagScreen', 'openBag', () => { window.CARIBOU.state.inventory.items = {}; }, 'with an empty bag'],
  ['PartyScreen', 'openParty', () => { window.CARIBOU.state.party.length = 0; }, 'with no party at all'],
]) {
  const base = await depth();
  await page.evaluate(setup);
  await page.evaluate((o) => window.CARIBOU[o](), opener);
  await wait(340);
  const nowTop = await top();
  const chip = await backChip();
  check(nowTop === name && !!chip, `${name} still draws a way out ${why}`,
    chip ? `${Math.round(chip.x)},${Math.round(chip.y)}` : 'NO CHIP');
  if (chip) {
    await page.mouse.click(chip.x, chip.y);
    await wait(340);
    check(await depth() === base, `${name} still closes on that chip ${why}`);
  }
  await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
  await wait(160);
}

console.log('\n--- every long list scrolls by touch alone ---');
// A bag with one Potion in it has no list to scroll, so fill it with enough
// of one pocket to be longer than the screen — which is the only case the
// bug could ever show up in.
await page.evaluate(() => {
  const g = window.CARIBOU;
  const inv = g.state.inventory;
  for (const id of g.debugItemIds ? g.debugItemIds() : []) inv.items[id] = 3;
});

for (const [name, opener] of [
  ['DexScreen', 'openDex'],
  ['BagScreen', 'openBag'],
  ['DebugScreen', 'openDebug'],
]) {
  const base = await depth();
  await page.evaluate((o) => window.CARIBOU[o](), opener);
  await wait(340);
  if (await top() !== name) {
    check(false, `${name} opens`, await top());
    await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
    continue;
  }

  // Start from the top of a list nobody has touched. `detail` matters on the
  // Pokedex: a stray tap opens an entry, and a drag inside an entry is not a
  // drag on the list.
  await page.evaluate(() => {
    const t = window.CARIBOU.screens.top;
    t.scroll = 0; t.index = 0; t.detail = false;
    // The Bag opens on whichever pocket is first; point it at the one that
    // actually has a list in it, which is what a player with a full bag sees.
    if (t.pocket !== undefined && t.items) {
      for (let p = 0; p < 6; p++) { t.pocket = p; if (t.items.length > 6) break; }
      t.index = 0; t.scroll = 0;
    }
  });
  await wait(120);
  const before = await page.evaluate(() => window.CARIBOU.screens.top.scroll || 0);

  const box = await page.evaluate(() => {
    const d = window.CARIBOU.display;
    return { w: d.width, h: d.height };
  });
  const p0 = await toPage(box.w * 0.35, box.h * 0.78);
  const p1 = await toPage(box.w * 0.35, box.h * 0.18);
  await page.mouse.move(p0.x, p0.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(p0.x, p0.y + (p1.y - p0.y) * (i / 10));
    await wait(20);
  }
  await page.mouse.up();
  await wait(260);

  const after = await page.evaluate(() => window.CARIBOU.screens.top.scroll || 0);
  check(after > before, `${name} scrolls when you drag it`, `scroll ${before} -> ${after}`);

  // And the scrollbar arrow is a thing a thumb can hit.
  const bar = await page.evaluate(() => {
    const b = window.CARIBOU.screens.top.bar;
    return b && b.count > b.rows ? { x: b.x, y: b.y, w: b.w, h: b.h, arrow: b.arrow } : null;
  });
  check(!!bar, `${name} draws a scrollbar`, bar ? 'yes' : 'none');
  if (bar) {
    // Back to the top first: an arrow cannot page a list that is already at
    // its end, and testing that it does not is testing nothing.
    await page.evaluate(() => { const t = window.CARIBOU.screens.top; t.scroll = 0; t.index = 0; });
    await wait(120);
    const atTop = await page.evaluate(() => window.CARIBOU.screens.top.scroll);
    const a = await toPage(bar.x + bar.w / 2, bar.y + bar.h - bar.arrow / 2);
    await page.touchscreen.tap(a.x, a.y);
    await wait(300);
    const pushed = await page.evaluate(() => {
      const t = window.CARIBOU.screens.top;
      return t.scroll === undefined ? `left the screen (${t.constructor.name})` : t.scroll;
    });
    check(typeof pushed === 'number' && pushed > atTop,
      `${name} pages down when the arrow is tapped`, `${atTop} -> ${pushed}`);
  }
  await page.evaluate((d) => { while (window.CARIBOU.screens.stack.length > d) window.CARIBOU.screens.pop(); }, base);
  await wait(150);
}

if (errs.length) { console.log(`  page errors: ${errs.slice(0, 4).join(' | ')}`); fails += errs.length; }
console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nevery menu has a way out');
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
