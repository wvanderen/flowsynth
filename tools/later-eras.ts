import { BALANCE, WORLD_ENEMIES } from "../src/engine/constants";
import { DEFAULT_ALLOCATION_BUDGET } from "../src/engine/allocation";
import assert from "node:assert/strict";
import {
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
import { buyCatalogEntry, buyChargeColumn, buyHoneRank, placeWorldOccupant } from "../src/engine/actions";
import { columnCost, enemyDefAt, honeCostOf, worldOccupantAt } from "../src/engine/world";
import { adjacent } from "../src/engine/hex";
import { chargeLineCells } from "../src/engine/playthrough-placement";
import { seededRng } from "../src/engine/capacity-calibration";
import type { GameState } from "../src/engine/types";
import { meaningfulDecisions, type DecisionGap } from "./first-prestige";

// The compiled recording CLI uses exactly the same runner and source read.
export { playthroughSource, runPlaythrough, stateNumbersFinite };

// The later-era evaluation (issue #491, parent #484 stories 5, 17–27,
// 42–43): the shipped economy's repeated productive eras, read on real
// scheduled playthroughs — the existing runner, real engine actions, no
// second simulator, no shared-balance mutation, no grant, no refund. The
// declared matrix: the eight declared seeds × the two declared session
// shapes (the suite's baseline 25-minute day and its 60-minute variant) ×
// the parent's three declared World policies — support-seeking,
// combat-engaging, and enemy-ignoring — each walked through four claimed
// frontiers. Every closed era's ledger carries its span on the credited
// clock, its banked claim, the strictly larger frontier it advanced to,
// the familiar/new territory split (credited seconds below the previous
// bank's depth against beyond it), the two faster-return marks, and the
// finite read over the exact recorded state its bank produced.
//
// Every figure is a measurement, never a verdict: an open era, an
// out-of-window era, or a postponed-combat run stays explicit in its row.
// The later productive eras (index ≥ 1; era 0 is the opening era whose
// 8–12-hour window issue #490 already evaluated) classify against the
// roughly 5–10 credited-hour validation range (ADR-0078 as revised) — a
// validation range, not a timer.

// The declared seed matrix (issue #491; the same eight as #490's).
export const LATER_ERA_SEEDS: readonly number[] = [42, 468, 157, 2026, 7, 99, 11, 23];

// The declared session shapes: the suite's baseline (two 25-minute daily
// sessions) and its 60-minute variant — the same five-minute breather,
// one practice habit with a daily goal.
export const BASELINE_SESSION_MINUTES = 25;
export const LONG_SESSION_MINUTES = 60;

// The declared World-comparison policies (issue #491; the parent's
// support-seeking / combat-engaging / enemy-ignoring trio).
export const WORLD_POLICIES = ["support", "combat", "ignoring"] as const;
export type WorldPolicyId = (typeof WORLD_POLICIES)[number];

// The declared walk: four claimed frontiers — the opening era plus three
// later eras, each bank advancing the frontier strictly beyond the last.
export const TARGET_ERAS = 4;

// The declared budgets: the walk's own honest stop when a policy cannot
// finish. Sized from the recorded calibration walks below (the baseline
// day credits ~0.83 flow hours, the long day ~2), with a budget miss a
// recorded miss, never an extended goalpost.
export const BASELINE_BUDGET_DAYS = 70;
export const LONG_BUDGET_DAYS = 30;

// The later-era validation range (ADR-0078 as revised): roughly 5–10
// credited hours. A validation range, not a timer.
export const LATER_ERA_MIN_HOURS = 5;
export const LATER_ERA_MAX_HOURS = 10;

// One later era's timing classification. Era 0 — the opening — is not a
// later era: its window is #490's, and this evaluation labels it
// "opening" rather than judging it here. An era still open at the stop is
// "open" — the explicit incomplete outcome.
export type EraTimingClass = "opening" | "in-window" | "under" | "over" | "open";

export function eraHoursOf(era: PlaythroughEraLedger): number | null {
  return era.endCredited === null ? null : (era.endCredited - era.startCredited) / 3600;
}

export function classifyEra(era: PlaythroughEraLedger): EraTimingClass {
  if (era.index === 0) return "opening";
  const hours = eraHoursOf(era);
  if (hours === null) return "open";
  if (hours < LATER_ERA_MIN_HOURS) return "under";
  if (hours > LATER_ERA_MAX_HOURS) return "over";
  return "in-window";
}

// One era's analytical view, read off the record: the timing class, the
// familiar/new split, the faster-return marks, and the era's own route —
// the consequential purchase, placement, and defeat decisions its span
// recorded, with the pacing gaps between them.
export interface LaterEraView {
  readonly index: number;
  readonly eraClass: EraTimingClass;
  // The era's credited span, in hours (null while open).
  readonly hours: number | null;
  readonly claim: number | null;
  readonly frontierAfter: number | null;
  readonly priorDepth: number | null;
  readonly familiarHours: number;
  readonly newHours: number;
  // New territory's share of the era's credited time — the read behind
  // "rebuilding must not consume most of every later era" (issue #491).
  // Null when the era carries no credited time at all.
  readonly newShare: number | null;
  // Faster return through familiar territory (issue #491): this era's
  // familiar credited walk against the previous era's FULL credited span
  // to the same depth — the depth this era re-walks is exactly the depth
  // the previous era's bank landed at. True when retained strength made
  // the re-walk faster. Null for era 0 (nothing was familiar) and for an
  // open era whose crossing has not carried.
  readonly familiarFaster: boolean | null;
  readonly priorSpanHours: number | null;
  readonly productionRegainedHours: number | null;
  readonly priorDepthPassedHours: number | null;
  // The rebuilding share (issue #491's second criterion): the credited
  // span the era spent regaining the production the reset erased, against
  // the era's whole credited span. Rebuilding consuming most of a later
  // era reads here — a share above half is the recorded failure, never a
  // silent pass. Null while the mark or the span is unreached.
  readonly rebuildingShare: number | null;
  // The era's route (issue #491's fourth criterion): what its Arete
  // bought and what deployed — the affordable route the walk
  // demonstrated at this frontier, labels verbatim from the action
  // record. The routine nous purchases (shelf, cells, capacity rungs)
  // ride the count; the route is the Arete-scale line.
  readonly purchases: readonly string[];
  readonly nousPurchases: number;
  readonly placements: readonly string[];
  readonly defeats: readonly string[];
  // The consequential-decision gaps (issue #491's sixth criterion), in
  // credited seconds — the same declared decision rule as #490's.
  readonly gaps: {
    readonly count: number;
    readonly maxCredited: number;
    readonly meanCredited: number;
  };
  readonly finite: boolean | null;
}

function eraSpanEvents(record: PlaythroughRecord, era: PlaythroughEraLedger): PlaythroughEvent[] {
  // Closing-session facts precede the bank even when both clocks tie.
  // Event order, not a half-open credited-time range, owns the era.
  const banks = record.events.flatMap((event, index) => event.kind === "prestige" && event.ok ? [index] : []);
  const start = era.index === 0 ? 0 : banks[era.index - 1]! + 1;
  return record.events.slice(start, banks[era.index] ?? record.events.length);
}

function gapsOf(decisions: readonly PlaythroughEvent[]): LaterEraView["gaps"] {
  const gaps: DecisionGap[] = [];
  for (let i = 1; i < decisions.length; i++) {
    gaps.push({ credited: Math.max(0, decisions[i]!.credited - decisions[i - 1]!.credited), closedBy: decisions[i]!.label });
  }
  return {
    count: gaps.length,
    maxCredited: gaps.length > 0 ? Math.max(...gaps.map((gap) => gap.credited)) : 0,
    meanCredited: gaps.length > 0 ? Math.round(gaps.reduce((sum, gap) => sum + gap.credited, 0) / gaps.length) : 0,
  };
}

const WORLD_DEFEAT_PREFIX = "World — enemy ";
const isWorldPlacement = (event: PlaythroughEvent): boolean =>
  event.kind === "world" && (event.label.startsWith("Placed ") || event.label.startsWith("Relocated "));

export function laterEraView(record: PlaythroughRecord, index: number, previous: LaterEraView | null): LaterEraView {
  const era = record.eras[index];
  if (!era) throw new Error(`Later-era view: the record carries no era ${index}.`);
  const span = eraSpanEvents(record, era);
  const consequential = new Set(meaningfulDecisions(record));
  const decisions = span.filter((event) => consequential.has(event));
  const hours = eraHoursOf(era);
  const totalCredited = era.familiarCredited + era.newCredited;
  const familiarFaster = era.index === 0 || era.priorDepthPassed === null || previous === null || previous.hours === null
    ? null
    : era.familiarCredited < previous.hours * 3600;
  return {
    index: era.index,
    eraClass: classifyEra(era),
    hours: hours === null ? null : Math.round(hours * 100) / 100,
    claim: era.claim,
    frontierAfter: era.frontierAfter,
    priorDepth: era.priorDepth,
    familiarHours: Math.round((era.familiarCredited / 3600) * 100) / 100,
    newHours: Math.round((era.newCredited / 3600) * 100) / 100,
    newShare: totalCredited <= 0 ? null : Math.round((era.newCredited / totalCredited) * 1000) / 1000,
    familiarFaster,
    priorSpanHours: previous?.hours ?? null,
    productionRegainedHours: era.productionRegained === null ? null : Math.round((era.productionRegained.credited / 3600) * 100) / 100,
    priorDepthPassedHours: era.priorDepthPassed === null ? null : Math.round((era.priorDepthPassed.credited / 3600) * 100) / 100,
    rebuildingShare:
      era.productionRegained === null || hours === null || hours <= 0
        ? null
        : Math.round((era.productionRegained.credited / (hours * 3600)) * 1000) / 1000,
    purchases: span
      .filter((event) => event.ok && (
        event.kind === "arete" ||
        (event.kind === "world" && !isWorldPlacement(event))))
      .map((event) => event.label),
    nousPurchases: span.filter((event) => event.ok && event.kind === "purchase").length,
    placements: span
      .filter((event) => event.ok && isWorldPlacement(event))
      .map((event) => event.label),
    defeats: span
      .filter((event) => event.ok && event.kind === "milestone" &&
        event.label.startsWith(WORLD_DEFEAT_PREFIX) && event.label.includes(" defeated"))
      .map((event) => event.label.slice(WORLD_DEFEAT_PREFIX.length).replace(" defeated", "")),
    gaps: gapsOf(decisions),
    finite: era.finite,
  };
}

// One run's row: the clocks, the banks, the frontiers, every era's view,
// and the honest stop.
export interface LaterEraRow {
  readonly seed: number;
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly complete: boolean;
  readonly stopKind: string;
  readonly stopReason: string;
  readonly days: number;
  readonly elapsedHours: number;
  readonly creditedHours: number;
  readonly manageBreaks: number;
  readonly claims: readonly number[];
  readonly claimTarget: number;
  // The frontier after each closed era's bank — strictly increasing while
  // the claims bank.
  readonly frontiers: readonly number[];
  readonly eras: readonly LaterEraView[];
  // The currency-integrity read: the state's whole intake against
  // everything the walk earned through real sessions and breathers.
  readonly noGrant: boolean;
  readonly defeats: readonly string[];
  readonly bottleneck: string | null;
  readonly note: string;
}

export function laterEraRow(seed: number, sessionMinutes: number, record: PlaythroughRecord): LaterEraRow {
  const views: LaterEraView[] = [];
  for (let index = 0; index < record.eras.length; index++) {
    const era = record.eras[index]!;
    // The just-opened successor at a successful terminal bank is not an
    // attempted, incomplete era. Keep genuine open walks, including era 0.
    if (index > 0 && era.claim === null && era.familiarCredited + era.newCredited === 0 &&
      era.startElapsed === record.elapsedSeconds) continue;
    views.push(laterEraView(record, index, views[index - 1] ?? null));
  }
  const drift = Math.abs(record.state.totalEarned - record.earnedNous);
  return {
    seed,
    sessionMinutes,
    policy: record.policy.id,
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
    noGrant: drift < Math.max(1, record.earnedNous) * 1e-12,
    defeats: record.worldDefeats,
    bottleneck: record.bottleneck,
    note: playthroughNote(record),
  };
}

export function laterEraRecipe(seed: number, sessionMinutes: number, policyId: string): PlaythroughRecipe {
  return composePlaythroughRecipe({
    seed,
    policyId,
    claimTarget: 2,
    eras: TARGET_ERAS,
    budgetDays: sessionMinutes === BASELINE_SESSION_MINUTES ? BASELINE_BUDGET_DAYS : LONG_BUDGET_DAYS,
    schedule: {
      sessionsPerDay: 2,
      sessionMinutes,
      breatherMinutes: 5,
    },
  });
}

// ── The smoke tier (issue #506) ────────────────────────────────────────────

// The recording CLI's smoke tier declares its own small bound here, in
// the module the recorders compile: one seed, one short session shape,
// a single credited hour, a 3-day budget — far under the later-era
// window's floor (5 credited hours). The walk finishes in seconds; the
// pipeline (argument validation, persistence, validation, composition)
// is what smoke certifies, never balance evidence. Explicitly named so
// it can never be mistaken for the matrix's era-counted walks.
export const LATER_ERA_SMOKE = {
  seed: LATER_ERA_SEEDS[0],
  sessionMinutes: BASELINE_SESSION_MINUTES,
  policyId: "support",
  stopCreditedHours: 1,
  budgetDays: 3,
} as const;

export function laterEraSmokeRecipe(): PlaythroughRecipe {
  return {
    ...laterEraRecipe(LATER_ERA_SMOKE.seed, LATER_ERA_SMOKE.sessionMinutes, LATER_ERA_SMOKE.policyId),
    stopCreditedHours: LATER_ERA_SMOKE.stopCreditedHours,
    budgetDays: LATER_ERA_SMOKE.budgetDays,
  };
}

// The later-era distribution for one schedule×policy slice: per-seed era
// classes, never an average alone.
export interface LaterEraDistribution {
  readonly sessionMinutes: number;
  readonly policy: string;
  // Per-seed, the closed later eras' classes in era order.
  readonly erasBySeed: readonly {
    readonly seed: number;
    readonly classes: readonly { readonly index: number; readonly eraClass: EraTimingClass; readonly hours: number | null }[];
  }[];
  readonly counts: { readonly inWindow: number; readonly under: number; readonly over: number; readonly open: number };
}

export function laterEraDistribution(rows: readonly LaterEraRow[]): LaterEraDistribution {
  const erasBySeed = rows.map((row) => ({
    seed: row.seed,
    classes: row.eras
      .filter((era) => era.index > 0)
      .map((era) => ({ index: era.index, eraClass: era.eraClass, hours: era.hours })),
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

export interface LaterEraReport {
  readonly target: { readonly minHours: number; readonly maxHours: number; readonly eras: number };
  readonly seeds: readonly number[];
  readonly budgets: { readonly baselineDays: number; readonly longDays: number };
  readonly policies: readonly string[];
  readonly source: PlaythroughSource;
  readonly runs: readonly LaterEraRow[];
  readonly distributions: readonly LaterEraDistribution[];
}

// One declared slice: the eight seeds for one session shape × one policy —
// the unit the recorded matrix runs in, so a recording interruption loses
// at most its own slice and the slices compose (issue #491).
export function laterEraSliceRows(sessionMinutes: number, policyId: string): LaterEraRow[] {
  return LATER_ERA_SEEDS.map((seed) =>
    laterEraRow(seed, sessionMinutes, runPlaythrough(laterEraRecipe(seed, sessionMinutes, policyId))));
}

// The full declared report, composed from the slices: eight seeds × two
// session shapes × the three declared World policies, with the per-slice
// distribution reads.
export function laterEraReport(runs: readonly LaterEraRow[]): LaterEraReport {
  if (runs.length !== LATER_ERA_SEEDS.length * 2 * WORLD_POLICIES.length) {
    throw new Error(
      `Later-era report: expected ${LATER_ERA_SEEDS.length * 2 * WORLD_POLICIES.length} recorded runs, found ${runs.length}.`,
    );
  }
  const distributions = [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES].flatMap((sessionMinutes) =>
    WORLD_POLICIES.map((policyId) =>
      laterEraDistribution(runs.filter((row) => row.sessionMinutes === sessionMinutes && row.policy === policyId)),
    ),
  );
  return {
    target: { minHours: LATER_ERA_MIN_HOURS, maxHours: LATER_ERA_MAX_HOURS, eras: TARGET_ERAS },
    seeds: LATER_ERA_SEEDS,
    budgets: { baselineDays: BASELINE_BUDGET_DAYS, longDays: LONG_BUDGET_DAYS },
    policies: [...WORLD_POLICIES],
    source: playthroughSource(),
    runs,
    distributions,
  };
}

// ── The no-refund route probe (issue #491's fourth criterion) ──────────

// At each tested frontier — the exact recorded state each of the walk's
// banks produced, its claim unspent — every affordable purchase order
// rides the engine's own purchase and placement actions, and each order's
// route is read: the purchases land, nothing refunds, the recorded state
// stays finite, the rig's seats exist beside the fight and the charge
// line, and the pieces the order skipped are priced from the same state.
// Purchase, finite, and structural-seat reads are distinct from forward
// progress. Only a directly continued branch can establish that; an
// unreached budget is not silently called either a route or a trap.
export type RoutePiece = "entry" | "column" | "hone";

// A piece's price at one bank state, read off the authored ladders — the
// Column and Hone prices grow with what the walk already owns, so a
// later frontier enumerates its own prices, never the first rungs.
export function routePiecePriceAt(state: GameState, piece: RoutePiece): number | null {
  if (piece === "entry") return state.catalogEntryOwned ? null : BALANCE.catalogEntryCost;
  if (piece === "column") return columnCost(state.world.columns.length);
  return honeCostOf(state, "chargeBlade");
}

// Every affordable order at one state: the empty route, each single
// affordable piece, and every permutation of the affordable set within
// the budget.
export function affordableOrdersAt(state: GameState): readonly RoutePiece[][] {
  const pieces: RoutePiece[] = ["entry", "column", "hone"];
  const priced = pieces.flatMap((piece) => {
    const price = routePiecePriceAt(state, piece);
    return price === null ? [] : [{ piece, price }];
  });
  const orders: RoutePiece[][] = [[]];
  const walk = (prefix: RoutePiece[], left: typeof priced, spent: number): void => {
    for (const { piece, price } of left) {
      if (spent + price > state.arete) continue;
      const next = [...prefix, piece];
      orders.push(next);
      walk(next, left.filter((entry) => entry.piece !== piece), spent + price);
    }
  };
  walk([], priced, 0);
  return orders;
}

export interface RouteProbeOrder {
  readonly order: readonly RoutePiece[];
  readonly spend: number;
  // Every purchase in the order landed through the engine's own action.
  readonly purchasesOk: boolean;
  // The rig's seats existed and the placements landed: the weapon beside
  // the first enemy's cell, the Column beside the charge line.
  readonly placementsOk: boolean;
  // The finite read over the state the order left.
  readonly finite: boolean;
  // Null in the cheap enumeration tier, never inferred from another
  // branch's walk. The recording tier continues this exact configuration.
  readonly forward: RouteForward | null;
}

export interface RouteForward {
  readonly outcome: "advanced" | "unreached";
  readonly runId: string;
  readonly recipe: PlaythroughRecipe;
  readonly frontierAfter: number;
  readonly creditedHours: number;
  readonly defeats: readonly string[];
  readonly noGrant: boolean;
  readonly noRefund: boolean;
  readonly finite: boolean;
}

// One tested frontier's probe: the bank's claim and the frontier it
// advanced to, the pieces the ladders offered at that state, and every
// affordable order's reads.
export interface RouteBankProbe {
  readonly frontier: number;
  readonly claim: number;
  readonly budget: number;
  readonly pieces: readonly { readonly piece: RoutePiece; readonly price: number }[];
  readonly orders: readonly RouteProbeOrder[];
  // True only if this bank has a directly continued configuration that
  // banked a strictly greater frontier. Placement alone proves nothing.
  readonly routeDemonstrated: boolean;
}

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function probeBuy(state: GameState, piece: RoutePiece, rng: () => number): boolean {
  if (piece === "entry") return buyCatalogEntry(state, rng).ok;
  if (piece === "column") return buyChargeColumn(state).ok;
  return buyHoneRank(state, "chargeBlade").ok;
}

// The rig's placements through the engine's own action: the weapon on a
// free owned cell beside the first enemy's authored cell, the Column on a
// free owned cell whose module can receive charge beside a charge source
// (the same topological line the placement leg reads), preferring one
// that also touches the weapon. Returns whether both landed.
function probePlace(state: GameState): boolean {
  const first = WORLD_ENEMIES[0]!;
  const free = state.cells.filter((cell) => !enemyDefAt(cell) && !worldOccupantAt(state, cell));
  const weapon = state.world.weapons[0];
  if (!weapon) return false;
  const weaponSeat = free.find((cell) => adjacent(cell, first.pos));
  if (!weaponSeat || !placeWorldOccupant(state, weapon.id, weaponSeat).ok) return false;
  const column = state.world.columns[0];
  if (!column) return false;
  const columnSeat = chargeLineCells(state).find((cell) =>
    !enemyDefAt(cell) && !worldOccupantAt(state, cell) && adjacent(cell, weaponSeat));
  return columnSeat !== undefined && placeWorldOccupant(state, column.id, columnSeat).ok;
}

// The probe itself, over one recorded walk: one probe per bank the walk
// landed, each against that bank's own unspent state.
export function routeProbes(record: PlaythroughRecord, forward?: { budgetDays: number }): RouteBankProbe[] {
  const banks = record.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.kind === "prestige" && event.ok);
  if (banks.length === 0) throw new Error("Route probe: the walk never banked its first claim — extend the budget.");
  const probes: RouteBankProbe[] = [];
  for (let bank = 0; bank < banks.length; bank++) {
    const base = record.snapshots[banks[bank]!.event.snapshot]!.state;
    if (base.arete < 0) throw new Error("Route probe: the bank state's Arete is unreadable.");
    const pieces = (["entry", "column", "hone"] as const).flatMap((piece) => {
      const price = routePiecePriceAt(base, piece);
      return price === null ? [] : [{ piece, price }];
    });
    const orders: RouteProbeOrder[] = [];
    for (const order of affordableOrdersAt(base)) {
      const prepared = prepareProbeOrder(record, bank, order);
      orders.push({
        order,
        spend: prepared.spend,
        purchasesOk: prepared.purchasesOk,
        placementsOk: prepared.placementsOk,
        finite: prepared.finite,
        forward: forward && prepared.purchasesOk ? probeForwardFor(record, prepared, forward.budgetDays) : null,
      });
    }
    probes.push({
      frontier: base.world.frontier,
      claim: record.eras[bank]?.claim ?? 0,
      budget: base.arete,
      pieces,
      orders,
      routeDemonstrated: orders.some((order) => order.forward?.outcome === "advanced"),
    });
  }
  return probes;
}

// One enumerated order's cheap preparation: the bank's exact unspent state
// cloned, the order's purchases made through the engine's own actions, and
// the purchases/seat/finite reads. No walk runs here — this is the
// persisted-work-unit boundary (issue #507): enumeration is cheap and
// shared, and each order's forward continuation is its own unit.
export interface PreparedProbeOrder {
  readonly bankIndex: number;
  readonly order: readonly RoutePiece[];
  readonly spend: number;
  // Every purchase in the order landed through the engine's own action.
  readonly purchasesOk: boolean;
  // The rig's seats existed and the placements landed: the weapon beside
  // the first enemy's cell, the Column beside the charge line.
  readonly placementsOk: boolean;
  // The finite read over the state the order left.
  readonly finite: boolean;
  // The bought clone the forward continues; null when purchases failed.
  readonly state: GameState | null;
  readonly bankEvent: PlaythroughEvent;
}

export function prepareProbeOrder(
  record: PlaythroughRecord,
  bankIndex: number,
  order: readonly RoutePiece[],
): PreparedProbeOrder {
  const banks = record.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.kind === "prestige" && event.ok);
  if (banks.length === 0) throw new Error("Route probe: the walk never banked its first claim — extend the budget.");
  const bank = banks[bankIndex];
  if (!bank) throw new Error(`Route probe: the walk carries no bank ${bankIndex}.`);
  const base = record.snapshots[bank.event.snapshot]!.state;
  if (base.arete < 0) throw new Error("Route probe: the bank state's Arete is unreadable.");
  const state = cloneState(base);
  const rng = seededRng(record.recipe.seed + bankIndex);
  let purchasesOk = true;
  let spend = 0;
  for (const piece of order) {
    const price = routePiecePriceAt(state, piece);
    if (price === null || !probeBuy(state, piece, rng)) {
      purchasesOk = false;
      break;
    }
    spend += price;
  }
  return {
    bankIndex,
    order,
    spend,
    purchasesOk,
    placementsOk: probePlace(cloneState(state)),
    finite: stateNumbersFinite(state),
    state: purchasesOk ? state : null,
    bankEvent: bank.event,
  };
}

// The order's forward continuation — the expensive walk that used to hide
// inside composition (issue #507) and now executes as its own persisted
// work unit, on a worker process, under the unit's own identity.
export function probeForwardFor(
  parent: PlaythroughRecord,
  prepared: PreparedProbeOrder,
  budgetDays: number,
): RouteForward {
  if (!prepared.state) throw new Error("Route forward: the order's purchases did not land — no state to continue.");
  return walkRouteForward(parent, prepared.bankEvent, prepared.bankIndex, prepared.state, budgetDays);
}

// No second simulator: use the same runner on a clone of the exact bank
// after the enumerated irreversible purchases. Remaining currency follows
// the support policy; no further Arete exists until a real later bank.
// One positive claim suffices to demonstrate a route past this frontier.
export function walkRouteForward(
  parent: PlaythroughRecord,
  bank: PlaythroughEvent,
  bankIndex: number,
  state: GameState,
  budgetDays: number,
): RouteForward {
  const recipe = composePlaythroughRecipe({
    ...parent.recipe,
    seed: parent.recipe.seed + bankIndex,
    policyId: "support",
    claimTarget: 1,
    eras: 1,
    budgetDays,
    schedule: { ...parent.recipe.schedule, startAt: parent.recipe.schedule.startAt + bank.at * 1000 },
  });
  const continuation = continuePlaythrough(recipe, state, parent.source);
  const earned = continuation.state.totalEarned - state.totalEarned;
  const drift = Math.abs(earned - continuation.earnedNous);
  return {
    outcome: continuation.state.world.frontier > state.world.frontier ? "advanced" : "unreached",
    runId: continuation.runId,
    recipe: continuation.recipe,
    frontierAfter: continuation.state.world.frontier,
    creditedHours: continuation.creditedSeconds / 3600,
    defeats: continuation.worldDefeats,
    noGrant: drift < Math.max(1, state.totalEarned, continuation.earnedNous) * 1e-12,
    noRefund: continuation.state.arete <= state.arete + continuation.claims.reduce((sum, claim) => sum + claim, 0) &&
      continuation.state.world.columns.length >= state.world.columns.length &&
      continuation.state.world.hone.chargeBlade >= state.world.hone.chargeBlade &&
      (!state.catalogEntryOwned || continuation.state.catalogEntryOwned),
    finite: continuation.snapshots.every((snapshot) => stateNumbersFinite(snapshot.state) && Number.isFinite(snapshot.rate)),
  };
}

// ── The resumable evaluation job (issue #507) ──────────────────────────────
//
// One supported interface records this evaluation as a job of persisted
// work units: every completed seed walk (and the probe walk and each of
// its route forwards) lands atomically in the job directory under its own
// identity, so an interruption loses in-flight work only. Relaunching
// reuses a stored unit exactly when its identity — the behavior-affecting
// inputs, and nothing else — matches the inputs this checkout would run.
// The identity lives here, beside the evaluation logic it names, so the
// CLI and the verification exercise one recording boundary.

// Bumped only when the recorded figures' meaning changes — the row and
// era reads, the report's assertions, the probe reads. A change here
// invalidates every stored unit (the figures would read differently), and
// a report-format change that does not touch these semantics must not.
export const LATER_ERA_EVALUATION_VERSION = 1;

// The probe walk's declared basis (issue #491's recorded probes): the
// seed-23 long-session support walk whose banks the route probes read.
export const PROBE_WALK_SEED = 23;

// Each route order's forward continuation budget — the same declared
// budget composition always used for these continuations.
export const PROBE_FORWARD_BUDGET_DAYS = LONG_BUDGET_DAYS;

export function laterEraProbeWalkRecipe(): PlaythroughRecipe {
  return laterEraRecipe(PROBE_WALK_SEED, LONG_SESSION_MINUTES, "support");
}

// What a stored unit must match to be reused, computed fresh from the
// inputs this checkout would run. Engine and runner source (the compiled
// fingerprint), the full recipe — seed, schedule shape, calendar basis,
// budgets, stops — the evaluation-logic version, the allocation solver's
// declared settings, and the runtime. Nothing report-shaped appears: a
// report-format change never discards completed evidence. A forward adds
// its bank, order, budget, and its parent probe-walk identity, so a
// changed parent invalidates its forwards by construction.
export interface LaterEraUnitIdentity {
  readonly engine: PlaythroughSource;
  readonly evaluation: number;
  readonly solver: { readonly maxNodes: number; readonly maxMs: number };
  readonly runtime: { readonly node: string };
  readonly recipe: PlaythroughRecipe | null;
  readonly forward: {
    readonly bank: number;
    readonly order: readonly RoutePiece[];
    readonly budgetDays: number;
    readonly parent: LaterEraUnitIdentity | null;
  } | null;
}

export type LaterEraUnitKey =
  | { readonly kind: "seed"; readonly seed: number; readonly minutes: number; readonly policy: string }
  | { readonly kind: "probe-walk" }
  | { readonly kind: "probe-forward"; readonly bank: number; readonly orderIndex: number };

// One planned work unit: what a worker executes, as plain data. The full
// recipe rides the descriptor (seed and probe-walk units), so a worker
// never re-derives anything from the declared matrix — the plan is the
// whole instruction.
export interface LaterEraUnitDescriptor {
  readonly id: string;
  readonly key: LaterEraUnitKey;
  readonly recipe: PlaythroughRecipe | null;
  readonly forward: {
    readonly bank: number;
    readonly order: readonly RoutePiece[];
    readonly budgetDays: number;
    readonly parentIdentity: LaterEraUnitIdentity;
  } | null;
  readonly deps: readonly string[];
}

export function laterEraUnitId(key: LaterEraUnitKey): string {
  if (key.kind === "seed") return `seed-${key.minutes}-${key.policy}-${key.seed}`;
  if (key.kind === "probe-walk") return "probe-walk";
  return `forward-b${key.bank}-o${key.orderIndex}`;
}

function seedUnit(seed: number, minutes: number, policy: string, recipe: PlaythroughRecipe): LaterEraUnitDescriptor {
  return { id: laterEraUnitId({ kind: "seed", seed, minutes, policy }), key: { kind: "seed", seed, minutes, policy }, recipe, forward: null, deps: [] };
}

function probeWalkUnit(recipe: PlaythroughRecipe): LaterEraUnitDescriptor {
  return { id: laterEraUnitId({ kind: "probe-walk" }), key: { kind: "probe-walk" }, recipe, forward: null, deps: [] };
}

function forwardUnit(
  bank: number,
  orderIndex: number,
  order: readonly RoutePiece[],
  parentIdentity: LaterEraUnitIdentity,
): LaterEraUnitDescriptor {
  return {
    id: laterEraUnitId({ kind: "probe-forward", bank, orderIndex }),
    key: { kind: "probe-forward", bank, orderIndex },
    recipe: null,
    forward: { bank, order, budgetDays: PROBE_FORWARD_BUDGET_DAYS, parentIdentity },
    deps: [laterEraUnitId({ kind: "probe-walk" })],
  };
}

export function laterEraUnitIdentity(descriptor: LaterEraUnitDescriptor): LaterEraUnitIdentity {
  return {
    engine: playthroughSource(),
    evaluation: LATER_ERA_EVALUATION_VERSION,
    solver: { maxNodes: DEFAULT_ALLOCATION_BUDGET.maxNodes, maxMs: DEFAULT_ALLOCATION_BUDGET.maxMs },
    runtime: { node: process.version },
    recipe: descriptor.recipe,
    forward: descriptor.forward === null ? null : {
      bank: descriptor.forward.bank,
      order: descriptor.forward.order,
      budgetDays: descriptor.forward.budgetDays,
      parent: descriptor.forward.parentIdentity,
    },
  };
}

// The evaluation job's declared plan: every matrix seed of every slice,
// then the probe walk. The plan builder asserts id and key uniqueness —
// two units claiming the same evidence are a plan defect, refused here
// before any walk. The forward units are not enumerable until the probe
// walk's banks exist; `derive` builds them from the persisted probe-walk
// result, under the walk's own identity, so the fan-out rides the job.
export interface LaterEraJobPlan {
  readonly units: readonly LaterEraUnitDescriptor[];
  readonly derive: (banks: readonly RouteBankProbe[], probeWalkIdentity: LaterEraUnitIdentity) => readonly LaterEraUnitDescriptor[];
}

function assertPlanUnique(units: readonly LaterEraUnitDescriptor[], known: readonly string[] = []): void {
  const ids = new Set<string>(known);
  const keys = new Set<string>();
  for (const unit of units) {
    if (ids.has(unit.id)) throw new Error(`Later-era job plan: duplicate unit id "${unit.id}".`);
    const keyText = JSON.stringify(unit.key);
    if (keys.has(keyText)) throw new Error(`Later-era job plan: duplicate unit key ${keyText} (unit "${unit.id}").`);
    ids.add(unit.id);
    keys.add(keyText);
    for (const dep of unit.deps) {
      if (!ids.has(dep)) throw new Error(`Later-era job plan: unit "${unit.id}" depends on unplanned unit "${dep}".`);
    }
  }
}

export function laterEraJobPlan(): LaterEraJobPlan {
  const units = [
    probeWalkUnit(laterEraProbeWalkRecipe()),
    ...[BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES].flatMap((minutes) =>
      WORLD_POLICIES.map((policy) => ({ minutes, policy })),
    ).flatMap(({ minutes, policy }) =>
      LATER_ERA_SEEDS.map((seed) => seedUnit(seed, minutes, policy, laterEraRecipe(seed, minutes, policy))),
    ),
  ];
  assertPlanUnique(units);
  return {
    units,
    derive: (banks, probeWalkIdentity) => {
      // The forwards' declared dependency — the probe walk — is known
      // from the plan the supervisor already carries; the forwards array
      // itself is validated against that known id, not alone.
      const forwards = banks.flatMap((probe, bank) =>
        probe.orders.map((order, orderIndex) =>
          forwardUnit(bank, orderIndex, order.order, probeWalkIdentity)),
      );
      assertPlanUnique(forwards, [laterEraUnitId({ kind: "probe-walk" })]);
      return forwards;
    },
  };
}

// One slice's plan (a targeted `run 25:support`): that slice's eight
// declared seeds — the same units the full evaluation plans, so a
// targeted run and the full evaluation share evidence.
export function laterEraSliceJobPlan(minutes: number, policy: string): LaterEraJobPlan {
  const units = LATER_ERA_SEEDS.map((seed) => seedUnit(seed, minutes, policy, laterEraRecipe(seed, minutes, policy)));
  assertPlanUnique(units);
  return { units, derive: () => [] };
}

// The smoke tier's plan (issue #506's bounded seam, carried into the job
// interface): one tiny seed unit on the smoke recipe. Never mixes with
// the matrix — smoke publishes only into isolated output.
export function laterEraSmokeJobPlan(): LaterEraJobPlan {
  const seed = LATER_ERA_SMOKE.seed;
  const recipe = laterEraSmokeRecipe();
  const units = [seedUnit(seed, recipe.schedule.sessionMinutes, recipe.policyId, recipe)];
  assertPlanUnique(units);
  return { units, derive: () => [] };
}

// A tiny multi-unit evaluation (the interruption/resume demonstration
// seam): three tiny seed units — seconds each — so the real supervisor
// loop, resume, cancellation, and notification run inside a test. Every
// seed walks its own recipe: the units' identities must separate them.
export function laterEraTinyJobPlan(seeds: readonly number[] = [42, 468, 157]): LaterEraJobPlan {
  const units = seeds.map((seed) => {
    const recipe = laterEraSmokeRecipe();
    return seedUnit(seed, recipe.schedule.sessionMinutes, recipe.policyId, { ...recipe, seed });
  });
  assertPlanUnique(units);
  return { units, derive: () => [] };
}

// ── The unit checks, shared by worker, supervisor, and composition ────────

// The mechanical per-walk checks both the matrix slices and the smoke
// walk validate (issue #506): finite state and rate at every snapshot,
// event credit matching its snapshot, the prior depth's credit carried
// into the era, and every era's defeats read off its own pre-bank board.
export function assertLaterEraWalk(record: PlaythroughRecord): void {
  const banks = record.events.flatMap((event, index) => event.kind === "prestige" && event.ok ? [index] : []);
  for (const [index, bank] of banks.entries()) {
    const last = record.events.slice(0, bank).reverse().find(event => event.kind === "session" || event.kind === "breather");
    const state = record.snapshots[last!.snapshot].state;
    const defeats = Object.entries(state.world.enemies).filter(([, enemy]) => enemy.discovered && enemy.hp === 0).map(([key]) => key);
    assert.deepEqual(laterEraView(record, index, null).defeats, defeats);
  }
  for (const snapshot of record.snapshots) {
    assert.equal(stateNumbersFinite(snapshot.state), true, "the recorded state stayed finite");
    assert.ok(Number.isFinite(snapshot.rate), "the credited rate stayed finite");
  }
  for (const event of record.events) assert.equal(record.snapshots[event.snapshot]!.credited, event.credited);
  for (const era of record.eras) {
    if (era.priorDepthPassed) assert.equal(era.familiarCredited, era.priorDepthPassed.credited);
  }
}

// The row core both the matrix rows and the smoke row validate (issue
// #506): currency integrity, finite banked state, the familiar/new hour
// split, and strict frontier advance at every closed era.
export function assertLaterEraRowCore(row: LaterEraRow): void {
  assert.equal(row.noGrant, true);
  let frontier = 0;
  for (const era of row.eras) {
    if (era.claim === null) continue;
    assert.equal(era.finite, true);
    if (era.index > 0) assert.ok(Math.abs(era.familiarHours + era.newHours - era.hours!) < 0.02);
    assert.ok(era.frontierAfter! > frontier);
    frontier = era.frontierAfter!;
  }
}

// The smoke row's own checks (issue #506): the walk completed at its
// declared credited bound and stays under the later-era window's floor —
// the bounded seam cannot pass a smoke row off as later-era evidence.
export function assertLaterEraSmokeRow(row: LaterEraRow): void {
  assertLaterEraRowCore(row);
  assert.equal(row.complete, true, "the smoke walk completes at its declared bound");
  assert.equal(row.stopKind, "century", "the smoke walk completes at its declared credited stop");
  assert.ok(row.creditedHours >= LATER_ERA_SMOKE.stopCreditedHours, `credited ${row.creditedHours} below the smoke bound`);
  assert.ok(row.creditedHours < LATER_ERA_MIN_HOURS, "a smoke row stays under the later-era window — it is not later-era evidence");
}

// What one kind's stored unit must carry. The supervisor and the worker
// both run this: the worker before persisting (a unit never persists in
// a shape its own module cannot read back), the supervisor when a worker
// exits (a worker that claimed success without a readable unit is a
// named failure, never silent reuse).
export function validateLaterEraUnit(descriptor: LaterEraUnitDescriptor, payload: {
  readonly unit?: unknown;
  readonly key?: unknown;
  readonly identity?: unknown;
  readonly result?: Record<string, unknown>;
}): void {
  assert.equal(payload.unit, descriptor.id, "the stored unit names its own id");
  assert.deepEqual(payload.key, descriptor.key, "the stored unit's key matches its plan key");
  assertLaterEraUnitShape(descriptor, payload);
  const result = payload.result;
  if (descriptor.key.kind === "seed") {
    const row = result?.row as LaterEraRow | undefined;
    assert.ok(row, "the seed unit carries its row");
    assertLaterEraRowCore(row!);
    assert.equal(row!.seed, descriptor.key.seed);
    assert.equal(row!.sessionMinutes, descriptor.key.minutes);
    assert.equal(row!.policy, descriptor.key.policy);
  } else if (descriptor.key.kind === "probe-walk") {
    const row = result?.row as LaterEraRow | undefined;
    const banks = result?.banks as RouteBankProbe[] | undefined;
    const record = result?.record as PlaythroughRecord | undefined;
    assert.ok(row, "the probe-walk unit carries its row");
    assertLaterEraRowCore(row!);
    assert.ok(banks, "the probe-walk unit carries its banks");
    assert.ok(banks!.length >= 1, "the probe walk banked at least one claim");
    assert.ok(record, "the probe-walk unit carries its record");
    assert.ok(record!.snapshots.length > 0, "the probe-walk record carries snapshots");
    assert.deepEqual(record!.recipe, descriptor.recipe, "the carried record is the planned walk");
    assert.equal(row!.seed, PROBE_WALK_SEED);
  } else {
    const prepared = result?.prepared as { readonly order?: unknown } | undefined;
    const forward = result?.forward as RouteForward | undefined;
    assert.ok(prepared, "the forward unit carries its preparation");
    assert.deepEqual(prepared!.order, descriptor.forward!.order, "the forward unit's order matches its plan");
    assert.ok(forward, "the forward unit carries its forward continuation");
    assert.ok(forward!.outcome === "advanced" || forward!.outcome === "unreached", "the forward names its outcome");
    assert.equal(typeof forward!.runId, "string", "the forward names its run");
  }
}

function assertLaterEraUnitShape(descriptor: LaterEraUnitDescriptor, payload: { readonly identity?: unknown }): void {
  assert.ok(payload.identity && typeof payload.identity === "object", "the stored unit carries its identity");
  const identity = payload.identity as LaterEraUnitIdentity;
  assert.ok(identity.engine, "the unit identity names the engine source");
  assert.equal(identity.evaluation, LATER_ERA_EVALUATION_VERSION, "the unit identity names the evaluation version");
  assert.ok(identity.solver && typeof identity.solver.maxNodes === "number", "the unit identity names the solver budget");
  assert.ok(identity.runtime && typeof identity.runtime.node === "string", "the unit identity names the runtime");
  if (descriptor.recipe === null) assert.equal(identity.recipe, null, "a forward unit carries no recipe identity");
  else assert.deepEqual(identity.recipe, descriptor.recipe, "the unit identity carries the planned recipe");
}

// A stored unit is reusable exactly when its identity equals the identity
// this checkout would run — deep equality over the whole identity block.
export function laterEraUnitMatches(descriptor: LaterEraUnitDescriptor, payload: { readonly identity?: unknown }): boolean {
  try {
    assertLaterEraUnitShape(descriptor, payload);
    assert.deepEqual(payload.identity, laterEraUnitIdentity(descriptor));
    return true;
  } catch {
    return false;
  }
}

// ── The persisted probe evidence (issue #507) ──────────────────────────────
//
// Composition never runs a walk or a route continuation. The probe walk
// and every one of its orders' forwards are persisted work units; the
// job publishes their composed evidence, and composition verifies it.

export interface LaterEraProbeEvidence {
  readonly source: PlaythroughSource;
  readonly recordingCommit: string;
  readonly recordingEnvironment?: Record<string, unknown>;
  readonly unitProvenance: Record<string, { readonly recordingCommit: string; readonly recordingEnvironment?: Record<string, unknown> }>;
  readonly seed: number;
  readonly minutes: number;
  readonly policy: string;
  readonly walk: { readonly recipe: PlaythroughRecipe; readonly row: LaterEraRow };
  readonly banks: readonly RouteBankProbe[];
}

// Composition's verification of the probe evidence: the declared walk,
// the banks read off that walk, and every order's forward present and
// advancing — the same reads the inline composition used to enforce,
// now against persisted evidence (issue #507).
export function assertProbeEvidence(payload: unknown, label: string): asserts payload is LaterEraProbeEvidence {
  const probe = payload as LaterEraProbeEvidence;
  assert.ok(probe && typeof probe === "object", `${label} carries no probe evidence`);
  assert.ok(probe.source, `${label} names its engine source`);
  assert.equal(typeof probe.recordingCommit, "string", `${label} names its recording commit`);
  assert.deepEqual(probe.walk?.recipe, laterEraProbeWalkRecipe(),
    `${label} is not the declared probe walk (seed ${PROBE_WALK_SEED}, ${LONG_SESSION_MINUTES}-minute support) — re-record it`);
  assert.equal(probe.seed, PROBE_WALK_SEED);
  assert.equal(probe.minutes, LONG_SESSION_MINUTES);
  assert.equal(probe.policy, "support");
  assertLaterEraRowCore(probe.walk.row);
  assert.ok(probe.unitProvenance && typeof probe.unitProvenance === "object", `${label} names its units' provenance`);
  const banks = probe.banks;
  assert.ok(Array.isArray(banks), `${label} carries its probed banks`);
  // The probed frontiers are the walk's own banks — the exact sequence the
  // walk's row recorded — strictly increasing, at least two to probe.
  assert.deepEqual(banks.map((bank) => bank.frontier), probe.walk.row.frontiers,
    `${label}'s probed banks are not the walk's own banks`);
  assert.ok(banks.length >= 2, `${label} probed enough banks`);
  for (let i = 1; i < banks.length; i++) assert.ok(banks[i]!.frontier > banks[i - 1]!.frontier);
  for (const bank of banks) {
    assert.ok(bank.orders.length > 0, `${label} carries every affordable order`);
    assert.equal(bank.routeDemonstrated, true, `${label}'s frontier ${bank.frontier} demonstrates no route`);
    for (const order of bank.orders) {
      assert.ok(order.forward, `${label}'s frontier ${bank.frontier} carries an order without its persisted forward`);
      assert.equal(order.purchasesOk, true);
      assert.equal(order.finite, true);
      assert.ok(order.spend <= bank.budget);
      assert.equal(order.forward!.noGrant, true);
      assert.equal(order.forward!.noRefund, true);
      assert.equal(order.forward!.finite, true);
      assert.equal(order.forward!.outcome, "advanced");
      assert.ok(order.forward!.frontierAfter > bank.frontier);
    }
  }
}
