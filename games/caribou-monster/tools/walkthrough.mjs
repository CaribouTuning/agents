// Scripted opening playthrough.
//
// Walks the real route a player takes — out of the house, into the lab, take a
// starter, back out — asserting at each step that the player can still move.
// The static audit proves the maps are sound; this proves the game actually
// plays through them.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PAGE = process.argv[2] || 'index.html';
const OUT = process.argv[3] || '/tmp/walk';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
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
const ctx = await browser.newContext({ viewport: { width: 900, height: 460 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/${PAGE}`, { waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 8000 });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (k, ms) => {
  await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); await wait(180);
};
const tap = async (k, n = 1, d = 200) => {
  for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(d); }
};
const where = () => page.evaluate(() => {
  const g = window.CARIBOU, w = g.overworld && g.overworld.world;
  return w ? { map: w.mapId, x: w.player.x, y: w.player.y, screen: g.screens.top.constructor.name } : null;
});
// The softlock predicate, evaluated live against the running world.
const canMove = () => page.evaluate(() => {
  const w = window.CARIBOU.overworld.world;
  const p = w.player;
  return ['up', 'down', 'left', 'right'].filter((d) => {
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
    return w.canEnter(p, p.x + dx, p.y + dy, d);
  });
});

console.log('--- opening playthrough ---');
await page.evaluate(() => window.CARIBOU.startNewGame({ name: 'Matthew', look: 'boy', difficulty: 'easy' }));
await wait(700);
check('game starts in the player house', (await where()).map === 'player_house');

// Clears whatever is on screen and waits until the player can move again.
// Phases used to run into each other: a dialogue box left open from the last
// step silently ate the next phase's walking, which reads as a broken feature.
const waitIdle = async (limit = 40) => {
  for (let i = 0; i < limit; i++) {
    const state = await page.evaluate(() => {
      const g = window.CARIBOU;
      return {
        screen: g.screens.top.constructor.name,
        busy: !!g.overworld?.script || g.dialogueForTest.visible || g.screens.busy,
      };
    });
    if (state.screen === 'NicknameScreen') { await page.keyboard.press('KeyX'); await wait(160); continue; }
    if (!state.busy && state.screen === 'OverworldScreen') return true;
    await page.keyboard.press('KeyZ');
    await wait(150);
  }
  return false;
};

// Walks toward a tile with short directional holds, re-checking as it goes.
// More robust than fixed durations, and it fails loudly rather than silently
// wandering off.
const PERPENDICULAR = {
  ArrowLeft: ['ArrowUp', 'ArrowDown'], ArrowRight: ['ArrowUp', 'ArrowDown'],
  ArrowUp: ['ArrowLeft', 'ArrowRight'], ArrowDown: ['ArrowLeft', 'ArrowRight'],
};

const walkTo = async (tx, ty, limit = 16) => {
  let stuck = 0;
  for (let i = 0; i < limit; i++) {
    const w = await where();
    if (!w) return false;
    if (w.x === tx && w.y === ty) return true;
    let key;
    if (w.x !== tx) key = w.x < tx ? 'ArrowRight' : 'ArrowLeft';
    else key = w.y < ty ? 'ArrowDown' : 'ArrowUp';
    const dist = w.x !== tx ? Math.abs(tx - w.x) : Math.abs(ty - w.y);
    const before = `${w.x},${w.y},${w.map}`;
    // A single-tile move gets a short hold. A long one used to overshoot and
    // then oscillate around the target until the attempt budget ran out.
    await hold(key, dist === 1 ? 170 : 150 + dist * 240);
    let after = await where();
    if (after.map !== w.map) return true;                              // warped

    if (`${after.x},${after.y},${after.map}` === before) {
      // Blocked. Towns have NPCs that wander into doorways, and giving up on
      // the first bump made every walk in this suite a coin toss. Sidestep and
      // carry on; only a repeatedly immovable wall is a real failure.
      if (++stuck > 3) return false;
      for (const side of PERPENDICULAR[key]) {
        await hold(side, 170);
        after = await where();
        if (`${after.x},${after.y},${after.map}` !== before) break;
      }
      continue;
    }
    stuck = 0;
  }
  return false;
};

// Out the front door.
await hold('ArrowDown', 1400);
await wait(900);
let w = await where();
check('walked out into the town', w.map === 'twinleaf', `${w.map} ${w.x},${w.y}`);

// Town path: down to the main road, east to the crossroads, north, then west
// to the lab door at (6,5).
await walkTo(5, 14);
await walkTo(14, 14);
await walkTo(14, 6);
await walkTo(6, 6);
await hold('ArrowUp', 500);
await wait(900);
w = await where();
check('reached the lab', w.map === 'rowan_lab', `${w.map} ${w.x},${w.y}`);
await page.screenshot({ path: path.join(OUT, '01-inside-lab.png') });

// THE REPORTED BUG: can the player move at all after entering?
let moves = await canMove();
check('can move inside the lab', moves.length > 0, `legal moves: ${moves.join(',') || 'NONE'}`);

// Reach the professor at (6,2) and take a starter.
await walkTo(6, 3);
await hold('ArrowUp', 220);
await wait(300);
// Advance until the cutscene actually ends, rather than guessing a count.
for (let i = 0; i < 90; i++) {
  const s2 = await page.evaluate(() => {
    const g = window.CARIBOU;
    return {
      screen: g.screens.top.constructor.name,
      done: !g.dialogueForTest.visible && !g.overworld.script,
    };
  });
  // The professor now asks you to name it, which is a keyboard, not a page.
  if (s2.screen === 'NicknameScreen') { await page.keyboard.press('KeyX'); await wait(170); continue; }
  if (s2.done && i > 2) break;
  await page.keyboard.press('KeyZ');
  await wait(170);
}
await wait(400);
await page.screenshot({ path: path.join(OUT, '02-starter.png') });
const party = await page.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));
check('received a starter from the professor', party.length > 0, JSON.stringify(party));

// Back out of the lab.
await walkTo(6, 7);
await hold('ArrowDown', 700);
await wait(900);
w = await where();
check('left the lab again', w.map === 'twinleaf', `${w.map} ${w.x},${w.y}`);
await page.screenshot({ path: path.join(OUT, '03-back-outside.png') });

// Every interior, entered directly, must leave the player able to move.
const interiors = ['player_house', 'rival_house', 'rowan_lab', 'oreburgh_center',
  'oreburgh_mart', 'oreburgh_gym', 'oreburgh_house', 'oreburgh_house2', 'oreburgh_hall',
  'oreburgh_gate', 'everlight_chamber', 'route201', 'route207', 'route202', 'oreburgh', 'twinleaf'];
for (const id of interiors) {
  const res = await page.evaluate(async (mapId) => {
    const g = window.CARIBOU;
    // Enter the way a player does: through a warp that targets this map.
    const { MAPS } = g.mapsForTest;
    let entry = null;
    for (const m of Object.values(MAPS)) {
      for (const wp of m.warps) if (wp.to === mapId) { entry = { x: wp.tx, y: wp.ty }; break; }
      if (entry) break;
    }
    if (!entry) entry = { x: 5, y: 5 };
    g.overworld.world.load(mapId, entry.x, entry.y, 'down');
    const w = g.overworld.world, p = w.player;
    const legal = ['up', 'down', 'left', 'right'].filter((d) => {
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
      return w.canEnter(p, p.x + dx, p.y + dy, d);
    });
    return { entry, legal };
  }, id);
  check(`entering ${id} leaves the player mobile`, res.legal.length > 0,
    `at ${res.entry.x},${res.entry.y} moves: ${res.legal.join(',') || 'NONE'}`);
}

// --- the Everlight, the story's ending ---
// Four maps of NPCs point at a seam of light under Oreburgh Gate. This proves
// the door is really there, that it is shut without the Aurora Charm, and that
// what is behind it is a real catchable encounter and not a cutscene.
console.log('\n--- the everlight ---');
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.state.flags.beatCommander = true;
  delete g.state.inventory.items.auroracharm;
  // This section is testing the story, not survival. Oreburgh Gate rolls wild
  // encounters, and a level-5 starter loses them and blacks out to the heal
  // point halfway through the scene — which reads as a broken door.
  g.debugGive(4, 45);
  g.state.repelSteps = 9999;
  g.overworld.world.load('oreburgh_gate', 12, 3, 'up');
});
await wait(500);
await walkTo(12, 2);
for (let i = 0; i < 8; i++) {
  const busy = await page.evaluate(() => !!window.CARIBOU.overworld.script || window.CARIBOU.dialogueForTest.visible);
  if (!busy) break;
  await tap('KeyZ', 1, 170);
}
await waitIdle();
const shut = await where();
check('the seam is shut without the Aurora Charm', shut.map === 'oreburgh_gate', shut.map);

// With the charm it opens.
await page.evaluate(() => { window.CARIBOU.state.inventory.items.auroracharm = 1; });
await waitIdle();
check('the player can step off the seam', await walkTo(11, 2, 6), (await where()).x + ',' + (await where()).y);
await waitIdle();
check('the player can step back onto the seam', await walkTo(12, 2, 6), (await where()).x + ',' + (await where()).y);
for (let i = 0; i < 25; i++) {
  const w2 = await where();
  if (w2 && w2.map === 'everlight_chamber') break;
  await tap('KeyZ', 1, 200);
}
const inside = await where();
check('the Aurora Charm opens the chamber', inside.map === 'everlight_chamber',
  `${inside.map} ${inside.x},${inside.y}`);
check('the door set its flag', await page.evaluate(() => !!window.CARIBOU.state.flags.everlightOpened));
await page.screenshot({ path: path.join(OUT, '09-everlight.png') });

if (inside.map === 'everlight_chamber') {
  check('the chamber leaves the player mobile', (await canMove()).length > 0, (await canMove()).join(','));
  await waitIdle();
  const walked = await walkTo(7, 4, 16);
  const standing = await where();
  check('the player can reach the Everlight', walked && standing.x === 7 && standing.y === 4,
    `${standing.x},${standing.y} walked=${walked}`);
  let battled = false;
  for (let i = 0; i < 30; i++) {
    const scr = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    if (scr === 'BattleScreen') { battled = true; break; }
    await tap('KeyZ', 1, 200);
  }
  const foe = await page.evaluate(() => {
    const s = window.CARIBOU.screens.top;
    if (s.constructor.name !== 'BattleScreen') return null;
    return { name: s.battle.sides[1].name, species: s.battle.sides[1].party[0].species,
      level: s.battle.sides[1].party[0].level, kind: s.battle.kind };
  });
  check('the chamber starts a real encounter with Dialga',
    battled && foe && foe.species === 37 && foe.kind === 'wild',
    foe ? `${foe.name} #${foe.species} Lv${foe.level}` : 'no battle');
  await page.screenshot({ path: path.join(OUT, '10-dialga.png') });
  check('the encounter recorded Dialga as seen',
    await page.evaluate(() => !!window.CARIBOU.state.dex.seen[37]));

  // Run from it: a legendary you decline must still be there afterwards.
  await page.evaluate(() => {
    const g = window.CARIBOU;
    const s = g.screens.top;
    if (s.constructor.name === 'BattleScreen') { s.battle.over = true; s.battle.result = 'run'; s._finish(); }
  });
  await wait(1400);
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => !!window.CARIBOU.overworld.script || window.CARIBOU.dialogueForTest.visible);
    if (!busy) break;
    await tap('KeyZ', 1, 170);
  }
  const after = await page.evaluate(() => ({
    resolved: !!window.CARIBOU.state.flags.everlightResolved,
    caught: !!window.CARIBOU.state.flags.caughtEverlight,
    map: window.CARIBOU.overworld.world.mapId,
  }));
  check('declining the Everlight does not consume it',
    after.resolved && !after.caught, JSON.stringify(after));
}

