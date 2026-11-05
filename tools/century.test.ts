import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORLD_ENEMIES } from "../src/engine/constants";
import {
  exportPlaythroughArtifact,
  importPlaythroughArtifact,
} from "../src/engine/playthrough-artifact";
import { composePlaythroughRecipe, runPlaythrough, type PlaythroughRecord } from "../src/engine/playthrough";
import {
  CENTURY_BUDGET_DAYS,
  CENTURY_MARK_HOURS,
  CENTURY_POLICIES,
  CENTURY_SEEDS,
  CENTURY_SESSION_MINUTES,
  LONG_GAP_CREDITED,
  LATER_WINDOW,
  OPENING_WINDOW,
  SPARSE_ACQUISITION_SEEDS,
  SUPPLIED_BOARD_LEVEL,
  SUPPLIED_BOARD_MODULE_COUNT,
  calibrationBaseline,
  centuryDistribution,
  centuryEraView,
  centuryRecipe,
  centuryRow,
  investmentTimeline,
  suppliedBoardState,
  type CenturyEraClass,
} from "./century";
import { enemyDefAt } from "../src/engine/world";
import { syncRates } from "../src/engine/economy";

// The century evaluation's always-on checks (issue #492, parent #484
// stories 5–9, 33, 42–43). The declared matrix, the century stop's
// mechanics, the classification windows, the fixture construction, and
// the numeric/serialized reads run here on short real walks; the full
// 100-credited-hour recorded matrix rides the FLOWSYNTH_CENTURY_SLICE /
// FLOWSYNTH_CENTURY_REPORT gates like the recorded evaluations before it,
// so a suite pass never pays for a multi-hour evaluation it did not ask
// for. The slices (one per session shape × policy) run independently and
// compose into the report.

// The short real walks this file runs carry stopCreditedHours 2 on the
// 60-minute session shape — two sessions, roughly twenty seconds of walk
// each — enough to exercise the stop, the banking gates, and the fixture
// walks without paying for a century.

function shortCenturyRecord(policyId: string, seed = 23): PlaythroughRecord {
  return runPlaythrough(composePlaythroughRecipe({
    seed,
    policyId,
    claimTarget: 2,
    eras: 1,
    stopCreditedHours: 2,
    budgetDays: 5,
    schedule: { sessionsPerDay: 2, sessionMinutes: 60, breatherMinutes: 5 },
  }));
}

describe("the declared century matrix", () => {
  it("declares the eight seeds, two session shapes, five policies, the mark, and the windows", () => {
    expect(CENTURY_SEEDS).toEqual([42, 468, 157, 2026, 7, 99, 11, 23]);
    expect(CENTURY_SESSION_MINUTES).toEqual({ baseline: 25, long: 60 });
    expect(CENTURY_POLICIES).toEqual(["prompt", "pushing", "support", "combat", "ignoring"]);
    expect(CENTURY_MARK_HOURS).toBe(100);
    expect(OPENING_WINDOW).toEqual({ minHours: 8, maxHours: 12 });
    expect(LATER_WINDOW).toEqual({ minHours: 5, maxHours: 10 });
    // The budgets sit past the mark on each schedule: a baseline day
    // credits 50 minutes (120 days reach 100 hours), a long day 2 hours
    // (50 days). A budget miss is a recorded miss, never an extension.
    expect(CENTURY_BUDGET_DAYS.baseline * 50).toBeGreaterThanOrEqual(CENTURY_MARK_HOURS * 60);
    expect(CENTURY_BUDGET_DAYS.long * 120).toBeGreaterThanOrEqual(CENTURY_MARK_HOURS * 60);
    expect(CENTURY_BUDGET_DAYS).toEqual({ baseline: 140, long: 60 });
  });

  it("declares century recipes: the mark rides the recipe, the walk is not era-counted", () => {
    for (const policyId of CENTURY_POLICIES) {
      const recipe = centuryRecipe(CENTURY_SEEDS[0]!, 25, policyId);
      expect(recipe.policyId).toBe(policyId);
      expect(recipe.stopCreditedHours).toBe(CENTURY_MARK_HOURS);
      expect(recipe.eras).toBe(1);
      expect(recipe.schedule.sessionMinutes).toBe(25);
      expect(recipe.schedule.sessionsPerDay).toBe(2);
      expect(recipe.claimTarget).toBe(2);
      expect(recipe.budgetDays).toBe(CENTURY_BUDGET_DAYS.baseline);
      const long = centuryRecipe(CENTURY_SEEDS[0]!, 60, policyId);
      expect(long.budgetDays).toBe(CENTURY_BUDGET_DAYS.long);
    }
  });

  it("rejects malformed credited stops", () => {
    for (const stop of [-1, 0.5, 801]) {
      expect(() => composePlaythroughRecipe({ stopCreditedHours: stop }))
        .toThrow(/stopCreditedHours/);
    }
    expect(composePlaythroughRecipe({ stopCreditedHours: 0 }).stopCreditedHours).toBe(0);
  });

  it("declares the sparse-acquisition stress fixtures and the long-gap failure threshold", () => {
    for (const seed of SPARSE_ACQUISITION_SEEDS) {
      expect(CENTURY_SEEDS, `sparse seed ${seed} declared from the matrix`).toContain(seed);
    }
    expect(LONG_GAP_CREDITED).toBe(2 * 3600);
  });
});

