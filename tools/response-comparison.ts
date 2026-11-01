import { upgradeModuleLevels } from "../src/engine/actions";
import { allocateRates, investment, levelCost, responseSupportPowerOf, type AllocatedRates } from "../src/engine/economy";
import { RESPONSE_CURVES, WORLD_ENEMIES } from "../src/engine/constants";
import { stateOf, type ComparisonBoard } from "../src/engine/capacity-comparisons";
import { fresh, give } from "../src/engine/fixtures";
import { hex, sameHex } from "../src/engine/hex";
import { composePlaythroughRecipe, playthroughSource, runPlaythrough, type PlaythroughEvent, type PlaythroughRecord, type PlaythroughRecipe, type PlaythroughSource } from "../src/engine/playthrough";
import { worldFactorOf } from "../src/engine/world";
import type { GameState, Hex, ModuleType, ResponseCurveId } from "../src/engine/types";

// The response-support candidate comparison (issue #487, parent #484
// stories 7–14 and 42–43): shipped, linear, and bounded Chorus/Exciter
// response progression, read on real allocated boards and real scheduled
// playthroughs through the engine's own rate path and actions — never a
// second simulator and never the shared balance definitions. Three
// evidence classes, kept separate wherever they are recorded:
//
//   envelopes  — analytical growth-against-upgrade-cost rows computed
//                from a real board's rate curve under each candidate;
//                idealized, never a pacing forecast.
//   fixtures   — already-acquired boards: the phenomenon rigs and the
//                anonymized supplied-board reconstruction, swept over
//                declared finite levels and the full reachable capacity
//                ladder, the allocation's certification recorded per row.
//   pacing     — fresh-start scheduled walks (the prompt acquisition
//                policy) and a declared purchase-policy sweep — the
//                prompt rule's gesture size and order through the real
//                bulk action on an already-acquired board.
//
// The supplied board's historical levels (1506) and monetary fields were
// lost with the parent save; nothing here treats them as valid or claims
// to reconstruct a historical rate. Sweeps run declared finite levels
// against declared synthetic reserve supplies. Every figure is
// provisional tuning evidence toward the parent's coefficient decision —
// no row is a 100-hour acceptance claim.

export const CURVES: readonly ResponseCurveId[] = ["shipped", "linear", "bounded"];

// The declared finite level sweep — the corrupt level-1506 save never
// rides a row. Levels span the intermediate growth the parent asked
// about (tens to hundreds) into the high levels where the shipped
// exponential is the structural runaway.
export const LEVEL_SWEEP: readonly number[] = [0, 25, 100, 250, 500, 1000];

// The phenomena levels: level zero (grant parity), an intermediate
// board, and the runaway regime.
export const PHENOMENON_LEVELS: readonly number[] = [0, 100, 1000];

// The full reachable capacity ladder: the opening voice plus every
// purchasable rung under the two declared Expansion Bays — capacity five
// is the ceiling the bays open, and the ladder cannot climb past it.
export const CAPACITY_SWEEP: readonly number[] = [1, 2, 3, 4, 5];

// The declared synthetic reserve supplies: the parent save's original
// reserves were lost, so every charged fixture banks this declared
// supply instead — large enough that no declared read drains it, never a
// claim about the historical reserve.
export const SYNTHETIC_RESERVE = 1e9;

// The declared synthetic bank the purchase-policy gesture sweep spends.
export const SYNTHETIC_BANK = 1e15;

// The prompt policy's own gesture size (five levels, cheapest first) —
// the sweep rides the same rule through the real bulk action.
const GESTURE_LEVELS = 5;

// ── The supplied board (issue #487's anonymized inputs) ─────────────────
//
// Topology and tier facts only. The saved deployed levels were 1506 and
// the monetary fields were lost; the sweeps stand in for both. Copy
// identifiers (P01–P30) are created in the table's relative order, so the
// Echo's lowest-id adjacent-voice tie-break reproduces. Personal records,
// original reserves, feats, discovery bonuses, and the historical clock
// are omitted; the declared breathers, enemy states, purchases, and
// Spotlight recipients below are the table's declared facts.

export interface SuppliedCopy {
  readonly copy: string;
  readonly name: string;
  readonly type: ModuleType;
  readonly tier: number;
  readonly q: number;
  readonly r: number;
  readonly setting?: string;
}

const copy = (copyId: string, name: string, type: ModuleType, tier: number, q: number, r: number, setting?: string): SuppliedCopy =>
  ({ copy: copyId, name, type, tier, q, r, ...(setting ? { setting } : {}) });

