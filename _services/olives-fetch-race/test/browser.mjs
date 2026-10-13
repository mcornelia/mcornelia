import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { startWorker, root, keys, call, move } from "./harness.mjs";
import { startWeb } from "./server.mjs";
import {
  route,
  HOMES,
  BALLS,
  legalMoves,
} from "../../../play/olives-fetch-race/engine.mjs";
const out = join(root, process.env.TEST_OUTPUT || "test-results");
await mkdir(out, { recursive: true });
const web = await startWeb();
let worker, browser;
const errors = [];
try {
  worker = await startWorker({ port: 8887, origin: web.origin });
  const cached = join(
    process.env.HOME,
    "Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  );
  browser = await (process.env.TEST_BROWSER === "webkit"
    ? webkit.launch({ headless: true })
    : chromium.launch({
        headless: true,
        ...(existsSync(cached) ? { executablePath: cached } : {}),
      }));
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      }),
    ),
  );
  for (const c of contexts)
    await c.addInitScript(() => {
      localStorage.setItem("tired-dogs:v1:sentinel", "unchanged");
      window.audioProbe = { contexts: 0, starts: 0, gesture: [] };
      const Native = window.AudioContext || window.webkitAudioContext;
      window.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          audioProbe.contexts++;
          audioProbe.gesture.push(navigator.userActivation.isActive);
        }
        createOscillator() {
          const o = super.createOscillator(),
            start = o.start.bind(o);
          o.start = (...args) => {
            audioProbe.starts++;
            return start(...args);
          };
          return o;
        }
      };
    });
  const [m, a] = await Promise.all(contexts.map((c) => c.newPage()));
  for (const p of [m, a]) p.on("pageerror", (e) => errors.push(e.message));
  const url = web.origin + "/play/olives-fetch-race/";
  async function login(p, i) {
    await p.goto(url);
    assert.equal(await p.evaluate(() => audioProbe.contexts), 0);
    await p.locator("#key").fill(keys[i]);
    await p.locator("#join").click();
    await p.locator("#game").waitFor({ state: "visible" });
    assert.equal(await p.locator("#sound").textContent(), "Sound on");
    assert.deepEqual(await p.evaluate(() => audioProbe.gesture), [true]);
    await p.waitForFunction(() => audioProbe.starts > 0);
  }
  async function version(v) {
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      if ((await call(worker.base)).state.version === v) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Version did not reach " + v);
  }
  async function turn(p, name) {
    await p.waitForFunction(
      (name) =>
        document.getElementById("turn-title").textContent ===
        `Your turn, ${name}.`,
      name,
    );
  }
  async function act(p, type, to, v) {
    await p.locator(`[data-mode="${type}"]`).click();
    await p.locator(`[data-cell="${to}"]`).click();
    await p.locator("#commit").click();
    await version(v);
  }
  await Promise.all([login(m, 0), login(a, 1)]);
  assert.equal(await a.locator("#commit").isDisabled(), true);
  assert.equal(
    (await call(worker.base, 1, move(0, { type: "step", to: 39 }))).status,
    409,
  );
  let releasePoll,
    pollReady,
    pollDone,
    staleHeld = false;
  const pollGate = new Promise((r) => (releasePoll = r)),
    pollStarted = new Promise((r) => (pollReady = r)),
    pollFinished = new Promise((r) => (pollDone = r));
  await m.route("**/state", async (r) => {
    if (staleHeld) return r.continue();
    staleHeld = true;
    const response = await r.fetch();
    pollReady();
    await pollGate;
    await r.fulfill({ response });
    pollDone();
  });
  await m.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await pollStarted;
  await m.locator('[data-cell="37"]').click();
  assert.match(await m.locator("#preview").textContent(), /Mike/);
  let requests = 0;
  m.on("request", (r) => {
    if (r.url().endsWith("/move")) requests++;
  });
  await m.locator("#commit").evaluate((b) => {
    b.click();
    b.click();
  });
  await version(1);
  assert.equal(requests, 1);
  releasePoll();
  await pollFinished;
  await m.unroute("**/state");
  await m.waitForFunction(
    () => document.getElementById("turn-number").textContent === "TURN 2",
  );
  assert.match(await m.locator("#turn-title").textContent(), /Aimee/);
  assert.ok(await m.evaluate(() => audioProbe.starts > 0));
  await turn(a, "Aimee");
  await act(a, "step", 39, 2);
  await turn(m, "Mike");
  // Fence preview is a real choice, with no server mutation until confirmed.
  await m.locator('[data-mode="fence"]').click();
  await m.locator('[data-cell="4"]').click();
  await m.locator('[data-cell="5"]').click();
  assert.match(await m.locator("#preview").textContent(), /Detour/);
  assert.equal((await call(worker.base)).state.version, 2);
  const sizes = await m
    .locator(".cell")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  assert.ok(Math.max(...sizes) - Math.min(...sizes) < 1);
  await m.screenshot({
    path: join(out, "mobile-fence-preview.png"),
    fullPage: true,
  });
  await m.setViewportSize({ width: 1280, height: 950 });
  await m.screenshot({
    path: join(out, "desktop-fence-preview.png"),
    fullPage: true,
  });
  await m.setViewportSize({ width: 390, height: 844 });
  await m.locator("#commit").click();
  await version(3);
  await turn(a, "Aimee");
  await act(a, "step", 40, 4);
  await turn(m, "Mike");
  // Server saves, response disappears. Reload replays the exact request once.
  let lose = true,
    applied = false;
  await m.route("**/move", async (r) => {
    if (!lose) return r.continue();
    if (!applied) {
      await r.fetch();
      applied = true;
    }
    await r.abort("connectionfailed");
  });
  await act(m, "step", 36, 5);
  await m.waitForFunction(() =>
    document.getElementById("notice").textContent.includes("kept safely"),
  );
  assert.ok(
    await m.evaluate(() =>
      localStorage.getItem("olives-fetch-race:v1:pending"),
    ),
  );
  lose = false;
  await m.reload();
  await m.locator("#game").waitFor({ state: "visible" });
  await m.waitForFunction(
    () => !localStorage.getItem("olives-fetch-race:v1:pending"),
  );
  assert.equal((await call(worker.base)).state.version, 5);
  assert.equal(await m.evaluate(() => audioProbe.starts), 0);
  await m.unroute("**/move");
  // Offline planning cannot commit, reconnect restores turn/state.
  await contexts[1].setOffline(true);
  await a.waitForFunction(() =>
    document.getElementById("connection").textContent.includes("OFFLINE"),
  );
  assert.equal(await a.locator("#commit").isDisabled(), true);
  await contexts[1].setOffline(false);
  await turn(a, "Aimee");
  await a.waitForFunction(() =>
    document.getElementById("connection").textContent.includes("SAVED"),
  );
  const before = (await call(worker.base)).state.version;
  await m.locator("#ball").focus();
  await m.keyboard.press("Enter");
  assert.match(await m.locator("#ball-message").textContent(), /Olive|dog/);
  assert.equal((await call(worker.base)).state.version, before);
  await m.locator("#sound").click();
  assert.equal(await m.locator("#sound").textContent(), "Sound off");
  await m.reload();
  await m.locator("#game").waitFor({ state: "visible" });
  await m.locator("#ball").click();
  assert.equal(await m.evaluate(() => audioProbe.starts), 0);
  assert.equal(await m.locator("#sound").textContent(), "Sound off");
  await m.locator("#sound").click();
  await m.locator("#ball").click();
  assert.ok(await m.evaluate(() => audioProbe.starts > 0));
  for (const p of [m, a]) {
    assert.equal(
      await p.evaluate(() => localStorage.getItem("tired-dogs:v1:sentinel")),
      "unchanged",
    );
    await p.setViewportSize({ width: 320, height: 700 });
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await a.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await a
      .locator(".token")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await m.locator("#rules").click();
  assert.equal(await m.locator("#rules-dialog").isVisible(), true);
  await m.keyboard.press("Escape");
  // Finish through authoritative API, both phones observe the same result.
  let s = (await call(worker.base)).state;
  for (let i = 0; i < 100 && s.result === null; i++) {
    const p = s.turn,
      v = s.players[p],
      path = route(s, v.pos, v.ball ? HOMES[p] : BALLS[p]);
    const r = await call(
      worker.base,
      p,
      move(s.version, { type: "step", to: path[1] }),
    );
    assert.equal(r.status, 200);
    s = r.state;
  }
  assert.notEqual(s.result, null);
  await m.waitForFunction(() =>
    /wins|matched/.test(document.getElementById("turn-title").textContent),
  );
  await a.waitForFunction(() =>
    /wins|matched/.test(document.getElementById("turn-title").textContent),
  );
  assert.equal(
    await m.locator("#turn-title").textContent(),
    await a.locator("#turn-title").textContent(),
  );
  assert.equal((await call(worker.base, s.turn, move(s.version))).status, 422);
  await m.setViewportSize({ width: 390, height: 844 });
  await m.screenshot({ path: join(out, "mobile-finish.png"), fullPage: true });
  const outsider = await browser.newPage({
    viewport: { width: 320, height: 700 },
  });
  await outsider.route("**/config.mjs", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: "export const API_ORIGIN='';",
    }),
  );
  await outsider.goto(url);
  assert.equal(await outsider.locator("#join").isDisabled(), true);
  assert.equal(await outsider.locator("#game").isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS " +
      (process.env.TEST_BROWSER || "chromium") +
      ": independent phones, shared turns, preview, double click, lost response + reload retry, offline reconnect, finish, 320/390px, default gesture audio, remembered mute, reduced motion, key/state isolation, fail-closed, no page errors.",
  );
  console.log("Screenshots: " + out);
} finally {
  await browser?.close();
  await web.stop();
  await worker?.stop();
}
