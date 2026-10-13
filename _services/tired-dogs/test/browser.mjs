import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium, webkit } from 'playwright';
import { startWorker, root, repo, keys, call, move } from './harness.mjs';
const out=join(root,'test-results'); await mkdir(out,{recursive:true});
const web=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://local').pathname;
  if(pathname==='/play/tired-dogs/config.mjs'){res.setHeader('Content-Type','text/javascript');res.end("export const API_ORIGIN = 'http://127.0.0.1:8787';");return;}
  const path=resolve(repo,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!path.startsWith(join(repo,'play/tired-dogs')+'/')){res.writeHead(404).end();return;}
  try{const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise((r,reject)=>{web.on('error',reject);web.listen(0,'127.0.0.1',r);});
const origin=`http://127.0.0.1:${web.address().port}`;
let worker;
try { worker=await startWorker({origin}); } catch(e) { web.close(); throw e; }
const cached=join(process.env.HOME,'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser=await (process.env.TEST_BROWSER === 'webkit' ? webkit.launch({headless:true}) : chromium.launch({headless:true,...(existsSync(cached)?{executablePath:cached}:{})}));
const errors=[];
try{
  const mike=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const aimee=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  for(const context of [mike,aimee])await context.addInitScript(() => {
    window.audioProbe={contexts:0,starts:0,gesture:[],gains:[]};
    const Native=window.AudioContext||window.webkitAudioContext;
    window.AudioContext=class extends Native {
      constructor(...args){super(...args);audioProbe.contexts++;audioProbe.gesture.push(navigator.userActivation.isActive);}
      createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{audioProbe.starts++;return start(...args);};return node;}
      createGain(){const node=super.createGain();audioProbe.gains.push(node);return node;}
    };
  });
  const m=await mike.newPage(),a=await aimee.newPage();
  for(const p of [m,a])p.on('pageerror',e=>errors.push(e.message));
  const url=origin+'/play/tired-dogs/';
  async function login(p,key){await p.goto(url);assert.equal(await p.locator('#sound-toggle').textContent(),'Sound on');assert.equal(await p.evaluate(()=>audioProbe.contexts),0);await p.locator('#player-key').fill(key);await p.locator('#join').click();await p.locator('#play-panel').waitFor({state:'visible'});}
  async function version(v){await m.waitForFunction(async(v)=>{const t=sessionStorage.getItem('tired-dogs:v1:key');return (await(await fetch('http://127.0.0.1:8787/state',{headers:{Authorization:`Bearer ${t}`}})).json()).state.version===v;},v);}
  async function act(p,action,dog,v){await p.locator(`[data-dog="${dog}"]`).click();await p.locator(`[data-action="${action}"]`).click();await p.waitForFunction(()=>!document.getElementById('commit').disabled);await p.locator('#commit').click();await version(v);}
  await Promise.all([login(m,keys[0]),login(a,keys[1])]);
  assert.equal(await m.evaluate(()=>audioProbe.starts),0);assert.deepEqual(await m.evaluate(()=>audioProbe.gesture),[true]);
  assert.match(await m.locator('#turn-title').textContent(),/Your turn, Mike/);
  assert.equal(await a.locator('#commit').isDisabled(),true);
  const denied=await call(worker.base,1,{...move(0),player:0});assert.equal(denied.status,409);
  // Both clicks in one event loop: only one outbound action and one committed turn.
  await m.locator('#commit').evaluate(b=>{b.click();b.click();}); await version(1);
  await m.waitForFunction(()=>audioProbe.starts===3);await m.waitForTimeout(2800);assert.equal(await m.evaluate(()=>audioProbe.starts),3);
  await act(a,'walk','Huck',2);
  let lose=true,applied=false;
  await m.route('**/move',async route=>{
    if(!lose){await route.continue();return;}
    if(!applied){await route.fetch();applied=true;}
    await route.abort('connectionfailed');
  });
  await act(m,'walk','Olive',3);
  await m.waitForFunction(()=>document.getElementById('notice').textContent.includes('kept safely'));
  assert.ok(await m.evaluate(()=>!!sessionStorage.getItem('tired-dogs:v1:pending')));
  lose=false; await m.reload(); await m.locator('#play-panel').waitFor({state:'visible'});
  await m.waitForFunction(()=>!sessionStorage.getItem('tired-dogs:v1:pending'));
  assert.equal((await call(worker.base)).state.version,3);assert.equal(await m.evaluate(()=>audioProbe.starts),0);assert.equal(await m.evaluate(()=>audioProbe.contexts),0);
  await m.unroute('**/move');
  await act(a,'cuddle','Olive',4);await act(m,'cuddle','Olive',5);await act(a,'cuddle','Huck',6);
  await act(m,'couch','Olive',7);await act(a,'couch','Huck',8);
  await m.waitForFunction(()=>document.getElementById('turn-title').textContent==='Mission accomplished.');
  await a.waitForFunction(()=>document.getElementById('turn-title').textContent==='Mission accomplished.');
  assert.equal(await a.locator('#olive-art').evaluate(el=>getComputedStyle(el).animationName),'none');
  const beforeBall=await m.evaluate(()=>audioProbe.starts);
  await m.locator('#ball').focus();await m.keyboard.press('Enter');await m.keyboard.press('Enter');
  assert.match(await m.locator('#ball-message').textContent(),/Huck/);assert.equal((await call(worker.base)).state.version,8);assert.equal(await m.evaluate(()=>audioProbe.starts),beforeBall+4);
  assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await m.screenshot({path:join(out,'mobile-sleeping.png'),fullPage:true});
  await m.setViewportSize({width:1280,height:900});await m.screenshot({path:join(out,'desktop-sleeping.png'),fullPage:true});
  await a.locator('#next-evening').click();await version(9);
  await m.waitForFunction(()=>document.getElementById('next-evening').textContent.includes('Join your partner'));
  await m.locator('#next-evening').click();await version(10);
  await a.waitForFunction(()=>document.getElementById('turn-title').textContent.includes('Your turn, Aimee'));
  // Separate phone rejoins its authoritative room, without any shared browser storage.
  await a.reload();await a.locator('#play-panel').waitFor({state:'visible'});assert.match(await a.locator('#move-label').textContent(),/EVENING 2/);
  await m.setViewportSize({width:390,height:844});await m.screenshot({path:join(out,'mobile-playing.png'),fullPage:true});
  await m.setViewportSize({width:1280,height:900});await m.screenshot({path:join(out,'desktop-playing.png'),fullPage:true});
  const outsider=await browser.newPage({viewport:{width:320,height:700}});await outsider.goto(url);assert.equal(await outsider.locator('#play-panel').isVisible(),false);assert.equal(await outsider.locator('#join-panel').isVisible(),true);
  assert.ok(await outsider.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await outsider.locator('#help').click();await outsider.locator('#help-dialog').waitFor({state:'visible'});await outsider.keyboard.press('Escape');assert.equal(await outsider.locator('#help-dialog').isVisible(),false);
  await outsider.route('**/config.mjs',route=>route.fulfill({contentType:'text/javascript',body:"export const API_ORIGIN='';"}));await outsider.reload();assert.equal(await outsider.locator('#join').isDisabled(),true);assert.match(await outsider.locator('#setup-message').textContent(),/being prepared/);
  await outsider.screenshot({path:join(out,'unconfigured-mobile.png'),fullPage:true});
  // Explicit mute persists through reload and blocks both ball and synced move audio.
  await m.locator('#sound-toggle').click();assert.equal(await m.locator('#sound-toggle').textContent(),'Sound off');
  await m.reload();await m.locator('#play-panel').waitFor({state:'visible'});assert.equal(await m.locator('#sound-toggle').getAttribute('aria-pressed'),'false');
  await m.locator('#ball').click();assert.equal(await m.evaluate(()=>audioProbe.starts),0);assert.equal(await m.evaluate(()=>audioProbe.contexts),0);
  await m.locator('#sound-toggle').click();assert.equal(await m.locator('#sound-toggle').textContent(),'Sound on');await m.locator('#ball').click();await m.waitForFunction(()=>audioProbe.starts>0);
  assert.ok(await m.evaluate(()=>audioProbe.gains[0].gain.value<=.091));
  await m.setViewportSize({width:320,height:700});assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await m.screenshot({path:join(out,'sound-mobile-'+(process.env.TEST_BROWSER||'chromium')+'.png'),fullPage:true});
  const unavailable=await browser.newContext();await unavailable.addInitScript(()=>{window.AudioContext=class {constructor(){throw Error('Audio unavailable');}};window.webkitAudioContext=undefined;});
  const quiet=await unavailable.newPage();quiet.on('pageerror',e=>errors.push(e.message));await quiet.goto(url);await quiet.locator('#ball').click();await quiet.locator('#sound-toggle').click();await quiet.locator('#sound-toggle').click();assert.match(await quiet.locator('#ball-message').textContent(),/Olive/);
  await m.locator('#leave').click();assert.equal(await m.locator('#join-panel').isVisible(),true);assert.equal(await m.evaluate(()=>sessionStorage.getItem('tired-dogs:v1:key')),null);
  assert.deepEqual(errors,[]);
  console.log('PASS: two isolated phone contexts; turn enforcement; double tap; lost-response/reload retry; win; two-person restart; rejoin; keyboard ball; reduced motion; 320/390px layouts; fail-closed setup; default-on gesture-only audio; quiet gain; persisted mute; no poll/rejoin/retry replay; silent audio failure; no browser errors.');
  console.log('Screenshots: '+out);
}finally{await browser.close();await new Promise(r=>web.close(r));await worker.stop();}
