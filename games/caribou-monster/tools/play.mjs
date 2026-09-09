// Drives the real game in Chromium and screenshots each major state.
// This is the smoke test: if a screen throws, it shows up here.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '/tmp/shots';
const W = Number(process.env.W || 800);
const H = Number(process.env.H || 400);
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
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
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message)));

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 5000 });

const shot = async (name) => {
  await page.waitForTimeout(280);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  process.stdout.write(`  shot ${name}\n`);
};
const run = (fn, ...args) => page.evaluate(fn, ...args);
const key = async (k, n = 1, delay = 90) => {
  for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(delay); }
};
// Movement needs the key HELD, not tapped: the world only starts a step
// while a direction is down.
const hold = async (k, ms) => {
  await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  await page.keyboard.up(k);
  await page.waitForTimeout(120);
};

console.log('--- driving the game ---');
await shot('01-title');

// New game straight through the API so the run is deterministic.
await run(() => window.CARIBOU.startNewGame({ name: 'Matthew', look: 'boy', difficulty: 'easy' }));
await page.waitForTimeout(500);
await shot('02-house');

// Out the front door — held, so the player actually walks.
await hold('ArrowDown', 900);
await page.waitForTimeout(900);
await shot('03-town');

// The lab.
await run(() => window.CARIBOU.teleport('rowan_lab'));
await page.waitForTimeout(900);
await shot('04-lab');

// Talk to the professor: walk up to her and press A.
await run(() => {
  const w = window.CARIBOU.overworld.world;
  w.player.x = 6; w.player.y = 3; w.player.dir = 'up';
});
await key('KeyZ', 1, 400);
await shot('05-starter-dialogue');
await key('KeyZ', 6, 320);
await shot('06-starter-choice');

// Pick Chimchar (second option).
await key('ArrowDown', 1, 150);
await key('KeyZ', 1, 400);
await shot('07-starter-preview');
await key('KeyZ', 4, 320);
await shot('08-starter-confirm');
await key('KeyZ', 8, 300);
await shot('09-starter-got');

const party = await run(() => window.CARIBOU.state.party.map((m) => `${m.species}:L${m.level}`));
console.log('  party after starter:', party);

// Force a party if the script did not complete, so later screens still work.
await run(() => {
  const g = window.CARIBOU;
  if (!g.state.party.length) {
    g.state.flags.gotStarter = true;
    g.state.starterBase = 4;
    window.__forced = true;
  }
});
await run(() => {
  const g = window.CARIBOU;
  if (window.__forced) {
    import('./src/game/monster.js').then((m) => {
      g.state.party.push(m.createMonster(4, 12));
      g.state.party.push(m.createMonster(10, 10));
    });
  }
});
await page.waitForTimeout(400);

// Overworld route with grass.
await run(() => window.CARIBOU.teleport('route201'));
await page.waitForTimeout(900);
await shot('10-route1');

await run(() => window.CARIBOU.teleport('route202'));
await page.waitForTimeout(900);
await shot('11-forest');

await run(() => window.CARIBOU.teleport('oreburgh'));
await page.waitForTimeout(900);
await shot('12-city');

await run(() => window.CARIBOU.teleport('oreburgh_gym'));
await page.waitForTimeout(900);
await shot('13-gym');

await run(() => window.CARIBOU.teleport('oreburgh_gate'));
await page.waitForTimeout(900);
await shot('14-cave');

// Wild battle.
await run(() => { window.CARIBOU.teleport('route201'); });
await page.waitForTimeout(700);
await run(() => window.CARIBOU.startWildBattle(13, 6));
await page.waitForTimeout(900);
await shot('15-battle-intro');
await key('KeyZ', 5, 260);
await shot('16-battle-command');
await key('KeyZ', 1, 350);
await shot('17-battle-moves');
await key('KeyZ', 1, 500);
await page.waitForTimeout(1400);
await shot('18-battle-turn');
await key('KeyZ', 6, 300);
await shot('19-battle-after');

// Bag inside battle.
await run(() => {
  const s = window.CARIBOU.screens.top;
  if (s && s.constructor.name === 'BattleScreen') { s.mode = 'bag'; }
});
await shot('20-battle-bag');

