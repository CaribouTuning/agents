import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const out = process.argv[3];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
const cols = Number(process.argv[4] || 4);
const cw = 400, chh = 200;
const rows = Math.ceil(files.length / cols);
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:2px">` +
 files.map(f => `<div style="position:relative"><img src="data:image/png;base64,${fs.readFileSync(path.join(dir,f)).toString('base64')}" style="width:${cw}px;height:${chh}px;image-rendering:pixelated;display:block"><div style="position:absolute;left:2px;top:2px;color:#0f0;font:11px monospace;background:#000a;padding:1px 3px">${f.replace('.png','')}</div></div>`).join('') + '</body>';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:cols*cw+cols*2,height:rows*chh+rows*2}});
await p.setContent(html);
await p.screenshot({path:out,fullPage:true});
await b.close();
console.log('sheet:',out, files.length,'images');
