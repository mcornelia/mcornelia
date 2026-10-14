# Three playtest recommendations: local revision

Based on published main `7f0197a`; branch `codex/fetch-race-playability`. This revision is local only. No deployment, push, live game action, credential change, or message to Aimee was performed.

## Before and after

| Finding | Revised behavior | Evidence |
| --- | --- | --- |
| Meadow C3–C4 and E3–E4 opening cuts each added 8 opponent steps for 0 self steps | Each now adds 4 opponent steps for 0 self steps | Exhaustive initial legal-fence check: no opening fence adds more than 4 steps to either player |
| 390×844 phone required board/control scrolling | Modes above the board; preview and deliberate Confirm directly below it, all visible together | WebKit board y=312–664; Confirm y=746–790, versus prior board y=478–812 and Confirm y=1228–1276 |
| Terminal screen advanced to nonexistent turn 45/71/75 and retained active-play directions | Dedicated winner/tie panel, completed counts 44/70/74, per-player counts, finish explanation and rematch controls | Chromium/WebKit fixtures cover tie, starter win after the final response, second-player win, both starters, and invitation versions excluded from move counts |

Meadow is now `meadow-crossroads-v4`. The only fixed-fence change moves A4–B4 and its mirror F4–G4 to A2–B2 and F2–G2. Fourteen fixed fences, six placeable fences, two sprints, 24 walking steps and 22 optimal movement turns remain unchanged. Shortest outbound paths increase from 8 to 12 for each player. All 43 lawn squares remain reachable; every ball/home route still crosses D4, with three viable approaches per side. The four-step target is an experiment for the next qualitative games, not a claim of perfect balance.

North and South retain their published v3 definitions. North's late B7–C7 fence remains legal and still moves Mike from one step home to five. All published classic/v2/v3 geometries and completed-game transitions remain unchanged.

New invitations upgrade an old queued Meadow ID to v4. Already pending invitations retain the exact board they promised. Protocol 4 prevents cached clients from rendering an unknown v4 race or invitation, while protocol 3 can still read/play an existing unmodified v3 race. The new app retains access-phrase compatibility; no authentication implementation or credential verifier was changed.

The mobile decision strip stays in document flow rather than floating over lawn squares or a keyboard. The active header is compact; legal previews, 44px confirmation, sound, reduced motion, and Olive's ball remain. Both board and Confirm fit together at 320×844 and 390×844. Smaller usable heights can still scroll normally. Finished screens remove active controls and instructions, explain equal-turn outcomes, show unused resources, and bring the result into view. Rematch actions still require the existing deliberate invitation/acceptance flow.

## Automated verification

- `npm test`: 39/39 passed, including 40 complete revised-crossroads invariant games and 49,256 accepted fence continuations. Every accepted fence preserves both objectives and mandatory shared crossing.
- Complete phone gameplay regressions passed in Chromium and WebKit. Includes independent identities, turn enforcement, double-click, response loss/reload retry, reconnect, finishing, mutual rematches/decline, varied layouts, mobile width, audio, and storage isolation.
- Chromium and WebKit phone-layout/result tests passed, including 44/70/74 completed-turn scenarios and both win explanations.
- Chromium and WebKit access regressions passed: visible login, retained errors, stale sessions, blocked storage, self-service confirmation/retries and exact race preservation.
- Worker dry-run bundle passed (24.19 KiB / 7.73 KiB gzip). No deployment.

## Independent three-game QA handoff

Use this worktree or create a separate worktree from the exact handoff commit:

```
/Users/glyph/Documents/Codex/2026-10-13/task/olives-fetch-race-playability
```

From `_services/olives-fetch-race`, run:

```sh
PREVIEW_PORT=4193 WORKER_PORT=8917 TEST_LAYOUT=meadow-crossroads-v4 npm run dev
```

Open these in separate browser profiles/contexts:

- Mike: `http://127.0.0.1:4193/review/mike`
- Aimee: `http://127.0.0.1:4193/review/aimee`

The launcher creates fresh local state and ephemeral dummy identities; it does not read production keys. Stop with Ctrl-C. Use unused alternate ports if another reviewer is already running those ports. `TEST_LAYOUT=north-crossroads-v3` or `south-crossroads-v3` selects a different fresh local board, or use the ordinary mutual rematch flow to cycle the three gardens.

Play three complete UI games on the exact revision: test the revised Meadow opening attacks and their alternatives, retain a late tactical ambush, and assess the board/preview/Confirm flow and actual terminal screens. Report any improvements before publication review. No publication is authorized by this handoff.

Targeted commands:

```sh
npm test
npm run test:playability-ui
TEST_BROWSER=webkit npm run test:playability-ui
npm run test:access-ui
TEST_BROWSER=webkit npm run test:access-ui
TEST_LAYOUT=meadow-crossroads-v4 npm run test:e2e
TEST_BROWSER=webkit TEST_LAYOUT=meadow-crossroads-v4 npm run test:e2e
BASELINE_REPO=/path/to/published-checkout node test/compare-phone.mjs
```

Screenshots are under `_services/olives-fetch-race/test-results-playability/` (ignored by Git). `before-390-full.png` and `after-390-full.png` provide the measured layout comparison; `webkit-390-preview.png` and `webkit-finish-70-1.png` provide focused review screens without credentials.

Confirmed Library review images: phone preview `libfile_41bb384829008191a0a68332bb41b8b3`; finish panel fixture `libfile_be8b45c9117c8191bd838a8a66ab2131`. Neither contains credentials.

One initial full WebKit run completed its gameplay assertions but failed the final no-page-errors check with a native access-control message during intentionally interrupted networking. A fresh rerun with phase diagnostics passed all assertions with no page errors; the isolated WebKit access/reconnect suites also passed. Keep reconnect/reload behavior in the independent QA checks.
