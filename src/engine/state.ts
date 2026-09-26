import { BALANCE } from "./constants";
import { hex } from "./hex";
import type { GameState, ModuleInstance, ModuleType, Rarity } from "./types";

// The opening board (board-redesign spec §8, ADR-0022): the three-cell
// opening footprint is retained — its geometry, not its Carrier rationale.
// The player starts with exactly one plain synthesizer, pre-placed at C4
// (the origin cell), and the tray starts empty.
const STARTER_CELLS: { q: number; r: number }[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
];

// The octave rows the opening footprint spans (C4·G4 in row 0, C5 in row 1):
// their one-time gates are paid by the same grant that places the cells, so
// the start register is never "new" to the economy (ADR-0022 — gate distance
// counts from it).
const OPENING_GATED_ROWS: number[] = [0, 1];

// The opening grant (ADR-0022): a nous grant that affords — but no longer
// exactly equals — the pre-placed synthesizer's first upgrade. Everything
// else is earned through play.
export function openingGrant(): number {
  return BALANCE.openingGrant;
}

export function createInitialState(): GameState {
  const state: GameState = {
    mode: "upgrade",
    sessionIndex: 0,
    sessionsCompleted: 0,
    unstructuredSessions: 0,
    plannedSessionsCompleted: 0,
    combinations: 0,
    nous: openingGrant(),
    totalEarned: 0,
    arete: 0,
    horizonAcknowledged: false,
    muted: false,
    notificationAsked: false,
    modules: [],
    cells: STARTER_CELLS.map(({ q, r }) => hex(q, r)),
    cellsBought: 0,
    gatedRows: [...OPENING_GATED_ROWS],
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
    sessionRecords: [],
    goals: [],
    achievements: {},
    session: null,
    summary: null,
    nextId: 1,
  };
  const opening = createModule(state, "additive", "common");
  opening.pos = hex(0, 0);
  state.modules.push(opening);
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
