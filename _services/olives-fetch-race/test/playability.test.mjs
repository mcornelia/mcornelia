import test from 'node:test';
import assert from 'node:assert/strict';
import * as old from './fixtures/published-v3-engine.mjs';
import {initialState,boardFor,edge,distance,route,legalMoves,applyMove,applyRematch,V3_LAYOUTS,STRATEGY_LAYOUTS} from '../../../play/olives-fetch-race/engine.mjs';
import {raceSummary, playerObjective} from '../../../play/olives-fetch-race/race-summary.mjs';

test('Meadow opening cuts halve from eight to four steps without creating a worse opening cut',()=>{
 for(const [id,expected] of [['meadow-crossroads-v3',8],['meadow-crossroads-v4',4]]) {
  const s=initialState(id);
  for(const [a,b,delta] of [[16,23,[0,expected]],[18,25,[expected,0]]]) {
   const next=applyMove(s,0,{type:'fence',a,b});
   assert.deepEqual([0,1].map(p=>distance(next,p)-distance(s,p)),delta);
  }
  if(id.endsWith('v4'))for(const m of legalMoves(s,0,'fence')) {
   const next=applyMove(s,0,m);assert.ok([0,1].every(p=>distance(next,p)-distance(s,p)<=4));
  }
 }
});

test('all published v3 layouts and completed games retain their exact geometry and transitions',()=>{
 for(const id of V3_LAYOUTS) {
  let s=initialState(id),prior=old.initialState(id);
  assert.deepEqual(boardFor(s),old.boardFor(prior));
  for(let t=0;t<180&&s.result===null;t++) {
   const p=s.turn,b=boardFor(s),a=s.players[p];
   const fences=legalMoves(s,p,'fence');
   const action=t%11===0&&fences.length?fences[(t*7)%fences.length]:{type:'step',to:route(s,a.pos,a.ball?b.homes[p]:b.balls[p])[1]};
   s=applyMove(s,p,action);prior=old.applyMove(prior,p,action);assert.deepEqual(s,prior);
  }
  assert.notEqual(s.result,null);
 }
});

test('new proposals use strategy gardens; existing invitations keep their exact promised board',()=>{
 const s={...initialState('south-crossroads-v3'),gardenQueue:['meadow-crossroads-v3','north-crossroads-v3']};
 const next=applyRematch(s,0,{type:'request'},'new');
 assert.ok(STRATEGY_LAYOUTS.includes(next.rematch.layout));assert.equal(next.layout,s.layout);assert.deepEqual(next.walls,s.walls);
 const pending={...s,rematch:{id:'old',by:0,layout:'meadow-crossroads-v3',queue:['north-crossroads-v3']}};
 assert.equal(applyRematch(pending,1,{type:'accept',proposal:'old'}).layout,'meadow-crossroads-v3');
});

test('late North B7–C7 ambush remains a legal four-step setback, even one step from home',()=>{
 const s=initialState('north-crossroads-v3');s.players[0]={...s.players[0],pos:44,ball:true};s.turn=1;
 assert.equal(distance(s,0),1);
 const next=applyMove(s,1,{type:'fence',a:43,b:44});assert.equal(distance(next,0),5);assert.equal(next.players[1].fences,5);
});

test('finished summaries count completed turns and explain tie or either winning order',()=>{
 for(const starter of [0,1])for(const turns of [44,70,74]) {
  const s={...initialState(),starter,ply:turns,version:turns+5,result:'tie'};
  assert.deepEqual(raceSummary(s).counts,[turns/2,turns/2]);assert.equal(raceSummary(s).turns,turns);assert.match(raceSummary(s).explanation,/final chance to tie/);
  s.result=starter;assert.match(raceSummary(s).explanation,/could not reach home/);
  s.result=1-starter;assert.match(raceSummary(s).explanation,/same number of turns/);
 }
 const s={...initialState(),starter:1,ply:3};assert.deepEqual(raceSummary(s).counts,[1,2]);
});

test('player status distinguishes fetch and return, pluralizes zero/one/multiple, and preserves finished and active copy',()=>{
  for(const [ball, expected] of [[false,["Fetch unfinished · 0 steps left","Fetch unfinished · 1 step left","Fetch unfinished · 5 steps left"]],[true,["Return unfinished · 0 steps left","Return unfinished · 1 step left","Return unfinished · 5 steps left"]]]) {
    assert.deepEqual([0,1,5].map(steps=>playerObjective({ball,finished:false},true,steps)),expected);
    assert.equal(playerObjective({ball,finished:true},true,0),"Home with the ball");
    assert.equal(playerObjective({ball,finished:false},false,5),ball?"Bring it home":"Fetch your ball");
  }
});
