# Two-row phone header trial

User requested a roomier two-row phone composition after reviewing the single-row implementation. Source `d6ed8516`; [accepted provenance](provenance.json) confirms this worktree at `http://localhost:5175/?dev=1` with clean source before capture.

| Acceptance | Recorded verification |
| --- | --- |
| Phone uses two rows | [390px upgrade](phone-upgrade.png): identity/status/Settings above Pause, clock/Notes, and Enter flow. Live viewport 390×844, header height 120px |
| All four modes retain readable actions/status | [Flow](phone-flow.png), [paused](phone-paused.png), [Breather](phone-breather.png), plus upgrade; original header action/status tests retained |
| Small-phone fit and touch targets | [320×740 Breather](phone-320.png): document has no horizontal overflow; Pause x=10 width44, clock x=70 width68.53, Notes x=153.53 width44, main action x=206.53 width103.47, Settings x=266 width44; buttons height44 |
| Desktop stays unchanged | [1440×900 desktop](desktop.png), live header height64, single-row composition |
| Keyboard and non-color state | Focused main action has solid outline; mode words carry state without color, text actions remain inside native buttons |
| Rack standards | Condensed control text, mono status, graphite surfaces, existing clipped primary action retained. Two-row phone trial explicitly supersedes the one-row phone contract; historical control pin retains other authority |

Setup: `window.__flowsynth.devFocusScenario(); window.__flowsynth.devFocusScenarioAssert()` installs and verifies the isolated save. For flow use `app.ui.chosenTarget=1500; app.startFlow()`, then `app.pause()`. Breather presentation seeded directly with mode breather and `{startedAt:Date.now(),allowanceSeconds:300,elapsed:0}`, then render; this does not verify the summary-to-Breather journey. Desktop resets the same isolated scenario.

Verification limits: hardware touch, runtime reduced-motion emulation, live historical-pin comparison, and long-habit stress captures unavailable. No animation or disclosure behavior changed. Browser reports visible=false but snapshots/evaluation succeed; visibility itself unverified. Measured live viewport confirms sizes despite resize response echoing a stale 1280×800 measurement.

Checks: targeted app/instrument/theme passed (103 tests); `npm run check` passed. `npm test` passed: 93 files, 1859 passed and 2 existing skips.
