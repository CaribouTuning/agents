import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '.';
const page_ = process.argv[3] || 'tools/artcheck.html';
const out = process.argv[4] || '/tmp/shot.png';
const W = Number(process.argv[5] || 1140);
const H = Number(process.argv[6] || 660);

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(root, u === '/' ? '/index.html' : u);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
const errors = [];
pg.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
pg.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await pg.goto(`http://127.0.0.1:${port}/${page_}`, { waitUntil: 'load' });
await pg.waitForTimeout(Number(process.env.WAIT || 900));
await pg.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
else console.log('no console errors');
await browser.close();
server.close();
