import { describe, expect, it } from "vitest";
import { buyActivation, endSession, startSession } from "./actions";
import { appActive, appLockNote, FOCUS_APPS, LADDER_APPS, ladderComplete, nextRung, nextRungCost } from "./apps";
import { BALANCE } from "./constants";
import { rungCost } from "./economy";
import { fresh } from "./fixtures";

describe("app activation (ADR-0012 §2.3)", () => {
  it("keeps Habit free and always on", () => {
    const s = fresh();
    expect(appActive(s, "habit")).toBe(true);
    expect(appLockNote(s, "habit")).toBeNull();
  });

  it("auto-activates Time after the first session", () => {
    const s = fresh();
    expect(appActive(s, "time")).toBe(false);
    expect(appLockNote(s, "time")).toBe("after your first session");

    startSession(s, null);
    expect(appActive(s, "time")).toBe(false);
    endSession(s, Date.now());
    expect(appActive(s, "time")).toBe(true);
    expect(appLockNote(s, "time")).toBeNull();
  });

  it("holds Notes and Goals locked until the activation ladder flips them", () => {
    const s = fresh();
    for (const app of ["notes", "goals"] as const) {
      expect(appActive(s, app)).toBe(false);
      expect(appLockNote(s, app)).toBe("activate with nous");
    }
  });

  it("exposes the launch app inventory in tile order", () => {
    expect(FOCUS_APPS).toEqual(["habit", "time", "notes", "goals"]);
    expect(LADDER_APPS).toEqual(["notes", "goals"]);
  });
});

describe("activation ladder (ADR-0013, issue #42)", () => {
  it("prices rung one below the shelf floor", () => {
    const shelfFloor = Math.min(...Object.values(BALANCE.shelfPrices));
    expect(rungCost(1)).toBeLessThan(shelfFloor);
  });

  it("charges each later rung more, counted globally regardless of app", () => {
    expect(rungCost(2)).toBeGreaterThan(rungCost(1));
    const s = fresh();
    s.nous = nextRungCost(s);
    expect(nextRung(s)).toBe(1);
    buyActivation(s, "goals");
    expect(nextRung(s)).toBe(2);
    expect(nextRungCost(s)).toBe(rungCost(2));
    expect(nextRungCost(s)).toBeGreaterThan(rungCost(1));
  });

  it("sells its rungs in free order", () => {
    const s = fresh();
    s.nous = rungCost(1) + rungCost(2);
    // Goals first: rung one opens Goals even though Notes leads the tiles.
    expect(buyActivation(s, "goals").ok).toBe(true);
    expect(appActive(s, "goals")).toBe(true);
    expect(appActive(s, "notes")).toBe(false);
    expect(buyActivation(s, "notes").ok).toBe(true);
    expect(appActive(s, "notes")).toBe(true);
    expect(ladderComplete(s)).toBe(true);
  });

  it("flips locknotes off as activations land", () => {
    const s = fresh();
    s.nous = nextRungCost(s);
    buyActivation(s, "notes");
    expect(appLockNote(s, "notes")).toBeNull();
    expect(appLockNote(s, "goals")).toBe("activate with nous");
  });

  it("refuses double purchases, non-ladder apps, flow, and empty pockets", () => {
    const s = fresh();
    s.nous = rungCost(1) + rungCost(2);
    buyActivation(s, "notes");
    expect(buyActivation(s, "notes").ok).toBe(false);
    expect(buyActivation(s, "habit").ok).toBe(false);
    expect(buyActivation(s, "time").ok).toBe(false);
    const flow = fresh();
    flow.nous = rungCost(1);
    startSession(flow, null);
    expect(buyActivation(flow, "notes").ok).toBe(false);
    const broke = fresh();
    expect(buyActivation(broke, "notes").ok).toBe(false);
    expect(broke.activatedApps).toHaveLength(0);
    // The opening grant (issue #43) sits in the balance yet never reaches rung one.
    expect(broke.nous).toBeGreaterThan(0);
    expect(broke.nous).toBeLessThan(rungCost(1));
  });
});
