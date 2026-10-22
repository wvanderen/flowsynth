# PR 477 fixes: verification record

Source: fce8c0d71147e3f8e317b6c4cfd426d628ba31db. Capture preflight accepted http://localhost:5173 in this checkout; see provenance.json.

## Findings mapped to evidence

- Canonical product names: `the prompt policy’s record` / `records purchases, placement, milestones, sessions, and the engine’s own decline reasons` in src/ui/app.playthrough.test.ts asserts the Poly Expander milestone; source review confirms Chord Catalysts and Expansion Bays labels.
- Elapsed origin and monotonic clock: `keeps local calendar starts and monotonic elapsed clocks across daylight-saving dates` asserts initial event/sample zero, monotonic events, final sample equal to elapsedSeconds, and elapsed deadline.
- Schedule/budget bounds: `rejects schedules that overlap a calendar day or overrun the budget` rejects both the long-session example and the reproduced long-breather example.
- Calendar declaration: `declares the host calendar and rejects a different timezone before running` asserts the declared host timezone and explicit rejection of foreign calendars. The daylight-saving case also ran under TZ=America/New_York and verifies March 7/8/9 starts at local 09:00.
- Prestige day: `reports the same prestige day when the budget ends on the crossing day` runs one session daily, then reruns with the budget cut to the crossing day and compares completion day, clocks and events.
- Source identity: `records engine content provenance and identifies a changed source` asserts a source fingerprint and changed-source run identity. Source inspection confirms the sorted raw engine-source dependencies include actions, constants and scenario construction, exclude tests, and participate in Vite hot reload.

## Checks

- Targeted playthrough file: 14 passed.
- TZ=America/New_York targeted calendar/accounting/completion cases: 5 passed.
- npm run check: passed.
- Full npm test: passed, 95 files, 1894 passed and 2 existing calibration skips.

## Browser evidence

Desktop 1440×900 and phone 390×844 confirmed by in-page reads; desktop.png and phone.png show the one-day result at this source. On phone, rerunning after resize recomputes the dev panel’s stage constraints: panel x=12..378, Run button x=105..226, height 44. The initial resize-only capture retained desktop panel constraints until render; it is not the final phone evidence.

In-page command demonstration: timezone America/Chicago, engineSource 1946df84, runnerVersion 2; first event 0, final trajectory elapsed 3600, result elapsedSeconds 3600. The former overlapping 8×(1+600)-minute recipe now throws `Playthrough recipe: schedule must fit each calendar day, including declared breathers and daylight-saving transitions.`

The note uses explicit ✓/✗ state text, not color alone. No new animation or disclosure was added. Keyboard/touch disclosure and reduced-motion emulation unavailable (not exercised); full presentation validation is not claimed. Source control geometry remains the existing square 44px controls.
