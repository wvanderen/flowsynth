// The Arete accumulator (ADR-0015): the status monitor's log-scale fill on
// lifetime total nous earned toward the first prestige threshold — the
// horizon line. Filling mints Arete: nous fills, Arete is minted; what a
// fill mints in quantity and what Arete spends on are prestige design, out
// of scope. The floor, horizon, and graduations are provisional tuning.
import type { GameState } from "./types";

// Lifetime ν where the visible log scale begins.
export const ARETE_LOG_FLOOR = 10;

// The first prestige threshold — the horizon line that caps the fill.
export const ARETE_HORIZON = 100_000;

// Inert decade graduations strung between floor and horizon.
export const ARETE_GRADUATIONS: readonly number[] = [100, 1_000, 10_000];

// The fill's log-scale position: 0 at the floor, 1 at the horizon, clamped
// outside so pre-floor totals and past-horizon eras both render sanely.
export function accumulatorFill(totalEarned: number): number {
  const span = Math.log10(ARETE_HORIZON) - Math.log10(ARETE_LOG_FLOOR);
  const position = (Math.log10(Math.max(totalEarned, ARETE_LOG_FLOOR)) - Math.log10(ARETE_LOG_FLOOR)) / span;
  return Math.min(1, Math.max(0, position));
}

// The next mark the readout counts toward: the following decade graduation,
// or the horizon once every graduation lies behind.
export function nextAccumulatorMark(totalEarned: number): number {
  return ARETE_GRADUATIONS.find((mark) => mark > totalEarned) ?? ARETE_HORIZON;
}

// Crossing the horizon mints Arete. totalEarned is monotonic, so the check
// is idempotent and safe to call anywhere totalEarned grows (flow ticks,
// dev grants). Returns how many Arete this call minted.
export function syncArete(state: GameState): number {
  if (state.totalEarned >= ARETE_HORIZON && state.arete === 0) {
    state.arete = 1;
    return 1;
  }
  return 0;
}
