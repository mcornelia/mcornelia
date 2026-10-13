import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {randomBytes,createHash} from "node:crypto";

import {canonicalPhrase,normalizeCredential,credentialCandidates,phraseHash} from "../../../play/olives-fetch-race/access.mjs";
import {startWorker,keys,hashes,call,move} from "./harness.mjs";
const generatePhrase=()=>Array.from({length:6},()=>Array.from(randomBytes(8),n=>String.fromCharCode(97+n%26)).join('')).join('-');
const digest=s=>createHash('sha256').update(s).digest('hex');

test("opaque keys remain exact; six-word phrases normalize without leaking candidate values",async()=>{
  const key=randomBytes(32).toString('base64url');
  assert.ok(normalizeCredential(` \n${key}\u00a0`)===key);
  const phrase=generatePhrase();
  assert.ok(canonicalPhrase(phrase)===phrase);
  assert.ok(canonicalPhrase(phrase.toUpperCase().replaceAll('-',' — '))===phrase);
  assert.ok(normalizeCredential(phrase.replaceAll('-',' '))===phrase);
  assert.ok(credentialCandidates(phrase.toUpperCase()).includes(phrase));
  assert.ok(await phraseHash(phrase)===digest(phrase));
  assert.equal(canonicalPhrase(phrase.split('-').slice(0,3).join('-')),null);
  assert.equal(canonicalPhrase(Array(6).fill('repeat').join('-')),null);
  assert.equal(canonicalPhrase('x'.repeat(161)),null);
  assert.equal(normalizeCredential(''),null);
});

test("phrase-compatible code keeps old keys, then user-supplied test verifier changes preserve race and turn",async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fetch-access-test-'));
  let server=await startWorker({port:8897,directory:dir});
  const phrases=[generatePhrase(),generatePhrase()];
  while(phrases[0]===phrases[1])phrases[1]=generatePhrase();
  const read=async token=>{
    const r=await fetch(server.base+'/state',{headers:{Authorization:`Bearer ${token}`,'X-Fetch-Protocol':'3'}});
    return {status:r.status,...await r.json()};
  };
  try {
    assert.equal((await call(server.base,0)).status,200);
    assert.equal((await call(server.base,1)).status,200);
    assert.equal((await read(phrases[0])).status,401,'A generated phrase is not configured automatically');
    const before=(await call(server.base,0,move(0))).state;
    await server.stop();
    // Disposable local environment only: model the owner saving one verifier.
    server=await startWorker({port:8897,directory:dir,credentialHashes:[await phraseHash(phrases[0]),hashes[1]]});
    assert.equal((await call(server.base,0)).status,401);
    const m=await read(phrases[0].toUpperCase());
    assert.equal(m.status,200);assert.equal(m.player,0);assert.deepEqual(m.state,before);
    const a=await call(server.base,1);
    assert.equal(a.status,200);assert.equal(a.player,1);assert.deepEqual(a.state,before);
    await server.stop();
    server=await startWorker({port:8897,directory:dir,credentialHashes:await Promise.all(phrases.map(phraseHash))});
    for(const p of [0,1]) {
      assert.equal((await call(server.base,p)).status,401);
      const d=await read(phrases[p]);assert.equal(d.status,200);assert.equal(d.player,p);assert.deepEqual(d.state,before);
    }
    const wrongTurn=await call(server.base,0,move(before.version),{headers:{Authorization:`Bearer ${phrases[0]}`}});
    assert.equal(wrongTurn.status,409);
    assert.deepEqual((await read(phrases[1])).state,before);
    assert.equal((await read(phrases[0].split('-').slice(0,3).join('-'))).status,401);
  } finally {await server.stop();await rm(dir,{recursive:true,force:true});}
});

test("overlapping opaque/normalized identities fail closed instead of choosing a player",async()=>{
  const chosen=generatePhrase().split('-').map((w,i)=>w.slice(0,i<4?6:7));
  const canonical=chosen.join('-'),opaque=canonical[0].toUpperCase()+canonical.slice(1);
  assert.equal(opaque.length,43);
  const server=await startWorker({port:8898,credentialHashes:[digest(opaque),digest(canonical)]});
  try {
    const r=await fetch(server.base+'/state',{headers:{Authorization:`Bearer ${opaque}`,'X-Fetch-Protocol':'3'}});
    assert.equal(r.status,401);
  } finally {await server.stop();}
});

test('self-service phrase change revokes only its player, preserves race, retries, and persists on restart',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'fetch-self-service-'));
  let server=await startWorker({port:8899,directory:dir});
  const phrase=generatePhrase(),other=generatePhrase(),id=crypto.randomUUID();
  async function api(token,path='/state',body) {
    const r=await fetch(server.base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'X-Fetch-Protocol':'3',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,...await r.json()};
  }
  try {
    const before=(await call(server.base,0,move(0))).state;
    const body={id,phrase,confirmation:phrase};
    assert.equal((await api(generatePhrase(),'/access',body)).status,401);
    assert.equal((await api(keys[0],'/access',{...body,confirmation:other})).status,400);
    assert.deepEqual((await call(server.base,0)).state,before);
    const attempts=await Promise.all([api(keys[0],'/access',body),api(keys[0],'/access',body)]);
    assert.deepEqual(attempts.map(a=>a.status).sort(),[200,401]);
    assert.equal((await api(keys[0])).status,401);
    assert.equal((await api(phrase.toUpperCase().replaceAll('-',' '))).player,0);
    assert.equal((await api(phrase,'/access',body)).changed,true);
    assert.equal((await api(phrase,'/access',{...body,id:crypto.randomUUID()})).status,409);
    assert.deepEqual((await call(server.base,1)).state,before);
    assert.equal((await api(keys[1],'/access',{...body,id:crypto.randomUUID()})).status,409);
    assert.equal((await api(phrase,'/move',move(before.version))).status,409);
    await server.stop();server=await startWorker({port:8899,directory:dir});
    assert.equal((await api(keys[0])).status,401);
    assert.deepEqual((await api(phrase)).state,before);
    assert.equal((await call(server.base,1)).player,1);
    assert.equal((await api(keys[1],'/access',{id:crypto.randomUUID(),phrase:other,confirmation:other})).status,200);
    assert.equal((await api(keys[1])).status,401);
    assert.equal((await api(other)).player,1);
    assert.deepEqual((await api(phrase)).state,before);
  } finally {await server.stop();await rm(dir,{recursive:true,force:true});}
});

test('failed sign-ins are throttled, valid existing credentials still work, foreign origins cannot change access',async()=>{
  const server=await startWorker({port:8900});
  try {
    for(let i=0;i<19;i++) assert.equal((await fetch(server.base+'/state',{headers:{Authorization:'Bearer invalid'}})).status,401);
    assert.equal((await fetch(server.base+'/state')).status,429);
    assert.equal((await call(server.base,0)).status,200);
    const phrase=generatePhrase();
    assert.equal((await fetch(server.base+'/access',{method:'POST',headers:{Authorization:`Bearer ${keys[0]}`,Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),phrase,confirmation:phrase})})).status,403);
    assert.equal((await call(server.base,0)).state.version,0);
  } finally {await server.stop();}
});
