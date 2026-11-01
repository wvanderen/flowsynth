import { describe, expect, it } from "vitest";
import { allocateRates, levelCost, responseSupportPowerOf } from "../src/engine/economy";
import { BALANCE } from "../src/engine/constants";
import { tierPowerOf } from "../src/engine/module-strength";
import { fresh, give } from "../src/engine/fixtures";
import { hex } from "../src/engine/hex";
import { PHENOMENON_BOARDS, phenomenonState, suppliedBoardState, type PhenomenonBoard } from "./response-comparison";

// The adopted response-support progression's real-board checks (issue
// #488, parent #484 stories 7–14). Production reads the bounded level
// term from BALANCE (issue #487's comparison evidence chose the shape);
// these cases walk the comparison's own phenomenon rigs — real allocated
// boards through the engine's one rate path — under the shipped curve:
// the level-zero grant, marginal growth across the sweep (the
// intermediate acceleration an asymptotic-only test would miss), the
// whole capacity ladder, the merge ladder's top, and the structures the
// adoption must not move.

// The marginal sweep: the comparison's declared levels, denser in the
// intermediate band where the adoption's turn from acceleration to
// saturation has to land.
const SWEEP: readonly number[] = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

// The boards whose production rides a response grant — the marginal
// sweep walks each. The amplitude control and the capacity rig have
// their own cases below.
const RESPONSE_RIGS: readonly string[] = [
  "chorus-stack",
  "exciter-producer",
  "sideband-conversion",
  "multi-support",
  "silent-voices",
  "conduit-chain",
  "merge-extremes",
];

const board = (name: string): PhenomenonBoard =>
  PHENOMENON_BOARDS.find((candidate) => candidate.name === name)!;

const rateAt = (name: string, level: number): number =>
  allocateRates(phenomenonState(board(name), level, 5, "shipped"), true).snapshot.rate;

// The envelope's own marginal definition: next level's cost/rate over
// this level's, one ladder step at a time — above one means the next
// level takes longer.
const stepRatio = (rate: (level: number) => number, level: number): number =>
  levelCost(level + 1) / rate(level + 1) / (levelCost(level) / rate(level));

