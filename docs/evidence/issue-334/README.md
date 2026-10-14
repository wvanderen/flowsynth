# Issue #334: concise, deliberately accessible production details — verification

Implemented on branch `t3code/issue-334-implementation` in this worktree, from the acceptance criteria of #334 **as amended by the [2026-10-14 issue comment](https://github.com/wvanderen/flowsynth/issues/334#issuecomment-6170846456)**: the inline per-row calculation and its expansion arrow are dropped for now — the roster is the total, the global factors once as already included, and one final-ν/s row per oscillator, with no supporting-module roster and no expansion controls. ADR-0037 is amended in place; the allocation and purchase economy is untouched.

## Automated checks

- `npm run check` (tsc): passed.
- Full suite: 61 files, 1,292 tests passed, 2 skipped.
- UI regression suite (`npx vitest run --project ui`): 676 passed — including the reworked `ledger.test.ts` (totals + once-only global factors + oscillator-only rows + zero-output row + the no-expansion pin), the re-anchored #154/#258/#260/#295 suites, and the plain-readout pins.
- New pins of note:
  - the roster lists the total, the `Feats · Discoveries` line exactly once (`already included`), and one final-ν/s row per oscillator; `.rd-other-row` never exists and no row carries an Achievements/Discoveries leg;
  - **no expansion**: no `.rd-calc`, no `.rd-calc-toggle`, no `aria-controls` anywhere in the roster, and the only buttons are the row picks (the amendment's arrow ban, pinned);
  - an uncharged Blaster (a zero-output oscillator) renders the same `+0 ν/s` row grammar as any other;
  - a row's tap picks its module; the used/available capacity read stays local to the reserved readout and Hex detail (the sheet carries no Capacity leg);
  - live slots fill both channels independently — a tick never rebuilds the roster;
  - the transient readout (hover ask and placement preview) renders zero interactive elements — no buttons, no `inst-tip`, no dotted underlines — while the Hex detail's chord row keeps its disclosure layer.

## Browser provenance

- Collaborative preview tab: served `http://localhost:5173/?dev`; `/-/dev/provenance` returned worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-8e65848d` (equals `git rev-parse --show-toplevel`), branch `t3code/issue-334-implementation` (Vite serves the working tree's uncommitted amendment edits; the captures were taken against the amended source).
- Headless phone context (Playwright, Chrome for Testing): provenance fetched from inside the capture page returned commit `2164956` with the amendment in the working tree.

## Captures

Desktop 1,402 × 877 CSS px (collaborative preview tab); phone 390 × 844 CSS px, deviceScaleFactor 2, `hasTouch` (headless context against the same server). Boards seeded with the C4 opening module plus two dev-granted synths at G4 and C5 (the C4·G4 Fifth active, the C4·C5 Octave an idle candidate at capacity one). Every capture was gated by a DOM wait or assertion recording the surface's state first.

- [desktop-rate-sheet-totals.png](desktop-rate-sheet-totals.png): the tap-opened rate sheet — `RATE 0.43 ν/s`, the one `Feats · Discoveries +8% · +2% — already included` line, three oscillator rows with final ν/s, no supporting-module roster, no expansion arrows.
- [desktop-ledger-popover-focus.png](desktop-ledger-popover-focus.png): the ledger's quick-read popover opened by keyboard focus on the rate figure (`:focus-within`, 3 roster rows, zero expansion controls) — the retained hover path is reachable without a pointer and is not the sole route (the tap-open sheet is the door at every width). Escape had just dismissed the sheet (recorded: `escapeClosed: true`).
- [desktop-transient-readout-plain.png](desktop-transient-readout-plain.png): C4's ask — `+0.15 ν/s`, `(1/1) ⬡`, `Fifth ×1.3`, `Formation ×1.12`, `1 idle` — plain chips; guard recorded `interactive: 0` and `text-decoration-line: none` on every name.
- [desktop-hex-detail-chord-facts.png](desktop-hex-detail-chord-facts.png): the click-open Hex detail keeps the deeper chord facts — the chord row's capacity, total factor ×1.46, formation and its measured scale, named instances — with its disclosure layer intact (4 triggers).
- [phone-rate-sheet-totals.png](phone-rate-sheet-totals.png): 390 px — the game-info strip's rate read tapped (`hasTouch`), the bottom sheet presenting the same roster: 3 rows, `expansion: 0`, global line present.
- [phone-transient-readout-plain.png](phone-transient-readout-plain.png): 390 px — the same plain ask over the board, zero interactive elements; the preceding tap on the module itself opened the Hex detail (the phone's click-open door) with the chord row's deeper facts.

Live DOM guards recorded at capture time (desktop session): sheet open with `total`, one `global` line, `pickButtons: 3`, `toggles: 0`, rows `["+0.16 ν/s", "+0.16 ν/s", "+0.11 ν/s"]`; Escape closed the sheet; focus on the rate figure opened the popover (`popoverVisible: true`, `popoverToggles: 0`). Phone session: tap on `#info-rate` → `modal-backdrop sheet`, `expansion: 0`; Escape closed the sheet (`escapeClosed: true`); the plain ask listed its five chips with `interactive: 0`.

## Instrument-standards notes

- Open divisions only: flat rule-line rows — no nested cards, no `<details>`, no expansion controls; the row is its name and its final figure, the pick its one control. The pick rides the row's own line (the base button's 44px floor overrode to `min-height: 0` on fine pointers — it was padding every row with dead space below the baseline), while coarse pointers keep the floor, where the height reads as tap spacing; both pinned by the suite.
- Honest arithmetic: the global factors appear once, worded `already included`, and the rows sum to the board's rate (pinned by the suite and `sumSynthValues`; the displayed-figure sum is additionally pinned by the #154-era ledger test that parses the rendered row strings).
- Misleading hover cues removed: the readout's disclosure buttons, dotted underlines, and coarse-pointer min-height rules are deleted from markup and stylesheet; the roster's rows carry no arrow promising an expansion that isn't there.
- Reduced motion: the roster surfaces have no motion at all (the tick fills text in place); the readout lost its only transitions with the disclosure markup.

