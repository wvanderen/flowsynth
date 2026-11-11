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
  buyRowUnlock,
  buyShelfModule,
  chooseMutatorRoll,
  chooseRoll,
  dismissSummary,
  endBreather,
  endSession,
  placeModule,
  placeWorldOccupant,
  prestige,
  retrieveWorldOccupant,
  startBreather,
  startSession,
  upgradeModuleLevels,
} from "./actions";
import type { ActionResult } from "./actions";
import { frontier, seededRng } from "./capacity-calibration";
import { BALANCE, CATEGORY_OF, isOscillatorType, RESPONSE_CURVES, responseCurveCandidateOf, SAVE_VERSION, SHELF_TYPES, WORLD_ENEMIES } from "./constants";
import { isModuleCandidate } from "./types";
import type { WorldEnemyDef } from "./constants";
import { chargeLineCells } from "./playthrough-placement";
import { affordableLevels, syncRates, wholeNous, levelsCost } from "./economy";
import { rowUnlockCost, unlockableRows } from "./catalog";
import { activeGoalOf, createGoal, rollGoalOccurrences } from "./goals";
import { createHabit, selectHabit } from "./habits";
import { adjacent, hexDistance, sameHex } from "./hex";
import { cellNoteOf, octaveRowOf } from "./lattice";
import { neighbors } from "./hex";
import { writeNote } from "./notes";
import { SCENARIOS, scenarioOf } from "./scenarios";
import { deserialize, serialize } from "./save";
import { columnCost, enemyDefAt, enemyDefeated, honeCostOf, worldOccupantAt, hasActiveWorldEnemy, eligibleTargetsOf } from "./world";
import type { GameState, Hex, ModuleInstance, ModuleType, ResponseCurveId, WeaponType } from "./types";

// The reproducible playthrough runner (issues #468/#469/#472, parent
// #465): a recipe declares every behavior-affecting input — starting
// scenario, seed, player policy, practice schedule, time budget, claim
// target, calendar anchor, and the declared tuning overrides — and the
// runner walks it through the real engine actions on a real session
// schedule: two 25-minute daily sessions, a five-minute breather, one
// practice habit with a daily goal, and honest overnight gaps where
// upgrade mode produces and credits nothing. The prompt policy prestiges
// at the first between-sessions moment the horizon is reached; the
// first-eligibility claim banks zero Arete under the frontier curve, and
// that zero stands rather than being topped up. The pushing policy shares
// the prompt policy's every purchase rule and the same schedule, but never
// prestiges at the first eligibility: it pushes until the pending claim
// reaches its configured target, then banks, and its record follows the
// next era through earned-Arete spending, World placement and purchases,
// and the worthwhile-prestige journey (issue #490): the first bank's
// claim, the lasting purchase it funded, the starter World rig's
// deployment, the two recovery measures — regaining the first era's
// pre-reset production and reaching prestige eligibility again — and the
// frontier advancing beyond the claimed frontier, each timed on both
// clocks. Eligibility alone is never the journey: a zero-claim reset
// banks its honest zero and the journey marks stay explicitly unreached.
// The same walk carries the progression checkpoints (issue #471):
// declared between-sessions stops — the door approaching, the first earned
// bank, the World's living fight — whose halted state is the progression
// presets' ground, reached by the walk rather than built by hand. Overrides
// (issue #472) are declared, validated tuning values — magnitudes only,
// never new mechanics — confined to the walk's own candidate state; the
// same declarations serve the terminal command and the visual controls.
// Nothing here grants resources; an exhausted budget is an explicit
// incomplete result with the last milestone, the bottleneck, and the
// declined actions' reasons — and a missing recovery measure is an
// explicit unreached mark, never a fabricated one. The session loop's
// prior art is the calibration walk (#262) — its seeded rng and
// frontier/preview patterns are reused, its compressed fictional time is
// not: schedule and day accounting are this module's own, and the
// calibration run remains the economy-only kind this record's kind line
// distinguishes itself from.

// The runner's own version: a behavior-affecting change here is a source
// change, and a rerun against different source identifies separately
// (story 36's foundation). The declared override set (issue #472) rides
// the recipe, so this bump records the walk's new inputs; the response
// curve (issue #487) joins them; the worthwhile-prestige journey marks
// (issue #490) change what the walk measures and when it completes; the
// later-era ledger, the eras recipe input, and the three World-comparison
// policies (issue #491) join both. The declared credited-flow stop
// (issue #492) — a century walk's terminal and its banking gates — joins
// them too.
export const PLAYTHROUGH_RUNNER_VERSION = 15;

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
    "Buy board cells while affordable, nearest first along the compact frontier; after the World's entry, a locked octave row the board reaches opens through the Catalog's Rack Extenders before the expansion continues (issue #492).",
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
    "Each weapon deploys beside the fight: an owned cell next to a living discovered enemy, preferring a cell that also touches a placed Column, nearest the enemy first; while no enemy lives, the weapon waits in the tray. A weapon whose fight is won relocates to the next living discovered enemy, and a Column the fight left behind follows the charge line — relocation is free between sessions.",
    "Each Column deploys on the charge line: an owned cell next to a deployed generator, preferring a cell that also touches a placed weapon.",
    "Ends every session at its planned target and writes a practice note.",
  ],
};

// The World-comparison policies (issue #491, parent #484's declared
// support-seeking / combat-engaging / enemy-ignoring trio). All three buy
// what the prompt policy buys and push claims exactly like the pushing
// policy; they differ only in the World faces — which lasting purchases
// they make in what order, and whether they ever deploy. The comparison's
// reading lives in the evaluation that walks them; the policies only
// declare the behavior.
export const SUPPORT_POLICY: PlaythroughPolicy = {
  id: "support",
  name: "Support-seeking",
  rules: [
    "Buys exactly what the prompt policy buys, by the same rules, on the same schedule, and pushes claims like the pushing policy.",
    "Once the World is entered it pays the Catalog entry first, then Charge Columns while affordable, then Hone ranks cheapest-first — the charge line before the blade; the discount and ceiling offerings wait for what remains.",
    "The weapon takes the fight-adjacent seat that also touches a placed Column when one exists; the Column takes a charge line — a cell whose module receives charge — preferring one that touches the placed weapon. A weapon whose fight is won relocates to the next living discovered enemy, and a Column the fight left behind follows it when a charge line touches the new fight.",
    "Ends every session at its planned target and writes a practice note.",
  ],
};

export const COMBAT_POLICY: PlaythroughPolicy = {
  id: "combat",
  name: "Combat-engaging",
  rules: [
    "Buys exactly what the prompt policy buys, by the same rules, on the same schedule, and pushes claims like the pushing policy.",
    "Once the World is entered it pays the Catalog entry first, then Hone ranks cheapest-first while affordable, then Charge Columns while affordable — the blade before the charge line; the discount and ceiling offerings wait for what remains.",
    "Each weapon deploys beside the fight immediately; each Column deploys on the charge line. A weapon whose fight is won relocates to the next living discovered enemy, and a Column the fight left behind follows the charge line — relocation is free between sessions.",
    "Ends every session at its planned target and writes a practice note.",
  ],
};

export const IGNORING_POLICY: PlaythroughPolicy = {
  id: "ignoring",
  name: "Enemy-ignoring",
  rules: [
    "Buys exactly what the prompt policy buys, by the same rules, on the same schedule, and pushes claims like the pushing policy.",
    "Never buys or deploys a World occupant: the starter weapon stays in the tray, and every discovered enemy's pressure stands for the whole era — the postponed-combat trade-off, paid in production.",
    "Pays the Catalog entry, then the discount and ceiling offerings, while affordable.",
    "Ends every session at its planned target and writes a practice note.",
  ],
};

export const PLAYTHROUGH_POLICIES: readonly PlaythroughPolicy[] =
  [PROMPT_POLICY, PUSHING_POLICY, SUPPORT_POLICY, COMBAT_POLICY, IGNORING_POLICY];

function policyOf(id: string): PlaythroughPolicy {
  return PLAYTHROUGH_POLICIES.find((policy) => policy.id === id) ?? PROMPT_POLICY;
}

// ── The declared tuning overrides (issue #472, parent stories 31–32) ──

// One tunable magnitude: what it names, what it does, the range a recipe
// may declare, and the shipped default a blank carries. Magnitudes only —
// no new mechanic definitions, no arbitrary code; the walk applies each
// through the engine's own parameterized seam, and every other reader of
// the constant keeps the shipped value.
export interface PlaythroughTuningParam {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

export const PLAYTHROUGH_TUNING: readonly PlaythroughTuningParam[] = [
  {
    key: "openingGrant",
    name: "Opening grant",
    description: "The ν grant each era start pays — the run's first moment on a fresh start, and every prestige reset.",
    min: 0,
    max: 120,
    default: BALANCE.openingGrant,
  },
  {
    key: "claimBase",
    name: "Frontier claim base",
    description: "The Arete the frontier claim curve pays at the World's entry depth — the pushing bank's floor.",
    min: 1,
    max: 36,
    default: BALANCE.world.claimBase,
  },
];

function tuningParamOf(key: string): PlaythroughTuningParam | null {
  return PLAYTHROUGH_TUNING.find((param) => param.key === key) ?? null;
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
  // How many claimed frontiers the walk banks before its declared stop
  // (issue #491): one era ledger closes per bank, and the walk completes
  // when the worthwhile-prestige journey has carried and `eras` ledgers
  // have closed. 1 — the default — keeps the journey's own stop: the bank
  // that advanced the frontier past the claimed frontier. A larger figure
  // walks repeated productive eras: every later bank records its era's
  // span, its banked claim, the strictly larger frontier, and the
  // familiar/new territory split, and the walk completes when the last
  // declared era's bank lands. A budget that outlives them leaves the
  // open era explicitly open in the record.
  readonly eras: number;
  // The declared credited-flow stop (issue #492): a century-scale walk's
  // terminal. Zero — the default — keeps every stop the walk already
  // declares: the prompt door, the worthwhile-prestige journey, the era
  // count, the budget. A positive figure declares the credited-flow mark
  // in credited hours: the walk completes at the first between-sessions
  // moment the credited clock reaches it, era ledgers keep closing per
  // the policy's own banking rule at every door until then, and the era
  // count stops being a completion gate — a walk that banks its declared
  // frontiers before the mark keeps walking, and one whose economy stops
  // banking records the exhausted stretch as evidence, not silence.
  readonly stopCreditedHours: number;
  // The declared response-curve candidate (issue #487): which supported
  // curve the walk's Chorus/Exciter response grants read — shipped by
  // default, never a silent shipped read for a misspelled candidate. The
  // curve rides the recipe so run identity, the artifact, and every
  // comparison report name it.
  readonly responseCurve: ResponseCurveId;
  // The declared tuning overrides (issue #472): validated magnitudes from
  // the declared catalog, confined to this run's own candidate state —
  // never the live state, the save, or any other reader of the constant.
  // Empty carries the shipped tuning.
  readonly overrides: Record<string, number>;
}

// The default recipe: two 25-minute daily flow sessions with a
// five-minute breather on one practice — the fixture baseline, not a
// typical-player claim (#465's implementation decisions). The claim target
// defaults to 2 — the first positive claim the frontier curve pays, at the
// World's entry depth.
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
    eras: 1,
    stopCreditedHours: 0,
    responseCurve: "shipped",
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
  eras?: number;
  stopCreditedHours?: number;
  responseCurve?: ResponseCurveId;
  overrides?: Record<string, number>;
}

// The composition seam the app command uses: the default recipe patched by
// an explicit input, validated with named failures. Unknown input keys are
// rejected — an unsupported request never quietly runs a default.
export function composePlaythroughRecipe(input: PlaythroughRecipeInput = {}): PlaythroughRecipe {
  const known = new Set(["scenarioId", "seed", "policyId", "claimTarget", "schedule", "budgetDays", "eras", "stopCreditedHours", "responseCurve", "overrides"]);
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
    ...(input.eras !== undefined ? { eras: input.eras } : {}),
    ...(input.stopCreditedHours !== undefined ? { stopCreditedHours: input.stopCreditedHours } : {}),
    ...(input.responseCurve !== undefined ? { responseCurve: input.responseCurve } : {}),
    ...(input.overrides !== undefined ? { overrides: input.overrides } : {}),
    schedule: { ...base.schedule, ...(input.schedule ?? {}) },
  };
  return validatePlaythroughRecipe(recipe);
}

