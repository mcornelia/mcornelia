import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startWorker, call, move, keys, repo } from "./harness.mjs";
test("real Durable Object: auth, 12 retries, competing writes, restart, invalid moves", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fetch-race-persistence-"));
  let server = await startWorker({ port: 8890, directory: dir });
  try {
    assert.equal((await fetch(server.base + "/state")).status, 401);
    assert.equal(
      (
        await fetch(server.base + "/state", {
          headers: { Authorization: "Bearer " + "a".repeat(43) },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await call(server.base, 0, null, {
          headers: { Origin: "https://intruder.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call(server.base, 0, null, {
          headers: { Origin: "http://127.0.0.1:4173" },
        })
      ).headers.get("access-control-allow-origin"),
      "http://127.0.0.1:4173",
    );
    assert.equal(
      (await call(server.base, 1, move(0, { type: "step", to: 39 }))).status,
      409,
    );
    const first = move(0);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => call(server.base, 0, first)),
    );
    assert.equal(results.filter((r) => !r.alreadyApplied).length, 1);
    assert.ok(results.every((r) => r.status === 200));
    assert.equal(
      (
        await call(server.base, 0, {
          ...first,
          action: { type: "step", to: 43 },
        })
      ).status,
      409,
    );
    const competing = await Promise.all([
      call(server.base, 1, move(1, { type: "step", to: 39 })),
      call(server.base, 1, move(1, { type: "step", to: 45 })),
    ]);
    assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
    assert.equal((await call(server.base, 0, move(0))).status, 409);
    assert.equal(
      (await call(server.base, 0, move(2, { type: "step", to: 0 }))).status,
      422,
    );
    assert.equal(
      (await call(server.base, 0, { ...move(2), version: -1 })).status,
      400,
    );
    const before = (await call(server.base)).state;
    await server.stop();
    server = await startWorker({ port: 8890, directory: dir });
    assert.deepEqual((await call(server.base)).state, before);
    assert.equal((await call(server.base, 0, first)).alreadyApplied, true);
    assert.equal((await call(server.base)).state.version, 2);
    const large = await fetch(server.base + "/move", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys[0]}`,
        "Content-Type": "application/json",
      },
      body: " ".repeat(2049),
    });
    assert.equal(large.status, 413);
    assert.equal((await call(server.base)).state.version, 2);
  } finally {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
test("unprovisioned game fails closed", async () => {
  const server = await startWorker({ port: 8891, configured: false });
  try {
    assert.equal((await call(server.base)).status, 503);
  } finally {
    await server.stop();
  }
});
test("separate Worker, class, binding, room, secrets and browser storage", async () => {
  const w = await readFile(
      join(repo, "_services/olives-fetch-race/worker.mjs"),
      "utf8",
    ),
    c = await readFile(
      join(repo, "_services/olives-fetch-race/wrangler.jsonc"),
      "utf8",
    ),
    a = await readFile(join(repo, "play/olives-fetch-race/app.mjs"), "utf8");
  assert.match(w, /FETCH_ROOM/);
  assert.match(w, /olives-fetch-race-v1/);
  assert.match(w, /FETCH_MIKE_KEY_HASH/);
  assert.match(c, /FetchRaceRoom/);
  assert.match(a, /olives-fetch-race:v1:/);
  assert.ok(![w, c, a].some((s) => s.includes("tired-dogs")));
});
