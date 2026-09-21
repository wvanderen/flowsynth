import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { chargedFactor, computeRates, investment, levelCost, modulePower } from "./economy";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";

// Fresh board: the Carrier at (0,0), empty cells (1,0) and (0,1) — a
// triangle (ADR-0018). The carrier term alone is the whole formula at game
// start (§4). Ring-2 cells like (2,0) sit two hexes out — pitch 3,
// chordless — keeping the amplitude tests free of chord terms; chords get
// their own suite (chords.test.ts).
const CARRIER = 0.1;

describe("board production model", () => {
  it("a fresh board produces the carrier term alone", () => {
    const s = fresh();
    expect(computeRates(s, true).rate).toBeCloseTo(CARRIER, 9);
    expect(computeRates(s, false).rate).toBeCloseTo(CARRIER, 9);
  });

  it("harmonic terms add to the composite", () => {
    const s = fresh();
    give(s, "additive", hex(2, 0));
    give(s, "conditional", hex(2, -1));
    // Both pitch 3; adjacent at the same pitch, so amplitude only — no chord.
    expect(computeRates(s, true).rate).toBeCloseTo(CARRIER + 0.05 + 0.05, 9);
  });

  it("amplitude scales with level and rarity", () => {
    const s = fresh();
    const additive = give(s, "additive", hex(2, 0), 2);
    additive.rarity = "uncommon";
    expect(computeRates(s, true).rate).toBeCloseTo(CARRIER + 0.05 * 1.25 ** 2, 9);
  });

  it("infusors add local bonuses to neighbors", () => {
    const s = fresh();
    give(s, "additive", hex(2, 0));
    give(s, "infusor", hex(2, -1));
    // The infusor touches the additive but not the carrier.
    expect(computeRates(s, true).rate).toBeCloseTo(CARRIER + 0.05 * (1 + 0.2), 9);
  });

  it("charge empowers adjacent synthesizers and infusors while the window lasts", () => {
    const s = fresh();
    give(s, "focusKeyed", hex(0, 1));
    s.chargeWindow = 60;
    const live = computeRates(s, true);
    expect(live.rate).toBeCloseTo(CARRIER * chargedFactor(1), 9);
    // Charge exists only while flow is live: no session, no empowerment.
    expect(computeRates(s, false).rate).toBeCloseTo(CARRIER, 9);
  });

  it("generators produce charge only from board modules; none exists without one", () => {
    const s = fresh();
    expect(computeRates(s, true).forgeRate).toBe(0);
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.nousEarned).toBeCloseTo(60, 6);
    expect(s.forge.progress).toBe(0);
    expect(s.forge.earned).toBe(0);
    expect(result.rollsBanked).toBe(0);
  });

  it("a generator feeds the adjacent Forge toward its threshold", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 600;
    expect(computeRates(s, true).forgeRate).toBeCloseTo(1, 9);
    startSession(s, null);
    advance(s, 100);
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(40, 6);
  });

  it("generators never charge themselves or each other", () => {
    const s = fresh();
    const generator = give(s, "focusKeyed", hex(1, 0));
    const second = give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 60;
    const snapshot = computeRates(s, true);
    expect(snapshot.chargeStrength.get(generator.id)).toBe(0);
    expect(snapshot.chargeStrength.get(second.id)).toBe(0);
    // The carrier at (0,0) is adjacent to the generator at (1,0) and is
    // empowered; the generators themselves receive nothing.
    expect(snapshot.rate).toBeCloseTo(CARRIER * chargedFactor(1), 9);
  });

  it("stacked generators empower with diminishing returns", () => {
    const s = fresh();
    give(s, "focusKeyed", hex(1, 0));
    give(s, "focusKeyed", hex(0, 1));
    s.chargeWindow = 60;
    expect(computeRates(s, true).rate).toBeCloseTo(CARRIER * chargedFactor(2), 9);
  });

  it("shelved modules produce nothing; the Carrier never leaves the board", () => {
    const s = fresh();
    const additive = give(s, "additive", hex(1, 0));
    additive.pos = null;
    expect(computeRates(s, true).rate).toBeCloseTo(CARRIER, 9);
    expect(s.modules.some((m) => m.type === "carrier" && m.pos !== null)).toBe(true);
  });

  it("produces nothing outside flow: paused and upgrade boards earn zero", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "forge", hex(0, 1));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 600;
    startSession(s, 600);
    advance(s, 100);
    s.mode = "paused";
    expect(advance(s, 600).nousEarned).toBe(0);
    s.mode = "upgrade";
    expect(advance(s, 600).nousEarned).toBe(0);
  });
});

describe("upgrade costs and rarity power", () => {
  it("matches the accepted geometric cost curve without recursive rounding", () => {
    expect([0, 1, 2, 3, 4].map((l) => levelCost(l))).toEqual([10, 16, 26, 41, 66]);
    expect(investment(4)).toBe(93);
  });

  it("level zero power is one for every rarity", () => {
    for (const rarity of ["common", "uncommon", "rare"] as const) {
      expect(modulePower({ rarity, level: 0 })).toBe(1);
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
