import assert from 'node:assert/strict';
import {webkit} from 'playwright';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {startWeb} from './server.mjs';
import {root,keys} from './harness.mjs';
import {initialState} from '../../../play/olives-fetch-race/engine.mjs';
const web=await startWeb(),browser=await webkit.launch({headless:true});
const out=join(root,'test-results-readability');await mkdir(out,{recursive:true});
try {for(const width of [393,390]) {
 const ctx=await browser.newContext({viewport:{width,height:width===393?852:844},isMobile:true,hasTouch:true});
 await ctx.addInitScript(k=>localStorage.setItem('olives-fetch-race:v1:key',k),keys[0]);
 await ctx.route('**/config.mjs',r=>r.fulfill({contentType:'text/javascript',body:`export const API_ORIGIN=${JSON.stringify(web.origin)};`}));
 await ctx.route('**/state',r=>r.fulfill({json:{player:0,state:initialState('meadow-crossroads-v4')}}));
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(web.origin+'/play/olives-fetch-race/');await p.locator('#game').waitFor({state:'visible'});
 await p.locator('[data-mode=fence]').click();await p.locator('[data-cell="16"]').click();await p.locator('[data-cell="23"]').click();
 for(const scale of [1,2]) {
  await p.evaluate(size=>document.documentElement.style.setProperty("font-size",size+"px","important"),16*scale);
  const m=await p.evaluate(()=>{
   const fs=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
   const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
   return {viewport:innerWidth,page:document.documentElement.scrollWidth,hint:fs('#hint'),preview:fs('#preview'),status:fs('#connection'),action:fs('[data-mode=step]'),coord:fs('.coord'),commit:rect('#commit'),board:rect('.board-wrap'),dock:rect('.action-dock'),cells:[...document.querySelectorAll('.cell')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}),scrollableBoard:document.querySelector('.board-scroll').scrollWidth>document.querySelector('.board-scroll').clientWidth};
  });
  assert.ok(m.page<=m.viewport,'Text and controls reflow without horizontal page overflow');
  assert.ok(m.hint>=16*scale&&m.preview>=16*scale&&m.action>=16*scale&&m.status>=14*scale&&m.coord>=10*scale);
  assert.ok(m.commit.height>=44);assert.ok(m.cells.every(c=>c.width>=43.5&&c.height>=43.5),'Board hit targets do not shrink or overlap');
  assert.ok(m.dock.y>=m.board.bottom,'Decision strip does not cover the board');
  for(let i=0;i<m.cells.length;i++)for(let j=i+1;j<m.cells.length;j++){const a=m.cells[i],b=m.cells[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'Board targets never overlap');}
  for(const selector of ['#hint','#preview','#connection','.modes button'])assert.ok(await p.locator(selector).first().evaluate(el=>el.scrollHeight<=el.clientHeight+1),'Text is not vertically clipped');
  await p.locator('#commit').scrollIntoViewIfNeeded();assert.ok(await p.locator('#commit').isVisible());
  if(scale===2) {assert.equal(m.scrollableBoard,true);await p.locator('.board-scroll').evaluate(el=>el.scrollLeft=el.scrollWidth);assert.ok(await p.locator('.board-scroll').evaluate(el=>el.scrollLeft>0));}
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:join(out,`webkit-${width}-${scale}x.png`),fullPage:true});
  console.log(JSON.stringify({width,scale,hint:m.hint,preview:m.preview,status:m.status,action:m.action,coordinate:m.coord,minCell:Math.min(...m.cells.map(c=>c.width)),pageOverflow:m.page>m.viewport,boardPans:m.scrollableBoard}));
 }
 // Explicit safe-area values exercise the same CSS variables supplied by env() on-device.
 await p.evaluate(()=>{for(const [side,value] of Object.entries({top:47,right:12,bottom:34,left:12}))document.documentElement.style.setProperty('--safe-'+side,value+'px');});
 const safe=await p.locator('main').evaluate(el=>{const s=getComputedStyle(el);return {top:parseFloat(s.paddingTop),bottom:parseFloat(s.paddingBottom),left:parseFloat(s.paddingLeft),right:parseFloat(s.paddingRight)};});
 assert.ok(safe.top>=47&&safe.bottom>=34&&safe.left>=12&&safe.right>=12);
 // Reduced visual viewport models the space left above a phone keyboard. No fixed overlays.
 await p.locator('#access-open').click();await p.setViewportSize({width,height:380});
 await p.locator('#access-new').focus();await p.locator('#access-new').scrollIntoViewIfNeeded();assert.ok(await p.locator('#access-new').isVisible());
 await p.locator('#access-save').scrollIntoViewIfNeeded();
 const keyboard=await p.locator('#access-save').boundingBox();assert.ok(keyboard.y>=0&&keyboard.y+keyboard.height<=380);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const dialog=await p.locator('#access-dialog').boundingBox();assert.ok(dialog.y>=47&&dialog.y+dialog.height<=380-34,'Dialog remains inside simulated notch and home-indicator safe areas');
 await p.locator('#access-close').click();assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log('PASS WebKit: 393x852 / 390x844, readable text, 200% text enlargement, contained board panning, no clipping/overlap, and reduced keyboard viewport.');
}finally{await browser.close();await web.stop();}
