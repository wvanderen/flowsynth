# 0067 — Draft categories draw their own weights; scrap buys the Draft Loom's tier bonus

Date: 2026-10-16
Status: Accepted
Issue: #378 (parent #366)

## Context

The launch draft samples a rarity band, then a type uniformly inside it
(ADR-0058). Two pressures break that shape as the roster grows: category
frequency rides type count, so every oscillator wave crowds the support
categories out of drafts (user story 15), and no roster entry is equally
likely by default is left to chance — the uniform draw makes them exactly
equally likely. Meanwhile the scrap economy (#377, ADR-0066) banks income
with no consumer: the parent's contract directs surplus drafts to fund
permanent draft improvements, including a chance for higher merge tiers,
with offered tiers respecting the unlocked cap and purchases that cannot
improve any candidate standing unavailable.

## Decision

1. **Category frequency is its own authored table.** Each slot still
   draws its fixed rarity band first (`rarityProbability`, ADR-0058 —
   type rarity is fixed and never stored), then one category among the
   band's not-yet-drawn types by `draftCategoryWeights`, then a type
   uniformly inside that category. A present category's mass is its
   weight over the total — never its type count — so the oscillator
   roster grows without crowding support categories out, and absent
   categories redistribute their mass. Provisional tuning:
   oscillators 4, generators 2, boosters 2, silent voices 1.5, spacer,
   forge, conduit, and ritual 1 each. The oscillator share sits near the
   uniform-by-type figure it replaced so the calibrated pacing
   (docs/capacity-release-tuning.md) survives the composition cut; seed
   42's era-1 record moved 660 → 540 minutes and was re-recorded.

2. **The loom's tier bonus is a permanent scrap ladder.** The nth owned
   rung gives every fresh candidate `tierBonusChance[n−1]` chance to
   mint one merge tier higher, clamped to the unlocked cap — offered
   tiers never exceed it, whatever the rungs owned. Three finite rungs
   at 15%/30%/50%, priced 50/150/450 scrap. Income accounting: a tiered
   candidate doubles its scrap value (`scrapTierFactor`, ADR-0066)
   beside its `tierPower`, so each rung pays back through power and
   recovery value alike; the first rung prices at a handful of early
   skips, later rungs steeper. Provisional prices, limits, and
   probabilities throughout — the parent's remaining draft products
   (guaranteed category-only, rare-only, and +1-tier one-time drafts)
   stay open follow-up work.

3. **The purchase refuses before it charges.** A past-the-ladder-end
   purchase is unavailable, as is one the unlocked cap cannot improve
   (a cap below the first tier gives every rung nothing to lift); an
   unaffordable price never consumes scrap; the flow lock covers it like
   every purchase. The rungs are memorized: `draftTierBonus` survives
   the arete reset beside the scrap that pays for it, lenient-defaults
   to 0 at load, and an implausible saved count clamps at the ladder's
   end so the quoted prices can never disagree with the owned state.

4. **The rng contract stays documented and streamable.** Per slot: band,
   category, type — three draws — plus the tier draw only while a rung
   is owned (at no rungs the stream stays nine draws per offer). The
   walk reads the weights in their authored order; distinct-candidate
   offers are untouched (each pick still leaves the shared pool exactly
   once, by identity), and the first-roll rig keeps its guard.

## Consequences

Ordinary drafts keep useful surprises — the band draw still lands
rares, and the support categories hold fixed shares — while an
established board can skip most offers into the loom fund instead of
minting inventory chores. The category table is the authoring seam the
50–100-module library will lean on: new oscillator designs divide the
oscillator mass thinner without touching any support share. The loom
row lives on the Forge's Modules face — name, current chance, and the
next rung's price in one row, the deeper mechanic in the tooltip layer —
and the canonical scrap balance in the board ledger stays the one
balance read. Mutator rolls are untouched (ADR-0043), as is the roll
rig and every threshold.
