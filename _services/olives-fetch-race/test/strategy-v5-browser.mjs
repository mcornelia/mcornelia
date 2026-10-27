import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';import {join} from 'node:path';import {webkit,chromium} from 'playwright';
import {startWeb} from './server.mjs';import {startWorker,keys,call,move,root} from './harness.mjs';
import {legalMoves,edge,distance,applyMove} from '../../../play/olives-fetch-race/engine.mjs';import {travel} from './strategy-v5-helpers.mjs';
const web=await startWeb({workerPort:8923}),worker=await startWorker({port:8923,origin:web.origin,layout:'orchard-v5'}),kind=process.env.TEST_BROWSER||'webkit';
const browser=await(kind==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:join(process.env.HOME,'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')}));
const errors=[],contexts=[],pages=[],out=join(root,'test-results-strategy');await mkdir(out,{recursive:true});
try{
 for(const p of [0,1]){const c=await browser.newContext({viewport:{width:p?390:393,height:p?844:852},isMobile:true,hasTouch:true});contexts.push(c);await c.addInitScript(k=>{localStorage.setItem('olives-fetch-race:v1:key',k);localStorage.setItem('olives-fetch-race:v1:mute','yes');localStorage.setItem('tired-dogs:v1:sentinel','unchanged');},keys[p]);const page=await c.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));await page.goto(web.origin+'/play/olives-fetch-race/');await page.locator('#game').waitFor({state:'visible'});}
 const [m,a]=pages;const state=async()=>(await call(worker.base)).state;
 async function sync(){for(const p of pages)await p.evaluate(()=>dispatchEvent(new Event('online')));await new Promise(r=>setTimeout(r,100));}
 async function version(v){const end=Date.now()+5000;while(Date.now()<end){if((await state()).version===v)return;await new Promise(r=>setTimeout(r,50));}throw Error('Version '+v+' not reached');}
 assert.match(await m.locator('#player0').textContent(),/2 flea traps/);assert.equal(await m.locator('#sound').textContent(),'Sound off');
 await m.locator('[data-mode=flea]').click();await m.locator('[data-cell="36"]').click();assert.match(await m.locator('#notice').textContent(),/safe/);assert.equal(await m.locator('#commit').isDisabled(),true);
 await m.locator('[data-mode="walk-flea"]').click();
 await m.locator('[data-cell="30"]').click();assert.match(await m.locator('#preview').textContent(),/neighboring/);
 await m.locator('[data-cell="37"]').click();assert.equal(await m.locator('#commit').isDisabled(),true);assert.match(await m.locator('#preview').textContent(),/Nothing has been saved/);
 await m.locator('#change-walk').click();assert.equal(await m.locator('#change-walk').isHidden(),true);await m.locator('[data-cell="37"]').click();
 await m.locator('[data-cell="37"]').click();assert.match(await m.locator('#preview').textContent(),/unoccupied/);
 await m.locator('[data-cell="33"]').click();assert.match(await m.locator('#preview').textContent(),/Walk to C6 \+ first flea at F5.*One turn total/);assert.equal((await state()).version,0);
 await m.screenshot({path:join(out,kind+'-combined-preview.png'),fullPage:true});
 let writes=0;m.on('request',r=>{if(r.url().endsWith('/move'))writes++;});await m.locator('#commit').evaluate(b=>{b.click();b.click();});await version(1);assert.equal(writes,1);await sync();await a.locator('.flea-marker').waitFor();await a.screenshot({path:join(out,kind+'-visible-flea.png'),fullPage:true});assert.equal((await state()).players[0].fleas,1);assert.equal((await state()).players[0].pos,37);assert.equal((await state()).ply,1);await m.locator('[data-mode="walk-flea"]:disabled').waitFor();
 await a.locator('[data-cell="33"]').click();assert.match(await a.locator('#preview').textContent(),/Flea bite/);await a.locator('#commit').click();await version(2);await sync();assert.equal((await state()).players[1].scratching,true);assert.equal((await state()).traps.length,0);
 // Lose the response that also resolves a scratch; a reload retry must not skip twice.
 let dropped=false;await m.route('**/move',async r=>{if(!dropped){dropped=true;await r.fetch();}await r.abort();});
 const next=travel(await state(),0).move;await m.locator(`[data-mode=${next.type}]`).click();await m.locator(`[data-cell="${next.to}"]`).click();await m.locator('#commit').click();await version(3);await m.waitForFunction(()=>document.getElementById('notice').textContent.includes('kept safely'));
 const skipped=await state();assert.equal(skipped.turn,0);assert.deepEqual(skipped.turnCounts,[2,2]);assert.equal(skipped.ply,4);assert.match(skipped.last,/Aimee spends this turn scratching/);
 await m.unroute('**/move');await m.reload();await m.locator('#game').waitFor({state:'visible'});await m.waitForFunction(()=>!localStorage.getItem('olives-fetch-race:v1:pending'));assert.deepEqual(await state(),skipped);assert.equal(await m.locator('#sound').textContent(),'Sound off');
 assert.equal((await call(worker.base,1,move(skipped.version))).status,409);
 await m.locator('[data-mode=fence]').click();await m.locator('[data-gap="16-23"]').click();assert.match(await m.locator('#preview').textContent(),/already a fence/);assert.equal(await m.locator('#commit').isDisabled(),true);
 await m.locator('[data-cell="36"]').click();await m.locator('[data-side="North"]').click();assert.match(await m.locator('#preview').textContent(),/neighboring lawn/);
 assert.ok((await m.locator('.fence-side').evaluateAll(bs=>bs.map(b=>b.getBoundingClientRect().height))).every(h=>h>=44));
 const fence=legalMoves(skipped,0,'fence').find(f=>distance(applyMove(skipped,0,f),1)>distance(skipped,1))??legalMoves(skipped,0,'fence')[0];
 await m.locator('[data-mode=fence]').click();const gap=m.locator(`[data-gap="${edge(fence.a,fence.b)}"]`);const box=await gap.boundingBox();assert.equal(box.width,44);assert.equal(box.height,44);await gap.click();assert.match(await m.locator('#preview').textContent(),/Detour/);assert.equal((await state()).version,3);
 await m.screenshot({path:join(out,kind+'-fence-preview.png'),fullPage:true});await m.locator('#commit').click();await version(4);await sync();
 await contexts[1].setOffline(true);await a.waitForFunction(()=>document.getElementById('connection').textContent.includes('OFFLINE'));assert.equal(await a.locator('#commit').isDisabled(),true);await contexts[1].setOffline(false);await a.reload();await a.locator('#game').waitFor({state:'visible'});assert.equal((await state()).version,4);
 for(const page of pages){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>localStorage.getItem('tired-dogs:v1:sentinel')),'unchanged');assert.equal(await page.locator('#sound').textContent(),'Sound off');}
 assert.deepEqual(errors,[]);console.log('PASS '+kind+': two-player trap landing/one skip, double click, lost-response/reload idempotence, wrong turn, gap targets, square-to-side help, invalid reasons, reconnect, remembered mute and isolation. Includes first-flea walk selection, change-walk, invalid placement, atomic double click and remaining-trap count.');
}finally{await browser.close();await worker.stop();await web.stop();}
