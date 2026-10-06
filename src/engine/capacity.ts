// The harmonic-capacity ladder (issue #259, carrying the confirmed design
// recorded beside ADR-0050): one module owns the whole economy — the
// per-voice budget's reads, the nous Catalog's rung prices, and the Arete
// offerings' two permanent ladders (ceiling unlocks and discounts). The
// ladder is strictly finite: four nous rungs, two ceiling unlocks, two
// discounts. Prices are centralized provisional tuning for calibration.
import { BALANCE } from "./constants";
import type { GameState } from "./types";

// The per-voice whole-chord budget — the figure every rate pass and
// readout shares (through economy's voiceCapacityOf, the one accessor
// ADR-0052 reserved for this ladder). Clamped into the ceiling, so a
// corrupt save or a re-tuned ladder degrades honestly, never over-sings.
export function capacityOf(state: GameState): number {
  return Math.min(1 + state.capacityBought, capacityCeiling(state));
}

// The capacity the ladder can currently reach: the first-era prototype
// ceiling (three — two nous purchases) plus each owned Arete ceiling
// unlock (four, then five).
export function capacityCeiling(state: GameState): number {
  return 1 + Math.min(BALANCE.capacityPrices.length, 2 + state.capacityCeilings);
}

// The next rung's whole-nous price, the owned Arete discounts folded in
// (rounded up, so a discount never undercharges whole nous); null when the
// ladder is exhausted — the ceiling is reached or the rungs are sold out.
export function nextCapacityPrice(state: GameState): number | null {
  const bought = state.capacityBought;
  if (bought >= BALANCE.capacityPrices.length) return null;
  if (1 + bought >= capacityCeiling(state)) return null;
  return Math.ceil(BALANCE.capacityPrices[bought]! * (1 - capacityDiscountShare(state)));
}

// The discount share the owned Arete discounts grant off the original
// prices: 20%, then 40% in total.
export function capacityDiscountShare(state: GameState): number {
  return BALANCE.capacityDiscountShares[state.capacityDiscounts - 1] ?? 0;
}

// The Arete ceiling ladder's next rung, or null when both are owned.
export function nextCeilingPrice(state: GameState): number | null {
  return BALANCE.capacityCeilingCosts[state.capacityCeilings] ?? null;
}

// The Arete discount ladder's next rung, or null when both are owned.
export function nextDiscountPrice(state: GameState): number | null {
  return BALANCE.capacityDiscountCosts[state.capacityDiscounts] ?? null;
}
