import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh, give, giveHabit, stubRng } from "./fixtures";
import { createHabit, selectHabit } from "./habits";
import { BALANCE, SAVE_VERSION } from "./constants";
import { longGoalCost, mutatorSlotCost } from "./economy";
import { activeGoals, accrueGoalProgress, createGoal, deleteGoal, editGoal, retainGoalChoice, rollGoalOccurrences } from "./goals";
import { deserialize, serialize, SaveRefusedError, GOAL_CAPACITY_REFUND_CAP } from "./save";
import { freshWorld } from "./state";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import { ARETE_HORIZON } from "./accumulator";
import { writeNote } from "./notes";
import { hex } from "./hex";
import type { GameState, Habit } from "./types";
import v10MigrationFixture from "./fixtures/saves/v10-migration.json";

// The version boundaries (issues #423, #445): the habit-class cut and the
// one-goal cut. Each explicit migration is the one step at its boundary;
// every version older than v10 rejects with the start-fresh message, and
// there is no chain past the steps this build carries.

// Fabricate a v8 save from a live state: force the version. Rejected —
// the v10 step is the current chain's floor, and the chain does not grow.
function asV7(state: GameState, savedAt = 1_000): string {
  const file = JSON.parse(serialize(state, savedAt));
  file.version = 7;
  return JSON.stringify(file);
}

// Fabricate a v10 save from a live v11 state: force the version. The
// migration reads the same lenient shapes a real pre-class save wrote;
// the acceptance oracle for known histories is the versioned fixture
// under fixtures/saves/.
function asV10(state: GameState, savedAt = 1_000): string {
  const file = JSON.parse(serialize(state, savedAt));
  file.version = 10;
  return JSON.stringify(file);
}

// Fabricate a v11 save from a live v12 state: rewind the one-goal
// schema — habits wore no palette key, goals carried one — and force the
// version, so `migrateV11ToV12` runs over a real shape.
function asV11(state: GameState, savedAt = 1_000, goalColor = "amber"): string {
  const file = JSON.parse(serialize(state, savedAt));
  for (const habit of file.state.habits) delete habit.color;
  for (const goal of file.state.goals) goal.color = goalColor;
  file.version = 11;
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
    expect(parsed.version).toBe(12);
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

  it("saves lenient-default a module's corrupt position to the tray", () => {
    // A module whose saved position is not a full hex reads as
    // undeployed — every pass guards `pos === null`, so a corrupt figure
    // must degrade to the tray, never poison the boot.
    const file = JSON.parse(serialize(fresh()));
    delete file.state.modules[0]!.pos;
    const absent = deserialize(JSON.stringify(file));
    expect(absent.error).toBeUndefined();
    expect(absent.state!.modules[0]!.pos).toBeNull();
    file.state.modules[0]!.pos = { q: 0 };
    const half = deserialize(JSON.stringify(file));
    expect(half.error).toBeUndefined();
    expect(half.state!.modules[0]!.pos).toBeNull();
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
  it("rejects v9 and every older version; there is no chain past one step", () => {
    for (const version of [1, 4, 5, 6, 7, 8, 9]) {
      const text = serialize(fresh()).replace(`"version": ${SAVE_VERSION}`, `"version": ${version}`);
      const result = deserialize(text);
      expect(result.error, `v${version}`).toMatch(/older version/i);
      expect(result.state, `v${version}`).toBeUndefined();
    }
  });

  it("a v8 save starts fresh with the standard version error, never a crash", () => {
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
    expect(deserialize('{"app":"flowsynth","version":9,"state":{"mode":"weird"}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":9}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":13,"state":{}}').error).toMatch(/newer than this build/i);
  });

  it("exported saves load unchanged", () => {
    const s = fresh();
    writeNote(s, "portable", 1_000);
    const loaded = deserialize(serialize(s, 42));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.notes[0]!.text).toBe("portable");
  });
});

