# Agent Guest Book — review handoff

Implemented locally on `codex/agent-guest-book`, based on `e4e3b98c956a7d0f9c6c92c9feb2db3f39b8890d` (October 27, 2026). Nothing has been pushed or deployed. Production submission discovery intentionally remains `accepting_entries: false`, `api_base: null` until provisioning and review.

## Repository and hosting

Verified source checkout: `/Users/glyph/.openclaw/workspace/mcornelia`, remote `git@github.com:mcornelia/mcornelia.git`. It contains untracked collection/booklet artifacts; none were copied, altered, staged or removed. Its tracked files were clean at inspection. The older Dropbox `mcornelia-site` checkout is on a different Daily Fetch feature history; it was not modified.

Working isolated local clone: `/Users/glyph/Documents/Codex/2026-10-28/task-4/agent-guest-book`. This clone's origin points to the source checkout, not GitHub; do not push to that origin. For later authorized review publication, explicitly add/use the verified GitHub remote. Existing EDI content, games, robots policy and services are unchanged.

The existing site uses GitHub Pages, `main` at repository root (see `operation-tired-dogs.md`). Static Pages cannot run a private inbox. This feature follows the repository's existing Worker + SQLite Durable Object pattern, but creates a separate proposed service named `mcornelia-agent-guest-book`. It does not reuse either household game's state or keys. No Sites project, hosting account, paid plan, DNS, production secret or production resource was created.

## Experience and discovery

- `/agents/` (Pages directory route; `/agents` redirects) is a crawlable, no-JavaScript-readable introduction, with a custom vector robot clubhouse illustration.
- Homepage navigation and the project list link to it. The sitemap includes it. Optional `/llms.txt` links to the page, protocol and synthetic example.
- `robots.txt` is byte-for-byte unchanged, including the existing `/EDI/` exclusion. No training-crawler setting was broadened.
- A browser can fetch a challenge, but does not solve or submit automatically. Agents use the documented JSON API and `agents/example.py` standard-library example.
- Page and example explicitly require operator permission. Discovery never grants authority. No secrets, sensitive identifiers or private prompts are requested. Identity is self-reported and unverified.
- The private inbox is served on the independent Worker origin at `/inbox`. Its public login shell contains no records. The owner key remains only in page memory, never in URLs, local/session storage or the Pages frontend.

## Protocol and controls

`GET /v1/challenge`: 16-byte random challenge ID, 24-byte random nonce, SHA-256 over the UTF-8 bytes of the decoded `payload` string (exactly two LF characters, no appended newline), five-minute expiry. Challenges bind to the same source IP's daily HMAC tag. A network change or UTC midnight may require a new challenge.

`POST /v1/entries`: exact allowed fields, JSON boolean permission, 4 KiB streaming body cap, bounded strings, public site path without query/fragment, and parameterized SQL. The digest is compared against the server-held expected result. Validation, replay consumption and insertion occur in one synchronous SQLite transaction. Replaying returns 409 without another entry; an unknown/expired challenge returns 410. A lost success response is deliberately not auto-resubmitted with a new challenge.

The check establishes ability to perform automation, not AI identity. Humans can pass. This is not proof-of-work, CAPTCHA, verified membership, or a guarantee of agent traffic.

Rate limits (fixed windows):

- 30 public API requests per source network per 10 minutes, including invalid requests.
- 10 challenges per source network per 10 minutes; 240 globally per hour.
- 3 accepted entries per source network per UTC day; 100 globally per UTC day.
- 1,200 public API requests globally per hour; 1,000 retained inbox entries.
- Owner requests: 120 per 10 minutes after successful authentication.
- A 429 includes conservative `Retry-After: 3600`. Per-day limits may require waiting longer.

Only a daily keyed IP tag and counters are retained for abuse control; no raw IP, user agent, email, or arbitrary headers are stored in the guest book. Cloudflare supplies the IP header; the service accepts no forwarding-header fallback. Tags/counters expire at their time-window boundary, with cleanup on requests and an hourly alarm. Challenge rows become eligible for cleanup five minutes after expiry and are pruned on requests or the next hourly alarm. Entries expire after 30 days; every inbox read prunes expired data, and alarms schedule the next retention deadline. Provider alarm delays/backups are outside application guarantees. Application request observability is disabled; provider connection processing still applies.

Abuse limits are modest application controls, not DDoS protection or cost guarantees. A distributed attacker could exhaust global allowances and deny legitimate submissions. Platform quotas are shared with existing services. Keep the account on Free and confirm current limits before any production resource is created; do not silently enable paid usage.

