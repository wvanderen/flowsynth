import { describe, expect, it } from "vitest";
import { assertFocusScenario, createFocusScenarioState, FOCUS_SCENARIO } from "./focus-scenario";
import { BALANCE } from "./constants";
import { classDefOf, pairOf, practiceRollThreshold } from "./classes";
import { activeGoalOf, deleteGoal, rollGoalOccurrences } from "./goals";
import { selectHabit } from "./habits";

// The Focus evidence scenario (issue #456): the builder rebuilds the
// intended preparation state from nothing, the rebuild is exact, and the
// one assertion fails with a named reason when the setup is absent or
// inconsistent.
const T = 1_799_999_040_000;

describe("Focus evidence scenario", () => {
  it("builds the intended habit, goal, and class advancement", () => {
    const state = createFocusScenarioState(T);
    assertFocusScenario(state, T);
    // The constants must reach the level they claim, whatever BALANCE
    // tunes — the builder's figures are load-facts, so this is the one
    // guard that keeps them honest.
    expect(BALANCE.engineerLevelThresholds[FOCUS_SCENARIO.classLevel - 1]!).toBeLessThanOrEqual(FOCUS_SCENARIO.creditedSeconds);
    const habit = state.habits[0]!;
    expect(habit.name).toBe(FOCUS_SCENARIO.habitName);
    expect(habit.color).toBe(FOCUS_SCENARIO.habitColor);
    expect(state.activeHabitId).toBe(habit.id);
    const goal = activeGoalOf(state, habit.id)!;
    expect(goal.condition.minutes).toBe(FOCUS_SCENARIO.goalMinutes);
    expect(goal.schedule).toEqual({ kind: FOCUS_SCENARIO.goalSchedule });
    expect(goal.progressSeconds).toBe(FOCUS_SCENARIO.loggedMinutes * 60);
    expect(goal.liveSeconds).toBe(0);
    expect(goal.completed).toBe(false);
    const pair = pairOf(habit);
    expect(pair.level).toBe(FOCUS_SCENARIO.classLevel);
    expect(pair.experience).toBe(FOCUS_SCENARIO.creditedSeconds);
    const def = classDefOf(habit.classId);
    expect(pair.rollMeter.earned).toBeGreaterThanOrEqual(1);
    expect(pair.rollMeter.progress).toBeGreaterThan(0);
    expect(pair.rollMeter.progress).toBeLessThan(practiceRollThreshold(pair, pair.rollMeter.earned, def));
    expect(state.bankedRolls).toHaveLength(pair.rollMeter.earned);
    expect(state.sessionRecords).toHaveLength(1);
    expect(state.sessionRecords[0]!.habitId).toBe(habit.id);
    expect(state.nous).toBe(BALANCE.openingGrant + FOCUS_SCENARIO.sessionEarnedNous);
  });

  it("rebuilds equivalent state without accumulating grants, habits, goals, or progress", () => {
    expect(createFocusScenarioState(T)).toEqual(createFocusScenarioState(T));
    // A different stamp changes only what the wall clock owns: the goal's
    // occurrence and the recorded session's wall stamps — the setup's
    // shape and figures hold.
    const other = createFocusScenarioState(T + 86_400_000);
    expect(other.habits).toEqual(createFocusScenarioState(T).habits);
    expect(assertFocusScenario(other, T + 86_400_000)).toBeUndefined();
  });

  it("assertions fail clearly when the expected setup is absent or inconsistent", () => {
    const expectWhy = (run: () => void, why: RegExp): void => expect(run).toThrowError(why);
    const renamed = createFocusScenarioState(T);
    renamed.habits[0]!.name = "Sketching";
    expectWhy(() => assertFocusScenario(renamed, T), /expected one live "Piano" habit/);

    const unselected = createFocusScenarioState(T);
    selectHabit(unselected, null);
    expectWhy(() => assertFocusScenario(unselected, T), /selected as the active habit/);

    const noGoal = createFocusScenarioState(T);
    deleteGoal(noGoal, activeGoalOf(noGoal, noGoal.habits[0]!.id)!.id);
    expectWhy(() => assertFocusScenario(noGoal, T), /expected the active goal/);

    const retargeted = createFocusScenarioState(T);
    activeGoalOf(retargeted, retargeted.habits[0]!.id)!.condition.minutes = 30;
    expectWhy(() => assertFocusScenario(retargeted, T), /daily 60-minute goal/);

    const rolled = createFocusScenarioState(T);
    rollGoalOccurrences(rolled, T + 86_400_000);
    expectWhy(() => assertFocusScenario(rolled, T), /today's occurrence/);

    const unearned = createFocusScenarioState(T);
    pairOf(unearned.habits[0]!).level = 2;
    expectWhy(() => assertFocusScenario(unearned, T), /expected Engineer level 3/);

    const unspent = createFocusScenarioState(T);
    pairOf(unspent.habits[0]!).spent = {};
    expectWhy(() => assertFocusScenario(unspent, T), /governor node/);

    const drained = createFocusScenarioState(T);
    pairOf(drained.habits[0]!).rollMeter.progress = 0;
    expectWhy(() => assertFocusScenario(drained, T), /partial practice-roll meter/);

    const shortQueue = createFocusScenarioState(T);
    shortQueue.bankedRolls.pop();
    expectWhy(() => assertFocusScenario(shortQueue, T), /roll queue/);

    const spentNous = createFocusScenarioState(T);
    spentNous.nous -= 1;
    expectWhy(() => assertFocusScenario(spentNous, T), /banked/);

    const missingRecord = createFocusScenarioState(T);
    missingRecord.sessionRecords.pop();
    expectWhy(() => assertFocusScenario(missingRecord, T), /one recorded 1500s session/);
  });
});
