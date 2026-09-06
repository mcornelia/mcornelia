import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats, scoreWords } from '../play/daily-fetch/game-engine.mjs';
import { migrateStore, openStore, prepareDay, recordHint, restartDay, updateDayRecord } from '../play/daily-fetch/stats-store.mjs';
const today = new Date(2026, 8, 6, 12);
const key = '2026-09-06';
const puzzle = { letters: 'abcdefghijklmnop' };
const fakeStorage = (initial = null) => {
  let raw = initial;
  return { getItem: () => raw, setItem: (_key, next) => { raw = next; }, read: () => raw };
};

test('migration preserves legacy history, extra fields and aggregates without inventing hints', () => {
  const input = { soundEnabled: false, custom: { best: 400 }, days: {
    '2026-09-04': { foundWords: ['cat','orange'], completedAt: 'old', extra: 42, hintRevealed: false },
    '2026-09-05': { foundWords: ['ball'], hintRevealed: true },
  }};
  const store = migrateStore(input, today);
  assert.deepEqual(store.custom, input.custom);
  assert.equal(store.soundEnabled, false);
  assert.equal(store.days['2026-09-04'].extra, 42);
  assert.equal(store.days['2026-09-04'].completedAt, 'old');
  assert.deepEqual(store.days['2026-09-04'].foundWords, ['cat','orange']);
  assert.equal(store.days['2026-09-04'].hintHistoryKnown, false);
  assert.equal(input.days['2026-09-04'].playedAt, undefined);
  const stats = calculateStats(store.days, today);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.bestPoints, 6);
  assert.equal(stats.hintDays, 1);
  assert.equal(stats.hintTrackedDays, 1);
  assert.deepEqual(migrateStore(store, today), store);
});

test('post-win bests keep increasing and survive reload, new day and explicit restart', () => {
  const storage = fakeStorage();
  const session = openStore(() => storage, today);
  const day = prepareDay(session.store, key, puzzle);
  day.foundWords = ['cat','dog','fetch','orange','sun','rain','oak','ball'];
  day.completedAt = 'win';
  updateDayRecord(day,key);
  const first = calculateStats(session.store.days,today);
  day.foundWords.push('inside','playtime');
  updateDayRecord(day,key);
  session.save();
  const restored = openStore(() => storage,today);
  assert.equal(calculateStats(restored.store.days,today).bestPoints, first.bestPoints + 15);
  assert.equal(calculateStats(restored.store.days,today).bestWords,10);
  prepareDay(restored.store,'2026-09-07',puzzle);
  assert.equal(calculateStats(restored.store.days,new Date(2026,8,7)).bestWords,10);
  recordHint(restored.store.days[key]);
  restartDay(restored.store,key,puzzle);
  assert.equal(calculateStats(restored.store.days,today).bestWords,10);
  assert.equal(calculateStats(restored.store.days,today).played,1);
  assert.equal(calculateStats(restored.store.days,today).hintDays,1);
  assert.equal(restored.store.days[key].archivedAttempts[0].foundWords.length,10);
});

test('best points and best words can belong to different days', () => {
  const stats = calculateStats({
    '2026-09-05': {foundWords:['playtime']},
    [key]: {foundWords:['cat','dog','sun','oak']},
  },today);
  assert.equal(stats.bestPoints,10);
  assert.equal(stats.bestWords,4);
});

test('played-day streaks ignore completion, opening-only days, future dates and invalid keys', () => {
  const days = {
    '2026-09-01':{foundWords:['cat']}, '2026-09-02':{foundWords:['cat']},
    '2026-09-03':{foundWords:[]}, '2026-09-04':{foundWords:['cat']},
    '2026-09-05':{foundWords:['cat']}, [key]:{foundWords:[]},
    '2026-09-07':{foundWords:['cat']}, '2026-02-30':{foundWords:['cat']}, bad:null,
  };
  assert.equal(calculateStats(days,today).currentStreak,2);
  assert.equal(calculateStats(days,today).played,4);
  days[key].foundWords.push('dog');
  assert.equal(calculateStats(days,today).currentStreak,3);
  assert.equal(calculateStats(days,new Date(2026,8,9)).currentStreak,0);
  assert.equal(calculateStats(days,new Date(2026,8,9)).longestStreak,4);
});

