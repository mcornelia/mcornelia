import test from "node:test";
import assert from "node:assert/strict";
import { calculateStats, createShareText, getObjectives, scoreWords } from "../play/daily-fetch/game-engine.mjs";

test("daily results and sharing include words found after completing the goals", () => {
  const foundWords = ["cat", "dog", "fetch", "orange", "sun", "rain", "oak", "ball"];
  assert.equal(getObjectives(foundWords, "orange").complete, true);
  const firstScore = scoreWords(foundWords);
  const completedAt = "2026-09-06T12:00:00Z";
  const days = { "2026-09-06": { foundWords, completedAt } };
  foundWords.push("inside", "playtime");
  const restored = JSON.parse(JSON.stringify(days));
  const finalWords = restored["2026-09-06"].foundWords;
  assert.equal(scoreWords(finalWords), firstScore + 15);
  assert.equal(restored["2026-09-06"].completedAt, completedAt);
  assert.equal(calculateStats(restored, new Date(2026, 8, 6)).completed, 1);
  const text = createShareText({ dayNumber: 249, foundWords: finalWords, secret: "orange", completed: true, streak: 1 });
  assert.ok(text.includes(`${firstScore + 15} points · 10 words`));
  assert.match(text, /Ball found!/);
  assert.doesNotMatch(text, /orange|inside|playtime/);
});
