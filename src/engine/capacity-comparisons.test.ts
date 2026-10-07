import { describe, expect, it } from "vitest";
import {
  chromaticHexad,
  compareBoard,
  doubledDominantSeventh,
  doubledMajorSeventh,
  doubledTriad,
  qualityOfBoard,
  spendOf,
  type ComparisonBoard,
  type ComparisonRow,
} from "./capacity-comparisons";
import { investment } from "./economy";
import type { Rarity } from "./types";

// The complete-board comparison record (issue #262): the strategy axes the
// release calibration must satisfy — concentrated/distributed power,
// organized/tense/lush formations, chromatic density, duplicate voices,
// silent voices, charge, boosters, builds, rarity and mutators — at equal
// acquisition and upgrade investment, with unspent balances recorded, read
// through the authoritative allocation at every capacity the ladder can
// reach. The assertions carry the design's qualitative contracts: each
// capacity purchase opens a real optimization opportunity, organized
// sevenths stay useful, chromatic cramming never dominates, and
// concentrated power stays viable while distributed strategies compete.

const CAPACITIES = [1, 2, 3, 4, 5];
const BUDGET = 25_000;

// The largest single level a budget affords, and the equal share a roster
// of `voices` spreads — the two power shapes' level picks.
function levelForBudget(budget: number): number {
  let level = 0;
  while (investment(level + 1) <= budget) level++;
  return level;
}

function levelForShare(budget: number, voices: number): number {
  return levelForBudget(budget / voices);
}

