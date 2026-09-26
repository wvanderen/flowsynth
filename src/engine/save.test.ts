import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { createHabit } from "./habits";
import { fresh, give, stubRng } from "./fixtures";
import { BALANCE, SAVE_VERSION } from "./constants";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import { writeNote } from "./notes";
import { hex } from "./hex";
import type { GameState } from "./types";

// ADR-0023: SAVE_VERSION 6 — the carrierless board. V5 saves convert once
// inside deserialize as a hybrid: the life record and lifetime meta carry
// over, the board side resets to the new opening. Anything older, and any
// future version, hard-rejects with the start-fresh message.

// Fabricate a v5 save from a live v6 state: force the version and salt it
// with the board-side shapes only a v5 build would write (a Carrier, the
// retired additive shelf key, the welcome flag).
function asV5(state: GameState, savedAt = 1_000): string {
  const file = JSON.parse(serialize(state, savedAt));
  file.version = 5;
  file.state.welcomeAcked = true;
  file.state.modules.unshift({ id: "m0", type: "carrier", rarity: "common", level: 4, invested: 93, pos: hex(0, 0) });
  file.state.purchased.additive = true;
  return JSON.stringify(file);
}

describe("persistence", () => {
  it("round-trips the full game state", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "forge", hex(0, 1));
    s.nous = 123.456;
    s.forge.progress = 42.5;
    startSession(s, 600);
    advance(s, 123, stubRng(new Array(6).fill(0.4)));
    const text = serialize(s, 1_000);
    const loaded = deserialize(text);
    expect(loaded.error).toBeUndefined();
    expect(serialize(loaded.state!, 1_000)).toBe(text);
  });

  it("saves carry the current version", () => {
    const parsed = JSON.parse(serialize(fresh()));
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.version).toBe(6);
  });

  it("v6 saves lenient-default the gate ledger", () => {
    // Absent, a save written before the ledger existed owes no gates it
    // can't know about — the fresh state's granted opening rows must not
    // ride in; corrupt, it falls back to the empty ledger as well.
    const file = JSON.parse(serialize(fresh()));
    delete file.state.gatedRows;
    const absent = deserialize(JSON.stringify(file));
    expect(absent.error).toBeUndefined();
    expect(absent.state!.gatedRows).toEqual([]);
    file.state.gatedRows = null;
    const corrupt = deserialize(JSON.stringify(file));
    expect(corrupt.error).toBeUndefined();
    expect(corrupt.state!.gatedRows).toEqual([]);
  });

  it("resuming from a mid-flow save does not duplicate rewards", () => {
    const build = () => {
      const s = fresh();
      give(s, "forge", hex(1, 0));
      give(s, "focusKeyed", hex(2, 0));
      s.chargeWindow = 600;
      startSession(s, 600);
      return s;
    };

    const straight = build();
    advance(straight, 400);

    const split = build();
    advance(split, 150);
    const reloaded = deserialize(serialize(split))!;
    const restored = reloaded.state!;
    advance(restored, 250);

    expect(restored.nous).toBeCloseTo(straight.nous, 6);
    expect(restored.forge.progress).toBeCloseTo(straight.forge.progress, 6);
  });

  it("an unseen summary, its events, and its reflection survive a reload together (§8)", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    applyGap(s, 300, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "missed");
    endSession(s, 5_000);
    s.summary!.reflection = { text: "drifted", slider: 3 };
    expect(s.summary!.seen).toBe(false);
    const loaded = deserialize(serialize(s, 1_000));
    expect(loaded.error).toBeUndefined();
    const summary = loaded.state!.summary!;
    expect(summary.seen).toBe(false);
    expect(summary.honestyEvents).toEqual([{ awaySeconds: 300, outcome: "missed" }]);
    expect(summary.reflection).toEqual({ text: "drifted", slider: 3 });
  });

  it("the retired reconcile dialog's frozen gap is dropped at load (ADR-0019)", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 30);
    const file = JSON.parse(serialize(s, 1_000));
    file.state.pendingGap = { seconds: 600, detectedAt: 1_000 };
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect((loaded.state as unknown as Record<string, unknown>).pendingGap).toBeUndefined();
  });
});

