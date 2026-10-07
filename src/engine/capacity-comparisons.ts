import { allocateRates, investment, maxChordFactorOf, type AllocatedRates } from "./economy";
import { allocationQualityOf } from "./allocation";
import { BALANCE, CATEGORY_OF } from "./constants";
import { createHabit, selectHabit } from "./habits";
import { equipBuildNode } from "./builds";
import { createInitialState, createModule, createMutator } from "./state";
import { hex } from "./hex";
import type { GameState, ModuleType, MutatorFamily, Rarity } from "./types";

// The complete-board comparison fixtures (issue #262): equal-acquisition,
// equal-upgrade boards over the real engine state — the authoritative
// allocation reads them through allocateRates exactly as live play does —
// arranged across the design's strategy axes. Every family fixes the
// roster (types, rarity, levels, cells) and varies the arrangement the
// question names; where rosters differ, the shelf prices and level
// investments are computed and the unspent balance recorded, so a row
// never quietly buys more board than its rival.

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
  // The acquisition-and-upgrade spend the roster represents, and what the
  // comparison's budget leaves unspent.
  spent: number;
  unspent: number;
}

// The shelf prices a fixture's support roster represents — oscillators
// arrive through rolls, so only the keyed shelf categories carry a price
// here (the shelf sells the generator family, the booster, the Forge).
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

export function spendOf(board: ComparisonBoard): number {
  let total = shelfSpend(board.modules);
  for (const module of board.modules) total += investment(module.level);
  return total;
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
  state.cellsBought = board.cells.length;
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
  const spent = spendOf(board);
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
      spent,
      unspent: budget - spent,
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
  const modules: FixtureModule[] = [];
  const cells: { q: number; r: number }[] = [];
  for (let i = 0; i < columns.length; i++) {
    for (let row = 0; row < 2; row++) {
      const q = q0 + columns[i]!;
      const r = r0 + row;
      const type: ModuleType = silentLevel >= 0 && row === 1 ? "harmonizer" : "additive";
      modules.push({ type, level: silentLevel >= 0 && row === 1 ? silentLevel : level, q, r, rarity });
      cells.push({ q, r });
    }
  }
  for (const q of [q0 + 2, q0 + 3]) {
    for (const row of [0, 1]) cells.push({ q, r: r0 + row });
  }
  // Spacers conduct; they carry no levels (the bulk ladder excludes them).
  for (const cell of cells) {
    if (!modules.some((m) => m.q === cell.q && m.r === cell.r)) {
      modules.push({ type: "spacer", level: 0, q: cell.q, r: cell.r });
    }
  }
  return { name: "", cells, modules };
}

// A chromatic hexad: columns C·C#·D·D#·E·F (classes 0·1·2·3·4·5) in one
// long spacer-bridged row.
export function chromaticHexad(level: number): ComparisonBoard {
  const columns = [C, C_SHARP, D, D_SHARP, E, F_NATURAL];
  const modules: FixtureModule[] = [];
  const cells: { q: number; r: number }[] = [];
  const sorted = [...columns].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    modules.push({ type: "additive", level, q: sorted[i]!, r: 0 });
    cells.push({ q: sorted[i]!, r: 0 });
    if (i < sorted.length - 1) {
      for (let q = sorted[i]! + 1; q < sorted[i + 1]!; q++) {
        modules.push({ type: "spacer", level: 0, q, r: 0 });
        cells.push({ q, r: 0 });
      }
    }
  }
  return { name: "", cells, modules };
}

// A doubled major seventh: columns C·E·G·B across two rows, spacers
// bridging the middle gaps.
export function doubledMajorSeventh(level: number, q0 = 0, r0 = 0): ComparisonBoard {
  const columns = [C, E, G, B];
  const modules: FixtureModule[] = [];
  const cells: { q: number; r: number }[] = [];
  for (const column of columns) {
    for (const row of [0, 1]) {
      modules.push({ type: "additive", level, q: q0 + column, r: r0 + row });
      cells.push({ q: q0 + column, r: r0 + row });
    }
  }
  for (const q of [1, 2, 3]) {
    for (const row of [0, 1]) {
      const occupied = modules.some((m) => m.q === q0 + q && m.r === r0 + row);
      if (!occupied) {
        modules.push({ type: "spacer", level: 0, q: q0 + q, r: r0 + row });
        cells.push({ q: q0 + q, r: r0 + row });
      }
    }
  }
  return { name: "", cells, modules };
}

// A doubled dominant seventh: columns C·E·G·B♭ (B♭ = class 10, column 10).
export function doubledDominantSeventh(level: number, q0 = 0, r0 = 0): ComparisonBoard {
  const columns = [C, E, G, 10];
  const modules: FixtureModule[] = [];
  const cells: { q: number; r: number }[] = [];
  for (const column of columns) {
    for (const row of [0, 1]) {
      modules.push({ type: "additive", level, q: q0 + column, r: r0 + row });
      cells.push({ q: q0 + column, r: r0 + row });
    }
  }
  for (const q of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    modules.push({ type: "spacer", level: 0, q: q0 + q, r: r0 });
    cells.push({ q: q0 + q, r: r0 });
  }
  return { name: "", cells, modules };
}

// The formation quality the allocator scores for a board's classes — the
// Q read beside every comparison table.
export function qualityOfBoard(board: ComparisonBoard): number {
  const classes = [...new Set(board.modules.filter((m) => m.type !== "spacer").map((m) => ((7 * m.q) % 12 + 12) % 12))];
  return allocationQualityOf(classes);
}

