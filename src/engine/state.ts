import { DIRECTIONS, hex } from "./hex";
import type { GameState, ModuleInstance } from "./types";

export function createInitialState(): GameState {
  const state: GameState = {
    mode: "upgrade",
    sessionIndex: 0,
    sessionsCompleted: 0,
    nous: 0,
    totalEarned: 0,
    modules: [],
    cells: [...DIRECTIONS.map(([q, r]) => hex(q, r)), hex(0, 0), hex(2, 0)],
    cellTokens: 0,
    forge: { progress: 0, earned: 0 },
    expansion: { progress: 0, earned: 0 },
    bankedRolls: [],
    purchased: { additive: false, conditional: false, infusor: false, forge: false, expander: false },
    timeActive: false,
    notesActive: false,
    notes: [],
    habits: [],
    activeHabitId: null,
    practiceLog: [],
    goalsActive: false,
    goals: [],
    tasksActive: false,
    tasks: [],
    allowance: 0,
    taskCompletionCounter: 0,
    storeOpened: false,
    session: null,
    pendingGap: null,
    nextId: 1,
  };
  const layout: { type: ModuleInstance["type"]; pos: ReturnType<typeof hex> }[] = [
    { type: "enter", pos: hex(1, -1) },
    { type: "time", pos: hex(1, 0) },
    { type: "habit", pos: hex(0, -1) },
    { type: "notes", pos: hex(-1, 0) },
    { type: "goals", pos: hex(-1, 1) },
    { type: "tasks", pos: hex(0, 1) },
  ];
  for (const { type, pos } of layout) {
    const module = createModule(state, type, "common");
    module.pos = pos;
    state.modules.push(module);
  }
  return state;
}

export function newModuleId(state: GameState): string {
  return `m${state.nextId++}`;
}

export function createModule(
  state: GameState,
  type: ModuleInstance["type"],
  rarity: ModuleInstance["rarity"],
): ModuleInstance {
  return {
    id: newModuleId(state),
    type,
    rarity,
    level: 0,
    invested: 0,
    pos: null,
    bursts: [],
  };
}
