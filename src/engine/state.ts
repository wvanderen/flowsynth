import { BALANCE, isOscillatorType, WORLD_ENEMIES } from "./constants";
import { hex } from "./hex";
import type { ChordDiscovery, GameState, ModuleInstance, ModuleType, MutatorFamily, MutatorInstance, Rarity, WeaponCopy, WeaponType, WorldColumn, WorldState } from "./types";

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
    scrap: 0,
    draftTierBonus: 0,
    specialDrafts: { category: 0, rare: 0, tier: 0 },
    mergeCapPurchases: 0,
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
    world: freshWorld(),
    capacityBought: 0,
    capacityCeilings: 0,
    capacityDiscounts: 0,
    mutatorSlots: [],
    mutators: [],
    forge: { progress: 0, earned: 0 },
    mutatorForge: { progress: 0, earned: 0 },
    arcCardSeen: false,
    bankedRolls: [],
    bankedMutatorRolls: [],
    purchased: { generator: false, infusor: false, forge: false },
    goalCapacityBought: 0,
    notes: [],
    habits: [],
    activeHabitId: null,
    practiceLog: [],
    sessionRecords: [],
    goals: [],
    goalFuel: 0,
    achievements: {},
    chordDiscovery: {},
    activeChords: [],
    session: null,
    summary: null,
    breather: null,
    lastSessionClock: 0,
    breathersCompleted: 0,
    breatherSeconds: 0,
    nextId: 1,
  };
  const opening = createModule(state, "additive");
  opening.pos = hex(0, 0);
  state.modules.push(opening);
  return state;
}

export function newModuleId(state: GameState): string {
  return `m${state.nextId++}`;
}

// The tier argument (ADR-0058) is the merge tier the copy mints at — 0 from
// every fresh grant, roll, and shelf purchase; the legacy conversion is the
// only source of higher tiers.
export function createModule(state: GameState, type: ModuleType, tier: number = 0): ModuleInstance {
  return {
    id: newModuleId(state),
    type,
    tier,
    level: 0,
    invested: 0,
    pos: null,
    // Reserves are charge state — every module holds one, zero until a
    // generator rule banks into it (ADR-0047).
    reserve: 0,
    // The Bend's player-picked shift defaults to the ♯ (ADR-0048); null on
    // every other type.
    shift: type === "bend" ? BALANCE.bendDefaultShift : null,
    // The Spotlight's recipient starts unselected (issue #374): the booster
    // is inactive until the player picks — never an output-ranked guess.
    target: null,
  };
}

