import { EPS } from "./constants";
import { syncArete } from "./accumulator";
import { chargeWindowActive, computeRates, deployed } from "./economy";
import { addForgeProgress, type Rng } from "./rolls";
import { accrueLivePractice } from "./habits";
import { accrueGoalProgress } from "./goals";
import type { AdvanceResult, GameState } from "./types";

export function advance(state: GameState, seconds: number, rng: Rng = Math.random): AdvanceResult {
  const result: AdvanceResult = {
    nousEarned: 0,
    rollsBanked: 0,
    goalsCompleted: 0,
    areteMinted: 0,
  };
  if (state.mode !== "flow" || seconds <= EPS) return result;
  const session = state.session;
  if (!session) return result;

  // The board is locked during flow, so the rate is constant across the
  // step; production is exactly what the board's modules make (§2.1).
  const snapshot = computeRates(state, true);
  const gained = snapshot.rate * seconds;
  state.nous += gained;
  state.totalEarned += gained;
  result.nousEarned += gained;
  // Filling the accumulator mints Arete (ADR-0015).
  result.areteMinted += syncArete(state);
  if (snapshot.forgeRate > 0) {
    result.rollsBanked += addForgeProgress(state, snapshot.forgeRate * seconds, rng);
  }
  session.elapsed += seconds;
  // The summary's headline and rate (§5.7) accrue with the session itself,
  // so pauses and discarded gaps never count into either.
  session.earned += gained;
  // The charge window is a time budget, not a rate: a deployed focus-keyed
  // generator spends one window second per flow second, elapsing even with
  // no eligible neighbors (the remaining-duration vocabulary). Undeployed,
  // it produces no output and the window holds.
  if (chargeWindowActive(state) && deployed(state).some((m) => m.type === "focusKeyed")) {
    state.chargeWindow = Math.max(0, state.chargeWindow - seconds);
  }
  accrueLivePractice(state, seconds);
  result.goalsCompleted += accrueGoalProgress(state, state.activeHabitId, seconds);
  return result;
}
