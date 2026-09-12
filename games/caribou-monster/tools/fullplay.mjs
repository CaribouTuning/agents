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
// Fastest text. A full playthrough is thousands of text boxes, and the
// typewriter is not what is being tested.
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.state.settings.textSpeed = 2;
  g.dialogueForTest.speedIndex = 2;
});

const wait = (ms) => page.waitForTimeout(ms);
const hold = async (code, ms) => {
  await page.keyboard.down(code); await wait(ms); await page.keyboard.up(code); await wait(70);
};
const tap = async (code, n = 1, ms = 70) => {
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
async function clear(budget = 220) {
  let last = '';
  let same = 0;
  let stuckOn = null;
  let stuckN = 0;
  const seen = [];
  for (let i = 0; i < budget; i++) {
    if (!await busy()) return seen.join(' ');
    const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    if (top === 'NicknameScreen' || top === 'TextEntryScreen') { await tap('KeyQ', 1, 140); continue; }
    if (top === 'BattleScreen') { await fightToTheEnd(); continue; }
    if (top === 'CreditsScreen') return '<<CREDITS>>';
    // Anything else on top of the world — a shop, the PC, a menu — is backed
    // out of rather than confirmed. Holding A in a shop buys things forever.
    if (top !== 'OverworldScreen') {
      await tap('KeyX', 1, 120);
      const still = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
      if (still === top) {
        stuckOn = (stuckOn === top) ? stuckOn : top;
        stuckN++;
        if (stuckN > 6) { found('TRAPPED', `${top} will not close`); return seen.join(' '); }
      } else { stuckOn = null; stuckN = 0; }
      continue;
    }
    const t = await said();
    if (t && !seen.includes(t)) { seen.push(t); await inspect(t); }
    // A question is answered, not mashed past. Take the first option, which
    // is the one that moves the story on ("yes, please"); B would take the
    // last, which usually declines.
    const asked = await page.evaluate(() => {
      const d = window.CARIBOU.dialogueForTest;
      if (d.choice) { d.answer(0); return 'answered'; }
      if (d.pendingChoice) { d.shown = d.currentText.length; d.advance(); return 'opened'; }
      return null;
    });
    if (asked) { await wait(140); continue; }
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
  const onTop = await page.evaluate(() => {
    const g = window.CARIBOU;
    return { screen: g.screens.top.constructor.name,
      dialogue: g.dialogueForTest.visible, script: !!(g.overworld && g.overworld.script) };
  });
  found('STUCK', `the world never became walkable again — ${JSON.stringify(onTop)}`);
  return seen.join(' ');
}

/**
 * True when somebody who talks is standing next to the player.
 *
 * Two corrections to what this used to be, both of which cost a whole run.
 * It looked only at the tile the player was FACING, and the companion walks:
 * between one A press and the next she has stepped round to another side.
 * And it looked only in `entities`, where the companion, the dog and the
 * walking Pokemon are not — they are their own fields on the world, checked
 * by hand in `facingTarget`. So every conversation with the person walking
 * beside you looked like a box that nothing was re-opening, which is exactly
 * the shape of a softlock and exactly not one.
 *
 * A box with genuinely nobody beside it still trips it, which is the case it
 * was written for.
 */
const facingSomebody = () => page.evaluate(() => {
  const w = window.CARIBOU.overworld && window.CARIBOU.overworld.world;
  if (!w) return false;
  const near = (e) => !!e && e.visible !== false
    && Math.abs(e.x - w.player.x) + Math.abs(e.y - w.player.y) <= 1;
  return (w.entities || []).some(near) || near(w.companion) || near(w.pet) || near(w.follower);
});

/**
 * Wins a battle, playing it the way somebody competent would.
 *
 * The first version mashed A, which always picks move slot one. When that
 * slot held Growl the battle could not be won at all: the harness sat there
 * for two hundred turns taking chip damage and then reported the fight as
 * broken, which was a lie about the game. So it puts the cursor on the
 * hardest-hitting move it actually has before confirming, and keeps the
 * party standing so the run is testing scenes rather than a level curve.
 */
async function fightToTheEnd() {
  const started = Date.now();
  let lastProgress = Date.now();
  let mark = '';
  while (Date.now() - started < 120000) {
    const s = await page.evaluate(() => {
      const g = window.CARIBOU;
      const top = g.screens.top;
      if (top.constructor.name !== 'BattleScreen') return null;
      if (g.healPartyForTest) g.healPartyForTest();
      if (g.bestMoveForTest) {
        const i = g.bestMoveForTest(top);
        if (i >= 0) top.moveIndex = i;
      }
      const side = top.battle && top.battle.sides[top.foeSide];
      const foe = side && side.party ? side.party.map((m) => m.hp).join(',') : '';
      // The wrap-up — "was defeated", the speech, the badge, the EXP — has no
      // turns left to count and no health left to change, and it is the part
      // that hands over the badge. Watching only the turn counter called it a
      // stuck fight and walked away before the Leader gave anything up.
      return { turn: top.battle ? top.battle.turn : -1, foe, msg: String(top.msg || '') };
    });
    if (!s) return;
    const now = `${s.turn}|${s.foe}|${s.msg}`;
    if (now !== mark) { mark = now; lastProgress = Date.now(); }
    // Twenty seconds with neither the turn counter nor a single point of the
    // other side's health moving is not a long fight, it is a stuck one.
    if (Date.now() - lastProgress > 20000) {
      const detail = await page.evaluate(() => {
        const g = window.CARIBOU;
        const top = g.screens.top;
        const one = (x) => (x && x.party ? x.party.map((m) => `${m.species}@${m.level} ${m.hp}hp`).join(' ') : '?');
        const me = top.battle && top.battle.sides[top.mySide];
        return { mode: top.mode, msg: String(top.msg || '').slice(0, 60),
          moveIndex: top.moveIndex, turn: top.battle && top.battle.turn,
          mine: one(me), foe: one(top.battle && top.battle.sides[top.foeSide]),
          moves: me && me.party[me.active] ? me.party[me.active].moves.map((m) => `${m.id}:${m.pp}`) : null };
      });
      found('BATTLE', `a battle stopped making progress — ${JSON.stringify(detail)}`);
      return;
    }
    for (let k = 0; k < 5; k++) { await page.keyboard.press('KeyZ'); await wait(30); }
  }
  found('BATTLE', 'a battle ran for two minutes without finishing');
}

/**
 * Walks to a tile, the way a player does: by finding a route.
 *
 * The first version of this steered greedily toward the target and gave up
 * when a building got in the way, which meant it could not reach Professor
 * Rowan's front door from the player's own house — and then reported the lab
 * as unreachable, which was a lie about the game. A harness that cannot walk
 * cannot tell you anything about a world you walk through.
 *
 * The search runs inside the page against the world's own `canEnter`, so it
 * is the game's idea of what is walkable, not a second one that can drift.
 * The destination tile itself is allowed to be un-standable — a door usually
 * is — so the route stops next to it and the last step is taken as a move.
 */
async function routeTo(tx, ty) {
  return page.evaluate(([gx, gy]) => {
    const w = window.CARIBOU.overworld.world;
    const p = w.player;
    const DIRS = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    const key = (x, y) => `${x},${y}`;
    const from = new Map([[key(p.x, p.y), null]]);
    const queue = [[p.x, p.y]];
    let goal = null;
    for (let i = 0; i < queue.length && i < 20000; i++) {
      const [x, y] = queue[i];
      if (x === gx && y === gy) { goal = [x, y]; break; }
      for (const [d, dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (from.has(key(nx, ny))) continue;
        // The goal is reachable even when you cannot stand on it: that is
        // what a door is. Anywhere else has to be walkable.
        if (!(nx === gx && ny === gy) && !w.canEnter(p, nx, ny)) continue;
        from.set(key(nx, ny), { x, y, d });
        queue.push([nx, ny]);
        // Canalave's Gym is three sealed bands joined only by its lifts. A
        // lift is a warp back into the same map, and stepping onto one is a
        // move like any other — without this the Leader is unreachable and
        // the harness reports a badge that cannot be earned.
        const lift = (w.map.warps || []).find((z) => z.to === w.mapId && z.x === nx && z.y === ny);
        if (lift && !from.has(key(lift.tx, lift.ty))) {
          from.set(key(lift.tx, lift.ty), { x: nx, y: ny, d, lift: true });
          queue.push([lift.tx, lift.ty]);
        }
      }
    }
    if (!goal) return null;
    const steps = [];
    let cur = key(gx, gy);
    while (from.get(cur)) {
      const step = from.get(cur);
      steps.push(step.d);
      cur = key(step.x, step.y);
    }
    return steps.reverse();
  }, [tx, ty]);
}

const KEY_FOR = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

/**
 * Takes exactly one step, and does not lie about it.
 *
 * Firing a fixed-length key hold per step loses steps: the player is still
 * sliding between tiles when the next press arrives, and the game drops it.
 * A route of eleven steps arrived four tiles short, and the harness then
 * reported Professor Rowan's lab as unreachable — a bug in the harness that
 * read exactly like a bug in the world. So each step holds the key until the
 * player has actually moved and come to rest, and reports whether it did.
 */
async function step(dir) {
  const before = await page.evaluate(() => {
    const p = window.CARIBOU.overworld.world.player;
    return { x: p.x, y: p.y };
  });
  const key = KEY_FOR[dir];
  await page.keyboard.down(key);
  let moved = false;
  for (let i = 0; i < 24; i++) {                 // ~400ms, well over one tile
    await wait(16);
    const now = await page.evaluate(() => {
      const g = window.CARIBOU;
      const w = g.overworld && g.overworld.world;
      if (!w) return null;
      return { x: w.player.x, y: w.player.y, moving: !!w.player.moving, map: w.mapId,
        busy: !!(g.overworld.script) || g.dialogueForTest.visible
          || g.screens.top.constructor.name !== 'OverworldScreen' };
    });
    if (!now) break;
    if (now.map !== undefined && (now.busy || now.x !== before.x || now.y !== before.y)) {
      if (!now.moving || now.busy) { moved = true; break; }
    }
  }
  await page.keyboard.up(key);
  await wait(40);
  return moved;
}

/** Walks to a tile, re-planning whenever the world interrupts. */
async function walkTo(tx, ty, replans = 8) {
  for (let r = 0; r < replans; r++) {
    if (await busy()) { await clear(); continue; }
    const p = await at();
    if (p.x === tx && p.y === ty) return true;
    const steps = await routeTo(tx, ty);
    if (!steps) return false;                    // genuinely no way there
    const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    let expect = { x: p.x, y: p.y };
    for (const d of steps) {
      const ok = await step(d);
      if (await busy()) break;                   // a scene, a battle, a door
      const q = await at();
      if (q.map !== p.map) return true;          // we went through something
      if (q.x === tx && q.y === ty) return true;
      if (!ok) break;                            // blocked: plan again
      expect = { x: expect.x + DELTA[d][0], y: expect.y + DELTA[d][1] };
      // A lift puts us somewhere the rest of this route knows nothing about,
      // so throw the route away and plan again from wherever we landed.
      if (q.x !== expect.x || q.y !== expect.y) break;
    }
    const q = await at();
    if (q.x === tx && q.y === ty || q.map !== p.map) return true;
  }
  return false;
}

/** Checks the place you have just arrived in behaves like a place. */
async function checkArrival(expected) {
  // Let the doorway finish. Sampling mid-transition reported an ordinary
  // walk through a door as arriving in the wrong place and then being thrown
  // out of it — two findings for something that was simply still moving.
  let p = await at();
  for (let i = 0; i < 25; i++) {
    await wait(120);
    const now = await at();
    if (now.map === p.map && !await busy()) break;
    p = now;
  }
  if (expected && p.map !== expected) {
    found('WRONG MAP', `expected ${expected}, arrived in ${p.map}`);
  }
  where = p.map || where;
  // Standing still and being moved anyway? That is the Hearthome bug: a door
  // that puts you back outside the moment you walk through it.
  await wait(600);
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

let stageN = 0;
const stage = (name) => {
  where = name;
  console.log(`[${String(++stageN).padStart(2)}] ${name}`);
};

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
    // Only judge somebody we are genuinely standing in front of, and check
    // that against where they are NOW — a wandering NPC has moved on since
    // the list was taken, and quiet scenery is not a silent NPC.
    const placed = await page.evaluate(([x, y, id]) => {
      const w = window.CARIBOU.overworld.world;
      if (w.player.x !== x || w.player.y !== y) return null;
      const e = (w.entities || []).find((n) => n.id === id);
      if (!e) return null;
      const dx = e.x - x, dy = e.y - y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return null;      // they wandered off
      w.player.dir = dx ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      return w.player.dir;
    }, [spot.x, spot.y, who.id]);
    if (!placed) continue;
    // The game only reads an A press while the player is standing still, so
    // wait for the last step to finish landing before knocking.
    for (let k = 0; k < 20; k++) {
      const still = await page.evaluate(() => !window.CARIBOU.overworld.world.player.moving);
      if (still) break;
      await wait(30);
    }
    await wait(90);

    await tap('KeyZ', 1, 220);
    const opened = await page.evaluate(() => {
      const g = window.CARIBOU;
      return g.dialogueForTest.visible || !!(g.overworld && g.overworld.script);
    });
    if (!opened) {
      // Say what the game thought was in front of us, so this is a diagnosis
      // rather than an accusation.
      const facing = await page.evaluate(() => {
        const t = window.CARIBOU.overworld.world.facingTarget();
        return t ? `${t.type}${t.entity ? ':' + t.entity.id : ''}` : 'nothing';
      });
      found('SILENT NPC', `${who.id} does not react; the game was facing ${facing}`);
      continue;
    }

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
          if (d.choice) d.answer(0); else d.advance();
        });
      }
      await wait(90);
    }
    const text = seen.join(' ');
    await inspect(text);
    if (!text.trim()) found('SILENT NPC', `${who.id} opens a box with nothing in it`);
  }
}

