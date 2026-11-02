import { composePlaythroughRecipe, playthroughNote, playthroughSource, runPlaythrough, type PlaythroughEvent, type PlaythroughRecord, type PlaythroughRecipe } from "../src/engine/playthrough";
import type { PlaythroughSource } from "../src/engine/playthrough";

// The first-worthwhile-prestige evaluation (issue #490, parent #484
// stories 1–4, 22–24, 28–31, and 42–43): the shipped economy's opening
// read on real scheduled playthroughs — the existing runner, real engine
// actions, no second simulator, no shared-balance mutation. Two declared
// session shapes (the suite's baseline 25-minute schedule and a 60-minute
// variant), the two declared policies, and the eight declared seeds: the
// prompt walk demonstrates the eligibility door's honest zero-claim bank;
// the pushing walk holds that door and demonstrates the worthwhile
// journey — claim banking, lasting purchase, starter World deployment,
// return toward pre-reset output, and frontier progress beyond the
// claimed frontier.
//
// Every figure is a measurement, never a verdict: an unreached mark, a
// budget miss, or an out-of-window seed stays explicit in its row. The
// summary classifies distributions against the 8–12 credited-hour
// first-worthwhile-prestige target centered on ten, per run — never an
// average that hides a miss. The four-hour experiments of the parent's
// early baseline remain baselines: the target is the ticket's own
// validation range, not a timer the engine enforces.

// The declared seed matrix (issue #490).
export const FIRST_PRESTIGE_SEEDS: readonly number[] = [42, 468, 157, 2026, 7, 99, 11, 23];

// The declared session shapes: the suite's baseline (two 25-minute daily
// sessions) and its 60-minute variant — the same five-minute breather,
// one practice habit with a daily goal.
export const BASELINE_SESSION_MINUTES = 25;
export const LONG_SESSION_MINUTES = 60;

// The declared budgets: the walk's own honest stop when a policy cannot
// finish. The baseline budget clears the full journey for every seed that
// banks inside it (~0.83 credited hours per day); the long-session budget
// carries the same intent at ~2 credited hours per day. A budget miss is
// a recorded miss, never an extended goalpost.
export const BASELINE_BUDGET_DAYS = 30;
export const LONG_BUDGET_DAYS = 16;

// The validation range (ADR-0078 as revised): 8–12 credited hours,
// centered around ten. A validation range, not a timer.
export const TARGET_WINDOW_MIN_HOURS = 8;
export const TARGET_WINDOW_MAX_HOURS = 12;

// The worthwhile-prestige target classification for one run — the timing
// class for a run that demonstrated the whole journey (bank, lasting
// purchase, deployed starter rig, both recoveries, frontier advance), the
// explicit bank-only class for a run that banked a positive claim without
// demonstrating the journey (eligibility alone is never a worthwhile
// prestige, and a bare bank is not one either), and the explicit
// unreached class.
export type WorthwhileClass = "in-window" | "under" | "over" | "bank-only" | "unreached";

export function classifyRun(record: PlaythroughRecord): WorthwhileClass {
  const hours = worthwhileHoursOf(record);
  if (hours === null) return "unreached";
  // A frontier bank can precede deployment or recovery. Require the
  // runner's completion and every journey mark rather than one milestone.
  const recovery = record.recovery;
  if (!record.complete || record.stop.kind !== "recovered" || recovery === null ||
    [recovery.lastingPurchase, recovery.weaponDeployed, recovery.columnDeployed,
      recovery.productionRegained, recovery.eligibilityReached, recovery.frontierAdvanced]
      .some(mark => mark == null)) return "bank-only";
  if (hours < TARGET_WINDOW_MIN_HOURS) return "under";
  if (hours > TARGET_WINDOW_MAX_HOURS) return "over";
  return "in-window";
}

// The decision rule behind the opening's pacing gaps (issue #490): the
// recorded decisions that changed what the player could do — acquisitions
// (roll acceptances), purchases (shelf, cells, Arete offerings, World
// products, capacity rungs), placements, and the milestone unlocks (feats
// and World discoveries). Level sweeps and session/breather stamps are
// routine; they close no gap. Declared here so a rerun reads the same
// gaps the recorded report does.
export function meaningfulDecisions(record: PlaythroughRecord): PlaythroughEvent[] {
  return record.events.filter((event) => {
    if (!event.ok) return false;
    if (event.kind === "roll" || event.kind === "purchase" || event.kind === "placement" ||
      event.kind === "arete" || event.kind === "world") return true;
    if (event.kind === "milestone") {
      return event.label.startsWith("Poly Expander") || event.label.startsWith("Feat unlocked") ||
        event.label.startsWith("World —");
    }
    return false;
  });
}

export interface DecisionGap {
  // Credited seconds from the previous meaningful decision to this one.
  readonly credited: number;
  // The decision that closed the gap.
  readonly closedBy: string;
}

