import { describe, expect, it } from "vitest";
import {
  BoardBuilder,
  chromaticHexad,
  compareBoard,
  doubledDominantSeventh,
  doubledMajorSeventh,
  doubledTriad,
  ledgerOf,
  qualityOfBoard,
  spendOf,
  type ComparisonBoard,
  type ComparisonRow,
} from "./capacity-comparisons";
import { investment, levelCost } from "./economy";
import type { Rarity } from "./types";

// The complete-board comparison record (issue #262): the strategy axes the
// release calibration must satisfy — concentrated/distributed power,
// organized/tense/lush formations, chromatic density, duplicate voices,
// silent voices, charge, boosters, builds, rarity and mutators — read
// through the authoritative allocation at every capacity the ladder can
// reach.
//
// The equal-investment contract, explicit (issue #262's rerun gate): every
// board's nous bill is `ledgerOf`'s full ledger — keyed shelf purchases,
// level investments, and the topology (cell scaler over the board's cell
// count plus one-time octave-row gates past the granted rows). Where a
// family's boards differ in shape, each board's level pick is matched
// against its own whole bill, so no row quietly buys more board than its
// rival; unspent nous is recorded on every row. The practice-metered side
// (module rolls) is counted on every row — the formation family's rosters
// differ in roll count and the record states that difference rather than
// pretending it away. The Arete side (Mutator entry, slot unlocks) rides
// mutator fixtures only and is recorded beside them; the build family
// holds the build's time-earned nodes constant by construction.

const CAPACITIES = [1, 2, 3, 4, 5];
const BUDGET = 25_000;
// The late-progression construction budget: cells persist across
// prestiges (the topology is lifetime acquisition, the levels the era's
// upgrade investment), and the sprawling boards' past-the-grant cells
// only exist at this scale.
const LATE_BUDGET = 25_000_000;

// The largest single level a budget affords — the concentrated shape's
// pick: the whole budget parked on one voice.
function levelForBudget(budget: number): number {
  let level = 0;
  while (investment(level + 1) <= budget) level++;
  return level;
}

// The largest equal singer level whose board's whole ledger fits the
// budget — the equal-investment pick once topology is in the bill.
function levelForBoardBudget(board: (level: number) => ComparisonBoard, budget: number): number {
  let level = 0;
  while (spendOf(board(level + 1)) <= budget) level++;
  return level;
}

// The largest equal level for the template board whose total bill fits
// `target` — the control's level pick when a support board's bill is the
// fixed side.
function levelMatchingSpend(template: (level: number) => ComparisonBoard, target: number): number {
  return levelForBoardBudget(template, target);
}

function named(board: ComparisonBoard, name: string): ComparisonBoard {
  return { ...board, name };
}

// A board's rows at one capacity, keyed by board name.
function rowsFor(family: string, budget: number, boards: ComparisonBoard[], capacities: readonly number[] = CAPACITIES): ComparisonRow[] {
  return boards.flatMap((board) => compareBoard(family, budget, board, capacities));
}

function rate(rows: ComparisonRow[], board: string, capacity: number): number {
  return rows.find((row) => row.board === board && row.capacity === capacity)!.rate;
}

