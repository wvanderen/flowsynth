import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { chooseRoll, endSession, startSession } from "./actions";
import { fresh, give, stubRng } from "./fixtures";
import { SAVE_VERSION } from "./constants";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import { ARETE_HORIZON } from "./accumulator";
import { writeNote } from "./notes";
import { hex } from "./hex";
import type { GameState } from "./types";

// The v9 boundary (issue #367, ADR-0058): the rarity/tier cut. A v8 save
// migrates in place — each module's saved rarity maps by index onto the
// merge tier, the stored rarity field dies, and banked module-roll
// candidates convert the same way — and the life record is never wiped.
// Every version older than v8 still rejects with the start-fresh message;
// there is no chain past one step.

// Fabricate a v7 save from a live state: force the version. Rejected —
// the v8 step was its one migration, and the chain does not grow.
function asV7(state: GameState, savedAt = 1_000): string {
  const file = JSON.parse(serialize(state, savedAt));
  file.version = 7;
  return JSON.stringify(file);
}

// Fabricate a v8 save from a live v9 state: force the version, restore
// the pre-cut shape (the per-copy rarity field, no tier), and strip the
// fields the v9 build writes.
function asV8(state: GameState, savedAt = 1_000): string {
  const file = JSON.parse(serialize(state, savedAt));
  file.version = 8;
  const RARITY = ["common", "uncommon", "rare"];
  for (const module of file.state.modules) {
    module.rarity = RARITY[module.tier] ?? "common";
    delete module.tier;
  }
  for (const offer of file.state.bankedRolls) {
    for (const candidate of offer.candidates) {
      candidate.rarity = RARITY[candidate.tier] ?? "common";
      delete candidate.tier;
    }
  }
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
    expect(parsed.version).toBe(9);
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
    expect(forge[0]!.tier).toBe(0);
    expect(forge[0]!.pos).toBeNull();
    // Idempotent: reloading the backfilled save grants nothing further.
    const reloaded = deserialize(serialize(loaded.state!, 6_000));
    expect(reloaded.state!.modules.filter((m) => m.type === "mutatorForge")).toHaveLength(1);
    // An entry owner who already rolled a second Mutator Forge from the
    // joined pool (a lost module forge to combination is impossible, so
    // any mutatorForge at all means the grant landed) is left alone.
    file.state.modules.push({ id: "m9", type: "mutatorForge", tier: 1, level: 0, invested: 0, pos: null });
    const owning = deserialize(JSON.stringify(file));
    expect(owning.state!.modules.filter((m) => m.type === "mutatorForge")).toHaveLength(1);
    expect(owning.state!.modules.at(-1)!.tier).toBe(1);
    // No retro-sequence, no retro roll (issue #274): the entry's performed
    // roll belongs to purchases from now on — the backfill banks nothing
    // into the Mutator tray's queue.
    expect(loaded.state!.bankedMutatorRolls).toEqual([]);
    expect(loaded.state!.mutatorSlots).toEqual([]);
  });

  it("resuming from a mid-flow save does not duplicate rewards", () => {
    const build = () => {
      const s = fresh();
      give(s, "forge", hex(1, 0));
      const gen = give(s, "focusKeyed", hex(2, 0));
      gen.reserve = 600;
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

describe("the version gate (ADR-0017's pattern)", () => {
  it("rejects v7 and every older version; there is no chain past one step", () => {
    for (const version of [1, 4, 5, 6, 7]) {
      const text = serialize(fresh()).replace(`"version": ${SAVE_VERSION}`, `"version": ${version}`);
      const result = deserialize(text);
      expect(result.error, `v${version}`).toMatch(/older version/i);
      expect(result.state, `v${version}`).toBeUndefined();
    }
  });

  it("a v7 save starts fresh with the standard version error, never a crash", () => {
    const s = fresh();
    s.arete = 1;
    s.totalEarned = ARETE_HORIZON;
    const result = deserialize(asV7(s));
    expect(result.error).toMatch(/older version/i);
    expect(result.state).toBeUndefined();
    // The fresh state the boot builds instead carries none of it.
    expect(fresh().arete).toBe(0);
  });

  it("rejects corrupt, foreign, and future-version saves", () => {
    expect(deserialize("{nope").error).toBeDefined();
    expect(deserialize('{"app":"other","version":7}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":99,"state":{}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":8,"state":{"mode":"weird"}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":8}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":10,"state":{}}').error).toMatch(/newer than this build/i);
  });

  it("exported saves load unchanged", () => {
    const s = fresh();
    writeNote(s, "portable", 1_000);
    const loaded = deserialize(serialize(s, 42));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.notes[0]!.text).toBe("portable");
  });
});

describe("the v8 → v9 migration (issue #367, ADR-0058)", () => {
  it("a v8 save loads: each copy's rarity becomes its merge tier by index", () => {
    const s = fresh();
    const base = give(s, "harmonizer", hex(1, 0));
    const merged = give(s, "harmonizer", hex(0, 1));
    merged.tier = 1;
    const capped = give(s, "harmonizer", hex(1, 1));
    capped.tier = 2;
    const loaded = deserialize(asV8(s));
    expect(loaded.error).toBeUndefined();
    const modules = loaded.state!.modules;
    // common → 0, uncommon → 1, rare → 2 — the collection's earned steps.
    expect(modules.find((m) => m.id === base.id)!.tier).toBe(0);
    expect(modules.find((m) => m.id === merged.id)!.tier).toBe(1);
    expect(modules.find((m) => m.id === capped.id)!.tier).toBe(2);
    // The stored rarity field is gone from the loaded shape.
    expect(modules.every((m) => !("rarity" in m))).toBe(true);
    // Nothing else moved: cells, levels, placement.
    expect(modules.find((m) => m.id === base.id)!.pos).toEqual(hex(1, 0));
  });

  it("a corrupt legacy rarity reads as the base tier, never a crash", () => {
    const s = fresh();
    const file = JSON.parse(asV8(s));
    file.state.modules[0]!.rarity = "legendary";
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.modules.every((m) => m.tier === 0)).toBe(true);
  });

  it("banked module-roll candidates keep their rolled band as the mint tier", () => {
    const s = fresh();
    s.bankedRolls.push({
      id: "offer",
      candidates: [
        { id: "c1", type: "additive", tier: 0 },
        { id: "c2", type: "spacer", tier: 2 },
        { id: "c3", type: "infusor", tier: 0 },
      ],
    });
    const loaded = deserialize(asV8(s));
    expect(loaded.error).toBeUndefined();
    const candidates = loaded.state!.bankedRolls[0]!.candidates;
    expect(candidates[0]!.tier).toBe(0);
    expect(candidates[1]!.tier).toBe(2);
    expect(candidates.every((c) => !("rarity" in c))).toBe(true);
    // The queued value survives the choice: taking the converted candidate
    // mints at its tier, not the base.
    const rarity = loaded.state!;
    const taken = candidates[1]!;
    expect(chooseRoll(rarity, "offer", taken.id).ok).toBe(true);
    expect(rarity.modules.some((m) => m.type === "spacer" && m.tier === 2)).toBe(true);
  });

  it("mutator rarity is untouched by the migration", () => {
    const s = fresh();
    s.mutators.push({ id: "mu1", family: "power", rarity: "uncommon", pos: null });
    s.bankedMutatorRolls.push({
      id: "mo1",
      candidates: [
        { id: "mc1", family: "charge", rarity: "rare" },
        { id: "mc2", family: "resonance", rarity: "common" },
      ],
    });
    const loaded = deserialize(asV8(s));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.mutators[0]).toMatchObject({ family: "power", rarity: "uncommon" });
    expect(loaded.state!.bankedMutatorRolls[0]!.candidates[0]).toMatchObject({ family: "charge", rarity: "rare" });
  });

  it("the migration is repeatable: a migrated save reloads byte-identical", () => {
    const s = fresh();
    const merged = give(s, "additive", hex(1, 0));
    merged.tier = 1;
    const first = deserialize(asV8(s)).state!;
    const text = serialize(first, 1_000);
    const second = deserialize(text);
    expect(second.error).toBeUndefined();
    expect(serialize(second.state!, 1_000)).toBe(text);
  });

  it("the migration loses no collection value: types, tiers, levels, reserves, and the life record stand", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(1, 0));
    gen.reserve = 42;
    const merged = give(s, "additive", hex(0, 1), 3);
    merged.tier = 2;
    merged.invested = 999;
    s.sessionRecords.push({
      sessionNumber: 1,
      startedAt: 1,
      endedAt: 2,
      habitId: null,
      mode: "open-ended",
      plannedTarget: null,
      creditedSeconds: 60,
      earned: 6,
      honestyEvents: [],
      reflection: null,
      goalsAdvanced: [],
      achievements: [],
    });
    const before = { records: s.sessionRecords.length, modules: s.modules.length };
    const loaded = deserialize(asV8(s));
    expect(loaded.state!.modules).toHaveLength(before.modules);
    expect(loaded.state!.modules.find((m) => m.id === gen.id)!.reserve).toBeCloseTo(42, 9);
    expect(loaded.state!.modules.find((m) => m.id === merged.id)!.level).toBe(3);
    expect(loaded.state!.modules.find((m) => m.id === merged.id)!.invested).toBe(999);
    expect(loaded.state!.sessionRecords).toHaveLength(before.records);
  });
});
