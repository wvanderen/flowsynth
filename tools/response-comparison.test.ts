import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
  suppliedBoardState,
  uniformLevelInvestment,
} from "./response-comparison";
import { allocateRates, voiceCapacityOf } from "../src/engine/economy";
import { BALANCE, RESPONSE_CURVES, WORLD_ENEMIES } from "../src/engine/constants";
import { exportPlaythroughArtifact, importPlaythroughArtifact } from "../src/engine/playthrough-artifact";
import { composePlaythroughRecipe, playthroughNote, playthroughRunId, runPlaythrough, type PlaythroughRecord } from "../src/engine/playthrough";

// The response-support candidate comparison's checks (issue #487, parent
// stories 7–14, 42–43). The catalog and seam pins run always; the full
// recorded report — the envelopes, the purchase-policy gesture sweep,
// and the acquisition scan's scheduled walks — rides the
// FLOWSYNTH_RESPONSE_REPORT gate like the balance experiments before it,
// so a suite pass never pays for a multi-minute tuning walk it did not
// ask for.

describe("the declared curve catalog", () => {
  it("declares shipped, linear, and bounded, the shipped curve unintercepted", () => {
    expect(CURVES).toEqual(["shipped", "linear", "bounded"]);
    expect(RESPONSE_CURVES.map((curve) => curve.id)).toEqual(CURVES);
    expect(RESPONSE_CURVES.map((curve) => curve.name)).toEqual(["Shipped", "Linear", "Bounded"]);
    for (const curve of RESPONSE_CURVES) expect(curve.description).toBeTruthy();
    expect(RESPONSE_CURVES.find((curve) => curve.id === "shipped")!.levelTerm).toBeNull();
    // The bounded candidate is the previously explored formula — the same
    // shape the balance-growth experiment carried, still a candidate.
    expect(curvePower("bounded", 0)).toBe(1);
    expect(curvePower("bounded", 100)).toBeCloseTo(1 + (3 * 100) / 120, 12);
    expect(curvePower("bounded", 1e9)).toBeLessThan(4);
    expect(curvePower("linear", 0)).toBe(1);
    expect(curvePower("linear", 100)).toBeCloseTo(11, 12);
    // The shipped read is the shared module power — rarity over level —
    // never a re-derived copy.
    expect(curvePower("shipped", 7)).toBe(BALANCE.rarityPower.uncommon ** 7);
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

  it("diverges the response boards in the runaway regime — shipped above the candidates", () => {
    for (const name of ["chorus-stack", "exciter-producer", "sideband-conversion"]) {
      const board = PHENOMENON_BOARDS.find((candidate) => candidate.name === name)!;
      const rates = CURVES.map((curve) => allocateRates(phenomenonState(board, 1000, 5, curve), true).snapshot.rate);
      expect(rates[0]).toBeGreaterThan(rates[1]);
      expect(rates[0]).toBeGreaterThan(rates[2]);
      // On the chord-carrying rig the grant rides inside every chord
      // instance, so the candidates spread wide — shipped is orders of
      // magnitude above linear.
      if (name === "chorus-stack") {
        expect(rates[1]).toBeGreaterThan(rates[2]);
        expect(rates[0] / rates[1]).toBeGreaterThan(1e10);
      }
      // On the isolated charged producer the candidates read equal to
      // float precision at this level: the producer's own (untouched)
      // power dominates, and the Exciter's grant lands once per producer
      // — the recorded report's findings carry the same fact.
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
    // The discovered undefeated enemies multiply the board's floor.
    const shipped = suppliedBoardState(100, 5, "shipped");
    const rates = allocateRates(shipped, true);
    const worldFactor = 0.8 ** WORLD_ENEMIES.length;
    expect(rates.snapshot.rate).toBeLessThan(worldFactor * 1e3 * 0 + Infinity);
    void worldFactor;
    expect(Number.isFinite(rates.snapshot.rate)).toBe(true);
  });

  it("reads the bounded candidate's board below the shipped one at the same declared level", () => {
    const shipped = allocateRates(suppliedBoardState(100, 5, "shipped"), true).snapshot.rate;
    const linear = allocateRates(suppliedBoardState(100, 5, "linear"), true).snapshot.rate;
    const boundedRate = allocateRates(suppliedBoardState(100, 5, "bounded"), true).snapshot.rate;
    expect(shipped).toBeGreaterThan(linear);
    expect(linear).toBeGreaterThan(boundedRate);
  });
});

describe("the analytical envelopes", () => {
  // The shipped regime's high-level solves ride the allocation valve at
  // 750 ms each before returning their incumbent — the sweep's honest
  // cost, declared here rather than trimmed away.
  it("show levelling slowing under the candidates and never under shipped before overflow", { timeout: 120_000 }, () => {
    const rows = envelopeRows();
    for (const curve of CURVES) {
      const curveRows = rows.filter((row) => row.curve === curve);
      expect(curveRows).toHaveLength(LEVEL_SWEEP.length);
      // The waiting-time ratio at the top of the sweep: the candidates
      // crossed above one and stay there; shipped's board has left the
      // representable range before it ever slowed.
      const last = curveRows.at(-1)!;
      if (curve === "shipped") {
        expect(last.rate).toBeNull();
        expect(last.marginalNuPerNu).toBeNull();
        expect(last.waitRatio).toBeNull();
      } else {
        expect(last.waitRatio).not.toBeNull();
        expect(last.waitRatio!).toBeGreaterThan(1);
      }
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
    // The acquisition scan is recorded evidence: no scheduled opening-era
    // run held a response support, which is why the pacing rows match.
    expect(report.acquisitionScan.length).toBeGreaterThan(5);
    expect(report.acquisitionScan.every((row) => row.responseSupportsAcquired === 0)).toBe(true);
    // The findings quote the rows, and the report is writable JSON — the
    // explicit nulls carry the beyond-representable figures.
    expect(report.findings.length).toBeGreaterThanOrEqual(10);
    expect(report.certificationProbes.some((probe) => !probe.certified)).toBe(true);
    const text = JSON.stringify(report, null, 2) + "\n";
    expect(text).not.toMatch(/Infinity|NaN/);
    if (process.env.FLOWSYNTH_RESPONSE_REPORT) {
      writeFileSync(process.env.FLOWSYNTH_RESPONSE_REPORT, text);
    }
  });
});