export const SUPPLIED_BOARD: readonly SuppliedCopy[] = [
  copy("P01", "Sine", "additive", 2, 3, 1),
  copy("P02", "Triangle", "triangle", 2, 1, -1),
  copy("P03", "Bend", "bend", 0, 5, 0, "Shift +1"),
  copy("P04", "Booster", "infusor", 2, 2, 1),
  copy("P05", "Echo", "echo", 1, 4, -1),
  copy("P06", "Spotlight", "spotlight", 2, 1, 1, "Recipient P30"),
  copy("P07", "Flywheel", "focusKeyed", 2, -3, 3),
  copy("P08", "Saw", "saw", 0, 3, 0),
  copy("P09", "Field", "field", 2, 2, -1),
  copy("P10", "Harmonizer", "harmonizer", 2, 3, -1),
  copy("P11", "Scribe", "noteKeyed", 0, -3, 4),
  copy("P12", "Square", "square", 0, 3, -2),
  copy("P13", "Module Forge", "forge", 2, -2, 4),
  copy("P14", "Triangle", "triangle", 0, 6, -1),
  copy("P15", "Module Forge", "forge", 0, -3, 2),
  copy("P16", "Blaster", "blaster", 1, -1, 0),
  copy("P17", "Flywheel", "focusKeyed", 1, -2, 2),
  copy("P18", "Amplifier", "amplifier", 2, 0, 1),
  copy("P19", "Module Forge", "forge", 1, -1, 3),
  copy("P20", "Spotlight", "spotlight", 1, 2, -2, "Recipient P30"),
  copy("P21", "Amplifier", "amplifier", 0, 0, 0),
  copy("P22", "Amplifier", "amplifier", 0, -2, 3),
  copy("P23", "Harmonizer", "harmonizer", 0, 0, -1),
  copy("P24", "Harmonizer", "harmonizer", 0, 4, 0),
  copy("P25", "Chorus", "chorus", 0, 1, 0),
  copy("P26", "Amplifier", "amplifier", 2, 0, 2),
  copy("P27", "Amplifier", "amplifier", 0, -2, 1),
  copy("P28", "Amplifier", "amplifier", 2, -1, 2),
  copy("P29", "Amplifier", "amplifier", 2, -1, 1),
  copy("P30", "Tail", "tail", 1, 2, 0),
];

// The generator copies whose declared synthetic reserves stock the
// board's charge lines — the supplies the experiments assume.
export const SUPPLIED_GENERATORS = new Set(["P07", "P11", "P17"]);

// The Spotlight recipients, by copy: P06 and P20 both select P30 (the
// Tail) — the table's declared settings, applied through the module's
// own recipient reference.
const SUPPLIED_RECIPIENTS: readonly { readonly from: string; readonly to: string }[] = [
  { from: "P06", to: "P30" },
  { from: "P20", to: "P30" },
];

export const SUPPLIED_BOARD_DECLARED = {
  polyExpanderPurchases: 4,
  expansionBays: 2,
  chordCatalysts: 2,
  completedBreathers: 17,
  lifetimeBreatherSeconds: 6_241,
  enemies: "all nine discovered and undefeated",
  worldWeaponAndColumns: "unplaced",
  savedDeployedLevels: "1506 — corrupt magnitude, never used; declared finite sweeps stand in",
  monetaryFields: "lost — no monetary figure is reconstructed",
  reserves: `${SYNTHETIC_RESERVE} charge on each declared generator supply (synthetic)`,
  omitted: "personal records, original reserves, feats, discovery bonuses, historical clock",
} as const;

// The supplied board as a comparison board: cells and copies exactly as
// the table declares, in the table's relative order.
export function suppliedComparisonBoard(level: number): ComparisonBoard {
  return {
    name: "supplied-board-p01-p30",
    cells: SUPPLIED_BOARD.map((c) => ({ q: c.q, r: c.r })),
    modules: SUPPLIED_BOARD.map((c) => ({
      type: c.type, level, q: c.q, r: c.r, tier: c.tier,
      ...(SUPPLIED_GENERATORS.has(c.copy) ? { reserve: SYNTHETIC_RESERVE } : {}),
    })),
  };
}

// The one candidate-application read: shipped sets nothing on the state,
// so shipped runs keep the exact states they always built; a candidate
// rides the run's own candidate state and nothing shared.
function withCurve(state: GameState, curve: ResponseCurveId): GameState {
  if (curve !== "shipped") state.candidates = { responseCurve: curve };
  return state;
}

