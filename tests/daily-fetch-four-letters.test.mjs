import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleWords,evaluateWord,scoreWords,getObjectives} from '../play/daily-fetch/game-engine.mjs';
import {PUZZLES} from '../play/daily-fetch/puzzles.mjs';
import {MODERN_PUZZLES as VARIETY_PUZZLES} from '../play/daily-fetch/puzzles-modern.mjs';
import {migrateStore} from '../play/daily-fetch/stats-store.mjs';
test('three-letter submissions are rejected, four-letter words accepted',()=>{
 const args={foundWords:[],acceptedWords:['ant','ante']};
 assert.equal(evaluateWord({...args,word:'ANT'}).reason,'short');
 assert.equal(evaluateWord({...args,word:'ANTE'}).accepted,true);
});
test('all retained boards can still meet all goals with four-letter words',()=>{
 for(const puzzle of [...PUZZLES,...VARIETY_PUZZLES]) {
  const words=eligibleWords(puzzle.words);
  assert.ok(getObjectives(words,puzzle.secret).complete,puzzle.letters);
 }
 assert.equal(eligibleWords(VARIETY_PUZZLES[0].words).length,49);
});
test('legacy short words, scores and completion remain intact',()=>{
 const words=['cat','dog','fetch','orange','sun','rain','oak','ball'];
 const input={days:{'2026-10-04':{foundWords:words,completedAt:'2026-10-04T12:00:00Z'}}};
 const restored=migrateStore(input,new Date(2026,9,4));
 const saved=restored.days['2026-10-04'];
 assert.deepEqual(saved.foundWords,words);
 assert.equal(scoreWords(saved.foundWords),scoreWords(words));
 assert.equal(saved.completedAt,input.days['2026-10-04'].completedAt);
 assert.equal(getObjectives(saved.foundWords,'orange').complete,true);
});

test('modern vocabulary excludes retired entries and preserves current-board progress',()=>{
 for(const puzzle of VARIETY_PUZZLES) {
  assert.ok(puzzle.words.every(word=>word.length>=4));
  assert.ok(!puzzle.words.includes('slon'));
  assert.ok(!puzzle.words.includes('taen'));
 }
 const words=['ant','slon','taen','ante'];
 const input={days:{'2026-10-04':{puzzleId:VARIETY_PUZZLES[0].letters,foundWords:words}}};
 const restored=migrateStore(input,new Date(2026,9,4));
 assert.deepEqual(restored.days['2026-10-04'].foundWords,words);
 assert.equal(scoreWords(restored.days['2026-10-04'].foundWords),scoreWords(words));
});
