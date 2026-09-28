# Combine rides the drop onto a matching twin

The Combine button lived on the expanded face in every presentation (ADR-0026): popped plate, zoomed-in ride card, phone bottom sheet. That placement made combining a select-then-click flow that never showed the outcome — the merge simply happened, refund and all, on one press. Issue #152 asked for direct manipulation with a reviewable outcome; this ADR records the shape that landed (2026-09-26).

## Decision

- **A matching module-on-module drop offers the combine.** Dropping a module onto another of the same type and rarity — board to board, tray to board, board to tray, tray to tray — opens a confirmation dialog instead of the usual landing. The hover wears its own register (the nous tint) while a live drag points at a twin, so the offer is previewed before the release. Rare modules never combine, so a pair of rares still swaps.
- **Every other occupied drop still swaps, immediately.** The swap is the default landing (spec §5); the confirmation is scoped to matching pairs alone. Armed click-then-cell placements keep swapping too — the offer rides the drag gesture, not the placement.
- **The review shows the terms before either copy is consumed**: resulting rarity, the retained higher level, and the refund — the lower-level copy's invested nous. Cancel (button, ✕, backdrop, Esc) leaves both modules exactly as they were.
- **The result lands where the drop target was.** Board target: the combined copy holds the target's cell. Tray target: it waits in the tray. The engine's position rule follows the partner, and the refund and future secondary-effect inheritance rules (ADR-0006) are unchanged.
- **The Combine button is retired from the expanded face** in all three presentations. Combining has one home: the drop. ADR-0026's "Combine button beside Upgrade" clause is superseded.

## Consequences

- The engine's `combine` moves the survivor to the partner's position instead of the survivor keeping its own cell — the drop target is the partner, so the old "tray-kept survivor inherits the melt's cell" special case disappears.
- A `combinePreview` read (pure, no mutation) is the single source for both the hover register's eligibility and the dialog's terms, so the review can never promise what the combine wouldn't deliver.
- The twin-consumption feats (`two-of-a-kind`, `fine-china`) fire on confirm as before, because the flow routes through the same engine action.
- The retirement ledger's "combine stays a panel button" and "swap confirmation" rows are amended in place: swaps stay confirm-free for non-matching pairs; matching pairs confirm by design.
