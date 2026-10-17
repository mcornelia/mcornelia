import test from 'node:test';
import assert from 'node:assert/strict';
import {isPerfectFetch} from '../play/daily-fetch/game-engine.mjs';
const words=['also','coal','lass','sass','class','lasso','oasis','sisal','cassia','classic'];
test('Perfect Fetch requires every eligible word, not a matching count',()=>{
 assert.equal(isPerfectFetch(words.slice(0,9),words),false);
 assert.equal(isPerfectFetch([...words.slice(0,9),'retired','also'],words),false);
 assert.equal(isPerfectFetch(words,words),true);
 assert.equal(isPerfectFetch([...words,'retired'],words),true);
 assert.equal(isPerfectFetch([],[]),false);
});
test('eight-word boards can finish regular and perfect goals together',()=>{
 assert.equal(isPerfectFetch(words.slice(0,8),words.slice(0,8)),true);
 assert.equal(isPerfectFetch(words.slice(0,8),[...words.slice(0,8),'ant']),true);
});
