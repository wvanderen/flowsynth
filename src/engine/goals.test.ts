import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { chargeSecondsRemaining } from "./economy";
import { fresh } from "./fixtures";
import { createHabit, selectHabit, addPracticeLog } from "./habits";
import {
  accrueGoalProgress,
  createGoal,
  deleteGoal,
  goalCapacity,
  goalBurstSeconds,
  goalsActive,
  rollGoalOccurrences,
} from "./goals";
import { deserialize, serialize } from "./save";

const DAY = 24 * 60 * 60 * 1000;

function activated(now = 1_000_000) {
  const s = fresh();
  s.timeActive = true;
  s.notesActive = true;
  s.goalsActive = true;
  s.storeOpened = true;
  void now;
  return s;
}

function withHabit(s: ReturnType<typeof fresh>, name = "Piano", now = 1_000_000) {
  const habit = createHabit(s, name)!.habit!;
  selectHabit(s, habit.id);
  return { habit, now };
}

describe("goal slots and creation", () => {
  it("starts with two slots and gains one per module level", () => {
    const s = activated();
    expect(goalCapacity(s)).toBe(2);
    s.modules.find((m) => m.type === "goals")!.level = 1;
    expect(goalCapacity(s)).toBe(3);
  });

  it("rejects goals when full, with bad inputs, or while in flow", () => {
    const { s } = { s: activated() };
    withHabit(s);
    createGoal(s, { habitId: null, minutes: 20, schedule: "daily", now: 1 });
    createGoal(s, { habitId: null, minutes: 20, schedule: "daily", now: 1 });
    expect(createGoal(s, { habitId: null, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    s.modules.find((m) => m.type === "goals")!.level = 1;
    expect(createGoal(s, { habitId: null, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
    expect(createGoal(s, { habitId: null, minutes: 0, schedule: "daily", now: 1 }).ok).toBe(false);
    expect(createGoal(s, { habitId: "nope", minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    startSession(s, 600);
    expect(createGoal(s, { habitId: null, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    expect(deleteGoal(s, s.goals[0]!.id).ok).toBe(false);
    endSession(s);
    expect(deleteGoal(s, s.goals[0]!.id).ok).toBe(true);
  });

  it("stays inactive before the store opens and activates with it", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(s.storeOpened).toBe(false);
    expect(goalsActive(s)).toBe(false);
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.storeOpened).toBe(true);
    expect(s.goalsActive).toBe(true);
  });
});

describe("goal progress and completion", () => {
  it("accrues live practice for matching goals and queues the burst immediately", () => {
    const s = activated();
    const { habit } = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1 });
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.goalsCompleted).toBe(1);
    expect(s.goals[0]!.completed).toBe(true);
    expect(s.goals[0]!.completedCount).toBe(1);
    // Time's completion burst (60s) plus the goal burst (5s) both queue.
    expect(chargeSecondsRemaining(s)).toBeCloseTo(60 + goalBurstSeconds(s.goals[0]!), 6);
    expect(goalBurstSeconds(s.goals[0]!)).toBeCloseTo(5, 6); // 10 min × 0.5 s/min
  });

  it("rewards an occurrence exactly once; extra practice does not re-complete", () => {
    const s = activated();
    const { habit } = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1 });
    startSession(s, null);
    advance(s, 600);
    expect(chargeSecondsRemaining(s)).toBeCloseTo(5, 6); // queued at the boundary
    advance(s, 3600); // flow continues: the burst dispenses, no second reward
    expect(s.goals[0]!.completedCount).toBe(1);
    expect(chargeSecondsRemaining(s)).toBe(0);
  });

  it("matches any-habit goals from every habit and unstructured practice", () => {
    const s = activated();
    createGoal(s, { habitId: null, minutes: 10, schedule: "daily", now: 1 });
    expect(accrueGoalProgress(s, null, 300)).toBe(0); // unstructured still counts
    expect(s.goals[0]!.progressSeconds).toBeCloseTo(300, 6);
    const other = createHabit(s, "Cooking")!.habit!;
    expect(accrueGoalProgress(s, other.id, 300)).toBe(1); // completes
  });

  it("specific-habit goals ignore other habits and no-habit sessions", () => {
    const s = activated();
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
    const s = activated();
    const { habit } = withHabit(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s, 5_000);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 6_000 });
    expect(s.goals[0]!.progressSeconds).toBe(0);
  });

  it("manual logs complete goals between sessions and bank the burst", () => {
    const s = activated();
    const { habit } = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 15, schedule: "daily", now: 1 });
    const result = addPracticeLog(s, habit.id, 15, 2_000);
    expect(result.completions).toBe(1);
    expect(s.goals[0]!.completed).toBe(true);
    expect(chargeSecondsRemaining(s)).toBeCloseTo(7.5, 6);
    expect(s.nous).toBe(0);
  });

  it("inactive module accrues nothing", () => {
    const s = fresh();
    s.timeActive = true;
    const piano = createHabit(s, "Piano")!.habit!;
    createGoal(s, { habitId: piano.id, minutes: 10, schedule: "daily", now: 1 }); // inactive: rejected
    expect(s.goals).toHaveLength(0);
    s.goalsActive = true;
    s.goals.push({
      id: "g1",
      condition: { kind: "habit-minutes", habitId: piano.id, minutes: 10 },
      schedule: { kind: "daily" },
      occurrenceKey: "x",
      progressSeconds: 0,
      completed: false,
      completedCount: 0,
      createdAt: 0,
    });
    s.goalsActive = false;
    accrueGoalProgress(s, piano.id, 600);
    expect(s.goals[0]!.progressSeconds).toBe(0);
  });
});

describe("recurrence", () => {
  it("daily goals reset at the local calendar day boundary", () => {
    const s = activated();
    const { habit } = withHabit(s);
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
    const s = activated();
    const { habit } = withHabit(s);
    const tuesday = Date.UTC(2026, 8, 15, 9); // 2026-09-15 Tue
    createGoal(s, { habitId: habit.id, minutes: 60, schedule: "weekly", now: tuesday });
    accrueGoalProgress(s, habit.id, 1800);
    rollGoalOccurrences(s, tuesday + 2 * DAY); // Thursday, same week
    expect(s.goals[0]!.progressSeconds).toBeCloseTo(1800, 6);
    rollGoalOccurrences(s, Date.UTC(2026, 8, 22, 8)); // next Tuesday
    expect(s.goals[0]!.progressSeconds).toBe(0);
  });

  it("one-time goals never reset and keep their slot", () => {
    const s = activated();
    const { habit } = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    accrueGoalProgress(s, habit.id, 600);
    rollGoalOccurrences(s, 999_999_999);
    expect(s.goals[0]!.completed).toBe(true);
    expect(s.goals).toHaveLength(1);
  });
});

describe("persistence", () => {
  it("round-trips goals and activates them for store-opened older saves", () => {
    const s = activated();
    const { habit } = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "daily", now: 7_000 });
    accrueGoalProgress(s, habit.id, 240);
    const loaded = deserialize(serialize(s))!;
    expect(loaded.state!.goals).toHaveLength(1);
    expect(loaded.state!.goals[0]!.progressSeconds).toBeCloseTo(240, 6);
    expect(loaded.state!.goalsActive).toBe(true);

    const v2 = serialize(s).replace('"version": 3', '"version": 2');
    const parsed = JSON.parse(v2);
    delete parsed.state.goalsActive;
    delete parsed.state.goals;
    const migrated = deserialize(JSON.stringify(parsed))!;
    expect(migrated.state!.goalsActive).toBe(true);
    expect(migrated.state!.goals).toEqual([]);
  });
});
