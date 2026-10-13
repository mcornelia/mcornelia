import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWorker, call, move, keys } from './harness.mjs';
test('real Worker: auth, concurrent writes, retries, persistence, version and turn boundaries', async () => {
  const dir=await mkdtemp(join(tmpdir(),'tired-dogs-persistence-'));
  let server=await startWorker({port:8790,directory:dir});
  try {
    assert.equal((await fetch(server.base+'/state')).status,401);
    assert.equal((await fetch(server.base+'/state',{headers:{Authorization:'Bearer '+'a'.repeat(43)}})).status,401);
    assert.equal((await fetch(server.base+'/state',{headers:{Origin:'https://intruder.example',Authorization:`Bearer ${keys[0]}`}})).status,403);
    assert.equal((await fetch(server.base+'/move',{method:'GET',headers:{Authorization:`Bearer ${keys[0]}`}})).status,405);
    let result=await call(server.base); assert.equal(result.state.version,0); assert.equal(result.player,0); assert.equal(result.headers.get('cache-control'),'no-store');
    const unauthorized=await call(server.base,1,{...move(0),player:0}); assert.equal(unauthorized.status,409);
    const m=move(0); const duplicates=await Promise.all(Array.from({length:12},()=>call(server.base,0,m)));
    assert.ok(duplicates.every(r=>r.status===200)); assert.equal(duplicates.filter(r=>!r.alreadyApplied).length,1); assert.equal((await call(server.base)).state.version,1);
    const changed=await call(server.base,0,{...m,action:'treat'}); assert.equal(changed.status,409);
    const race=await Promise.all([call(server.base,1,move(1,'walk')),call(server.base,1,move(1,'treat'))]); assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    const before=(await call(server.base)).state;
    assert.equal((await call(server.base,0,move(1))).status,409);
    assert.equal((await call(server.base,0,move(2,'__proto__'))).status,422);
    assert.deepEqual((await call(server.base)).state,before);
    await server.stop(); server=await startWorker({port:8790,directory:dir});
    assert.deepEqual((await call(server.base)).state,before);
    const replay=await call(server.base,0,m); assert.equal(replay.alreadyApplied,true); assert.equal(replay.state.version,2);
    const cors=await fetch(server.base+'/state',{headers:{Origin:'http://127.0.0.1:4173',Authorization:`Bearer ${keys[0]}`}}); assert.equal(cors.headers.get('access-control-allow-origin'),'http://127.0.0.1:4173');
    const oversized=await fetch(server.base+'/move',{method:'POST',headers:{Authorization:`Bearer ${keys[0]}`,'Content-Type':'application/json'},body:' '.repeat(2049)}); assert.equal(oversized.status,413);
    const malformed=await fetch(server.base+'/move',{method:'POST',headers:{Authorization:`Bearer ${keys[0]}`,'Content-Type':'application/json'},body:'oops'}); assert.equal(malformed.status,400);
    const badtype=await fetch(server.base+'/move',{method:'POST',headers:{Authorization:`Bearer ${keys[0]}`},body:'{}'}); assert.equal(badtype.status,415);
    const invalid=await call(server.base,0,{...move(2),version:-1}); assert.equal(invalid.status,400);
    let s=(await call(server.base)).state;
    for(let i=0;i<7;i++){ const r=await call(server.base,s.turn,move(s.version,'walk')); assert.equal(r.status,200); s=r.state; }
    for(const name of ['Olive','Huck']) {
      for(let i=0;i<4;i++) s=(await call(server.base,s.turn,move(s.version,'cuddle',name))).state;
      s=(await call(server.base,s.turn,move(s.version,'couch',name))).state;
    }
    assert.ok(s.dogs.Olive.asleep&&s.dogs.Huck.asleep);
    assert.equal((await call(server.base,s.turn,move(s.version))).status,422);
    let vote={id:crypto.randomUUID(),version:s.version,kind:'ready'};
    s=(await call(server.base,0,vote)).state; assert.deepEqual(s.votes,[0]);
    assert.equal((await call(server.base,0,{...vote,id:crypto.randomUUID(),version:s.version})).status,422);
    s=(await call(server.base,1,{id:crypto.randomUUID(),version:s.version,kind:'ready'})).state;
    assert.equal(s.round,2); assert.equal(s.turn,1); assert.equal(s.moves,0);
  } finally { await server.stop(); await rm(dir,{recursive:true,force:true}); }
});
test('unprovisioned deployment fails closed', async () => {
  const server=await startWorker({port:8791,configured:false});
  try { assert.equal((await call(server.base)).status,503); } finally { await server.stop(); }
});
