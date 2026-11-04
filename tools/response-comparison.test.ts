import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recordingPayload } from "./dev/runtime.mjs";
import {
  CAPACITY_SWEEP,
  CURVES,
  LEVEL_SWEEP,
  PHENOMENON_BOARDS,
  PHENOMENON_LEVELS,
  SUPPLIED_BOARD,
  SUPPLIED_BOARD_DECLARED,
  SUPPLIED_GENERATORS,
  certificationProbes,
  curvePower,
  envelopeRows,
  phenomenonState,
  pacingRows,
  responseComparisonReport,
  responseSupportsAcquired,
  suppliedBoardState,
  suppliedBoardUnpressed,
  uniformLevelInvestment,
} from "./response-comparison";
import { upgradeModuleLevels } from "../src/engine/actions";
import { allocateRates, voiceCapacityOf } from "../src/engine/economy";
import { BALANCE, RESPONSE_CURVES, WORLD_ENEMIES } from "../src/engine/constants";
import { exportPlaythroughArtifact, importPlaythroughArtifact } from "../src/engine/playthrough-artifact";
import { composePlaythroughRecipe, playthroughNote, playthroughRunId, runPlaythrough, type PlaythroughEvent, type PlaythroughRecord } from "../src/engine/playthrough";

// The response-support candidate comparison's checks (issue #487, parent
// stories 7–14, 42–43). The catalog and seam pins run always; the full
// recorded report — the envelopes, the purchase-policy gesture sweep,
// and the acquisition scan's scheduled walks — rides the
// FLOWSYNTH_RESPONSE_REPORT gate like the balance experiments before it,
// so a suite pass never pays for a multi-minute tuning walk it did not
// ask for.

describe("the declared curve catalog", () => {
  it("declares shipped, linear, and bounded — shipped carrying the adopted bounded term (issue #488)", () => {
    expect(CURVES).toEqual(["shipped", "linear", "bounded"]);
    expect(RESPONSE_CURVES.map((curve) => curve.id)).toEqual(CURVES);
    expect(RESPONSE_CURVES.map((curve) => curve.name)).toEqual(["Shipped", "Linear", "Bounded"]);
    for (const curve of RESPONSE_CURVES) expect(curve.description).toBeTruthy();
    // Production adopted the bounded shape: every entry carries a level
    // term now, and the shipped entry reads BALANCE's authored
    // coefficients — the one central definition.
    for (const curve of RESPONSE_CURVES) expect(curve.levelTerm).toBeTruthy();
    expect(curvePower("bounded", 0)).toBe(1);
    expect(curvePower("bounded", 100)).toBeCloseTo(1 + (3 * 100) / 120, 12);
    expect(curvePower("bounded", 1e9)).toBeLessThan(4);
    expect(curvePower("linear", 0)).toBe(1);
    expect(curvePower("linear", 100)).toBeCloseTo(11, 12);
    // The shipped read is the adopted saturating term from BALANCE — ×1
    // at level zero, the bounded candidate's shape exactly while BALANCE
    // carries its recorded coefficients, never a re-derived copy.
    expect(curvePower("shipped", 0)).toBe(1);
    expect(curvePower("shipped", 7)).toBeCloseTo(1 + (BALANCE.responseShare * 7) / (7 + BALANCE.responseSaturation), 12);
    expect(curvePower("shipped", 100)).toBe(curvePower("bounded", 100));
  });
});