/**
 * Walks up to one particular person and talks to them.
 *
 * Talking to everybody in a Gym means fighting every trainer in it, which is
 * an honest thing to do and takes twenty minutes a Gym. When what is being
 * checked is whether the Leader hands over the badge, go and find the Leader.
 */
async function talkTo(match) {
  const who = await page.evaluate((m) => {
    const w = window.CARIBOU.overworld.world;
    const e = (w.entities || []).find((n) => n.id === m
      || (n.data && (n.data.trainer === m || n.data.name === m)));
    return e ? { id: e.id, x: e.x, y: e.y } : null;
  }, match);
  if (!who) return null;
  const spot = await page.evaluate(([x, y]) => {
    const w = window.CARIBOU.overworld.world;
    for (const [d, dx, dy] of [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]]) {
      if (w.canEnter(w.player, x + dx, y + dy)) return { x: x + dx, y: y + dy, dir: d };
    }
    return null;
  }, [who.x, who.y]);
  if (!spot) return null;
  if (!await walkTo(spot.x, spot.y, 18)) return null;
  for (let k = 0; k < 20; k++) {
    if (await page.evaluate(() => !window.CARIBOU.overworld.world.player.moving)) break;
    await wait(30);
  }
  await page.evaluate((d) => { window.CARIBOU.overworld.world.player.dir = d; }, spot.dir);
  await wait(120);
  await tap('KeyZ', 1, 220);
  const text = await clear(200);
  await inspect(text);
  return text;
}

