import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh, give, stubRng } from "./fixtures";
import { SAVE_VERSION } from "./constants";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import { ARETE_HORIZON } from "./accumulator";
import { writeNote } from "./notes";
import { hex } from "./hex";
import type { GameState } from "./types";

// The v7 boundary (issue #194, ADR-0017's pattern): the prestige cut is a
// clean break. Every save older than this build — v6 included — rejects
// with the start-fresh message; there is no migration chain, no archive,
// and no import path for rejected versions. Old saves are disposable per
// the map's standing note.

// Fabricate a v6 save from a live v7 state: force the version and salt it
// with the field only a v6 build would write (the legacy acknowledgment
// flag the removed prestige button once set).
function asV6(state: GameState, savedAt = 1_000): string {
  const file = JSON.parse(serialize(state, savedAt));
  file.version = 6;
  file.state.horizonAcknowledged = true;
  return JSON.stringify(file);
}

describe("persistence", () => {
  it("round-trips the full game state", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "forge", hex(0, 1));
    s.nous = 123.456;
    s.forge.progress = 42.5;
    s.prestiges = 2;
    s.eraEarned = 555;
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
    expect(parsed.version).toBe(7);
  });

  it("saves lenient-default the gate ledger", () => {
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

  it("saves lenient-default the Catalog unlocks (issue #197)", () => {
    // A save written before the Arete Catalog existed owes no unlocks it
    // can't know about: absent fields read as never unlocked, never bought.
    const file = JSON.parse(serialize(fresh()));
    delete file.state.unlockedRows;
    delete file.state.catalogEntryOwned;
    delete file.state.rollPoolJoined;
    const absent = deserialize(JSON.stringify(file));
    expect(absent.error).toBeUndefined();
    expect(absent.state!.unlockedRows).toEqual([]);
    expect(absent.state!.catalogEntryOwned).toBe(false);
    expect(absent.state!.rollPoolJoined).toBe(false);
    file.state.unlockedRows = null;
    file.state.catalogEntryOwned = null;
    file.state.rollPoolJoined = null;
    const corrupt = deserialize(JSON.stringify(file));
    expect(corrupt.error).toBeUndefined();
    expect(corrupt.state!.unlockedRows).toEqual([]);
    expect(corrupt.state!.catalogEntryOwned).toBe(false);
    expect(corrupt.state!.rollPoolJoined).toBe(false);
  });

  it("Catalog unlocks round-trip through the save (issue #197)", () => {
    const s = fresh();
    s.arete = 3;
    s.unlockedRows = [3, -2];
    s.catalogEntryOwned = true;
    s.rollPoolJoined = true;
    const loaded = deserialize(serialize(s, 5_000));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.unlockedRows).toEqual([3, -2]);
    expect(loaded.state!.catalogEntryOwned).toBe(true);
    expect(loaded.state!.rollPoolJoined).toBe(true);
    expect(loaded.state!.arete).toBe(3);
  });

  it("saves lenient-default the Mutator layer (issue #198)", () => {
    // A save written before the mutator layer existed owes no slots, no
    // mutators, no branch meter, no pending mutator rolls — absent fields
    // read as the entry never bought. Corrupt fields fall back the same.
    const file = JSON.parse(serialize(fresh()));
    delete file.state.mutatorSlots;
    delete file.state.mutators;
    delete file.state.mutatorForge;
    delete file.state.bankedMutatorRolls;
    const absent = deserialize(JSON.stringify(file));
    expect(absent.error).toBeUndefined();
    expect(absent.state!.mutatorSlots).toEqual([]);
    expect(absent.state!.mutators).toEqual([]);
    expect(absent.state!.mutatorForge).toEqual({ progress: 0, earned: 0 });
    expect(absent.state!.bankedMutatorRolls).toEqual([]);
    file.state.mutatorSlots = null;
    file.state.mutators = 42;
    file.state.mutatorForge = "gone";
    file.state.bankedMutatorRolls = {};
    const corrupt = deserialize(JSON.stringify(file));
    expect(corrupt.error).toBeUndefined();
    expect(corrupt.state!.mutatorSlots).toEqual([]);
    expect(corrupt.state!.mutators).toEqual([]);
    expect(corrupt.state!.mutatorForge).toEqual({ progress: 0, earned: 0 });
    expect(corrupt.state!.bankedMutatorRolls).toEqual([]);
  });

  it("the Mutator layer round-trips through the save (issue #198)", () => {
    const s = fresh();
    s.mutatorSlots = [hex(0, 1), hex(1, 0)];
    s.mutators = [
      { id: "mu1", family: "power", rarity: "uncommon", pos: hex(0, 1) },
      { id: "mu2", family: "charge", rarity: "rare", pos: null },
    ];
    s.mutatorForge = { progress: 33, earned: 2 };
    s.bankedMutatorRolls = [
      {
        id: "mo1",
        candidates: [
          { id: "mc1", family: "resonance", rarity: "common" },
          { id: "mc2", family: "power", rarity: "rare" },
        ],
      },
    ];
    const loaded = deserialize(serialize(s, 6_000));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.mutatorSlots).toEqual([hex(0, 1), hex(1, 0)]);
    expect(loaded.state!.mutators).toEqual(s.mutators);
    expect(loaded.state!.mutatorForge).toEqual({ progress: 33, earned: 2 });
    expect(loaded.state!.bankedMutatorRolls).toEqual(s.bankedMutatorRolls);
  });

  it("a pre-mutator entry owner loads owing its grant, exactly once (issue #198)", () => {
    // The sheet purchase (#197) predates the entry's engine effects: a
    // save holding the owned flag without the Mutator Forge module loads
    // with the grant backfilled — the purchase itself refuses as owned.
    const file = JSON.parse(serialize(fresh()));
    file.state.catalogEntryOwned = true;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    const forge = loaded.state!.modules.filter((m) => m.type === "mutatorForge");
    expect(forge).toHaveLength(1);
    expect(forge[0]!.rarity).toBe("common");
    expect(forge[0]!.pos).toBeNull();
    // Idempotent: reloading the backfilled save grants nothing further.
    const reloaded = deserialize(serialize(loaded.state!, 6_000));
    expect(reloaded.state!.modules.filter((m) => m.type === "mutatorForge")).toHaveLength(1);
    // An entry owner who already rolled a second Mutator Forge from the
    // joined pool (a lost module forge to combination is impossible, so
    // any mutatorForge at all means the grant landed) is left alone.
    file.state.modules.push({ id: "m9", type: "mutatorForge", rarity: "uncommon", level: 0, invested: 0, pos: null });
    const owning = deserialize(JSON.stringify(file));
    expect(owning.state!.modules.filter((m) => m.type === "mutatorForge")).toHaveLength(1);
    expect(owning.state!.modules.at(-1)!.rarity).toBe("uncommon");
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

  it("the prestige state round-trips: the count, the balance, and both earned measures", () => {
    const s = fresh();
    s.prestiges = 3;
    s.arete = 6;
    s.eraEarned = 1_234;
    s.totalEarned = ARETE_HORIZON * 3 + 1_234;
    const loaded = deserialize(serialize(s, 2_000));
    expect(loaded.error).toBeUndefined();
    const m = loaded.state!;
    expect(m.prestiges).toBe(3);
    expect(m.arete).toBe(6);
    expect(m.eraEarned).toBe(1_234);
    expect(m.totalEarned).toBe(ARETE_HORIZON * 3 + 1_234);
  });
});