describe("the phenomenon fixtures", () => {
  it("read level-zero grant parity: every board, every curve, one rate", () => {
    for (const board of PHENOMENON_BOARDS) {
      const shipped = allocateRates(phenomenonState(board, 0, 5, "shipped"), true).snapshot.rate;
      for (const curve of ["linear", "bounded"] as const) {
        expect(allocateRates(phenomenonState(board, 0, 5, curve), true).snapshot.rate).toBe(shipped);
      }
    }
  });

  it("keeps the amplitude-only control curve-invariant at every swept level", () => {
    const control = PHENOMENON_BOARDS.find((board) => board.name === "amplitude-support")!;
    for (const level of PHENOMENON_LEVELS) {
      const shipped = allocateRates(phenomenonState(control, level, 5, "shipped"), true).snapshot.rate;
      for (const curve of ["linear", "bounded"] as const) {
        expect(allocateRates(phenomenonState(control, level, 5, curve), true).snapshot.rate).toBe(shipped);
      }
    }
  });

  it("reads the adopted curve on the response boards — shipped the bounded term, linear above, everything finite", () => {
    for (const name of ["chorus-stack", "exciter-producer", "sideband-conversion"]) {
      const board = PHENOMENON_BOARDS.find((candidate) => candidate.name === name)!;
      const rates = CURVES.map((curve) => allocateRates(phenomenonState(board, 1000, 5, curve), true).snapshot.rate);
      // The adoption removed the exponential: the shipped board reads the
      // bounded term exactly, and every board stays inside the
      // representable range where the recorded pre-adoption regime left
      // it.
      expect(rates[0]).toBe(rates[2]);
      expect(rates[1]).toBeGreaterThanOrEqual(rates[0]);
      for (const rate of rates) expect(Number.isFinite(rate)).toBe(true);
      // On the chord-carrying rig the grant rides inside every chord
      // instance, so even the linear candidate spreads wide over the
      // adopted term — the multiplicative seat structure survives the
      // adoption untouched (the whole-board legs dilute the raw term
      // ratio, and the spread stays many-times wide).
      if (name === "chorus-stack") {
        expect(rates[1]).toBeGreaterThan(rates[0]);
        expect(rates[1] / rates[0]).toBeGreaterThan(5);
      } else {
        // On the isolated charged producer and the converter the
        // candidates read float-identical at this level — the recorded
        // report's own finding: the producer's untouched power dominates,
        // and the Exciter's grant lands once per producer.
        expect(rates[1]).toBe(rates[0]);
      }
    }
  });

  it("records certification, and the declared reduced budget distinguishes the uncertified incumbent", () => {
    const [baseline, reduced] = certificationProbes(25);
    expect(baseline.budget).toBe("default");
    expect(baseline.certified).toBe(true);
    expect(reduced.budget).toBe("reduced-declared");
    expect(reduced.certified).toBe(false);
    // The incumbent still answers — it names itself, never substitutes
    // silently (ADR-0051).
    expect(reduced.rate).toBeGreaterThan(0);
  });

  it("sweeps the full reachable capacity ladder over both intrinsic bases", () => {
    const board = PHENOMENON_BOARDS.find((candidate) => candidate.name === "blaster-seats")!;
    let previousRate = -1;
    let previousInstances = -1;
    for (const capacity of CAPACITY_SWEEP) {
      const state = phenomenonState(board, 100, capacity, "bounded");
      // The Blaster's intrinsic two seats ride on top of the purchased
      // rungs; the standard voice reads the ladder alone.
      expect(voiceCapacityOf(state, "blaster")).toBe(2 + capacity - 1);
      expect(voiceCapacityOf(state)).toBe(capacity);
      const rates = allocateRates(state, true);
      // A wider budget never reads below the tighter one — small boards
      // may seat the same chords twice in a row; the record keeps both.
      expect(rates.snapshot.rate).toBeGreaterThanOrEqual(previousRate);
      expect(rates.read.instances.length).toBeGreaterThanOrEqual(previousInstances);
      previousRate = rates.snapshot.rate;
      previousInstances = rates.read.instances.length;
    }
    // The ceiling the two declared Expansion Bays open is the ladder's
    // top — capacity five, and the sweep never claims past it.
    expect(CAPACITY_SWEEP.at(-1)).toBe(5);
  });
});