export function validatePlaythroughRecipe(recipe: PlaythroughRecipe): PlaythroughRecipe {
  const fail = (why: string): never => {
    throw new Error(`Playthrough recipe: ${why}`);
  };
  // The overrides first, so a run with a bad tuning input is refused
  // before anything else is read — an unsupported, invalid, or
  // inapplicable override never looks run (stories 31–32).
  for (const [key, value] of Object.entries(recipe.overrides)) {
    const param = tuningParamOf(key);
    if (param === null) {
      fail(`override "${key}" is not supported — the suite offers ${PLAYTHROUGH_TUNING.map((p) => p.key).join(", ")}.`);
      // fail throws; the continue narrows param for the checks below.
      continue;
    }
    if (!Number.isInteger(value) || value < param.min || value > param.max) {
      fail(`override "${key}" must be a whole number ${param.min}–${param.max} — found ${value}.`);
    }
  }
  if (recipe.overrides.claimBase !== undefined && recipe.policyId === PROMPT_POLICY.id) {
    fail('override "claimBase" is inapplicable — the prompt policy banks at the first horizon crossing, where the frontier curve has not opened yet.');
  }
  // The declared response curve (issue #487): supported candidates only,
  // rejected by name — a misspelled candidate never quietly walks shipped.
  if (!responseCurveCandidateOf(recipe.responseCurve)) {
    fail(`response curve "${String(recipe.responseCurve)}" is not supported — the suite offers ${RESPONSE_CURVES.map((curve) => curve.id).join(", ")}.`);
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
  if (!Number.isInteger(recipe.eras) || recipe.eras < 1 || recipe.eras > 12) {
    fail(`eras must be a whole number 1–12 — found ${recipe.eras}.`);
  }
  if (!Number.isInteger(recipe.stopCreditedHours) || recipe.stopCreditedHours < 0 || recipe.stopCreditedHours > 800) {
    fail(`stopCreditedHours must be a whole number 0–800 — found ${recipe.stopCreditedHours}.`);
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

// ── The progression checkpoints (issue #471, parent #465) ──

// A declared stop inside a declared walk: the moment a progression preset
// is. Each checkpoint names the between-sessions moment it halts on, and
// the situation it stops in is the same words its preset declares — the
// walk is the only thing that can reach it.
export type PlaythroughCheckpointId = "approaching-prestige" | "after-first-bank" | "world-enemy-active";

export interface PlaythroughCheckpoint {
  readonly id: PlaythroughCheckpointId;
  readonly name: string;
  // The intended situation, one line: what the stopped state is for.
  readonly situation: string;
}

export const PLAYTHROUGH_CHECKPOINTS: readonly PlaythroughCheckpoint[] = [
  {
    id: "approaching-prestige",
    name: "Approaching prestige",
    situation: "an established board with the first prestige door open",
  },
  {
    id: "after-first-bank",
    name: "After first bank",
    situation: "immediately after the first prestige, its earned Arete unspent",
  },
  {
    id: "world-enemy-active",
    name: "World enemy",
    situation: "a living discovered enemy with the placement decision unplayed",
  },
];

function checkpointOf(id: PlaythroughCheckpointId): PlaythroughCheckpoint {
  return PLAYTHROUGH_CHECKPOINTS.find((checkpoint) => checkpoint.id === id)!;
}

// The checkpoints' declared recipes (parent story 8's reachability
// evidence, carried verbatim on each preset): the approaching door rides
// the suite's baseline schedule — the prompt walk opens it around day
// nine — while the earned bank and the World's fight push past the World
// entry depth, beyond what the baseline's credited practice banks before
// the door, so they declare the pushing fixture's own
// long-session schedule: two 600-minute daily sessions on the same
// five-minute breather, the shape the pushing tests ride. Both are
// fixtures — declared, not typical-player claims — and the preset's
// provenance names exactly how its situation was reached.
export const APPROACHING_PRESTIGE_RECIPE: PlaythroughRecipe = {
  ...defaultPlaythroughRecipe(),
  budgetDays: 15,
};

export const PUSHING_CHECKPOINT_RECIPE: PlaythroughRecipe = {
  ...defaultPlaythroughRecipe(),
  policyId: PUSHING_POLICY.id,
  claimTarget: 2,
  budgetDays: 36,
  schedule: {
    ...defaultPlaythroughRecipe().schedule,
    sessionsPerDay: 2,
    sessionMinutes: 600,
    breatherMinutes: 5,
  },
};

export function checkpointRecipeOf(id: PlaythroughCheckpointId): PlaythroughRecipe {
  return id === "approaching-prestige" ? APPROACHING_PRESTIGE_RECIPE : PUSHING_CHECKPOINT_RECIPE;
}

// The World decision pending (issue #471): a discovered enemy still lives
// and an owned occupant — weapon or Column — waits in the tray. Read at
// the between-sessions moment after the prestige door's check and before
// any spending, placement, or recovery bookkeeping touches the era, so
// the stopped state is the decision itself, unplayed.
function worldDecisionPending(state: GameState): boolean {
  const living = hasActiveWorldEnemy(state);
  const waiting =
    state.world.weapons.some((weapon) => weapon.pos === null) ||
    state.world.columns.some((column) => column.pos === null);
  return living && waiting;
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

// Vite's importGlob never matches the importing module itself (its
// `file !== id` filter, issue #503) — and that holds in dev, build, and
// test alike, so the glob below alone never carried playthrough.ts's own
// bytes: edits to this file left the fingerprint flat. The explicit raw
// twin restores the self entry. `?raw` serves the file's exact bytes in
// every path — the dev watcher invalidates it with the file under hot
// reload, builds embed the content, and vitest reads disk per run — so
// one identity holds across all three. Test files are excluded.
import engineSelfSource from "./playthrough.ts?raw";

const engineFiles: Record<string, string> = {
  ...import.meta.glob<string>(["./**/*.ts", "!./**/*.test.ts"], {
    query: "?raw", import: "default", eager: true,
  }),
  "./playthrough.ts": engineSelfSource,
};

function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// The digest's exact input: every engine module's path beside its raw
// bytes, sorted. Exported so the sensitivity test can edit a scratch copy
// of this input and watch the digest move without touching real files
// (issue #503) — editing a real engine file mid-suite would leak a
// different fingerprint into every other test file in the run.
export function playthroughSourceEntries(): Array<readonly [string, string]> {
  return Object.keys(engineFiles).sort().map((path) => [path, engineFiles[path]!] as const);
}

export function playthroughSourceDigest(entries: ReadonlyArray<readonly [string, string]>): string {
  return fingerprint(JSON.stringify(entries));
}

export function playthroughSource(): PlaythroughSource {
  return {
    game: "flowsynth", saveVersion: SAVE_VERSION,
    runnerVersion: PLAYTHROUGH_RUNNER_VERSION,
    engineSource: playthroughSourceDigest(playthroughSourceEntries()),
  };
}

// Stable identity: the same recipe and source share one run id; a changed
// input or source changes it. A checkpoint walk carries its declared stop
// in the identity too — the same recipe walked to a different terminal is
// a different record. A plain FNV-1a keeps the identity free of wall-clock
// stamps and platform hash variance.
export function playthroughRunId(
  recipe: PlaythroughRecipe,
  source: PlaythroughSource,
  checkpoint: PlaythroughCheckpointId | null = null,
): string {
  const text = JSON.stringify({ recipe, source, ...(checkpoint ? { checkpoint } : {}) });
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
// store; historical selection alone picks which snapshot is inspected. A
// stamp's actions take no simulated time, so every event of one stamp
// resolves to that stamp's one closing state — the exact recorded board
// at the moment they all carry, never a neighboring break's.
//
// Bounded retention (issue #509) carries the same moment as figures: a
// batch walk declares `retention: "bounded"` and its snapshots keep the
// numbers every report read consumes while the board itself is dropped —
// `state` null, `voices` empty — so historical retention stops growing
// with the board. Bounded records are explicitly not interactive
// artifacts: inspection and artifact export refuse them by name, and the
// numerical-integrity verdicts move to capture time (recorded per
// snapshot in `numbers`), so the evidence survives the drop.
export interface PlaythroughSnapshotNumbers {
  readonly nous: number;
  readonly eraEarned: number;
  readonly totalEarned: number;
  readonly arete: number;
  readonly prestiges: number;
  readonly frontier: number;
  readonly maxLevel: number;
  readonly maxAbsReserve: number;
  // The whole-state finite read, taken at capture on the exact cloned
  // state — the numerical-integrity figure both retentions report.
  readonly finite: boolean;
  // The serialized round-trip verdicts taken at capture, bounded records
  // only: every tenth recorded state and every bank boundary, so the
  // save seam's evidence survives the dropped boards. Complete records
  // check the same stride at report time off their retained states and
  // carry zeros here.
  readonly serializedChecks: number;
  readonly serializedOk: number;
}

export interface PlaythroughSnapshot {
  readonly rate: number;
  readonly voices: readonly PlaythroughBoardVoice[];
  // Simulated elapsed seconds since the anchor — the plotted x.
  readonly elapsed: number;
  readonly credited: number;
  // The captured figures, computed at capture from the exact cloned state
  // — the one store every batch read consumes, both retentions alike.
  readonly numbers: PlaythroughSnapshotNumbers;
  // The whole recorded state, complete records only; bounded retention
  // drops the board and carries null (voices ride along as empty).
  readonly state: GameState | null;
}

// The curve markers (story 27): every recorded event classifies into the
// plotted marker classes or plots none. Purchases are the buys — shelf,
// cells, the Arete and World offerings, the capacity rungs; unlocks are
// the acquisitions and discoveries — roll acceptances, feats, World
// finds; sessions plot as the full session boundary; breathers plot as
// their own tick; prestige is the bank. Placement and upgrade gestures
// and the pacing marks plot none: they stay lines of the decisions list.
// Declined attempts plot none — their reasons live in the record.
export type PlaythroughMarker = "purchase" | "unlock" | "session" | "breather" | "prestige";

export function playthroughEventMarker(event: PlaythroughEvent): PlaythroughMarker | null {
  if (!event.ok) return null;
  if (event.kind === "purchase" || event.kind === "arete") return "purchase";
  if (event.kind === "world") return event.label.startsWith("Placed") ? null : "purchase";
  if (event.kind === "roll") return "unlock";
  if (event.kind === "milestone") {
    if (event.label.startsWith("Poly Expander")) return "purchase";
    if (event.label.startsWith("Feat unlocked") || event.label.startsWith("World —")) return "unlock";
    return null;
  }
  if (event.kind === "session") return "session";
  if (event.kind === "breather") return "breather";
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

// The next era's worthwhile-prestige ledger (stories 24–25, issue #490):
// what the first prestige banked and what its reward demonstrably funded,
// measured from the prestige moment on both clocks. Null until the run's
// first prestige — a run that never banks never recovers. The marks make
// eligibility distinguishable from a worthwhile reset: the claim figure
// (the first bank's banking), the lasting purchase it funded, the starter
// World rig's deployment (weapon beside the fight, Column on the charge
// line), the two recovery measures, and the frontier advancing beyond the
// claimed frontier. A zero-claim reset carries claim zero and null marks —
// honest, never topped up. A mark the budget outlives stays explicitly
// null.
export interface PlaythroughRecovery {
  // Whole-board ν/s immediately before the first prestige.
  readonly preResetRate: number;
  // The first bank's claim — zero at the eligibility door.
  readonly claim: number;
  // The first lasting Arete purchase after the bank (the Catalog entry,
  // a capacity offering, a Charge Column, a Hone rank) and what it was.
  readonly lastingPurchase: PlaythroughRecoveryMark | null;
  readonly lastingPurchaseLabel: string | null;
  // The starter weapon deployed beside a living discovered enemy.
  readonly weaponDeployed: PlaythroughRecoveryMark | null;
  // The first Charge Column deployed on the charge line.
  readonly columnDeployed: PlaythroughRecoveryMark | null;
  // When the next era's board first produced at least that rate again.
  readonly productionRegained: PlaythroughRecoveryMark | null;
  // When the next era first reached prestige eligibility again.
  readonly eligibilityReached: PlaythroughRecoveryMark | null;
  // When a later bank advanced the frontier beyond the first bank's
  // claim — progress into the next frontier, not merely recovery of the
  // old one.
  readonly frontierAdvanced: PlaythroughRecoveryMark | null;
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
  readonly rowUnlocks: number;
  readonly hone: Record<WeaponType, number>;
}

// The result. The kind line is the honest one: this walk rode the real
// session schedule, practice accounting, and engine actions — it is not
// the economy-only simulation the calibration runner performs (story 13).
export interface PlaythroughRecord {
  readonly kind: "representative" | "continuation";
  readonly runId: string;
  readonly recipe: PlaythroughRecipe;
  readonly source: PlaythroughSource;
  readonly policy: { readonly id: string; readonly name: string };
  readonly complete: boolean;
  // "prestige" is the prompt door; "recovered" is the pushing run's
  // completed worthwhile-prestige journey — the bank, the lasting
  // purchase, the deployed starter rig, both recovery measures, and the
  // frontier advanced past the claimed frontier. "budget" is the explicit
  // incomplete outcome (story 21). "checkpoint" is a declared progression
  // checkpoint's stop (issue #471) — the walk halted exactly where its
  // preset's situation lives. "frontier" is the multi-era walk's declared
  // stop (issue #491): every claimed frontier the recipe declared has
  // banked, each era's ledger closed against a strictly larger frontier.
  // "century" is the declared credited-flow stop (issue #492): the
  // credited clock reached the recipe's mark at a between-sessions
  // moment — the run is complete, whatever the era ledger shows.
  readonly stop: { readonly kind: "prestige" | "recovered" | "budget" | "checkpoint" | "frontier" | "century"; readonly reason: string };
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
  // The management opportunities the schedule gave the policy: one per
  // between-sessions break the walk played (issue #490's separate
  // recording — session length and management density are the two clocks
  // a session shape moves).
  readonly manageBreaks: number;
  // Every ν the run banked — sessions and their breathers together — the
  // figure the no-grants guarantee is checked against, with the two
  // sources recorded separately (issue #490: breather production is its
  // own figure, never folded into the sessions' unseen).
  readonly earnedNous: number;
  readonly sessionNous: number;
  readonly breatherNous: number;
  // The authored era-start grants the run's resets paid — the opening
  // grants and, from the first banked claim on, the claim grants (issue
  // #484). Grants bypass `totalEarned` (they are authored intake, never
  // earned production), so the no-grant read stays between the wallet's
  // earned production and the sessions' and breathers' recorded figures;
  // this ledger names the grants separately so a run can never pass its
  // integrity check by forgetting them.
  readonly grantNous: number;
  readonly lastMilestone: string | null;
  // Incomplete runs only: what the budget ran out against, with the last
  // declined action's reason (story 22).
  readonly bottleneck: string | null;
  readonly events: readonly PlaythroughEvent[];
  readonly trajectory: readonly PlaythroughTrajectoryPoint[];
  // The exact recorded states (issue #470): one per plotted sample, one at
  // every session boundary, one at every moment the action record stamps —
  // every event's `snapshot` and every point's `snapshot` resolves here.
  // Complete retention carries each snapshot's whole frozen state;
  // bounded retention (issue #509) carries the captured figures and
  // drops the boards.
  readonly snapshots: readonly PlaythroughSnapshot[];
  readonly achievements: readonly string[];
  readonly worldDiscoveries: readonly string[];
  readonly worldDefeats: readonly string[];
  // The next era's worthwhile-prestige ledger (stories 24–25, issue
  // #490): null until the run's first prestige, then the pre-reset rate,
  // the banked claim, and every journey mark — the unreached ones
  // explicitly null.
  readonly recovery: PlaythroughRecovery | null;
  // The walked eras' ledgers (issue #491): one per era the walk opened —
  // the opening era at index 0, one more per bank — each closed at its own
  // bank or explicitly open at the stop. A prompt run banks its honest
  // zero: era 0 closes with claim zero and the frontier unadvanced.
  readonly eras: readonly PlaythroughEraLedger[];
  // The run's final state — the ground truth behind every figure.
  readonly state: GameState;
  // The historical retention the walk declared (issue #509): "complete"
  // keeps every snapshot's whole frozen state — the interactive artifact
  // record, inspectable and exportable; "bounded" keeps the captured
  // figures and drops the boards, so a batch recording's memory stops
  // growing with the board. A bounded record refuses inspection and
  // artifact export by name — it never masquerades as a complete one.
  readonly retention: PlaythroughRetention;
}

interface RunContext {
  schedule: PlaythroughSchedule;
  claimTarget: number;
  // True for every claim-pushing policy — pushing and the three
  // World-comparison policies (issue #491); only the prompt policy banks
  // at the first eligibility door instead.
  claimsPushing: boolean;
  // The declared era count (issue #491): the claimed frontiers the walk
  // banks before its completion read.
  eraGoal: number;
  // The declared credited-flow stop (issue #492): the century mark in
  // credited seconds, or null when the recipe declares none and the
  // walk's own stops stand.
  centuryStopSeconds: number | null;
  continuation: boolean;
  // The declared overrides (issue #472): the run's own tuning, read
  // nowhere else — the candidate state carries them, nothing shared does.
  openingGrant: number | undefined;
  claimBase: number | undefined;
  rng: () => number;
  events: PlaythroughEvent[];
  trajectory: PlaythroughTrajectoryPoint[];
  // The exact recorded states, and the events awaiting their binding: an
  // event is stamped before the moment's snapshot is taken, so it opens
  // here and the next snapshot closes it.
  snapshots: PlaythroughSnapshot[];
  openEvents: number[];
  claims: number[];
  areteSpent: { entry: number; discounts: number; ceilings: number; columns: number; rowUnlocks: number; hone: Record<WeaponType, number> };
  achievements: string[];
  discovered: string[];
  defeated: string[];
  credited: number;
  // The credited stamp mid-session (issue #491): the closed sessions' total
  // plus the running session's credited-so-far — the exact figure a
  // mid-session stamp carries, equal to `credited` at every between-
  // sessions moment. The walk's spans are all live, so the running
  // session's accrual is monotone and exact.
  stampCredited: number;
  sessionCreditedBase: number;
  breatherSeconds: number;
  sessionNous: number;
  breatherNous: number;
  grantNous: number;
  elapsedMs: number;
  lastDecline: string | null;
  lastMilestone: string | null;
  // The worthwhile-prestige ledger (stories 24–25, issue #490): armed at
  // the run's first prestige with the pre-reset rate and the frontier it
  // banked against, then settled at every between-sessions moment and
  // purchase until every journey mark carries its mark.
  preResetRate: number | null;
  prestigeElapsedMs: number;
  prestigeCredited: number;
  frontierAtBank: number | null;
  lastingPurchase: PlaythroughRecoveryMark | null;
  lastingPurchaseLabel: string | null;
  weaponDeployed: PlaythroughRecoveryMark | null;
  columnDeployed: PlaythroughRecoveryMark | null;
  productionRegained: PlaythroughRecoveryMark | null;
  eligibilityReached: PlaythroughRecoveryMark | null;
  frontierAdvanced: PlaythroughRecoveryMark | null;
  manageBreaks: number;
  // The walked eras (issue #491): one open entry at era 0 from the walk's
  // start, closed and followed by a new open entry at every bank.
  eras: EraTrack[];
  // The policy's World spending order (issue #491): "offerings-first" is
  // the shipped prompt/pushing order; the comparison policies ride their
  // own; "none" never touches the World faces.
  worldOrder: "offerings-first" | "support-first" | "combat-first" | "none";
  // The declared historical retention (issue #509): "complete" freezes and
  // keeps every snapshot's state; "bounded" drops the board after the
  // capture read and moves the serialized stride checks to capture time.
  retention: PlaythroughRetention;
}

// The runner's mutable era tracker: everything the public
// PlaythroughEraLedger carries plus the crossing flag the per-step split
// reads. An era opens at the walk's start (era 0) or at its bank (the next
// index), and closes at its own bank.
interface EraTrack {
  index: number;
  startElapsedMs: number;
  startCredited: number;
  priorDepth: number | null;
  priorRate: number | null;
  depthCrossed: boolean;
  familiarCredited: number;
  newCredited: number;
  productionRegained: PlaythroughRecoveryMark | null;
  priorDepthPassed: PlaythroughRecoveryMark | null;
  claim: number | null;
  frontierAfter: number | null;
  endElapsedMs: number | null;
  endCredited: number | null;
  finite: boolean | null;
  discovered: string[];
  defeated: string[];
}

function openEraTrack(index: number, startElapsedMs: number, startCredited: number): EraTrack {
  return {
    index,
    startElapsedMs,
    startCredited,
    priorDepth: null,
    priorRate: null,
    depthCrossed: false,
    familiarCredited: 0,
    newCredited: 0,
    productionRegained: null,
    priorDepthPassed: null,
    claim: null,
    frontierAfter: null,
    endElapsedMs: null,
    endCredited: null,
    finite: null,
    discovered: [],
    defeated: [],
  };
}

// The policy's World spending order (issue #491): the shipped policies
// keep the shipped order; the comparison policies ride their own.
function worldOrderOf(policyId: string): RunContext["worldOrder"] {
  if (policyId === SUPPORT_POLICY.id) return "support-first";
  if (policyId === COMBAT_POLICY.id) return "combat-first";
  if (policyId === IGNORING_POLICY.id) return "none";
  return "offerings-first";
}

// The public ledger of one walked era (issue #491), read off the tracker.
function eraLedgerOf(ctx: RunContext, era: EraTrack): PlaythroughEraLedger {
  return {
    index: era.index,
    startElapsed: Math.max(0, Math.round((era.startElapsedMs - ctx.schedule.startAt) / 1000)),
    startCredited: Math.round(era.startCredited),
    endElapsed: era.endElapsedMs === null ? null : Math.max(0, Math.round((era.endElapsedMs - ctx.schedule.startAt) / 1000)),
    endCredited: era.endCredited === null ? null : Math.round(era.endCredited),
    claim: era.claim,
    frontierAfter: era.frontierAfter,
    priorDepth: era.priorDepth,
    priorRate: era.priorRate,
    familiarCredited: Math.round(era.familiarCredited),
    newCredited: Math.round(era.newCredited),
    productionRegained: era.productionRegained,
    priorDepthPassed: era.priorDepthPassed,
    finite: era.finite,
  };
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
  ctx.events.push({ at: Math.round((ctx.elapsedMs - ctx.schedule.startAt) / 1000), credited: Math.round(ctx.stampCredited), ...event, snapshot: -1 });
  ctx.openEvents.push(ctx.events.length - 1);
  if (event.milestone && event.ok) ctx.lastMilestone = event.label;
}

// Deep-read-only (issue #470): every recorded state freezes whole, so a
// stray write through inspection — human or agent — fails loudly instead
// of rewriting evidence. The run artifact (issue #473) gives its imported
// copies the same treatment, so evidence that crossed a file boundary
// keeps the guarantee.
export function deepFreeze<T>(value: T): T {
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
function previewClone(state: GameState): GameState {
  const clone = structuredClone(state);
  syncRates(clone, false);
  return clone;
}

// The captured figures (issue #509): everything the batch reads consume,
// computed once at capture from the exact cloned state — the maxima the
// numeric read reports, the balances the per-hour trajectory plots, and
// the whole-state finite verdict, all from one walk over the clone.
function snapshotNumbersOf(state: GameState): PlaythroughSnapshotNumbers {
  let maxLevel = 0;
  let maxAbsReserve = 0;
  for (const module of state.modules) {
    maxLevel = Math.max(maxLevel, module.level);
    maxAbsReserve = Math.max(maxAbsReserve, Math.abs(module.reserve));
  }
  return {
    nous: state.nous,
    eraEarned: state.eraEarned,
    totalEarned: state.totalEarned,
    arete: state.arete,
    prestiges: state.prestiges,
    frontier: state.world.frontier,
    maxLevel,
    maxAbsReserve,
    finite: stateNumbersFinite(state),
    serializedChecks: 0,
    serializedOk: 0,
  };
}

// The capture read's costs (issue #509): what the recording profiler
// reports, separated from the simulation — clone/rate/freeze/figures time
// and, on bounded walks, the capture-time serialized round trips. captureMs
// INCLUDES serializeMs (the round trips run inside the same snap); the
// profiler's capture-only bucket is captureMs − serializeMs. Module-
// global like the allocation stats: the profiler resets it around a
// measured walk, production never does, and the record itself carries no
// timings so artifacts stay byte-stable.
export interface PlaythroughCaptureStats {
  captures: number;
  // Snapshots that kept their whole frozen state (complete retention).
  retainedStates: number;
  captureMs: number;
  serializeMs: number;
}

export const playthroughCaptureStats: PlaythroughCaptureStats = {
  captures: 0, retainedStates: 0, captureMs: 0, serializeMs: 0,
};

// The bounded stride's serialized round trip, at capture (issue #509):
// every tenth recorded state and every bank boundary rides the real save
// seam while the state is still in hand — a refusal or a drifted monetary
// field records as a failed verdict, never silently dropped evidence.
function captureSerializedCheck(captured: GameState, elapsedSeconds: number): { checks: number; ok: number } {
  const started = performance.now();
  let checks = 1;
  let ok = 0;
  try {
    const text = serialize(captured, elapsedSeconds * 1000);
    const loaded = deserialize(text, () => 0.5).state;
    ok = loaded !== undefined &&
      loaded.nous === captured.nous &&
      loaded.eraEarned === captured.eraEarned &&
      loaded.totalEarned === captured.totalEarned &&
      loaded.arete === captured.arete ? 1 : 0;
  } catch {
    // A refusal is the recorded failure this read exists to catch.
  }
  playthroughCaptureStats.serializeMs += performance.now() - started;
  return { checks, ok };
}

function snap(ctx: RunContext, state: GameState): number {
  const started = performance.now();
  const captured = previewClone(state);
  const rates = syncRates(captured, false);
  const numbers = snapshotNumbersOf(captured);
  const index = ctx.snapshots.length;
  const elapsed = Math.round((ctx.elapsedMs - ctx.schedule.startAt) / 1000);
  const bounded = ctx.retention === "bounded";
  // Bank boundaries ride the same detection the report-time stride uses:
  // the previous recorded state's prestige count moved.
  const isBank = index > 0 && ctx.snapshots[index - 1]!.numbers.prestiges < captured.prestiges;
  const serialized = bounded && (index % 10 === 0 || isBank)
    ? captureSerializedCheck(captured, elapsed)
    : { checks: 0, ok: 0 };
  const snapshot: PlaythroughSnapshot = {
    rate: rates.rate,
    voices: bounded ? [] : deepFreeze(captured.modules
      .filter(module => module.pos !== null)
      .sort((a, b) => a.pos!.r - b.pos!.r || a.pos!.q - b.pos!.q || a.id.localeCompare(b.id))
      .map(module => ({ type: module.type, note: cellNoteOf(module.pos!), level: module.level,
        nuPerSecond: rates.contributions.get(module.id)?.value ?? null }))),
    elapsed,
    credited: Math.round(ctx.stampCredited),
    numbers: { ...numbers, serializedChecks: serialized.checks, serializedOk: serialized.ok },
    state: bounded ? null : deepFreeze(captured),
  };
  playthroughCaptureStats.captures++;
  if (!bounded) playthroughCaptureStats.retainedStates++;
  playthroughCaptureStats.captureMs += performance.now() - started;
  ctx.snapshots.push(snapshot);
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
  const era = ctx.eras[ctx.eras.length - 1]!;
  for (const [key, enemy] of Object.entries(state.world.enemies)) {
    if (enemy.discovered && !era.discovered.includes(key)) {
      era.discovered.push(key);
      if (!ctx.discovered.includes(key)) ctx.discovered.push(key);
      record(ctx, {
        kind: "milestone",
        label: `World — enemy ${key} discovered`,
        ok: true,
        milestone: true,
      });
    }
    if (enemy.discovered && enemyDefeated(state, key) && !era.defeated.includes(key)) {
      era.defeated.push(key);
      if (!ctx.defeated.includes(key)) ctx.defeated.push(key);
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
  ctx.manageBreaks++;
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
      offer.candidates.find((c) => isModuleCandidate(c) && isOscillatorType(c.type)) ??
      offer.candidates.find((c) => isModuleCandidate(c) && CATEGORY_OF[c.type] === "generator") ??
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

  // Board cells, nearest first along the compact frontier. A locked
  // octave row the board reaches opens through the Catalog's Rack
  // Extenders
  // before the expansion continues (issue #492's calibration: the
  // six-row cap is part of the board's production ceiling, so every
  // policy reads the same expansion rule, declared here once). The
  // expansion opens after the World's entry — the Catalog door outranks
  // board space, and no row unlock ever spends the claim that would
  // first bank the World's entry.
  for (;;) {
    const unlockRow = state.catalogEntryOwned
      ? unlockableRows(state).find((row) =>
        state.cells.some((cell) => neighbors(cell).some((n) => octaveRowOf(n) === row)))
      : undefined;
    const unlockPrice = rowUnlockCost(state);
    if (unlockRow !== undefined && unlockPrice !== null && state.arete >= unlockPrice) {
      const result = buyRowUnlock(state, unlockRow);
      record(ctx, { kind: "arete", label: `Rack Extenders — row ${unlockRow}`, ...outcome(result) });
      if (!result.ok) {
        decline(ctx, `row unlock ${unlockRow}`, result.reason ?? "declined");
        break;
      }
      ctx.areteSpent.rowUnlocks++;
      continue;
    }
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

  // The World's door (story 24): a starter weapon granted, a claimed
  // frontier, or a discovered enemy. Prestige restores every enemy to
  // undiscovered, so a discovered-only gate would idle the whole next
  // era's spending while the claim's Arete sits in the bank; the door,
  // once entered, stays entered. The policy's spending order reads it.
  const worldEntered = state.world.starterWeaponGranted || state.world.frontier > 0 ||
    Object.values(state.world.enemies).some((enemy) => enemy.discovered);

  // The Arete offerings behind the Catalog entry (#262's playable path).
  // "When affordable" is the authored rule, read literally: a broke board
  // attempts nothing, so a long claim-less push records no wall of
  // declined nickels — the leg's first real refusal still lands with the
  // engine's own reason.
  if (!state.catalogEntryOwned && state.arete >= BALANCE.catalogEntryCost) {
    const result = buyCatalogEntry(state, ctx.rng);
    if (result.ok) {
      ctx.areteSpent.entry++;
      noteLastingPurchase(ctx, "Catalog entry");
    }
    record(ctx, { kind: "arete", label: "Catalog entry", ...outcome(result) });
    if (!result.ok) decline(ctx, "catalog entry", result.reason ?? "declined");
  } else if (state.catalogEntryOwned) {
    // The policy's own World spending order (issue #491): the comparison
    // policies buy their World line before the capacity offerings —
    // support the charge line before the blade, combat the blade before
    // the charge line — and the ignoring policy buys no World line at
    // all. The shipped order keeps the offerings first, below.
    if (ctx.worldOrder === "support-first" && worldEntered) {
      buyColumnsWhileAffordable(ctx, state);
      buyHoneWhileAffordable(ctx, state);
    }
    if (ctx.worldOrder === "combat-first" && worldEntered) {
      buyHoneWhileAffordable(ctx, state);
      buyColumnsWhileAffordable(ctx, state);
    }
    for (const [label, kind, attempt] of [
      ["Chord Catalysts", "discounts", () => buyCapacityDiscount(state)],
      ["Expansion Bays", "ceilings", () => buyCapacityCeiling(state)],
    ] as const) {
      const result = attempt();
      if (result.ok) {
        ctx.areteSpent[kind]++;
        noteLastingPurchase(ctx, label);
      }
      record(ctx, { kind: "arete", label: `Arete — ${label}`, ...outcome(result) });
      if (!result.ok) {
        decline(ctx, `arete ${label}`, result.reason ?? "declined");
        break;
      }
    }
  }

  // The World faces (story 24): purchases wait for the World's door and
  // an affordable price, the authored rule read literally — the shipped
  // order pays Charge Columns then Hone ranks after the capacity
  // offerings; the comparison policies paid their line above. Then every
  // occupant deploys through the real placement action: weapons beside
  // the fight, Columns on the charge line. The placement leg keeps its
  // readable preference order, never an optimizer.
  if (worldEntered && ctx.worldOrder !== "none") {
    if (ctx.worldOrder === "offerings-first") {
      buyColumnsWhileAffordable(ctx, state);
      buyHoneWhileAffordable(ctx, state);
    }
    placeWorldOccupants(ctx, state);
  }
  recordDiscoveries(ctx, state);
  settleRecovery(ctx, state);
  pushTrajectory(ctx, state);
}

// The World's purchase lines (story 24, shared by every spending order —
// issue #491): Charge Columns while affordable, then Hone ranks
// cheapest-first per owned weapon type. Every attempt rides the engine's
// own action gates; the leg's first real refusal lands with the engine's
// own reason, exactly where the shipped walk takes it.
function buyColumnsWhileAffordable(ctx: RunContext, state: GameState): void {
  for (;;) {
    if (state.arete < columnCost(state.world.columns.length)) {
      decline(ctx, "World Column", "Not enough Arete.");
      break;
    }
    const result = buyChargeColumn(state);
    if (result.ok) {
      ctx.areteSpent.columns++;
      noteLastingPurchase(ctx, "a Charge Column");
    }
    record(ctx, { kind: "world", label: "World Column", ...outcome(result) });
    if (!result.ok) {
      decline(ctx, "World Column", result.reason ?? "declined");
      break;
    }
  }
}

function buyHoneWhileAffordable(ctx: RunContext, state: GameState): void {
  for (const weapon of state.world.weapons) {
    for (;;) {
      const price = honeCostOf(state, weapon.type);
      if (price === null || state.arete < price) {
        decline(ctx, `Hone rank ${weapon.type}`, price === null ? "at its Hone ceiling" : "Not enough Arete.");
        break;
      }
      const result = buyHoneRank(state, weapon.type);
      if (result.ok) {
        ctx.areteSpent.hone[weapon.type] = (ctx.areteSpent.hone[weapon.type] ?? 0) + 1;
        noteLastingPurchase(ctx, `a Hone rank (${weapon.type})`);
      }
      record(ctx, { kind: "world", label: `Hone rank — ${weapon.type}`, ...outcome(result) });
      if (!result.ok) {
        decline(ctx, `Hone rank ${weapon.type}`, result.reason ?? "declined");
        break;
      }
    }
  }
}

// The World placement leg (story 24): each weapon deploys beside the fight
// — an owned cell adjacent to a living discovered enemy, preferring one
// that also touches a placed Column, nearest the enemy first — and each
// The World placement leg (story 24, the charge-line seat repaired by
// issue #491): the weapon deploys beside the fight — an owned cell
// adjacent to a living discovered enemy, preferring one that also touches
// a placed Column, nearest the enemy first — and the Column deploys on a
// charge line: a cell whose module can receive charge beside a charge
// source, preferring one that also touches the placed weapon, then the
// strongest line. Every policy deploys the weapon's fight before the
// charge line — a Column must never take the fight's only seat. Readable
// preference ranks, board order breaking ties; the engine's own placement
// action gates every seat (enemy-reserved cells refuse, one occupant per
// cell).
function placeWorldOccupants(ctx: RunContext, state: GameState): void {
  const living = WORLD_ENEMIES.filter((def) => {
    const live = state.world.enemies[def.key];
    return live?.discovered === true && !enemyDefeated(state, def.key);
  });
  const distanceToFight = (pos: Hex): number =>
    living.length > 0 ? Math.min(...living.map((def) => hexDistance(pos, def.pos))) : Number.POSITIVE_INFINITY;
  const free = (): Hex[] =>
    state.cells.filter((cell) => !enemyDefAt(cell) && !worldOccupantAt(state, cell));
  // The charge line's read (issue #491's trap repair): the TOPOLOGY of a
  // line, not its instantaneous strength. A charge line is a cell whose
  // module can receive charge and that sits beside the board's charge
  // sources; the strength it carries is reserve-driven and intermittent
  // by design — generators drain while emitting and refill on the
  // practice facts — so an instant read of zero describes a resting line,
  // not its absence. The flow-basis strength remains the rank's
  // tiebreak: among equal seats, the line currently carrying more stands
  // first. A Column copies the charge the module beneath it receives — a
  // seat with no receiving module copies nothing — and an Arete purchase
  // stranded on such a seat is exactly the progression trap this ticket
  // repairs in the placement rule, never in currency.
  const chargeSnapshot = syncRates(state, true);
  // The deployed modules indexed once: the seat reads run per candidate
  // cell, and the board never changes inside this leg.
  const moduleAt = new Map(state.modules.filter((entry) => entry.pos !== null).map((entry) => [seatKey(entry.pos!), entry]));
  const receivedAt = (pos: Hex): number => {
    const module = moduleAt.get(seatKey(pos));
    return module ? (chargeSnapshot.chargeStrength.get(module.id) ?? 0) : 0;
  };
  const lineCells = new Set(chargeLineCells(state).map(seatKey));
  const lineAt = (pos: Hex): boolean => lineCells.has(seatKey(pos));
  // The weapon seat's rank, one construction shared by the deploy leg and
  // the relocation read — the two can never disagree about preference.
  const weaponRank = (pos: Hex): readonly number[] => [
    distanceToFight(pos),
    state.world.columns.some((column) => column.pos !== null && adjacent(pos, column.pos)) ? 0 : 1,
    pos.q, pos.r,
  ];
  // Both occupants share selection and action handling; each rule supplies
  // eligible seats and its own readable preference ranks.
  const deploy = (
    id: string,
    name: string,
    candidates: Hex[],
    rank: (pos: Hex) => readonly number[],
    unavailable: string,
    kind: "weapon" | "column",
  ): boolean => {
    const best = bestRanked(candidates, rank);
    if (!best) {
      record(ctx, { kind: "world", label: `${name} stayed in the tray`, ok: false, reason: unavailable });
      decline(ctx, name, unavailable);
      return false;
    }
    const result = placeWorldOccupant(state, id, best);
    if (result.ok) {
      if (kind === "weapon" && ctx.weaponDeployed === null) ctx.weaponDeployed = journeyMark(ctx);
      if (kind === "column" && ctx.columnDeployed === null) ctx.columnDeployed = journeyMark(ctx);
    }
    record(ctx, { kind: "world", label: `Placed ${name} at ${best.q},${best.r}`, ...outcome(result) });
    if (!result.ok) decline(ctx, name, result.reason ?? "declined");
    return result.ok;
  };
  // Each leg is one occupant family's independent attempt: the original
  // loops broke only their own iteration, never withheld the other's.
  // Every policy deploys the weapon first — a Column must never take the
  // fight's only seat (issue #491's repair) — then the Column takes a
  // charge line: a cell whose module receives charge, preferring one that
  // also touches the placed weapon, then the strongest line. The pair
  // connects wherever the board can carry the line to the fight; where it
  // cannot yet, the Column sits on its best line and relocates to the
  // fight when the board grows one.
  const weaponLeg = (): void => {
    for (const weapon of state.world.weapons) {
      if (weapon.pos !== null) continue;
      if (!deploy(
        weapon.id,
        `the ${weapon.type}`,
        free().filter((pos) => living.some((def) => adjacent(pos, def.pos))),
        weaponRank,
        "no free World cell beside a living discovered enemy",
        "weapon",
      )) break;
    }
  };
  const columnLeg = (): void => {
    for (const column of state.world.columns) {
      if (column.pos !== null) continue;
      if (!deploy(
        column.id,
        "a Charge Column",
        free().filter((pos) => lineAt(pos)),
        (pos) => [
          state.world.weapons.some((weapon) => weapon.pos !== null && adjacent(pos, weapon.pos)) ? 0 : 1,
          -receivedAt(pos),
          pos.q, pos.r,
        ],
        "no free World cell on a charge line",
        "column",
      )) break;
    }
  };
  // The deployment order is shared: the weapon's fight first, then the
  // charge line (issue #491's repair).
  weaponLeg();
  columnLeg();
  relocateWorldOccupants(ctx, state, { living, free, lineAt, receivedAt, weaponRank });
}

// The seat map's key: one coordinate, one string.
function seatKey(pos: Hex): string {
  return `${pos.q},${pos.r}`;
}

// The relocation's shared seat reads (issue #491): the fight's shape, the
// free cells, the charge line's topology and strength, and the weapon
// seat's rank — one bundle, built once per placement leg.
interface SeatReads {
  readonly living: readonly WorldEnemyDef[];
  readonly free: () => Hex[];
  readonly lineAt: (pos: Hex) => boolean;
  readonly receivedAt: (pos: Hex) => number;
  readonly weaponRank: (pos: Hex) => readonly number[];
}

function bestRanked(candidates: readonly Hex[], rank: (pos: Hex) => readonly number[]): Hex | undefined {
  let best: Hex | undefined;
  for (const pos of candidates) {
    if (!best || rankLessOf(rank(pos), rank(best))) best = pos;
  }
  return best;
}

function rankLessOf(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}

// The relocation leg (issue #491's route at later frontiers): a weapon
// whose fight is won — no eligible target remains adjacent — moves to the
// next living discovered enemy, and a Column the fight left behind moves
// to a charge line that touches the fight. Relocation is free between
// sessions (the authored mechanic), every move rides the engine's own
// retrieve and placement actions, and each leg only fires when the seat
// has gone stale AND a genuinely better seat exists — a Column with no
// fight-adjacent line to move to stays put, so the leg settles, never
// churns.
function relocateWorldOccupants(ctx: RunContext, state: GameState, seats: SeatReads): void {
  const { living, free, lineAt, receivedAt, weaponRank } = seats;
  for (const weapon of state.world.weapons) {
    const current = weapon.pos;
    if (current === null) continue;
    if (eligibleTargetsOf(state, weapon).length > 0) continue;
    if (living.length === 0) continue;
    const seat = bestRanked(
      free().filter((pos) => !sameHex(pos, current) && living.some((def) => adjacent(pos, def.pos))),
      weaponRank,
    );
    if (!seat) continue;
    if (!retrieveWorldOccupant(state, weapon.id).ok) continue;
    const result = placeWorldOccupant(state, weapon.id, seat);
    record(ctx, { kind: "world", label: `Relocated the ${weapon.type} to ${seat.q},${seat.r}`, ...outcome(result) });
    if (!result.ok) {
      // The retrieval landed, so the weapon must not sit out the era in
      // a place the policy never chose: return it to its prior seat.
      placeWorldOccupant(state, weapon.id, current);
      decline(ctx, `relocate the ${weapon.type}`, result.reason ?? "declined");
    }
  }
  for (const column of state.world.columns) {
    const current = column.pos;
    if (current === null) continue;
    if (state.world.weapons.some((weapon) => weapon.pos !== null && adjacent(weapon.pos, current))) continue;
    const seat = bestRanked(
      free().filter((pos) => !sameHex(pos, current) && lineAt(pos) &&
        state.world.weapons.some((weapon) => weapon.pos !== null && adjacent(pos, weapon.pos))),
      (pos) => [-receivedAt(pos), pos.q, pos.r],
    );
    if (!seat) continue;
    if (!retrieveWorldOccupant(state, column.id).ok) continue;
    const result = placeWorldOccupant(state, column.id, seat);
    record(ctx, { kind: "world", label: `Relocated a Charge Column to ${seat.q},${seat.r}`, ...outcome(result) });
    if (!result.ok) {
      placeWorldOccupant(state, column.id, current);
      decline(ctx, "relocate a Charge Column", result.reason ?? "declined");
    }
  }
}

// The journey mark's both clocks (issue #490): elapsed and credited
// seconds since the run's first prestige. Only meaningful while the
// ledger is armed — every caller guards on `preResetRate !== null`.
function journeyMark(ctx: RunContext): PlaythroughRecoveryMark {
  return {
    elapsed: Math.max(0, Math.round((ctx.elapsedMs - ctx.prestigeElapsedMs) / 1000)),
    credited: Math.max(0, Math.round(ctx.stampCredited - ctx.prestigeCredited)),
  };
}

// The era mark's both clocks (issue #491): elapsed and credited seconds
// since the open era's own start — the previous bank, or the walk's start
// for era 0.
function eraMark(ctx: RunContext): PlaythroughRecoveryMark {
  const era = ctx.eras[ctx.eras.length - 1]!;
  return {
    elapsed: Math.max(0, Math.round((ctx.elapsedMs - era.startElapsedMs) / 1000)),
    credited: Math.max(0, Math.round(ctx.stampCredited - era.startCredited)),
  };
}

// The open era's per-step bookkeeping (issue #491): the crossing check
// runs BEFORE the step's production lands, so a crossing that happened
// during a breather (which produces but credits no practice time) is
// caught at the next step's start, never misattributed to that step's
// credited time; a mid-step crossing is caught after the advance. Either
// way the crossing milestone records at its own moment and binds its own
// snapshot — the exact recorded board at the crossing — and the step's
// credited seconds land on the familiar side through the crossing step
// (the step that completes the familiar walk) and on the new side after.
// Era 0 has no prior depth: everything is new territory.
function stepEraCrossing(ctx: RunContext, state: GameState): void {
  const era = ctx.eras[ctx.eras.length - 1]!;
  if (era.priorDepth !== null && !era.depthCrossed && state.eraEarned >= era.priorDepth) {
    era.depthCrossed = true;
    era.priorDepthPassed = eraMark(ctx);
    record(ctx, {
      kind: "milestone",
      label: `Era ${era.index} — the prior frontier's depth passed`,
      ok: true,
      milestone: true,
    });
    snap(ctx, state);
  }
}

function stepEraCredit(ctx: RunContext, state: GameState, creditedDelta: number): void {
  const era = ctx.eras[ctx.eras.length - 1]!;
  if (era.priorDepth === null || era.depthCrossed) era.newCredited += creditedDelta;
  else era.familiarCredited += creditedDelta;
  stepEraCrossing(ctx, state);
}

// The finite read over the exact recorded state a bank produced (issue
// #491's sixth criterion): every number in the recorded state must be
// representable. The engine's own requireFinite guards make a walk that
// produced a nonfinite figure throw; this read is the recorded check that
// nothing nonfinite slipped through — false is a recorded failure, never
// a silent pass.
export function stateNumbersFinite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null || typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every(stateNumbersFinite);
  return Object.values(value).every(stateNumbersFinite);
}

// The first lasting Arete purchase after the bank (issue #490): the mark
// the worthwhile-prestige ledger carries beside the claim — eligibility
// alone never funds anything. A purchase before the ledger is armed (no
// bank yet — Arete mints nowhere else) is not a journey purchase.
function noteLastingPurchase(ctx: RunContext, label: string): void {
  if (ctx.preResetRate === null || ctx.lastingPurchase !== null) return;
  ctx.lastingPurchase = journeyMark(ctx);
  ctx.lastingPurchaseLabel = label;
  record(ctx, {
    kind: "milestone",
    label: `Recovery — lasting purchase (${label})`,
    ok: true,
    milestone: true,
  });
}

// The recovery settlement (stories 24–25, issue #490): measured at every
// between-sessions moment after the run's first prestige. Regaining
// production compares the next era's whole-board rate against the rate the
// reset erased; eligibility is the horizon crossing again. Both carry
// their mark on both clocks, measured from the prestige moment; a measure
// the budget outlives stays explicitly null. The open era's own
// production-regained mark (issue #491) settles at the same moments
// against the rate the era's opening bank erased.
function settleRecovery(ctx: RunContext, state: GameState): void {
  if (ctx.preResetRate === null) return;
  const rate = syncRates(state, false).rate;
  if (ctx.productionRegained === null && rate >= ctx.preResetRate) {
    ctx.productionRegained = journeyMark(ctx);
    record(ctx, {
      kind: "milestone",
      label: `Recovery — pre-reset production regained (${ctx.preResetRate.toFixed(2)}ν/s)`,
      ok: true,
      milestone: true,
    });
  }
  const era = ctx.eras[ctx.eras.length - 1]!;
  if (era.priorRate !== null && era.productionRegained === null && rate >= era.priorRate) {
    era.productionRegained = eraMark(ctx);
    record(ctx, {
      kind: "milestone",
      label: `Era ${era.index} — prior production regained (${era.priorRate.toFixed(2)}ν/s)`,
      ok: true,
      milestone: true,
    });
  }
  if (ctx.eligibilityReached === null && horizonReached(state)) {
    ctx.eligibilityReached = journeyMark(ctx);
    record(ctx, {
      kind: "milestone",
      label: "Recovery — next prestige eligibility reached",
      ok: true,
      milestone: true,
    });
  }
}

// The worthwhile-prestige journey's completion (issue #490): every mark
// carried — the bank spent into a lasting purchase, the starter rig
// deployed, production and eligibility recovered, and the frontier
// advanced beyond the claimed frontier. Whatever a measure lacks is the
// record's explicit null, never a fabricated mark.
function journeyComplete(ctx: RunContext): boolean {
  return ctx.lastingPurchase !== null && ctx.weaponDeployed !== null && ctx.columnDeployed !== null &&
    ctx.productionRegained !== null && ctx.eligibilityReached !== null && ctx.frontierAdvanced !== null;
}

// One walked era's ledger (issue #491): the span the era occupied on both
// clocks, the bank that closed it, the frontier that bank advanced to, and
// the familiar/new territory split — credited seconds this era spent below
// the previous bank's depth (familiar ground retained upgrades shorten)
// against beyond it (the new frontier the era's effort owes). The faster-
// return marks carry both clocks from the era's own start: when the era's
// board first produced at the rate the previous bank erased, and when its
// era-earned re-passed the previous bank's depth. Era 0 — the opening —
// carries null prior figures and credits everything to new territory:
// nothing was familiar. An era still open at the walk's stop carries its
// split so far and explicit nulls for the bank it never landed — the
// honest incomplete outcome, never a fabricated era.
export interface PlaythroughEraLedger {
  readonly index: number;
  readonly startElapsed: number;
  readonly startCredited: number;
  readonly endElapsed: number | null;
  readonly endCredited: number | null;
  readonly claim: number | null;
  readonly frontierAfter: number | null;
  readonly priorDepth: number | null;
  readonly priorRate: number | null;
  readonly familiarCredited: number;
  readonly newCredited: number;
  readonly productionRegained: PlaythroughRecoveryMark | null;
  readonly priorDepthPassed: PlaythroughRecoveryMark | null;
  // The finite read over the exact recorded state the bank produced —
  // false is a recorded failure, never a silent pass (issue #491's sixth
  // criterion). Null while the era is open.
  readonly finite: boolean | null;
}

// One planned session at its target, the breather the session minted, and
// the honest stamps on both ends. Never walks past the target: the prompt
// policy ends sessions at their plan — a readable, checkable rule.
function* runSession(ctx: RunContext, state: GameState, day: number, session: number): Generator<void> {
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
    stepEraCrossing(ctx, state);
    const creditedBefore = state.session?.accounting.creditedSeconds ?? 0;
    advance(state, STEP_SECONDS, ctx.rng);
    ctx.elapsedMs += STEP_SECONDS * 1000;
    ctx.stampCredited = ctx.sessionCreditedBase + (state.session?.accounting.creditedSeconds ?? 0);
    stepEraCredit(ctx, state, (state.session?.accounting.creditedSeconds ?? 0) - creditedBefore);
    yield;
  }
  const ended = endSession(state, startMs + target * 1000);
  const recordLine = state.sessionRecords[state.sessionRecords.length - 1];
  const credited = recordLine?.creditedSeconds ?? 0;
  ctx.credited += credited;
  ctx.sessionCreditedBase = ctx.credited;
  ctx.stampCredited = ctx.credited;
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
  stepEraCrossing(ctx, state);
  recordDiscoveries(ctx, state);
  pushTrajectory(ctx, state);
}

// The prestige check — the prompt policy's completion and the pushing
// policy's banks. The prompt door opens at the first between-sessions
// moment the horizon is reached; the first-eligibility claim is zero under
// the frontier curve, and the zero banks honestly. The pushing policy
// holds that door: it prestiges when the pending claim reaches its
// configured target (story 19) — the first worthwhile bank (issue #490) —
// and its first bank arms the journey ledger (stories 24–25). While the
// journey's frontier mark is unmet it keeps banking the same declared
// target: the bank that advances the frontier beyond the claimed frontier
// is the journey's last mark, and once it lands the walk banks no more —
// it observes the recovered era, it does not farm it.
// The walk's declared completion (issue #491): every claimed frontier the
// recipe declared has banked — and, for a fighting policy, the first
// worthwhile-prestige journey has carried. The ignoring policy declares
// its combat postponed: its eras close without the journey's combat
// marks, and the record keeps those marks explicitly null.
function walkComplete(ctx: RunContext): boolean {
  const closed = ctx.eras.filter((era) => era.claim !== null).length;
  return closed >= ctx.eraGoal && (ctx.continuation || journeyComplete(ctx) || ctx.worldOrder === "none");
}

function tryPrestige(ctx: RunContext, state: GameState): boolean {
  if (ctx.claimsPushing) {
    // A century walk (issue #492) declares a credited-flow terminal: the
    // era count and the journey's frontier mark stop gating the banking,
    // because the walk banks at every door, per its policy's own rule,
    // until the mark.
    if (ctx.centuryStopSeconds === null) {
      if (ctx.eraGoal === 1) {
        if (ctx.frontierAdvanced !== null) return false;
      } else if (walkComplete(ctx)) {
        return false;
      }
    }
    if (pendingClaimOf(state, ctx.claimBase) < ctx.claimTarget) return false;
  } else if (!horizonReached(state)) {
    return false;
  }
  // Every bank captures the rate and the depth the reset is about to
  // erase (issue #491): the journey ledger arms against the first bank's,
  // every era's ledger against its own.
  const preRate = syncRates(state, false).rate;
  const depthAtBank = state.eraEarned;
  if (ctx.preResetRate === null) {
    // The first prestige, either policy: arm the journey measures against
    // what the reset is erasing.
    ctx.preResetRate = preRate;
    ctx.frontierAtBank = state.world.frontier;
    ctx.prestigeElapsedMs = ctx.elapsedMs;
    ctx.prestigeCredited = ctx.stampCredited;
  }
  const before = state.arete;
  const result = prestige(state, {
    ...(ctx.openingGrant !== undefined ? { openingGrant: ctx.openingGrant } : {}),
    ...(ctx.claimBase !== undefined ? { claimBase: ctx.claimBase } : {}),
  });
  // The ledger counts the reset's era-start grant (issue #484): right here
  // the wallet holds exactly what the reset paid — the no-grant read then
  // sees the authored figures as declared intake, never as fabricated ν.
  if (result.ok) ctx.grantNous += state.nous;
  const claim = state.arete - before;
  ctx.claims.push(claim);
  record(ctx, {
    kind: "prestige",
    label: `Prestige ${state.prestiges} — banked ${claim} Arete`,
    ...outcome(result),
    milestone: true,
  });
  // The frontier mark (issue #490): a LATER bank advancing the frontier
  // beyond the claimed frontier — progress into the next frontier, not
  // merely the first bank's own advance over the reset's zero.
  if (
    ctx.claims.length >= 2 && ctx.frontierAtBank !== null &&
    state.world.frontier > ctx.frontierAtBank && ctx.frontierAdvanced === null
  ) {
    ctx.frontierAdvanced = journeyMark(ctx);
    record(ctx, {
      kind: "milestone",
      label: `Recovery — frontier advanced to ${state.world.frontier} Arete`,
      ok: true,
      milestone: true,
    });
  }
  // The era's ledger closes at its own bank (issue #491), the finite read
  // scans the exact recorded state the reset produced, and the next era
  // opens against the depth and rate this bank read.
  const era = ctx.eras[ctx.eras.length - 1]!;
  era.claim = claim;
  era.frontierAfter = state.world.frontier;
  era.endElapsedMs = ctx.elapsedMs;
  era.endCredited = ctx.stampCredited;
  pushTrajectory(ctx, state);
  // The era's finite verdict reads the moment's captured figures — the
  // just-pushed snapshot's own integrity read, both retentions alike.
  era.finite = ctx.snapshots[ctx.snapshots.length - 1]!.numbers.finite;
  if (!era.finite) {
    record(ctx, {
      kind: "milestone",
      label: `Era ${era.index} closed with a nonfinite recorded state`,
      ok: false,
    });
  }
  ctx.eras.push(openEraTrack(era.index + 1, ctx.elapsedMs, ctx.stampCredited));
  const next = ctx.eras[ctx.eras.length - 1]!;
  next.priorDepth = depthAtBank;
  next.priorRate = preRate;
  return result.ok;
}

// The declared historical retention (issue #509): "complete" — the
// default, and every interactive path — freezes and keeps each snapshot's
// whole state, the record inspection and artifact export read. "bounded"
// keeps the captured figures and drops the boards, so a long batch
// recording's memory stops growing with the board; the record refuses
// inspection and export by name, never masquerading as a complete one.
export type PlaythroughRetention = "complete" | "bounded";

export interface PlaythroughRunOptions {
  readonly retention?: PlaythroughRetention;
}

export function runPlaythrough(
  recipe: PlaythroughRecipe,
  source: PlaythroughSource = playthroughSource(),
  options: PlaythroughRunOptions = {},
): PlaythroughRecord {
  return finishWalk(walkPlaythrough(recipe, null, source, undefined, options.retention ?? "complete"));
}

// The checkpoint walk (issue #471): the same walk with one declared stop.
// A checkpoint the budget never reaches is a thrown, named failure — a
// preset whose situation the recipe can no longer reach must fail its
// build, never install a lookalike.
export function runPlaythroughCheckpoint(
  recipe: PlaythroughRecipe,
  checkpointId: PlaythroughCheckpointId,
  source: PlaythroughSource = playthroughSource(),
  options: PlaythroughRunOptions = {},
): PlaythroughRecord {
  const checkpoint = checkpointOf(checkpointId);
  // A checkpoint preset feeds interactive inspection and artifact export
  // (issue #471's presets ride the app's dev surfaces), so a bounded walk
  // would build an unusable preset: refused at the door, not at the UI.
  if (options.retention === "bounded") {
    throw new Error("Playthrough checkpoint: presets are interactive records — retention is always complete.");
  }
  const record = finishWalk(walkPlaythrough(recipe, checkpointId, source, undefined, options.retention ?? "complete"));
  return assertCheckpointReached(record, checkpoint);
}

function assertCheckpointReached(record: PlaythroughRecord, checkpoint: PlaythroughCheckpoint): PlaythroughRecord {
  const checkpointId = checkpoint.id;
  const recipe = record.recipe;
  if (record.stop.kind !== "checkpoint") {
    throw new Error(
      `Playthrough checkpoint "${checkpointId}" was not reached within the ${recipe.budgetDays}-day budget — ` +
        `the recipe or engine drifted from its declared situation (${checkpoint.situation}).`,
    );
  }
  return record;
}

// Continue an earned bank state through this same scheduled action walk.
// The caller's state is cloned; the first snapshot preserves the exact
// branch input. A continuation is explicitly not fresh-start acquisition
// evidence, and its identity includes that input, not just the recipe.
export function continuePlaythrough(
  recipe: PlaythroughRecipe,
  state: GameState,
  source: PlaythroughSource = playthroughSource(),
  options: PlaythroughRunOptions = {},
): PlaythroughRecord {
  if (state.mode !== "upgrade" || state.session !== null || state.eraEarned !== 0 || !stateNumbersFinite(state)) {
    throw new Error("Playthrough continuation: expected a finite, between-sessions bank state.");
  }
  return finishWalk(walkPlaythrough(recipe, null, source, state, options.retention ?? "complete"));
}

function finishWalk(walk: Generator<void, PlaythroughRecord>): PlaythroughRecord {
  let next = walk.next();
  while (!next.done) next = walk.next();
  return next.value;
}

// One scheduled action walk, driven step by step: the exported generator
// form the checkpoint presets' interleaved preparation shares with the
// recording profiler (issue #509), which samples memory between steps.
export function* walkPlaythrough(
  recipe: PlaythroughRecipe,
  checkpoint: PlaythroughCheckpointId | null,
  source: PlaythroughSource,
  initialState?: GameState,
  retention: PlaythroughRetention = "complete",
): Generator<void, PlaythroughRecord> {
  validatePlaythroughRecipe(recipe);
  const scenario = scenarioOf(recipe.scenarioId)!;
  const state = initialState ? structuredClone(initialState) : scenario.build(recipe.schedule.startAt);
  // A checkpoint carries real session history. Continue after its last
  // session and declared breather rather than restarting at the recipe's
  // original anchor; record the effective input so a rerun is reproducible.
  const lastEnd = state.sessionRecords.reduce((latest, session) => Math.max(
    latest,
    session.endedAt + Math.max(session.breather?.seconds ?? 0, recipe.schedule.breatherMinutes * 60) * 1000,
  ), -Infinity);
  const startAt = Math.max(recipe.schedule.startAt, lastEnd);
  recipe = { ...recipe, schedule: { ...recipe.schedule, startAt } };
  validatePlaythroughRecipe(recipe);
  if (!initialState) scenario.assert(state, startAt);
  // The declared overrides apply to this run's candidate only, after the
  // scenario's own assertion has verified the baseline it grew from
  // (issue #472): a run that starts at the shipped opening — the
  // scenario's own origin classification — pays the declared grant at its
  // first moment; every later era start pays it through the prestige
  // action's seam.
  if (!initialState && recipe.overrides.openingGrant !== undefined && scenario.origin === "initial state") {
    state.nous = recipe.overrides.openingGrant;
  }
  // The declared response curve (issue #487) applies to this run's own
  // candidate state: the walk's rate reads — and nothing else, no other
  // run, no shared balance definition — take the candidate's grant level
  // term from here on. Shipped sets nothing, so shipped runs keep the
  // exact states they always built.
  if (recipe.responseCurve !== "shipped") {
    state.candidates = { responseCurve: recipe.responseCurve };
  }
  const policy = policyOf(recipe.policyId);
  const ctx: RunContext = {
    schedule: recipe.schedule,
    claimTarget: recipe.claimTarget,
    claimsPushing: policy.id !== PROMPT_POLICY.id,
    eraGoal: recipe.eras,
    centuryStopSeconds: recipe.stopCreditedHours > 0 ? recipe.stopCreditedHours * 3600 : null,
    continuation: initialState !== undefined,
    openingGrant: recipe.overrides.openingGrant,
    claimBase: recipe.overrides.claimBase,
    rng: seededRng(recipe.seed),
    events: [],
    trajectory: [],
    snapshots: [],
    openEvents: [],
    claims: [],
    areteSpent: { entry: 0, discounts: 0, ceilings: 0, columns: 0, rowUnlocks: 0, hone: { chargeBlade: 0 } },
    achievements: [],
    discovered: [],
    defeated: [],
    credited: 0,
    stampCredited: 0,
    sessionCreditedBase: 0,
    breatherSeconds: 0,
    sessionNous: 0,
    breatherNous: 0,
    grantNous: 0,
    elapsedMs: recipe.schedule.startAt,
    lastDecline: null,
    lastMilestone: null,
    preResetRate: null,
    prestigeElapsedMs: 0,
    prestigeCredited: 0,
    frontierAtBank: null,
    lastingPurchase: null,
    lastingPurchaseLabel: null,
    weaponDeployed: null,
    columnDeployed: null,
    productionRegained: null,
    eligibilityReached: null,
    frontierAdvanced: null,
    manageBreaks: 0,
    eras: [openEraTrack(0, recipe.schedule.startAt, 0)],
    worldOrder: worldOrderOf(policy.id),
    retention,
  };

  if (initialState) pushTrajectory(ctx, state);
  let days = 0;
  let complete = false;
  let checkpointStop: PlaythroughRecord["stop"] | null = null;
  let stop: PlaythroughRecord["stop"] = ctx.centuryStopSeconds !== null
    ? { kind: "budget", reason: `The ${recipe.budgetDays}-day budget ended before the declared ${recipe.stopCreditedHours}-credited-hour mark.` }
    : ctx.claimsPushing
      ? { kind: "budget", reason: `The ${recipe.budgetDays}-day budget ended before the ${recipe.claimTarget}-Arete claim or the worthwhile-prestige journey behind it.` }
      : { kind: "budget", reason: `The ${recipe.budgetDays}-day budget ended before the first prestige.` };
  // A checkpoint's halt (issue #471): the declared moment named, the day
  // counted — the record's stop carries the situation, never a verdict.
  const haltAt = (id: PlaythroughCheckpointId): void => {
    const descriptor = checkpointOf(id);
    checkpointStop = {
      kind: "checkpoint",
      reason: `${descriptor.name} reached at day ${days} — ${descriptor.situation}.`,
    };
  };
  // The door's check (issue #471): the approaching-prestige moment is the
  // horizon's first between-sessions crossing of the first era — read
  // before the prestige door itself, so the walk stops before the bank.
  const doorOpen = (): boolean =>
    checkpoint === "approaching-prestige" && ctx.claims.length === 0 && horizonReached(state);
  // The bank-and-World read (issue #471): evaluated right after the
  // prestige door's check at both between-sessions points, before any
  // spending or recovery bookkeeping touches the era — the first bank
  // still unspent, or the World's decision still unplayed. Returns the
  // checkpoint whose moment is now, or null.
  const checkpointAfterDoor = (): PlaythroughCheckpointId | null => {
    if (checkpoint === "after-first-bank") return ctx.claims.length === 1 ? checkpoint : null;
    if (checkpoint === "world-enemy-active") {
      return ctx.claims.length >= 1 && worldDecisionPending(state) ? checkpoint : null;
    }
    return null;
  };
  let firstEligibilityRecorded = false;
  const stopBetweenSessions = (): boolean => {
    if (!firstEligibilityRecorded && ctx.claims.length === 0 && horizonReached(state)) {
      firstEligibilityRecorded = true;
      record(ctx, { kind: "milestone", label: "First prestige eligibility reached", ok: true, milestone: true });
      snap(ctx, state);
    }
    if (doorOpen()) {
      haltAt("approaching-prestige");
      return true;
    }
    // Recovery belongs to the board before this bank erases it, including
    // a mark first reached in the closing session or its breather.
    settleRecovery(ctx, state);
    if (ctx.openEvents.length > 0) snap(ctx, state);
    if (tryPrestige(ctx, state) && !ctx.claimsPushing && ctx.centuryStopSeconds === null) {
      complete = true;
      stop = { kind: "prestige", reason: `First prestige at day ${days}.` };
      return true;
    }
    // The declared credited-flow stop (issue #492): the century walk's
    // terminal. A bank landing at this same break captured its ledger
    // first; the mark then closes the walk, with every open era, gap,
    // and unreached outcome left exactly as the record carries them.
    if (ctx.centuryStopSeconds !== null && ctx.credited >= ctx.centuryStopSeconds) {
      complete = true;
      const closed = ctx.eras.filter((era) => era.claim !== null).length;
      stop = {
        kind: "century",
        reason: `The declared ${ctx.centuryStopSeconds / 3600}-credited-hour mark reached at day ${days} — ${closed} era(s) banked.`,
      };
      return true;
    }
    const hit = checkpointAfterDoor();
    if (!hit) return false;
    haltAt(hit);
    return true;
  };
  day: for (let day = 0; day < recipe.budgetDays; day++) {
    days = day + 1;
    for (let session = 0; session < recipe.schedule.sessionsPerDay; session++) {
      if (stopBetweenSessions()) break day;
      manage(ctx, state);
      yield* runSession(ctx, state, day, session);
      if (stopBetweenSessions()) break day;
      // The between-sessions settlement: both recovery measures read here
      // too, so a measure crossed during the session carries its mark at
      // this moment, never a day late.
      settleRecovery(ctx, state);
      // Recovery may open events after runSession closed its final sample.
      // Bind them now, before stopping or advancing to another stamp.
      if (ctx.openEvents.length > 0) snap(ctx, state);
      // The claim-pushing walk's completion (stories 24–25, issue #490;
      // multi-era walks issue #491): the worthwhile-prestige journey's
      // marks all carried — the bank, the lasting purchase, the deployed
      // starter rig, both recovery measures, and the frontier advanced
      // past the claimed frontier — and every claimed frontier the recipe
      // declared has banked. A century walk (issue #492) declares a
      // different terminal — the credited mark — so this stop never fires
      // for it. Whatever a mark lacks is the ledger's
      // explicit null; there is no pacing threshold to miss. The ignoring
      // policy declares its combat postponed: its eras close without the
      // journey's combat marks. A checkpoint walk has its own declared
      // terminal (issue #471): it rides past this stop so a recovery
      // milestone that lands before its situation — the two thresholds
      // can finish neck and neck — never steals the walk's end.
      if (ctx.claimsPushing && ctx.centuryStopSeconds === null && checkpoint === null && walkComplete(ctx)) {
        complete = true;
        stop = ctx.continuation || ctx.eraGoal > 1 || ctx.worldOrder === "none"
          ? { kind: "frontier", reason: `The declared ${ctx.eraGoal} claimed frontiers banked at day ${days} — the frontier stands at ${state.world.frontier} Arete${ctx.worldOrder === "none" ? ", combat still postponed" : ""}.` }
          : { kind: "recovered", reason: `The worthwhile-prestige journey completed at day ${days} — the frontier advanced to ${state.world.frontier} Arete.` };
        break day;
      }
    }
  }
  // A pushing run that banked but never finished its declared walk names
  // that stop exactly, with the missing journey marks and open eras left
  // explicitly null/open. A century walk (issue #492) — pushing or
  // prompt, banked or not — names its unreached credited mark instead.
  // The credited-hour read at one-decimal granularity — the same /360
  // tenth-of-an-hour rounding the trajectory and gap reads use.
  const bankedHours = Math.round((ctx.credited / 360)) / 10;
  const bankedCount = ctx.eras.filter((era) => era.claim !== null).length;
  if (!complete && !checkpointStop && ctx.claims.length > 0 &&
    (ctx.centuryStopSeconds !== null || ctx.claimsPushing)) {
    stop = {
      kind: "budget",
      reason: ctx.centuryStopSeconds !== null
        ? `The ${days}-day budget ended at ${bankedHours} credited hours — the declared ${ctx.centuryStopSeconds / 3600}-hour mark unreached; ${bankedCount} era(s) banked.`
        : ctx.worldOrder === "none"
          ? `The ${days}-day budget ended with combat postponed — ${bankedCount} of the declared ${ctx.eraGoal} era(s) closed.`
          : `The ${days}-day budget ended inside the worthwhile-prestige journey.`,
    };
  }
  const lastSessionLabel = [...ctx.events].reverse().find((event) => event.kind === "session")?.label ?? null;
  // A checkpoint stop names its moment; nothing was blocked, so no
  // bottleneck is written for it.
  const bottleneck = checkpointStop
    ? null
    : complete
      ? null
      : ctx.lastDecline
        ? `${stop.reason} Last decline — ${ctx.lastDecline}.`
        : `${stop.reason} No action was declined — practice rate alone did not reach the horizon.`;
  const recovery: PlaythroughRecovery | null =
    ctx.preResetRate === null
      ? null
      : {
          preResetRate: ctx.preResetRate,
          claim: ctx.claims[0] ?? 0,
          lastingPurchase: ctx.lastingPurchase,
          lastingPurchaseLabel: ctx.lastingPurchaseLabel,
          weaponDeployed: ctx.weaponDeployed,
          columnDeployed: ctx.columnDeployed,
          productionRegained: ctx.productionRegained,
          eligibilityReached: ctx.eligibilityReached,
          frontierAdvanced: ctx.frontierAdvanced,
        };
  return {
    kind: initialState ? "continuation" : "representative",
    runId: playthroughRunId(recipe, source, checkpoint) + (initialState ? `-from-${fingerprint(JSON.stringify(initialState))}` : ""),
    recipe,
    source,
    policy: { id: policy.id, name: policy.name },
    complete,
    stop: checkpointStop ?? stop,
    claimTarget: recipe.claimTarget,
    claims: ctx.claims,
    areteSpent: ctx.areteSpent,
    days,
    elapsedSeconds: Math.round((ctx.elapsedMs - recipe.schedule.startAt) / 1000),
    creditedSeconds: Math.round(ctx.credited),
    breatherSeconds: Math.round(ctx.breatherSeconds),
    manageBreaks: ctx.manageBreaks,
    earnedNous: ctx.sessionNous + ctx.breatherNous,
    sessionNous: ctx.sessionNous,
    breatherNous: ctx.breatherNous,
    grantNous: ctx.grantNous,
    lastMilestone: ctx.lastMilestone ?? lastSessionLabel,
    bottleneck,
    events: ctx.events,
    trajectory: ctx.trajectory,
    snapshots: ctx.snapshots,
    achievements: ctx.achievements,
    worldDiscoveries: ctx.discovered,
    worldDefeats: ctx.defeated,
    recovery,
    eras: ctx.eras.map((era) => eraLedgerOf(ctx, era)),
    state,
    retention: ctx.retention,
  };
}

// The result's one-line read: the ✓/✗ shape the suite's notes carry, with
// the figures that matter — both clocks, the claim against its target, the
// spending, the recovery measures, the identity, and on an incomplete run
// the honest stop. A checkpoint's ◆ marks its declared halt (issue #471).
// Measurements and explicit outcomes only; never a pacing verdict
// (story 37).
export function playthroughNote(record: PlaythroughRecord): string {
  const credited = Math.round(record.creditedSeconds / 60);
  const elapsed = Math.round(record.elapsedSeconds / 60);
  const claims = record.claims.length > 0 ? record.claims.join(", ") : "none";
  const target = record.policy.id === PUSHING_POLICY.id ? `/${record.claimTarget}` : "";
  const mark = record.stop.kind === "checkpoint" ? "◆" : record.complete ? "✓" : "✗";
  const parts = [
    `${record.policy.name} ${mark} ` +
      `${record.days}d · ${credited}m credited of ${elapsed}m elapsed · ` +
      `claim ${claims}${target} Arete · ` +
      `seed ${record.recipe.seed} · ${record.recipe.scenarioId} · ${record.runId}`,
  ];
  const spent = spendingNote(record.areteSpent);
  if (spent) parts.push(spent);
  // A tuned run names its overrides beside the baseline recipe's figures,
  // so an altered run cannot masquerade as shipped-tuning evidence
  // (issue #472); a candidate curve names itself the same way (issue
  // #487).
  const tuned = Object.entries(record.recipe.overrides).map(([key, value]) => `${key}=${value}`);
  if (tuned.length > 0) parts.push(`tuned ${tuned.join(", ")}`);
  // Older artifacts' recipes predate the declared curve (issue #487) —
  // absent reads shipped, never "curve undefined".
  if ((record.recipe.responseCurve ?? "shipped") !== "shipped") parts.push(`curve ${record.recipe.responseCurve}`);
  if (record.recovery) parts.push(recoveryNote(record.recovery));
  // A multi-era walk names its era count (issue #491): how many of the
  // declared claimed frontiers closed, beside the stop's own reason.
  if (record.recipe.eras > 1 && record.policy.id !== PROMPT_POLICY.id) {
    const closed = record.eras.filter((era) => era.claim !== null).length;
    parts.push(`eras ${closed}/${record.recipe.eras} closed`);
  }
  if (record.stop.kind === "checkpoint") parts.push(record.stop.reason);
  else if (record.complete) parts.push(record.stop.reason);
  else parts.push(`${record.lastMilestone ?? "no milestone"}`, `${record.bottleneck ?? record.stop.reason}`);
  return parts.join(" · ");
}

function spendingNote(spent: PlaythroughAreteSpent): string {
  const entries = [
    spent.entry > 0 ? "Catalog entry" : null,
    spent.discounts > 0 ? `${spent.discounts}× Chord Catalysts` : null,
    spent.ceilings > 0 ? `${spent.ceilings}× Expansion Bays` : null,
    spent.columns > 0 ? `${spent.columns}× Charge Column` : null,
    spent.rowUnlocks > 0 ? `${spent.rowUnlocks}× Rack Extenders` : null,
    ...Object.entries(spent.hone).filter(([, ranks]) => ranks > 0).map(([type, ranks]) => `${ranks}× Hone (${type})`),
  ].filter((entry): entry is string => entry !== null);
  return entries.length > 0 ? `spent ${entries.join(" + ")}` : "no Arete spent";
}

function recoveryNote(recovery: PlaythroughRecovery): string {
  const mark = (value: PlaythroughRecoveryMark | null): string =>
    value ? `${(value.elapsed / 86_400).toFixed(1)}d/${Math.round(value.credited / 60)}m` : "unreached";
  // A zero-claim first bank (the prompt door) has no reward to journey
  // with — the honest door read, never topped up (issue #490).
  if (recovery.claim === 0) {
    return `recovery — none: the door banked 0 Arete (${recovery.preResetRate.toFixed(2)}ν/s pre-reset)`;
  }
  return `recovery — bank ${recovery.claim}, purchase ${mark(recovery.lastingPurchase)}` +
    `${recovery.lastingPurchaseLabel ? ` (${recovery.lastingPurchaseLabel})` : ""}, ` +
    `blade ${mark(recovery.weaponDeployed)}, column ${mark(recovery.columnDeployed)}, ` +
    `rate ${mark(recovery.productionRegained)}, door ${mark(recovery.eligibilityReached)}, ` +
    `frontier ${mark(recovery.frontierAdvanced)} (${recovery.preResetRate.toFixed(2)}ν/s pre-reset)`;
}

// ── The checkpoint presets (issue #471, parent #465) ──

// One progression preset's read: the declared checkpoint, the recipe that
// reached it, the walk's record (its provenance and its decisions), and
// the stopped state. The record's state is the ground truth behind every
// figure; the read hands out a fresh clone of it every call.
export interface PlaythroughCheckpointPreset {
  readonly checkpoint: PlaythroughCheckpoint;
  readonly recipe: PlaythroughRecipe;
  readonly record: PlaythroughRecord;
  readonly state: GameState;
}

interface CheckpointMemoEntry {
  readonly source: string;
  readonly record: PlaythroughRecord;
}

// One walk per checkpoint per engine source, memoized: the walk is a pure
// function of the declared recipe and the engine — deterministic inputs,
// no wall-clock reads — so the memo never lies, and a changed engine
// fingerprint (hot reload included) walks again. Every read clones the
// stopped state out, so the preset rebuilds from nothing on every launch
// and installs cannot accumulate. The record rides out as the read-only
// provenance artifact it is — the same convention the run command's
// result follows; the clone is what guards the install path.
const checkpointMemo = new Map<PlaythroughCheckpointId, CheckpointMemoEntry>();

export function playthroughCheckpointPreset(id: PlaythroughCheckpointId): PlaythroughCheckpointPreset {
  const checkpoint = checkpointOf(id);
  const recipe = checkpointRecipeOf(id);
  const source = playthroughSource();
  let memo = checkpointMemo.get(id);
  if (!memo || memo.source !== source.engineSource) {
    memo = { source: source.engineSource, record: runPlaythroughCheckpoint(recipe, id, source) };
    checkpointMemo.set(id, memo);
  }
  return { checkpoint, recipe, record: memo.record, state: structuredClone(memo.record.state) };
}


// The browser consumes the same walk cooperatively. A short slice keeps
// input/paint available even on the long-session checkpoints; synchronous
// engine callers still drain exactly the same generator without timers.
export async function preparePlaythroughCheckpoint(id: PlaythroughCheckpointId): Promise<void> {
  const source = playthroughSource();
  if (checkpointMemo.get(id)?.source === source.engineSource) return;
  const key = `${source.engineSource}:${id}`;
  const pending = checkpointPreparation.get(key);
  if (pending) return pending;
  const preparation = (async () => {
    const walk = walkPlaythrough(checkpointRecipeOf(id), id, source);
    let next: IteratorResult<void, PlaythroughRecord>;
    do {
      await new Promise<void>((resolve) => {
        // Message tasks yield to input/paint without hidden-tab timer
        // throttling turning a long walk into hours of preparation.
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(null);
      });
      const deadline = performance.now() + 8;
      do { next = walk.next(); } while (!next.done && performance.now() < deadline);
    } while (!next.done);
    checkpointMemo.set(id, { source: source.engineSource, record: assertCheckpointReached(next.value, checkpointOf(id)) });
  })();
  checkpointPreparation.set(key, preparation);
  try { await preparation; } finally { checkpointPreparation.delete(key); }
}
const checkpointPreparation = new Map<string, Promise<void>>();

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
  // The latest session and its preparation, through the selected moment.
  // These are references to the action record, never copied explanations.
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
  // The record's own frozen state: all board layers and tray contents.
  readonly state: GameState;
}

// The assemblies are pure over an immutable record and a frozen snapshot —
// one read per (record, index), memoized.
const inspections = new WeakMap<PlaythroughRecord, Map<number, PlaythroughInspection>>();

// The complete-record narrow (issue #509): the readers that need the
// exact historical boards — historical inspection, artifact export, the
// later-era probe boundary — assert complete retention here, one named
// refusal, instead of silently reading a missing board as data.
export interface CompletePlaythroughSnapshot extends PlaythroughSnapshot {
  readonly state: GameState;
}

export function completeSnapshotsOf(record: PlaythroughRecord): readonly CompletePlaythroughSnapshot[] {
  if (record.retention === "bounded") {
    throw new Error(
      "Playthrough record: a bounded-retention record carries no historical board states — " +
        "this read needs a complete record.",
    );
  }
  return record.snapshots as readonly CompletePlaythroughSnapshot[];
}

export function playthroughInspection(run: PlaythroughRecord, index: number): PlaythroughInspection {
  if (run.retention === "bounded") {
    throw new Error(
      "Playthrough inspection: a bounded-retention record carries no historical board states — " +
        "historical inspection reads a complete record.",
    );
  }
  const hit = inspections.get(run)?.get(index);
  if (hit) return hit;
  // The retention guard above is the narrow: a complete record's snapshots
  // carry their states.
  const snapshot = run.snapshots[index] as CompletePlaythroughSnapshot | undefined;
  if (!snapshot) {
    throw new Error(`Playthrough inspection: no recorded snapshot ${index} — the run carries ${run.snapshots.length}.`);
  }
  const state = snapshot.state;
  const sessions = run.events.filter((event) => event.kind === "session" && event.ok && event.snapshot <= index);
  const previousSession = sessions.at(-2)?.snapshot ?? -1;
  const inspection: PlaythroughInspection = {
    index,
    elapsed: snapshot.elapsed,
    credited: snapshot.credited,
    point: run.trajectory.find((point) => point.snapshot === index) ?? null,
    events: run.events.filter((event) => event.snapshot > previousSession && event.snapshot <= index),
    state,
    rate: snapshot.rate,
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
    voices: snapshot.voices,
  };
  let memo = inspections.get(run);
  if (!memo) {
    memo = new Map();
    inspections.set(run, memo);
  }
  memo.set(index, inspection);
  return inspection;
}

// Shared non-color completion mark for the library and terminal.
export function playthroughStatusMark(record: PlaythroughRecord): string {
  return record.stop.kind === "checkpoint" ? "◆" : record.complete ? "✓" : "✗";
}