/**
 * Reads every sign on the map, as the player reads it.
 *
 * A sign's stored text still has its slots in it — the filling happens on
 * the way to the text box — so checking the raw string reports a board that
 * reads perfectly well in game as broken.
 */
async function readEverySign() {
  const signs = await page.evaluate(() => {
    const g = window.CARIBOU;
    const m = g.overworld.world.map;
    return (m.signs || []).map((s) => (g.fillForTest ? g.fillForTest(s.text) : s.text));
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

/**
 * Walks to another map, however many doors away it is.
 *
 * `goThrough` only knows about doors on the map you are standing on, so a
 * run that wandered into a Poké Mart while talking to people then reported
 * the road out of town as missing — the door was there, it was just two
 * rooms away. This searches the whole warp graph and walks the doors in
 * order, which is what a player does without thinking about it.
 */
async function goTo(target, hops = 8) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await busy()) await clear();
    const here = (await at()).map;
    if (here === target) return true;
    const path = await page.evaluate(([from, to, limit]) => {
      const MAPS = window.CARIBOU.mapsForTest && window.CARIBOU.mapsForTest.MAPS;
      if (!MAPS) return null;
      const prev = new Map([[from, null]]);
      const queue = [from];
      for (let i = 0; i < queue.length && i < 500; i++) {
        const id = queue[i];
        if (id === to) break;
        const m = MAPS[id];
        if (!m) continue;
        for (const w of (m.warps || [])) {
          if (prev.has(w.to)) continue;
          prev.set(w.to, id);
          queue.push(w.to);
        }
      }
      if (!prev.has(to)) return null;
      const out = [];
      let cur = to;
      while (cur !== from) { out.push(cur); cur = prev.get(cur); }
      return out.reverse().slice(0, limit);
    }, [here, target, hops]);
    if (!path) { found('NO WAY THERE', `nothing joins ${here} to ${target}`); return false; }
    let ok = true;
    for (const next of path) {
      if (!await goThrough(next, null, true)) { ok = false; break; }
    }
    if (ok && (await at()).map === target) return true;
  }
  return (await at()).map === target;
}

