import { describe, expect, it } from "vitest";
import {
  ARETE_GRADUATIONS,
  ARETE_HORIZON,
  ARETE_LOG_FLOOR,
  accumulatorFill,
  nextAccumulatorMark,
  syncArete,
} from "./accumulator";
import { acknowledgeHorizon, startSession } from "./actions";
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

  it("places every decade graduation strictly inside the rail", () => {
    for (const mark of ARETE_GRADUATIONS) {
      const position = accumulatorFill(mark);
      expect(position).toBeGreaterThan(0);
      expect(position).toBeLessThan(1);
    }
  });
});

describe("the horizon's decade graduations", () => {
  it("step through the decades, then yield to the horizon", () => {
    expect(nextAccumulatorMark(0)).toBe(ARETE_GRADUATIONS[0]);
    expect(nextAccumulatorMark(150)).toBe(1_000);
    expect(nextAccumulatorMark(9_999)).toBe(10_000);
    expect(nextAccumulatorMark(10_000)).toBe(ARETE_HORIZON);
    expect(nextAccumulatorMark(ARETE_HORIZON)).toBe(ARETE_HORIZON);
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

describe("the reserved prestige button", () => {
  it("records the acknowledgment for the achievements ticket", () => {
    const s = fresh();
    expect(s.horizonAcknowledged).toBe(false);
    expect(acknowledgeHorizon(s).ok).toBe(true);
    expect(s.horizonAcknowledged).toBe(true);
  });

  it("acknowledging is idempotent and never touches the economy", () => {
    const s = fresh();
    s.totalEarned = ARETE_HORIZON;
    syncArete(s);
    const nous = s.nous;
    acknowledgeHorizon(s);
    acknowledgeHorizon(s);
    expect(s.horizonAcknowledged).toBe(true);
    expect(s.arete).toBe(1);
    expect(s.nous).toBe(nous);
  });
});

function startAndAdvance(state: ReturnType<typeof fresh>, seconds: number): void {
  // Sessions are the only production window; the Carrier alone is producing.
  startSession(state, null);
  advance(state, seconds);
}
