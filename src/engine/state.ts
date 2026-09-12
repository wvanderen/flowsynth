import { DIRECTIONS, hex } from "./hex";
import type { GameState, ModuleInstance, StarterType } from "./types";

export function createInitialState(): GameState {
  const coreModules: ModuleInstance[] = (
    [
      { type: "enter", pos: hex(1, -1) },
      { type: "time", pos: hex(1, 0) },
      { type: "habit", pos: hex(0, -1) },
      { type: "notes", pos: hex(-1, 0) },
      { type: "goals", pos: hex(-1, 1) },
      { type: "tasks", pos: hex(0, 1) },
    ] as const
  ).map((spec, i) => ({
    id: `m${i + 1}`,
    type: spec.type,
    rarity: "common" as const,
    level: 0,
    invested: 0,
    pos: spec.pos,
    bursts: [],
  }));

  return {
    mode: "upgrade",
    sessionIndex: 0,
    sessionsCompleted: 0,
    nous: 0,
    totalEarned: 0,
    modules: coreModules,
    cells: [...DIRECTIONS.map(([q, r]) => hex(q, r)), hex(0, 0), hex(2, 0)],
    cellTokens: 0,
    forge: { progress: 0, earned: 0 },
    expansion: { progress: 0, earned: 0 },
    bankedRolls: [],
    purchased: { additive: false, conditional: false, infusor: false, forge: false, expander: false },
    timeActive: false,
    storeOpened: false,
    session: null,
    pendingGap: null,
    nextId: coreModules.length + 1,
  };
}

export function newModuleId(state: GameState): string {
  return `m${state.nextId++}`;
}

export function starterPurchased(state: GameState, type: StarterType): boolean {
  return state.purchased[type];
}
