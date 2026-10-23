import { hasActiveWorldEnemy } from "./world";
import { BALANCE } from "./constants";
import { assertFocusScenario, createFocusScenarioState, focusScenarioSummary } from "./focus-scenario";
import {
  playthroughCheckpointPreset,
  preparePlaythroughCheckpoint,
  APPROACHING_PRESTIGE_RECIPE,
  PUSHING_CHECKPOINT_RECIPE,
  type PlaythroughCheckpointId,
  type PlaythroughRecipe,
} from "./playthrough";
import { horizonReached } from "./accumulator";
import { createInitialState, openingGrant } from "./state";
import type { GameState } from "./types";

// The playtesting suite's scenario catalog (issue #467, parent #465): the
// declared launchable setups behind the one application-facing command
// boundary. Each descriptor owns its identity — name, intended situation,
// origin classification — and its builder plus assertion, the ADR-0077
// pair: the builder maps nothing but its own constants onto a fresh state
// through the real creation seams, and the assertion is the check every
// consumer runs on the candidate before an install touches anything. New
// scenarios join this catalog; they never add a parallel launch path.

// The origin classification (parent stories 8–9): where the setup's state
// comes from. "initial state" is the shipped opening itself;
// "constructed fixture" is a development-built setup ordinary play cannot
// reach; "recipe checkpoint" is a declared playthrough walk's stop — the
// situation was reached by real practice, not built by hand, and the
// recipe stays on the descriptor as the reachability evidence.
export type ScenarioOrigin = "initial state" | "constructed fixture" | "recipe checkpoint";

export interface ScenarioDescriptor {
  readonly id: string;
  readonly name: string;
  // The intended situation, one line: what the launch is for.
  readonly situation: string;
  readonly origin: ScenarioOrigin;
  // The declared recipe a checkpoint preset grew from (issue #471): the
  // reachability evidence — starting scenario, seed, policy, claim target,
  // schedule, budget. Read lazily: the catalog initializes beside the
  // runner, and the recipe belongs to whoever asks. Absent on the initial
  // state and the constructed fixtures.
  readonly recipe?: PlaythroughRecipe;
  // The intended state, rebuilt from nothing every call.
  build(now: number): GameState;
  // Optional cold preparation; the application awaits it before building.
  prepare?(): Promise<void>;
  // The intended setup restated as checks, failing with a named reason.
  assert(state: GameState, now: number): void;
  // The ✓ readout's headline figures.
  summary(): string;
}

// The named-failure shape every descriptor's assertion shares.
function failFor(name: string): (why: string) => never {
  return (why) => {
    throw new Error(`${name}: ${why}`);
  };
}

// The fresh start: the shipped opening board itself, the game's own first
// moment. Its origin is honest — nothing here is constructed; the state is
// exactly what a new player's first upgrade mode carries.
const FRESH_START: ScenarioDescriptor = {
  id: "fresh-start",
  name: "Fresh start",
  situation: "the shipped opening board",
  origin: "initial state",
  build: () => createInitialState(),
  assert: (state) => assertFreshStart(state),
  summary: () => `${openingGrant()}ν grant · one synth · upgrade mode`,
};

// The Focus evidence scenario (issue #456), unchanged beneath the suite:
// engine/focus-scenario.ts stays its one authoritative place.
const FOCUS: ScenarioDescriptor = {
  id: "focus",
  name: "Focus",
  situation: "session preparation with class development (#456)",
  origin: "constructed fixture",
  build: (now) => createFocusScenarioState(now),
  assert: (state, now) => assertFocusScenario(state, now),
  summary: () => focusScenarioSummary(),
};

// ── The progression presets (issue #471, parent #465) ──

