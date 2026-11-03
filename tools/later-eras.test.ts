import { execFileSync } from "node:child_process";
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
  walkRouteForward,
} from "./later-eras";
import { composePlaythroughRecipe, continuePlaythrough, runPlaythrough, type PlaythroughEraLedger } from "../src/engine/playthrough";
import { PLAYTHROUGH_POLICIES } from "../src/engine/playthrough";
import { BALANCE } from "../src/engine/constants";
import type { GameState } from "../src/engine/types";
import { createInitialState } from "../src/engine/state";
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

  it("enumerates orders without mistaking seats or another branch for forward progress", () => {
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
        expect(typeof row.placementsOk).toBe("boolean");
        expect(row.forward).toBeNull();
        expect(row.finite).toBe(true);
        // No refunds: the order's spend is its pieces' authored prices,
        // never recovered, and never above the bank's unspent claim.
        expect(row.spend).toBeLessThanOrEqual(probe.budget);
      }
    }
    // The empty first-bank order has no Column: a weapon seat alone is
    // not a functioning rig, and the parent's later bank proves nothing
    // about any enumerated branch.
    expect(probes[0]!.orders[0]!.placementsOk).toBe(false);
    expect(probes.every((probe) => !probe.routeDemonstrated)).toBe(true);
  });

  it("keeps crossing events, inspection clocks, and the familiar span in agreement", () => {
    const crossings = pushingWalk.events.filter((event) => event.label.includes("prior frontier's depth passed"));
    expect(crossings.length).toBeGreaterThan(0);
    for (const event of crossings) {
      expect(pushingWalk.snapshots[event.snapshot]!.credited).toBe(event.credited);
    }
    for (const era of pushingWalk.eras.filter((entry) => entry.priorDepthPassed !== null)) {
      expect(era.familiarCredited).toBe(era.priorDepthPassed!.credited);
    }
  });

  it("owns closing-session defeats and repeated kills in the era that fought them", () => {
    const banks = pushingWalk.events.flatMap((event, index) => event.kind === "prestige" && event.ok ? [index] : []);
    expect(banks.length).toBeGreaterThan(0);
    for (const [index, bank] of banks.entries()) {
      const lastSession = pushingWalk.events.slice(0, bank).reverse().find((event) => event.kind === "breather" || event.kind === "session")!;
      const state = pushingWalk.snapshots[lastSession.snapshot]!.state;
      const defeated = Object.entries(state.world.enemies).filter(([, enemy]) => enemy.discovered && enemy.hp === 0).map(([key]) => key);
      expect(laterEraView(pushingWalk, index, null).defeats).toEqual(defeated);
    }
  });

  it("keeps facts before a tied bank in the closing era and facts after it in the next", () => {
    const bank = pushingWalk.events.find((event) => event.kind === "prestige")!;
    const defeat = { ...bank, kind: "milestone" as const, label: "World — enemy w0 defeated" };
    const purchase = { ...bank, kind: "world" as const, label: "World Column" };
    const record = { ...pushingWalk,
      events: [defeat, bank, purchase],
      eras: [ledgerOf({ index: 0, endCredited: bank.credited }), ledgerOf({ index: 1, startCredited: bank.credited })],
    };
    expect(laterEraView(record, 0, null).defeats).toEqual(["w0"]);
    expect(laterEraView(record, 0, null).purchases).toEqual([]);
    expect(laterEraView(record, 1, null).defeats).toEqual([]);
    expect(laterEraView(record, 1, null).purchases).toEqual(["World Column"]);
  });

  it("continues the exact earned bank without mutating it or inferring the parent's later success", { timeout: 60_000 }, () => {
    const bank = pushingWalk.events.find((event) => event.kind === "prestige")!;
    const state = pushingWalk.snapshots[bank.snapshot]!.state;
    const before = JSON.stringify(state);
    const forward = walkRouteForward(pushingWalk, bank, 0, state, 1);
    expect(forward.outcome).toBe("unreached");
    expect(forward.frontierAfter).toBe(state.world.frontier);
    expect(forward.creditedHours).toBe(BASELINE_SESSION_MINUTES * 2 / 60);
    expect(forward.noGrant).toBe(true);
    expect(forward.noRefund).toBe(true);
    expect(forward.finite).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    const branch = continuePlaythrough(forward.recipe, state);
    expect(branch.kind).toBe("continuation");
    expect(branch.snapshots[0]!.state).toEqual(state);
    const load = importPlaythroughArtifact(exportPlaythroughArtifact({ record: branch }));
    expect(load.ok).toBe(true);
    if (load.ok) expect(load.artifact.record.kind).toBe("continuation");
  });

  it("banks a strictly greater frontier in a constructed continuation without a grant or refund", () => {
    // A labelled fast fixture, not acquisition or balance evidence: one
    // developed voice at an otherwise freshly reset, claimed frontier.
    const state = createInitialState();
    state.world.frontier = 2;
    state.modules[0]!.level = 300;
    const before = structuredClone(state);
    const recipe = composePlaythroughRecipe({ policyId: "support", claimTarget: 1, eras: 1, budgetDays: 1 });
    const branch = continuePlaythrough(recipe, state);
    expect(branch.complete).toBe(true);
    expect(branch.stop.kind).toBe("frontier");
    expect(branch.state.world.frontier).toBeGreaterThan(before.world.frontier);
    expect(branch.state.totalEarned - before.totalEarned).toBeCloseTo(branch.earnedNous, -2);
    expect(branch.state.arete).toBe(branch.claims.reduce((sum, claim) => sum + claim, 0));
    expect(state).toEqual(before);
    expect(branch.runId).toContain("-from-");
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
  // The explicit tier compiles through Vite's real raw/glob transform,
  // avoiding #503's vitest fingerprint. One recorder owns the provenance
  // checks and assertions for direct CLI and env-gated invocations alike.
  const slice = process.env.FLOWSYNTH_LATER_ERA_SLICE;
  it(slice ? `walks the ${slice} slice and records it` : "composes the full declared matrix from the recorded slices", () => {
    execFileSync(process.execPath, ["tools/record-later-eras.mjs", ...(slice ? ["slice", slice] : ["compose"])], {
      stdio: "inherit",
      timeout: 7_200_000,
    });
  });
});
