import { describe, expect, it } from "vitest";
import { BALANCE, ROLL_POOL, typeRarityOf } from "./constants";
import { allocationMemoStats, displayedRates } from "./economy";
import { breatherResponseOf, breatherRuleOf, profileAxesOf } from "./profiles";
import { deserialize, serialize } from "./save";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { advance } from "./advance";
import { endBreather, endSession, startBreather, startSession } from "./actions";
import { applyBreatherGap } from "./trust";
import type { GameState, OscillatorType } from "./types";

// The breather-specialist wave (issue #416, parent #366): three oscillator
// types whose profiles make rest their identity — the S band's signature
// on the breather axis beside the launch roster's modest ×1.1–×1.25 and
// the Sine's absent mark. The contract reads through observable
// transitions — the mode change, the lifetime facts as inputs, the memo's
// re-solve at a step boundary — never coefficient tables. The fact-keyed
// rules follow the temporal-profile discipline (ADR-0061): described
// directly, never graded, the facts read-only inputs.

const SPECIALISTS: readonly OscillatorType[] = ["release", "standby", "tail"];

// End a 25-minute session the plain way: live present time, no honesty.
function runSession(state: GameState, seconds: number): void {
  startSession(state, null);
  advance(state, seconds);
  endSession(state);
}

// A fresh board carrying one specialist beside the opening Sine — the
// Fifth they form is mode-independent, so each voice's flow→breather
// ratio isolates its own response whatever the boosts do.
function pairBoard(state: GameState, type: OscillatorType): void {
  give(state, type, hex(1, 0));
}

// The lifetime facts, set through the real seams: the session mints the
// summary, the facts are the saved lifetime state, the breather starts.
function enterBreather(state: GameState, completedBreathers: number, breatherSeconds: number): void {
  state.breathersCompleted = completedBreathers;
  state.breatherSeconds = breatherSeconds;
  startBreather(state, 1000);
}

