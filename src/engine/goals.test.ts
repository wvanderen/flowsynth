import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh, give, giveHabit } from "./fixtures";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import { hex } from "./hex";
import {
  accrueGoalProgress,
  createGoal,
  deleteGoal,
  editGoal,
  normalizeGoals,
  occurrenceKeyFor,
  pendingGoalsOf,
  retainGoalChoice,
  rollGoalOccurrences,
  activeGoalOf,
} from "./goals";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import type { Goal } from "./types";

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

describe("one goal per habit", () => {
  it("create refuses while an active goal stands, and answers again once it is gone (issue #445)", () => {
    const s = fresh();
    const habit = withHabit(s);
    const made = createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 });
    expect(made.ok).toBe(true);
    expect(createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(false);
    deleteGoal(s, made.goal!.id);
    expect(createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
    // Another habit's goal is its own.
    const other = createHabit(s, "Cooking")!.habit!;
    expect(createGoal(s, { habitId: other.id, minutes: 5, schedule: "daily", now: 1 }).ok).toBe(true);
  });

  it("an unresolved migration choice also refuses create until a goal is retained (issue #445)", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).goal!;
    goal.pendingChoice = true;
    expect(createGoal(s, { habitId: habit.id, minutes: 9, schedule: "once", now: 1 }).ok).toBe(false);
    expect(retainGoalChoice(s, goal.id).ok).toBe(true);
    // The retained row is the habit's active goal; a fresh goal waits for
    // its removal.
    expect(createGoal(s, { habitId: habit.id, minutes: 9, schedule: "once", now: 1 }).ok).toBe(false);
    deleteGoal(s, goal.id);
    expect(createGoal(s, { habitId: habit.id, minutes: 9, schedule: "once", now: 1 }).ok).toBe(true);
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

  it("delete removes the habit's active goal and never a carried-over row (issue #445)", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: 1 }).goal!;
    goal.pendingChoice = true;
    expect(deleteGoal(s, goal.id).ok).toBe(false);
    expect(s.goals).toHaveLength(1);
    retainGoalChoice(s, goal.id);
    expect(deleteGoal(s, goal.id).ok).toBe(true);
    expect(activeGoalOf(s, habit.id)).toBeUndefined();
    expect(goal.retired).toBe(true);
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

describe("goal edits (issue #445)", () => {
  it("a target edit retains qualifying practice: 30 to 60 after 20 qualifying minutes", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 30, schedule: "daily", now: 1 }).goal!;
    startSession(s, null);
    advance(s, 20 * 60);
    endSession(s);
    expect(editGoal(s, goal.id, { minutes: 60, schedule: "daily" }, 9_000).ok).toBe(true);
    expect(goal.condition.minutes).toBe(60);
    expect(goal.progressSeconds).toBeCloseTo(20 * 60, 6);
    expect(goal.completed).toBe(false);
    // The retained minutes ride toward the raised target: forty more
    // completes it.
    startSession(s, null);
    expect(advance(s, 40 * 60).goalsCompleted).toBe(1);
    endSession(s);
    expect(goal.completedCount).toBe(1);
  });

  it("a met goal stays completed until a raised target un-completes it, and no credit replays", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    fullFuel(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 }).goal!;
    startSession(s, null);
    advance(s, 600);
    endSession(s);
    expect(goal.completed).toBe(true);
    const creditedOnce = gen.reserve;
    // Lower the target below met progress: already complete, no second
    // completion tick, no second credit.
    editGoal(s, goal.id, { minutes: 5, schedule: "once" }, 9_000);
    expect(goal.completed).toBe(true);
    expect(gen.reserve).toBe(creditedOnce);
    // Raise it: the completion un-lands, the practice stays.
    editGoal(s, goal.id, { minutes: 15, schedule: "once" }, 9_100);
    expect(goal.completed).toBe(false);
    expect(goal.progressSeconds).toBeCloseTo(600, 6);
    startSession(s, null);
    expect(advance(s, 300).goalsCompleted).toBe(1);
    endSession(s);
    // The raised target's completion is the goal's second lifetime
    // completion — the count accrues across the edit.
    expect(goal.completedCount).toBe(2);
  });

  it("a cadence edit splits live practice at midnight and never replays fuel", () => {
    const s = fresh();
    const habit = withHabit(s);
    const midnight = new Date(2026, 9, 21).getTime();
    const goal = createGoal(s, { habitId: habit.id, minutes: 60, schedule: "weekly", now: midnight - DAY }).goal!;
    startSession(s, null, midnight - 600_000);
    advance(s, 1200);
    endSession(s, midnight + 600_000);
    const fuel = s.goalFuel;
    editGoal(s, goal.id, { minutes: 60, schedule: "daily" }, midnight + 600_000);
    expect(goal.progressSeconds).toBeCloseTo(600);
    expect(goal.liveSeconds).toBeCloseTo(600);
    expect(s.goalFuel).toBe(fuel);
    const loaded = deserialize(serialize(s)).state!;
    expect(activeGoalOf(loaded, habit.id)!.progressSeconds).toBeCloseTo(600);
  });

  it("removal, replacement, edits and reload preserve previous goal descriptions", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 30, schedule: "daily", now: 1 }).goal!;
    startSession(s, null, 1000);
    advance(s, 600);
    endSession(s, 601000);
    editGoal(s, goal.id, { minutes: 60, schedule: "weekly" }, 602000);
    deleteGoal(s, goal.id);
    expect(createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 603000 }).ok).toBe(true);
    const loaded = deserialize(serialize(s)).state!;
    expect(loaded.sessionRecords[0]!.goalsAdvanced[0]!.goal!.condition.minutes).toBe(30);
    expect(loaded.sessionRecords[0]!.goalsAdvanced[0]!.goal!.schedule.kind).toBe("daily");
    expect(loaded.goals.find(row => row.id === goal.id)!.retired).toBe(true);
  });

  it("edits refuse bad figures and lock in flow", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 }).goal!;
    expect(editGoal(s, goal.id, { minutes: 0, schedule: "once" }, 9_000).ok).toBe(false);
    expect(editGoal(s, "nope", { minutes: 10, schedule: "once" }, 9_000).ok).toBe(false);
    startSession(s, 600);
    expect(editGoal(s, goal.id, { minutes: 20, schedule: "once" }, 9_000).ok).toBe(false);
    endSession(s);
    expect(goal.condition.minutes).toBe(10);
  });

  it("a cadence edit recalculates from qualifying practice in the new period", () => {
    const s = fresh();
    const habit = withHabit(s);
    const wednesday = Date.UTC(2026, 9, 21, 10); // 2026-10-21 Wed
    const goal = createGoal(s, { habitId: habit.id, minutes: 30, schedule: "daily", now: wednesday - 3 * DAY }).goal!;
    // Yesterday's credited session (10 min) and last week's (12 min).
    startSession(s, null);
    advance(s, 600);
    endSession(s, wednesday - DAY);
    startSession(s, null);
    advance(s, 720);
    endSession(s, wednesday - 8 * DAY);
    // Today's live practice and manual condition progress both survive.
    startSession(s, null);
    advance(s, 300);
    endSession(s, wednesday);
    addPracticeLog(s, habit.id, 10, wednesday + 1_000);
    editGoal(s, goal.id, { minutes: 30, schedule: "weekly" }, wednesday + 2_000);
    expect(goal.schedule.kind).toBe("weekly");
    expect(goal.occurrenceKey).toBe(occurrenceKeyFor(goal.schedule, wednesday + 2_000));
    // Last week stays outside the period; manual time never joins live credit.
    expect(goal.progressSeconds).toBeCloseTo(300 + 600 + 600, 6);
    expect(goal.liveSeconds).toBeCloseTo(300 + 600, 6);
    expect(goal.completed).toBe(false);
  });

  it("a cadence edit to once reads from the goal's creation; daily reads from local midnight", () => {
    const s = fresh();
    const habit = withHabit(s);
    const created = new Date(2026, 9, 19, 23).getTime(); // created late on the 19th
    const goal = createGoal(s, { habitId: habit.id, minutes: 60, schedule: "once", now: created }).goal!;
    startSession(s, null);
    advance(s, 1_200);
    endSession(s, created + DAY + 3_600_000 + 1_200_000); // the 21st, 00:00 local
    editGoal(s, goal.id, { minutes: 60, schedule: "daily" }, created + DAY + 3_600_000 + 1_200_000);
    // Daily's period is today: the whole session landed after midnight.
    expect(goal.progressSeconds).toBeCloseTo(1_200, 6);
    // Back to once reads from creation: the whole record.
    editGoal(s, goal.id, { minutes: 60, schedule: "once" }, created + DAY + 3_600_000 + 1_200_000);
    expect(goal.progressSeconds).toBeCloseTo(1_200, 6);
    editGoal(s, goal.id, { minutes: 10, schedule: "daily" }, created + DAY + 3_600_000 + 1_200_000);
    expect(goal.completed).toBe(true);
    expect(goal.completedCount).toBe(0); // the recalculation never mints a completion
  });
});

