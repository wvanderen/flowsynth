import { BALANCE, EPS } from "./constants";
import { computeRates, deployedTime } from "./economy";
import { addExpansionProgress, addForgeProgress, type Rng } from "./rolls";
import type { AdvanceResult, Burst, ModuleInstance } from "./types";

export function pushBurst(module: ModuleInstance, burst: Burst): void {
  const last = module.bursts[module.bursts.length - 1];
  if (last && last.strength === burst.strength) {
    last.seconds += burst.seconds;
  } else {
    module.bursts.push(burst);
  }
}

export function advance(state: import("./types").GameState, seconds: number, rng: Rng = Math.random): AdvanceResult {
  const result: AdvanceResult = {
    nousEarned: 0,
    rollsBanked: 0,
    cellsEarned: 0,
    burstAwarded: false,
    storeOpened: false,
  };
  if (state.mode !== "flow" || seconds <= 0) return result;

  let remaining = seconds;
  let guard = 0;
  while (remaining > EPS && guard++ < 100_000) {
    const time = state.timeActive ? deployedTime(state) : undefined;
    const burst = time && time.bursts.length > 0 ? time.bursts[0] : undefined;
    const session = state.session;
    if (!session) break;

    const tBurst = burst ? burst.seconds : Number.POSITIVE_INFINITY;
    const target = session.target;
    const tTarget =
      target !== null && !session.burstAwarded && session.elapsed < target ? target - session.elapsed : Number.POSITIVE_INFINITY;
    const step = Math.min(remaining, tBurst, tTarget);

    if (step > EPS) {
      const snapshot = computeRates(state, burst !== undefined);
      const gained = snapshot.rate * step;
      state.nous += gained;
      state.totalEarned += gained;
      result.nousEarned += gained;
      if (snapshot.forgeRate > 0) {
        result.rollsBanked += addForgeProgress(state, snapshot.forgeRate * step, rng);
      }
      if (snapshot.expansionRate > 0) {
        result.cellsEarned += addExpansionProgress(state, snapshot.expansionRate * step);
      }
      if (burst) burst.seconds = Math.max(0, burst.seconds - step);
      session.elapsed += step;
      remaining -= step;
    }

    if (burst && burst.seconds <= EPS && time) {
      time.bursts.shift();
    }

    if (
      session.target !== null &&
      !session.burstAwarded &&
      session.elapsed >= session.target - EPS
    ) {
      session.burstAwarded = true;
      if (state.timeActive && time) {
        pushBurst(time, { strength: 1, seconds: session.target * BALANCE.chargeSecondsPerPracticeSecond });
        result.burstAwarded = true;
      }
      if (state.timeActive && !state.storeOpened) {
        state.storeOpened = true;
        // The store opening is also the Notes module's activation gate (#4):
        // its capture tool comes alive with the wider game.
        state.notesActive = true;
        result.storeOpened = true;
      }
    }
  }
  return result;
}