// The reconstruction's engine state: the comparison board plus the
// table's declared facts — the four Poly Expander purchases under the two
// Expansion Bays' ceiling, the two Chord Catalysts, the breathers, the
// discovered undefeated enemies, and the Spotlight recipients.
export function suppliedBoardState(level: number, capacity: number, curve: ResponseCurveId): GameState {
  const state = stateOf(suppliedComparisonBoard(level), capacity);
  state.capacityCeilings = SUPPLIED_BOARD_DECLARED.expansionBays;
  state.capacityDiscounts = SUPPLIED_BOARD_DECLARED.chordCatalysts;
  state.breathersCompleted = SUPPLIED_BOARD_DECLARED.completedBreathers;
  state.breatherSeconds = SUPPLIED_BOARD_DECLARED.lifetimeBreatherSeconds;
  for (const def of WORLD_ENEMIES) {
    const live = state.world.enemies[def.key];
    if (live) live.discovered = true;
  }
  const byCopy = new Map(SUPPLIED_BOARD.map((c, index) => [c.copy, index]));
  for (const { from, to } of SUPPLIED_RECIPIENTS) {
    state.modules[byCopy.get(from)!]!.target = state.modules[byCopy.get(to)!]!.id;
  }
  return withCurve(state, curve);
}

// The same reconstruction with the declared enemies left undiscovered —
// everything else identical — the control the enemy-pressure pin reads
// against.
export function suppliedBoardUnpressed(level: number, capacity: number, curve: ResponseCurveId): GameState {
  const state = suppliedBoardState(level, capacity, curve);
  for (const def of WORLD_ENEMIES) {
    const live = state.world.enemies[def.key];
    if (live) live.discovered = false;
  }
  return state;
}

// ── The phenomenon boards ────────────────────────────────────────────────
//
// Each rig is a real allocated board over the engine's opening state —
// the opening voice at (0,0) with its granted cells, the Fifth partner at
// (1,0) — built through the fixture helper and read by allocateRates
// exactly as live play reads. One rig per clause the acceptance criteria
// name; the capacity sweep runs on the two rigs whose seats the ladder
// can actually widen (the Blaster's intrinsic two, the supplied board's
// roster).

export interface PhenomenonBoard {
  readonly name: string;
  // The criterion clause the rig exercises.
  readonly exercises: string;
  readonly build: (state: GameState, level: number) => void;
}

// The charged supply helper: one keyed generator banking the declared
// synthetic reserve, its emission the charge the rig's legs read.
function supply(state: GameState, at: Hex): void {
  give(state, "focusKeyed", at, 0).reserve = SYNTHETIC_RESERVE;
}

// The opening voice's module instance (the fixture's first placed voice
// at (0,0)) — the Spotlight boards' declared recipient.
function openingVoice(state: GameState): string {
  const module = state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(0, 0)));
  if (!module) throw new Error("phenomenon board: no opening voice at (0,0)");
  return module.id;
}

export const PHENOMENON_BOARDS: readonly PhenomenonBoard[] = [
  {
    name: "chorus-stack",
    exercises: "Chorus stacking — two Chorus copies' same-term grants add on one voice inside a live chord",
    build: (state, level) => {
      give(state, "additive", hex(1, 0), level);
      give(state, "chorus", hex(1, -1), level);
      give(state, "chorus", hex(0, -1), level);
      supply(state, hex(-1, 0));
    },
  },
  {
    name: "exciter-producer",
    exercises: "an independent charged Exciter producer — the charge-response grant on a charged Tail",
    build: (state, level) => {
      give(state, "tail", hex(1, 0), level);
      give(state, "exciter", hex(1, -1), level);
      supply(state, hex(0, -1));
    },
  },
  {
    name: "sideband-conversion",
    exercises: "Sideband conversion — the charged chord converter's scale deepened by the Exciter's grant",
    build: (state, level) => {
      give(state, "sideband", hex(1, 0), level);
      give(state, "exciter", hex(1, -1), level);
      supply(state, hex(0, -1));
    },
  },
  {
    name: "multi-support",
    exercises: "multiple supports — amplitude, chord-response, and charge-response legs on one voice at once",
    build: (state, level) => {
      give(state, "additive", hex(1, 0), level);
      give(state, "chorus", hex(1, -1), level);
      give(state, "exciter", hex(0, -1), level);
      give(state, "field", hex(-1, 0), level);
      give(state, "spotlight", hex(-1, 1), level).target = openingVoice(state);
      supply(state, hex(0, 1));
    },
  },
  {
    name: "silent-voices",
    exercises: "silent voices — Harmonizer, Echo, and Bend uplift stacking inside Chorus-carried instances",
    build: (state, level) => {
      give(state, "additive", hex(1, 0), level);
      give(state, "harmonizer", hex(-1, 0), level);
      give(state, "echo", hex(-1, 1), level);
      give(state, "bend", hex(0, 1), level);
      give(state, "chorus", hex(1, -1), level);
      supply(state, hex(0, -1));
    },
  },
  {
    name: "amplitude-support",
    exercises: "amplitude support only — the curve-invariant control; no response support may move this board",
    build: (state, level) => {
      give(state, "additive", hex(1, 0), level);
      give(state, "infusor", hex(1, -1), level);
      give(state, "field", hex(0, -1), level);
      give(state, "spotlight", hex(-1, 1), level).target = openingVoice(state);
      supply(state, hex(-1, 0));
    },
  },
  {
    name: "conduit-chain",
    exercises: "conduit chains — relayed charge through two Amplifiers feeding the Exciter's grant and a converter",
    build: (state, level) => {
      give(state, "sideband", hex(1, 0), level);
      give(state, "exciter", hex(2, 0), level);
      give(state, "amplifier", hex(2, -1), level);
      give(state, "amplifier", hex(3, -1), level);
      supply(state, hex(2, -2));
    },
  },
  {
    name: "merge-extremes",
    exercises: "merge-tier extremes — the tier-0 and tier-2 ladder ends side by side, the candidate scaling with tier",
    build: (state, level) => {
      give(state, "chorus", hex(1, -1), level);
      give(state, "additive", hex(1, 0), level).tier = 2;
      give(state, "chorus", hex(2, 0), level).tier = 2;
      supply(state, hex(0, -1));
    },
  },
  {
    name: "blaster-seats",
    exercises: "the Blaster's intrinsic two seats beside the purchased ladder — capacity swept end to end",
    build: (state, level) => {
      give(state, "blaster", hex(1, 0), level);
      give(state, "harmonizer", hex(2, 0), level);
      supply(state, hex(1, -1));
    },
  },
];