describe("the supplied-board reconstruction", () => {
  it("builds the thirty copies in the table's relative order with the declared facts", () => {
    expect(SUPPLIED_BOARD).toHaveLength(30);
    expect(SUPPLIED_BOARD.map((c) => c.copy)).toEqual(
      Array.from({ length: 30 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`),
    );
    const state = suppliedBoardState(25, 5, "shipped");
    // Copy identifiers in the shown relative order — the Echo's
    // lowest-id adjacent-voice tie-break reads the creation order.
    const ids = state.modules.map((module) => Number(module.id.slice(1)));
    for (let i = 1; i < ids.length; i++) expect(ids[i]).toBeGreaterThan(ids[i - 1]!);
    // The declared purchases, breathers, and supplies.
    expect(state.capacityBought).toBe(SUPPLIED_BOARD_DECLARED.polyExpanderPurchases);
    expect(state.capacityCeilings).toBe(SUPPLIED_BOARD_DECLARED.expansionBays);
    expect(state.capacityDiscounts).toBe(SUPPLIED_BOARD_DECLARED.chordCatalysts);
    expect(state.breathersCompleted).toBe(SUPPLIED_BOARD_DECLARED.completedBreathers);
    expect(state.breatherSeconds).toBe(SUPPLIED_BOARD_DECLARED.lifetimeBreatherSeconds);
    for (const copy of SUPPLIED_BOARD) {
      if (!SUPPLIED_GENERATORS.has(copy.copy)) continue;
      const module = state.modules[SUPPLIED_BOARD.indexOf(copy)]!;
      expect(module.reserve).toBeGreaterThan(0);
    }
    // All nine enemies discovered and undefeated.
    expect(Object.keys(state.world.enemies)).toHaveLength(WORLD_ENEMIES.length);
    for (const def of WORLD_ENEMIES) {
      const live = state.world.enemies[def.key]!;
      expect(live.discovered).toBe(true);
      expect(live.hp).toBe(def.maxHp);
    }
    // The two Spotlights select P30 — the table's declared settings.
    const tail = state.modules[29]!;
    expect(tail.type).toBe("tail");
    expect(state.modules[5]!.target).toBe(tail.id);
    expect(state.modules[19]!.target).toBe(tail.id);
    // The corrupt level-1506 save never rides: the sweep is declared and
    // finite, and a real allocation reads off the declared level.
    expect(LEVEL_SWEEP).not.toContain(1506);
    expect(Number.isFinite(uniformLevelInvestment(25))).toBe(true);
  });

  it("allocates the real topology — chord instances form, certification is recorded, enemies press", () => {
    for (const curve of CURVES) {
      const state = suppliedBoardState(100, 5, curve);
      const rates = allocateRates(state, true);
      expect(rates.read.instances.length).toBeGreaterThan(10);
      expect(rates.snapshot.namedChords.length).toBeGreaterThan(10);
      expect(typeof rates.read.certified).toBe("boolean");
      expect(Number.isFinite(rates.snapshot.rate)).toBe(true);
    }
    // The enemies press, behaviorally: the same board with no enemy
    // discovered reads exactly the discovered board's rate divided by the
    // nine (1 − penalty) floors — 0.8⁹ — because the World factor
    // multiplies every voice's weight and value alike, so the allocation
    // cannot differ. Certified solves only: an incumbent pair could pick
    // different allocations and spoil the ratio's meaning.
    const pressed = allocateRates(suppliedBoardState(100, 5, "bounded"), true);
    const unpressed = allocateRates(suppliedBoardUnpressed(100, 5, "bounded"), true);
    expect(pressed.read.certified).toBe(true);
    expect(unpressed.read.certified).toBe(true);
    expect(pressed.snapshot.rate / unpressed.snapshot.rate).toBeCloseTo(0.8 ** WORLD_ENEMIES.length, 6);
  });

  it("reads the adopted shipped board at the bounded candidate's rate, linear above, at the same declared level", () => {
    const shipped = allocateRates(suppliedBoardState(100, 5, "shipped"), true).snapshot.rate;
    const linear = allocateRates(suppliedBoardState(100, 5, "linear"), true).snapshot.rate;
    const boundedRate = allocateRates(suppliedBoardState(100, 5, "bounded"), true).snapshot.rate;
    expect(shipped).toBe(boundedRate);
    expect(linear).toBeGreaterThan(shipped);
  });
});

describe("response-support acquisition evidence", () => {
  it("counts successful Chorus and Exciter roll acquisitions and excludes refusals and other events", () => {
    const event = (label: string, ok = true, kind: PlaythroughEvent["kind"] = "roll"): PlaythroughEvent =>
      ({ at: 0, credited: 0, snapshot: 0, kind, label, ok });
    expect(responseSupportsAcquired([
      event("Accepted a chorus from the roll"),
      event("Accepted a exciter from the roll"),
      event("Accepted a chorus from the roll", false),
      event("Accepted a exciter from the roll", false),
      event("Accepted a additive from the roll"),
      event("Accepted a chorus from the roll", true, "milestone"),
    ])).toBe(2);
    expect(responseSupportsAcquired([])).toBe(0);
  });
});

describe("the analytical envelopes", () => {
  it("prices the whole-board level increase against the real upgrade actions", { timeout: 120_000 }, () => {
    const state = suppliedBoardState(0, 5, "bounded");
    state.nous = 1000;
    const before = allocateRates(state, true).snapshot.rate;
    const bank = state.nous;
    for (const module of state.modules) {
      expect(upgradeModuleLevels(state, module.id, 1).ok).toBe(true);
    }
    const spent = bank - state.nous;
    // The envelopes hold discoveries and Feats fixed; purchase actions may
    // unlock them, so read the next endpoint from the same declared fixture.
    const after = allocateRates(suppliedBoardState(1, 5, "bounded"), true).snapshot.rate;
    const row = envelopeRows().find((row) => row.curve === "bounded" && row.level === 0)!;
    expect(spent).toBe(300);
    expect(row.nextLevelCost).toBe(spent);
    expect(row.marginalNuPerNu).toBeCloseTo((after - before) / spent, 12);
  });

  // The adopted curve's own honest cost: the sweep's high-level solves
  // still ride the allocation valve on the thirty-copy board before
  // returning their incumbent — declared here rather than trimmed away.
  it("show levelling slowing under every curve — the adopted shipped term included", { timeout: 120_000 }, () => {
    const rows = envelopeRows();
    for (const curve of CURVES) {
      const curveRows = rows.filter((row) => row.curve === curve);
      expect(curveRows).toHaveLength(LEVEL_SWEEP.length);
      // The waiting-time ratio at the top of the sweep: above one under
      // the adopted curve — levelling eventually slows, the failure mode
      // the recorded pre-adoption regime never reached before its own
      // board left the representable range.
      const last = curveRows.at(-1)!;
      expect(last.rate).not.toBeNull();
      expect(last.waitRatio).not.toBeNull();
      expect(last.waitRatio!).toBeGreaterThan(1);
    }
    // The intermediate board still reads finite everywhere: level 100 is
    // inside every curve's representable range.
    for (const curve of CURVES) {
      expect(rows.find((row) => row.level === 100 && row.curve === curve)!.rate).not.toBeNull();
    }
  });
});

describe("fresh-start pacing", () => {
  // The behavior figures a rerun must reproduce — balances, decisions,
  // and trajectory; the wall-clock discovery stamps are presentation.
  const behaviorOf = (record: PlaythroughRecord): string =>
    JSON.stringify([
      record.days, record.creditedSeconds, record.earnedNous, record.complete, record.stop,
      record.events.map((event) => [event.at, event.kind, event.label, event.ok]),
      record.trajectory.map((point) => [point.elapsed, point.credited, point.rate, point.nous]),
    ]);

  it("reproduces from the same recipe and identifies a changed candidate", () => {
    const first = runPlaythrough(composePlaythroughRecipe({ seed: 9, budgetDays: 2, responseCurve: "bounded" }));
    const second = runPlaythrough(composePlaythroughRecipe({ seed: 9, budgetDays: 2, responseCurve: "bounded" }));
    expect(playthroughRunId(second.recipe, second.source)).toBe(playthroughRunId(first.recipe, first.source));
    expect(behaviorOf(second)).toBe(behaviorOf(first));
    const shipped = runPlaythrough(composePlaythroughRecipe({ seed: 9, budgetDays: 2, responseCurve: "shipped" }));
    expect(playthroughRunId(shipped.recipe, shipped.source))
      .not.toBe(playthroughRunId(first.recipe, first.source));
  });

  it("applies the candidate to the walk's own state, carries it in the note, and keeps shipped untouched", () => {
    const boundedRun = pacingRows(2).find((row) => row.curve === "bounded")!;
    void boundedRun;
    const runs = new Map(CURVES.map((curve) => {
      const record = runPlaythrough(composePlaythroughRecipe({ seed: 468, budgetDays: 2, responseCurve: curve }));
      return [curve, record];
    }));
    const shippedRecord = runs.get("shipped")!;
    const boundedRecord = runs.get("bounded")!;
    const linearRecord = runs.get("linear")!;
    expect(shippedRecord.state.candidates).toBeUndefined();
    expect(boundedRecord.state.candidates).toEqual({ responseCurve: "bounded" });
    expect(linearRecord.state.candidates).toEqual({ responseCurve: "linear" });
    // Every recorded snapshot carries the run's own candidate — the
    // historical board reads the curve it was played under.
    for (const snapshot of boundedRecord.snapshots) {
      expect(snapshot.state.candidates).toEqual({ responseCurve: "bounded" });
    }
    expect(playthroughNote(boundedRecord)).toContain("curve bounded");
    expect(playthroughNote(shippedRecord)).not.toContain("curve");
    // The opening era holds no response support, so the candidates
    // cannot diverge it: the walks' behavior figures match exactly.
    expect(behaviorOf(boundedRecord)).toBe(behaviorOf(shippedRecord));
    expect(behaviorOf(linearRecord)).toBe(behaviorOf(shippedRecord));
  });

  it("carries the curve through the artifact boundary", () => {
    const record = runPlaythrough(composePlaythroughRecipe({ seed: 5, budgetDays: 1, responseCurve: "linear" }));
    const artifact = importPlaythroughArtifact(exportPlaythroughArtifact({ record }));
    expect(artifact.ok).toBe(true);
    if (!artifact.ok) return;
    expect(artifact.artifact.record.recipe.responseCurve).toBe("linear");
    expect(playthroughNote(artifact.artifact.record)).toContain("curve linear");
  });

  it("rejects unknown and invalid candidates by name before running", () => {
    expect(() => composePlaythroughRecipe({ responseCurve: "exponential" as never }))
      .toThrow(/response curve "exponential" is not supported — the suite offers shipped, linear, bounded\./);
    expect(() => composePlaythroughRecipe({ responseCurve: 42 as never }))
      .toThrow(/response curve "42" is not supported/);
    expect(() => composePlaythroughRecipe({ responseCurve: "bounded" })).not.toThrow();
    expect(composePlaythroughRecipe({ responseCurve: "bounded" }).responseCurve).toBe("bounded");
    // The default carries shipped explicitly.
    expect(composePlaythroughRecipe().responseCurve).toBe("shipped");
  });
});

describe("the recorded comparison report", { skip: !process.env.FLOWSYNTH_RESPONSE_REPORT, timeout: 900_000 }, () => {
  it("walks the full comparison — envelopes, gestures, pacing, and the acquisition scan — and records it", () => {
    const report = responseComparisonReport(12);
    expect(report.pacing).toHaveLength(3);
    expect(report.gestureSweep).toHaveLength(3);
    expect(report.fixtures).toHaveLength(PHENOMENON_BOARDS.length * PHENOMENON_LEVELS.length * 3);
    expect(report.capacitySweep).toHaveLength(CAPACITY_SWEEP.length * 3 * 2);
    expect(report.envelopes).toHaveLength(LEVEL_SWEEP.length * 3);
    // The real scheduled scan must detect the supports its walks acquired;
    // the old display-name matcher incorrectly reported zero for every seed.
    expect(report.acquisitionScan.length).toBeGreaterThan(5);
    expect(report.acquisitionScan.some((row) => row.responseSupportsAcquired > 0)).toBe(true);
    // The findings quote the rows, and the report is writable JSON — the
    // explicit nulls carry the beyond-representable figures.
    expect(report.findings.length).toBeGreaterThanOrEqual(10);
    expect(report.certificationProbes.some((probe) => !probe.certified)).toBe(true);
    const text = JSON.stringify(recordingPayload(report), null, 2) + "\n";
    expect(text).not.toMatch(/Infinity|NaN/);
    if (process.env.FLOWSYNTH_RESPONSE_REPORT) {
      writeFileSync(process.env.FLOWSYNTH_RESPONSE_REPORT, text);
    }
  });
});

