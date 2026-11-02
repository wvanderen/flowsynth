import { writeFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { BALANCE, WORLD_ENEMIES } from "../src/engine/constants";
import {
  COMBAT_POLICY,
  IGNORING_POLICY,
  PROMPT_POLICY,
  PUSHING_POLICY,
  composePlaythroughRecipe,
  runPlaythrough,
} from "../src/engine/playthrough";
import type { PlaythroughRecord } from "../src/engine/playthrough";
import { exportPlaythroughArtifact, importPlaythroughArtifact } from "../src/engine/playthrough-artifact";
import * as actions from "../src/engine/actions";
import { SCENARIOS } from "../src/engine/scenarios";
import { createInitialState, createModule } from "../src/engine/state";
import {
  BASELINE_BUDGET_DAYS,
  BASELINE_SESSION_MINUTES,
  DECLARED_ERAS,
  ERA_WINDOW_MAX_HOURS,
  ERA_WINDOW_MIN_HOURS,
  LATER_ERA_POLICIES,
  LATER_ERA_SEEDS,
  LONG_BUDGET_DAYS,
  LONG_SESSION_MINUTES,
  classifyEraHours,
  eraLedgersOf,
  frontierRoutesOf,
  laterEraRecipe,
  laterEraRow,
  laterErasReport,
  noGrantRead,
  policySlicesOf,
} from "./later-eras";
import type { EraLedger, LaterEraRow } from "./later-eras";

// The later-era evaluation's checks (issue #491, parent #484 stories 5,
// 17–27, and 42–43). The declared matrix and the reading rules run
// always; the full recorded report — the 24 scheduled walks over the four
// seeds, both session shapes, and the three declared attitudes — rides
// the FLOWSYNTH_LATER_ERAS_REPORT gate like the recorded evaluations
// before it, so a suite pass never pays for a multi-minute evaluation it
// did not ask for.
//
// The quick walks ride the fixture shape the pushing-policy cases in the
// app suite established: the real scenario entry, its assertion stubbed,
// and the prestige action patched so each bank's claim refills instantly
// — one between-sessions break banks one era. The walk, the placement
// rules, the combat clock, the purchases, and the ledgers are all the
// real ones; only the era measure's pace is fixture-fast, and the era
// measure is a depth, not a currency — the no-grant read still passes.

afterEach(() => {
  vi.restoreAllMocks();
});

const freshStart = SCENARIOS.find((scenario) => scenario.id === "fresh-start")!;

// A banking walk whose every break can bank: the prestige action banks
// for real, then refills the era measure to the depth that makes the next
// claim reach the target. Era 1 opens with the measure at the World's
// entry depth, so the first bank lands on the first break.
function refillWalk(policyId: string, eras: number, budgetDays: number, seed = 468): PlaythroughRecord {
  const build = vi.spyOn(freshStart, "build").mockImplementation(() => {
    const state = createInitialState();
    state.eraEarned = BALANCE.world.entryNous;
    return state;
  });
  const assert = vi.spyOn(freshStart, "assert").mockImplementation(() => {});
  const prestige = actions.prestige;
  const bank = vi.spyOn(actions, "prestige").mockImplementation((state, tuning) => {
    const result = prestige(state, tuning);
    state.eraEarned = BALANCE.world.entryNous * 10 ** (state.world.frontier / BALANCE.world.claimDepthSlope);
    return result;
  });
  void build;
  void assert;
  void bank;
  try {
    return runPlaythrough(composePlaythroughRecipe({
      seed,
      policyId,
      claimTarget: 2,
      eras,
      budgetDays,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 },
    }));
  } finally {
    vi.restoreAllMocks();
  }
}