// The fixture state for one phenomenon row: the rig, the swept capacity
// (the declared bays open the ladder past three), the declared curve.
export function phenomenonState(
  board: PhenomenonBoard,
  level: number,
  capacity: number,
  curve: ResponseCurveId,
): GameState {
  const state = fresh();
  board.build(state, level);
  state.capacityBought = capacity - 1;
  if (state.capacityBought > 2) state.capacityCeilings = 2;
  return withCurve(state, curve);
}

// ── The rows ─────────────────────────────────────────────────────────────

export interface FixtureRow {
  readonly evidenceClass: "fixture";
  readonly board: string;
  readonly exercises?: string;
  readonly curve: ResponseCurveId;
  readonly level: number;
  readonly capacity: number;
  // The whole-board rate; null records a figure beyond the representable
  // range — written as null on purpose, never silently (the save
  // boundary's own refusal lesson, #486).
  readonly rate: number | null;
  readonly activeInstances: number;
  readonly certified: boolean;
  // The full-board floor the World's discovered undefeated enemies
  // multiply in — recorded so the supplied board's absolute figures are
  // never misread as unpressured production.
  readonly worldFactor: number;
}

export interface EnvelopeRow {
  readonly evidenceClass: "envelope";
  readonly board: string;
  readonly curve: ResponseCurveId;
  readonly level: number;
  // The whole-board rate at this level; null beyond the representable
  // range, recorded as null on purpose.
  readonly rate: number | null;
  // Price to raise all supplied-board copies by one level, matching the
  // whole-board rate difference below.
  readonly nextLevelCost: number;
  // Marginal ν/s per next-level ν — growth against the upgrade cost;
  // null when either endpoint leaves the representable range.
  readonly marginalNuPerNu: number | null;
  // The next level's cost/rate over this level's cost/rate: below one
  // means levelling is getting faster — the runaway's own signature;
  // null when either endpoint leaves the representable range.
  readonly waitRatio: number | null;
  // Whether this level's allocation certified under the default budget —
  // the shipped regime's boards can be incumbent-only, and the row says
  // so rather than passing the figure off as proven optimal.
  readonly certified: boolean;
}

export interface GestureRow {
  readonly evidenceClass: "pacing-purchase";
  readonly curve: ResponseCurveId;
  readonly startLevel: number;
  readonly bank: number;
  readonly levelsBought: number;
  readonly finalLevel: number;
  readonly rate: number | null;
  readonly certified: boolean;
}

export interface PacingRow {
  readonly evidenceClass: "pacing-acquisition";
  readonly curve: ResponseCurveId;
  readonly runId: string;
  readonly source: PlaythroughSource;
  // The whole composed recipe rides the row — the report records
  // recipes, not just their seeds.
  readonly recipe: PlaythroughRecipe;
  readonly budgetDays: number;
  readonly complete: boolean;
  readonly stop: string;
  readonly days: number;
  readonly creditedMinutes: number;
  readonly earnedNous: number;
  readonly responseSupportsAcquired: number;
  readonly peakLevel: number;
}

export interface AcquisitionScanRow {
  readonly seed: number;
  readonly budgetDays: number;
  readonly complete: boolean;
  readonly responseSupportsAcquired: number;
}

export interface CertificationProbe {
  readonly evidenceClass: "certification-probe";
  readonly board: string;
  readonly curve: ResponseCurveId;
  readonly level: number;
  readonly budget: "default" | "reduced-declared";
  readonly certified: boolean;
  readonly rate: number | null;
}

