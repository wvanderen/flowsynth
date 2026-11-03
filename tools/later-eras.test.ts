import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BASELINE_BUDGET_DAYS,
  BASELINE_SESSION_MINUTES,
  LATER_ERA_MAX_HOURS,
  LATER_ERA_MIN_HOURS,
  LATER_ERA_SEEDS,
  LONG_BUDGET_DAYS,
  LONG_SESSION_MINUTES,
  TARGET_ERAS,
  WORLD_POLICIES,
  affordableOrdersAt,
  classifyEra,
  eraHoursOf,
  laterEraRecipe,
  laterEraRow,
  laterEraView,
  routePiecePriceAt,
  routeProbes,
  type LaterEraRow,
} from "./later-eras";
import { composePlaythroughRecipe, playthroughSource, runPlaythrough, type PlaythroughEraLedger, type PlaythroughSource } from "../src/engine/playthrough";
import { PLAYTHROUGH_POLICIES } from "../src/engine/playthrough";
import { BALANCE } from "../src/engine/constants";
import type { GameState } from "../src/engine/types";
import { exportPlaythroughArtifact, importPlaythroughArtifact } from "../src/engine/playthrough-artifact";

// The later-era evaluation's checks (issue #491, parent #484 stories 5,
// 17–27, 42–43). The declared matrix and the reading rules run always;
// the full recorded report — the 48 scheduled walks over the eight seeds,
// both session shapes, and the three declared World policies — rides the
// FLOWSYNTH_LATER_ERA_REPORT / FLOWSYNTH_LATER_ERA_SLICE gates like the
// recorded evaluations before it, so a suite pass never pays for a
// multi-hour evaluation it did not ask for. The six slices (one per
// session shape × policy) run independently and compose into the report;
// a recording interruption loses at most its own slice.

function ledgerOf(partial: Partial<PlaythroughEraLedger> & { index: number }): PlaythroughEraLedger {
  return {
    startElapsed: 0,
    startCredited: 0,
    endElapsed: null,
    endCredited: null,
    claim: null,
    frontierAfter: null,
    priorDepth: null,
    priorRate: null,
    familiarCredited: 0,
    newCredited: 0,
    productionRegained: null,
    priorDepthPassed: null,
    finite: null,
    ...partial,
  };
}

