import { describe, expect, it } from "vitest";
import { assertFocusScenario, createFocusScenarioState, FOCUS_SCENARIO } from "./focus-scenario";
import { BALANCE } from "./constants";
import { classDefOf, pairOf, practiceRollThreshold } from "./classes";
import { activeGoalOf, deleteGoal } from "./goals";
import { selectHabit } from "./habits";

// The Focus evidence scenario (issue #456): the builder rebuilds the
// intended preparation state from nothing, the rebuild is exact, and the
// one assertion fails with a named reason when the setup is absent or
// inconsistent.
const T = 1_799_999_040_000;

describe("Focus evidence scenario", () => {
  it("builds the intended habit, goal, and class advancement", () => {
    const state = createFocusScenarioState(T);
    assertFocusScenario(state);
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
  });

  it("rebuilds equivalent state without accumulating grants, habits, goals, or progress", () => {
    expect(createFocusScenarioState(T)).toEqual(createFocusScenarioState(T));
    // A different stamp changes only what the wall clock owns: the goal's
    // occurrence and the recorded session's wall stamps — the setup's
    // shape and figures hold.
    const other = createFocusScenarioState(T + 86_400_000);
    expect(other.habits).toEqual(createFocusScenarioState(T).habits);
    expect(assertFocusScenario(other)).toBeUndefined();
  });

  it("assertions fail clearly when the expected setup is absent or inconsistent", () => {
    const expectWhy = (run: () => void, why: RegExp): void => expect(run).toThrowError(why);
    const renamed = createFocusScenarioState(T);
    renamed.habits[0]!.name = "Sketching";
    expectWhy(() => assertFocusScenario(renamed), /expected one live "Piano" habit/);

    const unselected = createFocusScenarioState(T);
    selectHabit(unselected, null);
    expectWhy(() => assertFocusScenario(unselected), /selected as the active habit/);

    const noGoal = createFocusScenarioState(T);
    deleteGoal(noGoal, activeGoalOf(noGoal, noGoal.habits[0]!.id)!.id);
    expectWhy(() => assertFocusScenario(noGoal), /expected the active goal/);

    const retargeted = createFocusScenarioState(T);
    activeGoalOf(retargeted, retargeted.habits[0]!.id)!.condition.minutes = 30;
    expectWhy(() => assertFocusScenario(retargeted), /daily 60-minute goal/);

    const unearned = createFocusScenarioState(T);
    pairOf(unearned.habits[0]!).level = 2;
    expectWhy(() => assertFocusScenario(unearned), /expected Engineer level 3/);

    const unspent = createFocusScenarioState(T);
    pairOf(unspent.habits[0]!).spent = {};
    expectWhy(() => assertFocusScenario(unspent), /governor node/);

    const drained = createFocusScenarioState(T);
    pairOf(drained.habits[0]!).rollMeter.progress = 0;
    expectWhy(() => assertFocusScenario(drained), /partial practice-roll meter/);

    const shortQueue = createFocusScenarioState(T);
    shortQueue.bankedRolls.pop();
    expectWhy(() => assertFocusScenario(shortQueue), /roll queue/);

    const missingRecord = createFocusScenarioState(T);
    missingRecord.sessionRecords.pop();
    expectWhy(() => assertFocusScenario(missingRecord), /one recorded 1500s session/);

    const driftingBalance = BALANCE.engineerLevelThresholds;
    expect(driftingBalance[FOCUS_SCENARIO.classLevel - 1]!).toBeLessThanOrEqual(FOCUS_SCENARIO.creditedSeconds);
  });
});
