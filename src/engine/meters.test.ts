import { describe, expect, it } from "vitest";
import { advance, } from "./advance";
import { startSession } from "./actions";
import { fresh, give, grantBurst, setActive } from "./fixtures";
import { addExpansionProgress, addForgeProgress, expansionThreshold, forgeThreshold } from "./rolls";
import { hex } from "./hex";

describe("global progress meters", () => {
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

  it("duplicate forges share one increasing threshold", () => {
    const s = fresh();
    setActive(s);
    give(s, "forge", hex(0, 0));
    give(s, "forge", hex(2, 0));
    grantBurst(s, 1, 60);
    startSession(s, 600);
    advance(s, 600);
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(60, 6);
    expect(forgeThreshold(s.forge.earned)).toBeCloseTo(90, 6);
  });

  it("one burst supplies its full charge to both forge and expansion", () => {
    const s = fresh();
    setActive(s);
    give(s, "forge", hex(0, 0));
    give(s, "expander", hex(2, 0));
    grantBurst(s, 1, 60);
    startSession(s, 600);
    advance(s, 600);
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.expansion.earned).toBe(1);
    expect(s.expansion.progress).toBeCloseTo(0, 6);
    expect(s.cellTokens).toBe(1);
  });

  it("global progress survives layout and module changes", () => {
    const s = fresh();
    addForgeProgress(s, 42);
    const forge = give(s, "forge", hex(0, 0), 4);
    forge.pos = null;
    s.modules = s.modules.filter((m) => m.id !== forge.id);
    expect(s.forge.progress).toBeCloseTo(42, 6);
    expect(s.forge.earned).toBe(0);
  });

  it("thresholds grow globally per earned reward", () => {
    expect(forgeThreshold(0)).toBe(60);
    expect(forgeThreshold(1)).toBeCloseTo(90, 6);
    expect(forgeThreshold(2)).toBeCloseTo(135, 6);
    expect(expansionThreshold(0)).toBe(60);
    expect(expansionThreshold(1)).toBeCloseTo(120, 6);
    expect(expansionThreshold(2)).toBeCloseTo(240, 6);
  });

  it("expansion banking earns cell tokens", () => {
    const s = fresh();
    addExpansionProgress(s, 60);
    expect(s.expansion.earned).toBe(1);
    expect(s.cellTokens).toBe(1);
  });
});