describe("the declared credited-flow stop", () => {
  it("completes at the mark: a fresh walk's century stop, with the era-count gate off", () => {
    const record = shortCenturyRecord("support");
    expect(record.stop.kind).toBe("century");
    expect(record.complete).toBe(true);
    expect(record.creditedSeconds).toBeGreaterThanOrEqual(2 * 3600);
    expect(record.stop.reason).toContain("2-credited-hour mark");
    // The walk is not era-counted: eras stay 1 in the recipe while the
    // open era remains explicitly open at the stop.
    expect(record.recipe.eras).toBe(1);
    expect(record.eras.at(-1)!.claim).toBeNull();
    expect(record.snapshots.every((snapshot) => Number.isFinite(snapshot.rate))).toBe(true);
  }, 120_000);

  it("keeps the shipped stops when no mark is declared", () => {
    const recipe = composePlaythroughRecipe({ policyId: "prompt", budgetDays: 20, schedule: { sessionMinutes: 60 } });
    expect(recipe.stopCreditedHours).toBe(0);
    const record = runPlaythrough(recipe);
    expect(record.stop.kind).toBe("prestige");
    expect(record.complete).toBe(true);
  }, 240_000);
});

describe("the classification windows", () => {
  const ledger = (index: number, hours: number | null) => ({
    index,
    startElapsed: 0,
    startCredited: 0,
    endElapsed: hours === null ? null : hours * 3600,
    endCredited: hours === null ? null : hours * 3600,
    claim: hours === null ? null : 2,
    frontierAfter: hours === null ? null : 4,
    priorDepth: null,
    priorRate: null,
    familiarCredited: 0,
    newCredited: 0,
    productionRegained: null,
    priorDepthPassed: null,
    finite: null,
  });

  it("reads the opening era against 8–12 and later eras against 5–10", () => {
    const cases: readonly { readonly index: number; readonly hours: number | null; readonly expected: CenturyEraClass }[] = [
      { index: 0, hours: 9, expected: "in-window" },
      { index: 0, hours: 7.9, expected: "under" },
      { index: 0, hours: 12.1, expected: "over" },
      { index: 1, hours: 7, expected: "in-window" },
      { index: 1, hours: 4.9, expected: "under" },
      { index: 1, hours: 10.1, expected: "over" },
      { index: 3, hours: null, expected: "open" },
    ];
    for (const entry of cases) {
      const eras = Array.from({ length: entry.index + 1 }, (_, i) => ledger(i, entry.index === i ? entry.hours : 6));
      expect(centuryEraView({ eras, events: [], snapshots: [] } as unknown as PlaythroughRecord, entry.index, null).eraClass)
        .toBe(entry.expected);
    }
  });
});

