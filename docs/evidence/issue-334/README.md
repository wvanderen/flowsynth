# Issue #334: concise, deliberately accessible production details — verification

Implemented on branch `t3code/issue-334-implementation` in this worktree, from the acceptance criteria of #334. ADR-0037 is amended in place (supporting-module roster retired; global factors once; the inline calculation as the ADR-0056 interview's confirmed exception to tooltip-only disclosure); the allocation and purchase economy is untouched.

## Automated checks

- `npm run check` (tsc): passed.
- Full suite: 61 files, 1,297 tests passed, 2 skipped.
- UI regression suite (`npx vitest run --project ui`): 681 passed — including the reworked `ledger.test.ts` (totals + once-only global factors + inline calculation + accordion + pick guard + zero-output row + the 44px touch-floor pin), the re-anchored #154/#258/#260/#295 suites, and the new plain-readout pins.
- New pins of note:
  - the roster lists the total, the `Feats · Discoveries` line exactly once (`already included`), and one final-ν/s row per oscillator; `.rd-other-row` never exists again and no row carries an Achievements/Discoveries leg;
  - an uncharged Blaster (a zero-output oscillator) renders the same `+0 ν/s` row grammar as any other;
  - the calculation is an explicit `<button class="rd-calc-toggle">` (`aria-expanded`/`aria-controls`), never a `<details>`; opening another oscillator closes the standing one; a click inside the calculation or on its control never picks a module or closes the sheet;
  - live slots fill both channels independently, the open calculation survives `app.tick()` fills in place, and the global line re-words with the boosts;
  - the transient readout (hover ask and placement preview) renders zero interactive elements — no buttons, no `inst-tip`, no dotted underlines — while the Hex detail's chord row keeps its disclosure layer.

## Browser provenance

- Collaborative preview tab: served `http://localhost:5173/?dev`; `/-/dev/provenance` returned worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-8e65848d` (equals `git rev-parse --show-toplevel`), branch `t3code/issue-334-implementation`, commit `76aee4b` (equals `git rev-parse HEAD`; Vite serves the working tree's uncommitted edits).
- Headless phone context (Playwright, Chrome for Testing): the same provenance payload was fetched from inside the capture page (`phone-shot.mjs`) before any screenshot.

## Captures

Desktop 1,402 × 877 CSS px (collaborative preview tab); phone 390 × 844 CSS px, deviceScaleFactor 2, `hasTouch` (headless context against the same server). Boards seeded with the C4 opening module plus two dev-granted synths at G4 and C5 (the C4·G4 Fifth active, the C4·C5 Octave an idle candidate at capacity one). Every capture was gated by a DOM wait or assertion recording the surface's state first.

- [desktop-rate-sheet-totals.png](desktop-rate-sheet-totals.png): the tap-opened rate sheet — `RATE 0.41 ν/s`, the one `Feats · Discoveries +4% · +2% — already included` line, three oscillator rows with final ν/s, no supporting-module roster.
- [desktop-rate-sheet-calc-open.png](desktop-rate-sheet-calc-open.png): the C4 row's calculation opened by its control — Base 0.1 ν/s, Formation ×1.12 (Fifth ×1.3), Chords ×1.3, Capacity 1/1 with the idle note, Booster +0%, Charge ×1, Feats · Discoveries ×1.06 already included, `= +0.15 ν/s` — the legs multiply back to the row's own figure.
- [desktop-accordion-one-open.png](desktop-accordion-one-open.png): after opening G4's calculation, C4's closed (`firstClosed: true`, `expandedStates: ["false","true","false"]`) — one oscillator's arithmetic at a time.
- [desktop-keyboard-open-calc.png](desktop-keyboard-open-calc.png): the C5 toggle focused and activated with Enter alone — calculation open, no pointer involved; a second Enter closed it and Escape dismissed the sheet (recorded in the DOM guards below).
- [desktop-ledger-popover-focus.png](desktop-ledger-popover-focus.png): the ledger's quick-read popover opened by keyboard focus on the rate figure (`:focus-within`, 3 roster rows) — the retained hover path is reachable without a pointer and is not the sole route (the sheet is the door at every width).
- [desktop-transient-readout-plain.png](desktop-transient-readout-plain.png): C4's ask — `+0.15 ν/s`, `(1/1) ⬡`, `Fifth ×1.3`, `Formation ×1.12`, `1 idle` — plain chips; guard recorded `interactive: 0` and `text-decoration-line: none` on every name.
- [desktop-hex-detail-chord-facts.png](desktop-hex-detail-chord-facts.png): the click-open Hex detail keeps the deeper chord facts — the chord row's capacity, total factor ×1.46, formation and its measured scale, named instances — with its disclosure layer intact (4 triggers).
- [phone-rate-sheet-totals.png](phone-rate-sheet-totals.png): 390 px — the game-info strip's rate read tapped (`hasTouch`), the bottom sheet presenting the same roster.
- [phone-rate-sheet-calc-open.png](phone-rate-sheet-calc-open.png): 390 px — G4's calculation opened by tap, accordion held (`hidden: [true, false, true]`), the chevron's open state readable.
- [phone-transient-readout-plain.png](phone-transient-readout-plain.png): 390 px — the same plain ask over the board; zero interactive elements. (The prior touch pass, tapping the module itself, opened the Hex detail — the phone's click-open door — with the chord row's deeper facts.)

Live DOM guards recorded at capture time (desktop session): sheet open with `otherRows: 0` and all calcs hidden; C4's calc legs exactly `["Base 0.1 ν/s", "Formation ×1.12 Fifth ×1.3", "Chords ×1.3", "Capacity 1/1 idle — earns nothing: Octave ×1.15", "Booster +0%", "Charge ×1", "Feats · Discoveries ×1.06 already included", "= +0.15 ν/s"]`; accordion `firstClosed` with `expandedStates ["false","true","false"]`; keyboard open at index 2, Enter-toggle closed it, Escape closed the sheet; popover `popoverVisible: true` on focus; readout `interactive: 0`, underlines `none`; five `app.tick()` renders left the open calculation open with its product line filled in place. Phone session: tap on `#info-rate` → `modal-backdrop sheet`, 3 rows, global line present; tap on the second toggle → `hidden [true,false,true]`, `expanded ["false","true","false"]`.

