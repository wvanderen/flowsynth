import { BALANCE, EPS } from "./constants";
import type { Goal, GoalCondition, GoalSchedule, GameState } from "./types";
export type { Goal, GoalCondition, GoalSchedule };

// Goals (issue #6). A goal tracks a practice condition ("Piano, 20 minutes
// a day") in a limited slot. Progress accrues only while the goal is active
// — earlier practice never counts retroactively. Completions carry no
// charge: goal templates are conditions only (ADR-0012). Daily and weekly
// goals reset at the local calendar boundary; one-time goals keep their
// slot until replaced in upgrade mode. Slot capacity grows only through the
// console long goal (issue #42): goal capacity, bought in the Goals panel.

export function goalCapacity(state: GameState): number {
  return BALANCE.goalBaseSlots + state.goalCapacityBought * BALANCE.goalSlotsPerLongGoal;
}

export function goalRequiredSeconds(goal: Goal): number {
  return goal.condition.minutes * 60;
}

function localDateKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localWeekKey(now: number): string {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return `${monday.getFullYear()}-W${String(monday.getMonth() + 1).padStart(2, "0")}${String(monday.getDate()).padStart(2, "0")}`;
}

export function occurrenceKeyFor(schedule: GoalSchedule, now: number): string {
  if (schedule.kind === "daily") return localDateKey(now);
  if (schedule.kind === "weekly") return localWeekKey(now);
  return "once";
}

// Rolls recurring goals to the current occurrence at the local calendar
// boundary. Cheap; call with the real clock from ticks and session events.
export function rollGoalOccurrences(state: GameState, now: number): void {
  for (const goal of state.goals) {
    const key = occurrenceKeyFor(goal.schedule, now);
    if (goal.occurrenceKey !== key) {
      goal.occurrenceKey = key;
      goal.progressSeconds = 0;
      goal.completed = false;
    }
  }
}

export interface GoalCreateInput {
  habitId: string | null;
  minutes: number;
  schedule: GoalSchedule["kind"];
  now: number;
}

export function createGoal(state: GameState, input: GoalCreateInput): { ok: boolean; reason?: string; goal?: Goal } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Goals are managed between sessions." };
  if (state.goals.length >= goalCapacity(state)) return { ok: false, reason: "No free goal slots — remove a goal first." };
  if (!(input.minutes > 0) || input.minutes > 24 * 60) return { ok: false, reason: "Choose between 1 and 1440 minutes." };
  if (input.habitId !== null && !state.habits.some((h) => h.id === input.habitId && !h.archived)) {
    return { ok: false, reason: "That habit does not exist." };
  }
  const schedule: GoalSchedule =
    input.schedule === "daily" ? { kind: "daily" } : input.schedule === "weekly" ? { kind: "weekly" } : { kind: "once" };
  const goal: Goal = {
    id: `g${state.nextId++}`,
    condition: { kind: "habit-minutes", habitId: input.habitId, minutes: Math.round(input.minutes) },
    schedule,
    occurrenceKey: occurrenceKeyFor(schedule, input.now),
    progressSeconds: 0,
    completed: false,
    completedCount: 0,
    createdAt: input.now,
  };
  state.goals.push(goal);
  return { ok: true, goal };
}

export function deleteGoal(state: GameState, id: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Goals are managed between sessions." };
  const index = state.goals.findIndex((g) => g.id === id);
  if (index === -1) return { ok: false, reason: "Goal not found." };
  state.goals.splice(index, 1);
  return { ok: true };
}

const SCHEDULE_LABEL: Record<GoalSchedule["kind"], string> = { once: "once", daily: "a day", weekly: "a week" };

export function goalSummary(state: GameState, goal: Goal): string {
  const name = goal.condition.habitId === null ? "Any habit" : state.habits.find((h) => h.id === goal.condition.habitId)?.name ?? "a habit";
  return `${name} · ${goal.condition.minutes} min ${SCHEDULE_LABEL[goal.schedule.kind]}`;
}

// Accrues qualifying practice and completes goals. Unstructured practice
// (habitId null) counts toward any-habit goals; specific-habit goals only
// accrue from their habit. Returns the number of occurrences completed.
export function accrueGoalProgress(state: GameState, habitId: string | null, seconds: number): number {
  if (seconds <= EPS) return 0;
  let completions = 0;
  for (const goal of state.goals) {
    if (goal.completed) continue;
    if (goal.condition.kind !== "habit-minutes") continue;
    if (goal.condition.habitId !== null && goal.condition.habitId !== habitId) continue;
    goal.progressSeconds += seconds;
    if (goal.progressSeconds >= goalRequiredSeconds(goal)) {
      goal.completed = true;
      goal.completedCount++;
      completions++;
    }
  }
  return completions;
}
