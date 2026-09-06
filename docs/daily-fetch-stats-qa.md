# Daily Fetch stats: local QA handoff

Status: implemented and locally tested; **not pushed or published**. Scout should perform independent QA and obtain user approval before publication. Branch: `feature/daily-fetch-stats`, based on the already-published results-button change.

## Preview

Running on `http://127.0.0.1:4331/`:
- `/game/`: production-code preview on a separate local origin. Its test save currently contains one accepted word; it is unrelated to the public game's saves.
- `/legacy/`: memory-only fixture with four old played days and today's completed eight-word game. Reload resets this fixture by design.
- `/blocked/`: storage-unavailable fixture with a persistent warning and playable board.

Rebuild fixture copies after edits: `node scripts/preview-daily-fetch-stats.mjs`. It prints the temporary directory and server command. No fixture injection ships in the game. The server is loopback-only.

## Behavior and decisions

- Prominent **Your Stats** button above the board opens the labeled native dialog on demand. The header icon still works. No new stats appear automatically or on Olive's victory screen; its existing three totals and replay animation remain intact.
- Today's points/words and separate Best points/Best words use all current accepted words, including finds after the win. Records may come from different days.
- Days played and both streaks use at least one accepted word. A retained legacy completion is accepted as proof of past play. Opening a day is not play. Current streak uses today if played, otherwise yesterday's grace; a missing calendar day breaks it. Calendar arithmetic uses local dates, not elapsed 24-hour periods. Invalid/future date records are excluded from current stats but retained in storage.
- Hint days use a sticky `hintUsed` flag. Repeated reveals, hiding, replaying, reload, or restarting never add another day. Hint-before-first-word remains pending until that day is played.
- Legacy `hintRevealed: true` proves a hint was used. False/missing does not prove no hint was used, because old hide actions erased that information. The hint denominator includes only played days with known history; a nearby message explicitly counts/excludes unknown days. No no-hint statistic was added. New days have complete tracking. Old unknown history is not invented, even when the saved day was only a visit.

## Storage and migration

Still exclusively browser-local, same `ravenwood.dailyFetch.v1` key; additive `statsVersion: 2`. No backend, accounts, database, or sync.

`stats-store.mjs` preserves existing top-level/day fields and aggregates, adds `playedAt`, per-day bests, sticky hint tracking and a tracking-start date. Retained words reconstruct records/streaks; saved words are not discarded when the dictionary changes. Malformed word fields are preserved under `legacyFoundWords` before normalization. Unknown day entries remain retained. A puzzle replacement archives the previous day state. Explicit Start today over now archives the prior attempt and keeps records/play/hint history instead of destroying it.

Corrupt or unreadable whole saves are not overwritten: a temporary in-memory session and persistent warning are shown. Failed writes retain the in-memory data and can retry; the UI advises keeping the page open. Midnight/focus checks only reload for a new local day after a successful save; they do not discard an unsaved session. These checks also guard submit, hint, stats, share, and replay actions.

All-time records reflect retained local history. History cleared before this update, including previously reset attempts, cannot be recovered. No historical totals are fabricated. Closing an unsavable session still loses that temporary session, as its warning explains.

## Validation

- `node --test tests/*.test.mjs`: 11 passed in public checkout.
- `npm test --prefix ../ravenwood-games`: 23 passed, including the existing annual puzzle validity suite.
- Syntax check and `git diff --check`: passed.
- Focused tests cover legacy preservation/idempotency, independent bests, post-win increases, reload/day changes/reset retention, played-day streaks without completion, missing days, both US DST transitions, once-per-day hints before/after a word and reload, unknown hints, invalid JSON/denied reads, quota/write recovery, and malformed day fields.
- Browser: desktop 1280x720, mobile 390x844 and 375x667. Modal has no horizontal overflow; keyboard Tab reaches bottom actions through scrolling. Enter opens, Escape closes and restores focus to Your Stats.
- Legacy fixture: 17 points/8 words, Best points 30, Best words 8, 5 played days/current/longest streak; one known hinted day and four explicitly unknown days. After entering DIP through the board, replay shows 18 points/9 words/5-day streak; stats show Best words 9 while Best points stays 30. No stats modal opens during catch.
- Fresh separate-origin browser preview: entered DIP, reloaded, confirmed 1 point/1 word, record 1, played/streak 1, hints 0 of 1.
- Blocked-storage browser fixture: persistent warning visible and all 16 board tiles rendered. No real/public browser save was inspected or modified.

## Changed copies

Public checkout `/Users/glyph/Library/CloudStorage/Dropbox/Codex/mcornelia-site`:
- `play/daily-fetch/app.mjs`
- `play/daily-fetch/game-engine.mjs`
- `play/daily-fetch/index.html`
- `play/daily-fetch/styles.css`
- new `play/daily-fetch/stats-store.mjs`
- new `tests/daily-fetch-stats.test.mjs`
- new `scripts/preview-daily-fetch-stats.mjs`
- this handoff document

Matching source edits in `/Users/glyph/Library/CloudStorage/Dropbox/Codex/ravenwood-games` (not a Git checkout): the same five game files under `public/games/daily-fetch/`, new `tests/daily-fetch-stats.test.mjs`, and existing `tests/game-engine.test.mjs` updated for played-day streak expectations. Source-specific sound default and public favicon differences are preserved.

Public GitHub Pages and the installed LAN copy under `/Users/glyph/Applications/ravenwood-games` remain unchanged. No push, PR, merge, deployment or service restart was performed. Agent Office was untouched.

## Scout-requested readability polish

Implementation commit: `879b8e1` (on top of `e194ea1`). Scoped to the stats dialog tile labels and singular hint wording; equivalent source companion files updated. No outgoing Scout message retried.

- All seven tile labels now measure **14px**, `rgb(174, 180, 169)` (`--muted`) at desktop 1280×720 and mobile 375×667.
- Measured tile background: `rgba(255,255,255,0.024)` over dialog `rgb(32,44,38)`. Composited contrast is approximately **6.36:1** using sRGB relative luminance.
- At 375px, all three history labels wrap to two lines (39px tall, 78px wide). Their scroll widths equal their client widths; modal content/client width both 335px; page width remains 375px. Desktop labels remain on one line. Screenshots visually checked at both sizes.
- Hint summary verified in the legacy fixture: “Hints used on 1 of 1 day played.” Zero/multiple tracked days continue to use “days.”
- Public tests 11/11 and source tests 23/23 pass again; diff whitespace check passes.
- Existing 4331 fixtures regenerated from the final code. Browser viewport restored after QA. Nothing pushed, merged, published, installed, or changed in real game saves.
