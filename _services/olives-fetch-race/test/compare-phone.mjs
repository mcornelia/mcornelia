import {webkit} from 'playwright';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {startWeb as newWeb} from './server.mjs';
import {pathToFileURL} from 'node:url';
if(!process.env.BASELINE_REPO)throw Error('Set BASELINE_REPO to a checkout of published commit 7f0197a.');
const {startWeb:oldWeb}=await import(pathToFileURL(join(process.env.BASELINE_REPO,'_services/olives-fetch-race/test/server.mjs')));
import {initialState} from '../../../play/olives-fetch-race/engine.mjs';
import {root,keys} from './harness.mjs';
const browser=await webkit.launch({headless:true}),out=join(root,'test-results-playability');await mkdir(out,{recursive:true});
try { for(const [label,start,id] of [['before',oldWeb,'meadow-crossroads-v3'],['after',newWeb,'meadow-crossroads-v4']]) {
 const web=await start(),ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try {
  await ctx.addInitScript(k=>localStorage.setItem('olives-fetch-race:v1:key',k),keys[0]);
  await ctx.route('**/config.mjs',r=>r.fulfill({contentType:'text/javascript',body:`export const API_ORIGIN=${JSON.stringify(web.origin)};`}));
  await ctx.route('**/state',r=>r.fulfill({json:{state:initialState(id),player:0}}));
  const p=await ctx.newPage();await p.goto(web.origin+'/play/olives-fetch-race/');await p.locator('#game').waitFor({state:'visible'});
  await p.locator('[data-mode=fence]').evaluate(b=>b.click());await p.locator('[data-cell="16"]').evaluate(b=>b.click());await p.locator('[data-cell="23"]').evaluate(b=>b.click());
  await p.evaluate(()=>scrollTo(0,0));
  const metrics=await p.evaluate(()=>Object.fromEntries(['.board-wrap','.modes','#preview','#commit'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{top:r.top,bottom:r.bottom}];})));
  console.log(JSON.stringify({label,width:390,height:844,metrics}));await p.screenshot({path:join(out,`${label}-390-full.png`),fullPage:true});
 }finally{await ctx.close();await web.stop();}
 }}finally{await browser.close();}
