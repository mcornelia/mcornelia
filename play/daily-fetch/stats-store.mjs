import { dateKey, scoreWords } from './game-engine.mjs?v=20260906-stats';

export const STORAGE_KEY = 'ravenwood.dailyFetch.v1';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validWords = value => Array.isArray(value) ? [...new Set(value.filter(word => typeof word === 'string' && /^[a-z]{3,}$/i.test(word)).map(word => word.toLowerCase()))] : [];
const nonnegative = value => Number.isFinite(value) && value >= 0 ? value : 0;

// Add fields without replacing legacy properties or aggregates. Incomplete legacy
// hint flags are unknown: "hidden" never proved that a hint was not used.
export function migrateStore(input, today = new Date()) {
  const store = object(input) ? structuredClone(input) : {};
  if (!object(store.days)) {
    if (store.days !== undefined) store.legacyDays = store.days;
    store.days = {};
  }
  store.statsVersion = 2;
  store.hintTrackingSince ??= dateKey(today);
  for (const [key, value] of Object.entries(store.days)) {
    if (!object(value)) continue; // Keep unrecognized records intact, outside active statistics.
    const words = validWords(value.foundWords);
    if (JSON.stringify(words) !== JSON.stringify(value.foundWords ?? [])) value.legacyFoundWords ??= value.foundWords;
    value.foundWords = words;
    updateDayRecord(value, key);
    if (value.hintRevealed === true) value.hintUsed = true;
    if (value.hintUsed === true) value.hintHistoryKnown = true;
    else if (value.hintHistoryKnown !== true) value.hintHistoryKnown = false;
  }
  return store;
}

export function updateDayRecord(day, key) {
  if (day.foundWords.length > 0 || day.completedAt) day.playedAt ||= key;
  day.bestPoints = Math.max(nonnegative(day.bestPoints), scoreWords(day.foundWords));
  day.bestWords = Math.max(nonnegative(day.bestWords), day.foundWords.length);
}

export function prepareDay(store, key, puzzle) {
  const previous = store.days[key];
  if (object(previous) && previous.puzzleId === puzzle.letters) {
    // Keep accepted saved words, even if a later dictionary revision drops them.
    return previous;
  }
  const day = {
    ...(object(previous) ? previous : {}),
    puzzleId: puzzle.letters, foundWords: [], completedAt: null, celebrationSeenAt: null,
    startedAt: new Date().toISOString(), hintHistoryKnown: object(previous) ? previous.hintHistoryKnown === true : true,
  };
  if (previous !== undefined) day.archivedAttempts = [...(Array.isArray(day.archivedAttempts) ? day.archivedAttempts : []), structuredClone(previous)];
  store.days[key] = day;
  return day;
}

export function recordHint(day) {
  day.hintUsed = true;
  day.hintHistoryKnown = true;
}

export function restartDay(store, key, puzzle) {
  const previous = store.days[key];
  updateDayRecord(previous, key);
  store.days[key] = {
    ...previous, foundWords: [], completedAt: null, celebrationSeenAt: null,
    hintRevealed: false, puzzleId: puzzle.letters, startedAt: new Date().toISOString(),
    archivedAttempts: [...(Array.isArray(previous.archivedAttempts) ? previous.archivedAttempts : []), { ...previous, archivedAttempts: undefined }],
  };
  return store.days[key];
}

// Corrupt/unreadable saves are never overwritten by a fresh empty game.
// Storage is injected so failure paths and fixtures use no real browser data.
export function openStore(storageProvider, today = new Date()) {
  let writable = true;
  let warning = '';
  let value;
  try {
    const raw = storageProvider().getItem(STORAGE_KEY);
    value = raw === null ? {} : JSON.parse(raw);
    if (!object(value) || (value.days !== undefined && !object(value.days))) throw new Error('Invalid save');
  } catch {
    writable = false;
    warning = 'Saved progress could not be read. This session is temporary; the existing save has not been changed.';
    value = {};
  }
  const store = migrateStore(value, today);
  return {
    store,
    get warning() { return warning; },
    save() {
      if (!writable) return false;
      try {
        storageProvider().setItem(STORAGE_KEY, JSON.stringify(store));
        warning = '';
        return true;
      } catch {
        warning = 'Progress is only in memory right now. This browser could not save it; keep this page open.';
        return false;
      }
    },
  };
}
