# iPhone readability — separate unpublished patch

Based on approved/published playability commit `9a824ca`. Branch `codex/fetch-race-readability`. This is not part of PR 29 and has not been pushed or deployed.

Mobile instruction, preview, action, last-move, form, rules, and body text now use 1rem (16px at the default browser setting), with 14px player/status labels, 13px supporting labels, and 10px board coordinates. The previous compact UI used 7–10px for much of this information. Colors for secondary text and player labels are darker: calculated contrast is 5.90:1 for Mike, 6.23:1 for Aimee, 6.90:1 for status text, and 8.83:1 for board coordinates on their tested backgrounds. Font sizes use rem units so browser text enlargement works.

Normal vertical scrolling is intentional: readable text is more important than fitting every element above the fold. The action bar remains directly above the board and the preview/Confirm strip directly below, in normal flow. Nothing floats over the board or keyboard. Board targets stay at least 44px rather than shrinking; when text is enlarged, only the two-dimensional board pans horizontally inside its own accessible scroll region. Text and controls reflow without horizontal page scrolling.

WebKit checks cover 393×852 (iPhone 16 class), 390×844, and 200% text enlargement. Default instructions/actions/previews measure 16px, status 14px, coordinates 10px; at 200% they measure 32/28/20px. Board cells measure about 45px at default size and 88px enlarged. No horizontal page overflow or board/control overlap. A reduced 380px viewport models keyboard space: the focused phrase input and Save button remain reachable within the scrolling dialog. CSS uses native safe-area env values; the test supplies top/right/bottom/left values of 47/12/34/12px through the same variables and verifies padding plus dialog containment. The page viewport retains browser zoom permission; tests simulate text enlargement and reduced viewport, not a physical iPhone keyboard or gesture.

Relevant test: `node test/readability-browser.mjs` from `_services/olives-fetch-race`. The prior phone-fit test now checks reachable confirmation with normal scrolling, matching the user's new instruction not to reduce text to force a one-screen layout.

No game logic, Worker, authentication, state, or credential changes. Publication requires separate approval; this patch only changes static presentation, tests, and review notes. Mike's actual iPhone readability preference is the remaining human check.


Preview screenshot: Library `libfile_afffe52394988191992c5c99b136c621`; local `_services/olives-fetch-race/test-results-readability/webkit-393-1x.png`. It contains only dummy local game state and no credentials.

The WebKit access regression also passed (reused login, failed-entry retention, denied storage, phrase settings and lost-response handling). The full WebKit game regression passed: independent phones and shared turns, legal previews, double clicks, lost-response/reload retries, offline/reconnect, finish, three varied rematches, mutual acceptance/decline, 320/390px layouts, gesture audio and remembered mute, reduced motion, key/state isolation, fail-closed behavior, and zero page errors. The styling change leaves application logic, engine, Worker, access code, race layouts and credentials byte-for-byte unchanged.
