import { describe, expect, it } from "vitest";
import { advance, advanceBreather } from "./advance";
import { endSession, pauseSession, prestige, resumeSession, startBreather, startSession } from "./actions";
import { addPracticeLog, selectHabit } from "./habits";
import {
  accrueClassDevelopment,
  allocateClassNode,
  applyClassPreset,
  CLASSES,
  classDefOf,
  practiceRollThreshold,
  respecClassTree,
  selectHabitClass,
  totalPracticeRollsEarned,
} from "./classes";
import { accrueGoalFuel, accrueGoalProgress, createGoal } from "./goals";
import { creditGoalEarning } from "./reserves";
import { BALANCE } from "./constants";
import { fresh, give, giveHabit, stubRng } from "./fixtures";
import { deserialize, serialize } from "./save";

// The habit-class layer (issue #423, ADR-0074): each habit–class pair owns
// its experience, level, tree points, allocations, and roll progress;
// credited flow time with the pair selected is the only class development;
// the session lock covers pauses; and the goal-fuel budget bounds the
// completion credit at the seam. Every cadence figure, node effect,
// threshold, and budget rate here reads BALANCE — the tuning knobs live in
// constants.ts alone, never in action code.

// A mid-band draw: whatever the slot asks, the stub answers inside every
// band and weight — offer shapes never matter, only the crossings do.
const PLAIN = () => 0.5;

describe("the pair ledger", () => {
  it("a created habit wears the launch class with a fresh pair", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    expect(habit.classId).toBe("engineer");
    expect(pair).toMatchObject({ experience: 0, level: 0, points: 0 });
    expect(pair.rollMeter).toEqual({ progress: 0, earned: 0 });
    expect(CLASSES.map((c) => c.id)).toEqual(["engineer"]);
  });

  it("credited flow accrues class experience and crosses authored thresholds into tree points", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    startSession(s, 600);
    advance(s, BALANCE.engineerLevelThresholds[0]!, PLAIN);
    endSession(s);
    expect(pair.experience).toBe(BALANCE.engineerLevelThresholds[0]);
    expect(pair.level).toBe(1);
    expect(pair.points).toBe(1);
    // Crossing the next threshold in one span grants its point — accrual
    // reads the whole span, never one level at a time.
    startSession(s, 600);
    advance(s, BALANCE.engineerLevelThresholds[1]! - BALANCE.engineerLevelThresholds[0]! + 1, PLAIN);
    endSession(s);
    expect(pair.level).toBe(2);
    expect(pair.points).toBe(2);
  });

  it("switching habits freezes each pair in place — nothing transfers, nothing destroys", () => {
    const s = fresh();
    const first = giveHabit(s, "Piano");
    startSession(s, 600);
    advance(s, 1200, PLAIN);
    endSession(s);
    // 1200 credited seconds: the opening fill crossed, the flat block waits.
    const frozen = { experience: first.pair.experience, progress: first.pair.rollMeter.progress, earned: first.pair.rollMeter.earned };
    expect(frozen.earned).toBe(1);
    expect(frozen.progress).toBeCloseTo(1020, 6);

    const second = giveHabit(s, "Cooking");
    startSession(s, 600);
    advance(s, 600, PLAIN);
    endSession(s);

    // The first pair froze exactly where it stood; the second filled alone.
    expect(first.pair.experience).toBe(frozen.experience);
    expect(first.pair.rollMeter.progress).toBeCloseTo(frozen.progress, 6);
    expect(first.pair.rollMeter.earned).toBe(frozen.earned);
    expect(second.pair.experience).toBe(600);
    expect(second.pair.rollMeter.earned).toBe(1);
    expect(second.pair.rollMeter.progress).toBeCloseTo(420, 6);
    // Switching back resumes the first pair, not a shared meter.
    selectHabit(s, first.habit.id);
    startSession(s, 600);
    advance(s, 600, PLAIN);
    endSession(s);
    expect(first.pair.rollMeter.earned).toBe(frozen.earned);
    expect(first.pair.rollMeter.progress).toBeCloseTo(frozen.progress + 600, 6);
    expect(totalPracticeRollsEarned(s)).toBe(2);
  });

  it("switching to unstructured practice freezes the pair the same way", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    startSession(s, 600);
    advance(s, 300, PLAIN);
    endSession(s);
    selectHabit(s, null);
    startSession(s, 600);
    advance(s, 3600, PLAIN);
    endSession(s);
    // The unstructured hour ran production and charge forging and earned
    // nothing class-side: experience froze at 300, the meter at its fill.
    expect(pair.experience).toBe(300);
    expect(pair.rollMeter.earned).toBe(1);
    expect(pair.rollMeter.progress).toBeCloseTo(120, 6);
  });

  it("manual practice logs advance neither class experience nor roll progress", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    addPracticeLog(s, habit.id, 120, 1_000);
    expect(habit.seconds).toBe(7200); // practice history advances
    expect(pair.experience).toBe(0);
    expect(pair.rollMeter).toEqual({ progress: 0, earned: 0 });
    expect(totalPracticeRollsEarned(s)).toBe(0);
  });

  it("breathers grant neither class experience, roll progress, nor goal fuel", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    startSession(s, null);
    advance(s, 3600, stubRng(new Array(64).fill(0.5)));
    endSession(s, 1_000);
    const before = { experience: pair.experience, meter: { ...pair.rollMeter }, fuel: s.goalFuel };
    expect(s.summary!.breatherAllowance).toBeGreaterThan(0);
    expect(startBreather(s, 2_000).ok).toBe(true);
    advanceBreather(s, s.breather!.allowanceSeconds, stubRng(new Array(8).fill(0.5)));
    expect(pair.experience).toBe(before.experience);
    expect(pair.rollMeter).toEqual(before.meter);
    expect(s.goalFuel).toBe(before.fuel);
  });

  it("per-pair meters survive a prestige — class progress persists, nothing class-side resets", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    pair.experience = BALANCE.engineerLevelThresholds[1]!;
    pair.level = 2;
    pair.points = 1;
    pair.spent = { governor: 1 };
    pair.rollMeter = { progress: 900, earned: 4 };
    // Force the horizon so the reset can run.
    s.eraEarned = 1e12;
    prestige(s);
    expect(habit.classId).toBe("engineer");
    expect(pair.experience).toBe(BALANCE.engineerLevelThresholds[1]);
    expect(pair.level).toBe(2);
    expect(pair.points).toBe(1);
    expect(pair.spent).toEqual({ governor: 1 });
    expect(pair.rollMeter).toEqual({ progress: 900, earned: 4 });
  });
});

