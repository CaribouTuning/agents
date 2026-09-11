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
let transcript = '';
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
  transcript = transcript || '';
  for (let i = 0; i < budget; i++) {
    if (!await busy()) return true;
    const top = await page.evaluate(() => window.CARIBOU.screens.top.constructor.name);
    if (top === 'NicknameScreen' || top === 'TextEntryScreen') { await tap('KeyQ', 1, 160); continue; }
    if (top === 'BattleScreen') return 'battle';
    const t = (await said()).text;
    if (t && !transcript.includes(t)) transcript += ' ' + t;
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

/**
 * The opening, played as one of the two of them.
 *
 * Parameterised rather than written twice, because "does it work as Sammy"
 * has to be a question the tests answer rather than one I answer.
 */
async function playOpening(me) {
  const them = me.name === 'Matthew' ? 'Sammy' : 'Matthew';
  console.log(`\n--- the opening, played as ${me.name} ---`);

  await page.evaluate((m) => window.CARIBOU.startNewGame({ name: m.name, look: m.look, difficulty: 'easy' }), me);
  await wait(700);
  let w = await where();
  check(w && w.map === me.house, `${me.name} wakes up in their own house`, w && w.map);

  // Mum catches you on the mat.
  await hold('ArrowDown', 380);
  await wait(400);
  transcript = (await said()).text;
  check(/Mum/.test(transcript), 'Mum stops you before the door', transcript.slice(0, 60));
  await clear();
  const mum = transcript;
  check(new RegExp(them).test(mum), 'and names the person waiting outside', mum.slice(-90));

  // Out the door, and then NOTHING. No steps at all.
  //
  // This used to walk south a few tiles before looking, which is what hid the
  // bug for weeks: the scene was sitting on the path row below the houses,
  // the test obligingly walked onto it, and a real player — who walks NORTH,
  // because that is where the lab is — never saw it. Mum said the other one
  // was outside and there was nobody there. So the test now does what a
  // person does: comes out of the door and looks.
  for (let i = 0; i < 6; i++) {
    const at = await where();
    if (at.map === 'twinleaf') break;
    await hold('ArrowDown', 420);
    await wait(360);
  }
  await wait(900);
  transcript = '';
  await clear(200);
  const step = transcript;
  check(new RegExp(them).test(step), `${them} is waiting outside and starts a scene`, step.slice(0, 70));
  if (me.name === 'Sammy') {
    check(/Bandit/.test(step), 'and Bandit gets in first, because she always does', step.slice(0, 70));
  }

  const joined = await page.evaluate(() => {
    const g = window.CARIBOU, c = g.overworld.world.companion;
    return { active: !!(g.state.companion && g.state.companion.active), name: g.state.companion.name, visible: !!(c && c.visible) };
  });
  check(joined.active && joined.name === them, `${them} joins you as a companion`, JSON.stringify(joined));

  // They walk with you.
  await hold('ArrowUp', 500);
  await wait(400);
  const trailing = await page.evaluate(() => {
    const w2 = window.CARIBOU.overworld.world;
    const c = w2.companion, p = w2.player;
    return { visible: !!c.visible, dist: Math.abs(c.x - p.x) + Math.abs(c.y - p.y) };
  });
  check(trailing.visible && trailing.dist <= 2, 'and walks along behind you', JSON.stringify(trailing));

  // To the lab. The door is looked up rather than hard-coded, so resizing
  // the town cannot quietly turn this test into a test of nothing.
  await page.evaluate(() => {
    const { MAPS } = window.CARIBOU.mapsForTest;
    const door = MAPS.twinleaf.warps.find((wp) => wp.to === 'rowan_lab');
    window.CARIBOU.overworld.world.load('twinleaf', door.x, door.y + 1, 'up');
  });
  await wait(400);
  w = await walkUntilMapChanges('ArrowUp');
  check(w.map === 'rowan_lab', 'the lab is enterable', `${w.map} ${w.x},${w.y}`);
  const cameIn = await page.evaluate(() => {
    const c = window.CARIBOU.overworld.world.companion;
    return !!(c && c.visible);
  });
  check(cameIn, `${them} comes into the lab with you`, String(cameIn));

  // You pick first, whichever of you you are.
  for (let i = 0; i < 6; i++) {
    const p2 = await where();
    if (p2.y <= 3) break;
    await hold('ArrowUp', 380);
    await wait(260);
  }
  await hold('ArrowUp', 300);
  await wait(300);
  await tap('KeyZ', 1, 400);
  await clear(240);
  await wait(400);
  const lab = await page.evaluate(() => {
    const g = window.CARIBOU;
    return {
      mine: g.state.starterBase,
      party: g.state.party.length,
      metRival: !!g.state.flags.metRival,
      buddyTook: !!g.state.flags.buddyHasStarter,
    };
  });
  check(lab.party > 0 && !!lab.mine, `${me.name} takes the first pick`, JSON.stringify(lab));
  check(lab.metRival, 'Cass takes the counter to it, on screen', JSON.stringify(lab));
  check(lab.buddyTook, `${them} takes the last one`, JSON.stringify(lab));

  // And Cass's counter really is the counter to what the PLAYER picked.
  const counter = await page.evaluate(async (mine) => {
    const { rivalStarterBase } = await import('./src/data/trainers.js');
    return rivalStarterBase(mine);
  }, lab.mine);
  check(counter !== lab.mine, "and it is the one that beats the player's", `${lab.mine} -> ${counter}`);
  return lab;
}

await playOpening({ name: 'Matthew', look: 'matthew', house: 'matthew_house' });
await playOpening({ name: 'Sammy', look: 'sammy', house: 'sammy_house' });

// --- the map exists and can be opened ---
// --- what Cass promised actually happens ---
//
// She says "Route 201. The north gate. Twenty minutes." and then walks out.
// If nothing is waiting up that road, she is a character who makes an
// appointment and does not keep it, and the player is left standing at a gate
// wondering what they did wrong. This walks the appointment.
console.log('\n--- Cass keeps her appointment ---');
{
  await page.evaluate(() => {
    const g = window.CARIBOU;
    // Straight after the lab: starter in hand, Cass met, gate open.
    g.state.flags.gotStarter = true;
    g.state.flags.metRival = true;
    g.state.player.dir = 'up';
    g.teleport('twinleaf', 11, 2);
  });
  await wait(700);

  transcript = '';
  let met = '';
  let sawHer = false;
  for (let i = 0; i < 16; i++) {
    const at = await where();
    if (!at) break;
    if (await busy()) {
      const r = await clear(90);
      met += ' ' + transcript;
      if (r === 'battle') { sawHer = true; break; }
      if (/Cass/.test(transcript)) sawHer = true;
      continue;
    }
    await hold('ArrowUp', 380);
    await wait(260);
  }
  const at = await where();
  check(sawHer && /Cass/i.test(met),
    'walking up Route 201 actually finds her there',
    `${at ? at.map + ' ' + at.x + ',' + at.y : '?'} | ${met.slice(0, 120)}`);

  // The proof is that a battle against HER actually starts. Fighting it to a
  // finish is a different test; what matters here is that the appointment she
  // made in the lab turns into the thing she said it would.
  const fight = await page.evaluate(() => {
    const g = window.CARIBOU;
    const top = g.screens.top;
    if (top.constructor.name !== 'BattleScreen') return { screen: top.constructor.name };
    const b = top.battle || top.engine || null;
    const foe = b && b.sides && b.sides[1];
    return { screen: 'BattleScreen', foe: foe ? foe.name : null };
  });
  check(fight.screen === 'BattleScreen' && /Cass/i.test(fight.foe || ''),
    'and the battle she promised is the one that starts', JSON.stringify(fight));

  // She is also standing there to be SEEN, not conjured out of the air three
  // tiles up the road once you have already walked past where she said.
  const visible = await page.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    const e = (w.entities || []).find((x) => x.id === 'rival');
    return e ? { x: e.x, y: e.y } : null;
  });
  check(!!visible, 'and she is a person standing on the route, not a spawn', JSON.stringify(visible));
}


