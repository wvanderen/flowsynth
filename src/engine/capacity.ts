// The harmonic-capacity ladder (issue #259, carrying the confirmed design
// recorded beside ADR-0050): one module owns the whole economy — the
// per-voice budget's reads, the nous Catalog's rung prices, and the Arete
// offerings' two permanent ladders (ceiling unlocks and discounts). The
// ladder is strictly finite: four nous rungs, two ceiling unlocks, two
// discounts. Prices are centralized provisional tuning for calibration.
// Since issue #373 the ceiling bounds the purchased increments alone: a
// voice's final budget is its type's intrinsic capacity (profiles.ts)
// plus the shared purchased rungs, so a profile can end above the ceiling
// the ladder itself can reach.
import { BALANCE } from "./constants";
import { intrinsicCapacityOf } from "./profiles";
import type { GameState, ModuleType } from "./types";

// The first-era ladder's base reach (issue #259): two nous purchases on
// top of the opening one — the prototype ceiling of three — before any
// Arete unlock raises it.
const BASE_RUNGS = 2;

// The ladder's purchased increments, shared by every voice: this era's
// Poly Expander rungs, clamped into the ceiling (so a corrupt save or a
// re-tuned ladder degrades honestly, never over-sings). The ceiling
// limits these purchases only (issue #373) — a profile's intrinsic seats
// ride on top, outside the clamp.
export function purchasedCapacityOf(state: GameState): number {
  return Math.min(state.capacityBought, capacityCeiling(state) - 1);
}

// One voice's whole-chord budget (issue #373): the type's intrinsic
// capacity plus the ladder's shared purchased increments. Omitting the
// type reads the standard voice — intrinsic one — which is also every
// board's floor, since no profile authors fewer.
export function capacityOf(state: GameState, type?: ModuleType): number {
  return (type ? intrinsicCapacityOf(type) : 1) + purchasedCapacityOf(state);
}

// The capacity the ladder can currently reach: the first-era prototype
// ceiling (three — two nous purchases) plus each owned Arete ceiling
// unlock (four, then five), never past the rung list a re-tuned ladder
// can actually price.
export function capacityCeiling(state: GameState): number {
  return 1 + Math.min(BALANCE.capacityPrices.length, BASE_RUNGS + state.capacityCeilings);
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
