// The Arete accumulator (ADR-0015, ambient per ADR-0038, prestige per
// ADR-0039): a log-scale fill on the current era's earned nous toward
// the horizon line — the fixed prestige threshold, the same every era. The
// fill rebases at each prestige; lifetime totalEarned stays the monotonic
// truth underneath (and is what the "Eyes on the horizon" feat reads).
// Arete mints nowhere: the crossing only opens the door; the reset action
// banks the claim. The floor and horizon are provisional tuning.
// The frontier contract (issue #425, ADR-0074 as amended): the claim reads
// a cumulative entitlement curve over era-earned depth, never the prestige
// count — the retired accumulator claim (ADR-0042's linear base and the
// Horizon break's overfill scaling) is subsumed by the curve, and Headroom
// retires with it.
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

// The visible scale's decade count — the one span read, shared by the
// fill and the surfaces that quote its geometry.
export function accumulatorSpan(): number {
  return Math.log10(ARETE_HORIZON) - Math.log10(ARETE_LOG_FLOOR);
}

// The fill's log-scale position: 0 at the floor, 1 at the horizon, clamped
// outside so pre-floor eras and past-horizon overfill both render sanely.
export function accumulatorFill(eraEarned: number): number {
  const position = (Math.log10(Math.max(eraEarned, ARETE_LOG_FLOOR)) - Math.log10(ARETE_LOG_FLOOR)) / accumulatorSpan();
  return Math.min(1, Math.max(0, position));
}

// Whether the current era's fill has reached the horizon line — the state
// that opens the prestige door. Per-era, never lifetime: a fresh era's bar
// reads 0% and the door is shut again until the next crossing.
export function horizonReached(state: GameState): boolean {
  return state.eraEarned >= ARETE_HORIZON;
}

// The frontier claim curve (issue #425, ADR-0074's claimed-frontier
// section): a cumulative entitlement E over era-earned nous depth assigns
// total Arete entitlement to depth. Zero below the World's 1T entry; the
// log candidate from research/world-frontier/findings.md — 2 + 2·log₁₀(x)
// over x = era-earned / 1e12 — ships as the baseline, its discontinuous
// entry grant paying exactly one weapon plus one Column. HYPOTHESIS KNOBS:
// findings.md is comparison evidence within a short horizon, its own
// provenance section records that no current-engine calibration was rerun
// and the no-refund re-derivation (#425's second blocker) had not landed —
// no shipped default claims recoverability. The curve is increasing with
// diminishing marginal reward; fractionally valued, always.
// The curve's optional claimBase (issue #472): the playtesting recipe's
// declared override — an isolated run's curve carries its own base while
// ordinary play and every other reader keep the shipped constant. The
// slope and entry depth stay the curve's own.
export function frontierEntitlement(eraEarned: number, claimBase: number = BALANCE.world.claimBase): number {
  if (eraEarned < BALANCE.world.entryNous) return 0;
  const depth = Math.log10(eraEarned / BALANCE.world.entryNous);
  return claimBase + BALANCE.world.claimDepthSlope * depth;
}

// The pending claim (issue #425): the positive difference between the
// entitlement at the current era score and the entitlement already banked
// against — the claimed frontier, advanced only on prestige, atomically
// with banking. Fractional entitlement is preserved internally so rounding
// neither destroys progress nor the partition-independence the simulation
// proved: claims telescope because the frontier advances by whole banked
// steps (an integer), so floor sums recombine exactly. Repeating a
// previously reached depth leaves at most the sub-unit fraction pending —
// it banks nothing. This figure reads only on the prestige door and its
// confirm; no board-wide or ledger claim figure exists.
export function pendingClaimOf(state: GameState, claimBase?: number): number {
  return Math.max(0, frontierEntitlement(state.eraEarned, claimBase) - state.world.frontier);
}

// The bankable claim: whole Arete, floored from the pending figure at the
// moment of banking. The frontier then advances by exactly this whole step
// — the invariant that makes arbitrary prestige splittings telescope to
// the single-climb total (world.test.ts re-derives it within 1e-10).
export function bankableClaimOf(state: GameState, claimBase?: number): number {
  return Math.floor(pendingClaimOf(state, claimBase));
}
