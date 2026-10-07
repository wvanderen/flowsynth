# #272 — One mode: board tabs, tray column, dock (review rework 2)

Implemented and captured at this worktree's dev server (`npm run dev`, port 5173). Provenance verified from the capture tab via `/-/dev/provenance` before staging:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-7a56c3a3` (= `git rev-parse --show-toplevel`)
- Branch: `t3code/implement-feature`, commit `626d465a` plus this rework's working tree (the server serves it)
- Desktop captures: 1,402 × 877 CSS px; phone captures: 546 × 877 (within the <600px container breakpoint, so the real phone composition rules apply)

## What the captures show

- **column-modules-face.png / column-mutators-face.png** — desktop: the always-open tray column at the board's right edge carrying no switcher of its own; the board tabs under the ledger are the one Modules/Mutators switch, and the column's Mutators face is tiles-only — the unlock arm lives in Add.
- **phone-no-strip.png** — phone, Mutator mode: the always-on Mutator strip card is gone — the lane above the thumb bar is clear; the board tabs and slot faces stand alone.
- **phone-sheet-scrimless.png** — the tray sheet stands scrimless (verified live: backdrop `background: transparent`, `pointer-events: none` while the sheet's own panel keeps events): the board behind stays fully visible and live, so drags to and from the sheet genuinely land. The Mutators face's tiles present at the same size as the modules' (the sheet grid's cells, not the old 54px strip tiles).
- **phone-sheet-modules.png** — one tap on the sheet's switch: the global mode flipped (board tabs behind follow), the sheet shows the three category-hue module tiles icon-only at the same size, no dim, board live behind.
- **phone-add-arms-unlock.png** — Add is mode-directed: in mutator mode its tap arms the slot unlock (the pill "Unlock Mutator slot · 8 Arete — Cancel · Esc" rides the board's top edge, the Add segment reads active) and puts the sheet away first so the pulsing targets stand on a visible board. No tray card carries the unlock anywhere.

## Capture constraint, disclosed

The preview pipeline's desktop captures render the live 1,402px window cropped at 1,280px and drop board-anchored overlays near the window's right edge. The column's true dock is `right: 12px` — asserted live via computed style and `getBoundingClientRect` before and after the captures; the two desktop face captures were taken with a capture-only temporary inline translation (removed afterwards, state hard-reset). The pre-entry capture shows the column at its true position inside the crop.

## Automated checks

- `npm run check`: passed.
- `npm test`: 48 files, 1,045 tests passed — including the mode-directed Add tests (cell in module mode, slot unlock in mutator mode, sheet-put-away on arming), the tray-column no-second-switch and tiles-only-face tests, the scrimless-sheet tests (peek-tray class, sheet retrieval drop), and the stylesheet gesture-surface check.

## Unavailable checks

- **Reduced-motion emulation**: unavailable in this preview; source-verified (the global `animation: none` stills the unlock pulse; the pill and dashed outlines carry the armed state).
- **True touch drag**: unavailable; pointer-level drags were exercised by the automated drag tests and the pointer-driven captures, which is not claimed as a touch pass.
