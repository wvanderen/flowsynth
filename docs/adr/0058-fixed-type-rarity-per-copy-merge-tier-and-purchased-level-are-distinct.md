# 0058 — Fixed type rarity, per-copy merge tier, and purchased level are distinct

Date: 2026-10-14
Status: Accepted
Issue: #367 (parent #366)

## Context

A module's `rarity` today does three jobs at once: it is rolled per candidate
at acquisition, it climbs when two same-rarity copies combine at the Forge,
and it scales purchased levels (`rarityPower[rarity] ** level`) plus the
Bend's selectable shift set. As the roster grows (#366), players must be able
to learn a named design's rarity once — rarity must belong to the type, while
duplicate-earned improvement and purchased levels become separate axes.

## Decision

1. **Fixed type rarity is a property of the named type, authored in code.**
   `TYPE_RARITY: Record<ModuleType, Rarity>` in `constants.ts` assigns each
   type its acquisition rarity; it is never rolled per instance and never
   stored in the save — like achievement definitions, the table is code. The
   launch roster authors every type `common` as explicit, provisional tuning:
   the band-then-type draw below then samples the thirteen launch types
   uniformly, matching today's distribution exactly. The profile waves
   (#369 onward) retune the table per design.

2. **Rolls draw the rarity band, then the type inside it.** A module-roll
   slot first draws common/uncommon/rare from the shared
   `rarityProbability` table, then draws uniformly among the not-yet-drawn
   types whose fixed rarity matches the band (falling back to the whole
   remaining pool when a band has no types — the launch roster has only
   commons). Commons therefore acquire duplicates more readily, and rarer
   types are genuinely scarcer, without any per-instance roll. Mutator rolls
   are untouched: they keep the shared rarity table per candidate (ADR-0043).

3. **The merge tier is per copy, earned by exact copies.** `ModuleInstance`
   carries `tier` (0-based) instead of a stored rarity. Combining requires
   the same named type **and** the same tier; the result is one copy at
   `tier + 1`, keeping the higher level, refunding the melt's invested nous,
   landing where the drop target stood, and forfeiting the melt's unspent
   reserve — every retention contract of the old gesture (issues #152,
   ADR-0047) unchanged. Unequal tiers and different named types cannot
   combine. A finite unlocked cap gates the ladder (`BALANCE.mergeCap`, 2 —
   three tiers, provisional): a pair at the cap refuses, until a future
   Arete purchase raises it (#380).

4. **Tier scaling improves authored strengths, nothing else.** Module power
   is `rarityPower[TYPE_RARITY[type]] ** level × TIER_POWER[tier]`
   (`TIER_POWER` = [1, 1.5, 2.25], ×1.5 per tier, provisional). Tier never
   changes input proportions, conditions, or relative weaknesses — and never
   the type's rarity, the ring count of which now reads the tier (below).
   Mutator rarity and mutator combination are untouched.

5. **Presentation keeps one home per fact.** The engraved rings — the
   surface players already read as duplicate progress — now engrave the
   merge tier (one ring per tier, +1); the plate tint and the rarity word in
   tooltips and tiles keep the fixed type rarity. The combine review says
   "Resulting tier". The Forge candidate tile shows the type's fixed rarity
   and its per-level scaling from that rarity.

6. **Legacy-save conversion (v8 → v9), settled before implementation.**
   Loading a v8 save maps each owned module's saved rarity by index onto the
   tier — common → 0, uncommon → 1, rare → 2 — drops the stored rarity
   field, and derives type rarity from the code table. A banked module-roll
   candidate converts the same way (its rolled band survives as the tier the
   choice mints at), so queued value is never silently lost. The conversion
   is repeatable: it runs only on `version === SAVE_VERSION - 1`, writes
   only the new shape, and a save/load round-trip is stable. Nothing else
   moves — levels, reserves, placement, the life record, and mutator
   rarity all stand exactly where they were.

7. **Secondary-effect retention stays as implemented.** The survivor keeps
   its own secondary effects (the Bend's shift); the consumed copy's are
   forfeited with it. The vocabulary's "player chooses one input's secondary
   effects" line described an aspiration the engine never shipped; this
   change records the implemented contract rather than inventing a new one.
   Any revision is explicit follow-up design, not ride-along.

8. **The arete reset boundary keeps its shape.** Owned modules — types,
   tiers, placement — and the tray persist; nous levels, invested spend, and
   stored charge reset. Tier now carries exactly what rarity used to carry
   across the reset (ADR-0039).

## Consequences

- `ModuleInstance.rarity` and `Candidate.rarity` die; readers derive rarity
  via `TYPE_RARITY` and read `tier` for progress and power. The allocation
  fingerprint hashes the tier.
- `SAVE_VERSION` bumps to 9 with the one-step v8 conversion; anything older
  still rejects with the start-fresh message (ADR-0017's pattern).
- The rarity-ring visual now reads tier; a future cap raise (#380) extends
  the ring count past three and revisits the radii.
- The "Fine china" feat re-keys from owning a rare copy to owning a copy at
  the unlocked cap — the stored rarity it read no longer exists, and the
  cap is the ladder's same "the shelf never sells this" top.
- Roster rarity authoring is now a table entry, not a roll-path change; the
  category/type weighting work (#366's draft-composition decision) lands
  beside this seam in later tickets.
