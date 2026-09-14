// Are the glimmers actually gettable?
//
// Placing collectibles by hand in three dimensions goes wrong in two silent
// ways. One is burying a glimmer inside a tree trunk or under a platform,
// where it is visible from nowhere and reachable by nothing — and since the
// counter says 83, the player hunts for it until they give up on the game.
// The other is hanging one so far above any surface that nothing in the
// movement set can get to it.
//
// Neither shows up in a screenshot. Both are arithmetic, so they are checked
// here against the same collision boxes the player collides with.

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
await p.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await p.waitForFunction('!!window.GLIMMER', { timeout: 20000 });
await p.waitForTimeout(500);

const report = await p.evaluate(() => {
  const g = window.GLIMMER;
  const items = g.glimmers.items;
  const world = g.world;
  const scratch = [];
  const BOB = 0.16;          // the lowest each one ever hangs

  // What the movement set can actually do, in metres.
  //
  // From a surface you jump to about 1.5m, and you collect with your middle,
  // which is 0.72 above your feet, within 1.05 — so you can take something
  // 3.2 above the floor you left. Covering ground costs height: the glide
  // falls 2.1m/s while you run 6.6m/s, which is 0.32m down per metre across.
  // A point hanging over nothing is therefore fine — an arc across a gap is
  // SUPPOSED to hang over nothing — as long as some surface can launch you
  // through it.
  // Two different numbers, and conflating them is how a world passes this
  // test while being unclimbable. To TOUCH a glimmer you only have to pass
  // through it at the top of a jump, 3.2 above the floor you left. To STAND
  // on a ledge you have to land on it, and the jump only lifts you 1.5.
  const UP = 3.2;
  const LAND_UP = 1.45;
  const DROP_PER_M = 0.32;
  const FREE = 2.0;          // covered by the jump itself before the glide
  const MAX_D = 19;

  // ---- which surfaces can you actually stand on? ------------------------
  //
  // Checking each glimmer against the nearest ledge is circular reasoning: it
  // proves you could take it IF you were standing somewhere you may have no
  // way of getting to. The shelf in the first draft of this meadow sat higher
  // than the lookout you were meant to glide from, so every glimmer around it
  // validated happily against a platform no player can reach.
  //
  // So: flood-fill outward from the ground under the spawn, one jump-or-glide
  // at a time, and only then ask what the glimmers hang over.
  const floors = world.all.filter((s) => s.tag === 'ground' || s.tag === 'plank');
  const gapBetween = (a, c) => {
    const dx = Math.max(a.minX - c.maxX, c.minX - a.maxX, 0);
    const dz = Math.max(a.minZ - c.maxZ, c.minZ - a.maxZ, 0);
    return Math.hypot(dx, dz);
  };
  const canHop = (from, to) => {
    const d = gapBetween(from, to);
    if (d > MAX_D) return false;
    return to.maxY <= from.maxY + LAND_UP - DROP_PER_M * Math.max(0, d - FREE);
  };
  const spawn = g.hero.a;
  let start = null;
  for (const s of floors) {
    if (spawn.x >= s.minX - 1 && spawn.x <= s.maxX + 1
      && spawn.z >= s.minZ - 1 && spawn.z <= s.maxZ + 1
      && (!start || s.maxY > start.maxY)) start = s;
  }
  const reached = new Set();
  if (start) {
    const queue = [start];
    reached.add(start);
    while (queue.length) {
      const at = queue.pop();
      for (const s of floors) {
        if (reached.has(s)) continue;
        if (!canHop(at, s)) continue;
        reached.add(s);
        queue.push(s);
      }
    }
  }
  const stranded = floors.filter((s) => !reached.has(s))
    .map((s) => ({ x: +((s.minX + s.maxX) / 2).toFixed(1), y: +s.maxY.toFixed(1),
      z: +((s.minZ + s.maxZ) / 2).toFixed(1), tag: s.tag }));

  const buried = [], marooned = [];
  for (const it of items) {
    const y = it.y - BOB;
    const near = world.near(it.x - MAX_D, it.z - MAX_D, it.x + MAX_D, it.z + MAX_D, scratch);
    let inside = false;
    for (const s of near) {
      if (it.x > s.minX && it.x < s.maxX && it.z > s.minZ && it.z < s.maxZ
        && y > s.minY && y < s.maxY) inside = true;
    }
    let best = null, bestCeil = -Infinity;
    for (const s of reached) {
      const dx = Math.max(s.minX - it.x, 0, it.x - s.maxX);
      const dz = Math.max(s.minZ - it.z, 0, it.z - s.maxZ);
      const d = Math.hypot(dx, dz);
      if (d > MAX_D) continue;
      const ceil = s.maxY + UP - DROP_PER_M * Math.max(0, d - FREE);
      if (ceil > bestCeil) { bestCeil = ceil; best = { d: +d.toFixed(1), top: +s.maxY.toFixed(1) }; }
    }
    if (inside) {
      buried.push({ x: +it.x.toFixed(1), y: +it.y.toFixed(1), z: +it.z.toFixed(1) });
    } else if (y > bestCeil) {
      marooned.push({
        x: +it.x.toFixed(1), y: +it.y.toFixed(1), z: +it.z.toFixed(1),
        short: +(y - bestCeil).toFixed(1),
        from: best ? `${best.top} high, ${best.d}m away` : 'no reachable surface within range',
      });
    }
  }
  return { total: items.length, buried, marooned, stranded, floors: floors.length, reached: reached.size };
});

