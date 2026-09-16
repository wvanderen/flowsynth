import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { fresh, give } from "./fixtures";
import { addForgeProgress, forgeThreshold } from "./rolls";
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
    advance(s, 100);
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(40, 6);
    expect(forgeThreshold(s.forge.earned)).toBeCloseTo(90, 6);
    expect(s.bankedRolls).toHaveLength(1);
  });

  it("duplicate forges share one increasing threshold", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "forge", hex(0, 1));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 600;
    startSession(s, null);
    advance(s, 600);
    // 600 progress through thresholds 60 + 90 + 135 + 202.5 → 4 rolls, 112.5 left.
    expect(s.forge.earned).toBe(4);
    expect(s.forge.progress).toBeCloseTo(112.5, 6);
    expect(s.bankedRolls).toHaveLength(4);
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
    // 100 seconds at strength 1 × power 1.2 = 120 progress: one 60 roll banks, 60 remains.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(60, 6);
  });
});
