import { describe, expect, it } from "vitest";
import { endSession, prestige, startSession } from "./actions";
import { ARETE_HORIZON } from "./accumulator";
import { computeRates, emittedStrength } from "./economy";
import { fresh, give, giveHabit, stubRng } from "./fixtures";
import { hex } from "./hex";
import { addPracticeLog } from "./habits";
import { writeNote } from "./notes";
import { creditFocusEarning } from "./reserves";
import { deserialize, serialize } from "./save";
import v10MigrationFixture from "./fixtures/saves/v10-migration.json";
import type { GameState, Habit } from "./types";

// The legacy habit builds' retirement (issue #444, ADR-0076): class
// development is the single progression system per habit/class. The old
// loadouts retire as a behavior change — production, charge, and the
// related RITUAL amplification no longer read them — while earned class
// development, practice history, and the one-time recorded-practice
// conversion survive untouched. These regressions exercise both shapes a
// returning save can carry: a previously equipped loadout and an empty
// one.

// A habit shape as an old save wrote it: the retired build field on the
// v11 schema. The load's retired-field strip is what must digest it.
function habitWithRetiredBuild(habit: Habit, build: string[]): void {
  (habit as Habit & { build?: string[] }).build = build;
}

// The same board twice: once with the legacy loadout carried, once with
// the retired field stripped — every economy read must agree.
function pairedStates(build: string[]): { carried: GameState; stripped: GameState } {
  const carried = fresh();
  const { habit } = giveHabit(carried);
  habitWithRetiredBuild(habit, build);
  const stripped = deserialize(serialize(carried)).state!;
  expect(stripped.habits[0]!.classes.engineer).toBeDefined();
  return { carried, stripped };
}

