import { describe, expect, it } from "vitest";
import { ARETE_HORIZON, ARETE_LOG_FLOOR, accumulatorFill, syncArete } from "./accumulator";
import { startSession } from "./actions";
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

describe("filling mints Arete", () => {
  it("mints nothing before the horizon", () => {
    const s = fresh();
    s.totalEarned = ARETE_HORIZON - 1;
    expect(syncArete(s)).toBe(0);
    expect(s.arete).toBe(0);
  });

  it("mints Arete once at the crossing, idempotently", () => {
    const s = fresh();
    s.totalEarned = ARETE_HORIZON;
    expect(syncArete(s)).toBe(1);
    expect(s.arete).toBe(1);
    expect(syncArete(s)).toBe(0);
    s.totalEarned += 5_000;
    expect(syncArete(s)).toBe(0);
    expect(s.arete).toBe(1);
  });

  it("mints when flow production crosses the horizon", () => {
    const s = fresh();
    s.totalEarned = ARETE_HORIZON - 10;
    startAndAdvance(s, 100);
    expect(s.totalEarned).toBeGreaterThanOrEqual(ARETE_HORIZON);
    expect(s.arete).toBe(1);
  });
});

function startAndAdvance(state: ReturnType<typeof fresh>, seconds: number): void {
  // Sessions are the only production window; the Carrier alone is producing.
  startSession(state, null);
  advance(state, seconds);
}
