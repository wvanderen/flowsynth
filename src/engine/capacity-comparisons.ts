import {
  allocateRates,
  cellCost,
  investment,
  maxChordFactorOf,
  mutatorSlotCost,
  rowGateCost,
  type AllocatedRates,
} from "./economy";
import { allocationQualityOf } from "./allocation";
import { BALANCE, CATEGORY_OF } from "./constants";
import { octaveRowOf } from "./lattice";
import { createHabit, selectHabit } from "./habits";
import { equipBuildNode } from "./builds";
import { createInitialState, createModule, createMutator, OPENING_GATED_ROWS } from "./state";
import { hex } from "./hex";
import type { GameState, ModuleType, MutatorFamily, Rarity } from "./types";

// The complete-board comparison fixtures (issue #262): equal-acquisition,
// equal-upgrade boards over the real engine state — the authoritative
// allocation reads them through allocateRates exactly as live play does —
// arranged across the design's strategy axes.
//
// The equal-investment contract (issue #262's rerun gate), explicit:
// `ledgerOf` prices every board across the three currencies the game
// spends. The nous bill covers the keyed shelf purchases, the level
// investments, and the topology — the cell scaler over the cells bought
// past the opening grant's twelve (which ride every bill equally), plus
// the one-time octave-row gates past the granted rows. The
// practice-metered side is counted, never priced: module rolls cadence on
// credited practice, so roll-bought modules are recorded as counts and
// comparisons either carry the same roster or state the difference. The
// Arete side prices the Mutator entry and its slot unlocks where a
// fixture carries mutators. `spendOf`/`unspent` always quote the nous
// bill; rows record the other two beside it. Boards are assembled through
// the occupancy-safe builder — unique cells, at most one module per cell
// — so an illegal fixture is a construction error, never a silently
// doubled cell.

export interface FixtureModule {
  type: ModuleType;
  level: number;
  q: number;
  r: number;
  rarity?: Rarity;
  // Keyed generators bank their reserve here (a charged fixture emits).
  reserve?: number;
}

export interface FixtureMutator {
  family: MutatorFamily;
  rarity: Rarity;
  q: number;
  r: number;
}

export interface ComparisonBoard {
  name: string;
  cells: { q: number; r: number }[];
  modules: FixtureModule[];
  mutators?: FixtureMutator[];
  // The habit build's equipped node ids (the habit's practice time is
  // fixture state, outside the nous budget — builds are time-earned).
  buildNodes?: string[];
}

// The one occupancy-safe board builder: a cell registers when a module
// takes it, a second module on a taken cell throws, and bridging spacers
// land only on vacant cells.
export class BoardBuilder {
  readonly cells: { q: number; r: number }[] = [];
  readonly modules: FixtureModule[] = [];
  private readonly taken = new Set<string>();

  place(module: FixtureModule): this {
    const key = `${module.q},${module.r}`;
    if (this.taken.has(key)) throw new Error(`illegal board: two modules on cell ${key}`);
    this.taken.add(key);
    this.modules.push(module);
    this.cells.push({ q: module.q, r: module.r });
    return this;
  }

  bridge(qs: readonly number[], r: number): this {
    for (const q of qs) {
      if (!this.taken.has(`${q},${r}`)) this.place({ type: "spacer", level: 0, q, r });
    }
    return this;
  }
}

export interface ComparisonRow {
  family: string;
  board: string;
  capacity: number;
  // The board's whole ν/s under the authoritative allocation.
  rate: number;
  // The largest final chord factor any voice carries.
  maxChordFactor: number;
  activeInstances: number;
  certified: boolean;
  // The nous bill the roster represents (shelf, levels, topology) and what
  // the comparison's budget leaves unspent.
  spent: number;
  unspent: number;
  // The practice-metered side: roll-bought modules, counted.
  rolls: number;
  // The Arete side: the Mutator entry and slot unlocks the board's
  // mutators ride (0 without them).
  mutatorArete: number;
}

export interface SpendLedger {
  // The nous bill.
  shelf: number;
  levels: number;
  cells: number;
  rowGates: number;
  total: number;
  // The practice-metered side: roll-bought modules, counted.
  rolls: number;
  // The Arete side: Mutator entry (first slot rides it) plus the slot
  // unlocks past the first.
  mutatorArete: number;
}

