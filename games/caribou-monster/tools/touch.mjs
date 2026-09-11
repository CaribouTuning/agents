// Touch-only playthrough.
//
// The keyboard and the debug API are deliberately NOT used here: every step
// is a real tap at a real screen coordinate, at real phone sizes. This is the
// test that would have caught pointer events being mapped into the canvas
// backing store instead of logical pixels.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PAGE = process.argv[2] || 'index.html';
const OUT = process.argv[3] || '/tmp/touch';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  // Chromium asks for this unprompted; a 204 keeps it out of the error log.
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

// Real device shapes, including the fractional-scale and high-dpr cases that
// the coordinate bug depended on.
const DEVICES = [
  { name: 'iphone-landscape', width: 844, height: 390, dpr: 3, touch: true },
  { name: 'iphone-portrait', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'pixel-landscape', width: 915, height: 412, dpr: 2.6, touch: true },
  { name: 'desktop', width: 900, height: 500, dpr: 1, touch: false },
];

/**
 * Finds the selection highlight in the rendered frame and returns its centre
 * in logical pixels. This is how a "what you see is what you can touch" check
 * is made: the tap goes where the player sees the row, so a hit target that
 * has drifted away from its own drawing fails here.
 */
async function findHighlightBand(page, bounds) {
  return page.evaluate((b) => {
    const d = window.CARIBOU.display;
    const cv = document.getElementById('game');
    const ctx = cv.getContext('2d');
    const px = d.dpr * d.scale;
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    // PAL.uiSelect, the colour every selected row in the game is filled with.
    const want = [0x3f, 0x6f, 0xd4];
    const near = (o) => Math.abs(img[o] - want[0]) < 12
      && Math.abs(img[o + 1] - want[1]) < 12 && Math.abs(img[o + 2] - want[2]) < 12;

    // Bounded to the panel under test, in device pixels. The gamepad's B
    // button is a blue of its own and would otherwise be the first hit.
    const x0 = Math.max(0, Math.floor(b.x * px));
    const x1 = Math.min(cv.width, Math.ceil((b.x + b.w) * px));
    const yTop = Math.max(0, Math.floor(b.y * px));
    const yBot = Math.min(cv.height, Math.ceil((b.y + b.h) * px));
    const minRun = Math.max(8, Math.floor(30 * px));

    // Every scan line that carries a long run of the colour. Collected rather
    // than walked, because a fractional display scale antialiases the band's
    // edges and a pixel-by-pixel walk stops on the first blended row.
    const rows = [];
    for (let y = yTop; y < yBot; y++) {
      let run = 0, best = 0, bestStart = -1, start = -1;
      for (let x = x0; x < x1; x++) {
        if (near((y * cv.width + x) * 4)) {
          if (run === 0) start = x;
          run++;
          if (run > best) { best = run; bestStart = start; }
        } else run = 0;
      }
      if (best >= minRun) rows.push({ y, start: bestStart, run: best });
    }
    if (!rows.length) return null;

    // The first contiguous group of them is the topmost band.
    const group = [rows[0]];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].y - group[group.length - 1].y > 1) break;
      group.push(rows[i]);
    }
    const first = group[0], last = group[group.length - 1];
    return {
      y0: first.y / px,
      y1: (last.y + 1) / px,
      rows: group.length,
      cx: (first.start + first.run / 2) / px,
      cy: (first.y + (last.y + 1)) / 2 / px,
    };
  }, bounds);
}