describe("the v5 → v6 hybrid migration (ADR-0023)", () => {
  it("carries the life record and lifetime meta over untouched", () => {
    const s = fresh();
    s.habits.push({ id: "h1", name: "Piano", seconds: 3600, archived: false });
    s.activeHabitId = "h1";
    s.practiceLog.push({ id: "p1", habitId: "h1", seconds: 600, source: "live", at: 1_000 });
    s.notes.push({ id: "n1", sessionId: 1, atElapsed: 30, text: "kept", habitId: "h1", at: 1_000 });
    s.goals.push({
      id: "g1",
      condition: { kind: "habit-minutes", habitId: "h1", minutes: 10 },
      schedule: { kind: "daily" },
      occurrenceKey: "2026-09-25",
      progressSeconds: 120,
      completed: false,
      completedCount: 0,
      createdAt: 1_000,
    });
    s.sessionRecords.push({
      sessionNumber: 1,
      startedAt: 1_000,
      endedAt: 2_000,
      habitId: "h1",
      mode: "planned",
      plannedTarget: 600,
      creditedSeconds: 600,
      earned: 60,
      honestyEvents: [],
      reflection: null,
      goalsAdvanced: [],
      achievements: [],
    });
    s.achievements = { "first-light": 1_234 };
    s.sessionsCompleted = 3;
    s.unstructuredSessions = 1;
    s.plannedSessionsCompleted = 2;
    s.sessionIndex = 3;
    s.combinations = 5;
    s.muted = true;
    s.notificationAsked = true;
    s.activatedApps = [];
    s.goalCapacityBought = 1;
    s.totalEarned = 12_345;
    s.arete = 2;
    s.horizonAcknowledged = true;

    const loaded = deserialize(asV5(s));
    expect(loaded.error).toBeUndefined();
    const m = loaded.state!;
    expect(m.habits).toEqual(s.habits);
    expect(m.activeHabitId).toBe("h1");
    expect(m.practiceLog).toEqual(s.practiceLog);
    expect(m.notes).toEqual(s.notes);
    expect(m.goals).toEqual(s.goals);
    expect(m.sessionRecords).toEqual(s.sessionRecords);
    expect(m.achievements).toEqual({ "first-light": 1_234 });
    expect(m.sessionsCompleted).toBe(3);
    expect(m.unstructuredSessions).toBe(1);
    expect(m.plannedSessionsCompleted).toBe(2);
    expect(m.sessionIndex).toBe(3);
    expect(m.combinations).toBe(5);
    expect(m.muted).toBe(true);
    expect(m.notificationAsked).toBe(true);
    expect(m.activatedApps).toEqual([]);
    expect(m.goalCapacityBought).toBe(1);
    expect(m.totalEarned).toBe(12_345);
    expect(m.arete).toBe(2);
    expect(m.horizonAcknowledged).toBe(true);
  });

  it("winds the id counter past the preserved life record so minting can't collide", () => {
    const s = fresh();
    s.habits.push({ id: "h3", name: "Piano", seconds: 3600, archived: false });
    s.practiceLog.push({ id: "p5", habitId: "h3", seconds: 600, source: "live", at: 1_000 });
    s.notes.push({ id: "n7", sessionId: 1, atElapsed: 30, text: "kept", habitId: "h3", at: 1_000 });
    s.goals.push({
      id: "g2",
      condition: { kind: "habit-minutes", habitId: "h3", minutes: 10 },
      schedule: { kind: "daily" },
      occurrenceKey: "2026-09-25",
      progressSeconds: 0,
      completed: false,
      completedCount: 0,
      createdAt: 1_000,
    });
    const m = deserialize(asV5(s)).state!;
    expect(m.nextId).toBe(8);
    const created = createHabit(m, "Cello");
    expect(created.ok).toBe(true);
    expect(created.habit!.id).toBe("h8");
    expect(m.habits.map((h) => h.id)).toEqual(["h3", "h8"]);
  });

  it("resets the board side to the new opening — Carrier row included", () => {
    const s = fresh();
    give(s, "conditional", hex(2, 0), 5);
    s.cells.push(hex(4, 0), hex(5, 0), hex(-3, 2));
    s.cellsBought = 7;
    s.gatedRows = [2, -1];
    s.forge = { progress: 500, earned: 9 };
    s.bankedRolls.push({ id: "offer", candidates: [
      { id: "c1", type: "conditional", rarity: "rare" },
      { id: "c2", type: "forge", rarity: "common" },
      { id: "c3", type: "infusor", rarity: "common" },
    ] });
    s.chargeWindow = 400;
    s.nous = 5_000;

    const loaded = deserialize(asV5(s));
    expect(loaded.error).toBeUndefined();
    const m = loaded.state!;
    // The board resets: one pre-placed additive at C4, the opening
    // footprint, nothing bought, nothing gated, nothing banked.
    expect(m.modules).toHaveLength(1);
    expect(m.modules[0]!.type).toBe("additive");
    expect(m.modules[0]!.pos).toEqual(hex(0, 0));
    expect(m.cells.map((c) => `${c.q},${c.r}`).sort()).toEqual(["0,0", "0,1", "1,0"]);
    expect(m.cellsBought).toBe(0);
    // The opening's rows are gate-paid by grant; nothing the v5 board paid
    // for survives into the new economy.
    expect(m.gatedRows).toEqual([0, 1]);
    expect(m.forge).toEqual({ progress: 0, earned: 0 });
    expect(m.bankedRolls).toEqual([]);
    expect(m.chargeWindow).toBe(0);
    expect(m.purchased).toEqual({ generator: false, infusor: false, forge: false });
    expect(m.mode).toBe("upgrade");
    expect(m.nous).toBe(BALANCE.openingGrant);
    // The retired welcome flag is deleted by the loader, not defaulted.
    expect("welcomeAcked" in m).toBe(false);
    expect((m as unknown as Record<string, unknown>).welcomeAcked).toBeUndefined();
  });

  it("discards a mid-flow v5 session uncredited, landing in upgrade mode", () => {
    for (const mode of ["flow", "paused"] as const) {
      const s = fresh();
      startSession(s, 600);
      advance(s, 300);
      s.mode = mode;
      const loaded = deserialize(asV5(s));
      expect(loaded.error).toBeUndefined();
      expect(loaded.state!.mode).toBe("upgrade");
      expect(loaded.state!.session).toBeNull();
      // The discarded session credits nothing: no practice log entry, no
      // charge window, and the balance is the grant alone.
      expect(loaded.state!.practiceLog).toHaveLength(0);
      expect(loaded.state!.chargeWindow).toBe(0);
      expect(loaded.state!.nous).toBe(BALANCE.openingGrant);
    }
  });

  it("preserved counters keep the session-one guard from re-firing", () => {
    const s = fresh();
    s.sessionsCompleted = 2;
    s.achievements = {};
    const loaded = deserialize(asV5(s));
    const m = loaded.state!;
    expect(m.achievements).toEqual({});
    // Feats can unlock from the first post-migration session: the record's
    // summary row fires at its end boundary.
    startSession(m, 600);
    advance(m, 60);
    endSession(m, 5_000);
    expect(m.achievements["first-light"]).toBeDefined();
  });

  it("the migrated state saves forward as v6 and never converts twice", () => {
    const s = fresh();
    s.totalEarned = 999;
    const migrated = deserialize(asV5(s)).state!;
    const text = serialize(migrated, 2_000);
    expect(JSON.parse(text).version).toBe(SAVE_VERSION);
    const again = deserialize(text);
    expect(again.error).toBeUndefined();
    expect(again.state!.totalEarned).toBe(999);
    expect(again.state!.modules).toHaveLength(1);
  });

  it("exported v5 saves follow the same rule: they convert exactly like stored ones", () => {
    const s = fresh();
    writeNote(s, "portable", 1_000);
    const loaded = deserialize(asV5(s, 42));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.notes[0]!.text).toBe("portable");
  });
});

describe("the version gate (ADR-0017, kept by ADR-0023)", () => {
  it("rejects v4 and every older version; there is no migrate chain", () => {
    for (const version of [1, 2, 3, 4]) {
      const text = serialize(fresh()).replace(`"version": ${SAVE_VERSION}`, `"version": ${version}`);
      const result = deserialize(text);
      expect(result.error, `v${version}`).toMatch(/older version/i);
      expect(result.state, `v${version}`).toBeUndefined();
    }
  });

  it("rejects corrupt, foreign, and future-version saves", () => {
    expect(deserialize("{nope").error).toBeDefined();
    expect(deserialize('{"app":"other","version":6}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":99,"state":{}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":6,"state":{"mode":"weird"}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":6}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":7,"state":{}}').error).toMatch(/newer than this build/i);
  });
});