describe("the tree (issue #423)", () => {
  it("nodes carry bounded ranks and explicit level prerequisites", () => {
    const { nodes } = classDefOf("engineer");
    for (const node of nodes) {
      expect(node.maxRank).toBeGreaterThan(0);
      expect(node.requiredLevel).toBeGreaterThanOrEqual(1);
    }
  });

  it("allocating spends the balance, honors rank caps and level prerequisites, and refuses in flow", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    pair.level = 3;
    pair.points = 3;
    expect(allocateClassNode(s, habit.id, "reed").ok).toBe(true);
    expect(pair.spent).toEqual({ reed: 1 });
    expect(pair.points).toBe(2);
    expect(allocateClassNode(s, habit.id, "reed").ok).toBe(true);
    expect(pair.spent).toEqual({ reed: 2 });
    expect(allocateClassNode(s, habit.id, "reed").ok).toBe(false); // rank cap
    expect(allocateClassNode(s, habit.id, "governor").ok).toBe(true);
    expect(allocateClassNode(s, habit.id, "punch-card").ok).toBe(false); // level 5 lock
    startSession(s, 600);
    expect(allocateClassNode(s, habit.id, "governor").ok).toBe(false);
    expect(pair.points).toBe(0);
  });

  it("the Governor's ranks discount only the flat cadence block", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    pair.spent = { governor: 2 };
    expect(practiceRollThreshold(pair, 0)).toBe(BALANCE.flowOpeningSeconds);
    expect(practiceRollThreshold(pair, 4)).toBeCloseTo(
      BALANCE.flowCadenceSeconds * (1 - 2 * BALANCE.engineerCadenceDiscountPerRank),
      6,
    );
  });

  it("the Reed ranks lift the pair's practice mints' tier chance, clamped to the unlocked cap", () => {
    const s = fresh();
    const { pair } = giveHabit(s);
    pair.spent = { reed: 2 };
    // Draws per candidate: band, category, type, tier. Bands land common,
    // the category lands oscillator, the type lands additive (the rig
    // never fires), and every tier draw clears the loom+Reed chance —
    // each candidate mints one tier up, at the cap's leave.
    const draws = [0.0001, 0.0, 0.0, 0.0, 0.0001, 0.0, 0.0, 0.0, 0.0001, 0.0, 0.0, 0.0];
    accrueClassDevelopment(s, BALANCE.flowOpeningSeconds, stubRng(draws));
    const offer = s.bankedRolls.at(-1)!;
    expect(offer.candidates.map((c) => c.tier)).toEqual([1, 1, 1]);
  });

  it("the Punch card weaves every nth practice mint as a guaranteed-rare draft", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    pair.level = 5;
    pair.points = 3;
    expect(allocateClassNode(s, habit.id, "punch-card").ok).toBe(true);
    // The opening fill crosses first; the flat cadence carries the rest.
    accrueClassDevelopment(s, BALANCE.flowOpeningSeconds, PLAIN);
    for (let i = 1; i < BALANCE.engineerGuaranteedWeaveNth; i++) {
      accrueClassDevelopment(s, BALANCE.flowCadenceSeconds, PLAIN);
    }
    // The nth crossing minted a guaranteed-rare offer: the draft-control
    // branch's quality shape, on the pair's own cadence.
    const woven = s.bankedRolls.at(-1)!;
    expect(woven.special?.kind).toBe("rare");
    // Earlier crossings drew the pool plain.
    expect(s.bankedRolls[0]!.special).toBeUndefined();
  });

  it("respec returns every spent point; experience and level stay (conservation, prestige included)", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    const spentOf = () => Object.values(pair.spent).reduce((sum, r) => sum + r, 0);
    pair.level = 4;
    pair.points = 1;
    pair.spent = { governor: 2, reed: 1 };
    // Conservation reads before the respec: earned = spent + unspent.
    expect(pair.points + spentOf()).toBe(pair.level);
    expect(respecClassTree(s, habit.id).ok).toBe(true);
    expect(pair.points).toBe(4); // 3 spent returned beside the free 1
    expect(pair.spent).toEqual({});
    expect(pair.level).toBe(4);
    // Conservation holds through reallocation and a prestige round-trip.
    pair.spent = { governor: 1 };
    pair.points = 3;
    s.eraEarned = 1e12;
    prestige(s);
    expect(pair.points + spentOf()).toBe(pair.level);
    expect(respecClassTree(s, habit.id).ok).toBe(true);
    expect(pair.points + spentOf()).toBe(pair.level);
  });

  it("presets apply as ordinary allocations within the earned budget and the level prerequisites", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    pair.level = 2;
    pair.points = 2;
    pair.spent = { governor: 1 };
    // The default preset spends the reed rank: its level 3 prerequisite
    // refuses before any budget arithmetic.
    expect(applyClassPreset(s, habit.id, "engineer-default").ok).toBe(false);
    // The budget refuses too: the preset wants three ranks, the pair owns
    // two (its free point plus the governor rank it would replace).
    pair.level = 3;
    pair.points = 1;
    expect(applyClassPreset(s, habit.id, "engineer-default").ok).toBe(false);
    pair.points = 2;
    expect(applyClassPreset(s, habit.id, "engineer-default").ok).toBe(true);
    expect(pair.spent).toEqual({ governor: 2, reed: 1 });
    expect(pair.points).toBe(0);
    // Presets are the same freely adjustable points: apply and re-apply,
    // the balance re-deriving from ranks + free points every time.
    expect(applyClassPreset(s, habit.id, "engineer-cadence").ok).toBe(true); // governor only
    expect(pair.spent).toEqual({ governor: 2 });
    expect(pair.points).toBe(1);
    expect(applyClassPreset(s, habit.id, "engineer-merge").ok).toBe(true);
    expect(pair.spent).toEqual({ reed: 2 });
    expect(pair.points).toBe(1);
    // An unauthored preset refuses, touching nothing.
    expect(applyClassPreset(s, habit.id, "engineer-punch").ok).toBe(false);
    expect(pair.spent).toEqual({ reed: 2 });
  });

  it("the class selection shares the habit lock's refusal surface, pauses included", () => {
    const s = fresh();
    const { habit } = giveHabit(s);
    startSession(s, 600);
    expect(selectHabit(s, null).ok).toBe(false);
    expect(selectHabit(s, null).reason).toBe("The active habit is locked during flow.");
    expect(selectHabitClass(s, habit.id, "engineer").ok).toBe(false);
    expect(selectHabitClass(s, habit.id, "engineer").reason).toBe("The active class is locked during flow.");
    pauseSession(s);
    // The lock holds through the pause — between sessions means between.
    expect(selectHabit(s, null).ok).toBe(false);
    expect(selectHabitClass(s, habit.id, "engineer").ok).toBe(false);
    expect(allocateClassNode(s, habit.id, "governor").ok).toBe(false);
    expect(respecClassTree(s, habit.id).ok).toBe(false);
    expect(applyClassPreset(s, habit.id, "engineer-default").ok).toBe(false);
    resumeSession(s);
    endSession(s);
    expect(selectHabitClass(s, habit.id, "engineer").ok).toBe(true);
  });

  it("the class layer round-trips the save", () => {
    const s = fresh();
    const { habit, pair } = giveHabit(s);
    pair.experience = BALANCE.engineerLevelThresholds[2]!;
    pair.level = 3;
    pair.points = 1;
    pair.spent = { reed: 2 };
    pair.rollMeter = { progress: 420, earned: 5 };
    const loaded = deserialize(serialize(s, 1_000)).state!;
    const restored = loaded.habits.find((h) => h.id === habit.id)!.classes.engineer!;
    expect(restored).toMatchObject({ experience: pair.experience, level: 3, points: 1 });
    expect(restored.spent).toEqual({ reed: 2 });
    expect(restored.rollMeter).toEqual({ progress: 420, earned: 5 });
  });

  it("a corrupt class ledger lenient-defaults per pair, clamping past-level ranks", () => {
    const s = fresh();
    giveHabit(s);
    const file = JSON.parse(serialize(s, 1_000));
    file.state.habits[0].classes.engineer = {
      experience: "much",
      level: 2,
      points: 99,
      spent: { governor: 9, ghost: 2 },
      rollMeter: { progress: -5, earned: 2.5 },
    };
    file.state.habits[0].classId = "blacksmith";
    const loaded = deserialize(JSON.stringify(file)).state!;
    const habit = loaded.habits[0]!;
    expect(habit.classId).toBe("engineer"); // unknown wear falls back
    const pair = habit.classes.engineer!;
    expect(pair.experience).toBe(0);
    expect(pair.level).toBe(2);
    // The ghost rank drops, governor clamps to its cap, and the free
    // balance never claims more than the level could have earned past its
    // ranks — corruption can grant no free points.
    expect(pair.spent).toEqual({ governor: 2 });
    expect(pair.points).toBe(0);
    expect(pair.rollMeter).toEqual({ progress: 0, earned: 2 });
  });
});

