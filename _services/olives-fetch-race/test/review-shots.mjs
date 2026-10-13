// Local-only screenshots of a meaningful fence choice and all three gardens.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { startWorker, call, move, keys, root } from "./harness.mjs";
import { startWeb } from "./server.mjs";
import {route,boardFor} from "../../../play/olives-fetch-race/engine.mjs";
const out = join(root, "test-results/crossroads-review");
await mkdir(out, {recursive:true});
const web = await startWeb({workerPort:8887});
let worker, browser;
try {
  worker = await startWorker({port:8887,origin:web.origin,layout:"meadow-crossroads-v3"});
  let s = (await call(worker.base)).state;
  for (let i=0;i<12;i++) {
    const p=s.turn,b=boardFor(s),v=s.players[p];
    const r=await call(worker.base,p,move(s.version,{type:"step",to:route(s,v.pos,b.balls[p])[1]}));
    assert.equal(r.status,200);
    s=r.state;
  }
  const cached = join(process.env.HOME,"Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
  browser = await chromium.launch({headless:true,...(existsSync(cached)?{executablePath:cached}:{})});
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.goto(web.origin+"/play/olives-fetch-race/");
  await page.locator("#key").fill(keys[0]);
  await page.locator("#join").click();
  await page.locator("#game").waitFor({state:"visible"});
  await page.locator('[data-mode="fence"]').click();
  await page.locator('[data-cell="16"]').click();
  await page.locator('[data-cell="23"]').click();
  assert.match(await page.locator("#preview").textContent(),/Detour: Mike \+0, Aimee \+8/);
  await page.screenshot({path:join(out,"shared-crossroads-mobile.png"),fullPage:true});
  await page.setViewportSize({width:1280,height:950});
  await page.screenshot({path:join(out,"shared-crossroads-desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for(const p of [0,1]) s=(await call(worker.base,p,move(s.version,{type:"step",to:24}))).state;
  await page.reload();
  await page.locator("#game").waitFor({state:"visible"});
  assert.equal(await page.locator('[data-cell="24"] .token').count(),2);
  await page.screenshot({path:join(out,"shared-courtyard-meeting.png"),fullPage:true});
  for (let i=0;i<3;i++) {
    const command = (type,proposal) => ({id:crypto.randomUUID(),kind:"rematch",version:s.version,race:s.race??0,action:{type,...(proposal?{proposal}:{})}});
    s=(await call(worker.base,0,command("request"))).state;
    s=(await call(worker.base,1,command("accept",s.rematch.id))).state;
    await page.reload();
    await page.locator("#game").waitFor({state:"visible"});
    await page.screenshot({path:join(out,`${s.layout}-mobile.png`),fullPage:true});
  }
  console.log("Review screenshots: "+out);
} finally {
  await browser?.close();
  await web.stop();
  await worker?.stop();
}
