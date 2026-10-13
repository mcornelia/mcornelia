import test from "node:test";
import assert from "node:assert/strict";
import * as published from "./fixtures/published-v2-engine.mjs";
import * as current from "../../../play/olives-fetch-race/engine.mjs";
import { initialState, boardFor, RACE_LAYOUTS, V2_LAYOUTS, route, neighbors,
  distance, validate, applyMove, legalMoves, edge, applyRematch } from "../../../play/olives-fetch-race/engine.mjs";
import { allShortest, fastest } from "./strategy-helpers.mjs";
const mirror = n => Math.floor(n/7)*7+6-n%7;
const withoutHub = s => ({...s,walls:[...s.walls,edge(23,24),edge(24,25)]});

test("14 mirrored fences cause real detours, every lawn square is reachable, equal resources and sprint opportunity",()=>{
  const paths=[];
  for(const id of RACE_LAYOUTS) {
    const s=initialState(id),b=boardFor(s);
    assert.equal(s.walls.length,14);
    assert.equal(new Set(s.walls).size,14);
    assert.deepEqual(s.walls.map(w=>edge(...w.split('-').map(Number).map(mirror))).sort(),[...s.walls].sort());
    assert.deepEqual(b.rocks.map(mirror).sort(),[...b.rocks].sort());
    assert.equal(mirror(b.homes[0]),b.homes[1]);
    assert.equal(mirror(b.balls[0]),b.balls[1]);
    assert.ok(s.walls.every(w=>w.split('-').map(Number).every(n=>!b.balls.includes(n)&&!b.homes.includes(n))));
    assert.deepEqual(s.players.map(p=>[p.fences,p.sprints]),[[6,2],[6,2]]);
    assert.deepEqual([distance(s,0),distance(s,1)],[24,24]);
    assert.deepEqual([fastest(s,0),fastest(s,1)],[22,22]);
    assert.deepEqual([0,1].map(p=>distance({...s,walls:[]},p)),[20,20]);
    for(let n=0;n<49;n++) if(!b.rocks.includes(n)) assert.ok(route(s,b.homes[0],n));
    const shortest=allShortest(s,b.homes[0],b.balls[0]);
    paths.push(JSON.stringify(shortest));
    console.log(`${b.name}: 14 fixed fences, 24/24 walking steps, 22/22 sprint-optimal turns, ${shortest.length} shortest outbound routes each; all 43 lawn squares reachable.`);
  }
  assert.equal(new Set(paths).size,3);
});

test("courtyard intersection is guaranteed for ALL routes, with three viable approaches per side",()=>{
  for(const id of RACE_LAYOUTS) {
    const s=initialState(id),b=boardFor(s);
    // Removing the shared square disconnects both home/ball pairs: this tests
    // every possible walk, not merely an example or shortest-route overlay.
    for(const p of [0,1]) {
      assert.equal(route(withoutHub(s),b.homes[p],b.balls[p]),null);
      assert.equal(route(withoutHub(s),b.balls[p],b.homes[p]),null);
      for(const path of allShortest(s,b.homes[p],b.balls[p]))
        assert.ok(b.courtyard.every(n=>path.includes(n)));
    }
    // Either player can close two approaches on a side; the third still works.
    for(const gate of [16,22,30]) {
      const closed=[16,22,30].filter(n=>n!==gate).map(n=>edge(n,23));
      const bothSides=closed.concat(closed.map(w=>edge(...w.split('-').map(Number).map(mirror))));
      const v={...s,walls:[...s.walls,...bothSides]};
      for(const p of [0,1]) {
        const path=route(v,b.homes[p],b.balls[p]);
        assert.ok(path && path.length-1<=20);
        assert.ok(path.includes(gate));
      }
    }
    assert.match(validate(s,0,{type:"fence",a:23,b:24}),/close a winning route/);
    let v=applyMove(s,0,{type:"fence",a:16,b:23});
    v=applyMove(v,1,{type:"fence",a:22,b:23});
    assert.match(validate(v,0,{type:"fence",a:23,b:30}),/close a winning route/);
  }
});

