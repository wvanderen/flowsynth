import { horizonReached, pendingClaimOf } from "./accumulator";
import { advance, advanceBreather } from "./advance";
import {
  buyCapacity,
  buyCapacityCeiling,
  buyCapacityDiscount,
  buyCatalogEntry,
  buyCell,
  buyChargeColumn,
  buyHoneRank,
  buyShelfModule,
  chooseMutatorRoll,
  chooseRoll,
  dismissSummary,
  endBreather,
  endSession,
  placeModule,
  placeWorldOccupant,
  prestige,
  startBreather,
  startSession,
  upgradeModuleLevels,
} from "./actions";
import type { ActionResult } from "./actions";
import { frontier, seededRng } from "./capacity-calibration";
import { BALANCE, CATEGORY_OF, isOscillatorType, SAVE_VERSION, SHELF_TYPES, WORLD_ENEMIES } from "./constants";
import { affordableLevels, syncRates, wholeNous, levelsCost } from "./economy";
import { activeGoalOf, createGoal, rollGoalOccurrences } from "./goals";
import { createHabit, selectHabit } from "./habits";
import { adjacent, hexDistance, sameHex } from "./hex";
import { cellNoteOf } from "./lattice";
import { writeNote } from "./notes";
import { SCENARIOS, scenarioOf } from "./scenarios";
import { columnCost, enemyDefAt, enemyDefeated, honeCostOf, worldOccupantAt } from "./world";
import type { GameState, Hex, ModuleInstance, ModuleType, WeaponType } from "./types";

// The reproducible playthrough runner (issues #468/#469, parent #465): a
// recipe declares every behavior-affecting input — starting scenario, seed,
// player policy, practice schedule, time budget, claim target, calendar
// anchor, and the still empty override set — and the runner walks it through
// the real engine actions on a real session schedule: two 25-minute daily
// sessions, a five-minute breather, one practice habit with a daily goal,
// and honest overnight gaps where upgrade mode produces and credits
// nothing. The prompt policy prestiges at the first between-sessions moment
// the horizon is reached; the first-eligibility claim banks zero Arete
// under the frontier curve, and that zero stands rather than being topped
// up. The pushing policy shares the prompt policy's every purchase rule and
// the same schedule, but never prestiges at the first eligibility: it
// pushes until the pending claim reaches its configured target, then
// banks, and its record follows the next era through earned-Arete
// spending, World placement and purchases, and the two recovery measures —
// regaining the first era's pre-reset production and reaching prestige
// eligibility again, each timed on both clocks. Nothing here grants
// resources; an exhausted budget is an explicit incomplete result with the
// last milestone, the bottleneck, and the declined actions' reasons — and
// a missing recovery measure is an explicit unreached mark, never a
// fabricated one. The session loop's prior art is the calibration walk
// (#262) — its seeded rng and frontier/preview patterns are reused, its
// compressed fictional time is not: schedule and day accounting are this
// module's own, and the calibration run remains the economy-only kind this
// record's kind line distinguishes itself from.

// The runner's own version: a behavior-affecting change here is a source
// change, and a rerun against different source identifies separately
// (story 36's foundation).
export const PLAYTHROUGH_RUNNER_VERSION = 5;

// The acceleration step (seconds): production is exact at any step; this
// only coarsens crossing granularity. 60 matches the calibration walk.
const STEP_SECONDS = 60;
const NOTE_TEXT = "keep the shoulders down and the wrist loose through the scale run";
// The level-sweep gesture size — five levels per real action, the prompt
// policy's pinned rule.
const GESTURE_LEVELS = 5;

// The player policies. "prompt" is the readable baseline; "pushing" shares
// its every purchase rule and the same schedule but holds the door for its
// claim target (story 16's push-versus-reset pair).
export interface PlaythroughPolicy {
  readonly id: string;
  readonly name: string;
  // The rules, stated so an investigator can predict the run from them
  // (story 17): explainable, not secretly optimal.
  readonly rules: readonly string[];
}

export const PROMPT_POLICY: PlaythroughPolicy = {
  id: "prompt",
  name: "Prompt prestige",
  rules: [
    "Accept the first oscillator a roll offers, else a generator, else the first candidate; mutator rolls take their first candidate.",
    "Buy every unowned shelf module it can afford — generator, infusor, then forge.",
    "Buy board cells while affordable, nearest first along the compact frontier.",
    "Place every tray module on the vacancy the authoritative preview scores highest.",
    "Buy every affordable Poly Expander, then sweep five-level upgrades over the deployed voices, cheapest first, while the bank covers the next gesture.",
    "Bank the Catalog entry when affordable, then the discount and ceiling offerings.",
    "Attempt World Columns and Hone ranks only once an enemy is discovered, and only while affordable.",
    "Prestige at the first between-sessions moment the horizon is reached.",
    "End every session at its planned target and write a practice note.",
  ],
};

export const PUSHING_POLICY: PlaythroughPolicy = {
  id: "pushing",
  name: "Pushing",
  rules: [
    "Buys exactly what the prompt policy buys, by the same rules, on the same schedule.",
    "Never prestiges at the first eligibility: it pushes until the pending claim reaches its configured target, then banks that claim.",
    "Once the World is entered — a starter weapon granted, a claimed frontier, or a discovered enemy — it pays the Catalog entry first, then Charge Columns while affordable, then Hone ranks cheapest-first while affordable.",
    "Each weapon deploys beside the fight: an owned cell next to a living discovered enemy, preferring a cell that also touches a placed Column, nearest the enemy first; while no enemy lives, the weapon waits in the tray.",
    "Each Column deploys on the charge line: an owned cell next to a deployed generator, preferring a cell that also touches a placed weapon.",
    "Ends every session at its planned target and writes a practice note.",
  ],
};

export const PLAYTHROUGH_POLICIES: readonly PlaythroughPolicy[] = [PROMPT_POLICY, PUSHING_POLICY];

function policyOf(id: string): PlaythroughPolicy {
  return PLAYTHROUGH_POLICIES.find((policy) => policy.id === id) ?? PROMPT_POLICY;
}

// The practice schedule: the session rhythm, the one practice habit and
// its daily goal, and the calendar anchor. Days are the host's local
// calendar — the engine's own goal-occurrence rule — so the anchor is a
// declared epoch stamp and day boundaries follow the game's accounting.
export interface PlaythroughSchedule {
  readonly sessionsPerDay: number;
  readonly sessionMinutes: number;
  readonly breatherMinutes: number;
  readonly habitName: string;
  readonly goalMinutes: number;
  // Day 1, session 1 (epoch ms). Declared, never read off the wall clock:
  // the same recipe builds the same run.
  readonly startAt: number;
  // Engine goal accounting uses the host calendar; reject a different host.
  readonly timeZone: string;
}

// The recipe: every behavior-affecting input in one place (story 11).
export interface PlaythroughRecipe {
  // The starting state: a launchable scenario id — the same catalog the
  // suite launches, the shipped opening included.
  readonly scenarioId: string;
  readonly seed: number;
  readonly policyId: string;
  // The pushing policy's stopping rule (story 19): the pending Arete claim
  // it pushes for before banking — a whole figure above the zero the first
  // eligibility banks. The prompt policy never reads it; it prestiges at
  // the first eligibility whatever the target says.
  readonly claimTarget: number;
  readonly schedule: PlaythroughSchedule;
  // The simulated time budget in days: an unsuccessful policy terminates
  // here with an explicit incomplete result (story 21).
  readonly budgetDays: number;
  // Declared and empty until a ticket supports overrides; any key present
  // is rejected by name so an ineffective experiment cannot look run.
  readonly overrides: Record<string, never>;
}

