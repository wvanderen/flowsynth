import { describe, expect, it } from "vitest";
import { ARETE_HORIZON, ARETE_LOG_FLOOR, accumulatorFill, claimOf, horizonReached } from "./accumulator";
import { breakHorizon, prestige, startSession } from "./actions";
import { advance } from "./advance";
import { BALANCE } from "./constants";
import { fresh } from "./fixtures";

describe("the Arete accumulator's log-scale fill", () => {
  it("sits at zero at and below the log floor", () => {
    expect(accumulatorFill(0)).toBe(0);
    expect(accumulatorFill(ARETE_LOG_FLOOR)).toBe(0);
  });

  it("is exactly half way at the geometric midpoint of floor and horizon", () => {
    expect(accumulatorFill(Math.sqrt(ARETE_LOG_FLOOR * ARETE_HORIZON))).toBeCloseTo(0.5, 9);
  });

  it("caps at the horizon and never overflows past it", () => {
    expect(accumulatorFill(ARETE_HORIZON)).toBe(1);
    expect(accumulatorFill(ARETE_HORIZON * 1_000_000)).toBe(1);
  });

  it("sweeps visibly through the first decades of play", () => {
    // The curved scale is the point (issue #156): early play moves the bar.
    expect(accumulatorFill(100)).toBeCloseTo(1 / 22, 9);
    expect(accumulatorFill(1_000)).toBeCloseTo(2 / 22, 9);
  });
});

describe("the per-era horizon (ADR-0039)", () => {
  it("reads the era's earned ν, never the lifetime total", () => {
    const s = fresh();
    s.totalEarned = ARETE_HORIZON;
    expect(horizonReached(s)).toBe(false);
    s.eraEarned = ARETE_HORIZON;
    expect(horizonReached(s)).toBe(true);
  });

  it("flow production fills the era's measure beside the lifetime truth", () => {
    const s = fresh();
    // Both measures ride together in play; the era sits one step short.
    s.totalEarned = ARETE_HORIZON - 10;
    s.eraEarned = ARETE_HORIZON - 10;
    startAndAdvance(s, 100);
    expect(s.totalEarned).toBeGreaterThanOrEqual(ARETE_HORIZON);
    expect(s.eraEarned).toBeGreaterThanOrEqual(ARETE_HORIZON);
    expect(horizonReached(s)).toBe(true);
  });

  it("the crossing mints nothing — the door opens and Arete waits for the reset", () => {
    const s = fresh();
    s.eraEarned = ARETE_HORIZON;
    expect(horizonReached(s)).toBe(true);
    expect(s.arete).toBe(0);
  });

  it("prestige rebases the era measure and the door shuts again", () => {
    const s = fresh();
    s.totalEarned = ARETE_HORIZON + 5_000;
    s.eraEarned = ARETE_HORIZON + 5_000;
    prestige(s);
    expect(s.eraEarned).toBe(0);
    expect(horizonReached(s)).toBe(false);
    // Lifetime totalEarned is the monotonic truth underneath.
    expect(s.totalEarned).toBe(ARETE_HORIZON + 5_000);
  });
});

describe("the linear claim (ADR-0042's base)", () => {
  it("the nth prestige banks n: two consecutive resets bank 1 then 2", () => {
    const s = fresh();
    expect(claimOf(s)).toBe(1);
    s.eraEarned = ARETE_HORIZON;
    prestige(s);
    expect(s.arete).toBe(1);
    s.eraEarned = ARETE_HORIZON;
    prestige(s);
    expect(s.arete).toBe(3);
    expect(claimOf(s)).toBe(3);
  });
});

describe("the broken claim (ADR-0042's overfill scaling)", () => {
  // The break is a purchase: every test here buys it first.
  function broken(prestiges = 0): ReturnType<typeof fresh> {
    const s = fresh();
    s.prestiges = prestiges;
    s.arete = BALANCE.horizonBreakCost;
    expect(breakHorizon(s).ok).toBe(true);
    return s;
  }

  it("pre-break the cap never bites: every reset banks exactly n whatever the overfill", () => {
    const s = fresh();
    s.eraEarned = ARETE_HORIZON * 1_000_000;
    expect(claimOf(s)).toBe(1);
    prestige(s);
    expect(s.arete).toBe(1);
  });

  it("an at-threshold reset banks exactly n: the scale floors at the base", () => {
    const s = broken(4);
    s.eraEarned = ARETE_HORIZON;
    expect(claimOf(s)).toBe(5);
  });

  it("decades past the horizon multiply by (1 + log₁₀ R), rounded down to whole Arete", () => {
    const s = broken();
    // One decade: claim = 1 × (1 + 1) = 2. Two: 3.
    s.eraEarned = ARETE_HORIZON * 10;
    expect(claimOf(s)).toBe(2);
    s.eraEarned = ARETE_HORIZON * 100;
    expect(claimOf(s)).toBe(3);
    // A fractional decade floors: R ≈ 31.6 → ×2.5 → 2 (from n = 1).
    s.eraEarned = ARETE_HORIZON * Math.sqrt(1000);
    expect(claimOf(s)).toBe(2);
  });

  it("nothing banks beyond the cap, even from a maximally juiced era", () => {
    const s = broken(30);
    s.eraEarned = ARETE_HORIZON * 1e12;
    expect(claimOf(s)).toBe(BALANCE.horizonBreakClaimCap);
  });

  it("the formula reads the per-era measure, never lifetime totalEarned", () => {
    const s = broken();
    s.totalEarned = ARETE_HORIZON * 1e9;
    s.eraEarned = ARETE_HORIZON;
    expect(claimOf(s)).toBe(1);
  });
});

function startAndAdvance(state: ReturnType<typeof fresh>, seconds: number): void {
  // Sessions are the only production window; the opening synth is producing.
  startSession(state, null);
  advance(state, seconds);
}