// The combat fixture: a crafted mid-fight state — a generator feeding a
// synthesizer, a Charge Column on the synthesizer's cell, the starter
// blade in the tray, w0 and w1 discovered, and a small Arete purse — and
// a pending claim held just under the target, so no prestige ever
// restores the enemies. The blade deploys beside w0, starves through the
// first session (the generator's reserve credits at the session end),
// kills w0 through the Column-fed line in the second, and — its seat now
// touching no living enemy — relocates onto w1 through the real
// retrieval and placement actions, then kills w1 the same way.
function relocationWalk(policyId: string): PlaythroughRecord {
  const build = vi.spyOn(freshStart, "build").mockImplementation(() => {
    const state = createInitialState();
    // The seats: the opening footprint plus the cells the blade walks
    // between. All owned; none is an authored enemy cell.
    for (const [q, r] of [[0, -1], [-1, 1], [1, -1]] as const) {
      state.cells.push({ q, r });
    }
    // The charge line: a generator beside the opening synthesizer, the
    // Column on the synthesizer's cell copying what it receives.
    const generator = createModule(state, "focusKeyed");
    generator.pos = { q: 1, r: 0 };
    state.modules.push(generator);
    const column = { id: "column-fixture", pos: { q: 0, r: 0 } };
    state.world.columns.push(column);
    // The starter blade, granted and waiting in the tray.
    state.world.weapons.push({ id: "blade-fixture", type: "chargeBlade", pos: null, store: 0, cooldown: 0, targetPriority: [] });
    state.world.starterWeaponGranted = true;
    // The fight: w0 and w1 discovered and living.
    state.world.enemies.w0!.discovered = true;
    state.world.enemies.w1!.discovered = true;
    // A small purse for the policy's own purchases, and an era measure
    // held below the World's entry depth — the pending claim stays under
    // the target, so no prestige ever restores the enemies: the states
    // evolve with the fight, untouched by a reset.
    state.arete = 2;
    state.eraEarned = 1e7;
    return state;
  });
  const assert = vi.spyOn(freshStart, "assert").mockImplementation(() => {});
  void build;
  void assert;
  try {
    return runPlaythrough(composePlaythroughRecipe({
      seed: 468,
      policyId,
      claimTarget: 2,
      eras: 1,
      budgetDays: 2,
      schedule: { sessionsPerDay: 2, sessionMinutes: 5, breatherMinutes: 0 },
    }));
  } finally {
    vi.restoreAllMocks();
  }
}

describe("the declared later-era matrix", () => {
  it("declares the four journey seeds, both session shapes, three attitudes, four eras, and the 5–10 window", () => {
    expect(LATER_ERA_SEEDS).toEqual([42, 468, 7, 23]);
    expect(BASELINE_SESSION_MINUTES).toBe(25);
    expect(LONG_SESSION_MINUTES).toBe(60);
    expect(LATER_ERA_POLICIES).toEqual(["pushing", "combat", "ignoring"]);
    expect(DECLARED_ERAS).toBe(4);
    expect(ERA_WINDOW_MIN_HOURS).toBe(5);
    expect(ERA_WINDOW_MAX_HOURS).toBe(10);
    // The budgets are declared arithmetic, not goalposts: 4 eras at the
    // window's ceiling is 40 credited hours, and the shapes credit ~0.83
    // and ~2 flow hours per day.
    expect(BASELINE_BUDGET_DAYS).toBe(72);
    expect(LONG_BUDGET_DAYS).toBe(30);
    for (const policyId of LATER_ERA_POLICIES) {
      for (const minutes of [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES]) {
        const recipe = laterEraRecipe(468, minutes, policyId);
        expect(recipe.policyId).toBe(policyId);
        expect(recipe.eras).toBe(DECLARED_ERAS);
        expect(recipe.claimTarget).toBe(2);
        expect(recipe.schedule.sessionMinutes).toBe(minutes);
        expect(recipe.schedule.sessionsPerDay).toBe(2);
        expect(recipe.schedule.breatherMinutes).toBe(5);
        expect(recipe.budgetDays).toBe(minutes === BASELINE_SESSION_MINUTES ? BASELINE_BUDGET_DAYS : LONG_BUDGET_DAYS);
      }
    }
  });

  it("rejects era counts and prompt-era combinations the walk cannot treat", () => {
    expect(() => composePlaythroughRecipe({ eras: 0 })).toThrow(/eras must be a whole number 1–8/);
    expect(() => composePlaythroughRecipe({ eras: 1.5 })).toThrow(/eras must be a whole number 1–8/);
    expect(() => composePlaythroughRecipe({ eras: 9 })).toThrow(/eras must be a whole number 1–8/);
    expect(() => composePlaythroughRecipe({ eras: 2, policyId: PROMPT_POLICY.id }))
      .toThrow(/eras 2 needs a banking policy/);
    // The defaults still compose: a banking policy with an explicit count.
    expect(composePlaythroughRecipe({ eras: 4, policyId: PUSHING_POLICY.id }).eras).toBe(4);
  });
});

