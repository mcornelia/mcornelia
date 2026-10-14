# Shorter gardens, visible fleas, and phone fence controls — local candidate

This revision is unpublished. It does not access live player credentials, reset any race, change saved sound preferences, or touch Tired Dogs. Existing layouts and race transitions remain immutable; the new rules begin only after both players accept a new-garden invitation. Existing pending invitations retain their promised board.

## Teachable rules

- Fetch your matching ball and return home. Walk one square, or spend one of two sprints to cross two clear squares in a straight line. Players can share spaces.
- New gardens give each player three fences and two flea traps. Either placement spends the whole turn. Fences block both players and stay until the race ends. No placement can close a winning route; in these gardens no fence can add more than four remaining walking steps to either player.
- A visible flea trap can go on empty lawn, away from homes and balls. It bites only the opponent, only on landing. A sprint's passed-over square is safe; its destination can trigger a bite. The trap is consumed on landing, and the victim's next turn is automatically spent scratching. No timer or extra confirmation is needed. Traps never replenish, so at most four scratch turns can happen in the whole race.
- Every trap or fence placement must preserve a flea-free route to each relevant ball and home. A player can choose a risky shorter route, but cannot be forced into a trap by a placement.
- If the starter gets home first, the second player gets their final turn to tie. Scratch turns count as turns. The final-chance banner and per-player turn counts make the rule visible; previews explicitly identify a race-ending move.

## Boards and fairness audit

Orchard Paths, Brook Bend, and Rose Garden have genuinely different asymmetric flower beds and fences. Each has two seat assignments. A shuffled bag uses all six assignments, without immediately repeating a physical garden. Both players start at 14 walking steps or 12 optimal movement turns using their two sprints, versus the older crossroads gardens' 24/22. All lawn cells are connected.

The reported live first-player advantage was not assumed to be a bug. Code-level complete beeline games tie in both starter orders on every published crossroads and every new board. Explicit final-step and scratch-on-final-chance tests also cover both starter orders. The exact reported live game was not replayed: no live race or private credentials were retrieved. The new final-chance wording addresses the possibility of confusing 'ball home' with a completed win.

The 72-game deterministic strategy matrix crosses six seat assignments, both starter orders, and six policy pairings. Baseline beelines tie in all 12 games at 24 turns. Fence play beats a beeline from either identity and starter order, in 30 turns. Flea-vs-beeline games tie at 24–28 turns; mutual flea play ties at 28–32. Combined fence-aware play takes 46–54 turns and splits wins 6/6 by starter order and 6/6 by identity. These policies use exact solo movement planning plus one-action obstacle evaluation; this is evidence of choices and bounded length, not a proof of perfect strategic balance. Fleas cost a turn to place and usually trade one turn for one; the independent human-style UI playthroughs should judge their fun and clarity.

## Phone fence controls

Fence mode draws 44px diamond gap targets, highlights the selected edge, and retains a separate Confirm button. Tapping a square offers four named side buttons, at least 48px high, with coordinate pairs. Unavailable sides and existing fences explain the reason when tapped. Preview text shows both detours and the turn/resource cost. Nothing is saved by choosing a square, gap or side.

## Verification and independent QA handoff

Automated coverage includes published v1/v2/v3/v4 geometry and full transitions, finite resources, route and flea-free-route invariants, landing vs sprint-middle triggers, own-trap immunity, exact automatic skip accounting, both finish orders, API protocol protection, persistent invitations/archives, duplicate requests and restart recovery. The new two-client WebKit/Chromium test checks a real local Worker trap landing, automatic skip with a lost response and reload retry, wrong-turn rejection, square/side and direct-gap controls, invalid messages, reconnect, mute preservation and unrelated-state isolation. The broader WebKit regression covers a completed older race followed by new garden rematches. Readability checks cover 393×852, 390×844, 200% text and safe areas.

These simulations and focused regressions are **not** the three requested actual-UI playthroughs. Independent QA must play three complete games through the UI, record final outcomes and turn counts, assess gameplay, and return one or two concrete improvement suggestions.

Worktree: `/Users/glyph/Documents/Codex/2026-10-13/task/olives-fetch-race-readability`.
Branch: `codex/fetch-race-fleas-and-routes`.

From `_services/olives-fetch-race`, launch:

```sh
PREVIEW_PORT=4197 WORKER_PORT=8927 TEST_LAYOUT=orchard-v5 npm run dev
```

Use **separate browser contexts/profiles** at `http://127.0.0.1:4197/review/mike` and `http://127.0.0.1:4197/review/aimee`. These inject process-local throwaway keys; no production credentials are needed. Stop with Ctrl-C. A restart creates a fresh disposable room. Complete game 1, then use the mutual new-race UI for games 2 and 3 to exercise alternating starters and different gardens. The review server is not left running by implementation, so QA owns its process and browsers. Test-generated screenshots are in `test-results-strategy/` under the service directory.

If later approved, deployment requires the compatible Worker followed by Pages. Protocol 5 rejects cached older clients for new invitations/new gardens while old races retain their geometry and transitions. Keep all existing bindings, secrets, namespace and migration tag. No migration, reset, invitation acceptance, or access-phrase submission is part of deployment.
