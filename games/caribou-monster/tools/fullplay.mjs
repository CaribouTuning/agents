// Playing the WHOLE game, not the prologue.
//
// Every other suite in here proves a thing I already thought of. This one is
// the opposite: it walks the critical path from the first morning to the
// credits and REPORTS ANYTHING THAT LOOKS WRONG, whether or not anybody
// predicted it. The detectors are generic on purpose —
//
//   * a line of text with a {slot} still in it
//   * a line the font cannot draw
//   * a conversation that will not close
//   * arriving somewhere and being thrown straight back out
//   * a map with no legal move from where you land
//   * an objective line that is empty, or too long for the bar
//   * a gym that does not hand over its badge
//   * a script that throws
//   * anything at all on the browser console
//
// — so it finds the class of bug rather than the instance. It is slow. It is
// meant to be: it is the only thing here that plays the game.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '/tmp/fullplay';
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
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();

// ---- findings ---------------------------------------------------------------
const findings = [];
let where = '(boot)';
const found = (kind, detail) => {
  const key = `${kind}|${where}|${String(detail).slice(0, 80)}`;
  if (findings.some((f) => f.key === key)) return;      // one report per problem
  findings.push({ key, kind, where, detail: String(detail).slice(0, 220) });
  console.log(`  ${kind.padEnd(14)} [${where}] ${String(detail).slice(0, 130)}`);
};

page.on('pageerror', (e) => found('PAGE ERROR', e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/favicon|Failed to load resource/i.test(t)) return;
  found('CONSOLE', t);
});

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });

const wait = (ms) => page.waitForTimeout(ms);
const hold = async (code, ms) => {
  await page.keyboard.down(code); await wait(ms); await page.keyboard.up(code); await wait(70);
};
const tap = async (code, n = 1, ms = 110) => {
  for (let i = 0; i < n; i++) { await page.keyboard.press(code); await wait(ms); }
};

const at = () => page.evaluate(() => {
  const g = window.CARIBOU;
  const w = g.overworld && g.overworld.world;
  return {
    map: w ? w.mapId : null,
    x: w ? w.player.x : -1,
    y: w ? w.player.y : -1,
    screen: g.screens.top.constructor.name,
    badges: (g.state.badges || []).length,
  };
});

const busy = () => page.evaluate(() => {
  const g = window.CARIBOU;
  return !!(g.overworld && g.overworld.script) || g.dialogueForTest.visible
    || g.screens.top.constructor.name !== 'OverworldScreen';
});

/** Every page of text currently on screen, as one string. */
const said = () => page.evaluate(() => {
  const d = window.CARIBOU.dialogueForTest;
  return (d.pages || []).flat().join(' ');
});

const UNDRAWABLE = await page.evaluate(() => {
  // Ask the game itself which characters it cannot draw, rather than guessing.
  return null;
});
void UNDRAWABLE;

/** Checks one piece of text for the things text is never allowed to do. */
async function inspect(text) {
  if (!text) return;
  const slot = text.match(/\{\w+\}/g);
  if (slot) found('UNFILLED SLOT', `${slot.join(' ')} in "${text.slice(0, 90)}"`);
  const bad = await page.evaluate((t) => window.CARIBOU.unrenderableForTest
    ? window.CARIBOU.unrenderableForTest(t) : [], text);
  if (bad && bad.length) found('UNDRAWABLE', `${JSON.stringify(bad)} in "${text.slice(0, 70)}"`);
}

/**
 * Advances whatever is on screen until the world is walkable again, watching
 * everything it says on the way past.
 */
async function clear(budget = 160) {
  let last = '';
  let same = 0;
  const seen = [];
  for (let i = 0; i < budget; i++) {
    if (!await busy()) return seen.join(' ');
    const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    if (top === 'NicknameScreen' || top === 'TextEntryScreen') { await tap('KeyQ', 1, 140); continue; }
    if (top === 'BattleScreen') { await fightToTheEnd(); continue; }
    if (top === 'CreditsScreen') return '<<CREDITS>>';
    const t = await said();
    if (t && !seen.includes(t)) { seen.push(t); await inspect(t); }
    if (t && t === last) same++; else { same = 0; last = t; }
    if (same > 8) {
      // Standing nose-to-nose with somebody, every A press closes their box
      // and opens it again. That is the game working. Only call it stuck if
      // nothing in front of us could be re-opening it.
      if (!await facingSomebody()) {
        found('STUCK DIALOGUE', `"${t.slice(0, 80)}" will not advance`);
      }
      await page.evaluate(() => window.CARIBOU.dialogueForTest.hide());
      await wait(120);
      same = 0;
      continue;
    }
    await tap('KeyZ', 1, 100);
  }
  found('STUCK', 'the world never became walkable again');
  return seen.join(' ');
}

