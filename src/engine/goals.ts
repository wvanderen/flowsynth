import { BALANCE, EPS } from "./constants";
import { creditGoalEarning } from "./reserves";
import type { Goal, GoalCondition, GoalSchedule, GameState } from "./types";
export type { Goal, GoalCondition, GoalSchedule };

// Goals (issue #6, as re-owned by issue #423 and narrowed to one per habit
// by issue #445, ADR-0075). A goal tracks a practice condition ("Piano,
// 20 minutes a day") and belongs to ONE habit: only credited practice for
// that habit advances it — unstructured practice advances nothing. Each
// habit owns zero or one active goal, never purchasable; progress accrues
// only while the goal is active — earlier practice never counts
// retroactively. Completions grant nothing themselves — goal templates are
// conditions only (ADR-0012) — but the completion tick is the fact every
// owned generator reads, banking its profile's goal credit on the focus
// equivalent (issue #371) under the bounded fuel budget (below). Daily and
// weekly goals reset at the local calendar boundary; one-time goals keep
// running until edited, replaced, or removed in the habit editor.
//
// The goal-generator fuel budget (issue #423): completions credit
// generators only out of a pool that accrues at
// BALANCE.goalFuelPerCreditedSecond per credited practice second — more
// goals, shorter targets, repeated replacement, cadence changes, and
// migration cannot raise the generator credit the same practice time
// yields. The pool lives on state.goalFuel and draws down inside the one
// credit seam (reserves.creditGoalEarning); it is a rule, never a
// displayed resource.

// A habit's active goal: the one running row — a multi-goal migration's
// unresolved rows are pending (they neither run nor light a read until the
// player retains one) and retired rows are history.
export function activeGoalOf(state: GameState, habitId: string): Goal | undefined {
  return state.goals.find((goal) => !goal.retired && !goal.pendingChoice && goal.condition.habitId === habitId);
}

export function activeGoals(state: GameState): Goal[] {
  return state.goals.filter((goal) => !goal.retired && !goal.pendingChoice && goal.condition.habitId !== null);
}

export function pendingGoalsOf(state: GameState, habitId: string): Goal[] {
  return state.goals.filter((goal) => !goal.retired && goal.pendingChoice === true && goal.condition.habitId === habitId);
}

// The goal-generator fuel's one accrual leg: credited practice seconds
// only, called beside the credited time it budgets (advance's live sink
// and the honesty report's credit). Manual logs and breathers feed
// nothing.
export function accrueGoalFuel(state: GameState, seconds: number): void {
  if (!(seconds > EPS)) return;
  state.goalFuel += BALANCE.goalFuelPerCreditedSecond * seconds;
}

export function goalRequiredSeconds(goal: Goal): number {
  return goal.condition.minutes * 60;
}

// The tracker's rolled-up state (issue #149, scoped by issue #423): the
// selected habit's goal — none tracked, work in progress, or the current
// occurrence complete. With no habit selected nothing is tracked; a
// recurring reset rolls the goal back to open; an unresolved migration
// choice reads as none until a goal is retained.
export type GoalTrackerState = "none" | "open" | "complete";

export function goalTrackerState(state: GameState): GoalTrackerState {
  const habitId = state.activeHabitId;
  if (habitId === null) return "none";
  const goal = activeGoalOf(state, habitId);
  if (!goal) return "none";
  return goal.completed ? "complete" : "open";
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

// The current occurrence's start (issue #445): local midnight for daily,
// the local Monday for weekly, and the goal's own creation for once — the
// period a cadence change recalculates qualifying practice over. The key
// helpers above are the one calendar source; this derives from the same
// local reads.
export function occurrenceStartFor(schedule: GoalSchedule, now: number, createdAt: number): number {
  if (schedule.kind === "once") return createdAt;
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (schedule.kind === "weekly" ? day : 0));
  return start.getTime();
}

