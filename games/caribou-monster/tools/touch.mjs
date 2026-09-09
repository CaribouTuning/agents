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

  if (errs.length) { console.log(`  page errors: ${errs.slice(0, 3).join(' | ')}`); failures += errs.length; }
  await ctx.close();
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : '\nall touch checks passed');
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
