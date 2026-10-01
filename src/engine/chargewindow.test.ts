import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, pauseSession, resumeSession, startSession } from "./actions";
import { createHabit, addPracticeLog } from "./habits";
import { computeRates } from "./economy";
import { fresh, give, stubRng } from "./fixtures";
import { serialize, deserialize } from "./save";
import { hex } from "./hex";

// The generator's charge window (§2.3, ADR-0012; ADR-0018 made the
// focus-keyed generator the launch generator): ending any session banks a
// window of fraction × live practice time — the tuning fraction is 0.1, so
// a 600 s session banks 60 s — spent as the generator's output during the
// next session's first minutes. Charge is an across-session reserve, never
// a live drip.

describe("the charge window", () => {
  it("every session end banks fraction × live practice time", () => {
    const planned = fresh();
    startSession(planned, 600);
    advance(planned, 600);
    endSession(planned);
    // 0.1 × 600 s of practice banks a 60 s window.
    expect(planned.chargeWindow).toBeCloseTo(60, 6);

    const openEnded = fresh();
    startSession(openEnded, null);
    advance(openEnded, 300);
    endSession(openEnded);
    expect(openEnded.chargeWindow).toBeCloseTo(30, 6);
  });

  it("a session banks exactly once, whatever its shape or exit", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 100);
    pauseSession(s);
    endSession(s);
    expect(s.chargeWindow).toBeCloseTo(10, 6);
    endSession(s);
    expect(s.chargeWindow).toBeCloseTo(10, 6);
  });

  it("only live flow banks: paused time is not practice", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 100);
    pauseSession(s);
    resumeSession(s);
    advance(s, 100);
    endSession(s);
    expect(s.chargeWindow).toBeCloseTo(20, 6);
  });

  it("manual practice logs never bank or simulate charge activity", () => {
    const s = fresh();
    const habit = createHabit(s, "Piano");
    expect(habit.ok).toBe(true);
    expect(addPracticeLog(s, habit.habit!.id, 45).ok).toBe(true);
    expect(s.chargeWindow).toBe(0);

    // Ending a session with no live time banks nothing either.
    startSession(s, null);
    endSession(s);
    expect(s.chargeWindow).toBe(0);
  });

  it("the window is spent as the focus-keyed generator's output early in the next session", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(s.chargeWindow).toBeCloseTo(60, 6);

    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    startSession(s, null);
    const rng = stubRng(new Array(12).fill(0.5));
    advance(s, 60, rng);
    // The prep session's 600 credited seconds crossed only the flow meter's
    // opening fill (ADR-0041) — this branch starts clean. The measured 60 s
    // adds strength 1 × 60 s of window charge: the 60 threshold crosses.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.chargeWindow).toBeCloseTo(0, 6);

    // The window is empty: the next minute moves this branch by nothing —
    // practice is the flow meter's diet, filling on beside it.
    advance(s, 60, rng);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.forge.earned).toBe(1);
    expect(s.flow.progress).toBeCloseTo(540, 6);
  });

  it("the window buys charge, never nous: the board's rate is unchanged", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));

    startSession(s, null);
    const before = s.nous;
    // Board production only (0.1 ν/s) — the window buys charge, never nous —
    // scaled by the boost leg in force during the step (ADR-0015).
    const boost = computeRates(s, true).achievementBoost;
    advance(s, 60);
    expect(s.nous - before).toBeCloseTo(0.1 * 60 * boost, 6);
  });

  it("window time elapses during flow even without eligible neighbors", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    give(s, "focusKeyed", hex(2, 0));

    startSession(s, null);
    advance(s, 60);
    expect(s.chargeWindow).toBeCloseTo(0, 6);
  });

  it("an undeployed focus-keyed generator produces nothing and the window holds", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    give(s, "focusKeyed", null);

    startSession(s, null);
    advance(s, 600);
    expect(s.chargeWindow).toBeCloseTo(60, 6);
  });

  it("pausing freezes the window; the drained window yields no output", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));

    startSession(s, null);
    advance(s, 30);
    expect(s.chargeWindow).toBeCloseTo(30, 6);
    pauseSession(s);
    advance(s, 100);
    expect(s.chargeWindow).toBeCloseTo(30, 6);
    resumeSession(s);
    advance(s, 30);
    expect(s.chargeWindow).toBeCloseTo(0, 6);
    // The window drained across the two live legs — 30 + 30 charge — over
    // this branch's clean start (the prep session filled only the flow
    // meter): the 60 threshold crosses at the end, and the pause moved
    // nothing.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.flow.progress).toBeCloseTo(480, 6);
  });

  it("windows stack by extending the remaining duration, never the strength", () => {
    const s = fresh();
    for (let i = 0; i < 2; i++) {
      startSession(s, 600);
      advance(s, 600);
      endSession(s);
    }
    expect(s.chargeWindow).toBeCloseTo(120, 6);

    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    startSession(s, null);
    advance(s, 120, stubRng(new Array(12).fill(0.5)));
    // The measured 120 s adds charge at constant strength 1 (the second
    // window extended the first instead of amplifying it): the 60 threshold
    // crosses, 60 carries into the 90. Practice filled only the flow meter.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(60, 6);
    expect(s.chargeWindow).toBeCloseTo(0, 6);
    expect(s.flow.progress).toBeCloseTo(1140, 6);
  });

  it("a step that outlives the window splits at the boundary, never over-crediting", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    startSession(s, null);
    // One 100 s step across the 60 s window — as a throttled tab's catch-up
    // tick would take: the drained generator credits only 60 s of it, and
    // the step's remaining 40 s run uncharged.
    advance(s, 100, stubRng(new Array(12).fill(0.5)));
    expect(s.chargeWindow).toBeCloseTo(0, 6);
    // Over this branch's clean start: the charged 60 s leg adds 60 charge —
    // the threshold crosses exactly — and the drained 40 s leg adds nothing.
    // The split never over-credits.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.session!.elapsed).toBeCloseTo(100, 6);
  });

  it("every generator spends the window: an empty window means silence (ADR-0018)", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    startSession(s, null);
    advance(s, 10);
    // No window is banked yet — session one only accrues it — so no charge
    // flows at all (charge is a reserve, never a live drip). This branch
    // stays silent; the 10 credited seconds fill the flow meter (ADR-0041).
    expect(computeRates(s, true).forgeRate).toBe(0);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.flow.progress).toBeCloseTo(10, 6);
    expect(s.chargeWindow).toBe(0);
  });

  it("the charge window survives a save round-trip", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    const result = deserialize(serialize(s, 1234));
    expect(result.error).toBeUndefined();
    expect(result.state!.chargeWindow).toBeCloseTo(60, 6);
  });
});