// Three checkpoints grown from declared playthrough recipes: the runner
// walks its own walk — real sessions, real purchases, real prestige — and
// stops at the declared moment, so each situation was reached, never
// built. Nothing is fabricated: the Arete the second preset carries was
// earned by the walk's own practice, and a constructed fixture could
// never say that. The recipe stays on the descriptor (read lazily — the
// catalog and the runner initialize beside each other) as the
// reachability evidence, and the summary names the walk's day and
// identity. The summary's first read in a page IS the walk (the memo
// turns every later read into a clone): the walked day is the preset's
// headline figure, so the readout's cost is the preset's own walk. When
// the engine drifts from a checkpoint's intended situation, the walk
// fails its build with a named reason instead of installing a lookalike.
function checkpointSummary(id: PlaythroughCheckpointId): string {
  const preset = playthroughCheckpointPreset(id);
  return `day ${preset.record.days} of the declared walk · ${preset.record.runId}`;
}

const APPROACHING_PRESTIGE: ScenarioDescriptor = {
  id: "approaching-prestige",
  name: "Approaching prestige",
  situation: "an established board with the first prestige door open (#471)",
  origin: "recipe checkpoint",
  get recipe() {
    return APPROACHING_PRESTIGE_RECIPE;
  },
  prepare: () => preparePlaythroughCheckpoint("approaching-prestige"),
  build: () => playthroughCheckpointPreset("approaching-prestige").state,
  assert: (state) => assertApproachingPrestige(state),
  summary: () => checkpointSummary("approaching-prestige"),
};

const AFTER_FIRST_BANK: ScenarioDescriptor = {
  id: "after-first-bank",
  name: "After first bank",
  situation: "immediately after the first prestige, its earned Arete unspent (#471)",
  origin: "recipe checkpoint",
  get recipe() {
    return PUSHING_CHECKPOINT_RECIPE;
  },
  prepare: () => preparePlaythroughCheckpoint("after-first-bank"),
  build: () => playthroughCheckpointPreset("after-first-bank").state,
  assert: (state) => assertAfterFirstBank(state, PUSHING_CHECKPOINT_RECIPE.claimTarget),
  summary: () => checkpointSummary("after-first-bank"),
};

const WORLD_ENEMY: ScenarioDescriptor = {
  id: "world-enemy",
  name: "World enemy",
  situation: "a living discovered enemy with the placement decision unplayed (#471)",
  origin: "recipe checkpoint",
  get recipe() {
    return PUSHING_CHECKPOINT_RECIPE;
  },
  prepare: () => preparePlaythroughCheckpoint("world-enemy-active"),
  build: () => playthroughCheckpointPreset("world-enemy-active").state,
  assert: (state) => assertWorldEnemy(state),
  summary: () => checkpointSummary("world-enemy-active"),
};

// The catalog in suite order: fresh start first (the game's own opening),
// then the progression presets in the order a playthrough meets them, then
// the evidence setups.
export const SCENARIOS: readonly ScenarioDescriptor[] = [
  FRESH_START,
  APPROACHING_PRESTIGE,
  AFTER_FIRST_BANK,
  WORLD_ENEMY,
  FOCUS,
];

