# #272 — One mode: board tabs, tray column, dock

Implemented and captured at this worktree's dev server (`npm run dev`, port 5174). Provenance verified from the tab before every capture via `/-/dev/provenance`:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-7a56c3a3` (= `git rev-parse --show-toplevel`)
- Branch: `t3code/implement-feature`
- Commit at capture: `b7560b839537f253e028e5bc53937fd532047e84` (working tree carries the #272 diff; the dev server serves it)
- Browser viewport: 1,402 × 877 CSS px (desktop)

## What the captures show

- **modules-face-pre-entry.png** — upgrade mode before the Mutator entry: the tray column stands open at the board's right edge with the Modules face only (no head — pre-entry, #273 adds the locked-but-visible face), module tiles wearing ADR-0027's minimal mark in category hues. The dock reads Catalog / Forge / Add (three icons; no Inventory).
- **mutators-face.png** — after the dev-era grant, the Mutators face: the tray head's MODULES/MUTATORS pair with MUTATORS active in the arete tint, the arete-register mutator tile (hexagon outline + glyph + effect short — the minimal mark), and the unlock pill riding the face's end; the board behind wears the slot faces with the resting modules greyed. Both tab mounts agree — board tabs (top-left) and tray head are the same switch.
- **head-flips-to-modules.png** — one real click on the tray head's MODULES button: the global mode flipped (`ui.mutLayer: "mutators" → "modules"`), the board tabs' active state followed, the modules face swapped back in (generator/booster/forge tiles in their category hues), and the board's mutator presence outlines replaced the slot faces. No independent tray peek.
- **head-keyboard-focus.png** — after two Tab presses, the tray head's MUTATORS button wears the visible keyboard-focus ring; the switch is reachable and operable from the keyboard (aria-pressed on both mounts).

## Capture constraint, disclosed

The preview pipeline's captures render the live 1,402px window cropped at 1,280px and drop board-anchored overlays near the window's right edge (the zoom cluster crops the same way). The tray column's true dock is `right: 12px` — asserted live via computed style (`position: absolute; right: 12px; width: 96px; pointer-events: none`) and `getBoundingClientRect` (right edge = board right − 12) before and after the captures. For the two face captures the column was translated to a mid-board position with a temporary inline style (capture-only; removed afterwards, state hard-reset). The module-face/pre-entry capture shows the column at its true position inside the crop.

## Automated checks

- `npm run check`: passed.
- `npm test`: 48 files, 1,041 tests passed — including the reworked dock/column tests, the one-switch tests (`app.test.ts`, `mutators.test.ts`), and the stylesheet gesture-surface check (`theme.test.ts`).

## Unavailable checks

- **Phone composition (<600px container)**: viewport resizing times out in the preview browser (recorded as a browser limit by previous evidence rounds too). The phone behavior — column unfolds via `display: contents`, head and modules face hide, the Mutators face re-pins as the strip above the thumb bar — is covered by the DOM/state tests and reuses the strip layout proven in the #199 work; the visual pass at 390px is recorded unavailable.
- **Reduced-motion emulation**: unavailable in this preview. The unlock pulse is animation-only state; under `prefers-reduced-motion` the stylesheet's global `animation: none` stills it and the armed state remains readable through the dashed outlines and the pill (source-verified, not an emulation pass).
- **True touch disclosure**: unavailable; the head buttons respond to pointer click (exercised by the flip capture), which is not claimed as a touch pass.