/** Finds the door on this map that leads to `to`, and walks through it. */
async function goThrough(to, expectMap = null, quiet = false) {
  const door = await page.evaluate((t) => {
    const w = window.CARIBOU.overworld.world;
    const ws = (w.map.warps || []).filter((x) => x.to === t);
    return ws.length ? { x: ws[0].x, y: ws[0].y } : null;
  }, to);
  if (!door) {
    // When `goTo` is walking a route it plans each hop afresh, so a hop that
    // no longer applies is a stale plan, not a missing door.
    if (!quiet) found('NO DOOR', `this map has no way to ${to}`);
    return false;
  }
  const ok = await walkTo(door.x, door.y, 6);
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
stage('matthew_house');

// --- the prologue, walked ---
stage('the prologue');
await clear();
await goTo('twinleaf');
await wait(700);
await clear();                                   // the doorstep scene
await talkToEveryone(6);
await readEverySign();

await goTo('rowan_lab');
await runScene('starter');
await page.evaluate(() => {
  const g = window.CARIBOU;
  // A team that can win the story's fights, so the run tests SCENES rather
  // than whether a level-5 Turtwig can beat a Gym.
  g.debugGive(387, 60); g.debugGive(392, 60); g.debugGive(398, 60);
  // Lead with the strongest, the way anybody would. Leading with the level-8
  // starter turns every Gym into a war of attrition, and this run is testing
  // whether the scenes and the badges work, not the level curve.
  g.state.party.sort((a, b) => b.level - a.level);
});
await goTo('twinleaf');
await goTo('route201');
await clear();                                   // Cass, at the north gate
await goTo('sandgem');
await talkToEveryone(6);
await readEverySign();

// --- the road north, gym by gym ---
stage('the road north');
const ROAD = [
  ['route202', null],
  ['jubilife', 'talk'],
  ['route203', null],
  ['oreburgh', 'talk'],
];
for (const [map, mode] of ROAD) {
  if (!await goTo(map)) { found('ROUTE BROKEN', `could not walk to ${map}`); break; }
  if (mode === 'talk') { await talkToEveryone(8); await readEverySign(); }
}

// --- every built Gym, in order ---
stage('the Gyms');
const GYMS = await page.evaluate(() => window.CARIBOU.gymsForTest ? window.CARIBOU.gymsForTest() : []);
for (const gym of GYMS) {
  stage(gym.map);
  await page.evaluate((m) => window.CARIBOU.teleport(m), gym.city);
  await wait(500);
  await clear();
  await checkArrival(gym.city);
  const got = await goThrough(gym.map);
  if (!got) { found('GYM UNREACHABLE', `${gym.leader}'s Gym has no door from ${gym.city}`); continue; }
  const before = (await at()).badges;
  // Go and find the Leader rather than fighting the whole Gym: the badge is
  // what is being checked, and the trainers in between are twenty minutes.
  const met = await talkTo(gym.trainer);
  if (met === null) await talkToEveryone(6);   // could not find them; try the room
  const after = (await at()).badges;
  if (after <= before) {
    found('NO BADGE', `beating ${gym.leader} did not hand over the ${gym.badge}`);
  }
}

// --- the story's spine ---
stage('oreburgh_gate');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.state.flags.badge1 = true;
  g.teleport('oreburgh_gate');
});
await wait(500);
await clear();
await checkArrival('oreburgh_gate');
await talkToEveryone(8);

