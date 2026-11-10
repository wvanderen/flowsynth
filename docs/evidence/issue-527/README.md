# #527 completion record

Branch: `t3/ledger-reset-enemy-pressure`. Offered source: `e54b19b12dc8a3a841ef8ddf099da4441e8a12ba`.

## Scope and provenance

Read #527 and parent #525, including comments (both had none), via `gh issue view --json title,body,comments`. Prepared HEAD was baseline `4f9cfa7`; `git merge-base --is-ancestor 4f9cfa7 HEAD` returned 0 before editing. Local `integration/525-world-progression` was merged before freeze: already up to date at `4f9cfa7`. No unlock/acquisition/face implementation, claim arithmetic, enemy arithmetic, calibration artifact, issue closure, or PR changes.

The parent explicitly confirms application workflow and engine/save seams. TDD used production App workflows in `src/ui/app.board.test.ts`: each new slice failed for its missing observable surface before implementation, then passed. Existing engine arithmetic tests remain the precision seam. No test-only API added.

## Criterion mapping

| #527 criterion | Named verification | Class / limits |
| --- | --- | --- |
| Desktop and phone ambient pending Arete and explicit reset without opening ledger | `app.board.test.ts`: “ambient reset on desktop and phone explains eligibility and retains zero-yield confirmation” checks both ambient doors, zero pending yield, positive pending yield and confirmed banking | Automated. Visual composition unavailable (see below). |
| Confirmation, upgrade restriction, below-eligibility reason, unmistakable zero yield | Same case checks `aria-disabled`, associated reason, refused flow action, zero confirmation, and positive phone confirmation; existing “the prestige door” cases cover the ledger flow | Automated. Real keyboard/touch acceptance unavailable. |
| Catalog remains spending destination, ordinary shared disclosure preserved, no horizon | Existing board/ledger regressions plus source diff review: ambient buttons are siblings of shared ledger buttons; no spending controls or horizon added | Automated regression + manual source review. Existing ledger Arete action retained as the established workflow, not added as a second ambient action. |
| Actual combined active penalties and individual multiplicative factors | `app.board.test.ts`: “ledger explains pre-unlock pressure with multiplicative sources and live deepening” checks two 20% sources as 36.0%, per-source ×0.800, two deep 65% sources as 87.8%, and defeated-source exclusion. `src/engine/world.test.ts`, describe “multiplicative penalty stacking (issue #425, priority 3)” verifies production arithmetic | Automated. Enemy arithmetic unchanged. Defeated bonuses intentionally excluded from active-pressure reduction. |
| Deepening, positive-Arete discovery explanation before map access, no coordinates/placement | Same application pressure case opens ledger on a fresh state, asserts explanation, deepening and source removal. Source review confirms no map, coordinates or placement affordances in disclosure | Automated + source review. Actual permanent unlock belongs to #526 and is not claimed shipped here. |
| Application workflow and engine verification; keyboard/touch explanations without hover | Above workflow cases and existing world arithmetic/deepening tests. Reasons are standing text linked by `aria-describedby`; reset stays focusable with guarded `aria-disabled`; pressure is standing ledger text | Automated for application behavior. Physical keyboard/touch acceptance unavailable. |
| Final desktop/phone evidence, pre-unlock pressure, ambient reset/yield, zero, confirm, unavailable, non-color/reduced-motion | Provenance preflight accepted at frozen source; phone live geometry read confirmed 390×844 and reset button 98.25×44px | **Unavailable / acceptance blocker**: no captures or final visual judgment obtained. No scope waiver requested or claimed. |

## Preliminary source/spec gate, before freeze

Reviewed complete source diff against #527/#525, ADR-0087, AGENTS, instrument standards and completion mapping. Findings resolved together: initial zero confirmation wording was awkward and an existing assertion required the plain “banks no Arete” wording; corrected to explicit `0 Arete` alongside it. Initial new pressure expectations duplicated formula logic; replaced with independently worked literals (36.0%, 87.8%, 65.0%) and concrete per-source factors. Second source pass found no remaining source blocker. No optional refactor undertaken. Targeted tests after fixes: 206 passed across board, ledger and engine World files. Source committed/frozen before final checks and browser attempts. This gate is not final acceptance.

## Checks

- `npm install`: completed; npm reported three high-severity dependency advisories (not changed in this slice).
- Initial `npm run preflight`: refused host Node 26.13.0. Followed prescribed manager selection: `mise exec node@22.23.4 -- npm run preflight` accepted Node 22.23.4, America/Chicago, working happy-dom storage.
- Targeted final iteration: `npm test -- src/ui/app.board.test.ts src/ui/ledger.test.ts src/engine/world.test.ts`: 206 passed.
- Frozen `npm run check`: passed typecheck and five-script recorder static gate.
- Frozen full `npm test`: **incomplete / acceptance blocker**. First invocation exceeded command timeout (200 seconds); restarted once because the run was interrupted. The retry was allowed over 17 minutes, with an active UI worker consuming a CPU, but produced no summary; interrupted via SIGINT rather than leaving background verification running at hand-off. This is not a green full suite, nor proof of a failing test. See `full-test-incomplete.log`. Git diagnostics printed “fatal: not a git repository”; not independently interpreted as suite failure. Do not count the targeted pass as full-suite acceptance. `check.log` and `targeted.log` retain completed check output.
- No calendar-adjacent or balance arithmetic change; calendar matrix and balance recordings not owed by this slice. Historical calibration is not evidence for the changed acquisition economy.

## Final browser attempt and unavailable evidence

Launched this worktree with `npm run dev`: `http://localhost:5175/?dev=1`. Capture preflight accepted clean source at e54b19b; see `provenance.json`. Seeded isolated `fresh-start` using `devLaunchScenario`, then one discovered living enemy (`w0`, hp 100) and rendered. Initial evaluate syntax error was corrected to an async wrapper; setup then ran successfully.

Desktop live size read: 1280×800. Browser status repeatedly reported available, loaded, correct URL, no dialog, `visible:false`. Snapshot attempt 1 failed with **“Preview automation snapshot timed out after 15000ms.”** Ran `node tools/evidence-healthcheck.mjs --url http://localhost:5175 --viewport 1280x800`: server/provenance healthy. Read `preview_status`, retried same snapshot: same error (attempt 2). Read status again, retried same snapshot: same error (attempt 3). Browser-snapshot budget exhausted; no artifact exists and no screenshot is claimed. Visibility confirmation also unavailable.

Phone resize returned a stale 1280×800 echo; a subsequent live page read confirmed **390×844**, strip bounds x22..368/y140..274, reset bounds x154.28..252.53/y221..265 (44px height). This is a geometry observation, not a visual pass. Phone ledger click timed out with **“Preview automation click timed out after 15000ms. The click may have happened; check the page before retrying.”** Follow-up evaluate found modal null, so no touch disclosure pass is claimed. No further screenshot retries after budget exhaustion.

Unavailable: all required desktop/phone screenshots for pressure, ambient reset/yield, zero yield, confirmation, unavailable states; keyboard/touch disclosure dismissal; grayscale/non-color visual judgment; reduced-motion browser judgment. New controls add no animation, but that source observation does not substitute for requested evidence. Final acceptance remains blocked on those missing checks and the incomplete full suite; the implementation is not represented as accepted. Final local integration merge was attempted again after the browser/check attempts: still already up to date at baseline `4f9cfa7`. No source changed after freeze.
