import { horizonReached } from "./accumulator";
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
  prestige,
  startBreather,
  startSession,
  upgradeModuleLevels,
} from "./actions";
import type { ActionResult } from "./actions";
import { frontier, seededRng } from "./capacity-calibration";
import { CATEGORY_OF, isOscillatorType, SAVE_VERSION, SHELF_TYPES } from "./constants";
import { syncRates, wholeNous } from "./economy";
import { activeGoalOf, createGoal, rollGoalOccurrences } from "./goals";
import { createHabit, selectHabit } from "./habits";
import { sameHex } from "./hex";
import { writeNote } from "./notes";
import { SCENARIOS, scenarioOf } from "./scenarios";
import type { GameState, Hex } from "./types";

// The reproducible playthrough runner (issue #468, parent #465): a recipe
// declares every behavior-affecting input — starting scenario, seed, player
// policy, practice schedule, time budget, calendar anchor, and the still
// empty override set — and the runner walks it through the real engine
// actions on a real session schedule: two 25-minute daily sessions, a
// five-minute breather, one practice habit with a daily goal, and honest
// overnight gaps where upgrade mode produces and credits nothing. The
// prompt policy prestiges at the first between-sessions moment the horizon
// is reached; the first-eligibility claim banks zero Arete under the
// frontier curve, and that zero stands rather than being topped up.
// Nothing here grants resources; an exhausted budget is an explicit
// incomplete result with the last milestone, the bottleneck, and the
// declined actions' reasons. The session loop's prior art is the
// calibration walk (#262) — its seeded rng and frontier/preview patterns
// are reused, its compressed fictional time is not: schedule and day
// accounting are this module's own, and the calibration run remains the
// economy-only kind this record's kind line distinguishes itself from.

// The runner's own version: a behavior-affecting change here is a source
// change, and a rerun against different source identifies separately
// (story 36's foundation).
export const PLAYTHROUGH_RUNNER_VERSION = 1;

// The acceleration step (seconds): production is exact at any step; this
// only coarsens crossing granularity. 60 matches the calibration walk.
const STEP_SECONDS = 60;
const DAY_MS = 86_400_000;
const NOTE_TEXT = "keep the shoulders down and the wrist loose through the scale run";

// The player policies. "prompt" is this ticket's readable baseline; the
// pushing policy joins on the same schedule later (story 16).
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
    "Buy every affordable capacity rung, then sweep five-level upgrades over the deployed voices, cheapest first, while the bank covers the next gesture.",
    "Bank the Catalog entry when affordable, then the discount and ceiling offerings.",
    "Attempt World Columns and Hone ranks only once an enemy is discovered, and only while affordable.",
    "Prestige at the first between-sessions moment the horizon is reached.",
    "End every session at its planned target and write a practice note.",
  ],
};

export const PLAYTHROUGH_POLICIES: readonly PlaythroughPolicy[] = [PROMPT_POLICY];

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
}

