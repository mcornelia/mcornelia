import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {startWorker,keys,root,call,move} from './harness.mjs';
import {startWeb} from './server.mjs';
import {initialState} from '../../../play/olives-fetch-race/engine.mjs';
const kind=process.env.TEST_BROWSER||'chromium';
const browser=await (kind==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:join(process.env.HOME,'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')}));
const web=await startWeb({workerPort:8901});
const url=web.origin+'/play/olives-fetch-race/';
const errors=[];let worker;
const context=async(mock=true)=>{const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});if(mock)await c.route('**/config.mjs',r=>r.fulfill({contentType:'text/javascript',body:`export const API_ORIGIN=${JSON.stringify(web.origin)};`}));return c;};
const enter=async(p,value)=>p.evaluate(v=>{document.getElementById('key').value=v;},value);
const ready=async p=>p.waitForFunction(()=>document.documentElement.dataset.fetchReady==='yes');
const saved='olives-fetch-race:v1:';
try {
  // Old storage, corrupt pending state, and a delayed old auto-login response.
  const c=await context();
  await c.addInitScript(({key,ns})=>{localStorage.setItem(ns+'key',key);localStorage.setItem(ns+'pending','{');localStorage.setItem('tired-dogs:v1:sentinel','unchanged');AbortSignal.timeout=undefined;},{key:keys[1],ns:saved});
  const p=await c.newPage();p.on('pageerror',()=>errors.push('page error'));
  let release;const gate=new Promise(r=>release=r);setTimeout(()=>release(),1500);let count=0;
  await p.route('**/state',async route=>{count++;if(count===1){await gate;await route.fulfill({json:{state:initialState("south-crossroads-v3"),player:1}}).catch(()=>{});}else await route.fulfill({json:{state:initialState("south-crossroads-v3"),player:0}});});
  await p.goto(url);await ready(p);
  await enter(p,keys[0]);await p.locator('#join').click();
  await p.locator('#game').waitFor({state:'visible'});release();
  await p.waitForTimeout(100);
  assert.match(await p.locator('#connection').textContent(),/SIGNED IN AS MIKE/);
  assert.equal(await p.evaluate(()=>localStorage.getItem('tired-dogs:v1:sentinel')),'unchanged');
  assert.equal(await p.locator('#key').inputValue(),'');
  await c.close();
  console.log(kind+': reused session, corrupt pending storage, stale response and missing AbortSignal.timeout passed');

  // Persistent errors and entry preservation across interrupted/repeated submissions.
  const c2=await context(),p2=await c2.newPage();p2.on('pageerror',()=>errors.push('page error'));
  let mode='offline',requests=0;
  await p2.route('**/state',async route=>{requests++;if(mode==='offline')return route.abort();if(mode==='json')return route.fulfill({body:'<html>bad response</html>',contentType:'text/html'});if(mode==='success')return route.fulfill({json:{state:initialState("south-crossroads-v3"),player:0}});return route.fulfill({status:Number(mode),json:{error:mode==='426'?'Refresh this page to open the new garden.':'That key was not recognized. Check it and try again.'}});});
  await p2.goto(url);await ready(p2);
  assert.equal(await p2.locator('#key').getAttribute('type'),'text');
  await mkdir(join(root,'test-results-access'),{recursive:true});
  await p2.screenshot({path:join(root,'test-results-access',kind+'-visible-login.png'),fullPage:true});
  await enter(p2,keys[0]);
  for(const failure of ['offline','401','426','json']) {
    mode=failure;await p2.locator('#key').press('Enter');
    await p2.waitForFunction(()=>document.getElementById('join').textContent==='Enter garden');
    assert.ok(await p2.evaluate(v=>document.getElementById('key').value===v,keys[0]),'Failed entry was retained');
    assert.match(await p2.locator('#setup').textContent(),failure==='426'?/Refresh this page/:failure==='json'?/unreadable/:failure==='401'?/not recognized/:/connect/);
  }
  const requestCount=requests;
  await p2.waitForTimeout(4200);assert.equal(requests,requestCount,'Failed login is not automatically retried or cleared');
  mode='success';await p2.evaluate(()=>{document.getElementById('join-form').requestSubmit();document.getElementById('join-form').requestSubmit();});
  await p2.locator('#game').waitFor({state:'visible'});assert.equal(requests,requestCount+1);
  await p2.locator('#access-open').click();
  await p2.screenshot({path:join(root,'test-results-access',kind+'-phrase-settings-blank.png'),fullPage:false});
  assert.ok(await p2.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p2.locator('#access-close').click();
  mode='426';await p2.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await p2.waitForFunction(()=>document.getElementById('connection').textContent==='REFRESH THIS PAGE');
  mode='401';await p2.evaluate(()=>dispatchEvent(new Event('online')));await p2.locator('#join-panel').waitFor({state:'visible'});
  assert.match(await p2.locator('#setup').textContent(),/not recognized/);
  await c2.close();console.log(kind+': offline, 401, 426, malformed response, double-submit, mobile return and screenshots passed');

  const denied=await context();
  await denied.addInitScript(()=>{for(const name of ['getItem','setItem','removeItem'])Storage.prototype[name]=()=>{throw new DOMException('Storage denied','SecurityError');};});
  const pd=await denied.newPage();pd.on('pageerror',()=>errors.push('page error'));
  await pd.route('**/state',r=>r.fulfill({json:{state:initialState("south-crossroads-v3"),player:0}}));await pd.goto(url);await ready(pd);await enter(pd,keys[0]);await pd.locator('#join').click();await pd.locator('#game').waitFor({state:'visible'});
  assert.match(await pd.locator('#notice').textContent(),/cannot remember/);await denied.close();
  const broken=await context(),pb=await broken.newPage();await pb.route('**/app.mjs*',r=>r.abort());await pb.goto(url);await enter(pb,keys[0]);await pb.locator('#join').click();assert.ok(await pb.evaluate(v=>document.getElementById('key').value===v,keys[0]));assert.match(await pb.locator('#setup').textContent(),/still loading/);assert.equal(pb.url(),url);await broken.close();
  console.log(kind+': denied storage and failed module leave clear visible feedback passed');

  // Real local Worker, owner-submitted phrase, lost reply, preserved state and other identity.
  worker=await startWorker({port:8901,origin:web.origin});
  const before=(await call(worker.base,0,move(0))).state;
  const live=await context(false),pl=await live.newPage();pl.on('pageerror',()=>errors.push('page error'));
  await pl.goto(url);await ready(pl);await enter(pl,keys[0]);await pl.locator('#join').click();await pl.locator('#game').waitFor({state:'visible'});
  assert.match(await pl.locator('#hint').textContent(),/signed in as Mike/i);
  await pl.locator('#access-open').click();
  // Test-only phrases created inside the browser; never printed or photographed.
  await pl.evaluate(k=>{const fresh=()=>Array.from({length:3},()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>String.fromCharCode(97+n%26)).join('')).join('-')+'27!';window.testPhrase=fresh();document.getElementById('access-current').value=k;document.getElementById('access-new').value=testPhrase;document.getElementById('access-confirm').value=fresh();},keys[0]);
  await pl.locator('#access-save').click();assert.match(await pl.locator('#access-confirm-error').textContent(),/do not match/);
  // All feedback uses dummy entries; malformed phrases never reach /access.
  let invalidWrites=0;const countInvalid=r=>{if(r.url().endsWith('/access'))invalidWrites++;};pl.on('request',countInvalid);
  await pl.setViewportSize({width:393,height:380});
  for(const [current,phrase,confirm,field] of [
    ['', 'first-second-third7!', 'first-second-third7!', 'current'],
    [keys[0], '', '', 'new'],
    ...['onecontinuousword7!', 'first second third7!', 'first-second-third!', 'first-second-third7', 'first-second-third-fourth7!', 'first-second-third-fourth-fifth-sixth'].map(v=>[keys[0],v,v,'new']),
    [keys[0], 'first-second-third7!', 'first-second-other7!', 'confirm'],
  ]) {
    await pl.evaluate(([a,b,c])=>{document.getElementById('access-current').value=a;document.getElementById('access-new').value=b;document.getElementById('access-confirm').value=c;},[current,phrase,confirm]);
    await pl.locator('#access-save').click();
    assert.equal(await pl.evaluate(()=>document.activeElement.id),'access-'+field);
    assert.equal(await pl.locator('#access-'+field).getAttribute('aria-invalid'),'true');
    assert.ok(await pl.locator('#access-'+field+'-error').isVisible());
    const box=await pl.locator('#access-'+field+'-error').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=380,'Inline error scrolls into the keyboard-sized viewport');
    assert.deepEqual(await pl.evaluate(()=>['current','new','confirm'].map(n=>document.getElementById('access-'+n).value)),[current,phrase,confirm]);
    assert.match(await pl.locator('#access-status').textContent(),/Nothing changed/);
  }
  assert.equal(invalidWrites,0);pl.off('request',countInvalid);
  assert.deepEqual((await call(worker.base,1)).state,before);
  await pl.evaluate(k=>{document.getElementById('access-current').value=k;document.getElementById('access-new').value=testPhrase;document.getElementById('access-confirm').value=testPhrase;},keys[1]);
  await pl.locator('#access-save').click();
  await pl.waitForFunction(()=>document.getElementById('access-status').textContent.includes('does not match'));
  assert.equal(await pl.evaluate(()=>document.activeElement.id),'access-status');
  assert.ok(await pl.evaluate(k=>document.getElementById('access-current').value===k&&document.getElementById('access-new').value===testPhrase,keys[1]));
  assert.deepEqual((await call(worker.base,1)).state,before);
  await pl.setViewportSize({width:393,height:852});
  await pl.evaluate(k=>{document.getElementById('access-current').value=k;document.getElementById('access-new').value=testPhrase;document.getElementById('access-confirm').value=testPhrase;},keys[0]);
  let writes=0;
  await pl.route('**/access',async route=>{writes++;await route.fetch();await route.abort();});
  await pl.evaluate(()=>{document.getElementById('access-form').requestSubmit();document.getElementById('access-form').requestSubmit();});
  await pl.waitForFunction(()=>document.getElementById('access-status').textContent.startsWith('Saved.'));
  assert.equal(writes,1);
  assert.equal((await call(worker.base,0)).status,401);
  assert.deepEqual((await call(worker.base,1)).state,before);
  await pl.locator('#access-close').click();await pl.reload();await pl.locator('#game').waitFor({state:'visible'});
  assert.match(await pl.locator('#connection').textContent(),/SIGNED IN AS MIKE/);
  assert.deepEqual((await call(worker.base,1)).state,before);
  await live.close();assert.equal(errors.length,0);
  console.log(kind+': invalid-format focus/inline feedback, retained fields, no invalid writes, three-word self-service confirmation, double-submit, lost-response recovery, reload, identity and exact race preservation passed');
} finally {await worker?.stop();await web.stop();await browser.close();}
