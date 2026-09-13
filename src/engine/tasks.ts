import { EPS } from "./constants";
import { isActive, modulePower } from "./economy";
import type { GameState, ModuleInstance, Task, TaskSize } from "./types";

export type { Task, TaskSize };

// Tasks (issue #7, ADR-0005). Capture is unrestricted and available any
// time. A few player-estimated sizes draw from one player-wide allowance
// earned by live flow time only. Completing a task records immediately;
// its nous reward pays in completion order, fully or not at all — an
// underfunded reward waits as pending and is never lost. Nous granted mid-
// flow is effectively banked: it cannot be spent until upgrade mode.

export function taskModule(state: GameState): ModuleInstance | undefined {
  return state.modules.find((m) => m.type === "tasks" && m.pos !== null);
}

export function tasksActive(state: GameState): boolean {
  return state.tasksActive && taskModule(state) !== undefined;
}

export function taskCost(size: TaskSize): number {
  return { small: 3, medium: 8, large: 15 }[size];
}

export function taskReward(size: TaskSize): number {
  return { small: 3, medium: 8, large: 15 }[size];
}

// Allowance accrual rate in points per live-flow minute, scaled by the
// module's level and rarity (its primary effect).
export function allowanceRate(state: GameState): number {
  const module = taskModule(state);
  if (!module || !isActive(state, module)) return 0;
  return modulePower(module);
}

export function createTask(state: GameState, text: string, size: TaskSize): { ok: boolean; reason?: string } {
  if (!tasksActive(state)) return { ok: false, reason: "The Tasks module is not active yet." };
  const trimmed = text.trim().slice(0, 120);
  if (!trimmed) return { ok: false, reason: "Describe the task first." };
  state.tasks.push({ id: `t${state.nextId++}`, text: trimmed, size, done: false, paid: false, completionOrder: null });
  return { ok: true };
}

export function completeTask(state: GameState, id: string): { ok: boolean; reason?: string; paid?: boolean } {
  if (!tasksActive(state)) return { ok: false, reason: "The Tasks module is not active yet." };
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return { ok: false, reason: "Task not found." };
  if (task.done) return { ok: false, reason: "Already completed." };
  task.done = true;
  task.completionOrder = state.taskCompletionCounter++;
  settlePendingRewards(state);
  return { ok: true, paid: task.paid };
}

// Pays pending rewards in completion order: fully or not at all.
export function settlePendingRewards(state: GameState): number {
  const pending = state.tasks.filter((t) => t.done && !t.paid).sort((a, b) => (a.completionOrder ?? 0) - (b.completionOrder ?? 0));
  let paid = 0;
  for (const task of pending) {
    const cost = taskCost(task.size);
    if (state.allowance + EPS < cost) break;
    state.allowance -= cost;
    state.nous += taskReward(task.size);
    state.totalEarned += taskReward(task.size);
    task.paid = true;
    paid++;
  }
  return paid;
}

// Called from advance's step loop: live flow time earns allowance, and any
// newly fundable pending rewards pay out immediately.
export function accrueTaskAllowance(state: GameState, seconds: number): number {
  if (!tasksActive(state) || seconds <= EPS) return 0;
  state.allowance += (seconds / 60) * allowanceRate(state);
  return settlePendingRewards(state);
}
