import { MODERN_PUZZLES, RELEASE_LEGACY_PUZZLE } from './puzzles-modern.mjs?v=20261004-modern';
import { PUZZLES as LEGACY_PUZZLES } from './puzzles.mjs';
import { puzzleIndexForDate } from './game-engine.mjs?v=20261004-four-letters';

// Local calendar dates select the same puzzle on every device. Keep earlier
// boards stable, including the day this change was prepared.
export const VARIETY_START_DAY = Date.UTC(2026, 9, 4) / 86_400_000;

export function puzzleForDate(date, savedDay) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
  const legacy = LEGACY_PUZZLES[puzzleIndexForDate(date, LEGACY_PUZZLES.length)];
  if (day < VARIETY_START_DAY) return legacy;

  if (day >= VARIETY_START_DAY) {
    if (day === VARIETY_START_DAY && savedDay?.puzzleId === RELEASE_LEGACY_PUZZLE.letters) {
      // Keep a completed legacy catch replayable; new submissions still use the curated list.
      return savedDay.completedAt
        ? { ...RELEASE_LEGACY_PUZZLE, secret: legacy.secret }
        : RELEASE_LEGACY_PUZZLE;
    }
    return MODERN_PUZZLES[(day - VARIETY_START_DAY) % MODERN_PUZZLES.length];
  }

}