describe("the declared evaluation matrix", () => {
  it("declares the eight seeds, two session shapes, three policies, four claimed frontiers, and the window", () => {
    expect(LATER_ERA_SEEDS).toEqual([42, 468, 157, 2026, 7, 99, 11, 23]);
    expect(BASELINE_SESSION_MINUTES).toBe(25);
    expect(LONG_SESSION_MINUTES).toBe(60);
    expect(WORLD_POLICIES).toEqual(["support", "combat", "ignoring"]);
    expect(TARGET_ERAS).toBe(4);
    expect(LATER_ERA_MIN_HOURS).toBe(5);
    expect(LATER_ERA_MAX_HOURS).toBe(10);
    // The three declared policies exist in the runner's own catalog, with
    // the ignoring policy's postponed-combat rule declared in words.
    for (const policyId of WORLD_POLICIES) {
      const policy = PLAYTHROUGH_POLICIES.find((entry) => entry.id === policyId);
      expect(policy, `policy ${policyId} declared`).toBeDefined();
    }
    expect(PLAYTHROUGH_POLICIES.find((entry) => entry.id === "ignoring")!.rules.join(" ")).toContain("Never buys or deploys");
    // The recipes carry the suite's session rhythm, the declared era
    // count, and the shape's budget.
    for (const minutes of [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES]) {
      for (const policyId of WORLD_POLICIES) {
        const recipe = laterEraRecipe(LATER_ERA_SEEDS[0]!, minutes, policyId);
        expect(recipe.policyId).toBe(policyId);
        expect(recipe.schedule.sessionMinutes).toBe(minutes);
        expect(recipe.schedule.sessionsPerDay).toBe(2);
        expect(recipe.schedule.breatherMinutes).toBe(5);
        expect(recipe.claimTarget).toBe(2);
        expect(recipe.eras).toBe(TARGET_ERAS);
      }
    }
    expect(laterEraRecipe(468, BASELINE_SESSION_MINUTES, "support").budgetDays).toBe(BASELINE_BUDGET_DAYS);
    expect(laterEraRecipe(468, LONG_SESSION_MINUTES, "ignoring").budgetDays).toBe(LONG_BUDGET_DAYS);
  });

  it("classifies eras: the opening is not a later era, and an open era stays open", () => {
    expect(classifyEra(ledgerOf({ index: 0, endCredited: 40 * 3600 }))).toBe("opening");
    const later = (hours: number) => ledgerOf({ index: 1, endCredited: hours * 3600 });
    expect(classifyEra(later(7))).toBe("in-window");
    expect(classifyEra(later(4.9))).toBe("under");
    expect(classifyEra(later(10.1))).toBe("over");
    expect(classifyEra(ledgerOf({ index: 1 }))).toBe("open");
    expect(eraHoursOf(later(7))).toBeCloseTo(7, 10);
    expect(eraHoursOf(ledgerOf({ index: 1 }))).toBeNull();
  });

  it("enumerates every affordable route order at the probe's one-Arete rungs", () => {
    // The first frontier's pieces each cost their first rung — one Arete —
    // read off the authored ladders, never restated; a deeper bank's
    // ladders price their own enumeration.
    const firstRungs = { catalogEntryOwned: false, arete: 2, world: { columns: [], hone: { chargeBlade: 0 } } } as unknown as GameState;
    for (const piece of ["entry", "column", "hone"] as const) {
      expect(routePiecePriceAt(firstRungs, piece)).toBe(1);
    }
    const orders = affordableOrdersAt(firstRungs);
    // The empty route, three singles, and all six two-piece permutations.
    expect(orders).toHaveLength(10);
    expect(orders[0]).toEqual([]);
    for (const order of orders) {
      const spend = order.reduce((sum, piece) => sum + (routePiecePriceAt(firstRungs, piece) ?? 0), 0);
      expect(spend).toBeLessThanOrEqual(2);
      expect(new Set(order).size).toBe(order.length);
    }
    const broke = { ...firstRungs, arete: 0 } as unknown as GameState;
    expect(affordableOrdersAt(broke)).toEqual([[]]);
    // A deeper bank's own ladders: two Columns owned price the next at 4,
    // past a 2-Arete budget — the enumeration shrinks honestly.
    const deeper = { catalogEntryOwned: true, arete: 2, world: { columns: [{}, {}], hone: { chargeBlade: 0 } } } as unknown as GameState;
    expect(affordableOrdersAt(deeper).every((order) => !order.includes("column"))).toBe(true);
  });
});