describe("the first-roll rig reads the pair total (issue #423)", () => {
  // A synthless draw: the category draws land ritual, conduit, spacer —
  // no oscillator anywhere, so an armed rig must supply the additive.
  const SYNTHLESS = [0.9, 0.95, 0.5, 0.9, 0.96, 0.5, 0.9, 0.85, 0.5];

  it("a fresh pair's first crossing is the rigged one; the second pair's is not", () => {
    const s = fresh();
    giveHabit(s);
    accrueClassDevelopment(s, BALANCE.flowOpeningSeconds, stubRng(SYNTHLESS));
    expect(s.bankedRolls[0]!.candidates.some((c) => c.type === "additive")).toBe(true);
    // The total earned is past one: the same synthless draw stands unrigged
    // for the next pair's own first crossing.
    const second = giveHabit(s, "Cooking");
    accrueClassDevelopment(s, BALANCE.flowOpeningSeconds, stubRng(SYNTHLESS));
    expect(second.pair.rollMeter.earned).toBe(1);
    expect(s.bankedRolls[1]!.candidates.some((c) => c.type === "additive")).toBe(false);
  });
});

// ── The goal-fuel budget (issue #423) ─────────────────────────────────

describe("the goal-fuel budget", () => {
  it("accrues only from credited practice legs — manual logs feed nothing", () => {
    const s = fresh();
    const { habit } = giveHabit(s);
    accrueGoalFuel(s, 600);
    expect(s.goalFuel).toBeCloseTo(600 * BALANCE.goalFuelPerCreditedSecond, 9);
    addPracticeLog(s, habit.id, 60, 1_000);
    expect(s.goalFuel).toBeCloseTo(600 * BALANCE.goalFuelPerCreditedSecond, 9);
  });

  it("completions draw the pool down without going negative", () => {
    const s = fresh();
    const { habit } = giveHabit(s);
    const gen = give(s, "goalKeyed", null);
    createGoal(s, { habitId: habit.id, minutes: 1, schedule: "once", now: 1 });
    // No credited time, no fuel: the completion draws nothing and the
    // pool never reads a debt.
    accrueGoalProgress(s, habit.id, 60);
    expect(s.goals[0]!.completed).toBe(true);
    expect(gen.reserve).toBe(0);
    expect(s.goalFuel).toBe(0);
    // A partial budget pays its share, and the pool floors at zero.
    accrueGoalFuel(s, 300); // 30 fuel
    createGoal(s, { habitId: habit.id, minutes: 1, schedule: "once", now: 2 });
    accrueGoalProgress(s, habit.id, 60);
    // Desired: 5 × 0.1 × 60 = 30 — exactly the pool; it drains to zero.
    expect(gen.reserve).toBeCloseTo(30, 6);
    expect(s.goalFuel).toBeCloseTo(0, 9);
  });

  it("the budget invariant: any rearrangement of goals over a fixed credited-time budget banks no more than the rate allows", () => {
    const credited = 3600;
    const budget = credited * BALANCE.goalFuelPerCreditedSecond;
    const arrangements: number[][] = [
      [60],
      [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      [20, 20, 20],
    ];
    for (const minutes of arrangements) {
      const s = fresh();
      const { habit } = giveHabit(s);
      give(s, "goalKeyed", null);
      give(s, "goalKeyed", null);
      for (let i = 0; i < minutes.length; i++) {
        createGoal(s, { habitId: habit.id, minutes: minutes[i]!, schedule: "once", now: i + 1 });
      }
      // The credited time lands whole; every qualifying completion draws
      // as it lands, and the seam scales the draws the pool cannot cover.
      accrueGoalFuel(s, credited);
      accrueGoalProgress(s, habit.id, credited);
      const banked = s.modules.reduce((total, module) => total + module.reserve, 0);
      expect(banked, minutes.join("/")).toBeLessThanOrEqual(budget + 1e-6);
    }
  });

  it("the drawdown lives at the credit seam: creditGoalEarning scales the whole board by one share", () => {
    const s = fresh();
    const board = give(s, "goalKeyed", null);
    const tray = give(s, "goalKeyed", null);
    s.goalFuel = 300;
    creditGoalEarning(s, 1200, 1);
    // Desired: 5 × 0.1 × 1200 = 600 per copy — 1200 total. Fuel 300 pays
    // its exact share (scale 0.25): 150 per copy, pool at zero.
    expect(board.reserve).toBeCloseTo(150, 6);
    expect(tray.reserve).toBeCloseTo(150, 6);
    expect(s.goalFuel).toBe(0);
  });
});
