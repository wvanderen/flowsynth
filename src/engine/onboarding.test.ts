import { describe, expect, it } from "vitest";
import {
  acknowledgeWelcome,
  buyActivation,
  buyCell,
  buyGoalCapacity,
  buyShelfModule,
  dismissSummary,
  endSession,
  pauseSession,
  resumeSession,
  startSession,
  upgradeModule,
} from "./actions";
import { advance } from "./advance";
import { appActive } from "./apps";
import { BALANCE } from "./constants";
import { rungCost } from "./economy";
import { fresh } from "./fixtures";
import { hex } from "./hex";
import { createHabit, selectHabit } from "./habits";
import { isCarrier } from "./state";
import { deserialize, serialize } from "./save";
import type { ShelfType } from "./types";

// §5, issue #44: the first session, moment by moment. The beats are
// identical whatever the session's length or early exit, so every exit path
// lands in the same loud summary.

describe("the enter prompt's open-ended shape (§5.5)", () => {
  it("session one is mechanically open-ended — Time is not active yet", () => {
    const s = fresh();
    expect(appActive(s, "time")).toBe(false);
    expect(startSession(s, null).ok).toBe(true);
    expect(s.session?.target).toBeNull();
  });

  it("a habit named at the prompt lands first in the Habit app and takes the session", () => {
    const s = fresh();
    // The prompt's create field: createHabit, then beginFlow's select.
    const created = createHabit(s, "Piano");
    expect(created.ok).toBe(true);
    expect(s.habits).toHaveLength(1);
    expect(selectHabit(s, created.habit!.id).ok).toBe(true);
    startSession(s, null);
    expect(s.activeHabitId).toBe(created.habit!.id);
    advance(s, 600);
    expect(s.habits[0]!.seconds).toBeCloseTo(600, 6);
    endSession(s, 1_000);
    // The session logs to the chosen habit: its first practice-log entry.
    expect(s.practiceLog).toHaveLength(1);
    expect(s.practiceLog[0]!.habitId).toBe(created.habit!.id);
    expect(s.practiceLog[0]!.source).toBe("live");
  });
});

describe("the loud summary (§5.7) — every exit path, identical beats", () => {
  it("an early exit still summarizes: earned, practice minutes, rate, unlock row", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 300);
    expect(endSession(s, 1_000).ok).toBe(true);
    expect(s.summary).not.toBeNull();
    expect(s.summary!.sessionNumber).toBe(1);
    expect(s.summary!.earned).toBeCloseTo(30, 6);
    expect(s.summary!.seconds).toBeCloseTo(300, 6);
    expect(s.summary!.ratePerMinute).toBeCloseTo(6, 6);
    expect(s.summary!.seen).toBe(false);
    expect(s.summary!.timeUnlocked).toBe(true);
  });

  it("a manual exit after the target also summarizes (target reached or not)", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    advance(s, 60);
    expect(endSession(s).ok).toBe(true);
    expect(s.summary!.earned).toBeCloseTo(66, 6);
    expect(s.summary!.timeUnlocked).toBe(true);
  });

  it("exiting from a pause summarizes too", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 120);
    pauseSession(s);
    expect(endSession(s).ok).toBe(true);
    expect(s.summary!.seconds).toBeCloseTo(120, 6);
    expect(s.summary!.earned).toBeCloseTo(12, 6);
  });

  it("pauses never count into earned or the rate", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 60);
    pauseSession(s);
    advance(s, 600);
    resumeSession(s);
    advance(s, 60);
    endSession(s);
    expect(s.summary!.seconds).toBeCloseTo(120, 6);
    expect(s.summary!.earned).toBeCloseTo(12, 6);
    expect(s.summary!.ratePerMinute).toBeCloseTo(6, 6);
  });

  it("the rate achieved matches the production split across advances", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 100);
    advance(s, 200);
    endSession(s);
    expect(s.summary!.earned).toBeCloseTo(30, 6);
    expect(s.summary!.ratePerMinute).toBeCloseTo(6, 6);
  });

  it("the rate breakdown is carrier-only during session one", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 60);
    endSession(s);
    expect(s.summary!.carrier).toBeCloseTo(0.1, 9);
    expect(s.summary!.harmonics).toBe(0);
    expect(s.summary!.chordMultiplier).toBe(1);
    expect(s.summary!.empowerment).toBe(1);
  });

  it("a zero-length session still summarizes, with no rate achieved", () => {
    const s = fresh();
    startSession(s, null);
    endSession(s);
    expect(s.summary!.earned).toBe(0);
    expect(s.summary!.seconds).toBe(0);
    expect(s.summary!.ratePerMinute).toBe(0);
  });

  it("session two's summary drops the unlock row", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 60);
    endSession(s);
    startSession(s, null);
    advance(s, 60);
    endSession(s);
    expect(s.summary!.sessionNumber).toBe(2);
    expect(s.summary!.timeUnlocked).toBe(false);
  });

  it("dismissal is idempotent and the seen flag survives a save round-trip", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 60);
    endSession(s);
    expect(dismissSummary(s).ok).toBe(true);
    expect(dismissSummary(s).ok).toBe(true);
    const restored = deserialize(serialize(s, 1_000)).state!;
    expect(restored.summary!.seen).toBe(true);
    expect(restored.summary!.earned).toBeCloseTo(6, 6);
    expect(restored.summary!.timeUnlocked).toBe(true);
  });

  it("an unseen summary survives a reload to re-open the modal; a seen one stays closed", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 60);
    endSession(s);
    const unseen = deserialize(serialize(s, 1_000)).state!;
    expect(unseen.summary!.seen).toBe(false);
    dismissSummary(s);
    const seen = deserialize(serialize(s, 1_000)).state!;
    expect(seen.summary!.seen).toBe(true);
  });
});

