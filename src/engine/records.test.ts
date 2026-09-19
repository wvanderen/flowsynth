import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, recordSummaryReflection, startSession } from "./actions";
import { createGoal, deleteGoal } from "./goals";
import { addPracticeLog, createHabit, renameHabit, archiveHabit, selectHabit } from "./habits";
import { writeNote } from "./notes";
import {
  habitPracticeSummary,
  habitRecordName,
  habitTaggedNotes,
  recordMissed,
  recordTargetHit,
  sessionRecordsNewestFirst,
} from "./records";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import type { GameState } from "./types";
import { fresh } from "./fixtures";

// Session records (focus-tool spec §9): one append-only entry per session
// at close, whatever its length or mode; history derives hits and misses,
// and ids resolve at render.

const START = new Date(2026, 8, 18, 9, 0).getTime();
const END = START + 30 * 60_000;

function practice(state: GameState, seconds: number): void {
  advance(state, seconds);
}

describe("the session record", () => {
  it("every session writes exactly one record at close — planned, open-ended, unstructured, seconds-long", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, 600, START);
    practice(s, 600);
    endSession(s, START + 600_000);

    startSession(s, null, START + 700_000);
    practice(s, 60);
    endSession(s, START + 760_000);

    selectHabit(s, null);
    startSession(s, null, START + 800_000);
    endSession(s, START + 800_500);

    startSession(s, 600, START + 900_000);
    endSession(s, START + 900_400);

    expect(s.sessionRecords).toHaveLength(4);
    expect(s.sessionRecords.map((r) => r.sessionNumber)).toEqual([1, 2, 3, 4]);
    expect(s.sessionRecords[0]!.mode).toBe("planned");
    expect(s.sessionRecords[1]!.mode).toBe("open-ended");
    expect(s.sessionRecords[2]!.habitId).toBeNull();
    expect(s.sessionRecords[3]!.creditedSeconds).toBe(0);
    // Append-only: nothing prunes or rewrites earlier entries.
    expect(s.sessionRecords[0]!.sessionNumber).toBe(1);
  });

  it("carries the start and end stamps from the wall clock", () => {
    const s = fresh();
    startSession(s, 600, START);
    practice(s, 600);
    endSession(s, END);
    expect(s.sessionRecords[0]!.startedAt).toBe(START);
    expect(s.sessionRecords[0]!.endedAt).toBe(END);
  });

  it("a pre-§9 session resumed without a start stamp dates its record at close, not 1970", () => {
    const s = fresh();
    startSession(s, 600);
    practice(s, 60);
    endSession(s, END);
    expect(s.sessionRecords[0]!.startedAt).toBe(END);
  });

  it("stores credited seconds post-reconciliation and earned after a bucket drop", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, 600, START);
    practice(s, 600);
    // Half an hour away past the plan, reported as a miss: the bucket
    // drops, so earned excludes it and C stays at the plan.
    applyGap(s, 1800, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "missed");
    const earnedBefore = s.session!.earned;
    endSession(s, END);
    const record = s.sessionRecords[0]!;
    expect(record.creditedSeconds).toBe(600);
    expect(record.earned).toBeCloseTo(earnedBefore, 6);
    expect(record.honestyEvents).toEqual([{ awaySeconds: 1800, outcome: "missed" }]);
  });

  it("a planned honesty answer lifts credited seconds above presence", () => {
    const s = fresh();
    startSession(s, 1800, START);
    practice(s, 1800);
    applyGap(s, 600, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "planned");
    endSession(s, END);
    const record = s.sessionRecords[0]!;
    expect(record.creditedSeconds).toBe(1800);
    expect(recordTargetHit(record)).toBe(true);
    expect(recordMissed(record)).toBe(false);
  });

  it("the reflection joins the record as the summary records it", () => {
    const s = fresh();
    startSession(s, 600, START);
    practice(s, 600);
    endSession(s, END);
    expect(s.sessionRecords[0]!.reflection).toBeNull();
    recordSummaryReflection(s, { text: "steady", slider: 5 });
    expect(s.sessionRecords[0]!.reflection).toEqual({ text: "steady", slider: 5 });
  });

  it("goals advanced snapshot at close: deleting the goal never rewrites history", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    const goal = createGoal(s, { habitId: habit.id, minutes: 5, schedule: "once", now: START }).goal!;
    startSession(s, null, START);
    practice(s, 120);
    endSession(s, END);
    expect(s.sessionRecords[0]!.goalsAdvanced).toEqual([{ goalId: goal.id, seconds: 120 }]);
    deleteGoal(s, goal.id);
    expect(s.sessionRecords[0]!.goalsAdvanced).toEqual([{ goalId: goal.id, seconds: 120 }]);
  });

  it("credited provisional time from the honesty report joins the goals-advanced snapshot", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    const goal = createGoal(s, { habitId: habit.id, minutes: 40, schedule: "once", now: START }).goal!;
    startSession(s, 1800, START);
    practice(s, 1800);
    applyGap(s, 600, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "full");
    endSession(s, END);
    // 30 presence minutes + 10 credited from the report complete the 40.
    expect(s.sessionRecords[0]!.goalsAdvanced).toEqual([{ goalId: goal.id, seconds: 2400 }]);
  });

  it("manual practice logs never join a session's goals-advanced snapshot", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    createGoal(s, { habitId: habit.id, minutes: 5, schedule: "once", now: START });
    addPracticeLog(s, habit.id, 10, START);
    startSession(s, null, START);
    practice(s, 60);
    endSession(s, END);
    expect(s.sessionRecords[0]!.goalsAdvanced).toEqual([]);
  });

  it("the id resolves at render: renames and archiving never rewrite history", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, 600, START);
    practice(s, 600);
    endSession(s, END);
    expect(s.sessionRecords[0]!.habitId).toBe(habit.id);
    renameHabit(s, habit.id, "Fortepiano");
    archiveHabit(s, habit.id);
    expect(s.sessionRecords[0]!.habitId).toBe(habit.id);
    expect(habitRecordName(s, habit.id)).toBe("Fortepiano");
  });

  it("records survive a save round-trip intact", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, 600, START);
    practice(s, 600);
    endSession(s, END);
    recordSummaryReflection(s, { text: "kept" });
    const loaded = deserialize(serialize(s, END))!;
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.sessionRecords).toEqual(s.sessionRecords);
  });

  it("the newest-first view reverses the append-only run", () => {
    const s = fresh();
    for (let i = 0; i < 3; i++) {
      startSession(s, null, START + i * 1000);
      endSession(s, START + i * 1000 + 500);
    }
    expect(sessionRecordsNewestFirst(s).map((r) => r.sessionNumber)).toEqual([3, 2, 1]);
  });
});

describe("habit development aggregates (§9)", () => {
  it("sessions practiced counts live sessions only; last practiced reads live and manual together", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, START);
    practice(s, 60);
    endSession(s, START + 120_000);
    addPracticeLog(s, habit.id, 10, START + 500_000);
    const summary = habitPracticeSummary(s, habit.id);
    expect(summary.sessions).toBe(1);
    expect(summary.lastPracticed).toBe(START + 500_000);
  });

  it("an untouched habit reports zero sessions and no last-practiced date", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    expect(habitPracticeSummary(s, habit.id)).toEqual({ sessions: 0, lastPracticed: null });
  });

  it("tagged notes list newest first", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, START);
    writeNote(s, "first thought", START + 1000);
    writeNote(s, "second thought", START + 2000);
    expect(habitTaggedNotes(s, habit.id).map((n) => n.text)).toEqual(["second thought", "first thought"]);
  });
});
