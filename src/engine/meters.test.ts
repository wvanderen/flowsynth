import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { fresh, give } from "./fixtures";
import { addFlowProgress, addForgeProgress, flowThreshold, forgeThreshold } from "./rolls";
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
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 600;
    startSession(s, null);
    advance(s, 50);
    // Charge 50 crosses the 60 threshold only with the window's full
    // strength — practice no longer rides this branch (ADR-0041): the
    // 50 credited seconds sit in the flow meter instead.
    expect(s.forge.earned).toBe(0);
    expect(s.forge.progress).toBeCloseTo(50, 6);
    expect(s.flow.progress).toBeCloseTo(50, 6);
    expect(s.bankedRolls).toHaveLength(0);
  });

  it("duplicate forges share one increasing threshold", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "forge", hex(0, 1));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 600;
    startSession(s, null);
    advance(s, 600);
    // 600 charge (practice feeds the flow meter now, not this branch)
    // through thresholds 60 + 90 + 135 + 202.5 → 4 rolls, 112.5 left.
    expect(s.forge.earned).toBe(4);
    expect(s.forge.progress).toBeCloseTo(112.5, 6);
    // The same 600 credited seconds crossed the flow meter's flat cadence.
    expect(s.flow.earned).toBe(1);
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
    s.chargeWindow = 600;
    startSession(s, null);
    advance(s, 100);
    expect(forge.level).toBe(1);
    // 100 s at strength 1 × power 1.2 = 120 charge: the 60 threshold
    // crosses, 60 carries — practice no longer pads this branch.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(60, 6);
  });
});

describe("the flow meter (ADR-0041)", () => {
  it("fills with credited seconds and banks into the same queue", () => {
    const s = fresh();
    addFlowProgress(s, 180);
    expect(s.flow.earned).toBe(1);
    expect(s.flow.progress).toBeCloseTo(0, 6);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.forge.earned).toBe(0);
  });

  it("batches identically to incremental adds across the flat cadence", () => {
    const s = fresh();
    addFlowProgress(s, 3600);
    expect(s.flow.earned).toBe(2);
    expect(s.flow.progress).toBeCloseTo(1620, 6);

    const t = fresh();
    for (let i = 0; i < 36; i++) addFlowProgress(t, 100);
    expect(t.flow.earned).toBe(s.flow.earned);
    expect(t.flow.progress).toBeCloseTo(s.flow.progress, 6);
  });

  it("the opening fill crosses once fast; every later roll sits one flat block out", () => {
    expect(flowThreshold(0)).toBe(180);
    expect(flowThreshold(1)).toBe(1800);
    expect(flowThreshold(7)).toBe(1800);
  });
});
