import { describe, expect, it } from "vitest";
import { buyActivation, endSession, startSession } from "./actions";
import { appActive, appLockNote, FOCUS_APPS, LADDER_APPS, ladderComplete, nextRung, nextRungCost } from "./apps";
import { rungCost } from "./economy";
import { fresh } from "./fixtures";

describe("the free opening (ADR-0019, issue #83)", () => {
  it("all four launch apps are active from minute 0 — before any session", () => {
    const s = fresh();
    for (const app of FOCUS_APPS) {
      expect(appActive(s, app)).toBe(true);
      expect(appLockNote(s, app)).toBeNull();
    }
    expect(s.sessionsCompleted).toBe(0);
    expect(s.activatedApps).toHaveLength(0);
  });

  it("stays free after sessions come and go; activation records stay empty", () => {
    const s = fresh();
    startSession(s, null);
    endSession(s, Date.now());
    for (const app of FOCUS_APPS) expect(appActive(s, app)).toBe(true);
    expect(s.activatedApps).toHaveLength(0);
  });

  it("exposes the launch app inventory in tile order, with the ladder resting empty", () => {
    expect(FOCUS_APPS).toEqual(["habit", "time", "notes", "goals"]);
    expect(LADDER_APPS).toEqual([]);
    expect(ladderComplete(fresh())).toBe(true);
  });
});

describe("the activation ladder rests empty at launch (ADR-0019)", () => {
  it("sells nothing: every launch app is refused whatever the pockets", () => {
    const s = fresh();
    s.nous = 1e9;
    for (const app of FOCUS_APPS) {
      expect(buyActivation(s, app).ok).toBe(false);
    }
    expect(s.activatedApps).toHaveLength(0);
    expect(s.nous).toBe(1e9);
  });

  it("keeps the shared, scaling rung shape for its first tenant", () => {
    expect(rungCost(2)).toBeGreaterThan(rungCost(1));
    const s = fresh();
    expect(nextRung(s)).toBe(1);
    expect(nextRungCost(s)).toBe(rungCost(1));
    // Nothing ever moves the rung at launch: the ladder sells nothing.
    expect(ladderComplete(s)).toBe(true);
  });
});