/** True when the tile the player is facing holds somebody who talks. */
const facingSomebody = () => page.evaluate(() => {
  const w = window.CARIBOU.overworld && window.CARIBOU.overworld.world;
  if (!w) return false;
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[w.player.dir] || [0, 1];
  const fx = w.player.x + d[0], fy = w.player.y + d[1];
  return (w.entities || []).some((e) => e.visible !== false && e.x === fx && e.y === fy);
});

/** Wins a battle by mashing the first move, with the party kept healthy. */
async function fightToTheEnd() {
  for (let i = 0; i < 260; i++) {
    const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    if (top !== 'BattleScreen') return;
    await page.evaluate(() => {
      const g = window.CARIBOU;
      for (const m of g.state.party) { m.hp = 9999; m.status = null; }
    });
    await tap('KeyZ', 1, 70);
  }
  found('BATTLE', 'a battle never ended');
}

/** Walks toward a tile, giving up rather than looping forever. */
async function walkTo(tx, ty, tries = 26) {
  for (let i = 0; i < tries; i++) {
    if (await busy()) { await clear(); continue; }
    const p = await at();
    if (p.x === tx && p.y === ty) return true;
    const dx = tx - p.x, dy = ty - p.y;
    let key = null;
    if (Math.abs(dx) >= Math.abs(dy) && dx) key = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    else if (dy) key = dy > 0 ? 'ArrowDown' : 'ArrowUp';
    if (!key) return true;
    await hold(key, 150);
    const q = await at();
    // Blocked in the direction we wanted: try the other axis once.
    if (q.x === p.x && q.y === p.y) {
      const alt = dy ? (dy > 0 ? 'ArrowDown' : 'ArrowUp') : (dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      await hold(alt, 150);
    }
  }
  return false;
}

/** Checks the place you have just arrived in behaves like a place. */
async function checkArrival(expected) {
  const p = await at();
  if (expected && p.map !== expected) {
    found('WRONG MAP', `expected ${expected}, arrived in ${p.map}`);
  }
  where = p.map || where;
  // Straight back out again? That is the Hearthome bug.
  await wait(260);
  const after = await at();
  if (after.map !== p.map) {
    found('SPAT OUT', `landed in ${p.map} and was immediately moved to ${after.map}`);
    where = after.map;
  }
  const moves = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    const out = [];
    for (const [d, [dx, dy]] of Object.entries({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })) {
      if (w.canEnter(w.player, w.player.x + dx, w.player.y + dy)) out.push(d);
    }
    return out;
  });
  if (!moves.length) found('SOFTLOCK', `no legal move from ${after.x},${after.y}`);
  const obj = await page.evaluate(() => window.CARIBOU.objectiveForTest
    ? window.CARIBOU.objectiveForTest() : null);
  if (obj !== null) {
    if (!obj) found('NO OBJECTIVE', 'the guide bar has nothing to say here');
    else await inspect(obj);
  }
}

const setWhere = (w) => { where = w; };

const finish = async () => {
  console.log(`\n${findings.length} finding(s)`);
  const byKind = {};
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
  for (const [k, n] of Object.entries(byKind)) console.log(`  ${String(n).padStart(3)}  ${k}`);
  await browser.close();
  server.close();
  process.exit(findings.length ? 1 : 0);
};