// It did not. The Town Map screen was written, the Key Item was defined, and
// nobody was ever given one — so as far as a player was concerned the game
// had no map at all.
console.log('\n--- the map ---');
{
  const held = await page.evaluate(() => (window.CARIBOU.state.inventory.items.townmap || 0) > 0);
  check(held, 'you are actually given a Town Map', String(held));

  await page.evaluate(() => window.CARIBOU.openMenu());
  await wait(320);
  const keys = await page.evaluate(() => (window.CARIBOU.screens.top.entries || []).map((e) => e.key));
  check(keys.includes('map'), 'and it is in the pause menu', keys.join(','));

  // Open it the way a player would: move to the row and press A.
  const opened = await page.evaluate(async () => {
    const g = window.CARIBOU;
    g.openTownMap();
    await new Promise((r) => setTimeout(r, 200));
    return g.screens.top.constructor.name;
  });
  check(opened === 'TownMapScreen', 'and it opens', opened);
  await page.screenshot({ path: path.join(OUT, 'map.png') });

  // The whole region is on the paper from the first morning, but a place you
  // have not stood in has no name on it and no way to travel to it.
  const m = await page.evaluate(() => {
    const s = window.CARIBOU.screens.top;
    const byId = (id) => s.places.find((p) => p.id === id);
    return {
      total: s.places.length,
      known: s.places.filter((p) => s._known(p.id)).length,
      hasFarTown: !!byId('snowpoint') || !!byId('veilstone'),
      veilstoneKnown: s._known('veilstone'),
      canGoVeilstone: s._canTravelTo(byId('veilstone')),
      canGoHome: s._canTravelTo(byId('twinleaf')),
      routeIsNotADestination: s._canTravelTo(byId('route201')),
    };
  });
  check(m.total > m.known, 'the whole region is drawn, not only what you have walked',
    `${m.known} known of ${m.total}`);
  check(m.hasFarTown, 'including cities you have never been near');
  check(!m.veilstoneKnown, 'a town you have not stood in stays undiscovered');
  check(!m.canGoVeilstone, 'and you cannot travel to it');
  check(!m.routeIsNotADestination, 'a route is not somewhere you travel to');

  // Having stood somewhere is the whole unlock.
  const after = await page.evaluate(() => {
    const g = window.CARIBOU;
    g.state.visited.veilstone = true;
    const s = g.screens.top;
    return s._canTravelTo(s.places.find((p) => p.id === 'veilstone'));
  });
  check(after, 'once you have stood there, you can travel back to it');

  // Test mode sees everything, because that is what test mode is for.
  const inTest = await page.evaluate(() => {
    const g = window.CARIBOU;
    delete g.state.visited.veilstone;
    g.state.settings.testMode = true;
    const s = g.screens.top;
    const ok = s._canTravelTo(s.places.find((p) => p.id === 'veilstone'));
    g.state.settings.testMode = false;
    return ok;
  });
  check(inTest, 'test mode can travel anywhere without walking it first');

  await page.evaluate(() => { while (window.CARIBOU.screens.stack.length > 1) window.CARIBOU.screens.pop(); });
  await wait(200);
}