describe("the anonymized supplied-board fixture", () => {
  it("builds the reported position through the engine's own seams", () => {
    const state = suppliedBoardState();
    expect(state.prestiges).toBe(1);
    expect(state.catalogEntryOwned).toBe(true);
    expect(state.modules).toHaveLength(SUPPLIED_BOARD_MODULE_COUNT + 1); // plus the opening synth
    const supplied = state.modules.filter((module) => module.id.startsWith("supplied-"));
    expect(supplied).toHaveLength(SUPPLIED_BOARD_MODULE_COUNT);
    for (const module of supplied) {
      expect(module.level).toBe(SUPPLIED_BOARD_LEVEL);
      expect(module.pos).not.toBeNull();
      expect(enemyDefAt(module.pos!), `no module stands on an enemy cell (${module.id})`).toBeUndefined();
    }
    // The footprint is the launch band's compact frontier: connected and
    // inside the lattice. Every seat is an owned cell.
    const owned = new Set(state.cells.map((cell) => `${cell.q},${cell.r}`));
    for (const module of supplied) expect(owned.has(`${module.pos!.q},${module.pos!.r}`)).toBe(true);
    for (const def of WORLD_ENEMIES) {
      const live = state.world.enemies[def.key]!;
      expect(live.discovered).toBe(true);
      expect(live.hp).toBe(def.maxHp);
    }
    expect(state.world.columns).toHaveLength(0);
    expect(state.world.weapons).toHaveLength(0);
    expect(Number.isFinite(syncRates(state, false).rate)).toBe(true);
  });

  it("records the raw position's shape through its construction, levels at the finite boundary", () => {
    // The full raw and collection-reset century walks — and the stranding
    // the raw position records — ride the recording tier's `fixture`
    // command (`node tools/record-century.mjs fixture <variant>`), which
    // the FLOWSYNTH_CENTURY_REPORT compose reads: the certified allocator
    // over the retained board's 36 voices costs fractions of a second per
    // read, so a walk through the real manage seam is a multi-minute walk
    // no always-on case should pay. The construction itself is the
    // always-on check.
    const state = suppliedBoardState();
    const supplied = state.modules.filter((module) => module.id.startsWith("supplied-"));
    for (const module of supplied) expect(module.level).toBe(SUPPLIED_BOARD_LEVEL);
    expect(Number.isFinite(syncRates(state, false).rate)).toBe(true);
  }, 60_000);
});

describe("the analysis reads", () => {
  it("extracts the investment timeline's firsts with occurrence-indexed repeats", () => {
    const event = (label: string, kind: PlaythroughRecord["events"][number]["kind"], credited: number, snapshot = 0) =>
      ({ at: credited, credited, kind, label, ok: true, snapshot });
    const record = {
      events: [
        event("Shelf — generator", "purchase", 60),
        event("Cell at 1,0", "purchase", 600),
        event("Catalog entry", "arete", 3600 * 9),
        event("World Column", "world", 3600 * 11),
        event("World Column", "world", 3600 * 17),
        event("Hone rank — chargeBlade", "world", 3600 * 18),
        event("Arete — Chord Catalysts", "arete", 3600 * 30),
        event("Arete — Chord Catalysts", "arete", 3600 * 44),
        event("Prestige 3 — banked 2 Arete", "prestige", 3600 * 20, 5),
        event("Placed a Sine at 0,1", "placement", 3600 * 21),
        event("Swept 5 levels", "upgrade", 3600 * 21),
      ],
      snapshots: [],
    } as unknown as PlaythroughRecord;
    const timeline = investmentTimeline(record);
    const keys = timeline.map((entry) => entry.key);
    expect(keys).toEqual([
      "shelf generator",
      "board cells",
      "Catalog entry",
      "Charge Column 1",
      "Charge Column 2",
      "Hone ladder 1",
      "Chord Catalysts 1",
      "Chord Catalysts 2",
    ]);
    expect(timeline.find((entry) => entry.key === "Catalog entry")!.creditedHour).toBe(9);
    // Level sweeps and placements close no investment.
    expect(keys).not.toContain("Swept 5 levels");
  });

  it("distributes era classes per seed with honest open outcomes", () => {
    const row = (seed: number, classes: readonly CenturyEraClass[]) => ({
      seed,
      sessionMinutes: 60,
      policy: "support",
      eras: classes.map((eraClass, index) => ({
        index,
        eraClass,
        hours: eraClass === "in-window" ? 7 : eraClass === "under" ? 3 : eraClass === "over" ? 14 : null,
      })),
    });
    const distribution = centuryDistribution([row(42, ["in-window", "over", "open"]), row(468, ["under", "in-window"])] as never);
    expect(distribution.counts).toEqual({ inWindow: 2, under: 1, over: 1, open: 1 });
    expect(distribution.erasBySeed).toHaveLength(2);
  });
});

describe("the frozen baseline", () => {
  it("matches every frozen figure to the committed save-translation baseline", () => {
    const frozen = JSON.parse(readFileSync(new URL("../docs/century-calibration-baseline.json", import.meta.url), "utf8"));
    // Source fingerprints identify recordings, not numeric balance. A
    // comment or measurement-only edit must not force a numeric re-freeze.
    const { source: _source, ...compiled } = calibrationBaseline();
    expect(Object.keys(compiled).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(compiled)) {
      expect(value, `frozen ${key}: re-record and explicitly re-freeze before changing`).toEqual(frozen[key]);
    }
  });
});

