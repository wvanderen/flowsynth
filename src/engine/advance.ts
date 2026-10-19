import { CATEGORY_OF, EPS } from "./constants";
import { syncAchievements } from "./achievements";
import { syncChordDiscoveries } from "./library";
import { activeBuildGeneratorStrength, chargeDelivered, emittedStrength, maxChordFactorOf, deployed, sessionClockOf, syncRates } from "./economy";
import { lifetimeBreatherSecondsOf, nextRestBoundaryOf, nextTemporalBoundaryOf } from "./profiles";
import { summaryTermsOf } from "./allocation";
import { addFlowProgress, addForgeProgress, addMutatorForgeProgress, type Rng } from "./rolls";
import { accrueLivePractice } from "./habits";
import { accrueGoalProgress, secondsUntilGoalCompletion } from "./goals";
import type { AdvanceResult, GameState, ModuleInstance, RateSnapshot } from "./types";

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
    rollsMutator: a.rollsMutator + b.rollsMutator,
    goalsCompleted: a.goalsCompleted + b.goalsCompleted,
  };
}

// Shared board boundaries; only flow adds practice-driven goal boundaries.
function boardBoundaries(state: GameState) {
  const steadyBonus = activeBuildGeneratorStrength(state, true);
  const liveGenerators: { module: ModuleInstance; strength: number }[] = [];
  let earliest = Infinity;
  for (const module of deployed(state)) {
    if (CATEGORY_OF[module.type] !== "generator") continue;
    if (module.reserve > EPS) {
      const strength = emittedStrength(state, module, true, steadyBonus);
      liveGenerators.push({ module, strength });
      earliest = Math.min(earliest, module.reserve / strength);
    }
  }
  const clock = sessionClockOf(state);
  for (const module of deployed(state)) {
    const boundary = nextTemporalBoundaryOf(module.type, clock) - clock;
    if (boundary < earliest) earliest = boundary;
    if (state.mode === "breather") {
      const rest = lifetimeBreatherSecondsOf(state);
      earliest = Math.min(earliest, nextRestBoundaryOf(module.type, rest) - rest);
    }
  }
  return { liveGenerators, earliest };
}

function advanceForge(state: GameState, snapshot: RateSnapshot, spanSeconds: number, rng: Rng, spanResult: AdvanceResult): void {
  if (snapshot.forgeRate > 0) {
    const forgeRolls = addForgeProgress(state, snapshot.forgeRate * spanSeconds, rng);
    spanResult.rollsForge += forgeRolls;
    spanResult.rollsBanked += forgeRolls;
  }
  // The Mutator Forge branch (ADR-0043): its own meter, its own queue —
  // charge-only, so the practice leg below never feeds it.
  if (snapshot.mutatorForgeRate > 0) {
    const mutatorRolls = addMutatorForgeProgress(state, snapshot.mutatorForgeRate * spanSeconds, rng);
    spanResult.rollsMutator += mutatorRolls;
  }
}

function drainReserves(liveGenerators: { module: ModuleInstance; strength: number }[], spanSeconds: number): void {
  for (const { module, strength } of liveGenerators) {
    module.reserve = Math.max(0, module.reserve - strength * spanSeconds);
  }
}

function discoverBoard(state: GameState, snapshot: RateSnapshot): void {
  syncAchievements(state, {
    chargeDelivered: chargeDelivered(snapshot),
    maxChordFactor: maxChordFactorOf(snapshot),
  });
  // The chord library rides the same tick (issue #230): every recognized
  // voice-set — active or idle — is available to discovery; only the
  // active ones populate the bonus terms (issue #258).
  syncChordDiscoveries(state, { chords: snapshot.allocation ? summaryTermsOf(snapshot.allocation) : snapshot.namedChords });
}