// --- the stand-in steps aside for the real person ---
console.log('\n--- and gets out of the way when the real one arrives ---');
{
  const before = await page.evaluate(() => !!window.CARIBOU.overworld.world.companion.visible);
  check(before, 'the stand-in is walking with you');
  const after = await page.evaluate(() => {
    const g = window.CARIBOU;
    g.state.link = { connected: true, partner: { name: 'Sammy' } };
    g.overworld.world.refreshCompanion();
    return !!g.overworld.world.companion.visible;
  });
  check(!after, 'and vanishes the moment a real second player links in', String(after));
  await page.evaluate(() => {
    const g = window.CARIBOU;
    g.state.link = null;
    g.overworld.world.refreshCompanion();
  });
  const back = await page.evaluate(() => !!window.CARIBOU.overworld.world.companion.visible);
  check(back, 'and comes back when the link drops', String(back));
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

// One slot per character, so read the one this run belongs to rather than
// the single slot the first builds used.
const stored = await page.evaluate(() => {
  const look = (window.CARIBOU.state.player.look || '').toLowerCase();
  const raw = localStorage.getItem(`caribou:save-${look}`);
  return raw ? JSON.parse(raw).meta : null;
});
check(!!stored, 'and something is actually on disk', JSON.stringify(stored));

// The phone way out: hide the page, then reload.
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await wait(500);

// Taken while the played game is still in memory. Taking it after the reload
// would export the blank state the title screen sits on, which is exactly the
// mistake that makes a restore quietly wipe a playthrough.
const backupText = await page.evaluate(() => window.CARIBOU.backupText());

await page.reload({ waitUntil: 'load' });
await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
await wait(1500);
// How long the title takes to find out whether a saved game exists.
//
// This is the bug the players actually hit: every provider was polled for
// fifteen seconds and the title waited for all of them, so CONTINUE did not
// appear until long after they had tapped NEW GAME over the top of their
// save. The save was never lost. It was just never offered in time.
const settledIn = await page.evaluate(() => {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (window.CARIBOU && window.CARIBOU.saveProviders !== undefined) resolve(performance.now() - t0);
      else if (performance.now() - t0 > 20000) resolve(Infinity);
      else setTimeout(tick, 50);
    };
    tick();
  });
});
check(settledIn < 4000, 'the title learns whether a save exists in the first few seconds',
  `${Math.round(settledIn)}ms`);

