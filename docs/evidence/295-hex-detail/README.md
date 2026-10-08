# Hex detail and the vertical layer legend — review evidence

Source: issue #295 (this branch's working tree, commit at capture time
`dd351b58bcbb7a002f0e376ca6cce48491feb136` plus the uncommitted Hex-detail
diff). Launched this checkout with `npm run dev` at
`http://localhost:5174/?dev=1`; the provenance endpoint's `worktree` and
`commit` matched `git rev-parse` in this checkout before every capture.
The development `mutator era` grant seeded the Mutator layer's states.

## Desktop (1402×877 viewport, screenshot scaled to 1280)

- [Grid with the legend](desktop-grid-legend.png): the vertical layer
  legend stands on the board's left edge beneath the action dock — the
  modules symbol wearing the selected marker, the Mutators symbol beside
  it. Board gestures and the tray are untouched.
- [Module detail](desktop-detail-module.png): C4's cross-section. The
  fixed stack reads Mutators above Modules, both visible; the Modules
  face wears the firm inset marker (non-color) while the Mutators face
  rests dimmed. The module face reads identity · level · rarity · note ·
  ν/s, the mutator line, and the full upgrade column (dial, cost,
  benefit). Return control in the head.
- [Slotless cell](desktop-detail-unlock.png): the Mutators face prices
  the unlock — `UNLOCK SLOT · 8 ◇` — with the adjacency rule reserved for
  ineligible cells.
- [Locked layer](desktop-detail-locked-entry.png): pre-entry, the locked
  Mutators place shows its state and the `CATALOG ENTRY` action (the walk
  every locked Mutators control takes); the legend's Mutators symbol
  stands locked-but-visible with the ⓘ beneath it.
- [Empty place](desktop-detail-empty-locked.png): an owned empty cell
  reads `Empty place · D4` with the dashed tile; the locked Mutators
  place beside it. (Detail inventory placement lands with #296.)
- [Keyboard disclosure](desktop-legend-focus-tooltip.png): keyboard focus
  on the locked symbol's ⓘ opens the tooltip ("Unlocks with the Mutator
  entry"); Escape dismissed it in the same session (unit-pinned in
  mutators.test.ts and hexdetail.test.ts).
- [The Mutators layer](desktop-mutators-layer.png): the grid's fixed
  stack — slot faces foreground, the module board resting greyed beneath,
  the legend's Mutators symbol active. Clicking a slot opens the detail
  on the Mutators face.

## Phone (390×844)

The T3 preview window would not resize (resize timed out twice and the
client disconnected once); the phone compositions come from a same-origin
iframe at 390×844 served by the same verified dev server — the app's own
container query (`@container app (width < 600px)`) drives the same
re-docking the device would.

- [Detail as bottom sheet](phone-detail-sheet.png): the same panel
  re-docked over the thumb bar — the buy column wraps to full width
  beneath the identity column; the face scrolls within the sheet.
- [Return restores the grid](phone-grid-return.png): after the return
  control, the grid stands again with the legend strip above the thumb
  bar; position and zoom were preserved by standing still.

## Symbol discoverability (issue #295, criterion 3)

The legend is symbol-only by design. Mitigations in place: every symbol
carries an accessible name (`aria-label`), a pressed state
(`aria-pressed`), a native tooltip (`title`) at every width, the locked
symbol adds the ⓘ disclosure, and the Hex detail's section heads repeat
the same symbols beside their words — the detail teaches the symbols the
legend uses. Unresolved limitation, recorded: on the grid before the
first detail open, the symbols' meanings rest on the tooltips alone; a
first-run learner has no ambient label. The tickets downstream (#296–
#298) revisit the symbol-only navigation; #298 explicitly re-evaluates
it. Recorded here as the limitation rather than claimed solved.

## Honest limits

- **Greyscale pass unavailable.** No greyscale emulation exists in this
  environment (no headless Chromium; the preview offers color-scheme
  only). The non-color state distinctions are structural and verified in
  the stylesheet and captures: selected = firm inset marker
  (`.legend-symbol.active` / `.hex-detail-layer-head.selected`
  box-shadow), locked = muted outline + lock mark, unavailable actions
  absent rather than dimmed. The UI suite pins these rules
  (hexdetail.test.ts reads the stylesheet).
- **Reduced-motion pass unavailable.** Not emulatable here. The global
  reduced-motion rule (`* { animation: none !important; transition: none
  !important }` in style.css) covers the detail's entry animation and
  every transition; state information never rides motion.
- **Touch pass indirect.** No touch device. The ⓘ tooltip's tap-to-pin
  and tap-away dismissal ride the shared tooltip layer and are
  unit-pinned (focus and tap in mutators.test.ts); the capture above
  shows the focus path live.

## Checks

Validation at capture time: `npm run check` clean; full suite
1128 tests across 57 files green; `npx vitest run --project ui` green
(526 tests). The evidence postdates the final CSS layout fixes (panel
width, legend position, phone wrap).