// The default recipe: two 25-minute daily flow sessions with a
// five-minute breather on one practice — the fixture baseline, not a
// typical-player claim (#465's implementation decisions). The claim target
// defaults to 2 — the first positive claim the frontier curve pays, at the
// World's 1T entry depth.
export function defaultPlaythroughRecipe(): PlaythroughRecipe {
  return {
    scenarioId: "fresh-start",
    seed: 468,
    policyId: PROMPT_POLICY.id,
    claimTarget: 2,
    schedule: {
      sessionsPerDay: 2,
      sessionMinutes: 25,
      breatherMinutes: 5,
      habitName: "Practice",
      goalMinutes: 25,
      startAt: Date.UTC(2026, 0, 5, 9, 0, 0),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    budgetDays: 30,
    overrides: {},
  };
}

export interface PlaythroughRecipeInput {
  scenarioId?: string;
  seed?: number;
  policyId?: string;
  claimTarget?: number;
  schedule?: Partial<PlaythroughSchedule>;
  budgetDays?: number;
}

// The composition seam the app command uses: the default recipe patched by
// an explicit input, validated with named failures. Unknown input keys are
// rejected — an unsupported request never quietly runs a default.
export function composePlaythroughRecipe(input: PlaythroughRecipeInput = {}): PlaythroughRecipe {
  const known = new Set(["scenarioId", "seed", "policyId", "claimTarget", "schedule", "budgetDays"]);
  for (const key of Object.keys(input)) {
    if (!known.has(key)) throw new Error(`Playthrough recipe: unsupported input "${key}".`);
  }
  const base = defaultPlaythroughRecipe();
  const recipe: PlaythroughRecipe = {
    ...base,
    ...(input.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    ...(input.policyId !== undefined ? { policyId: input.policyId } : {}),
    ...(input.claimTarget !== undefined ? { claimTarget: input.claimTarget } : {}),
    ...(input.budgetDays !== undefined ? { budgetDays: input.budgetDays } : {}),
    schedule: { ...base.schedule, ...(input.schedule ?? {}) },
  };
  return validatePlaythroughRecipe(recipe);
}

export function validatePlaythroughRecipe(recipe: PlaythroughRecipe): PlaythroughRecipe {
  const fail = (why: string): never => {
    throw new Error(`Playthrough recipe: ${why}`);
  };
  for (const key of Object.keys(recipe.overrides)) {
    fail(`override "${key}" is not supported yet — the recipe carries no overrides.`);
  }
  if (!scenarioOf(recipe.scenarioId)) {
    fail(`no scenario "${recipe.scenarioId}" — the suite offers ${SCENARIOS.map((s) => s.id).join(", ")}.`);
  }
  if (!PLAYTHROUGH_POLICIES.some((policy) => policy.id === recipe.policyId)) {
    fail(`no policy "${recipe.policyId}" — the suite offers ${PLAYTHROUGH_POLICIES.map((p) => p.id).join(", ")}.`);
  }
  if (!Number.isInteger(recipe.claimTarget) || recipe.claimTarget < 1 || recipe.claimTarget > 36) {
    fail(`claimTarget must be a whole number 1–36 — found ${recipe.claimTarget}.`);
  }
  if (!Number.isInteger(recipe.seed) || recipe.seed < 0 || recipe.seed > 0xffffffff) {
    fail(`seed must be a whole number 0–4294967295 — found ${recipe.seed}.`);
  }
  if (!Number.isInteger(recipe.budgetDays) || recipe.budgetDays < 1 || recipe.budgetDays > 366) {
    fail(`budgetDays must be a whole number 1–366 — found ${recipe.budgetDays}.`);
  }
  const schedule = recipe.schedule;
  if (!Number.isInteger(schedule.sessionsPerDay) || schedule.sessionsPerDay < 1 || schedule.sessionsPerDay > 8) {
    fail(`sessionsPerDay must be a whole number 1–8 — found ${schedule.sessionsPerDay}.`);
  }
  if (!Number.isInteger(schedule.sessionMinutes) || schedule.sessionMinutes < 1 || schedule.sessionMinutes > 600) {
    fail(`sessionMinutes must be a whole number 1–600 — found ${schedule.sessionMinutes}.`);
  }
  if (!Number.isInteger(schedule.breatherMinutes) || schedule.breatherMinutes < 0 || schedule.breatherMinutes > 600) {
    fail(`breatherMinutes must be a whole number 0–600 — found ${schedule.breatherMinutes}.`);
  }
  if (!schedule.habitName || schedule.habitName.length > 40) {
    fail("habitName must be 1–40 characters.");
  }
  if (!Number.isInteger(schedule.goalMinutes) || schedule.goalMinutes < 1 || schedule.goalMinutes > 1440) {
    fail(`goalMinutes must be a whole number 1–1440 — found ${schedule.goalMinutes}.`);
  }
  if (!Number.isFinite(schedule.startAt) || schedule.startAt < 0 || !Number.isFinite(new Date(schedule.startAt).getTime())) {
    fail("startAt must be a finite epoch-millis stamp.");
  }
  if (schedule.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone) {
    fail(`timeZone must match the engine's host calendar (${Intl.DateTimeFormat().resolvedOptions().timeZone}) — found ${schedule.timeZone}.`);
  }
  const dailySpan = schedule.sessionsPerDay * (schedule.sessionMinutes + schedule.breatherMinutes) * 60_000;
  for (let day = 0; day < recipe.budgetDays; day++) {
    const start = sessionStartMs(schedule, day, 0);
    const next = sessionStartMs(schedule, day + 1, 0);
    if (!Number.isFinite(next) || dailySpan > next - start) {
      fail("schedule must fit each calendar day, including declared breathers and daylight-saving transitions.");
    }
  }
  return recipe;
}

// Source provenance (stories 13, 36): what produced the run, so a rerun
// against different source identifies separately, and a representative
// playthrough never masquerades as the economy-only calibration run.
export interface PlaythroughSource {
  readonly game: "flowsynth";
  readonly saveVersion: number;
  readonly runnerVersion: number;
  readonly engineSource: string;
}

// Vite tracks these raw dependencies in dev and embeds the exact engine
// content in builds/tests. Changes to actions, balance, and scenarios all
// change provenance, including during hot reload; test files are excluded.
const engineFiles = import.meta.glob<string>(["./**/*.ts", "!./**/*.test.ts"], {
  query: "?raw", import: "default", eager: true,
});

function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function playthroughSource(): PlaythroughSource {
  const content = JSON.stringify(Object.keys(engineFiles).sort().map((path) => [path, engineFiles[path]]));
  return {
    game: "flowsynth", saveVersion: SAVE_VERSION,
    runnerVersion: PLAYTHROUGH_RUNNER_VERSION, engineSource: fingerprint(content),
  };
}

// Stable identity: the same recipe and source share one run id; a changed
// input or source changes it. A plain FNV-1a keeps the identity free of
// wall-clock stamps and platform hash variance.
export function playthroughRunId(recipe: PlaythroughRecipe, source: PlaythroughSource): string {
  const text = JSON.stringify({ recipe, source });
  return `${recipe.scenarioId}-s${recipe.seed}-${fingerprint(text)}`;
}

// One recorded decision (story 18): the simulated moment, the credited
// practice so far, what was attempted, and the engine's own reason when it
// declined. Milestones flag the run's meaningful steps. `snapshot` indexes
// the record's snapshots — the exact recorded state at this decision's
// simulated moment; the action record owns the reasons, never a copy of
// the board.
export interface PlaythroughEvent {
  // Simulated elapsed seconds since the anchor.
  readonly at: number;
  readonly credited: number;
  readonly kind:
    | "roll"
    | "purchase"
    | "placement"
    | "upgrade"
    | "arete"
    | "world"
    | "session"
    | "breather"
    | "prestige"
    | "milestone";
  readonly label: string;
  readonly ok: boolean;
  readonly reason?: string;
  readonly milestone?: boolean;
  readonly snapshot: number;
}

// One sample of the run's shape: simulated elapsed against credited
// practice, with the board's rates and balances at that moment (story 26).
// `snapshot` indexes the exact recorded state behind the plotted point —
// the plot never interpolates a board that was not sampled.
export interface PlaythroughTrajectoryPoint {
  readonly elapsed: number;
  readonly credited: number;
  readonly rate: number;
  readonly forgeRate: number;
  readonly eraEarned: number;
  readonly nous: number;
  readonly arete: number;
  readonly snapshot: number;
}

// One exact recorded state (issue #470): the whole game state as it stood
// at a simulated moment — cloned, rate-synced on the preview basis, and
// deep-frozen, so historical inspection cannot mutate the run and no
// interpolated or mismatched board can pass as a recorded one. Samples of
// the trajectory and the moments the action record stamps share this one
// store; historical selection alone picks which snapshot is inspected.
export interface PlaythroughSnapshot {
  // Simulated elapsed seconds since the anchor — the plotted x.
  readonly elapsed: number;
  readonly credited: number;
  readonly state: GameState;
}

// The curve markers (story 27): every recorded event classifies into the
// four plotted marker classes or plots none. Purchases are the buys —
// shelf, cells, the Arete and World offerings, the capacity rungs; unlocks
// are the acquisitions and discoveries — roll acceptances, feats, World
// finds; session boundaries are the sessions and their breathers; prestige
// is the bank. Placement and upgrade gestures and the pacing marks plot
// none: they stay lines of the decisions list. Declined attempts plot
// none — their reasons live in the record.
export type PlaythroughMarker = "purchase" | "unlock" | "session" | "prestige";

export function playthroughEventMarker(event: PlaythroughEvent): PlaythroughMarker | null {
  if (!event.ok) return null;
  if (event.kind === "purchase" || event.kind === "arete" || event.kind === "world") return "purchase";
  if (event.kind === "roll") return "unlock";
  if (event.kind === "milestone") {
    if (event.label.startsWith("Poly Expander")) return "purchase";
    if (event.label.startsWith("Feat unlocked") || event.label.startsWith("World —")) return "unlock";
    return null;
  }
  if (event.kind === "session" || event.kind === "breather") return "session";
  if (event.kind === "prestige") return "prestige";
  return null;
}

// One recovery mark (story 25): the both-clocks cost of a next-era
// milestone, measured from the prestige moment — simulated elapsed seconds
// and credited practice seconds. Null is the explicit unreached mark (a
// slower recovery is valid evidence; a missing milestone is never
// fabricated).
export interface PlaythroughRecoveryMark {
  readonly elapsed: number;
  readonly credited: number;
}

// The next era's recovery ledger (stories 24–25): the production the
// reset erased, and both recovery measures against it. Null until the
// run's first prestige — a run that never banks never recovers.
export interface PlaythroughRecovery {
  // Whole-board ν/s immediately before the first prestige.
  readonly preResetRate: number;
  // When the next era's board first produced at least that rate again.
  readonly productionRegained: PlaythroughRecoveryMark | null;
  // When the next era first reached prestige eligibility again.
  readonly eligibilityReached: PlaythroughRecoveryMark | null;
}

// The run's Arete spending ledger (story 24): what the earned claims paid
// for — the Catalog entry (0 or 1), the capacity offerings' discounts and
// ceiling unlocks, Charge Column copies, and Hone ranks across weapon
// types. Purchases ride the engine's own action gates; the ledger records
// what landed.
export interface PlaythroughAreteSpent {
  readonly entry: number;
  readonly discounts: number;
  readonly ceilings: number;
  readonly columns: number;
  readonly hone: Record<WeaponType, number>;
}

// The result. The kind line is the honest one: this walk rode the real
// session schedule, practice accounting, and engine actions — it is not
// the economy-only simulation the calibration runner performs (story 13).
export interface PlaythroughRecord {
  readonly kind: "representative";
  readonly runId: string;
  readonly recipe: PlaythroughRecipe;
  readonly source: PlaythroughSource;
  readonly policy: { readonly id: string; readonly name: string };
  readonly complete: boolean;
  // "prestige" is the prompt door; "recovered" is the pushing run's
  // completed next-era demonstration — both recovery measures measured.
  // "budget" is the explicit incomplete outcome (story 21).
  readonly stop: { readonly kind: "prestige" | "recovered" | "budget"; readonly reason: string };
  // The pushing policy's configured pending-claim target, carried beside
  // the actual claims so intent and outcome stay distinguishable
  // (stories 19–20).
  readonly claimTarget: number;
  // Arete banked per prestige — the first-eligibility claim is zero by the
  // frontier curve, and the zero stands (#465's implementation decisions).
  readonly claims: readonly number[];
  readonly areteSpent: PlaythroughAreteSpent;
  readonly days: number;
  readonly elapsedSeconds: number;
  readonly creditedSeconds: number;
  readonly breatherSeconds: number;
  // Every ν the run banked — sessions and their breathers together — the
  // figure the no-grants guarantee is checked against.
  readonly earnedNous: number;
  readonly lastMilestone: string | null;
  // Incomplete runs only: what the budget ran out against, with the last
  // declined action's reason (story 22).
  readonly bottleneck: string | null;
  readonly events: readonly PlaythroughEvent[];
  readonly trajectory: readonly PlaythroughTrajectoryPoint[];
  // The exact recorded states (issue #470): one per plotted sample, one at
  // every session boundary, one at every moment the action record stamps —
  // every event's `snapshot` and every point's `snapshot` resolves here.
  readonly snapshots: readonly PlaythroughSnapshot[];
  readonly achievements: readonly string[];
  readonly worldDiscoveries: readonly string[];
  readonly worldDefeats: readonly string[];
  // The next era's recovery ledger (stories 24–25): null until the run's
  // first prestige, then the pre-reset rate and the two measures.
  readonly recovery: PlaythroughRecovery | null;
  // The run's final state — the ground truth behind every figure.
  readonly state: GameState;
}

interface RunContext {
  schedule: PlaythroughSchedule;
  claimTarget: number;
  pushing: boolean;
  rng: () => number;
  events: PlaythroughEvent[];
  trajectory: PlaythroughTrajectoryPoint[];
  // The exact recorded states, and the events awaiting their binding: an
  // event is stamped before the moment's snapshot is taken, so it opens
  // here and the next snapshot closes it.
  snapshots: PlaythroughSnapshot[];
  openEvents: number[];
  claims: number[];
  areteSpent: { entry: number; discounts: number; ceilings: number; columns: number; hone: Record<WeaponType, number> };
  achievements: string[];
  discovered: string[];
  defeated: string[];
  credited: number;
  breatherSeconds: number;
  sessionNous: number;
  breatherNous: number;
  elapsedMs: number;
  lastDecline: string | null;
  lastMilestone: string | null;
  // The recovery ledger (stories 24–25): armed at the run's first prestige
  // with the pre-reset rate, then settled at every between-sessions moment
  // until both measures carry marks.
  preResetRate: number | null;
  prestigeElapsedMs: number;
  prestigeCredited: number;
  productionRegained: PlaythroughRecoveryMark | null;
  eligibilityReached: PlaythroughRecoveryMark | null;
}

// Session k of a day starts after the k preceding sessions and their
// breathers; the day's last session leaves the overnight gap untouched —
// upgrade mode produces and credits nothing there, which is the real
// accounting (story 15).
function sessionStartMs(schedule: PlaythroughSchedule, day: number, session: number): number {
  const stride = (schedule.sessionMinutes + schedule.breatherMinutes) * 60_000;
  const date = new Date(schedule.startAt);
  date.setDate(date.getDate() + day);
  return date.getTime() + session * stride;
}

function record(
  ctx: RunContext,
  event: Omit<PlaythroughEvent, "at" | "credited" | "snapshot"> & { ok: boolean; reason?: string },
): void {
  ctx.events.push({ at: Math.round((ctx.elapsedMs - ctx.schedule.startAt) / 1000), credited: Math.round(ctx.credited), ...event, snapshot: -1 });
  ctx.openEvents.push(ctx.events.length - 1);
  if (event.milestone && event.ok) ctx.lastMilestone = event.label;
}

// Deep-read-only (issue #470): every recorded state freezes whole, so a
// stray write through inspection — human or agent — fails loudly instead
// of rewriting evidence.
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// The moment's exact recorded state: cloned off the live walk (which keeps
// moving), rate-synced on the same preview basis every plotted sample
// reads, then frozen. Every event opened since the last snapshot binds
// here — an event's board is the exact state at its own simulated stamp,
// never an interpolation or a neighboring break's board.
function snap(ctx: RunContext, state: GameState): number {
  const clone = structuredClone(state);
  syncRates(clone, false);
  const snapshot: PlaythroughSnapshot = {
    elapsed: Math.round((ctx.elapsedMs - ctx.schedule.startAt) / 1000),
    credited: Math.round(ctx.credited),
    state: deepFreeze(clone),
  };
  ctx.snapshots.push(snapshot);
  const index = ctx.snapshots.length - 1;
  for (const open of ctx.openEvents) {
    ctx.events[open] = { ...ctx.events[open]!, snapshot: index };
  }
  ctx.openEvents = [];
  return index;
}

function decline(ctx: RunContext, label: string, reason: string): void {
  ctx.lastDecline = `${label} — ${reason}`;
}

// The action-outcome recording shape: the engine's own ok/reason verbatim.
function outcome(result: ActionResult): { ok: boolean; reason?: string } {
  return result.ok ? { ok: true } : { ok: false, ...(result.reason !== undefined ? { reason: result.reason } : {}) };
}

function pushTrajectory(ctx: RunContext, state: GameState): void {
  const snapshot = syncRates(state, false);
  ctx.trajectory.push({
    elapsed: Math.round((ctx.elapsedMs - ctx.schedule.startAt) / 1000),
    credited: Math.round(ctx.credited),
    rate: snapshot.rate,
    forgeRate: snapshot.forgeRate,
    eraEarned: state.eraEarned,
    nous: wholeNous(state),
    arete: state.arete,
    snapshot: snap(ctx, state),
  });
}

// The run's discovery diffs: achievements and World enemies found since
// the last check, recorded as milestones (story 24's foundation), plus
// enemies defeated — the ×(1 + bonus) era bonus landing is the World
// milestone the spending bought toward.
function recordDiscoveries(ctx: RunContext, state: GameState): void {
  for (const id of Object.keys(state.achievements)) {
    if (!ctx.achievements.includes(id)) {
      ctx.achievements.push(id);
      record(ctx, { kind: "milestone", label: `Feat unlocked — ${id}`, ok: true, milestone: true });
    }
  }
  for (const [key, enemy] of Object.entries(state.world.enemies)) {
    if (enemy.discovered && !ctx.discovered.includes(key)) {
      ctx.discovered.push(key);
      record(ctx, {
        kind: "milestone",
        label: `World — enemy ${key} discovered`,
        ok: true,
        milestone: true,
      });
    }
    if (enemy.discovered && enemyDefeated(state, key) && !ctx.defeated.includes(key)) {
      ctx.defeated.push(key);
      record(ctx, {
        kind: "milestone",
        label: `World — enemy ${key} defeated`,
        ok: true,
        milestone: true,
      });
    }
  }
}

// One management break: the prompt policy's decisions, each riding the
// engine's own action gates. Every leg records its first decline and stops
// — the record stays readable and the reasons stay the engine's own.
function manage(ctx: RunContext, state: GameState): void {
  recordDiscoveries(ctx, state);
  // The one standing practice: the schedule's habit with its daily goal.
  if (!state.habits.some((habit) => !habit.archived)) createHabit(state, ctx.schedule.habitName);
  const habit = state.habits.find((habit) => !habit.archived)!;
  if (state.activeHabitId !== habit.id) selectHabit(state, habit.id);
  if (!activeGoalOf(state, habit.id)) {
    createGoal(state, {
      habitId: habit.id,
      minutes: ctx.schedule.goalMinutes,
      schedule: "daily",
      now: ctx.elapsedMs,
    });
  }

  // Rolls: accept an oscillator when offered, else a generator, else the
  // first candidate; mutator rolls take their first candidate.
  for (const offer of [...state.bankedRolls]) {
    const candidate =
      offer.candidates.find((c) => isOscillatorType(c.type)) ??
      offer.candidates.find((c) => CATEGORY_OF[c.type] === "generator") ??
      offer.candidates[0];
    if (!candidate) continue;
    const result = chooseRoll(state, offer.id, candidate.id);
    record(ctx, { kind: "roll", label: `Accepted a ${candidate.type} from the roll`, ...outcome(result) });
  }
  for (const offer of [...state.bankedMutatorRolls]) {
    const candidate = offer.candidates[0];
    if (!candidate) continue;
    const result = chooseMutatorRoll(state, offer.id, candidate.id);
    record(ctx, {
      kind: "roll",
      label: `Accepted a ${candidate.family} mutator from the roll`,
      ...outcome(result),
    });
  }

  // Shelf purchases, generator → infusor → forge.
  for (const type of SHELF_TYPES) {
    if (state.purchased[type]) continue;
    const result = buyShelfModule(state, type);
    record(ctx, { kind: "purchase", label: `Shelf — ${type}`, ...outcome(result) });
    if (!result.ok) {
      decline(ctx, `shelf ${type}`, result.reason ?? "declined");
      break;
    }
  }

  // Board cells, nearest first along the compact frontier.
  for (;;) {
    const pos = frontier(state, "compact")[0];
    if (!pos) break;
    const result = buyCell(state, pos);
    record(ctx, { kind: "purchase", label: `Cell at ${pos.q},${pos.r}`, ...outcome(result) });
    if (!result.ok) {
      decline(ctx, `cell at ${pos.q},${pos.r}`, result.reason ?? "declined");
      break;
    }
  }

  // Placement: every tray module onto the vacancy the authoritative
  // preview scores highest — the calibration walk's pattern (issue #262).
  for (const module of state.modules.filter((m) => m.pos === null)) {
    const vacancies = state.cells.filter((cell) => !state.modules.some((m) => m.pos && sameHex(m.pos, cell)));
    let best: Hex | undefined;
    let bestScore = -1;
    for (const pos of vacancies) {
      module.pos = pos;
      const score = syncRates(state, false).rate;
      if (score > bestScore) {
        bestScore = score;
        best = pos;
      }
    }
    module.pos = null;
    if (!best) {
      record(ctx, {
        kind: "placement",
        label: `${module.type} stayed in the tray`,
        ok: false,
        reason: "no free cell to place on",
      });
      decline(ctx, `placement ${module.type}`, "no free cell to place on");
      break;
    }
    const result = placeModule(state, module.id, best);
    record(ctx, {
      kind: "placement",
      label: `Placed a ${module.type} at ${best.q},${best.r}`,
      ...outcome(result),
    });
    if (!result.ok) {
      decline(ctx, `placement ${module.type}`, result.reason ?? "declined");
      break;
    }
  }

  // The capacity ladder before the level gestures: each rung records the
  // optimization opportunity it opened — the run's pacing milestones.
  for (;;) {
    const before = syncRates(state, false).rate;
    const result = buyCapacity(state);
    if (result.ok) {
      const after = syncRates(state, false).rate;
      record(ctx, {
        kind: "milestone",
        label: `Poly Expander ${state.capacityBought} — ${before.toFixed(2)}ν/s → ${after.toFixed(2)}ν/s`,
        ok: true,
        milestone: true,
      });
    } else {
      record(ctx, {
        kind: "milestone",
        label: `Poly Expander ${state.capacityBought + 1}`,
        ...outcome(result),
      });
      decline(ctx, `Poly Expander ${state.capacityBought + 1}`, result.reason ?? "declined");
      break;
    }
  }

  // Level gestures: five-level sweeps over the deployed voices, cheapest
  // first, while the bank covers the next gesture. The cap is a runaway
  // guard, not a tuning constant — levels grow priced beyond any bank
  // long before it binds. The gesture walk is batched without changing
  // what lands: the walk is simulated arithmetically against the same
  // per-level prices and the same cheapest-first, roster-tie order — every
  // partial gesture included — and each voice's total then rides one real
  // action, charged in the walk's own order (every prefix fits the bank by
  // construction). The closing refusal still rides the real action, so the
  // final levels, the total spend, the aggregate event line, and the
  // engine's own decline reason are exactly what the unbatched walk
  // produces, at a fraction of the action-boundary syncs a long push's
  // big banks would otherwise pay.
  const gestureVoices = (): ModuleInstance[] =>
    state.modules.filter((m) => m.pos !== null && m.type !== "spacer").sort((a, b) => a.level - b.level);
  let swept = 0;
  const voices = gestureVoices();
  let bankRanDry = false;

  if (voices.length > 0) {
    let bank = wholeNous(state);
    const levels = new Map<string, number>(voices.map((voice) => [voice.id, voice.level]));
    const totals = new Map<string, number>();
    // The walk re-sorts every gesture, so ties resolve in roster order —
    // the stable sort's own tiebreak — never in the captured array's
    // stale level order.
    const rosterRank = new Map(state.modules.map((module, index) => [module.id, index]));
    const picksCheapest = (a: ModuleInstance, b: ModuleInstance): boolean => {
      const la = levels.get(a.id)!;
      const lb = levels.get(b.id)!;
      return la < lb || (la === lb && rosterRank.get(a.id)! < rosterRank.get(b.id)!);
    };
    for (let guard = 0; guard < 2000; guard++) {
      let cheapest: ModuleInstance | null = null;
      for (const voice of voices) {
        if (cheapest === null || picksCheapest(voice, cheapest)) cheapest = voice;
      }
      if (!cheapest) break;
      const from = levels.get(cheapest.id)!;
      const affordable = affordableLevels(bank, from);
      if (affordable < 1) {
        bankRanDry = true;
        break;
      }
      const bought = Math.min(GESTURE_LEVELS, affordable);
      const spent = levelsCost(from, bought);
      bank -= spent;
      levels.set(cheapest.id, from + bought);
      totals.set(cheapest.id, (totals.get(cheapest.id) ?? 0) + bought);
    }
    for (const voice of voices) {
      const total = totals.get(voice.id) ?? 0;
      if (total <= 0) continue;
      const result = upgradeModuleLevels(state, voice.id, total);
      if (!result.ok) break;
      swept += result.bulk?.levels ?? 0;
    }
  }
  // The closing refusal, exactly where the unbatched walk takes it: the
  // cheapest voice's next gesture rides the real action and records the
  // engine's own reason. A guard-bound walk never took that call, so the
  // batched one doesn't either.
  if (bankRanDry) {
    const resting = gestureVoices()[0];
    if (resting) {
      const result = upgradeModuleLevels(state, resting.id, GESTURE_LEVELS);
      if (!result.ok) {
        record(ctx, { kind: "upgrade", label: `Levels on the ${resting.type}`, ...outcome(result) });
        decline(ctx, `levels on the ${resting.type}`, result.reason ?? "declined");
      }
    }
  }
  if (swept > 0) record(ctx, { kind: "upgrade", label: `Swept ${swept} levels`, ok: true });

  // The Arete offerings behind the Catalog entry (#262's playable path).
  // "When affordable" is the authored rule, read literally: a broke board
  // attempts nothing, so a long claim-less push records no wall of
  // declined nickels — the leg's first real refusal still lands with the
  // engine's own reason.
  if (!state.catalogEntryOwned && state.arete >= BALANCE.catalogEntryCost) {
    const result = buyCatalogEntry(state, ctx.rng);
    if (result.ok) ctx.areteSpent.entry++;
    record(ctx, { kind: "arete", label: "Catalog entry", ...outcome(result) });
    if (!result.ok) decline(ctx, "catalog entry", result.reason ?? "declined");
  } else if (state.catalogEntryOwned) {
    for (const [label, kind, attempt] of [
      ["Chord Catalysts", "discounts", () => buyCapacityDiscount(state)],
      ["Expansion Bays", "ceilings", () => buyCapacityCeiling(state)],
    ] as const) {
      const result = attempt();
      if (result.ok) ctx.areteSpent[kind]++;
      record(ctx, { kind: "arete", label: `Arete — ${label}`, ...outcome(result) });
      if (!result.ok) {
        decline(ctx, `arete ${label}`, result.reason ?? "declined");
        break;
      }
    }
  }

  // The World faces (story 24): purchases wait for the World's door — a
  // starter weapon granted, a claimed frontier, or a discovered enemy —
  // and an affordable price, the authored rule read literally. Prestige
  // restores every enemy to undiscovered, so a discovered-only gate would
  // idle the whole next era's spending while the claim's Arete sits in the
  // bank; the door, once entered, stays entered. Then every occupant
  // deploys through the real placement action: weapons beside the fight,
  // Columns on the charge line. The placement leg keeps its readable
  // preference order, never an optimizer.
  const worldEntered = state.world.starterWeaponGranted || state.world.frontier > 0 ||
    Object.values(state.world.enemies).some((enemy) => enemy.discovered);
  if (worldEntered) {
    for (;;) {
      if (state.arete < columnCost(state.world.columns.length)) {
        decline(ctx, "World Column", "Not enough Arete.");
        break;
      }
      const result = buyChargeColumn(state);
      if (result.ok) ctx.areteSpent.columns++;
      record(ctx, { kind: "world", label: "World Column", ...outcome(result) });
      if (!result.ok) {
        decline(ctx, "World Column", result.reason ?? "declined");
        break;
      }
    }
    for (const weapon of state.world.weapons) {
      for (;;) {
        const price = honeCostOf(state, weapon.type);
        if (price === null || state.arete < price) {
          decline(ctx, `Hone rank ${weapon.type}`, price === null ? "at its Hone ceiling" : "Not enough Arete.");
          break;
        }
        const result = buyHoneRank(state, weapon.type);
        if (result.ok) ctx.areteSpent.hone[weapon.type] = (ctx.areteSpent.hone[weapon.type] ?? 0) + 1;
        record(ctx, { kind: "world", label: `Hone rank — ${weapon.type}`, ...outcome(result) });
        if (!result.ok) {
          decline(ctx, `Hone rank ${weapon.type}`, result.reason ?? "declined");
          break;
        }
      }
    }
    placeWorldOccupants(ctx, state);
  }
  recordDiscoveries(ctx, state);
  settleRecovery(ctx, state);
  pushTrajectory(ctx, state);
}

// The World placement leg (story 24): each weapon deploys beside the fight
// — an owned cell adjacent to a living discovered enemy, preferring one
// that also touches a placed Column, nearest the enemy first — and each
// Column deploys on the charge line — an owned cell adjacent to a deployed
// generator, preferring one beside a placed weapon. Readable preference
// ranks, board order breaking ties; the engine's own placement action
// gates every seat (enemy-reserved cells refuse, one occupant per cell).
function placeWorldOccupants(ctx: RunContext, state: GameState): void {
  const living = WORLD_ENEMIES.filter((def) => {
    const live = state.world.enemies[def.key];
    return live?.discovered === true && !enemyDefeated(state, def.key);
  });
  const distanceToFight = (pos: Hex): number =>
    living.length > 0 ? Math.min(...living.map((def) => hexDistance(pos, def.pos))) : Number.POSITIVE_INFINITY;
  const free = (): Hex[] =>
    state.cells.filter((cell) => !enemyDefAt(cell) && !worldOccupantAt(state, cell));
  // Rank keys compare lexicographically; lower is the earlier preference.
  const rankLess = (a: readonly number[], b: readonly number[]): boolean => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i]! < b[i]!;
    }
    return false;
  };
  // Both occupants share selection and action handling; each rule supplies
  // eligible seats and its own readable preference ranks.
  const deploy = (
    id: string,
    name: string,
    candidates: Hex[],
    rank: (pos: Hex) => readonly number[],
    unavailable: string,
  ): boolean => {
    let best: Hex | undefined;
    for (const pos of candidates) {
      if (!best || rankLess(rank(pos), rank(best))) best = pos;
    }
    if (!best) {
      record(ctx, { kind: "world", label: `${name} stayed in the tray`, ok: false, reason: unavailable });
      decline(ctx, name, unavailable);
      return false;
    }
    const result = placeWorldOccupant(state, id, best);
    record(ctx, { kind: "world", label: `Placed ${name} at ${best.q},${best.r}`, ...outcome(result) });
    if (!result.ok) decline(ctx, name, result.reason ?? "declined");
    return result.ok;
  };
  for (const weapon of state.world.weapons) {
    if (weapon.pos !== null) continue;
    if (!deploy(
      weapon.id,
      `the ${weapon.type}`,
      free().filter((pos) => living.some((def) => adjacent(pos, def.pos))),
      (pos) => [
        distanceToFight(pos),
        state.world.columns.some((column) => column.pos !== null && adjacent(pos, column.pos)) ? 0 : 1,
        pos.q, pos.r,
      ],
      "no free World cell beside a living discovered enemy",
    )) break;
  }
  for (const column of state.world.columns) {
    if (column.pos !== null) continue;
    if (!deploy(
      column.id,
      "a Charge Column",
      free().filter((pos) => state.modules.some((module) => module.pos !== null &&
        CATEGORY_OF[module.type] === "generator" && adjacent(pos, module.pos))),
      (pos) => [
        state.world.weapons.some((weapon) => weapon.pos !== null && adjacent(pos, weapon.pos)) ? 0 : 1,
        pos.q, pos.r,
      ],
      "no free World cell beside a deployed generator",
    )) break;
  }
}

