import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { fresh, give, giveHabit } from "./fixtures";
import { addForgeProgress, forgeThreshold } from "./rolls";
import { accrueClassDevelopment, practiceRollThreshold } from "./classes";
import { totalPracticeRollsEarned } from "./rolls";
import { hex } from "./hex";

describe("the forge meter", () => {
  it("batches progress identically to incremental adds with carry", () => {
    const s = fresh();
    addForgeProgress(s, 300);
    expect(s.forge.earned).toBe(3);
    expect(s.forge.progress).toBeCloseTo(15, 6);

    const t = fresh();
    for (let i = 0; i < 300; i++) addForgeProgress(t, 1);
    expect(t.forge.earned).toBe(s.forge.earned);
    expect(t.forge.progress).toBeCloseTo(s.forge.progress, 6);
  });

  it("charge from generators banks rolls through the shared meter", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    s.modules.find((m) => m.type === "focusKeyed")!.reserve = 600;
    startSession(s, null);
    advance(s, 50);
    // Charge 50 crosses the 60 threshold only with the window's full
    // strength — practice no longer rides this branch (ADR-0041): the
    // 50 credited seconds sit in the pair's practice-roll meter instead.
    expect(s.forge.earned).toBe(0);
    expect(s.forge.progress).toBeCloseTo(50, 6);
    expect(pair.rollMeter.progress).toBeCloseTo(50, 6);
    expect(s.bankedRolls).toHaveLength(0);
  });

  it("duplicate forges share one increasing threshold", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    give(s, "forge", hex(1, 0));
    give(s, "forge", hex(0, 1));
    give(s, "focusKeyed", hex(2, 0));
    s.modules.find((m) => m.type === "focusKeyed")!.reserve = 600;
    startSession(s, null);
    advance(s, 600);
    // 600 charge (practice feeds the practice-roll meter now, not this
    // branch) through thresholds 60 + 90 + 135 + 202.5 → 4 rolls, 112.5
    // left.
    expect(s.forge.earned).toBe(4);
    expect(s.forge.progress).toBeCloseTo(112.5, 6);
    // The same 600 credited seconds crossed the pair meter's opening fill;
    // the flat block waits.
    expect(pair.rollMeter.earned).toBe(1);
    expect(pair.rollMeter.progress).toBeCloseTo(420, 6);
    expect(s.bankedRolls).toHaveLength(5);
  });

  it("global progress survives layout and module changes", () => {
    const s = fresh();
    addForgeProgress(s, 42);
    const forge = give(s, "forge", hex(1, 0), 4);
    forge.pos = null;
    s.modules = s.modules.filter((m) => m.id !== forge.id);
    expect(s.forge.progress).toBeCloseTo(42, 6);
    expect(s.forge.earned).toBe(0);
  });

  it("thresholds grow globally per earned reward", () => {
    expect(forgeThreshold(0)).toBe(60);
    expect(forgeThreshold(1)).toBeCloseTo(90, 6);
    expect(forgeThreshold(2)).toBeCloseTo(135, 6);
  });

  it("forge progress scales with the forge's own power", () => {
    const s = fresh();
    const forge = give(s, "forge", hex(1, 0), 1);
    give(s, "focusKeyed", hex(2, 0));
    const { pair } = giveHabit(s);
    s.modules.find((m) => m.type === "focusKeyed")!.reserve = 600;
    startSession(s, null);
    advance(s, 100);
    expect(forge.level).toBe(1);
    // 100 s at strength 1 × power 1.2 = 120 charge: the 60 threshold
    // crosses, 60 carries — practice no longer pads this branch.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(60, 6);
    expect(pair.rollMeter.progress).toBeCloseTo(100, 6);
  });
});

describe("the practice-roll meter (issue #423)", () => {
  it("fills with credited seconds and banks into the same queue", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    accrueClassDevelopment(s, 180, () => 0.5);
    expect(pair.rollMeter.earned).toBe(1);
    expect(pair.rollMeter.progress).toBeCloseTo(0, 6);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.forge.earned).toBe(0);
  });

  it("batches identically to incremental adds across the flat cadence", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    accrueClassDevelopment(s, 3600, () => 0.5);
    expect(pair.rollMeter.earned).toBe(2);
    expect(pair.rollMeter.progress).toBeCloseTo(1620, 6);

    const t = fresh();
    const { pair: tPair } = giveHabit(t);
    for (let i = 0; i < 36; i++) accrueClassDevelopment(t, 100, () => 0.5);
    expect(tPair.rollMeter.earned).toBe(pair.rollMeter.earned);
    expect(tPair.rollMeter.progress).toBeCloseTo(pair.rollMeter.progress, 6);
  });

  it("the opening fill crosses once fast; every later roll sits one flat block out", () => {
    const { pair } = giveHabit(fresh());
    expect(practiceRollThreshold(pair, 0)).toBe(180);
    expect(practiceRollThreshold(pair, 1)).toBe(1800);
    expect(practiceRollThreshold(pair, 7)).toBe(1800);
  });

  it("unstructured sessions fill nothing", () => {
    const s = fresh();
    accrueClassDevelopment(s, 1800, () => 0.5);
    expect(s.bankedRolls).toHaveLength(0);
    expect(totalPracticeRollsEarned(s)).toBe(0);
  });
});
