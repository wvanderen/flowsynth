import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { chargedFactor, computeRates, investment, levelCost, modulePower } from "./economy";
import { BALANCE } from "./constants";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";

// The unified production model (ADR-0022):
//   rate      = (synths + infusor uplift) × Π chord terms × empowerment × achievementBoost
//   composite = (synths + infusor uplift) × Π chord terms
// Fresh board: one additive at C4 (0,0), empty cells G4 (1,0) and C5 (0,1) —
// the retained three-cell footprint. Its single synth term is the whole
// formula at game start. Chordless positions for amplitude tests sit off in
// their own island (D5 at (2,0) matches nothing and touches nothing);
// chords get their own suite (chords.test.ts).
const SYNTH = BALANCE.synthRate;

describe("board production model", () => {
  it("a fresh board produces one unified synth term", () => {
    const s = fresh();
    expect(computeRates(s, true).rate).toBeCloseTo(SYNTH, 9);
    expect(computeRates(s, false).rate).toBeCloseTo(SYNTH, 9);
    expect(computeRates(s, true).synths).toBeCloseTo(SYNTH, 9);
  });

  it("every synthesizer shares the one leg: a second synth adds the same base term", () => {
    const s = fresh();
    give(s, "additive", hex(2, 0)); // D5 — its own island
    give(s, "additive", hex(2, -1)); // D4 — the octave below it
    const snapshot = computeRates(s, true);
    // The D pair forms an Octave; there is no carrier/harmonics split —
    // every synthesizer rides the same unified base rate.
    expect(snapshot.synths).toBeCloseTo(3 * SYNTH, 9);
    expect(snapshot.rate).toBeCloseTo(3 * SYNTH * 1.15, 9);
  });

  it("amplitude scales with level and rarity", () => {
    const s = fresh();
    const island = give(s, "additive", hex(3, 0), 2); // A5 — chordless island
    island.rarity = "uncommon";
    expect(computeRates(s, true).rate).toBeCloseTo(SYNTH + SYNTH * 1.25 ** 2, 9);
  });

  it("infusors add local bonuses to neighbors as their own leg", () => {
    const s = fresh();
    give(s, "additive", hex(2, 0)); // D5 island
    give(s, "infusor", hex(2, -1)); // adjacent to D5 only
    // The infusor touches the island synth but not the opening synth: the
    // synths leg stays base and the uplift rides in the infusor leg.
    const snapshot = computeRates(s, true);
    expect(snapshot.rate).toBeCloseTo(SYNTH + SYNTH * (1 + 0.2), 9);
    expect(snapshot.synths).toBeCloseTo(2 * SYNTH, 9);
    expect(snapshot.infusors).toBeCloseTo(SYNTH * 0.2, 9);
    expect(snapshot.amplitude).toBeCloseTo(snapshot.synths + snapshot.infusors, 9);
  });

  it("charge empowers adjacent synthesizers and infusors while the window lasts", () => {
    const s = fresh();
    give(s, "focusKeyed", hex(0, 1)); // C5 — adjacent to the opening C4
    s.chargeWindow = 60;
    const live = computeRates(s, true);
    expect(live.rate).toBeCloseTo(SYNTH * chargedFactor(1), 9);
    // Charge exists only while flow is live: no session, no empowerment.
    expect(computeRates(s, false).rate).toBeCloseTo(SYNTH, 9);
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
    // The opening synth at (0,0) is adjacent to the generator at (1,0) and
    // is empowered; the generators themselves receive nothing.
    expect(snapshot.rate).toBeCloseTo(SYNTH * chargedFactor(1), 9);
  });

  it("stacked generators empower with diminishing returns", () => {
    const s = fresh();
    give(s, "focusKeyed", hex(1, 0));
    give(s, "focusKeyed", hex(0, 1));
    s.chargeWindow = 60;
    expect(computeRates(s, true).rate).toBeCloseTo(SYNTH * chargedFactor(2), 9);
  });

  it("shelved modules produce nothing; the spacer never produces anywhere", () => {
    const s = fresh();
    const additive = give(s, "additive", hex(1, 0));
    additive.pos = null;
    give(s, "spacer", hex(1, 0));
    expect(computeRates(s, true).synths).toBeCloseTo(SYNTH, 9);
    expect(computeRates(s, true).rate).toBeCloseTo(SYNTH, 9);
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
      expect(modulePower({ id: "x", type: "forge", rarity, level: 0, invested: 0, pos: null })).toBe(1);
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