// The recovery settlement (stories 24–25): measured at every
// between-sessions moment after the run's first prestige. Regaining
// production compares the next era's whole-board rate against the rate the
// reset erased; eligibility is the horizon crossing again. Both carry
// their mark on both clocks, measured from the prestige moment; a measure
// the budget outlives stays explicitly null.
function settleRecovery(ctx: RunContext, state: GameState): void {
  if (ctx.preResetRate === null) return;
  const since = (): PlaythroughRecoveryMark => ({
    elapsed: Math.max(0, Math.round((ctx.elapsedMs - ctx.prestigeElapsedMs) / 1000)),
    credited: Math.max(0, Math.round(ctx.credited - ctx.prestigeCredited)),
  });
  if (ctx.productionRegained === null && syncRates(state, false).rate >= ctx.preResetRate) {
    ctx.productionRegained = since();
    record(ctx, {
      kind: "milestone",
      label: `Recovery — pre-reset production regained (${ctx.preResetRate.toFixed(2)}ν/s)`,
      ok: true,
      milestone: true,
    });
  }
  if (ctx.eligibilityReached === null && horizonReached(state)) {
    ctx.eligibilityReached = since();
    record(ctx, {
      kind: "milestone",
      label: "Recovery — next prestige eligibility reached",
      ok: true,
      milestone: true,
    });
  }
}

