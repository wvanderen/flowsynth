# Nest the expanded face onto its module

The board-redesign spec §5 stated the bloom's geometry as "sits exactly centered above the selected module, bottom tip at the cell's top edge." Building it (issue #136, PR #141, 2026-09-26) showed the stated geometry was flawed on a zoomable board, and the implementation departs from it. This ADR records the departure as decided; the spec's §5 clause is rewritten in the same change.

## Decision

- **The bloom nests onto its module**: its center sits one module-radius above the module's center, which brings the bloom's two bottom corners to rest exactly on the module's upper edges — both corners touching, at whatever the module's on-screen size. Presenting below (when the frame's top leaves no room) mirrors the nest onto the module's lower edges. The geometry is pure and tested in `src/ui/bloom.ts`.
- **The pop-or-ride threshold**: the fixed-size bloom only pops when it would actually enlarge the module — `BLOOM_WIDTH` must out-size the on-screen hex. Zoomed in past that (few cells filling the wrap, each module already dwarfing the fixed plate), the upgrade affordances ride the closed face as a floating card and nothing pops out. Only the card's button is interactive, so drags on the face beneath never skip.

## Rationale

The tip-kiss anchor had three flaws the nested geometry removes:

- A bloom balanced on its tip floats detached above its module — at typical zoom the gap reads as belonging to nothing, breaking the toward-camera metaphor the plate exists to serve.
- The below-mirror of a tip anchor overlaps the module it presents, doubling the face the lift-off just vacated.
- A tip anchor spends the module's height twice — plate plus gap — pushing the bloom against the frame's top edge sooner and forcing the below-presentation earlier than the frame's real room demands.

The ride threshold follows from the same discovery: the bloom is fixed-size while the board zooms, so "expanded" is meaningless once the on-screen module out-sizes the plate. The ride keeps the affordances reachable at every zoom without a plate that shrinks the module it stands for.

## Consequences

- Amends board-redesign spec §5's bloom clause; §5's sizing note ("fixed-size regular hexagon: tuning") stands.
- The bloom's size constants (256×296, vs the prototype's 224×258) remain tuning, not spec.
- The origin cell renders vacated while the popped bloom stands (the lift-off); the ride mode renders no vacated cell, since the face never lifts.
