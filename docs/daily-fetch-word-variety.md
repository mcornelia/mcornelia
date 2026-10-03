# Daily Fetch word variety

The original pack has 365 boards but only 16 different hidden ball words. The
new pack has 1,297 unique boards and 1,297 distinct everyday hidden words. A word
does not return for 1,297 days (about 3.5 years). Ordinary bonus words can still
appear on multiple boards. Every hidden word is at least six letters and still
satisfies the long-throw objective; Olive's theme and the eight-word goal remain.

## Selection and existing saves

`puzzle-schedule.mjs` uses the player's local calendar date, with a fixed start
date of October 4, 2026. Earlier dates keep the original schedule. New dates
advance through the shuffled pack in order, including across year boundaries,
leap days, and daylight-saving changes. The pack cycles after day 1,297.

If the browser already saved that date's legacy board before receiving this
release, it finishes the saved board. No saved words, hints, completion, or
history are cleared. Its next unstarted date uses the new schedule. During
this transition, someone finishing an older board may see a different puzzle
from someone starting that day's new board.

The old pack stays available for those saves. Game scripts and the new pack have
versioned imports. No storage schema, public URL, or household redirect changes.

## Rebuilding and validating

The source list is `scripts/daily-fetch-words.txt`. The generator uses that list
for hidden words and the macOS `/usr/share/dict/words` dictionary plus existing
custom words for accepted words. It rejects duplicate hidden words and boards,
and requires at least 25 accepted words on every board.

```sh
node scripts/build-daily-fetch-puzzles.mjs
node --test tests/daily-fetch*.test.mjs
TZ=America/New_York node --test tests/daily-fetch-puzzles.test.mjs
TZ=Pacific/Auckland node --test tests/daily-fetch-puzzles.test.mjs
```

Freeze the pack and its ordering once published. Appending words changes the
cycle length and reshuffling changes date assignments. Future expansions need
a versioned pack and a deliberate transition, rather than overwriting this one.

## Validation on October 3, 2026

- 17 Daily Fetch tests passed, including exhaustive path validation for every
  accepted word on all 1,297 boards and two full schedule cycles without a
  repeat inside any 1,297-day window.
- Schedule tests passed in both New York and Auckland timezones, covering leap
  day, both DST changes, historical dates, cycle wrap, and legacy/new saved games.
- Two builds produced identical puzzle data (SHA-256
  `312d3a449ea407dbbbda9f0d3151b8b916bd5891aef49d6863aab0e6944122be`).
- Browser QA used an isolated loopback preview with the October 4 board selected
  on the current date. Confirmed hint text, keyboard word entry, six-letter and
  hidden-word objectives, five-point score, reload persistence, and updated help.
  The normal pointer click did not activate the preview hint in the browser tool;
  keyboard activation succeeded. No pointer-handling code changed.
- Public browser saves were not accessed. Publishing remains pending approval.

The larger pack is about 1.33 MB before HTTP compression. The old pack is retained
for compatibility, so this release increases the initial download size.