describe("the era ledger reads a real multi-era walk", () => {
  const record = refillWalk(PUSHING_POLICY.id, 4, 6);
  const ledgers = eraLedgersOf(record);
  const row = laterEraRow(468, BASELINE_SESSION_MINUTES, record);

  it("banks the declared era count with strictly larger claimed frontiers", () => {
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("eras");
    expect(record.claims).toEqual([2, 2, 2, 2]);
    expect(row.frontiers).toEqual([2, 4, 6, 8]);
    expect(row.frontierStrictlyGrowing).toBe(true);
    // Every claim advanced the claimed frontier by whole Arete — the
    // telescoping the frontier contract pins.
    for (const claim of record.claims) expect(claim).toBeGreaterThanOrEqual(1);
  });

  it("carries per-era recovery, familiar/new split, and purchases without re-walking", () => {
    expect(ledgers).toHaveLength(4);
    expect(ledgers.every((ledger) => ledger.complete)).toBe(true);
    // Era 1 climbs: no rebuild to measure, no prior peak, nothing to
    // regain — its nulls are the definition, not a miss.
    expect(ledgers[0]!.previousPeakEraEarned).toBeNull();
    expect(ledgers[0]!.familiarCreditedSeconds).toBeNull();
    expect(ledgers[0]!.productionRegainedHours).toBeNull();
    // Every later era stands read: the recovery and split fields exist,
    // landed or explicitly null (this fixture's banks land before any
    // sample of their era, so the reads are null here — the exact split
    // arithmetic has its own crafted case below, and the recorded matrix
    // carries the landed marks).
    for (const ledger of ledgers.slice(1)) {
      expect("previousPeakEraEarned" in ledger).toBe(true);
      expect("familiarCreditedSeconds" in ledger).toBe(true);
      expect("productionRegainedHours" in ledger).toBe(true);
      expect("eligibilityHours" in ledger).toBe(true);
    }
    // Each later era's depth passes the previous era's peak — the walk
    // develops new territory, it does not refight old ground only.
    for (let i = 1; i < ledgers.length; i++) {
      expect(ledgers[i]!.eraEarned).toBeGreaterThan(ledgers[i - 1]!.eraEarned);
    }
    // The fight ran: some later era's closing state carries the restored
    // roster (the fixture's banks alternate around sessions, so not every
    // era holds a session), and the purchases the banked Arete paid for
    // are on the ledgers.
    expect(ledgers.slice(1).some((ledger) => ledger.discoveries.length > 0)).toBe(true);
    expect(ledgers.some((ledger) => ledger.aretePurchases > 0)).toBe(true);
  });

  it("reads the familiar split, the previous peak, and the recovery marks exactly", () => {
    // A crafted record: two banks with known samples straddling the first
    // era's peak. The trajectory carries credited/depth/rate; the events
    // carry the two prestige stamps. Every figure the ledgers read is
    // hand-placed, so the reads are exact.
    const snapshot = (index: number, credited: number, eraEarned: number, rate: number): PlaythroughRecord["snapshots"][number] => ({
      index, elapsed: credited, credited, rate, voices: [],
      state: { ...createInitialState(), eraEarned, arete: 0 },
    } as unknown as PlaythroughRecord["snapshots"][number]);
    const point = (snapshot: number, credited: number, eraEarned: number, rate: number) =>
      ({ snapshot, elapsed: credited, credited, eraEarned, rate, forgeRate: 0, nous: 0, arete: 0 });
    const trajectory = [
      point(0, 3600, 5e6, 100),   // era 1 mid
      point(1, 7200, 1e7, 200),   // era 1's peak sample (pre-bank)
      point(2, 7300, 0, 0),       // bank 1's own post-reset sample
      point(3, 10_800, 6e6, 150), // era 2 mid — still below the rebuilt target
      point(4, 14_400, 1.2e7, 220), // era 2: peak passed, production regained
    ];
    const snapshots = [...trajectory.map((p, i) => snapshot(i, p.credited, p.eraEarned, p.rate)),
      snapshot(5, 14_500, 1.2e7, 220)]; // bank 2's own post-reset state
    const events = [
      { at: 7200, credited: 7200, kind: "prestige", label: "Prestige 1", ok: true, snapshot: 2 },
      { at: 14_400, credited: 14_400, kind: "prestige", label: "Prestige 2", ok: true, snapshot: 5 },
    ] as unknown as PlaythroughRecord["events"];
    const record = {
      complete: false, stop: { kind: "budget", reason: "fixture" }, claims: [2],
      creditedSeconds: 14_400, elapsedSeconds: 14_400, events, trajectory, snapshots,
      state: { ...createInitialState(), eraEarned: 1.2e7 },
    } as unknown as PlaythroughRecord;
    const ledgers = eraLedgersOf(record);
    expect(ledgers).toHaveLength(2);
    // Era 1: peak 1e7 at its bank; nothing before it.
    expect(ledgers[0]!.previousPeakEraEarned).toBeNull();
    expect(ledgers[0]!.eraEarned).toBe(1e7);
    expect(ledgers[0]!.preResetRate).toBe(200);
    expect(ledgers[0]!.productionRegainedHours).toBeNull();
    // Era 2: the previous peak is era 1's bank depth; the familiar/new
    // split straddles it exactly where the samples cross.
    expect(ledgers[1]!.previousPeakEraEarned).toBe(1e7);
    // Samples: 6e6 at 10 800 (below), 1.2e7 at 14 400 (above). The peak
    // crossing sits 2/3 through that span: 2400 credited seconds below,
    // the rest above.
    expect(ledgers[1]!.familiarCreditedSeconds).toBe(3600 + 2400);
    expect(ledgers[1]!.newCreditedSeconds).toBe(1200);
    // The rate era 2 must rebuild is era 1's erased rate (200); era 2
    // first matches it at its 220-rate sample — 2 credited hours into the
    // era (the era opens at the bank's own stamp, 7200). Its own bank
    // then erased 220, the figure era 3 would rebuild.
    expect(ledgers[1]!.preResetRate).toBe(220);
    expect(ledgers[1]!.productionRegainedHours).toBe(2);
    // Eligibility read the same samples: era 2's depth crosses the
    // horizon (7e6) at its 1.2e7 sample — 2 credited hours in.
    expect(ledgers[1]!.eligibilityHours).toBe(2);
    expect(ledgers[0]!.eligibilityHours).toBe(2);
  });

  it("records finite numeric state through every era and reconstructs without mutating the record", () => {
    expect(ledgers.every((ledger) => ledger.finite)).toBe(true);
    // A second read agrees, and the frozen record is untouched by either.
    const again = eraLedgersOf(record);
    expect(again).toEqual(ledgers);
  });

  it("classifies era hours against the declared window", () => {
    for (const ledger of ledgers) {
      expect(row.eraClasses[ledger.era - 1]).toBe(classifyEraHours(ledger.creditedSeconds / 3600));
    }
    expect(classifyEraHours(4.9)).toBe("under");
    expect(classifyEraHours(5)).toBe("in-window");
    expect(classifyEraHours(10)).toBe("in-window");
    expect(classifyEraHours(10.1)).toBe("over");
  });

  it("keeps the no-grant integrity read true on a fixture-paced walk", () => {
    expect(noGrantRead(record)).toBe(true);
    expect(row.noGrant).toBe(true);
  });
});