## Unavailable checks

- Collaborative-tab viewport resize to phone dimensions timed out repeatedly (the same limitation #333's evidence recorded); the phone captures above come from a real 390 × 844 CSS px headless context (`hasTouch`, deviceScaleFactor 2) against the verified server instead.
- Physical touch-gesture verification on a real device: unavailable; phone interactions were real touch-context taps (`page.tap` with `hasTouch`).
- Live `prefers-reduced-motion` media emulation during capture: unavailable; the surfaces carry no motion of their own, so the note is source-level, not a claimed emulation pass.

## Superseded captures

The first implementation's calculation captures (inline calculation open, accordion, keyboard-open) were removed with the feature they evidenced; this README's captures back the amended scope only.

## PR #340 accessibility review corrections (2026-10-14)

- The oscillator picks retain the 44px minimum whenever **any** coarse pointer is available, including secondary touch input alongside a primary mouse/trackpad. Mouse-only layouts retain their compact rows.
- The plain placement-preview quality scale now has `role="img"` and an accessible label carrying measured quality, floor, cap, and neutral. Its SVG remains decorative; it adds no interactive term or disclosure.
- Regression checks cover the any-pointer rule and the placement preview's accessible measurement even when its applied Formation chip is absent. Typecheck, full suite (1,293 passed, 2 skipped), and UI regression suite (677 passed) passed.
- Fresh browser provenance at `http://localhost:5175/-/dev/provenance` matched `/Users/eggfam/.t3/worktrees/flowsynth/t3code-786765a1`, HEAD `f003936`, with these review corrections in the working tree. The collaborative desktop viewport reported 1,402 × 877 CSS pixels; exported PNGs are 1,280 × 800.
- [review-desktop-rate-sheet.png](review-desktop-rate-sheet.png): click-open roster preserves open rule rows and compact mouse-only picks. DOM measurements were 15.09px high with `min-height: 0px`; primary fine pointer true, any coarse pointer false.
- [review-desktop-placement-preview.png](review-desktop-placement-preview.png): preview of the tray oscillator at C5, set through the dev app's transient UI state. DOM inspection confirmed the scale's `img` role and label `Formation quality — ×0.5 chromatic to ×1.5 organized, ×1 neutral; this formation measures ×1.24`, with zero interactive elements in the transient readout.
- Compared the fixes with the pinned presentation and controls prototypes: flat divisions and plain readout remain intact; coarse input retains the controls sheet's 44px floor.
- Unavailable in this correction pass: phone capture (both 390 × 844 freeform and iPhone 12 Pro preset resize timed out), hybrid-pointer media emulation, physical touch and screen-reader verification, greyscale and reduced-motion emulation. The corrections add no animation; automated assertions and DOM inspection are not claimed as physical-device verification.
