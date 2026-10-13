import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RACE_LAYOUTS } from "../../../play/olives-fetch-race/engine.mjs";
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

// Startup configuration must never replace persisted room state.
test("changing the empty-room initializer leaves an existing classic race and receipts intact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fetch-layout-upgrade-"));
  let server = await startWorker({
    port: 8892,
    directory: dir,
    layout: "classic-v1",
  });
  try {
    const first = move(0);
    const saved = await call(server.base, 0, first);
    assert.equal(saved.status, 200);
    const before = saved.state;
    await server.stop();
    server = await startWorker({
      port: 8892,
      directory: dir,
      layout: "crossing-v2",
    });
    assert.deepEqual((await call(server.base)).state, before);
    assert.equal(Object.hasOwn(before, "layout"), false);
    assert.equal((await call(server.base, 0, first)).alreadyApplied, true);
    const next = await call(server.base, 1, move(1, { type: "step", to: 39 }));
    assert.equal(next.status, 200);
    assert.equal(next.state.version, 2);
    assert.equal(Object.hasOwn(next.state, "layout"), false);
  } finally {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
test("a new crossing room persists its own layout across restart and alternate-client moves", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fetch-crossing-persist-"));
  let server = await startWorker({
    port: 8893,
    directory: dir,
    layout: "crossing-v2",
  });
  try {
    const first = move(0, { type: "step", to: 36 });
    const results = await Promise.all([
      call(server.base, 0, first),
      call(server.base, 0, first),
    ]);
    assert.equal(results.filter((r) => !r.alreadyApplied).length, 1);
    const before = (await call(server.base)).state;
    assert.equal(before.layout, "crossing-v2");
    await server.stop();
    server = await startWorker({
      port: 8893,
      directory: dir,
      layout: "classic-v1",
    });
    assert.deepEqual((await call(server.base)).state, before);
    const next = await call(server.base, 1, move(1, { type: "step", to: 40 }));
    assert.equal(next.status, 200);
    assert.equal(next.state.layout, "crossing-v2");
    assert.deepEqual(
      (await call(server.base, 0)).state,
      (await call(server.base, 1)).state,
    );
  } finally {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("mutual rematches: stale/duplicate requests, archives, monotonic versions, restart and old-client safety", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fetch-rematches-"));
  let server = await startWorker({port:8894,directory:dir,layout:"classic-v1"});
  const command = (s,type,proposal) => ({id:crypto.randomUUID(),kind:"rematch",version:s.version,race:s.race??0,action:{type,...(proposal?{proposal}:{})}});
  const archived = [];
  try {
    assert.equal((await call(server.base,0,null,{headers:{"X-Fetch-Protocol":""}})).status,200);
    const oldMove = move(0);
    assert.equal((await call(server.base,0,oldMove)).status,200);
    let s=(await call(server.base)).state;
    const invite=command(s,"request");
    assert.equal((await call(server.base,0,invite,{headers:{"X-Fetch-Protocol":""}})).status,426);
    const duplicates=await Promise.all(Array.from({length:12},()=>call(server.base,0,invite)));
    assert.equal(duplicates.filter(r=>!r.alreadyApplied).length,1);
    assert.ok(duplicates.every(r=>r.status===200));
    s=duplicates[0].state;
    assert.equal((await call(server.base,0,command(s,"accept",s.rematch.id))).status,422);
    assert.deepEqual(s.players,(await call(server.base)).state.players);
    const obsoleteAccept=command(s,"accept",s.rematch.id);
    s=(await call(server.base,1,move(s.version,{type:"step",to:39}))).state;
    assert.equal(s.rematch,undefined);
    assert.equal((await call(server.base,1,obsoleteAccept)).status,409);
    assert.equal((await call(server.base,1,command(s,"accept",invite.id))).status,422);
    const competing=await Promise.all([call(server.base,0,command(s,"request")),call(server.base,1,command(s,"request"))]);
    assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
    s=(await call(server.base)).state;
    const decliner=1-s.rematch.by;
    const decline=command(s,"decline",s.rematch.id);
    s=(await call(server.base,decliner,decline)).state;
    assert.equal(s.rematch,undefined);
    assert.equal((await call(server.base,decliner,decline)).alreadyApplied,true);
    const layouts=[];
    let retryAccept;
    for(let i=0;i<7;i++) {
      const previous=s;
      s=(await call(server.base,0,command(s,"request"))).state;
      assert.deepEqual(s.players,previous.players);
      archived.push(s);
      const accept=command(s,"accept",s.rematch.id);
      const accepted=await Promise.all(Array.from({length:8},()=>call(server.base,1,accept)));
      assert.equal(accepted.filter(r=>!r.alreadyApplied).length,1);
      assert.ok(accepted.every(r=>r.status===200));
      s=accepted[0].state;
      assert.equal(s.race,i+1);
      assert.equal(s.starter,(i+1)%2);
      assert.equal(s.version,previous.version+2);
      assert.equal(s.ply,0);
      assert.deepEqual((await call(server.base,0)).state,(await call(server.base,1)).state);
      assert.equal((await call(server.base,0,oldMove)).alreadyApplied,true);
      assert.equal((await call(server.base,s.turn,{...move(s.version),race:0})).status,409);
      assert.equal((await call(server.base,1,{...accept,id:crypto.randomUUID()})).status,409);
      assert.equal((await call(server.base,0,null,{headers:{"X-Fetch-Protocol":""}})).status,426);
      assert.equal((await call(server.base,s.turn,move(s.version),{headers:{"X-Fetch-Protocol":""}})).status,426);
      for (const oldProtocol of ["2", "junk"]) {
        assert.equal((await call(server.base,0,null,{headers:{"X-Fetch-Protocol":oldProtocol}})).status,426);
        assert.equal((await call(server.base,s.turn,move(s.version),{headers:{"X-Fetch-Protocol":oldProtocol}})).status,426);
      }
      layouts.push(s.layout);
      retryAccept=accept;
    }
    assert.equal(new Set(layouts.slice(0,3)).size,3);
    assert.equal(new Set(layouts.slice(3,6)).size,3);
    assert.ok(layouts.every((id,i)=>RACE_LAYOUTS.includes(id) && (!i || id!==layouts[i-1])));
    await server.stop();
    server=await startWorker({port:8894,directory:dir,layout:"classic-v1"});
    assert.deepEqual((await call(server.base)).state,s);
    assert.equal((await call(server.base,1,retryAccept)).alreadyApplied,true);
    await server.stop();
    const {readdir}=await import("node:fs/promises");
    const {DatabaseSync}=await import("node:sqlite");
    const files=await readdir(join(dir,"state"),{recursive:true});
    let snapshots;
    for(const f of files.filter(f=>f.endsWith(".sqlite"))) {
      const db=new DatabaseSync(join(dir,"state",f),{readOnly:true});
      try { snapshots=db.prepare("SELECT value FROM race_archive ORDER BY race").all().map(r=>JSON.parse(r.value)); }
      catch {} finally {db.close();}
      if(snapshots) break;
    }
    assert.deepEqual(snapshots,archived);
  } finally {
    await server.stop();
    await rm(dir,{recursive:true,force:true});
  }
});

test("server-chosen courtyard invitation and accepted garden persist across restarts without rerolling", async()=>{
  const dir=await mkdtemp(join(tmpdir(),"fetch-courtyard-"));
  let server=await startWorker({port:8895,directory:dir,layout:"crossing-v2"});
  try {
    assert.equal((await call(server.base,0,null,{headers:{"X-Fetch-Protocol":"2"}})).status,200);
    const req={id:crypto.randomUUID(),version:0,race:0,kind:"rematch",action:{type:"request"}};
    assert.equal((await call(server.base,0,req,{headers:{"X-Fetch-Protocol":"2"}})).status,426);
    let s=(await call(server.base,0,req)).state;
    const invited=structuredClone(s);
    assert.ok(RACE_LAYOUTS.includes(s.rematch.layout));
    assert.equal(s.layout,"crossing-v2");
    await server.stop();
    server=await startWorker({port:8895,directory:dir,layout:"meadow-crossroads-v3"});
    assert.deepEqual((await call(server.base)).state,invited);
    assert.equal((await call(server.base,0,req)).alreadyApplied,true);
    assert.deepEqual((await call(server.base,1)).state,invited);
    s=(await call(server.base,1,{id:crypto.randomUUID(),version:s.version,race:0,kind:"rematch",action:{type:"accept",proposal:s.rematch.id}})).state;
    assert.equal(s.layout,invited.rematch.layout);
    assert.equal(s.walls.length,14);
    assert.deepEqual(s.gardenQueue,invited.rematch.queue);
    await server.stop();
    server=await startWorker({port:8895,directory:dir,layout:"classic-v1"});
    assert.deepEqual((await call(server.base)).state,s);
    assert.deepEqual((await call(server.base,1)).state,s);
  } finally {
    await server.stop();
    await rm(dir,{recursive:true,force:true});
  }
});

test("archive readback is authenticated, exact, read-only, and persistent", async()=>{
  const dir=await mkdtemp(join(tmpdir(),"fetch-archive-read-"));
  let server=await startWorker({port:8896,directory:dir});
  const archive=async(query="race=0",player=0,extra={})=>{
    const r=await fetch(server.base+"/archive?"+query,{headers:{Authorization:`Bearer ${keys[player]}`,"X-Fetch-Protocol":"3"},...extra});
    return {status:r.status,...await r.json()};
  };
  try {
    assert.equal((await fetch(server.base+"/archive?race=0")).status,401);
    assert.equal((await archive("race=0",0,{headers:{Authorization:"Bearer "+"z".repeat(43),"X-Fetch-Protocol":"3"}})).status,401);
    assert.equal((await archive()).status,404);
    for(const query of ["","race=-1","race=0&race=1","race=1.5","race=0%20OR%201=1"])
      assert.equal((await archive(query)).status,400);
    assert.equal((await archive("race=0",0,{method:"POST"})).status,405);
    const requested=await call(server.base,0,{id:crypto.randomUUID(),version:0,race:0,kind:"rematch",action:{type:"request"}});
    const old=requested.state;
    const accepted=await call(server.base,1,{id:crypto.randomUUID(),version:old.version,race:0,kind:"rematch",action:{type:"accept",proposal:old.rematch.id}});
    assert.equal(accepted.status,200);
    for(const player of [0,1]) assert.deepEqual((await archive("race=0",player)).archivedState,old);
    assert.equal((await archive("race=1")).status,404);
    assert.deepEqual((await call(server.base)).state,accepted.state);
    await server.stop();
    server=await startWorker({port:8896,directory:dir});
    assert.deepEqual((await archive()).archivedState,old);
    assert.deepEqual((await call(server.base)).state,accepted.state);
  } finally {await server.stop();await rm(dir,{recursive:true,force:true});}
});
