import { describe, expect, it } from "vitest";
import { placeModule, returnModule } from "./actions";
import { allocationQualityOf, ALLOCATION_QUALITY_BOUNDS } from "./allocation";
import { formationQuality, formationTension } from "./chords";
import { BALANCE } from "./constants";
import { displayedRates, projectPlacement, syncRates, maxChordFactorOf, chargeDelivered } from "./economy";
import { syncAchievements } from "./achievements";
import { syncChordDiscoveries } from "./library";
import { summaryTermsOf } from "./allocation";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import type { GameState, ModuleInstance } from "./types";

// The placement projection (issue #260): the live outcome reads a player
// sees while moving a module — previewed values and changes relative to
// the current board, from the same authoritative allocation and economy
// calculation that commits the move — plus the measured-vs-applied
// formation quality seam and the allocation Q curve's adopted 0.5–1.5
// range (issue #257's bounds over #260's own magnitudes).

// The board suites' convention: the fifths axis — +7 semitones per +q, so
// a recipe's classes land on the columns 7·q ≡ interval (mod 12), with
// spacers bridging the intermediate columns into one connected formation.
function placed(state: GameState, type: ModuleInstance["type"], q: number, r = 0, level = 0): ModuleInstance {
  const pos = hex(q, r);
  if (!state.cells.some((c) => c.q === pos.q && c.r === pos.r)) state.cells.push(pos);
  return give(state, type, pos, level);
}

function bridgeRow(state: GameState, maxQ: number): void {
  for (let q = 0; q <= maxQ; q++) {
    if (state.modules.some((m) => m.pos !== null && m.pos.q === q && m.pos.r === 0)) continue;
    if (!state.cells.some((c) => c.q === q && c.r === 0)) state.cells.push(hex(q, 0));
    give(state, "spacer", hex(q, 0));
  }
}

// The column carrying pitch class `interval` above C on the fifths axis.
const col = (interval: number): number => (7 * interval) % 12;

describe("the allocation Q curve (#260)", () => {
  it("spreads organized formations across the adopted 0.5–1.5 range, not just a lifted cap", () => {
    const octave = allocationQualityOf([0]);
    const fifth = allocationQualityOf([0, 7]);
    const triad = allocationQualityOf([0, 4, 7]);
    const dominant = allocationQualityOf([0, 4, 7, 10]);
    const lush = allocationQualityOf([0, 3, 5, 7, 10]);
    const chromatic = allocationQualityOf([0, 1, 2, 3, 4, 5]);
    // The organized ladder climbs by interval content: octave neutral,
    // fifth, triad, organized seventh, lush cluster toward the cap.
    expect(octave).toBe(1);
    expect(fifth).toBeGreaterThan(1);
    expect(triad).toBeGreaterThan(fifth);
    expect(dominant).toBeGreaterThan(triad);
    expect(lush).toBeGreaterThan(dominant);
    expect(lush).toBeGreaterThanOrEqual(1.4);
    // Chromatic density sinks to the floor — materially below neutral.
    expect(chromatic).toBe(ALLOCATION_QUALITY_BOUNDS.floor);
    expect(chromatic).toBeLessThan(1);
    // The shipped bounds stay the adopted development range.
    expect(ALLOCATION_QUALITY_BOUNDS).toEqual({ floor: 0.5, cap: 1.5 });
  });

  it("holds the three-way balance under capacity-one economics", () => {
    // ADR-0049's acceptance check, restated for the allocation curve: a
    // tense-but-organized dominant seventh and a lush major seventh each
    // outproduce a clean major triad per voice, and the bridged chromatic
    // mass loses to it — read off the real rate pass at capacity one.
    const perVoice = (classes: number[]): number => {
      const state = fresh();
      state.cells = [];
      state.modules = [];
      const cols = classes.map(col);
      for (const q of cols) placed(state, "additive", q);
      bridgeRow(state, Math.max(...cols));
      const { contributions } = displayedRates(state, true);
      const factors = [...contributions.values()].filter((c) => c.type === "additive").map((c) => c.chordFactor!);
      return Math.max(...factors);
    };
    const triad = perVoice([0, 4, 7]);
    const dominant = perVoice([0, 4, 7, 10]);
    const majorSeventh = perVoice([0, 4, 7, 11]);
    const chromatic = perVoice([0, 1, 2, 3, 4, 5]);
    expect(dominant).toBeGreaterThan(triad);
    expect(majorSeventh).toBeGreaterThan(triad);
    expect(chromatic).toBeLessThan(triad);
  });

  it("compares an upper bound of two in experiments without shipping it", () => {
    // The experimental comparison #260 records: the same curve over the
    // same magnitudes with the cap raised to two. For every
    // representative formation the read is unchanged — the magnitudes
    // shape the posture, not the cap — and the shipped default stays 1.5.
    const representative: number[][] = [
      [0],
      [0, 7],
      [0, 4, 7],
      [0, 4, 7, 10],
      [0, 4, 7, 11],
      [0, 3, 5, 7, 10],
      [0, 1, 2, 3, 4, 5],
    ];
    const magnitudes = {
      complexityRate: BALANCE.allocationComplexityRate,
      tensionAllowance: BALANCE.allocationTensionAllowance,
    };
    for (const classes of representative) {
      const shipped = allocationQualityOf(classes);
      const experimental = formationQuality(
        classes,
        formationTension(classes, BALANCE.allocationTensionWeights),
        true,
        { floor: 0.5, cap: 2 },
        magnitudes,
      );
      expect(experimental).toBe(shipped);
    }
    expect(ALLOCATION_QUALITY_BOUNDS.cap).toBe(1.5);
  });
});

