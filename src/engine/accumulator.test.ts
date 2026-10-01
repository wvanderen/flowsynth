import { describe, expect, it } from "vitest";
import { ARETE_HORIZON, ARETE_LOG_FLOOR, accumulatorFill, claimOf, horizonReached } from "./accumulator";
import { prestige, startSession } from "./actions";
import { advance } from "./advance";
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
    expect(accumulatorFill(100)).toBeCloseTo(0.25, 9);
    expect(accumulatorFill(1_000)).toBeCloseTo(0.5, 9);
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

function startAndAdvance(state: ReturnType<typeof fresh>, seconds: number): void {
  // Sessions are the only production window; the opening synth is producing.
  startSession(state, null);
  advance(state, seconds);
}
