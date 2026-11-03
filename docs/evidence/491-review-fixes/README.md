# #491 / PR #504 review-fix verification

## Source and commands

Runtime source: `3181bebf6e8e0fb0153b90ed507e0d0ae7478654` (runner 14, compiled engine `1ae24261`). The 48 matrix walks and 17 real no-refund continuations are recorded from that commit. [The completion record](../../later-era-productivity.md#every-acceptance-criterion-beside-its-evidence) maps each acceptance criterion to named tests or recordings; **the new-frontier-effort criterion remains unmet and blocks completion**.

Browser capture source: `9161c52b`, which adds the corrected recording documents to that runtime source; `git diff 3181beb..9161c52 -- src tools` is empty. The served checkout was `/home/lem/dev/flowsynth`, branch `t3/issue-491`, at `http://localhost:5173`. [provenance.json](provenance.json) is the capture preflight's clean-source acceptance, not an old server's banner. The later addition of this evidence folder changes no runtime source.

```sh
npm run dev
node docs/evidence/491-review-fixes/capture.mjs http://localhost:5173
```

`capture.mjs` runs the preflight, opens its own temporary Chromium profile, drives the checkout through CDP, records both viewports, closes Chromium, and removes its profile. It does not use or alter a user's tab or save. It selects a real crossing from a seed-23 pushing walk (10 baseline days, one 600-minute session/day, five-minute breather); this intentionally different schedule is readout evidence, not an additional productivity-matrix row.

## Changed inspection readout

- [Desktop 1280×800](desktop-crossing.png)
- [Phone 390×844](phone-crossing.png)
- [Machine-readable checks](verification.json)

The selected boundary is `Era 1 — the prior frontier's depth passed`, snapshot 22 / boundary 23 of 29. Both the event and inspected snapshot read **224,880 credited seconds = 62h 28m**, at simulated day 7, 02:28:00. Both screenshots expose that boundary's decision beside the numeric inspection readout. The exact values are asserted before capture; this is not an inference from the graph's color or approximate x-position.

Checks against `docs/instrument-standards.md` and its pinned prototype, limited to the changed readout:

- Clock/resource readouts remain plain, labelled measurements without new decorative categories or warning color. Units and numerals remain readable at both sizes; the phone's long first line wraps instead of dropping the credited value. The unchanged graph and historical board retain their intentional horizontal scrolling.
- Native Tab then Shift+Tab returns to the credited-axis control. It has visible keyboard focus in both captures, and its measured target is 72.56×44px. The selected readout retains `role="status"`.
- Reduced motion is emulated in both captures; computed readout animation is `none` and transition duration is `0s`. No motion was added by the repair.
- Live GameState JSON and localStorage contents are unchanged by the walk and inspection; both are asserted in `verification.json`.
- The five existing policy-option labels are recorded in both views. No labels, layout, terms, or disclosure mechanisms changed in this repair. The original option-surface evidence remains [491-policy-select](../491-policy-select/README.md).
- **Unavailable / not claimed:** physical-phone touch operation and screen-reader speech output were not run. No new tooltip/disclosure was introduced, and the unchanged glossary's open/dismiss behavior was not re-exercised by this capture. Viewport emulation, focus/status assertions, and measured targets are not substitutes for those checks.

## Automated verification, including the initial environment failure

All checks below exercised the final runtime source `3181beb`; only recording documents and this evidence were added afterward.

| Command / check | Result |
| --- | --- |
| Targeted regression iteration | Five selected new boundary/ownership/continuation regressions passed after reproducing the clock failure. The real continuation regression's initial default-timeout failure was corrected with an explicit 60-second timeout. All touched-area cases also ran in the engine pass below. |
| `npm run check` | Passed (`tsc --noEmit`). |
| `npm test`, shell-default Node 26.7.0 | All 67 engine/tool files and 12 UI files passed. The other 28 UI files failed during fixture boot/cleanup because Node 26's native localStorage global is undefined without a storage file (`localStorage.clear()`), before their application assertions ran. This is recorded as a failed run, not a green full-suite result. |
| `PATH=/home/lem/.local/share/mise/installs/node/22.23.4/bin:$PATH npx vitest run --project ui` | All 40 UI files / 971 cases passed under CI's Node 22. This reran the affected project, not the already-green engine suite. Together with the full run, every one of the 107 test files has a passing result on unchanged source; 2,111 cases passed and six explicit long-recording gates were skipped. |
| `PATH=/home/lem/.local/share/mise/installs/node/22.23.4/bin:$PATH npm run build` | Passed. Vite emits the existing large-chunk advisory. |
| Six `tools/record-later-eras.mjs slice` commands | All 48 real walks passed their per-snapshot finite/rate, event-clock, crossing-split, per-era defeat, purchase-policy, and strictly increasing frontier assertions. Each slice records commit and actual compiled source. |
| Direct `routeProbes` recording with `{ budgetDays: 30 }`, run alongside the matrix; composed after matching source and commit | All 17 real purchase-order continuations advanced: frontier 2→4 in 5 credited hours (10 orders), 4→5 in 6h (3), 6→7 in 9h (2), and 8→9 in 11h (2). Every branch is finite, no-grant, and no-refund; every tested frontier has a directly demonstrated fighting route. |
| Composition / documentation cross-check | Six slices match the same source/commit and seed matrix; 48 rows, 15 completed four-bank walks, 86 closed later eras, 32 genuinely attempted open eras, 78 faster familiar returns, 22 new-territory majorities, 24 over-half rebuilding spans. These misses remain explicit. |
| `node --check tools/record-later-eras.mjs`; `node --check docs/evidence/491-review-fixes/capture.mjs`; `git diff --check` | Passed. |

No entitlement/reset, enemy, price, or first-prestige calibration was changed to make the recordings pass. Do not read the corrected evidence or green regression coverage as acceptance of the outstanding balance requirement.
