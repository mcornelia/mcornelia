export const BOARD_SIZE = 4;
export const WORD_GOAL = 8;
export const LONG_WORD_LENGTH = 6;

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function puzzleIndexForDate(date, puzzleCount) {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return ((dayNumber % puzzleCount) + puzzleCount) % puzzleCount;
}

export function isAdjacent(first, second, size = BOARD_SIZE) {
  if (first === second || first < 0 || second < 0 || first >= size * size || second >= size * size) return false;
  const firstRow = Math.floor(first / size);
  const firstColumn = first % size;
  const secondRow = Math.floor(second / size);
  const secondColumn = second % size;
  return Math.abs(firstRow - secondRow) <= 1 && Math.abs(firstColumn - secondColumn) <= 1;
}

export function canAddToPath(path, index, size = BOARD_SIZE) {
  if (path.includes(index)) return false;
  return path.length === 0 || isAdjacent(path.at(-1), index, size);
}

export function wordFromPath(path, letters) {
  return path.map((index) => letters[index]).join("").toLowerCase();
}

export function pointsForWord(word) {
  const length = word.length;
  if (length < 3) return 0;
  if (length === 3) return 1;
  if (length === 4) return 2;
  if (length === 5) return 3;
  if (length === 6) return 5;
  if (length === 7) return 7;
  return 10 + (length - 8) * 2;
}

export function evaluateWord({ word, foundWords, acceptedWords }) {
  const normalized = word.toLowerCase();
  if (normalized.length < 3) return { accepted: false, reason: "short", word: normalized };
  if (foundWords.includes(normalized)) return { accepted: false, reason: "duplicate", word: normalized };
  if (!acceptedWords.includes(normalized)) return { accepted: false, reason: "invalid", word: normalized };
  return { accepted: true, reason: "accepted", word: normalized, points: pointsForWord(normalized) };
}

export function getObjectives(foundWords, secret) {
  const wordCount = foundWords.length;
  const longest = foundWords.reduce((maximum, word) => Math.max(maximum, word.length), 0);
  const wordGoal = wordCount >= WORD_GOAL;
  const longGoal = longest >= LONG_WORD_LENGTH;
  const secretGoal = foundWords.includes(secret);
  return {
    wordCount,
    longest,
    wordGoal,
    longGoal,
    secretGoal,
    complete: wordGoal && longGoal && secretGoal,
  };
}

export function scoreWords(foundWords) {
  return foundWords.reduce((total, word) => total + pointsForWord(word), 0);
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function calculateStats(days, today = new Date()) {
  const retainedDays = Object.entries(days).filter(([key, day]) =>
    /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDateKey(key)) === key &&
    day && typeof day === "object" && key <= dateKey(today));
  const completedKeys = retainedDays.filter(([, day]) => Boolean(day.completedAt)).map(([key]) => key);
  const playedDays = retainedDays.filter(([, day]) =>
    Boolean(day.playedAt || day.completedAt) || (Array.isArray(day.foundWords) && day.foundWords.length > 0));
  const playedKeys = playedDays.map(([key]) => key).sort();
  const played = new Set(playedKeys);
  let longestStreak = 0;
  let running = 0;
  let previous = null;

  for (const key of playedKeys) {
    const current = parseDateKey(key);
    const consecutive = previous && dateKey(addDays(previous, 1)) === key;
    running = consecutive ? running + 1 : 1;
    longestStreak = Math.max(longestStreak, running);
    previous = current;
  }

  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(addDays(today, -1));
  let cursor = played.has(todayKey) ? parseDateKey(todayKey) : played.has(yesterdayKey) ? parseDateKey(yesterdayKey) : null;
  let currentStreak = 0;
  while (cursor && played.has(dateKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    played: playedDays.length,
    bestPoints: Math.max(0, ...playedDays.map(([, day]) => Math.max(
      Number.isFinite(day.bestPoints) ? day.bestPoints : 0,
      scoreWords(Array.isArray(day.foundWords) ? day.foundWords.filter(word => typeof word === "string") : [])))),
    bestWords: Math.max(0, ...playedDays.map(([, day]) => Math.max(
      Number.isFinite(day.bestWords) ? day.bestWords : 0,
      Array.isArray(day.foundWords) ? day.foundWords.filter(word => typeof word === "string").length : 0))),
    hintDays: playedDays.filter(([, day]) => day.hintUsed === true || day.hintRevealed === true).length,
    hintTrackedDays: playedDays.filter(([, day]) => day.hintHistoryKnown === true || day.hintUsed === true || day.hintRevealed === true).length,
    completed: completedKeys.length,
    currentStreak,
    longestStreak,
  };
}

export function createShareText({ dayNumber, foundWords, secret, completed, streak }) {
  const objectives = getObjectives(foundWords, secret);
  const paws = [objectives.wordGoal, objectives.longGoal, objectives.secretGoal]
    .map((done) => (done ? "🐾" : "▫️"))
    .join("");
  const status = completed ? "Ball found!" : `${objectives.wordCount}/${WORD_GOAL} words`;
  return `The Daily Fetch #${dayNumber}\n${paws} ${status}\n${scoreWords(foundWords)} points · ${foundWords.length} words\n🔥 ${streak} day streak\nhttps://mcornelia.com/play/daily-fetch/`;
}