// The keyed shelf prices a fixture's support roster represents —
// oscillators, silent voices, wires and rituals arrive through rolls, so
// only the keyed shelf categories carry a price here.
function shelfSpend(modules: FixtureModule[]): number {
  let total = 0;
  for (const module of modules) {
    const category = CATEGORY_OF[module.type];
    if (category === "generator") total += BALANCE.shelfPrices.generator;
    else if (category === "booster") total += BALANCE.shelfPrices.infusor;
    else if (category === "forge") total += BALANCE.shelfPrices.forge;
  }
  return total;
}

const ROLL_CATEGORIES = new Set(["oscillator", "silentVoice", "spacer", "conduit", "ritual"]);

export function ledgerOf(board: ComparisonBoard): SpendLedger {
  const shelf = shelfSpend(board.modules);
  let levels = 0;
  let rolls = 0;
  for (const module of board.modules) {
    levels += investment(module.level);
    if (ROLL_CATEGORIES.has(CATEGORY_OF[module.type])) rolls++;
  }
  let cells = 0;
  const rows = new Set<number>();
  // The opening grant's twelve cells ride every bill equally: the
  // fixture's first twelve cells are the grant every player starts with,
  // and only the cells past it are bought at the scaler — the topology
  // cost a real player's board actually carried.
  for (let k = BALANCE.openingGrant; k < board.cells.length; k++) cells += cellCost(k);
  for (const cell of board.cells) rows.add(octaveRowOf(hex(cell.q, cell.r)));
  let rowGates = 0;
  for (const row of rows) {
    if (!OPENING_GATED_ROWS.includes(row)) rowGates += rowGateCost(row);
  }
  const count = board.mutators?.length ?? 0;
  let mutatorArete = 0;
  if (count > 0) {
    mutatorArete = BALANCE.catalogEntryCost;
    for (let k = 1; k < count; k++) mutatorArete += mutatorSlotCost(k);
  }
  return { shelf, levels, cells, rowGates, total: shelf + levels + cells + rowGates, rolls, mutatorArete };
}

export function spendOf(board: ComparisonBoard): number {
  return ledgerOf(board).total;
}

// The fixture's engine state: a real GameState carrying exactly the
// board's roster (the opening board's starter is cleared — the fixture
// owns the whole roster), capacity set through the ladder's own state
// field, and (when a fixture charges generators) reserves banked.
// allocateRates reads flow directly, so no session is opened.
export function stateOf(board: ComparisonBoard, capacity: number): GameState {
  const state = createInitialState();
  state.modules = [];
  state.cells = board.cells.map(({ q, r }) => hex(q, r));
  state.cellsBought = Math.max(0, board.cells.length - BALANCE.openingGrant);
  state.capacityBought = capacity - 1;
  for (const spec of board.modules) {
    const module = createModule(state, spec.type, spec.rarity ?? "common");
    module.level = spec.level;
    module.pos = hex(spec.q, spec.r);
    module.reserve = spec.reserve ?? 0;
    state.modules.push(module);
  }
  for (const spec of board.mutators ?? []) {
    const mutator = createMutator(state, spec.family, spec.rarity);
    mutator.pos = hex(spec.q, spec.r);
    state.mutators.push(mutator);
  }
  if (board.buildNodes && board.buildNodes.length > 0) {
    const created = createHabit(state, "comparison");
    if (created.habit) {
      created.habit.seconds = 150 * 3600;
      for (const node of board.buildNodes) equipBuildNode(state, created.habit.id, node);
      selectHabit(state, created.habit.id);
    }
  }
  return state;
}

export function compareBoard(family: string, budget: number, board: ComparisonBoard, capacities: readonly number[]): ComparisonRow[] {
  const ledger = ledgerOf(board);
  const rows: ComparisonRow[] = [];
  for (const capacity of capacities) {
    const state = stateOf(board, capacity);
    const rates: AllocatedRates = allocateRates(state, true);
    rows.push({
      family,
      board: board.name,
      capacity,
      rate: rates.snapshot.rate,
      maxChordFactor: maxChordFactorOf(rates.snapshot),
      activeInstances: rates.read.instances.length,
      certified: rates.read.certified,
      spent: ledger.total,
      unspent: budget - ledger.total,
      rolls: ledger.rolls,
      mutatorArete: ledger.mutatorArete,
    });
  }
  return rows;
}

