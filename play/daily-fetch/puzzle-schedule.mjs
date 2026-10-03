import { PUZZLES as LEGACY_PUZZLES } from './puzzles.mjs';
import { VARIETY_PUZZLES } from './puzzles-variety.mjs?v=20261003-variety';
import { puzzleIndexForDate } from './game-engine.mjs?v=20260907-longest-word';

// Local calendar dates select the same puzzle on every device. Keep earlier
// boards stable, including the day this change was prepared.
export const VARIETY_START_DAY = Date.UTC(2026, 9, 4) / 86_400_000;

export function puzzleForDate(date, savedDay) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
  const legacy = LEGACY_PUZZLES[puzzleIndexForDate(date, LEGACY_PUZZLES.length)];
  if (day < VARIETY_START_DAY) return legacy;

  // An older tab may already have started today's old board before updating.
  // Finish that board without clearing its words, hints, or completed result.
  // Only honor the legacy board for THIS date, not a previous day's save.
  if (savedDay?.puzzleId === legacy.letters) return legacy;
  return VARIETY_PUZZLES[(day - VARIETY_START_DAY) % VARIETY_PUZZLES.length];
}
