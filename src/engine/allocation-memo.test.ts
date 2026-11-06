import { describe, expect, it } from "vitest";
import { allocateRates, allocationMemoStats, displayedRates, LIVE_ALLOCATION_BUDGET, syncRates, voiceCapacityOf } from "./economy";
import { allocationBudgetStats } from "./allocation";
import { advance } from "./advance";
import { startSession } from "./actions";
import { createHabit, selectHabit } from "./habits";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { syncChordDiscoveries } from "./library";
import { recognizedTermsOf } from "./allocation";
import type { GameState, ModuleInstance } from "./types";

// The solve memo (issue #349): the tick path's repeated rate reads —
// advance's boundary sync, the display basis, the charge-projected twin —
// serve one authoritative solve per changed inputs. The exported counters
// are the verification read: consecutive boundary-free flow ticks solve
// nothing, and every input the pass actually reads invalidates exactly
// once.

function placed(state: GameState, type: ModuleInstance["type"], q: number, r = 0, level = 0): ModuleInstance {
  if (!state.cells.some((c) => c.q === q && c.r === r)) state.cells.push(hex(q, r));
  return give(state, type, hex(q, r), level);
}

function memoizedBoard(): GameState {
  const state = fresh();
  placed(state, "additive", 1, 0);
  placed(state, "additive", 0, 1);
  return state;
}

// Solves the mutation costs: build the board (optionally prepared), warm
// the memo on the settled read, apply the mutation, read again, count.
function solvesAfter(mutate: (state: GameState) => void, prepare?: (state: GameState) => void): number {
  const state = memoizedBoard();
  prepare?.(state);
  syncRates(state, true);
  allocationMemoStats.solves = 0;
  mutate(state);
  syncRates(state, true);
  return allocationMemoStats.solves;
}

describe("the live allocation budget (#349)", () => {
  it("the live path honors a finite wall-clock valve again", () => {
    expect(Number.isFinite(LIVE_ALLOCATION_BUDGET.maxMs)).toBe(true);
    expect(LIVE_ALLOCATION_BUDGET.maxNodes).toBeGreaterThan(0);
  });
});