describe("serialization refuses what it cannot write (issue #486)", () => {
  it("a state carrying a nonfinite number refuses the save instead of writing null", () => {
    for (const figure of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      const s = fresh();
      s.nous = figure;
      expect(() => serialize(s)).toThrow(SaveRefusedError);
    }
  });

  it("the refusal names where the figure lives, however deep it hides", () => {
    const s = fresh();
    give(s, "additive", null);
    s.modules[s.modules.length - 1]!.reserve = NaN;
    try {
      serialize(s);
      expect.unreachable("serialize should have refused");
    } catch (error) {
      expect(error).toBeInstanceOf(SaveRefusedError);
      expect((error as Error).message).toMatch(/modules.*reserve/);
    }
  });

  it("a session's unrepresentable accounting refuses the save, not a null bucket", () => {
    const s = fresh();
    startSession(s, null);
    s.session!.accounting.bucketNous = Infinity;
    expect(() => serialize(s)).toThrow(/bucketNous/);
  });
});

describe("the v10 boundary (issue #423)", () => {
  it("a v10 save with none of the retired state migrates to an untouched fresh shape", () => {
    const s = fresh();
    giveHabit(s);
    const gen = give(s, "focusKeyed", hex(1, 0));
    gen.reserve = 60;
    const file = JSON.parse(asV10(s));
    // The pre-class shape: no class wear on the habit, the player-wide
    // flow meter still on it — with nothing to refund or pay out.
    delete file.state.habits[0].classId;
    delete file.state.habits[0].classes;
    file.state.flow = { progress: 0, earned: 0 };
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    const state = loaded.state!;
    // The habit reads as an Engineer from zero — exactly what a fresh
    // shape writes; the reserve stands as stored.
    expect(state.habits[0]!.classId).toBe("engineer");
    expect(state.habits[0]!.classes.engineer).toMatchObject({ experience: 0, level: 0, points: 0 });
    expect(state.habits[0]!.classes.engineer!.rollMeter).toEqual({ progress: 0, earned: 0 });
    expect(state.goalFuel).toBe(0);
    expect(state.modules.find((m) => m.id === gen.id)!.reserve).toBe(60);
    // Nothing retired, nothing paid: the balances stand.
    expect(state.arete).toBe(0);
    expect(state.nous).toBe(fresh().nous);
    expect("flow" in state).toBe(false);
    expect(state.bankedRolls).toHaveLength(0);
  });

  it("a loaded v10 save round-trips byte-identical", () => {
    const s = fresh();
    giveHabit(s);
    const first = deserialize(asV10(s)).state!;
    const text = serialize(first, 1_000);
    const second = deserialize(text);
    expect(second.error).toBeUndefined();
    expect(serialize(second.state!, 1_000)).toBe(text);
  });

  it("mutators, tiers, and banked rolls are untouched at the boundary", () => {
    const s = fresh();
    s.mutators.push({ id: "mu1", family: "power", rarity: "uncommon", pos: null });
    const merged = give(s, "harmonizer", hex(0, 1));
    merged.tier = 2;
    s.bankedRolls.push({
      id: "offer",
      candidates: [
        { id: "c1", type: "additive", tier: 0 },
        { id: "c2", type: "spacer", tier: 2 },
        { id: "c3", type: "infusor", tier: 0 },
      ],
    });
    const loaded = deserialize(asV10(s));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.mutators[0]).toMatchObject({ family: "power", rarity: "uncommon" });
    expect(loaded.state!.modules.find((m) => m.id === merged.id)!.tier).toBe(2);
    expect(loaded.state!.bankedRolls[0]!.candidates[1]!.tier).toBe(2);
  });
});

