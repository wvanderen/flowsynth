import { describe, expect, it } from "vitest";
import {
  CHARGED,
  NAKED,
  REPICK,
  RESPONDERS,
  SPECIALISTS,
  STARTER,
  TEMPORAL,
  flywheelReserveAfter,
  runArcPair,
} from "./breather-calibration";
import { endSession, startBreather, startSession } from "./actions";
import { createInitialState } from "./state";
import { seededRng } from "./capacity-calibration";
import { advance } from "./advance";
import { writeNote } from "./notes";
import { BREATHER } from "./constants";
import type { BoardBuilder } from "./breather-calibration";
import type { GameState } from "./types";
;

// The breather's production-economy gate (issue #417): the adopted
// figures' pacing record, read as observable arc outcomes on the sample
// niches — never coefficient tables. The evidence behind every band is
// the arc battery recorded in docs/breather-tuning.md; the tuning note
// owns the rationale, this gate pins the behavior the note describes. A
// moved figure must re-record the note beside it, then re-band this gate.

const SEED = 157;

function pair(board: BoardBuilder, seed: number = SEED) {
  return runArcPair(board, seed);
}

describe("the breather's honest worth (priority 1)", () => {
  it("a breather is worth taking: the boosted minute out-produces the practice minute wherever a response is authored", () => {
    const NICHES: readonly [string, BoardBuilder][] = [
      ["starter", STARTER],
      ["charged", CHARGED],
      ["temporal", TEMPORAL],
      ["responders", RESPONDERS],
      ["specialists", SPECIALISTS],
    ];
    for (const [name, board] of NICHES) {
      const { taken } = pair(board);
      expect(taken.allowanceSeconds).toBe(300);
      // The boosted yield per minted minute rides above the flow mean —
      // the response-scaled rate is a real raise, never a disguised tax.
      expect(taken.boostedPerMintedMinute, name).toBeGreaterThan(1);
    }
  });

  it("a breather never dwarfs the session that minted it", () => {
    const NICHES: readonly [string, BoardBuilder][] = [
      ["naked", NAKED],
      ["starter", STARTER],
      ["charged", CHARGED],
      ["temporal", TEMPORAL],
      ["responders", RESPONDERS],
      ["specialists", SPECIALISTS],
    ];
    for (const [name, board] of NICHES) {
      const { taken } = pair(board);
      // The 1:5 divisor times any launched response stays well under half
      // the minting session — the paid rest tracks the allowance's length
      // in flow-equivalent production.
      expect(taken.dwarfRatio, name).toBeGreaterThan(0.15);
      expect(taken.dwarfRatio, name).toBeLessThan(0.4);
    }
  });

  it("the absent mark reads exactly ×1, board-wide: the naked board's breather is the flow mean", () => {
    const { taken } = pair(NAKED);
    // The Sine authors no breather response and the warmup session has
    // already earned every boost the board can carry — the breather
    // minute equals the practice minute exactly.
    expect(taken.boostedPerMintedMinute).toBeCloseTo(1, 9);
    expect(taken.dwarfRatio).toBeCloseTo(0.2, 6);
  });

  it("the gate and the cap bound the mint both ways", () => {
    // Exactly ten credited minutes mint the smallest allowance; a
    // 90-minute session mints the cap, whose dwarf compresses the long
    // sessions the allowance formula would otherwise scale with.
    const gate = minting(600);
    expect(gate).toBe(120);
    const cap = minting(5400);
    expect(cap).toBe(BREATHER.capSeconds);
  });
});