// Rolls recurring goals to the current occurrence at the local calendar
// boundary. Cheap and idempotent; call with the real clock from ticks and
// session events.
export function rollGoalOccurrences(state: GameState, now: number): void {
  for (const goal of activeGoals(state)) {
    const key = occurrenceKeyFor(goal.schedule, now);
    if (goal.occurrenceKey !== key) {
      goal.occurrenceKey = key;
      goal.progressSeconds = 0;
      goal.liveSeconds = 0;
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
  // Goals are owned by a habit (issue #423): the cross-habit template
  // retired with the shared slot economy.
  if (input.habitId === null) return { ok: false, reason: "Pick the habit this goal tracks." };
  // One active goal per habit (issue #445): an unresolved migration choice
  // counts — the carried rows stand until the player retains one.
  if (activeGoalOf(state, input.habitId) || pendingGoalsOf(state, input.habitId).length > 0) {
    return { ok: false, reason: "That habit already tracks a goal — edit or remove it first." };
  }
  if (!(input.minutes > 0) || input.minutes > 24 * 60) return { ok: false, reason: "Choose between 1 and 1440 minutes." };
  if (!state.habits.some((h) => h.id === input.habitId && !h.archived)) {
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
    liveSeconds: 0,
    completed: false,
    completedCount: 0,
    createdAt: input.now,
  };
  state.goals.push(goal);
  return { ok: true, goal };
}

export function deleteGoal(state: GameState, id: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Goals are managed between sessions." };
  const index = state.goals.findIndex((g) => !g.retired && !g.pendingChoice && g.id === id);
  if (index === -1) return { ok: false, reason: "Goal not found." };
  state.goals.splice(index, 1);
  return { ok: true };
}

// The goal's edit (issue #445), the one path the habit editor's form
// lands through — a target change and a cadence change in one move.
// Upgrade mode only, like every goal mutation. A target change retains
// qualifying practice: progressSeconds stands, and the goal only
// un-completes when the raised target is no longer met (a target lowered
// to or below met progress stays completed — the completion already
// happened, and no credit can replay). A cadence change recalculates
// qualifying practice for the new period: credited practice — live
// sessions alone, the manual boundary stands — since the new schedule's
// current occurrence began, with the occurrence rolled to its key.
// Nothing here awards or replays generator fuel: credit fires only on
// completion ticks on the accrual paths, against the one bounded pool.
export function editGoal(
  state: GameState,
  id: string,
  edit: { minutes: number; schedule: GoalSchedule["kind"] },
  now: number,
): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Goals are managed between sessions." };
  const goal = activeGoals(state).find((g) => g.id === id);
  if (!goal) return { ok: false, reason: "Goal not found." };
  if (!(edit.minutes > 0) || edit.minutes > 24 * 60) return { ok: false, reason: "Choose between 1 and 1440 minutes." };
  const schedule: GoalSchedule =
    edit.schedule === "daily" ? { kind: "daily" } : edit.schedule === "weekly" ? { kind: "weekly" } : { kind: "once" };
  goal.condition.minutes = Math.round(edit.minutes);
  if (schedule.kind === goal.schedule.kind) {
    goal.schedule = schedule;
    goal.completed = goal.progressSeconds >= goalRequiredSeconds(goal);
    return { ok: true };
  }
  // Cadence change: recalculate from qualifying practice in the new
  // period. Credited eligibility only — the practice log's live entries
  // are the sessions the goal could have ridden; manual logs never join.
  goal.schedule = schedule;
  goal.occurrenceKey = occurrenceKeyFor(schedule, now);
  const start = occurrenceStartFor(schedule, now, goal.createdAt);
  const qualifying = state.practiceLog
    .filter((entry) => entry.habitId === goal.condition.habitId && entry.source === "live" && entry.at >= start)
    .reduce((sum, entry) => sum + entry.seconds, 0);
  goal.progressSeconds = qualifying;
  // The reconstructed progress is credited practice through and through,
  // so the live slice is the whole of it.
  goal.liveSeconds = qualifying;
  goal.completed = qualifying >= goalRequiredSeconds(goal);
  return { ok: true };
}

// The migration choice's landing (issue #445): the player retains one
// carried-over row and its pending siblings retire to history, records
// intact. The retained row keeps its condition, progress, and completion
// facts exactly as carried — nothing is reinterpreted, and no completion
// fires here, so no generator fuel can move at choice time.
export function retainGoalChoice(state: GameState, id: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Goals are managed between sessions." };
  const goal = state.goals.find((g) => g.pendingChoice === true && g.id === id);
  if (!goal || goal.condition.habitId === null) return { ok: false, reason: "Goal not found." };
  for (const pending of pendingGoalsOf(state, goal.condition.habitId)) {
    if (pending.id === id) delete pending.pendingChoice;
    else {
      pending.retired = true;
      delete pending.pendingChoice;
    }
  }
  return { ok: true };
}

const SCHEDULE_LABEL: Record<GoalSchedule["kind"], string> = { once: "once", daily: "a day", weekly: "a week" };

export function goalSummary(state: GameState, goal: Goal): string {
  const name = goal.condition.habitId === null ? "Any habit" : state.habits.find((h) => h.id === goal.condition.habitId)?.name ?? "a habit";
  return `${name} · ${goal.condition.minutes} min ${SCHEDULE_LABEL[goal.schedule.kind]}`;
}

// Load-time normalization for the goal's live-share surface (ADR-0047): a
// goal saved before the generators wave carries no live slice —
// lenient-defaulted to 0, the honest reading (the completion's live share
// would read 0, banking nothing) and exactly what a fresh shape writes.
// The per-goal palette key (issue #312) retired with the GOALS face
// (issue #445): the color rides the habit now, and a save's key drops
// after the migration has read it. Mutates in place over the merged
// state's goal list.
export function normalizeGoals(goals: Goal[]): void {
  for (const goal of goals) {
    if (!goal || typeof goal !== "object") continue;
    if (goal.retired !== true) delete goal.retired;
    if (goal.pendingChoice !== true) delete goal.pendingChoice;
    if (typeof goal.liveSeconds !== "number" || !Number.isFinite(goal.liveSeconds)) goal.liveSeconds = 0;
    delete (goal as unknown as Record<string, unknown>).color;
  }
}

// The completion tick's credit (ADR-0047, generalized by issue #371,
// budgeted by issue #423): completing a goal of M minutes banks the focus
// equivalent (the Flywheel's focus rate × M) × the live share of the
// goal's progress into every owned generator at its profile's goal
// coefficient — manual-only completions bank nothing (the honesty
// boundary) and mixed practice banks its live share. The draw lands
// inside the one credit seam (reserves.creditGoalEarning) against the
// goalFuel pool, so a completion can never credit more than the credited
// practice time it rode on has budgeted. Recurring goals credit once per
// occurrence — this fires at the completion tick, and the occurrence
// reset re-opens the goal — and overlapping completions each credit.
function creditGoalGenerators(state: GameState, goal: Goal): void {
  if (goal.progressSeconds <= EPS || goal.liveSeconds <= EPS) return;
  creditGoalEarning(state, goal.progressSeconds, goal.liveSeconds / goal.progressSeconds);
}

function acceptsPractice(goal: Goal, habitId: string | null): boolean {
  // Goals are habit-owned (issue #423): only their own habit's credited
  // practice advances them. The cross-habit template (habitId null)
  // retired — a migrated save may still carry one until the conversion
  // retires it, and it never accrues again.
  return !goal.completed && goal.condition.kind === "habit-minutes"
    && goal.condition.habitId !== null && goal.condition.habitId === habitId;
}

// Live advancement must stop at the next completion: its credit can change
// generator output for the rest of the span. Provisional time never calls
// this seam because it does not advance goals until reconciliation.
export function secondsUntilGoalCompletion(state: GameState, habitId: string | null): number {
  let earliest = Infinity;
  for (const goal of activeGoals(state)) {
    if (!acceptsPractice(goal, habitId)) continue;
    const remaining = goalRequiredSeconds(goal) - goal.progressSeconds;
    if (remaining > EPS) earliest = Math.min(earliest, remaining);
  }
  return earliest;
}

// Accrues qualifying practice and completes goals. Practice advances only
// its own habit's goal (issue #423; one per habit since issue #445) —
// unstructured practice (habitId null) advances nothing, and an unresolved
// migration choice leaves nothing to advance. The `source` splits the
// honesty boundary (ADR-0047): "live" is credited present, trusted, and
// honesty-credited time (the advance and reconciliation paths); "manual"
// is a player practice log, which advances the condition but never joins
// the live slice. Returns the number of occurrences completed. While a
// session is live, every credited second is also ledged onto the session's
// own advancement map (§9), snapshotting into the record at close — manual
// logs never pass through here with a session live, so they never join
// the snapshot.
export function accrueGoalProgress(state: GameState, habitId: string | null, seconds: number, source: "live" | "manual" = "live"): number {
  if (seconds <= EPS) return 0;
  let completions = 0;
  for (const goal of activeGoals(state)) {
    if (!acceptsPractice(goal, habitId)) continue;
    // Only practice up to completion belongs to this occurrence. Excess
    // time still counts as practice, but cannot change its live share.
    const qualifying = Math.min(seconds, Math.max(0, goalRequiredSeconds(goal) - goal.progressSeconds));
    goal.progressSeconds += qualifying;
    if (source === "live") goal.liveSeconds += qualifying;
    const session = state.session;
    if (session) session.goalSeconds[goal.id] = (session.goalSeconds[goal.id] ?? 0) + qualifying;
    if (goal.progressSeconds >= goalRequiredSeconds(goal)) {
      goal.completed = true;
      goal.completedCount++;
      completions++;
      creditGoalGenerators(state, goal);
    }
  }
  return completions;
}
