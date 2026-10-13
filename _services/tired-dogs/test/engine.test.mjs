import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, applyAction, nextEvening, finished, ready, ACTIONS } from '../../../play/tired-dogs/engine.mjs';
test('a cooperative eight-turn path reaches both dogs asleep', () => {
  let state = initialState(); const original = structuredClone(state);
  for (const [action,dog] of [['walk','Olive'],['walk','Huck'],['walk','Olive'],['cuddle','Olive'],['cuddle','Olive'],['cuddle','Huck'],['couch','Olive'],['couch','Huck']]) state = applyAction(state, action, dog);
  assert.ok(finished(state)); assert.equal(state.moves,8); assert.equal(state.version,8); assert.equal(state.turn,0); assert.deepEqual(initialState(),original);
  assert.throws(() => applyAction(state,'walk','Olive'));
  const voted = nextEvening(state,0); assert.ok(finished(voted)); assert.throws(() => nextEvening(voted,0));
  const next = nextEvening(voted,1); assert.equal(next.round,2); assert.equal(next.version,10); assert.equal(next.turn,1); assert.deepEqual(next.votes,[]);
});
test('readiness boundaries and immutable sleepers', () => {
  const base = {wiggles:25,sniffs:20,love:75,asleep:false}; assert.ok(ready(base));
  for (const delta of [{wiggles:26},{sniffs:21},{love:74}]) assert.equal(ready({...base,...delta}),false);
  let state = initialState(); state.dogs.Olive = base; state = applyAction(state,'couch','Olive');
  const sleeping = structuredClone(state.dogs.Olive);
  for (const action of ['walk','fetch','treat','cuddle','couch']) state = applyAction(state,action,'Huck');
  assert.deepEqual(state.dogs.Olive,sleeping); assert.throws(() => applyAction(state,'fetch','Olive'));
});
test('invalid inputs cannot change state, including prototype properties', () => {
  const state = initialState();
  for (const action of ['bogus','constructor','__proto__',null]) assert.throws(() => applyAction(state,action,'Olive'));
  for (const dog of ['constructor','__proto__',null]) assert.throws(() => applyAction(state,'walk',dog));
  assert.throws(() => nextEvening(state,0)); assert.equal(state.version,0);
});
test('long play remains bounded and recoverable without decay or losses', () => {
  let seed = 21; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2**32);
  for (let run=0;run<30;run++) {
    let state=initialState();
    for (let i=0;i<100&&!finished(state);i++) {
      const awake=Object.keys(state.dogs).filter(n=>!state.dogs[n].asleep);
      state=applyAction(state,Object.keys(ACTIONS)[Math.floor(rng()*5)],awake[Math.floor(rng()*awake.length)]);
      for (const d of Object.values(state.dogs)) for (const k of ['wiggles','sniffs','love']) assert.ok(d[k]>=0&&d[k]<=100);
    }
    for(let i=0;i<7&&!finished(state);i++) state=applyAction(state,'walk','Olive');
    for(const name of ['Olive','Huck']) if(!state.dogs[name].asleep) {
      for(let i=0;i<4;i++) state=applyAction(state,'cuddle',name);
      state=applyAction(state,'couch',name);
    }
    assert.ok(finished(state)); assert.ok(state.journal.length<=12);
  }
});
