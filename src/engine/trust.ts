import { DRIFT_NOISE_SECONDS, EPS, RECONCILIATION_FLOOR_SECONDS } from "./constants";
import { syncArete } from "./accumulator";
import { advance, sumResults } from "./advance";
import { accrueLivePractice } from "./habits";
import { accrueGoalProgress } from "./goals";
import type { Rng } from "./rolls";
import type { AdvanceResult, GameState, HonestyOutcome, SessionAccounting } from "./types";

export type { HonestyOutcome };

// Trust accounting (focus-tool spec §1–3, ADR-0019). Presence is visibility;
// every boundary hands this module the wall-clock gap since the last one and
// the presence state that held during it, and the whole simulation advances
// by that gap — never by tick count. Away trust runs to the plan: on a
// planned session, away time up to the target is trusted (banks and credits
// silently); past the target — and all away time on open-ended sessions,
// beyond the reconciliation floor — it is provisional. Provisional time
// produces into the bucket (nous) and the pool (minutes) and credits nothing
// until the honesty report settles both in one move. Nothing already banked
// is ever retracted.
//
// An absence is the whole contiguous away stretch, never one throttled
// wake-up's slice of it: while the tab is hidden, each boundary's gap
// buffers into `pendingAwaySeconds` (a persisted additive field, so a
// discard/reload/import reconciles into the same stretch), and the flush
// that classifies it — floor, target split, provisional — happens once,
// when presence returns.

export function freshAccounting(): SessionAccounting {
  return { creditedSeconds: 0, poolSeconds: 0, bucketNous: 0, pendingAwaySeconds: 0, events: [] };
}

// The presence state that held across a gap: visible, or away (hidden, or a
// slept span, or the unobservable stretch a discard/reload/import must
// reconcile from the last hidden-transition save).
export type Presence = "visible" | "away";

const ZERO: AdvanceResult = { nousEarned: 0, rollsBanked: 0, goalsCompleted: 0, areteMinted: 0 };

export function poolOutstanding(state: GameState): boolean {
  return (state.session?.accounting.poolSeconds ?? 0) > EPS;
}

// One boundary's gap, classified and applied. `seconds` is the wall-clock
// delta since the last boundary; `driftStepSeconds` is the step in
// Date.now() − (performance.timeOrigin + performance.now()) across the same
// span — a positive step past the noise floor sizes a slept gap, which is
// away even while the tab was "visible"; a negative step past the floor
// (clock rolled back) credits zero; steps inside the floor on either side
// are measurement jitter the boundary ignores. Paused time is neither
// present nor away: it produces and credits nothing.
export function applyGap(
  state: GameState,
  seconds: number,
  presence: Presence,
  driftStepSeconds: number,
  rng: Rng = Math.random,
): AdvanceResult {
  if (state.mode !== "flow" || seconds <= EPS) return ZERO;
  // Past the noise floor on either side is real drift; inside it is the two
  // clocks' quantization jitter, which the boundary ignores. Treating each
  // jitter step as drift discarded whole wall gaps (negative) or sized
  // phantom sleeps from ±2 ms (positive) — a stopwatch against the session
  // clock read a steady fraction of real time.
  if (driftStepSeconds < -DRIFT_NOISE_SECONDS) return ZERO;
  const slept = driftStepSeconds > DRIFT_NOISE_SECONDS ? Math.min(driftStepSeconds, seconds) : 0;
  const awake = seconds - slept;
  if (presence === "away") {
    // Same contiguous absence: buffer, never classify a throttled slice.
    state.session!.accounting.pendingAwaySeconds += seconds;
    return ZERO;
  }
  // The slept span joins the buffered absence and flushes first, so its
  // credit clamps at the plan (spec §1); whatever presence follows the
  // sleep banks live regardless, even past the target.
  state.session!.accounting.pendingAwaySeconds += slept;
  const flushed = flushPendingAway(state, rng);
  const live = advance(state, awake, rng);
  return sumResults(flushed, live);
}

// Classifies the whole buffered absence through the trust table (spec §1).
// Sub-floor absences auto-credit silently on both modes — nous banks, time
// credits, no report, never the pool. A planned absence spanning the target
// splits in one pass: the under-plan slice auto-banks, the past-target
// slice goes provisional. Open-ended absences past the floor go wholly
// provisional.
export function flushPendingAway(state: GameState, rng: Rng = Math.random): AdvanceResult {
  if (state.mode !== "flow") return ZERO;
  const accounting = state.session?.accounting;
  if (!accounting || accounting.pendingAwaySeconds <= EPS) return ZERO;
  const seconds = accounting.pendingAwaySeconds;
  accounting.pendingAwaySeconds = 0;
  if (seconds < RECONCILIATION_FLOOR_SECONDS) return advance(state, seconds, rng);
  const session = state.session!;
  if (session.target !== null && session.elapsed < session.target) {
    const underPlan = Math.min(seconds, session.target - session.elapsed);
    return sumResults(
      advance(state, underPlan, rng),
      advance(state, seconds - underPlan, rng, "provisional"),
    );
  }
  return advance(state, seconds, rng, "provisional");
}

export interface HonestyResolution {
  ok: boolean;
  reason?: string;
  // Goal occurrences the credited provisional minutes completed.
  completions?: number;
}

// The honesty report's answer (spec §2): settles the whole outstanding pool
// and its bucket in one move. Didn't practice credits nothing and drops the
// bucket; did what I planned credits up to the plan (C rises to max(C, T));
// practiced the whole time away credits fully. Both non-missed answers bank
// the bucket. The recorded event is the reconciliation's factual line.
export function resolveHonestyReport(state: GameState, outcome: HonestyOutcome): HonestyResolution {
  if (state.mode !== "flow") return { ok: false, reason: "No session is running." };
  const session = state.session;
  if (!session) return { ok: false, reason: "No session is running." };
  const accounting = session.accounting;
  if (accounting.poolSeconds <= EPS) return { ok: false, reason: "No provisional time is waiting." };
  if (outcome === "planned" && session.target === null) {
    return { ok: false, reason: "There is no plan to match." };
  }
  const pool = accounting.poolSeconds;
  let credit = 0;
  if (outcome === "full") {
    credit = pool;
  } else if (outcome === "planned") {
    credit = Math.min(pool, Math.max(0, session.target! - accounting.creditedSeconds));
  }
  let completions = 0;
  if (credit > EPS) {
    accounting.creditedSeconds += credit;
    accrueLivePractice(state, credit);
    completions = accrueGoalProgress(state, state.activeHabitId, credit);
  }
  if (outcome !== "missed" && accounting.bucketNous > 0) {
    state.nous += accounting.bucketNous;
    state.totalEarned += accounting.bucketNous;
    session.earned += accounting.bucketNous;
    syncArete(state);
  }
  accounting.events.push({ awaySeconds: pool, outcome });
  accounting.poolSeconds = 0;
  accounting.bucketNous = 0;
  return { ok: true, completions };
}
