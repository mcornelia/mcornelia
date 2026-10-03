import test from "node:test";
import assert from "node:assert/strict";
import { LONG_WORD_LENGTH } from "../play/daily-fetch/game-engine.mjs";
import { VARIETY_PUZZLES as PUZZLES } from "../play/daily-fetch/puzzles-variety.mjs";
import { PUZZLES as LEGACY_PUZZLES } from "../play/daily-fetch/puzzles.mjs";
import { puzzleForDate, VARIETY_START_DAY } from "../play/daily-fetch/puzzle-schedule.mjs";
import { dateKey, puzzleIndexForDate, getObjectives } from "../play/daily-fetch/game-engine.mjs";
import { prepareDay, migrateStore } from "../play/daily-fetch/stats-store.mjs";

const SIZE = 4;
const neighbors = Array.from({ length: SIZE * SIZE }, (_, index) => {
  const row = Math.floor(index / SIZE);
  const column = index % SIZE;
  const result = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
      if (rowDelta === 0 && columnDelta === 0) continue;
      const nextRow = row + rowDelta;
      const nextColumn = column + columnDelta;
      if (nextRow >= 0 && nextRow < SIZE && nextColumn >= 0 && nextColumn < SIZE) result.push(nextRow * SIZE + nextColumn);
    }
  }
  return result;
});

const calendarDate = offset => {
  const utc = new Date((VARIETY_START_DAY + offset) * 86_400_000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12);
};

test("daily selection has no repeats across years, leap day, DST, or a cycle boundary", () => {
  // Two cycles also check the wrap; any sliding pack-length window is unique.
  const recent = new Set();
  const queue = [];
  for (let offset = 0; offset < PUZZLES.length * 2; offset += 1) {
    const date = calendarDate(offset);
    const puzzle = puzzleForDate(date);
    if (queue.length === PUZZLES.length) recent.delete(queue.shift());
    assert.ok(!recent.has(puzzle.secret), dateKey(date));
    recent.add(puzzle.secret);
    queue.push(puzzle.secret);
    for (const hour of [0, 8, 23]) {
      const sameDay = new Date(date); sameDay.setHours(hour);
      assert.equal(puzzleForDate(sameDay), puzzle);
    }
  }
  assert.deepEqual(puzzleForDate(calendarDate(PUZZLES.length)), PUZZLES[0]);
});

test("earlier dates keep their original boards", () => {
  for (let offset = -400; offset < 0; offset += 1) {
    const date = calendarDate(offset);
    assert.equal(puzzleForDate(date), LEGACY_PUZZLES[puzzleIndexForDate(date, LEGACY_PUZZLES.length)]);
  }
});

test("an existing legacy day's words, hints, completion and history survive the update", () => {
  for (const completed of [false, true]) {
    const date = calendarDate(5);
    const key = dateKey(date);
    const legacy = LEGACY_PUZZLES[puzzleIndexForDate(date, LEGACY_PUZZLES.length)];
    const words = [legacy.secret, ...legacy.words.filter(word => word !== legacy.secret)].slice(0, completed ? 8 : 2);
    const store = migrateStore({ days: {
      '2026-09-01': { foundWords: ['cat'], completedAt: null },
      [key]: { puzzleId: legacy.letters, foundWords: words, hintUsed: true,
        completedAt: completed ? date.toISOString() : null }
    } }, date);
    const before = structuredClone(store);
    const chosen = puzzleForDate(date, store.days[key]);
    assert.equal(chosen, legacy);
    prepareDay(store, key, chosen);
    assert.deepEqual(store, before);
    assert.equal(getObjectives(words, chosen.secret).complete, completed);
    assert.deepEqual(puzzleForDate(calendarDate(6)), PUZZLES[6]);
  }
});

test("saved new boards stay stable and stale legacy boards cannot pin another day", () => {
  const date = calendarDate(10);
  const key = dateKey(date);
  const puzzle = puzzleForDate(date);
  const store = migrateStore({ days: {} }, date);
  const saved = prepareDay(store, key, puzzle);
  saved.foundWords.push(puzzle.secret);
  assert.equal(puzzleForDate(date, saved), puzzle);
  assert.equal(prepareDay(store, key, puzzle), saved);
  const stale = LEGACY_PUZZLES[puzzleIndexForDate(calendarDate(9), LEGACY_PUZZLES.length)];
  assert.equal(puzzleForDate(date, { puzzleId: stale.letters }), puzzle);
});

function canTrace(board, word) {
  function visit(index, position, used) {
    if (board[index] !== word[position]) return false;
    if (position === word.length - 1) return true;
    return neighbors[index].some((next) => (used & (1 << next)) === 0 && visit(next, position + 1, used | (1 << next)));
  }
  return [...board].some((_, index) => visit(index, 0, 1 << index));
}

test("every new board and accepted word is playable, with distinct hidden words for over three years", () => {
  assert.ok(PUZZLES.length >= 1_200);
  assert.equal(new Set(PUZZLES.map(puzzle => puzzle.secret)).size, PUZZLES.length);
  const oldWords = new Set(LEGACY_PUZZLES.map(puzzle => puzzle.secret));
  assert.ok(PUZZLES.every(puzzle => !oldWords.has(puzzle.secret)));
  assert.equal(new Set(PUZZLES.map((puzzle) => puzzle.letters)).size, PUZZLES.length);
  for (const [index, puzzle] of PUZZLES.entries()) {
    assert.match(puzzle.letters, /^[a-z]{16}$/, `board ${index} has sixteen letters`);
    assert.ok(puzzle.words.length >= 25, `board ${index} has enough accepted words`);
    assert.equal(new Set(puzzle.words).size, puzzle.words.length, `board ${index} has no duplicate words`);
    assert.ok(puzzle.words.includes(puzzle.secret), `board ${index} contains its hidden ball word`);
    assert.ok(puzzle.secret.length >= LONG_WORD_LENGTH, `board ${index} ball word also satisfies the long throw`);
    assert.ok(puzzle.words.every((word) => canTrace(puzzle.letters, word)), `board ${index} contains a valid path for every accepted word`);
  }
});