describe("the era view and the route probe on real walks", () => {
  // A real short prompt walk: the fresh-start prompt policy over six
  // baseline days makes decisions the view reads, without reaching the
  // prestige door — its era stays honestly open.
  const promptWalk = runPlaythrough(composePlaythroughRecipe({ seed: 23, budgetDays: 6 }));

  // The declared walk the probe reads: the pushing policy on the baseline
  // shape banks its first claim, demonstrates the combat route (the
  // starter rig defeating the first enemy), and advances the frontier —
  // the tested first frontier's own surpassing-resistance evidence.
  const pushingWalk = runPlaythrough(composePlaythroughRecipe({
    seed: 23,
    budgetDays: 16,
    policyId: "pushing",
    schedule: { sessionMinutes: BASELINE_SESSION_MINUTES },
  }));

  it("reads an open era honestly: opening class, accruing split, no verdict", () => {
    expect(promptWalk.eras).toHaveLength(1);
    expect(promptWalk.eras[0]!.claim).toBeNull();
    const view = laterEraView(promptWalk, 0, null);
    expect(view.eraClass).toBe("opening");
    expect(view.hours).toBeNull();
    expect(view.newShare).not.toBeNull();
    expect(view.finite).toBeNull();
    // The era's recorded decisions feed the gap read.
    expect(view.gaps.count).toBeGreaterThan(2);
    expect(view.gaps.maxCredited).toBeGreaterThanOrEqual(0);
    // The row carries the whole read, and the currency-integrity read.
    const row = laterEraRow(23, BASELINE_SESSION_MINUTES, promptWalk);
    expect(row.noGrant).toBe(true);
    expect(row.eras).toHaveLength(1);
    expect(row.frontiers).toEqual([]);
    expect(row.creditedHours).toBeGreaterThan(0);
    expect(row.elapsedHours).toBeGreaterThan(row.creditedHours);
  });

  it("closes the first era at its bank and reads the familiar/new split", () => {
    expect(pushingWalk.claims.length).toBeGreaterThanOrEqual(1);
    const era0 = pushingWalk.eras[0]!;
    expect(era0.claim).toBe(2);
    expect(era0.frontierAfter).toBe(2);
    expect(era0.finite).toBe(true);
    expect(era0.priorDepth).toBeNull();
    // The opening era credits everything to new territory.
    expect(era0.familiarCredited).toBe(0);
    expect(era0.newCredited).toBe(era0.endCredited! - era0.startCredited);
    const view0 = laterEraView(pushingWalk, 0, null);
    expect(view0.familiarFaster).toBeNull();
    // The second era walks against the first bank's depth.
    const era1 = pushingWalk.eras[1];
    if (era1 !== undefined) {
      expect(era1.priorDepth).toBeGreaterThan(BALANCE.world.entryNous);
      expect(era1.priorRate).toBeGreaterThan(0);
      if (era1.claim !== null) {
        // A closed later era: the frontier advanced strictly beyond the
        // claimed frontier, the split covers the whole span, and the
        // finite read scanned the bank state.
        expect(era1.frontierAfter!).toBeGreaterThan(era0.frontierAfter!);
        expect(era1.familiarCredited + era1.newCredited).toBe(era1.endCredited! - era1.startCredited);
        expect(era1.finite).toBe(true);
        const view1 = laterEraView(pushingWalk, 1, view0);
        expect(view1.familiarFaster).not.toBeNull();
        expect(view1.priorDepthPassedHours).not.toBeNull();
        // The criterion's read (issue #491's second): rebuilding —
        // regaining the erased production — consumes well under half the
        // later era; the rest of its credited time develops territory.
        expect(view1.rebuildingShare).not.toBeNull();
        expect(view1.rebuildingShare!).toBeLessThan(0.5);
      }
    }
  });

  it("demonstrates the combat route surpassing the first frontier's resistance", () => {
    // The recorded defeat is the demonstration: the deployed starter rig
    // — blade, Column, charge line — killed the first enemy through the
    // engine's own combat, with no grant and no refund.
    expect(pushingWalk.worldDefeats).toContain("w0");
    const row = laterEraRow(23, BASELINE_SESSION_MINUTES, pushingWalk);
    expect(row.noGrant).toBe(true);
    const defeatViews = row.eras.filter((era) => era.defeats.includes("w0"));
    expect(defeatViews.length).toBeGreaterThan(0);
    // The era that killed carried the route's purchases and placements.
    const route = defeatViews[0]!;
    expect(route.purchases.some((label) => label.startsWith("World Column"))).toBe(true);
    expect(route.placements.length).toBeGreaterThan(0);
    // The routine nous purchases ride their count; the route is the
    // Arete-scale line.
    expect(route.nousPurchases).toBeGreaterThan(0);
  });

  it("walks every affordable order at each tested frontier without a trap", () => {
    // The pushing walk banked two claimed frontiers — the probe reads
    // both banks' unspent states, each priced from its own ladders.
    const probes = routeProbes(pushingWalk);
    expect(probes.map((probe) => probe.frontier)).toEqual([2, 4]);
    for (const probe of probes) {
      expect(probe.budget).toBeGreaterThan(0);
      // The empty order is always enumerable, and every piece's price
      // comes from the state's own ladders — the second bank's rungs are
      // deeper than the first's.
      expect(probe.orders[0]!.order).toEqual([]);
      expect(probe.pieces.length).toBeGreaterThanOrEqual(1);
      for (const row of probe.orders) {
        // Every purchase in every order landed through the engine's own
        // action, the state stayed finite, and the rig's seats existed.
        expect(row.purchasesOk).toBe(true);
        expect(row.placementsOk).toBe(true);
        expect(row.finite).toBe(true);
        // No refunds: the order's spend is its pieces' authored prices,
        // never recovered, and never above the bank's unspent claim.
        expect(row.spend).toBeLessThanOrEqual(probe.budget);
      }
    }
    // The first bank's route forward is demonstrated by the walk's own
    // later bank; the last bank's record ends there.
    expect(probes[0]!.routeDemonstrated).toBe(true);
    expect(probes[1]!.routeDemonstrated).toBe(false);
  });

  it("round-trips the walked eras through the run artifact whole", () => {
    // The artifact is the evidence's file format: a multi-era record
    // exports, imports, and keeps its era ledgers exactly — and the
    // imported copy is as read-only as a fresh walk's.
    const text = exportPlaythroughArtifact({ record: pushingWalk });
    const load = importPlaythroughArtifact(text);
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    expect(load.artifact.record.eras).toEqual(pushingWalk.eras);
    expect(load.artifact.record.claims).toEqual(pushingWalk.claims);
    expect(() => {
      (load.artifact.record.eras[0] as { claim: number }).claim = 99;
    }).toThrow();
  });
});

