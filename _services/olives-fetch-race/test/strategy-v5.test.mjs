import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,STRATEGY_LAYOUTS,RACE_LAYOUTS,boardFor,route,distance,validate,applyMove,legalMoves,safeRoute,edge} from '../../../play/olives-fetch-race/engine.mjs';
import {raceSummary} from '../../../play/olives-fetch-race/race-summary.mjs';
import {travel,play} from './strategy-v5-helpers.mjs';

test('short asymmetric gardens give equal walking and sprint costs, connected lawn and a clean route',()=>{
 for(const id of STRATEGY_LAYOUTS){const s=initialState(id),b=boardFor(s);assert.deepEqual([distance(s,0),distance(s,1)],[14,14]);assert.deepEqual([travel(s,0).cost,travel(s,1).cost],[12,12]);assert.deepEqual(s.players.map(p=>[p.fences,p.sprints,p.fleas]),[[3,2,2],[3,2,2]]);
  const mirror=n=>Math.floor(n/7)*7+6-n%7;assert.notDeepEqual([...b.rocks].sort(),b.rocks.map(mirror).sort());
  for(let n=0;n<49;n++)if(!b.rocks.includes(n))assert.ok(route(s,b.homes[0],n));
  for(const m of legalMoves(s,0,'fence')){const v=applyMove(s,0,m);for(const p of [0,1])assert.ok(distance(v,p)-distance(s,p)<=4);}
 }
});
test('equal-turn rule ties exact beelines with either starter, including every published crossroads garden',()=>{
 for(const id of [...RACE_LAYOUTS,...STRATEGY_LAYOUTS])for(const starter of [0,1]){const {state:s}=play(initialState(id),starter,['beeline','beeline']);assert.equal(s.result,'tie',id);assert.equal(raceSummary(s).counts[0],raceSummary(s).counts[1]);}
});
test('flea landing consumes exactly one trap and one later turn; sprint middle squares and own traps are safe',()=>{
 const original=initialState('orchard-v5'),b=boardFor(original);let found;
 for(let pos=0;pos<49&&!found;pos++){const s=structuredClone(original);s.players[0].pos=pos;for(const m of legalMoves(s,0,'sprint'))if(![...b.homes,...b.balls].includes(m.to)&&m.to!==s.players[1].pos){found={s,m};break;}}
 assert.ok(found);const {s,m}=found,mid=s.players[0].pos+(m.to-s.players[0].pos)/2;
 s.traps=[{owner:1,to:mid}];let v=applyMove(s,0,m);assert.equal(v.players[0].scratching,false);assert.equal(v.traps.length,1);
 s.traps=[{owner:0,to:m.to}];v=applyMove(s,0,m);assert.equal(v.players[0].scratching,false);assert.equal(v.traps.length,1);
 s.traps=[{owner:1,to:m.to}];v=applyMove(s,0,m);assert.equal(v.players[0].scratching,true);assert.equal(v.traps.length,0);assert.equal(v.turn,1);
 const next=applyMove(v,1,travel(v,1).move);assert.equal(next.turn,1);assert.equal(next.players[0].scratching,false);assert.deepEqual(next.turnCounts,[2,1]);assert.equal(next.ply,3);assert.match(next.last,/spends this turn scratching/);
});
test('placement rejects goals, occupied squares, duplicate traps, exhausted supply and forced bites',()=>{
 let checked=0;
 for(const id of STRATEGY_LAYOUTS){const s=initialState(id),b=boardFor(s);for(const to of [...b.homes,...b.balls])assert.ok(validate(s,0,{type:'flea',to}));
  for(const m of legalMoves(s,0,'flea')){const v=applyMove(s,0,m);assert.equal(v.players[0].fleas,1);assert.ok(safeRoute(v,1,v.players[1].pos,b.balls[1]));assert.ok(safeRoute(v,1,b.balls[1],b.homes[1]));assert.match(validate({...v,turn:0},0,m),/already/);checked++;}
  s.players[0].fleas=0;assert.match(validate(s,0,{type:'flea',to:24}),/No flea/);
 }
 assert.ok(checked>50);
});
test('final chance to tie survives either starting order; scratching consumes that chance exactly once',()=>{
 for(const starter of [0,1]){const s=initialState('orchard-v5'),b=boardFor(s);s.starter=starter;s.turn=starter;
  for(const p of [0,1]){s.players[p].ball=true;s.players[p].pos=route(s,b.homes[p],b.balls[p])[1];}
  let v=applyMove(s,starter,{type:'step',to:b.homes[starter]});assert.equal(v.result,null);assert.equal(v.finalLap,true);
  v=applyMove(v,1-starter,{type:'step',to:b.homes[1-starter]});assert.equal(v.result,'tie');assert.deepEqual(v.turnCounts,[1,1]);
  s.players[1-starter].scratching=true;v=applyMove(s,starter,{type:'step',to:b.homes[starter]});assert.equal(v.result,starter);assert.deepEqual(v.turnCounts,[1,1]);
 }
});
test('full strategy games compare beeline, fences, fleas and combined play in both seat orders',()=>{
 const results=[];for(const id of STRATEGY_LAYOUTS)for(const starter of [0,1])for(const policies of [['beeline','beeline'],['fences','beeline'],['beeline','fences'],['fleas','beeline'],['fleas','fleas'],['mixed','mixed']]){
  const result=play(initialState(id),starter,policies),s=result.state;assert.ok(s.ply<=90);assert.ok(result.skips<=4);assert.ok(s.players.every(a=>a.fleas>=0&&a.fences>=0));
  results.push({id,starter,policies,result:s.result,turns:s.ply,...result.actions,skips:result.skips});
 }
 assert.ok(results.some(r=>r.fence>0&&r.result!=='tie'));assert.ok(results.some(r=>r.flea>0&&r.skips>0));console.log('STRATEGY_RESULTS '+JSON.stringify(results));
});


