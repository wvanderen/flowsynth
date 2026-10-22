import { earnNous } from "./advance";
import { seededRng } from "./capacity-calibration";
import { allocateClassNode, classDefOf, pairOf, practiceRollThreshold, rankOf } from "./classes";
import { BALANCE } from "./constants";
import { addPracticeLog, createHabit, selectHabit, setHabitColor } from "./habits";
import { activeGoalOf, createGoal, occurrenceKeyFor } from "./goals";
import { bankRolls, generateOffer } from "./rolls";
import { createInitialState } from "./state";
import type { GameState } from "./types";

// The Focus evidence scenario (issue #456): one representative
// session-preparation state — a selected habit with time in the seat, its
// daily goal part-way through today's occurrence, Engineer level 3 with a
// spent rank and points to spend, a partially filled practice-roll meter
// whose banked rolls wait in the queue, and one recorded session behind
// it. Development-only: nothing here touches the production game. This
// module is the scenario's one authoritative place — the builder maps any
// prior state onto the intended setup through the real creation seams,
// and the assertion is the check every consumer (the dev helper, the
// capture pass, the suites) runs to confirm it.

export const FOCUS_SCENARIO = {
  habitName: "Piano",
  habitColor: "cyan",
  // Credited seconds the pair has banked: class experience, the
  // practice-roll meter's fill, and the recorded session all read it.
  // Manual logs advance the habit's seat time and goal without touching
  // class figures (ADR-0074), so the habit's seconds run one logged
  // step ahead of the pair's experience by design.
  creditedSeconds: 15 * 3600,
  classLevel: 3,
  classNodeId: "governor",
  goalMinutes: 60,
  goalSchedule: "daily",
  loggedMinutes: 25,
  // The recorded session: this morning's planned 25 minutes on the habit,
  // before the goal existed, fully credited.
  sessionSeconds: 1500,
  sessionEarnedNous: 900,
  // The practice-roll mint draw's fixed seed: the same banked offers on
  // every build, so two installs read identically.
  offerSeed: 20261022,
} as const;

// The dev readout's one-pass summary: the scenario's headline figures.
export function focusScenarioSummary(): string {
  return (
    `focus ✓ ${FOCUS_SCENARIO.habitName} · daily ${FOCUS_SCENARIO.goalMinutes}m · ` +
    `${FOCUS_SCENARIO.loggedMinutes}m logged · Engineer Lv ${FOCUS_SCENARIO.classLevel} · isolated save`
  );
}

// The intended state, rebuilt from nothing every call: arbitrary prior
// development state cannot leak in because nothing is read but the
// constants above. Timestamps derive from `now`, so a fixed stamp
// reproduces the build byte-for-byte and a live stamp lands the goal in
// the current occurrence.
export function createFocusScenarioState(now: number = Date.now()): GameState {
  const state = createInitialState();
  const habit = createHabit(state, FOCUS_SCENARIO.habitName).habit!;
  setHabitColor(state, habit.id, FOCUS_SCENARIO.habitColor);
  selectHabit(state, habit.id);

  // Class advancement: the pair's credited-practice figures written as
  // the scenario's constants — accrueClassDevelopment stays credited
  // time's one seam, so a dev fixture mints no development through it.
  // Experience, level, and the earned points are load-facts here exactly
  // as normalizeHabitClasses treats them at load; the one spent rank
  // rides the real allocation action, and the meter's crossings ride the
  // real banking leg so the pair's meter and the shared roll queue agree
  // (the Reed ranks are unspent, so the pair's mint is the plain offer
  // draw).
  const pair = pairOf(habit);
  pair.experience = FOCUS_SCENARIO.creditedSeconds;
  pair.level = FOCUS_SCENARIO.classLevel;
  pair.points = FOCUS_SCENARIO.classLevel;
  allocateClassNode(state, habit.id, FOCUS_SCENARIO.classNodeId);
  const def = classDefOf(habit.classId);
  bankRolls(
    pair.rollMeter,
    "flow",
    FOCUS_SCENARIO.creditedSeconds,
    (earned) => practiceRollThreshold(pair, earned, def),
    state,
    seededRng(FOCUS_SCENARIO.offerSeed),
    state.bankedRolls,
    (s, rng) => generateOffer(s, rng),
  );

  // The recorded session behind the preparation, and the nous it banked.
  // The credited seat time lands first; the manual log below adds its own
  // step, so the habit runs one logged step ahead of the pair.
  habit.seconds = FOCUS_SCENARIO.creditedSeconds;
  state.sessionsCompleted = 1;
  state.sessionRecords.push({
    sessionNumber: 1,
    startedAt: now - 45 * 60_000,
    endedAt: now - 20 * 60_000,
    habitId: habit.id,
    mode: "planned",
    plannedTarget: FOCUS_SCENARIO.sessionSeconds,
    creditedSeconds: FOCUS_SCENARIO.sessionSeconds,
    earned: FOCUS_SCENARIO.sessionEarnedNous,
    honestyEvents: [],
    reflection: null,
    goalsAdvanced: [],
    achievements: [],
    breather: null,
  });
  earnNous(state, FOCUS_SCENARIO.sessionEarnedNous);

  // The goal and today's manual logs: created at `now` so the occurrence
  // is the current day, then advanced by the log — manual minutes join
  // the goal and the seat time, never the live slice or the class pair.
  createGoal(state, {
    habitId: habit.id,
    minutes: FOCUS_SCENARIO.goalMinutes,
    schedule: FOCUS_SCENARIO.goalSchedule,
    now,
  });
  addPracticeLog(state, habit.id, FOCUS_SCENARIO.loggedMinutes, now);
  return state;
}

