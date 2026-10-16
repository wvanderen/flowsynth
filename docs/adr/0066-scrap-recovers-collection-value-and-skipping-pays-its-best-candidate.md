# 0066 — Scrap recovers collection value; skipping a draft pays its best candidate

Date: 2026-10-16
Status: Accepted
Issue: #377 (parent #366)

## Context

Unwanted collection finds and unhelpful drafts currently create inventory
chores: a roll the player cannot use leaves nothing behind ("unchosen
candidates disappear without consolation resources"), and an owned module
with no place on the board can only wait in the tray. The parent's scrap
economy contract (#366) directs the opposite: skipping consumes the offer
for the greatest scrap value among its candidates, taking and immediately
scrapping yields no advantage, owned copies use the same valuation, and
merged or directly drafted higher tiers carry the equivalent
constituent-copy value — no hidden value loss. The scrap balance persists
through the arete reset with the collection it values.

## Decision

1. **One valuation schedule, read in one place.** A copy's recovery
   value is `scrapValue[fixed type rarity] × scrapTierFactor ** tier`
   (`scrap.ts`), with the fixed rarity from `TYPE_RARITY` (ADR-0058) and
   the copy's own merge tier. Provisional tuning: commons 5, uncommons
   15, rares 40, ×2 per tier.

2. **The tier factor conserves value through merging.** The factor is
   exactly 2: two copies at tier t scrap for what the one copy at
   t + 1 they combine into scraps for, and a directly drafted higher
   tier (the legacy conversion's mint, ADR-0058) is worth its
   constituent copies. Merging therefore never destroys recoverable
   value. Levels and invested nous price no scrap — the schedule values
   the collection, not the upgrade spend; a scrapped copy's levels are
   lost with it, as a melt's forfeit already is (ADR-0058's retention
   contracts stand).

3. **Scrap is a persistent resource with one canonical store.**
   `GameState.scrap` banks every payout; no other state carries it. It
   survives the arete reset beside the collection (levels and stored
   charge still reset), lenient-defaults to 0 at load, and round-trips
   through the save. Its consumer — the parent's permanent draft
   upgrades and special drafts — is later work (#366); this slice
   defines only the income.

4. **Skipping pays the draft action; scrapping pays the recovery.** The
   skip action consumes a banked module roll once and pays
   `max(candidates' scrapValueOf)`; the scrap action removes an owned
   module once and pays `moduleScrapValue`. Both are upgrade-mode-only
   under the existing session locks, refuse unknown ids, and cannot
   double-pay: a consumed offer's id is not banked, a removed module's
   id is not found. Taking the best candidate and immediately scrapping
   it mints the same type at the same tier, so the two paths pay
   identically by construction. Mutator rolls are untouched — unchosen
   candidates still vanish without consolation (ADR-0043). The scrap
   action is engine-open to every owned module, but the launch surface
   is the tray: the library tiles (column and sheet) carry the chips,
   and a deployed copy is retrieved by the existing gestures first —
   the unwanted-collection home, not a board edit.

5. **Removal ends a targeted selection, like a melt.** A scrapped
   recipient's id resolves to nothing forever, so every Spotlight
   pointing at it drops its pick (the combine rule, issue #374); the
   remembered-selection rule keeps temporary invalidation, never a dead
   reference.

## Consequences

Every draft and every duplicate now has a floor value, so the library
can grow (#366) without punishing finds that do not fit the board. The
payout equivalence makes the skip control a pure convenience — mature
players can pocket value without mint-and-scrap round trips — and the
conservation rule makes merge-all safe to run before a scrap sweep. The
base values and the factor are provisional: retuning `scrapValue` or
`scrapTierFactor` changes every figure uniformly and cannot break the
equivalence or the conservation, which follow from the schedule's shape.
Presentation keeps one home per fact: the balance reads once in the
board ledger's resource group, the offer's payout rides the skip
control, and the recovery value rides the scrap action.