test('fences and extra traps cannot remove the last flea-free route; skips cannot chain beyond pending players',()=>{
 const base=initialState('orchard-v5');let s=applyMove(base,0,{type:'flea',to:18});
 assert.match(validate(s,1,{type:'fence',a:31,b:32}),/force a flea/);
 let checked=0;
 for(const m of legalMoves(s,1,'flea')){const v=applyMove(s,1,m);for(const f of legalMoves(v,0,'fence')){const n=applyMove(v,0,f),b=boardFor(n);for(const p of [0,1]){assert.ok(safeRoute(n,p,n.players[p].pos,b.balls[p]));assert.ok(safeRoute(n,p,b.balls[p],b.homes[p]));}checked++;}}
 assert.ok(checked>100);
 s=structuredClone(base);s.players.forEach(p=>p.scratching=true);const v=applyMove(s,0,travel({...s,players:s.players.map(p=>({...p,scratching:false}))},0).move);
 assert.deepEqual(v.players.map(p=>p.scratching),[false,false]);assert.equal(v.ply,3);assert.deepEqual(v.turnCounts,[2,1]);
 assert.match(validate(initialState(),0,{type:'flea',to:20}),/new gardens only/);
});


test('published v4 garden retains byte-equivalent full-game transitions',async()=>{
 const old=await import('./fixtures/published-v4-engine.mjs');let s=initialState('meadow-crossroads-v4'),prior=old.initialState('meadow-crossroads-v4');
 assert.deepEqual(s,prior);assert.deepEqual(boardFor(s),old.boardFor(prior));
 for(let t=0;t<180&&s.result===null;t++) {const p=s.turn,f=legalMoves(s,p,'fence'),m=t%9===0&&f.length?f[(t*7)%f.length]:travel(s,p).move;s=applyMove(s,p,m);prior=old.applyMove(prior,p,m);assert.deepEqual(s,prior);}
 assert.notEqual(s.result,null);
});