function recoveryComplete(ctx: RunContext): boolean {
  return ctx.productionRegained !== null && ctx.eligibilityReached !== null;
}

// One planned session at its target, the breather the session minted, and
// the honest stamps on both ends. Never walks past the target: the prompt
// policy ends sessions at their plan — a readable, checkable rule.
function runSession(ctx: RunContext, state: GameState, day: number, session: number): void {
  const target = ctx.schedule.sessionMinutes * 60;
  const startMs = sessionStartMs(ctx.schedule, day, session);
  ctx.elapsedMs = startMs;
  // The app rolls goal occurrences on its ticks and at boot, so a player
  // returning the next day finds the daily goal re-keyed before the first
  // session starts — the runner mirrors that here with the session's own
  // stamp, and endSession's rollover covers the other edge.
  rollGoalOccurrences(state, startMs);
  const started = startSession(state, target, startMs);
  if (!started.ok) {
    record(ctx, { kind: "session", label: `Session ${state.sessionIndex + 1}`, ...outcome(started) });
    decline(ctx, "session start", started.reason ?? "declined");
    // The refused attempt is its own recorded moment: the stamp moved, so
    // the event binds a snapshot of the untouched state at its own stamp,
    // never the previous break's.
    snap(ctx, state);
    return;
  }
  writeNote(state, NOTE_TEXT, startMs);
  for (let step = 0; step < target / STEP_SECONDS; step++) {
    advance(state, STEP_SECONDS, ctx.rng);
    ctx.elapsedMs += STEP_SECONDS * 1000;
  }
  const ended = endSession(state, startMs + target * 1000);
  const recordLine = state.sessionRecords[state.sessionRecords.length - 1];
  const credited = recordLine?.creditedSeconds ?? 0;
  ctx.credited += credited;
  ctx.sessionNous += recordLine?.earned ?? 0;
  record(ctx, {
    kind: "session",
    label: `Session ${recordLine?.sessionNumber ?? state.sessionsCompleted} — ${ctx.schedule.sessionMinutes}m planned, ${Math.round(credited)}s credited, +${recordLine?.earned ?? 0}ν`,
    ...outcome(ended),
  });
  if (!ended.ok) decline(ctx, "session end", ended.reason ?? "declined");
  // The session's own boundary stamp: the end event binds the state as the
  // session banked it, before the breather moves the clock on.
  snap(ctx, state);

  // The breather the session minted, bounded by the declared schedule —
  // the engine's allowance is the real mechanic, and the recipe never
  // fabricates more rest than the session earned. A declared zero is the
  // declined breather, and the summary expires with it.
  const allowance = state.summary?.breatherAllowance ?? 0;
  const declared = ctx.schedule.breatherMinutes * 60;
  const lived = Math.min(allowance, declared);
  if (lived > 0) {
    const breatheStart = startBreather(state, ctx.elapsedMs);
    if (breatheStart.ok) {
      const livedResult = advanceBreather(state, lived, ctx.rng);
      ctx.elapsedMs += lived * 1000;
      endBreather(state);
      ctx.breatherSeconds += lived;
      ctx.breatherNous += livedResult.nousEarned;
      record(ctx, {
        kind: "breather",
        label: `Breather — ${Math.round(lived)}s of the ${allowance}s allowance`,
        ok: true,
      });
    } else {
      record(ctx, { kind: "breather", label: "Breather", ...outcome(breatheStart) });
      decline(ctx, "breather", breatheStart.reason ?? "declined");
      dismissSummary(state);
    }
  } else {
    dismissSummary(state);
    if (allowance > 0) {
      record(ctx, {
        kind: "breather",
        label: `Breather declined by schedule — the ${allowance}s allowance expired`,
        ok: true,
      });
    }
  }
  recordDiscoveries(ctx, state);
  pushTrajectory(ctx, state);
}

