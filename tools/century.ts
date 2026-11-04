import { BALANCE, SAVE_VERSION, WORLD_ENEMIES } from "../src/engine/constants";
import {
  PLAYTHROUGH_RUNNER_VERSION,
  composePlaythroughRecipe,
  continuePlaythrough,
  playthroughNote,
  playthroughSource,
  runPlaythrough,
  stateNumbersFinite,
  type PlaythroughEraLedger,
  type PlaythroughEvent,
  type PlaythroughRecipe,
  type PlaythroughRecord,
  type PlaythroughSource,
} from "../src/engine/playthrough";
import { serialize, deserialize } from "../src/engine/save";
import { LATER_ERA_MAX_HOURS, LATER_ERA_MIN_HOURS, LATER_ERA_SEEDS } from "./later-eras";
import { TARGET_WINDOW_MAX_HOURS, TARGET_WINDOW_MIN_HOURS, meaningfulDecisions, type DecisionGap } from "./first-prestige";
import { createInitialState } from "../src/engine/state";
import { investment } from "../src/engine/economy";
import { frontier as boardFrontier } from "../src/engine/capacity-calibration";
import { enemyDefAt } from "../src/engine/world";
import type { GameState, Hex, ModuleType } from "../src/engine/types";

export { playthroughSource, runPlaythrough, stateNumbersFinite, playthroughNote };

// The century evaluation (issue #492, parent #484 stories 5–9, 33, 42–43):
// the shipped economy's consequential progression through roughly 100
// credited flow hours, read on real scheduled playthroughs — the existing
// runner, real engine actions, no second simulator, no grant, no refund.
// The declared matrix: the eight declared seeds × the two declared session
// shapes × the five declared policies — the prompt and pushing policies
// plus the parent's three World policies. Each walk carries the runner's
// declared credited-flow stop (the century mark): it completes at the
// first between-sessions moment the credited clock reaches 100 hours,
// banking per its policy's own rule at every door until then.
//
// Every figure is a measurement, never a verdict. The century reading
// distinguishes representative walks (the matrix), stress fixtures (the
// declared sparse-acquisition seeds and the anonymized supplied-board
// continuation), and expected unsuccessful policies (the prompt door
// policy, whose honest zero-claim banking resets each era at the horizon
// and cannot sustain century-scale progression — recorded, not repaired).

// The declared seed matrix (issues #490/#491; the same eight).
export const CENTURY_SEEDS: readonly number[] = LATER_ERA_SEEDS;

// The declared session shapes: the suite's baseline two-25-minute day and
// its two-60-minute variant.
export const CENTURY_SESSION_MINUTES = { baseline: 25, long: 60 } as const;

// The declared century mark: the credited-flow horizon this evaluation
// walks through. A validation target from ADR-0078, not a timer.
export const CENTURY_MARK_HOURS = 100;

// The budgets sized past the mark: a baseline day credits 50 minutes of
// practice (120 days reach the mark), a long day credits 2 hours (50
// days). A budget that outlives an economy's banks leaves the exhausted
// stretch explicitly recorded, never hidden behind an extended goalpost.
export const CENTURY_BUDGET_DAYS = { baseline: 140, long: 60 } as const;

// The five declared policies: prompt and pushing (issues #468–#490) plus
// the three World-comparison policies (issue #491).
export const CENTURY_POLICIES = ["prompt", "pushing", "support", "combat", "ignoring"] as const;
export type CenturyPolicyId = (typeof CENTURY_POLICIES)[number];

// The declared sparse-acquisition stress fixtures: seeds whose recorded
// acquisition stayed weakest across the matrix (roll acceptances per
// credited hour and distinct acquired types through the opening era).
// Declared here, measured in every recorded row, so the sparse walks ride
// the same declared matrix instead of a hand-built lucky board.
export const SPARSE_ACQUISITION_SEEDS: readonly number[] = [11, 42];

// The era windows (ADR-0078 as revised): the opening era's 8–12 credited
// hours (#490's calibrated range) and later eras' roughly 5–10 (#491's).
export const OPENING_WINDOW = { minHours: TARGET_WINDOW_MIN_HOURS, maxHours: TARGET_WINDOW_MAX_HOURS };
export const LATER_WINDOW = { minHours: LATER_ERA_MIN_HOURS, maxHours: LATER_ERA_MAX_HOURS };

// One era's timing class against its window. Era 0 is the opening era and
// reads the 8–12 window; every later era reads 5–10. An open era stays
// open — the explicit incomplete outcome.
export type CenturyEraClass = "in-window" | "under" | "over" | "open";

export function eraHoursOf(era: PlaythroughEraLedger): number | null {
  return era.endCredited === null ? null : (era.endCredited - era.startCredited) / 3600;
}

export function classifyCenturyEra(era: PlaythroughEraLedger): CenturyEraClass {
  const hours = eraHoursOf(era);
  if (hours === null) return "open";
  const window = era.index === 0 ? OPENING_WINDOW : LATER_WINDOW;
  if (hours < window.minHours) return "under";
  if (hours > window.maxHours) return "over";
  return "in-window";
}

