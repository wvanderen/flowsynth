import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { buyGoalCapacity, endSession, startSession } from "./actions";
import { fresh, give } from "./fixtures";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import { hex } from "./hex";
import {
  accrueGoalProgress,
  createGoal,
  deleteGoal,
  goalCapacity,
  goalTrackerState,
  rollGoalOccurrences,
} from "./goals";
import { longGoalCost } from "./economy";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";

const DAY = 24 * 60 * 60 * 1000;

function withHabit(s: ReturnType<typeof fresh>, name = "Piano") {
  const habit = createHabit(s, name)!.habit!;
  selectHabit(s, habit.id);
  return habit;
}

describe("goal slots and creation", () => {
  it("starts at the base two slots; capacity grows one slot per long-goal purchase", () => {
    const s = fresh();
    expect(goalCapacity(s)).toBe(2);
    s.goalCapacityBought = 2;
    expect(goalCapacity(s)).toBe(4);
  });

  it("sells goal capacity as the first console long goal — Goals is free, so only nous gates it", () => {
    const s = fresh();
    s.nous = longGoalCost(0);
    expect(buyGoalCapacity(s).ok).toBe(true);
    expect(s.goalCapacityBought).toBe(1);
    expect(goalCapacity(s)).toBe(3);
    expect(s.nous).toBe(0);
  });

  it("adds exactly one slot per purchase, priced far past the last, with no occupancy gate (#150)", () => {
    const s = fresh();
    // Much steeper: each slot costs over twice the previous one.
    expect(longGoalCost(1)).toBeGreaterThan(longGoalCost(0) * 2);
    // Successive slots ride back-to-back whenever affordable — an empty
    // tracker never blocks a purchase.
    s.nous = longGoalCost(0) + longGoalCost(1);
    expect(buyGoalCapacity(s).ok).toBe(true);
    expect(goalCapacity(s)).toBe(3);
    expect(buyGoalCapacity(s).ok).toBe(true);
    expect(s.goalCapacityBought).toBe(2);
    expect(goalCapacity(s)).toBe(4);
    expect(s.nous).toBe(0);
  });

  it("refuses the long goal during flow or without nous", () => {
    const s = fresh();
    s.nous = longGoalCost(0);
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
    expect(s.nous - nousBefore).toBeCloseTo(360, 6); // one synth alone; no rewards
    // The meter's growth is the flow cadence's (ADR-0041) — no completion grants:
    // 4200 credited seconds cross the opening fill plus two flat blocks, carrying 420.
    expect(s.flow.earned).toBe(3);
    expect(s.flow.progress).toBeCloseTo(420, 6);
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
    const startingNous = s.nous; // the opening grant (issue #43) sits in the balance
    const result = addPracticeLog(s, habit.id, 15, 2_000);
    expect(result.completions).toBe(1);
    expect(s.goals[0]!.completed).toBe(true);
    expect(s.nous).toBe(startingNous);
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

describe("the tracker's rolled-up state (#149)", () => {
  it("distinguishes no tracked goals, work in progress, and every occurrence complete", () => {
    const s = fresh();
    expect(goalTrackerState(s)).toBe("none");
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1 });
    expect(goalTrackerState(s)).toBe("open");
    accrueGoalProgress(s, habit.id, 600);
    expect(goalTrackerState(s)).toBe("complete");
    // One incomplete current occurrence is enough for in progress, whatever
    // the others say.
    createGoal(s, { habitId: null, minutes: 20, schedule: "once", now: 2 });
    expect(goalTrackerState(s)).toBe("open");
  });

  it("a recurring reset returns the tracker to in progress", () => {
    const s = fresh();
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1 });
    accrueGoalProgress(s, habit.id, 600);
    expect(goalTrackerState(s)).toBe("complete");
    rollGoalOccurrences(s, DAY + 3600_000); // next local day: fresh occurrence
    expect(goalTrackerState(s)).toBe("open");
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

// The Goal Generator's reserve (ADR-0047, wave 5): completing a goal of M
// minutes banks k × the focus equivalent (chargeWindowFraction × M) into
// every owned Goal Generator, board or tray alike, prorated by the live
// share of the goal's progress — manual-only completions bank nothing,
// mixed practice banks its live share. Recurring goals credit once per
// occurrence; overlapping completions each credit.
describe("the Goal Generator's reserve", () => {
  it.each(["live", "manual"] as const)("caps an oversized %s completion at the remaining goal duration", (source) => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    accrueGoalProgress(s, habit.id, 300, source === "live" ? "manual" : "live");
    accrueGoalProgress(s, habit.id, 3600, source);
    expect(s.goals[0]!.progressSeconds).toBe(600);
    expect(s.goals[0]!.liveSeconds).toBe(300);
    expect(gen.reserve).toBeCloseTo(150, 6);
  });

  it("a large manual log preserves the live share earned before completion", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    startSession(s, null);
    advance(s, 300);
    endSession(s);
    addPracticeLog(s, habit.id, 60, 2_000);
    expect(gen.reserve).toBeCloseTo(150, 6);
  });

  it("trusted batches deliver and drain completion credits like one-second ticks", () => {
    function scenario() {
      const s = fresh();
      const board = give(s, "goalKeyed", hex(1, 0));
      const tray = give(s, "goalKeyed", null);
      createGoal(s, { habitId: null, minutes: 1, schedule: "once", now: 1 });
      createGoal(s, { habitId: null, minutes: 2, schedule: "once", now: 1 });
      startSession(s, 600);
      return { s, board, tray };
    }
    const batch = scenario();
    const ticks = scenario();
    applyGap(batch.s, 600, "away", 0, () => 0.5);
    const result = flushPendingAway(batch.s, () => 0.5);
    for (let i = 0; i < 600; i++) advance(ticks.s, 1, () => 0.5);
    expect(result.goalsCompleted).toBe(2);
    expect(batch.board.reserve).toBe(0);
    expect(batch.tray.reserve).toBe(90);
    expect(batch.s.nous).toBeCloseTo(ticks.s.nous, 6);
    expect(batch.s.forge.progress).toBeCloseTo(ticks.s.forge.progress, 6);
    expect(batch.s.session!.goalSeconds).toEqual(ticks.s.session!.goalSeconds);
  });

  it("a live completion banks k × the focus equivalent into every owned Goal Generator", () => {
    const s = fresh();
    const habit = withHabit(s);
    const board = give(s, "goalKeyed", hex(2, 0));
    const tray = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "once", now: 1 });
    startSession(s, 600);
    advance(s, 600);
    advance(s, 600); // 1200 s live — completes the 20-minute goal
    // 5 × 0.1 × 1200 s = 600 s of reserve, per generator.
    expect(board.reserve).toBeCloseTo(600, 6);
    expect(tray.reserve).toBeCloseTo(600, 6);
  });

  it("a half-live, half-manual completion banks exactly the live share of the k× multiple", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "once", now: 1 });
    startSession(s, 600);
    advance(s, 600); // half the goal live
    endSession(s);
    addPracticeLog(s, habit.id, 10, 5_000); // the other half manual — completes it
    // liveShare 0.5 × (5 × 0.1 × 1200) = 300 s.
    expect(gen.reserve).toBeCloseTo(300, 6);
  });

  it("a manual-only completion banks nothing", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    addPracticeLog(s, habit.id, 10, 2_000);
    expect(s.goals[0]!.completed).toBe(true);
    expect(gen.reserve).toBe(0);
  });

  it("honesty-credited completions bank as live — the reconciliation tick credits", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    startSession(s, null);
    applyGap(s, 900, "away", 0); // open-ended past the floor: provisional
    flushPendingAway(s);
    expect(s.goals[0]!.progressSeconds).toBe(0);
    resolveHonestyReport(s, "full");
    // The whole pool credited live: 5 × 0.1 × 600 × (900/900) = 300 s.
    expect(s.goals[0]!.completed).toBe(true);
    expect(gen.reserve).toBeCloseTo(300, 6);
  });

  it("recurring goals credit once per occurrence — the reset re-opens the bank", () => {
    const s = fresh();
    const habit = withHabit(s);
    const monday = Date.UTC(2026, 8, 14, 10);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: monday });
    accrueGoalProgress(s, habit.id, 600);
    expect(gen.reserve).toBeCloseTo(300, 6);
    rollGoalOccurrences(s, monday + DAY); // next day: fresh occurrence
    accrueGoalProgress(s, habit.id, 600);
    // The second occurrence credited again — 600 s total, not 300.
    expect(gen.reserve).toBeCloseTo(600, 6);
  });

  it("overlapping completions each credit", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 2 });
    accrueGoalProgress(s, habit.id, 600); // completes both at once
    // Each goal's own credit lands: 2 × 300 s on the one generator.
    expect(gen.reserve).toBeCloseTo(600, 6);
  });

  it("the occurrence reset clears the live slice with the progress", () => {
    const s = fresh();
    const habit = withHabit(s);
    const monday = Date.UTC(2026, 8, 14, 10);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: monday });
    accrueGoalProgress(s, habit.id, 300);
    expect(s.goals[0]!.liveSeconds).toBeCloseTo(300, 6);
    rollGoalOccurrences(s, monday + DAY);
    expect(s.goals[0]!.liveSeconds).toBe(0);
    expect(s.goals[0]!.progressSeconds).toBe(0);
  });

  it("a goal saved before the generators wave loads with its live slice defaulted empty", () => {
    const s = fresh();
    const habit = withHabit(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    const saved = JSON.parse(serialize(s));
    delete saved.state.goals[0].liveSeconds;
    const result = deserialize(JSON.stringify(saved));
    expect(result.error).toBeUndefined();
    expect(result.state!.goals[0]!.liveSeconds).toBe(0);
  });
});
