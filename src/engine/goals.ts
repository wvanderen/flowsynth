import { BALANCE, EPS } from "./constants";
import { creditGoalEarning } from "./reserves";
import type { Goal, GoalColor, GoalCondition, GoalSchedule, GameState } from "./types";
export type { Goal, GoalColor, GoalCondition, GoalSchedule };

// The six-token palette (issue #312), vermillion default. The choice is
// made once — at creation or the row's re-pick on the GOALS face — and
// read from goal state everywhere after; there is no legend and no second
// place to set it.
export const GOAL_COLORS: readonly GoalColor[] = ["vermillion", "amber", "green", "cyan", "indigo", "violet"];
export const DEFAULT_GOAL_COLOR: GoalColor = "vermillion";

// The one lenient spelling: an absent or unknown key reads as the default,
// never a made-up token — the same answer at creation, at a re-pick, and
// at load.
export function normalizeGoalColor(color: unknown): GoalColor {
  return typeof color === "string" && (GOAL_COLORS as readonly string[]).includes(color) ? (color as GoalColor) : DEFAULT_GOAL_COLOR;
}

// Goals (issue #6, as re-owned by issue #423). A goal tracks a practice
// condition ("Piano, 20 minutes a day") and belongs to ONE habit: only the
// selected habit's goals display, and only credited practice for that
// habit advances them — unstructured practice advances no goals. The
// shared slot economy and its Channel Strips purchase retire with the
// World experiment (ADR-0074): each habit owns a small fixed capacity
// (BALANCE.habitGoalSlots), never purchasable. Progress accrues only
// while the goal is active — earlier practice never counts retroactively.
// Completions grant nothing themselves — goal templates are conditions
// only (ADR-0012) — but the completion tick is the fact every owned
// generator reads, banking its profile's goal credit on the focus
// equivalent (issue #371) under the bounded fuel budget (below). Daily and
// weekly goals reset at the local calendar boundary; one-time goals keep
// their slot until replaced in upgrade mode.
//
// The goal-generator fuel budget (issue #423): completions credit
// generators only out of a pool that accrues at
// BALANCE.goalFuelPerCreditedSecond per credited practice second — more
// goals, shorter targets, and repeated replacement cannot raise the
// generator credit the same practice time yields. The pool lives on
// state.goalFuel and draws down inside the one credit seam
// (reserves.creditGoalEarning); it is a rule, never a displayed resource.

export function activeGoals(state: GameState): Goal[] {
  return state.goals.filter((goal) => !goal.retired && goal.condition.habitId !== null);
}

export function goalCapacity(): number {
  return BALANCE.habitGoalSlots;
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
// selected habit's goals — none tracked, work in progress (at least one
// incomplete current occurrence), or every current occurrence complete.
// With no habit selected nothing is tracked; a recurring reset rolls
// completed goals back to open. Cross-habit goals retired by the
// experiment never qualify.
export type GoalTrackerState = "none" | "open" | "complete";

export function goalTrackerState(state: GameState): GoalTrackerState {
  const habitId = state.activeHabitId;
  if (habitId === null) return "none";
  const own = activeGoals(state).filter((g) => g.condition.habitId === habitId);
  if (own.length === 0) return "none";
  return own.some((g) => !g.completed) ? "open" : "complete";
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
  color?: GoalColor;
}

export function createGoal(state: GameState, input: GoalCreateInput): { ok: boolean; reason?: string; goal?: Goal } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Goals are managed between sessions." };
  // Goals are owned by a habit (issue #423): the cross-habit template
  // retired with the shared slot economy.
  if (input.habitId === null) return { ok: false, reason: "Pick the habit this goal tracks." };
  if (activeGoals(state).filter((g) => g.condition.habitId === input.habitId).length >= goalCapacity()) {
    return { ok: false, reason: "No free goal slots — remove a goal first." };
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
    color: normalizeGoalColor(input.color),
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
  const index = state.goals.findIndex((g) => !g.retired && g.id === id);
  if (index === -1) return { ok: false, reason: "Goal not found." };
  state.goals.splice(index, 1);
  return { ok: true };
}

// The palette's edit half (issue #312): the row's re-pick on the GOALS
// face. Same upgrade-mode gate as every other goal mutation; the color key
// must be one of the six.
export function setGoalColor(state: GameState, id: string, color: GoalColor): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Goals are managed between sessions." };
  const goal = activeGoals(state).find((g) => g.id === id);
  if (!goal) return { ok: false, reason: "Goal not found." };
  if (normalizeGoalColor(color) !== color) return { ok: false, reason: "Pick one of the six colors." };
  goal.color = color;
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
// The palette key (issue #312) lenient-defaults the same way: a goal saved
// before the palette wave carries no color, and vermillion is what it
// wore. Mutates in place over the merged state's goal list.
export function normalizeGoals(goals: Goal[]): void {
  for (const goal of goals) {
    if (!goal || typeof goal !== "object") continue;
    if (goal.retired !== true) delete goal.retired;
    if (typeof goal.liveSeconds !== "number" || !Number.isFinite(goal.liveSeconds)) goal.liveSeconds = 0;
    goal.color = normalizeGoalColor(goal.color);
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
// its own habit's goals (issue #423) — unstructured practice (habitId
// null) advances nothing. The `source` splits the honesty boundary
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