describe("the legacy build retirement (issue #444)", () => {
  it("a previously equipped loadout no longer modifies production", () => {
    // Weights scaled the synth term, pitch-ear the named-chord factor —
    // the authoritative pass must read both shapes identically.
    const { carried, stripped } = pairedStates(["weights", "weights-ii", "pitch-ear", "deep-practice"]);
    give(carried, "additive", hex(1, 0));
    give(stripped, "additive", hex(1, 0));
    const withLoadout = computeRates(carried, true);
    const without = computeRates(stripped, true);
    expect(withLoadout.rate).toBeCloseTo(without.rate, 9);
    expect(withLoadout.synths).toBeCloseTo(without.synths, 9);
    expect(withLoadout.namedChords).toEqual(without.namedChords);
  });

  it("a previously equipped loadout no longer modifies charge", () => {
    // Steady conduit added flat output strength; charge-tap scaled the
    // session-end focus bank — neither may move now.
    const { carried, stripped } = pairedStates(["steady-conduit", "charge-tap", "charge-tap-ii"]);
    for (const s of [carried, stripped]) {
      give(s, "focusKeyed", hex(1, 0)).reserve = 600;
    }
    const generator = carried.modules.find((m) => m.type === "focusKeyed")!;
    expect(emittedStrength(carried, generator, true)).toBeCloseTo(emittedStrength(stripped, generator, true), 9);
    // The focus bank: same credited seconds, same banked charge.
    const beforeCarried = carried.modules.find((m) => m.type === "focusKeyed")!.reserve;
    const beforeStripped = stripped.modules.find((m) => m.type === "focusKeyed")!.reserve;
    creditFocusEarning(carried, 600);
    creditFocusEarning(stripped, 600);
    expect(
      carried.modules.find((m) => m.type === "focusKeyed")!.reserve - beforeCarried,
    ).toBeCloseTo(
      stripped.modules.find((m) => m.type === "focusKeyed")!.reserve - beforeStripped,
      9,
    );
  });

  it("a previously equipped loadout no longer modifies Forge progress or booster uplift", () => {
    const { carried, stripped } = pairedStates(["forge-hand", "forge-hand-ii", "steady-hand"]);
    for (const s of [carried, stripped]) {
      give(s, "focusKeyed", hex(1, 0)).reserve = 600;
      give(s, "forge", hex(2, 0));
      give(s, "infusor", hex(3, 1));
      give(s, "additive", hex(4, 0));
    }
    const withLoadout = computeRates(carried, true);
    const without = computeRates(stripped, true);
    expect(withLoadout.forgeRate).toBeCloseTo(without.forgeRate, 9);
    const voice = (s: GameState) => s.modules.find((m) => m.type === "additive")!.id;
    expect(withLoadout.contributions.get(voice(carried))!.infusorBonus).toBeCloseTo(
      without.contributions.get(voice(stripped))!.infusorBonus,
      9,
    );
  });

  it("RITUAL amplification retired with the builds: a charged RITUAL moves no production", () => {
    const s = fresh();
    giveHabit(s);
    const ritual = give(s, "ritual", hex(1, 0));
    ritual.level = 3;
    give(s, "focusKeyed", hex(2, 0)).reserve = 600;
    give(s, "additive", hex(3, 0));
    const charged = computeRates(s, true);
    // The ritual still receives charge continuously — and delivers nothing.
    expect(charged.chargeStrength.get(ritual.id)!).toBeGreaterThan(0);
    const plain = fresh();
    giveHabit(plain);
    give(plain, "focusKeyed", hex(2, 0)).reserve = 600;
    give(plain, "additive", hex(3, 0));
    expect(charged.rate).toBeCloseTo(computeRates(plain, true).rate, 9);
  });

  it("loading a save that carries the retired build field strips it and preserves class development", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    habitWithRetiredBuild(habit, ["weights"]);
    pair.experience = 1234;
    pair.level = 4;
    pair.points = 1;
    pair.spent = { governor: 2, reed: 1 };
    pair.rollMeter.progress = 77;
    pair.rollMeter.earned = 2;
    habit.seconds = 9_000;
    const loaded = deserialize(serialize(s, 1_000));
    expect(loaded.error).toBeUndefined();
    const loadedHabit = loaded.state!.habits[0]!;
    expect((loadedHabit as Habit & { build?: string[] }).build).toBeUndefined();
    expect(loadedHabit.seconds).toBe(9_000);
    const loadedPair = loadedHabit.classes.engineer!;
    expect(loadedPair.experience).toBe(1234);
    expect(loadedPair.level).toBe(4);
    expect(loadedPair.points).toBe(1);
    expect(loadedPair.spent).toEqual({ governor: 2, reed: 1 });
    expect(loadedPair.rollMeter).toEqual({ progress: 77, earned: 2 });
    // The stripped shape is the stable one: the next round-trip is
    // byte-identical, so the retired field can never come back.
    const text = serialize(loaded.state!, 1_000);
    expect(text).not.toContain('"build"');
    expect(serialize(deserialize(text).state!, 1_000)).toBe(text);
  });

  it("an empty legacy build loads exactly like an equipped one — no error, no leftovers", () => {
    const s = fresh();
    const { habit } = giveHabit(s);
    habitWithRetiredBuild(habit, []);
    const loaded = deserialize(serialize(s, 1_000));
    expect(loaded.error).toBeUndefined();
    expect((loaded.state!.habits[0]! as Habit & { build?: string[] }).build).toBeUndefined();
  });

  it("the recorded-practice conversion still happens exactly once — a converted save never converts again", () => {
    const fixtureText = JSON.stringify(v10MigrationFixture);
    const first = deserialize(fixtureText, stubRng(new Array(32).fill(0.4)));
    expect(first.error).toBeUndefined();
    const converted = first.state!;
    // The conversion's rule: one Engineer XP per recorded second, once.
    const totals = converted.habits.map((habit) => ({
      seconds: habit.seconds,
      experience: habit.classes.engineer!.experience,
    }));
    for (const total of totals) {
      expect(total.experience).toBe(total.seconds);
    }
    // Loading the converted (current) save grants no second award: every
    // pair reads exactly as the first load wrote it.
    const second = deserialize(serialize(converted, 2_000));
    expect(second.error).toBeUndefined();
    for (const habit of second.state!.habits) {
      const match = totals.find((total) => total.seconds === habit.seconds)!;
      expect(habit.classes.engineer!.experience).toBe(match.experience);
    }
  });

  it("prestige keeps class ledgers, allocation, and roll progress; no build state returns", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    habit.seconds = 5_400;
    pair.experience = 2_000;
    pair.level = 4;
    pair.points = 2;
    pair.spent = { governor: 1 };
    pair.rollMeter.progress = 90;
    pair.rollMeter.earned = 5;
    s.eraEarned = ARETE_HORIZON;
    s.mode = "upgrade";
    expect(prestige(s).ok).toBe(true);
    expect(habit.seconds).toBe(5_400);
    expect(pair.experience).toBe(2_000);
    expect(pair.level).toBe(4);
    expect(pair.points).toBe(2);
    expect(pair.spent).toEqual({ governor: 1 });
    expect(pair.rollMeter).toEqual({ progress: 90, earned: 5 });
    expect((habit as Habit & { build?: string[] }).build).toBeUndefined();
    expect(serialize(s)).not.toContain('"build"');
  });

  it("practice history, archived habits, tagged notes, and collection records survive the strip", () => {
    const s = fresh();
    const kept = giveHabit(s, "Piano");
    kept.habit.archived = true;
    const active = giveHabit(s, "Reading");
    habitWithRetiredBuild(active.habit, ["weights"]);
    // Real records through their own seams: a manual log, a session, a
    // tagged note, a feat, a banked roll.
    addPracticeLog(s, active.habit.id, 10, 1_000);
    startSession(s, null);
    writeNote(s, "slow bars first", 1_500);
    endSession(s);
    s.achievements["first-light"] = 1_000;
    s.bankedRolls.push({
      id: "offer",
      candidates: [
        { id: "c1", type: "additive", tier: 0 },
        { id: "c2", type: "spacer", tier: 0 },
        { id: "c3", type: "infusor", tier: 0 },
      ],
    });
    const loaded = deserialize(serialize(s, 2_000));
    expect(loaded.error).toBeUndefined();
    const state = loaded.state!;
    expect(state.habits.map((habit) => habit.archived)).toEqual([true, false]);
    expect(state.habits.map((habit) => habit.seconds)).toEqual(s.habits.map((habit) => habit.seconds));
    expect((state.habits[1]! as Habit & { build?: string[] }).build).toBeUndefined();
    expect(state.notes).toEqual(s.notes);
    expect(state.practiceLog).toEqual(s.practiceLog);
    expect(state.sessionRecords).toEqual(s.sessionRecords);
    expect(state.achievements).toEqual(s.achievements);
    expect(state.bankedRolls).toEqual(s.bankedRolls);
  });
});
