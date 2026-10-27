import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {initialState,applyMove,validate,legalMoves,applyRematch,physicalGarden,boardFor,safeRoute} from '../../../play/olives-fetch-race/engine.mjs';import {startWorker,call,move} from './harness.mjs';
test('first flea + normal walk is one immutable action, once only, with post-walk placement and safeguards',()=>{
 const s=initialState('orchard-v5'),copy=structuredClone(s),m={type:'walk-flea',to:37,trap:33},n=applyMove(s,0,m);
 assert.deepEqual(s,copy);assert.equal(n.version,1);assert.equal(n.ply,1);assert.deepEqual(n.turnCounts,[1,0]);assert.equal(n.players[0].pos,37);assert.equal(n.players[0].fleas,1);assert.equal(n.players[0].sprints,2);assert.equal(n.players[0].firstFleaWalk,false);assert.deepEqual(n.traps,[{owner:0,to:33}]);assert.match(n.last,/same turn/);
 assert.match(validate({...n,turn:0},0,{type:'walk-flea',to:30,trap:32}),/first flea/);assert.equal(applyMove(s,0,{type:'flea',to:33}).players[0].firstFleaWalk,false);
 for(const bad of [{...m,to:38},{...m,trap:37},{...m,trap:40},{...m,trap:19},{...m,trap:29},{type:'sprint',to:38,trap:33}]){assert.ok(validate(s,0,bad));assert.throws(()=>applyMove(s,0,bad));assert.deepEqual(s,copy);}
 assert.ok(validate(initialState(),0,m));const old=structuredClone(s);delete old.players[0].firstFleaWalk;assert.ok(validate(old,0,m));
 const parked=structuredClone(s);parked.players[0].pos=37;assert.equal(applyMove(parked,0,{type:'walk-flea',to:30,trap:37}).traps[0].to,37);
 parked.traps=[{owner:1,to:30}];const bitten=applyMove(parked,0,{type:'walk-flea',to:30,trap:33});assert.equal(bitten.players[0].scratching,true);assert.deepEqual(bitten.traps,[{owner:0,to:33}]);
 for(const action of legalMoves(s,0,'walk-flea')){const v=applyMove(s,0,action),b=boardFor(v);assert.ok(safeRoute(v,1,v.players[1].pos,b.balls[1]));assert.ok(safeRoute(v,1,b.balls[1],b.homes[1]));}
});
test('three physical gardens per cycle, alternating seats on return and stable persisted invitations',()=>{
 for(const seed of [0,1,2,77,134,5555])for(const initial of ['classic-v1','orchard-v5']){
  let s=initialState(initial),seen=initial==='classic-v1'?[]:[s.layout],seats=new Map(seen.map(id=>[physicalGarden(id),id]));
  for(let i=0;i<12;i++){
   const before=structuredClone(s),request=applyRematch(s,0,{type:'request'},'invite-'+i,seed+i*7),snapshot=JSON.parse(JSON.stringify(request));assert.deepEqual(request.players,before.players);
   if(s.gardenQueue?.length){const declined=applyRematch(request,1,{type:'decline',proposal:request.rematch.id}),retried=applyRematch(declined,0,{type:'request'},'retry',999);assert.deepEqual(retried.rematch.queue,request.rematch.queue);assert.equal(retried.rematch.layout,request.rematch.layout);}
   s=applyRematch(snapshot,1,{type:'accept',proposal:snapshot.rematch.id},undefined,999999);const base=physicalGarden(s.layout);if(seats.has(base))assert.notEqual(s.layout,seats.get(base));seats.set(base,s.layout);assert.ok(!seen.length||base!==physicalGarden(seen.at(-1)));seen.push(s.layout);assert.deepEqual(s.gardenQueue,request.rematch.queue);
  }
  for(let i=0;i+3<=seen.length;i+=3)assert.equal(new Set(seen.slice(i,i+3).map(physicalGarden)).size,3);
 }
});
test('Worker applies combined move once across retries/restart and preserves the garden cycle on disk',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fetch-combo-'));let server=await startWorker({port:8925,directory:dir,layout:'orchard-v5'});
 try{
  const start=(await call(server.base)).state,bad=move(0,{type:'walk-flea',to:37,trap:37});assert.equal((await call(server.base,0,bad)).status,422);assert.deepEqual((await call(server.base)).state,start);
  const command=move(0,{type:'walk-flea',to:37,trap:33}),results=await Promise.all(Array.from({length:12},()=>call(server.base,0,command)));assert.ok(results.every(r=>r.status===200));assert.equal(results.filter(r=>!r.alreadyApplied).length,1);
  let s=(await call(server.base)).state;assert.equal(s.version,1);assert.equal(s.players[0].pos,37);assert.equal(s.players[0].fleas,1);assert.equal(s.traps.length,1);assert.equal(s.ply,1);
  await server.stop();server=await startWorker({port:8925,directory:dir});assert.deepEqual((await call(server.base)).state,s);assert.equal((await call(server.base,0,command)).alreadyApplied,true);assert.equal((await call(server.base,0,{...command,action:{type:'walk-flea',to:37,trap:32}})).status,409);
  const seen=[s.layout];for(let i=0;i<7;i++){
   const request={id:crypto.randomUUID(),version:s.version,race:s.race??0,kind:'rematch',action:{type:'request'}};s=(await call(server.base,0,request)).state;const invited=structuredClone(s);
   await server.stop();server=await startWorker({port:8925,directory:dir});assert.deepEqual((await call(server.base)).state,invited);
   const accept={id:crypto.randomUUID(),version:s.version,race:s.race??0,kind:'rematch',action:{type:'accept',proposal:s.rematch.id}};s=(await call(server.base,1,accept)).state;assert.equal((await call(server.base,1,accept)).alreadyApplied,true);seen.push(s.layout);
  }
  for(let i=0;i+3<=seen.length;i+=3)assert.equal(new Set(seen.slice(i,i+3).map(physicalGarden)).size,3);assert.ok(seen.every((id,i)=>!i||physicalGarden(id)!==physicalGarden(seen[i-1])));
 }finally{await server.stop();await rm(dir,{recursive:true,force:true});}
});
