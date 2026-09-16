import { levelCost } from "./economy";
import { hex } from "./hex";
import type { GameState, ModuleInstance, ModuleType, Rarity } from "./types";

// ADR-0013 opening board: the Carrier pinned at the origin plus ~2 empty
// cells.
const STARTER_CELLS: { q: number; r: number }[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: -1 },
];

// The opening grant (ADR-0013): exactly the Carrier's first upgrade price —
// priced below the shelf floor, so beat one is spendable within seconds of
// reading and the balance returns to zero on the first purchase.
export function openingGrant(): number {
  return levelCost(0);
}

export function createInitialState(): GameState {
  const state: GameState = {
    mode: "upgrade",
    sessionIndex: 0,
    sessionsCompleted: 0,
    nous: openingGrant(),
    totalEarned: 0,
    arete: 0,
    horizonAcknowledged: false,
    welcomeAcked: false,
    modules: [],
    cells: STARTER_CELLS.map(({ q, r }) => hex(q, r)),
    cellsBought: 0,
    forge: { progress: 0, earned: 0 },
    chargeWindow: 0,
    bankedRolls: [],
    purchased: { generator: false, infusor: false, forge: false },
    activatedApps: [],
    goalCapacityBought: 0,
    notes: [],
    habits: [],
    activeHabitId: null,
    practiceLog: [],
    goals: [],
    session: null,
    summary: null,
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
