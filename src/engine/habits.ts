import { NumericFault } from "./numeric";
import { EPS } from "./constants";
import { syncAchievements } from "./achievements";
import { createHabitClasses } from "./classes";
import { accrueGoalProgress, rollGoalOccurrences } from "./goals";
import type { GameState, Habit, HabitColor, PracticeEntry } from "./types";

export type { Habit, PracticeEntry };

// Habits (issue #5; class-wearing since issue #423). A habit names what
// you are practicing; one may be selected as the session's active habit,
// locked for the session (ADR-0001). Development accrues from live flow
// time and manual practice logs — manual logs never produce nous or
// charge (ADR-0012's boundary rule). The Habit app is a fixed-function
// console instrument (ADR-0012): no module, no power curve; development
// always advances one-for-one until the console long goals arrive. Every
// habit wears the launch class (Engineer) from creation; its pair's
// progression lives under the habit and never transfers.

// The six-token palette (issue #312, re-owned by the habit with issue
// #445, ADR-0075), vermillion default. The choice is made in the habit
// editor and read from habit state everywhere after — the goal inherits
// it, so there is no legend and no second place to set it.
export const HABIT_COLORS: readonly HabitColor[] = ["vermillion", "amber", "green", "cyan", "indigo", "violet"];
export const DEFAULT_HABIT_COLOR: HabitColor = "vermillion";

// The one lenient spelling: an absent or unknown key reads as the default,
// never a made-up token — the same answer at creation, at a re-pick, and
// at load.
export function normalizeHabitColor(color: unknown): HabitColor {
  return typeof color === "string" && (HABIT_COLORS as readonly string[]).includes(color) ? (color as HabitColor) : DEFAULT_HABIT_COLOR;
}

export function activeHabit(state: GameState): Habit | undefined {
  return state.habits.find((h) => h.id === state.activeHabitId && !h.archived);
}

function cleanName(name: string): string {
  return name.trim().slice(0, 40);
}

export function createHabit(state: GameState, name: string): { ok: boolean; reason?: string; habit?: Habit } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Habits are managed between sessions." };
  const trimmed = cleanName(name);
  if (!trimmed) return { ok: false, reason: "Give the habit a name." };
  const habit: Habit = {
    id: `h${state.nextId++}`,
    name: trimmed,
    seconds: 0,
    archived: false,
    // The palette default (issue #445): the editor's swatches change it.
    color: DEFAULT_HABIT_COLOR,
    // Every habit wears the launch class from creation (issue #423); its
    // Engineer pair starts at zero and accrues only from credited flow.
    classId: "engineer",
    classes: createHabitClasses(),
  };
  state.habits.push(habit);
  return { ok: true, habit };
}

export function renameHabit(state: GameState, id: string, name: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Habits are managed between sessions." };
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return { ok: false, reason: "Habit not found." };
  const trimmed = cleanName(name);
  if (!trimmed) return { ok: false, reason: "Give the habit a name." };
  habit.name = trimmed;
  return { ok: true };
}

// The palette's landing (issue #445): the editor's swatch row re-colors
// the habit — identity alone, never its class — and every goal read
// inherits the pick. Upgrade mode only, like every habit mutation; the
// key must be one of the six.
export function setHabitColor(state: GameState, id: string, color: HabitColor): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Habits are managed between sessions." };
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return { ok: false, reason: "Habit not found." };
  if (normalizeHabitColor(color) !== color) return { ok: false, reason: "Pick one of the six colors." };
  habit.color = color;
  return { ok: true };
}

export function archiveHabit(state: GameState, id: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Habits are managed between sessions." };
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return { ok: false, reason: "Habit not found." };
  habit.archived = true;
  if (state.activeHabitId === id) state.activeHabitId = null;
  return { ok: true };
}

// The session lock (ADR-0001, extended by issue #423): habit selection is
// an upgrade-mode action — the lock holds for the entire session,
// pauses included, and the class selection behind it shares the same
// refusal surface. "Between sessions" is the gate's whole vocabulary.
export function selectHabit(state: GameState, id: string | null): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "The active habit is locked during flow." };
  if (id !== null && !state.habits.some((h) => h.id === id && !h.archived)) {
    return { ok: false, reason: "Habit not found." };
  }
  state.activeHabitId = id;
  return { ok: true };
}

// Manual practice log: advances development and goal conditions without
// producing nous or charge (§2.3).
function applyPracticeLog(
  state: GameState,
  habitId: string,
  minutes: number,
  now: number = 0,
): { ok: boolean; reason?: string; completions?: number; unlocked?: string[] } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Practice is logged between sessions." };
  const habit = state.habits.find((h) => h.id === habitId && !h.archived);
  if (!habit) return { ok: false, reason: "Habit not found." };
  if (!(minutes > 0)) return { ok: false, reason: "Log a positive number of minutes." };
  rollGoalOccurrences(state, now);
  // The manual side of the honesty boundary (ADR-0047): the log advances
  // goal conditions but never joins the live slice the completion
  // credit prorates by.
  const completions = accrueGoalProgress(state, habitId, minutes * 60, "manual");
  habit.seconds += minutes * 60;
  state.practiceLog.push({
    id: `p${state.nextId++}`,
    habitId,
    seconds: minutes * 60,
    source: "manual",
    at: now,
  });
  // The manual-log boundary check (ADR-0015): Off the clock, Time in the seat.
  return { ok: true, completions, unlocked: syncAchievements(state, { now }).map((def) => def.id) };
}

// Called from advance: live practice develops the active habit.
export function accrueLivePractice(state: GameState, seconds: number): void {
  if (seconds <= EPS) return;
  const habit = activeHabit(state);
  if (!habit) return;
  habit.seconds += seconds;
}

// Called from endSession: one practice-log entry per session for goal
// evaluation. Timestamps come from the caller; tests pass explicit values.
export function logSessionPractice(state: GameState, seconds: number, now: number): void {
  const habit = state.habits.find((h) => h.id === state.activeHabitId);
  if (!habit || seconds <= EPS) return;
  state.practiceLog.push({
    id: `p${state.nextId++}`,
    habitId: habit.id,
    seconds,
    source: "live",
    at: now,
  });
}

export function addPracticeLog(
  state: GameState,
  habitId: string,
  minutes: number,
  now: number = 0,
): { ok: boolean; reason?: string; completions?: number; unlocked?: string[] } {
  const pristine = structuredClone(state);
  try {
    return applyPracticeLog(state, habitId, minutes, now);
  } catch (error) {
    if (!(error instanceof NumericFault)) throw error;
    Object.assign(state, pristine);
    return { ok: false, reason: "The generator charge cannot bank safely, so nothing was logged." };
  }
}
