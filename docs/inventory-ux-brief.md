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

## Inventory feedback amendment — 2026-10-18

Status: consolidated scope confirmed 2026-10-18 and implemented in this checkout. This amendment supersedes conflicting presentation clauses above. Verification is recorded in [the amendment evidence](evidence/inventory-2026-10-18/README.md).

- Collapse to a small hypercube inventory symbol with the stored-item count. Treat the symbol as inventory identity; adopting it as the main logo is a separate decision.
- Standardize rarity marks wherever rarity appears: grey circle for common, green triangle for uncommon, blue diamond for rare. Shapes carry the distinction without color; accessible names retain the rarity word. Keep category glyphs and category hues distinct from these marks. Apply the same rarity vocabulary to mutators without changing their per-copy rarity rules.
- Display module level with Arabic digits and merge tier with Roman numerals across inventory, details, draft choices, and merge reviews. Preserve the existing one-based display: the first merge tier is I. Mutators have neither module level nor merge tier; non-levelable modules do not acquire a level readout.
- Inventory detail uses a compact identity face carrying the category glyph, rarity finish, and merge rings. Show level and tier once alongside the name below, rather than repeating them inside the face. Board faces and Hex detail retain their full information-bearing faces.
- Use the main inventory browser inside Hex detail, preserving filter, sort, and scroll through entry and return. Replace the separate Add/Swap tray experience with shared inventory interaction.
- Drag an inventory copy onto the corresponding enlarged Hex detail face to place or swap it; drag a deployed face into inventory to retrieve it. Preserve existing eligible-pair merge review behavior. Keep click, touch, and keyboard placement available so dragging is optional.
- This is an Operate surface within the existing Rack identity. Colored rarity markers deliberately amend the prior rarity-word-only presentation; category color continues to identify category, not rarity. Engraved rings continue to identify merge tier.
- Expanded rows use one compact identity/state line: rarity mark, name, Roman merge tier, and consistently aligned Arabic level, with the category hex beside it. Keep Merge at the right and preserve accessible touch target sizes.
- In Hex detail, Place from inventory inspection directly targets the currently opened cell under existing placement/swap rules and merge reviews. Keep Retrieve as the accessible button alternative to dragging the deployed face into inventory; remove the separate Add/Swap tray controls.
- Merge uses a custom two-branches-converging-into-one glyph in a quiet square icon button. Keep the accessible name Merge and a plain Merge tooltip; mute the action when no eligible partner exists. Activating it opens the existing pair review. This action-label tooltip is a deliberate exception to the mechanic-only tooltip rule so the unfamiliar icon has an accessible, discoverable meaning.

All seven decisions and the consolidated implementation scope were explicitly confirmed.

Verification covers desktop and phone, shared browsing state, placement/swap/merge/retrieval, and accessible non-drag interaction; see the amendment evidence for results and limitations.

The always-open/no-collapse clauses in [ADR-0027](adr/0027-dock-the-tray-beside-the-action-row.md) and CONTEXT.md are amended. Inventory detail is an inspection context distinct from a board coordinate's Hex detail. See [the evidence review](evidence/inventory-2026-10-17/README.md) for checks and limitations.

### Follow-up refinement — 2026-10-18

User-directed correction after reviewing the implementation: full module faces put `Lv. 0` on the upper line and rarity mark + name + Roman merge tier together on the next baseline. Restore `Lv.` on all compact level readouts, including inventory and merge reviews. Align inventory name/tier text on a shared baseline; inset the native-select replacement chevrons 12px from the right border with reserved text padding. Add a small filled hexagon at the hypercube symbol's center for this visual trial. Inventory inspection keeps its identity face and its single level readout below.

Refinement evidence: [desktop](evidence/inventory-2026-10-18/refinement/desktop.jpg), [phone](evidence/inventory-2026-10-18/refinement/phone.jpg), [collapsed symbol](evidence/inventory-2026-10-18/refinement/collapsed.jpg).

### Hex detail cleanup — 2026-10-18

The user's subsequent review supersedes the earlier decision to retain Retrieve: remove the redundant Store/Retrieve button from both detail faces. Keep existing drag retrieval into inventory. Opening or collapsing inventory must not resize or shift the main Hex detail composition; the browser overlays the unchanged stage.
