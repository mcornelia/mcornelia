import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {startWeb} from './server.mjs';
import {root,keys} from './harness.mjs';
import {initialState} from '../../../play/olives-fetch-race/engine.mjs';
const kind=process.env.TEST_BROWSER||'chromium';
const browser=await (kind==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:join(process.env.HOME,'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')}));
const web=await startWeb(),out=join(root,'test-results-playability');await mkdir(out,{recursive:true});
try {
 for(const width of [390,320]) {
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await ctx.addInitScript(key=>localStorage.setItem('olives-fetch-race:v1:key',key),keys[0]);
  await ctx.route('**/config.mjs',r=>r.fulfill({contentType:'text/javascript',body:`export const API_ORIGIN=${JSON.stringify(web.origin)};`}));
  let state=initialState('meadow-crossroads-v4');const errors=[];
  await ctx.route('**/state',r=>r.fulfill({json:{state,player:0}}));
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(web.origin+'/play/olives-fetch-race/');await page.locator('#game').waitFor({state:'visible'});
  await page.locator('[data-mode=fence]').click();await page.locator('[data-cell="16"]').click();await page.locator('[data-cell="23"]').click();
  const metrics=await page.evaluate(()=>{
   const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
   return {board:box('.board-wrap'),modes:box('.modes'),dock:box('.action-dock'),confirm:box('#commit'),viewport:innerHeight,scroll:scrollY,width:document.documentElement.scrollWidth,inner:innerWidth};
  });
  assert.ok(metrics.width<=metrics.inner);assert.ok(metrics.modes.bottom<=metrics.board.top);assert.ok(metrics.board.bottom<=metrics.dock.top);
  assert.ok(metrics.board.top>=0 && metrics.confirm.bottom<=metrics.viewport,'Board and deliberate confirmation fit together on phone');
  assert.ok(metrics.confirm.height>=44);
  assert.match(await page.locator('#preview').textContent(),/Aimee \+4/);
  await page.screenshot({path:join(out,`${kind}-${width}-preview.png`)});
  console.log(JSON.stringify({browser:kind,width,...metrics}));
  let version=100;
  for(const [ply,result,starter] of [[44,'tie',0],[70,1,0],[74,'tie',1],[70,0,0]]) {
   state={...initialState('meadow-crossroads-v4'),ply,version:version++,starter,result,last:'Mike walked to C7.'};
   state.players.forEach((p,i)=>{p.finished=result==='tie'||result===i;p.ball=true;p.pos=p.finished?[43,47][i]:[44,46][i];});
   await page.evaluate(()=>dispatchEvent(new Event('online')));
   await page.waitForFunction(ply=>document.getElementById('turn-number').textContent===`${ply} TURNS · COMPLETE`,ply);
   assert.ok(await page.locator('#finish-panel').isVisible());assert.ok(await page.locator('.action-dock').isHidden());assert.ok(await page.locator('.modes').isHidden());
   assert.match(await page.locator('#finish-counts').textContent(),new RegExp(`${ply} turns completed`));
   assert.match(await page.locator('#finish-title').textContent(),result==='tie'?/matched/:new RegExp((result===1?'Aimee':'Mike')+' wins'));
   assert.ok(await page.locator('#new-race').isVisible());
   if(result!=='tie')assert.match(await page.locator('#player'+(1-result)).textContent(),/Return unfinished · 1 step left/);
   await page.evaluate(()=>scrollTo(0,0));
   if(width===390)await page.screenshot({path:join(out,`${kind}-finish-${ply}-${result}.png`)});
  }
  assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log(`PASS ${kind}: mobile board/action geometry, legal preview, accessible confirmation, 44/70/74 completed turns, tie and both win explanations, rematch availability.`);
}finally{await browser.close();await web.stop();}
