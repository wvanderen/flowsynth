# #272 — One mode: board tabs, tray column, dock (review rework)

Implemented and captured at this worktree's dev server (`npm run dev`, port 5173). Provenance verified from each capture tab via `/-/dev/provenance` before staging:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-7a56c3a3` (= `git rev-parse --show-toplevel`)
- Branch: `t3code/implement-feature`, commit `d690580a907d6e65c168eaaa2415cac888accb2b` plus this rework's working tree (the server serves it)
- Desktop captures: 1,402 × 877 CSS px; phone captures: 546 × 877 (within the <600px container breakpoint, so the real phone composition rules apply)

## What the captures show

- **column-modules-face.png** — desktop, Modules mode: the always-open tray column at the board's right edge carrying no switcher of its own — the board tabs under the ledger (top-left, MODULES active) are the one Modules/Mutators switch (review feedback: the column's duplicate switch is gone). Category-hue minimal-mark tiles stand in the Modules face; presence outlines mark hosted cells.
- **column-mutators-face.png** — one click on the board tabs' MUTATORS: the column swaps to the arete-register Mutators face (tile + unlock pill), the board wears the slot faces over the greyed modules. No independent tray peek anywhere.
- **phone-mutator-strip.png** — phone, Mutator mode: the Mutators face re-pins as the strip above the thumb bar (tile + unlock), the board tabs hug the top, slot faces over the resting board, thumb bar Catalog / Forge / Add / Inventory / Collection.
- **phone-sheet-mutators.png** — the thumb bar's Inventory opens the unified tray sheet: INVENTORY eyebrow + ✕, the MODULES/MUTATORS switch riding the sheet, the Mutators face showing the arete-register tile — no how-to prose.
- **phone-sheet-modules.png** — one tap on the sheet's switch: the global mode flipped (the board tabs behind follow to MODULES) and the sheet swaps to the category-hue module tiles, icon-only. Tiles bind the same gestures as the column — tap-then-cell/slot places, a live drag carries between board and sheet in both directions (the backdrop turns drag-through while a drag is live, so drops resolve against the board; a drop back onto the sheet retrieves). The automated suite covers the drag-through cycle, the sheet switch flip, and the sheet retrieval drop.

## Capture constraint, disclosed

The preview pipeline's desktop captures render the live 1,402px window cropped at 1,280px and drop board-anchored overlays near the window's right edge. The column's true dock is `right: 12px` — asserted live via computed style (`position: absolute; right: 12px; width: 96px; pointer-events: none`) and `getBoundingClientRect` before and after the captures. For the two desktop face captures the column was translated to a mid-board position with a temporary inline style (capture-only; removed afterwards, state hard-reset). The pre-entry capture shows the column at its true position inside the crop.

## Automated checks

- `npm run check`: passed.
- `npm test`: 48 files, 1,043 tests passed — including the tray-column no-second-switch tests, the tray-sheet tests (switch flip, no prose, drag-through + sheet retrieval drop), and the stylesheet gesture-surface check (`theme.test.ts`).

## Unavailable checks

- **Reduced-motion emulation**: unavailable in this preview. The unlock pulse is animation-only state; under `prefers-reduced-motion` the stylesheet's global `animation: none` stills it and the armed state remains readable through the dashed outlines and the pill (source-verified, not an emulation pass).
- **True touch disclosure**: unavailable; the sheet switch and tiles respond to pointer taps (exercised by the flip captures), which is not claimed as a touch pass.
- **Keyboard-focus capture of the reworked switch**: the dedicated screenshot was dropped this round (the earlier shot framed the since-removed tray head); the switch's keyboard operability is asserted by the suite's Tab-walk and flip tests instead.