describe("authorship and the axis's strong band", () => {
  it("each specialist reads a distinct five-axis grade signature", () => {
    const letters = (type: OscillatorType): string => profileAxesOf(type).map((axis) => axis.grade).join("");
    // base · boost · chord · charge · breath — the breather axis is the
    // signature: S on every specialist, above the launch roster's A band.
    expect(letters("release")).toBe("CBBBS");
    expect(letters("standby")).toBe("BBBBS");
    expect(letters("tail")).toBe("DBBBS");
  });

  it("the comparable axes stay five — a fact rule is a description, never a sixth axis", () => {
    for (const type of SPECIALISTS) {
      expect(profileAxesOf(type).map((axis) => axis.id)).toEqual(["base", "booster", "chord", "charge", "breather"]);
    }
    // The fact-keyed growth lives in the direct descriptions only.
    expect(breatherRuleOf("standby")).toContain("completed breather");
    expect(breatherRuleOf("tail")).toContain("lifetime breather");
    expect(breatherRuleOf("release")).toBeNull();
    expect(breatherRuleOf("additive")).toBeNull();
    expect(breatherRuleOf("afterglow")).toBeNull();
  });

  it("the specialists join the roll pool inside their authored bands; the category keeps its share", () => {
    for (const type of SPECIALISTS) expect(ROLL_POOL).toContain(type);
    expect(typeRarityOf("release")).toBe("common");
    expect(typeRarityOf("standby")).toBe("uncommon");
    expect(typeRarityOf("tail")).toBe("rare");
    // The draft composition's contract (issue #378): the category's mass
    // is its authored weight, never its type count — growing the roster
    // crowded nothing out.
    expect(BALANCE.draftCategoryWeights.oscillator).toBe(4);
  });

  it("the roster round-trips through the save with the specialists' reads intact", () => {
    const s = fresh();
    const release = give(s, "release", hex(2, 0));
    release.tier = 1;
    give(s, "standby", hex(3, 0));
    give(s, "tail", null);
    s.breathersCompleted = 2;
    s.breatherSeconds = 1900;
    const restored = deserialize(serialize(s, 1)).state!;
    expect(restored.modules.map((m) => m.type).sort()).toEqual(s.modules.map((m) => m.type).sort());
    // The live and loaded boards read identically — the profiles are code,
    // the facts ride the save.
    const live = displayedRates(s);
    const loaded = displayedRates(restored);
    expect(loaded.rate).toBeCloseTo(live.rate, 9);
  });

  it("the deepened response survives the round-trip and reads through a real breather", () => {
    const s = fresh();
    pairBoard(s, "standby");
    const restored = deserialize(serialize(s, 1)).state!;
    runSession(restored, 1500);
    const flowRates = displayedRates(restored);
    const standbyFlow = flowRates.contributions.get(restored.modules[1]!.id)!.value;
    const sineFlow = flowRates.contributions.get(restored.modules[0]!.id)!.value;
    restored.breathersCompleted = 2;
    startBreather(restored, 1000);
    const breatherRates = displayedRates(restored);
    const standbyBreather = breatherRates.contributions.get(restored.modules[1]!.id)!.value;
    const sineBreather = breatherRates.contributions.get(restored.modules[0]!.id)!.value;
    expect((standbyBreather / standbyFlow) / (sineBreather / sineFlow)).toBeCloseTo(1.6, 9);
  });

  it("a completed breather deepens the next one through the real seams", () => {
    const s = fresh();
    pairBoard(s, "standby");
    runSession(s, 1500);
    startBreather(s, 1000);
    applyBreatherGap(s, 300); // the allowance runs to zero
    endBreather(s); // the completion mints the count
    expect(s.breathersCompleted).toBe(1);
    // The next session's end offers again; the new breather reads the
    // deepened response nothing hand-set.
    runSession(s, 1500);
    const flowRates = displayedRates(s);
    const standbyFlow = flowRates.contributions.get(s.modules[1]!.id)!.value;
    const sineFlow = flowRates.contributions.get(s.modules[0]!.id)!.value;
    startBreather(s, 5000);
    const breatherRates = displayedRates(s);
    const standbyBreather = breatherRates.contributions.get(s.modules[1]!.id)!.value;
    const sineBreather = breatherRates.contributions.get(s.modules[0]!.id)!.value;
    expect((standbyBreather / standbyFlow) / (sineBreather / sineFlow)).toBeCloseTo(1.5, 9);
  });
});

describe("the Release's defining behavior", () => {
  it("the breather multiplies its voice by exactly ×1.6 — the strongest response on the roster", () => {
    const s = fresh();
    pairBoard(s, "release");
    runSession(s, 1500);
    const flowRates = displayedRates(s);
    const releaseFlow = flowRates.contributions.get(s.modules[1]!.id)!.value;
    const sineFlow = flowRates.contributions.get(s.modules[0]!.id)!.value;
    enterBreather(s, 0, 0);
    const breatherRates = displayedRates(s);
    const releaseBreather = breatherRates.contributions.get(s.modules[1]!.id)!.value;
    const sineBreather = breatherRates.contributions.get(s.modules[0]!.id)!.value;
    // The Sine's absent mark is the control: ×1 exactly.
    expect(sineBreather / sineFlow).toBeCloseTo(1, 9);
    // The response is the specialist's ratio of ratios — every boost that
    // moved between the reads moved both voices equally.
    expect(releaseBreather / releaseFlow).toBeCloseTo(1.6, 9);
    // The spread widened, the launch wave untouched: the Afterglow's
    // modest response still reads its authored ×1.25.
    expect(breatherResponseOf("afterglow")).toBe(1.25);
    expect(breatherResponseOf("triangle")).toBe(1.1);
  });

  it("in flow it trails every standard producer — the break is the point", () => {
    const s = fresh();
    const release = give(s, "release", hex(2, 0)); // a chordless island
    const value = displayedRates(s).contributions.get(release.id)!.value;
    const sine = displayedRates(s).contributions.get(s.modules[0]!.id)!.value;
    expect(value).toBeLessThan(sine);
  });
});