// The migration's acceptance oracle: the versioned v10 fixture save under
// the test tree (issue #427) — known purchase histories, partial flow
// progress, per-habit seconds, and a multi-habit goal — never a hand-built
// object in test code. Refund arithmetic asserts against the price
// functions' own outputs, never literals.
describe("the v10 → v11 migration (issue #427)", () => {
  const fixtureText = JSON.stringify(v10MigrationFixture);
  const loadFixture = (text = fixtureText) => {
    const result = deserialize(text, stubRng(new Array(32).fill(0.4)));
    expect(result.error).toBeUndefined();
    return result.state!;
  };
  // A fixture variant with named JSON edits — the file stays the oracle,
  // the edit names the difference.
  const withEdits = (edit: (state: Record<string, unknown>) => void): string => {
    const file = JSON.parse(fixtureText) as { state: Record<string, unknown> };
    edit(file.state);
    return JSON.stringify(file);
  };

  it("refunds every retired Mutator purchase exactly, in original currency, off the price functions", () => {
    const state = loadFixture();
    // The fixture owned the full tree: the entry, three slots (two paid),
    // the pool join — and broke the horizon. The refund sums the same
    // functions the purchases charged, on top of the carried balance.
    const expected =
      v10MigrationFixture.state.arete +
      BALANCE.catalogEntryCost +
      (mutatorSlotCost(1) + mutatorSlotCost(2)) +
      BALANCE.rollPoolJoinCost +
      BALANCE.horizonBreakCost;
    expect(state.arete).toBe(expected);
    // The flags rest as the Mutator layer's inert data — ownership itself
    // is not rewritten by the refund.
    expect(state.catalogEntryOwned).toBe(true);
    expect(state.rollPoolJoined).toBe(true);
  });

  it("refunds the retired goal-slot economy exactly through the long-goal ladder, one whole-nous refund", () => {
    const state = loadFixture();
    const expected = 150 + longGoalCost(0) + longGoalCost(1);
    expect(state.nous).toBe(expected);
    expect(Number.isInteger(state.nous)).toBe(true);
    // The retired count retires with its economy.
    expect(state.goalCapacityBought).toBe(0);
  });

  it("a corrupt goal-capacity figure refunds the ladder's plausible head and never spins", () => {
    const state = loadFixture(
      withEdits((s) => {
        s.goalCapacityBought = 1e9;
      }),
    );
    let expected = 150;
    for (let bought = 0; bought < GOAL_CAPACITY_REFUND_CAP; bought++) expected += longGoalCost(bought);
    expect(state.nous).toBe(expected);
    expect(state.goalCapacityBought).toBe(0);
  });

  it("a retired purchase never owned refunds nothing, and zero flow progress pays nothing", () => {
    const baseline = loadFixture();
    const state = loadFixture(
      withEdits((s) => {
        s.catalogEntryOwned = false;
        s.rollPoolJoined = false;
        s.horizonBroken = false;
        s.goalCapacityBought = 0;
        (s.flow as { progress: number }).progress = 0;
      }),
    );
    expect(state.arete).toBe(
      baseline.arete - BALANCE.catalogEntryCost - (mutatorSlotCost(1) + mutatorSlotCost(2)) - BALANCE.rollPoolJoinCost - BALANCE.horizonBreakCost,
    );
    expect(state.nous).toBe(baseline.nous - longGoalCost(0) - longGoalCost(1));
    expect(state.bankedRolls).toHaveLength(1);
  });

  it("converts recorded habit seconds to Engineer experience once at one XP per second, levels deriving through the authored thresholds", () => {
    const state = loadFixture();
    // h1 recorded 36 000 s: 1 XP/s lands past the second threshold
    // (36 000 ≥ 21 600), two levels and two points derived, allocations
    // unspent, the pair's meter empty.
    const [h1, h2] = state.habits as Habit[];
    expect(h1!.seconds).toBe(36_000);
    expect(h1!.classes.engineer).toMatchObject({ experience: 36_000, level: 2, points: 2, spent: {} });
    expect(h1!.classes.engineer!.rollMeter).toEqual({ progress: 0, earned: 0 });
    // h2 recorded 8 000 s: past the first threshold alone.
    expect(h2!.seconds).toBe(8_000);
    expect(h2!.classes.engineer).toMatchObject({ experience: 8_000, level: 1, points: 1, spent: {} });
  });

  it("pays the flow meter's final payout: partial progress banks exactly one roll into the shared queue", () => {
    const state = loadFixture();
    // The fixture's own banked roll stands first; the payout appends one.
    expect(state.bankedRolls).toHaveLength(2);
    expect(state.bankedRolls[0]!.id).toBe("offer1");
    expect(state.bankedRolls[1]!.candidates).toHaveLength(3);
    // The retired meter is gone from the shape; nothing else was paid.
    expect("flow" in state).toBe(false);
  });

  it("retires overflow goals to history oldest-active-first and keeps within-capacity goals untouched", () => {
    const state = loadFixture();
    const byId = new Map(state.goals.map((goal) => [goal.id, goal]));
    // h1 carried four goals past the fixed capacity of three; the oldest
    // retires. h2 carried two — nothing retires. The retired per-goal
    // palette key dropped with the one-goal cut (issue #445).
    const fixtureGoal = (id: string) => {
      const { color: _color, ...rest } = v10MigrationFixture.state.goals.find((g) => g.id === id)!;
      return rest;
    };
    expect(byId.get("g1")).toEqual({ ...fixtureGoal("g1"), liveSeconds: 0, retired: true });
    expect(activeGoals(state).some((g) => g.id === "g1")).toBe(false);
    expect(byId.get("g2")).toMatchObject({ progressSeconds: 900, condition: { minutes: 45 } });
    expect(byId.get("g3")).toMatchObject({ progressSeconds: 300, schedule: { kind: "weekly" } });
    expect(byId.get("g5")).toMatchObject({ progressSeconds: 0 });
    expect(byId.get("g6")).toMatchObject({ progressSeconds: 120 });
    expect(byId.get("g7")).toMatchObject({ progressSeconds: 0 });
    // Session history still resolves the preserved goal by ID.
    expect(state.sessionRecords[0]!.goalsAdvanced[0]).toMatchObject({ goalId: "g1" });
  });

  it("cross-habit goals retire to history in full and are never re-read as single-habit goals", () => {
    const state = loadFixture();
    const cross = state.goals.find((goal) => goal.id === "g4");
    // Kept, inert: the row rests with its condition exactly as carried.
    expect(cross).toMatchObject({ progressSeconds: 1_200, condition: { kind: "habit-minutes", habitId: null, minutes: 60 } });
    // The production read refuses it: credited practice for a habit never
    // advances the cross-habit row again.
    const before = cross!.progressSeconds;
    accrueGoalProgress(state, "h1", 3_600, "live");
    expect(cross!.progressSeconds).toBe(before);
    // And it never occupies the one active goal: the narrowing's pending
    // rows hold the habit's carried records instead (issue #445).
    expect(activeGoals(state).filter((goal) => goal.condition.habitId === "h1")).toHaveLength(0);
  });

  it("preserves fractional recorded seconds and pays even subsecond flow progress", () => {
    const state = loadFixture(withEdits((s) => {
      (s.habits as Habit[])[0]!.seconds = 36_000.75;
      (s.flow as { progress: number }).progress = 0.25;
    }));
    expect(state.habits[0]!.classes.engineer!.experience).toBe(36_000.75);
    expect(state.bankedRolls).toHaveLength(2);
    const reloaded = deserialize(serialize(state)).state!;
    expect(reloaded.habits[0]!.classes.engineer!.experience).toBe(36_000.75);
    expect(reloaded.bankedRolls).toHaveLength(2);
  });

  it("keeps retired goal facts unchanged across rollover, practice, edits, and reload", () => {
    const state = loadFixture();
    const retired = state.goals.filter((g) => g.retired);
    expect(retired.map((g) => g.id)).toEqual(["g1", "g4"]);
    const before = structuredClone(retired);
    rollGoalOccurrences(state, Date.UTC(2030, 0, 1));
    accrueGoalProgress(state, "h1", 3_600);
    state.mode = "upgrade";
    expect(deleteGoal(state, "g1").ok).toBe(false);
    expect(retainGoalChoice(state, "g1").ok).toBe(false);
    expect(retired).toEqual(before);
    expect(deserialize(serialize(state)).state!.goals.filter((g) => g.retired)).toEqual(before);
    // The carried rows resolve through the one-goal editor: retaining one
    // retires its pending siblings, and the retained row can then be
    // replaced by a fresh goal even though the records remain present.
    expect(retainGoalChoice(state, "g2").ok).toBe(true);
    expect(state.goals.filter((g) => g.retired).map((g) => g.id)).toEqual(["g1", "g3", "g4", "g5"]);
    expect(deleteGoal(state, "g2").ok).toBe(true);
    expect(createGoal(state, { habitId: "h1", minutes: 10, schedule: "daily", now: 1 }).ok).toBe(true);
  });

  it("preserves overflow goals even when no session ever referenced them", () => {
    const state = loadFixture(withEdits((s) => { s.sessionRecords = []; }));
    const { color: _color, ...expected } = v10MigrationFixture.state.goals.find((g) => g.id === "g1")!;
    expect(state.goals.find((g) => g.id === "g1")).toEqual({ ...expected, liveSeconds: 0, retired: true });
  });

  it("keeps the Mutator layer resting intact: slots, tray, placed mutators, banked rolls, and meter survive inert", () => {
    const state = loadFixture();
    expect(state.mutatorSlots).toEqual([hex(0, 1), hex(1, 0), hex(2, 0)]);
    expect(state.mutators).toEqual(v10MigrationFixture.state.mutators);
    expect(state.mutatorForge).toEqual({ progress: 33, earned: 2 });
    expect(state.bankedMutatorRolls).toEqual(v10MigrationFixture.state.bankedMutatorRolls);
    // The entry's Mutator Forge module was carried, so the load backfills
    // no second grant.
    expect(state.modules.filter((module) => module.type === "mutatorForge")).toHaveLength(1);
  });

  it("keeps everything the prestige boundary kept: the life record, the collection, and the earned feats", () => {
    const state = loadFixture();
    // Habits and their practice seconds; the life record.
    expect(state.habits.map((h) => h.seconds)).toEqual([36_000, 8_000]);
    expect(state.practiceLog).toEqual(v10MigrationFixture.state.practiceLog);
    expect(state.notes).toEqual(v10MigrationFixture.state.notes);
    expect(state.sessionRecords).toEqual(v10MigrationFixture.state.sessionRecords);
    // The collection and the board.
    expect(state.cellsBought).toBe(2);
    expect(state.gatedRows).toEqual([0, 1, -1]);
    expect(state.unlockedRows).toEqual([2]);
    expect(state.capacityCeilings).toBe(1);
    expect(state.capacityDiscounts).toBe(1);
    expect(state.mergeCapPurchases).toBe(1);
    expect(state.scrap).toBe(25);
    expect(state.draftTierBonus).toBe(1);
    expect(state.bankedRolls[0]!.candidates[1]!.tier).toBe(2);
    // Already-earned feats stay earned — the retired horizon-break stamp
    // included.
    expect(state.achievements["breaking-the-horizon"]).toBe(1_700_000_000_001);
    expect(state.achievements["roll-credit"]).toBe(1_700_000_000_004);
    // A v10 save predates the World layer: it opens unclaimed.
    expect(state.world).toEqual(freshWorld());
  });

  it("a migration round-trips the save cleanly", () => {
    const migrated = loadFixture();
    const text = serialize(migrated, 1_000);
    const reloaded = deserialize(text, stubRng(new Array(32).fill(0.4)));
    expect(reloaded.error).toBeUndefined();
    expect(serialize(reloaded.state!, 1_000)).toBe(text);
  });

  it("a re-migration cannot exist: the migrated save reloads as v11 and pays nothing again", () => {
    const migrated = loadFixture();
    const text = serialize(migrated, 1_000);
    const reloaded = deserialize(text, stubRng(new Array(32).fill(0.4))).state!;
    expect(reloaded.arete).toBe(migrated.arete);
    expect(reloaded.nous).toBe(migrated.nous);
    expect(reloaded.bankedRolls).toHaveLength(2);
    expect(reloaded.habits.map((h) => h.classes.engineer!.experience)).toEqual([36_000, 8_000]);
  });
});

