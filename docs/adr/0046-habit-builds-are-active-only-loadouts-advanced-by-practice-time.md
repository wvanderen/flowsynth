# Habit builds are active-only loadouts advanced by practice time

Habit specialization is the next iteration's central gameplay direction, and habits had no progression at all — a habit was a name and an accumulated seconds counter. The decision map (issue #212, ticket #213, 2026-10-01) settled the build model, the progression economy, and how RITUAL connects board charge to habits, deliberately revisiting ADR-0012's board/console resource boundary and upholding it.

## Decision

- **A habit build is a per-habit loadout of build nodes** chosen from one shared, habit-agnostic catalog, configured and freely re-pickable (free respec) in upgrade mode. Each habit picks independently; differentiation comes from the picks, not from locked per-habit classes.
- **The launch catalog carries two branches: charge/Forge progress and nous production.** The workout/dev contrast stays sharp, and every chord-touching lever is left to the harmony effort (issues #217, #218) rather than preempted here.
- **Nodes unlock at credited-practice milestones** on the habit's own practice time — the same accrual stream that already feeds habit development, manual logs included. Unlocks are free; the equip slot count is limited per habit and grows with development. Time buys options, slots force choices — the slot pressure is the permanent decision point, so no currency or purchase gate is needed.
- **Build effects are active-only.** They apply while that habit is the session's active habit and never as always-on cross-habit bonuses, so switching habits stays strategically real and the longest-practiced habit cannot runaway-win (the failure mode issue #178 warned against). Unstructured sessions run no build. Builds and unlocks persist through prestige — real-life time is never un-earned, the flow meter's principle (ADR-0041).
- **RITUAL is a chargeable-family board module** that amplifies the active habit's equipped build effects while receiving charge — continuous empowerment, the family's synthesizer/infusor mode, not threshold fill. Working name; the roster effort (issues #215, #219) owns its name, glyph, category placement, and roll-pool wiring.
- **RITUAL reaches players through the module-roll pool only.** Deliberately RNG-gated rather than a guaranteed one-time offering: the pool is still small and the feature already takes time to unlock, and the one-time guaranteed offerings are under consideration for scale-back.
- **ADR-0012's boundary stands unsuperseded.** The compared alternatives — a minimum-credited-time-plus-charge joint gate, separate time/charge trees or pools, charge spend on habit progression — are all rejected: charge never crosses to the console. The module receives charge board-side and reads focus state as input, exactly the existing seam. Habit assignment rules stand too: one active habit fixed at session start (ADR-0001), habit and build read-only during flow, managed in upgrade mode.

## Consequences

- The Habit glossary entry's promise that development "unlocks habit-specific customization options" is kept by build nodes; `CONTEXT.md` gains **Habit build**, **Build node**, and **RITUAL** (working name).
- Charge-flavored builds carry their whole charge connection in RITUAL's amplification. If playtests show them feeling inert, time-plus-RITUAL-threshold joint gates are the considered upgrade path — not a boundary change.
- Consistency, notes, and goal-completion progression feeds are deferred, not rejected; they stay in the map's fog.
- Milestone cadence, slot growth, per-node effect lists, and magnitudes are provisional tuning, per the map's standing note.
