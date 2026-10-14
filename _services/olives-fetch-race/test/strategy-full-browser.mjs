import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {webkit} from 'playwright';
import {startWeb} from './server.mjs';import {startWorker,keys,call,root} from './harness.mjs';import {choose} from './strategy-v5-helpers.mjs';import {edge,physicalGarden} from '../../../play/olives-fetch-race/engine.mjs';
const web=await startWeb({workerPort:8931}),worker=await startWorker({port:8931,origin:web.origin,layout:'orchard-v5'}),browser=await webkit.launch({headless:true}),pages=[],contexts=[],errors=[],results=[],out=join(root,'test-results-approved');await mkdir(out,{recursive:true});
const state=async()=>(await call(worker.base)).state;
async function version(v){const deadline=Date.now()+7000;while(Date.now()<deadline){const s=await state();if(s.version===v)return s;await new Promise(r=>setTimeout(r,60));}throw Error('Version timeout '+v);}
async function sync(s){for(const p of pages){await p.evaluate(()=>dispatchEvent(new Event('online')));await p.waitForFunction(last=>document.getElementById('last').textContent.startsWith(last),s.last);}}
try{
 for(let i=0;i<2;i++){const c=await browser.newContext({viewport:{width:i?390:393,height:i?844:852},isMobile:true,hasTouch:true});contexts.push(c);await c.addInitScript(key=>{localStorage.setItem('olives-fetch-race:v1:key',key);localStorage.setItem('olives-fetch-race:v1:mute','yes');},keys[i]);const p=await c.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));await p.goto(web.origin+'/play/olives-fetch-race/');await p.locator('#game').waitFor({state:'visible'});}
 let s=await state();const policies=[['mixed','beeline'],['fleas','mixed'],['mixed','mixed']];
 for(let game=0;game<3;game++){
  const log=[];while(s.result===null){assert.ok(log.length<110);await sync(s);const p=pages[s.turn],m=choose(s,s.turn,policies[game][s.turn]);await p.locator(`[data-mode="${m.type}"]`).click();
   if(m.type==='fence')await p.locator(`[data-gap="${edge(m.a,m.b)}"]`).click();else{await p.locator(`[data-cell="${m.to}"]`).click();if(m.type==='walk-flea')await p.locator(`[data-cell="${m.trap}"]`).click();}
   assert.equal(await p.locator('#commit').isEnabled(),true);const before=s;await p.locator('#commit').click();s=await version(s.version+1);log.push({player:before.turn,action:m,version:s.version,ply:s.ply});
   if(log.length===8){await p.reload();await p.locator('#game').waitFor({state:'visible'});assert.equal((await state()).version,s.version);}
  }
  await sync(s);for(const p of pages){await p.locator('#finish-panel').waitFor({state:'visible'});assert.ok(await p.locator('.modes').isHidden());assert.equal(await p.locator('#sound').textContent(),'Sound off');}
  assert.equal(await pages[0].locator('#finish-title').textContent(),await pages[1].locator('#finish-title').textContent());await pages[0].screenshot({path:join(out,`game-${game+1}-finish.png`),fullPage:true});
  results.push({game:game+1,layout:s.layout,starter:s.starter??0,result:s.result,turns:s.ply,counts:s.turnCounts,moves:log.length,combinedActions:log.filter(v=>v.action.type==='walk-flea').length,policies:policies[game]});
  console.log(JSON.stringify(results.at(-1)));
  if(game<2){await pages[0].locator('#new-race').click();await pages[0].locator('#rematch-confirm').click();s=await version(s.version+1);await pages[1].evaluate(()=>dispatchEvent(new Event('online')));await pages[1].locator('#accept-race').waitFor({state:'visible'});await pages[1].locator('#accept-race').click();await pages[1].locator('#rematch-confirm').click();s=await version(s.version+1);await sync(s);}
 }
 assert.equal(new Set(results.map(r=>physicalGarden(r.layout))).size,3);assert.deepEqual(results.map(r=>r.starter),[0,1,0]);assert.ok(results.some(r=>r.combinedActions>0));assert.deepEqual(errors,[]);await writeFile(join(out,'three-full-ui-games.json'),JSON.stringify(results,null,2));console.log('PASS three complete mobile WebKit games: every move and rematch through actual UI, all three physical gardens, both starting orders, combined actions, reload recovery and matching finish panels.');
}finally{await browser.close();await worker.stop();await web.stop();}
