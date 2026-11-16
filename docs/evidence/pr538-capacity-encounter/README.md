# PR #538 review findings — capacity encounter recovery

## Scope and source

Reviewed PR tip: `a38d6b6b709cfe8f32c52f80c38f70b04a1e8168`.
Fix/source freeze: `220f0260a592a0bd6df6c4efd5071eeba2ca9d35` on `fix/pr538-capacity-encounter`.

This record owns the three findings from the PR review, not a new declaration that the full Encyclopedia is accepted. No issue has been closed and no scope waiver has been inferred. The later owner-approval comment on #532 names source `632c779`, not the source reviewed or fixed here.

## Findings and criterion mapping

| Finding / requirement | Disposition and named verification | Class |
| --- | --- | --- |
| Chords available at the first visible capacity constraint, before purchase or opening a panel | Fixed. `src/ui/app.encyclopedia.test.ts`: **offers chords before opening a panel when desktop capacity is visible, but waits on phone** asserts the standing capacity readout, no purchased capacity, available/unseen Chords in the global library, no automatic modal, retention after shrinking to phone, fresh phone absence, and availability after opening the phone ledger. Browser `capture.mjs` verifies actual desktop/phone CSS visibility and the same availability split. | Automated + scripted browser evidence |
| Preserve the one-layout-read render contract while checking the responsive gate | Encounters run after `beginLayoutPass()` in `src/ui/render.ts`; the policy and save/indicator updates remain in `App.refreshEncyclopediaEncounters`. `src/ui/app.phone.test.ts`: **a render pass reads the container's layout once, and a resized pass reads again** passes. | Automated |
| Scenario launch retains opening-state and save-isolation guarantees | Updated desktop Encyclopedia expectations in `src/ui/app.scenarios.test.ts`; all launch/isolation cases pass. No scenario engine or save normalization policy changed. | Automated |
| Required visual/accessibility acceptance | **Still blocked.** Captures below verify this narrow fix with desktop keyboard and emulated phone touch. They are not independent visual/accessibility approval, physical-device or screen-reader validation. The previously recorded phone inspection overlap is not changed or approved by this fix. | Unavailable — requires independent/human judgments |
| Representative Charge, idle-Chord/local-constraint and Prestige comprehension | **Still blocked.** No representative participant responses were collected. Existing task prompts remain in `../issue-536/README.md`, “Human tasks — unavailable, not passes.” Record responses/errors for each task rather than treating page opening as understanding. | Unavailable — requires representative human participation |

## Source review and recovery

Preliminary source/spec review of the fix checked the responsive boundary against the stylesheet: the standing board ledger is hidden below the 600px app-container breakpoint, and the phone strip omits capacity. The trigger uses the shared `isPhoneWidth()` gate; it does not unlock Charge, open the reader automatically, or relock knowledge after resizing. No engine/balance changes, tooltip purge, or presentation redesign was introduced.

The first full run exposed stale desktop scenario expectations and an extra layout read from evaluating the gate outside the layout batch. Both were resolved together before freeze; the three touched UI suites then passed. The first full run also reported one recorder smoke race failure (`m.playthroughSource is not a function`); the unchanged recorder passed in the final full run. This is a recorded transient result, not a claim that its cause was diagnosed.

The old `issue-536/revision-2` source freeze and suite results are superseded for this revision. Its opening availability and affected browser assertions are not current evidence. The captures here regenerate only the capacity-encounter scenarios; they do **not** relabel the previous complete reader walkthrough, task-scroll checks, or other captures as verified at this source. Full integrated acceptance remains blocked on the remaining evidence/judgment obligations.

## Checks at the fixed source

- Dependencies installed with `npm install` before checks.
- Initial preflight rejected host Node v26.13.0; `mise exec node@22.23.4 -- npm run preflight` accepted Node v22.23.4, America/Chicago and happy-dom storage.
- `targeted.log`: Encyclopedia, scenario and phone suites — **83 passed**.
- `check.log`: `npm run check` — passed, including recorder static gate.
- `full-test.log`: final `npm test` — **134 files passed; 2,418 tests passed, 9 skipped**. The log retains the smoke harness's git-discovery diagnostics; they did not fail a test.
- `git diff --check` passed before freeze.

## Browser evidence at the freeze

`npm run dev` served this worktree at `http://localhost:5174/`. `provenance.json` records the clean-source capture preflight at `220f0260`. Local headless Chromium ran `capture.mjs` through CDP; no foreign checkout or server was used. Development-only instrumentation was hidden by the capture script; shipped controls were unchanged.

- Desktop **1280×900**: `desktop-fresh.png`, `desktop-initial-topics.png`, `desktop-chords.png`. Capacity visible before any panel, Chords available/unseen, entry opened by keyboard and closed to the board.
- Phone **390×844**: `phone-fresh.png`, `phone-initial-topics.png`, `phone-chords.png`. Standing capacity hidden, Chords initially absent, then available from the visible ledger and opened by emulated touch; closing restores the ledger.
- `observations.json` and `capture.log`: viewport size, no document-width overflow, initial save-owned marks, visibility, topics, opening/seen state and task-return assertions. Reduced-motion preference was set for both passes. No new animation was introduced.

The captures have been inspected for the narrow visibility/topic/readability behavior. They do not satisfy independent perceptual approval or comprehension. No final acceptance is claimed.
