import { EPS } from "./constants";
import { isActive, modulePower } from "./economy";
import type { GameState, ModuleInstance } from "./types";

// Habits (issue #5). A habit names what you are practicing; one may be
// selected as the session's active habit, locked for the session (ADR-0001).
// Development accrues from live flow time and manual practice logs — manual
// logs never produce nous or charge (ADR-0001). The Habit module's primary
// effect is its development-rate multiplier; customization unlocks that
// spend development are deferred.

export interface Habit {
  id: string;
  name: string;
  seconds: number;
  archived: boolean;
}

export interface PracticeEntry {
  id: string;
  habitId: string;
  seconds: number;
  source: "live" | "manual";
  at: number;
}

export function habitModule(state: GameState): ModuleInstance | undefined {
  return state.modules.find((m) => m.type === "habit" && m.pos !== null);
}

export function habitsActive(state: GameState): boolean {
  return isActive(state, habitModule(state)!);
}

export function developmentRate(state: GameState): number {
  const module = habitModule(state);
  if (!module || !isActive(state, module)) return 1;
  return modulePower(module);
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
  const habit: Habit = { id: `h${state.nextId++}`, name: trimmed, seconds: 0, archived: false };
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

export function archiveHabit(state: GameState, id: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Habits are managed between sessions." };
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return { ok: false, reason: "Habit not found." };
  habit.archived = true;
  if (state.activeHabitId === id) state.activeHabitId = null;
  return { ok: true };
}

export function selectHabit(state: GameState, id: string | null): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "The active habit is locked during flow." };
  if (id !== null && !state.habits.some((h) => h.id === id && !h.archived)) {
    return { ok: false, reason: "Habit not found." };
  }
  state.activeHabitId = id;
  return { ok: true };
}

// Manual practice log: advances development (and later goal conditions)
// without producing nous or simulating charge activity.
export function addPracticeLog(state: GameState, habitId: string, minutes: number, now: number = 0): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Practice is logged between sessions." };
  const habit = state.habits.find((h) => h.id === habitId && !h.archived);
  if (!habit) return { ok: false, reason: "Habit not found." };
  if (!(minutes > 0)) return { ok: false, reason: "Log a positive number of minutes." };
  const seconds = minutes * 60 * developmentRate(state);
  habit.seconds += seconds;
  state.practiceLog.push({
    id: `p${state.nextId++}`,
    habitId,
    seconds,
    source: "manual",
    at: now,
  });
  return { ok: true };
}

// Called from advance's step loop: live practice develops the active habit.
export function accrueLivePractice(state: GameState, seconds: number): void {
  if (seconds <= EPS) return;
  const habit = activeHabit(state);
  if (!habit) return;
  habit.seconds += seconds * developmentRate(state);
}

// Called from endSession: one practice-log entry per session for goal
// evaluation. Timestamps come from the caller; tests pass explicit values.
export function logSessionPractice(state: GameState, seconds: number, now: number): void {
  const habit = state.habits.find((h) => h.id === state.activeHabitId);
  if (!habit || seconds <= EPS) return;
  state.practiceLog.push({
    id: `p${state.nextId++}`,
    habitId: habit.id,
    seconds: seconds * developmentRate(state),
    source: "live",
    at: now,
  });
}