// The prestige check — the prompt policy's completion and the pushing
// policy's bank. The prompt door opens at the first between-sessions
// moment the horizon is reached; the first-eligibility claim is zero under
// the frontier curve, and the zero banks honestly. The pushing policy
// holds that door: it prestiges only when the pending claim reaches its
// configured target (story 19) — a depth the horizon has long been past —
// and its first bank arms the next era's recovery ledger (stories 24–25).
function tryPrestige(ctx: RunContext, state: GameState): boolean {
  // This run measures the era immediately following its first bank.
  if (ctx.claims.length > 0) return false;
  if (ctx.pushing) {
    if (pendingClaimOf(state) < ctx.claimTarget) return false;
  } else if (!horizonReached(state)) {
    return false;
  }
  if (ctx.preResetRate === null) {
    // The first prestige, either policy: capture the production the reset
    // is about to erase, then arm the recovery measures against it.
    ctx.preResetRate = syncRates(state, false).rate;
    ctx.prestigeElapsedMs = ctx.elapsedMs;
    ctx.prestigeCredited = ctx.credited;
  }
  const before = state.arete;
  const result = prestige(state);
  const claim = state.arete - before;
  ctx.claims.push(claim);
  record(ctx, {
    kind: "prestige",
    label: `Prestige ${state.prestiges} — banked ${claim} Arete`,
    ...outcome(result),
    milestone: true,
  });
  pushTrajectory(ctx, state);
  return result.ok;
}