describe("Time auto-activates with the first completion (§5.7–5.8)", () => {
  it("the unlock lands at endSession, never during the session", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 600);
    expect(appActive(s, "time")).toBe(false);
    endSession(s);
    expect(appActive(s, "time")).toBe(true);
    expect(s.activatedApps).toHaveLength(0);
  });

  it("after session one the planned target is a real choice", () => {
    const s = fresh();
    startSession(s, null);
    endSession(s);
    expect(startSession(s, 300).ok).toBe(true);
    expect(s.session?.target).toBe(300);
  });
});

describe("nothing unlocks or purchases mid-session-one (§5.6)", () => {
  it("every economy surface is sealed while session one runs", () => {
    const s = fresh();
    s.nous = 1e6;
    startSession(s, null);
    for (const type of Object.keys(BALANCE.shelfPrices) as ShelfType[]) {
      expect(buyShelfModule(s, type).ok).toBe(false);
    }
    expect(buyCell(s, hex(2, 0)).ok).toBe(false);
    expect(buyActivation(s, "notes").ok).toBe(false);
    expect(buyGoalCapacity(s).ok).toBe(false);
    expect(upgradeModule(s, s.modules.find(isCarrier)!.id).ok).toBe(false);
    expect(acknowledgeWelcome(s).ok).toBe(false);
    expect(s.purchased.generator).toBe(false);
    expect(s.cellsBought).toBe(0);
    expect(s.activatedApps).toHaveLength(0);
    expect(s.goalCapacityBought).toBe(0);
    expect(s.welcomeAcked).toBe(false);
    endSession(s);
    // The same surfaces reopen between sessions.
    expect(acknowledgeWelcome(s).ok).toBe(true);
    expect(buyActivation(s, "notes").ok).toBe(true);
  });
});

describe("post-session: the rung-1-vs-generator choice (§5.8)", () => {
  it("rung one prices below the shelf floor, unguided and side by side", () => {
    const shelfFloor = Math.min(...Object.values(BALANCE.shelfPrices));
    expect(rungCost(1)).toBeLessThan(shelfFloor);
    expect(rungCost(2)).toBeGreaterThan(rungCost(1));
  });
});
