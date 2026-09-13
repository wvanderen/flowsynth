import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { buyCoreActivation, endSession, startSession } from "./actions";
import { chargeSecondsRemaining, isActive } from "./economy";
import { fresh, grantBurst } from "./fixtures";
import { canWriteNotes, projectedNotesBurst, sessionNoteCount, writeNote, notesPower } from "./notes";
import type { GameState } from "./types";

function activated(): GameState {
  const s = fresh();
  s.timeActive = true;
  s.notesActive = true;
  return s;
}

describe("notes module", () => {
  it("activation is a store purchase; it stays locked until bought", () => {
    const s = fresh();
    expect(isActive(s, s.modules.find((m) => m.type === "notes")!)).toBe(false);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(s.storeOpened).toBe(true);
    expect(s.notesActive).toBe(false);
    s.nous = 20;
    expect(buyCoreActivation(s, "notes").ok).toBe(true);
    expect(s.notesActive).toBe(true);
    expect(s.nous).toBeCloseTo(0, 6);
  });

  it("captures notes during flow and paused, never in upgrade mode", () => {
    const s = activated();
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

  it("banks a burst at session end proportional to qualifying minutes", () => {
    const s = activated();
    startSession(s, 600);
    writeNote(s, "note");
    advance(s, 300);
    endSession(s);
    expect(chargeSecondsRemaining(s)).toBeCloseTo(5, 6);
  });

  it("awards nothing without a note, regardless of length", () => {
    const s = activated();
    startSession(s, 600);
    advance(s, 300);
    endSession(s);
    expect(chargeSecondsRemaining(s)).toBe(0);
  });

  it("does not care when the first note was written", () => {
    const early = activated();
    startSession(early, 600);
    advance(early, 10);
    writeNote(early, "early");
    advance(early, 590);
    endSession(early);

    const late = activated();
    startSession(late, 600);
    advance(late, 590);
    writeNote(late, "late");
    advance(late, 10);
    endSession(late);

    // Both include Time's 60s completion burst plus the same 10s notes burst.
    expect(chargeSecondsRemaining(late)).toBeCloseTo(chargeSecondsRemaining(early), 6);
    expect(chargeSecondsRemaining(late)).toBeCloseTo(70, 6);
  });

  it("covers open-ended sessions and prorates partial minutes", () => {
    const s = activated();
    startSession(s, null);
    writeNote(s, "note");
    advance(s, 90);
    endSession(s);
    expect(chargeSecondsRemaining(s)).toBeCloseTo(1.5, 6);
  });

  it("scales with module level and rarity", () => {
    const s = activated();
    const notes = s.modules.find((m) => m.type === "notes")!;
    notes.level = 2;
    notes.rarity = "uncommon";
    expect(notesPower(notes)).toBeCloseTo(1.25 ** 2, 9);
    startSession(s, 600);
    writeNote(s, "note");
    advance(s, 300);
    endSession(s);
    expect(chargeSecondsRemaining(s)).toBeCloseTo(5 * 1.5625, 6);
  });

  it("merges into the generator queue without acting in the earning session", () => {
    const s = activated();
    grantBurst(s, 1, 30);
    startSession(s, 600);
    writeNote(s, "note");
    advance(s, 300);
    const before = chargeSecondsRemaining(s);
    endSession(s);
    expect(before).toBe(0); // the pre-existing burst fully dispensed
    expect(chargeSecondsRemaining(s)).toBeCloseTo(5, 6); // 300s practice → 5s banked
  });

  it("projects the current session's bank", () => {
    const s = activated();
    startSession(s, 600);
    expect(projectedNotesBurst(s)).toBe(0);
    writeNote(s, "note");
    advance(s, 120);
    expect(projectedNotesBurst(s)).toBeCloseTo(2, 6);
  });

  it("keeps notes across save round-trips", async () => {
    const { serialize, deserialize } = await import("./save");
    const s = activated();
    startSession(s, 600);
    writeNote(s, "persisted thought");
    advance(s, 60);
    endSession(s);
    const loaded = deserialize(serialize(s))!;
    expect(loaded.state!.notes).toHaveLength(1);
    expect(loaded.state!.notes[0]!.text).toBe("persisted thought");
  });
});
