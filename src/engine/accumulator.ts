// The Arete accumulator (ADR-0015, ambient per ADR-0038, prestige per
// ADR-0039/0042): a log-scale fill on the current era's earned nous toward
// the horizon line — the fixed prestige threshold, the same every era. The
// fill rebases at each prestige; lifetime totalEarned stays the monotonic
// truth underneath (and is what the "Eyes on the horizon" feat reads).
// Arete mints nowhere: the crossing only opens the door; the reset action
// banks the claim. The floor and horizon are provisional tuning.
import { BALANCE } from "./constants";
import type { GameState } from "./types";

// Lifetime ν where the visible log scale begins.
export const ARETE_LOG_FLOOR = 1e3;

// The prestige threshold — the horizon line that caps each era's fill.
// The harmonic-capacity calibration (#262): the finite-capacity economy's
// ordinary first era crosses in roughly twenty credited hours and the
// second near seventy percent of that (full-fidelity evidence across
// seeds and policies in docs/capacity-release-tuning.md and
// capacity-calibration.test.ts). The prior 1e23 expansion-led figure
// belonged to the uncapped stacking model the capacity design retires.
export const ARETE_HORIZON = 7e6;

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

// The live prestige claim (ADR-0042). The base is linear forever: the nth
// prestige banks n. Once the horizon break is owned, per-era overfill
// scales on top — R is the era's earned ν over the horizon line (the bar's
// own rebased measure, never lifetime; R ≥ 1 under the floored scale), the
// decade coefficient is log₁₀ by contract, and the product sits under a
// hard cap. The scale floors at n, so an at-threshold reset banks exactly
// n; claims round down to whole Arete (rounding is tuning), which also
// keeps the pre-break claim and the floor identical.
export function claimOf(state: GameState): number {
  const n = state.prestiges + 1;
  if (!state.horizonBroken) return n;
  const R = Math.max(state.eraEarned / ARETE_HORIZON, 1);
  return Math.min(Math.floor(n * (1 + Math.log10(R))), BALANCE.horizonBreakClaimCap);
}
