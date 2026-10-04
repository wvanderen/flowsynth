import { BALANCE, EPS } from "./constants";
import { creditOwnedGenerators } from "./reserves";
import type { Goal, GoalCondition, GoalSchedule, GameState } from "./types";
export type { Goal, GoalCondition, GoalSchedule };

// Goals (issue #6). A goal tracks a practice condition ("Piano, 20 minutes
// a day") in a limited slot. Progress accrues only while the goal is active
// — earlier practice never counts retroactively. Completions grant nothing
// themselves — goal templates are conditions only (ADR-0012) — but the
// completion tick is the fact each owned Goal Generator reads, banking its
// reserve a multiple of the focus equivalent (ADR-0047). Daily and weekly
// goals reset at the local calendar boundary; one-time goals keep their
// slot until replaced in upgrade mode. Slot capacity grows only through the
// console long goal (issue #42): one more slot per purchase, bought in the
// Goals panel.

export function goalCapacity(state: GameState): number {
  return BALANCE.goalBaseSlots + state.goalCapacityBought;
}

export function goalRequiredSeconds(goal: Goal): number {
  return goal.condition.minutes * 60;
}

// The tracker's rolled-up state (issue #149): no tracked goals, work in
// progress (at least one incomplete current occurrence), or every current
// occurrence complete. A recurring reset rolls completed goals back to open.
export type GoalTrackerState = "none" | "open" | "complete";

export function goalTrackerState(state: GameState): GoalTrackerState {
  if (state.goals.length === 0) return "none";
  return state.goals.some((g) => !g.completed) ? "open" : "complete";
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
// boundary. Cheap and idempotent; call with the real clock from ticks and
// session events.
export function rollGoalOccurrences(state: GameState, now: number): void {
  for (const goal of state.goals) {
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

// Load-time normalization for the goal's live-share surface (ADR-0047): a
// goal saved before the generators wave carries no live slice —
// lenient-defaulted to 0, the honest reading (the completion's live share
// would read 0, banking nothing) and exactly what a fresh shape writes.
// Mutates in place over the merged state's goal list.
export function normalizeGoals(goals: Goal[]): void {
  for (const goal of goals) {
    if (!goal || typeof goal !== "object") continue;
    if (typeof goal.liveSeconds !== "number" || !Number.isFinite(goal.liveSeconds)) goal.liveSeconds = 0;
  }
}

// The Goal Generator's completion credit (ADR-0047): completing a goal of
// M minutes banks k × the focus equivalent (chargeWindowFraction × M)
// into every owned Goal Generator, board or tray alike — prorated by the
// live share of the goal's progress, so manual-only completions bank
// nothing (the honesty boundary) and mixed practice banks its live share.
// Recurring goals credit once per occurrence — this fires at the
// completion tick, and the occurrence reset re-opens the goal — and
// overlapping completions each credit. No size floor: goal slots and the
// practice itself keep farming self-limiting.
function creditGoalGenerators(state: GameState, goal: Goal): void {
  if (goal.progressSeconds <= EPS || goal.liveSeconds <= EPS) return;
  creditOwnedGenerators(
    state,
    "goalKeyed",
    BALANCE.goalReserveMultiple * BALANCE.chargeWindowFraction * goal.condition.minutes * 60 * (goal.liveSeconds / goal.progressSeconds),
  );
}

// Accrues qualifying practice and completes goals. Unstructured practice
// (habitId null) counts toward any-habit goals; specific-habit goals only
// accrue from their habit. The `source` splits the honesty boundary
// (ADR-0047): "live" is credited present, trusted, and honesty-credited
// time (the advance and reconciliation paths); "manual" is a player
// practice log, which advances the condition but never joins the live
// slice. Returns the number of occurrences completed. While a session is
// live, every credited second is also ledged onto the session's own
// advancement map (§9), snapshotting into the record at close — manual
// logs never pass through here with a session live, so they never join
// the snapshot.
export function accrueGoalProgress(state: GameState, habitId: string | null, seconds: number, source: "live" | "manual" = "live"): number {
  if (seconds <= EPS) return 0;
  let completions = 0;
  for (const goal of state.goals) {
    if (goal.completed) continue;
    if (goal.condition.kind !== "habit-minutes") continue;
    if (goal.condition.habitId !== null && goal.condition.habitId !== habitId) continue;
    goal.progressSeconds += seconds;
    if (source === "live") goal.liveSeconds += seconds;
    const session = state.session;
    if (session) session.goalSeconds[goal.id] = (session.goalSeconds[goal.id] ?? 0) + seconds;
    if (goal.progressSeconds >= goalRequiredSeconds(goal)) {
      goal.completed = true;
      goal.completedCount++;
      completions++;
      creditGoalGenerators(state, goal);
    }
  }
  return completions;
}
