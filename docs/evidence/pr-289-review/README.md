# PR #289 review fixes

The capacity Catalog row and Arete offerings use open, rule-separated rows, compared with the pinned instrument prototype at `eb232c4`. Independent disclosure triggers use the existing instrument tooltip primitives; locked and unaffordable purchases do not block disclosure. The two offering purchase helpers share their state branches.

## Verification

- Typecheck passed.
- Full suite passed: 49 files, 1,051 tests (before adding the disclosure regression).
- Final `src/ui/app.test.ts` run passed all 287 tests, including the added disclosure regression: unavailable purchase, focus opening, Escape dismissal without closing the sheet, click pin and click-away, and the locked ceiling prerequisite.
- Desktop captures: [Catalog](catalog.png), [Arete](arete.png), [locked prerequisite tooltip](locked-tooltip.png).
- Browser click opened the locked prerequisite tooltip; Escape hid it and retained the Arete sheet. Readouts and acquired/locked words convey state independently of color. No animation was added.

## Provenance

Served with `npm run dev` at `http://localhost:5173/?dev=1`. `/-/dev/provenance` confirmed worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-9db4661f`, branch `t3code/review-pr-289`, base commit `3641bb468054bd073cd5275e8403d7aa4f8eba41`, with the review fixes present as uncommitted changes. Desktop browser reported 1,402 × 877 CSS pixels; screenshot artifact is 1,280 × 800.

## Unavailable

- Phone resizing timed out at 390 × 844; no phone pass claimed.
- True touch, greyscale, and reduced-motion emulation unavailable.
- Native browser keyboard-focus opening was not verified: programmatic focus moved the active element but did not deliver focus disclosure in this preview. The automated regression verifies the focus event path; browser click and Escape were verified separately.

## Integration with main's tabbed catalog (#271 / PR #288)

The merge moves capacity into the nous face and permanent capacity offerings into the unlocked Arete face. The Catalog door, fixed frame, face switch, prestige-count lock and single pre-entry Mutator offer are preserved. This resolves the overlapping old separate-sheet implementation in favor of the accepted tabbed shop: capacity offerings appear after Mutator entry. Purchases use the shared catalog price and acquired-state primitives, including insufficient-Arete and flow disabling; the existing tooltip layer covers both faces. Capacity ownership remains part of the shared dialog rebuild key.

The ten capacity UI scenarios pass after migrating them to the face switch; typecheck and whitespace checks pass. Source review against the pinned prototype confirms use of the catalog's open row primitives and independent disclosure triggers.

Fresh desktop/phone interaction captures for the merge are unavailable: the launched checkout's provenance endpoint was verified at `http://localhost:5174`, worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-9db4661f`, head `f09d07c`, but the collaborative preview failed to load the app module with a `video/mp2t` MIME error. Reloading, a fresh URL, loopback host and environment-port navigation did not recover the app. Earlier screenshots above predate the tabbed-catalog integration and are not claimed as verification of this merge. Touch, grayscale and reduced-motion checks likewise remain unavailable.

Final merge checks: `npm run check` and whitespace checks passed. The first full invocation hit 10-second setup-hook timeouts in seven late UI scenarios; it was stopped after the UI failures were reported. Verification then passed in two runs: `npx vitest run --exclude src/ui/app.test.ts` (48 files, 765 tests), and `npx vitest run src/ui/app.test.ts --hookTimeout=60000` (297 tests). No persistent timeout configuration changed. After binding tooltip listeners to the replaceable catalog frame, all ten capacity scenarios passed again, including click pinning after switching faces. This prevents disclosure handlers accumulating on the stable dialog root across face rebuilds.