// The reported comparison. `source` is the run provenance every recipe
// carries; the pacing rows' recipes compose exactly as the app command's.
export interface ResponseComparisonReport {
  readonly model: string;
  readonly source: PlaythroughSource;
  readonly curves: readonly { readonly id: ResponseCurveId; readonly name: string; readonly description: string }[];
  readonly declared: typeof SUPPLIED_BOARD_DECLARED;
  readonly suppliedCopies: readonly SuppliedCopy[];
  readonly fixtures: readonly FixtureRow[];
  readonly capacitySweep: readonly FixtureRow[];
  readonly envelopes: readonly EnvelopeRow[];
  readonly gestureSweep: readonly GestureRow[];
  readonly pacing: readonly PacingRow[];
  readonly acquisitionScan: readonly AcquisitionScanRow[];
  readonly certificationProbes: readonly CertificationProbe[];
  readonly findings: readonly string[];
}

function fixtureRow(board: PhenomenonBoard, curve: ResponseCurveId, level: number, capacity: number): FixtureRow {
  const state = phenomenonState(board, level, capacity, curve);
  return rowOf(state, board.name, board.exercises, curve, level, capacity);
}

function suppliedRow(curve: ResponseCurveId, level: number, capacity: number): FixtureRow {
  return rowOf(suppliedBoardState(level, capacity, curve), "supplied-board-p01-p30", undefined, curve, level, capacity);
}

function rowOf(
  state: GameState,
  board: string,
  exercises: string | undefined,
  curve: ResponseCurveId,
  level: number,
  capacity: number,
): FixtureRow {
  const rates: AllocatedRates = allocateRates(state, true);
  return {
    evidenceClass: "fixture",
    board,
    ...(exercises ? { exercises } : {}),
    curve, level, capacity,
    rate: representable(rates.snapshot.rate),
    activeInstances: rates.read.instances.length,
    certified: rates.read.certified,
    worldFactor: worldFactorOf(state),
  };
}

