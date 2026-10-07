# 0053 — The capacity ladder sells through the Catalogs, and prestige returns the voices to one

Date: 2026-10-06
Status: Accepted (development slice — the ordinary economy stays on its existing path pending full calibration)
Issue: #259

## Context

ADR-0052 landed the one-capacity economy behind the development gate and left `voiceCapacityOf` returning one, with the ladder's economy surfaces — the nous Catalog purchases, the Arete ceiling unlocks and discounts, the prestige reset — deliberately unwired. The confirmed harmonic-capacity design sells those surfaces: capacity starts at one, each global purchase adds a unit to every current and future voice inside a first-era ceiling of three, the Arete offerings raise that ceiling (prototype maximums four and five) and discount the rungs (20%, then 40% in total), and prestige resets the purchases while the offerings persist. Prices are milestones — no earned-nous gate, no per-module purchase — and the numerical prototype's 1,000/100,000 rungs are explicitly not adopted tuning.

## Decision

1. **One module owns the ladder.** `capacity.ts` holds every figure and read: the per-voice budget (clamped into the ceiling, so a corrupt save or a re-tuned ladder degrades honestly), the ceiling (three plus the owned unlocks, never past the rung list), the next rung's whole-nous price with the owned discounts folded in (rounded up — a discount never undercharges whole nous), and both Arete ladders' next prices. `economy.ts`'s `voiceCapacityOf` delegates to it — the ladder landed in exactly the one accessor ADR-0052 reserved, so every rate pass and readout stays on one figure.

2. **The purchase is one action with the price as its only gate.** `buyCapacity` runs the house purchase shape — upgrade mode only, an exact whole-nous spend of the quoted price, `checkUnlocks` at the boundary — with no earnings gate and no per-module path. The Arete offerings (`buyCapacityCeiling`, `buyCapacityDiscount`) mirror the sheet's one-time purchase shape, each pair climbing in order.

3. **The prices are centralized provisional tuning.** Four nous rungs and four Arete prices live in `BALANCE` alone, marked for calibration; every ceiling costs more than the discount standing beside it; the discount shares (20%, then 40%) replace, never stack past, their quoted shape. No test or surface treats a figure as settled balance — the suite pins the ladder's shape and honesty, never the numbers.

4. **Prestige resets the purchases and keeps the offerings.** The reset boundary erases `capacityBought` beside the module levels — the voices return to one, and the rungs must be re-earned through practice — while the owned ceilings and discounts ride the Arete-survives list. The prestige modal names the reset in the same breath as the levels, wherever the capacity model exists.

5. **The surfaces stay development-gated.** The nous Catalog's capacity row and the Arete sheet's offerings render only in development play — the allocation model they serve is gated (ADR-0052), and ordinary play shows no capacity controls. The row reads bought (the per-voice figure advances), unavailable (disabled price with the practice-minute estimate), and capped (`capped` with a pointer at the Arete sheet while a ceiling unlock remains, `complete` when sold out); the sheet's rows wear the owned words and the locked "after the first" state. Both modals' rebuild keys carry the owned counts, so a purchase re-reads the row at once — and the purchase itself re-runs the allocation through `checkUnlocks`, moving every readout in the same pass.

6. **The save grows three counters, leniently.** `capacityBought`, `capacityCeilings`, and `capacityDiscounts` lenient-default to zero at load — a pre-ladder save owes no purchases and no offerings, and nothing unrelated resets with them. Corrupt counts degrade to zero; an over-purchased count clamps at the ceiling when read.

## Consequences

- Development play now prices capacity: purchases raise `voiceCapacityOf`, the allocation spends the raised budget, and the board's capacity reads (used/available, idle candidates, the Catalog row) follow in the same render. Ordinary play is untouched — the purchase row and offerings simply do not render.
- The acceptance scenarios — purchase, subsequent module acquisition, cap enforcement, failed and flow-mode purchase, save/reload, prestige followed by repurchase — are pinned in `capacity.test.ts` (engine) and the Catalog suites (UI).
- #260's placement preview and the calibration ticket inherit the seam unchanged: rebalancing is an edit to `BALANCE`'s ladder block alone. Higher ceilings and deeper discounts remain deferred by design; the ladders are strictly finite.
- Prestige testing now covers the ladder's reset-and-repurchase cycle; the era-two pacing targets (provisionally ~14 of the ~20 credited-practice hours) await the calibration ticket's real figures.