describe("the declared attitudes walk differently", () => {
  const pushing = refillWalk(PUSHING_POLICY.id, 3, 5);
  const combat = refillWalk(COMBAT_POLICY.id, 3, 5);
  const ignoring = refillWalk(IGNORING_POLICY.id, 3, 5);

  it("the pushing policy buys Charge Columns before Hone ranks; the combat policy the reverse", () => {
    const firstWorldPurchase = (record: PlaythroughRecord): string | null => {
      const event = record.events.find((event) => event.ok && event.kind === "world" &&
        (event.label === "World Column" || event.label.startsWith("Hone rank")));
      return event?.label ?? null;
    };
    expect(firstWorldPurchase(pushing)).toBe("World Column");
    expect(firstWorldPurchase(combat)).toBe("Hone rank — chargeBlade");
  });

  it("the ignoring policy banks claims while never buying a World product or deploying an occupant", () => {
    expect(ignoring.claims.length).toBeGreaterThanOrEqual(2);
    expect(ignoring.events.some((event) => event.ok && event.kind === "world")).toBe(false);
    // The starter weapon was granted — the first World-eligible bank
    // grants it unconditionally — and it still sits in the tray, unhoned.
    expect(ignoring.state.world.starterWeaponGranted).toBe(true);
    expect(ignoring.state.world.weapons[0]?.pos).toBeNull();
    expect(ignoring.state.world.hone.chargeBlade).toBe(0);
    // Discovered enemies stood the whole way: eras with a session inside
    // reveal the restored roster, and none of it ever dies.
    const ledgers = eraLedgersOf(ignoring);
    expect(ledgers.some((ledger) => ledger.discoveries.length > 0)).toBe(true);
    expect(ledgers.every((ledger) => ledger.defeats.length === 0)).toBe(true);
  });

  it("the slices compare the attitudes on banked eras, defeats, and relocation", () => {
    const rows = [
      laterEraRow(468, BASELINE_SESSION_MINUTES, pushing),
      laterEraRow(468, BASELINE_SESSION_MINUTES, combat),
      laterEraRow(468, BASELINE_SESSION_MINUTES, ignoring),
    ];
    const slices = policySlicesOf(rows);
    expect(slices.map((slice) => slice.policy)).toEqual(["pushing", "combat", "ignoring"]);
    const byPolicy = new Map(slices.map((slice) => [slice.policy, slice]));
    // The ignoring policy banks but never fights.
    expect(byPolicy.get("ignoring")!.defeats).toBe(0);
    expect(byPolicy.get("ignoring")!.bankedEras).toBeGreaterThan(0);
    // Neither pushing nor combat carries a relocation leg in this
    // fixture: every manage break reads a freshly restored, hidden
    // roster, so no seat can read as idle. The relocation behavior has
    // its own crafted case below.
    expect(byPolicy.get("pushing")!.relocations).toBe(0);
  });
});