export function scenarioOf(id: string): ScenarioDescriptor | null {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

// The fresh start's assertion: the defining opening facts, each failing
// with a named reason. Exact-equality against a fresh build is the
// consumer suites' stronger read; this assertion is the one that runs in
// the app, where a named failure is the contract.
export function assertFreshStart(state: GameState): void {
  const fail: (why: string) => never = (why) => {
    throw new Error(`Fresh start: ${why}`);
  };
  if (state.mode !== "upgrade") fail(`expected upgrade mode — found ${state.mode}.`);
  if (state.habits.length !== 0) fail(`expected no habits — found ${state.habits.length}.`);
  if (state.sessionsCompleted !== 0 || state.sessionRecords.length !== 0) {
    fail(`expected an unplayed game — found ${state.sessionsCompleted} sessions.`);
  }
  if (state.nous !== BALANCE.openingGrant) {
    fail(`expected the ${BALANCE.openingGrant}ν opening grant — found ${state.nous}ν.`);
  }
  if (state.totalEarned !== 0) fail(`expected zero lifetime earnings — found ${state.totalEarned}ν.`);
  if (state.modules.length !== 1 || state.modules[0]!.type !== "additive" || state.modules[0]!.level !== 0) {
    fail("expected exactly the opening synth, level 0.");
  }
  if (state.bankedRolls.length !== 0 || state.bankedMutatorRolls.length !== 0) {
    fail("expected no banked rolls.");
  }
  if (state.prestiges !== 0 || state.arete !== 0) fail("expected the first era — no prestiges, no Arete.");
}

// The approaching door's assertion (issue #471): the first era is played
// and established, the horizon stands open, and nothing has been banked,
// granted, or entered — the walk stopped before the door, not past it.
function assertApproachingPrestige(state: GameState): void {
  const fail = failFor("Approaching prestige");
  if (state.mode !== "upgrade") fail(`expected upgrade mode — found ${state.mode}.`);
  if (state.prestiges !== 0) fail(`expected the first era — found ${state.prestiges} prestiges.`);
  if (state.arete !== 0) fail(`expected no Arete before the first prestige — found ${state.arete}.`);
  if (!horizonReached(state)) fail("expected the prestige horizon reached — the door is not open.");
  if (state.sessionsCompleted === 0 || state.sessionRecords.length !== state.sessionsCompleted) {
    fail("expected a played, established board — no completed sessions behind it.");
  }
  if (state.modules.filter((module) => module.pos !== null).length < 2) {
    fail("expected an established board — fewer than two placed modules.");
  }
  if (state.catalogEntryOwned) fail("expected no Catalog entry before the first prestige.");
  if (state.world.weapons.length > 0) fail("expected no World grant before the first prestige.");
}

// The first bank's assertion (issue #471): exactly one prestige, the
// earned claim sitting unspent, the starter blade waiting in the tray,
// and the fresh second era untouched — the walk stopped between the bank
// and the spending it would trigger.
function assertAfterFirstBank(state: GameState, claimTarget: number): void {
  const fail = failFor("After first bank");
  if (state.mode !== "upgrade") fail(`expected upgrade mode — found ${state.mode}.`);
  if (state.prestiges !== 1) fail(`expected exactly the first prestige — found ${state.prestiges}.`);
  if (state.arete !== claimTarget) {
    fail(`expected the earned ${claimTarget}-Arete claim unspent — found ${state.arete}.`);
  }
  if (state.world.frontier !== claimTarget) {
    fail(`expected the frontier advanced by the claim — found ${state.world.frontier}.`);
  }
  const blade = state.world.weapons.length === 1 ? state.world.weapons[0] : null;
  if (!state.world.starterWeaponGranted || !blade || blade.pos !== null) {
    fail("expected the starter Charge Blade waiting in the tray.");
  }
  if (state.catalogEntryOwned) fail("expected the earned spending still unplayed — the Catalog entry is owned.");
  if (state.eraEarned !== 0) fail(`expected the fresh second era — era-earned is ${state.eraEarned}.`);
  if (state.capacityBought !== 0) fail("expected the reset capacity ladder — the second era has not re-earned its rungs.");
}

// The living fight's assertion (issue #471): one prestige behind it, a
// discovered enemy still alive, the starter blade's placement unplayed,
// and the earned claim spent into the purchases the walk's rules name —
// Catalog entry owned, a Charge Column standing, the bank honestly empty.
function assertWorldEnemy(state: GameState): void {
  const fail = failFor("World enemy");
  if (state.mode !== "upgrade") fail(`expected upgrade mode — found ${state.mode}.`);
  if (state.prestiges !== 1) fail(`expected the era after the first prestige — found ${state.prestiges}.`);
  if (!hasActiveWorldEnemy(state)) fail("expected a discovered enemy still alive — the World has no active fight.");
  if (!state.world.weapons.some((weapon) => weapon.pos === null)) {
    fail("expected a weapon waiting in the tray — the placement decision is unplayed.");
  }
  if (!state.catalogEntryOwned) fail("expected the earned spending played — the Catalog entry is unowned.");
  if (!state.world.columns.some((column) => column.pos !== null)) {
    fail("expected a placed Charge Column from the earned spending.");
  }
  if (state.arete !== 0) fail(`expected the earned claim fully spent — ${state.arete} Arete remain.`);
}