describe("the declared World policies' spending orders", { timeout: 1_800_000 }, () => {
  // The 600-minute fixture shape: its credited density crosses the World's
  // reveal within days, so a short budget reaches the declared spending
  // orders fast.
  const fixture = { sessionMinutes: 600, breatherMinutes: 5 } as const;
  const walk = (policyId: string) => runPlaythrough(composePlaythroughRecipe({
    seed: 23, budgetDays: 4, policyId, schedule: fixture,
  }));
  const firstWorldPurchaseAfterFirstBank = (policyId: string): string | null => {
    const record = walk(policyId);
    const firstBank = record.events.findIndex((event) => event.kind === "prestige" && event.ok);
    if (firstBank === -1) return null;
    return record.events.find((event, index) =>
      index > firstBank && event.kind === "world" && event.ok)?.label ?? null;
  };

  it("support buys its charge line before its blade; combat its blade before its charge line", () => {
    const support = firstWorldPurchaseAfterFirstBank("support");
    const combat = firstWorldPurchaseAfterFirstBank("combat");
    // The starter grant lands at the first bank, so both orders have a
    // blade to hone and a line to build — the first post-bank World
    // purchase names the policy's declared order.
    expect(support).toBe("World Column");
    expect(combat).toBe("Hone rank — chargeBlade");
  });

  it("ignoring never buys or deploys a World occupant, and still banks its claims", () => {
    const record = walk("ignoring");
    expect(record.events.some((event) => event.kind === "world")).toBe(false);
    expect(record.worldDefeats).toEqual([]);
    // The postponed-combat trade-off: the claims still bank under the
    // discovered enemies' pressure.
    expect(record.claims.length).toBeGreaterThan(0);
    // The journey's combat marks stay explicitly unplayed.
    expect(record.recovery).not.toBeNull();
    expect(record.recovery!.weaponDeployed).toBeNull();
    expect(record.recovery!.columnDeployed).toBeNull();
  });
});