export function runPlaythrough(
  recipe: PlaythroughRecipe,
  source: PlaythroughSource = playthroughSource(),
): PlaythroughRecord {
  validatePlaythroughRecipe(recipe);
  const scenario = scenarioOf(recipe.scenarioId)!;
  const state = scenario.build(recipe.schedule.startAt);
  scenario.assert(state, recipe.schedule.startAt);
  const policy = policyOf(recipe.policyId);
  const ctx: RunContext = {
    schedule: recipe.schedule,
    claimTarget: recipe.claimTarget,
    pushing: policy.id === PUSHING_POLICY.id,
    rng: seededRng(recipe.seed),
    events: [],
    trajectory: [],
    snapshots: [],
    openEvents: [],
    claims: [],
    areteSpent: { entry: 0, discounts: 0, ceilings: 0, columns: 0, hone: { chargeBlade: 0 } },
    achievements: [],
    discovered: [],
    defeated: [],
    credited: 0,
    breatherSeconds: 0,
    sessionNous: 0,
    breatherNous: 0,
    elapsedMs: recipe.schedule.startAt,
    lastDecline: null,
    lastMilestone: null,
    preResetRate: null,
    prestigeElapsedMs: 0,
    prestigeCredited: 0,
    productionRegained: null,
    eligibilityReached: null,
  };

  let days = 0;
  let complete = false;
  let stop: PlaythroughRecord["stop"] = {
    kind: "budget",
    reason: ctx.pushing
      ? `The ${recipe.budgetDays}-day budget ended before the ${recipe.claimTarget}-Arete claim or the recovery behind it.`
      : `The ${recipe.budgetDays}-day budget ended before the first prestige.`,
  };
  day: for (let day = 0; day < recipe.budgetDays; day++) {
    days = day + 1;
    for (let session = 0; session < recipe.schedule.sessionsPerDay; session++) {
      // The policy checks its door at every between-sessions moment —
      // before the break's purchases, so a claim due (or a reached
      // horizon) is never spent into levels a prestige would wipe. The
      // prompt door is the prompt run's completion; a pushing bank is the
      // demonstration's middle, never its end — the record follows the
      // next era until both recovery measures carry their marks.
      if (tryPrestige(ctx, state) && !ctx.pushing) {
        complete = true;
        stop = { kind: "prestige", reason: `First prestige at day ${days}.` };
        break day;
      }
      manage(ctx, state);
      runSession(ctx, state, day, session);
      if (tryPrestige(ctx, state) && !ctx.pushing) {
        complete = true;
        stop = { kind: "prestige", reason: `First prestige at day ${days}.` };
        break day;
      }
      // The between-sessions settlement: both recovery measures read here
      // too, so a measure crossed during the session carries its mark at
      // this moment, never a day late.
      settleRecovery(ctx, state);
      // The pushing run's completion (stories 24–25): both recovery
      // measures measured — production regained and the door reached
      // again. Whatever the figures say is the evidence; there is no
      // pacing threshold to miss.
      if (ctx.pushing && recoveryComplete(ctx)) {
        complete = true;
        stop = { kind: "recovered", reason: `Recovery measured at day ${days}.` };
        break day;
      }
    }
  }
  // A pushing run that banked but never recovered names that stop exactly.
  if (!complete && ctx.pushing && ctx.claims.length > 0) {
    stop = { kind: "budget", reason: `The ${days}-day budget ended inside the recovery era.` };
  }
  const lastSessionLabel = [...ctx.events].reverse().find((event) => event.kind === "session")?.label ?? null;
  const bottleneck = complete
    ? null
    : ctx.lastDecline
      ? `${stop.reason} Last decline — ${ctx.lastDecline}.`
      : `${stop.reason} No action was declined — practice rate alone did not reach the horizon.`;
  const recovery: PlaythroughRecovery | null =
    ctx.preResetRate === null
      ? null
      : {
          preResetRate: ctx.preResetRate,
          productionRegained: ctx.productionRegained,
          eligibilityReached: ctx.eligibilityReached,
        };
  // Defensive binding: every leg ends at a snapshot, so nothing should
  // still be open here — but an event can never resolve to nothing.
  if (ctx.openEvents.length > 0 && ctx.snapshots.length > 0) {
    const last = ctx.snapshots.length - 1;
    for (const open of ctx.openEvents) {
      ctx.events[open] = { ...ctx.events[open]!, snapshot: last };
    }
    ctx.openEvents = [];
  }
  return {
    kind: "representative",
    runId: playthroughRunId(recipe, source),
    recipe,
    source,
    policy: { id: policy.id, name: policy.name },
    complete,
    stop,
    claimTarget: recipe.claimTarget,
    claims: ctx.claims,
    areteSpent: ctx.areteSpent,
    days,
    elapsedSeconds: Math.round((ctx.elapsedMs - recipe.schedule.startAt) / 1000),
    creditedSeconds: Math.round(ctx.credited),
    breatherSeconds: Math.round(ctx.breatherSeconds),
    earnedNous: ctx.sessionNous + ctx.breatherNous,
    lastMilestone: ctx.lastMilestone ?? lastSessionLabel,
    bottleneck,
    events: ctx.events,
    trajectory: ctx.trajectory,
    snapshots: ctx.snapshots,
    achievements: ctx.achievements,
    worldDiscoveries: ctx.discovered,
    worldDefeats: ctx.defeated,
    recovery,
    state,
  };
}

