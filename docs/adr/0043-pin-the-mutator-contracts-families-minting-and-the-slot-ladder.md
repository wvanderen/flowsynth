# Pin the mutator contracts: families, minting, and the slot ladder

ADR-0040 opened the Mutator tree with the launch families named but their exact terms deferred. Grilling the contracts (issue #183, 2026-09-30) pinned what the launch mutators do, how the Mutator Forge mints, and how the slot ladder sells.

## Decision

- **Power modifies the host's power term.** A power mutator multiplies its host module's power (`× (1 + magnitude)`), so it rides everywhere power already appears: the synthesizer's final ν/s, the uplift an infusor grants, a generator's output strength, and Forge progress (`strength × power`). A Mutator Forge boosting its own branch's progress is intended, not a bug.
- **Resonance modifies the host's chord factor.** A resonance mutator multiplies the product of the chord instances its host sings (`× (1 + magnitude)`), scaling with chord investment; it is inert on a chordless host and on spacers. The Conditional's per-instance bonus (ADR-0022) is untouched. Resonance needs no new chord vocabulary — chord depth stays parked.
- **Charge modifies received strength.** A charge mutator multiplies the strength its host receives (`× (1 + magnitude)`) before the diminishing charge curve, feeding the host's charge leg, Forge progress, and the strength side of infusor bonuses; inert while uncharged. "Efficiency" leaves the family's contract.
- **Rarity is one geometric rule.** Each family has a base magnitude; rarity multiplies it ×1 / ×2 / ×4 across the shared common/uncommon/rare tiers. Numbers are tuning.
- **Effects fold into the host's legs.** No mutator row joins the rate details (ADR-0037's roster stands); the placed mutator's face states its own effect.
- **The Mutator Forge mints on its own charge-only branch.** ADR-0009's shared-meter pattern with its own constants, growth steeper than the module branch's ×1.5 (≈×2), paced so the first mutator roll lands within the first post-entry era. ADR-0041 stands: no practice leg. Exact numbers are tuning.
- **Pool membership is uniform.** The tree's roll-pool purchase appends the Mutator Forge type to the module roll pool as one entry, unweighted; the purchase buys membership, nothing else.
- **Mutator rolls offer two candidates.** Not three — three families cannot fill three meaningful slots. Family uniform, the shared rarity table, unchosen candidates vanish, no first-roll rig. Module rolls keep three candidates.
- **Mutators combine.** Two of the same family and rarity combine into one of the next rarity, same family — mutators carry no levels, so nothing is retained or refunded; the gesture mirrors the module drop-and-confirm.
- **The slot ladder is unbounded, per-item priced.** No cap this phase; each slot's price scales with the count already unlocked (a 2/3/5/8/12 shape continuing, tuning). The roll-pool purchase stays a fixed 5 Arete, a mid-tree decision; purchases in any order.
- **The unlock gesture is growth-constrained.** The entry's first slot may be placed on any owned cell; every later unlock must attach adjacent to the already-unlocked patch, expanding from there.

## Consequences

- CONTEXT.md's Mutator, Mutator roll, and Combination entries carry the pinned terms; ADR-0040's "exact terms land with the mutator-contracts ticket" clause closes.
- The interaction prototype (issue #184) picks up the mutator-combination gesture beside the tray's place-and-retrieve.
- The map's resonance-vocabulary fog clears: resonance rides the existing chord-factor terms.
- All magnitudes, thresholds, growth rates, and prices stay provisional tuning, landing with implementation.
