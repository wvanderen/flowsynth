# World victories last for the lifetime and enemies take turns

Accepted design; not implemented. A credited enemy victory lasts for the current lifetime: prestige neither restores that enemy nor reapplies its production penalty. Only one enemy at a time applies pressure, in authored order. Its pressure begins when both its predecessor is defeated (if it has one) and the current era reaches its nous threshold. A wall slows nous production without shutting off charge, combat, or the option to prestige.

Victory removes the enemy's reservation and penalty, not the normal purchase requirement for an unowned cell. There is no era-local victory multiplier. Old Blade-only clears do not become lifetime victories against the redesigned enemies; the migration preserves unrelated progression, collection, and valid placements.

This replaces ADR-0074's era-local clears and stacking enemies. Replaying the same fights on every prestige makes rebuilding feel like lost progress; stacking enemies lets production leapfrog encounters while multiplying penalties, rather than making each enemy a recognizable next obstacle. Prestige should bring a stronger build back to the frontier, not recreate conquered territory. A future higher-order reset is outside this decision.

Keep pressure explainable in the Ledger before World discovery and attribute it to the current enemy on the discovered World layer. This does not change ADR-0087's permanent discovery boundary. The [redesign brief](../world-combat-redesign-brief.md) owns the remaining combat, expansion, and acquisition scope.
