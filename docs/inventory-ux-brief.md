# Inventory UX — design interview draft

Status: confirmed 2026-10-17; implemented in this checkout. Verification is recorded in [the evidence review](evidence/inventory-2026-10-17/README.md).

## Intent and priorities

In upgrade mode, help players find and inspect a useful inventory hex for placement while keeping the board available. Operate mode, within the existing Rack identity.

1. Find and understand a copy before placing it.
2. Keep direct placement quick for players who already know their choice.
3. Make cleanup compact and deliberate.

## Confirmed direction

- Inventory rows carry a compact Merge action alongside the module rather than large stacked buttons. Remove the separate information icon and per-row Scrap controls.
- Clicking an inventory hex opens its detail; Place inside the detail arms placement. Dragging continues to place directly.
- Filter modules by category and mutators by family, with an All option. Use the vocabulary in [CONTEXT.md](../CONTEXT.md): module category differs from module type; mutator family is power, resonance, or charge.
- Offer sorting by category/family and type, rarity, level where applicable, and newest.
- Inventory can collapse to a small handle with its item count, giving space back to the board.
- Row Merge combines the selected copy with one matching inventory copy only. Deployed copies are excluded. Show the resulting tier before acting; do not invoke the collection-wide Merge All sweep from a row.
- Inventory inspection shows the full face, profile, rarity, merge tier, level, and intrinsic effects with Place as the main action; omit board-dependent facts.
- Merge presents eligible inventory partners, then reviews the result and refund before confirmation. Select the sole eligible partner automatically, but still review the outcome.
- The inventory menu's Select for scrap action enters batch selection mode. Row clicks select copies instead of inspecting or placing them. Selection marks, a running payout, Scrap selected, and Cancel expose the mode and its exit. Review the selected copies and losses once before committing; leaving the mode restores normal browsing.
- Select all matching selects the current filter's results; players can deselect individual copies. Selections persist across filter changes, the total selected count stays visible, and final review includes hidden selections.
- The clicked row is the surviving merge copy and retains its secondary effects. Existing combination rules retain the higher input level and refund the other input's invested nous. Review shows both inputs, resulting tier and level, refund, and lost secondary effects. Remove the old collection-wide Merge All control from inventory; row actions never merge deployed copies.
- Default sorting is category/family, then type. Preserve filter, sort, and scroll position through inspection and return, including closing and reopening inventory during the current visit. Newest shows newly acquired copies first. Browsing state need not persist across visits.
- Dragging a board hex over the collapsed inventory handle temporarily opens inventory for retrieval. After the gesture, restore its prior collapsed state. Collapse is remembered for the current visit. On phone, retain the existing Inventory entry and dismissible sheet.

## Interaction consequences

- Normal browsing supports click to inspect and drag to place. Scrap selection is an explicit mode: row interaction selects copies and must not also arm placement or perform merging. Cancel discards the pending selection without scrapping anything.
- Merge reviews describe one pair and one resulting improvement; there is no implicit chain or collection-wide sweep.
- Detail return restores the browsing context rather than starting a new inventory view.
- Module and mutator distinctions remain intact: module merging improves merge tier; mutator combination improves rarity under its existing family/rarity rules. Level sorting applies only where levels exist. Scrap selection covers modules, the existing scrap economy's owned-copy input.
- Empty inventory, no filter matches, no eligible merge partner, merge cap, and no scrap selection must read clearly through the existing state grammar, without explanatory filler. Ineligible row controls must not perform an action.

## Boundaries and one-place rules

- [Instrument standards](instrument-standards.md) govern presentation: open rows, square controls, existing category hues and glyphs, accessible touch and keyboard access. Mutators precede modules wherever both co-list.
- Inspection must be reachable through the hex itself without a separate information icon.
- Do not invent board pitch, active chords, or incoming charge for an unplaced copy.
- Keep the scrap balance in its existing board-ledger location; a row may show its own payout, not a repeated balance.
- No general visual redesign or economy changes are implied.

## Confirmation

The user agreed to each interaction decision and confirmed the complete brief before implementation. The engine preserves these outcomes while retaining the existing board drag-combination rules. ADR-0071 records the deliberate distinction in merge survivor identity.

## Documentation and verification

The always-open/no-collapse clauses in [ADR-0027](adr/0027-dock-the-tray-beside-the-action-row.md) and CONTEXT.md are amended. Inventory detail is an inspection context distinct from a board coordinate's Hex detail. See [the evidence review](evidence/inventory-2026-10-17/README.md) for checks and limitations.
