import { EPS } from "./constants";
import { syncAchievements } from "./achievements";
import { chargeDelivered, chargeWindowActive, computeRates, deployed } from "./economy";
import { addFlowProgress, addForgeProgress, type Rng } from "./rolls";
import { accrueLivePractice } from "./habits";
import { accrueGoalProgress } from "./goals";
import type { AdvanceResult, GameState } from "./types";

// Where a span's produced nous lands and whether it credits practice
// (focus-tool spec §1–3). "live" is present or trusted time: banks, credits,
// accrues. "provisional" is away time the honesty report still owns: its
// nous lands in the provisional bucket and its minutes in the pool — it
// produces, but credits nothing until the report settles it.
export type AdvanceSink = "live" | "provisional";

// The one production-credit seam (ADR-0039): produced nous lands on the
// balance, the lifetime truth, and the era's measure together — prestige
// rebases only the era leg. Every nous-granting path reads this, never
// three parallel increments that can drift.
export function earnNous(state: GameState, amount: number): void {
  state.nous += amount;
  state.totalEarned += amount;
  state.eraEarned += amount;
}

export function sumResults(a: AdvanceResult, b: AdvanceResult): AdvanceResult {
  return {
    nousEarned: a.nousEarned + b.nousEarned,
    rollsBanked: a.rollsBanked + b.rollsBanked,
    rollsFlow: a.rollsFlow + b.rollsFlow,
    rollsForge: a.rollsForge + b.rollsForge,
    goalsCompleted: a.goalsCompleted + b.goalsCompleted,
  };
}

export function advance(
  state: GameState,
  seconds: number,
  rng: Rng = Math.random,
  sink: AdvanceSink = "live",
): AdvanceResult {
  const result: AdvanceResult = {
    nousEarned: 0,
    rollsBanked: 0,
    rollsFlow: 0,
    rollsForge: 0,
    goalsCompleted: 0,
  };
  if (state.mode !== "flow" || seconds <= EPS) return result;
  const session = state.session;
  if (!session) return result;

  // The board is locked during flow, so the rate is constant across the
  // step — except at the charge-window boundary: a step that outlives the
  // window splits there, so the drained generator stops crediting the
  // remainder (the rate really does change mid-step, once).
  if (
    chargeWindowActive(state) &&
    state.chargeWindow + EPS < seconds &&
    deployed(state).some((m) => m.type === "focusKeyed")
  ) {
    // Capture the split point first: the first leg drains the window, so
    // reading it in the second call's argument would re-advance the whole
    // step uncharged.
    const split = state.chargeWindow;
    const first = advance(state, split, rng, sink);
    const second = advance(state, seconds - split, rng, sink);
    return sumResults(first, second);
  }

  // The board is locked during flow, so the rate is constant across the
  // step; production is exactly what the board's modules make (§2.1).
  // Board-side meters (Forge progress, received charge) run in both sinks —
  // the trust table redirects only nous and practice minutes (§1); the
  // bucket holds nous only. Practice is the flow meter's whole diet
  // (ADR-0041): it joins below, live-sink only, beside the credited time
  // it keys off — it feeds no Forge branch's threshold.
  const snapshot = computeRates(state, true);
  const gained = snapshot.rate * seconds;
  if (sink === "provisional") {
    // Provisional nous never touches the balance: it waits in the bucket
    // for the honesty report to bank or drop it in one move (§2), and the
    // span's minutes join the pool behind it.
    session.accounting.bucketNous += gained;
    session.accounting.poolSeconds += seconds;
  } else {
    earnNous(state, gained);
  }
  result.nousEarned += gained;
  if (snapshot.forgeRate > 0) {
    const forgeRolls = addForgeProgress(state, snapshot.forgeRate * seconds, rng);
    result.rollsForge += forgeRolls;
    result.rollsBanked += forgeRolls;
  }
  session.elapsed += seconds;
  // The summary's headline and rate (§5.7) accrue with the session itself,
  // so pauses never count into either; provisional production stays out
  // until its bucket banks.
  if (sink === "live") session.earned += gained;
  // The charge window is a time budget, not a rate: a deployed focus-keyed
  // generator spends one window second per flow second, elapsing even with
  // no eligible neighbors (the remaining-duration vocabulary). Undeployed,
  // it produces no output and the window holds.
  if (chargeWindowActive(state) && deployed(state).some((m) => m.type === "focusKeyed")) {
    state.chargeWindow = Math.max(0, state.chargeWindow - seconds);
  }
  if (sink === "live") {
    // Practice credits only from present and trusted time — nothing ever
    // accrues from away before its reconciliation (§3), so the provisional
    // minutes above leave habit, goals, and C untouched.
    session.accounting.creditedSeconds += seconds;
    accrueLivePractice(state, seconds);
    result.goalsCompleted += accrueGoalProgress(state, state.activeHabitId, seconds);
    // The flow meter (ADR-0041): every credited practice second fills the
    // player-wide meter one-for-one, crossing its fixed cadence — one fast
    // opening fill, then flat forever. Received charge feeds only the Forge
    // branches, above; the two sources share one banked-roll queue.
    result.rollsFlow += addFlowProgress(state, seconds, rng);
    result.rollsBanked += result.rollsFlow;
  }
  // The session-tick check (ADR-0015): charge exists only live in flow, so
  // the tick that holds the snapshot reports whether any module received
  // it (Spark). Unlocks queue into the session's summary row.
  syncAchievements(state, { chargeDelivered: chargeDelivered(snapshot) });
  return result;
}