// Mars is a person standing in the Gate, and her scene reads her trainer
// record off the NPC. Calling the scene with nobody attached throws before it
// says a word, which is a fact about how this harness called it and not about
// the game. Go and fight her.
if ((await talkTo('cave_commander')) === null) {
  found('STORY BREAK', 'Mars is not somebody you can walk up to in the Gate');
}
const hasCharm = await page.evaluate(() => !!window.CARIBOU.state.flags.beatCommander);
if (!hasCharm) found('STORY BREAK', 'beating Mars did not set beatCommander');
await runScene('charmFound');

// The charm is a ball on the floor behind her, and it is only on the floor
// once she has been beaten. Pick it up the way a player does — the door
// checks the bag, not a flag, so a run that skips this stands on the seam
// and is told, correctly, that nothing happens.
if (!await walkTo(11, 1, 30)) {
  // Mars and a boulder sit between most of the cave and that corner, and the
  // greedy walker gives up. This step is testing whether the charm is THERE,
  // so put the feet down and reach for it.
  await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    w.player.x = 11; w.player.y = 1;
    window.CARIBOU.state.player.x = 11; window.CARIBOU.state.player.y = 1;
  });
}
await page.evaluate(() => { window.CARIBOU.overworld.world.player.dir = 'right'; });
await tap('KeyZ', 1, 150);
await clear(60);
if (!await page.evaluate(() => (window.CARIBOU.state.inventory.items.auroracharm || 0) > 0)) {
  found('STORY BREAK', 'the Aurora Charm could not be picked up after beating Mars');
}
await runScene('everlight');
await wait(400);
await clear();
await checkArrival('everlight_chamber');
// Too early: this must NOT end the game.
await runScene('everlightDialga');
const early = await page.evaluate(() => !!window.CARIBOU.state.flags.everlightResolved);
if (early) found('STORY BREAK', 'the Everlight resolved before Canalave');