// The recipe: every behavior-affecting input in one place (story 11).
export interface PlaythroughRecipe {
  // The starting state: a launchable scenario id — the same catalog the
  // suite launches, the shipped opening included.
  readonly scenarioId: string;
  readonly seed: number;
  readonly policyId: string;
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
// typical-player claim (#465's implementation decisions).
export function defaultPlaythroughRecipe(): PlaythroughRecipe {
  return {
    scenarioId: "fresh-start",
    seed: 468,
    policyId: PROMPT_POLICY.id,
    schedule: {
      sessionsPerDay: 2,
      sessionMinutes: 25,
      breatherMinutes: 5,
      habitName: "Practice",
      goalMinutes: 25,
      startAt: Date.UTC(2026, 0, 5, 9, 0, 0),
    },
    budgetDays: 30,
    overrides: {},
  };
}

export interface PlaythroughRecipeInput {
  scenarioId?: string;
  seed?: number;
  policyId?: string;
  schedule?: Partial<PlaythroughSchedule>;
  budgetDays?: number;
}

// The composition seam the app command uses: the default recipe patched by
// an explicit input, validated with named failures. Unknown input keys are
// rejected — an unsupported request never quietly runs a default.
export function composePlaythroughRecipe(input: PlaythroughRecipeInput = {}): PlaythroughRecipe {
  const known = new Set(["scenarioId", "seed", "policyId", "schedule", "budgetDays"]);
  for (const key of Object.keys(input)) {
    if (!known.has(key)) throw new Error(`Playthrough recipe: unsupported input "${key}".`);
  }
  const base = defaultPlaythroughRecipe();
  const recipe: PlaythroughRecipe = {
    ...base,
    ...(input.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    ...(input.policyId !== undefined ? { policyId: input.policyId } : {}),
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
  if (!Number.isFinite(schedule.startAt) || schedule.startAt < 0) {
    fail("startAt must be a finite epoch-millis stamp.");
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
}

export function playthroughSource(): PlaythroughSource {
  return { game: "flowsynth", saveVersion: SAVE_VERSION, runnerVersion: PLAYTHROUGH_RUNNER_VERSION };
}

// Stable identity: the same recipe and source share one run id; a changed
// input or source changes it. A plain FNV-1a keeps the identity free of
// wall-clock stamps and platform hash variance.
export function playthroughRunId(recipe: PlaythroughRecipe, source: PlaythroughSource): string {
  const text = JSON.stringify({ recipe, source });
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${recipe.scenarioId}-s${recipe.seed}-${hash.toString(16).padStart(8, "0")}`;
}

// One recorded decision (story 18): the simulated moment, the credited
// practice so far, what was attempted, and the engine's own reason when it
// declined. Milestones flag the run's meaningful steps.
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
}

// One sample of the run's shape: simulated elapsed against credited
// practice, with the board's rates and balances at that moment (story 26).
export interface PlaythroughTrajectoryPoint {
  readonly elapsed: number;
  readonly credited: number;
  readonly rate: number;
  readonly forgeRate: number;
  readonly eraEarned: number;
  readonly nous: number;
  readonly arete: number;
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
  readonly stop: { readonly kind: "prestige" | "budget"; readonly reason: string };
  // Arete banked per prestige — the first-eligibility claim is zero by the
  // frontier curve, and the zero stands (#465's implementation decisions).
  readonly claims: readonly number[];
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
  readonly achievements: readonly string[];
  readonly worldDiscoveries: readonly string[];
  // The run's final state — the ground truth behind every figure.
  readonly state: GameState;
}

interface RunContext {
  schedule: PlaythroughSchedule;
  rng: () => number;
  events: PlaythroughEvent[];
  trajectory: PlaythroughTrajectoryPoint[];
  claims: number[];
  achievements: string[];
  discovered: string[];
  credited: number;
  breatherSeconds: number;
  sessionNous: number;
  breatherNous: number;
  elapsedMs: number;
  lastDecline: string | null;
  lastMilestone: string | null;
}

// Session k of a day starts after the k preceding sessions and their
// breathers; the day's last session leaves the overnight gap untouched —
// upgrade mode produces and credits nothing there, which is the real
// accounting (story 15).
function sessionStartMs(schedule: PlaythroughSchedule, day: number, session: number): number {
  const stride = (schedule.sessionMinutes + schedule.breatherMinutes) * 60_000;
  return schedule.startAt + day * DAY_MS + session * stride;
}

function record(
  ctx: RunContext,
  event: Omit<PlaythroughEvent, "at" | "credited"> & { ok: boolean; reason?: string },
): void {
  ctx.events.push({ at: Math.round(ctx.elapsedMs / 1000), credited: Math.round(ctx.credited), ...event });
  if (event.milestone && event.ok) ctx.lastMilestone = event.label;
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
    elapsed: Math.round(ctx.elapsedMs / 1000),
    credited: Math.round(ctx.credited),
    rate: snapshot.rate,
    forgeRate: snapshot.forgeRate,
    eraEarned: state.eraEarned,
    nous: wholeNous(state),
    arete: state.arete,
  });
}

// The run's discovery diffs: achievements and World enemies found since
// the last check, recorded as milestones (story 24's foundation).
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
        label: `Capacity rung ${state.capacityBought} — ${before.toFixed(2)}ν/s → ${after.toFixed(2)}ν/s`,
        ok: true,
        milestone: true,
      });
    } else {
      record(ctx, {
        kind: "milestone",
        label: `Capacity rung ${state.capacityBought + 1}`,
        ...outcome(result),
      });
      decline(ctx, `capacity rung ${state.capacityBought + 1}`, result.reason ?? "declined");
      break;
    }
  }

  // Level gestures: five-level sweeps over the deployed voices, cheapest
  // first, while the bank covers the next gesture. The cap is a runaway
  // guard, not a tuning constant — levels grow priced beyond any bank
  // long before it binds.
  let swept = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const voice = state.modules
      .filter((m) => m.pos !== null && m.type !== "spacer")
      .sort((a, b) => a.level - b.level)[0];
    if (!voice) break;
    const result = upgradeModuleLevels(state, voice.id, 5);
    if (!result.ok) {
      record(ctx, { kind: "upgrade", label: `Levels on the ${voice.type}`, ...outcome(result) });
      decline(ctx, `levels on the ${voice.type}`, result.reason ?? "declined");
      break;
    }
    const bought = result.bulk?.levels ?? 0;
    swept += bought;
    if (bought === 0) break;
  }
  if (swept > 0) record(ctx, { kind: "upgrade", label: `Swept ${swept} levels`, ok: true });

  // The Arete offerings behind the Catalog entry (#262's playable path).
  if (!state.catalogEntryOwned) {
    const result = buyCatalogEntry(state, ctx.rng);
    record(ctx, { kind: "arete", label: "Catalog entry", ...outcome(result) });
    if (!result.ok) decline(ctx, "catalog entry", result.reason ?? "declined");
  } else {
    for (const [label, attempt] of [
      ["capacity discount", () => buyCapacityDiscount(state)],
      ["capacity ceiling", () => buyCapacityCeiling(state)],
    ] as const) {
      const result = attempt();
      record(ctx, { kind: "arete", label: `Arete — ${label}`, ...outcome(result) });
      if (!result.ok) {
        decline(ctx, `arete ${label}`, result.reason ?? "declined");
        break;
      }
    }
  }

  // World purchases wait for a discovered enemy — the frontier's door —
  // and never fire in a first era; the leg is the policy's readable
  // World intent (story 24's foundation).
  if (Object.values(state.world.enemies).some((enemy) => enemy.discovered)) {
    for (;;) {
      const result = buyChargeColumn(state);
      record(ctx, { kind: "world", label: "World Column", ...outcome(result) });
      if (!result.ok) {
        decline(ctx, "World Column", result.reason ?? "declined");
        break;
      }
    }
    for (const weapon of state.world.weapons) {
      const result = buyHoneRank(state, weapon.type);
      record(ctx, { kind: "world", label: `Hone rank — ${weapon.type}`, ...outcome(result) });
      if (!result.ok) {
        decline(ctx, `Hone rank ${weapon.type}`, result.reason ?? "declined");
        break;
      }
    }
  }
  recordDiscoveries(ctx, state);
  pushTrajectory(ctx, state);
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

// The prompt prestige check — the run's completion. The first-eligibility
// claim is zero under the frontier curve (the horizon sits far below the
// World's entry depth), and the zero banks honestly.
function tryPrestige(ctx: RunContext, state: GameState): boolean {
  if (!horizonReached(state)) return false;
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
): PlaythroughRecord {  validatePlaythroughRecipe(recipe);
  const scenario = scenarioOf(recipe.scenarioId)!;
  const state = scenario.build(recipe.schedule.startAt);
  scenario.assert(state, recipe.schedule.startAt);
  const ctx: RunContext = {
    schedule: recipe.schedule,
    rng: seededRng(recipe.seed),
    events: [],
    trajectory: [],
    claims: [],
    achievements: [],
    discovered: [],
    credited: 0,
    breatherSeconds: 0,
    sessionNous: 0,
    breatherNous: 0,
    elapsedMs: recipe.schedule.startAt,
    lastDecline: null,
    lastMilestone: null,
  };

  let days = 0;
  let complete = false;
  let stop: PlaythroughRecord["stop"] = {
    kind: "budget",
    reason: `The ${recipe.budgetDays}-day budget ended before the first prestige.`,
  };
  day: for (let day = 0; day < recipe.budgetDays; day++) {
    days = day + 1;
    for (let session = 0; session < recipe.schedule.sessionsPerDay; session++) {
      // The prompt policy checks the door at every between-sessions moment
      // — before the break's purchases, so a reached horizon is never
      // spent into levels a prestige would wipe.
      if (tryPrestige(ctx, state)) {
        complete = true;
        stop = { kind: "prestige", reason: `First prestige at day ${days}.` };
        break day;
      }
      manage(ctx, state);
      runSession(ctx, state, day, session);
    }
  }
  if (!complete && horizonReached(state)) {
    // The budget ended between sessions with the door already open — one
    // last prompt check before calling the run incomplete.
    if (tryPrestige(ctx, state)) {
      complete = true;
      stop = { kind: "prestige", reason: `First prestige at day ${days}.` };
    }
  }
  const lastSessionLabel = [...ctx.events].reverse().find((event) => event.kind === "session")?.label ?? null;
  const bottleneck = complete
    ? null
    : ctx.lastDecline
      ? `${stop.reason} Last decline — ${ctx.lastDecline}.`
      : `${stop.reason} No action was declined — practice rate alone did not reach the horizon.`;
  return {
    kind: "representative",
    runId: playthroughRunId(recipe, source),
    recipe,
    source,
    policy: { id: PROMPT_POLICY.id, name: PROMPT_POLICY.name },
    complete,
    stop,
    claims: ctx.claims,
    days,
    elapsedSeconds: Math.round((ctx.elapsedMs - recipe.schedule.startAt) / 1000),
    creditedSeconds: Math.round(ctx.credited),
    breatherSeconds: Math.round(ctx.breatherSeconds),
    earnedNous: ctx.sessionNous + ctx.breatherNous,
    lastMilestone: ctx.lastMilestone ?? lastSessionLabel,
    bottleneck,
    events: ctx.events,
    trajectory: ctx.trajectory,
    achievements: ctx.achievements,
    worldDiscoveries: ctx.discovered,
    state,
  };
}

// The result's one-line read: the ✓/✗ shape the suite's notes carry, with
// the figures that matter — both clocks, the claim, the identity, and on
// an incomplete run the honest stop. Measurements and explicit outcomes
// only; never a pacing verdict (story 37).
export function playthroughNote(record: PlaythroughRecord): string {
  const credited = Math.round(record.creditedSeconds / 60);
  const elapsed = Math.round(record.elapsedSeconds / 60);
  const base =
    `${record.policy.name} ${record.complete ? "✓" : "✗"} ` +
    `${record.days}d · ${credited}m credited of ${elapsed}m elapsed · ` +
    `claim ${record.claims.join(", ") || "none"} Arete · ` +
    `seed ${record.recipe.seed} · ${record.recipe.scenarioId} · ${record.runId}`;
  if (record.complete) return `${base} · ${record.stop.reason}`;
  return `${base} · ${record.lastMilestone ?? "no milestone"} · ${record.bottleneck ?? record.stop.reason}`;
}
