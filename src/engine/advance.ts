import { EPS } from "./constants";
import { computeRates } from "./economy";
import { addForgeProgress, type Rng } from "./rolls";
import { accrueLivePractice } from "./habits";
import { accrueGoalProgress } from "./goals";
import type { AdvanceResult, GameState } from "./types";

export function advance(state: GameState, seconds: number, rng: Rng = Math.random): AdvanceResult {
  const result: AdvanceResult = {
    nousEarned: 0,
    rollsBanked: 0,
    goalsCompleted: 0,
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
  if (snapshot.forgeRate > 0) {
    result.rollsBanked += addForgeProgress(state, snapshot.forgeRate * seconds, rng);
  }
  session.elapsed += seconds;
  accrueLivePractice(state, seconds);
  result.goalsCompleted += accrueGoalProgress(state, state.activeHabitId, seconds);
  return result;
}
