# Open the Arete Catalog with the Mutator tree and the Octave tree

ADR-0039 fixed the first prestige loop — flat 1 Arete per reset, board and life record persisting, levels resetting — and left what Arete buys undecided. Grilling the spending contract (issue #171, 2026-09-29) grew the cell-bonus candidate into a second board layer and landed the shape below.

## Decision

- **The Arete Catalog is the shop.** Trees of permanent offerings, sold from a chip on the board ledger that appears with the first banked Arete and opens the prestige sheet — purchases stay grouped with production on the board side; the console never touches Arete. ADR-0039's completed-bar prestige door stands unchanged. Each tree enters at 1 Arete and escalates within; every purchase survives prestige.
- **The Mutator tree is the first offering.** Its entry purchase (1 Arete) activates the Mutator Grid, grants the Mutator Forge module itself, and unlocks the first Mutator slot. The type is Catalog-exclusive; a later, pricier purchase joins it to the roll pool. Slots are bought inside this tree — trees map to systems, so the slot ladder is the tree's escalating body, and in-tree escalation keeps capacity paced. No third tree.
- **The Mutator Grid is the board lattice's second layer.** It mirrors the lattice position for position: each cell owns one slot (the cell's second face), unlocked one at a time in upgrade mode; a mutator sits in a slot and modifies whatever module occupies that cell — vacant cell, inert slot. Modules move freely; slots stay put, making slot placement a formation decision.
- **Mutators are typed and carry rarity.** Launch families: power (module power), resonance (the host's chord factor), charge (received strength/efficiency). Exact terms land with the mutator-contracts ticket.
- **The Forge becomes a family.** The existing Forge is the Module Forge, minting module rolls (renamed from forge rolls); the Mutator Forge is its sibling, minting mutator rolls into the Mutator tray. Each is its own chargeable branch with its own shared progress meter, on ADR-0009's per-branch pattern. Vocabulary renames only — save fields and historical ADRs stand.
- **The Octave tree caps board height.** The launch board's nous row gates stand as tuned; the tree sells one octave row above and one below the launch band, in either order (1 Arete, then 2), its purchase standing in the row gate for the row it opens. The board caps at six octave rows this phase — height is powerful, and this phase keeps it bounded.
- **Prestige persists the mutator layer.** ADR-0039's reset boundary extends: Catalog unlocks, unlocked slots, placed mutators, and the Mutator tray survive prestige; levels, nous, and charge still reset.

## Consequences

- ADR-0015's "what Arete spends on is undecided" clause closes, and ADR-0039's "yield growth lives in what Arete buys" gains its buyer.
- CONTEXT.md gains the mutator family and the Catalog terms; the Forge splits into Module and Mutator branches with forge roll → module roll.
- Two follow-up tickets feed the ordered handoff: "Mutator layer contracts: launch types, minting, and slot unlocks" and "Mutator layer interaction: grid rendering, slots, and tray".
- Parked with seeds for a future effort: later Catalog trees (rarity access, era head start, automatic leveling) and the reset layer above prestige — working name Apotheum: slots and mutators retained on such a reset, the Mutator Grid deactivated until Arete re-activates it for the super-era. The entry purchase's activation semantics exist for exactly that hook.
- All numbers — entry prices, the slot ladder, mutator magnitudes, row prices, the six-row cap — are provisional tuning.
