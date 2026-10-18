# PR #412 review corrections

Captured from this checkout at `http://localhost:5175/?dev`, with base commit `b7da1eebb295d5724cd6f14a3434fcd924f621df` plus the review corrections. The provenance endpoint matched `/Users/eggfam/.t3/worktrees/flowsynth/t3-33b7f6f2` and that commit before captures.

- Restored category glossary disclosures beside the Jacquard Roll controls, using sibling buttons rather than nested interactive elements. Rolled category and Plied Weft offer notes disclose their domain terms too.
- Draft Loom level and percentage figures use the existing tabular monospace class.
- Compared with the pinned instrument standards and current amendments: the catalog retains open rows, square controls, category glyphs, and the existing glossary layer without info icons.
- Live browser at 390 CSS pixels confirmed focus opens the category definition, Escape dismisses it, and click activation reopens it without consuming the Card. Computed styles confirmed both Draft Loom numeric spans use monospace.
- `desktop.png` captures the scrap face at 1280 CSS pixels. `phone-disclosure.png` captures the 390 CSS pixel disclosure state. Preview captures are blurred, and the phone artifact repeats the viewport horizontally; precise pixel-level visual assessment is unavailable from these artifacts. Browser DOM checks and UI interaction tests supplement these limited captures.
- Physical touch, grayscale inspection, and reduced-motion emulation were unavailable. These corrections introduce no animation; held counts and disabled button semantics remain.

Validation: `npm run check` passed; the special-draft interaction suite passed all 10 tests; `npm test` passed 83 files, 1,665 tests, with 2 skipped.