// The intended setup, restated as checks. Every consumer confirms through
// this one function: it fails with a named reason when the expected habit,
// goal, or advancement is absent, and when any figure is inconsistent with
// the scenario — including the ledger agreements the builder guarantees
// (the queue carrying the meter's crossings, the conservation of tree
// points) and the goal living in today's occurrence. `now` anchors that
// occurrence check; the default is the real clock, a fixed stamp serves
// the suites. Runs on the candidate before an install touches anything,
// and on live state whenever a capture pass re-confirms its setup.
export function assertFocusScenario(state: GameState, now: number = Date.now()): void {
  const fail: (why: string) => never = (why) => {
    throw new Error(`Focus scenario: ${why}`);
  };
  const scenario = FOCUS_SCENARIO;
  if (state.mode !== "upgrade") fail(`expected upgrade mode — found ${state.mode}.`);
  const live = state.habits.filter((habit) => !habit.archived);
  if (live.length !== 1 || live[0]!.name !== scenario.habitName) {
    fail(`expected one live "${scenario.habitName}" habit — found ${live.length} (${live.map((h) => h.name).join(", ") || "none"}).`);
  }
  const habit = live[0]!;
  if (habit.color !== scenario.habitColor) {
    fail(`expected "${scenario.habitName}" in the ${scenario.habitColor} palette pick — found ${habit.color}.`);
  }
  if (state.activeHabitId !== habit.id) fail(`expected "${scenario.habitName}" selected as the active habit.`);
  const seatSeconds = scenario.creditedSeconds + scenario.loggedMinutes * 60;
  if (habit.seconds !== seatSeconds) {
    fail(`expected ${seatSeconds}s of seat time on "${scenario.habitName}" — found ${habit.seconds}s.`);
  }

  const goal = activeGoalOf(state, habit.id);
  if (!goal) fail(`expected the active goal on "${scenario.habitName}" — none found.`);
  if (goal.condition.kind !== "habit-minutes" || goal.condition.habitId !== habit.id) {
    fail("expected a habit-minutes goal owned by the scenario habit.");
  }
  if (goal.condition.minutes !== scenario.goalMinutes || goal.schedule.kind !== scenario.goalSchedule) {
    fail(
      `expected the ${scenario.goalSchedule} ${scenario.goalMinutes}-minute goal — found ` +
        `${goal.schedule.kind} ${goal.condition.minutes}-minute.`,
    );
  }
  const today = occurrenceKeyFor(goal.schedule, now);
  if (goal.occurrenceKey !== today) {
    fail(`expected the goal in today's occurrence (${today}) — found ${goal.occurrenceKey}: reinstall the scenario.`);
  }
  if (goal.progressSeconds !== scenario.loggedMinutes * 60) {
    fail(`expected ${scenario.loggedMinutes}m logged toward the goal — found ${goal.progressSeconds}s.`);
  }
  if (goal.completed || goal.completedCount !== 0) {
    fail(`expected the goal open mid-occurrence — completed=${goal.completed}, count=${goal.completedCount}.`);
  }

  const pair = pairOf(habit);
  const def = classDefOf(habit.classId);
  if (pair.level !== scenario.classLevel) {
    fail(`expected ${def.name} level ${scenario.classLevel} — found level ${pair.level}.`);
  }
  if (pair.experience !== scenario.creditedSeconds) {
    fail(`expected ${scenario.creditedSeconds}s of pair experience — found ${pair.experience}s.`);
  }
  const node = def.nodes.find((candidate) => candidate.id === scenario.classNodeId);
  if (!node || rankOf(pair, node) !== 1) {
    fail(`expected rank 1 on the ${scenario.classNodeId} node — found ${node ? rankOf(pair, node) : "no such node"}.`);
  }
  const spentTotal = def.nodes.reduce((sum, candidate) => sum + rankOf(pair, candidate), 0);
  if (pair.points !== pair.level - spentTotal) {
    fail(`expected ${pair.level - spentTotal} unspent tree points — found ${pair.points}.`);
  }
  const threshold = practiceRollThreshold(pair, pair.rollMeter.earned, def);
  if (pair.rollMeter.earned < 1 || pair.rollMeter.progress <= 0 || pair.rollMeter.progress >= threshold) {
    fail(
      `expected a partial practice-roll meter — found ${pair.rollMeter.progress}s into ` +
        `${threshold}s after ${pair.rollMeter.earned} crossings.`,
    );
  }
  if (state.bankedRolls.length !== pair.rollMeter.earned) {
    fail(`expected the roll queue to carry the meter's ${pair.rollMeter.earned} crossings — found ${state.bankedRolls.length}.`);
  }

  if (state.sessionRecords.length !== 1 || state.sessionRecords[0]!.creditedSeconds !== scenario.sessionSeconds) {
    fail(`expected one recorded ${scenario.sessionSeconds}s session — found ${state.sessionRecords.length}.`);
  }
  const record = state.sessionRecords[0]!;
  if (record.habitId !== habit.id || record.earned !== scenario.sessionEarnedNous) {
    fail(`expected the scenario's session (habit ${habit.id}, ${scenario.sessionEarnedNous}ν earned) — found ` +
      `habit ${record.habitId}, ${record.earned}ν.`);
  }
  if (state.sessionsCompleted !== 1 || state.nous !== BALANCE.openingGrant + scenario.sessionEarnedNous) {
    fail(
      `expected one completed session and ${BALANCE.openingGrant + scenario.sessionEarnedNous}ν banked — found ` +
        `${state.sessionsCompleted} and ${state.nous}ν.`,
    );
  }
  if (BALANCE.engineerLevelThresholds[scenario.classLevel - 1]! > scenario.creditedSeconds) {
    fail(`the constants do not reach level ${scenario.classLevel} — raise creditedSeconds.`);
  }
}