// A "long period with no new decisions" is a recorded failure, not a
// finite-numbers pass. The declared threshold: a credited gap longer than
// two session lengths — twice the baseline session — between meaningful
// decisions. The declared decision rule is #490's: acquisitions,
// purchases, placements, Arete and World products, capacity rungs, feats,
// World finds; level sweeps and session stamps close no gap.
export const LONG_GAP_CREDITED = 2 * 2 * CENTURY_SESSION_MINUTES.baseline * 60;

export interface CenturyEraView {
  readonly index: number;
  readonly eraClass: CenturyEraClass;
  readonly hours: number | null;
  readonly claim: number | null;
  readonly frontierAfter: number | null;
  readonly priorDepth: number | null;
  // Depth growth this era delivered against the era it inherited — the
  // read behind "the claim curve's depth demand vs the board's production
  // growth" (issue #492's tuning clause).
  readonly depthGrowth: number | null;
  readonly familiarHours: number;
  readonly newHours: number;
  readonly newShare: number | null;
  readonly rebuildingShare: number | null;
  // The era's Arete-scale route (labels verbatim from the action record)
  // and the routine nous purchase count.
  readonly purchases: readonly string[];
  readonly nousPurchases: number;
  readonly placements: number;
  readonly defeats: readonly string[];
  readonly gaps: { readonly count: number; readonly maxCredited: number; readonly meanCredited: number };
  readonly longGaps: readonly DecisionGap[];
  readonly finite: boolean | null;
}

// The investment timeline: the first moment each consequential investment
// became reachable and was taken — products, rungs, enemies, feats — with
// the credited hour and the era that reached it. "Newly reachable
// investments" (issue #492) reads here; the later-first list is where
// exhausted choices would show.
export interface InvestmentFirst {
  readonly key: string;
  readonly creditedHour: number;
  readonly era: number;
}

const ERAS_PREFIX = /^Era \d+ — /;
const RECOVERY_PREFIX = "Recovery — ";

function investmentKeyOf(event: PlaythroughEvent): string | null {
  if (!event.ok) return null;
  switch (event.kind) {
    case "roll": {
      const match = event.label.match(/^Accepted a (.+) from the roll$/);
      return match ? `module ${match[1]}` : null;
    }
    case "purchase":
      if (event.label.startsWith("Shelf — ")) return `shelf ${event.label.slice(8)}`;
      if (event.label.startsWith("Cell at")) return "board cells";
      return null;
    case "milestone": {
      if (event.label.startsWith("Poly Expander ")) {
        return `Poly Expander rung ${event.label.slice("Poly Expander ".length).match(/^\d+/)?.[0] ?? "?"}`;
      }
      if (event.label.startsWith("Feat unlocked — ")) return `feat ${event.label.slice("Feat unlocked — ".length)}`;
      if (event.label.startsWith("World — enemy ")) return event.label.replace(" discovered", "").replace(" defeated", " defeated").toLowerCase();
      return null;
    }
    case "arete":
      if (event.label === "Catalog entry") return "Catalog entry";
      if (event.label === "Arete — Chord Catalysts") return "Chord Catalysts";
      if (event.label === "Arete — Expansion Bays") return "Expansion Bays";
      return null;
    case "world":
      if (event.label === "World Column") return "Charge Column";
      if (event.label.startsWith("Hone rank — ")) return "Hone ladder";
      return null;
    default:
      return null;
  }
}

// Occurrence-indexed keys: rungs and ranks repeat (Chord Catalysts ×2,
// Hone ×4, Columns unboundedly), so the first-time timeline indexes the
// repeat into the key. The first occurrence of every other key stands
// alone.
const OCCURRENCE_KEYS = new Set(["Chord Catalysts", "Expansion Bays", "Charge Column", "Hone ladder"]);

export function investmentTimeline(record: PlaythroughRecord): InvestmentFirst[] {
  const occurrences = new Map<string, number>();
  const seen = new Set<string>();
  const timeline: InvestmentFirst[] = [];
  for (const event of record.events) {
    const base = investmentKeyOf(event);
    if (base === null) continue;
    let key = base;
    if (OCCURRENCE_KEYS.has(base)) {
      const occurrence = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, occurrence);
      key = `${base} ${occurrence}`;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    timeline.push({ key, creditedHour: Math.round((event.credited / 360)) / 10, era: eraIndexOfEvent(record, event) });
  }
  return timeline;
}

// The era a stamped event belongs to: the last bank at or before the
// event's own position in the action record.
function eraIndexOfEvent(record: PlaythroughRecord, event: PlaythroughEvent): number {
  let era = 0;
  for (const candidate of record.events) {
    if (candidate === event) break;
    if (candidate.kind === "prestige" && candidate.ok) era++;
  }
  return era;
}

