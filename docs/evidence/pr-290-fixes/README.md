# PR #290 review fixes

- Retrieval now runs the same discovery, allocation-retention, and achievement boundary as placement. A regression removes C♯ from C–G–E–B–C♯ and asserts the newly earned feat and complete preview/commit snapshot equality.
- Matching-twin drag targets open combination review without presenting a swap projection.
- Selected and projected voices share their figure renderer, including consistent silent-voice factor treatment.
- Figure and quality disclosures use the existing instrument tooltip layer, focusable controls, 44px hit height, Escape and tap-away dismissal. Unchanged markup preserves focus and pinned disclosure across readout refreshes.

## Instrument review

Source compared against the pinned instrument prototype at eb232c4: compact figure rows remain; the scale conveys quality with tick/marker position and weight; disclosure uses the shared layer and does not add motion.

Launched this checkout at http://localhost:5174/?dev=1; browser provenance verified worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-bc7bebef`, commit ee37fae with the review fixes served as working-tree edits.

Browser checks are **unavailable**: preview automation repeatedly failed or timed out for evaluate, snapshot, navigation and phone resize. Returned screenshots did not reflect the seeded readout DOM, and the browser focus probe did not open disclosure reliably. These results are not claimed as visual/interaction passes. Desktop/phone layout, physical touch, greyscale and reduced-motion emulation require follow-up browser verification. Automated UI coverage checks focus/tap opening, Escape/tap-away dismissal, transient previews, combine suppression, and existing placement flows.

## Checks

- Typecheck and targeted engine/UI regressions pass.
- Full suite: 1,077 passed, three test/hook timeouts; all three timed-out cases pass in an isolated rerun (3/3). All 1,080 tests therefore passed across the full run and targeted rerun; a single clean full-suite run is not claimed.
