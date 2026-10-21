# PR #441 ledger balance overflow

Verified `http://localhost:5175/-/dev/provenance`: worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3-b6a408dc`, base commit
`cccb68902ba4efd7c14d7345bddb116a26c39282`, with the CSS fix applied.

Browser-only stress values set Arete and Scrap readouts to
`1,000,000,000,000`; no save or economy data was changed. The reserved
columns stay fixed, while exact digits wrap within their lane and the
value row grows vertically. Resource icons remain visible.

- [Desktop](desktop.png): measured viewport 1024px, document width 1024px;
  Arete/Scrap client and scroll widths both 80px.
- [Phone](phone.png): measured viewport 390px, document width 390px;
  Arete/Scrap client and scroll widths both 88px.

The preview captures include compositor scaling/duplication; viewport and
overflow assertions above use the page's DOM measurements. Against the
instrument standards and header/ledger amendment, the existing type,
resource marks, square control, and open panel divisions are preserved.

Typecheck, all 33 UI test files (816 tests), and `git diff --check` passed.
Physical touch/trackpad, grayscale, keyboard/touch disclosure and OS
reduced-motion checks were unavailable in this bounded layout pass.
