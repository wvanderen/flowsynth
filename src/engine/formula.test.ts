import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { chargedFactor, computeRates, investment, levelCost, modulePower } from "./economy";
import { fresh, give, grantBurst, setActive } from "./fixtures";
import { hex } from "./hex";

describe("shared production formula", () => {
  it("combines Enter/Exit and additive into one rate with fractional accumulation", () => {
    const s = fresh();
    setActive(s);
    give(s, "additive", hex(0, 0));
    expect(computeRates(s, false).rate).toBeCloseTo(0.18, 9);
    expect(computeRates(s, true).rate).toBeCloseTo(0.27, 9);
    startSession(s, 600);
    grantBurst(s, 1, 60);
    const result = advance(s, 600);
    expect(result.nousEarned).toBeCloseTo(113.4, 6);
  });

  it("inactive Time has no multiplier effect and generates no charge", () => {
    const s = fresh();
    grantBurst(s, 1, 60);
    const snapshot = computeRates(s, true);
    expect(snapshot.rate).toBeCloseTo(0.1, 9);
    expect(snapshot.forgeRate).toBe(0);
    expect(snapshot.expansionRate).toBe(0);
  });

  it("the generator does not charge itself", () => {
    const s = fresh();
    setActive(s);
    grantBurst(s, 1, 60);
    expect(computeRates(s, true).rate).toBeCloseTo(0.18, 9);
  });

  it("copies of the same multiplier type add their bonuses", () => {
    const s = fresh();
    setActive(s);
    give(s, "conditional", hex(0, 0));
    give(s, "conditional", hex(2, -1));
    // (0,0) sees enter, Time, and the now-active Habit core (3);
    // (2,-1) sees enter and Time (2): total +0.5 multiplier bonus.
    expect(computeRates(s, false).rate).toBeCloseTo(0.1 * 1.2 * 1.5, 9);
  });

  it("infusors add and only empower the bonus above ×1", () => {
    const s = fresh();
    setActive(s);
    give(s, "infusor", hex(0, 0));
    give(s, "infusor", hex(2, -1));
    expect(computeRates(s, false).rate).toBeCloseTo(0.1 * 1.4 * (1 + 0.2 * 1.4), 9);
    expect(computeRates(s, true).rate).toBeCloseTo(0.1 * 1.6 * 1.5 * (1 + 0.2 * 1.6), 9);
  });

  it("charged infusors do not amplify forge or expansion progress", () => {
    const s = fresh();
    setActive(s);
    give(s, "forge", hex(0, 0));
    give(s, "expander", hex(2, 0));
    give(s, "infusor", hex(2, -1));
    grantBurst(s, 1, 60);
    startSession(s, 600);
    advance(s, 600);
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.expansion.earned).toBe(1);
    expect(s.cellTokens).toBe(1);
  });
});

describe("upgrade costs and rarity power", () => {
  it("matches the accepted geometric cost curve without recursive rounding", () => {
    expect([0, 1, 2, 3, 4].map((l) => levelCost(l))).toEqual([10, 16, 26, 41, 66]);
    expect(investment(4)).toBe(93);
  });

  it("level zero power is one for every rarity", () => {
    for (const rarity of ["common", "uncommon", "rare"] as const) {
      expect(modulePower({ id: "x", type: "forge", rarity, level: 0, invested: 0, pos: null, bursts: [] })).toBe(1);
    }
  });

  it("empowerment has diminishing returns", () => {
    const bonuses = [0, 1, 2, 3].map((s) => chargedFactor(s));
    expect(bonuses[1]).toBeCloseTo(1.5, 9);
    expect(bonuses[2]).toBeCloseTo(5 / 3, 9);
    expect(bonuses[3]).toBeCloseTo(1.75, 9);
    expect(bonuses[1]! - bonuses[0]!).toBeGreaterThan(bonuses[2]! - bonuses[1]!);
    expect(bonuses[2]! - bonuses[1]!).toBeGreaterThan(bonuses[3]! - bonuses[2]!);
  });
});
