# Olive’s Fetch Race

A competitive asynchronous garden strategy game for Mike and Aimee. Built in an isolated clone on `codex/olives-fetch-race`, from published `origin/main` commit `5a553937` (PR #23). No applicable AGENTS.md or .agents/skills files were present in the source checkout. Existing project documentation and the Worker/test architecture were inspected before implementation.

**Publication approved by Mike on October 13, 2026.** The separate Worker is deployed at `https://olives-fetch-race.mike-cornelia.workers.dev`. Two private game-only player keys are provisioned; only their hashes are stored by the Worker. Raw keys remain in owner-only files outside this repository. Tired Dogs source, hosting configuration, player keys, and live state remain unchanged. Nothing has been sent to Aimee.

The existing Cloudflare dashboard confirmed **Free ($0), Current plan** immediately before deployment. The existing grant was sufficient: Account Read, Workers Scripts Write, and Background Access. No paid service, new account credential, permission expansion, DNS change, or billing change was made. The GitHub Pages route is `https://mcornelia.com/play/olives-fetch-race/`; merging this game’s approved PR publishes it.

**Current local revision is not approved for publication.** The crossed routes, varied gardens, and mutual rematches are documented in [Crossing Garden review](crossing-garden-review.md). The publication approval above applies to the already-published original game, not these new changes.

## Teach it in a minute

- Fetch your matching ball at the far end of the 7×7 garden, then return to your matching home. Mike and Aimee alternate turns. There is no clock or daily reset.
- On your turn, **walk one square**, **sprint two clear squares in a straight line**, or **place one fence between adjacent lawn squares**. Preview first, then confirm.
- Each player gets **two sprints and six fences for the whole race**. A fence consumes a full turn, blocks both players, and stays in place. Flower beds and fences cannot be crossed. Fixed garden fences are part of the selected layout and do not consume either supply.
- Crossing your ball collects it; crossing home with the ball finishes immediately. Players can share or pass through squares, so a player can never imprison the other by standing still.
- A proposed fence is rejected unless both players can still reach their ball and home. The preview shows each player’s remaining walking steps and the detour caused by the fence. The number includes the return trip and does not account for sprints; players work out their own routes. Balls and houses use player colors plus initials, with full player names on homes and accessible board-cell labels.
- If the starting player finishes first, the other player has one last turn to tie. If both finish in the same pair of turns, it’s a tie. Otherwise the first home wins.

New races cross the ball destinations: Mike goes B7→F1→B7; Aimee goes F7→B1→F7. Three validated gardens rotate, each with ten fixed fences and north, middle, and south crossing alternatives. Crossing Garden starts at 20 walking steps per player; North Bend and South Bend each start at 24. Existing races retain their original layout.

A new-race invitation requires the other player's acceptance. Either can decline/withdraw, and playing a move cancels the invitation. Accepted races alternate the starter and preserve the previous state in a private archive. No unilateral reset, analytics, chat, timers, matchmaking, or public room creation.

## Local review

From `_services/olives-fetch-race/`:

```sh
npm ci
npm run dev
```

The review harness opens loopback-only services and prints these non-secret local entry points:

- Mike: `http://127.0.0.1:4183/review/mike`
- Aimee: `http://127.0.0.1:4183/review/aimee` in a separate browser profile/private window

These are disposable local test identities, generated only in the harness process. The harness securely injects a temporary identity into the chosen browser, then removes the entry route from the address bar. No key is printed or encoded in a URL. Stopping the process removes its temporary server state. A fresh launch intentionally starts a fresh **local test** room; this has no connection to either production game. Use Ctrl-C to stop.

The current checkout reuses already installed dependencies through an ignored node_modules symlink. `npm ci` gives a portable dependency install. Node 22+ and a compatible Playwright browser are required. The harness binds Worker port 8887; integration tests use 8890–8894. Do not run browser suites concurrently on the same ports or stop unrelated services to claim a port.

## Verification

```sh
npm test
TEST_OUTPUT=test-results/crossing-legacy npm run test:e2e
TEST_LAYOUT=crossing-v2 TEST_OUTPUT=test-results/crossing-chromium npm run test:e2e
TEST_LAYOUT=crossing-v2 TEST_BROWSER=webkit TEST_OUTPUT=test-results/crossing-webkit npm run test:e2e
node test/review-shots.mjs
XDG_CONFIG_HOME=/tmp/fetch-race-build-config WRANGLER_SEND_METRICS=false npm run check:deploy
```

Verified locally on October 13, 2026:

- **20 engine/integration tests passed.** Forty complete varied-garden races checked **66,237 accepted fence continuations** and **166,219 rejected candidates**. Seven sequential rematches checked layout rotation, alternating starters, tie opportunities, invitation cancellation, self-accept rejection, stale/duplicate requests, archived snapshots, and persistence. The classic engine remains byte-equivalent for existing play. Separately, Sixty seeded complete races checked **110,198 accepted fence continuations** and **158,910 rejected candidate placements**. Every accepted continuation retained routes to each outstanding objective. Tests cover equal starting distances, useful asymmetric detours, resource exhaustion, immutable state, no row-wrap or diagonal movement, bidirectional walls, last-exit rejection, ball/home crossing, equal-turn ties and both winner boundaries.
- **Actual workerd + SQLite Durable Object**, not a mocked transport: auth and CORS, wrong-player rejection, 12 simultaneous identical requests applied exactly once, competing distinct requests resolved 200/409, stale versions, changed-ID payload rejection, invalid moves, body limits, persistent state after Worker restart, and idempotent replay after restart. Unprovisioned secrets fail closed.
- **Chromium and WebKit**, independent 390px phone contexts: last-move/turn synchronization, preview without mutation, double clicks sent one request, server commit with lost response recovered across reload without replaying the action, offline reconnect, shared finish, three successive varied rematches, mutual acceptance/refusal, rematch response loss and reload retry, 320px overflow checks, uniform board rows, keyboard ball, reduced motion, and no page errors. A delayed old poll cannot replace a newer confirmed state.
- Sound is on by default. The first ordinary pointer or keyboard interaction activates AudioContext; there is no enable-sound gate. Quiet synthesized cues accompany controls and moves. Explicit mute persists through reload. Initial load/rejoin and replayed moves are silent; polls never replay cues. No microphone or audio downloads. WebKit tests verify browser behavior, not physical iPhone speaker/silent-mode audibility.
- Separate Worker (`olives-fetch-race`), Durable Object class (`FetchRaceRoom`), binding (`FETCH_ROOM`), named room (`olives-fetch-race-v1`), secret names (`FETCH_MIKE_KEY_HASH`, `FETCH_AIMEE_KEY_HASH`), and browser prefix (`olives-fetch-race:v1:`). Browser tests preserve an unrelated Tired Dogs storage sentinel. `git diff origin/main -- play/tired-dogs _services/tired-dogs` is empty. No requests were sent to the live Tired Dogs backend.
- Deployment **dry run only** passed: Worker bundle 14.88 KiB, 5.13 KiB gzip. No resources were created remotely.

Review screenshots are in ignored `_services/olives-fetch-race/test-results/crossing-review/`: `crossing-garden-mobile.png`, `crossing-garden-desktop.png`, `north-bend-mobile.png`, and `south-bend-mobile.png`. They show disposable local play, with no keys. Confirmed Library identities are reported with the review.

## Storage and failure behavior

The browser stores this game’s provided player key, mute preference, and pending operation under its own prefix. Leave clears the key and pending operation. This is possession-based access; a key grants that player’s moves. Never paste keys into public URLs, logs, screenshots, code, or chat. Remembered keys share the trusted mcornelia.com origin, as with the existing game; scripts on that origin must remain trusted.

The server authenticates before accessing the room. It stores the current game, archived previous races, and the last 257 operation receipts. Movement checks identity, turn, version, resources, and route validity in the same synchronous SQLite transaction as its receipt and state update. Old receipts may be pruned, but the monotonically increasing version still rejects old writes. The client saves the exact pending operation before sending; storage failure blocks sending, and timeouts retain that operation for retry. Mutual rematches archive the previous race atomically and never reset the shared version. Invitations identify the exact race/proposal; old requests cannot reset a later game. A protocol header and versioned client entry prevent cached classic clients from rendering or mutating a new garden until refreshed. State is never reset on reconnect. A disconnected or quota-limited client cannot silently create a separate local race.

## Release procedure and authorization

This revision requires separate publication approval. Follow the exact migration procedure in [Crossing Garden review](crossing-garden-review.md): deploy the compatible Worker first, publish the versioned Pages client, and verify that the current live race is unchanged. Use existing player credentials without reading them into logs or rotating them. Keep the production room and initializer as they are. Both players later choose when to start the next garden through the mutual invitation flow; deployment itself must not start or reset a race.

Any PR must be draft until approved. No Aimee message is authorized. Never alter Operation: Tired Dogs, its credentials, Worker, state, or hosting as part of this game. Once a varied race starts, a classic-only Worker is not a safe rollback: preserve state and use a compatible build or forward fix.
