// One picture per pose, zoomed, so the character can be judged.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((rq,rs)=>{const u=decodeURIComponent(rq.url.split('?')[0]);
 if(u==='/favicon.ico'){rs.writeHead(204);rs.end();return;}
 fs.readFile(path.join('.',u==='/'?'/index.html':u),(e,d)=>{if(e){rs.writeHead(404);rs.end('');return;}
 rs.writeHead(200,{'Content-Type':MIME[path.extname(u)]||'application/octet-stream'});rs.end(d);});});
await new Promise(r=>server.listen(0,r));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
// Small viewport = big logical pixels = a good look at the character.
const p=await (await b.newContext({viewport:{width:576,height:324},hasTouch:true,deviceScaleFactor:2})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'load'});
await p.waitForFunction('!!window.GLIMMER',{timeout:20000});
const wait=(ms)=>p.waitForTimeout(ms);
await p.evaluate(()=>{window.GLIMMER.showHelp=0;});
await wait(400);

// stand
await p.screenshot({path:'/tmp/claude-0/p-stand.png'});
// run
await p.keyboard.down('ArrowRight'); await wait(700);
await p.screenshot({path:'/tmp/claude-0/p-run.png'});
// jump
await p.keyboard.down('KeyZ'); await wait(180);
await p.screenshot({path:'/tmp/claude-0/p-jump.png'});
// glide: hold jump well past the apex
await wait(500);
await p.screenshot({path:'/tmp/claude-0/p-glide.png'});
const s = await p.evaluate(()=>({state:window.GLIMMER.hero.state, spin:+window.GLIMMER.hero.hairSpin.toFixed(2)}));
console.log('glide shot state:', JSON.stringify(s));
await p.keyboard.up('KeyZ'); await p.keyboard.up('ArrowRight');
await wait(600);
await p.screenshot({path:'/tmp/claude-0/p-fall.png'});
console.log(errs.length?'ERRORS '+errs.join(' | '):'no page errors');
await b.close(); server.close();