describe("the allocation solve memo (#349)", () => {
  it("consecutive unchanged reads solve once, then every seam hits", () => {
    const state = memoizedBoard();
    allocationMemoStats.solves = 0;
    allocationMemoStats.hits = 0;
    const first = syncRates(state, true);
    // The display twin and a second read of the same basis: memo hits.
    expect(displayedRates(state, true)).toBe(first);
    expect(displayedRates(state, true)).toBe(first);
    expect(allocationMemoStats.solves).toBe(1);
    expect(allocationMemoStats.hits).toBe(2);
    // A later boundary-free read — the next tick's shape — solves nothing.
    const solves = allocationMemoStats.solves;
    expect(displayedRates(state, true)).toBe(first);
    expect(allocationMemoStats.solves).toBe(solves);
  });

  it("a boundary-free flow step drains reserves and banks nous without a solve", () => {
    const state = memoizedBoard();
    const generator = placed(state, "focusKeyed", -1, 0, 1);
    generator.reserve = 600;
    startSession(state, null);
    // The first step may hear the board's chords (the discovery ledger
    // writes, the boost rises); settle it, then watch the calm steps.
    advance(state, 1);
    advance(state, 1);
    allocationMemoStats.solves = 0;
    allocationMemoStats.hits = 0;
    const a = advance(state, 1);
    const b = advance(state, 1);
    // The steps changed nous, session meters, and the generator's
    // reserve — none of them a rate input while it stays charged: no
    // solve.
    expect(b.nousEarned).toBeCloseTo(a.nousEarned, 6);
    expect(generator.reserve).toBeLessThan(600);
    expect(allocationMemoStats.solves).toBe(0);
    expect(allocationMemoStats.hits).toBeGreaterThan(0);
  });

  it("a reserve crossing its empty step is a rate input and re-solves", () => {
    const state = memoizedBoard();
    const generator = placed(state, "focusKeyed", -1, 0, 1);
    generator.reserve = 600;
    startSession(state, null);
    syncRates(state, true);
    allocationMemoStats.solves = 0;
    generator.reserve = 0;
    advance(state, 1);
    expect(allocationMemoStats.solves).toBeGreaterThan(0);
  });

  it("reserve draining without crossing the empty step never re-solves", () => {
    expect(solvesAfter((state) => {
      const generator = state.modules.find((m) => m.type === "focusKeyed" && m.pos !== null)!;
      generator.reserve -= 1;
    }, (state) => {
      const generator = placed(state, "focusKeyed", -1, 0, 1);
      generator.reserve = 600;
    })).toBe(0);
  });

  it("every board input invalidates exactly once", () => {
    // Placement moves: adjacency and pitches re-derive.
    expect(solvesAfter((state) => {
      const moved = state.modules.find((m) => m.pos?.q === 1 && m.pos.r === 0)!;
      moved.pos = hex(2, 0);
    })).toBe(1);
    // A module leaves the board.
    expect(solvesAfter((state) => {
      const lifted = state.modules.find((m) => m.pos?.q === 1 && m.pos.r === 0)!;
      lifted.pos = null;
    })).toBe(1);
    // Level and tier re-weight the pass.
    expect(solvesAfter((state) => {
      state.modules[0]!.level += 1;
    })).toBe(1);
    expect(solvesAfter((state) => {
      state.modules[0]!.tier = 2;
    })).toBe(1);
    // The Bend's pitch shift moves the formation's pitch classes.
    expect(solvesAfter((state) => {
      const bend = state.modules.find((m) => m.type === "bend" && m.pos !== null)!;
      bend.shift = 2;
    }, (state) => {
      placed(state, "bend", 2, 1);
    })).toBe(1);
    // A mutator lands on a module's cell, and a rarity change re-scales it.
    expect(solvesAfter((state) => {
      state.mutators.push({ id: "m1", family: "power", rarity: "common", pos: hex(1, 0) });
    })).toBe(1);
    expect(solvesAfter((state) => {
      state.mutators[0]!.rarity = "rare";
    }, (state) => {
      state.mutators.push({ id: "m1", family: "power", rarity: "common", pos: hex(1, 0) });
    })).toBe(1);
    // A habit selection alone no longer re-solves: the active habit's
    // legacy build left the pass with the build retirement (issue #444) —
    // the selection is not a rate input anymore.
    expect(solvesAfter((state) => {
      state.activeHabitId = state.habits.find((h) => h.id !== state.activeHabitId)!.id;
    }, (state) => {
      createHabit(state, "practice");
      createHabit(state, "other");
      selectHabit(state, state.habits[0]!.id);
    })).toBe(0);
    // Feats and chord discoveries ride their global boosts.
    expect(solvesAfter((state) => {
      state.achievements["spark"] = 1;
    })).toBe(1);
    expect(solvesAfter((state) => {
      syncChordDiscoveries(state, { chords: recognizedTermsOf(allocateRates(state, true).read), now: 0 });
    })).toBe(1);
    // The capacity ladder re-budgets the allocator.
    expect(solvesAfter((state) => {
      state.capacityBought += 1;
    })).toBe(1);
  });

  it("the retention hint is part of the read: a different hint re-solves", () => {
    // Which instances earn is the hint's tie-break (the retention rule
    // live-allocation.test.ts pins), so a changed hint must never serve
    // a stale allocation.
    expect(solvesAfter((state) => {
      state.activeChords = ["Fifth|0|some-other-pair"];
    })).toBe(1);
  });

  it("the two bases cache separately and never cross-serve", () => {
    const state = memoizedBoard();
    allocationMemoStats.solves = 0;
    allocationMemoStats.hits = 0;
    // The display reads (no write-back) — the render pass's shape.
    const build = displayedRates(state, false);
    const flow = displayedRates(state, true);
    expect(flow).not.toBe(build);
    expect(allocationMemoStats.solves).toBe(2);
    expect(displayedRates(state, false)).toBe(build);
    expect(displayedRates(state, true)).toBe(flow);
    expect(allocationMemoStats.solves).toBe(2);
    expect(allocationMemoStats.hits).toBe(2);
  });

  it("an explicit budget or capacity variant reads as its own key", () => {
    const state = memoizedBoard();
    allocationMemoStats.solves = 0;
    syncRates(state, true);
    const devBoard = allocateRates(state, true, { capacity: 3, keep: new Set(state.activeChords) });
    // The override replaces every voice's budget (issue #373): the
    // per-voice read carries it, while the summary's scalar stays the
    // standard voice's figure the ambient meter quotes.
    const allocation = devBoard.snapshot.allocation!;
    expect([...allocation.capacities.values()]).toEqual([3, 3, 3]);
    expect(allocation.capacity).toBe(voiceCapacityOf(state));
    expect(allocationMemoStats.solves).toBe(2);
  });

  it("retention stays bounded (issue #509): recent fingerprints hit, deep recurrences re-solve", () => {
    const state = memoizedBoard();
    syncRates(state, true);
    const baseline = state.modules[0]!.level;
    // Twenty distinct board fingerprints on one live state — the long
    // walk's shape. The memo must not grow with them.
    allocationMemoStats.solves = 0;
    allocationMemoStats.hits = 0;
    for (let level = 1; level <= 20; level++) {
      state.modules[0]!.level = level;
      syncRates(state, true);
    }
    const freshSolves = allocationMemoStats.solves;
    expect(freshSolves).toBe(20);
    // The most recent fingerprint still hits.
    syncRates(state, true);
    expect(allocationMemoStats.hits).toBe(1);
    expect(allocationMemoStats.solves).toBe(freshSolves);
    // A recurrence deeper than the bound was evicted: it re-solves to
    // the identical read, it never serves a stale one.
    state.modules[0]!.level = baseline;
    syncRates(state, true);
    expect(allocationMemoStats.solves).toBe(freshSolves + 1);
    // And that re-solve is warm again.
    syncRates(state, true);
    expect(allocationMemoStats.solves).toBe(freshSolves + 1);
    expect(allocationMemoStats.hits).toBe(2);
  });
});