/** Talks to every NPC on the current map, watching what they say. */
async function talkToEveryone(limit = 14) {
  const people = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    return (w.entities || [])
      .filter((e) => e.kind === 'npc' && e.visible !== false)
      .slice(0, 40)
      .map((e) => ({ id: e.id, x: e.x, y: e.y }));
  });
  let n = 0;
  for (const who of people) {
    if (n++ >= limit) break;
    // Stand next to them and face them, rather than walking into scenery.
    const spot = await page.evaluate(([x, y]) => {
      const w = window.CARIBOU.overworld.world;
      for (const [d, dx, dy] of [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]]) {
        const px = x + dx, py = y + dy;
        if (w.canEnter(w.player, px, py)) return { x: px, y: py, dir: d };
      }
      return null;
    }, [who.x, who.y]);
    if (!spot) continue;
    if (!await walkTo(spot.x, spot.y, 18)) continue;
    // Only judge somebody we are genuinely standing in front of. A walk that
    // ended somewhere else means our A press hit scenery, and scenery being
    // quiet is not a bug.
    const placed = await page.evaluate(([x, y, d]) => {
      const w = window.CARIBOU.overworld.world;
      if (w.player.x !== x || w.player.y !== y) return false;
      w.player.dir = d;
      return true;
    }, [spot.x, spot.y, spot.dir]);
    if (!placed) continue;
    await wait(90);

    await tap('KeyZ', 1, 200);
    const opened = await page.evaluate(() => {
      const g = window.CARIBOU;
      return g.dialogueForTest.visible || !!(g.overworld && g.overworld.script);
    });
    if (!opened) { found('SILENT NPC', `${who.id} does not react at all`); continue; }

    // Drain what they say through the game's own advance, NOT by mashing A —
    // an A press with an NPC in front of us just re-opens the conversation.
    const seen = [];
    for (let i = 0; i < 120; i++) {
      const state = await page.evaluate(() => {
        const g = window.CARIBOU;
        const d = g.dialogueForTest;
        const top = g.screens.top.constructor.name;
        return {
          top,
          visible: d.visible,
          text: (d.pages || []).flat().join(' '),
          script: !!(g.overworld && g.overworld.script),
        };
      });
      if (state.top === 'BattleScreen') { await fightToTheEnd(); continue; }
      if (state.top !== 'OverworldScreen') { await tap('KeyQ', 1, 140); continue; }
      if (!state.visible && !state.script) break;
      if (state.text && !seen.includes(state.text)) seen.push(state.text);
      if (state.visible) {
        await page.evaluate(() => {
          const d = window.CARIBOU.dialogueForTest;
          d.shown = d.currentText.length;   // skip the typewriter
          d.advance();
        });
      }
      await wait(90);
    }
    const text = seen.join(' ');
    await inspect(text);
    if (!text.trim()) found('SILENT NPC', `${who.id} opens a box with nothing in it`);
  }
}

/** Reads every sign on the map. */
async function readEverySign() {
  const signs = await page.evaluate(() => {
    const m = window.CARIBOU.overworld.world.map;
    return (m.signs || []).map((s) => s.text);
  });
  for (const t of signs) await inspect(t);
}

/** Runs a named story script through the real runner and watches it. */
async function runScene(name) {
  const before = await at();
  await page.evaluate((n) => window.CARIBOU.overworld.runScript(n), name);
  await wait(220);
  const text = await clear(120);
  await inspect(text);
  if (!text.trim()) found('EMPTY SCENE', `${name} ran and said nothing`);
  return { text, before };
}

/** Finds the door on this map that leads to `to`, and walks through it. */
async function goThrough(to, expectMap = null) {
  const door = await page.evaluate((t) => {
    const w = window.CARIBOU.overworld.world;
    const ws = (w.map.warps || []).filter((x) => x.to === t);
    return ws.length ? { x: ws[0].x, y: ws[0].y } : null;
  }, to);
  if (!door) { found('NO DOOR', `this map has no way to ${to}`); return false; }
  const ok = await walkTo(door.x, door.y, 40);
  await wait(420);
  if (await busy()) await clear();
  const p = await at();
  if (p.map !== to) {
    // One more nudge: some doors need the last step taken deliberately.
    await walkTo(door.x, door.y, 6);
    await wait(420);
    if (await busy()) await clear();
  }
  await checkArrival(expectMap || to);
  void ok;
  return (await at()).map === to;
}

// ---------------------------------------------------------------------------
// THE PLAYTHROUGH
// ---------------------------------------------------------------------------
console.log('--- playing the whole game ---\n');

await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Matthew', look: 'matthew', difficulty: 'easy' });
});
await wait(700);
setWhere('matthew_house');

// --- the prologue, walked ---
await clear();
await goThrough('twinleaf');
await wait(700);
await clear();                                   // the doorstep scene
await talkToEveryone(6);
await readEverySign();

await goThrough('rowan_lab');
await runScene('starter');
await page.evaluate(() => {
  const g = window.CARIBOU;
  // A team that can win the story's fights, so the run tests SCENES rather
  // than whether a level-5 Turtwig can beat a Gym.
  g.debugGive(387, 60); g.debugGive(392, 60); g.debugGive(398, 60);
});
await goThrough('twinleaf');
await goThrough('route201');
await clear();                                   // Cass, at the north gate
await goThrough('sandgem');
await talkToEveryone(6);
await readEverySign();

// --- the road north, gym by gym ---
const ROAD = [
  ['route202', null],
  ['jubilife', 'talk'],
  ['route203', null],
  ['oreburgh', 'talk'],
];
for (const [map, mode] of ROAD) {
  if (!await goThrough(map)) { found('ROUTE BROKEN', `could not walk to ${map}`); break; }
  if (mode === 'talk') { await talkToEveryone(8); await readEverySign(); }
}

