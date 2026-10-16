# 0068 — Scrap buys guaranteed special drafts

Date: 2026-10-16
Status: Accepted
Issue: #379 (parent #366)

## Context

ADR-0067 closed the Draft Loom's permanent tier-bonus ladder but left the
parent's remaining draft products open: the one-time drafts a player buys
to pursue a category, the rare band, or a higher merge tier deliberately.
The scrap economy (#377, ADR-0066) banks income whose only consumer was
the loom; the contract requires explicit guarantees that apply to every
candidate, entitlements that survive save/load and the arete reset and
are consumed exactly once, offered tiers that respect the unlocked cap,
purchases no candidate could benefit from standing unavailable, and
downstream resolution under the same authoritative economy as ordinary
offers.

## Decision

1. **Three products, one guarantee each.** The Jacquard Card (`category`)
   drafts the category the player picks when weaving it; the Silk Warp
   (`rare`) drafts the rare band; the Plied Weft (`tier`) mints every
   candidate at least one merge tier above base. Provisional prices:
   60, 150, and 100 scrap respectively. The Silk Warp's price
   clears the 120 scrap a three-rare offer scraps for, so no product
   prints scrap through take-and-scrap; the category card draws its slots
   band-first, so its take-and-scrap expectation stays the ordinary
   ≈15 scrap whatever the category pursued.

2. **The purchase banks a held entitlement; the weave banks an ordinary
   offer.** `specialDrafts` counts unused entitlements per kind. They are
   memorized — they survive the arete reset beside the scrap that pays
   for them — and stack; a weave consumes exactly one and pushes a
   `RollOffer` into the shared `bankedRolls` queue. From there the offer
   is ordinary: `chooseRoll` and `skipRoll` resolve it, the skip pays
   `skipPayoutOf`, and a minted candidate scraps at the one valuation
   schedule. No second economy exists.

3. **Generation reads the ordinary seams, guarantee-bound.** The pool
   reads exactly as the ordinary draw's (the roll-pool join included).
   Candidates draw independently, so repeats are legal — the
   distinct-candidate offer stays an ordinary-draft invariant, and a
   special draft's duplicate feeds the merge path. Per slot, streamable:
   category 6 draws at no loom rungs (band, then a type inside band ∩
   category, a band with none falling back inside the category for no
   extra draw) and 9 with; rare 6/9 (a category among the rare band's
   present categories by the authored weights, then a type); tier 9/12
   (the ordinary band → category → type walk, then the lift). The loom's
   owned rungs ride on top of every guarantee — a Plied Weft plus a rung
   mints tier 2 where the cap allows — and the unlocked cap clamps every
   offered tier. The first-roll rig never applies (it reads the module
   meters, and a special draft needs scrap no opening state can carry).

4. **Refusals land before any charge.** The flow lock covers purchase and
   weave alike; an unaffordable price never consumes scrap; a Plied Weft
   the unlocked cap cannot honor (a cap below the first tier gives every
   candidate nothing to lift) refuses as unavailable; a weave with
   nothing held refuses and mints nothing. `specialDrafts` lenient-
   defaults to all-zero at load, and a corrupt per-kind count floors at
   zero — a broken record can never read as a free draft.

## Consequences

The scrap balance gains its deliberate consumer: an established board can
skip most ordinary drafts into the fund and pursue a category, the rare
band, or a tier up on demand, while ordinary drafts keep their surprises
(the card's rarity mix stays the authored gamble). The Forge's Modules
face grows one row per product under the loom row in the same grammar —
name, effect line, tooltip layer, scrap price, held count, and the weave
controls, the Jacquard Card's category named in its pick chips. Mutator
rolls are untouched, as is every threshold and the ordinary roll rig. The
products' names, prices, and packaging are provisional tuning.