describe("decision gaps at observation boundaries", () => {
  const hour = 3600;
  const reading = (times: number[], endHours: number) => {
    const base = shortCenturyRecord("support");
    const events: PlaythroughRecord["events"][number][] = times.map((credited) => ({ at: credited, credited, kind: "placement", label: "Placed a Sine", ok: true, snapshot: 0 }));
    const era: PlaythroughRecord["eras"][number] = { ...base.eras[0]!, endCredited: null, newCredited: endHours * hour };
    const record = { ...base, events, eras: [era], creditedSeconds: endHours * hour };
    return { record, row: centuryRow(23, 60, record), view: centuryEraView(record, 0, null) };
  };

  it("records a decision-free century as one long gap in both run and open era", () => {
    const { row, view } = reading([], 100);
    expect(row.gaps).toMatchObject({ count: 1, maxCredited: 100 * hour, longCount: 1 });
    expect(row.decisionGapsOk).toBe(false);
    expect(view.longGaps).toEqual([{ credited: 100 * hour, closedBy: "Observation ended" }]);
  });

  it("includes the wait from the start to the first decision", () => {
    const { row, view } = reading([3 * hour], 4);
    expect(row.gaps.maxCredited).toBe(3 * hour);
    expect(view.longGaps).toEqual([{ credited: 3 * hour, closedBy: "Placed a Sine" }]);
  });

  it("includes the wait after the last decision, even when no later decision closes it", () => {
    const { row, view } = reading([0, 600], 100);
    expect(row.gaps.maxCredited).toBe(100 * hour - 600);
    expect(row.gaps.longCount).toBe(1);
    expect(view.longGaps[0]!.credited).toBe(100 * hour - 600);
  });

  it("clips a closed era at its bank instead of extending it to the run stop", () => {
    const { record } = reading([hour], 100);
    record.eras[0] = { ...record.eras[0]!, endCredited: 2 * hour, endElapsed: 2 * hour, claim: 2 };
    const view = centuryEraView(record, 0, null);
    expect(view.gaps.maxCredited).toBe(hour);
    expect(view.longGaps).toEqual([]);
  });

  it("does not let a prestige hide an uninterrupted whole-run wait", () => {
    const { record } = reading([0, 3 * hour], 3);
    record.events.splice(1, 0, { at: 1.5 * hour, credited: 1.5 * hour, kind: "prestige", label: "Prestige 1", ok: true, snapshot: 0 });
    record.eras = [
      { ...record.eras[0]!, endCredited: 1.5 * hour, endElapsed: 1.5 * hour, claim: 2, newCredited: 1.5 * hour },
      { ...record.eras[0]!, index: 1, startCredited: 1.5 * hour, startElapsed: 1.5 * hour, newCredited: 1.5 * hour },
    ];
    const row = centuryRow(23, 60, record);
    expect(row.gaps).toMatchObject({ maxCredited: 3 * hour, longCount: 1 });
    expect(row.decisionGapsOk).toBe(false);
    expect(row.eras.map((era) => era.longGaps.length)).toEqual([0, 0]);
  });
});

describe("the recorded century evaluation", { skip: !process.env.FLOWSYNTH_CENTURY_REPORT && !process.env.FLOWSYNTH_CENTURY_SLICE, timeout: 7_200_000 }, () => {
  // The explicit tier compiles through Vite's real raw/glob transform,
  // certifying the compiled engine under the identity #503's fix made
  // content-sensitive everywhere. One recorder owns the provenance
  // checks and assertions for direct CLI and env-gated invocations alike.
  const slice = process.env.FLOWSYNTH_CENTURY_SLICE;
  it(slice ? `walks the ${slice} century slice and records it` : "composes the full declared matrix, the fixture pair, and the frozen baseline", () => {
    execFileSync(process.execPath, ["tools/record-century.mjs", ...(slice ? ["slice", slice] : ["compose"])], {
      stdio: "inherit",
      timeout: 7_200_000,
    });
  });
});

describe("the century record at the artifact boundary", () => {
  it("round-trips a century-stop record with its declared stop", () => {
    const record = runPlaythrough(composePlaythroughRecipe({
      seed: 468,
      policyId: "prompt",
      claimTarget: 2,
      eras: 1,
      stopCreditedHours: 1,
      budgetDays: 3,
      schedule: { sessionsPerDay: 2, sessionMinutes: 60, breatherMinutes: 5 },
    }));
    expect(record.stop.kind).toBe("century");
    const artifact = JSON.parse(exportPlaythroughArtifact({ record, exportedAt: 1700000000000 }));
    expect(artifact.version).toBe(5);
    const imported = importPlaythroughArtifact(JSON.stringify(artifact));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.artifact.record.stop.kind).toBe("century");
      expect(imported.artifact.record.recipe.stopCreditedHours).toBe(1);
      expect(imported.artifact.record.creditedSeconds).toBe(record.creditedSeconds);
    }
  }, 120_000);
});
