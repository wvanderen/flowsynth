import { createInitialState, createModule } from "./state";
import { investment } from "./economy";
import type { GameState, Hex, ModuleInstance, ModuleType, RateSnapshot } from "./types";

export function fresh(): GameState {
  return createInitialState();
}

export function give(state: GameState, type: ModuleType, pos: Hex | null, level = 0): ModuleInstance {
  const module: ModuleInstance = { ...createModule(state, type, "common"), pos };
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
    if (contribution.type === "additive" || contribution.type === "conditional") sum += contribution.value;
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
