# Visible sign-in and user-controlled access phrases

Local review branch: `codex/fetch-race-access-phrases`, based on published `7f6cebb`.
No publication or real credential rotation has been performed for this change.

## What was fixed

Mike reported that Enter garden erased the pasted key and appeared to do nothing on his iPhone. The previous handler erased input before authentication and could skip a submitted login while a saved-session refresh was already running. It also depended on `AbortSignal.timeout`. Fresh-browser live authentication had succeeded, so that earlier check did not establish what was happening in Mike's reused iPhone tab.

The new handler keeps input until authentication succeeds, shows Opening progress, prevents duplicate submissions, replaces old in-flight sign-ins, ignores their late results, and remembers credentials only after success. HTTP errors, stale-client refresh instructions, timeouts, malformed responses, network errors, and denied storage receive visible feedback. An independent small form guard prevents a navigation/reset when the main module cannot load. Timeout handling uses AbortController plus a timer. Returning from the mobile page cache refreshes the session. Failed login screens do not silently poll away the error.

Entry is visible by default, with an optional Hide checkbox and mobile capitalization/autocorrection disabled. Successful screens explicitly name the signed-in player and identify whose turn is pending.

## Mike's phrase choice

After publication, Mike signs in with his existing key, opens **Change my access phrase**, manually enters his current key, chooses exactly three words separated by dashes, followed immediately by a number and exclamation mark, repeats them, then presses **Save my new access phrase** himself. Household words and names are accepted; there is no fixed dictionary or prefilled phrase. Case and typographic dashes are normalized for new phrases; dashes are required between words. Previously saved six-to-twelve-word phrases keep their existing sign-in normalization, including spaces. Aimee has the same flow for her own identity. No person can change the other player's credential through this screen.

The UI checks the manually supplied current credential against the signed-in identity. The server authenticates the POST independently. Only that final authenticated POST writes a credential verifier. New words never appear in public source, URLs, logs, screenshots, or response payloads. The existing remembered-device behavior stores the successfully chosen credential in this game's own localStorage namespace. As requested, phrase fields are visible on the user's own screen.

The Durable Object keeps per-player salted PBKDF2-SHA256 verifiers (100,000 iterations), never plaintext phrases. Existing environment secrets continue to authenticate a player until that player saves a replacement. Existing secret values are not edited. Authentication and its action are serialized, the verification cache is cleared on replacement, and ambiguous identity matches fail closed. Failed sign-ins are limited to 20 per IP and 100 globally per fifteen-minute window; already verified sessions and unchanged valid legacy keys remain usable. Cold valid phrase attempts can also be delayed by an exhausted failure window. Salted hashes, throttling, and longer phrases reduce guessing risk; personal household words remain more predictable than randomly selected words.

A lost response is resolved by verifying the proposed phrase; the browser does not blindly submit a second rotation. Repeated old-key requests fail after the first change. Authenticated retries with the new phrase and same change ID are idempotent. New phrases must differ from current and partner credentials.

The new `player_access` and `access_attempts` tables are separate from race, receipt, and archive tables in the existing Fetch Race Durable Object. No new account, binding, public room, external service, or access grant is introduced. Tired Dogs files, storage namespaces, service, keys, and state are unchanged.

## Validation

- Full `npm test`: 33/33 passed. Includes 225,394 legal fence continuations across existing garden generations, full races, turn enforcement, 12 concurrent retries, competing writes, restart persistence, archive preservation, and namespace isolation.
- Access-specific server suite: opaque-key compatibility; normalized phrases; ambiguous identity rejection; confirmation rejection; own-key revocation; partner identity preservation; repeated requests; exact race/turn preservation; restart persistence; throttling; foreign-origin rejection.
- Chromium and iPhone-sized WebKit access tests: reused saved session with a late prior response; corrupt pending JSON; absent AbortSignal.timeout; retained text after network/401/426/malformed-response failures; Enter key and repeated submission; denied localStorage; failed main module; page-cache return; correct player label; unchanged Tired Dogs sentinel; visible input; no horizontal overflow.
- Real local Worker browser flow: mismatched confirmation rejected; double submission produces one access write; server-applied change with lost response recovered; new phrase survives reload; previous key fails; partner remains authenticated with byte-equivalent race state.
- Full Chromium and WebKit two-phone gameplay regressions passed: preview, double clicks, lost move response plus reload retry, offline reconnect, finish, mutual rematches/decline, 320/390px viewports, gesture audio, remembered mute, reduced motion, and state/key isolation.
- Deployment bundle dry run passed. No deployment was performed.
- All credentials used in tests are disposable, generated only inside test processes/browser contexts. Screenshots are taken before fields contain any credential.

Automated WebKit is an iPhone-like browser test, not a direct reproduction on Mike's actual phone. His exact prior runtime/cache condition remains unconfirmed.

## Publication and final handoff

1. Obtain Mike's explicit approval to publish this code update. Push this branch, create a draft PR, and review the final diff; keep it unmerged until the Worker step below succeeds.
2. Deploy the Fetch Race Worker code first with its existing `wrangler.jsonc`, existing DO binding/room, and existing secrets. Do not run secret-put, reset, new-race, or initialization commands. No new credential values are needed for deployment.
3. Merge the approved PR to publish the static game assets through the repository's established GitHub Pages flow. The app, stylesheet, and form guard use the v4 asset URL. Protocol 3 and all game rules remain unchanged.
4. Perform read-only live checks with the existing Mike key and compare race/version/turn/archive with the pre-publication snapshot. Ask Mike to reload the page and verify his phone sign-in. Do not test live moves or credential changes on his behalf.
5. Mike chooses, confirms, and submits his own phrase in the published UI. That separate human action is the only authorized live rotation. He should save the words privately; no phrase values need to be sent to an agent. Aimee's existing key remains valid until she changes it herself.

Once a phrase has been saved, do not roll back to the old authentication implementation: it would ignore the replacement table and revive an old key. Use a forward fix retaining the new authentication logic. There is no public reset/recovery endpoint; a forgotten phrase requires a separately authorized, scoped administrative recovery. No such recovery or credential action is included here.

Reference: Cloudflare documents PBKDF2/Web Crypto support at https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ .

## Review screenshots

- Visible phone login: Library `libfile_13b6b76008248191b5e54b68c81d7249`; local `_services/olives-fetch-race/test-results-access/webkit-visible-login.png`.
- Blank phrase settings: Library `libfile_94fef4e3ce048191bab596c9d46e3571`; local `_services/olives-fetch-race/test-results-access/webkit-phrase-settings-blank.png`.

Both screenshots were inspected and contain no player credentials.