// --- the World Circuit, played end to end ---
// Walk into the Battle Hall, register at the desk, enter the Rookie Cup and
// actually fight a round. This is the only test that proves the side story
// connects to the real battle system rather than simulating one.
console.log('\n--- world circuit ---');
const idle = await waitIdle(60);
check('the world is idle before the circuit section', idle, await page.evaluate(() => {
  const g = window.CARIBOU;
  return `${g.screens.top.constructor.name} script=${!!g.overworld?.script} dlg=${g.dialogueForTest.visible}`;
}));
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.overworld.world.load('oreburgh_hall', 7, 8, 'up');
});
await wait(500);
check('the Battle Hall is enterable', (await where()).map === 'oreburgh_hall');

await waitIdle();
const reached = await walkTo(7, 6);
const deskState = await page.evaluate(() => {
  const g = window.CARIBOU; const p = g.overworld.world.player;
  return { at: `${p.x},${p.y}`, party: g.state.party.length, reachedDesk: true };
});
check('the player reaches the registration desk', reached && deskState.at === '7,6',
  `${deskState.at} party=${deskState.party}`);
await page.evaluate(() => { window.CARIBOU.overworld.world.player.dir = 'up'; });
await wait(150);

// Talk the desk script through: several lines, one Yes/No, then the hub opens.
for (let i = 0; i < 40; i++) {
  const done = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name === 'CircuitScreen');
  if (done) break;
  await tap('KeyZ', 1, 170);
}
const joined = await page.evaluate(() => ({
  screen: window.CARIBOU.screens.top.constructor.name,
  joined: window.CARIBOU.state.circuit.joined,
}));
check('the desk registers the player and opens the circuit', joined.joined && joined.screen === 'CircuitScreen',
  `${joined.screen} joined=${joined.joined}`);