describe("measured versus applied formation quality (#260)", () => {
  it("an unallocated oscillator keeps chord factor exactly one inside an active formation", () => {
    const state = fresh();
    state.cells = [];
    state.modules = [];
    // A doubled C class beside E and G: the triad's two C-seats compete,
    // and at capacity one the solver spends each voice once — the lighter
    // C stays unallocated inside the same named, actively singing
    // formation.
    const lightC = placed(state, "additive", col(0), 0);
    placed(state, "additive", col(0), 1, 1);
    placed(state, "additive", col(4));
    placed(state, "additive", col(7));
    bridgeRow(state, col(4));
    const snapshot = displayedRates(state, true);
    expect(snapshot.allocation!.used.get(lightC.id)).toBe(0);
    const contribution = snapshot.contributions.get(lightC.id)!;
    // The applied production seam: exactly ×1 — no partial chord, no
    // orphaned Q — while the formation's measured quality still reads
    // over every singing voice in it, this one included.
    expect(contribution.chordFactor).toBe(1);
    expect(contribution.formationQ).toBe(1);
    expect(contribution.formationMeasuredQ).toBe(allocationQualityOf([0, 4, 7]));
    // A participant earns the whole term: instance product × the applied
    // formation Q — the breakdown's two reads multiply out exactly.
    const heavyC = state.modules.find((m) => m.pos !== null && m.pos.q === col(0) && m.pos.r === 1)!;
    const earned = snapshot.contributions.get(heavyC.id)!;
    expect(earned.formationQ).toBe(allocationQualityOf([0, 4, 7]));
    expect(earned.chordFactor).toBeCloseTo((1 + 0.75) * allocationQualityOf([0, 4, 7]), 9);
    expect(earned.formationMeasuredQ).toBe(earned.formationQ);
  });

  it("a formation whose every chord sat idle measures its Q and applies exactly one", () => {
    const state = fresh();
    state.cells = [];
    state.modules = [];
    // A doubled C against C♯ and D: the Octave is recognized, but the
    // floor prices the formation so activation would reduce production —
    // nothing activates, and the formation still measures.
    const c = placed(state, "additive", col(0), 0);
    placed(state, "additive", col(0), 1);
    placed(state, "additive", col(1));
    placed(state, "additive", col(2));
    bridgeRow(state, col(1));
    const snapshot = displayedRates(state, true);
    expect(snapshot.allocation!.active.length).toBe(0);
    expect(snapshot.allocation!.recognized.length).toBeGreaterThan(0);
    const contribution = snapshot.contributions.get(c.id)!;
    expect(contribution.chordFactor).toBe(1);
    expect(contribution.formationQ).toBe(1);
    expect(contribution.formationMeasuredQ).toBe(ALLOCATION_QUALITY_BOUNDS.floor);
  });
});

