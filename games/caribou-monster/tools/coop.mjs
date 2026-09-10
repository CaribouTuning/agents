// Two-player integration test.
//
// Opens TWO independent pages, each with its own save, party and game state,
// links them through the network layer, and drives a real co-op session:
// room join, position sync, a trade, and a link battle.
//
// This is the test that proves multiplayer is real rather than simulated —
// nothing here reaches across from one page into the other.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PAGE = process.argv[2] || 'index.html';
const OUT = process.argv[3] || '/tmp/coop';
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
  args: ['--no-sandbox'],
});
// One context so both tabs share a BroadcastChannel origin, exactly like two
// tabs on one phone. Separate contexts would be two different devices, which
// only the artifact-room transport can bridge.
const ctx = await browser.newContext({ viewport: { width: 800, height: 400 } });

const errs = [];
async function openTab(label) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`[${label}] ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`[${label}] ${m.text()}`); });
  await p.goto(`http://127.0.0.1:${port}/${PAGE}`, { waitUntil: 'load' });
  await p.waitForFunction('!!window.CARIBOU', { timeout: 8000 });
  return p;
}

const A = await openTab('A');
const B = await openTab('B');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

// Each tab starts its own game with its own team.
const seed = async (p, name, look, species) => p.evaluate(async ([n, l, sp]) => {
  const g = window.CARIBOU;
  g.save.markDirty = () => {};              // keep the shared localStorage out of it
  g.save.save = async () => true;
  g.startNewGame({ name: n, look: l, difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  const m = await import('./src/game/monster.js').catch(() => null);
  const make = m ? m.createMonster : null;
  if (make) {
    g.state.party.push(make(sp[0], 12));
    g.state.party.push(make(sp[1], 10));
  }
  return g.state.party.length;
}, [name, look, species]);

console.log('--- two-player session ---');

// The bundle has no module URLs to import, so fall back to the debug helper.
const seedBundled = async (p, name, look, species) => p.evaluate(([n, l, sp]) => {
  const g = window.CARIBOU;
  g.save.save = async () => true;
  g.startNewGame({ name: n, look: l, difficulty: 'easy' });
  g.state.flags.gotStarter = true;
  for (const s of sp) g.debugGive ? g.debugGive(s, 12) : null;
  return g.state.party.length;
}, [name, look, species]);

let na = await seed(A, 'Matthew', 'boy', [390, 396]);
let nb = await seed(B, 'Sammy', 'girl', [393, 403]);
if (!na) na = await seedBundled(A, 'Matthew', 'boy', [390, 396]);
if (!nb) nb = await seedBundled(B, 'Sammy', 'girl', [393, 403]);
check('both players have a party', na > 0 && nb > 0, `A=${na} B=${nb}`);

await wait(600);
const transport = await A.evaluate(() => window.CARIBOU.rooms && window.CARIBOU.net ? '' : '');
void transport;

// --- room ---------------------------------------------------------------
const code = await A.evaluate(() => {
  const g = window.CARIBOU;
  const net = g.netForTest;
  const r = net.createRoom();
  return r.ok ? r.code : null;
});
check('host created a room', !!code, code || '(no transport)');

if (code) {
  const joined = await B.evaluate((c) => window.CARIBOU.netForTest.joinRoom(c).ok, code);
  check('guest joined the room', joined);

  await wait(1600);
  const seesA = await A.evaluate(() => {
    const s = window.CARIBOU.netForTest.snapshot();
    return s.partner ? s.partner.name : null;
  });
  const seesB = await B.evaluate(() => {
    const s = window.CARIBOU.netForTest.snapshot();
    return s.partner ? s.partner.name : null;
  });
  check('host sees the guest', seesA === 'Sammy', `saw ${seesA}`);
  check('guest sees the host', seesB === 'Matthew', `saw ${seesB}`);

  // --- position sync -----------------------------------------------------
  await A.evaluate(() => {
    const g = window.CARIBOU;
    g.teleport('route201');
  });
  await B.evaluate(() => window.CARIBOU.teleport('route201'));
  await wait(1400);
  await A.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    w.player.x = 9; w.player.y = 14; w.player.dir = 'right';
    window.CARIBOU.state.player.x = 9; window.CARIBOU.state.player.y = 14;
  });
  await wait(1200);
  const remote = await B.evaluate(() => {
    const w = window.CARIBOU.overworld.world;
    const list = [...w.remotes.values()];
    return list.length ? { x: list[0].targetX, y: list[0].targetY, name: list[0].name, map: list[0].onThisMap } : null;
  });
  check('guest sees the host walking in the same map',
    !!remote && remote.x === 9 && remote.y === 14 && remote.map === true,
    remote ? `at ${remote.x},${remote.y} (${remote.name})` : 'no remote entity');

  await B.screenshot({ path: path.join(OUT, 'coop-01-both-in-world.png') });

  // --- trade -------------------------------------------------------------
  const beforeA = await A.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));
  const beforeB = await B.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));

  await A.evaluate(() => window.CARIBOU.requestTrade());
  await wait(700);
  const invited = await B.evaluate(() => window.CARIBOU.rooms.trade.phase);
  check('guest received the trade request', invited === 'invited', invited);

  await B.evaluate(() => window.CARIBOU.rooms.trade.accept());
  await wait(600);
  await A.evaluate(() => {
    const t = window.CARIBOU.rooms.trade;
    t.offer(window.CARIBOU.state.party[0].uid);
  });
  await B.evaluate(() => {
    const t = window.CARIBOU.rooms.trade;
    t.offer(window.CARIBOU.state.party[0].uid);
  });
  await wait(800);
  const reviewA = await A.evaluate(() => window.CARIBOU.rooms.trade.phase);
  check('both monsters are on the table', reviewA === 'review', reviewA);

  await A.screenshot({ path: path.join(OUT, 'coop-02-trade-review.png') });

  // One-sided confirm must NOT move anything — the core safety rule.
  await A.evaluate(() => window.CARIBOU.rooms.trade.confirm());
  await wait(500);
  const midA = await A.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));
  check('one confirm alone moves nothing',
    JSON.stringify(midA) === JSON.stringify(beforeA), JSON.stringify(midA));

  await B.evaluate(() => window.CARIBOU.rooms.trade.confirm());
  await wait(1200);
  const afterA = await A.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));
  const afterB = await B.evaluate(() => window.CARIBOU.state.party.map((m) => m.species));
  check('host received the guest monster', afterA.includes(beforeB[0]), JSON.stringify(afterA));
  check('guest received the host monster', afterB.includes(beforeA[0]), JSON.stringify(afterB));
  check('host gave away its own monster', !afterA.includes(beforeA[0]) || beforeA[0] === beforeB[0]);

  await A.screenshot({ path: path.join(OUT, 'coop-03-trade-done.png') });
  await A.evaluate(() => { window.CARIBOU.rooms.trade.reset(); while (window.CARIBOU.screens.stack.length > 1) window.CARIBOU.screens.pop(); });
  await B.evaluate(() => { window.CARIBOU.rooms.trade.reset(); while (window.CARIBOU.screens.stack.length > 1) window.CARIBOU.screens.pop(); });
  await wait(400);

  // --- link battle -------------------------------------------------------
  await A.evaluate(() => window.CARIBOU.requestPvp());
  await wait(800);
  const pvpInvited = await B.evaluate(() => window.CARIBOU.rooms.pvp.phase);
  check('guest received the battle request', pvpInvited === 'invited', pvpInvited);

  await B.evaluate(() => window.CARIBOU.rooms.pvp.accept());
  await wait(1600);
  const state = async (p) => p.evaluate(() => {
    const s = window.CARIBOU.rooms.pvp;
    if (!s.battle) return { phase: s.phase };
    return {
      phase: s.phase, seed: s.battle.seed, mySide: s.mySide, turn: s.battle.turn,
      hp: s.battle.sides.map((x) => x.party.map((m) => m.hp)),
    };
  });
  const sa = await state(A), sb = await state(B);
  check('both clients started the same battle',
    sa.phase === 'active' && sb.phase === 'active' && sa.seed === sb.seed,
    `seeds ${sa.seed} / ${sb.seed}`);
  check('the two clients took opposite sides', sa.mySide !== sb.mySide, `${sa.mySide} vs ${sb.mySide}`);

  await A.screenshot({ path: path.join(OUT, 'coop-04-link-battle.png') });

  // Each client picks its own move; the turn only resolves once both are in.
  await A.evaluate(() => window.CARIBOU.rooms.pvp.submitAction({ type: 'move', index: 0 }));
  await wait(600);
  const halfway = await state(A);
  check('turn waits for the second player', halfway.turn === 0, `turn ${halfway.turn}`);

  await B.evaluate(() => window.CARIBOU.rooms.pvp.submitAction({ type: 'move', index: 0 }));
  await wait(1500);
  const sa2 = await state(A), sb2 = await state(B);
  check('the turn resolved on both clients', sa2.turn === 1 && sb2.turn === 1, `${sa2.turn} / ${sb2.turn}`);
  check('both simulations agree exactly',
    JSON.stringify(sa2.hp) === JSON.stringify(sb2.hp),
    `${JSON.stringify(sa2.hp)} vs ${JSON.stringify(sb2.hp)}`);

  await A.screenshot({ path: path.join(OUT, 'coop-05-battle-turn.png') });

  // --- the world notices there are two of you -------------------------------
  // Written as "mostly single player, with real nods": when a partner is
  // actually connected, NPCs name them. This is the only place that can be
  // proved, because it needs two real clients.
  {
    const alone = await A.evaluate(() => {
      const g = window.CARIBOU;
      const mum = g.mapsForTest.MAPS.player_house.npcs.find((n) => n.id === 'ph_mom');
      return g.gossipForTest.resolveDialogue(mum.dialogue, g.state, 0, null).join(' ');
    });
    const together = await A.evaluate(() => {
      const g = window.CARIBOU;
      const mum = g.mapsForTest.MAPS.player_house.npcs.find((n) => n.id === 'ph_mom');
      return g.gossipForTest.resolveDialogue(
        mum.dialogue, g.state, 0, g.netForTest.snapshot()).join(' ');
    });
    const partnerName = await A.evaluate(() => {
      const p = window.CARIBOU.netForTest.snapshot().partner;
      return p ? p.name : null;
    });
    check('the client can see its partner by name', !!partnerName, partnerName);

    // The pair register: a keepsake you can only get while the two of you are
    // actually connected, which is the whole point of it.
    const registry = await A.evaluate(async () => {
      const g = window.CARIBOU;
      const said = [];
      const ctx = {
        state: g.state,
        say: async (t) => { said.push(String(t)); },
        give: (id, n) => { g.state.inventory.items[id] = (g.state.inventory.items[id] || 0) + n; },
        sfx: () => {},
        setFlag: (k, v = true) => { g.state.flags[k] = v; },
        journal: (id) => { g.state.journal.seen.push(id); },
        fill: (lines) => lines.map((l) => l.replace(/\{partner\}/g,
          (g.netForTest.snapshot().partner || {}).name || '?')),
        linked: () => !!(g.netForTest.snapshot().partner),
      };
      await g.scriptsForTest.pairRegistry(ctx);
      return { said, bell: g.state.inventory.items.pairbell || 0, flag: !!g.state.flags.pairRegistered };
    });
    check('a linked pair can be registered', registry.bell === 1 && registry.flag,
      `${registry.bell} bell(s), flag ${registry.flag}`);
    check('and the register names the partner',
      registry.said.some((l) => partnerName && l.includes(partnerName)),
      registry.said.join(' | ').slice(0, 100));
    check('an NPC says something different when a partner is connected',
      together !== alone, together.slice(0, 90));
    check('and names the partner', !!partnerName && together.includes(partnerName),
      together.slice(0, 90));
    // The solo line is allowed to name the other player — the world knows
    // both of them exist. What it must never do is claim they are here.
    check('and does not claim the partner is here when playing alone',
      !/with you\b|out there|right now/i.test(alone), alone.slice(0, 90));
  }

  // --- Secret Bases across the link ----------------------------------------
  // The Underground's headline feature, and the only thing in this game one
  // player publishes for the other to walk into. Everything B ends up with
  // came off the wire from A, so this is the real path, not a copy.
  {
    const built = await A.evaluate(async () => {
      const g = window.CARIBOU;
      const b = await import('./src/game/underground/base.js');
      const base = b.digBase(g.state.underground, 2, 7, g.state.player.name);
      b.place(base, 'hearth', 0, 0);
      b.place(base, 'banner', 3, 0);
      b.leaveNote(base, 'the kettle is on', g.state.player.name);
      g.netForTest.sendBase(b.shareable(base, g.state.player.name));
      return { owner: base.owner, decor: base.decor.length, note: base.note };
    });
    await wait(900);
    const seen = await B.evaluate(() => {
      const pb = window.CARIBOU.state.underground.partnerBase;
      return pb ? { owner: pb.owner, x: pb.x, y: pb.y, decor: pb.decor.length, note: pb.note } : null;
    });
    check('a Secret Base crosses the link', !!seen,
      seen ? `${seen.owner} at ${seen.x},${seen.y}` : 'nothing arrived');
    if (seen) {
      check('and arrives at the same wall', seen.x === 2 && seen.y === 7, `${seen.x},${seen.y}`);
      check('with the furniture in it', seen.decor === built.decor, `${seen.decor} piece(s)`);
      check('and the line left on the board', seen.note === built.note, seen.note);
      check('and whose room it is', seen.owner === built.owner, String(seen.owner));
    }

    // B walks in and takes the flag. A is the one who has to hear about it.
    const flagBefore = await A.evaluate(() => window.CARIBOU.state.underground.base.flagTaken);
    await B.evaluate(() => {
      window.CARIBOU.state.underground.flagsTaken++;
      window.CARIBOU.netForTest.sendFlagTaken();
    });
    await wait(900);
    const flagAfter = await A.evaluate(() => window.CARIBOU.state.underground.base.flagTaken);
    check('taking a flag tells the other player', flagAfter === flagBefore + 1,
      `${flagBefore} -> ${flagAfter}`);

    // And a hostile base is not a way into anybody's save.
    const hostile = await B.evaluate(async () => {
      const b = await import('./src/game/underground/base.js');
      const bad = b.acceptShared({ x: 2, y: 7, owner: 'x'.repeat(500), note: 'y'.repeat(9000),
        decor: Array.from({ length: 80 }, () => ({ id: 'nope', x: 999, y: -3 })) });
      return { owner: bad.owner.length, note: bad.note.length, decor: bad.decor.length };
    });
    check('a base off the wire is rebuilt rather than trusted',
      hostile.owner <= 16 && hostile.note <= 64 && hostile.decor === 0,
      JSON.stringify(hostile));
  }

  // --- ranked link play ----------------------------------------------------
  // A finished link battle counts towards the world ranking; an abandoned one
  // must not. Register A on the circuit first so there is something to move.
  await A.evaluate(() => { window.CARIBOU.state.circuit.joined = true; });
  const circuitBeforeDrop = await A.evaluate(() => {
    const c = window.CARIBOU.state.circuit;
    return { rating: c.rating, wins: c.wins, losses: c.losses, news: c.news.length };
  });

  // --- disconnect safety ---------------------------------------------------
  const partyBeforeDrop = await A.evaluate(() => window.CARIBOU.state.party.map((m) => `${m.species}:${m.hp}`));
  await B.close();
  await wait(5200);   // longer than the presence sweep
  const afterDrop = await A.evaluate(() => ({
    party: window.CARIBOU.state.party.map((m) => `${m.species}:${m.hp}`),
    pvp: window.CARIBOU.rooms.pvp.phase,
    partner: window.CARIBOU.netForTest.snapshot().partner,
  }));
  check('a mid-battle disconnect is detected', afterDrop.pvp === 'ended' && !afterDrop.partner, afterDrop.pvp);
  check('a link battle never touches the real party',
    JSON.stringify(afterDrop.party) === JSON.stringify(partyBeforeDrop),
    JSON.stringify(afterDrop.party));

  const circuitAfterDrop = await A.evaluate(() => {
    const c = window.CARIBOU.state.circuit;
    return { rating: c.rating, wins: c.wins, losses: c.losses, news: c.news.length };
  });
  check('an abandoned link battle does not move the world ranking',
    JSON.stringify(circuitAfterDrop) === JSON.stringify(circuitBeforeDrop),
    `${circuitBeforeDrop.rating} -> ${circuitAfterDrop.rating}`);

  // A clean result does move it, and files a story naming the opponent.
  const ranked = await A.evaluate(() => {
    const g = window.CARIBOU;
    const before = g.state.circuit.rating;
    g.career.recordLink(true, 'Robin');
    const c = g.state.circuit;
    return { before, after: c.rating, cp: c.cp, headline: c.news[0] && c.news[0].headline };
  });
  check('a completed link win raises the world ranking',
    ranked.after > ranked.before && ranked.cp > 0,
    `${ranked.before} -> ${ranked.after}, ${ranked.cp} CP`);
  check('the link result is reported by name',
    !!ranked.headline && ranked.headline.includes('Robin'), ranked.headline);
}

console.log(errs.length ? `\nERRORS:\n${errs.slice(0, 12).join('\n')}` : '\nno page errors');
console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall checks passed');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