describe("the recorded evaluation report", { skip: !process.env.FLOWSYNTH_LATER_ERA_REPORT && !process.env.FLOWSYNTH_LATER_ERA_SLICE, timeout: 7_200_000 }, () => {
  // The matrix records in six declared slices (one per session shape ×
  // policy), each its own invocation: FLOWSYNTH_LATER_ERA_SLICE
  // "<minutes>:<policy>" walks its eight seeds and writes its slice file;
  // FLOWSYNTH_LATER_ERA_REPORT composes the six into the recorded report.
  // A recording interruption loses at most its own slice; the walks are
  // deterministic per engine source, and every file carries (and the
  // compose verifies) the source it was recorded against.
  const slice = process.env.FLOWSYNTH_LATER_ERA_SLICE;
  const slicePath = (minutes: number, policy: string) =>
    `docs/later-era-slice-${minutes}-${policy}.json`;

  // The structural and honesty rules every recorded row must carry — the
  // same read at slice scope and at report scope.
  const assertRows = (rows: LaterEraRow[]): void => {
    for (const row of rows) {
      // Currency integrity rides every row: the state's whole intake is
      // what the walk earned — no hidden grant, no missing currency.
      expect(row.noGrant).toBe(true);
      // Every closed era's frontier advanced strictly beyond the last,
      // every closed era's bank state scanned finite, every era carries
      // a class.
      let last = 0;
      for (const era of row.eras) {
        expect(era.eraClass).toBeTruthy();
        if (era.frontierAfter !== null) {
          expect(era.frontierAfter).toBeGreaterThan(last);
          last = era.frontierAfter;
        }
        if (era.claim !== null) expect(era.finite).toBe(true);
        if (era.index > 0 && era.claim !== null) {
          expect(["in-window", "under", "over"]).toContain(era.eraClass);
          expect(era.hours).not.toBeNull();
          // The split recombines to the era's span.
          expect(era.familiarHours + era.newHours).toBeCloseTo(era.hours!, 0);
        }
      }
      // The declared policies' behavior, per row: the ignoring policy
      // never deploys; the fighting policies deploy through real
      // placements when they defeated.
      if (row.policy === "ignoring") {
        expect(row.defeats).toEqual([]);
        expect(row.eras.every((era) => era.placements.length === 0)).toBe(true);
      }
    }
  };

  it(slice ? `walks the ${slice} slice and records it` : "composes the full declared matrix from the recorded slices", async () => {
    const mod = await import("./later-eras");
    const source = playthroughSource();
    if (slice) {
      const [minutesRaw, policyId] = slice.split(":");
      const minutes = Number(minutesRaw);
      expect([BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES]).toContain(minutes);
      expect([...WORLD_POLICIES]).toContain(policyId);
      const rows = mod.laterEraSliceRows(minutes, policyId);
      expect(rows).toHaveLength(LATER_ERA_SEEDS.length);
      expect(rows.map((row) => row.seed)).toEqual(LATER_ERA_SEEDS);
      assertRows(rows);
      writeFileSync(slicePath(minutes, policyId!), JSON.stringify({ source, minutes, policy: policyId, rows }, null, 2));
      return;
    }
    const runs: LaterEraRow[] = [];
    for (const minutes of [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES]) {
      for (const policyId of WORLD_POLICIES) {
        const text = readFileSync(slicePath(minutes, policyId), "utf8");
        const recorded = JSON.parse(text) as { source: PlaythroughSource; minutes: number; policy: string; rows: LaterEraRow[] };
        // A slice composes only against the source it was recorded with.
        expect(recorded.source.engineSource).toBe(source.engineSource);
        expect(recorded.minutes).toBe(minutes);
        expect(recorded.policy).toBe(policyId);
        expect(recorded.rows).toHaveLength(LATER_ERA_SEEDS.length);
        assertRows(recorded.rows);
        runs.push(...recorded.rows);
      }
    }
    const report = mod.laterEraReport(runs);
    // 8 seeds × 2 schedules × 3 policies.
    expect(report.runs).toHaveLength(LATER_ERA_SEEDS.length * 2 * WORLD_POLICIES.length);
    expect(report.distributions).toHaveLength(6);
    expect(report.source.runnerVersion).toBeGreaterThanOrEqual(13);
    // The route enumeration at the deeper tested frontiers: one recorded
    // multi-era walk's banks — frontiers 2 through 8 — each probed against
    // its own unspent state and its own ladders, carried in the report.
    const probeWalk = runPlaythrough(mod.laterEraRecipe(23, LONG_SESSION_MINUTES, "support"));
    const routeProbes = mod.routeProbes(probeWalk);
    expect(routeProbes.map((probe) => probe.frontier)).toEqual([2, 4, 6, 8]);
    for (const probe of routeProbes) {
      for (const order of probe.orders) {
        expect(order.purchasesOk).toBe(true);
        expect(order.placementsOk).toBe(true);
        expect(order.finite).toBe(true);
        expect(order.spend).toBeLessThanOrEqual(probe.budget);
      }
    }
    const withProbes = { ...report, routeProbes };
    writeFileSync(process.env.FLOWSYNTH_LATER_ERA_REPORT!, JSON.stringify(withProbes, null, 2));
  });
});