function gapsOf(decisions: readonly PlaythroughEvent[]): {
  count: number;
  maxCredited: number;
  meanCredited: number;
  gaps: DecisionGap[];
} {
  const gaps: DecisionGap[] = [];
  for (let i = 1; i < decisions.length; i++) {
    gaps.push({ credited: Math.max(0, decisions[i]!.credited - decisions[i - 1]!.credited), closedBy: decisions[i]!.label });
  }
  return {
    count: gaps.length,
    maxCredited: gaps.length > 0 ? Math.max(...gaps.map((gap) => gap.credited)) : 0,
    meanCredited: gaps.length > 0 ? Math.round(gaps.reduce((sum, gap) => sum + gap.credited, 0) / gaps.length) : 0,
    gaps,
  };
}

// One era's span of the action record: closing-session facts precede the
// bank even when both clocks tie; event order owns the era.
function eraSpanEvents(record: PlaythroughRecord, era: PlaythroughEraLedger): PlaythroughEvent[] {
  const banks = record.events.flatMap((event, index) => event.kind === "prestige" && event.ok ? [index] : []);
  const start = era.index === 0 ? 0 : banks[era.index - 1]! + 1;
  return record.events.slice(start, banks[era.index] ?? record.events.length);
}

const WORLD_DEFEAT_PREFIX = "World — enemy ";
const isWorldPlacement = (event: PlaythroughEvent): boolean =>
  event.kind === "world" && (event.label.startsWith("Placed ") || event.label.startsWith("Relocated "));

export function centuryEraView(
  record: PlaythroughRecord,
  index: number,
  previous: CenturyEraView | null,
): CenturyEraView {
  const era = record.eras[index];
  if (!era) throw new Error(`Century era view: the record carries no era ${index}.`);
  const span = eraSpanEvents(record, era);
  const consequential = new Set(meaningfulDecisions(record));
  const decisions = span.filter((event) => consequential.has(event));
  const gapRead = gapsOf(decisions);
  const hours = eraHoursOf(era);
  const totalCredited = era.familiarCredited + era.newCredited;
  return {
    index: era.index,
    eraClass: classifyCenturyEra(era),
    hours: hours === null ? null : Math.round(hours * 100) / 100,
    claim: era.claim,
    frontierAfter: era.frontierAfter,
    priorDepth: era.priorDepth,
    depthGrowth:
      index === 0 || era.priorDepth === null || era.priorDepth <= 0 || previous?.priorDepth == null || previous.priorDepth <= 0
        ? null
        : Math.round((era.priorDepth / previous.priorDepth) * 100) / 100,
    familiarHours: Math.round((era.familiarCredited / 3600) * 100) / 100,
    newHours: Math.round((era.newCredited / 3600) * 100) / 100,
    newShare: totalCredited <= 0 ? null : Math.round((era.newCredited / totalCredited) * 1000) / 1000,
    rebuildingShare:
      era.productionRegained === null || hours === null || hours <= 0
        ? null
        : Math.round((era.productionRegained.credited / (hours * 3600)) * 1000) / 1000,
    purchases: span
      .filter((event) => event.ok && (
        event.kind === "arete" ||
        (event.kind === "world" && !isWorldPlacement(event))))
      .map((event) => event.label.replace(ERAS_PREFIX, "").replace(`${RECOVERY_PREFIX}lasting purchase (`, "lasting purchase ").replace(/\)$/, "")),
    nousPurchases: span.filter((event) => event.ok && event.kind === "purchase").length,
    placements: span.filter((event) => event.ok && event.kind === "placement").length,
    defeats: span
      .filter((event) => event.ok && event.kind === "milestone" &&
        event.label.startsWith(WORLD_DEFEAT_PREFIX) && event.label.includes(" defeated"))
      .map((event) => event.label.slice(WORLD_DEFEAT_PREFIX.length).replace(" defeated", "")),
    gaps: { count: gapRead.count, maxCredited: gapRead.maxCredited, meanCredited: gapRead.meanCredited },
    longGaps: gapRead.gaps.filter((gap) => gap.credited > LONG_GAP_CREDITED),
    finite: era.finite,
  };
}

// Coarse per-hour trajectory: the last recorded snapshot at or before each
// credited hour — the shape a reader plots, never an interpolation.
export interface TrajectoryPoint {
  readonly hour: number;
  readonly rate: number;
  readonly eraEarned: number;
  readonly nous: number;
  readonly frontier: number;
  readonly bankCount: number;
}

export function centuryTrajectory(record: PlaythroughRecord): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  const mark = CENTURY_MARK_HOURS * 3600;
  const banks = record.events.filter((event) => event.kind === "prestige" && event.ok);
  let bankIndex = 0;
  let snapshotIndex = 0;
  for (let hour = 0; hour <= CENTURY_MARK_HOURS; hour++) {
    const at = Math.min(hour * 3600, mark);
    while (snapshotIndex + 1 < record.snapshots.length && record.snapshots[snapshotIndex + 1]!.credited <= at) snapshotIndex++;
    const snapshot = record.snapshots[snapshotIndex];
    while (bankIndex < banks.length && banks[bankIndex]!.credited <= at) bankIndex++;
    points.push({
      hour,
      rate: snapshot ? Math.round(snapshot.rate * 100) / 100 : 0,
      eraEarned: snapshot ? Math.round(snapshot.state.eraEarned) : 0,
      nous: snapshot ? Math.round(snapshot.state.nous) : 0,
      frontier: snapshot ? snapshot.state.world.frontier : 0,
      bankCount: bankIndex,
    });
  }
  return points;
}