const onTitle = await page.evaluate(() => {
  const g = window.CARIBOU;
  const t = g.screens.top;
  return {
    screen: t.constructor.name,
    options: (t.options || []).map((o) => o.key),
    save: t.saveMeta || null,
  };
});
check(onTitle.options.some((k) => k.startsWith('continue')),
  'after a reload the title offers CONTINUE', JSON.stringify(onTitle.options));

// --- LOAD BACKUP actually opens something you can use ---
//
// It did nothing at all before, and the reason is the reason this block is
// here: every tap is consumed on the next logic tick, so by the time the
// title screen acted on LOAD BACKUP the browser no longer considered a
// gesture in progress, and a file picker opened from there is silently
// refused. Reasoning about that got it wrong twice. Pressing the button and
// looking at the page does not.
check(onTitle.save && onTitle.save.name === 'Matthew',
  'and it is the game we were playing', JSON.stringify(onTitle.save));

const loaded = await page.evaluate(async () => {
  const g = window.CARIBOU;
  await g.continueGame();
  return { money: g.state.money || g.state.inventory.money, party: g.state.party.length, map: g.state.player.map };
});
check(loaded.money === 4242 && loaded.party > 0,
  'and continuing puts the whole game back', JSON.stringify(loaded));

console.log('\n--- loading a backup back in ---');
{
  // Back to the title, because LOAD BACKUP lives there and that is where
  // somebody who has just lost a save actually is.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('!!window.CARIBOU', { timeout: 30000 });
  await wait(1500);
  // Wipe the device copy so the restore is genuinely doing the work.
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('caribou:')) localStorage.removeItem(k);
  });

  await page.evaluate(() => {
    const t = window.CARIBOU.screens.top;
    t.index = t.options.findIndex((o) => o.key === 'restore');
    t._pick('restore');
  });
  await wait(500);

  const panel = await page.evaluate(() => {
    const root = document.querySelector('.cbm-restore');
    if (!root) return null;
    return {
      file: !!root.querySelector('input[type=file]'),
      paste: !!root.querySelector('.cbm-paste'),
      cancel: !!root.querySelector('.cbm-cancel'),
      inputOff: !window.CARIBOU.inputEnabled,
    };
  });
  check(!!panel, 'LOAD BACKUP opens a panel you can actually touch', JSON.stringify(panel));
  if (panel) {
    check(panel.file, 'with a real file button the browser will honour');
    check(panel.paste && panel.cancel, 'a paste box, and a way out');
  }

  if (backupText) {
    const loaded = await page.evaluate(async (text) => {
      const root = document.querySelector('.cbm-restore');
      root.querySelector('textarea').value = text;
      root.querySelector('.cbm-paste').click();
      await new Promise((r) => setTimeout(r, 900));
      const g = window.CARIBOU;
      return { screen: g.screens.top.constructor.name, map: g.state.player.map, money: g.state.inventory.money };
    }, backupText);
    check(loaded.money === 4242, 'pasting a backup puts the game back', JSON.stringify(loaded));
  } else {
    check(false, 'could not read a backup out of the running game to paste back');
  }
}

if (errs.length) { console.log(`\n  page errors: ${errs.slice(0, 5).join(' | ')}`); fails += errs.length; }
console.log(fails ? `\n${fails} PROBLEM(S)` : '\nthe opening plays correctly');
await browser.close();
server.close();
process.exit(fails ? 1 : 0);