describe("the Standby's deepening", () => {
  function breatherRatio(state: GameState): number {
    pairBoard(state, "standby");
    runSession(state, 1500);
    const flowRates = displayedRates(state);
    const standbyFlow = flowRates.contributions.get(state.modules[1]!.id)!.value;
    const sineFlow = flowRates.contributions.get(state.modules[0]!.id)!.value;
    enterBreather(state, state.breathersCompleted, 0);
    const breatherRates = displayedRates(state);
    const standbyBreather = breatherRates.contributions.get(state.modules[1]!.id)!.value;
    const sineBreather = breatherRates.contributions.get(state.modules[0]!.id)!.value;
    return (standbyBreather / standbyFlow) / (sineBreather / sineFlow);
  }

  it("zero completed breathers read the authored floor; each completion deepens it; four is the ceiling", () => {
    expect(breatherRatio(fresh())).toBeCloseTo(1.4, 9);
    const once = fresh();
    once.breathersCompleted = 1;
    expect(breatherRatio(once)).toBeCloseTo(1.5, 9);
    const twice = fresh();
    twice.breathersCompleted = 2;
    expect(breatherRatio(twice)).toBeCloseTo(1.6, 9);
    const capped = fresh();
    capped.breathersCompleted = 9; // far past the cap steps
    expect(breatherRatio(capped)).toBeCloseTo(1.8, 9);
  });

  it("the lifetime facts are read-only inputs to the response: flow never moves", () => {
    const rested = fresh();
    pairBoard(rested, "standby");
    runSession(rested, 1500);
    rested.breathersCompleted = 9;
    rested.breatherSeconds = 99_999;
    const restedFlow = displayedRates(rested).contributions.get(rested.modules[1]!.id)!.value;
    const plain = fresh();
    pairBoard(plain, "standby");
    runSession(plain, 1500);
    const plainFlow = displayedRates(plain).contributions.get(plain.modules[1]!.id)!.value;
    // Same board, same session: the facts price nothing outside a breather.
    expect(restedFlow).toBeCloseTo(plainFlow, 9);
  });
});

describe("the Tail's rest warmth", () => {
  function islandRatio(state: GameState, type: OscillatorType): number {
    const module = give(state, type, hex(2, 0)); // the chordless D5 island
    const value = displayedRates(state).contributions.get(module.id)!.value;
    const sine = displayedRates(state).contributions.get(state.modules[0]!.id)!.value;
    return value / sine;
  }

  it("the authored D-weak base warms to a standard producer over lifetime breather seconds", () => {
    expect(islandRatio(fresh(), "tail")).toBeCloseTo(0.5, 9);
    const thirtyMinutes = fresh();
    thirtyMinutes.breatherSeconds = 1800;
    expect(islandRatio(thirtyMinutes, "tail")).toBeCloseTo(0.8, 9);
    const twoHours = fresh();
    twoHours.breatherSeconds = 7200;
    expect(islandRatio(twoHours, "tail")).toBeCloseTo(1.0, 9);
  });

  it("the breather response rides on top of the warmth — rest pays live and permanent", () => {
    const s = fresh();
    const tail = give(s, "tail", hex(2, 0));
    s.breatherSeconds = 1800;
    runSession(s, 1500);
    const flow = displayedRates(s).contributions.get(tail.id)!.value;
    enterBreather(s, 0, 1800);
    const breathing = displayedRates(s).contributions.get(tail.id)!.value;
    expect(breathing / flow).toBeCloseTo(1.5, 9);
  });

  it("a step boundary crossed mid-breather re-solves the memo; staying inside a step never does", () => {
    const s = fresh();
    const tail = give(s, "tail", hex(2, 0));
    runSession(s, 1500);
    enterBreather(s, 0, 1700);
    const before = displayedRates(s).contributions.get(tail.id)!.value;
    const solves = allocationMemoStats.solves;
    s.breatherSeconds = 1900; // across the 30-minute boundary
    const after = displayedRates(s).contributions.get(tail.id)!.value;
    expect(allocationMemoStats.solves).toBe(solves + 1);
    expect(after).toBeCloseTo(before * 1.6, 9);
    s.breatherSeconds = 2500; // deeper into the same step
    displayedRates(s);
    expect(allocationMemoStats.solves).toBe(solves + 1);
  });
});