// The finite-and-representable read (issue #492's fifth criterion): the
// maxima every figure reached across the run's recorded states, and the
// serialized-output check — the real save seam must serialize every
// sampled state without refusing, and the monetary fields must round-trip
// exactly. A refusal or a drifted field is a recorded failure.
export interface NumericRead {
  readonly maxNous: number;
  readonly maxEraEarned: number;
  readonly maxTotalEarned: number;
  readonly maxRate: number;
  readonly maxArete: number;
  readonly maxLevel: number;
  readonly maxReserve: number;
  readonly finiteSnapshots: boolean;
  readonly serializedChecks: number;
  readonly serializedOk: number;
}

export function numericRead(record: PlaythroughRecord): NumericRead {
  let maxNous = 0;
  let maxEraEarned = 0;
  let maxTotalEarned = 0;
  let maxRate = 0;
  let maxArete = 0;
  let maxLevel = 0;
  let maxReserve = 0;
  let finite = true;
  let serializedChecks = 0;
  let serializedOk = 0;
  for (let index = 0; index < record.snapshots.length; index++) {
    const snapshot = record.snapshots[index]!;
    finite = finite && stateNumbersFinite(snapshot.state) && Number.isFinite(snapshot.rate);
    maxNous = Math.max(maxNous, Math.abs(snapshot.state.nous));
    maxEraEarned = Math.max(maxEraEarned, snapshot.state.eraEarned);
    maxTotalEarned = Math.max(maxTotalEarned, snapshot.state.totalEarned);
    maxRate = Math.max(maxRate, Math.abs(snapshot.rate));
    maxArete = Math.max(maxArete, snapshot.state.arete);
    for (const module of snapshot.state.modules) {
      maxLevel = Math.max(maxLevel, module.level);
      maxReserve = Math.max(maxReserve, Math.abs(module.reserve));
    }
    // The serialized-output stride: every bank boundary, the final state,
    // and every tenth recorded state. The engine's serialize refuses a
    // nonfinite figure; the round trip pins the monetary fields exactly.
    const isBank = index > 0 && record.snapshots[index - 1]!.state.prestiges < snapshot.state.prestiges;
    if (isBank || index === record.snapshots.length - 1 || index % 10 === 0) {
      serializedChecks++;
      try {
        const text = serialize(snapshot.state, snapshot.elapsed * 1000);
        const roundTrip = deserialize(text, () => 0.5);
        const loaded = roundTrip.state;
        const ok = loaded !== undefined &&
          loaded.nous === snapshot.state.nous &&
          loaded.eraEarned === snapshot.state.eraEarned &&
          loaded.totalEarned === snapshot.state.totalEarned &&
          loaded.arete === snapshot.state.arete;
        if (ok) serializedOk++;
      } catch {
        // A refusal is the recorded failure this read exists to catch.
      }
    }
  }
  return {
    maxNous: Math.round(maxNous * 100) / 100,
    maxEraEarned: Math.round(maxEraEarned * 100) / 100,
    maxTotalEarned: Math.round(maxTotalEarned * 100) / 100,
    maxRate: Math.round(maxRate * 100) / 100,
    maxArete,
    maxLevel,
    maxReserve: Math.round(maxReserve * 100) / 100,
    finiteSnapshots: finite,
    serializedChecks,
    serializedOk,
  };
}

// The acquisition read behind the sparse-fixture declaration (issue #492's
// second criterion): roll acceptances per credited hour and the distinct
// acquired designs through the run. The retained supplied-board fixture
// never masquerades as acquisition pacing — it rides kind "continuation".
export interface AcquisitionRead {
  readonly rollsAccepted: number;
  readonly distinctTypes: number;
  readonly rollsPerCreditedHour: number;
}

export function acquisitionRead(record: PlaythroughRecord): AcquisitionRead {
  const accepted = record.events.filter((event) => event.ok && event.kind === "roll" && event.label.startsWith("Accepted a "));
  const types = new Set(accepted.map((event) => event.label.replace(/^Accepted a (.+) (module|from) .*$/, "$1").replace(/^Accepted a (.+) from the roll$/, "$1")));
  const hours = Math.max(record.creditedSeconds, 1) / 3600;
  return {
    rollsAccepted: accepted.length,
    distinctTypes: types.size,
    rollsPerCreditedHour: Math.round((accepted.length / hours) * 100) / 100,
  };
}