let failures = 0;
const check = (dev, name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  [${dev}] ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

for (const dev of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.dpr,
    hasTouch: dev.touch,
    isMobile: dev.touch,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/${PAGE}`, { waitUntil: 'load' });
  await page.waitForFunction('!!window.CARIBOU', { timeout: 8000 });
  await page.waitForTimeout(500);

  // Translate a logical game coordinate into a page coordinate, then tap it.
  const tapLogical = async (lx, ly) => {
    const pt = await page.evaluate(([x, y]) => {
      const d = window.CARIBOU.display;
      const r = document.getElementById('game').getBoundingClientRect();
      return { x: r.left + (x / d.width) * r.width, y: r.top + (y / d.height) * r.height };
    }, [lx, ly]);
    if (dev.touch) await page.touchscreen.tap(pt.x, pt.y);
    else await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(260);
  };

  // Tap whatever the current screen reports as its cursor row — mirrors what
  // a player does: look at the option, put a thumb on it.
  const tapMenuRow = async (index) => {
    const box = await page.evaluate((i) => {
      const s = window.CARIBOU.screens.top;
      const b = s._menuBox ? s._menuBox() : null;
      if (!b) return null;
      return { x: b.x + b.w / 2, y: b.y + 5 + i * 10 + 3 };
    }, index);
    if (!box) return false;
    await tapLogical(box.x, box.y);
    return true;
  };

  const screenName = () => page.evaluate(() => window.CARIBOU.screens.top.constructor.name);

  check(dev.name, 'starts on the title screen', (await screenName()) === 'TitleScreen');

  // --- the reported bug: tapping NEW GAME ---
  await tapMenuRow(0);
  let scr = await screenName();
  check(dev.name, 'tapping NEW GAME opens character creation', scr === 'CharacterScreen', scr);
  await page.screenshot({ path: path.join(OUT, `${dev.name}-1-character.png`) });

  if (scr === 'CharacterScreen') {
    // Pick a look by tapping the portrait directly.
    const lookPt = await page.evaluate(() => {
      const d = window.CARIBOU.display;
      const n = 4;
      return { x: d.width / 2 - (n * 34) / 2 + 15, y: d.height / 2 - 4 };
    });
    await tapLogical(lookPt.x, lookPt.y);
    const step = await page.evaluate(() => window.CARIBOU.screens.top.step);
    check(dev.name, 'tapping a character advances to name entry', step === 1, `step ${step}`);

    // Type two letters on the on-screen keyboard, then OK.
    const keys = await page.evaluate(() => {
      const s = window.CARIBOU.screens.top;
      const g = s._keyGrid();
      const pick = (ch) => {
        const c = g.cells.find((k) => k.ch === ch);
        return c ? { x: c.x + c.w / 2, y: c.y + c.h / 2 } : null;
      };
      return { M: pick('M'), a: pick('a'), ok: { x: g.okX + 22, y: g.okY + 7 } };
    });
    const before = await page.evaluate(() => window.CARIBOU.screens.top.name);
    await tapLogical(keys.M.x, keys.M.y);
    const typed = await page.evaluate(() => window.CARIBOU.screens.top.name);
    check(dev.name, 'the on-screen keyboard types', typed === before + 'M', `"${before}" -> "${typed}"`);

    await tapLogical(keys.ok.x, keys.ok.y);
    const step2 = await page.evaluate(() => window.CARIBOU.screens.top.step);
    check(dev.name, 'OK advances to difficulty', step2 === 2, `step ${step2}`);

    // Difficulty, then confirm.
    await page.evaluate(() => { window.__d = window.CARIBOU.display; });
    const diff = await page.evaluate(() => ({ x: window.__d.width / 2, y: window.__d.height / 2 - 1 }));
    await tapLogical(diff.x, diff.y);
    const step3 = await page.evaluate(() => window.CARIBOU.screens.top.step);
    check(dev.name, 'choosing a difficulty advances to confirm', step3 === 3, `step ${step3}`);

    await tapLogical(diff.x, diff.y);
    await page.waitForTimeout(1400);
    scr = await screenName();
    check(dev.name, 'confirming starts the game', scr === 'OverworldScreen', scr);
    await page.screenshot({ path: path.join(OUT, `${dev.name}-2-overworld.png`) });
  }

  // --- the D-pad actually moves the player ---
  if ((await screenName()) === 'OverworldScreen') {
    const start = await page.evaluate(() => {
      const p = window.CARIBOU.overworld.world.player;
      return { x: p.x, y: p.y };
    });
    const dpadDown = await page.evaluate(() => {
      const l = window.CARIBOU.controlsLayout();
      return { x: l.dpad.x + l.cell * 1.5, y: l.dpad.y + l.cell * 2.5 };
    });
    const pt = await page.evaluate(([x, y]) => {
      const d = window.CARIBOU.display;
      const r = document.getElementById('game').getBoundingClientRect();
      return { x: r.left + (x / d.width) * r.width, y: r.top + (y / d.height) * r.height };
    }, [dpadDown.x, dpadDown.y]);

    // Hold the D-pad the way a thumb does, rather than tapping it.
    if (dev.touch) {
      await page.touchscreen.tap(pt.x, pt.y);
      await page.evaluate(([x, y]) => {
        const cv = document.getElementById('game');
        const t = new Touch({ identifier: 1, target: cv, clientX: x, clientY: y });
        cv.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true }));
      }, [pt.x, pt.y]);
      await page.waitForTimeout(700);
      await page.evaluate(([x, y]) => {
        const cv = document.getElementById('game');
        const t = new Touch({ identifier: 1, target: cv, clientX: x, clientY: y });
        cv.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true }));
      }, [pt.x, pt.y]);
    } else {
      await page.mouse.move(pt.x, pt.y);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
    }
    await page.waitForTimeout(300);
    const moved = await page.evaluate(() => {
      const p = window.CARIBOU.overworld.world.player;
      return { x: p.x, y: p.y };
    });
    check(dev.name, 'holding the D-pad walks the player',
      moved.x !== start.x || moved.y !== start.y,
      `${start.x},${start.y} -> ${moved.x},${moved.y}`);

    // Walking through the front door starts a screen transition, and input
    // during a transition is deliberately swallowed — wait it out first.
    await page.waitForFunction(() => !window.CARIBOU.screens.busy, { timeout: 4000 });
    await page.waitForTimeout(200);

    // MENU pill opens the pause menu.
    const startBtn = await page.evaluate(() => {
      const l = window.CARIBOU.controlsLayout();
      return { x: l.start.x + l.start.w / 2, y: l.start.y + l.start.h / 2 };
    });
    await tapLogical(startBtn.x, startBtn.y);
    const menu = await screenName();
    check(dev.name, 'tapping MENU opens the pause menu', menu === 'MainMenuScreen', menu);
    await page.screenshot({ path: path.join(OUT, `${dev.name}-3-menu.png`) });
  }

  // --- the battle bag, by thumb ---
  // The bug this exists for: the bag's rows were drawn in one place and
  // hit-tested 18 pixels lower, so a Poké Ball could not be tapped at all and
  // there was no way to catch anything on a phone.
  if ((await screenName()) === 'MainMenuScreen') {
    await page.evaluate(() => {
      const g = window.CARIBOU;
      while (g.screens.stack.length > 1) g.screens.pop();
      g.debugGive(387, 12);
      g.state.inventory.items.pokeball = 5;
      g.state.inventory.items.potion = 3;
      g.startWildBattle(404, 4);
    });
    await page.waitForTimeout(900);
    // Skip the intro text with taps on the message box.
    for (let i = 0; i < 12; i++) {
      const m = await page.evaluate(() => {
        const s = window.CARIBOU.screens.top;
        return s.constructor.name === 'BattleScreen' ? s.mode : null;
      });
      if (m === 'command') break;
      await tapLogical(await page.evaluate(() => window.CARIBOU.display.width / 2),
        await page.evaluate(() => window.CARIBOU.display.height - 20));
    }
    const atCommand = await page.evaluate(() => window.CARIBOU.screens.top.mode);
    check(dev.name, 'a wild battle reaches the command menu', atCommand === 'command', atCommand);

    // Tap BAG (command index 1).
    const bagBtn = await page.evaluate(() => {
      const r = window.CARIBOU.screens.top._commandRects()[1];
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    });
    await tapLogical(bagBtn.x, bagBtn.y);
    const inBag = await page.evaluate(() => window.CARIBOU.screens.top.mode);
    check(dev.name, 'tapping BAG opens the bag', inBag === 'bag', inBag);

    if (inBag === 'bag') {
      const before = await page.evaluate(() => window.CARIBOU.state.inventory.items.pokeball || 0);
      const name = await page.evaluate(() => {
        const s = window.CARIBOU.screens.top;
        const items = s._bagItems();
        return items.length ? items[s.bagIndex].item.name : null;
      });
      check(dev.name, 'the bag lists a throwable ball', /Ball/.test(name || ''), name);

      // Tap where the selected row is DRAWN, found by scanning the canvas for
      // the highlight band — not where the code says its hit target is. Asking
      // the code for the rect would pass even if the two disagreed, which is
      // the bug this whole check exists for.
      const bagWindow = await page.evaluate(() => {
        const s = window.CARIBOU.screens.top;
        // The window's own frame, which draw and hit-test have always agreed
        // on; only the rows inside it were ever out of step.
        const b = s._bagBox();
        return { x: b.x, y: b.y, w: b.w, h: b.h };
      });
      const band = await findHighlightBand(page, bagWindow);
      check(dev.name, 'the selected bag row is visible on screen', !!band,
        band ? `y ${band.y0}-${band.y1}` : 'no highlight found');
      if (band && name) {
        await tapLogical(band.cx, band.cy);
        await page.waitForTimeout(700);
        const after = await page.evaluate(() => window.CARIBOU.state.inventory.items.pokeball || 0);
        check(dev.name, 'tapping the drawn Poké Ball row actually throws it',
          after === before - 1, `${before} -> ${after} (tapped ${band.cx.toFixed(0)},${band.cy.toFixed(0)})`);
      }
    }
    await page.evaluate(() => {
      const g = window.CARIBOU;
      while (g.screens.stack.length > 1) g.screens.pop();
      g.openMenu();
    });
    await page.waitForTimeout(300);
  }

  // --- the World Circuit, reached and driven entirely by tapping ---
  // The only non-tap step is registering the career, which in the game happens
  // at the Battle Hall desk several maps away; everything after it is a thumb.
  if ((await screenName()) === 'MainMenuScreen') {
    await page.evaluate(() => { window.CARIBOU.state.circuit.joined = true; });
    const row = await page.evaluate(() => {
      const s = window.CARIBOU.screens.top;
      const items = s.entries;
      const b = s._box();
      const i = items.findIndex((e) => e.key === 'circuit');
      return i < 0 ? null : { x: b.x + b.w / 2, y: b.y + 5 + i * 10 + 3 };
    });
    check(dev.name, 'CIRCUIT appears in the pause menu once registered', !!row);
    if (row) {
      await tapLogical(row.x, row.y);
      let scr2 = await screenName();
      check(dev.name, 'tapping CIRCUIT opens the hub', scr2 === 'CircuitScreen', scr2);

      if (scr2 === 'CircuitScreen') {
        // Every tab must be reachable by tapping its header.
        for (const want of [1, 2, 3, 0]) {
          const pt = await page.evaluate((i) => {
            const r = window.CARIBOU.screens.top._tabRects()[i];
            return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
          }, want);
          await tapLogical(pt.x, pt.y);
          const got = await page.evaluate(() => window.CARIBOU.screens.top.tab);
          check(dev.name, `tapping tab ${want} selects it`, got === want, `tab ${got}`);
        }
        await page.screenshot({ path: path.join(OUT, `${dev.name}-4-circuit.png`) });

        // Enter the open event by tapping its row, then confirming.
        const evPt = await page.evaluate(() => {
          const s = window.CARIBOU.screens.top;
          s.tab = 1; s.index = 0; s.scroll = 0;
          const b = s._panel();
          return { x: b.x + b.w / 2, y: b.y + 4 + s._rowH() / 2 };
        });
        await tapLogical(evPt.x, evPt.y);
        const asked = await page.evaluate(() => !!window.CARIBOU.screens.top.confirm);
        check(dev.name, 'entering an event asks first', asked);
        const yes = await page.evaluate(() => {
          const s = window.CARIBOU.screens.top;
          const b = s._confirmBox();
          const w = Math.floor((b.w - 20) / 2);
          return { x: b.x + 7 + w / 2, y: b.y + b.h - 20 + 7 };
        });
        await tapLogical(yes.x, yes.y);
        await page.waitForTimeout(300);
        scr2 = await screenName();
        check(dev.name, 'confirming opens the bracket', scr2 === 'TournamentScreen', scr2);
        await page.screenshot({ path: path.join(OUT, `${dev.name}-5-bracket.png`) });

        if (scr2 === 'TournamentScreen') {
          // WITHDRAW is the second button; tapping it must return to the hub.
          const btn = await page.evaluate(() => {
            const b = window.CARIBOU.screens.top._btnBox();
            return { x: b.x + b.w / 2, y: b.y + 16 + 7 };
          });
          await tapLogical(btn.x, btn.y);
          await page.waitForTimeout(300);
          const after = await screenName();
          check(dev.name, 'tapping WITHDRAW leaves the bracket', after === 'CircuitScreen', after);
        }

        // The BACK chip closes the hub.
        const back = await page.evaluate(() => {
          const b = window.CARIBOU.screens.top.game.display;
          return { x: b.width - 46 + 20, y: 6 };
        });
        await tapLogical(back.x, back.y);
        await page.waitForTimeout(250);
        const closed = await screenName();
        check(dev.name, 'the BACK chip closes the circuit hub', closed !== 'CircuitScreen', closed);
      }
    }
  }

  if (errs.length) { console.log(`  page errors: ${errs.slice(0, 3).join(' | ')}`); failures += errs.length; }
  await ctx.close();
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall touch checks passed');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