// ── The formation columns ────────────────────────────────────────────────
// Pitch classes ride the column alone (pitch = 60 + 7q + 12r): C=0 G=1 D=2
// A=3 E=4 B=5 F#=6 C#=7 G#=8 A#=9 D#=10 F=11. A doubled triad is two rows
// of columns C·E·G with the middle columns bridged by spacers, exactly the
// stress ladder's clean shape.

const C = 0;
const E = 4;
const G = 1;
const B = 5;
const D = 2;
const C_SHARP = 7;
const D_SHARP = 9;
const F_NATURAL = 11;

// One doubled-triad cluster: columns C·E·G across rows 0 and 1, spacers
// bridging columns 1·2 and 2·3 on both rows.
export function doubledTriad(level: number, q0 = 0, r0 = 0, rarity: Rarity = "common", silentLevel = -1): ComparisonBoard {
  const columns = [C, E, G];
  const board = new BoardBuilder();
  for (let i = 0; i < columns.length; i++) {
    for (let row = 0; row < 2; row++) {
      const type: ModuleType = silentLevel >= 0 && row === 1 ? "harmonizer" : "additive";
      board.place({
        type,
        level: silentLevel >= 0 && row === 1 ? silentLevel : level,
        q: q0 + columns[i]!,
        r: r0 + row,
        rarity,
      });
    }
  }
  // Spacers conduct; they carry no levels (the bulk ladder excludes them).
  for (const row of [0, 1]) board.bridge([q0 + 2, q0 + 3], r0 + row);
  return { name: "", cells: board.cells, modules: board.modules };
}

// A chromatic hexad: columns C·C#·D·D#·E·F (classes 0·1·2·3·4·5) in one
// long spacer-bridged row.
export function chromaticHexad(level: number): ComparisonBoard {
  const columns = [C, C_SHARP, D, D_SHARP, E, F_NATURAL];
  const board = new BoardBuilder();
  const sorted = [...columns].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    board.place({ type: "additive", level, q: sorted[i]!, r: 0 });
    if (i < sorted.length - 1) {
      const gaps: number[] = [];
      for (let q = sorted[i]! + 1; q < sorted[i + 1]!; q++) gaps.push(q);
      board.bridge(gaps, 0);
    }
  }
  return { name: "", cells: board.cells, modules: board.modules };
}

// A doubled major seventh: columns C·E·G·B across two rows, spacers
// bridging the middle gaps.
export function doubledMajorSeventh(level: number, q0 = 0, r0 = 0): ComparisonBoard {
  const columns = [C, E, G, B];
  const board = new BoardBuilder();
  for (const column of columns) {
    for (const row of [0, 1]) board.place({ type: "additive", level, q: q0 + column, r: r0 + row });
  }
  for (const row of [0, 1]) board.bridge([1, 2, 3], r0 + row);
  return { name: "", cells: board.cells, modules: board.modules };
}

// A doubled dominant seventh: columns C·E·G·B♭ (B♭ = class 10, column 10)
// across two rows, spacers bridging the long gaps on the first row. The
// reviewed revision stubbed spacers onto the occupied G and E cells
// (q=1, q=4) — the occupancy-safe builder refuses that, and the bridge
// lands only on the vacant gap columns.
export function doubledDominantSeventh(level: number, q0 = 0, r0 = 0): ComparisonBoard {
  const columns = [C, E, G, 10];
  const board = new BoardBuilder();
  for (const column of columns) {
    for (const row of [0, 1]) board.place({ type: "additive", level, q: q0 + column, r: r0 + row });
  }
  board.bridge([1, 2, 3, 4, 5, 6, 7, 8, 9], r0);
  return { name: "", cells: board.cells, modules: board.modules };
}

// The formation quality the allocator scores for a board's classes — the
// Q read beside every comparison table.
export function qualityOfBoard(board: ComparisonBoard): number {
  const classes = [...new Set(board.modules.filter((m) => m.type !== "spacer").map((m) => ((7 * m.q) % 12 + 12) % 12))];
  return allocationQualityOf(classes);
}

