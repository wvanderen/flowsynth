import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { BALANCE } from "./constants";
import { fresh, give } from "./fixtures";
import { createHabit, selectHabit } from "./habits";
import { hex } from "./hex";
import { NOTE_BETWEEN_SESSIONS, writeNote } from "./notes";
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
    expect(s.notes.filter((n) => n.sessionId === s.sessionIndex).length).toBe(1);
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

// The written-note fact's credit (ADR-0047, generalized by issue #371):
// every note written — in flow or between sessions, tagged or not —
// credits every owned generator the moment it lands, at its own profile:
// character earning per stored character under the per-note cap, plus the
// creation bonus once for a note meeting the creation minimum. Board and
// tray alike; notes are append-only, so a credit is the write's credit.
describe("the written-note fact's credit", () => {
  it("a note written between sessions credits every owned generator, board and tray alike", () => {
    const s = fresh();
    const board = give(s, "noteKeyed", hex(2, 0));
    const tray = give(s, "noteKeyed", null);
    writeNote(s, "hello"); // 5 characters, under the creation minimum
    // The Scribe's character axis: 5 × 1 charge, no creation bonus.
    expect(board.reserve).toBeCloseTo(5, 6);
    expect(tray.reserve).toBeCloseTo(5, 6);
  });

  it("character earning caps per note; the creation bonus rides on top", () => {
    const s = fresh();
    const gen = give(s, "noteKeyed", null);
    writeNote(s, "x".repeat(400));
    // The character axis flattens at the cap (400 counted as 300); the
    // creation bonus adds its flat 30 on top.
    const cappedNote = BALANCE.noteCharCreditCap + 30;
    expect(gen.reserve).toBeCloseTo(cappedNote, 6);
    // A second qualifying note earns its own full credit — per note, never
    // a shared daily pool.
    writeNote(s, "y".repeat(30));
    const shortQualifyingNote = 30 + 30; // 30 characters × 1 + the 30 bonus
    expect(gen.reserve).toBeCloseTo(cappedNote + shortQualifyingNote, 6);
  });

  it("the creation bonus fires once per newly created note, never on re-saves", () => {
    const s = fresh();
    const gen = give(s, "noteKeyed", null);
    writeNote(s, "a qualifying thought"); // 20 characters — exactly the minimum
    expect(gen.reserve).toBeCloseTo(20 + 30, 6);
    // Notes are append-only: writing the same text again is a new note
    // with its own credit — there is no edit or re-save path that could
    // re-award the first note's bonus on top of its character earning.
    const countBefore = s.notes.length;
    writeNote(s, "a qualifying thought");
    expect(s.notes).toHaveLength(countBefore + 1);
    expect(s.notes[countBefore]!.text).toBe("a qualifying thought");
    expect(gen.reserve).toBeCloseTo(2 * (20 + 30), 6);
  });

  it("short jottings earn characters but never the creation bonus", () => {
    const s = fresh();
    const gen = give(s, "noteKeyed", null);
    writeNote(s, "a");
    writeNote(s, "bb");
    expect(gen.reserve).toBeCloseTo(3, 6);
  });

  it("every generator earns at its own profile — the Scribe leads, the others trail", () => {
    const s = fresh();
    const flywheel = give(s, "focusKeyed", null);
    const scribe = give(s, "noteKeyed", null);
    const milestone = give(s, "goalKeyed", null);
    writeNote(s, "z".repeat(100)); // 100 characters, qualifying
    // Scribe: 100 × 1 + 30. Flywheel and Milestone: 100 × 0.2 + 5.
    expect(scribe.reserve).toBeCloseTo(130, 6);
    expect(flywheel.reserve).toBeCloseTo(25, 6);
    expect(milestone.reserve).toBeCloseTo(25, 6);
  });

  it("notes credit in flow and while paused too — the fact is the write, not the mode", () => {
    const s = fresh();
    const gen = give(s, "noteKeyed", null);
    startSession(s, 600);
    writeNote(s, "flow"); // 4 characters
    s.mode = "paused";
    writeNote(s, "paused"); // 6 characters
    endSession(s);
    expect(gen.reserve).toBeCloseTo(10, 6);
  });

  it("the reserve survives a save round-trip beside its note", () => {
    const s = fresh();
    give(s, "noteKeyed", null);
    writeNote(s, "persisted thought"); // 17 characters, under the minimum
    const result = deserialize(serialize(s));
    expect(result.error).toBeUndefined();
    expect(result.state!.modules.find((m) => m.type === "noteKeyed")!.reserve).toBeCloseTo(17, 6);
  });
});