describe("the placement projection (#260)", () => {
  it("previews a move through the same pass that commits it", () => {
    const state = fresh();
    state.cells = [];
    state.modules = [];
    const g = placed(state, "additive", col(7));
    placed(state, "additive", col(4));
    bridgeRow(state, col(7));
    state.cells.push(hex(col(9), 0));
    const pre = displayedRates(state, true);
    const preview = projectPlacement(state, g.id, hex(col(9), 0), true);
    expect(preview.current).toEqual(pre);
    expect(placeModule(state, g.id, hex(col(9), 0)).ok).toBe(true);
    expect(displayedRates(state, true)).toEqual(preview.projected);
  });

  it("previews a swap, a tray placement, and a retrieval the same way", () => {
    const state = fresh();
    state.cells = [];
    state.modules = [];
    const c = placed(state, "additive", col(0));
    const e = placed(state, "additive", col(4));
    bridgeRow(state, col(4));
    // Swap: the occupants trade cells; the preview reads the trade.
    const swap = projectPlacement(state, c.id, hex(col(4), 0), true);
    expect(placeModule(state, c.id, hex(col(4), 0)).ok).toBe(true);
    expect(displayedRates(state, true)).toEqual(swap.projected);
    expect(e.pos).toEqual(hex(col(0), 0));
    // Tray: a module off the board lands on an open cell.
    const trayVoice = give(state, "additive", null);
    const landing = projectPlacement(state, trayVoice.id, hex(col(7), 0), true);
    expect(placeModule(state, trayVoice.id, hex(col(7), 0)).ok).toBe(true);
    expect(displayedRates(state, true)).toEqual(landing.projected);
    // Retrieval: a null target reads the module off the board exactly as
    // returnModule takes it.
    const retrieval = projectPlacement(state, trayVoice.id, null, true);
    expect(returnModule(state, trayVoice.id).ok).toBe(true);
    expect(displayedRates(state, true)).toEqual(retrieval.projected);
  });

  it("rides the one allocation economy everywhere — no development dependence", () => {
    const state = fresh();
    state.cells = [];
    state.modules = [];
    const g = placed(state, "additive", col(7));
    placed(state, "additive", col(4));
    bridgeRow(state, col(7));
    state.cells.push(hex(col(9), 0));
    const preview = projectPlacement(state, g.id, hex(col(9), 0), true);
    expect(preview.projected.allocation).toBeDefined();
    expect(placeModule(state, g.id, hex(col(9), 0)).ok).toBe(true);
    expect(displayedRates(state, true)).toEqual(preview.projected);
  });

  it("never touches the live state it projects", () => {
    const state = fresh();
    state.cells = [];
    state.modules = [];
    const g = placed(state, "additive", col(7));
    bridgeRow(state, col(7));
    const before = JSON.stringify(state.modules.map((m) => [m.id, m.pos]));
    projectPlacement(state, g.id, hex(col(9), 0), true);
    projectPlacement(state, g.id, null, true);
    expect(JSON.stringify(state.modules.map((m) => [m.id, m.pos]))).toBe(before);
  });
});


describe("retrieval boundary agreement", () => {
  it("commits a newly earned feat when removal improves the remaining formation", () => {
    const state = fresh();
    state.cells = [];
    state.modules = [];
    state.sessionsCompleted = 1;
    for (const q of [0, 1, 4, 5]) placed(state, "additive", q);
    const dissonance = placed(state, "additive", 7);
    bridgeRow(state, 8);
    const initial = syncRates(state, true);
    syncChordDiscoveries(state, { chords: summaryTermsOf(initial.allocation!) });
    syncAchievements(state, { maxChordFactor: maxChordFactorOf(initial), chargeDelivered: chargeDelivered(initial) });
    const preview = projectPlacement(state, dissonance.id, null, false);
    expect(returnModule(state, dissonance.id).ok).toBe(true);
    const actual = displayedRates(state, false);
    expect(actual.achievementBoost).toBeGreaterThan(initial.achievementBoost);
    expect(actual).toEqual(preview.projected);
  });
});