// The result's one-line read: the ✓/✗ shape the suite's notes carry, with
// the figures that matter — both clocks, the claim against its target, the
// spending, the recovery measures, the identity, and on an incomplete run
// the honest stop. Measurements and explicit outcomes only; never a pacing
// verdict (story 37).
export function playthroughNote(record: PlaythroughRecord): string {
  const credited = Math.round(record.creditedSeconds / 60);
  const elapsed = Math.round(record.elapsedSeconds / 60);
  const claims = record.claims.length > 0 ? record.claims.join(", ") : "none";
  const target = record.policy.id === PUSHING_POLICY.id ? `/${record.claimTarget}` : "";
  const parts = [
    `${record.policy.name} ${record.complete ? "✓" : "✗"} ` +
      `${record.days}d · ${credited}m credited of ${elapsed}m elapsed · ` +
      `claim ${claims}${target} Arete · ` +
      `seed ${record.recipe.seed} · ${record.recipe.scenarioId} · ${record.runId}`,
  ];
  const spent = spendingNote(record.areteSpent);
  if (spent) parts.push(spent);
  if (record.recovery) parts.push(recoveryNote(record.recovery));
  if (record.complete) parts.push(record.stop.reason);
  else parts.push(`${record.lastMilestone ?? "no milestone"}`, `${record.bottleneck ?? record.stop.reason}`);
  return parts.join(" · ");
}