// Party picker inside battle.
await run(() => {
  const s = window.CARIBOU.screens.top;
  if (s && s.constructor.name === 'BattleScreen') { s.mode = 'party'; }
});
await shot('21-battle-party');

// Escape the battle and open the menus.
await run(() => {
  const g = window.CARIBOU;
  while (g.screens.stack.length > 1) g.screens.pop();
});
await page.waitForTimeout(400);
await run(() => window.CARIBOU.openMenu());
await shot('22-menu');

for (const [name, open] of [
  ['23-party', () => window.CARIBOU.openParty()],
  ['24-bag', () => window.CARIBOU.openBag()],
  ['25-dex', () => window.CARIBOU.openDex()],
  ['26-card', () => window.CARIBOU.openCard()],
  ['27-pc', () => window.CARIBOU.openPC()],
  ['28-shop', () => window.CARIBOU.openShop()],
  ['29-link', () => window.CARIBOU.openMultiplayer()],
  ['30-debug', () => { window.CARIBOU.debugEnabled = true; window.CARIBOU.openDebug(); }],
]) {
  try {
    await run(open);
    await shot(name);
    await run(() => window.CARIBOU.screens.pop());
    await page.waitForTimeout(150);
  } catch (e) { console.log(`  !! ${name}: ${e.message}`); }
}

// World Circuit: the career hub, every tab, a live bracket and the press.
await run(() => {
  const g = window.CARIBOU;
  const c = g.state.circuit;
  c.joined = true;
  c.cp = 900; c.rating = 1190; c.peakRating = 1210;
  c.wins = 18; c.losses = 6; c.streak = 4; c.bestStreak = 7;
  c.titles = ['rookie_cup', 'sinnoh_open'];
  c.hype = 62; c.respect = 44;
  g.career.enter('regional_invitational');
  g.career.recordRound(true, { survivors: 3, turns: 14, star: 'Infernape' });
});
for (const [name, open] of [
  ['31-circuit-career', () => window.CARIBOU.openCircuit({ tab: 0 })],
  ['32-circuit-events', () => window.CARIBOU.openCircuit({ tab: 1 })],
  ['33-circuit-ranks', () => window.CARIBOU.openCircuit({ tab: 2 })],
  ['34-circuit-news', () => window.CARIBOU.openCircuit({ tab: 3 })],
]) {
  try {
    await run(open);
    await shot(name);
    await run(() => window.CARIBOU.screens.pop());
    await page.waitForTimeout(150);
  } catch (e) { console.log(`  !! ${name}: ${e.message}`); }
}
// A full story, opened for reading.
try {
  await run(() => {
    const g = window.CARIBOU;
    const s = g.openCircuit({ tab: 3 });
    s.reading = g.state.circuit.news[0];
  });
  await shot('35-circuit-article');
  await run(() => window.CARIBOU.screens.pop());
} catch (e) { console.log(`  !! 35-circuit-article: ${e.message}`); }

// The live bracket.
try {
  await run(() => window.CARIBOU.resumeTournament());
  await shot('36-tournament');
  await run(() => window.CARIBOU.screens.pop());
} catch (e) { console.log(`  !! 36-tournament: ${e.message}`); }

// Podium and press conference.
try {
  await run(() => {
    const g = window.CARIBOU;
    while (g.state.circuit.active && !g.state.circuit.active.done) {
      g.career.recordRound(true, { survivors: 2, turns: 18, star: 'Luxray' });
    }
    const s = g.resumeTournament();
    s.onResume();
  });
  await shot('37-tournament-result');
  await run(() => window.CARIBOU.screens.pop());
  await run(() => window.CARIBOU.openPress());
  await shot('38-press');
  await run(() => {
    const s = window.CARIBOU.screens.top;
    if (s && s.constructor.name === 'PressScreen') s._answer(1);
  });
  await shot('39-press-answer');
  await run(() => window.CARIBOU.screens.pop());
} catch (e) { console.log(`  !! press: ${e.message}`); }

// Save + reload round trip.
await run(async () => { await window.CARIBOU.save.save(window.CARIBOU.state); });
const meta = await run(async () => window.CARIBOU.save.peek());
console.log('  save meta:', JSON.stringify(meta));

console.log(errors.length ? `\nERRORS (${errors.length}):\n` + errors.slice(0, 25).join('\n') : '\nno console errors');
await browser.close();
server.close();
