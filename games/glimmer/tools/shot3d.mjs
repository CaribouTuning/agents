// Drive the 3D game and take pictures.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((rq,rs)=>{const u=decodeURIComponent(rq.url.split('?')[0]);
 if(u==='/favicon.ico'){rs.writeHead(204);rs.end();return;}
 fs.readFile(path.join('.',u==='/'?'/index.html':u),(e,d)=>{if(e){rs.writeHead(404);rs.end('');return;}
 rs.writeHead(200,{'Content-Type':MIME[path.extname(u)]||'application/octet-stream'});rs.end(d);});});
await new Promise(r=>server.listen(0,r));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await (await b.newContext({viewport:{width:800,height:450}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'load'});
await p.waitForFunction('!!window.GLIMMER',{timeout:20000});
const wait=(ms)=>p.waitForTimeout(ms);
const st=()=>p.evaluate(()=>{const g=window.GLIMMER,h=g.hero,a=h.a;
  return {state:h.state,x:+a.x.toFixed(2),y:+a.y.toFixed(2),z:+a.z.toFixed(2),
    vy:+a.vy.toFixed(2),ground:a.onGround,verts:g.vertexCount};});
await wait(900);
console.log('spawn  ', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/w-spawn.png'});
// Run forward.
await p.keyboard.down('ArrowUp'); await wait(1100);
console.log('running', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/w-run.png'});
// Jump.
await p.keyboard.down('KeyZ'); await wait(250);
console.log('jumping', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/w-jump.png'});
// Hold through the apex to glide.
await wait(600);
console.log('gliding', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/w-glide.png'});
await p.keyboard.up('KeyZ'); await p.keyboard.up('ArrowUp');
await wait(1200);
console.log('after  ', JSON.stringify(await st()));
await p.screenshot({path:'/tmp/claude-0/w-after.png'});
console.log(errs.length?'ERRORS: '+errs.slice(0,4).join(' | '):'no page errors');
await b.close(); server.close();
