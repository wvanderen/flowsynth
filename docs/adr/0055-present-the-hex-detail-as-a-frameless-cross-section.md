# The Hex detail presents as a frameless cross-section, its faces as the voice

Issue #295's first implementation (PR #301) realized the Hex detail as a
clipped instrument panel holding two rounded cards — one per layer — each a
small module tile beside a text column. Review against the instrument
standards (2026-10-08) found it reading as a menu: nested cards the standards
ban, a text column repeating everything the module face already engraves
(the exact "module panel" pattern ADR-0026 retired), the pitch named three
times, the mutator effect stated twice, and the stack metaphor — the reason
the detail exists — present only as two list sections. This ADR records the
presentation decision that replaces it, and stands as the ADR-0055 the issue
cites as the Hex-detail interview's contract.

## Decision

- **The cross-section is frameless and center-stage.** No panel box: the
  cell's column lifts toward the camera the way the bloom did (ADR-0024's
  lineage), composed of the two layer faces stacked Mutators-above-Modules
  at the same chassis size, the action rail beside the stack, the chord row
  beneath the module face, and a compact Return control. The hex chassis is
  the container — there is structurally nothing to put a card in.
- **The faces are the voice.** The module face renders at full scale with
  its complete engraving (level, nameplate, signature, rarity rings, live
  readout with its unit, pitch, charge light, Forge fill) — the bloom's
  "the face itself is the plate" at rest. The Mutators face speaks in the
  slot face's own vocabulary (family word, glyph, rarity ticks, effect) with
  its state in the four-state grammar: muted outline = locked or ineligible,
  clear outline = eligible, dashed = open slot, occupied = the declaration.
  No text column re-speaks a face; the composition adds only what faces
  cannot say.
- **The hosting relation is the stack itself.** A mutator modifies whatever
  module occupies the position directly below, so no surface says "hosts" —
  adjacency in the cross-section is the relation.
- **The upgrade band moves out of the face** into the rail (dial + cost and
  benefit), so the face wears the compact rhythm; the chord row carries the
  reserved readout's chord facts minus the ν/s figure (the face has it),
  and every deeper mechanic — full name and rarity words, inert verdicts,
  unlock rules — rides the tooltip layer.

## Considered options

- **Centered instrument panel, opened internals** (the catalog's lineage):
  standards-compliant and contained, but it keeps a box around content that
  is the board's own voice, and boxes invite cards. The detail is not a
  surrounding surface; it stands where the grid stood.
- **Keep the panel-and-cards shape, trim the copies**: rejected — the card
  forwardness was the failure, not only the duplication.

## Consequences

- Amends the #295 first-implementation surface; the interaction contract
  stands unchanged (fixed stack, both faces visible, return-first with
  layer/position/zoom intact, read-only during flow, the legend as the one
  switch, emphasis without reordering).
- The bloom's variant layout (`variant: "bloom"` in face.ts) loses its last
  consumer; the compact rhythm serves the enlarged face because the button
  band now lives in the rail.
- The chord row forks the reserved readout's builders behind an id scope so
  the two surfaces can never mint colliding tooltip ids (the ledger's
  portal rule).