describe("fixture legality and the spend ledger (#262 rerun gates)", () => {
  it("assembles only legal boards — unique cells, one module per cell, modules on cells", () => {
    const boards = [doubledTriad(3), chromaticHexad(3), doubledMajorSeventh(3), doubledDominantSeventh(3)];
    for (const board of boards) {
      const seen = new Set<string>();
      for (const module of board.modules) {
        const key = `${module.q},${module.r}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      // The cell list is exactly the occupied set — no phantom cells, no
      // module off the board.
      expect(board.cells.length).toBe(seen.size);
      for (const cell of board.cells) expect(seen.has(`${cell.q},${cell.r}`)).toBe(true);
    }
    // The builder refuses a doubled cell outright — the reviewed
    // revision's dom7 stubbed spacers onto occupied G and E cells (q=1,
    // q=4), which can never happen again silently.
    expect(() =>
      new BoardBuilder().place({ type: "additive", level: 1, q: 0, r: 0 }).place({ type: "spacer", level: 0, q: 0, r: 0 }),
    ).toThrow(/two modules/);
    // The rebuilt dominant seventh bridges only the vacant gap columns.
    const dom7 = doubledDominantSeventh(3);
    expect(
      dom7.modules.filter((m) => m.type === "spacer").map((m) => m.q).sort((a, b) => a - b),
    ).toEqual([2, 3, 5, 6, 7, 8, 9]);
  });

  it("prices the whole board: topology, row gates, rolls and the Mutator Arete side", () => {
    // Two boards of equal roster but different topology differ exactly by
    // their cell bill, gate, and shelf side; an out-of-band row owes its
    // gate; a mutator fixture carries its Arete side. Thirteen cells puts
    // one past the grant.
    const plain = doubledTriad(3);
    const extended: ComparisonBoard = {
      name: "",
      cells: [...plain.cells, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: -1, r: 2 }],
      modules: [...plain.modules, { type: "focusKeyed", level: 0, q: -1, r: 0 }],
    };
    const plainLedger = ledgerOf(plain);
    const extendedLedger = ledgerOf(extended);
    expect(extendedLedger.cells).toBeGreaterThan(plainLedger.cells); // cell 13 is past the grant
    expect(extendedLedger.rowGates).toBeGreaterThan(0); // octave row −2 is outside the granted band
    expect(extendedLedger.shelf).toBeGreaterThan(plainLedger.shelf);
    expect(extendedLedger.total - plainLedger.total).toBe(
      extendedLedger.cells - plainLedger.cells + extendedLedger.rowGates - plainLedger.rowGates + extendedLedger.shelf - plainLedger.shelf,
    );
    // Inside the grant a bigger board is free; the grant rides every bill.
    const granted: ComparisonBoard = { ...plain, cells: [...plain.cells, { q: -1, r: 1 }] };
    expect(ledgerOf(granted).cells).toBe(plainLedger.cells);
    const mutated: ComparisonBoard = { ...plain, mutators: [{ family: "power", rarity: "uncommon", q: 0, r: 0 }] };
    expect(ledgerOf(mutated).mutatorArete).toBe(1); // the entry; the first slot rides it
    expect(plainLedger.mutatorArete).toBe(0);
    // Rows carry the contract out. The triad roster: six singers plus
    // four conducting spacers — all roll-bought.
    const rows = rowsFor("ledger", BUDGET, [named(mutated, "mutated")]);
    expect(rows[0]!.rolls).toBe(10);
    expect(rows[0]!.mutatorArete).toBe(1);
    expect(rows[0]!.spent).toBe(ledgerOf(mutated).total);
    expect(rows[0]!.unspent).toBe(BUDGET - ledgerOf(mutated).total);
  });
});

describe("the complete-board comparisons (#262)", () => {
  it("separates power shapes — concentrated stays viable, distributed competes", () => {
    const concentratedLevel = levelForBudget(BUDGET);
    const share = levelForBoardBudget((level) => doubledTriad(level), BUDGET);
    const boards = [
      named(doubledTriad(concentratedLevel, 0, 0, "common", -1), "concentrated"),
      named(doubledTriad(share), "distributed"),
    ];
    // The concentrated board parks the whole budget on one voice; the
    // distributed one spreads it evenly. Same roster, same topology, and
    // each bill fits the budget whole-level-exact.
    boards[0] = { ...boards[0], modules: boards[0]!.modules.map((m, i) => (m.type === "additive" ? ({ ...m, level: i === 0 ? concentratedLevel : 0 }) : m)) };
    const rows = rowsFor("power", BUDGET, boards);
    console.log("\npower shapes (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(
        `  ${row.board.padEnd(14)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)} spent=${row.spent} unspent=${row.unspent} rolls=${row.rolls} certified=${row.certified}`,
      );
    }
    for (const capacity of CAPACITIES) {
      const spread = rate(rows, "distributed", capacity);
      const focused = rate(rows, "concentrated", capacity);
      expect(focused).toBeGreaterThan(0);
      expect(spread).toBeGreaterThan(0);
    }
    // Concentrated power stays viable: it never falls below a tenth of the
    // spread shape at any capacity.
    for (const capacity of CAPACITIES) {
      expect(rate(rows, "concentrated", capacity)).toBeGreaterThan(rate(rows, "distributed", capacity) / 10);
    }
  });

  it("orders formations — organized sevenths useful, chromatic cramming never dominant", () => {
    // The tight boards (ten to twelve cells) fit inside the opening
    // grant, so at the small budget the topology bill is zero and the
    // levels carry the whole comparison. The sprawling doubled dom7
    // cannot: the cells past the grant cost more than the whole budget —
    // it enters at the late-progression leg below, where every board buys
    // its own topology and the rosters' roll counts (singers plus wires: 10/12/15/11) ride the
    // rows.
    const boards = [
      named(doubledTriad(levelForBoardBudget((l) => doubledTriad(l), BUDGET)), "doubled triad"),
      named(doubledMajorSeventh(levelForBoardBudget((l) => doubledMajorSeventh(l), BUDGET)), "doubled maj7"),
      named(chromaticHexad(levelForBoardBudget((l) => chromaticHexad(l), BUDGET)), "chromatic hexad"),
    ];
    const rows = rowsFor("formation", BUDGET, boards);
    console.log("\nformations (budget %d):", BUDGET);
    for (const row of rows) {
      const board = boards.find((b) => b.name === row.board)!;
      console.log(
        `  ${row.board.padEnd(14)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)} Q=${qualityOfBoard(board).toFixed(3)} spent=${row.spent} unspent=${row.unspent} rolls=${row.rolls} certified=${row.certified}`,
      );
    }
    // The equal-investment boundary, asserted: every board spent within
    // whole levels of the budget, and one more board-wide step would
    // overshoot it.
    for (const board of boards) {
      expect(spendOf(board)).toBeLessThanOrEqual(BUDGET);
      expect(spendOf(board)).toBeGreaterThan(BUDGET - investmentStep(board));
    }
    // Chromatic cramming never beats an organized board of the same
    // budget at any capacity.
    for (const capacity of CAPACITIES) {
      const chromatic = rate(rows, "chromatic hexad", capacity);
      expect(chromatic).toBeLessThan(rate(rows, "doubled triad", capacity));
      expect(chromatic).toBeLessThan(rate(rows, "doubled maj7", capacity));
    }
    // Organized sevenths stay useful: at the capacities where their extra
    // voices can participate (two and up) they beat the plain triad.
    expect(rate(rows, "doubled maj7", 2)).toBeGreaterThan(rate(rows, "doubled triad", 2));
    // The late-progression leg: every board buys its own topology first,
    // then the deepest whole-level fit its residue affords — the harmony
    // terms, not the level curve, must keep deciding.
    const lateBoards = [
      named(doubledTriad(levelForBoardBudget((l) => doubledTriad(l), LATE_BUDGET)), "doubled triad"),
      named(doubledMajorSeventh(levelForBoardBudget((l) => doubledMajorSeventh(l), LATE_BUDGET)), "doubled maj7"),
      named(doubledDominantSeventh(levelForBoardBudget((l) => doubledDominantSeventh(l), LATE_BUDGET)), "doubled dom7"),
      named(chromaticHexad(levelForBoardBudget((l) => chromaticHexad(l), LATE_BUDGET)), "chromatic hexad"),
    ];
    const highRows = rowsFor("formation-high", LATE_BUDGET, lateBoards);
    console.log("\nformations at late-progression budget %d:", LATE_BUDGET);
    for (const row of highRows) {
      const board = lateBoards.find((b) => b.name === row.board)!;
      console.log(
        `  ${row.board.padEnd(14)} cap=${row.capacity} rate=${row.rate.toExponential(3)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)} Q=${qualityOfBoard(board).toFixed(3)} spent=${row.spent.toExponential(2)} unspent=${row.unspent.toExponential(2)} rolls=${row.rolls} cells=${ledgerOf(board).cells} certified=${row.certified}`,
      );
    }
    for (const board of lateBoards) {
      expect(spendOf(board)).toBeLessThanOrEqual(LATE_BUDGET);
      expect(spendOf(board)).toBeGreaterThan(LATE_BUDGET - investmentStep(board));
    }
    for (const capacity of CAPACITIES) {
      expect(rate(highRows, "chromatic hexad", capacity)).toBeLessThan(rate(highRows, "doubled triad", capacity));
      expect(rate(highRows, "chromatic hexad", capacity)).toBeLessThan(rate(highRows, "doubled maj7", capacity));
    }
    // Organized sevenths stay useful at the late budget too, where their
    // extra voices actually participate.
    expect(rate(highRows, "doubled maj7", 2)).toBeGreaterThan(rate(highRows, "doubled triad", 2));
    expect(rate(highRows, "doubled dom7", 2)).toBeGreaterThan(rate(highRows, "doubled triad", 2));
    expect(rate(highRows, "doubled maj7", 3)).toBeGreaterThan(rate(highRows, "doubled triad", 3));
  });

  it("rewards duplicates as capacity rises — each rung opens an optimization opportunity", () => {
    const level = levelForBoardBudget((l) => doubledTriad(l), BUDGET);
    const wide = named(
      {
        name: "",
        cells: [],
        modules: [
          // C·D·E·G·A·B — six distinct classes, spacer-bridged: the
          // no-duplicate control. Singers at row 0 columns C·D·E and
          // row 1 columns G·A·B, the gaps carrying the spacers.
          ...([[0, 0], [2, 0], [4, 0], [1, 1], [3, 1], [5, 1]] as const).map(([q, r]) => ({ type: "additive" as const, level, q, r })),
          ...([[1, 0], [3, 0], [2, 1], [4, 1]] as const).map(([q, r]) => ({ type: "spacer" as const, level: 0, q, r })),
        ],
      },
      "wide hexatonic",
    );
    wide.cells = wide.modules.map((m) => ({ q: m.q, r: m.r }));
    const boards = [named(doubledTriad(level), "doubled triad"), wide];
    const rows = rowsFor("duplicates", BUDGET, boards);
    console.log("\nduplicates (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)} spent=${row.spent} unspent=${row.unspent}`);
    }
    // Capacity is the duplicate's whole reward: over the full ladder the
    // doubled triad's standing against the duplicate-free control rises,
    // and its per-voice depth (the max chord factor) climbs rung by rung
    // while its voices still have room.
    for (const capacity of [2, 3]) {
      const triadFactor = rows.find((row) => row.board === "doubled triad" && row.capacity === capacity)!.maxChordFactor;
      const previous = rows.find((row) => row.board === "doubled triad" && row.capacity === capacity - 1)!.maxChordFactor;
      expect(triadFactor).toBeGreaterThan(previous);
    }
    const triadRise = rate(rows, "doubled triad", 5) / rate(rows, "doubled triad", 1);
    const wideRise = rate(rows, "wide hexatonic", 5) / rate(rows, "wide hexatonic", 1);
    expect(triadRise).toBeGreaterThan(wideRise);
  });

  it("keeps silent voices sweetening, never dominating", () => {
    const level = levelForBoardBudget((l) => doubledTriad(l), BUDGET);
    const sweetened = named(doubledTriad(level, 0, 0, "common", level), "silent support");
    const full = named(doubledTriad(level), "all oscillators");
    const rows = rowsFor("silent", BUDGET, [sweetened, full]);
    console.log("\nsilent voices (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)} spent=${row.spent} unspent=${row.unspent}`);
    }
    // The silent support never wins the low ladder (uplift sweetens named
    // instances; it sings nothing of its own, and at capacity one there is
    // little to sweeten) — and never runs away at the high end: support
    // competes, it does not dominate by an unbounded margin.
    expect(rate(rows, "silent support", 1)).toBeLessThan(rate(rows, "all oscillators", 1));
    expect(rate(rows, "silent support", 2)).toBeLessThanOrEqual(rate(rows, "all oscillators", 2) * 1.05);
    for (const capacity of [3, 4, 5]) {
      expect(rate(rows, "silent support", capacity)).toBeLessThan(rate(rows, "all oscillators", capacity) * 2);
    }
    // The archetype is capacity-scaling: its standing rises as the ladder
    // opens — the higher rungs are where the sweetened instances stack.
    const low = rate(rows, "silent support", 1) / rate(rows, "all oscillators", 1);
    const high = rate(rows, "silent support", 3) / rate(rows, "all oscillators", 3);
    expect(high).toBeGreaterThan(low);
  });

  it("pays for charge and booster support at equal spend", () => {
    const level = levelForBoardBudget((l) => doubledTriad(l), BUDGET);
    const supported: ComparisonBoard = {
      ...doubledTriad(level),
      cells: [...doubledTriad(level).cells, { q: -1, r: 0 }],
      modules: [...doubledTriad(level).modules, { type: "focusKeyed", level: 5, q: -1, r: 0, reserve: 1800 }],
    };
    // The control sinks the same total bill — the supported board's whole
    // ledger, topology and row gate included — one ladder further into
    // the six oscillators.
    const matchedLevel = levelMatchingSpend((l) => doubledTriad(l), spendOf(supported));
    const plain = named(doubledTriad(matchedLevel), "levels instead");
    const rows = rowsFor("charge", BUDGET, [named(supported, "charge support"), plain]);
    console.log("\ncharge (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} spent=${row.spent} unspent=${row.unspent} rolls=${row.rolls}`);
    }
    // The charged board earns its generator's price: charged voices
    // out-produce the same spend sunk into levels alone.
    for (const capacity of CAPACITIES) {
      expect(rate(rows, "charge support", capacity)).toBeGreaterThan(rate(rows, "levels instead", capacity));
    }
    // The booster leg mirrors it — an adjacent infusor beats equal spend
    // in levels.
    const boosted: ComparisonBoard = {
      ...doubledTriad(level),
      cells: [...doubledTriad(level).cells, { q: -1, r: 0 }],
      modules: [...doubledTriad(level).modules, { type: "infusor", level: 5, q: -1, r: 0 }],
    };
    const boostedMatch = levelMatchingSpend((l) => doubledTriad(l), spendOf(boosted));
    const plainBoost = named(doubledTriad(boostedMatch), "levels instead");
    const boosterRows = rowsFor("booster", BUDGET, [named(boosted, "booster support"), plainBoost]);
    console.log("\nbooster (budget %d):", BUDGET);
    for (const row of boosterRows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} spent=${row.spent} unspent=${row.unspent} rolls=${row.rolls}`);
    }
    for (const capacity of CAPACITIES) {
      expect(rate(boosterRows, "booster support", capacity)).toBeGreaterThan(rate(boosterRows, "levels instead", capacity));
    }
  });

  it("weights the habit build into the same arrangement choices", () => {
    const level = levelForBoardBudget((l) => doubledTriad(l), BUDGET);
    const built = named({ ...doubledTriad(level), buildNodes: ["weights", "pitch-ear"] }, "with build");
    const plain = named(doubledTriad(level), "without build");
    const rows = rowsFor("build", BUDGET, [built, plain]);
    console.log("\nbuild (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} maxFactor=${row.maxChordFactor.toFixed(3)}`);
    }
    // The time-earned build lifts every row (synth term) and deepens the
    // chord factor (pitch-ear) — the build favors the organized boards the
    // same arrangements already prefer, it never flips the ordering. The
    // build's own nodes are time-earned and held identical between the
    // two rows.
    for (const capacity of CAPACITIES) {
      expect(rate(rows, "with build", capacity)).toBeGreaterThan(rate(rows, "without build", capacity));
    }
  });

  it("reads mutators on the same board — power and resonance both land", () => {
    const level = levelForBoardBudget((l) => doubledTriad(l), BUDGET);
    const boards = [
      named(doubledTriad(level), "no mutator"),
      named({ ...doubledTriad(level), mutators: [{ family: "power", rarity: "uncommon", q: 0, r: 0 }] }, "power mutator"),
      named({ ...doubledTriad(level), mutators: [{ family: "resonance", rarity: "uncommon", q: 0, r: 0 }] }, "resonance mutator"),
    ];
    const rows = rowsFor("mutator", BUDGET, boards);
    console.log("\nmutators (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(20)} cap=${row.capacity} rate=${row.rate.toFixed(2)} maxFactor=${row.maxChordFactor.toFixed(3)} mutatorArete=${row.mutatorArete}`);
    }
    // The nous bills are identical — the mutator rides a cell's second
    // face, so the topology is unchanged — and the Arete side (the entry;
    // the first slot rides it) is recorded on the mutator rows and only
    // there: the control simply holds that Arete unspent.
    expect(rows.find((row) => row.board === "no mutator")!.mutatorArete).toBe(0);
    expect(rows.find((row) => row.board === "power mutator")!.mutatorArete).toBe(1);
    for (const capacity of CAPACITIES) {
      expect(rate(rows, "power mutator", capacity)).toBeGreaterThan(rate(rows, "no mutator", capacity));
      expect(rate(rows, "resonance mutator", capacity)).toBeGreaterThan(rate(rows, "no mutator", capacity));
    }
  });

  it("scales rarity without touching capacity", () => {
    const level = levelForBoardBudget((l) => doubledTriad(l), BUDGET);
    const boards = (["common", "uncommon", "rare"] as const).map((rarity: Rarity) =>
      named(doubledTriad(level, 0, 0, rarity), `rarity-${rarity}`),
    );
    const rows = rowsFor("rarity", BUDGET, boards);
    console.log("\nrarity (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} maxFactor=${row.maxChordFactor.toFixed(3)} rolls=${row.rolls}`);
    }
    // Rarity never alters the chord math: the factors match exactly; only
    // the power leg scales. The roll-lottery side is held constant by
    // construction — identical rosters, only the rarity face differs.
    for (const capacity of CAPACITIES) {
      const factors = boards.map((board) => rows.find((row) => row.board === board.name && row.capacity === capacity)!.maxChordFactor);
      expect(factors[1]).toBeCloseTo(factors[0]!, 9);
      expect(factors[2]).toBeCloseTo(factors[0]!, 9);
      expect(rate(rows, "rarity-rare", capacity)).toBeGreaterThan(rate(rows, "rarity-common", capacity));
    }
  });
});

// The whole-level boundary, made precise: the matching picked the largest
// level whose total bill fits, so the residual is smaller than one
// board-wide level step (every singer up one level).
function investmentStep(board: ComparisonBoard): number {
  const singers = board.modules.filter((m) => m.type === "additive");
  const step = levelCost(Math.max(...singers.map((m) => m.level)));
  return singers.length * step;
}
