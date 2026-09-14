// Does she actually keep up?
//
// A follower is easy to make look right for ten seconds in front of a camera
// and easy to get catastrophically wrong out of shot — walking off the ledge
// you jumped from, stalling against a tree, or quietly falling into the void
// while the player runs on. So this drives a long route over the platforms and
// across the glide gap and watches her the whole way, every frame, not just in
// the screenshots.

import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((rq, rs) => {
  const u = decodeURIComponent(rq.url.split('?')[0]);
  if (u === '/favicon.ico') { rs.writeHead(204); rs.end(); return; }
  fs.readFile(path.join('.', u === '/' ? '/index.html' : u), (e, d) => {
    if (e) { rs.writeHead(404); rs.end(''); return; }
    rs.writeHead(200, { 'Content-Type': MIME[path.extname(u)] || 'application/octet-stream' });
    rs.end(d);
  });
});
await new Promise(r => server.listen(0, r));
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await p.waitForFunction('!!window.GLIMMER', { timeout: 20000 });
await p.waitForTimeout(600);

// Watch every frame, not just the frames we happen to screenshot.
await p.evaluate(() => {
  const g = window.GLIMMER;
  g.watch = { maxGap: 0, rescues: 0, deepest: 0, frames: 0, glided: 0, jumped: 0, stranded: 0 };
  const base = g.update.bind(g);
  let prev = null;
  g.update = (dt) => {
    base(dt);
    const w = g.watch, h = g.hero.a, q = g.partner.a;
    // A rescue is a teleport: her position moves further in one frame than
    // any amount of running could. Measuring it by the gap collapsing misses
    // the case that matters most, which is her falling straight down.
    if (prev) {
      const moved = Math.hypot(q.x - prev.x, q.y - prev.y, q.z - prev.z);
      if (moved > 4) w.rescues++;
    }
    prev = { x: q.x, y: q.y, z: q.z };
    const far = Math.hypot(h.x - q.x, h.z - q.z);
    w.maxGap = Math.max(w.maxGap, far);
    // How far below the player she got. Depth relative to him is the honest
    // measure — both of them falling off together is the player's doing.
    w.deepest = Math.min(w.deepest, q.y - h.y);
    if (g.partner.state === 'glide') w.glided++;
    if (g.partner.state === 'jump') w.jumped++;
    if (g.watching && !q.onGround) w.restless++;
    w.frames++;
  };
});

const key = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); };
const hold = async (keys, ms) => {
  for (const k of keys) await p.keyboard.down(k);
  await p.waitForTimeout(ms);
  for (const k of keys) await p.keyboard.up(k);
};
const state = () => p.evaluate(() => {
  const g = window.GLIMMER;
  return {
    hero: [+g.hero.a.x.toFixed(1), +g.hero.a.y.toFixed(1), +g.hero.a.z.toFixed(1)],
    partner: [+g.partner.a.x.toFixed(1), +g.partner.a.y.toFixed(1), +g.partner.a.z.toFixed(1)],
    gap: +Math.hypot(g.hero.a.x - g.partner.a.x, g.hero.a.z - g.partner.a.z).toFixed(2),
  };
});

const VOID_LIMIT = 13;
const legs = [];
const leg = async (label, fn) => {
  await fn();
  await p.waitForTimeout(500);
  const st = await state();
  console.log(`${label.padEnd(26)} hero ${JSON.stringify(st.hero).padEnd(20)} `
    + `partner ${JSON.stringify(st.partner).padEnd(20)} gap ${st.gap}`);
  legs.push([label, st]);
  return st;
};

// A route that uses everything the meadow has.
await leg('run across the meadow', () => hold(['ArrowUp'], 1400));
await leg('turn and run back', () => hold(['ArrowDown'], 1600));
await leg('run left to the stairs', () => hold(['ArrowLeft', 'ArrowUp'], 1500));
await leg('jump the platform stair', async () => {
  for (let i = 0; i < 3; i++) { await hold(['ArrowLeft', 'ArrowUp', 'KeyZ'], 520); await p.waitForTimeout(280); }
});
await leg('run right across', () => hold(['ArrowRight'], 2200));
await leg('jump the stepping stones', async () => {
  for (let i = 0; i < 4; i++) { await hold(['ArrowRight', 'KeyZ'], 560); await p.waitForTimeout(260); }
});
await leg('glide the long gap', () => hold(['ArrowRight', 'KeyZ'], 2000));
// Standing still is its own test. A follower that fidgets is invisible while
// you are running and unmissable the moment you put the controller down.
// The watch starts only once both of them have actually come to rest — count
// from the moment the key goes up and you are mostly counting the fall that
// was already in progress.
await leg('stand still together', () => p.waitForTimeout(1600));
await p.evaluate(() => {
  const g = window.GLIMMER;
  g.watch.restless = 0;
  g.watching = true;
});
await p.waitForTimeout(1600);

const w = await p.evaluate(() => window.GLIMMER.watch);
console.log('\nframes', w.frames, '| worst gap', w.maxGap.toFixed(1),
  '| deepest below you', w.deepest.toFixed(1),
  '| rescues', w.rescues, '| jumps', w.jumped, '| glides', w.glided,
  '| restless', w.restless);

const fails = [];
// What matters is not that she never falls — you can jump off a cliff and she
// will follow you off it, which is right. What matters is that she is never
// LEFT: at the end of every leg she is back at your side.
for (const [label, st] of legs) {
  if (st.gap > 6) fails.push(`after "${label}" she was still ${st.gap}m away — she did not catch up`);
}
if (w.deepest < -VOID_LIMIT) {
  fails.push(`she ended up ${(-w.deepest).toFixed(1)}m below you — the void rescue is not firing`);
}
if (w.jumped < 10) fails.push('she never jumped — she cannot follow you onto anything raised');
if (w.rescues > legs.length) {
  fails.push(`${w.rescues} rescue teleports over ${legs.length} legs — she is being carried, not following`);
}
if (w.restless > 12) {
  fails.push(`she left the ground on ${w.restless} frames while you stood still — she is fidgeting`);
}
if (errs.length) fails.push('page errors: ' + errs.slice(0, 3).join(' | '));

console.log();
for (const f of fails) console.log('FAIL ' + f);
console.log(fails.length ? `\n${fails.length} problem(s)` : '\nshe keeps up');
await b.close(); server.close();
process.exit(fails.length ? 1 : 0);