// The rows' one figure guard: a rate beyond the representable range is
// recorded as null explicitly — never handed to JSON.stringify, which
// would write the same null silently (the #486 refusal's exact lesson).
function representable(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function envelopeRows(): EnvelopeRow[] {
  const rows: EnvelopeRow[] = [];
  for (const curve of CURVES) {
    const cache = new Map<number, { rate: number; certified: boolean }>();
    const at = (level: number): { rate: number; certified: boolean } => {
      let value = cache.get(level);
      if (!value) {
        const rates = allocateRates(suppliedBoardState(level, 5, curve), true);
        value = { rate: rates.snapshot.rate, certified: rates.read.certified };
        cache.set(level, value);
      }
      return value;
    };
    for (const level of LEVEL_SWEEP) {
      const cost = SUPPLIED_BOARD.length * levelCost(level);
      const here = at(level).rate;
      const next = at(level + 1).rate;
      const finitePair = Number.isFinite(here) && Number.isFinite(next);
      rows.push({
        evidenceClass: "envelope",
        board: "supplied-board-p01-p30",
        curve, level,
        rate: representable(here),
        nextLevelCost: cost,
        marginalNuPerNu: finitePair ? representable((next - here) / cost) : null,
        waitRatio: finitePair ? representable((SUPPLIED_BOARD.length * levelCost(level + 1) / next) / (cost / here)) : null,
        certified: at(level).certified,
      });
    }
  }
  return rows;
}

// The declared purchase-policy sweep on the already-acquired board: the
// prompt rule's own gesture size and order — five-level gestures over the
// deployed voices, cheapest level first, ties in roster order exactly as
// the walk's gesture leg resolves them — through the real bulk action
// against a declared bank. The gesture leg inside the playthrough walk is
// not an extracted callable, so this sweep re-states its declared rule
// and the rows present it as that: a policy-shaped purchase sweep on a
// real board, not a recorded walk of the whole policy. The candidate
// changes how far the same bank pushes the same board — the purchase-side
// pacing leg.
export function gestureRows(): GestureRow[] {
  const startLevel = 25;
  return CURVES.map((curve) => {
    const state = suppliedBoardState(startLevel, 5, curve);
    state.nous = SYNTHETIC_BANK;
    // Roster order for ties: the walk's own tiebreak (the stable sort's
    // roster rank), never a lexicographic id compare — m2 outranks m10.
    const rosterRank = new Map(state.modules.map((module, index) => [module.id, index]));
    let bought = 0;
    for (let guard = 0; guard < 4000; guard++) {
      const voice = state.modules
        .filter((m) => m.pos !== null)
        .sort((a, b) => a.level - b.level || rosterRank.get(a.id)! - rosterRank.get(b.id)!)[0];
      if (!voice) break;
      const result = upgradeModuleLevels(state, voice.id, GESTURE_LEVELS);
      if (!result.ok) break;
      bought += result.bulk?.levels ?? GESTURE_LEVELS;
    }
    const rates = allocateRates(state, true);
    return {
      evidenceClass: "pacing-purchase" as const,
      curve, startLevel, bank: SYNTHETIC_BANK,
      levelsBought: bought,
      finalLevel: Math.max(...state.modules.map((m) => m.level)),
      rate: representable(rates.snapshot.rate),
      certified: rates.read.certified,
    };
  });
}

// Count successful roll acquisitions using the runner's type-id labels,
// including the runner's uniform "a" article for both support types.
export function responseSupportsAcquired(events: readonly PlaythroughEvent[]): number {
  return events.filter((event) => event.ok && event.kind === "roll" &&
    /^Accepted a (chorus|exciter) from the roll$/.test(event.label)).length;
}

// The acquisition-policy pacing legs: the scheduled prompt walk, one per
// candidate, same declared recipe otherwise. Whatever the curves do, the
// opening era's acquisitions are recorded exactly as the policy played
// them — the walks are the fresh-start pacing evidence class.
export function pacingRows(budgetDays: number): PacingRow[] {
  return CURVES.map((curve) => {
    const recipe = composePlaythroughRecipe({ seed: 468, budgetDays, responseCurve: curve });
    const run: PlaythroughRecord = runPlaythrough(recipe);
    const supports = responseSupportsAcquired(run.events);
    return {
      evidenceClass: "pacing-acquisition" as const,
      curve,
      runId: run.runId,
      source: run.source,
      recipe,
      budgetDays,
      complete: run.complete,
      stop: `${run.stop.kind} — ${run.stop.reason}`,
      days: run.days,
      creditedMinutes: Math.round(run.creditedSeconds / 60),
      earnedNous: run.earnedNous,
      responseSupportsAcquired: supports,
      peakLevel: Math.max(...run.state.modules.map((m) => m.level)),
    };
  });
}

// The certification probe: the same supplied-board read under the
// solver's default budget and under a declared reduced one, so the
// report carries the distinction itself — a certified default row beside
// an uncertified incumbent row that says so (ADR-0051). Level 25 is
// inside the default budget's reach; the reduced budget trips by
// declaration, not by board size.
export function certificationProbes(level: number): CertificationProbe[] {
  const curve: ResponseCurveId = "shipped";
  const reducedState = suppliedBoardState(level, 5, curve);
  const reduced = allocateRates(reducedState, true, { budget: { maxNodes: 1, maxMs: 1 } });
  const baseline = suppliedRow(curve, level, 5);
  return [
    {
      evidenceClass: "certification-probe",
      board: "supplied-board-p01-p30",
      curve, level,
      budget: "default",
      certified: baseline.certified,
      rate: baseline.rate as number | null,
    },
    {
      evidenceClass: "certification-probe",
      board: "supplied-board-p01-p30",
      curve, level,
      budget: "reduced-declared",
      certified: reduced.read.certified,
      rate: reduced.snapshot.rate,
    },
  ];
}

// The recorded acquisition scan: the scheduled prompt policy, walked
// seed by seed, counting the runs that ever held a Chorus or Exciter —
// the recorded evidence behind the opening-era invariance finding.
export function acquisitionScan(seeds: readonly number[], budgetDays: number): AcquisitionScanRow[] {
  return seeds.map((seed) => {
    const run = runPlaythrough(composePlaythroughRecipe({ seed, budgetDays, responseCurve: "shipped" }));
    return {
      seed,
      budgetDays,
      complete: run.complete,
      responseSupportsAcquired: responseSupportsAcquired(run.events),
    };
  });
}

export function responseComparisonReport(pacingBudgetDays: number): ResponseComparisonReport {
  const fixtures: FixtureRow[] = [];
  for (const board of PHENOMENON_BOARDS) {
    for (const level of PHENOMENON_LEVELS) {
      for (const curve of CURVES) {
        fixtures.push(fixtureRow(board, curve, level, 5));
      }
    }
  }
  const capacitySweep: FixtureRow[] = [];
  for (const capacity of CAPACITY_SWEEP) {
    for (const curve of CURVES) {
      capacitySweep.push(fixtureRow(PHENOMENON_BOARDS.find((b) => b.name === "blaster-seats")!, curve, 100, capacity));
      capacitySweep.push(suppliedRow(curve, 100, capacity));
    }
  }
  const report: ResponseComparisonReport = {
    model:
      "Real allocated boards and scheduled engine playthroughs under the declared response-curve candidates. " +
      "Three evidence classes kept separate: analytical envelopes (idealized growth against upgrade costs), " +
      "already-acquired fixtures (the phenomenon rigs and the anonymized supplied-board reconstruction over declared " +
      "finite level sweeps and declared synthetic reserve supplies), and fresh-start pacing (the scheduled prompt " +
      "acquisition walk and the prompt purchase gesture, both real engine actions). " +
      "A candidate is evidence toward the parent's coefficient decision, not approved tuning; no row is a 100-hour " +
      "acceptance claim.",
    source: playthroughSource(),
    curves: RESPONSE_CURVES.map(({ id, name, description }) => ({ id, name, description })),
    declared: SUPPLIED_BOARD_DECLARED,
    suppliedCopies: SUPPLIED_BOARD,
    fixtures,
    capacitySweep,
    envelopes: envelopeRows(),
    gestureSweep: gestureRows(),
    pacing: pacingRows(pacingBudgetDays),
    acquisitionScan: acquisitionScan([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], Math.max(pacingBudgetDays, 20)),
    certificationProbes: certificationProbes(25),
    findings: [],
  };
  return { ...report, findings: findingsOf(report) };
}

// The findings, computed from the recorded rows — the report reads what
// the rows say, never the other way around.
function findingsOf(report: ResponseComparisonReport): string[] {
  const findings: string[] = [];
  const at = (board: string, level: number, curve: ResponseCurveId): FixtureRow =>
    report.fixtures.find((row) => row.board === board && row.level === level && row.curve === curve)!;
  // Level-zero grant parity, every board.
  const parity = PHENOMENON_BOARDS.every((board) => {
    const shipped = at(board.name, 0, "shipped").rate;
    return CURVES.every((curve) => at(board.name, 0, curve).rate === shipped);
  });
  findings.push(
    parity
      ? "Level-zero grant parity: every phenomenon board reads exactly the same rate under all three candidates at level 0 — the candidates preserve the shipped level-zero grants (tier rides every curve)."
      : "Level-zero grant parity FAILED — a candidate moved a board at level 0.",
  );
  // The control.
  const control = (curve: ResponseCurveId): (number | null)[] =>
    report.fixtures.filter((row) => row.board === "amplitude-support" && row.curve === curve).map((row) => row.rate);
  const controlInvariant = CURVES.every((curve) => JSON.stringify(control(curve)) === JSON.stringify(control("shipped")));
  findings.push(
    controlInvariant
      ? "The amplitude-only control never moves: the candidates touch the Chorus/Exciter response grants alone — Booster, Field, and Spotlight legs read identically under every curve."
      : "The amplitude control MOVED under a candidate — the seam leaks beyond the response supports.",
  );
  // The runaway regime, per support path. The Chorus leg rides inside
  // every chord instance, so chord-carrying boards spread widest; the
  // Exciter leg lands once per producer, and at extreme levels the
  // producer's own (untouched) power dominates the absolute spread —
  // both facts are the finding, and the supplied board's waiting-time
  // ratios below carry the growth-against-cost direction.
  for (const board of ["chorus-stack", "exciter-producer", "sideband-conversion"]) {
    const shipped = at(board, 1000, "shipped").rate;
    const linear = at(board, 1000, "linear").rate;
    const bounded = at(board, 1000, "bounded").rate;
    const spread = (other: number | null): string =>
      shipped === null || other === null ? "beyond the representable range" : `(shipped ${(shipped / other).toExponential(1)}× above it)`;
    findings.push(
      `${board} at level 1000: shipped ${shipped === null ? "beyond representable range" : shipped.toExponential(2) + "ν/s"}, ` +
        `linear ${linear === null ? "beyond representable range" : linear.toExponential(2) + "ν/s"} ${spread(linear)}, ` +
        `bounded ${bounded === null ? "beyond representable range" : bounded.toExponential(2) + "ν/s"} ${spread(bounded)}.`,
    );
  }
  // The supplied board's own spread, intermediate and high.
  const envelope = (level: number, curve: ResponseCurveId): EnvelopeRow =>
    report.envelopes.find((row) => row.level === level && row.curve === curve)!;
  for (const level of [100, 1000]) {
    const shipped = envelope(level, "shipped");
    const bounded = envelope(level, "bounded");
    findings.push(
      `Supplied board at level ${level}: shipped ${shipped.rate === null ? "beyond the representable range" : shipped.rate.toExponential(2) + "ν/s"} vs ` +
        `bounded ${bounded.rate === null ? "beyond the representable range" : bounded.rate.toExponential(2) + "ν/s"}` +
        (shipped.rate !== null && bounded.rate !== null
          ? ` (shipped ${(shipped.rate / bounded.rate).toExponential(1)}× above)` : "") +
        (shipped.marginalNuPerNu !== null && bounded.marginalNuPerNu !== null && bounded.marginalNuPerNu > 0
          ? `; next-level marginal growth per ν ${(shipped.marginalNuPerNu / bounded.marginalNuPerNu).toExponential(1)}× shipped over bounded.`
          : "."),
    );
  }
  // Where levelling slows — computed from the rows, so the sentence stays
  // true under whatever curve the shipped entry carries.
  const waits = (curve: ResponseCurveId): string =>
    report.envelopes.filter((row) => row.curve === curve).map((row) => (row.waitRatio === null ? "—" : row.waitRatio.toFixed(2))).join(", ");
  const crossOf = (curve: ResponseCurveId): string => {
    const cross = report.envelopes.find((row) => row.curve === curve && row.waitRatio !== null && row.waitRatio > 1);
    return cross ? `${curve} above one from level ${cross.level}` : `${curve} never crosses inside the sweep`;
  };
  findings.push(
    `Supplied-board waiting-time ratios across the level sweep (next level's cost/rate over this level's; above one means the next level takes longer) — ` +
      `shipped: ${waits("shipped")}; linear: ${waits("linear")}; bounded: ${waits("bounded")}. ` +
      `${crossOf("shipped")}; ${crossOf("linear")}; ${crossOf("bounded")}.`,
  );
  const incumbent = report.envelopes.filter((row) => !row.certified);
  if (incumbent.length > 0) {
    findings.push(
      `${incumbent.length} envelope levels did not certify under the default budget ` +
        `(${incumbent.map((row) => `${row.curve}@${row.level}`).join(", ")}) — their figures are the incumbent's, marked in the rows; ` +
        "the runaway board cannot even finish its own optimal search.",
    );
  }
  // The World floor on the supplied board.
  const world = [...report.fixtures, ...report.capacitySweep].find((row) => row.board === "supplied-board-p01-p30")!.worldFactor;
  findings.push(
    `The supplied board's nine discovered undefeated enemies multiply every supplied row by ${world.toExponential(2)} — ` +
      "the reconstruction's absolute figures are pressured production, not unpressured capacity.",
  );
  // Certification.
  const uncertified = [...report.fixtures, ...report.capacitySweep].filter((row) => !row.certified);
  findings.push(
    uncertified.length === 0
      ? `All ${report.fixtures.length + report.capacitySweep.length} fixture and capacity rows solved certified under the default budget; the certification probes record the uncertified distinction under a declared reduced budget.`
      : `${uncertified.length} rows did not certify under the default budget and carry certified:false in place — ${[...new Set(uncertified.map((row) => row.board))].join(", ")}.`,
  );
  // Fresh-start pacing.
  const first = report.pacing[0]!;
  const identical = report.pacing.every((row) => row.creditedMinutes === first.creditedMinutes && row.earnedNous === first.earnedNous && row.complete === first.complete);
  const acquired = report.pacing.map((row) => row.responseSupportsAcquired);
  const scanHolds = report.acquisitionScan.filter((row) => row.responseSupportsAcquired > 0).length;
  findings.push(
    identical && acquired.every((count) => count === 0) && scanHolds === 0
      ? `Fresh-start pacing is curve-invariant in this era: the scheduled prompt policy acquired no Chorus or Exciter within ${first.budgetDays} days on seed ${first.recipe.seed}, and the recorded acquisition scan agrees (seeds ${report.acquisitionScan[0]!.seed}–${report.acquisitionScan.at(-1)!.seed} at ${report.acquisitionScan[0]!.budgetDays} days: ${scanHolds} of ${report.acquisitionScan.length} runs ever held a response support) — the candidates cannot move an opening era; the decision binds already-acquired boards.`
      : `Fresh-start pacing walks ${identical ? "are curve-invariant" : "differ"} — response supports acquired per candidate: ${acquired.join(", ")}; scan runs holding a support: ${scanHolds} of ${report.acquisitionScan.length}; walks identical: ${identical}.`,
  );
  findings.push(
    "The declared purchase-policy gesture sweep spends the same declared bank on the same already-acquired board under each candidate — " +
      "the same levels land (the ladder's prices do not read the candidate), and the resulting-rate rows show what those levels do under each curve: the purchase side costs the same, the response side is what the decision changes.",
  );
  findings.push(
    "Scope: these rows support choosing a structural candidate (which curve shape removes the runaway). They are not 100-hour progression acceptance; production adoption waits for the numeric-integrity tickets and calibrated era budgets.",
  );
  return findings;
}

// The response-power read at one level under one candidate, off a real
// state — the seam-level figure the envelopes and rate rows both derive
// from. The level is set directly, never through the fixture helper's
// invested-cost walk: an extreme level's ladder price is a BigInt
// computation no test should wait on for a power-term read.
export function curvePower(curve: ResponseCurveId, level: number): number {
  const state = fresh();
  const chorus = give(state, "chorus", hex(3, 3), 0);
  chorus.level = level;
  return responseSupportPowerOf(withCurve(state, curve), chorus);
}

// The swept levels' total price from zero — what an already-acquired
// board's uniform level represents on the upgrade ladder.
export function uniformLevelInvestment(level: number): number {
  return investment(level);
}