// The largest equal level for `voices` whose total spend fits `target` —
// the control's level pick when a support board's bill is the fixed side.
function levelMatchingSpend(target: number, voices: number): number {
  let level = 0;
  while (voices * investment(level + 1) <= target) level++;
  return level;
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

describe("the complete-board comparisons (#262)", () => {
  it("separates power shapes — concentrated stays viable, distributed competes", () => {
    const share = levelForShare(BUDGET, 6);
    const concentratedLevel = levelForBudget(BUDGET);
    const boards = [
      named(doubledTriad(concentratedLevel, 0, 0, "common", -1), "concentrated"),
      named(doubledTriad(share), "distributed"),
    ];
    // The concentrated board parks the whole budget on one voice; the
    // distributed one spreads it evenly. Same roster, same budget.
    boards[0] = { ...boards[0], modules: boards[0]!.modules.map((m, i) => (m.type === "additive" ? ({ ...m, level: i === 0 ? concentratedLevel : 0 }) : m)) };
    const rows = rowsFor("power", BUDGET, boards);
    console.log("\npower shapes (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(
        `  ${row.board.padEnd(14)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)} spent=${row.spent} unspent=${row.unspent} certified=${row.certified}`,
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
    const share = levelForShare(BUDGET, 8);
    const boards = [
      named(doubledTriad(levelForShare(BUDGET, 6)), "doubled triad"),
      named(doubledMajorSeventh(share), "doubled maj7"),
      named(doubledDominantSeventh(share), "doubled dom7"),
      named(chromaticHexad(levelForShare(BUDGET, 6)), "chromatic hexad"),
    ];
    const rows = rowsFor("formation", BUDGET, boards);
    console.log("\nformations (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(
        `  ${row.board.padEnd(14)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)} Q=${qualityOfBoard(boards.find((b) => b.name === row.board)!).toFixed(3)} certified=${row.certified}`,
      );
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
    expect(rate(rows, "doubled dom7", 2)).toBeGreaterThan(rate(rows, "doubled triad", 2));
    // The ordering holds at late-era budgets too, where the power leg's
    // level curve has multiplied every voice equally — the harmony terms,
    // not the level curve, must keep deciding.
    const high = 2_500_000;
    const highRows = rowsFor("formation-high", high, [
      named(doubledTriad(levelForShare(high, 6)), "doubled triad"),
      named(doubledMajorSeventh(levelForShare(high, 8)), "doubled maj7"),
      named(chromaticHexad(levelForShare(high, 6)), "chromatic hexad"),
    ]);
    console.log("\nformations at late-era budget %d:", high);
    for (const row of highRows) {
      console.log(`  ${row.board.padEnd(14)} cap=${row.capacity} rate=${row.rate.toExponential(3)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)}`);
    }
    for (const capacity of CAPACITIES) {
      expect(rate(highRows, "chromatic hexad", capacity)).toBeLessThan(rate(highRows, "doubled triad", capacity));
    }
    expect(rate(highRows, "doubled maj7", 3)).toBeGreaterThan(rate(highRows, "doubled triad", 3));
  });

  it("rewards duplicates as capacity rises — each rung opens an optimization opportunity", () => {
    const level = levelForShare(BUDGET, 6);
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
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)}`);
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
    const level = levelForShare(BUDGET, 6);
    const sweetened = named(doubledTriad(level, 0, 0, "common", level), "silent support");
    const full = named(doubledTriad(level), "all oscillators");
    const rows = rowsFor("silent", BUDGET, [sweetened, full]);
    console.log("\nsilent voices (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} active=${row.activeInstances} maxFactor=${row.maxChordFactor.toFixed(2)}`);
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
    const level = levelForShare(BUDGET, 6);
    const supported: ComparisonBoard = {
      ...doubledTriad(level),
      cells: [...doubledTriad(level).cells, { q: -1, r: 0 }],
      modules: [...doubledTriad(level).modules, { type: "focusKeyed", level: 5, q: -1, r: 0, reserve: 1800 }],
    };
    // The control sinks the same total spend one ladder further into the
    // six oscillators — the largest level whose spend fits the supported
    // board's bill.
    const matchedLevel = levelMatchingSpend(spendOf(supported), 6);
    const plain = named(doubledTriad(matchedLevel), "levels instead");
    const rows = rowsFor("charge", BUDGET, [named(supported, "charge support"), plain]);
    console.log("\ncharge (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} spent=${row.spent} unspent=${row.unspent}`);
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
    const boostedMatch = levelMatchingSpend(spendOf(boosted), 6);
    const plainBoost = named(doubledTriad(boostedMatch), "levels instead");
    const boosterRows = rowsFor("booster", BUDGET, [named(boosted, "booster support"), plainBoost]);
    console.log("\nbooster (budget %d):", BUDGET);
    for (const row of boosterRows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} spent=${row.spent} unspent=${row.unspent}`);
    }
    for (const capacity of CAPACITIES) {
      expect(rate(boosterRows, "booster support", capacity)).toBeGreaterThan(rate(boosterRows, "levels instead", capacity));
    }
  });

  it("weights the habit build into the same arrangement choices", () => {
    const level = levelForShare(BUDGET, 6);
    const built = named({ ...doubledTriad(level), buildNodes: ["weights", "pitch-ear"] }, "with build");
    const plain = named(doubledTriad(level), "without build");
    const rows = rowsFor("build", BUDGET, [built, plain]);
    console.log("\nbuild (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} maxFactor=${row.maxChordFactor.toFixed(3)}`);
    }
    // The time-earned build lifts every row (synth term) and deepens the
    // chord factor (pitch-ear) — the build favors the organized boards the
    // same arrangements already prefer, it never flips the ordering.
    for (const capacity of CAPACITIES) {
      expect(rate(rows, "with build", capacity)).toBeGreaterThan(rate(rows, "without build", capacity));
    }
  });

  it("reads mutators on the same board — power and resonance both land", () => {
    const level = levelForShare(BUDGET, 6);
    const boards = [
      named(doubledTriad(level), "no mutator"),
      named({ ...doubledTriad(level), mutators: [{ family: "power", rarity: "uncommon", q: 0, r: 0 }] }, "power mutator"),
      named({ ...doubledTriad(level), mutators: [{ family: "resonance", rarity: "uncommon", q: 0, r: 0 }] }, "resonance mutator"),
    ];
    const rows = rowsFor("mutator", BUDGET, boards);
    console.log("\nmutators (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(20)} cap=${row.capacity} rate=${row.rate.toFixed(2)} maxFactor=${row.maxChordFactor.toFixed(3)}`);
    }
    for (const capacity of CAPACITIES) {
      expect(rate(rows, "power mutator", capacity)).toBeGreaterThan(rate(rows, "no mutator", capacity));
      expect(rate(rows, "resonance mutator", capacity)).toBeGreaterThan(rate(rows, "no mutator", capacity));
    }
  });

  it("scales rarity without touching capacity", () => {
    const level = levelForShare(BUDGET, 6);
    const boards = (["common", "uncommon", "rare"] as const).map((rarity: Rarity) =>
      named(doubledTriad(level, 0, 0, rarity), `rarity-${rarity}`),
    );
    const rows = rowsFor("rarity", BUDGET, boards);
    console.log("\nrarity (budget %d):", BUDGET);
    for (const row of rows) {
      console.log(`  ${row.board.padEnd(16)} cap=${row.capacity} rate=${row.rate.toFixed(2)} maxFactor=${row.maxChordFactor.toFixed(3)}`);
    }
    // Rarity never alters the chord math: the factors match exactly; only
    // the power leg scales.
    for (const capacity of CAPACITIES) {
      const factors = boards.map((board) => rows.find((row) => row.board === board.name && row.capacity === capacity)!.maxChordFactor);
      expect(factors[1]).toBeCloseTo(factors[0]!, 9);
      expect(factors[2]).toBeCloseTo(factors[0]!, 9);
      expect(rate(rows, "rarity-rare", capacity)).toBeGreaterThan(rate(rows, "rarity-common", capacity));
    }
  });
});
