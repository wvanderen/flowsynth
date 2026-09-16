import { hex } from "./hex";
import type { GameState, ModuleInstance, ModuleType, Rarity } from "./types";

// ADR-0013 opening board: the Carrier pinned at the origin plus ~2 empty
// cells. The opening grant (the Carrier's first upgrade price as starting
// nous) arrives with the catalog work (issue #43).
const STARTER_CELLS: { q: number; r: number }[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: -1 },
];

export function createInitialState(): GameState {
  const state: GameState = {
    mode: "upgrade",
    sessionIndex: 0,
    sessionsCompleted: 0,
    nous: 0,
    totalEarned: 0,
    modules: [],
    cells: STARTER_CELLS.map(({ q, r }) => hex(q, r)),
    cellsBought: 0,
    forge: { progress: 0, earned: 0 },
    chargeWindow: 0,
    bankedRolls: [],
    purchased: { generator: false, infusor: false, forge: false },
    notes: [],
    habits: [],
    activeHabitId: null,
    practiceLog: [],
    goals: [],
    session: null,
    pendingGap: null,
    nextId: 1,
  };
  const carrier = createModule(state, "carrier", "common");
  carrier.pos = hex(0, 0);
  state.modules.push(carrier);
  return state;
}

export function newModuleId(state: GameState): string {
  return `m${state.nextId++}`;
}

export function createModule(state: GameState, type: ModuleType, rarity: Rarity): ModuleInstance {
  return {
    id: newModuleId(state),
    type,
    rarity,
    level: 0,
    invested: 0,
    pos: null,
  };
}

// The Carrier pins the grid's origin cell: it anchors every pitch (§4).
export const ORIGIN = hex(0, 0);

// The Carrier is the unique granted synthesizer: pinned, immovable,
// unsellable (§2.1).
export function isCarrier(module: ModuleInstance): boolean {
  return module.type === "carrier";
}
