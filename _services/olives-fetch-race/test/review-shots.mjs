// Local-only screenshots of a meaningful fence choice and all three gardens.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { startWorker, call, move, keys, root } from "./harness.mjs";
import { startWeb } from "./server.mjs";
const out = join(root, "test-results/crossing-review");
await mkdir(out, {recursive:true});
const web = await startWeb({workerPort:8887});
let worker, browser;
try {
  worker = await startWorker({port:8887,origin:web.origin,layout:"crossing-v2"});
  let s = (await call(worker.base)).state;
  for (const [p,action] of [[0,{type:"step",to:36}],[1,{type:"step",to:40}],[0,{type:"step",to:37}],[1,{type:"sprint",to:38}]]) {
    const r = await call(worker.base,p,move(s.version,action));
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
  await page.locator('[data-cell="37"]').click();
  await page.locator('[data-cell="38"]').click();
  assert.match(await page.locator("#preview").textContent(),/Detour: Mike \+2, Aimee \+4/);
  await page.screenshot({path:join(out,"crossing-garden-mobile.png"),fullPage:true});
  await page.setViewportSize({width:1280,height:950});
  await page.screenshot({path:join(out,"crossing-garden-desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for (const name of ["north-bend","south-bend"]) {
    const command = (type,proposal) => ({id:crypto.randomUUID(),kind:"rematch",version:s.version,race:s.race??0,action:{type,...(proposal?{proposal}:{})}});
    s=(await call(worker.base,0,command("request"))).state;
    s=(await call(worker.base,1,command("accept",s.rematch.id))).state;
    await page.reload();
    await page.locator("#game").waitFor({state:"visible"});
    await page.screenshot({path:join(out,`${name}-mobile.png`),fullPage:true});
  }
  console.log("Review screenshots: "+out);
} finally {
  await browser?.close();
  await web.stop();
  await worker?.stop();
}