describe("the migration's retain-one choice (issue #445)", () => {
  // The v11 → v12 conversion's shape, built by hand: several active rows
  // for one habit, every row held pending.
  function pendingPair(s: ReturnType<typeof fresh>): [Goal, Goal] {
    const habit = s.habits[0]!;
    const a = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 }).goal!;
    const b: Goal = {
      ...structuredClone(a),
      id: `${a.id}b`,
      condition: { kind: "habit-minutes", habitId: habit.id, minutes: 45 },
      progressSeconds: 900,
      createdAt: a.createdAt + 1,
    };
    s.goals.push(b);
    a.pendingChoice = true;
    b.pendingChoice = true;
    return [a, b];
  }

  it("pending rows neither accrue nor complete, and practice is never blocked", () => {
    const s = fresh();
    withHabit(s);
    const gen = give(s, "goalKeyed", null);
    fullFuel(s);
    const [a, b] = pendingPair(s);
    expect(activeGoalOf(s, s.habits[0]!.id)).toBeUndefined();
    // An unresolved choice never blocks a session.
    startSession(s, null);
    advance(s, 3_600);
    endSession(s);
    expect(a.progressSeconds).toBe(0);
    expect(b.progressSeconds).toBe(900);
    expect(a.completed).toBe(false);
    expect(b.completed).toBe(false);
    // The reserve holds the session-end focus earning alone — no goal
    // credit rode on the unresolved rows (Milestone's 0.02 × 3600).
    expect(gen.reserve).toBeCloseTo(72, 6);
  });

  it("retaining one row activates it with its record and retires the siblings to history", () => {
    const s = fresh();
    const habit = withHabit(s);
    const [a, b] = pendingPair(s);
    expect(retainGoalChoice(s, b.id).ok).toBe(true);
    expect(b.pendingChoice).toBeUndefined();
    expect(b.retired).toBeUndefined();
    expect(a.retired).toBe(true);
    expect(pendingGoalsOf(s, habit.id)).toHaveLength(0);
    expect(activeGoalOf(s, habit.id)).toBe(b);
    expect(b.progressSeconds).toBe(900);
    // The retained row runs: credited practice advances it again.
    fullFuel(s);
    expect(accrueGoalProgress(s, habit.id, 1_800)).toBe(1);
    expect(b.completed).toBe(true);
    // The retired sibling's facts never moved.
    expect(a.progressSeconds).toBe(0);
    expect(a.condition).toEqual({ kind: "habit-minutes", habitId: habit.id, minutes: 10 });
  });

  it("the choice locks in flow like every goal mutation", () => {
    const s = fresh();
    withHabit(s);
    const [a] = pendingPair(s);
    startSession(s, 600);
    expect(retainGoalChoice(s, a.id).ok).toBe(false);
    endSession(s);
    expect(a.pendingChoice).toBe(true);
  });

  it("a pending selection and its records survive reload", () => {
    const s = fresh();
    withHabit(s);
    const [a, b] = pendingPair(s);
    const loaded = deserialize(serialize(s)).state!;
    const loadedA = loaded.goals.find((g) => g.id === a.id)!;
    const loadedB = loaded.goals.find((g) => g.id === b.id)!;
    expect(loadedA.pendingChoice).toBe(true);
    expect(loadedB.pendingChoice).toBe(true);
    expect(loadedB.progressSeconds).toBe(900);
    expect(loaded.habits[0]!.color).toBe("vermillion");
    retainGoalChoice(loaded, loadedA.id);
    expect(loadedA.pendingChoice).toBeUndefined();
    expect(loadedB.retired).toBe(true);
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

  it("one-time goals never reset and keep running until edited or replaced", () => {
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

  it("normalizeGoals drops the retired per-goal palette key and carries a pending flag as written", () => {
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 }).goal!;
    const legacy = { ...structuredClone(goal), color: "cyan", liveSeconds: undefined } as unknown as Goal;
    const pending = { ...structuredClone(goal), id: `${goal.id}p`, pendingChoice: false } as unknown as Goal;
    normalizeGoals([legacy, pending]);
    expect("color" in legacy).toBe(false);
    expect(legacy.liveSeconds).toBe(0);
    expect("pendingChoice" in pending).toBe(false);
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
      fullFuel(s);
      startSession(s, 600);
      return { s, board, tray };
    }
    const batch = scenario();
    const ticks = scenario();
    applyGap(batch.s, 600, "away", 0, () => 0.5);
    const result = flushPendingAway(batch.s, () => 0.5);
    for (let i = 0; i < 600; i++) advance(ticks.s, 1, () => 0.5);
    expect(result.goalsCompleted).toBe(1);
    // The sub-floor absence auto-credits through the live legs, so the
    // completion banks its full live share: 60 s of credited time × the
    // Milestone's 5 × 0.1, on every owned generator. The board copy's
    // reserve already drained its window — the tray copy holds it.
    expect(batch.board.reserve).toBe(0);
    expect(batch.tray.reserve).toBe(30);
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

  it("edits and replacements never replay the pool: total credit is the credited time the budget accrued", () => {
    const s = fresh();
    const habit = withHabit(s);
    const gen = give(s, "goalKeyed", null);
    const goal = createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 }).goal!;
    startSession(s, null);
    advance(s, 600); // completes; the pool accrued 0.1 × 600 and the draw took it all
    endSession(s);
    const first = gen.reserve;
    // The pool-limited draw (60) beside the session-end focus earning
    // (Milestone's 0.02 × 600 = 12).
    expect(first).toBeCloseTo(72, 6);
    expect(s.goalFuel).toBeCloseTo(0, 9);
    // A raised target re-opens the goal; only the budget the new practice
    // accrued can pay the second completion.
    editGoal(s, goal.id, { minutes: 20, schedule: "once" }, 9_000);
    startSession(s, null);
    advance(s, 600); // completes the 20 at 1200 s of progress
    endSession(s);
    // The goal-credit legs took exactly the accrued fuel twice (60 + 60 =
    // 0.1 × 1200 credited seconds); the focus earnings rode beside (24).
    expect(gen.reserve).toBeCloseTo(144, 6);
    expect(s.goalFuel).toBeCloseTo(0, 9);
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