// One run's row: the clocks, the banks, every era's view, the investment
// timeline, the acquisition read, the numeric read, the coarse
// trajectory, and the honest stop.
export interface CenturyRow {
  readonly seed: number;
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly kind: "representative" | "continuation";
  readonly complete: boolean;
  readonly stopKind: string;
  readonly stopReason: string;
  readonly days: number;
  readonly elapsedHours: number;
  readonly creditedHours: number;
  readonly manageBreaks: number;
  readonly claims: readonly number[];
  readonly claimTarget: number;
  readonly frontiers: readonly number[];
  readonly eras: readonly CenturyEraView[];
  readonly investments: readonly InvestmentFirst[];
  readonly trajectory: readonly TrajectoryPoint[];
  readonly acquisition: AcquisitionRead;
  readonly numeric: NumericRead;
  readonly gaps: { readonly count: number; readonly maxCredited: number; readonly meanCredited: number; readonly longCount: number };
  readonly noGrant: boolean;
  readonly defeats: readonly string[];
  readonly bottleneck: string | null;
  readonly note: string;
}

export function centuryRow(
  seed: number,
  sessionMinutes: number,
  record: PlaythroughRecord,
): CenturyRow {
  const views: CenturyEraView[] = [];
  for (let index = 0; index < record.eras.length; index++) {
    const era = record.eras[index]!;
    // The just-opened successor at a successful terminal bank is not an
    // attempted era. Keep genuine open walks, including era 0.
    if (index > 0 && era.claim === null && era.familiarCredited + era.newCredited === 0 &&
      era.startElapsed === record.elapsedSeconds) continue;
    views.push(centuryEraView(record, index, views[index - 1] ?? null));
  }
  const decisions = meaningfulDecisions(record);
  const gapRead = gapsOf(decisions);
  // The currency-integrity read: the state's whole intake against what
  // the walk earned. A continuation's intake includes the branch input's
  // balance — the first recorded state — so the walk's own earnings read
  // against the difference, never against zero.
  const startTotal = record.kind === "continuation" ? (record.snapshots[0]?.state.totalEarned ?? 0) : 0;
  const drift = Math.abs((record.state.totalEarned - startTotal) - record.earnedNous);
  return {
    seed,
    sessionMinutes,
    policy: record.policy.id,
    kind: record.kind,
    complete: record.complete,
    stopKind: record.stop.kind,
    stopReason: record.stop.reason,
    days: record.days,
    elapsedHours: Math.round((record.elapsedSeconds / 3600) * 100) / 100,
    creditedHours: Math.round((record.creditedSeconds / 3600) * 100) / 100,
    manageBreaks: record.manageBreaks,
    claims: record.claims,
    claimTarget: record.claimTarget,
    frontiers: record.eras.flatMap((era) => (era.frontierAfter === null ? [] : [era.frontierAfter])),
    eras: views,
    investments: investmentTimeline(record),
    trajectory: centuryTrajectory(record),
    acquisition: acquisitionRead(record),
    numeric: numericRead(record),
    gaps: {
      count: gapRead.count,
      maxCredited: gapRead.maxCredited,
      meanCredited: gapRead.meanCredited,
      longCount: gapRead.gaps.filter((gap) => gap.credited > LONG_GAP_CREDITED).length,
    },
    noGrant: drift < Math.max(1, record.earnedNous) * 1e-12,
    defeats: record.worldDefeats,
    bottleneck: record.bottleneck,
    note: playthroughNote(record),
  };
}

// Century recipes carry no era-count completion: `eras: 1` reads as "the
// walk is not era-counted" — the declared century mark and the policy's
// own banking rule own the walk. The trajectory — the exact per-hour
// samples behind the row — rides the artifact tier, not the row.
export function centuryRecipe(seed: number, sessionMinutes: number, policyId: string): PlaythroughRecipe {
  return composePlaythroughRecipe({
    seed,
    policyId,
    claimTarget: 2,
    eras: 1,
    stopCreditedHours: CENTURY_MARK_HOURS,
    budgetDays: sessionMinutes === CENTURY_SESSION_MINUTES.baseline ? CENTURY_BUDGET_DAYS.baseline : CENTURY_BUDGET_DAYS.long,
    schedule: {
      sessionsPerDay: 2,
      sessionMinutes,
      breatherMinutes: 5,
    },
  });
}

// One declared slice: the eight seeds for one session shape × one policy
// — the unit the recorded matrix runs in (issue #491's slice discipline).
export function centurySliceRows(sessionMinutes: number, policyId: string): CenturyRow[] {
  return CENTURY_SEEDS.map((seed) =>
    centuryRow(seed, sessionMinutes, runPlaythrough(centuryRecipe(seed, sessionMinutes, policyId))));
}

// The per-policy era-class distribution for one schedule×policy slice.
export interface CenturyDistribution {
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly erasBySeed: readonly {
    readonly seed: number;
    readonly classes: readonly { readonly index: number; readonly eraClass: CenturyEraClass; readonly hours: number | null }[];
  }[];
  readonly counts: { readonly inWindow: number; readonly under: number; readonly over: number; readonly open: number };
}

