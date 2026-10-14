# Forge #335 implementation evidence

Reviewed 2026-10-14 against the presentation prototype pinned at eb232c4 and controls pinned at d405ce2, with #335's horizontal Forge progress amendment. Application changes are uncommitted on base 2556cc3554c9ca42a843d7f37b7b71d0a1dc79cf.

## Verified

- Served this checkout with npm run dev at localhost:5175. The provenance endpoint reported `/Users/eggfam/.t3/worktrees/flowsynth/t3code-22e6f5ec`, branch `t3code/improve-forge-bank-rolls`, commit `2556cc3554c9ca42a843d7f37b7b71d0a1dc79cf`.
- Desktop 1402×877: [Modules](desktop-modules.png), [Mutators](desktop-mutators.png). Both populated with temporary dev state (4 module rolls, 2 mutator rolls). Numeric progress is visible beneath horizontal tracks. Open hex choices replace individual enclosing cards. No footer prose. Both branch counts are visible. Module panel is 820×435.5px; mutator panel is approximately 820×434px; neither scrolls in this capture.
- Browser keyboard: focused Mutators then pressed Enter through preview_press. Only its two candidates appeared; focus remained on the switch; queues stayed at 4 and 2. Escape dismissed, queues stayed at 4 and 2.
- Branch selected state uses a firm inset underline as well as text/ARIA pressed state; counts/progress retain text figures. Greyscale capture unavailable.
- No candidate motion: computed transition duration 0s. No track-fill animation is introduced. Reduced-motion emulation unavailable.
- Typecheck passed. Full suite: 62 files, 1298 passed, 2 skipped. UI regression: 25 files, 682 passed. New tests cover branch switching, opening fallback, intentionally empty branch retention, total dock count, live progress/focus retention, both draft landings and dismissal without spending.
- Static Impeccable scan of src/ui/render.ts returned [] (template renderer scan is limited).

## Unavailable

- Phone visual evidence: collaborative preview resize timed out, including a named iPhone 12 Pro preset with a 20-second timeout. No alternative browser system was used. Phone CSS provides open rows with hex beside the readout, sticky branch/Close controls, bounded scrolling and no carousel; this is implementation evidence, not verified phone composition.
- Browser touch interactions, touch disclosure, greyscale and reduced-motion emulation unavailable. No new tooltip interaction was introduced; choice effects use visible text and aria-describedby rather than native title tooltips.
- Browser choice activation/outside-click dismissal were not exercised in the visual pass; regression tests verify candidate outcomes and outside-click behavior.

The obsolete standards example preserving the dismissal paragraph was replaced with visible Close/Esc and the short exclusive-choice cue. CONTEXT.md records the agreed branch-opening and display rules. Economy and draft outcomes are unchanged. The review-only dev server was stopped after capture.