// The solver's budget outcomes (issue #509): what the recording profiler
// reports — real solve passes, uncertified results, and which limit
// tripped. The deterministic node cap and the wall-clock valve count
// where they fire.
describe("the solver's budget outcomes (#509)", () => {
  const reset = () => {
    allocationBudgetStats.solves = 0;
    allocationBudgetStats.uncertified = 0;
    allocationBudgetStats.nodeTrips = 0;
    allocationBudgetStats.deadlineTrips = 0;
    allocationBudgetStats.maxNodes = 0;
    allocationBudgetStats.maxMs = 0;
  };

  it("a tripped node budget reads as an uncertified node trip", () => {
    const state = memoizedBoard();
    reset();
    const { read } = allocateRates(state, true, {
      keep: new Set(state.activeChords ?? []),
      budget: { maxNodes: 1, maxMs: 60_000 },
    });
    expect(allocationBudgetStats.solves).toBe(1);
    expect(read.certified).toBe(false);
    expect(allocationBudgetStats.uncertified).toBe(1);
    expect(allocationBudgetStats.nodeTrips).toBeGreaterThan(0);
    expect(allocationBudgetStats.deadlineTrips).toBe(0);
    expect(allocationBudgetStats.maxNodes).toBeGreaterThan(0);
  });

  it("a tripped wall-clock valve reads as a deadline trip beside the node count", () => {
    const state = memoizedBoard();
    reset();
    const { read } = allocateRates(state, true, {
      keep: new Set(state.activeChords ?? []),
      budget: { maxNodes: 1_000_000, maxMs: 0 },
    });
    expect(allocationBudgetStats.solves).toBe(1);
    expect(read.certified).toBe(false);
    expect(allocationBudgetStats.deadlineTrips).toBeGreaterThan(0);
  });

  it("a certified solve counts clean", () => {
    const state = memoizedBoard();
    reset();
    const { read } = allocateRates(state, true, {
      keep: new Set(state.activeChords ?? []),
      budget: { maxNodes: 250_000, maxMs: 750 },
    });
    expect(read.certified).toBe(true);
    expect(allocationBudgetStats.solves).toBe(1);
    expect(allocationBudgetStats.uncertified).toBe(0);
    expect(allocationBudgetStats.nodeTrips).toBe(0);
    expect(allocationBudgetStats.deadlineTrips).toBe(0);
  });
});
