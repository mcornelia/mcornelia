# Operation: Tired Dogs

A two-person cooperative evening for Mike and Aimee. Alternate small acts of care for Olive and Huck until both are happily asleep. No timer, streak, daily reset, health data, location data, or pressure to return. Olive's orange-and-blue ball is always a keyboard-accessible, purely cosmetic Easter egg.

## Release status

**Implemented and locally verified; not hosted yet.** The checked-in frontend fails closed with a setup message until `play/tired-dogs/config.mjs` has a verified backend origin. No production player keys exist as part of this change.

- Target repository: `https://github.com/mcornelia/mcornelia`
- Isolated branch: `codex/operation-tired-dogs`
- Proposed frontend: `https://mcornelia.com/play/tired-dogs/`
- Existing Pages deployment: `main`, repository root. Merging publishes the static frontend.
- Proposed backend: a Cloudflare Worker and one SQLite-backed Durable Object, deployed independently of the Mac.
- Existing Daily Fetch, the play shelf, LAN games, cards, and their saves are unchanged.

The relevant checkouts and deployment metadata had no reusable internet backend. Daily Fetch stores progress in each browser. The household Ravenwood Games runtime is LAN-only. No existing Sites project was available in the selected account. No Cloudflare account authorization was established.

## Approval still needed

Approve the Cloudflare account/setup to host this small backend, and creation of two separate private player keys with a secure way for the two players to receive/store them. If account signup, agreement, paid plan, or billing is necessary, stop for that approval. Do not treat this document as approval to create accounts or credentials.

Cloudflare's [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) documents SQLite Durable Objects on the Workers Free plan. Confirm the actual account's plan and limits at deployment; do not enable paid billing automatically. A quota outage pauses play, and must not fall back to public or browser-local state.

Before changing the live Pages site, confirm this exact route and the backend/access setup. Keep the PR in draft until backend deployment and real internet verification are complete. Do not merge unrelated work.

## Access model

The static artwork and JavaScript would be publicly retrievable through GitHub Pages, as is this repository. **Shared room state and all mutations require a private player key.** Each 32-byte cryptographically random key is encoded as exactly 43 base64url characters and maps to one player at the server. There is one room, no public room creation and no player selector that can impersonate the other player.

This is possession-based private access, not verified account identity: anyone deliberately given a player's key can act as that player. Keys should be kept in the players' password manager. Do not put keys in URLs, source, PRs, logs, screenshots, analytics, or chat. Never send them through third-party messaging without explicit authorization. Rotate the corresponding server secret to revoke a lost key; rotation preserves the room.

Only SHA-256 key hashes are provisioned as Worker secrets `MIKE_KEY_HASH` and `AIMEE_KEY_HASH`, through a secure stdin-based secret workflow. Both must be configured and distinct before state is readable. No raw keys or hashes are checked in. There is no live credential generator or auto-provisioning script. Test keys are random, temporary, local-only, and discarded after each test run.

The browser keeps its player key in sessionStorage for refresh/rejoin in the same tab. An explicit unchecked-by-default “Remember me” option uses localStorage on that device. Leave clears both. Another phone can rejoin using the same private key. This shared Pages origin should remain limited to trusted scripts; an XSS elsewhere on that origin could compromise remembered keys. Use a dedicated frontend origin if the site's trust model changes.

## Server guarantees

- Authentication occurs before the Durable Object is accessed. Request bodies cannot choose a player.
- The Worker allowlists the frontend's exact origin, rejects other browser origins, limits JSON bodies to 2 KiB, and sends no-store responses. CORS is additional browser protection, not authentication.
- A server-owned increasing version and player turn are checked inside the same SQLite transaction as the state write and idempotency receipt.
- Each move has a random operation ID. Concurrent retries apply once. Reuse with different contents is rejected; different simultaneous moves from the same version cannot both win.
- The latest 257 receipts are retained. After pruning, old retries are still rejected by their stale, never-reset version. Versions do not reset between evenings.
- No speculative UI state is committed. A pending move is stored before sending and retried with the same operation ID after timeout, disconnect, or refresh. Poll results cannot replace newer versions with older ones.
- Both players must independently opt into another evening. Sleeping dogs remain asleep until then; the starting player alternates.
- The room stores only game meters, turn/version, short in-game journal, restart votes, and recent operation receipts. No emails, addresses, health facts, external telemetry, or messages.

Cloudflare documents the [transactional SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). Tests exercise the actual workerd runtime through Wrangler; this is not a mocked multi-player transport.

## Local verification

From `_services/tired-dogs/`, with Node 22+:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run check:deploy
```

The browser script uses an existing compatible macOS test browser when available, otherwise the Playwright-installed browser. It allocates the frontend port and uses loopback port 8787 for the local Worker. Integration tests use 8790/8791. These listeners are temporary tests, never an always-on hosting solution. If a required port is in use, stop the test and choose another test port; do not stop an unrelated service.

In a sandbox, loopback binding may require a native execution grant. Set `XDG_CONFIG_HOME` to a writable temporary directory if Wrangler's default log/config folder is not writable. `WRANGLER_SEND_METRICS=false` disables Wrangler telemetry. The harness sets these for test runs.

Screenshots are written to ignored `_services/tired-dogs/test-results/`; they contain no keys. Unit tests cover the full win path, exact readiness boundaries, immutable sleepers, invalid actions, and recovery after varied long play. Integration tests cover auth, CORS, body validation, 12 simultaneous duplicate requests, stale versions, competing moves, durable restart, idempotent replay, and two-player restart. Browser tests cover two isolated mobile contexts, double tap, a committed move with a lost response followed by refresh, rejoin, win/restart, keyboard ball interaction, reduced motion, 320/390px layout, and unconfigured fail-closed UI.

## Deployment checklist after approval

1. Use the explicitly approved Cloudflare account; establish its free/paid status before resource creation. The checked-in Worker name is `operation-tired-dogs`; do not overwrite a pre-existing same-name service without inspecting it.
2. Provision the two approved secret hashes securely; deploy the Worker and its SQLite migration. No secrets belong in `wrangler.jsonc` or public frontend config. Keep observability request logs disabled.
3. Verify unauthenticated `/state` returns 401, each key identifies only its player, and wrong-origin requests are rejected. Do not loosen access to get a health check to pass.
4. Set `API_ORIGIN` to the exact deployed HTTPS Worker origin. The frontend CSP permits `https://*.workers.dev`; a custom backend domain needs a correspondingly narrow CSP update. `ALLOWED_ORIGIN` defaults to `https://mcornelia.com`.
5. Complete review and merge only this game change. Verify the Pages build and exact frontend URL before calling it live.
6. From two separate authenticated browser sessions over the internet, verify a turn, wrong-player rejection, refresh/rejoin, retry, sleep, and replay. Check state survives without any local dev process. Report the verified URL and possession-based two-key access level.

Rollback the frontend by reverting only this game's PR. Do not delete the Durable Object namespace or its stored room to roll back frontend code. Revoke keys or disable the Worker to close access; delete persistent state only with separate explicit authorization.