function spendingNote(spent: PlaythroughAreteSpent): string {
  const entries = [
    spent.entry > 0 ? "Catalog entry" : null,
    spent.discounts > 0 ? `${spent.discounts}× Chord Catalysts` : null,
    spent.ceilings > 0 ? `${spent.ceilings}× Expansion Bays` : null,
    spent.columns > 0 ? `${spent.columns}× Charge Column` : null,
    ...Object.entries(spent.hone).filter(([, ranks]) => ranks > 0).map(([type, ranks]) => `${ranks}× Hone (${type})`),
  ].filter((entry): entry is string => entry !== null);
  return entries.length > 0 ? `spent ${entries.join(" + ")}` : "no Arete spent";
}

function recoveryNote(recovery: PlaythroughRecovery): string {
  const mark = (value: PlaythroughRecoveryMark | null): string =>
    value ? `${(value.elapsed / 86_400).toFixed(1)}d/${Math.round(value.credited / 60)}m` : "unreached";
  return `recovery — rate ${mark(recovery.productionRegained)}, door ${mark(recovery.eligibilityReached)} (${recovery.preResetRate.toFixed(2)}ν/s pre-reset)`;
}

// The historical inspection read (issue #470, stories 28–30): one
// recorded snapshot assembled for reading — the plotted sample it carries
// (when it is one), the decisions the action record stamped at its moment,
// and the board as it stood. Everything derives from the record: the
// action record stays the sole owner of decision reasons, the selection
// stays the sole owner of which snapshot is inspected, and nothing here is
// a second explanation store. The recorded state itself is frozen — the
// board's figures are read off it, the per-voice production off an
// identical working clone at the same preview basis every sample reads.
export interface PlaythroughBoardVoice {
  readonly type: ModuleType;
  readonly note: string;
  readonly level: number;
  // Final ν/s on the preview basis; null for the voices that produce none
  // (silent voices, spacers).
  readonly nuPerSecond: number | null;
}

export interface PlaythroughInspection {
  readonly index: number;
  readonly elapsed: number;
  readonly credited: number;
  // The plotted sample behind this snapshot, when it is one — session
  // boundaries recorded between samples carry none.
  readonly point: PlaythroughTrajectoryPoint | null;
  // The decisions recorded at this exact moment, the action record's own
  // lines in their recorded order.
  readonly events: readonly PlaythroughEvent[];
  readonly rate: number;
  readonly balances: {
    readonly nous: number;
    readonly eraEarned: number;
    readonly arete: number;
    readonly scrap: number;
    readonly prestiges: number;
    readonly sessions: number;
    readonly cells: number;
    readonly tray: number;
  };
  readonly voices: readonly PlaythroughBoardVoice[];
}

// The assemblies are pure over an immutable record and a frozen snapshot —
// one working clone per (record, index), memoized.
const inspections = new WeakMap<PlaythroughRecord, Map<number, PlaythroughInspection>>();

export function playthroughInspection(record: PlaythroughRecord, index: number): PlaythroughInspection {
  const hit = inspections.get(record)?.get(index);
  if (hit) return hit;
  const snapshot = record.snapshots[index];
  if (!snapshot) {
    throw new Error(`Playthrough inspection: no recorded snapshot ${index} — the run carries ${record.snapshots.length}.`);
  }
  const state = snapshot.state;
  const working = structuredClone(state);
  const rates = syncRates(working, false);
  const voices: PlaythroughBoardVoice[] = state.modules
    .filter((module) => module.pos !== null)
    .sort((a, b) => a.pos!.r - b.pos!.r || a.pos!.q - b.pos!.q || a.id.localeCompare(b.id))
    .map((module) => ({
      type: module.type,
      note: cellNoteOf(module.pos!),
      level: module.level,
      nuPerSecond: rates.contributions.get(module.id)?.value ?? null,
    }));
  const inspection: PlaythroughInspection = {
    index,
    elapsed: snapshot.elapsed,
    credited: snapshot.credited,
    point: record.trajectory.find((point) => point.snapshot === index) ?? null,
    events: record.events.filter((event) => event.snapshot === index),
    rate: rates.rate,
    balances: {
      nous: wholeNous(state),
      eraEarned: state.eraEarned,
      arete: state.arete,
      scrap: state.scrap,
      prestiges: state.prestiges,
      sessions: state.sessionsCompleted,
      cells: state.cells.length,
      tray: state.modules.filter((module) => module.pos === null).length,
    },
    voices,
  };
  let memo = inspections.get(record);
  if (!memo) {
    memo = new Map();
    inspections.set(record, memo);
  }
  memo.set(index, inspection);
  return inspection;
}
