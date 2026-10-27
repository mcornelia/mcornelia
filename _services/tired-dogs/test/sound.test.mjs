import test from 'node:test';
import assert from 'node:assert/strict';
import { createSound, turnCue } from '../../../play/tired-dogs/sound.mjs';
import { initialState, applyAction, nextEvening } from '../../../play/tired-dogs/engine.mjs';

test('audio cues require exactly one fresh live move; reconnects and receipts are silent', () => {
  const a=initialState(), b=applyAction(a,'walk','Olive');
  assert.equal(turnCue(a,b,{live:true,move:{version:0,kind:'action',action:'walk'}}),'walk');
  assert.equal(turnCue(a,b,{live:true}),'care');
  for(const [prev,next,options] of [[null,b,{live:true}],[a,b,{}],[a,b,{live:true,replay:true}],[b,b,{live:true}],[b,a,{live:true}],[a,{...b,version:2},{live:true}],[a,{...b,round:2},{live:true}],[a,{...b,moves:0},{live:true}]])assert.equal(turnCue(prev,next,options),null);
  let state=a;for(const [action,dog] of [['walk','Olive'],['walk','Huck'],['walk','Olive'],['cuddle','Olive'],['cuddle','Olive'],['cuddle','Huck']])state=applyAction(state,action,dog);
  const one=applyAction(state,'couch','Olive'),two=applyAction(one,'couch','Huck');
  assert.equal(turnCue(state,one,{live:true}),'sleep');assert.equal(turnCue(one,two,{live:true}),'win');
  assert.equal(turnCue(two,nextEvening(two,0),{live:true}),null);
});

test('sound requires gesture unlock, stays quiet, stops on mute, and never queues blocked effects', async () => {
  let created=0,starts=0,stops=0,show=true;const gains=[];
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const context={state:'suspended',currentTime:0,destination:{},createGain(){const gain={gain:param(),connect(){},disconnect(){}};gains.push(gain);return gain;},createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(){starts++;},stop(){stops++;}};},resume(){return Promise.reject(new Error('blocked'));}};
  const sound=createSound({contextFactory:()=>{created++;return context;},visible:()=>show});
  assert.equal(sound.enabled,true);sound.play('ball');assert.equal(created,0);
  sound.unlock();await new Promise(r=>setTimeout(r,0));sound.play('ball');assert.equal(starts,0);assert.equal(gains[0].gain.value,.09);
  context.state='running';sound.play('ball');assert.equal(starts,2);
  sound.setEnabled(false);const stopped=stops;sound.play('win');sound.unlock();assert.equal(starts,2);assert.equal(stops,stopped);
  sound.setEnabled(true);show=false;sound.play('win');assert.equal(starts,2);
  show=true;sound.play('win');assert.equal(starts,6);assert.equal(created,1);
  const absent=createSound({contextFactory:()=>null,visible:()=>true});assert.doesNotThrow(()=>{absent.unlock();absent.play('win');});
  const broken=createSound({contextFactory:()=>{throw Error('unavailable');},visible:()=>true});assert.doesNotThrow(()=>{broken.unlock();broken.play('ball');});
  const muted=createSound({enabled:false,contextFactory:()=>{throw Error('must not initialize');},visible:()=>true});assert.doesNotThrow(()=>muted.unlock());
});