describe("the combat-engaging policy keeps the blade on the fight", () => {
  const combat = relocationWalk(COMBAT_POLICY.id);

  it("relocates a blade whose seat touches no living enemy, through the real actions", () => {
    const relocations = combat.events.filter((event) =>
      event.kind === "world" && event.ok && event.label.includes("relocated"));
    expect(relocations.length).toBeGreaterThan(0);
    for (const event of relocations) {
      expect(event.label).toMatch(/^Placed the chargeBlade at -?\d+,-?\d+ — relocated onto the fight$/);
    }
    // The blade ended on the relocated seat, beside the enemy it went to
    // kill — and that enemy died through the same Column-fed line.
    expect(combat.state.world.weapons[0]!.pos).toEqual({ q: 0, r: 1 });
    expect(combat.state.world.enemies.w1!.hp).toBeLessThanOrEqual(0);
  });

  it("the feeding line ran the kills on the blade's own cadence", () => {
    // w0 fell mid-run to the deployed blade — the fixture's Column fed
    // it, so the kills are combat output, not the placement leg alone.
    expect(combat.state.world.enemies.w0!.hp).toBeLessThanOrEqual(0);
    expect(combat.state.world.hone.chargeBlade).toBeGreaterThanOrEqual(1);
  });
});

describe("an incomplete multi-era walk stays explicit", () => {
  // The refill is disabled after the first bank, so the budget ends
  // mid-era: one banked era, then the open era the record carries.
  const record = (() => {
    const build = vi.spyOn(freshStart, "build").mockImplementation(() => {
      const state = createInitialState();
      state.eraEarned = BALANCE.world.entryNous;
      return state;
    });
    const assert = vi.spyOn(freshStart, "assert").mockImplementation(() => {});
    const prestige = actions.prestige;
    const bank = vi.spyOn(actions, "prestige").mockImplementation((state, tuning) => {
      const result = prestige(state, tuning);
      if (state.world.frontier < 2) {
        state.eraEarned = BALANCE.world.entryNous * 10;
      }
      return result;
    });
    void build;
    void assert;
    void bank;
    try {
      return runPlaythrough(composePlaythroughRecipe({
        seed: 468,
        policyId: PUSHING_POLICY.id,
        claimTarget: 2,
        eras: 4,
        budgetDays: 1,
        schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 },
      }));
    } finally {
      vi.restoreAllMocks();
    }
  })();
  const ledgers = eraLedgersOf(record);
  const row = laterEraRow(468, BASELINE_SESSION_MINUTES, record);

  it("carries the banked eras whole and the open era incomplete", () => {
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    expect(row.bottleneck).not.toBeNull();
    expect(ledgers[0]!.complete).toBe(true);
    const open = ledgers[ledgers.length - 1]!;
    expect(open.complete).toBe(false);
    expect(open.claim).toBeNull();
    expect(open.frontierAfter).toBeNull();
    expect(open.creditedSeconds).toBeGreaterThan(0);
    expect(row.eraClasses[row.eraClasses.length - 1]).toBe("incomplete");
    expect(row.claims.length).toBeLessThan(4);
  });
});