export function centuryDistribution(rows: readonly CenturyRow[]): CenturyDistribution {
  const erasBySeed = rows.map((row) => ({
    seed: row.seed,
    classes: row.eras.map((era) => ({ index: era.index, eraClass: era.eraClass, hours: era.hours })),
  }));
  const counts = { inWindow: 0, under: 0, over: 0, open: 0 };
  for (const entry of erasBySeed) {
    for (const era of entry.classes) {
      if (era.eraClass === "in-window") counts.inWindow++;
      else if (era.eraClass === "under") counts.under++;
      else if (era.eraClass === "over") counts.over++;
      else counts.open++;
    }
  }
  return {
    sessionMinutes: rows[0]?.sessionMinutes ?? 0,
    policy: rows[0]?.policy ?? "",
    erasBySeed,
    counts,
  };
}

// The investment timeline, pooled across runs: per investment key, how
// many runs reached it, the credited hour spread, and how many never did
// — the explicit unreached outcomes the record owes (issue #492).
export interface InvestmentReach {
  readonly key: string;
  readonly reached: number;
  readonly runs: number;
  readonly firstHourMin: number | null;
  readonly firstHourMedian: number | null;
  readonly firstHourMax: number | null;
}

export function investmentReach(rows: readonly CenturyRow[]): InvestmentReach[] {
  const byKey = new Map<string, number[]>();
  for (const row of rows) {
    for (const entry of row.investments) {
      const list = byKey.get(entry.key) ?? [];
      list.push(entry.creditedHour);
      byKey.set(entry.key, list);
    }
  }
  const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid]! : Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  };
  return [...byKey.entries()]
    .sort((a, b) => median(b[1]) - median(a[1]))
    .map(([key, hours]) => ({
      key,
      reached: hours.length,
      runs: rows.length,
      firstHourMin: Math.min(...hours),
      firstHourMedian: median(hours),
      firstHourMax: Math.max(...hours),
    }));
}

// The policy comparison at fixed seed and session shape: the fighting
// policies' material benefit and the postponed-combat trade-off, read off
// the recorded rows (issue #492's combat-advantage clause).
export interface PolicyComparison {
  readonly seed: number;
  readonly sessionMinutes: number;
  readonly byPolicy: readonly {
    readonly policy: string;
    readonly banks: number;
    readonly finalFrontier: number;
    readonly laterEraHours: number | null;
    readonly defeats: number;
  }[];
}

export function policyComparison(rows: readonly CenturyRow[], seed: number, sessionMinutes: number): PolicyComparison {
  const slice = rows.filter((row) => row.seed === seed && row.sessionMinutes === sessionMinutes);
  return {
    seed,
    sessionMinutes,
    byPolicy: CENTURY_POLICIES.map((policyId) => {
      const row = slice.find((entry) => entry.policy === policyId);
      const later = row?.eras.filter((era) => era.index > 0 && era.hours !== null) ?? [];
      const mean = later.length > 0 ? later.reduce((sum, era) => sum + (era.hours ?? 0), 0) / later.length : null;
      return {
        policy: policyId,
        banks: row?.claims.length ?? 0,
        finalFrontier: row?.frontiers.at(-1) ?? 0,
        laterEraHours: mean === null ? null : Math.round(mean * 100) / 100,
        defeats: row?.defeats.length ?? 0,
      };
    }),
  };
}

export interface CenturyReport {
  readonly target: {
    readonly markHours: number;
    readonly opening: typeof OPENING_WINDOW;
    readonly later: typeof LATER_WINDOW;
    readonly longGapCredited: number;
  };
  readonly seeds: readonly number[];
  readonly budgets: { readonly baselineDays: number; readonly longDays: number };
  readonly policies: readonly string[];
  readonly sparseSeeds: readonly number[];
  readonly source: PlaythroughSource;
  readonly runs: readonly CenturyRow[];
  readonly distributions: readonly CenturyDistribution[];
  readonly investments: readonly InvestmentReach[];
  readonly comparisons: readonly PolicyComparison[];
}

// The full declared report, composed from the slices: eight seeds × two
// session shapes × five policies, with the per-slice distributions, the
// pooled investment timeline, and the policy comparisons.
export function centuryReport(runs: readonly CenturyRow[]): CenturyReport {
  const expected = CENTURY_SEEDS.length * 2 * CENTURY_POLICIES.length;
  if (runs.length !== expected) {
    throw new Error(`Century report: expected ${expected} recorded runs, found ${runs.length}.`);
  }
  const distributions = [CENTURY_SESSION_MINUTES.baseline, CENTURY_SESSION_MINUTES.long].flatMap((sessionMinutes) =>
    CENTURY_POLICIES.map((policyId) =>
      centuryDistribution(runs.filter((row) => row.sessionMinutes === sessionMinutes && row.policy === policyId)),
    ),
  );
  const comparisons = CENTURY_SEEDS.map((seed) => policyComparison(runs, seed, CENTURY_SESSION_MINUTES.long));
  return {
    target: {
      markHours: CENTURY_MARK_HOURS,
      opening: OPENING_WINDOW,
      later: LATER_WINDOW,
      longGapCredited: LONG_GAP_CREDITED,
    },
    seeds: CENTURY_SEEDS,
    budgets: { baselineDays: CENTURY_BUDGET_DAYS.baseline, longDays: CENTURY_BUDGET_DAYS.long },
    policies: [...CENTURY_POLICIES],
    sparseSeeds: SPARSE_ACQUISITION_SEEDS,
    source: playthroughSource(),
    runs,
    distributions,
    investments: investmentReach(runs),
    comparisons,
  };
}

