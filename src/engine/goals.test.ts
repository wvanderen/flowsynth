import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh, give, giveHabit } from "./fixtures";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import { hex } from "./hex";
import {
  accrueGoalProgress,
  createGoal,
  DEFAULT_GOAL_COLOR,
  deleteGoal,
  GOAL_COLORS,
  goalCapacity,
  goalTrackerState,
  normalizeGoals,
  rollGoalOccurrences,
  setGoalColor,
} from "./goals";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import { BALANCE } from "./constants";

const DAY = 24 * 60 * 60 * 1000;

function withHabit(s: ReturnType<typeof fresh>, name = "Piano") {
  const habit = createHabit(s, name)!.habit!;
  selectHabit(s, habit.id);
  return habit;
}

// The completion-credit arithmetic is the subject of its own describe; the
// budget pool there is filled past any draw so the proration reads plain.
// Where the budget itself is the subject, the pool starts where the state
// starts: empty.
function fullFuel(s: ReturnType<typeof fresh>): void {
  s.goalFuel = 1e12;
}

describe("goal slots and creation", () => {
  it("each habit owns a small fixed capacity — never purchasable (issue #423)", () => {
    const s = fresh();
    expect(goalCapacity()).toBe(BALANCE.habitGoalSlots);
    const habit = withHabit(s);
    for (let i = 0; i < BALANCE.habitGoalSlots; i++) {
      expect(createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
    }
    expect(createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    deleteGoal(s, s.goals[0]!.id);
    expect(createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
    // Another habit's slots are its own.
    const other = createHabit(s, "Cooking")!.habit!;
    expect(createGoal(s, { habitId: other.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
  });

  it("goals are habit-owned: the cross-habit template refuses (issue #423)", () => {
    const s = fresh();
    expect(createGoal(s, { habitId: null, minutes: 10, schedule: "daily", now: 1 }).ok).toBe(false);
  });

  it("rejects goals with bad inputs, unknown habits, or while in flow", () => {
    const s = fresh();
    const habit = withHabit(s);
    expect(createGoal(s, { habitId: habit.id, minutes: 0, schedule: "daily", now: 1 }).ok).toBe(false);
    expect(createGoal(s, { habitId: "nope", minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    startSession(s, 600);
    expect(createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    endSession(s);
    expect(createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
  });

  it("colors a goal at creation — vermillion default, chosen key kept (#312)", () => {
    const s = fresh();
    const habit = withHabit(s);
    const plain = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 }).goal!;
    expect(plain.color).toBe(DEFAULT_GOAL_COLOR);
    expect(GOAL_COLORS).toEqual(["vermillion", "amber", "green", "cyan", "indigo", "violet"]);
    const picked = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1, color: "cyan" }).goal!;
    expect(picked.color).toBe("cyan");
    // An unknown key falls back to the default, never a made-up token.
    const stray = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1, color: "chartreuse" as never }).goal!;
    expect(stray.color).toBe(DEFAULT_GOAL_COLOR);
  });

  it("re-colors a goal in upgrade mode only, on real goals with real keys (#312)", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 }).goal!;
    expect(setGoalColor(s, goal.id, "indigo").ok).toBe(true);
    expect(goal.color).toBe("indigo");
    expect(setGoalColor(s, "nope", "cyan").ok).toBe(false);
    expect(setGoalColor(s, goal.id, "chartreuse" as never).ok).toBe(false);
    expect(goal.color).toBe("indigo");
    startSession(s, 600);
    expect(setGoalColor(s, goal.id, "cyan").ok).toBe(false);
    endSession(s);
    expect(goal.color).toBe("indigo");
  });

  it("lenient-defaults a pre-palette save's color and drops corrupt keys (#312)", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1, color: "violet" }).goal!;
    const legacy = { ...goal, color: undefined } as unknown as typeof goal;
    const corrupt = { ...goal, id: `${goal.id}x`, color: 7 } as unknown as typeof goal;
    normalizeGoals([legacy, corrupt]);
    expect(legacy.color).toBe(DEFAULT_GOAL_COLOR);
    expect(corrupt.color).toBe(DEFAULT_GOAL_COLOR);
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
    fullFuel(s);
    startSession(s, null);
    advance(s, 600);
    expect(s.goals[0]!.completed).toBe(true);
    const nousBefore = s.nous;
    advance(s, 3600);
    expect(s.nous - nousBefore).toBeCloseTo(360, 6); // one synth alone; no rewards
    // The meter's growth is the practice-roll cadence's (issue #423) — no
    // completion grants: 4200 credited seconds cross the opening fill plus
    // two flat blocks, carrying 420.
    expect(s.habits[0]!.classes.engineer!.rollMeter.earned).toBe(3);
    expect(s.habits[0]!.classes.engineer!.rollMeter.progress).toBeCloseTo(420, 6);
    expect(s.goals[0]!.completedCount).toBe(1);
  });

  it("goals are habit-owned: only their habit's practice advances them (issue #423)", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    createGoal(s, { habitId: piano.id, minutes: 10, schedule: "daily", now: 1 });
    expect(accrueGoalProgress(s, null, 300)).toBe(0); // unstructured advances nothing
    expect(s.goals[0]!.progressSeconds).toBe(0);
    const cooking = createHabit(s, "Cooking")!.habit!;
    expect(accrueGoalProgress(s, cooking.id, 600)).toBe(0); // another habit advances nothing
    expect(s.goals[0]!.progressSeconds).toBe(0);
    expect(accrueGoalProgress(s, piano.id, 600)).toBe(1); // completes
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
    expect(goalTrackerState(s)).toBe("none"); // no habit selected
    const habit = withHabit(s);
    expect(goalTrackerState(s)).toBe("none"); // the habit tracks nothing yet
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1 });
    expect(goalTrackerState(s)).toBe("open");
    accrueGoalProgress(s, habit.id, 600);
    expect(goalTrackerState(s)).toBe("complete");
    // One incomplete current occurrence is enough for in progress, whatever
    // the others say.
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "once", now: 2 });
    expect(goalTrackerState(s)).toBe("open");
    // Another habit's goals never qualify the tracker.
    const other = createHabit(s, "Cooking")!.habit!;
    selectHabit(s, other.id);
    expect(goalTrackerState(s)).toBe("none");
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
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "daily", now: 7_000, color: "amber" });
    accrueGoalProgress(s, habit.id, 240);
    const loaded = deserialize(serialize(s))!;
    expect(loaded.state!.goals).toHaveLength(1);
    expect(loaded.state!.goals[0]!.progressSeconds).toBeCloseTo(240, 6);
    expect(loaded.state!.goals[0]!.color).toBe("amber");
  });
});

