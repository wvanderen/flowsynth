import { BALANCE } from "./constants";
import { assertFocusScenario, createFocusScenarioState, focusScenarioSummary } from "./focus-scenario";
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

// The origin classification (parent story 9): where the setup's state
// comes from. "initial state" is the shipped opening itself;
// "constructed fixture" is a development-built setup ordinary play cannot
// reach; later tickets add recipe-generated checkpoints.
export type ScenarioOrigin = "initial state" | "constructed fixture";

export interface ScenarioDescriptor {
  readonly id: string;
  readonly name: string;
  // The intended situation, one line: what the launch is for.
  readonly situation: string;
  readonly origin: ScenarioOrigin;
  // The intended state, rebuilt from nothing every call.
  build(now: number): GameState;
  // The intended setup restated as checks, failing with a named reason.
  assert(state: GameState, now: number): void;
  // The ✓ readout's headline figures.
  summary(): string;
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

// The catalog in suite order: fresh start first (the game's own opening),
// then the evidence setups.
export const SCENARIOS: readonly ScenarioDescriptor[] = [FRESH_START, FOCUS];

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