await page.screenshot({ path: path.join(OUT, '04-circuit-hub.png') });

// Enter the Rookie Cup from the EVENTS tab. Entering asks first, so that is
// two presses: pick the event, then confirm.
await page.evaluate(() => { const s = window.CARIBOU.screens.top; s.tab = 1; s.index = 0; s.scroll = 0; });
await tap('KeyZ', 1, 300);
const asked = await page.evaluate(() => !!window.CARIBOU.screens.top.confirm);
check('entering an event asks for confirmation first', asked);
await tap('KeyZ', 1, 500);
const bracket = await page.evaluate(() => ({
  screen: window.CARIBOU.screens.top.constructor.name,
  active: window.CARIBOU.state.circuit.active && window.CARIBOU.state.circuit.active.id,
  rounds: window.CARIBOU.state.circuit.active && window.CARIBOU.state.circuit.active.rounds,
}));
check('entering an event draws a bracket', bracket.screen === 'TournamentScreen' && bracket.active === 'rookie_cup',
  `${bracket.screen} ${bracket.active} rounds=${bracket.rounds}`);
await page.screenshot({ path: path.join(OUT, '05-bracket.png') });

// Take the floor: this must start a real trainer battle against the pro's
// generated team, not a scripted result.
const before = await where();
await tap('KeyZ', 1, 900);
const inBattle = await page.evaluate(() => {
  const g = window.CARIBOU;
  const s = g.screens.top;
  if (s.constructor.name !== 'BattleScreen') return { screen: s.constructor.name };
  const foe = s.battle.sides[1];
  return {
    screen: 'BattleScreen',
    foeName: foe.name,
    foeTeam: foe.party.map((m) => `${m.species}:L${m.level}`),
    noBlackout: !!s.opts.noBlackout,
  };
});
check('the bracket starts a real battle against the pro', inBattle.screen === 'BattleScreen',
  `${inBattle.screen} ${inBattle.foeName || ''} ${(inBattle.foeTeam || []).join(' ')}`);