// ── The anonymized supplied-board fixture (issue #492's second criterion) ──

// The reported player's end state, anonymized and made finite: 35 modules
// at level 1506 on a connected compact footprint, all nine enemies
// discovered and alive, one prestige banked, Catalog entry owned, no
// deployed World rig — the aggregate facts the parent records, rebuilt
// through the engine's own creation seams on synthetic layout, tier, and
// type-mix values. The exact private save is never committed; this
// fixture is a synthetic regression stand-in for its topology, not a
// reconstruction, and its walks ride kind "continuation": retained-board
// evidence, never fresh-start acquisition pacing.
export const SUPPLIED_BOARD_MODULE_COUNT = 35;
// The deepest level whose invested sum stays inside the float64 range —
// 1.65e308 at 1504. The reported 1506 is two past this boundary: exactly
// why the original save's invested figures serialized to null. The
// fixture carries the boundary level, not the lost figures.
export const SUPPLIED_BOARD_LEVEL = 1504;

// An anonymized late-game type mix: oscillator-heavy with support lines —
// the shape the parent's investigation describes (chord support, charge
// support, a lasting-growth member) at high merge tiers. Common designs
// dominate; the rare pair rides the roster's own rarity.
const SUPPLIED_BOARD_MIX: readonly { readonly type: ModuleType; readonly tier: number }[] = [
  { type: "additive", tier: 3 }, { type: "blaster", tier: 3 }, { type: "triangle", tier: 3 },
  { type: "square", tier: 3 }, { type: "saw", tier: 3 }, { type: "additive", tier: 3 },
  { type: "blaster", tier: 2 }, { type: "triangle", tier: 2 }, { type: "square", tier: 2 },
  { type: "saw", tier: 2 }, { type: "afterglow", tier: 2 }, { type: "sideband", tier: 2 },
  { type: "release", tier: 2 }, { type: "standby", tier: 2 }, { type: "tail", tier: 2 },
  { type: "additive", tier: 2 }, { type: "triangle", tier: 1 }, { type: "square", tier: 1 },
  { type: "saw", tier: 1 }, { type: "chorus", tier: 2 }, { type: "exciter", tier: 2 },
  { type: "harmonizer", tier: 2 }, { type: "echo", tier: 1 }, { type: "bend", tier: 1 },
  { type: "harmonizer", tier: 1 }, { type: "echo", tier: 1 }, { type: "bend", tier: 1 },
  { type: "amplifier", tier: 1 }, { type: "pulsewell", tier: 2 }, { type: "pulsewell", tier: 1 },
  { type: "infusor", tier: 2 }, { type: "field", tier: 1 }, { type: "spotlight", tier: 1 },
  { type: "focusKeyed", tier: 2 }, { type: "spacer", tier: 1 },
];

export function suppliedBoardState(): GameState {
  const state = createInitialState();
  state.prestiges = 1;
  state.catalogEntryOwned = true;
  // The retained development's row unlocks: the launch band's six-row cap
  // open both sides — 35 owned modules cannot fit inside the four-row
  // launch band beside the nine enemy cells, so the reported position
  // carries both Row unlocks, and the fixture declares them.
  state.unlockedRows = [-2, 3];
  // Finite, mature-board balances consistent with the reported aggregate
  // history — never the lost nulls, and never invented history beyond the
  // documented aggregates.
  state.totalEarned = 4.5e11;
  state.nous = 8.2e9;
  // The reported board's placement footprint: the engine's own compact
  // frontier ordering over the launch band, enemy-reserved cells excluded
  // — real board geometry, synthetic provenance. Each chosen seat is
  // owned before the next is read, so the frontier walks outward.
  const seats: Hex[] = [];
  while (seats.length < SUPPLIED_BOARD_MODULE_COUNT) {
    const next = boardFrontier(state, "compact").find((pos) => !enemyDefAt(pos));
    if (!next) throw new Error("Supplied-board fixture: the compact frontier ran out of seats.");
    seats.push(next);
    state.cells.push({ ...next });
  }
  const created = SUPPLIED_BOARD_MIX.slice(0, SUPPLIED_BOARD_MODULE_COUNT).map((entry, index) =>
    state.modules[state.modules.push({
      id: `supplied-${index}`,
      type: entry.type,
      tier: entry.tier,
      level: SUPPLIED_BOARD_LEVEL,
      invested: investment(SUPPLIED_BOARD_LEVEL),
      pos: { ...seats[index]! },
      reserve: 0,
      shift: null,
      target: null,
    }) - 1]!);
  if (created.length !== SUPPLIED_BOARD_MODULE_COUNT) throw new Error("Supplied-board fixture: the mix fell short.");
  // The reported face: every enemy discovered, none defeated — the
  // postponed-combat position the parent investigates. The starter weapon
  // stays ungranted; no Columns bought.
  for (const def of WORLD_ENEMIES) {
    state.world.enemies[def.key] = { discovered: true, hp: def.maxHp };
  }
  return state;
}