export function advance(
  state: GameState,
  seconds: number,
  rng: Rng = Math.random,
  sink: AdvanceSink = "live",
): AdvanceResult {
  let result: AdvanceResult = {
    nousEarned: 0,
    rollsBanked: 0,
    rollsFlow: 0,
    rollsForge: 0,
    rollsMutator: 0,
    goalsCompleted: 0,
  };
  // A depletion split can be shorter than EPS seconds while still owning
  // significant charge at high strength. Process every positive span so
  // each span drains its boundary before the next begins.
  if (state.mode !== "flow" || seconds <= 0) return result;
  const session = state.session;
  if (!session) return result;

  // Walk spans iteratively: recurring cycle boundaries must not grow the
  // call stack during multi-day away catch-up, even with empty reserves.
  while (seconds > 0) {
    const spanResult: AdvanceResult = {
      nousEarned: 0, rollsBanked: 0, rollsFlow: 0,
      rollsForge: 0, rollsMutator: 0, goalsCompleted: 0,
    };
    // The board is locked during flow, so the rate is constant across the
    // step — except at reserve depletion, live goal completion, or a
    // temporal profile's step boundary. A generator whose
    // remaining duration runs out mid-step splits there, so the drained
    // generator stops crediting the remainder (the rate really does change
    // mid-step, once — the loop walks every boundary).
    // The reserves are charge quantity per module (issue #371): delivery
    // consumes quantity at the generator's emission rate, so the earliest
    // emptying one — remaining quantity ÷ strength — is one split boundary.
    // Every generator drains by the same rule, and the temporal walk
    // (issue #372) splits at its authored marks beside them.
    let { liveGenerators, earliest } = boardBoundaries(state);
    // A live goal completion banks reserve mid-span, so it is another rate
    // boundary even when every generator starts empty.
    if (sink === "live") earliest = Math.min(earliest, secondsUntilGoalCompletion(state, state.activeHabitId));
    // The temporal profiles' step boundaries (issue #372): a warmed
    // Afterglow or a cycling Pulsewell changes the rate exactly at its
    // authored marks on the shared session clock, so the walk splits there
    // too — each span then holds one constant factor, and equivalent
    // advancement intervals deliver equivalently whatever the step shape.
    const spanSeconds = earliest !== Infinity && earliest + EPS < seconds ? earliest : seconds;

    // The board is locked during flow, so the rate is constant across the
    // step; production is exactly what the board's modules make (§2.1).
    // Board-side meters (Forge progress, received charge) run in both sinks —
    // the trust table redirects only nous and practice minutes (§1); the
    // bucket holds nous only. Practice is the flow meter's whole diet
    // (ADR-0041): it joins below, live-sink only, beside the credited time
    // it keys off — it feeds no Forge branch's threshold.
    // The gated production pass (issue #258): development boards earn from
    // the selected whole chords only, recomputed every step so charge,
    // upgrades, and placement reselections land. The retention hint rides
    // the state and is written back here.
    const snapshot = syncRates(state, true);
    const gained = snapshot.rate * spanSeconds;
    if (sink === "provisional") {
      // Provisional nous never touches the balance: it waits in the bucket
      // for the honesty report to bank or drop it in one move (§2), and the
      // span's minutes join the pool behind it.
      session.accounting.bucketNous += gained;
      session.accounting.poolSeconds += spanSeconds;
    } else {
      earnNous(state, gained);
    }
    spanResult.nousEarned += gained;
    advanceForge(state, snapshot, spanSeconds, rng, spanResult);
    session.elapsed += spanSeconds;
    // The summary's headline and rate (§5.7) accrue with the session itself,
    // so pauses never count into either; provisional production stays out
    // until its bucket banks.
    if (sink === "live") session.earned += gained;
    // Each generator's reserve is a store of charge quantity of its own
    // (issue #371): a deployed generator — any named design —
    // spends reserve at its emission rate per flow second, elapsing even
    // with no eligible neighbors (delivery reaches whoever is adjacent at
    // full strength; expenditure never depends on the neighbor count).
    // Undeployed, it produces no output and its reserve holds.
    drainReserves(liveGenerators, spanSeconds);
    if (sink === "live") {
      // Practice credits only from present and trusted time — nothing ever
      // accrues from away before its reconciliation (§3), so the provisional
      // minutes above leave habit, goals, and C untouched.
      session.accounting.creditedSeconds += spanSeconds;
      accrueLivePractice(state, spanSeconds);
      spanResult.goalsCompleted += accrueGoalProgress(state, state.activeHabitId, spanSeconds);
      // The flow meter (ADR-0041): every credited practice second fills the
      // player-wide meter one-for-one, crossing its fixed cadence — one fast
      // opening fill, then flat forever. Received charge feeds only the Forge
      // branches, above; the two sources share one banked-roll queue.
      spanResult.rollsFlow += addFlowProgress(state, spanSeconds, rng);
      spanResult.rollsBanked += spanResult.rollsFlow;
    }
    // The session-tick check (ADR-0015): charge exists only live in flow, so
    // the tick that holds the snapshot reports whether any module received
    // it (Spark). Unlocks queue into the session's summary row. The feats
    // that read production factors read the factor actually earned — the
    // allocated pass's own maximum (issue #258).
    discoverBoard(state, snapshot);
    result = sumResults(result, spanResult);
    seconds -= spanSeconds;
  }
  return result;
}