console.log(`${report.total} glimmers placed; ${report.reached}/${report.floors} surfaces reachable from spawn`);
const fails = [];
if (report.stranded.length) {
  fails.push(`${report.stranded.length} surface(s) you can never stand on`);
  for (const q of report.stranded.slice(0, 8)) {
    console.log(`  unreachable ${q.tag} at ${q.x} ${q.y} ${q.z}`);
  }
}
if (report.buried.length) {
  fails.push(`${report.buried.length} buried inside solid geometry`);
  for (const q of report.buried.slice(0, 6)) console.log('  buried in', q.kind, 'at', q.x, q.y, q.z);
}
if (report.marooned.length) {
  fails.push(`${report.marooned.length} that nothing in the movement set can reach`);
  for (const q of report.marooned.slice(0, 10)) {
    console.log(`  out of reach at ${q.x} ${q.y} ${q.z} — ${q.short}m too high; best launch is ${q.from}`);
  }
}

// And the loop itself: running through them collects them, for BOTH of you.
await p.evaluate(() => {
  const g = window.GLIMMER;
  g.tally = { byHero: 0, byPartner: 0 };
  const items = g.glimmers.items;
  // Park one directly on each of them and step a frame; nothing else can
  // explain the count moving.
  const near = (c, i) => { items[i].x = c.a.x; items[i].y = c.a.y + 0.72; items[i].z = c.a.z; };
  near(g.hero, 0);
  near(g.partner, 1);
});
await p.waitForTimeout(400);
const loop = await p.evaluate(() => ({
  got: window.GLIMMER.glimmers.got,
  first: window.GLIMMER.glimmers.items[0].got,
  second: window.GLIMMER.glimmers.items[1].got,
  hud: document.getElementById('lums').textContent,
}));
console.log('after placing one on each of them:', JSON.stringify(loop));
if (!loop.first) fails.push('walking onto a glimmer did not collect it');
if (!loop.second) fails.push('she cannot pick them up — the count is the player alone');
if (!/^\d+\//.test(loop.hud) || loop.hud.startsWith('0/')) fails.push(`the counter did not move (${loop.hud})`);
if (errs.length) fails.push('page errors: ' + errs.slice(0, 3).join(' | '));

console.log();
for (const f of fails) console.log('FAIL ' + f);
console.log(fails.length ? `\n${fails.length} problem(s)` : '\nevery glimmer is reachable and the loop works');
await b.close(); server.close();
process.exit(fails.length ? 1 : 0);
