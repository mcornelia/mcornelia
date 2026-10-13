# Shared Crossroads — implementation and rollout review

Mike explicitly approved publication and a fresh test race, with the old test race archived, on October 13, 2026. This later owner authorization covers using the existing two-player test flow to request and accept that one new race. Existing keys stay unchanged, no move is played in the fresh race, and no message is sent to Aimee.

## Live diagnosis

The read-only check found **version 3, race 0, `classic-v1`**, with no new-race invitation. Mike's home/ball remain **C7/C1**; Aimee's remain **E7/E1**. Their positions were B6 and E6. The only walls were C1–C2 and E1–E2, immediately below the balls. The last move was “Mike walked to B6.”

This is the intentionally preserved original race. The previous deployment left it unchanged, as approved. It explains both reported symptoms: a ball behind a starting fence and largely parallel routes. It is not evidence of a browser-cache problem. Published v2 gardens require a mutually accepted new race to begin; none had begun at inspection.

There is also a separate design distinction: the v2 boards tested intersecting shortest routes, but offered north/middle/south crossings rather than requiring passage through one visibly shared central area. This revision makes that central interaction unavoidable.

## What changes in the next race

New gardens retain crossed destinations: Mike B7→F1→B7; Aimee F7→B1→F7. A visible flower-bed divider leaves a central courtyard at **C4–D4–E4**. Every complete outward and return route must pass through **D4**—including a sprint that crosses it without stopping. This is guaranteed for all routes, not merely suggested by a route overlay or observed on selected shortest paths.

Players may pass through or share the courtyard. They need not arrive together and cannot block one another by standing there. There are three approaches to either side of the courtyard. Closing two still leaves the third; closing the last winning connection, or fencing across the central passage, is illegal. Strategic choices concern approaches, detours, sprint opportunities, and timing.

Each layout has **14 fixed starting fences**, four more than v2's ten. None touches a home or ball square. Their placement adds real detours: 24 walking steps for either complete round trip versus 20 with those fences removed. Both players can complete the race in 22 movement turns with optimal use of their two sprints, before any new fences. All 43 lawn squares are reachable. Players still receive **six fences and two sprints each**.

| Tested garden | Starting fences | Shortest outbound routes per player | Walking round trip / best movement turns |
| --- | ---: | ---: | ---: |
| Meadow Crossroads | 14 | 8 | 24 / 22 |
| North Crossroads | 14 | 12 | 24 / 22 |
| South Crossroads | 14 | 12 | 24 / 22 |

The server now shuffles this tested set. Every group of three accepted races uses all three layouts; consecutive races never repeat. The proposed layout and remaining sequence are persisted, so duplicate requests, reconnects, reloads, and server restarts cannot reroll a garden. Declining an invitation does not change the current race. This is controlled random selection among validated layouts, not unchecked random wall placement.

The shared courtyard has a subtle ground tint and center mark. There is no route helper or shortest-path overlay. Identity, numeric distance previews, sound, remembered mute, animations, and Olive's ball remain intact.

### A reachable tactical preview

After six ordinary moves each in Meadow Crossroads, Mike reaches C4 and Aimee E4. Either can next enter D4, and both may share it. Mike can instead preview a fence between **C3 and C4**: it uses one fence and his full turn, adds **zero** remaining walking steps for him and **eight** for Aimee, and still leaves Aimee a finishable detour. The mirrored counterplay is available to Aimee. Equal mirrored starting opportunities do not claim perfect game-theoretic balance.

## Existing-race safety and the smallest way to try it

The development and review runs did not deploy, reset, invite, or accept a live race. Subsequent publication and the single owner-authorized fresh test race are reported separately. Tired Dogs, all player credentials, and infrastructure configuration are unchanged.

For an immediate review without affecting live play, run `npm run dev` in `_services/olives-fetch-race/`. The printed loopback Mike/Aimee links use disposable identities and a fresh Meadow Crossroads board. Use separate browser profiles.

The currently published version already offers the ten-fence v2 crossed gardens through **Invite a new race → partner reviews and accepts**. That would not yet include this 14-fence central-courtyard revision.

Under the subsequent explicit publication approval, deploy the compatible Worker first, then its versioned Pages client. Verify the current live state is unchanged. **Publishing alone will still leave the old race in place.** To experience the revised board, Mike invites a new race and Aimee accepts (or vice versa). Acceptance archives the previous race and starts one of the new crossroads layouts. The subsequent owner approval explicitly authorizes the request and acceptance for this fresh test race; future transitions still require their own authorization.

All published classic/v2 layout definitions remain unchanged. Existing states retain their geometry and transitions. New IDs end in `v3`; the client uses versioned `?v=3` assets and protocol 3. The Worker permits older clients to continue compatible older races, but requires a current client to invite/accept the revised gardens and to read/play a v3 race. This prevents cached code from silently misreading the new geometry.

## Verification

**The 27 engine/Worker tests passed in review**, including the original and v2 suites. The four browser runs passed: classic and v2 starts in Chromium, and v3 starts in Chromium and WebKit. The Worker dry-run bundle passed (16.67 KiB, 5.68 KiB gzip). A final read-only live check still showed `classic-v1`, version 3, with no invitation. Nothing was published.

Checks include:

- Graph-disconnection proof: removing D4 disconnects both home/ball pairs in both directions, covering every possible route, not just sensible/shortest examples.
- All shortest routes contain C4, D4, and E4; all three approaches remain viable when the other two are blocked, including symmetric closures on both sides.
- Mirror symmetry, equal resources and walking/sprint opportunity, changed route sets, no fences adjacent to targets, and all lawn squares reachable.
- Forty completed v3 races checked **48,959 accepted fence continuations** and **189,377 rejected candidates**. Every accepted fence preserved both objectives and mandatory courtyard passage.
- Seeded shuffle checks cover 24 seeds × nine new games: varied ordering, all variants used per three-game group, no consecutive repeats, and acceptance retaining the originally proposed garden.
- Exact comparison of classic and all v2 geometry and complete-game transitions against the published engine.
- Real SQLite persistence for a pending random invitation, its duplicate retry after restart, the accepted layout and remaining sequence, and another restart with a different initializer.
- Existing tests retain turn enforcement, duplicate clicks/requests, stale writes, lost-response retries, mutual restart safeguards, archive preservation, mobile synchronization, sound, and state isolation.

Commands:

```sh
npm test
TEST_OUTPUT=test-results/courtyard-legacy npm run test:e2e
TEST_LAYOUT=crossing-v2 TEST_OUTPUT=test-results/courtyard-v2 npm run test:e2e
TEST_LAYOUT=meadow-crossroads-v3 TEST_OUTPUT=test-results/courtyard-chromium npm run test:e2e
TEST_LAYOUT=meadow-crossroads-v3 TEST_BROWSER=webkit TEST_OUTPUT=test-results/courtyard-webkit npm run test:e2e
node test/review-shots.mjs
XDG_CONFIG_HOME=/tmp/fetch-race-build-config WRANGLER_SEND_METRICS=false npm run check:deploy
```

Screenshots are saved in `_services/olives-fetch-race/test-results/crossroads-review/`: desktop/mobile tactical previews, both players sharing D4, and each of the three starting gardens. Confirmed Library IDs are returned separately with the review.

## Archive verification

An authenticated, read-only `GET /archive?race=N` uses the same player keys and room as normal play. It accepts only an integer archived race number, returns that snapshot or 404, and has no write/reset capability. This permits exact remote archive readback after the approved fresh-test transition without adding account permissions or exposing secrets.
