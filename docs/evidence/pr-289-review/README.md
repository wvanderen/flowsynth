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