// The completion tick's credit (ADR-0047, generalized by issue #371,
// budgeted by issue #423): completing a goal banks the focus equivalent (the
// Flywheel's focus rate × the goal's credited seconds) × its live share into
// every owned generator at its profile's goal coefficient, drawn against the
// goalFuel pool. Manual-only completions bank nothing; recurring goals
// credit once per occurrence; overlapping completions each credit.
describe("the completion tick's credit", () => {
  it.each(["live", "manual"] as const)("caps an oversized %s completion at the remaining goal duration", (source) => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    fullFuel(s);
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
    fullFuel(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    startSession(s, null);
    advance(s, 300);
    endSession(s);
    addPracticeLog(s, habit.id, 60, 2_000);
    // The session's banked focus earning (Milestone's modest 0.02 × 300)
    // rides beside the completion's live share: 6 + 150.
    expect(gen.reserve).toBeCloseTo(156, 6);
  });

  it("trusted batches deliver and drain completion credits like one-second ticks", () => {
    function scenario() {
      const s = fresh();
      const board = give(s, "goalKeyed", hex(1, 0));
      const tray = give(s, "goalKeyed", null);
      const habit = giveHabit(s).habit;
      createGoal(s, { habitId: habit.id, minutes: 1, schedule: "once", now: 1 });
      createGoal(s, { habitId: habit.id, minutes: 2, schedule: "once", now: 1 });
      fullFuel(s);
      startSession(s, 600);
      return { s, board, tray };
    }
    const batch = scenario();
    const ticks = scenario();
    applyGap(batch.s, 600, "away", 0, () => 0.5);
    const result = flushPendingAway(batch.s, () => 0.5);
    for (let i = 0; i < 600; i++) advance(ticks.s, 1, () => 0.5);
    expect(result.goalsCompleted).toBe(2);
    // The sub-floor absence auto-credits through the live legs, so both
    // completions bank their full live shares: 60 s and 120 s of credited
    // time × the Milestone's 5 × 0.1, on every owned generator. The board
    // copy's reserve already drained its window — the tray copy holds both.
    expect(batch.board.reserve).toBe(0);
    expect(batch.tray.reserve).toBe(90);
    expect(batch.s.nous).toBeCloseTo(ticks.s.nous, 6);
    expect(batch.s.forge.progress).toBeCloseTo(ticks.s.forge.progress, 6);
    expect(batch.s.session!.goalSeconds).toEqual(ticks.s.session!.goalSeconds);
  });

  it("a live completion banks the Milestone's ×5 on the focus equivalent into every owned Milestone", () => {
    const s = fresh();
    const habit = withHabit(s);
    const board = give(s, "goalKeyed", hex(2, 0));
    const tray = give(s, "goalKeyed", null);
    fullFuel(s);
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "once", now: 1 });
    startSession(s, 600);
    advance(s, 600);
    advance(s, 600); // 1200 s live — completes the 20-minute goal
    // 5 × 0.1 × 1200 = 600 charge, per generator.
    expect(board.reserve).toBeCloseTo(600, 6);
    expect(tray.reserve).toBeCloseTo(600, 6);
  });

  it("a half-live, half-manual completion banks exactly the live share of the k× multiple", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    fullFuel(s);
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "once", now: 1 });
    startSession(s, 600);
    advance(s, 600); // half the goal live
    endSession(s);
    addPracticeLog(s, habit.id, 10, 5_000); // the other half manual — completes it
    // liveShare 0.5 × (5 × 0.1 × 1200) = 300, beside the session's banked
    // focus earning (0.02 × 600 = 12).
    expect(gen.reserve).toBeCloseTo(312, 6);
  });

  it("a manual-only completion banks nothing", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    fullFuel(s);
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    addPracticeLog(s, habit.id, 10, 2_000);
    expect(s.goals[0]!.completed).toBe(true);
    expect(gen.reserve).toBe(0);
  });

  it("honesty-credited completions bank as live — the reconciliation tick credits", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    fullFuel(s);
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
    fullFuel(s);
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
    fullFuel(s);
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