describe("the adopted response progression on real boards", () => {
  it("keeps the level-zero grant: every rig's supports read exactly tier × plane at level zero", () => {
    for (const name of RESPONSE_RIGS) {
      const state = phenomenonState(board(name), 0, 5, "shipped");
      for (const support of state.modules.filter((m) => m.type === "chorus" || m.type === "exciter")) {
        // The merge tier rides the level term — a tiered support's
        // level-zero grant is exactly its tier strength, the parity the
        // comparison recorded.
        expect(responseSupportPowerOf(state, support)).toBe(tierPowerOf(support.tier));
      }
    }
  });

  it("marginal growth: the supplied board accelerates through the intermediate levels, then slows; every response rig stays finite and slows at the top", () => {
    // The small rigs: every swept rate inside the representable range,
    // and the next level always costs more waiting time than the last —
    // their few legs cannot outrun the ladder, so no runaway survives.
    for (const name of RESPONSE_RIGS) {
      for (const level of SWEEP) expect(Number.isFinite(rateAt(name, level))).toBe(true);
      expect(stepRatio((level) => rateAt(name, level), SWEEP.at(-1)!)).toBeGreaterThan(1);
    }
    // The supplied board — thirty merged copies under twenty chord
    // instances — carries the shape the whole adoption is about: the
    // single-step ratios dip below one through the intermediate board
    // (beyond the opening level, where an asymptotic-only test would
    // never look) and cross above one before the sweep's end. The
    // acceleration half lives here alone because it can only live here:
    // the phenomenon rigs' few legs never outrun the ladder early, so
    // their ratios start above one — measured, not assumed — and the
    // dense board is the honest intermediate-acceleration witness.
    const supplied = (level: number): number => allocateRates(suppliedBoardState(level, 5, "shipped"), true).snapshot.rate;
    const ratios = SWEEP.map((level) => stepRatio(supplied, level));
    expect(Math.min(...ratios.slice(1))).toBeLessThan(1);
    expect(ratios.at(-1)).toBeGreaterThan(1);
  });

  it("solves certified at every swept level — the adopted curve never forces an incumbent", () => {
    for (const name of RESPONSE_RIGS) {
      for (const level of SWEEP) {
        const rates = allocateRates(phenomenonState(board(name), level, 5, "shipped"), true);
        expect(rates.read.certified).toBe(true);
      }
    }
  });

  it("holds the grants across the whole reachable capacity ladder on a chord-carrying rig", () => {
    let previousRate = -1;
    let previousInstances = -1;
    for (let capacity = 1; capacity <= 5; capacity++) {
      const state = phenomenonState(board("chorus-stack"), 100, capacity, "shipped");
      const rates = allocateRates(state, true);
      expect(Number.isFinite(rates.snapshot.rate)).toBe(true);
      expect(rates.snapshot.rate).toBeGreaterThanOrEqual(previousRate);
      expect(rates.read.instances.length).toBeGreaterThanOrEqual(previousInstances);
      expect(rates.read.certified).toBe(true);
      previousRate = rates.snapshot.rate;
      previousInstances = rates.read.instances.length;
    }
  });

  it("rides the merge ladder's top: a tier-5 Chorus grants the adopted term × the ladder's end strength", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    const chorus = give(s, "chorus", hex(1, -1), 100);
    chorus.tier = 5;
    const term = 1 + (BALANCE.responseShare * 100) / (100 + BALANCE.responseSaturation);
    expect(responseSupportPowerOf(s, chorus)).toBeCloseTo(term * BALANCE.tierPower[5]!, 9);
    // And the power mutator's plane multiplies on top, the one read the
    // rate pass composes.
    s.mutators.push({ id: "mu-p", family: "power", rarity: "common", pos: hex(1, -1) });
    expect(responseSupportPowerOf(s, chorus)).toBeCloseTo(term * BALANCE.tierPower[5]! * 1.5, 9);
  });

  it("keeps the chord effects member-local: a silent voice sings its own response, the granted oscillator earns the grant in production", () => {
    const build = (supportLevel: number) => {
      const s = fresh();
      give(s, "additive", hex(1, 0));
      give(s, "harmonizer", hex(-1, 0)); // chords with the opening, out of the Chorus's reach
      give(s, "chorus", hex(1, -1), supportLevel); // adjacent to the additive alone
      return allocateRates(s, false).snapshot;
    };
    const quiet = build(0);
    const lifted = build(100);
    const silentOf = (snapshot: ReturnType<typeof build>) =>
      [...snapshot.contributions.values()].find((c) => c.type === "harmonizer")!;
    const quietSilent = silentOf(quiet);
    const liftedSilent = silentOf(lifted);
    // The silent voice sings the chord — factor over one, value exactly
    // zero — and its factor is its own response: no grant lands on it, so
    // levelling the Chorus beside its fellow voice never moves it.
    expect(quietSilent.value).toBe(0);
    expect(quietSilent.chordFactor).toBeGreaterThan(1);
    expect(liftedSilent.chordFactor).toBe(quietSilent.chordFactor);
    // The granted oscillator earns the adopted grant inside the same
    // instance — its factor and its actual production both lift.
    const voiceOf = (snapshot: ReturnType<typeof build>) =>
      [...snapshot.contributions.values()].find((c) => c.type === "additive")!;
    expect(voiceOf(lifted).chordFactor!).toBeGreaterThan(voiceOf(quiet).chordFactor!);
    expect(voiceOf(lifted).value).toBeGreaterThan(voiceOf(quiet).value);
    expect(voiceOf(lifted).value).toBeGreaterThan(0);
  });

  it("never moves a board without response supports — the Tail's lasting foundation rides untouched", () => {
    const build = (withCandidates: boolean) => {
      const s = fresh();
      const tail = give(s, "tail", hex(1, 0), 500);
      void tail;
      const generator = give(s, "focusKeyed", hex(0, -1), 0);
      generator.reserve = 600;
      if (withCandidates) s.candidates = { responseCurve: "bounded" };
      return allocateRates(s, true).snapshot.rate;
    };
    expect(build(false)).toBe(build(true));
    // The amplitude control agrees across the whole sweep: no response
    // support, no curve anywhere.
    for (const level of SWEEP) {
      const shipped = rateAt("amplitude-support", level);
      for (const curve of ["linear", "bounded"] as const) {
        expect(allocateRates(phenomenonState(board("amplitude-support"), level, 5, curve), true).snapshot.rate).toBe(shipped);
      }
    }
  });
});
