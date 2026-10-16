# 0069 — Arete raises the merge cap

Date: 2026-10-16
Status: Accepted
Issue: #380 (parent #366)

## Context

ADR-0058 split fixed type rarity from the per-copy merge tier and ended
the combine ladder at a finite unlocked cap (`BALANCE.mergeCap`, 2 — three
tiers, provisional), explicitly deferring the raise to an Arete purchase.
The scrap economy's consumers (#378, #379) both clamp their offered tiers
to that cap, so an established collection could not advance its exact-copy
progression past three tiers, and the parent's user story 14 — "a finite
merge cap that Arete upgrades can raise, so that progression has reachable
milestones and further horizons" — stood unimplemented.

## Decision

1. **The cap raise is an Arete Catalog product, finite and escalating.**
   The **Warp Beam** — the weaving register the draft economy already
   speaks (the Draft Loom, the Silk Warp, the Plied Weft) — sells one rung
   per purchase at `mergeCapCosts` (5/12/30 Arete, provisional), each
   raising the unlocked cap one tier above the base. The ladder is
   strictly finite: past its end nothing more is sold, and the cap sits at
   its ceiling. No new prestige currency and no mutator merge tiers — the
   existing Arete balance is the only payer, per the parent's boundary.

2. **One read, one contract.** `catalog.unlockedMergeCap(state)` is the
   only read: the base cap plus the owned rungs, clamped at the ladder's
   end. Merge eligibility (`combinePreview`, the merge-all sweep), the
   drafts' tier draws (the ordinary lift and the special drafts'
   guaranteed base both clamp through it), the Draft Loom's and the Plied
   Weft's availability guards, and the "Fine china" feat all read it —
   a future merge-all retention or special-draft change inherits the same
   contract by construction. No surface keeps a second hard-coded limit.

3. **The tier's power scales past the old ladder.** `tierPower` extends to
   cover every tier the raised cap can mint (×1.5 per rung, the ADR-0058
   step), so a tier-3 copy's authored strengths scale by the same curve it
   always had — never a clamp at the old ladder's end. Conditions,
   proportions, and relative weaknesses never scale, unchanged.

4. **The rungs are memorized; the reset resets around them.**
   `mergeCapPurchases` counts the owned rungs. They persist through
   prestige beside the Catalog's other sheet purchases, while module
   levels, stored charge, and the era's nous-purchased progress reset as
   always. Save/load lenient-defaults the count to zero and clamps a
   corrupt figure at the ladder's end, so the unlocked cap can never
   promise a tier the prices have stopped selling.

5. **Refusals land before any charge.** The Arete mode lock (spent between
   sessions), the Catalog entry the surface stands behind, the exhausted
   ladder, and the unaffordable price each refuse without touching the
   balance — the capacity offerings' contract, unchanged.

## Consequences

Exact-copy progression gains reachable milestones past the base ceiling:
a capped pair refuses today and combines after a rung, the skip-and-scrap
economy funds the pursuit, and the drafts' offered tiers follow the cap
they always promised to clamp to. The presentation is one row on the
Catalog's Arete face in the capacity products' grammar — owned figure,
before → after cap, Arete price — with no new balances or readouts. All
names and prices are provisional tuning.