describe("the frontier-route read", () => {
  // Crafted rows standing at frontiers 2 and 4 with recorded wallets,
  // owned ranks, and defeats: the route read walks the authored ladders
  // from exactly those figures.
  const ledgerOf = (era: number, frontierAfter: number, wallet: number, hone: number, columns: number, defeats: string[]): EraLedger => ({
    era,
    complete: true,
    creditedSeconds: 36_000,
    elapsedSeconds: 360_000,
    claim: 2,
    frontierAfter,
    eraEarned: BALANCE.world.entryNous * 10 ** (frontierAfter / 2),
    previousPeakEraEarned: era === 1 ? null : BALANCE.world.entryNous * 10 ** ((frontierAfter - 2) / 2),
    familiarCreditedSeconds: era === 1 ? null : 3600,
    newCreditedSeconds: era === 1 ? null : 32_400,
    preResetRate: 100,
    productionRegainedHours: era === 1 ? null : 1,
    eligibilityHours: 1,
    aretePurchases: 1,
    honeRanks: hone,
    columns,
    deployments: 1,
    relocations: 0,
    discoveries: [],
    defeats,
    declines: [],
    closingRate: 100,
    walletArete: wallet,
    finite: true,
  });
  const rows = [{
    seed: 468, sessionMinutes: 25, policy: "pushing", erasTarget: 4, complete: true,
    stopKind: "eras", stopReason: "done", days: 10, creditedHours: 10,
    claims: [2, 2], frontiers: [2, 4],
    ledgers: [
      ledgerOf(1, 2, 0, 0, 1, ["w0"]),
      ledgerOf(2, 4, 1, 1, 1, ["w1"]),
    ],
    eraClasses: ["in-window", "in-window"],
    familiarShares: [0.4],
    inWindowEras: 2, overWindowEras: 0, underWindowEras: 0,
    noGrant: true, frontierStrictlyGrowing: true, bottleneck: null, note: "",
  }] as unknown as LaterEraRow[];

  it("enumerates affordable Arete routes and the surpass arithmetic at tested frontiers", () => {
    const routes = frontierRoutesOf(rows);
    expect(routes.map((route) => route.frontier)).toEqual([2, 4]);
    // Frontier 2's era banks its next claim at a decade past the entry —
    // the authored curve's slope, read through the entitlement.
    expect(routes[0]!.bankDepth).toBeCloseTo(BALANCE.world.entryNous * 10, 6);
    expect(routes[0]!.claim).toBe(2);
    // The resistance at frontier 2 is the enemy revealed at its bank
    // depth — w1 — and the defeat ledger names the era that surpassed it.
    expect(routes[0]!.enemy).toBe("w1");
    expect(routes[0]!.defeatedInLedgers).toBe(1);
    expect(routes[0]!.trap).toBe("");
    // The affordable routes walk the authored ladders from the recorded
    // ranks: at frontier 4 the opening wallet 1 plus the era's claim 2
    // buys the next Hone rung (price 2) from rank 1.
    expect(routes[1]!.honeRanksOwned).toBe(1);
    expect(routes[1]!.honeRanksAffordable).toBe(1);
    expect(routes[1]!.attackPower).toBe(BALANCE.world.attackBase + 2 * BALANCE.world.honeAttackPerRank);
    // The fed kill arithmetic reads the authored HP and cadence.
    const hp = WORLD_ENEMIES[2]!.maxHp;
    expect(routes[1]!.fedKillMinutes).toBe(Math.ceil(hp / (BALANCE.world.attackBase + 2 * BALANCE.world.honeAttackPerRank)));
  });

  it("keeps the trap read empty while any authored purchase is affordable", () => {
    // The claim at frontier 2's next bank is 2 Arete, so the authored
    // Hone ladder (first rung 1 Arete) routes forward from any recorded
    // purse — the trap read names a finding only when nothing is
    // affordable and nothing was demonstrated.
    const route = frontierRoutesOf(rows)[0]!;
    expect(route.claim).toBe(2);
    expect(route.honeRanksAffordable).toBeGreaterThan(0);
    expect(route.trap).toBe("");
  });
});