// The gaps between consecutive meaningful decisions through the opening
// era — every recorded decision before the run's first prestige, in
// credited flow time. A long opening must earn its length through these
// decisions; the gaps are where waiting would hide.
export function openingDecisionGaps(record: PlaythroughRecord): DecisionGap[] {
  const prestige = record.events.find((event) => event.kind === "prestige");
  const opening = meaningfulDecisions(record)
    .filter((event) => prestige === undefined || event.snapshot <= prestige.snapshot);
  const gaps: DecisionGap[] = [];
  for (let i = 1; i < opening.length; i++) {
    gaps.push({ credited: Math.max(0, opening[i]!.credited - opening[i - 1]!.credited), closedBy: opening[i]!.label });
  }
  return gaps;
}

// The credited hours of the run's first bank — the worthwhile prestige's
// moment on the credited-flow clock. Null when the run never banked a
// positive claim: the eligibility door's honest zero is not a worthwhile
// prestige, and no average may dress it up as one.
export function worthwhileHoursOf(record: PlaythroughRecord): number | null {
  const first = record.claims[0];
  if (first === undefined || first <= 0) return null;
  const prestige = record.events.find((event) => event.kind === "prestige" && event.ok);
  if (!prestige) return null;
  return hoursOf(prestige.credited);
}

// The credited hours of the first eligibility door (the prompt policy's
// zero-claim bank, or the pushing run's hold before its first claim).
export function eligibilityHoursOf(record: PlaythroughRecord): number | null {
  const eligibility = record.events.find((event) => event.kind === "milestone" &&
    event.ok && event.label === "First prestige eligibility reached");
  return hoursOf(eligibility?.credited ?? null);
}

function hoursOf(seconds: number | null): number | null {
  return seconds === null ? null : Math.round((seconds / 3600) * 100) / 100;
}

function daysOf(seconds: number | null): number | null {
  return seconds === null ? null : Math.round((seconds / 86_400) * 10) / 10;
}

// One run's row: the clocks recorded separately (issue #490's fifth
// criterion), the journey's marks, the decision gaps, and the honest stop.
export interface FirstPrestigeRow {
  readonly seed: number;
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly complete: boolean;
  readonly stopKind: string;
  readonly stopReason: string;
  readonly days: number;
  // The four clocks, separately: elapsed calendar time, credited flow,
  // breather rest, and the management opportunities the schedule gave.
  readonly elapsedHours: number;
  readonly creditedHours: number;
  readonly breatherSeconds: number;
  readonly breatherNous: number;
  readonly sessionNous: number;
  readonly manageBreaks: number;
  readonly claims: readonly number[];
  readonly claimTarget: number;
  // The eligibility door's credited hour (null when never reached).
  readonly eligibilityHours: number | null;
  // The first positive claim's credited hour and its classification.
  readonly worthwhileHours: number | null;
  readonly worthwhileClass: WorthwhileClass;
  // The journey's marks, both clocks, from the first bank.
  readonly journey: {
    readonly claim: number;
    readonly lastingPurchaseLabel: string | null;
    readonly lastingPurchaseHours: number | null;
    readonly weaponDeployedHours: number | null;
    readonly columnDeployedHours: number | null;
    readonly productionRegainedHours: number | null;
    readonly eligibilityReachedHours: number | null;
    readonly frontierAdvancedHours: number | null;
    readonly frontierAdvancedDays: number | null;
  } | null;
  // The opening's decision-gap read (issue #490's third criterion).
  readonly gaps: {
    readonly count: number;
    readonly maxCredited: number;
    readonly meanCredited: number;
    readonly longest: readonly DecisionGap[];
  };
  // The currency-integrity read (issue #490's fourth criterion): the
  // state's whole intake against the run's own earned ν — a hidden grant,
  // missing currency, or fabricated reward fails this row.
  readonly noGrant: boolean;
  readonly discoveries: readonly string[];
  readonly defeats: readonly string[];
  readonly bottleneck: string | null;
  readonly note: string;
}