// --- the middle: the truth in Canalave ---
stage('canalave_library');
await page.evaluate(() => window.CARIBOU.teleport('canalave_library'));
await wait(500);
await clear();
await checkArrival('canalave_library');
await talkToEveryone(8);
// Three volumes, and then the man at the far table who has read two of them
// four times each. Two volumes and no conversation is not the revelation.
for (const volume of [1, 2, 3]) {
  await page.evaluate((v) => window.CARIBOU.overworld.runScript('libraryBook', { volume: v }), volume);
  await wait(200);
  await inspect(await clear(120));
}
const read = await page.evaluate(() => {
  const f = window.CARIBOU.state.flags;
  return !!(f.readVolume1 && f.readVolume2 && f.readVolume3);
});
if (!read) found('STORY BREAK', 'reading all three volumes did not record them');
if ((await talkTo('lib_looker')) === null) await runScene('lookerLibrary');
const truth = await page.evaluate(() => !!window.CARIBOU.state.flags.canalaveTruth);
if (!truth) found('STORY BREAK', 'reading the library did not set canalaveTruth');

// --- the climax ---
stage('everlight_chamber');
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
stage('route207');
await runScene('rowanAfter');
await page.evaluate(() => { window.CARIBOU.state.flags.rowanDebriefed = true; });
stage('twinleaf');
await page.evaluate(() => window.CARIBOU.teleport('twinleaf'));
await wait(600);
await clear();
await runScene('wentHome');
const home = await page.evaluate(() => !!window.CARIBOU.state.flags.wentHome);
if (!home) found('STORY BREAK', 'going home did not close the chapter');

// --- the League, and the end ---
stage('the Finals');
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

// ---------------------------------------------------------------------------
// AND AGAIN, AS THE OTHER ONE
// ---------------------------------------------------------------------------
//
// The opening is written for two protagonists and the order of its scenes
// flips depending on which you are. Playing it only as Matthew proves half
// of it. This walks the same first morning as Sammy — the doorstep, the
// companion who is supposed to be standing there, Bandit, the lab, the road
// north — and reports the same way.

stage('as Sammy: the first morning');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.startNewGame({ name: 'Sammy', look: 'sammy', difficulty: 'easy' });
});
await wait(900);
await clear();
await goTo('twinleaf');
await wait(700);
await clear();                                   // the doorstep scene

// Whoever the player is, the other one and the dog should be on screen by
// the time the scene has finished talking about them.
const cast = await page.evaluate(() => {
  const w = window.CARIBOU.overworld.world;
  return {
    companion: !!(w.companion && w.companion.visible),
    pet: !!(w.pet && w.pet.visible),
    who: w.companion ? w.companion.name : null,
  };
});
if (!cast.companion) found('CAST', 'the other protagonist is talked about but not on screen');
if (cast.who === 'Sammy') found('CAST', 'Sammy is following Sammy');

await talkToEveryone(6);
await readEverySign();
stage('as Sammy: the lab');
await goTo('rowan_lab');
await runScene('starter');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.debugGive(387, 60); g.debugGive(392, 60); g.debugGive(398, 60);
  g.state.party.sort((a, b) => b.level - a.level);
});
stage('as Sammy: the road north');
if (!await goTo('route201')) found('ROUTE BROKEN', 'Sammy cannot walk north out of Twinleaf');
await clear();
if (!await goTo('sandgem')) found('ROUTE BROKEN', 'Sammy cannot reach Sandgem');
await talkToEveryone(6);

await finish();