// The fixture's declared walks, both through the support policy's century
// continuation on the same anonymized board:
//
// - "raw" — the un-translated position. The retained levels bank a
//   frontier the calibrated curve cannot re-reach, and every later era
//   stays open: the recorded limitation the save translation (issue
//   #493) exists to repair. Recorded, never silently repaired here.
// - "collection-reset" — the retained collection as one honest calibrated
//   reset leaves it: levels reset by the shipped prestige rule, merge
//   tiers and the board's mix retained, the claimed frontier at zero.
//   The anonymized topology's calibrated century walks from here — the
//   evidence the baseline freeze grounds for #493's retention table.
//   Neither walk is shipped translation behavior.
export type SuppliedBoardVariant = "raw" | "collection-reset";

export function suppliedBoardRecord(variant: SuppliedBoardVariant, stopHours: number = CENTURY_MARK_HOURS, budgetDays: number = CENTURY_BUDGET_DAYS.long): PlaythroughRecord {
  const recipe = composePlaythroughRecipe({
    seed: CENTURY_SEEDS[0]!,
    policyId: "support",
    claimTarget: 2,
    eras: 1,
    stopCreditedHours: stopHours,
    budgetDays,
    schedule: { sessionsPerDay: 2, sessionMinutes: CENTURY_SESSION_MINUTES.long, breatherMinutes: 5 },
  });
  const state = suppliedBoardState();
  if (variant === "collection-reset") {
    // The shipped prestige rule's own effect on the retained collection:
    // levels return to zero with their investment; tiers, designs, and
    // the board's layout stand. The claimed frontier reads zero.
    for (const module of state.modules) {
      module.level = 0;
      module.invested = 0;
    }
    state.world.frontier = 0;
  }
  return continuePlaythrough(recipe, state, playthroughSource());
}

export function suppliedBoardRow(variant: SuppliedBoardVariant): CenturyRow {
  const record = suppliedBoardRecord(variant);
  const row = centuryRow(CENTURY_SEEDS[0]!, CENTURY_SESSION_MINUTES.long, record);
  return { ...row, kind: record.kind, note: `${variant}: ${row.note}` };
}

// The frozen-baseline figure set (issue #492's seventh criterion): the
// calibrated curve and entitlement figures a save translation reads — the
// claim curve, the enemy ladder, the World purchase ladders, the capacity
// ladder, the level prices, the response-support shape, and the runner's
// identity. Compiled from the shipped constants, so the baseline cannot
// drift from the engine without this read changing.
export function calibrationBaseline(): Record<string, unknown> {
  return {
    saveVersion: SAVE_VERSION,
    runnerVersion: PLAYTHROUGH_RUNNER_VERSION,
    source: playthroughSource(),
    openingGrant: BALANCE.openingGrant,
    upgradeCost: {
      firstCost: BALANCE.upgradeFirstCost,
      growth: `${BALANCE.upgradeCostGrowthNumerator}/${BALANCE.upgradeCostGrowthDenominator}`,
    },
    claimCurve: {
      horizon: 7e6,
      entryNous: BALANCE.world.entryNous,
      claimBase: BALANCE.world.claimBase,
      claimDepthSlope: BALANCE.world.claimDepthSlope,
    },
    enemyLadder: {
      thresholdStepDecades: 1,
      thresholds: WORLD_ENEMIES.map((def) => def.threshold),
      maxHp: WORLD_ENEMIES.map((def) => def.maxHp),
      depthSteps: BALANCE.world.enemyDepthSteps,
      depthPenalties: BALANCE.world.enemyDepthPenalties,
      bonus: BALANCE.world.enemyBonus,
    },
    worldLadders: {
      columnFirstPrice: BALANCE.world.columnFirstPrice,
      columnPriceGrowth: BALANCE.world.columnPriceGrowth,
      honeCosts: BALANCE.world.honeCosts,
      catalogEntryCost: BALANCE.catalogEntryCost,
    },
    capacityLadder: {
      prices: BALANCE.capacityPrices,
      ceilingCosts: BALANCE.capacityCeilingCosts,
      discountCosts: BALANCE.capacityDiscountCosts,
    },
    responseSupport: {
      share: BALANCE.responseShare,
      saturation: BALANCE.responseSaturation,
    },
    cellEconomy: {
      firstCost: BALANCE.cellFirstCost,
      growth: `${BALANCE.cellCostGrowthNumerator}/${BALANCE.cellCostGrowthDenominator}`,
    },
  };
}