describe("reserve and forge pacing across the boundary (priority 2)", () => {
  it("the reserve drains at the unboosted strength: generators carry no breather response", () => {
    const s = arcBoard(STARTER);
    const rng = seededRng(SEED);
    startSession(s, null, 0);
    writeNote(s, "keep the shoulders down and the wrist loose through the scale run");
    for (let i = 0; i < 25; i++) advance(s, 60, rng);
    endSession(s, 1500);
    startBreather(s, 1000);
    // The Flywheel banked 150 at close; one breather minute later the
    // reserve reads the plain 1/s drain — 90, not the ~78 a ×1.2 boost
    // on the drain would leave.
    expect(flywheelReserveAfter(s, 60, rng)).toBeCloseTo(90, 6);
    // The forge meters turned on that charge and banked a roll.
    expect(s.forge.progress + s.forge.earned).toBeGreaterThan(0);
    expect(s.forge.earned).toBeGreaterThanOrEqual(1);
  });

  it("the next session's opening pays a bounded, recovered cost — the arc never goes behind", () => {
    for (const [name, board] of [["starter", STARTER], ["charged", CHARGED], ["temporal", TEMPORAL], ["responders", RESPONDERS], ["specialists", SPECIALISTS]] as const) {
      const { taken, declined } = pair(board);
      // The opening window is the drain's visible cost — bounded well
      // above half of the control's, and the reserve the breather spent
      // produced at the boosted rate while it lasted.
      expect(taken.nextOpeningEarned / declined.nextOpeningEarned, name).toBeGreaterThan(0.6);
      // The session that follows recovers: the whole-session cost stays
      // under ten percent.
      expect(taken.nextSessionEarned / declined.nextSessionEarned, name).toBeGreaterThan(0.9);
      // And the arc as a whole is strictly ahead: session + breather +
      // next session beats session + next session declined.
      const takenArc = taken.sessionEarned + taken.breatherEarned + taken.nextSessionEarned;
      const declinedArc = declined.sessionEarned + declined.nextSessionEarned;
      expect(takenArc / declinedArc, name).toBeGreaterThan(1.05);
    }
  });

  it("the temporal clock advances through the breather and resets at the next session", () => {
    const { taken } = pair(TEMPORAL);
    // The departed session's 25 minutes plus the breather's five.
    expect(taken.clockAfterBreather).toBe(1800);
    // The Afterglow breathes at its peak warmth and re-warms from cold
    // when the next session opens (breather-spec §1).
    expect(taken.afterglowDuringBreather).toBe(1.25);
    expect(taken.afterglowAtNextOpen).toBe(0.3);
  });
});

describe("the allocation across the breather boundary", () => {
  it("the mode join re-solves exactly once and the retained optimum never thrashes", () => {
    for (const [name, board] of [["naked", NAKED], ["starter", STARTER], ["charged", CHARGED], ["temporal", TEMPORAL], ["responders", RESPONDERS], ["specialists", SPECIALISTS]] as const) {
      const { taken } = pair(board);
      // Exactly one solve at the mode change — the fingerprint's mode leg
      // is the boundary, never a per-tick key.
      expect(taken.joinSolves, name).toBe(1);
      // No mid-breather key movement on the launch niches: the retained
      // optimum carries across the boundary.
      expect(taken.keyMoves, name).toBe(0);
      expect(taken.keySets, name).toBe(1);
      expect(taken.retainedExact, name).toBe(true);
    }
  });

  it("a differing breather optimum re-picks coherently: the join's re-pick holds and retention stays equal-output", () => {
    const { taken } = pair(REPICK);
    // The upgrade-quiet read holds the Fifth; the charged, breathing
    // read re-picks to the Flat seventh — the re-pick the boundary
    // produces on this niche.
    expect(taken.flowKeys).toEqual(["Fifth|0|m1,m2"]);
    expect(taken.breatherKeys).toEqual(["Flat seventh|0|m1,m4"]);
    expect(taken.joinSolves).toBe(1);
    // The re-pick is stable: piecewise-constant keys across the whole
    // walk, one set after the join, never falling short of a cold solve.
    expect(taken.keyMoves).toBe(0);
    expect(taken.keySets).toBe(1);
    expect(taken.retainedExact).toBe(true);
  });
});

describe("specialist headroom (priority 3)", () => {
  it("the launch spread reads clearly under the S band on same-shape boards", () => {
    // Same board shape, different voices: the launch responders' breather
    // yield per minted minute sits well below the specialists'.
    const launch = pair(RESPONDERS).taken;
    const specialist = pair(SPECIALISTS).taken;
    expect(launch.boostedPerMintedMinute).toBeGreaterThan(1);
    expect(specialist.boostedPerMintedMinute).toBeGreaterThan(launch.boostedPerMintedMinute * 1.2);
    // The whole breather stays a smaller share of its minting session.
    expect(specialist.dwarfRatio).toBeLessThan(0.4);
  });
});

// ── Arc plumbing ─────────────────────────────────────────────────────

function arcBoard(board: BoardBuilder): GameState {
  const state = createInitialState();
  board(state);
  return state;
}

function minting(creditedSeconds: number): number {
  const s = arcBoard(NAKED);
  const rng = seededRng(SEED);
  startSession(s, null, 0);
  for (let i = 0; i < creditedSeconds / 60; i++) advance(s, 60, rng);
  endSession(s, creditedSeconds);
  return s.summary?.breatherAllowance ?? 0;
}
