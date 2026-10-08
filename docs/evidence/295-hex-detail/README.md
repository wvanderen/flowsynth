# Hex detail and the vertical layer legend — review evidence

Source: issue #295 (this branch's working tree, commit at capture time
`093e9cb65e8634e31fa5514a10b89dc5705f65b8` plus the uncommitted
presentation rework — the frameless cross-section). Launched this
checkout with `npm run dev`; the provenance endpoint's `worktree` and
`commit` matched `git rev-parse` in this checkout before every capture.
Captures span two save states of the same verified server: the opening
board (a fresh save, after the app's own Reset progress) and a developed
save for the post-entry Mutator states.

## Desktop (1402×877 viewport, screenshot scaled to 1280)

- [Grid with the legend](desktop-grid-legend.png): the vertical layer
  legend stands on the board's left edge beneath the action dock — the
  modules symbol wearing the selected marker, the Mutators symbol beside
  it. Board gestures and the tray are untouched by the detail rework.
- [Module detail](desktop-detail-module.png): the cross-section as the
  instrument, not a panel — the module face below at full engraving
  (level · nameplate · signature · live ν/s with its unit · the cell's
  pitch), the occupied Mutators face above it in the arete register
  (family word, glyph, rarity ticks, the compact effect line), the
  action rail beside the stack (Retrieve aligned to the mutator's row,
  dial + upgrade aligned to the module's row, one hairline division),
  and the chord row beneath the face in the reserved readout's grammar
  (chord factor, formation and its scale, the named instances — the ν/s
  figure stays on the face). Return is a compact control at the stage's
  top-left; no header band, no text columns, no nested cards.
- [Slotless cell](desktop-detail-unlock.png): the Mutators face wears
  the clear outline (available) and the rail prices the unlock —
  `UNLOCK SLOT · 8 ◇`; an ineligible cell instead wears the muted
  outline and the rail names the adjacency rule ("beside the patch").
- [Locked layer](desktop-detail-locked-entry.png): pre-entry, the
  Mutators face wears the muted outline and the lock mark with LOCKED
  beneath, and the rail offers `CATALOG ENTRY` — the walk every locked
  Mutators control takes. The module face and the upgrade dial stand
  unchanged beside it.
- [Empty place](desktop-detail-empty-locked.png): an owned empty cell
  reads as two hollow hexes — the dashed module chassis carrying the
  cell's own pitch (C5), the locked Mutators face above. No rail row
  stands where no action exists. (Detail inventory placement lands with
  #296.)
- [Read-only in flow](desktop-detail-flow.png): the same cross-section
  during a live session — `FLOW LIVE · READ-ONLY` beside Return, live
  readouts on the faces and the chord row, every control gone, the
  legend withdrawn.
- [Keyboard disclosure](desktop-legend-focus-tooltip.png): keyboard
  focus on the locked symbol's ⓘ opens the tooltip ("Unlocks with the
  Mutator entry"); Escape dismissed it in the same session (unit-pinned
  in mutators.test.ts and hexdetail.test.ts). The detail's own faces
  disclose the same way — each chassis is its tooltip's trigger
  (verified live: focus opened "Oscillator · common · sings C4",
  Escape dismissed).
- [The Mutators layer](desktop-mutators-layer.png): the grid's fixed
  stack — slot faces foreground, the module board resting greyed beneath,
  the legend's Mutators symbol active. Clicking a slot opens the detail
  on the Mutators face.

## Phone (390×844)

The preview window's resize times out in this environment; the phone
composition drives the same gate the device would — `#app` constrained
to 390px so the app's own container query (`@container app (width <
600px)`) re-docks the anatomy. (A same-origin iframe was tried first and
abandoned: a second app instance reconciles against the shared save and
closes the sheet — recorded here as the reason, not worked around.)

- [Detail as bottom sheet](phone-detail-sheet.png): the cross-section
  re-docked over the thumb bar — one column, the stack on top, each
  action row under its own face, the rest scrolling within the sheet.
  The layer legend yields to the sheet at phone width (the faces carry
  the selection).

## Symbol discoverability (issue #295, criterion 3)

The legend is symbol-only by design. Mitigations in place: every symbol
carries an accessible name (`aria-label`), a pressed state
(`aria-pressed`), a native tooltip (`title`) at every width, the locked
symbol adds the ⓘ disclosure, and the Hex detail's faces speak the same
vocabulary — a module chassis over an arete-register chassis — so the
first detail open teaches the legend's two symbols. Unresolved
limitation, recorded: on the grid before the first detail open, the
symbols' meanings rest on the tooltips alone; a first-run learner has no
ambient label. The tickets downstream (#296–#298) revisit the
symbol-only navigation; #298 explicitly re-evaluates it. Recorded here
as the limitation rather than claimed solved.

## Honest limits

- **Greyscale pass unavailable.** No greyscale emulation exists in this
  environment (the preview offers color-scheme only). The non-color
  state distinctions are structural and verified in the stylesheet and
  captures: selected = the firm inset marker drawn on the chassis
  (`.hex-detail-layer.selected .hex-stack-marker`, pinned by
  hexdetail.test.ts reading the stylesheet), locked or ineligible =
  muted outline (+ the lock mark when the layer is locked), available =
  clear outline, open slot = dashed chassis. The UI suite pins these
  rules.
- **Reduced-motion pass unavailable.** Not emulatable here. The global
  reduced-motion rule (`* { animation: none !important; transition: none
  !important }` in style.css) covers the detail's one-time open lift and
  every transition; state information never rides motion. The detail
  section carries its own scoped rule as well.
- **Touch pass indirect.** No touch device. The tooltip layer's
  tap-to-pin and tap-away dismissal ride the shared instrument layer and
  are unit-pinned; the captures show the hover and focus paths live.
- **Occupied-mutator capture predates two cosmetic tunes** (section
  padding, marker stroke width) — the composition is identical; the
  post-entry states on a fresh save are unreachable without the Arete
  entry, and the developed save was reset after capture.

## Checks

Validation at capture time: `npm run check` clean; full suite 1130
tests across 57 files green; `npx vitest run --project ui` green (528
tests). The evidence postdates the final layout fixes (frameless stage,
readonly single column, phone legend yield).