## Privacy and untrusted data

Entry fields, receipt and received time live only in the bound Durable Object. No public listing endpoint exists. `/v1/inbox` and `/v1/inbox/delete` require a valid 32-byte owner bearer key (43 base64url characters); only its SHA-256 hash is provisioned. Missing owner hash or rate secret causes all data endpoints to fail closed with 503.

The inbox renders strings with `textContent`, preserves literal markup without executing it, does not linkify URLs, makes no automatic fetches, and labels all incoming content as untrusted. It has a restrictive CSP, no third-party assets, no framing, no caching, and no external telemetry. There is no integration feeding entries to Glyph, Avina, another model, email or chat. Treat any future integration as a separate security-sensitive change. Possession of the owner key grants read/delete access; losing the key requires rotation. It is not an account-based sign-in or MFA system.

## Local verification

From `_services/agent-guest-book` with Node 22+ (verified with Node 25.9.0):

```sh
npm ci
npm test
npm run test:e2e
XDG_CONFIG_HOME=/tmp/guestbook-wrangler-config WRANGLER_SEND_METRICS=false npm run check:deploy
npm run preview
```

Browser tests use the existing compatible Chromium cache when present; otherwise install the Playwright Chromium build explicitly before rerunning. Tests launch the actual local `workerd` runtime through pinned Miniflare, not a mock database. All credentials and records are synthetic, local and temporary. Tests remove their temporary databases and stop their listeners. A sandbox may require permission for loopback sockets and headless browser execution.

Verification covers exact hashes, control/length/path validation, no-content-length body limits, successful submission, invalid/unknown/expired/replayed challenges, eight concurrent copies (one save), restart persistence, authentication, CORS, private delete, pagination, retention, per-client/global limits, full inbox, unconfigured fail-closed behavior, literal hostile markup, no external requests, no browser errors, keyboard access, no-JS intro, and layout at 320/375/390/768/1440px. The Python example is exercised against the local service with synthetic data, including the missing-permission guard. These tests do not substitute for production smoke checks or a physical iPhone audit.

Screenshots in ignored `_services/agent-guest-book/test-results/` show local synthetic preview data, not production availability. The review archive includes these images. The local preview script prints its loopback URL and stops with Ctrl-C; it is not an internet deployment. Its ephemeral inbox key is intentionally not printed or distributed.

## Exact production steps — approval still required

1. Approve creating one separate Cloudflare Worker and SQLite Durable Object for this guest book in the existing owner account, after verifying its current Free plan, quotas and absence of a conflicting `mcornelia-agent-guest-book` service. No DNS change is needed; use `workers.dev`. Do not deploy or modify the existing game services.
2. Approve provisioning an owner key and independent rate HMAC secret. Generate these securely only after authorization. Store only `OWNER_KEY_HASH` and `RATE_SECRET` as Worker secrets through a secret-safe stdin workflow. Deliver the raw owner key locally to Mike's approved password manager/storage; never put it in chat, Git, screenshots, command arguments, or URLs. The repository has no production credential generator or secrets.
3. Deploy the reviewed Worker and its `v1` SQLite migration. Confirm the returned HTTPS endpoint; the CSP currently anticipates `https://mcornelia-agent-guest-book.mike-cornelia.workers.dev`, based on the account domain documented for the existing service, but it has not been provisioned or verified. Update this exact CSP origin if different.
4. Set `agents/protocol.json` to the verified `api_base` and `accepting_entries: true`. Verify a synthetic challenge/submission, replay rejection, unauthenticated 401, authorized owner read/delete, and cross-origin rejection. Confirm persistence independently of local processes. Delete the smoke entry through the owner API.
5. Review and authorize the scoped branch's GitHub push/PR and merge to `main`; merging triggers Pages production deployment. Do not merge unrelated feature branches or generated EDI content. Verify Pages build success, `/agents` redirect, `/agents/`, homepage links, sitemap, `llms.txt`, public protocol and private API boundaries on the real domain.
6. Tell Mike the actual public URL and exact owner inbox URL, with the private key delivered separately. No external announcements, ads, messages or autonomous monitoring are part of this change.

Rollback: set discovery to closed, revert only the guest-book frontend changes, and disable the new Worker if necessary. Preserve the Durable Object unless deleting stored entries is explicitly authorized. Rotate the owner secret hash to revoke access without deleting entries.
