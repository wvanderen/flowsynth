// The Arete accumulator (ADR-0015, ambient per ADR-0038, prestige per
// ADR-0039/0042): a log-scale fill on the current era's earned nous toward
// the horizon line — the fixed prestige threshold, the same every era. The
// fill rebases at each prestige; lifetime totalEarned stays the monotonic
// truth underneath (and is what the "Eyes on the horizon" feat reads).
// Arete mints nowhere: the crossing only opens the door; the reset action
// banks the claim. The floor and horizon are provisional tuning.
import type { GameState } from "./types";

// Lifetime ν where the visible log scale begins.
export const ARETE_LOG_FLOOR = 10;

// The prestige threshold — the horizon line that caps each era's fill.
export const ARETE_HORIZON = 100_000;

// The fill's log-scale position: 0 at the floor, 1 at the horizon, clamped
// outside so pre-floor eras and past-horizon overfill both render sanely.
export function accumulatorFill(eraEarned: number): number {
  const span = Math.log10(ARETE_HORIZON) - Math.log10(ARETE_LOG_FLOOR);
  const position = (Math.log10(Math.max(eraEarned, ARETE_LOG_FLOOR)) - Math.log10(ARETE_LOG_FLOOR)) / span;
  return Math.min(1, Math.max(0, position));
}

// Whether the current era's fill has reached the horizon line — the state
// that opens the prestige door. Per-era, never lifetime: a fresh era's bar
// reads 0% and the door is shut again until the next crossing.
export function horizonReached(state: GameState): boolean {
  return state.eraEarned >= ARETE_HORIZON;
}

// The live prestige claim (ADR-0042's linear base): the nth prestige banks
// n Arete. Post-break overfill scaling rides on top of this base later;
// the base never changes.
export function claimOf(state: GameState): number {
  return state.prestiges + 1;
}
