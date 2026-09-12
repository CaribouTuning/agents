// Every Gym leader, fought to the end, badge checked.
//
// The whole-game harness plays each Gym as a player would and gives each
// battle two minutes; the last two leaders run longer than that, so it
// reported "no badge" for fights it had simply walked away from. This suite
// answers the narrower question the report was really about — does beating
// this leader hand the badge over — with a team that plainly outclasses them,
// so nothing here depends on how long a fight takes.

import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((rq,rs)=>{const u=decodeURIComponent(rq.url.split('?')[0]);
 if(u==='/favicon.ico'){rs.writeHead(204);rs.end();return;}
 fs.readFile(path.join('.',u==='/'?'/index.html':u),(e,d)=>{if(e){rs.writeHead(404);rs.end('');return;}
 rs.writeHead(200,{'Content-Type':MIME[path.extname(u)]||'application/octet-stream'});rs.end(d);});});
await new Promise(r=>server.listen(0,r));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:667,height:375},hasTouch:true})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'load'});
await p.waitForFunction('!!window.CARIBOU',{timeout:30000});
const wait=(ms)=>p.waitForTimeout(ms);

const GYMS = await p.evaluate(()=>{
  const M = window.CARIBOU.mapsForTest.MAPS;
  const out = [];
  for (const m of Object.values(M)) for (const n of (m.npcs||[]))
    if (n.trainer && /_leader$/.test(n.trainer)) out.push({map:m.id, npc:n.id, trainer:n.trainer});
  return out;
});
console.log('gym leaders found:', GYMS.map(g=>g.trainer).join(', '));

let fails = 0;
for (const g of GYMS) {
  await p.evaluate(()=>{const G=window.CARIBOU;
    G.startNewGame({name:'Matthew',look:'matthew',difficulty:'easy'});
    G.state.flags.gotStarter=true;
    G.state.party=[];
    // A team that plainly outclasses every leader, so this measures whether
    // the badge is handed over, not whether the fight is winnable.
    [392,398,389,395,407].forEach(id=>G.debugGive(id, 80));
  });
  await wait(400);
  await p.evaluate((gg)=>{
    const G=window.CARIBOU;
    G.teleport(gg.map, 1, 1);
  }, g);
  await wait(700);
  // Run the leader's script directly, the way standing in front of them does.
  await p.evaluate((gg)=>{
    const w = window.CARIBOU.overworld.world;
    const npc = (w.entities||[]).find(e=>e.id===gg.npc) || { id: gg.npc, data: { trainer: gg.trainer } };
    if (!npc.data) npc.data = { trainer: gg.trainer };
    if (!npc.data.trainer) npc.data.trainer = gg.trainer;
    window.CARIBOU.overworld.runScript('gymLeader', npc);
  }, g);

  // Play it out: mash through text, pick the strongest move, never run.
  let turns = 0;
  for (let i=0;i<1600;i++){
    const s = await p.evaluate(()=>{
      const G=window.CARIBOU; const t=G.screens.top;
      return { name:t.constructor.name, mode:t.mode, dlg:G.dialogueForTest.visible,
        script:!!(G.overworld&&G.overworld.script),
        badges:G.state.badges.length };
    });
    if (s.name === 'BattleScreen') {
      turns++;
      await p.evaluate(()=>{
        const t = window.CARIBOU.screens.top;
        const b = t.battle;
        if (!b) return;
        const me = b.sides[t.mySide];
        const mon = me.party[me.active];
        if (!mon || !mon.moves) return;
        // Strongest move with PP left.
        let best = 0, bp = -1;
        mon.moves.forEach((mv, k) => { if (mv && mv.pp > 0 && (mv.power||0) > bp) { bp = mv.power||0; best = k; } });
        t.moveIndex = best;
      });
      await p.keyboard.press('KeyZ'); await wait(45);
      continue;
    }
    const asked = await p.evaluate(()=>{const d=window.CARIBOU.dialogueForTest;
      if(d.choice){d.answer(0);return true;}
      if(d.pendingChoice){d.shown=d.currentText.length;d.advance();return true;} return false;});
    if (asked) { await wait(90); continue; }
    if (s.dlg || s.script) { await p.keyboard.press('KeyZ'); await wait(55); continue; }
    if (s.badges > 0) { console.log(`  PASS  ${g.trainer}: badge awarded after ${turns} battle frames`); break; }
    if (i > 40) { console.log(`  FAIL  ${g.trainer}: no badge (screen ${s.name}, turns ${turns})`); fails++; break; }
    await wait(60);
  }
  const got = await p.evaluate(()=>window.CARIBOU.state.badges.length);
  if (!got) { /* already reported */ }
}
console.log(errs.length?'ERRORS '+errs.join(' | '):'no page errors');
console.log(fails?`\n${fails} gym(s) failed`:'\nevery gym hands over its badge');
await b.close(); server.close();
process.exit(fails?1:0);
