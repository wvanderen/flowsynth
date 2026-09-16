import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh } from "./fixtures";
import {
  activeHabit,
  addPracticeLog,
  archiveHabit,
  createHabit,
  renameHabit,
  selectHabit,
} from "./habits";
import { serialize, deserialize } from "./save";

describe("habit management", () => {
  it("creates, renames, and archives habits between sessions only", () => {
    const s = fresh();
    const made = createHabit(s, "  Piano  ");
    expect(made.ok).toBe(true);
    expect(made.habit!.name).toBe("Piano");
    expect(createHabit(s, "   ").ok).toBe(false);

    expect(renameHabit(s, made.habit!.id, "Cooking").ok).toBe(true);
    expect(archiveHabit(s, made.habit!.id).ok).toBe(true);
    expect(activeHabit(s)).toBeUndefined();

    startSession(s, 600);
    expect(createHabit(s, "X").ok).toBe(false);
    expect(renameHabit(s, "h1", "Y").ok).toBe(false);
    expect(archiveHabit(s, "h1").ok).toBe(false);
    expect(selectHabit(s, null).ok).toBe(false);
  });

  it("archives the active habit cleanly", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano")!.habit!;
    expect(selectHabit(s, habit.id).ok).toBe(true);
    expect(s.activeHabitId).toBe(habit.id);
    archiveHabit(s, habit.id);
    expect(s.activeHabitId).toBeNull();
  });

  it("selection accepts null (unstructured practice) and rejects unknown habits", () => {
    const s = fresh();
    expect(selectHabit(s, null).ok).toBe(true);
    expect(selectHabit(s, "nope").ok).toBe(false);
  });
});

describe("habit development", () => {
  it("accrues live flow time for the selected habit only, one-for-one", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    selectHabit(s, piano.id);
    startSession(s, 600);
    advance(s, 300);
    expect(piano.seconds).toBeCloseTo(300, 6);
    endSession(s, 1_000);

    const cooking = createHabit(s, "Cooking")!.habit!;
    selectHabit(s, cooking.id);
    startSession(s, 600);
    advance(s, 120);
    expect(piano.seconds).toBeCloseTo(300, 6);
    expect(cooking.seconds).toBeCloseTo(120, 6);
  });

  it("does not accrue while paused or in upgrade mode", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    selectHabit(s, piano.id);
    startSession(s, 600);
    advance(s, 60);
    s.mode = "paused";
    advance(s, 600);
    s.mode = "flow";
    advance(s, 60);
    endSession(s);
    expect(piano.seconds).toBeCloseTo(120, 6);
  });

  it("manual logs advance development without nous or charge", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    const startingNous = s.nous; // the opening grant (issue #43) sits in the balance
    addPracticeLog(s, piano.id, 15, 2_000);
    expect(piano.seconds).toBeCloseTo(900, 6);
    expect(s.nous).toBe(startingNous);
    expect(s.practiceLog).toHaveLength(1);
    expect(s.practiceLog[0]!.source).toBe("manual");
    expect(s.practiceLog[0]!.at).toBe(2_000);
    expect(addPracticeLog(s, piano.id, -5).ok).toBe(false);
  });

  it("the habit app is a fixed instrument: development never scales with any module", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    addPracticeLog(s, piano.id, 10);
    expect(piano.seconds).toBeCloseTo(600, 6);
    selectHabit(s, piano.id);
    startSession(s, 600);
    advance(s, 100);
    expect(piano.seconds).toBeCloseTo(700, 6);
  });

  it("logs one live practice entry per session with a timestamp", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    selectHabit(s, piano.id);
    startSession(s, 600);
    advance(s, 250);
    endSession(s, 5_000);
    expect(s.practiceLog).toHaveLength(1);
    expect(s.practiceLog[0]!.source).toBe("live");
    expect(s.practiceLog[0]!.seconds).toBeCloseTo(250, 6);
    expect(s.practiceLog[0]!.at).toBe(5_000);

    startSession(s, 600);
    advance(s, 10);
    endSession(s, 6_000);
    expect(s.practiceLog).toHaveLength(2);
  });

  it("persists habits, selection, and the practice log across saves", () => {
    const s = fresh();
    const piano = createHabit(s, "Piano")!.habit!;
    selectHabit(s, piano.id);
    startSession(s, 600);
    advance(s, 300);
    endSession(s, 9_000);
    addPracticeLog(s, piano.id, 5, 9_500);
    const loaded = deserialize(serialize(s))!;
    expect(loaded.state!.habits[0]!.name).toBe("Piano");
    expect(loaded.state!.activeHabitId).toBe(piano.id);
    expect(loaded.state!.practiceLog).toHaveLength(2);
    expect(loaded.state!.habits[0]!.seconds).toBeCloseTo(piano.seconds, 6);
  });
});