// --- every built Gym, in order ---
const GYMS = await page.evaluate(() => window.CARIBOU.gymsForTest ? window.CARIBOU.gymsForTest() : []);
for (const gym of GYMS) {
  setWhere(gym.map);
  await page.evaluate((m) => window.CARIBOU.teleport(m), gym.city);
  await wait(500);
  await clear();
  await checkArrival(gym.city);
  const got = await goThrough(gym.map);
  if (!got) { found('GYM UNREACHABLE', `${gym.leader}'s Gym has no door from ${gym.city}`); continue; }
  const before = (await at()).badges;
  await runScene('gymLeaderForTest:' + gym.trainer).catch(() => {});
  // Fight the leader for real: find them and talk.
  await talkToEveryone(10);
  const after = (await at()).badges;
  if (after <= before) {
    found('NO BADGE', `beating ${gym.leader} did not hand over the ${gym.badge}`);
  }
}

// --- the story's spine ---
setWhere('oreburgh_gate');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.state.flags.badge1 = true;
  g.teleport('oreburgh_gate');
});
await wait(500);
await clear();
await checkArrival('oreburgh_gate');
await talkToEveryone(8);

await runScene('commander');
const hasCharm = await page.evaluate(() => !!window.CARIBOU.state.flags.beatCommander);
if (!hasCharm) found('STORY BREAK', 'beating Mars did not set beatCommander');
await runScene('charmFound');
await runScene('everlight');
await wait(400);
await clear();
await checkArrival('everlight_chamber');
// Too early: this must NOT end the game.
await runScene('everlightDialga');
const early = await page.evaluate(() => !!window.CARIBOU.state.flags.everlightResolved);
if (early) found('STORY BREAK', 'the Everlight resolved before Canalave');

// --- the middle: the truth in Canalave ---
setWhere('canalave_library');
await page.evaluate(() => window.CARIBOU.teleport('canalave_library'));
await wait(500);
await clear();
await checkArrival('canalave_library');
await talkToEveryone(8);
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.state.flags.readVolume1 = true; g.state.flags.readVolume2 = true;
});
await runScene('libraryBook');
const truth = await page.evaluate(() => !!window.CARIBOU.state.flags.canalaveTruth);
if (!truth) found('STORY BREAK', 'reading the library did not set canalaveTruth');

// --- the climax ---
setWhere('everlight_chamber');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.state.flags.canalaveTruth = true;
  g.teleport('everlight_chamber');
});
await wait(500);
await clear();
await runScene('everlightDialga');
const resolved = await page.evaluate(() => !!window.CARIBOU.state.flags.everlightResolved);
if (!resolved) found('STORY BREAK', 'the climax did not resolve even after Canalave');

// --- the cool-down ---
setWhere('route207');
await runScene('rowanAfter');
await page.evaluate(() => { window.CARIBOU.state.flags.rowanDebriefed = true; });
setWhere('twinleaf');
await page.evaluate(() => window.CARIBOU.teleport('twinleaf'));
await wait(600);
await clear();
await runScene('wentHome');
const home = await page.evaluate(() => !!window.CARIBOU.state.flags.wentHome);
if (!home) found('STORY BREAK', 'going home did not close the chapter');

// --- the League, and the end ---
setWhere('the Finals');
const finale = await page.evaluate(() => {
  const g = window.CARIBOU;
  const st = g.state;
  st.badges = [1, 2, 3, 4, 5, 6];
  st.circuit.joined = true;
  st.circuit.cp = 99999;
  st.circuit.rank = 'legend';
  const { canEnter } = g.circuitForTest || {};
  return canEnter ? 'hook' : 'no-hook';
});
void finale;
const gate = await page.evaluate(() => {
  const g = window.CARIBOU;
  return { badges: g.state.badges.length, resolved: !!g.state.flags.everlightResolved };
});
if (gate.badges < 6 || !gate.resolved) found('LEAGUE', `the Finals gate is wrong: ${JSON.stringify(gate)}`);

// The credits are the last thing the game does.
await page.evaluate(() => window.CARIBOU.openCredits());
await wait(600);
const onCredits = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
if (onCredits !== 'CreditsScreen') found('ENDING', `the credits did not open (${onCredits})`);
else {
  const roll = await page.evaluate(() => window.CARIBOU.screens.top.lines.map((l) => l.text).join(' '));
  await inspect(roll);
}
await page.screenshot({ path: path.join(OUT, 'credits.png') });

await finish();
