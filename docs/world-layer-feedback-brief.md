# World layer feedback — confirmed design

Status: owner-confirmed design, implemented by #526–#530. Required visual acceptance remains outstanding; the completion mapping is `docs/evidence/issue-530/README.md`. This design brief alone is not implementation or visual evidence.

## Intent and priorities

Make World a lasting discovery earned by the first worthwhile prestige, never a layer that disappears after each reset. Explain production pressure even before the player can confront it. Put the Arete reset where players see their resources, finish retiring Mutators, and let collection growth use drafts instead of buying Columns with Arete.

This is the authoritative scope of the feedback round. ADR-0087 records the progression/acquisition trade-off. Historical descriptions in CONTEXT.md and older ADRs are not evidence that this design has shipped.

## Unlock and starting kit

- Hide all World navigation, map previews, locked placeholders, and World onboarding until the first prestige that banks positive Arete. Earning pending Arete or spending banked Arete is not the unlock event.
- Unlock permanently, surviving all subsequent prestiges.
- At unlock, grant one unplaced Charge Column and the existing one-time starter Charge Blade. Both persist; neither repeats each era.
- Preserve reset eligibility at 7M era-earned nous and first positive entitlement at 20M. A zero-yield reset remains possible, explicitly confirmed, and does not unlock World.
- Preserve other reset/economy rules unless explicitly changed here.

## Visible pressure before discovery

Enemies continue applying penalties before World unlocks. The ledger must show the actual combined production reduction (multiplicative remaining-production factors, not summed percentages), a breakdown by active source, and a compact explanation that pressure deepens with era progress and positive-Arete prestige unlocks the means to confront it. Do not reveal map coordinates or placement controls before unlock. Never require access to the hidden map to understand an active penalty.

## Ambient ledger reset

Desktop and phone always-visible resource strips show pending Arete yield and one clearly labeled reset entry point. Opening the ledger or menu must not be required to discover the reset. Keep the existing deliberate confirmation and upgrade-mode restriction; unavailable actions remain discoverable with their reason. Make zero-yield resets unmistakable. Do not make every Arete figure independently actionable. Spending remains in Catalog.

## World hex presentation

Replace square World faces with visually distinct hex faces on the board, inventory, drag previews, and detail views. Preserve existing hex coordinates, hit geometry, occupancy, placement, and combat rules. Differentiate World through treatment and interaction cues, not a new topology. Follow instrument standards except for the explicitly superseded module-exclusive silhouette rule.

## Acquisition

- Remove the Arete Column purchase ladder and its Catalog row. Keep Hone as a persistent, type-wide Arete weapon upgrade.
- On newly generated ordinary three-choice drafts after permanent World unlock, use a 25% chance to replace one module candidate with one World candidate. Split that World choice equally between Column and Charge Blade.
- At most one World candidate per ordinary offer; at least two module choices remain. This is explicit starting tuning, not a consequence of module rarity/category weights.
- Choosing a World candidate grants one unplaced copy to the World collection. It is not a module and has no module merge tier. Existing ownership does not exclude repeat acquisition.
- Special module drafts remain module-only, preserving their guarantees. Already-generated offers remain unchanged at unlock or migration. Only fresh ordinary offers use the mixed composition.
- Additional Blades use this shared path temporarily. A separate weapon pool is deferred until there are more weapons; no Blacksmith or dedicated weapon pool is in scope.

## Retirement and existing saves

Retire the old Mutator entry gate, Forge offer, inert Accelerator placeholder, and reachable legacy mechanics; do not rename them into World. Audit retained copies, slots, pending rolls, Forge progress, ownership flags, actions, and UI paths so obsolete behavior cannot revive. Explicitly account for those remnants in implementation rather than leave them active silently.

Existing saves must load without another blanket era reset. Preserve unrelated progression and existing World collection/placement. Do not implement refunds for past Column purchases: the owner is the only player and declined that complexity. Translate permanent unlock and starter-grant state once, safely across reloads, ensuring eligible existing saves have received the free Column without repeatedly granting it.

## One-place and non-goal rules

- This document owns the feedback scope; CONTEXT.md owns vocabulary and ADR-0087 owns the lasting progression/acquisition decision.
- Instrument standards remain the presentation authority; this round extends hex silhouettes to World and adds the ambient reset exception to the shared Ledger-button contract.
- No new adjacency rules, combat redesign, separate weapon pool, blanket save reset, refund subsystem, or claim-curve rebalance.
- Removing the open-ended Column sink changes the economy. Old calibration artifacts retain their historical identity; do not represent them as validation of the new economy.

## Verification owed by implementation

Map each behavior above to named tests or recorded verification in one completion record. Cover unlock permanence, zero-claim behavior, once-only grants and migration/reload, pre-unlock pressure arithmetic/disclosure, mixed-draft probability boundaries and routing, special/pending-offer preservation, and retired Mutator paths. Follow repository preliminary-review/source-freeze/final-evidence gates. Capture desktop and phone surfaces, keyboard/touch disclosure, unavailable reset states, non-color distinctions, and reduced motion against the pinned presentation standards. No such tests or browser evidence were run for this documentation-only decision record.