describe("the v7 version gate (ADR-0017's pattern, issue #194)", () => {
  it("rejects v6 and every older version; there is no migrate chain", () => {
    for (const version of [1, 4, 5, 6]) {
      const text = serialize(fresh()).replace(`"version": ${SAVE_VERSION}`, `"version": ${version}`);
      const result = deserialize(text);
      expect(result.error, `v${version}`).toMatch(/older version/i);
      expect(result.state, `v${version}`).toBeUndefined();
    }
  });

  it("a v6 save starts fresh with the standard version error, never a crash", () => {
    const s = fresh();
    s.arete = 1;
    s.totalEarned = ARETE_HORIZON;
    const result = deserialize(asV6(s));
    expect(result.error).toMatch(/older version/i);
    expect(result.state).toBeUndefined();
    // The fresh state the boot builds instead carries none of it.
    expect(fresh().arete).toBe(0);
  });

  it("rejects corrupt, foreign, and future-version saves", () => {
    expect(deserialize("{nope").error).toBeDefined();
    expect(deserialize('{"app":"other","version":7}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":99,"state":{}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":7,"state":{"mode":"weird"}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":7}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":8,"state":{}}').error).toMatch(/newer than this build/i);
  });

  it("exported v7 saves load unchanged", () => {
    const s = fresh();
    writeNote(s, "portable", 1_000);
    const loaded = deserialize(serialize(s, 42));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.notes[0]!.text).toBe("portable");
  });
});
