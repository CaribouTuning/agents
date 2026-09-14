// Drive the game with a script of held buttons and take pictures.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((rq,rs)=>{const u=decodeURIComponent(rq.url.split('?')[0]);
 if(u==='/favicon.ico'){rs.writeHead(204);rs.end();return;}
 fs.readFile(path.join('.',u==='/'?'/index.html':u),(e,d)=>{if(e){rs.writeHead(404);rs.end('');return;}
 rs.writeHead(200,{'Content-Type':MIME[path.extname(u)]||'application/octet-stream'});rs.end(d);});});
await new Promise(r=>server.listen(0,r));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:720,height:405},hasTouch:true})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
await p.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'load'});
await p.waitForFunction('!!window.GLIMMER',{timeout:20000});
const wait=(ms)=>p.waitForTimeout(ms);
const hold=async(keys,ms)=>{ for(const k of keys) await p.keyboard.down(k);
  await wait(ms); for(const k of keys) await p.keyboard.up(k); };
const st=()=>p.evaluate(()=>{const g=window.GLIMMER,h=g.hero;
  return {state:h.state, x:+h.body.x.toFixed(1), y:+h.body.y.toFixed(1),
    vx:+h.body.vx.toFixed(2), vy:+h.body.vy.toFixed(2), onGround:h.body.onGround};});
await wait(500);
console.log('spawn      ', JSON.stringify(await st()));
await hold(['ArrowRight'], 900);
console.log('after run  ', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/g-run.png'});
// A standing jump, held to full height.
await hold(['KeyZ'], 420);
console.log('at apex    ', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/g-jump.png'});
await wait(700);
console.log('landed     ', JSON.stringify(await st()));
// Run off the ledge and glide.
await p.keyboard.down('ArrowRight');
await wait(1400);
await p.keyboard.down('KeyZ');
await wait(700);
console.log('gliding    ', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/g-glide.png'});
await p.keyboard.up('KeyZ'); await p.keyboard.up('ArrowRight');
await wait(900);
console.log('after glide', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/g-after.png'});
console.log(errs.length?'ERRORS: '+errs.join(' | '):'no page errors');
await b.close(); server.close();