export function firstPrestigeRow(seed: number, sessionMinutes: number, record: PlaythroughRecord): FirstPrestigeRow {
  const gaps = openingDecisionGaps(record);
  const sorted = [...gaps].sort((a, b) => b.credited - a.credited);
  const recovery = record.recovery;
  const worthwhileHours = worthwhileHoursOf(record);
  // The no-grants tolerance: the same relative read the pushing-fixture
  // test pins — the summations drift by float rounding alone.
  const drift = Math.abs(record.state.totalEarned - record.earnedNous);
  return {
    seed,
    sessionMinutes,
    policy: record.policy.id,
    complete: record.complete,
    stopKind: record.stop.kind,
    stopReason: record.stop.reason,
    days: record.days,
    elapsedHours: hoursOf(record.elapsedSeconds)!,
    creditedHours: hoursOf(record.creditedSeconds)!,
    breatherSeconds: record.breatherSeconds,
    breatherNous: Math.round(record.breatherNous * 100) / 100,
    sessionNous: Math.round(record.sessionNous * 100) / 100,
    manageBreaks: record.manageBreaks,
    claims: record.claims,
    claimTarget: record.claimTarget,
    eligibilityHours: eligibilityHoursOf(record),
    worthwhileHours,
    worthwhileClass: classifyRun(record),
    journey: recovery === null ? null : {
      claim: recovery.claim,
      lastingPurchaseLabel: recovery.lastingPurchaseLabel,
      lastingPurchaseHours: hoursOf(recovery.lastingPurchase?.credited ?? null),
      weaponDeployedHours: hoursOf(recovery.weaponDeployed?.credited ?? null),
      columnDeployedHours: hoursOf(recovery.columnDeployed?.credited ?? null),
      productionRegainedHours: hoursOf(recovery.productionRegained?.credited ?? null),
      eligibilityReachedHours: hoursOf(recovery.eligibilityReached?.credited ?? null),
      frontierAdvancedHours: hoursOf(recovery.frontierAdvanced?.credited ?? null),
      frontierAdvancedDays: daysOf(recovery.frontierAdvanced?.elapsed ?? null),
    },
    gaps: {
      count: gaps.length,
      maxCredited: gaps.length > 0 ? Math.max(...gaps.map((gap) => gap.credited)) : 0,
      meanCredited: gaps.length > 0 ? Math.round(gaps.reduce((sum, gap) => sum + gap.credited, 0) / gaps.length) : 0,
      longest: sorted.slice(0, 5),
    },
    noGrant: drift < Math.max(1, record.earnedNous) * 1e-12,
    discoveries: record.worldDiscoveries,
    defeats: record.worldDefeats,
    bottleneck: record.bottleneck,
    note: playthroughNote(record),
  };
}

export function firstPrestigeRecipe(seed: number, sessionMinutes: number, policyId: string): PlaythroughRecipe {
  return composePlaythroughRecipe({
    seed,
    policyId,
    claimTarget: 2,
    budgetDays: sessionMinutes === BASELINE_SESSION_MINUTES ? BASELINE_BUDGET_DAYS : LONG_BUDGET_DAYS,
    schedule: {
      sessionsPerDay: 2,
      sessionMinutes,
      breatherMinutes: 5,
    },
  });
}

// The distribution read for one schedule×policy slice: per-seed classes,
// never an average alone.
export interface DistributionSummary {
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly hoursBySeed: readonly { readonly seed: number; readonly hours: number | null; readonly worthwhileClass: WorthwhileClass }[];
  readonly counts: { readonly inWindow: number; readonly under: number; readonly over: number; readonly unreached: number };
}

export function distributionOf(rows: readonly FirstPrestigeRow[]): DistributionSummary {
  const hoursBySeed = rows.map((row) => ({ seed: row.seed, hours: row.worthwhileHours, worthwhileClass: row.worthwhileClass }));
  const counts = { inWindow: 0, under: 0, over: 0, bankOnly: 0, unreached: 0 };
  const keyOf: Record<WorthwhileClass, keyof typeof counts> = {
    "in-window": "inWindow", under: "under", over: "over", "bank-only": "bankOnly", unreached: "unreached",
  };
  for (const entry of hoursBySeed) counts[keyOf[entry.worthwhileClass]]++;
  return {
    sessionMinutes: rows[0]?.sessionMinutes ?? 0,
    policy: rows[0]?.policy ?? "",
    hoursBySeed,
    counts,
  };
}

export interface FirstPrestigeReport {
  readonly target: { readonly minHours: number; readonly maxHours: number; readonly centeredHours: number };
  readonly seeds: readonly number[];
  readonly budgets: { readonly baselineDays: number; readonly longDays: number };
  readonly source: PlaythroughSource;
  readonly runs: readonly FirstPrestigeRow[];
  readonly distributions: readonly DistributionSummary[];
}

// The full declared matrix: eight seeds × two session shapes × two
// declared policies, each a real scheduled walk through the existing
// runner.
export function firstPrestigeReport(): FirstPrestigeReport {
  const runs: FirstPrestigeRow[] = [];
  for (const sessionMinutes of [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES]) {
    for (const policyId of ["prompt", "pushing"]) {
      for (const seed of FIRST_PRESTIGE_SEEDS) {
        const record = runPlaythrough(firstPrestigeRecipe(seed, sessionMinutes, policyId));
        runs.push(firstPrestigeRow(seed, sessionMinutes, record));
      }
    }
  }
  const distributions = [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES].flatMap((sessionMinutes) =>
    (["pushing", "prompt"] as const).map((policyId) =>
      distributionOf(runs.filter((row) => row.sessionMinutes === sessionMinutes && row.policy === policyId)),
    ),
  );
  return {
    target: { minHours: TARGET_WINDOW_MIN_HOURS, maxHours: TARGET_WINDOW_MAX_HOURS, centeredHours: 10 },
    seeds: FIRST_PRESTIGE_SEEDS,
    budgets: { baselineDays: BASELINE_BUDGET_DAYS, longDays: LONG_BUDGET_DAYS },
    source: playthroughSource(),
    runs,
    distributions,
  };
}
