import { BALANCE, CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES, WORLD_ENEMIES } from "../src/engine/constants";
import {
  composePlaythroughRecipe,
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
import { adjacent, sameHex } from "../src/engine/hex";
import { seededRng } from "../src/engine/capacity-calibration";
import type { GameState } from "../src/engine/types";
import { meaningfulDecisions, type DecisionGap } from "./first-prestige";

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
  return record.events.filter((event) =>
    event.credited >= era.startCredited &&
    (era.endCredited === null || event.credited < era.endCredited));
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
const WORLD_PLACED_PREFIX = "Placed ";

export function laterEraView(record: PlaythroughRecord, index: number, previous: LaterEraView | null): LaterEraView {
  const era = record.eras[index];
  if (!era) throw new Error(`Later-era view: the record carries no era ${index}.`);
  const span = eraSpanEvents(record, era);
  const decisions = meaningfulDecisions(record).filter((event) =>
    event.credited >= era.startCredited &&
    (era.endCredited === null || event.credited < era.endCredited));
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
        (event.kind === "world" && !event.label.startsWith(WORLD_PLACED_PREFIX))))
      .map((event) => event.label),
    nousPurchases: span.filter((event) => event.ok && event.kind === "purchase").length,
    placements: span
      .filter((event) => event.ok && event.kind === "world" && event.label.startsWith(WORLD_PLACED_PREFIX))
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
// An order that fails a read is a progression trap — repaired in the
// placement rules, never by granting currency or refunding a purchase.
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
  // The route forward, demonstrated: the walk itself continued past this
  // bank — a later era closed against a strictly larger frontier. The
  // last bank's record ends there, so its forward read is the honest
  // false and its route evidence is the orders' own reads.
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
  if (!column) return true;
  const generatorCells = state.modules.filter((module) => module.pos !== null &&
    (CATEGORY_OF[module.type] === "generator" || CATEGORY_OF[module.type] === "conduit"))
    .map((module) => module.pos!);
  const columnSeat = free
    .filter((cell) => state.modules.some((module) => module.pos !== null && sameHex(module.pos, cell) &&
      CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[module.type]) &&
      generatorCells.some((pos) => adjacent(cell, pos))))
    .sort((a, b) => Number(adjacent(b, weaponSeat)) - Number(adjacent(a, weaponSeat)))[0];
  return columnSeat !== undefined && placeWorldOccupant(state, column.id, columnSeat).ok;
}

// The probe itself, over one recorded walk: one probe per bank the walk
// landed, each against that bank's own unspent state.
export function routeProbes(record: PlaythroughRecord): RouteBankProbe[] {
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
      const state = cloneState(base);
      const rng = seededRng(record.recipe.seed + bank);
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
      orders.push({
        order,
        spend,
        purchasesOk,
        placementsOk: probePlace(state),
        finite: stateNumbersFinite(state),
      });
    }
    probes.push({
      frontier: base.world.frontier,
      claim: record.eras[bank]?.claim ?? 0,
      budget: base.arete,
      pieces,
      orders,
      routeDemonstrated: record.eras.slice(bank + 1).some((era) => era.claim !== null),
    });
  }
  return probes;
}