// Load-time normalization for the v9 per-module surface (issue #367): a
// module saved before the tier cut carries no tier — lenient-defaulted to
// the base tier exactly as a fresh shape would write it. Mutates in place
// over the merged state's module list.
export function normalizeModules(modules: ModuleInstance[]): void {
  for (const module of modules) {
    if (typeof module.reserve !== "number" || !Number.isFinite(module.reserve)) module.reserve = 0;
    if (typeof module.shift !== "number") module.shift = module.type === "bend" ? BALANCE.bendDefaultShift : null;
    if (typeof module.tier !== "number" || !Number.isInteger(module.tier) || module.tier < 0) module.tier = 0;
    // A position that is not a full hex reads as the tray (issue #372's
    // hardening): every pass guards `pos === null`, never an undefined —
    // a corrupt figure must degrade to "undeployed", not poison the boot.
    const pos = module.pos as { q?: unknown; r?: unknown } | null | undefined;
    if (!pos || typeof pos.q !== "number" || typeof pos.r !== "number") module.pos = null;
    // The Spotlight's selection (issue #374) lenient-defaults the same way:
    // absent means unselected, and an id that resolves to nothing — or to
    // something that could never receive the focus — drops. A real id for
    // a melted recipient cannot occur (the combine clears it), so the id
    // set is the whole check; validity and adjacency are live reads,
    // never stored.
    if (
      typeof module.target !== "string" ||
      !modules.some((other) => other.id === module.target && isOscillatorType(other.type))
    ) {
      module.target = null;
    }
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

// The World layer's fresh surface (issue #425): an unclaimed frontier, the
// once-ever starter flag down, empty occupant trays, zero Hone ranks, and
// every authored enemy standing reserved at its fixed stats. Enemies key to
// the authored roster — the table is code, the save only live state.
// `freshEnemyStates` is the restore shape too: prestige resets the
// encounters to exactly this map.
export function freshEnemyStates(): WorldState["enemies"] {
  return Object.fromEntries(WORLD_ENEMIES.map((def) => [def.key, { discovered: false, hp: def.maxHp }]));
}

export function freshWorld(): WorldState {
  return {
    frontier: 0,
    starterWeaponGranted: false,
    columns: [],
    weapons: [],
    hone: { chargeBlade: 0 },
    enemies: freshEnemyStates(),
  };
}

// A Charge Column copy waits in the World tray (pos = null) until placed
// over an owned cell; persistence rides the reset contract.
export function createWorldColumn(state: GameState): WorldColumn {
  return { id: newModuleId(state), pos: null };
}

// A weapon copy waits in the World tray: its store and cadence clock start
// empty, and its target priority starts unconfigured — the authored roster
// order resolves until the player picks between sessions (issue #425).
export function createWeapon(state: GameState, type: WeaponType): WeaponCopy {
  return {
    id: newModuleId(state),
    type,
    pos: null,
    store: 0,
    cooldown: 0,
    targetPriority: [],
  };
}

// Load-time normalization for the World layer's surface (issue #425): a
// save written before the World layer carries none of it — exactly what a
// fresh shape owes. Corrupt figures re-default; unknown enemy keys drop;
// missing authored keys fill from the table; an overfilled store clamps at
// the cap it could never exceed; a stale cadence clock folds into one
// interval so it can never wedge the walk.
function hexOrTray(raw: unknown): { q: number; r: number } | null {
  const pos = raw as { q?: unknown; r?: unknown } | null | undefined;
  return pos && typeof pos.q === "number" && typeof pos.r === "number" ? { q: pos.q, r: pos.r } : null;
}

export function normalizeWorld(raw: unknown): WorldState {
  const world = freshWorld();
  if (typeof raw !== "object" || raw === null) return world;
  const shape = raw as Partial<WorldState> & Record<string, unknown>;
  if (typeof shape.frontier === "number" && Number.isFinite(shape.frontier) && shape.frontier > 0) {
    world.frontier = shape.frontier;
  }
  if (shape.starterWeaponGranted === true) world.starterWeaponGranted = true;
  if (Array.isArray(shape.columns)) {
    for (const column of shape.columns) {
      if (typeof column !== "object" || column === null) continue;
      const candidate = column as Partial<WorldColumn> & Record<string, unknown>;
      if (typeof candidate.id !== "string") continue;
      world.columns.push({ id: candidate.id, pos: hexOrTray(candidate.pos) });
    }
  }
  if (Array.isArray(shape.weapons)) {
    for (const weapon of shape.weapons) {
      if (typeof weapon !== "object" || weapon === null) continue;
      const candidate = weapon as unknown as Record<string, unknown>;
      if (typeof candidate.id !== "string") continue;
      // The first experiment ships one weapon type (issue #425); the
      // per-type schema is the seam a second joins, so the load read is
      // per-type already.
      const type: WeaponType = "chargeBlade";
      const store = typeof candidate.store === "number" && Number.isFinite(candidate.store) && candidate.store > 0 ? candidate.store : 0;
      const cooldown = typeof candidate.cooldown === "number" && Number.isFinite(candidate.cooldown) && candidate.cooldown > 0 ? candidate.cooldown : 0;
      const priority = Array.isArray(candidate.targetPriority)
        ? candidate.targetPriority.filter((key): key is string => typeof key === "string" && WORLD_ENEMIES.some((def) => def.key === key))
        : [];
      world.weapons.push({
        id: candidate.id,
        type,
        pos: hexOrTray(candidate.pos),
        store: Math.min(store, BALANCE.world.storageCap),
        cooldown: cooldown % BALANCE.world.attackCadenceSeconds,
        targetPriority: [...new Set(priority)],
      });
    }
  }
  if (typeof shape.hone === "object" && shape.hone !== null) {
    for (const key of Object.keys(world.hone) as WeaponType[]) {
      const rank = (shape.hone as Record<string, unknown>)[key];
      if (typeof rank === "number" && Number.isFinite(rank) && rank > 0) {
        world.hone[key] = Math.min(Math.floor(rank), BALANCE.world.honeCosts.length);
      }
    }
  }
  if (typeof shape.enemies === "object" && shape.enemies !== null) {
    for (const [key, value] of Object.entries(shape.enemies as Record<string, unknown>)) {
      const def = WORLD_ENEMIES.find((entry) => entry.key === key);
      if (!def || typeof value !== "object" || value === null) continue;
      const candidate = value as Record<string, unknown>;
      const hp = typeof candidate.hp === "number" && Number.isFinite(candidate.hp) ? candidate.hp : def.maxHp;
      world.enemies[key] = {
        discovered: candidate.discovered === true,
        hp: Math.min(Math.max(hp, 0), def.maxHp),
      };
    }
  }
  return world;
}
