import { createInitialState, createModule } from "./state";
import { createHabit, selectHabit } from "./habits";
import { createHabitClasses, pairOf } from "./classes";
import { investment } from "./economy";
import { isOscillatorType } from "./constants";
import type { ClassPairState, GameState, Habit, Hex, ModuleInstance, ModuleType, RateSnapshot } from "./types";

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
// the save's shape, launch class wear included (issue #423).
export function plainHabit(id = "h1", name = "Piano"): Habit {
  return { id, name, seconds: 0, archived: false, classId: "engineer", classes: createHabitClasses() };
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
