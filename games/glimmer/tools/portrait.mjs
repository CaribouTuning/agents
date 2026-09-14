// Look the characters in the face.
//
// At gameplay distance a character is forty pixels tall and every art mistake
// hides. This puts the camera a metre away, turns them slowly through a full
// circle, and holds each pose long enough to photograph — so the face, the
// back of the head and the silhouette all get looked at on purpose.
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
const p = await (await b.newContext({ viewport: { width: 420, height: 560 } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
await p.waitForFunction('!!window.GLIMMER', { timeout: 20000 });
await p.waitForTimeout(700);

// Freeze the game and take manual control of the camera.
await p.evaluate(() => {
  const g = window.GLIMMER;
  g.loop.stop();
  g.portrait = (yaw, camYaw) => {
    const h = g.hero;
    h.yaw = yaw;
    h.a.vx = h.a.vz = 0;
    // Settle the springs so the limbs are where they belong, not mid-flight.
    for (let i = 0; i < 200; i++) g.updateHeroFrame(1 / 60);
    h.yaw = yaw;
    g.camYaw = camYaw;
    g.camDist = 2.6;
    g.camPitch = 0.12;
    g.camHeight = 0.55;
    g.snapCamera();
    g.render();
  };
});

const angles = [['front', 0], ['three-quarter', Math.PI * 0.25], ['side', Math.PI * 0.5],
  ['back', Math.PI]];
for (const look of ['matt', 'sam']) {
  await p.evaluate((l) => window.GLIMMER.setLook(l), look);
  for (const [name, a] of angles) {
    // The camera stays put and the CHARACTER turns. Orbiting both together
    // shows the same side four times, which is how the first pass of this
    // tool reported a head it had never actually looked at the back of.
    await p.evaluate(([yaw]) => window.GLIMMER.portrait(yaw, Math.PI), [a]);
    await p.screenshot({ path: `/tmp/claude-0/p-${look}-${name}.png` });
  }
}
console.log(errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'no page errors');
await b.close(); server.close();
