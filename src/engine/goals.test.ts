import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { buyActivation, buyGoalCapacity, endSession, startSession } from "./actions";
import { fresh } from "./fixtures";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import {
  accrueGoalProgress,
  createGoal,
  deleteGoal,
  goalCapacity,
  rollGoalOccurrences,
} from "./goals";
import { longGoalCost, rungCost } from "./economy";
import { deserialize, serialize } from "./save";

const DAY = 24 * 60 * 60 * 1000;

function withHabit(s: ReturnType<typeof fresh>, name = "Piano") {
  const habit = createHabit(s, name)!.habit!;
  selectHabit(s, habit.id);
  return habit;
}

describe("goal slots and creation", () => {
  it("starts at the base two slots; capacity grows only through the console long goal", () => {
    const s = fresh();
    expect(goalCapacity(s)).toBe(2);
    s.goalCapacityBought = 2;
    expect(goalCapacity(s)).toBe(6);
  });

  it("sells goal capacity as the first console long goal, gated behind Goals activation", () => {
    const s = fresh();
    s.nous = longGoalCost(0) + rungCost(1);
    // Locked apps sell no upgrades (ADR-0012).
    expect(buyGoalCapacity(s).ok).toBe(false);
    expect(buyActivation(s, "goals").ok).toBe(true);
    expect(buyGoalCapacity(s).ok).toBe(true);
    expect(s.goalCapacityBought).toBe(1);
    expect(goalCapacity(s)).toBe(4);
    expect(s.nous).toBe(0);
  });

  it("prices each long goal past the last, one at a time", () => {
    const s = fresh();
    expect(longGoalCost(1)).toBeGreaterThan(longGoalCost(0));
    s.nous = rungCost(1) + longGoalCost(0) + longGoalCost(1);
    buyActivation(s, "goals");
    expect(buyGoalCapacity(s).ok).toBe(true);
    expect(buyGoalCapacity(s).ok).toBe(true);
    expect(s.goalCapacityBought).toBe(2);
    expect(s.nous).toBe(0);
  });

  it("refuses the long goal during flow or without nous", () => {
    const s = fresh();
    s.nous = rungCost(1) + longGoalCost(0);
    buyActivation(s, "goals");
    startSession(s, null);
    expect(buyGoalCapacity(s).ok).toBe(false);
    endSession(s);
    s.nous = 0;
    expect(buyGoalCapacity(s).ok).toBe(false);
    expect(s.goalCapacityBought).toBe(0);
  });

  it("rejects goals when full, with bad inputs, or while in flow", () => {
    const s = fresh();
    withHabit(s);
    createGoal(s, { habitId: null, minutes: 20, schedule: "daily", now: 1 });
    createGoal(s, { habitId: null, minutes: 20, schedule: "daily", now: 1 });
    expect(createGoal(s, { habitId: null, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    deleteGoal(s, s.goals[0]!.id);
    expect(createGoal(s, { habitId: null, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
    expect(createGoal(s, { habitId: null, minutes: 0, schedule: "daily", now: 1 }).ok).toBe(false);
    expect(createGoal(s, { habitId: "nope", minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    startSession(s, 600);
    expect(createGoal(s, { habitId: null, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    expect(deleteGoal(s, s.goals[0]!.id).ok).toBe(false);
    endSession(s);
    expect(deleteGoal(s, s.goals[0]!.id).ok).toBe(true);
  });
});

describe("goal progress and completion", () => {
  it("accrues live practice for matching goals and completes them once", () => {
    const s = fresh();
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1 });
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.goalsCompleted).toBe(1);
    expect(s.goals[0]!.completed).toBe(true);
    expect(s.goals[0]!.completedCount).toBe(1);
  });

  it("templates are conditions only: completions grant nothing", () => {
    const s = fresh();
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1 });
    startSession(s, null);
    advance(s, 600);
    expect(s.goals[0]!.completed).toBe(true);
    const nousBefore = s.nous;
    advance(s, 3600);
    expect(s.nous - nousBefore).toBeCloseTo(360, 6); // carrier alone; no rewards
    expect(s.forge.progress).toBe(0);
    expect(s.goals[0]!.completedCount).toBe(1);
  });

  it("matches any-habit goals from every habit and unstructured practice", () => {
    const s = fresh();
    createGoal(s, { habitId: null, minutes: 10, schedule: "daily", now: 1 });
    expect(accrueGoalProgress(s, null, 300)).toBe(0); // unstructured still counts
    expect(s.goals[0]!.progressSeconds).toBeCloseTo(300, 6);
    const other = createHabit(s, "Cooking")!.habit!;
    expect(accrueGoalProgress(s, other.id, 300)).toBe(1); // completes
  });

  it("specific-habit goals ignore other habits and no-habit sessions", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    createGoal(s, { habitId: piano.id, minutes: 10, schedule: "daily", now: 1 });
    const cooking = createHabit(s, "Cooking")!.habit!;
    accrueGoalProgress(s, cooking.id, 600);
    accrueGoalProgress(s, null, 600);
    expect(s.goals[0]!.progressSeconds).toBe(0);
    accrueGoalProgress(s, piano.id, 600);
    expect(s.goals[0]!.completed).toBe(true);
  });

  it("does not count practice from before the goal existed", () => {
    const s = fresh();
    const habit = withHabit(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s, 5_000);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 6_000 });
    expect(s.goals[0]!.progressSeconds).toBe(0);
  });

  it("manual logs complete goals between sessions", () => {
    const s = fresh();
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 15, schedule: "daily", now: 1 });
    const result = addPracticeLog(s, habit.id, 15, 2_000);
    expect(result.completions).toBe(1);
    expect(s.goals[0]!.completed).toBe(true);
    expect(s.nous).toBe(0);
  });
});

describe("recurrence", () => {
  it("daily goals reset at the local calendar day boundary", () => {
    const s = fresh();
    const habit = withHabit(s);
    const monday = Date.UTC(2026, 8, 14, 10); // 2026-09-14 10:00 UTC
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: monday });
    accrueGoalProgress(s, habit.id, 300);
    rollGoalOccurrences(s, monday + 3600_000); // same day: no reset
    expect(s.goals[0]!.progressSeconds).toBeCloseTo(300, 6);
    rollGoalOccurrences(s, monday + DAY); // next day: fresh occurrence
    expect(s.goals[0]!.progressSeconds).toBe(0);
    expect(s.goals[0]!.completed).toBe(false);
    expect(s.goals[0]!.completedCount).toBe(0);
  });

  it("weekly goals reset at the Monday boundary", () => {
    const s = fresh();
    const habit = withHabit(s);
    const tuesday = Date.UTC(2026, 8, 15, 9); // 2026-09-15 Tue
    createGoal(s, { habitId: habit.id, minutes: 60, schedule: "weekly", now: tuesday });
    accrueGoalProgress(s, habit.id, 1800);
    rollGoalOccurrences(s, tuesday + 2 * DAY); // Thursday, same week
    expect(s.goals[0]!.progressSeconds).toBeCloseTo(1800, 6);
    rollGoalOccurrences(s, Date.UTC(2026, 8, 22, 8)); // next Tuesday
    expect(s.goals[0]!.progressSeconds).toBe(0);
  });

  it("one-time goals never reset and keep their slot", () => {
    const s = fresh();
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    accrueGoalProgress(s, habit.id, 600);
    rollGoalOccurrences(s, 999_999_999);
    expect(s.goals[0]!.completed).toBe(true);
    expect(s.goals).toHaveLength(1);
  });
});

describe("persistence", () => {
  it("round-trips goals with their progress", () => {
    const s = fresh();
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "daily", now: 7_000 });
    accrueGoalProgress(s, habit.id, 240);
    const loaded = deserialize(serialize(s))!;
    expect(loaded.state!.goals).toHaveLength(1);
    expect(loaded.state!.goals[0]!.progressSeconds).toBeCloseTo(240, 6);
  });
});
