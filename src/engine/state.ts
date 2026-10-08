import { BALANCE } from "./constants";
import { hex } from "./hex";
import type { ChordDiscovery, GameState, ModuleInstance, ModuleType, MutatorFamily, MutatorInstance, Rarity } from "./types";

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
// The rows whose octave-row gates the opening grants as paid (ADR-0022).
export const OPENING_GATED_ROWS: number[] = [0, 1];

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
    eraEarned: 0,
    arete: 0,
    prestiges: 0,
    muted: false,
    notificationAsked: false,
    modules: [],
    cells: STARTER_CELLS.map(({ q, r }) => hex(q, r)),
    cellsBought: 0,
    gatedRows: [...OPENING_GATED_ROWS],
    unlockedRows: [],
    catalogEntryOwned: false,
    rollPoolJoined: false,
    horizonBroken: false,
    capacityBought: 0,
    capacityCeilings: 0,
    capacityDiscounts: 0,
    mutatorSlots: [],
    mutators: [],
    forge: { progress: 0, earned: 0 },
    mutatorForge: { progress: 0, earned: 0 },
    flow: { progress: 0, earned: 0 },
    arcCardSeen: false,
    bankedRolls: [],
    bankedMutatorRolls: [],
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
    chordDiscovery: {},
    activeChords: [],
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
    // Reserves are charge state — every module holds one, zero until a
    // generator rule banks into it (ADR-0047).
    reserve: 0,
    // The Bend's player-picked shift defaults to the ♯ (ADR-0048); null on
    // every other type.
    shift: type === "bend" ? BALANCE.bendDefaultShift : null,
  };
}

// Load-time normalization for the v8 per-module surface (issue #229): a
// module saved before the roster wave carries no reserve or shift —
// lenient-defaulted exactly as the fresh shape would write them. Mutates in
// place over the merged state's module list.
export function normalizeModules(modules: ModuleInstance[]): void {
  for (const module of modules) {
    if (typeof module.reserve !== "number" || !Number.isFinite(module.reserve)) module.reserve = 0;
    if (typeof module.shift !== "number") module.shift = module.type === "bend" ? BALANCE.bendDefaultShift : null;
  }
}

// Load-time normalization for the discovery ledger's per-entry surface
// (issue #230): an entry saved before wave 3 carries the count alone — the
// root set lenient-defaults empty while the saved count is respected, so
// history never shrinks; corrupt figures re-derive from what remains.
// Mutates in place over the merged state's ledger.
export function normalizeChordDiscovery(ledger: Record<string, ChordDiscovery>): void {
  for (const record of Object.values(ledger)) {
    if (!record || typeof record !== "object") continue;
    if (!Array.isArray(record.roots)) record.roots = [];
    if (typeof record.rootsHeard !== "number" || !Number.isFinite(record.rootsHeard)) {
      record.rootsHeard = record.roots.length;
    }
    if (typeof record.firstFormedAt !== "number" || !Number.isFinite(record.firstFormedAt)) {
      record.firstFormedAt = 0;
    }
  }
}

// A mutator waits in the Mutator tray (pos = null) until placed into an
// unlocked slot; no levels — rarity alone scales the family's magnitude.
export function createMutator(state: GameState, family: MutatorFamily, rarity: Rarity): MutatorInstance {
  return {
    id: newModuleId(state),
    family,
    rarity,
    pos: null,
  };
}
