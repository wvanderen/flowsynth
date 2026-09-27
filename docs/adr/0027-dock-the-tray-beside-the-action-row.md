# Dock the tray beside the action row; the inventory wears a minimal mark

The console-and-responsive build (issue #139) left the board-surface tray (§5) as a horizontal strip pinned to the board's bottom edge, beside which the Arete pill and the zoom cluster also anchored — three surfaces competing for one lane, the tray's populated height overlapping the pill. Review feedback (2026-09-26) settled the composition and the tile's detailing. This ADR records the decisions; the spec's §5 tray clause and §7 dock line are amended in the same change.

## Decision

- **The tray is a collapsible column docked beside the action row.** The icon dock gains a fourth action — **Inventory**, with the tray's count as its badge — that toggles the column: vertical tiles under a `TRAY` label, the same dashed-veil drop target. The board's bottom edge belongs to the Arete pill (bottom-center) and the zoom cluster (bottom-right) alone.
- **The gesture opens what the toggle may keep closed.** A drag or an armed placement opens the column for the gesture's duration whatever the toggle says, so the chord-breaking drop always has a visible target; it re-closes after unless the player pinned it open. The toggle's state is light furniture, never saved.
- **The inventory wears a minimal mark.** Tray tiles drop the full readout face — at tile size the engraving (rings, nameplate, level, readout) was noise — for a hexagon outlined in the module's category hue with the signature glyph alone. The tooltip carries the details the mark leaves off. The mark is shared by the tray, the phone inventory sheet, and the live drag ghost, so what you carry is what waits in the tray; the full face remains the board's and the expanded face's language, and the Forge candidates keep it (acquisition reads at 150px, not 62).
- **Portrait phone stands**: the tray hides there, and the thumb bar's Inventory segment taps the same inventory open as a sheet.
- **A placement presents closed** (spec §5's "a drop leaves it closed", made load-bearing): the armed placement's selection is dropped before the landing renders, never after — the render the action triggers must never catch the stale selection and present the module bloomed.

## Consequences

- The §7 dock reads Catalog / Forge / New cell / Inventory; Feats stays phone-only on the thumb bar, with the board ledger's feats chip serving every other width.
- The inventory's tile identity intentionally departs from the face's "reads identically everywhere" rule (ADR-0016): category hue and glyph travel; engraving does not.
- The Forge candidate tiles and the board faces keep the full chassis; a candidate's detailing is the acquisition moment's business.
