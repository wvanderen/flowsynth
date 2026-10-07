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

## PR #291 review fixes (2026-10-07)

The Inventory tray now declares `aria-modal="false"`. Both sheet faces use
instrument tooltips with a separate 44px disclosure target; inspecting details
never arms placement. The tile remains the tap-to-place and drag target.

Review server provenance verified at `http://localhost:5175/-/dev/provenance`:
worktree `/private/tmp/flowsynth-review-291`, commit `33450592` plus these review
fixes. `tray-disclosure-review.png` shows the real sheet and open disclosure,
without moving the tray column or changing its docking geometry. The live
viewport measured 1402 × 877; the screenshot pipeline still crops at 1280px.
This screenshot demonstrates disclosure, not the full desktop docking position.

Verified live: focus entry opens disclosure; Escape dismisses the tooltip while
keeping Inventory open; clicking the separate disclosure button opens details
without arming a mutator. Automated regressions also cover tap-away dismissal,
subsequent tile placement, and the non-modal ARIA declaration.

### Outstanding visual checks — unavailable

- **390px phone composition:** both freeform 390 × 844 and the iPhone 12 Pro
  preset resize timed out. The earlier 546px captures are breakpoint examples,
  not a successful approximately-390px viewport pass.
- **Uncropped desktop column composition:** the capture pipeline crops the real
  right edge. Earlier translated screenshots illustrate faces only, not the
  final docking position. Live geometry confirms the column's right edge is
  12px inside the board space; no new screenshot claims a full layout pass.
- **True touch disclosure and dragging:** no touch-input emulation available;
  button-click tests do not establish a physical touch pass.
- **Non-color four-state visual review:** no complete grayscale state sequence
  captured; unavailable, not verified.
- **Reduced-motion emulation:** unavailable; the existing global reduced-motion
  rule remains source-verified only.

Source comparison with the pinned instrument prototype: disclosure uses the
shared instrument tooltip layer, without expandable cards or explanatory prose.
The canonical glyph, effect, rarity ticks, and separate placement gesture remain.