describe("the run artifact carries an era-stopped record", () => {
  it("exports and imports a declared-era walk's record whole", () => {
    const record = refillWalk(PUSHING_POLICY.id, 2, 4);
    expect(record.stop.kind).toBe("eras");
    const artifact = exportPlaythroughArtifact({ record, modified: false, interventions: [] });
    const load = importPlaythroughArtifact(artifact);
    expect(load.ok).toBe(true);
    if (load.ok) {
      expect(load.artifact.record.stop.kind).toBe("eras");
      expect(load.artifact.record.claims).toEqual(record.claims);
    }
  });
});

describe("the recorded later-era report", { timeout: 3_600_000 }, () => {
  it("walks the full declared matrix — four seeds, both shapes, three attitudes — and records it", { skip: !process.env.FLOWSYNTH_LATER_ERAS_REPORT }, () => {
    const report = laterErasReport();
    expect(report.runs).toHaveLength(LATER_ERA_SEEDS.length * 2 * LATER_ERA_POLICIES.length);
    expect(report.policySlices).toHaveLength(LATER_ERA_POLICIES.length);
    expect(report.source.runnerVersion).toBeGreaterThanOrEqual(13);
    // Every row carries the currency-integrity read and a frontier that
    // strictly grew on its banked claims.
    for (const row of report.runs) {
      expect(row.noGrant).toBe(true);
      expect(row.frontierStrictlyGrowing).toBe(true);
      expect(row.erasTarget).toBe(DECLARED_ERAS);
      expect(row.ledgers.length).toBeGreaterThan(0);
      expect(row.ledgers.every((ledger) => ledger.finite)).toBe(true);
      // A complete run banked its declared era count; an incomplete run
      // names its bottleneck and carries the open era explicitly.
      if (row.complete) {
        expect(row.stopKind).toBe("eras");
        expect(row.claims).toHaveLength(DECLARED_ERAS);
      } else {
        expect(row.stopKind).toBe("budget");
        expect(row.bottleneck).not.toBeNull();
      }
      // The recovery measures land on the real schedules: every banked
      // later era regained its pre-reset production and crossed
      // eligibility again — an explicit null here would be a recorded
      // recovery failure, not a fixture artifact.
      for (const ledger of row.ledgers) {
        if (ledger.complete && ledger.previousPeakEraEarned !== null) {
          expect(ledger.productionRegainedHours).not.toBeNull();
          expect(ledger.eligibilityHours).not.toBeNull();
        }
      }
    }
    // The policy comparison's material reads: the ignoring policy never
    // defeats anything, the combat policy relocates onto the fight.
    const slices = new Map(report.policySlices.map((slice) => [slice.policy, slice]));
    expect(slices.get("ignoring")!.defeats).toBe(0);
    expect(slices.get("combat")!.relocations).toBeGreaterThan(0);
    expect(slices.get("pushing")!.relocations).toBe(0);
    // Every tested frontier routes forward: no trap stands in the
    // recorded matrix, and each resistance was demonstrably surpassed.
    for (const route of report.frontierRoutes) {
      expect(route.trap).toBe("");
      expect(route.defeatedInLedgers).toBeGreaterThan(0);
    }
    const text = JSON.stringify(report, null, 2);
    writeFileSync(process.env.FLOWSYNTH_LATER_ERAS_REPORT!, text);
  });
});
