# Legacy habit builds retire without losing earned development

Accepted, 2026-10-21 (issue #444, a slice of the Focus redesign #443). This supersedes ADR-0046's build contract — catalog, milestone ladder, equip slots, and effects — and carries the retirement decision of the locally confirmed ADR-0075 into the shipped economy. Class development (ADR-0074) is the single progression system per habit/class.

## Decision

- **The legacy habit build retires as a complete behavior change**: the Focus build section, the equip/unequip actions, and every gameplay bonus retire together. Nothing is hidden behind dead UI, and no second progression system survives beside the class tree.
- **Effects retire at their authoritative economy sources.** The rate pass reads no build factors: the synth term, the named-chord bonus scale, the booster uplift, the Forge-progress efficiency, the achievement-boost touch, and the generators' flat output strength are gone from `computeRates` and its allocation twin. The session-end focus bank credits its authored profile alone. The related legacy amplification retires with them: the snapshot's ritual amplification field, the attunement scaling, and their readouts leave the pass and the surfaces, so no figure promises an effect nothing receives.
- **RITUAL remains a module** — the habit-keyed continuous-charge receiver keeps its category, hue, pool placement, level, and merge path — but it amplifies nothing. Its readouts state the charge it receives; its level buys nothing, so it wears no upgrade button, the silent wire's precedent. Any future role needs a specific charged effect, per ADR-0074's RITUAL note.
- **No compensatory XP and no second conversion.** The existing v10 → v11 migration's one-Engineer-XP-per-recorded-second rule stands, exactly once, and never overwrites the pair ledger it wrote. Retired build ids carry no convertible value: the `build` field drops at load per the retired-field precedent (no version bump), and saves stop writing it.
- **Earned development survives untouched**: class XP, levels, free points, allocation, presets, and the per-pair practice-roll meter persist across load/save, prestige, and the retirement itself; lifetime practice, session and goal history, archived habits, tagged notes, and unrelated collection and reward records stand outside the change.

## Consequences

- Habit practice time (`habit.seconds`) remains the honest lifetime record and the class level thresholds' accrual basis; it no longer unlocks anything else.
- The allocation memo no longer keys on the active habit or its build: a habit switch alone is not a rate input. The chord pass's `bonusScale` parameter retires with the named-chord scale — its only author was the build; every read now quotes the chord table's authored bonus directly.
- `docs/modules.md`'s RITUAL row reads the receiver role; the glossary's build entries record the retirement.
- Economy and migration regressions cover both shapes a returning save can carry — a previously equipped loadout and an empty one — asserting production, charge, Forge, and focus-bank equality against the stripped shape, the strip's byte-stable round-trip, the conversion's once-only rule, and prestige's ledger preservation.
