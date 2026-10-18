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

## Amendment — the always-open dual-face tray (2026-10-06)

The instrument map ([#242](https://github.com/wvanderen/flowsynth/issues/242), ticket [#246](https://github.com/wvanderen/flowsynth/issues/246)) amends the tray's composition: the tray is an **always-open pinned column docked at the board's right edge** in upgrade mode, **dual-face under a Modules/Mutators head** — category-hue module tiles and arete-register mutator tiles keep the minimal mark above. The collapse toggle and the gesture-reopens rule retire with the **Inventory dock icon**, which leaves the wide-surface dock (it reads Catalog / Forge / Add); the mode — the same single Modules/Mutators switch the board tabs carry — gates the tray's face instead. Placement and retrieval rules stand (occupied swaps, drop-onto-twin combining, retrieval never auto-switching the mode); **a mode change cancels armed actions** with a toast. Portrait phone stands: the tray hides there, and the thumb bar's Inventory segment opens the unified tray as a bottom sheet whose toggle flips the same global mode.

## Amendment — browse before placing, collapse and batch cleanup (2026-10-17)

The confirmed [inventory UX brief](../inventory-ux-brief.md) replaces the always-open constraint with a collapsible inventory browser: compact open rows, category/family filters, sorting, and a count-bearing collapsed handle. A board drag over the handle temporarily opens the retrieval target and restores its prior state afterward. The layer legend remains the sole wide-surface switch; portrait phone retains the Inventory entry and scrimless sheet.

Clicking a copy opens inventory detail; its Place action arms placement, while dragging stays direct. Inventory detail shows copy and authored profile facts without inventing a board coordinate's pitch, chord, or incoming charge. Return preserves filter, sort, and scroll for the current visit. Remove separate information icons and the collection-wide Merge All control from inventory: row Merge reviews one inventory-only pair (ADR-0071). Replace per-copy Scrap buttons with Select for scrap in the actions menu, selection across filters, Select all matching, and one final payout/loss review. Cancel removes the pending selection without consuming copies.

## Amendment — compact notation and shared Hex detail inventory (2026-10-18)

The confirmed inventory feedback amendment in the [inventory UX brief](../inventory-ux-brief.md) keeps one browser across the grid and Hex detail, with the same per-layer filters, sorting, scroll, inspection, merges, and scrap selection. The separate detail tray and Add/Swap controls retire. Place from inventory inspection targets the opened coordinate directly; on the grid it still arms placement. Dragging onto the enlarged matching face places/swaps or offers the existing twin merge review; dragging the deployed face back retrieves it. Retrieve remains available for touch and keyboard users. Portrait phone uses the same scrimless inventory sheet.

Collapsed inventory is a small hypercube symbol and stored count; it does not change the main logo. Open rows pair the category hex with a rarity mark, name, Roman merge tier, aligned Arabic level where applicable, and a compact converging-branches Merge icon. Inventory inspection uses an identity face (category glyph, rarity finish, merge rings), with name and numeric state once below. Board and Hex detail retain their full faces. The first touch on Merge names the icon; a second opens review. Keyboard and mouse can activate directly, and unavailable actions remain muted and inert.

The same day's follow-up review removes the redundant Store/Retrieve buttons from Hex detail; retrieval continues through the shared inventory drag gesture. Inventory overlays the unchanged stage: expanding/collapsing it must never shift the detail composition. This supersedes the button-retention clause above.