test("reachable courtyard choice has a real detour; players may meet and pass through",()=>{
  let s=initialState(RACE_LAYOUTS[0]);
  for(let i=0;i<12;i++) {
    const p=s.turn,b=boardFor(s),v=s.players[p];
    s=applyMove(s,p,{type:"step",to:route(s,v.pos,b.balls[p])[1]});
  }
  assert.deepEqual(s.players.map(p=>p.pos),[23,25]);
  const fenced=applyMove(s,0,{type:"fence",a:16,b:23});
  assert.deepEqual([0,1].map(p=>distance(fenced,p)-distance(s,p)),[0,8]);
  assert.equal(fenced.players[0].fences,5);
  s=applyMove(s,0,{type:"step",to:24});
  s=applyMove(s,1,{type:"step",to:24});
  assert.deepEqual(s.players.map(p=>p.pos),[24,24]);
  assert.equal(validate(s,0,{type:"step",to:25}),null);
});

test("shuffled gardens are stable through invitations, use every variant, and never repeat consecutively",()=>{
  const orders=new Set();
  for(let seed=0;seed<24;seed++) {
    let s=initialState();
    const seen=[];
    for(let game=0;game<9;game++) {
      const before=s;
      s=applyRematch(s,0,{type:"request"},`invite-${game}`,seed+game*71);
      const invitation=structuredClone(s.rematch);
      assert.deepEqual(s.players,before.players);
      assert.equal(s.layout,before.layout);
      s=applyRematch(s,1,{type:"accept",proposal:s.rematch.id},undefined,seed+983);
      assert.equal(s.layout,invitation.layout);
      assert.deepEqual(s.gardenQueue,invitation.queue);
      assert.ok(!seen.length || s.layout!==seen.at(-1));
      seen.push(s.layout);
    }
    for(let i=0;i<9;i+=3)assert.equal(new Set(seen.slice(i,i+3)).size,3);
    orders.add(seen.slice(0,3).join());
  }
  assert.ok(orders.size>=3,"different server seeds produce different garden orders");
});

test("published classic and v2 races retain exact geometry and complete-game transitions",()=>{
  for(const name of Object.keys(published)) assert.ok(name in current, `Published module export ${name} remains available`);
  for(const id of ["classic-v1",...V2_LAYOUTS]) {
    assert.equal(current.nextLayout({layout:id}),published.nextLayout({layout:id}));
    let s=initialState(id),old=published.initialState(id);
    assert.deepEqual(s,old);
    assert.deepEqual(boardFor(s),published.boardFor(old));
    for(let i=0;i<130&&s.result===null;i++) {
      const p=s.turn,b=boardFor(s),v=s.players[p];
      const fences=legalMoves(s,p,"fence");
      const move=(i%7===0&&fences.length)?fences[(i*13)%fences.length]:{type:"step",to:route(s,v.pos,v.ball?b.homes[p]:b.balls[p])[1]};
      assert.deepEqual(legalMoves(s,p,"fence"),published.legalMoves(old,p,"fence"));
      s=applyMove(s,p,move);old=published.applyMove(old,p,move);
      assert.deepEqual(s,old);
    }
    assert.notEqual(s.result,null);
  }
});

test("40 complete crossroads races: every accepted fence preserves both objectives and the shared crossing",()=>{
  let seed=27891,accepted=0,rejected=0;
  const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let game=0;game<40;game++) {
    let s=initialState(RACE_LAYOUTS[game%3]);
    const fixed=boardFor(s).fixedWalls;
    for(let t=0;t<240&&s.result===null;t++) {
      const p=s.turn,b=boardFor(s);
      for(let a=0;a<49;a++)for(const to of [a+1,a+7]){
        const m={type:"fence",a,b:to};
        if(validate(s,p,m)){rejected++;continue;}
        const v=applyMove(s,p,m);
        for(const i of [0,1]) {
          assert.ok(route(v,v.players[i].pos,v.players[i].ball?b.homes[i]:b.balls[i]));
          assert.ok(route(v,b.balls[i],b.homes[i]));
          assert.equal(route(withoutHub(v),b.balls[i],b.homes[i]),null);
        }
        accepted++;
      }
      const fences=legalMoves(s,p,"fence"),v=s.players[p];
      const m=fences.length&&rand(3)===0?fences[rand(fences.length)]:{type:"step",to:route(s,v.pos,v.ball?b.homes[p]:b.balls[p])[1]};
      s=applyMove(s,p,m);
      assert.ok(fixed.every(w=>s.walls.includes(w)));
      assert.equal(s.layout,RACE_LAYOUTS[game%3]);
    }
    assert.notEqual(s.result,null);
  }
  console.log(`Crossroads invariants: ${accepted} accepted continuations, ${rejected} rejected candidates across 40 completed games.`);
});
