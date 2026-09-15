import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh } from "./fixtures";
import { canWriteNotes, sessionNoteCount, writeNote } from "./notes";
import { deserialize, serialize } from "./save";

describe("notes app", () => {
  it("captures notes during flow and paused, never in upgrade mode", () => {
    const s = fresh();
    expect(writeNote(s, "hello").ok).toBe(false);
    startSession(s, 600);
    expect(writeNote(s, "first thought").ok).toBe(true);
    expect(sessionNoteCount(s)).toBe(1);
    expect(writeNote(s, "   ").ok).toBe(false);
    s.mode = "paused";
    expect(writeNote(s, "paused thought").ok).toBe(true);
    endSession(s);
    expect(canWriteNotes(s)).toBe(false);
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
});