check('a circuit match is flagged as a no-blackout battle', !!inBattle.noBlackout);
await page.screenshot({ path: path.join(OUT, '06-circuit-battle.png') });

// Force the loss rather than grinding the turns out. Whether the engine can
// finish a battle is battletest's job (400 of them, with a determinism check);
// what this suite is for is the case worth proving here — that a sanctioned
// loss does not send the player home, and that the run settles afterwards.
await page.evaluate(() => {
  const s = window.CARIBOU.screens.top;
  if (s.constructor.name === 'BattleScreen') {
    s.battle.over = true;
    s.battle.result = 'lose';
    s._finish();
  }
});
await wait(1600);
const after = await page.evaluate(() => {
  const g = window.CARIBOU;
  const c = g.state.circuit;
  return {
    screen: g.screens.top.constructor.name,
    map: g.overworld.world.mapId,
    x: g.overworld.world.player.x, y: g.overworld.world.player.y,
    losses: c.losses, wins: c.wins, cp: c.cp, active: !!c.active,
    news: c.news.length, press: !!c.lastPress, money: g.state.inventory.money,
  };
});
check('a circuit result was recorded', after.wins + after.losses > 0,
  `${after.wins}-${after.losses}, ${after.cp} CP`);
check('losing a sanctioned match does not send the player home',
  after.map === 'oreburgh_hall', `${after.map} ${after.x},${after.y}`);