// The breather's production walk (docs/breather-spec.md §1, §4, ADR-0073):
// the flow walk's board legs with every practice accrual absent and no
// provisional sink — the phase is pre-trusted, so its nous banks live
// through the one seam, and a breather claims nothing. Forge meters turn,
// received charge empowers, generator reserves drain, and the temporal
// boundaries split on the clock the breather advances (the departed
// session's, kept warm). The wall gap clamps at the remaining allowance —
// the phase cannot overshoot its mint — and the caller ends it when the
// clamp bites (trust.applyBreatherGap flags the completion).
export function advanceBreather(state: GameState, seconds: number, rng: Rng = Math.random): AdvanceResult {
  let result: AdvanceResult = {
    nousEarned: 0,
    rollsBanked: 0,
    rollsFlow: 0,
    rollsForge: 0,
    rollsMutator: 0,
    goalsCompleted: 0,
  };
  const breather = state.breather;
  if (state.mode !== "breather" || !breather || seconds <= 0) return result;
  seconds = Math.min(seconds, Math.max(0, breather.allowanceSeconds - breather.elapsed));
  while (seconds > 0) {
    const spanResult: AdvanceResult = {
      nousEarned: 0, rollsBanked: 0, rollsFlow: 0,
      rollsForge: 0, rollsMutator: 0, goalsCompleted: 0,
    };
    // The same boundary walk as flow, goals aside — a breather advances no
    // goal: reserve depletion, temporal marks, and lifetime rest marks are the mid-step
    // rate changes the phase can meet.
    const { liveGenerators, earliest } = boardBoundaries(state);
    const spanSeconds = earliest !== Infinity && earliest + EPS < seconds ? earliest : seconds;
    const snapshot = syncRates(state, true);
    const gained = snapshot.rate * spanSeconds;
    // Pre-trusted time banks straight onto the balance — the counter-image
    // of the provisional sink (docs/breather-spec.md §4).
    earnNous(state, gained);
    spanResult.nousEarned += gained;
    advanceForge(state, snapshot, spanSeconds, rng, spanResult);
    breather.elapsed += spanSeconds;
    drainReserves(liveGenerators, spanSeconds);
    // No creditedSeconds, no habit, no goal, no flow meter: a breather
    // credits nothing (spec §6 — the honesty system governs practice
    // claims, and a breather claims nothing).
    discoverBoard(state, snapshot);
    result = sumResults(result, spanResult);
    seconds -= spanSeconds;
  }
  return result;
}