// The one-goal narrowing's own boundary (issue #445): the v11 save built
// from a live state — habits without palette keys, goals carrying them —
// passes through `migrateV11ToV12` alone. The color transfer and the
// pending multi-goal choice are the conversion's whole subject.
describe("the v11 → v12 migration (issue #445)", () => {
  function singleGoalSave(): string {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    const goal = createGoal(s, { habitId: habit.id, minutes: 20, schedule: "daily", now: 5_000 }).goal!;
    goal.progressSeconds = 600;
    goal.completedCount = 2;
    return asV11(s);
  }

  it("a single-goal habit adopts its goal's color and the row transfers unchanged", () => {
    const loaded = deserialize(singleGoalSave()).state!;
    const [habit] = loaded.habits as Habit[];
    expect(habit!.color).toBe("amber");
    const goal = loaded.goals[0]!;
    expect(goal.pendingChoice).toBeUndefined();
    expect(goal.retired).toBeUndefined();
    expect(goal.progressSeconds).toBe(600);
    expect(goal.completedCount).toBe(2);
    expect("color" in goal).toBe(false);
  });

  it("a zero-goal habit wears the palette default and stays usable", () => {
    const s = fresh();
    createHabit(s, "Piano");
    const loaded = deserialize(asV11(s)).state!;
    expect(loaded.habits[0]!.color).toBe("vermillion");
    expect(loaded.goals).toHaveLength(0);
  });

  it("a multi-goal habit holds every row pending and wears the default until the choice lands", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    const first = createGoal(s, { habitId: habit.id, minutes: 20, schedule: "daily", now: 5_000 }).goal!;
    // The v11 save's second row — the create path refuses it today, so
    // the test writes the shape the old schema carried.
    s.goals.push({ ...structuredClone(first), id: `${first.id}b`, condition: { kind: "habit-minutes", habitId: habit.id, minutes: 45 }, schedule: { kind: "once" }, progressSeconds: 0, createdAt: 6_000 });
    const loaded = deserialize(asV11(s, 1_000, "cyan")).state!;
    expect(loaded.habits[0]!.color).toBe("vermillion");
    expect(loaded.goals.map((g) => g.pendingChoice)).toEqual([true, true]);
    // Unresolved: the active reads refuse the rows, and practice cannot
    // complete or pay either one.
    expect(activeGoals(loaded)).toHaveLength(0);
    accrueGoalProgress(loaded, habit.id, 3_600, "live");
    expect(loaded.goals.every((g) => !g.completed)).toBe(true);
    expect(loaded.goalFuel).toBe(0);
  });

  it("the chain runs once: a v10 fixture save lands on the same narrowing (both steps, in order)", () => {
    const state = deserialize(JSON.stringify(v10MigrationFixture), stubRng(new Array(32).fill(0.4))).state!;
    // h1's three surviving rows and h2's two all pend; the colors stay the
    // default — nothing was silently chosen.
    expect(state.habits.map((h) => h.color)).toEqual(["vermillion", "vermillion"]);
    expect(state.goals.filter((g) => g.pendingChoice).map((g) => g.id)).toEqual(["g2", "g3", "g5", "g6", "g7"]);
  });

  it("retaining a carried row after the migration keeps its record and pays one completion, once", () => {
    const loaded = deserialize(singleGoalSave()).state!;
    const goal = loaded.goals[0]!;
    // The transferred row is already active: credited practice rides
    // toward the raised target, and the completion draws the bounded pool.
    editGoal(loaded, goal.id, { minutes: 30, schedule: "daily" }, 9_000);
    expect(goal.completed).toBe(false);
    expect(goal.progressSeconds).toBe(600);
  });

  it("a v12 save reloads untouched: no re-defaulting, no re-flagging", () => {
    const once = deserialize(singleGoalSave()).state!;
    const text = serialize(once, 1_000);
    const twice = deserialize(text).state!;
    expect(serialize(twice, 1_000)).toBe(text);
    expect(twice.habits[0]!.color).toBe("amber");
    expect(twice.goals[0]!.pendingChoice).toBeUndefined();
  });
});