## Instrument-standards notes

- Open divisions only: the calculation is a rule-separated leg list inside the roster's flat rows — no nested cards, no `<details>` defaults; the toggle is a square-cut hairline control whose state rides the chevron's direction, border, and ink (never color alone), plus `aria-expanded`. Its compact glyph rides an invisible 44px hit field (`::after` inset −13px), pinned by the suite, so PRODUCT.md's touch floor holds without swelling the roster's rhythm.
- Honest arithmetic: the global leg closes each calculation's chain, so every opened decomposition multiplies exactly to its row's figure, and the rows sum to the board's rate (pinned by the suite and `sumSynthValues`; the displayed-figure sum is additionally pinned by the #154-era ledger test that parses the rendered row strings).
- Misleading hover cues removed: the readout's disclosure buttons, dotted underlines, and coarse-pointer min-height rules are deleted from markup and stylesheet; nothing that cannot open promises it can.
- Reduced motion: the toggle's only motion is a 0.15 s transform/color transition on state change; the stylesheet's global `prefers-reduced-motion: reduce` rule (`* { animation: none !important; transition: none !important; }`) removes it, and the state still reads from the rotated chevron's end-state, border, ink, and `aria-expanded` — state survives without motion. The readout surfaces have no motion at all.

## Unavailable checks

- Collaborative-tab viewport resize to phone dimensions timed out repeatedly (the same limitation #333's evidence recorded); the phone captures above come from a real 390 × 844 CSS px headless context (`hasTouch`, deviceScaleFactor 2) against the verified server instead.
- Physical touch-gesture verification on a real device: unavailable; phone interactions were real touch-context taps (`page.tap` with `hasTouch`), and keyboard/touch disclosure of the calculation is additionally pinned by the unit suite.
- Live `prefers-reduced-motion` media emulation during capture: unavailable; the source-level note above (one short state transition, killed by the global reduce rule, state intact without it) is not a claimed emulation pass.

## Review corrections (same branch)

The two-axis review flagged two findings, both fixed on this branch: the calculation toggle's 18px glyph now rides the invisible 44px hit field (PRODUCT.md's touch floor), and the global factors' wording moved into one `globalFactorsText` helper shared by the roster builder and the tick's fill (the house one-wording rule). Known edge, noted not fixed: a roster rebuild (a module move or upgrade landing) rebuilds the popover and rebuilds the sheet only when reopened, so a calculation standing through such a change closes with the rebuild — ordinary ticks never do (the live slots fill in place), which is the criterion's bar.
