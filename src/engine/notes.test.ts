import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh } from "./fixtures";
import { createHabit, selectHabit } from "./habits";
import { NOTE_BETWEEN_SESSIONS, sessionNoteCount, writeNote } from "./notes";
import { deserialize, serialize } from "./save";

describe("notes app", () => {
  it("captures notes in flow, paused, and between sessions (ADR-0018)", () => {
    const s = fresh();
    expect(writeNote(s, "hello").ok).toBe(true);
    // A note written outside any session carries the between-sessions mark
    // instead of a session clock.
    expect(s.notes[0]!.atElapsed).toBe(NOTE_BETWEEN_SESSIONS);
    expect(writeNote(s, "   ").ok).toBe(false);
    startSession(s, 600);
    expect(writeNote(s, "first thought").ok).toBe(true);
    expect(sessionNoteCount(s)).toBe(1);
    expect(s.notes[1]!.atElapsed).toBe(0);
    s.mode = "paused";
    expect(writeNote(s, "paused thought").ok).toBe(true);
    endSession(s);
    expect(writeNote(s, "after the session").ok).toBe(true);
    expect(s.notes).toHaveLength(4);
  });

  it("notes are notes: capture produces no nous and no charge", () => {
    const s = fresh();
    startSession(s, 600);
    writeNote(s, "note");
    const before = s.nous;
    advance(s, 300);
    const gained = s.nous - before;
    endSession(s);
    // Only the board's carrier term produced.
    expect(gained).toBeCloseTo(0.1 * 300, 6);
    expect(s.forge.progress).toBe(0);
  });

  it("does not care when the note was written — it changes nothing mechanically", () => {
    const early = fresh();
    startSession(early, 600);
    advance(early, 10);
    writeNote(early, "early");
    advance(early, 590);
    endSession(early);

    const late = fresh();
    startSession(late, 600);
    advance(late, 590);
    writeNote(late, "late");
    advance(late, 10);
    endSession(late);

    expect(late.totalEarned).toBeCloseTo(early.totalEarned, 6);
  });

  it("keeps notes across save round-trips", () => {
    const s = fresh();
    startSession(s, 600);
    writeNote(s, "persisted thought");
    advance(s, 60);
    endSession(s);
    const loaded = deserialize(serialize(s))!;
    expect(loaded.state!.notes).toHaveLength(1);
    expect(loaded.state!.notes[0]!.text).toBe("persisted thought");
  });

  it("in-session capture tags the active habit; the tag never retags (§9)", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null);
    writeNote(s, "tagged thought");
    expect(s.notes[0]!.habitId).toBe(habit.id);
    endSession(s);
    // Renaming or archiving the habit never rewrites the captured tag —
    // the id is stored raw and resolves at render.
    habit.name = "Fortepiano";
    expect(s.notes[0]!.habitId).toBe(habit.id);
  });

  it("unstructured notes go untagged; paused-session notes tag the session's habit", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null);
    s.mode = "paused";
    writeNote(s, "paused but tagged");
    selectHabit(s, null);
    // Selection is locked during flow/pause; unstructured is a start-time
    // choice, so simulate one by a habitless session.
    s.activeHabitId = null;
    writeNote(s, "unstructured");
    expect(s.notes[0]!.habitId).toBe(habit.id);
    expect(s.notes[1]!.habitId).toBeNull();
  });

  it("upgrade-mode notes stay untagged and carry the wall-clock stamp (§9)", () => {
    const s = fresh();
    writeNote(s, "between sessions", 5_000);
    expect(s.notes[0]!.habitId).toBeNull();
    expect(s.notes[0]!.at).toBe(5_000);
    expect(s.notes[0]!.atElapsed).toBe(NOTE_BETWEEN_SESSIONS);
  });
});
