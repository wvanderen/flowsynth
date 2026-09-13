import { createInitialState, createModule } from "./state";
import { investment } from "./economy";
import type { GameState, Hex, ModuleInstance, ModuleType } from "./types";

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

export function at(state: GameState, type: ModuleType): ModuleInstance {
  const module = state.modules.find((m) => m.type === type && m.pos !== null);
  if (!module) throw new Error(`no deployed ${type}`);
  return module;
}

export function grantBurst(state: GameState, strength: number, seconds: number): void {
  const time = at(state, "time");
  time.bursts.push({ strength, seconds });
}

export function stubRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng exhausted at ${i}`);
    return values[i++]!;
  };
}

export function setActive(state: GameState): void {
  state.timeActive = true;
}