test('calendar streaks survive both DST transitions with yesterday grace', () => {
  const old = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    for (const [keys, now] of [
      [['2026-03-07','2026-03-08','2026-03-09'],new Date(2026,2,10,0,1)],
      [['2026-10-31','2026-11-01','2026-11-02'],new Date(2026,10,3,0,1)],
    ]) {
      const days = Object.fromEntries(keys.map(k=>[k,{foundWords:['cat']}]));
      assert.equal(calculateStats(days,now).currentStreak,3);
      now.setDate(now.getDate()+1);
      assert.equal(calculateStats(days,now).currentStreak,0);
    }
  } finally { if(old===undefined) delete process.env.TZ; else process.env.TZ=old; }
});

test('hint before first word does not count a visit; repeated reveals and reloads count once', () => {
  const storage = fakeStorage();
  const session = openStore(()=>storage,today);
  const day=prepareDay(session.store,key,puzzle);
  recordHint(day); day.hintRevealed=false; recordHint(day);
  assert.equal(calculateStats(session.store.days,today).played,0);
  assert.equal(calculateStats(session.store.days,today).hintDays,0);
  session.save();
  const next=openStore(()=>storage,today);
  const resumed=prepareDay(next.store,key,puzzle);
  resumed.foundWords.push('cat'); updateDayRecord(resumed,key);
  recordHint(resumed); next.save();
  const stats=calculateStats(openStore(()=>storage,today).store.days,today);
  assert.equal(stats.hintDays,1); assert.equal(stats.hintTrackedDays,1); assert.equal(stats.played,1);
});

test('known no-hint days count in denominator; unknown legacy visits stay unknown', () => {
  const store=migrateStore({days:{[key]:{puzzleId:puzzle.letters,foundWords:[],hintRevealed:false}}},today);
  prepareDay(store,key,puzzle).foundWords.push('cat');
  assert.equal(calculateStats(store.days,today).hintTrackedDays,0);
  const fresh=migrateStore({},today);
  prepareDay(fresh,key,puzzle).foundWords.push('cat');
  assert.equal(calculateStats(fresh.days,today).hintTrackedDays,1);
  assert.equal(calculateStats(fresh.days,today).hintDays,0);
});

test('storage read/corruption failures do not overwrite existing bytes', () => {
  for (const raw of ['{broken','null','[]','{"days":[]}']) {
    const storage=fakeStorage(raw); const session=openStore(()=>storage,today);
    assert.equal(session.save(),false); assert.equal(storage.read(),raw);
    assert.match(session.warning,/existing save has not been changed/);
  }
  const session=openStore(()=>{throw new Error('denied');},today);
  prepareDay(session.store,key,puzzle).foundWords.push('cat');
  assert.equal(session.save(),false);
});

test('storage write failure keeps the in-memory record and can recover', () => {
  const storage=fakeStorage(); let fail=true;
  const session=openStore(()=>({...storage,setItem:(...args)=>{
    if(fail) throw new Error('quota'); storage.setItem(...args);
  }}),today);
  const day=prepareDay(session.store,key,puzzle); day.foundWords.push('orange'); updateDayRecord(day,key);
  assert.equal(session.save(),false); assert.match(session.warning,/only in memory/);
  assert.equal(day.bestPoints,5); fail=false; assert.equal(session.save(),true);
  assert.equal(session.warning,''); assert.equal(openStore(()=>storage,today).store.days[key].bestPoints,5);
});

test('malformed day fields do not crash and original values remain recoverable', () => {
  const store=migrateStore({days:{bad:null,[key]:{puzzleId:puzzle.letters,foundWords:['cat',null,42],bestPoints:'bad'}}},today);
  assert.deepEqual(store.days[key].legacyFoundWords,['cat',null,42]);
  assert.equal(scoreWords(prepareDay(store,key,puzzle).foundWords),1);
  assert.equal(calculateStats(store.days,today).played,1);
});