check('the press filed a story', after.news > 0, `${after.news} stories`);
await page.screenshot({ path: path.join(OUT, '07-circuit-after.png') });

// A lost round ends the run, so it must settle straight into the press.
for (let i = 0; i < 16; i++) {
  const n = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
  if (n === 'PressScreen') break;
  await tap('KeyZ', 1, 350);
}
const press = await page.evaluate(() => ({
  screen: window.CARIBOU.screens.top.constructor.name,
  active: !!window.CARIBOU.state.circuit.active,
}));
check('the run settles into a press conference', press.screen === 'PressScreen' && !press.active,
  `${press.screen} active=${press.active}`);
await page.screenshot({ path: path.join(OUT, '08-press.png') });
await tap('KeyZ', 3, 350);

// Nothing the press filed during that run may be unprintable or hold an
// unfilled slot — the same guard the offline suite applies, but against the
// stories this real playthrough actually generated.
const feed = await page.evaluate(() => window.CARIBOU.state.circuit.news.map(
  (n) => [n.headline, n.outlet, ...n.body].join(' | ')));
check('the stories this run filed are all printable',
  feed.every((t) => !/[{}]/.test(t)), feed.find((t) => /[{}]/.test(t)) || `${feed.length} stories`);

// --- the town notices ---
// The same NPC, asked the same way, must say different things as the world
// changes around them. This is the check that the dialogue system is wired to
// the live save and not to a fixed script.
await page.evaluate(() => {
  const g = window.CARIBOU;
  g.overworld.world.load('twinleaf', 10, 9, 'up');
});
await wait(500);
const talkToTam = () => page.evaluate(async () => {
  const g = window.CARIBOU;
  const tam = g.overworld.world.entities.find((e) => e.id === 'bv_kid');
  if (!tam) return null;
  // Ask directly through the same resolver the A button uses.
  return g.dialogueForTest ? g.gossipForTest.resolveDialogue(tam.data.dialogue, g.state, 0) : null;
});
const early = await talkToTam();
check('the town kid has something to say', !!early && early.length > 0, (early || []).join(' / '));

await page.evaluate(() => {
  const g = window.CARIBOU;
  const c = g.state.circuit;
  c.joined = true;
  c.titles = ['rookie_cup', 'sinnoh_open', 'regional_invitational'];
  c.cp = 3000; c.rating = 2200;
  for (const id of Object.keys(c.pros)) c.pros[id].rating = 900;
});
const late = await talkToTam();
check('the same kid says something else once you are world number one',
  !!late && JSON.stringify(late) !== JSON.stringify(early), (late || []).join(' / '));
check('and names the player as the one on top',
  !!late && late.some((l) => /world/i.test(l) && l.includes('Matthew')), (late || [])[0]);

// The career must survive a save/load round trip.
const trip = await page.evaluate(async () => {
  const g = window.CARIBOU;
  await g.save.save(g.state);
  const raw = await g.save.load();
  return {
    cp: g.state.circuit.cp, loadedCp: raw && raw.circuit && raw.circuit.cp,
    news: g.state.circuit.news.length,
    loadedNews: raw && raw.circuit && raw.circuit.news ? raw.circuit.news.length : -1,
  };
});
check('the career survives a save', trip.loadedCp === trip.cp && trip.loadedNews === trip.news,
  `cp ${trip.cp}/${trip.loadedCp}, stories ${trip.news}/${trip.loadedNews}`);
void before;

if (errs.length) { console.log(`  page errors: ${errs.slice(0, 5).join(' | ')}`); failures += errs.length; }
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall walkthrough checks passed');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
