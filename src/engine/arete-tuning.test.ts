import { describe, expect, it } from "vitest";
import { buyCell, buyShelfModule, chooseRoll, endSession, placeModule, prestige, startSession, upgradeModuleLevels } from "./actions";
import { advance } from "./advance";
import { ARETE_HORIZON, horizonReached } from "./accumulator";
import { CATEGORY_OF, isOscillatorType } from "./constants";
import { computeRates } from "./economy";
import { createGoal, deleteGoal } from "./goals";
import { neighbors, sameHex } from "./hex";
import { octaveRowOf, positionInRange } from "./lattice";
import { writeNote } from "./notes";
import { createInitialState } from "./state";
import type { GameState, Hex } from "./types";

// Repeatable balance experiment using actual purchases, offers and production.
// Five sessions are a checkpoint, not a deadline. No resets or free modules.
const THRESHOLDS = [100_000, 1e6, 1e9, 1e12, 1e23, 1e25];
function seeded(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function frontier(state: GameState, shape: "compact" | "fifths"): Hex[] {
  const unique = new Map<string, Hex>();
  for (const cell of state.cells) for (const pos of neighbors(cell)) {
    if (positionInRange(state, pos) && !state.cells.some((c) => sameHex(c, pos))) unique.set(`${pos.q},${pos.r}`, pos);
  }
  return [...unique.values()].sort((a, b) => {
    const score = (p: Hex) => shape === "compact"
      ? Math.abs(p.q) * 4 + Math.abs(octaveRowOf(p))
      : Math.abs(octaveRowOf(p)) * 12 + Math.abs(p.q);
    return score(a) - score(b) || a.q - b.q || a.r - b.r;
  });
}

function manage(state: GameState, shape: "compact" | "fifths"): void {
  // Accept a synthesizer when offered; otherwise a keyed generator — the
  // console facts below keep one fed, so it is a real draw (ADR-0047) —
  // otherwise keep the first candidate.
  for (const offer of [...state.bankedRolls]) {
    const candidate =
      offer.candidates.find((c) => isOscillatorType(c.type)) ??
      offer.candidates.find((c) => CATEGORY_OF[c.type] === "generator") ??
      offer.candidates[0];
    expect(chooseRoll(state, offer.id, candidate.id).ok).toBe(true);
  }
  // A modest player keeps one small goal tracked at all times — re-minted
  // each break because the sim's clock compresses days into sessions, so a
  // completed daily never rolls over. Completing it is the Goal
  // Generator's console fact (ADR-0047): the pool's keyed generators earn
  // their reserves through play, never for free.
  for (const goal of [...state.goals]) deleteGoal(state, goal.id);
  expect(createGoal(state, { habitId: null, minutes: 25, schedule: "once", now: 0 }).ok).toBe(true);
  // At most one shelf purchase and two cells per break, preserving room
  // for expansion before spending the rest on levels.
  for (const type of ["generator", "forge", "infusor"] as const) {
    if (!state.purchased[type]) { buyShelfModule(state, type); break; }
  }
  for (let i = 0; i < 2; i++) {
    if (!state.modules.some((m) => m.pos === null)) break;
    const pos = frontier(state, shape)[0];
    if (!pos || !buyCell(state, pos).ok) break;
  }
  // Greedy vacant-cell placement: a modest preview-driven player, not an
  // exhaustive layout search. Include Forge output so support has value.
  for (const module of [...state.modules].sort((a, b) => Number(isOscillatorType(b.type)) - Number(isOscillatorType(a.type)))) {
    if (module.pos !== null) continue;
    const vacancies = state.cells.filter((c) => !state.modules.some((m) => m.pos && sameHex(m.pos, c)));
    let best: Hex | undefined;
    let bestScore = -1;
    for (const pos of vacancies) {
      module.pos = pos;
      const rates = computeRates(state, true);
      const score = rates.rate + rates.forgeRate;
      if (score > bestScore) { bestScore = score; best = pos; }
    }
    module.pos = null;
    if (best) expect(placeModule(state, module.id, best).ok).toBe(true);
  }
  // Five-level gestures over every deployed synthesizer, cheapest voice
  // first — the low-tail sweep raises the whole chorus until the bank runs
  // dry (the bank-limited shape the bulk ladder ships, over the grown
  // roster the diluted pool and the keyed generators now carry).
  const synths = state.modules.filter((m) => m.pos && isOscillatorType(m.type)).sort((a, b) => a.level - b.level);
  for (const module of synths) upgradeModuleLevels(state, module.id, 5);
}

function scenario(seed: number, shape: "compact" | "fifths") {
  const state = createInitialState();
  const rng = seeded(seed);
  const rows = [];
  const crossings = new Map<number, number>();
  for (let session = 1; session <= 48; session++) {
    manage(state, shape);
    expect(startSession(state, 1800, (session - 1) * 1800000).ok).toBe(true);
    // One jotting per session — the Note Generator's console fact
    // (ADR-0047), credited by character count under the cap.
    writeNote(state, "keep the shoulders down and the wrist loose through the scale run");
    // Minute steps bound achievement and charge-boundary timing, and
    // record the first crossing to within one minute of credited play.
    for (let minute = 1; minute <= 30; minute++) {
      advance(state, 60, rng);
      for (const threshold of THRESHOLDS) {
        if (state.eraEarned >= threshold && !crossings.has(threshold)) crossings.set(threshold, (session - 1) * 30 + minute);
      }
    }
    expect(endSession(state, session * 1800000).ok).toBe(true);
    rows.push({ session, earned: state.eraEarned, cells: state.cells.length, synths: state.modules.filter((m) => m.pos && isOscillatorType(m.type)).length });
  }
  return { state, rows, crossings };
}

describe("first Arete tuning (#157)", () => {
  it("records expansion and board-choice sensitivity beyond the five-session checkpoint", () => {
    const report = [];
    for (const shape of ["compact", "fifths"] as const) for (const seed of [157, 42, 2026]) {
      const { state, rows, crossings } = scenario(seed, shape);
      expect(rows[4]!.cells).toBeGreaterThan(3);
      expect(state.cells.every((c) => positionInRange(state, c))).toBe(true);
      expect(state.eraEarned).toBe(state.totalEarned);
      expect(state.arete).toBe(0);
      expect(Number.isFinite(state.eraEarned)).toBe(true);
      report.push({ shape, seed, fiveSessionNous: Math.round(rows[4]!.earned), fiveSessionCells: rows[4]!.cells,
        ...Object.fromEntries(THRESHOLDS.map((threshold) => [String(threshold), crossings.get(threshold) ?? ">1440"])),
        earned16h: rows[31]!.earned.toExponential(4), synths16h: rows[31]!.synths,
        earned24h: rows[47]!.earned.toExponential(4), synths24h: rows[47]!.synths,
        horizonSession: rows.find((r) => r.earned >= ARETE_HORIZON)?.session ?? ">48", finalCells: state.cells.length,
      });
      if (shape === "compact") {
        expect(horizonReached(state)).toBe(true);
        expect(prestige(state).ok).toBe(true);
        expect(state.arete).toBe(1);
        expect(state.eraEarned).toBe(0);
      }
    }
    console.table(report);
  }, 60_000);
});
