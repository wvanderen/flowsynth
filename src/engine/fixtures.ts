import { createInitialState, createModule } from "./state";
import { createHabit, DEFAULT_HABIT_COLOR, selectHabit } from "./habits";
import { createHabitClasses, pairOf } from "./classes";
import { investment } from "./economy";
import { isOscillatorType } from "./constants";
import type { ClassPairState, GameState, Habit, Hex, ModuleInstance, ModuleType, RateSnapshot } from "./types";

import { generateOffer, type Rng } from "./rolls";
import { isModuleCandidate, type Candidate, type RollOffer } from "./types";

// Legacy module-only scenarios assert that premise while exercising the
// real generator. Never casts a World reward into a module.
export function generateModuleOffer(state: GameState, rng: Rng, extraTierChance = 0): RollOffer<Candidate> {
  const offer = generateOffer(state, rng, extraTierChance);
  const [a, b, c] = offer.candidates;
  if (!isModuleCandidate(a) || !isModuleCandidate(b) || !isModuleCandidate(c)) throw new Error("Expected a module-only offer");
  return { ...offer, candidates: [a, b, c] };
}

export function fresh(): GameState {
  return createInitialState();
}

// A habit with its Engineer pair selected — the fixture for anything that
// keys off the active habit–class pair (issue #423). Returns the pair so
// tests can rig its meter and tree directly.
export function giveHabit(state: GameState, name = "Piano"): { habit: Habit; pair: ClassPairState } {
  const created = createHabit(state, name);
  if (!created.ok || !created.habit) throw new Error("fixture habit failed");
  selectHabit(state, created.habit.id);
  return { habit: created.habit, pair: pairOf(created.habit) };
}

// A complete hand-built habit shape for tests that push habits directly —
// the save's shape, launch class wear and the palette default included
// (issue #423, issue #445).
export function plainHabit(id = "h1", name = "Piano"): Habit {
  return { id, name, seconds: 0, archived: false, color: DEFAULT_HABIT_COLOR, classId: "engineer", classes: createHabitClasses() };
}

export function give(state: GameState, type: ModuleType, pos: Hex | null, level = 0): ModuleInstance {
  const module: ModuleInstance = { ...createModule(state, type), pos };
  if (level > 0) {
    module.level = level;
    module.invested = investment(level);
  }
  state.modules.push(module);
  return module;
}

// The displayed module figures summed — the "figures sum to the board rate
// within rounding" read (ADR-0036) shared by the engine suites.
export function sumSynthValues(snapshot: RateSnapshot): number {
  let sum = 0;
  for (const contribution of snapshot.contributions.values()) {
    if (isOscillatorType(contribution.type)) sum += contribution.value;
  }
  return sum;
}

export function stubRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng exhausted at ${i}`);
    return values[i++]!;
  };
}
