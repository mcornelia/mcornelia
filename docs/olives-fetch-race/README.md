# Olive’s Fetch Race

A competitive asynchronous garden strategy game for Mike and Aimee. Built in an isolated clone on `codex/olives-fetch-race`, from published `origin/main` commit `5a553937` (PR #23). No applicable AGENTS.md or .agents/skills files were present in the source checkout. Existing project documentation and the Worker/test architecture were inspected before implementation.

**Publication approved by Mike on October 13, 2026.** The separate Worker is deployed at `https://olives-fetch-race.mike-cornelia.workers.dev`. Two private game-only player keys are provisioned; only their hashes are stored by the Worker. Raw keys remain in owner-only files outside this repository. Tired Dogs source, hosting configuration, player keys, and live state remain unchanged. Nothing has been sent to Aimee.

The existing Cloudflare dashboard confirmed **Free ($0), Current plan** immediately before deployment. The existing grant was sufficient: Account Read, Workers Scripts Write, and Background Access. No paid service, new account credential, permission expansion, DNS change, or billing change was made. The GitHub Pages route is `https://mcornelia.com/play/olives-fetch-race/`; merging this game’s approved PR publishes it.

## Teach it in a minute

- Fetch your matching ball at the far end of the 7×7 garden, then return to your matching home. Mike and Aimee alternate turns. There is no clock or daily reset.
- On your turn, **walk one square**, **sprint two clear squares in a straight line**, or **place one fence between adjacent lawn squares**. Preview first, then confirm.
- Each player gets **two sprints and six fences for the whole race**. A fence consumes a full turn, blocks both players, and stays in place. Flower beds and fences cannot be crossed. Two starter fences are part of the symmetric garden.
- Crossing your ball collects it; crossing home with the ball finishes immediately. Players can share or pass through squares, so a player can never imprison the other by standing still.
- A proposed fence is rejected unless both players can still reach their ball and home. The preview shows each player’s remaining walking steps and the detour caused by the fence. Dots show one shortest route to your next objective; the number includes the return trip and does not account for sprints.
- If Mike finishes first, Aimee has one last turn to tie. If both finish in the same pair of turns, it’s a tie. Otherwise the first home wins.

Example strategic tradeoff: fencing E1–F1 from the opening position costs Mike one turn and one fence, adding four walking steps to Aimee’s full route and none to Mike’s. Aimee can reroute, counter-fence, or conserve sprints to make up the gap. The board is symmetric and both start with 16 walking steps.

First-playable scope: one fixed, symmetric board and one race per room. There is no reset/rematch endpoint. A future mutually agreed rematch can be added after play review. No analytics, chat, timers, matchmaking, or public room creation.

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

The current checkout reuses already installed dependencies through an ignored node_modules symlink. `npm ci` gives a portable dependency install. Node 22+ and a compatible Playwright browser are required. The harness binds Worker port 8887; integration tests use 8890/8891. Do not run browser suites concurrently on the same ports or stop unrelated services to claim a port.

## Verification

```sh
npm test
npm run test:e2e
TEST_BROWSER=webkit npm run test:e2e
XDG_CONFIG_HOME=/tmp/fetch-race-build-config WRANGLER_SEND_METRICS=false npm run check:deploy
```

Verified locally on October 13, 2026:

- **9 engine/integration tests passed.** Sixty seeded complete races checked **110,198 accepted fence continuations** and **158,910 rejected candidate placements**. Every accepted continuation retained routes to each outstanding objective. Tests cover equal starting distances, useful asymmetric detours, resource exhaustion, immutable state, no row-wrap or diagonal movement, bidirectional walls, last-exit rejection, ball/home crossing, equal-turn ties and both winner boundaries.
- **Actual workerd + SQLite Durable Object**, not a mocked transport: auth and CORS, wrong-player rejection, 12 simultaneous identical requests applied exactly once, competing distinct requests resolved 200/409, stale versions, changed-ID payload rejection, invalid moves, body limits, persistent state after Worker restart, and idempotent replay after restart. Unprovisioned secrets fail closed.
- **Chromium and WebKit**, independent 390px phone contexts: last-move/turn synchronization, preview without mutation, double clicks sent one request, server commit with lost response recovered across reload without replaying the action, offline reconnect, shared finish, 320px overflow checks, uniform board rows, keyboard ball, reduced motion, and no page errors. A delayed old poll cannot replace a newer confirmed state.
- Sound is on by default. The first ordinary pointer or keyboard interaction activates AudioContext; there is no enable-sound gate. Quiet synthesized cues accompany controls and moves. Explicit mute persists through reload. Initial load/rejoin and replayed moves are silent; polls never replay cues. No microphone or audio downloads. WebKit tests verify browser behavior, not physical iPhone speaker/silent-mode audibility.
- Separate Worker (`olives-fetch-race`), Durable Object class (`FetchRaceRoom`), binding (`FETCH_ROOM`), named room (`olives-fetch-race-v1`), secret names (`FETCH_MIKE_KEY_HASH`, `FETCH_AIMEE_KEY_HASH`), and browser prefix (`olives-fetch-race:v1:`). Browser tests preserve an unrelated Tired Dogs storage sentinel. `git diff origin/main -- play/tired-dogs _services/tired-dogs` is empty. No requests were sent to the live Tired Dogs backend.
- Deployment **dry run only** passed: Worker bundle 10.52 KiB, 3.87 KiB gzip. No resources were created remotely.

Screenshots are in ignored `_services/olives-fetch-race/test-results/`: `mobile-fence-preview.png`, `desktop-fence-preview.png`, and `mobile-finish.png`. They show disposable local play, with no keys. Saved Library identity, if available, is reported separately.

## Storage and failure behavior

The browser stores this game’s provided player key, mute preference, and pending operation under its own prefix. Leave clears the key and pending operation. This is possession-based access; a key grants that player’s moves. Never paste keys into public URLs, logs, screenshots, code, or chat. Remembered keys share the trusted mcornelia.com origin, as with the existing game; scripts on that origin must remain trusted.

The server authenticates before accessing the room. It stores only game state and the last 257 operation receipts. Each action checks identity, turn, version, resources, and route validity in the same synchronous SQLite transaction as its receipt and state update. Old receipts may be pruned, but the monotonically increasing version still rejects old writes. The client saves the exact pending operation before sending; storage failure blocks sending, and timeouts retain that operation for retry. State is never reset on reconnect. A disconnected or quota-limited client cannot silently create a separate local race.

## Release procedure and authorization

Mike approved **this game’s publication, a separate Free-plan Worker/Durable Object, and two new Fetch Race player credentials**, including push, checks, merge, and live verification. Do not reuse or rotate its keys, modify its Worker, migrate its class, or touch its room.

The approved procedure is:

1. Rebase this isolated branch onto current `origin/main` and rerun the listed checks. Reconfirm the existing Cloudflare account remains on Workers Free and that `olives-fetch-race` does not name an unrelated service. Use the existing authorized deployment mechanism; if its grant is insufficient, report the exact new permission needed before expanding access.
2. Generate the two approved 32-byte player keys securely outside the repository. Deliver locally to Mike for review/handling; sending anything to Aimee still requires explicit authorization. Provision only SHA-256 hashes using secure stdin-based `wrangler secret put FETCH_MIKE_KEY_HASH` and `wrangler secret put FETCH_AIMEE_KEY_HASH` for this Worker. Never print raw keys or hashes. Both hashes must be distinct. No credential-generation/provisioning tool is included in this review build.
3. From `_services/olives-fetch-race/`, deploy **only** this separate Worker using `npx wrangler deploy`. Its `fetch-v1` SQLite migration creates `FetchRaceRoom`. Keep observability disabled and `ALLOWED_ORIGIN=https://mcornelia.com`. If free hosting cannot be retained, stop and obtain approval.
4. Verify unauthenticated state is rejected, each private identity maps to its own player, and wrong origins/turns fail. Set `play/olives-fetch-race/config.mjs` to the exact verified HTTPS Worker origin. Narrow the frontend CSP to that origin for publication before publication; the local test endpoint is port 8887.
5. Push this branch and open a **draft PR** with rules, evidence, and screenshots. A merge is the GitHub Pages publication step (`main`, repository root), so merge only when Mike’s approval explicitly covers it. The resulting URL will be `https://mcornelia.com/play/olives-fetch-race/`. This change intentionally does not add a public shelf link.
6. Verify the exact Pages URL and two independent authenticated internet sessions: alternating moves, stale writes, disconnect/retry, rejoin, finish, and physical-phone sound. Report the verified URL; do not send it to Aimee until authorized.

Rollback by reverting only this new frontend change or disabling only its Worker. Preserve its Durable Object data. Never use Tired Dogs as a rollback target.
