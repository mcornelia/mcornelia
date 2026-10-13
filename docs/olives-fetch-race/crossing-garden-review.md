# Varied Crossing Gardens — implementation and rollout review

Mike approved publication of this tested revision on October 13, 2026, including compatible Worker deployment, versioned Pages publication, and repository push/merge. Publication must preserve the current Fetch Race. Neither a new-race invitation nor acceptance may be performed on either player’s behalf. Existing keys and Operation: Tired Dogs remain untouched; no Aimee message is authorized.

## Rules in a minute

Mike's home is B7 and his ball is across the garden at F1. Aimee's home is F7 and her ball is at B1. Fetch your matching ball and bring it home. On your turn, walk one square, spend one of two sprints to cross two clear squares in a straight line, or spend one of six fences to block an edge. Fences block both players and last for the race. Preview the move and its distance changes before confirming. Every legal fence must preserve both players' route to their ball and home.

Players can share a square and pass through each other; they do not physically block or steal balls. The competition is over shared connections, sprint lanes, and permanent detours. If the starting player finishes first, the other player gets one final turn to tie. No timer. Turns wait across hours and reconnects.

Invite another race when ready. The other player must review and accept it, even after a finished race. Either player can decline/withdraw; playing a move cancels the invitation. The starter alternates. New fences and sprints are supplied only when the new race starts.

## Three gardens, real route changes

All three boards have mirrored homes, crossed balls, four flower beds, ten fixed garden fences, and three alternative crossings at D2, D4, and D6. Green rails with square posts are fixed garden fences; brown rails are player-placed fences. The shortest-route overlay stays removed.

| Garden | Walking round trip, each | Best movement turns with two sprints, each | Shortest outbound routes per player |
| --- | ---: | ---: | ---: |
| Crossing Garden | 20 | 18 | 5 |
| North Bend | 24 | 22 | 16 |
| South Bend | 24 | 22 | 16 |

The server rotates these layouts in order. Every successive garden differs; the set repeats after three races. The selected immutable layout ID is stored with the race and never changes during play. Both players see the same board across reloads, offline reconnects, and Worker restarts.

Each of the three crossings supports an equally short outbound route within its garden when the other two are closed. All opposing shortest-route pairs intersect (25 pairs in Crossing Garden, 256 in each Bend). Closing the final winning connection is rejected. Tests compare actual route sets to ensure the variants change routes, not merely decorative fences. Equal starting opportunities and mirrored geometry do not constitute a proof of perfect game-theoretic balance.

### A concrete tactical choice

In Crossing Garden: Mike walks B7→B6, Aimee walks F7→F6, Mike walks B6→C6, and Aimee sprints F6→D6. Mike can fence C6–D6: this costs a turn and fence, adds two remaining walking steps for him and four for Aimee, and leaves the north/middle alternatives. He can instead walk onto D6 alongside Aimee and conserve the resource. A fence can also break a useful sprint without changing the shortest walking count.

## Mutual rematches and race safety

- Invitations require the current race and version. They do not spend a player's turn or consume resources. A confirmation dialog names the next garden and explains the effect.
- The inviter cannot accept their own invitation. Accept/decline must identify the exact pending proposal. Playing any legal move cancels it.
- Acceptance archives the entire previous state and starts the next garden in the same synchronous SQLite transaction as its idempotency receipt. There is no unilateral reset endpoint.
- Race numbers increase, and the shared state version never resets. Old pending moves cannot accidentally become valid in a later race. Exact duplicate requests return the current state without applying again; stale or conflicting requests are rejected.
- Request, acceptance, and decline use the existing durable local pending queue. Lost responses, reloads, duplicate clicks, and reconnects retry the same operation ID.
- Archives are preserved in the private Durable Object's `race_archive` table. There is no user-facing archive browser or restore button in this revision.

## Exact migration and publication choice

**Recommended migration: keep the existing room and race. Publish compatible code only after approval, then use the mutual new-race invitation when both players choose to move on.** This can be after finishing the current race or sooner with both players' acceptance. No automatic reset is needed.

States without a layout ID remain the original `classic-v1` garden. The default production initializer and room name remain unchanged. `INSERT OR IGNORE` never replaces an existing room. New garden activation happens only through mutual acceptance, not through deployment or an initializer change.

A versioned client entry (`app.mjs?v=2`, `engine.mjs?v=2`) and protocol header protect cached clients: an older client can continue the classic race, but the Worker will refuse to return or mutate a new garden for it until it refreshes. Existing pending legacy operations keep their original receipt encoding. Monotonic versions and race checks preserve the existing browser storage namespace safely. Existing player keys continue to work; no new credentials or expanded access are needed.

After Mike approves publication:

1. Create/review a draft PR from this branch and retain the approved scope.
2. Capture the current Fetch Race state privately for the deployment comparison. Deploy only the updated `olives-fetch-race` Worker using its existing configuration and credentials. This adds archive storage but leaves the current race row and key secrets unchanged.
3. Merge the approved PR to publish the Pages client, then verify the live assets and that both player views still show the exact existing race state.
4. Stop there. Mike may invite the new race when ready; Aimee must accept in the game. Do not automate an acceptance or reset on either person's behalf.

Do not roll the Worker back to classic-only code after a new layout has begun; that older engine cannot interpret it. Use a forward fix or a compatible rollback build. The development and test runs used disposable local rooms. Deployment verification is reported separately; no live race-transition action is part of publication.

## Local review and tests

From `_services/olives-fetch-race/`, `npm run dev` starts a disposable Crossing Garden preview and prints separate local Mike/Aimee entry points. Use separate browser profiles; never enter real player keys. The rematch controls exercise all three gardens.

```sh
npm test
TEST_OUTPUT=test-results/crossing-legacy npm run test:e2e
TEST_LAYOUT=crossing-v2 TEST_OUTPUT=test-results/crossing-chromium npm run test:e2e
TEST_LAYOUT=crossing-v2 TEST_BROWSER=webkit TEST_OUTPUT=test-results/crossing-webkit npm run test:e2e
XDG_CONFIG_HOME=/tmp/fetch-race-build-config WRANGLER_SEND_METRICS=false npm run check:deploy
```

The engine/Worker suite has 20 tests. Forty seeded completed races across all three gardens explore 66,237 accepted fence continuations and 166,219 rejected candidates, retaining both outbound and return routes after every accepted fence. The original classic suite separately checks 110,198 accepted continuations. Seven successive new races verify rotation, alternating starters, equal-turn tie rules, monotonic versions, stale and duplicate commands, and matching client state. Real local SQLite tests verify exact archived snapshots and persistence after restart. Classic geometry/transitions are compared to the published engine fixture.

Phone suites cover legacy and crossing starts, independent player contexts, legal previews, turn enforcement, double clicks, lost move and rematch responses with reload retries, offline reconnect, stale polls, full race finish, mutual acceptance and refusal, repeated garden variation, 320/390px layout, reduced motion, default first-gesture sound, remembered mute, isolated browser storage, and no page errors. Final results and screenshots accompany this review.
