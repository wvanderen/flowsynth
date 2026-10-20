import { CATEGORY_OF, EPS } from "./constants";
import { syncAchievements } from "./achievements";
import { syncChordDiscoveries } from "./library";
import { activeBuildGeneratorStrength, chargeDelivered, emittedStrength, maxChordFactorOf, deployed, sessionClockOf, syncRates } from "./economy";
import { lifetimeBreatherSecondsOf, nextRestBoundaryOf, nextTemporalBoundaryOf } from "./profiles";
import { summaryTermsOf } from "./allocation";
import { addForgeProgress, addMutatorForgeProgress, type Rng } from "./rolls";
import { accrueLivePractice } from "./habits";
import { accrueGoalProgress, accrueGoalFuel, secondsUntilGoalCompletion } from "./goals";
import { accrueClassDevelopment } from "./classes";
import { advanceWorldCharge, advanceWorldCombat, combatBoundaryOf, discoverySecondsOf, syncWorldDiscoveries } from "./world";
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
  // call stack during multi-day away catch-up, even with empty reserves —
  // and, with the World layer (issue #425), even while weapons fire and
  // enemies fall across the whole gap.
  while (seconds > 0) {
    const spanResult: AdvanceResult = {
      nousEarned: 0, rollsBanked: 0, rollsFlow: 0,
      rollsForge: 0, rollsMutator: 0, goalsCompleted: 0,
    };
    // The board is locked during flow, so the rate is constant across the
    // step — except at reserve depletion, live goal completion, a
    // temporal profile's step boundary, or a World boundary (issue #425):
    // a generator whose remaining duration runs out mid-step splits there,
    // so the drained generator stops crediting the remainder (the rate
    // really does change mid-step, once — the loop walks every boundary).
    // The reserves are charge quantity per module (issue #371): delivery
    // consumes quantity at the generator's emission rate, so the earliest
    // emptying one — remaining quantity ÷ strength — is one split boundary.
    // Every generator drains by the same rule, and the temporal walk
    // (issue #372) splits at its authored marks beside them. The snapshot
    // leads the boundary read because the World legs need its rate: the
    // discovery crossing is measured in produced nous.
    const snapshot = syncRates(state, true);
    let { liveGenerators, earliest } = boardBoundaries(state);
    // A live goal completion banks reserve mid-span, so it is another rate
    // boundary even when every generator starts empty.
    if (sink === "live") earliest = Math.min(earliest, secondsUntilGoalCompletion(state, state.activeHabitId));
    // The World boundaries (issue #425, priorities 3 and 5): the era's
    // first threshold crossing — the reveal — and the next armed weapon's
    // attack tick are rate-relevant boundaries exactly like reserve
    // depletion and temporal marks. Both are trusted-time legs: provisional
    // spans hold fire, and their production never touches eraEarned, so
    // neither boundary can move under them.
    if (sink === "live") {
      earliest = Math.min(earliest, discoverySecondsOf(state, snapshot.rate), combatBoundaryOf(state));
    }
    const spanSeconds = earliest !== Infinity && earliest + EPS < seconds ? earliest : seconds;

    // The board is locked during flow, so the rate is constant across the
    // step; production is exactly what the board's modules make (§2.1).
    // Board-side meters (Forge progress, received charge) run in both sinks —
    // the trust table redirects only nous and practice minutes (§1); the
    // bucket holds nous only. Practice is the practice-roll meter's whole
    // diet (ADR-0041 as pair-owned by issue #423): it joins below, live-sink
    // only, beside the credited time it keys off — it feeds no Forge
    // branch's threshold.
    // The gated production pass (issue #258): development boards earn from
    // the selected whole chords only, recomputed every step so charge,
    // upgrades, and placement reselections land. The retention hint rides
    // the state and is written back here.
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
      // The goal-generator fuel (issue #423) accrues ahead of the
      // completion ticks in the same span, so a completion draws the
      // budget that span itself accrued.
      accrueGoalFuel(state, spanSeconds);
      spanResult.goalsCompleted += accrueGoalProgress(state, state.activeHabitId, spanSeconds);
      // The class legs (issue #423, ADR-0074): the same credited seconds
      // develop the active habit–class pair — class experience, tree
      // points at the authored thresholds, and the pair's practice-roll
      // meter, whose crossings bank module rolls into the shared queue.
      // The retired player-wide flow meter's whole diet moves here,
      // pair-owned: nothing accrues without a selected pair, so
      // unstructured sessions run production and charge forging and earn
      // nothing class-side.
      spanResult.rollsFlow += accrueClassDevelopment(state, spanSeconds, rng);
      spanResult.rollsBanked += spanResult.rollsFlow;
      // The World's combat leg (issue #425, priorities 4–5): the ticks the
      // span crossed resolve at its edge — the boundary above cut the span
      // at the next firing tick, so a kill lands exactly where the
      // remainder's production factor changes. Provisional spans never
      // reach this: rejected practice retains no damage, victories, or
      // bonuses, with no retraction machinery and no pending combat ledger.
      advanceWorldCombat(state, spanSeconds);
      syncWorldDiscoveries(state);
    }
    // The World's charge lift (issue #425): Columns copy their module
    // cells' received charge in both sinks — the charge economy runs in
    // both — while only the combat leg above gates on trust.
    advanceWorldCharge(state, snapshot, spanSeconds);
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
    // rate changes the phase can meet — and the World's own (issue #425):
    // the breather is trusted time, so enemy reveals and weapon ticks
    // split its spans exactly as flow's do, and its combat fights beside
    // its production with no class accrual, exactly as practice legs are
    // absent here.
    const snapshot = syncRates(state, true);
    const { liveGenerators, earliest } = boardBoundaries(state);
    const boundary = Math.min(earliest, discoverySecondsOf(state, snapshot.rate), combatBoundaryOf(state));
    const spanSeconds = boundary !== Infinity && boundary + EPS < seconds ? boundary : seconds;
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
    advanceWorldCombat(state, spanSeconds);
    advanceWorldCharge(state, snapshot, spanSeconds);
    syncWorldDiscoveries(state);
    discoverBoard(state, snapshot);
    result = sumResults(result, spanResult);
    seconds -= spanSeconds;
  }
  return result;
}
